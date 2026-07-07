import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
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
import { AlertTriangle, ChevronDown, ChevronRight, Plus, Trash2, Wand2 } from "lucide-react";
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
        subscription: ((sub.data ?? []) as any[]).map((r) => ({ id: r.id, name: `${r.provider ?? ""} ${r.account_email ?? r.id}`.trim() })) as Pool[],
        license: ((lic.data ?? []) as any[]).map((r) => ({ id: r.id, name: r.name })) as Pool[],
      };
    },
  });
}

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

  // Search / filters
  const [q, setQ] = useState("");
  const [statusF, setStatusF] = useState("");
  const [visF, setVisF] = useState("");
  const [poolF, setPoolF] = useState("");

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (variants as ProductVariant[]).filter((v) => {
      if (statusF && v.status !== statusF) return false;
      if (visF && v.visibility !== visF) return false;
      if (poolF) {
        const anyPool = [v.inventory_pool_id, v.subscription_pool_id, v.license_pool_id].some((p) => p === poolF);
        if (!anyPool) return false;
      }
      if (!term) return true;
      return (
        v.name.toLowerCase().includes(term) ||
        (v.sku ?? "").toLowerCase().includes(term)
      );
    });
  }, [variants, q, statusF, visF, poolF]);

  // Selection
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleAll = () =>
    setSelected(selected.size === filtered.length ? new Set() : new Set(filtered.map((v) => v.id)));

  // Bulk
  const bulkUpdate = useMutation({
    mutationFn: async (patch: Record<string, any>) => {
      const rows = (variants as ProductVariant[]).filter((v) => selected.has(v.id));
      for (const v of rows) {
        await upsert({ data: { ...toUpsert(v), ...patch } });
      }
    },
    onSuccess: () => {
      toast.success("Bulk update applied");
      setSelected(new Set());
      invalidate();
    },
    onError: (e: any) => toast.error(e.message),
  });
  const bulkDelete = useMutation({
    mutationFn: async () => {
      for (const id of selected) await del({ data: { id } });
    },
    onSuccess: () => {
      toast.success("Deleted");
      setSelected(new Set());
      invalidate();
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Generator
  const [genPrice, setGenPrice] = useState<string>("");
  const combos = useMemo(() => {
    const groups = (attrs as ProductAttribute[]).filter((a) => a.options.length > 0);
    if (!groups.length) return 0;
    return groups.reduce((n, g) => n * g.options.length, 1);
  }, [attrs]);
  const gen = useMutation({
    mutationFn: () =>
      generate({
        data: {
          product_id: productId,
          default_price: genPrice ? Number(genPrice) : 0,
        },
      }),
    onSuccess: (r: any) => {
      toast.success(`Generated ${r.created} variant(s), skipped ${r.skipped}`);
      invalidate();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const hasAttrs = (attrs as ProductAttribute[]).length > 0;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-3">
        <Summary label="Attributes" value={(attrs as ProductAttribute[]).length} />
        <Summary
          label="Options"
          value={(attrs as ProductAttribute[]).reduce((n, a) => n + a.options.length, 0)}
        />
        <Summary label="Variants" value={(variants as ProductVariant[]).length} />
        <Summary label="Inv pools" value={pools?.inventory.length ?? 0} />
        <Summary label="Sub pools" value={pools?.subscription.length ?? 0} />
        <Summary label="Lic pools" value={pools?.license.length ?? 0} />
      </div>

      {/* Generator */}
      <div className="rounded-lg border p-4 space-y-3">
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <Label>Default price</Label>
            <Input
              type="number"
              step="0.01"
              value={genPrice}
              onChange={(e) => setGenPrice(e.target.value)}
              className="w-32"
            />
          </div>
          <Button
            disabled={!hasAttrs || combos === 0}
            onClick={() => {
              if (!confirm(`This will generate up to ${combos} variant(s). Continue?`)) return;
              gen.mutate();
            }}
          >
            <Wand2 className="mr-1 h-4 w-4" /> Generate variants
          </Button>
          <div className="text-sm text-muted-foreground">
            {hasAttrs
              ? `${combos} possible combination${combos === 1 ? "" : "s"}`
              : "Add attributes with options first."}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search name or SKU"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-xs"
        />
        <select
          className="h-10 rounded-md border bg-background px-3 text-sm"
          value={statusF}
          onChange={(e) => setStatusF(e.target.value)}
        >
          <option value="">All statuses</option>
          <option value="active">active</option>
          <option value="inactive">inactive</option>
        </select>
        <select
          className="h-10 rounded-md border bg-background px-3 text-sm"
          value={visF}
          onChange={(e) => setVisF(e.target.value)}
        >
          <option value="">All visibility</option>
          <option value="public">public</option>
          <option value="hidden">hidden</option>
        </select>
        <select
          className="h-10 rounded-md border bg-background px-3 text-sm max-w-[200px]"
          value={poolF}
          onChange={(e) => setPoolF(e.target.value)}
        >
          <option value="">All pools</option>
          {pools?.inventory.map((p) => <option key={p.id} value={p.id}>Inv: {p.name}</option>)}
          {pools?.subscription.map((p) => <option key={p.id} value={p.id}>Sub: {p.name}</option>)}
          {pools?.license.map((p) => <option key={p.id} value={p.id}>Lic: {p.name}</option>)}
        </select>
      </div>

      {/* Bulk toolbar */}
      {selected.size > 0 && (
        <div className="sticky top-2 z-10 flex flex-wrap items-center gap-2 rounded-lg border bg-background/95 p-3 shadow backdrop-blur">
          <div className="text-sm font-medium">{selected.size} selected</div>
          <BulkNumber label="Set price" onApply={(v) => bulkUpdate.mutate({ price: v })} />
          <BulkNumber label="Set sale" onApply={(v) => bulkUpdate.mutate({ sale_price: v })} />
          <BulkSelect
            label="Status"
            options={[["active", "active"], ["inactive", "inactive"]]}
            onApply={(v) => bulkUpdate.mutate({ status: v })}
          />
          <BulkSelect
            label="Visibility"
            options={[["public", "public"], ["hidden", "hidden"]]}
            onApply={(v) => bulkUpdate.mutate({ visibility: v })}
          />
          <BulkSelect
            label="Inv pool"
            options={[["", "— clear —"], ...(pools?.inventory ?? []).map((p) => [p.id, p.name] as [string, string])]}
            onApply={(v) => bulkUpdate.mutate({ inventory_pool_id: v || null })}
          />
          <BulkSelect
            label="Sub pool"
            options={[["", "— clear —"], ...(pools?.subscription ?? []).map((p) => [p.id, p.name] as [string, string])]}
            onApply={(v) => bulkUpdate.mutate({ subscription_pool_id: v || null })}
          />
          <BulkSelect
            label="Lic pool"
            options={[["", "— clear —"], ...(pools?.license ?? []).map((p) => [p.id, p.name] as [string, string])]}
            onApply={(v) => bulkUpdate.mutate({ license_pool_id: v || null })}
          />
          <Button
            variant="destructive"
            size="sm"
            onClick={() => confirm(`Delete ${selected.size} variant(s)?`) && bulkDelete.mutate()}
          >
            <Trash2 className="mr-1 h-4 w-4" /> Delete
          </Button>
        </div>
      )}

      {/* Table */}
      <div className="rounded-lg border overflow-hidden">
        <div className="grid grid-cols-[32px_32px_64px_1fr_140px_100px_100px_100px_100px_60px] items-center gap-2 bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground">
          <Checkbox checked={filtered.length > 0 && selected.size === filtered.length} onCheckedChange={toggleAll} />
          <span />
          <span>Thumb</span>
          <span>Variant</span>
          <span>SKU</span>
          <span className="text-right">Price</span>
          <span className="text-right">Sale</span>
          <span>Status</span>
          <span>Stock</span>
          <span />
        </div>
        {isLoading && <div className="p-6 text-muted-foreground">Loading…</div>}
        {!isLoading && filtered.length === 0 && (
          <div className="p-6 text-center text-sm text-muted-foreground">
            No variants. Add attributes and click Generate.
          </div>
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
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function Summary({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border px-3 py-1.5 text-xs">
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
      <Button
        size="sm"
        variant="secondary"
        onClick={() => {
          if (val === "") return;
          onApply(Number(val));
          setVal("");
        }}
      >
        Apply
      </Button>
    </div>
  );
}

function BulkSelect({
  label,
  options,
  onApply,
}: {
  label: string;
  options: [string, string][];
  onApply: (v: string) => void;
}) {
  const [val, setVal] = useState("");
  return (
    <div className="flex items-center gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <select
        className="h-8 rounded-md border bg-background px-2 text-sm max-w-[140px]"
        value={val}
        onChange={(e) => setVal(e.target.value)}
      >
        <option value="">—</option>
        {options.map(([v, l]) => (
          <option key={v || "_clear"} value={v}>{l}</option>
        ))}
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

function VariantRow({
  variant,
  pools,
  selected,
  onToggle,
  onChanged,
}: {
  variant: ProductVariant;
  pools: ReturnType<typeof usePools>["data"];
  selected: boolean;
  onToggle: () => void;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => toUpsert(variant));
  const upsert = useServerFn(adminUpsertVariantFn);
  const del = useServerFn(adminDeleteVariantFn);

  const save = useMutation({
    mutationFn: () => upsert({ data: draft }),
    onSuccess: () => {
      toast.success("Saved");
      setOpen(false);
      onChanged();
    },
    onError: (e: any) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: () => del({ data: { id: variant.id } }),
    onSuccess: () => {
      toast.success("Deleted");
      onChanged();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const orphan = (variant.attribute_option_ids?.length ?? 0) === 0 && Object.keys(variant.attributes ?? {}).length > 0;

  return (
    <div>
      <div className="grid grid-cols-[32px_32px_64px_1fr_140px_100px_100px_100px_100px_60px] items-center gap-2 px-3 py-2 text-sm">
        <Checkbox checked={selected} onCheckedChange={onToggle} />
        <Button variant="ghost" size="icon" onClick={() => setOpen((v) => !v)}>
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </Button>
        <div className="h-10 w-10 rounded bg-muted overflow-hidden">
          {variant.thumbnail_url && <img src={variant.thumbnail_url} alt="" className="h-full w-full object-cover" />}
        </div>
        <div className="min-w-0">
          <div className="truncate font-medium">{variant.name}</div>
          <div className="flex flex-wrap gap-1 text-xs text-muted-foreground">
            {Object.entries(variant.attributes ?? {}).map(([k, val]) => (
              <span key={k} className="rounded bg-muted px-1.5">{k}: {String(val)}</span>
            ))}
            {orphan && (
              <span className="inline-flex items-center gap-1 text-amber-600">
                <AlertTriangle className="h-3 w-3" /> option missing
              </span>
            )}
          </div>
        </div>
        <div className="truncate text-muted-foreground">{variant.sku ?? "—"}</div>
        <div className="text-right">${Number(variant.price).toFixed(2)}</div>
        <div className="text-right">{variant.sale_price != null ? `$${Number(variant.sale_price).toFixed(2)}` : "—"}</div>
        <div>
          <Badge variant={variant.status === "active" ? "default" : "secondary"}>{variant.status}</Badge>
        </div>
        <div>{variant.stock ?? "—"}</div>
        <div className="text-right">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => confirm(`Delete ${variant.name}?`) && remove.mutate()}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {open && (
        <div className="border-t bg-muted/20 p-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <Field label="SKU"><Input value={draft.sku ?? ""} onChange={(e) => setDraft({ ...draft, sku: e.target.value })} /></Field>
            <Field label="Price"><Input type="number" step="0.01" value={String(draft.price)} onChange={(e) => setDraft({ ...draft, price: Number(e.target.value) })} /></Field>
            <Field label="Sale price">
              <Input
                type="number" step="0.01"
                value={draft.sale_price == null ? "" : String(draft.sale_price)}
                onChange={(e) => setDraft({ ...draft, sale_price: e.target.value === "" ? null : Number(e.target.value) })}
              />
            </Field>
            <Field label="Stock">
              <Input
                type="number"
                value={draft.stock == null ? "" : String(draft.stock)}
                onChange={(e) => setDraft({ ...draft, stock: e.target.value === "" ? null : Number(e.target.value) })}
              />
            </Field>
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
            <Button onClick={() => save.mutate()} disabled={save.isPending}>Save</Button>
          </div>
        </div>
      )}
    </div>
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

function PoolSelect({
  label, pools, value, onChange,
}: {
  label: string; pools: Pool[]; value: string | null; onChange: (v: string | null) => void;
}) {
  return (
    <Field label={label}>
      <select
        className="h-10 w-full rounded-md border bg-background px-3 text-sm"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
      >
        <option value="">— none —</option>
        {pools.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
    </Field>
  );
}
