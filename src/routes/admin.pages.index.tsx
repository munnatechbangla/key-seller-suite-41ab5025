import { createFileRoute, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PAGE_META, PAGE_SLUGS } from "@/lib/cms/pages/schemas";
import { Eye, EyeOff, ExternalLink, ChevronRight, Plus, Copy, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MediaPicker } from "@/components/admin/MediaLibrary";
import { RichTextEditor } from "@/components/admin/RichTextEditor";
import {
  cmsListPagesFn, cmsUpsertPageFn, cmsDeletePageFn, cmsDuplicatePageFn, cmsPublishPageFn,
} from "@/lib/cms.functions";

type CustomPageRow = {
  id: string; slug: string; title: string;
  featured_image: string | null; excerpt: string | null; body_html: string | null;
  meta_title: string | null; meta_description: string | null;
  status: string; show_in_header: boolean; show_in_footer: boolean;
  updated_at: string;
};

export const Route = createFileRoute("/admin/pages/")({
  validateSearch: (s: Record<string, unknown>) => ({ new: s.new ? 1 : undefined }),
  component: AdminPagesIndex,
});

function AdminPagesIndex() {
  const { new: openNewFlag } = Route.useSearch();
  const { data: rows = [] } = useQuery({
    queryKey: ["admin_pages_index"],
    queryFn: async () => {
      const { data } = await supabase.from("legal_pages").select("id,slug,is_published,updated_at");
      return data ?? [];
    },
  });
  const bySlug = new Map(rows.map((r: any) => [r.slug, r]));

  const list = useServerFn(cmsListPagesFn);
  const upsert = useServerFn(cmsUpsertPageFn);
  const del = useServerFn(cmsDeletePageFn);
  const dup = useServerFn(cmsDuplicatePageFn);
  const pub = useServerFn(cmsPublishPageFn);
  const [custom, setCustom] = useState<CustomPageRow[]>([]);
  const [editing, setEditing] = useState<Partial<CustomPageRow> | null>(null);
  const [open, setOpen] = useState(false);

  const refresh = () => list().then((r: any) => setCustom(r as CustomPageRow[]));
  useEffect(() => { refresh(); }, []);
  useEffect(() => {
    if (openNewFlag) {
      setEditing({ slug: "", title: "", status: "draft", show_in_header: false, show_in_footer: false });
      setOpen(true);
    }
  }, [openNewFlag]);

  const openNew = () => {
    setEditing({ slug: "", title: "", status: "draft", show_in_header: false, show_in_footer: false });
    setOpen(true);
  };
  const save = async () => {
    if (!editing?.slug || !editing?.title) { toast.error("Slug and title required"); return; }
    try {
      await upsert({ data: { ...editing, template: "default", page_type: "standard" } as any });
      toast.success("Saved");
      setOpen(false);
      refresh();
    } catch (e: any) { toast.error(e.message); }
  };

  const builtInSlugs = new Set(PAGE_SLUGS as readonly string[]);
  const customOnly = custom.filter((c) => !builtInSlugs.has(c.slug));

  return (
    <div className="p-6 max-w-5xl space-y-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Pages</h1>
          <p className="text-sm text-muted-foreground">Edit built-in pages, or create unlimited custom pages.</p>
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" /> New Page</Button>
      </header>

      <section>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase mb-2">Built-in pages</h2>
        <div className="rounded-xl border border-border bg-card divide-y divide-border">
          {PAGE_SLUGS.map((slug) => {
            const row = bySlug.get(slug) as any;
            const published = row?.is_published ?? false;
            return (
              <Link
                key={slug}
                to="/admin/pages/$slug"
                params={{ slug }}
                className="flex items-center gap-4 p-4 hover:bg-muted/40 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{PAGE_META[slug].title}</span>
                    <span className="text-xs text-muted-foreground">/{slug}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">{PAGE_META[slug].description}</div>
                </div>
                <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${published ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground"}`}>
                  {published ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                  {published ? "Published" : "Draft"}
                </span>
                <a
                  href={PAGE_META[slug].frontendPath}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                >
                  View <ExternalLink className="h-3 w-3" />
                </a>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase mb-2">Custom pages</h2>
        <div className="rounded-xl border border-border bg-card">
          {customOnly.length === 0 && (
            <div className="p-6 text-sm text-muted-foreground text-center">No custom pages yet. Click <strong>New Page</strong> to create one.</div>
          )}
          {customOnly.map((r) => (
            <div key={r.id} className="flex items-center gap-3 p-4 border-b last:border-b-0">
              <div className="flex-1 min-w-0">
                <div className="font-medium">{r.title}</div>
                <div className="text-xs text-muted-foreground">/{r.slug}</div>
              </div>
              <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{r.status}</span>
              <Button size="sm" variant="ghost" onClick={() => { setEditing(r); setOpen(true); }}>Edit</Button>
              <Button size="sm" variant="ghost" onClick={async () => { await pub({ data: { id: r.id, publish: r.status !== "published" } }); refresh(); }}>
                {r.status === "published" ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
              <Button size="sm" variant="ghost" onClick={async () => { await dup({ data: { id: r.id } }); refresh(); }}><Copy className="h-4 w-4" /></Button>
              <Button size="sm" variant="ghost" onClick={async () => { if (confirm("Delete page?")) { await del({ data: { id: r.id } }); refresh(); } }}><Trash2 className="h-4 w-4" /></Button>
              <a href={`/${r.slug}`} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline inline-flex items-center gap-1"><ExternalLink className="h-3 w-3" /></a>
            </div>
          ))}
        </div>
      </section>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing?.id ? "Edit page" : "New page"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Title</Label><Input value={editing.title ?? ""} onChange={(e) => setEditing({ ...editing, title: e.target.value })} /></div>
                <div><Label>Slug</Label><Input value={editing.slug ?? ""} onChange={(e) => setEditing({ ...editing, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })} /></div>
              </div>
              <MediaPicker label="Featured image" value={editing.featured_image ?? ""} onChange={(v) => setEditing({ ...editing, featured_image: v || null })} />
              <div><Label>Excerpt</Label><Textarea rows={2} value={editing.excerpt ?? ""} onChange={(e) => setEditing({ ...editing, excerpt: e.target.value })} /></div>
              <div><Label>Body</Label><RichTextEditor value={editing.body_html ?? ""} onChange={(v) => setEditing({ ...editing, body_html: v })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex items-center gap-2"><Switch checked={!!editing.show_in_header} onCheckedChange={(v) => setEditing({ ...editing, show_in_header: v })} /> Show in header</label>
                <label className="flex items-center gap-2"><Switch checked={!!editing.show_in_footer} onCheckedChange={(v) => setEditing({ ...editing, show_in_footer: v })} /> Show in footer</label>
              </div>
              <details className="border rounded p-3">
                <summary className="cursor-pointer font-medium text-sm">SEO</summary>
                <div className="mt-3 space-y-3">
                  <div><Label>Meta title</Label><Input value={editing.meta_title ?? ""} onChange={(e) => setEditing({ ...editing, meta_title: e.target.value })} /></div>
                  <div><Label>Meta description</Label><Textarea value={editing.meta_description ?? ""} onChange={(e) => setEditing({ ...editing, meta_description: e.target.value })} /></div>
                </div>
              </details>
              <div className="flex justify-between items-center pt-2">
                <div className="flex items-center gap-2 text-sm">
                  <Label className="mb-0">Published</Label>
                  <Switch checked={editing.status === "published"} onCheckedChange={(v) => setEditing({ ...editing, status: v ? "published" : "draft" })} />
                </div>
                <div className="flex gap-2">
                  {editing.slug && <Button variant="outline" asChild><a href={`/${editing.slug}`} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4 mr-1" />Preview</a></Button>}
                  <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button onClick={save}>Save</Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
