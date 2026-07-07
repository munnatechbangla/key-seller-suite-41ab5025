import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  adminListProductDownloadsFn,
  adminUpsertProductDownloadFn,
  adminDeleteProductDownloadFn,
  adminListVariationsFn,
  adminUpsertVariationFn,
  adminDeleteVariationFn,
  adminListProductImagesFn,
  adminUpsertProductImageFn,
  adminReorderProductImagesFn,
  adminDeleteProductImageFn,
} from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, ArrowUp, ArrowDown, Star, Copy, GripVertical, ChevronDown, ChevronRight, Eye } from "lucide-react";
import { CustomFieldsTab } from "@/components/admin/CustomFieldsTab";
import { MediaPicker } from "@/components/admin/MediaLibrary";
import { RichContentTab } from "@/components/admin/RichContentTab";
import { ProductSeoTab } from "@/components/admin/ProductSeoTab";
import { AttributesTab } from "@/components/admin/AttributesTab";
import { VariantsTab } from "@/components/admin/VariantsTab";

export const Route = createFileRoute("/admin/products/$id")({
  component: ManageProduct,
  errorComponent: ({ error }) => <div className="p-6 text-destructive">{String(error?.message ?? error)}</div>,
  notFoundComponent: () => <div className="p-6">Not found</div>,
});

function ManageProduct() {
  const { id } = Route.useParams();
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild><Link to="/admin/products"><ArrowLeft className="h-4 w-4 mr-1" /> Products</Link></Button>
        <h1 className="text-2xl font-bold">Manage product</h1>
      </div>
      <Tabs defaultValue="downloads">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="downloads">Downloads</TabsTrigger>
          <TabsTrigger value="attributes">Attributes</TabsTrigger>
          <TabsTrigger value="variants">Variants</TabsTrigger>
          <TabsTrigger value="variations">Legacy Variations</TabsTrigger>
          <TabsTrigger value="gallery">Gallery</TabsTrigger>
          <TabsTrigger value="custom-fields">Custom Fields</TabsTrigger>
          <TabsTrigger value="rich-content">Rich Content</TabsTrigger>
          <TabsTrigger value="seo">SEO</TabsTrigger>
        </TabsList>
        <TabsContent value="downloads"><DownloadsTab productId={id} /></TabsContent>
        <TabsContent value="attributes"><AttributesTab productId={id} /></TabsContent>
        <TabsContent value="variants"><VariantsTab productId={id} /></TabsContent>
        <TabsContent value="variations"><VariationsTab productId={id} /></TabsContent>
        <TabsContent value="gallery"><GalleryTab productId={id} /></TabsContent>
        <TabsContent value="custom-fields"><CustomFieldsTab productId={id} /></TabsContent>
        <TabsContent value="rich-content"><RichContentTab productId={id} /></TabsContent>
        <TabsContent value="seo"><ProductSeoTab productId={id} /></TabsContent>
      </Tabs>
    </div>
  );
}

