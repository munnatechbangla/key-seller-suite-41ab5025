import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  landingListPagesFn, landingUpsertPageFn, landingDeletePageFn,
  landingDuplicatePageFn, landingPublishPageFn,
} from "@/lib/landing.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Copy, Eye, EyeOff, Plus, ExternalLink, Pencil } from "lucide-react";

export const Route = createFileRoute("/admin/cms/landing-pages")({
  component: LandingPagesAdmin,
});

type Row = {
  id: string; slug: string; title: string; description: string | null;
  page_type: string; status: string;
  meta_title: string | null; meta_description: string | null;
  og_title: string | null; og_description: string | null; og_image: string | null;
  canonical_url: string | null; robots: string | null;
  updated_at: string;
};

const PAGE_TYPES = [
  "sales", "campaign", "launch", "thank_you", "coupon",
  "lead_gen", "webinar", "black_friday", "custom",
];

function LandingPagesAdmin() {
  const list = useServerFn(landingListPagesFn);
  const upsert = useServerFn(landingUpsertPageFn);
  const del = useServerFn(landingDeletePageFn);
  const dup = useServerFn(landingDuplicatePageFn);
  const pub = useServerFn(landingPublishPageFn);
  const [rows, setRows] = useState<Row[]>([]);
  const [editing, setEditing] = useState<Partial<Row> | null>(null);
  const [open, setOpen] = useState(false);

  const refresh = () => list().then((r) => setRows(r as Row[]));
  useEffect(() => { refresh(); }, []);

  const openNew = () => {
    setEditing({ slug: "", title: "", page_type: "custom", status: "draft", robots: "index,follow" });
    setOpen(true);
  };
  const save = async () => {
    if (!editing?.slug || !editing?.title) { toast.error("Slug and title required"); return; }
    try {
      const row = await upsert({ data: editing as any });
      toast.success("Saved");
      setOpen(false); await refresh();
      return row;
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Landing Pages</h1>
          <p className="text-sm text-muted-foreground">Independent marketing pages — sales, launch, campaigns, thank-you, and more.</p>
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" /> New Landing Page</Button>
      </header>

      <Card><CardContent className="p-0">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left">
            <tr><th className="p-3">Title</th><th className="p-3">Slug</th><th className="p-3">Type</th><th className="p-3">Status</th><th className="p-3 text-right">Actions</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="p-3 font-medium">{r.title}</td>
                <td className="p-3 text-muted-foreground">/l/{r.slug}</td>
                <td className="p-3">{r.page_type}</td>
                <td className="p-3">{r.status}</td>
                <td className="p-3 text-right space-x-1">
                  <Button size="sm" variant="ghost" asChild>
                    <Link to="/admin/cms/landing-pages/$id" params={{ id: r.id }}><Pencil className="h-3.5 w-3.5" /></Link>
                  </Button>
                  <Button size="sm" variant="ghost" onClick={async () => { await pub({ data: { id: r.id, publish: r.status !== "published" } }); refresh(); }}>
                    {r.status === "published" ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </Button>
                  <Button size="sm" variant="ghost" asChild><a href={`/l/${r.slug}`} target="_blank" rel="noreferrer"><ExternalLink className="h-3.5 w-3.5" /></a></Button>
                  <Button size="sm" variant="ghost" onClick={async () => { await dup({ data: { id: r.id } }); refresh(); }}><Copy className="h-3.5 w-3.5" /></Button>
                  <Button size="sm" variant="ghost" onClick={async () => { if (confirm("Delete landing page?")) { await del({ data: { id: r.id } }); refresh(); } }}><Trash2 className="h-3.5 w-3.5" /></Button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">No landing pages yet.</td></tr>}
          </tbody>
        </table>
      </CardContent></Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing?.id ? "Edit landing page" : "New landing page"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Title</Label><Input value={editing.title ?? ""} onChange={(e) => setEditing({ ...editing, title: e.target.value })} /></div>
                <div><Label>Slug</Label><Input value={editing.slug ?? ""} onChange={(e) => setEditing({ ...editing, slug: e.target.value })} /></div>
              </div>
              <div><Label>Description</Label><Textarea value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Page type</Label>
                  <Select value={editing.page_type ?? "custom"} onValueChange={(v) => setEditing({ ...editing, page_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{PAGE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
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
                <summary className="cursor-pointer font-medium text-sm">SEO &amp; Open Graph</summary>
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
