import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useRef, useState } from "react";
import {
  listProductAttributesFn,
  listProductVariantsFn,
  adminUpsertVariantFn,
  adminDeleteVariantFn,
  adminGenerateVariantsFn,
  type ProductAttribute,
  type ProductVariant,
} from "@/lib/product-variants.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { usePriceFormatter } from "@/lib/currency";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  Trash2,
  Upload,
  Wand2,
} from "lucide-react";
import { MediaPicker } from "@/components/admin/MediaLibrary";

type Pool = { id: string; name: string };

function usePools() {
  return useQuery({
    queryKey: ["variant-pool-options"],
    queryFn: async () => {
      const [inv, sub, lic] = await Promise.all([
        (supabase as any).from("inventory_pools").select("id, name").order("name"),
        (supabase as any).from("subscription_accounts").select("id, account_email, provider").order("account_email"),
        (supabase as any).from("license_pools").select("id, name").order("name"),
      ]);
      return {
        inventory: ((inv.data ?? []) as any[]).map((r) => ({ id: r.id, name: r.name })) as Pool[],
        subscription: ((sub.data ?? []) as any[]).map((r) => ({
          id: r.id,
          name: `${r.provider ?? ""} ${r.account_email ?? r.id}`.trim(),
        })) as Pool[],
        license: ((lic.data ?? []) as any[]).map((r) => ({ id: r.id, name: r.name })) as Pool[],
      };
    },
  });
}

/* ---------------- health / diagnostics ---------------- */

type Health = { warnings: string[]; ok: boolean };
function computeHealth(v: ProductVariant, dupSkuSet: Set<string>): Health {
  const w: string[] = [];
  if (!v.sku || !v.sku.trim()) w.push("Missing SKU");
  if (Number(v.price ?? 0) <= 0) w.push("Missing Price");
  const hasPool = !!(v.inventory_pool_id || v.subscription_pool_id || v.license_pool_id);
  if (!hasPool && v.delivery_type !== "external_url" && v.delivery_type !== "manual")
    w.push("No Pool");
  if (v.visibility === "hidden") w.push("Hidden");
  if (v.status === "inactive") w.push("Disabled");
  if (v.stock != null && Number(v.stock) === 0) w.push("Out of Stock");
  else if (v.stock != null && Number(v.stock) > 0 && Number(v.stock) <= 3) w.push("Low Stock");
  if (v.sku && dupSkuSet.has(v.sku.trim().toLowerCase())) w.push("Duplicate SKU");
  return { warnings: w, ok: w.length === 0 };
}

/* ---------------- CSV helpers ---------------- */

