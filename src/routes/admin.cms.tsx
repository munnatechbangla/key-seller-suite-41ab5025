import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  cmsListPagesFn, cmsUpsertPageFn, cmsDeletePageFn, cmsDuplicatePageFn, cmsPublishPageFn,
  cmsListMenuFn, cmsUpsertMenuItemFn, cmsDeleteMenuItemFn,
  cmsListFooterFn, cmsUpsertFooterFn, cmsDeleteFooterFn,
} from "@/lib/cms.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Copy, Eye, EyeOff, Plus, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/admin/cms")({
  component: AdminCMSPage,
});

function AdminCMSPage() {
  return (
    <div className="p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-bold">CMS</h1>
        <p className="text-sm text-muted-foreground">
          Manage pages, menus, footer, and site settings. All existing storefront routes continue to work unchanged.
        </p>
      </header>
      <Tabs defaultValue="pages">
        <TabsList>
          <TabsTrigger value="pages">Pages</TabsTrigger>
          <TabsTrigger value="homepage">Homepage</TabsTrigger>
          <TabsTrigger value="menus">Menus</TabsTrigger>
          <TabsTrigger value="footer">Footer</TabsTrigger>
          <TabsTrigger value="settings">Site Settings</TabsTrigger>
        </TabsList>
        <TabsContent value="pages"><PagesTab /></TabsContent>
        <TabsContent value="homepage"><HomepagePointer /></TabsContent>
        <TabsContent value="menus"><MenusTab /></TabsContent>
        <TabsContent value="footer"><FooterTab /></TabsContent>
        <TabsContent value="settings"><SettingsPointer /></TabsContent>
      </Tabs>
    </div>
  );
}

// ============= PAGES =============
type PageRow = {
  id: string; slug: string; title: string; description: string | null;
  meta_title: string | null; meta_description: string | null;
  og_title: string | null; og_description: string | null; og_image: string | null;
  canonical_url: string | null; robots: string | null;
  page_type: string; status: string; published_at: string | null; updated_at: string;
};

