import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useRef, useState } from "react";
import {
  adminListProductsFn,
  adminUpsertProductFn,
  adminDeleteProductFn,
} from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Pencil, Plus, Trash2, Download, Upload } from "lucide-react";
import { MediaPicker } from "@/components/admin/MediaLibrary";
import { ProductThumb } from "@/components/site/ProductThumb";
import { BatchActionsBar } from "@/components/admin/BatchActionsBar";
import { exportProducts, parseImport, diffImport } from "@/lib/admin/product-io";
import { logActivity } from "@/lib/admin/activity-log";
import { usePriceFormatter } from "@/lib/currency";

export const Route = createFileRoute("/admin/products/")({ component: AdminProducts });

type Row = {
  id: string; title: string; slug: string;
  regular_price: number | string; sale_price: number | string | null;
  status: string; stock_status: string; is_featured: boolean; sales_count: number;
  thumbnail_url: string | null;
  smm_config: any | null;
};

function AdminProducts() {
  const formatPrice = usePriceFormatter();
  const list = useServerFn(adminListProductsFn);
  const upsert = useServerFn(adminUpsertProductFn);
  const del = useServerFn(adminDeleteProductFn);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({ queryKey: ["admin-products"], queryFn: () => list() });
  const [editing, setEditing] = useState<Partial<Row> | null>(null);
  const [productMode, setProductMode] = useState<"simple" | "variable">("simple");

  const save = useMutation({
    mutationFn: (payload: any) => upsert({ data: payload }),
    onSuccess: (res: any) => {
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["admin-products"] });
      const wasVariable = productMode === "variable";
      const id = res?.id ?? editing?.id;
      setEditing(null);
      setProductMode("simple");
      if (wasVariable && id) {
        navigate({ to: "/admin/products/$id", params: { id }, search: { tab: "attributes" } as any });
      }
    },
    onError: (e: any) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["admin-products"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const rows = (data ?? []) as unknown as Row[];
  const allSelected = useMemo(
    () => rows.length > 0 && rows.every((r) => selected.has(r.id)),
    [rows, selected],
  );
  const toggle = (id: string) => {
    const n = new Set(selected);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    setSelected(n);
  };
  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(rows.map((r) => r.id)));
  };
  const selectedRows = rows.filter((r) => selected.has(r.id));

  const bulkStatus = useMutation({
    mutationFn: async (status: "published" | "draft" | "private") => {
      for (const p of selectedRows) {
        await upsert({
          data: {
            id: p.id,
            title: p.title,
            slug: p.slug,
            regular_price: Number(p.regular_price ?? 0),
            sale_price: p.sale_price == null ? null : Number(p.sale_price),
            status,
          },
        });
        logActivity(p.id, status === "published" ? "published" : "edited", `Bulk set status → ${status}`);
      }
    },
    onSuccess: (_r, status) => {
      toast.success(`Updated ${selectedRows.length} products → ${status}`);
      qc.invalidateQueries({ queryKey: ["admin-products"] });
      setSelected(new Set());
    },
    onError: (e: any) => toast.error(e.message),
  });

  const bulkDelete = useMutation({
    mutationFn: async () => {
      for (const p of selectedRows) await del({ data: { id: p.id } });
    },
    onSuccess: () => {
      toast.success(`Deleted ${selectedRows.length} products`);
      qc.invalidateQueries({ queryKey: ["admin-products"] });
      setSelected(new Set());
    },
    onError: (e: any) => toast.error(e.message),
  });

  const bulkDuplicate = useMutation({
    mutationFn: async () => {
      for (const p of selectedRows) {
        const res: any = await upsert({
          data: {
            title: `${p.title} (Copy)`,
            slug: `${p.slug}-copy-${Math.random().toString(36).slice(2, 6)}`,
            regular_price: Number(p.regular_price ?? 0),
            sale_price: p.sale_price == null ? null : Number(p.sale_price),
            status: "draft",
          },
        });
        if (res?.id) logActivity(res.id, "duplicated", `Duplicated from ${p.title}`);
      }
    },
    onSuccess: () => {
      toast.success(`Duplicated ${selectedRows.length} products as drafts`);
      qc.invalidateQueries({ queryKey: ["admin-products"] });
      setSelected(new Set());
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleExport = (format: "csv" | "json", scope: "selection" | "all") => {
    const source = scope === "selection" && selectedRows.length ? selectedRows : rows;
    const res = exportProducts(source, format, scope);
    for (const r of source) logActivity(r.id, "exported", `Exported as ${format.toUpperCase()}`);
    toast.success(`Exported ${res.count} products → ${res.filename}`);
  };

  const importInputRef = useRef<HTMLInputElement>(null);
  const [importPreview, setImportPreview] = useState<null | {
    rows: any[];
    toCreate: any[];
    toUpdate: any[];
    duplicates: any[];
    errors: string[];
  }>(null);

  const handleImportFile = async (file: File) => {
    const text = await file.text();
    const parsed = parseImport(text, file.name.endsWith(".json") ? "json" : "csv");
    const diff = diffImport(rows, parsed.rows);
    setImportPreview({
      rows: parsed.rows,
      toCreate: diff.toCreate,
      toUpdate: diff.toUpdate.map((d) => d.incoming),
      duplicates: diff.duplicates,
      errors: parsed.errors,
    });
  };

  const importCommit = useMutation({
    mutationFn: async () => {
      if (!importPreview) return;
      const snapshot = [...rows]; // in-memory rollback source
      try {
        for (const r of importPreview.toCreate) {
          if (!r.title || !r.slug) continue;
          const res: any = await upsert({
            data: {
              title: String(r.title),
              slug: String(r.slug),
              regular_price: Number(r.regular_price ?? 0),
              sale_price: r.sale_price == null || r.sale_price === "" ? null : Number(r.sale_price),
              status: (r.status as any) ?? "draft",
            },
          });
          if (res?.id) logActivity(res.id, "imported", "Created via import");
        }
        for (const r of importPreview.toUpdate) {
          if (!r.id) continue;
          await upsert({
            data: {
              id: String(r.id),
              title: String(r.title ?? ""),
              slug: String(r.slug ?? ""),
              regular_price: Number(r.regular_price ?? 0),
              sale_price: r.sale_price == null || r.sale_price === "" ? null : Number(r.sale_price),
              status: (r.status as any) ?? "draft",
            },
          });
          logActivity(String(r.id), "imported", "Updated via import");
        }
      } catch (e) {
        // Best-effort surface; a true transactional rollback needs backend support.
        void snapshot;
        throw e;
      }
    },
    onSuccess: () => {
      toast.success("Import complete");
      qc.invalidateQueries({ queryKey: ["admin-products"] });
      setImportPreview(null);
    },
    onError: (e: any) => toast.error(`Import failed: ${e.message}. No further rows applied.`),
  });

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold">URGENT: Restore the website homepage first. Do not work on SMM features.

The Lovable Preview is still showing:

"This page didn't load"
"Something went wrong on our end."

The homepage was working before the recent SMM workflow changes.

For this task, do not change any Admin Products display text.

First diagnose the actual runtime failure:

Open the Homepage route in Preview and inspect the actual runtime/server error.

Check the browser console, server logs, route loader, and failed Supabase requests.

Find the FIRST real exception that causes the Homepage error boundary to render.

Compare the recent SMM-related changes with the last known working implementation.

Pay particular attention to shared catalog/product queries and recently added SMM fields such as smm_config, product_type, and smm_fulfillment.

Check for missing database columns, invalid queries, failed imports, server-function errors, or runtime TypeErrors.

If the crash was introduced by a recent SMM change, revert or isolate ONLY the specific change responsible for the crash. Do not remove unrelated working functionality.

Do not create a new database, reset the database, delete data, drop tables, or recreate existing tables.

Do not add another large migration unless the actual error proves that a specific schema change is required.

Do not make broad refactors or UI changes.

Priority:
The existing website must load first. Existing Simple, Variable, License, Subscription, Downloadable, Payment, Order, and Customer Product Field workflows must remain intact.

After identifying and fixing the root cause, verify:

Homepage loads in Preview.

Homepage loads after refresh.

Product listing loads.

Product detail loads.

Admin Products loads.

No fatal runtime error remains.

No missing-column/schema-cache error remains.

IMPORTANT:
Do not report success just because the project builds. The Homepage must actually render successfully in Preview.

Report:

The exact root error

The file/function causing it

The minimal fix applied

The verification result

Do not proceed to any SMM development until the Homepage is confirmed working.</h1>
          <p className="text-sm text-muted-foreground">{data?.length ?? 0} products</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Button size="sm" variant="outline" onClick={() => handleExport("csv", "all")}>
            <Download className="h-4 w-4 mr-1" /> Export CSV
          </Button>
          <Button size="sm" variant="outline" onClick={() => handleExport("json", "all")}>
            <Download className="h-4 w-4 mr-1" /> Export JSON
          </Button>
          <Button size="sm" variant="outline" onClick={() => importInputRef.current?.click()}>
            <Upload className="h-4 w-4 mr-1" /> Import
          </Button>
          <input
            ref={importInputRef}
            type="file"
            accept=".csv,.json,text/csv,application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleImportFile(f);
              e.target.value = "";
            }}
          />
          <Button onClick={() => { setProductMode("simple"); setEditing({ status: "published", regular_price: 0 }); }}>
            <Plus className="h-4 w-4 mr-1" /> New product
          </Button>
        </div>
      </div>

      <BatchActionsBar
        count={selected.size}
        onClear={() => setSelected(new Set())}
        onPublish={() => bulkStatus.mutate("published")}
        onDraft={() => bulkStatus.mutate("draft")}
        onPrivate={() => bulkStatus.mutate("private")}
        onDuplicate={() => bulkDuplicate.mutate()}
        onExport={() => handleExport("csv", "selection")}
        onDelete={() => {
          if (confirm(`Delete ${selected.size} products? This cannot be undone.`)) bulkDelete.mutate();
        }}
        busy={bulkStatus.isPending || bulkDelete.isPending || bulkDuplicate.isPending}
      />

      <div className="bg-background rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Select all" />
              </TableHead>
              <TableHead className="w-12"></TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Sales</TableHead>
              <TableHead className="w-28"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">Loading…</TableCell></TableRow>
            )}
            {rows.map((p: Row) => (
              <TableRow key={p.id} data-state={selected.has(p.id) ? "selected" : undefined}>
                <TableCell>
                  <input
                    type="checkbox"
                    checked={selected.has(p.id)}
                    onChange={() => toggle(p.id)}
                    aria-label={`Select ${p.title}`}
                  />
                </TableCell>
                <TableCell>
                  <div className="h-10 w-10 rounded bg-muted overflow-hidden">
                    <ProductThumb 
                      src={p.thumbnail_url} 
                      emoji="📦" 
                      alt={p.title} 
                      size={40} 
                      className="h-full w-full object-cover"
                    />
                  </div>
                </TableCell>
                <TableCell className="font-medium">{p.title}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{p.slug}</TableCell>
                <TableCell>{formatPrice(Number(p.sale_price ?? p.regular_price))}</TableCell>
                <TableCell><Badge variant={p.status === "published" ? "default" : "secondary"}>{p.status}</Badge></TableCell>
                <TableCell>{p.sales_count ?? 0}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" asChild>
                      <a href={`/admin/products/${p.id}`}>Manage</a>
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => navigate({ to: "/admin/products/$id", params: { id: p.id }, search: { tab: "basic" } })}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => {
                      if (confirm(`Delete ${p.title}?`)) remove.mutate(p.id);
                    }}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!importPreview} onOpenChange={(v) => !v && setImportPreview(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Import preview</DialogTitle>
          </DialogHeader>
          {importPreview && (
            <div className="space-y-2 text-sm">
              <div>Parsed rows: <strong>{importPreview.rows.length}</strong></div>
              <div>To create: <strong>{importPreview.toCreate.length}</strong></div>
              <div>To update: <strong>{importPreview.toUpdate.length}</strong></div>
              <div>Duplicates skipped: <strong>{importPreview.duplicates.length}</strong></div>
              {importPreview.errors.length > 0 && (
                <div className="rounded border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
                  {importPreview.errors.slice(0, 5).map((er) => <div key={er}>{er}</div>)}
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportPreview(null)}>Cancel</Button>
            <Button onClick={() => importCommit.mutate()} disabled={importCommit.isPending}>
              {importCommit.isPending ? "Importing…" : "Apply import"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] p-0 gap-0 flex flex-col">
          <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
            <DialogTitle>{editing?.id ? "Edit product" : "New product"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3 overflow-y-auto px-6 py-4 flex-1 min-h-0">
              {!editing.id && (
                <div className="rounded-md border p-3">
                  <Label className="mb-2 block">Product Mode</Label>
                  <div className="flex gap-4 text-sm">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="product_mode" checked={productMode === "simple"} onChange={() => setProductMode("simple")} />
                      Simple Product
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="product_mode" checked={productMode === "variable"} onChange={() => setProductMode("variable")} />
                      Variable Product
                    </label>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Title</Label><Input value={editing.title ?? ""} onChange={(e) => setEditing({ ...editing, title: e.target.value })} /></div>
                <div><Label>Slug</Label><Input value={editing.slug ?? ""} onChange={(e) => setEditing({ ...editing, slug: e.target.value })} /></div>
                {productMode === "simple" ? (
                  <>
                    <div><Label>Regular price</Label><Input type="number" step="0.01" value={String(editing.regular_price ?? 0)} onChange={(e) => setEditing({ ...editing, regular_price: parseFloat(e.target.value) })} /></div>
                    <div><Label>Sale price</Label><Input type="number" step="0.01" value={editing.sale_price == null ? "" : String(editing.sale_price)} onChange={(e) => setEditing({ ...editing, sale_price: e.target.value === "" ? null : parseFloat(e.target.value) })} /></div>
                  </>
                ) : (
                  <div className="col-span-2 rounded-md border border-dashed bg-muted/30 p-3 text-sm text-muted-foreground">
                    This product uses Variant Pricing. Prices and inventory will be configured after creating variants.
                  </div>
                )}
                <div><Label>Status</Label>
                  <select className="w-full h-10 rounded-md border bg-background px-3 text-sm" value={editing.status ?? "published"} onChange={(e) => setEditing({ ...editing, status: e.target.value })}>
                    <option value="published">published</option>
                    <option value="draft">draft</option>
                    <option value="private">private</option>
                    <option value="archived">archived</option>
                  </select>
                </div>
                <div><Label>Visibility</Label>
                  <select className="w-full h-10 rounded-md border bg-background px-3 text-sm" value={(editing as any).visibility ?? "public"} onChange={(e) => setEditing({ ...editing, visibility: e.target.value } as any)}>
                    <option value="public">public</option>
                    <option value="members_only">members only</option>
                    <option value="hidden">hidden</option>
                  </select>
                </div>
                <div><Label>Product type</Label>
                  <select className="w-full h-10 rounded-md border bg-background px-3 text-sm" value={(editing as any).product_type ?? ""} onChange={(e) => setEditing({ ...editing, product_type: e.target.value || null } as any)}>
                    <option value="">— select —</option>
                    <option value="downloadable">Downloadable</option>
                    <option value="license_key">License key</option>
                    <option value="subscription">Subscription</option>
                    <option value="account">Account</option>
                    <option value="external">External</option>
                    <option value="manual">Manual delivery</option>
                    <option value="smm_service">SMM Service</option>
                  </select>
                </div>
                <div><Label>Delivery type</Label>
                  <select className="w-full h-10 rounded-md border bg-background px-3 text-sm" value={(editing as any).delivery_type ?? ""} onChange={(e) => setEditing({ ...editing, delivery_type: e.target.value || null } as any)}>
                    <option value="">— select —</option>
                    <option value="download">Download</option>
                    <option value="license_key">License key</option>
                    <option value="account">Account</option>
                    <option value="manual">Manual</option>
                    <option value="external_url">External URL</option>
                    <option value="smm_fulfillment">SMM Fulfillment</option>
                  </select>
                </div>


                {(editing as any).product_type === "smm_service" && (
                  <div className="col-span-2 space-y-4 rounded-lg border border-primary/20 bg-primary/5 p-4 mt-2">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-base">SMM Service Configuration</h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs">Platform</Label>
                        <Input
                          placeholder="e.g. Facebook, Instagram"
                          value={(editing as any).smm_config?.platform ?? ""}
                          onChange={(e) => {
                            const cfg = (editing as any).smm_config || {};
                            setEditing({ ...editing, smm_config: { ...cfg, platform: e.target.value } } as any);
                          }}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs">Service Type</Label>
                        <Input
                          placeholder="e.g. Followers, Likes"
                          value={(editing as any).smm_config?.service_type ?? ""}
                          onChange={(e) => {
                            const cfg = (editing as any).smm_config || {};
                            setEditing({ ...editing, smm_config: { ...cfg, service_type: e.target.value } } as any);
                          }}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs">Minimum Quantity</Label>
                        <Input
                          type="number"
                          min="1"
                          value={(editing as any).smm_config?.min_quantity ?? ""}
                          onChange={(e) => {
                            const cfg = (editing as any).smm_config || {};
                            setEditing({ ...editing, smm_config: { ...cfg, min_quantity: parseInt(e.target.value) } } as any);
                          }}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs">Maximum Quantity</Label>
                        <Input
                          type="number"
                          min="1"
                          value={(editing as any).smm_config?.max_quantity ?? ""}
                          onChange={(e) => {
                            const cfg = (editing as any).smm_config || {};
                            setEditing({ ...editing, smm_config: { ...cfg, max_quantity: parseInt(e.target.value) } } as any);
                          }}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs">Quantity Step</Label>
                        <Input
                          type="number"
                          min="1"
                          value={(editing as any).smm_config?.quantity_step ?? ""}
                          onChange={(e) => {
                            const cfg = (editing as any).smm_config || {};
                            setEditing({ ...editing, smm_config: { ...cfg, quantity_step: parseInt(e.target.value) } } as any);
                          }}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs">Pricing Mode</Label>
                        <select
                          className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                          value={(editing as any).smm_config?.pricing_mode ?? "per_1000"}
                          onChange={(e) => {
                            const cfg = (editing as any).smm_config || {};
                            setEditing({ ...editing, smm_config: { ...cfg, pricing_mode: e.target.value } } as any);
                          }}
                        >
                          <option value="per_unit">Per Unit</option>
                          <option value="per_1000">Per 1,000</option>
                          <option value="quantity_tier">Quantity Tier</option>
                        </select>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs">Base Price (৳)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={(editing as any).smm_config?.price ?? ""}
                          onChange={(e) => {
                            const cfg = (editing as any).smm_config || {};
                            setEditing({ ...editing, smm_config: { ...cfg, price: parseFloat(e.target.value) } } as any);
                          }}
                        />
                      </div>
                    </div>

                    {(editing as any).smm_config?.pricing_mode === "quantity_tier" && (
                      <div className="mt-4 space-y-3 pt-4 border-t border-primary/10">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs font-semibold">Pricing Tiers</Label>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-[10px]"
                            onClick={() => {
                              const cfg = (editing as any).smm_config || {};
                              const tiers = Array.isArray(cfg.tiers) ? cfg.tiers : [];
                              setEditing({ ...editing, smm_config: { ...cfg, tiers: [...tiers, { min: 0, price: 0 }] } } as any);
                            }}
                          >
                            <Plus className="h-3 w-3 mr-1" /> Add Tier
                          </Button>
                        </div>
                        <div className="space-y-2 max-h-[150px] overflow-y-auto pr-1">
                          {(Array.isArray((editing as any).smm_config?.tiers) ? (editing as any).smm_config.tiers : []).map((tier: any, idx: number) => (
                            <div key={idx} className="flex items-end gap-2 p-2 rounded border bg-background/50">
                              <div className="flex-1 space-y-1">
                                <Label className="text-[9px]">Min Qty</Label>
                                <Input
                                  className="h-7 text-xs"
                                  type="number"
                                  value={tier.min}
                                  onChange={(e) => {
                                    const cfg = { ...(editing as any).smm_config };
                                    if (!Array.isArray(cfg.tiers)) cfg.tiers = [];
                                    cfg.tiers = [...cfg.tiers];
                                    cfg.tiers[idx] = { ...cfg.tiers[idx], min: parseInt(e.target.value) || 0 };
                                    setEditing({ ...editing, smm_config: cfg } as any);
                                  }}
                                />
                              </div>
                              <div className="flex-1 space-y-1">
                                <Label className="text-[9px]">Price (৳)</Label>
                                <Input
                                  className="h-7 text-xs"
                                  type="number"
                                  step="0.01"
                                  value={tier.price}
                                  onChange={(e) => {
                                    const cfg = { ...(editing as any).smm_config };
                                    if (!Array.isArray(cfg.tiers)) cfg.tiers = [];
                                    cfg.tiers = [...cfg.tiers];
                                    cfg.tiers[idx] = { ...cfg.tiers[idx], price: parseFloat(e.target.value) || 0 };
                                    setEditing({ ...editing, smm_config: cfg } as any);
                                  }}
                                />
                              </div>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-destructive"
                                onClick={() => {
                                  const cfg = { ...(editing as any).smm_config };
                                  cfg.tiers = cfg.tiers.filter((_: any, i: number) => i !== idx);
                                  setEditing({ ...editing, smm_config: cfg } as any);
                                }}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}


                <div className="col-span-2"><MediaPicker label="Thumbnail" value={(editing as any).thumbnail_url ?? ""} onChange={(url) => setEditing({ ...editing, thumbnail_url: url } as any)} /></div>
              </div>
              <div><Label>Short description</Label><Textarea rows={2} value={(editing as any).short_description ?? ""} onChange={(e) => setEditing({ ...editing, short_description: e.target.value } as any)} /></div>
              <div><Label>Description</Label><Textarea rows={4} value={(editing as any).description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value } as any)} /></div>
            </div>
          )}
          <DialogFooter className="px-6 py-4 border-t shrink-0 bg-background">
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button
              disabled={save.isPending}
              onClick={() => {
                if (!editing?.title || !editing?.slug) return toast.error("Title and slug required");
                save.mutate({
                  id: editing.id,
                  title: editing.title,
                  slug: editing.slug,
                  regular_price: Number(editing.regular_price ?? 0),
                  sale_price: editing.sale_price == null ? null : Number(editing.sale_price),
                  status: (editing.status ?? "published") as any,
                  short_description: (editing as any).short_description ?? null,
                  description: (editing as any).description ?? null,
                  thumbnail_url: (editing as any).thumbnail_url ?? null,
                  visibility: (editing as any).visibility ?? "public",
                  product_type: (editing as any).product_type || null,
                  delivery_type: (editing as any).delivery_type || null,
                  smm_config: (editing as any).product_type === 'smm_service' && (editing as any).smm_config ? {
                    ...(editing as any).smm_config,
                    min_quantity: Number((editing as any).smm_config.min_quantity ?? 1),
                    max_quantity: Number((editing as any).smm_config.max_quantity ?? 1),
                    quantity_step: Number((editing as any).smm_config.quantity_step ?? 1),
                    price: Number((editing as any).smm_config.price ?? 0),
                  } : null,

                });
              }}
            >
              {save.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