function toCsv(rows: ProductVariant[]): string {
  const header = [
    "id", "name", "sku", "price", "sale_price", "stock", "status",
    "visibility", "delivery_type", "inventory_pool_id", "subscription_pool_id",
    "license_pool_id", "thumbnail_url",
  ];
  const esc = (v: unknown) => {
    if (v == null) return "";
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [
    header.join(","),
    ...rows.map((r) => header.map((h) => esc((r as any)[h])).join(",")),
  ].join("\n");
}
function parseCsv(text: string): Record<string, string>[] {
  const lines = text.replace(/\r/g, "").split("\n").filter((l) => l.length > 0);
  if (lines.length === 0) return [];
  const split = (line: string) => {
    const out: string[] = [];
    let cur = "", inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (inQ) {
        if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (c === '"') inQ = false;
        else cur += c;
      } else {
        if (c === ",") { out.push(cur); cur = ""; }
        else if (c === '"') inQ = true;
        else cur += c;
      }
    }
    out.push(cur);
    return out;
  };
  const headers = split(lines[0]).map((h) => h.trim());
  return lines.slice(1).map((l) => {
    const cells = split(l);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => (row[h] = cells[i] ?? ""));
    return row;
  });
}
function downloadFile(name: string, contents: string, mime = "text/csv") {
  const blob = new Blob([contents], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

/* ---------------- component ---------------- */

export function VariantsTab({ productId }: { productId: string }) {
  const listAttrs = useServerFn(listProductAttributesFn);
  const listVars = useServerFn(listProductVariantsFn);
  const upsert = useServerFn(adminUpsertVariantFn);
  const del = useServerFn(adminDeleteVariantFn);
  const generate = useServerFn(adminGenerateVariantsFn);
  const qc = useQueryClient();

  const attrsKey = ["admin-attributes", productId];
  const varsKey = ["admin-variants", productId];
  const { data: attrs = [] } = useQuery({ queryKey: attrsKey, queryFn: () => listAttrs({ data: { productId } }) });
  const { data: variants = [], isLoading } = useQuery({
    queryKey: varsKey,
    queryFn: () => listVars({ data: { productId } }),
  });
  const { data: pools } = usePools();

  const invalidate = () => qc.invalidateQueries({ queryKey: varsKey });

  /* filters */
  const [q, setQ] = useState("");
  const [statusF, setStatusF] = useState("");
  const [visF, setVisF] = useState("");
  const [poolF, setPoolF] = useState("");
  const [deliveryF, setDeliveryF] = useState("");
  const [healthF, setHealthF] = useState<"" | "missing_sku" | "missing_price" | "low_stock" | "oos" | "inactive" | "dupe_sku">("");

  const dupSkuSet = useMemo(() => {
    const counts = new Map<string, number>();
    for (const v of variants as ProductVariant[]) {
      const s = (v.sku ?? "").trim().toLowerCase();
      if (!s) continue;
      counts.set(s, (counts.get(s) ?? 0) + 1);
    }
    return new Set([...counts.entries()].filter(([, n]) => n > 1).map(([s]) => s));
  }, [variants]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (variants as ProductVariant[]).filter((v) => {
      if (statusF && v.status !== statusF) return false;
      if (visF && v.visibility !== visF) return false;
      if (deliveryF && (v.delivery_type ?? "") !== deliveryF) return false;
      if (poolF) {
        const anyPool = [v.inventory_pool_id, v.subscription_pool_id, v.license_pool_id].some((p) => p === poolF);
        if (!anyPool) return false;
      }
      if (healthF === "missing_sku" && (v.sku ?? "").trim()) return false;
      if (healthF === "missing_price" && Number(v.price ?? 0) > 0) return false;
      if (healthF === "low_stock" && !(v.stock != null && v.stock > 0 && v.stock <= 3)) return false;
      if (healthF === "oos" && !(v.stock != null && v.stock === 0)) return false;
      if (healthF === "inactive" && v.status !== "inactive") return false;
      if (healthF === "dupe_sku" && !dupSkuSet.has((v.sku ?? "").trim().toLowerCase())) return false;
      if (!term) return true;
      const hay = [
        v.name, v.sku, v.delivery_type,
        ...Object.entries(v.attributes ?? {}).map(([k, val]) => `${k}:${val}`),
      ].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(term);
    });
  }, [variants, q, statusF, visF, poolF, deliveryF, healthF, dupSkuSet]);

  /* summary */
  const summary = useMemo(() => {
    const rows = variants as ProductVariant[];
    const visible = rows.filter((v) => v.visibility !== "hidden").length;
    const hidden = rows.length - visible;
    const oos = rows.filter((v) => v.stock != null && v.stock === 0).length;
    const invAssigned = rows.filter((v) => !!v.inventory_pool_id).length;
    const subAssigned = rows.filter((v) => !!v.subscription_pool_id).length;
    const licAssigned = rows.filter((v) => !!v.license_pool_id).length;
    const healthy = rows.filter((v) => computeHealth(v, dupSkuSet).ok).length;
    const healthPct = rows.length === 0 ? 0 : Math.round((healthy / rows.length) * 100);
    return { total: rows.length, visible, hidden, oos, invAssigned, subAssigned, licAssigned, healthPct };
  }, [variants, dupSkuSet]);

  /* selection */
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  const toggleAll = () =>
    setSelected(selected.size === filtered.length ? new Set() : new Set(filtered.map((v) => v.id)));

  /* bulk mutations */
  const bulkUpdate = useMutation({
    mutationFn: async (patch: Record<string, any>) => {
      const rows = (variants as ProductVariant[]).filter((v) => selected.has(v.id));
      for (const v of rows) await upsert({ data: { ...toUpsert(v), ...patch } });
    },
    onSuccess: () => { toast.success("Bulk update applied"); setSelected(new Set()); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });
  const bulkDelete = useMutation({
    mutationFn: async () => { for (const id of selected) await del({ data: { id } }); },
    onSuccess: () => { toast.success("Deleted"); setSelected(new Set()); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });
  const bulkDuplicate = useMutation({
    mutationFn: async () => {
      const rows = (variants as ProductVariant[]).filter((v) => selected.has(v.id));
      for (const v of rows) {
        const clone = toUpsert(v);
        (clone as any).id = undefined;
        clone.name = `${v.name} (copy)`;
        clone.sku = v.sku ? `${v.sku}-copy` : null;
        await upsert({ data: clone });
      }
    },
    onSuccess: () => { toast.success("Duplicated"); setSelected(new Set()); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });

  /* generator */
  const [genPrice, setGenPrice] = useState<string>("");
  const combos = useMemo(() => {
    const groups = (attrs as ProductAttribute[]).filter((a) => a.options.length > 0);
    if (!groups.length) return 0;
    return groups.reduce((n, g) => n * g.options.length, 1);
  }, [attrs]);
  const missing = Math.max(0, combos - (variants as ProductVariant[]).length);
  const gen = useMutation({
    mutationFn: () => generate({ data: { product_id: productId, default_price: genPrice ? Number(genPrice) : 0 } }),
    onSuccess: (r: any) => { toast.success(`Generated ${r.created}, skipped ${r.skipped}`); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });

  const hasAttrs = (attrs as ProductAttribute[]).length > 0;

  /* CSV */
  const fileRef = useRef<HTMLInputElement>(null);
  const [importMode, setImportMode] = useState<"prices" | "skus" | "pools">("prices");
  const applyCsvImport = useMutation({
    mutationFn: async (rows: Record<string, string>[]) => {
      const byId = new Map((variants as ProductVariant[]).map((v) => [v.id, v]));
      let count = 0;
      for (const row of rows) {
        const v = byId.get(row.id);
        if (!v) continue;
        const base = toUpsert(v);
        let patch: Record<string, unknown> = {};
        if (importMode === "prices") {
          if (row.price !== "") patch.price = Number(row.price);
          if (row.sale_price !== "") patch.sale_price = row.sale_price === "" ? null : Number(row.sale_price);
          if (Number((patch as any).price) < 0) throw new Error("Negative price in CSV");
        } else if (importMode === "skus") {
          patch.sku = row.sku ?? null;
        } else if (importMode === "pools") {
          if ("inventory_pool_id" in row) patch.inventory_pool_id = row.inventory_pool_id || null;
          if ("subscription_pool_id" in row) patch.subscription_pool_id = row.subscription_pool_id || null;
          if ("license_pool_id" in row) patch.license_pool_id = row.license_pool_id || null;
        }
        await upsert({ data: { ...base, ...patch } });
        count++;
      }
      return count;
    },
    onSuccess: (n) => { toast.success(`Imported ${n} row(s)`); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });
  const onCsvFile = async (file: File) => {
    try {
      const text = await file.text();
      const rows = parseCsv(text);
      if (!rows.length) return toast.error("Empty CSV");
      applyCsvImport.mutate(rows);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div className="space-y-4">
      {/* sticky summary */}
      <div className="sticky top-14 z-10 flex flex-wrap items-center gap-2 rounded-lg border bg-card/95 backdrop-blur p-3">
        <Summary label="Variants" value={summary.total} />
        <Summary label="Visible" value={summary.visible} />
        <Summary label="Hidden" value={summary.hidden} tone={summary.hidden > 0 ? "warn" : "default"} />
        <Summary label="Out of stock" value={summary.oos} tone={summary.oos > 0 ? "warn" : "default"} />
        <Summary label="Inv assigned" value={summary.invAssigned} />
        <Summary label="Sub assigned" value={summary.subAssigned} />
        <Summary label="Lic assigned" value={summary.licAssigned} />
        <Summary label="Health" value={`${summary.healthPct}%`} tone={summary.healthPct >= 80 ? "ok" : "warn"} />
      </div>

      {/* generator */}
      <div className="rounded-lg border p-4 space-y-3">
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <Label>Default price</Label>
            <Input type="number" step="0.01" value={genPrice} onChange={(e) => setGenPrice(e.target.value)} className="w-32" />
          </div>
          <Button
            disabled={!hasAttrs || combos === 0}
            onClick={() => {
              if (!confirm(`Generate up to ${missing} missing variant(s)?`)) return;
              gen.mutate();
            }}
          >
            <Wand2 className="mr-1 h-4 w-4" /> Generate Missing Variants
          </Button>
          <div className="text-sm text-muted-foreground">
            {hasAttrs
              ? `${combos} possible · ${missing} missing`
              : "Add attributes with options first."}
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => downloadFile(`variants-${productId}.csv`, toCsv(variants as ProductVariant[]))}
            >
              <Download className="mr-1 h-4 w-4" /> Export CSV
            </Button>
            <select
              className="h-9 rounded-md border bg-background px-2 text-sm"
              value={importMode}
              onChange={(e) => setImportMode(e.target.value as any)}
              aria-label="Import mode"
            >
              <option value="prices">Import prices</option>
              <option value="skus">Import SKUs</option>
              <option value="pools">Import pools</option>
            </select>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onCsvFile(f);
                e.currentTarget.value = "";
              }}
            />
            <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
              <Upload className="mr-1 h-4 w-4" /> Import CSV
            </Button>
          </div>
        </div>
      </div>

      {/* filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search name, SKU, attribute, delivery…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-xs"
          aria-label="Search variants"
        />
        <select className="h-10 rounded-md border bg-background px-3 text-sm" value={statusF} onChange={(e) => setStatusF(e.target.value)} aria-label="Filter status">
          <option value="">All statuses</option>
          <option value="active">active</option>
          <option value="inactive">inactive</option>
        </select>
        <select className="h-10 rounded-md border bg-background px-3 text-sm" value={visF} onChange={(e) => setVisF(e.target.value)} aria-label="Filter visibility">
          <option value="">All visibility</option>
          <option value="public">public</option>
          <option value="hidden">hidden</option>
        </select>
        <select className="h-10 rounded-md border bg-background px-3 text-sm" value={deliveryF} onChange={(e) => setDeliveryF(e.target.value)} aria-label="Filter delivery type">
          <option value="">All delivery</option>
          <option value="download">Download</option>
          <option value="license_key">License key</option>
          <option value="account">Account</option>
          <option value="manual">Manual</option>
          <option value="external_url">External URL</option>
        </select>
        <select className="h-10 rounded-md border bg-background px-3 text-sm max-w-[200px]" value={poolF} onChange={(e) => setPoolF(e.target.value)} aria-label="Filter pool">
          <option value="">All pools</option>
          {pools?.inventory.map((p) => <option key={p.id} value={p.id}>Inv: {p.name}</option>)}
          {pools?.subscription.map((p) => <option key={p.id} value={p.id}>Sub: {p.name}</option>)}
          {pools?.license.map((p) => <option key={p.id} value={p.id}>Lic: {p.name}</option>)}
        </select>
        <select className="h-10 rounded-md border bg-background px-3 text-sm" value={healthF} onChange={(e) => setHealthF(e.target.value as any)} aria-label="Filter health">
          <option value="">All health</option>
          <option value="missing_sku">Missing SKU</option>
          <option value="missing_price">Missing Price</option>
          <option value="low_stock">Low Stock</option>
          <option value="oos">Out of Stock</option>
          <option value="inactive">Inactive</option>
          <option value="dupe_sku">Duplicate SKU</option>
        </select>
      </div>

      {/* bulk toolbar */}
      {selected.size > 0 && (
        <div className="sticky top-28 z-10 flex flex-wrap items-center gap-2 rounded-lg border bg-background/95 p-3 shadow backdrop-blur">
          <div className="text-sm font-medium">{selected.size} selected</div>
          <BulkNumber label="Set price" onApply={(v) => { if (v < 0) return toast.error("Negative price"); bulkUpdate.mutate({ price: v }); }} />
          <BulkNumber label="Set sale" onApply={(v) => bulkUpdate.mutate({ sale_price: v })} />
          <BulkSelect label="Status" options={[["active", "active"], ["inactive", "inactive"]]} onApply={(v) => bulkUpdate.mutate({ status: v })} />
          <BulkSelect label="Visibility" options={[["public", "public"], ["hidden", "hidden"]]} onApply={(v) => bulkUpdate.mutate({ visibility: v })} />
          <BulkSelect
            label="Delivery"
            options={[["", "— inherit —"], ["download", "Download"], ["license_key", "License"], ["account", "Account"], ["manual", "Manual"], ["external_url", "External URL"]]}
            onApply={(v) => bulkUpdate.mutate({ delivery_type: v || null })}
          />
          <BulkSelect label="Inv pool" options={[["", "— clear —"], ...(pools?.inventory ?? []).map((p) => [p.id, p.name] as [string, string])]} onApply={(v) => bulkUpdate.mutate({ inventory_pool_id: v || null })} />
          <BulkSelect label="Sub pool" options={[["", "— clear —"], ...(pools?.subscription ?? []).map((p) => [p.id, p.name] as [string, string])]} onApply={(v) => bulkUpdate.mutate({ subscription_pool_id: v || null })} />
          <BulkSelect label="Lic pool" options={[["", "— clear —"], ...(pools?.license ?? []).map((p) => [p.id, p.name] as [string, string])]} onApply={(v) => bulkUpdate.mutate({ license_pool_id: v || null })} />
          <Button variant="outline" size="sm" onClick={() => bulkDuplicate.mutate()}>
            <Copy className="mr-1 h-4 w-4" /> Duplicate
          </Button>
          <Button variant="destructive" size="sm" onClick={() => confirm(`Delete ${selected.size}?`) && bulkDelete.mutate()}>
            <Trash2 className="mr-1 h-4 w-4" /> Delete
          </Button>
        </div>
      )}

      {/* grid */}
      <div className="rounded-lg border overflow-hidden">
        <div className="max-h-[70vh] overflow-auto" role="grid" aria-label="Variants">
          <div className="grid grid-cols-[32px_32px_56px_1.4fr_140px_100px_100px_90px_120px_120px_120px_120px_90px_36px] items-center gap-2 sticky top-0 z-10 bg-muted/90 backdrop-blur px-3 py-2 text-xs font-medium text-muted-foreground border-b">
            <Checkbox checked={filtered.length > 0 && selected.size === filtered.length} onCheckedChange={toggleAll} aria-label="Select all" />
            <span />
            <span>Image</span>
            <span>Variant / Attributes</span>
            <span>SKU</span>
            <span className="text-right">Price</span>
            <span className="text-right">Sale</span>
            <span className="text-right">Stock</span>
            <span>Inv Pool</span>
            <span>Sub Pool</span>
            <span>Lic Pool</span>
            <span>Delivery</span>
            <span>Status</span>
            <span />
          </div>
          {isLoading && <div className="p-6 text-muted-foreground">Loading…</div>}
          {!isLoading && filtered.length === 0 && (
            <div className="p-6 text-center text-sm text-muted-foreground">No variants match.</div>
          )}
          <div className="divide-y">
            {filtered.map((v) => (
              <VariantRow
                key={v.id}
                variant={v}
                pools={pools}
                selected={selected.has(v.id)}
                onToggle={() => toggle(v.id)}
                onChanged={invalidate}
                health={computeHealth(v, dupSkuSet)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- small pieces ---------------- */

function Summary({ label, value, tone = "default" }: { label: string; value: number | string; tone?: "default" | "ok" | "warn" }) {
  const cls =
    tone === "ok"
      ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
      : tone === "warn"
        ? "border-amber-400/40 bg-amber-500/10 text-amber-700 dark:text-amber-400"
        : "border-border";
  return (
    <div className={`rounded-md border px-3 py-1.5 text-xs ${cls}`}>
      <span className="text-muted-foreground">{label}: </span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

function BulkNumber({ label, onApply }: { label: string; onApply: (v: number) => void }) {
  const [val, setVal] = useState("");
  return (
    <div className="flex items-center gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <Input type="number" step="0.01" value={val} onChange={(e) => setVal(e.target.value)} className="h-8 w-24" />
      <Button size="sm" variant="secondary" onClick={() => { if (val === "") return; onApply(Number(val)); setVal(""); }}>Apply</Button>
    </div>
  );
}
function BulkSelect({ label, options, onApply }: { label: string; options: [string, string][]; onApply: (v: string) => void }) {
  const [val, setVal] = useState("");
  return (
    <div className="flex items-center gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <select className="h-8 rounded-md border bg-background px-2 text-sm max-w-[140px]" value={val} onChange={(e) => setVal(e.target.value)}>
        <option value="">—</option>
        {options.map(([v, l]) => <option key={v || "_clear"} value={v}>{l}</option>)}
      </select>
      <Button size="sm" variant="secondary" onClick={() => onApply(val)}>Apply</Button>
    </div>
  );
}

function toUpsert(v: ProductVariant): Parameters<typeof adminUpsertVariantFn>[0]["data"] {
  return {
    id: v.id,
    product_id: v.product_id,
    name: v.name,
    sku: v.sku,
    price: Number(v.price),
    sale_price: v.sale_price == null ? null : Number(v.sale_price),
    stock: v.stock,
    stock_status: v.stock_status,
    status: v.status,
    visibility: v.visibility,
    attribute_option_ids: v.attribute_option_ids ?? [],
    thumbnail_url: v.thumbnail_url,
    delivery_type: v.delivery_type,
    inventory_pool_id: v.inventory_pool_id,
    subscription_pool_id: v.subscription_pool_id,
    license_pool_id: v.license_pool_id,
    weight: v.weight,
    dimensions: v.dimensions ?? {},
    sort_order: v.sort_order,
  };
}

/* ---------------- inline editable cell ---------------- */

function InlineCell({
  value,
  type = "text",
  onCommit,
  align = "left",
  placeholder,
  className,
}: {
  value: string | number | null;
  type?: "text" | "number";
  onCommit: (next: string) => void;
  align?: "left" | "right";
  placeholder?: string;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState<string>(value == null ? "" : String(value));
  const display = value == null || value === "" ? (placeholder ?? "—") : String(value);
  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => { setVal(value == null ? "" : String(value)); setEditing(true); }}
        className={`text-${align} truncate w-full hover:bg-muted/60 rounded px-1 py-0.5 ${className ?? ""}`}
        aria-label="Edit cell"
      >
        {display}
      </button>
    );
  }
  return (
    <Input
      autoFocus
      type={type}
      step={type === "number" ? "0.01" : undefined}
      value={val}
      onChange={(e) => setVal(e.target.value)}
      onBlur={() => { setEditing(false); if (val !== (value == null ? "" : String(value))) onCommit(val); }}
      onKeyDown={(e) => {
        if (e.key === "Enter") { e.preventDefault(); (e.currentTarget as HTMLInputElement).blur(); }
        else if (e.key === "Escape") { setVal(value == null ? "" : String(value)); setEditing(false); }
      }}
      className="h-8"
    />
  );
}

/* ---------------- row ---------------- */

function VariantRow({
  variant, pools, selected, onToggle, onChanged, health,
}: {
  variant: ProductVariant;
  pools: ReturnType<typeof usePools>["data"];
  selected: boolean;
  onToggle: () => void;
  onChanged: () => void;
  health: Health;
}) {
  const formatPrice = usePriceFormatter();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => toUpsert(variant));
  const upsert = useServerFn(adminUpsertVariantFn);
  const del = useServerFn(adminDeleteVariantFn);

  const save = useMutation({
    mutationFn: (data?: any) => upsert({ data: data ?? draft }),
    onSuccess: () => { toast.success("Saved"); setOpen(false); onChanged(); },
    onError: (e: any) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: () => del({ data: { id: variant.id } }),
    onSuccess: () => { toast.success("Deleted"); onChanged(); },
    onError: (e: any) => toast.error(e.message),
  });
  const duplicate = useMutation({
    mutationFn: () => {
      const clone: any = { ...toUpsert(variant), id: undefined };
      clone.name = `${variant.name} (copy)`;
      clone.sku = variant.sku ? `${variant.sku}-copy` : null;
      return upsert({ data: clone });
    },
    onSuccess: () => { toast.success("Duplicated"); onChanged(); },
    onError: (e: any) => toast.error(e.message),
  });

  const patch = (partial: Record<string, unknown>) => {
    const next = { ...toUpsert(variant), ...partial };
    if (Number((next as any).price) < 0) return toast.error("Negative price");
    save.mutate(next);
  };

  return (
    <div role="row" aria-selected={selected}>
      <div className="grid grid-cols-[32px_32px_56px_1.4fr_140px_100px_100px_90px_120px_120px_120px_120px_90px_36px] items-center gap-2 px-3 py-2 text-sm">
        <Checkbox checked={selected} onCheckedChange={onToggle} aria-label={`Select ${variant.name}`} />
        <Button variant="ghost" size="icon" onClick={() => setOpen((v) => !v)} aria-label="Expand row">
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </Button>
        <div className="h-10 w-10 rounded bg-muted overflow-hidden group relative">
          {variant.thumbnail_url ? (
            <img src={variant.thumbnail_url} alt="" className="h-full w-full object-cover transition-transform group-hover:scale-110" />
          ) : null}
        </div>
        <div className="min-w-0">
          <InlineCell value={variant.name} onCommit={(v) => patch({ name: v })} className="font-medium" />
          <div className="flex flex-wrap gap-1 text-xs text-muted-foreground mt-0.5">
            {Object.entries(variant.attributes ?? {}).map(([k, val]) => (
              <span key={k} className="rounded bg-muted px-1.5">{k}: {String(val)}</span>
            ))}
            {health.warnings.map((w) => (
              <span key={w} className="inline-flex items-center gap-1 rounded bg-amber-500/10 text-amber-700 dark:text-amber-400 px-1.5">
                <AlertTriangle className="h-3 w-3" /> {w}
              </span>
            ))}
          </div>
        </div>
        <InlineCell value={variant.sku ?? ""} onCommit={(v) => patch({ sku: v || null })} placeholder="SKU" />
        <InlineCell value={Number(variant.price).toFixed(2)} type="number" align="right" onCommit={(v) => patch({ price: Number(v) })} />
        <InlineCell value={variant.sale_price == null ? "" : Number(variant.sale_price).toFixed(2)} type="number" align="right" onCommit={(v) => patch({ sale_price: v === "" ? null : Number(v) })} placeholder="—" />
        <InlineCell value={variant.stock ?? ""} type="number" align="right" onCommit={(v) => patch({ stock: v === "" ? null : Number(v) })} placeholder="—" />
        <RowPoolPicker value={variant.inventory_pool_id} pools={pools?.inventory ?? []} onChange={(v) => patch({ inventory_pool_id: v })} />
        <RowPoolPicker value={variant.subscription_pool_id} pools={pools?.subscription ?? []} onChange={(v) => patch({ subscription_pool_id: v })} />
        <RowPoolPicker value={variant.license_pool_id} pools={pools?.license ?? []} onChange={(v) => patch({ license_pool_id: v })} />
        <select
          className="h-8 rounded-md border bg-background px-1 text-xs"
          value={variant.delivery_type ?? ""}
          onChange={(e) => patch({ delivery_type: e.target.value || null })}
          aria-label="Delivery type"
        >
          <option value="">inherit</option>
          <option value="download">Download</option>
          <option value="license_key">License</option>
          <option value="account">Account</option>
          <option value="manual">Manual</option>
          <option value="external_url">External URL</option>
        </select>
        <div>
          <Badge variant={variant.status === "active" ? "default" : "secondary"}>{variant.status}</Badge>
        </div>
        <div className="flex justify-end gap-0.5">
          <Button variant="ghost" size="icon" onClick={() => duplicate.mutate()} aria-label="Duplicate variant" title="Duplicate">
            <Copy className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => confirm(`Delete ${variant.name}?`) && remove.mutate()} aria-label="Delete variant">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {open && (
        <div className="border-t bg-muted/20 p-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <Field label="Name"><Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></Field>
            <Field label="SKU"><Input value={draft.sku ?? ""} onChange={(e) => setDraft({ ...draft, sku: e.target.value })} /></Field>
            <Field label="Price"><Input type="number" step="0.01" value={String(draft.price)} onChange={(e) => setDraft({ ...draft, price: Number(e.target.value) })} /></Field>
            <Field label="Sale price">
              <Input type="number" step="0.01" value={draft.sale_price == null ? "" : String(draft.sale_price)} onChange={(e) => setDraft({ ...draft, sale_price: e.target.value === "" ? null : Number(e.target.value) })} />
            </Field>
            <Field label="Stock"><Input type="number" value={draft.stock == null ? "" : String(draft.stock)} onChange={(e) => setDraft({ ...draft, stock: e.target.value === "" ? null : Number(e.target.value) })} /></Field>
            <Field label="Status">
              <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={draft.status ?? "active"} onChange={(e) => setDraft({ ...draft, status: e.target.value })}>
                <option value="active">active</option><option value="inactive">inactive</option>
              </select>
            </Field>
            <Field label="Visibility">
              <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={draft.visibility ?? "public"} onChange={(e) => setDraft({ ...draft, visibility: e.target.value })}>
                <option value="public">public</option><option value="hidden">hidden</option>
              </select>
            </Field>
            <Field label="Delivery type">
              <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={draft.delivery_type ?? ""} onChange={(e) => setDraft({ ...draft, delivery_type: e.target.value || null })}>
                <option value="">— inherit —</option>
                <option value="download">Download</option>
                <option value="license_key">License key</option>
                <option value="account">Account</option>
                <option value="manual">Manual</option>
                <option value="external_url">External URL</option>
              </select>
            </Field>
            <PoolSelect label="Inventory pool" pools={pools?.inventory ?? []} value={draft.inventory_pool_id ?? null} onChange={(v) => setDraft({ ...draft, inventory_pool_id: v })} />
            <PoolSelect label="Subscription pool" pools={pools?.subscription ?? []} value={draft.subscription_pool_id ?? null} onChange={(v) => setDraft({ ...draft, subscription_pool_id: v })} />
            <PoolSelect label="License pool" pools={pools?.license ?? []} value={draft.license_pool_id ?? null} onChange={(v) => setDraft({ ...draft, license_pool_id: v })} />
            <Field label="Weight"><Input type="number" step="0.01" value={draft.weight == null ? "" : String(draft.weight)} onChange={(e) => setDraft({ ...draft, weight: e.target.value === "" ? null : Number(e.target.value) })} /></Field>
            <div className="col-span-2 md:col-span-3">
              <MediaPicker label="Thumbnail" value={draft.thumbnail_url ?? ""} onChange={(url) => setDraft({ ...draft, thumbnail_url: url })} />
            </div>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => { setDraft(toUpsert(variant)); setOpen(false); }}>Cancel</Button>
            <Button
              onClick={() => {
                if (Number(draft.price) < 0) return toast.error("Negative price");
                save.mutate(undefined);
              }}
              disabled={save.isPending}
            >
              Save
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function RowPoolPicker({ value, pools, onChange }: { value: string | null; pools: Pool[]; onChange: (v: string | null) => void }) {
  return (
    <select
      className="h-8 rounded-md border bg-background px-1 text-xs max-w-[120px]"
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value || null)}
      aria-label="Pool"
    >
      <option value="">—</option>
      {pools.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
    </select>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function PoolSelect({ label, pools, value, onChange }: { label: string; pools: Pool[]; value: string | null; onChange: (v: string | null) => void }) {
  return (
    <Field label={label}>
      <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={value ?? ""} onChange={(e) => onChange(e.target.value || null)}>
        <option value="">— none —</option>
        {pools.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
    </Field>
  );
}