/* -------- Downloads -------- */
function DownloadsTab({ productId }: { productId: string }) {
  const list = useServerFn(adminListProductDownloadsFn);
  const upsert = useServerFn(adminUpsertProductDownloadFn);
  const del = useServerFn(adminDeleteProductDownloadFn);
  const qc = useQueryClient();
  const key = ["admin-downloads", productId];
  const { data = [], isLoading } = useQuery({ queryKey: key, queryFn: () => list({ data: { product_id: productId } }) });
  const [draft, setDraft] = useState<any>({ file_name: "", file_url: "", version: "", file_size: "", sort_order: 0 });

  const save = useMutation({
    mutationFn: (row: any) => upsert({ data: row }),
    onSuccess: () => { toast.success("Saved"); qc.invalidateQueries({ queryKey: key }); setDraft({ file_name: "", file_url: "", version: "", file_size: "", sort_order: 0 }); },
    onError: (e: any) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (rid: string) => del({ data: { id: rid } }),
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: key }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-5 gap-2 items-end p-4 border rounded-lg">
        <div><Label>File name</Label><Input value={draft.file_name} onChange={(e) => setDraft({ ...draft, file_name: e.target.value })} /></div>
        <div className="col-span-2"><Label>File URL</Label><Input value={draft.file_url} onChange={(e) => setDraft({ ...draft, file_url: e.target.value })} /></div>
        <div><Label>Version</Label><Input value={draft.version} onChange={(e) => setDraft({ ...draft, version: e.target.value })} /></div>
        <div><Label>Size (bytes)</Label><Input type="number" value={draft.file_size} onChange={(e) => setDraft({ ...draft, file_size: e.target.value })} /></div>
        <div className="col-span-5">
          <Button size="sm" onClick={() => {
            if (!draft.file_name || !draft.file_url) return toast.error("Name and URL required");
            save.mutate({
              product_id: productId,
              file_name: draft.file_name,
              file_url: draft.file_url,
              version: draft.version || null,
              file_size: draft.file_size === "" ? null : Number(draft.file_size),
              sort_order: Number(draft.sort_order ?? 0),
            });
          }}><Plus className="h-4 w-4 mr-1" /> Add download</Button>
        </div>
      </div>
      <div className="border rounded-lg divide-y">
        {isLoading && <div className="p-4 text-muted-foreground">Loading…</div>}
        {(data as any[]).map((d) => (
          <div key={d.id} className="p-3 flex items-center gap-3">
            <div className="flex-1">
              <div className="font-medium">{d.file_name} {d.version && <span className="text-xs text-muted-foreground">v{d.version}</span>}</div>
              <div className="text-xs text-muted-foreground truncate">{d.file_url}</div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => confirm("Delete?") && remove.mutate(d.id)}><Trash2 className="h-4 w-4" /></Button>
          </div>
        ))}
        {!isLoading && (data as any[]).length === 0 && <div className="p-4 text-muted-foreground text-sm">No downloads yet.</div>}
      </div>
    </div>
  );
}

/* -------- Variations -------- */
function VariationsTab({ productId }: { productId: string }) {
  const list = useServerFn(adminListVariationsFn);
  const upsert = useServerFn(adminUpsertVariationFn);
  const del = useServerFn(adminDeleteVariationFn);
  const qc = useQueryClient();
  const key = ["admin-variations", productId];
  const { data = [], isLoading } = useQuery({ queryKey: key, queryFn: () => list({ data: { product_id: productId } }) });
  const [draft, setDraft] = useState<any>({ name: "", sku: "", price: 0, compare_price: "", stock: "", status: "active" });

  const save = useMutation({
    mutationFn: (row: any) => upsert({ data: row }),
    onSuccess: () => { toast.success("Saved"); qc.invalidateQueries({ queryKey: key }); setDraft({ name: "", sku: "", price: 0, compare_price: "", stock: "", status: "active" }); },
    onError: (e: any) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (rid: string) => del({ data: { id: rid } }),
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: key }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-6 gap-2 items-end p-4 border rounded-lg">
        <div><Label>Name</Label><Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></div>
        <div><Label>SKU</Label><Input value={draft.sku} onChange={(e) => setDraft({ ...draft, sku: e.target.value })} /></div>
        <div><Label>Price</Label><Input type="number" step="0.01" value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value })} /></div>
        <div><Label>Compare price</Label><Input type="number" step="0.01" value={draft.compare_price} onChange={(e) => setDraft({ ...draft, compare_price: e.target.value })} /></div>
        <div><Label>Stock</Label><Input type="number" value={draft.stock} onChange={(e) => setDraft({ ...draft, stock: e.target.value })} /></div>
        <div><Label>Status</Label>
          <select className="w-full h-10 rounded-md border bg-background px-3 text-sm" value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value })}>
            <option value="active">active</option>
            <option value="inactive">inactive</option>
          </select>
        </div>
        <div className="col-span-6">
          <Button size="sm" onClick={() => {
            if (!draft.name) return toast.error("Name required");
            save.mutate({
              product_id: productId,
              name: draft.name,
              sku: draft.sku || null,
              price: Number(draft.price ?? 0),
              compare_price: draft.compare_price === "" ? null : Number(draft.compare_price),
              stock: draft.stock === "" ? null : Number(draft.stock),
              status: draft.status,
            });
          }}><Plus className="h-4 w-4 mr-1" /> Add variation</Button>
        </div>
      </div>
      <div className="border rounded-lg divide-y">
        {isLoading && <div className="p-4 text-muted-foreground">Loading…</div>}
        {(data as any[]).map((v) => (
          <div key={v.id} className="p-3 flex items-center gap-3">
            <div className="flex-1">
              <div className="font-medium">{v.name} <span className="text-xs text-muted-foreground">{v.sku ?? ""}</span></div>
              <div className="text-xs text-muted-foreground">${Number(v.price).toFixed(2)}{v.compare_price ? ` (was $${Number(v.compare_price).toFixed(2)})` : ""} · stock {v.stock ?? "—"} · {v.status}</div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => confirm("Delete?") && remove.mutate(v.id)}><Trash2 className="h-4 w-4" /></Button>
          </div>
        ))}
        {!isLoading && (data as any[]).length === 0 && <div className="p-4 text-muted-foreground text-sm">No variations yet.</div>}
      </div>
    </div>
  );
}

