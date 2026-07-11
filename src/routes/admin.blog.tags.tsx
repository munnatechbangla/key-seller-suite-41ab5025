import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  blogAdminListTagsFn, blogAdminUpsertTagFn, blogAdminDeleteTagFn,
} from "@/lib/blog.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/admin/blog/tags")({ component: Page });

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

type Tag = { id: string; name: string; slug: string; post_count: number };

function Page() {
  const list = useServerFn(blogAdminListTagsFn);
  const upsert = useServerFn(blogAdminUpsertTagFn);
  const del = useServerFn(blogAdminDeleteTagFn);
  const [rows, setRows] = useState<Tag[]>([]);
  const [editing, setEditing] = useState<Partial<Tag> | null>(null);
  const [open, setOpen] = useState(false);

  const refresh = () => list().then((r) => setRows(r as unknown as Tag[]));
  useEffect(() => { refresh(); }, []);

  const save = async () => {
    if (!editing?.name || !editing?.slug) { toast.error("Name and slug required"); return; }
    try {
      await upsert({ data: { id: editing.id, name: editing.name, slug: editing.slug } });
      toast.success("Saved"); setOpen(false); refresh();
    } catch (e) { toast.error((e as Error).message); }
  };

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Blog Tags</h1>
          <p className="text-sm text-muted-foreground">Cross-cutting labels for blog posts.</p>
        </div>
        <Button onClick={() => { setEditing({ name: "", slug: "" }); setOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> New Tag
        </Button>
      </header>

      <Card><CardContent className="p-0">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left"><tr><th className="p-3">Name</th><th className="p-3">Slug</th><th className="p-3">Posts</th><th className="p-3 text-right">Actions</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="p-3 font-medium">{r.name}</td>
                <td className="p-3 text-muted-foreground">/{r.slug}</td>
                <td className="p-3">{r.post_count}</td>
                <td className="p-3 text-right space-x-1">
                  <Button size="sm" variant="ghost" onClick={() => { setEditing(r); setOpen(true); }}>Edit</Button>
                  <Button size="sm" variant="ghost" onClick={async () => { if (confirm("Delete tag?")) { await del({ data: { id: r.id } }); refresh(); } }}><Trash2 className="h-3.5 w-3.5" /></Button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">No tags yet.</td></tr>}
          </tbody>
        </table>
      </CardContent></Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{editing?.id ? "Edit tag" : "New tag"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div><Label>Name</Label><Input value={editing.name ?? ""} onChange={(e) => {
                const name = e.target.value;
                setEditing((prev) => prev ? ({ ...prev, name, slug: (!prev.id && (!prev.slug || prev.slug === slugify(prev.name ?? ""))) ? slugify(name) : prev.slug }) : prev);
              }} /></div>
              <div><Label>Slug</Label><Input value={editing.slug ?? ""} onChange={(e) => setEditing({ ...editing, slug: slugify(e.target.value) })} /></div>
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
