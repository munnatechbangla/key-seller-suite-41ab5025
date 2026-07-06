import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  productLayoutsListFn, productLayoutGetFn, productLayoutUpsertFn, productLayoutDeleteFn,
  productLayoutDuplicateFn, productLayoutPublishFn,
  productLayoutSectionsListFn, productLayoutSectionUpsertFn,
  productLayoutSectionDeleteFn, productLayoutSectionReorderFn, productLayoutSectionDuplicateFn,
} from "@/lib/product-layouts.functions";
import { PRODUCT_SECTION_TYPES, findProductSectionDef, type ProductSectionTypeKey } from "@/lib/cms/product-section-types";
import { ProductLayoutRenderer, type ProductLayoutSection } from "@/components/cms/ProductLayoutRenderer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ArrowUp, ArrowDown, Copy, Trash2, Plus, ChevronDown, ChevronRight, Smartphone, Tablet, Monitor, ArrowLeft, Star } from "lucide-react";

export const Route = createFileRoute("/admin/cms/product-layouts")({
  component: ProductLayoutsAdminPage,
});

type LayoutRow = {
  id: string; name: string; description: string | null;
  is_default: boolean; enabled: boolean; status: string; updated_at: string;
};

type Device = "desktop" | "tablet" | "mobile";
const DEVICE_WIDTH: Record<Device, string> = { desktop: "100%", tablet: "768px", mobile: "390px" };

// Demo product used only in the visual preview.
const DEMO_PRODUCT = {
  id: "demo",
  slug: "demo",
  name: "Sample Product",
  short: "This is a demo product used to preview your product layout.",
  description: "<p>Long product description. Configure real content in the storefront.</p>",
  price: 29.99,
  oldPrice: 49.99,
  rating: 4.7,
  reviews: 128,
  stock: 25,
  thumbnailUrl: "https://placehold.co/800x800?text=Preview",
  image: "https://placehold.co/800x800?text=Preview",
  category: "Demo",
  faqs: [{ q: "How is it delivered?", a: "Instantly to your email." }],
};

function ProductLayoutsAdminPage() {
  const [selected, setSelected] = useState<LayoutRow | null>(null);

  if (selected) return <LayoutEditor layout={selected} onBack={() => setSelected(null)} />;
  return <LayoutList onOpen={(l) => setSelected(l)} />;
}