/* -------- Gallery -------- */
function GalleryTab({ productId }: { productId: string }) {
  const list = useServerFn(adminListProductImagesFn);
  const upsert = useServerFn(adminUpsertProductImageFn);
  const reorder = useServerFn(adminReorderProductImagesFn);
  const del = useServerFn(adminDeleteProductImageFn);
  const qc = useQueryClient();
  const key = ["admin-images", productId];
  const { data = [], isLoading } = useQuery({ queryKey: key, queryFn: () => list({ data: { product_id: productId } }) });
  const [url, setUrl] = useState("");
  const [alt, setAlt] = useState("");

  const invalidate = () => qc.invalidateQueries({ queryKey: key });
  const add = useMutation({
    mutationFn: (row: any) => upsert({ data: row }),
    onSuccess: () => { toast.success("Added"); invalidate(); setUrl(""); setAlt(""); },
    onError: (e: any) => toast.error(e.message),
  });
  const setPrimary = useMutation({
    mutationFn: (row: any) => upsert({ data: { ...row, is_primary: true } }),
    onSuccess: () => { toast.success("Primary set"); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (rid: string) => del({ data: { id: rid } }),
    onSuccess: () => { toast.success("Deleted"); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });

  const move = async (idx: number, dir: -1 | 1) => {
    const items = [...(data as any[])];
    const j = idx + dir;
    if (j < 0 || j >= items.length) return;
    [items[idx], items[j]] = [items[j], items[idx]];
    const payload = items.map((it, i) => ({ id: it.id, sort_order: i }));
    await reorder({ data: { items: payload } });
    invalidate();
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-6 gap-2 items-end p-4 border rounded-lg">
        <div className="col-span-3"><MediaPicker label="Image" value={url} onChange={setUrl} /></div>
        <div className="col-span-2"><Label>Alt text</Label><Input value={alt} onChange={(e) => setAlt(e.target.value)} /></div>
        <div>
          <Button size="sm" onClick={() => {
            if (!url) return toast.error("URL required");
            const items = data as any[];
            add.mutate({
              product_id: productId,
              url,
              alt: alt || null,
              sort_order: items.length,
              is_primary: items.length === 0,
            });
          }}><Plus className="h-4 w-4 mr-1" /> Add image</Button>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {isLoading && <div className="text-muted-foreground">Loading…</div>}
        {(data as any[]).map((img, idx) => (
          <div key={img.id} className="border rounded-lg overflow-hidden">
            <div className="aspect-square bg-muted">
              <img src={img.url} alt={img.alt ?? ""} className="w-full h-full object-cover" />
            </div>
            <div className="p-2 flex items-center gap-1">
              <Button size="icon" variant="ghost" onClick={() => move(idx, -1)}><ArrowUp className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" onClick={() => move(idx, 1)}><ArrowDown className="h-4 w-4" /></Button>
              <Button size="icon" variant={img.is_primary ? "default" : "ghost"} onClick={() => setPrimary.mutate({ id: img.id, product_id: productId, url: img.url, alt: img.alt })}><Star className="h-4 w-4" /></Button>
              <div className="flex-1" />
              <Button size="icon" variant="ghost" onClick={() => confirm("Delete?") && remove.mutate(img.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          </div>
        ))}
        {!isLoading && (data as any[]).length === 0 && <div className="text-sm text-muted-foreground">No images yet.</div>}
      </div>
    </div>
  );
}