function PagesTab() {
  const list = useServerFn(cmsListPagesFn);
  const upsert = useServerFn(cmsUpsertPageFn);
  const del = useServerFn(cmsDeletePageFn);
  const dup = useServerFn(cmsDuplicatePageFn);
  const pub = useServerFn(cmsPublishPageFn);
  const [rows, setRows] = useState<PageRow[]>([]);
  const [editing, setEditing] = useState<Partial<PageRow> | null>(null);
  const [open, setOpen] = useState(false);

  const refresh = () => list().then((r) => setRows(r as PageRow[]));
  useEffect(() => { refresh(); }, []);

  const openNew = () => {
    setEditing({ slug: "", title: "", page_type: "standard", status: "draft", robots: "index,follow" });
    setOpen(true);
  };
  const openEdit = (r: PageRow) => { setEditing(r); setOpen(true); };
  const save = async () => {
    if (!editing?.slug || !editing?.title) { toast.error("Slug and title required"); return; }
    try {
      await upsert({ data: editing as any });
      toast.success("Saved");
      setOpen(false); refresh();
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Pages</h2>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" /> New Page</Button>
      </div>
      <Card><CardContent className="p-0">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left">
            <tr><th className="p-3">Title</th><th className="p-3">Slug</th><th className="p-3">Status</th><th className="p-3">Type</th><th className="p-3 text-right">Actions</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="p-3 font-medium">{r.title}</td>
                <td className="p-3 text-muted-foreground">/{r.slug}</td>
                <td className="p-3">{r.status}</td>
                <td className="p-3">{r.page_type}</td>
                <td className="p-3 text-right space-x-1">
                  <Button size="sm" variant="ghost" onClick={() => openEdit(r)}>Edit</Button>
                  <Button size="sm" variant="ghost" onClick={async () => { await pub({ data: { id: r.id, publish: r.status !== "published" } }); refresh(); }}>
                    {r.status === "published" ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={async () => { await dup({ data: { id: r.id } }); refresh(); }}><Copy className="h-3.5 w-3.5" /></Button>
                  <Button size="sm" variant="ghost" onClick={async () => { if (confirm("Delete page?")) { await del({ data: { id: r.id } }); refresh(); } }}><Trash2 className="h-3.5 w-3.5" /></Button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">No pages yet.</td></tr>}
          </tbody>
        </table>
      </CardContent></Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing?.id ? "Edit page" : "New page"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Title</Label><Input value={editing.title ?? ""} onChange={(e) => setEditing({ ...editing, title: e.target.value })} /></div>
                <div><Label>Slug</Label><Input value={editing.slug ?? ""} onChange={(e) => setEditing({ ...editing, slug: e.target.value })} /></div>
              </div>
              <div><Label>Description</Label><Textarea value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Page type</Label>
                  <Select value={editing.page_type ?? "standard"} onValueChange={(v) => setEditing({ ...editing, page_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="standard">Standard</SelectItem>
                      <SelectItem value="landing">Landing</SelectItem>
                      <SelectItem value="legal">Legal</SelectItem>
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Status</Label>
                  <Select value={editing.status ?? "draft"} onValueChange={(v) => setEditing({ ...editing, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="published">Published</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <details className="border rounded p-3">
                <summary className="cursor-pointer font-medium text-sm">SEO & Open Graph</summary>
                <div className="mt-3 space-y-3">
                  <div><Label>Meta title</Label><Input value={editing.meta_title ?? ""} onChange={(e) => setEditing({ ...editing, meta_title: e.target.value })} /></div>
                  <div><Label>Meta description</Label><Textarea value={editing.meta_description ?? ""} onChange={(e) => setEditing({ ...editing, meta_description: e.target.value })} /></div>
                  <div><Label>OG title</Label><Input value={editing.og_title ?? ""} onChange={(e) => setEditing({ ...editing, og_title: e.target.value })} /></div>
                  <div><Label>OG description</Label><Textarea value={editing.og_description ?? ""} onChange={(e) => setEditing({ ...editing, og_description: e.target.value })} /></div>
                  <div><Label>OG image URL</Label><Input value={editing.og_image ?? ""} onChange={(e) => setEditing({ ...editing, og_image: e.target.value })} /></div>
                  <div><Label>Canonical URL</Label><Input value={editing.canonical_url ?? ""} onChange={(e) => setEditing({ ...editing, canonical_url: e.target.value })} /></div>
                  <div><Label>Robots</Label><Input value={editing.robots ?? "index,follow"} onChange={(e) => setEditing({ ...editing, robots: e.target.value })} /></div>
                </div>
              </details>
              <div className="flex justify-end gap-2 pt-2">
                {editing.slug && <Button variant="outline" asChild><a href={`/${editing.slug}`} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4 mr-1" />Preview</a></Button>}
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={save}>Save</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============= MENUS =============
type MenuItem = { id: string; menu_name: string; label: string; url: string; icon: string | null; target: string | null; parent_id: string | null; sort_order: number; enabled: boolean };

function MenusTab() {
  const [menuName, setMenuName] = useState("primary");
  const list = useServerFn(cmsListMenuFn);
  const upsert = useServerFn(cmsUpsertMenuItemFn);
  const del = useServerFn(cmsDeleteMenuItemFn);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [draft, setDraft] = useState<Partial<MenuItem>>({ label: "", url: "/", target: "_self" });

  const refresh = () => list({ data: { menu_name: menuName } }).then((r) => setItems(r as MenuItem[]));
  useEffect(() => { refresh(); }, [menuName]);

  const add = async () => {
    if (!draft.label) return;
    await upsert({ data: { ...draft, menu_name: menuName, sort_order: items.length, enabled: true } as any });
    setDraft({ label: "", url: "/", target: "_self" });
    refresh();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Label>Menu</Label>
        <Select value={menuName} onValueChange={setMenuName}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="primary">Primary Nav</SelectItem>
            <SelectItem value="footer_company">Footer — Company</SelectItem>
            <SelectItem value="footer_support">Footer — Support</SelectItem>
            <SelectItem value="mobile">Mobile</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card><CardContent className="p-4 space-y-2">
        {items.map((it, i) => (
          <div key={it.id} className="flex items-center gap-2 border rounded p-2">
            <Input className="flex-1" value={it.label} onChange={async (e) => { await upsert({ data: { ...it, label: e.target.value } as any }); refresh(); }} />
            <Input className="flex-1" value={it.url} onChange={async (e) => { await upsert({ data: { ...it, url: e.target.value } as any }); refresh(); }} />
            <Select value={it.target ?? "_self"} onValueChange={async (v) => { await upsert({ data: { ...it, target: v } as any }); refresh(); }}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="_self">Same tab</SelectItem><SelectItem value="_blank">New tab</SelectItem></SelectContent>
            </Select>
            <Switch checked={it.enabled} onCheckedChange={async (v) => { await upsert({ data: { ...it, enabled: v } as any }); refresh(); }} />
            <Button size="sm" variant="ghost" disabled={i === 0} onClick={async () => { const prev = items[i - 1]; await upsert({ data: { ...it, sort_order: prev.sort_order } as any }); await upsert({ data: { ...prev, sort_order: it.sort_order } as any }); refresh(); }}>↑</Button>
            <Button size="sm" variant="ghost" disabled={i === items.length - 1} onClick={async () => { const nx = items[i + 1]; await upsert({ data: { ...it, sort_order: nx.sort_order } as any }); await upsert({ data: { ...nx, sort_order: it.sort_order } as any }); refresh(); }}>↓</Button>
            <Button size="sm" variant="ghost" onClick={async () => { await del({ data: { id: it.id } }); refresh(); }}><Trash2 className="h-4 w-4" /></Button>
          </div>
        ))}
        {items.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No items yet.</p>}
      </CardContent></Card>

      <Card><CardHeader><CardTitle className="text-base">Add item</CardTitle></CardHeader>
        <CardContent className="flex gap-2">
          <Input placeholder="Label" value={draft.label ?? ""} onChange={(e) => setDraft({ ...draft, label: e.target.value })} />
          <Input placeholder="URL (/products, https://...)" value={draft.url ?? ""} onChange={(e) => setDraft({ ...draft, url: e.target.value })} />
          <Button onClick={add}><Plus className="h-4 w-4" /></Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ============= FOOTER =============
type FooterRow = { id: string; section_name: string; json_content: any; sort_order: number; enabled: boolean };

function FooterTab() {
  const list = useServerFn(cmsListFooterFn);
  const upsert = useServerFn(cmsUpsertFooterFn);
  const del = useServerFn(cmsDeleteFooterFn);
  const [rows, setRows] = useState<FooterRow[]>([]);
  const [draft, setDraft] = useState<{ section_name: string; body: string }>({ section_name: "", body: "{}" });
  const refresh = () => list().then((r) => setRows(r as FooterRow[]));
  useEffect(() => { refresh(); }, []);
  const add = async () => {
    if (!draft.section_name) return;
    let parsed: any = {};
    try { parsed = JSON.parse(draft.body || "{}"); } catch { toast.error("Invalid JSON"); return; }
    await upsert({ data: { section_name: draft.section_name, json_content: parsed, sort_order: rows.length, enabled: true } });
    setDraft({ section_name: "", body: "{}" });
    refresh();
  };
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Footer blocks (columns, social icons, newsletter, payment icons, copyright). Content is JSON — the storefront reads it when configured.
      </p>
      {rows.map((r) => (
        <Card key={r.id}><CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="font-semibold">{r.section_name}</div>
            <div className="flex items-center gap-2">
              <Switch checked={r.enabled} onCheckedChange={async (v) => { await upsert({ data: { ...r, enabled: v } as any }); refresh(); }} />
              <Button size="sm" variant="ghost" onClick={async () => { await del({ data: { id: r.id } }); refresh(); }}><Trash2 className="h-4 w-4" /></Button>
            </div>
          </div>
          <Textarea rows={4} defaultValue={JSON.stringify(r.json_content, null, 2)} onBlur={async (e) => { try { const j = JSON.parse(e.target.value); await upsert({ data: { ...r, json_content: j } as any }); refresh(); } catch { toast.error("Invalid JSON"); } }} />
        </CardContent></Card>
      ))}
      <Card><CardHeader><CardTitle className="text-base">Add footer block</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <Input placeholder="Section name (e.g. company, social, newsletter)" value={draft.section_name} onChange={(e) => setDraft({ ...draft, section_name: e.target.value })} />
          <Textarea rows={3} placeholder='{"title":"Company","links":[{"label":"About","href":"/about"}]}' value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} />
          <Button onClick={add}><Plus className="h-4 w-4 mr-1" /> Add</Button>
        </CardContent>
      </Card>
    </div>
  );
}

function HomepagePointer() {
  return (
    <Card><CardContent className="p-6 space-y-2">
      <p className="text-sm text-muted-foreground">
        Build a fully dynamic homepage with drag-and-drop sections. Until you publish, the current homepage keeps rendering unchanged.
      </p>
      <div className="flex gap-2">
        <Button asChild><a href="/admin/cms/homepage">Open Homepage Builder</a></Button>
        <Button variant="outline" asChild><a href="/admin/homepage">Legacy static homepage config</a></Button>
      </div>
    </CardContent></Card>
  );
}

function SettingsPointer() {
  return (
    <Card><CardContent className="p-6 text-sm text-muted-foreground">
      Logos, favicon, company info, social links, theme colors, and payment/analytics config live in{" "}
      <a className="underline" href="/admin/settings">Admin → Settings</a>. The existing settings store is the source of truth; CMS Pages/Menus/Footer above are additive layers.
    </CardContent></Card>
  );
}