function LayoutList({ onOpen }: { onOpen: (l: LayoutRow) => void }) {
  const list = useServerFn(productLayoutsListFn);
  const upsert = useServerFn(productLayoutUpsertFn);
  const del = useServerFn(productLayoutDeleteFn);
  const dup = useServerFn(productLayoutDuplicateFn);
  const pub = useServerFn(productLayoutPublishFn);
  const [rows, setRows] = useState<LayoutRow[]>([]);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<{ name: string; description: string }>({ name: "", description: "" });

  const refresh = () => list().then((r) => setRows(r as LayoutRow[]));
  useEffect(() => { refresh(); }, []);

  const create = async () => {
    if (!draft.name) return;
    await upsert({ data: { name: draft.name, description: draft.description, is_default: false, enabled: true, status: "draft" } });
    setDraft({ name: "", description: "" }); setOpen(false); refresh();
  };

  return (
    <div className="p-6 space-y-4">
      <header>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link to="/admin/cms" className="hover:underline">CMS</Link> <ChevronRight className="h-3 w-3" /> Product Layouts
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Product Layouts</h1>
            <p className="text-sm text-muted-foreground">Build reusable, dynamic product page layouts. Assign a layout to any product — otherwise the current product page keeps rendering.</p>
          </div>
          <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" /> New Layout</Button>
        </div>
      </header>

      <Card><CardContent className="p-0">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left">
            <tr><th className="p-3">Name</th><th className="p-3">Status</th><th className="p-3">Default</th><th className="p-3">Updated</th><th className="p-3 text-right">Actions</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="p-3">
                  <div className="font-semibold">{r.name}</div>
                  {r.description && <div className="text-xs text-muted-foreground">{r.description}</div>}
                </td>
                <td className="p-3">{r.status}</td>
                <td className="p-3">{r.is_default ? <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" /> : "—"}</td>
                <td className="p-3 text-muted-foreground">{new Date(r.updated_at).toLocaleString()}</td>
                <td className="p-3 text-right space-x-1">
                  <Button size="sm" variant="ghost" onClick={() => onOpen(r)}>Edit</Button>
                  <Button size="sm" variant="ghost" onClick={async () => { await pub({ data: { id: r.id, publish: r.status !== "published" } }); refresh(); }}>
                    {r.status === "published" ? "Unpublish" : "Publish"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={async () => { await upsert({ data: { ...r, is_default: !r.is_default } as any }); refresh(); }}>
                    {r.is_default ? "Unset default" : "Set default"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={async () => { await dup({ data: { id: r.id } }); refresh(); }}><Copy className="h-3.5 w-3.5" /></Button>
                  <Button size="sm" variant="ghost" onClick={async () => { if (confirm("Delete layout? Sections will be removed.")) { await del({ data: { id: r.id } }); refresh(); } }}><Trash2 className="h-3.5 w-3.5" /></Button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">No layouts yet. Click <b>New Layout</b> to create one.</td></tr>}
          </tbody>
        </table>
      </CardContent></Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Product Layout</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name</Label><Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Default product layout" /></div>
            <div><Label>Description</Label><Textarea value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></div>
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={create}>Create</Button></div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function LayoutEditor({ layout, onBack }: { layout: LayoutRow; onBack: () => void }) {
  const getLayout = useServerFn(productLayoutGetFn);
  const upsertLayout = useServerFn(productLayoutUpsertFn);
  const pubLayout = useServerFn(productLayoutPublishFn);
  const listSecs = useServerFn(productLayoutSectionsListFn);
  const [layoutRow, setLayoutRow] = useState<LayoutRow>(layout);
  const [sections, setSections] = useState<ProductLayoutSection[]>([]);
  const [selected, setSelected] = useState<ProductLayoutSection | null>(null);
  const [device, setDevice] = useState<Device>("desktop");
  const [addOpen, setAddOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const refreshSecs = async () => {
    const rows = await listSecs({ data: { layout_id: layoutRow.id } });
    setSections(rows as ProductLayoutSection[]);
  };
  const refreshLayout = async () => {
    const r = await getLayout({ data: { id: layoutRow.id } });
    if (r) setLayoutRow(r as LayoutRow);
  };
  useEffect(() => { refreshSecs(); }, [layoutRow.id]);

  return (
    <div className="p-6 space-y-4">
      <header className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="h-4 w-4 mr-1" /> Back</Button>
          <div>
            <h1 className="text-2xl font-bold">{layoutRow.name}</h1>
            <p className="text-sm text-muted-foreground">Drag, drop, and configure product sections. Products without a layout keep their current page.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-md border p-1">
            <Button variant={device === "desktop" ? "default" : "ghost"} size="sm" onClick={() => setDevice("desktop")}><Monitor className="h-4 w-4" /></Button>
            <Button variant={device === "tablet" ? "default" : "ghost"} size="sm" onClick={() => setDevice("tablet")}><Tablet className="h-4 w-4" /></Button>
            <Button variant={device === "mobile" ? "default" : "ghost"} size="sm" onClick={() => setDevice("mobile")}><Smartphone className="h-4 w-4" /></Button>
          </div>
          <Button variant={layoutRow.status === "published" ? "secondary" : "default"} onClick={async () => {
            const publish = layoutRow.status !== "published";
            await pubLayout({ data: { id: layoutRow.id, publish } });
            setLayoutRow({ ...layoutRow, status: publish ? "published" : "draft" });
            toast.success(publish ? "Published" : "Unpublished");
          }}>{layoutRow.status === "published" ? "Unpublish" : "Publish"}</Button>
        </div>
      </header>

      <Card><CardContent className="p-4 grid md:grid-cols-4 gap-3">
        <div className="md:col-span-2"><Label>Name</Label><Input value={layoutRow.name} onChange={(e) => setLayoutRow({ ...layoutRow, name: e.target.value })} onBlur={async () => { await upsertLayout({ data: layoutRow as any }); await refreshLayout(); }} /></div>
        <div className="md:col-span-2"><Label>Description</Label><Input value={layoutRow.description ?? ""} onChange={(e) => setLayoutRow({ ...layoutRow, description: e.target.value })} onBlur={async () => { await upsertLayout({ data: layoutRow as any }); await refreshLayout(); }} /></div>
        <label className="flex items-center gap-2 text-sm"><Switch checked={layoutRow.is_default} onCheckedChange={async (v) => { const next = { ...layoutRow, is_default: v }; setLayoutRow(next); await upsertLayout({ data: next as any }); await refreshLayout(); }} /> Default layout</label>
        <label className="flex items-center gap-2 text-sm"><Switch checked={layoutRow.enabled} onCheckedChange={async (v) => { const next = { ...layoutRow, enabled: v }; setLayoutRow(next); await upsertLayout({ data: next as any }); }} /> Enabled</label>
      </CardContent></Card>

      <div className="grid grid-cols-12 gap-4">
        <aside className="col-span-4 space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Sections</h2>
            <Button size="sm" onClick={() => setAddOpen(true)}><Plus className="h-4 w-4 mr-1" /> Add</Button>
          </div>
          <div className="space-y-2">
            {sections.map((s, i) => (
              <SectionRow
                key={s.id}
                s={s} index={i} total={sections.length}
                collapsed={!!collapsed[s.id]}
                selected={selected?.id === s.id}
                onSelect={() => setSelected(s)}
                onToggleCollapse={() => setCollapsed({ ...collapsed, [s.id]: !collapsed[s.id] })}
                onChanged={async () => { await refreshSecs(); setSelected(null); }}
                sections={sections}
              />
            ))}
            {sections.length === 0 && (
              <Card><CardContent className="p-6 text-sm text-muted-foreground text-center">No sections yet. Click <b>Add</b>.</CardContent></Card>
            )}
          </div>
        </aside>

        <main className="col-span-8">
          <Tabs defaultValue="preview">
            <TabsList>
              <TabsTrigger value="preview">Preview</TabsTrigger>
              <TabsTrigger value="settings" disabled={!selected}>Section settings</TabsTrigger>
            </TabsList>
            <TabsContent value="preview">
              <div className="border rounded-lg bg-muted/20 p-4 overflow-auto">
                <div className="mx-auto bg-background shadow-sm rounded-md overflow-hidden transition-all" style={{ width: DEVICE_WIDTH[device], maxWidth: "100%" }}>
                  <ProductLayoutRenderer product={DEMO_PRODUCT} sections={sections.filter((s) => s.enabled)} />
                  {sections.length === 0 && <div className="p-16 text-center text-sm text-muted-foreground">Add sections to preview.</div>}
                </div>
              </div>
            </TabsContent>
            <TabsContent value="settings">
              {selected && <SectionEditor section={selected} onSaved={refreshSecs} />}
            </TabsContent>
          </Tabs>
        </main>
      </div>

      <AddSectionDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onAdd={async (typeKey) => {
          const def = findProductSectionDef(typeKey)!;
          const upsert = productLayoutSectionUpsertFn;
          await upsert({ data: {
            layout_id: layoutRow.id,
            section_key: `${typeKey}-${Date.now().toString(36)}`,
            section_type: typeKey,
            title: def.label,
            subtitle: null,
            json_content: { ...def.defaults, style: { container_width: "lg", visibility: { desktop: true, tablet: true, mobile: true }, animation: "none" } },
            sort_order: sections.length,
            enabled: true,
          } as any });
          setAddOpen(false);
          await refreshSecs();
        }}
      />
    </div>
  );
}

function SectionRow({ s, index, total, collapsed, selected, onSelect, onToggleCollapse, onChanged, sections }: {
  s: ProductLayoutSection; index: number; total: number; collapsed: boolean; selected: boolean;
  onSelect: () => void; onToggleCollapse: () => void; onChanged: () => void; sections: ProductLayoutSection[];
}) {
  const upsert = useServerFn(productLayoutSectionUpsertFn);
  const del = useServerFn(productLayoutSectionDeleteFn);
  const dup = useServerFn(productLayoutSectionDuplicateFn);
  const reorder = useServerFn(productLayoutSectionReorderFn);
  const def = findProductSectionDef(s.section_type);

  const move = async (dir: -1 | 1) => {
    const j = index + dir;
    if (j < 0 || j >= sections.length) return;
    const a = sections[index], b = sections[j];
    await reorder({ data: { items: [{ id: a.id, sort_order: b.sort_order }, { id: b.id, sort_order: a.sort_order }] } });
    onChanged();
  };

  return (
    <Card className={selected ? "border-primary" : ""}>
      <CardContent className="p-3 space-y-2">
        <div className="flex items-center gap-2">
          <button onClick={onToggleCollapse} className="p-1">
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          <button className="flex-1 text-left" onClick={onSelect}>
            <div className="font-semibold text-sm">{s.title || def?.label || s.section_type}</div>
            <div className="text-xs text-muted-foreground">{def?.label ?? s.section_type}</div>
          </button>
          <Switch checked={s.enabled} onCheckedChange={async (v) => { await upsert({ data: { ...s, enabled: v } as any }); onChanged(); }} />
        </div>
        {!collapsed && (
          <div className="flex items-center gap-1 pt-2 border-t">
            <Button size="sm" variant="ghost" onClick={() => move(-1)} disabled={index === 0}><ArrowUp className="h-3.5 w-3.5" /></Button>
            <Button size="sm" variant="ghost" onClick={() => move(1)} disabled={index === total - 1}><ArrowDown className="h-3.5 w-3.5" /></Button>
            <Button size="sm" variant="ghost" onClick={onSelect}>Edit</Button>
            <Button size="sm" variant="ghost" onClick={async () => { await dup({ data: { id: s.id } }); onChanged(); }}><Copy className="h-3.5 w-3.5" /></Button>
            <Button size="sm" variant="ghost" onClick={async () => { if (confirm("Delete section?")) { await del({ data: { id: s.id } }); onChanged(); } }}><Trash2 className="h-3.5 w-3.5" /></Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SectionEditor({ section, onSaved }: { section: ProductLayoutSection; onSaved: () => Promise<void> }) {
  const upsert = useServerFn(productLayoutSectionUpsertFn);
  const [draft, setDraft] = useState<ProductLayoutSection>(section);
  useEffect(() => setDraft(section), [section.id]);
  const style = draft.json_content?.style ?? {};
  const setStyle = (patch: any) => setDraft({ ...draft, json_content: { ...draft.json_content, style: { ...style, ...patch } } });
  const setJson = (patch: any) => setDraft({ ...draft, json_content: { ...draft.json_content, ...patch } });

  const save = async () => {
    try {
      await upsert({ data: draft as any });
      toast.success("Saved");
      await onSaved();
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <Card><CardContent className="p-4 space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Title</Label><Input value={draft.title ?? ""} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></div>
        <div><Label>Subtitle</Label><Input value={draft.subtitle ?? ""} onChange={(e) => setDraft({ ...draft, subtitle: e.target.value })} /></div>
      </div>
      <div><Label>Description</Label><Textarea rows={2} value={draft.json_content?.description ?? ""} onChange={(e) => setJson({ description: e.target.value })} /></div>

      <details className="border rounded-md p-3" open>
        <summary className="font-semibold text-sm cursor-pointer">Type-specific JSON</summary>
        <p className="text-xs text-muted-foreground mt-1">Advanced: edit the raw config for this section.</p>
        <Textarea rows={10} className="font-mono text-xs mt-2"
          defaultValue={JSON.stringify({ ...draft.json_content, style: undefined, description: undefined }, null, 2)}
          onBlur={(e) => {
            try {
              const parsed = JSON.parse(e.target.value);
              setDraft({ ...draft, json_content: { ...parsed, style, description: draft.json_content?.description } });
            } catch { toast.error("Invalid JSON"); }
          }} />
      </details>

      <details className="border rounded-md p-3">
        <summary className="font-semibold text-sm cursor-pointer">Style & layout</summary>
        <div className="grid grid-cols-2 gap-3 mt-3">
          <div><Label>Background color</Label><Input value={style.background_color ?? ""} onChange={(e) => setStyle({ background_color: e.target.value })} /></div>
          <div><Label>Background image URL</Label><Input value={style.background_image ?? ""} onChange={(e) => setStyle({ background_image: e.target.value })} /></div>
          <div><Label>Padding</Label><Input value={style.padding ?? ""} onChange={(e) => setStyle({ padding: e.target.value })} placeholder="40px 0" /></div>
          <div><Label>Margin</Label><Input value={style.margin ?? ""} onChange={(e) => setStyle({ margin: e.target.value })} /></div>
          <div><Label>Container width</Label>
            <Select value={style.container_width ?? "lg"} onValueChange={(v) => setStyle({ container_width: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="sm">Small</SelectItem>
                <SelectItem value="md">Medium</SelectItem>
                <SelectItem value="lg">Large</SelectItem>
                <SelectItem value="xl">Extra large</SelectItem>
                <SelectItem value="full">Full width</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>Animation</Label>
            <Select value={style.animation ?? "none"} onValueChange={(v) => setStyle({ animation: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="fade">Fade</SelectItem>
                <SelectItem value="slide-up">Slide up</SelectItem>
                <SelectItem value="zoom">Zoom</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2"><Label>Custom CSS class</Label><Input value={style.custom_class ?? ""} onChange={(e) => setStyle({ custom_class: e.target.value })} /></div>
        </div>
        <div className="mt-3">
          <Label>Visibility</Label>
          <div className="flex gap-4 mt-1">
            {(["desktop","tablet","mobile"] as const).map((k) => (
              <label key={k} className="flex items-center gap-2 text-sm capitalize">
                <Switch checked={style.visibility?.[k] !== false} onCheckedChange={(v) => setStyle({ visibility: { ...style.visibility, [k]: v } })} /> {k}
              </label>
            ))}
          </div>
        </div>
      </details>

      <div className="flex justify-end gap-2"><Button onClick={save}>Save changes</Button></div>
    </CardContent></Card>
  );
}

function AddSectionDialog({ open, onOpenChange, onAdd }: { open: boolean; onOpenChange: (v: boolean) => void; onAdd: (t: ProductSectionTypeKey) => void }) {
  const grouped = useMemo(() => {
    const m: Record<string, typeof PRODUCT_SECTION_TYPES> = {};
    for (const t of PRODUCT_SECTION_TYPES) { (m[t.group] ??= []).push(t); }
    return m;
  }, []);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Add product section</DialogTitle></DialogHeader>
        <div className="space-y-5">
          {Object.entries(grouped).map(([group, types]) => (
            <div key={group}>
              <h3 className="text-xs uppercase tracking-wide text-muted-foreground mb-2">{group}</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {types.map((t) => (
                  <button key={t.key} onClick={() => onAdd(t.key)} className="text-left rounded-lg border p-3 hover:border-primary hover:bg-muted/40 transition">
                    <div className="font-semibold text-sm">{t.label}</div>
                    <div className="text-xs text-muted-foreground line-clamp-2">{t.description}</div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
