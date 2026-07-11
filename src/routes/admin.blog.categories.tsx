import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  blogAdminListCategoriesFn, blogAdminUpsertCategoryFn, blogAdminDeleteCategoryFn,
} from "@/lib/blog.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MediaPicker } from "@/components/admin/MediaLibrary";
import { Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/admin/blog/categories")({ component: Page });

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

type Cat = { id: string; slug: string; name: string; description: string | null; parent_id: string | null; icon: string | null; sort_order: number; post_count: number; kind: string };

function Page() {
  const list = useServerFn(blogAdminListCategoriesFn);
  const upsert = useServerFn(blogAdminUpsertCategoryFn);
  const del = useServerFn(blogAdminDeleteCategoryFn);
  const [rows, setRows] = useState<Cat[]>([]);
  const [editing, setEditing] = useState<Partial<Cat> | null>(null);
  const [open, setOpen] = useState(false);

  const refresh = () => list().then((r) => setRows(r as unknown as Cat[]));
  useEffect(() => { refresh(); }, []);

  const save = async () => {
    if (!editing?.name || !editing?.slug) { toast.error("Name and slug required"); return; }
    try {
      await upsert({ data: {
        id: editing.id, name: editing.name, slug: editing.slug,
        description: editing.description ?? null, parent_id: editing.parent_id || null,
        icon: editing.icon ?? null, sort_order: editing.sort_order ?? 0, kind: "blog",
      } });
      toast.success("Saved"); setOpen(false); refresh();
    } catch (e) { toast.error((e as Error).message); }
  };

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Blog Categories</h1>
          <p className="text-sm text-muted-foreground">Organize blog posts into categories.</p>
        </div>
        <Button onClick={() => { setEditing({ name: "", slug: "", description: "", parent_id: null, icon: "", sort_order: 0 }); setOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> New Category
        </Button>
      </header>

      <Card><CardContent className="p-0">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left"><tr>
            <th className="p-3">Image</th><th className="p-3">Name</th><th className="p-3">Slug</th>
            <th className="p-3">Parent</th><th className="p-3">Posts</th><th className="p-3 text-right">Actions</th>
          </tr></thead>
          <tbody>
            {rows.map((r) => {
              const parent = rows.find((p) => p.id === r.parent_id);
              return (
                <tr key={r.id} className="border-t">
                  <td className="p-3">{r.icon ? <img src={r.icon} alt="" className="h-9 w-9 rounded object-cover" /> : <div className="h-9 w-9 rounded bg-muted" />}</td>
                  <td className="p-3 font-medium">{r.name}</td>
                  <td className="p-3 text-muted-foreground">/{r.slug}</td>
                  <td className="p-3 text-muted-foreground">{parent?.name ?? "—"}</td>
                  <td className="p-3">{r.post_count}</td>
                  <td className="p-3 text-right space-x-1">
                    <Button size="sm" variant="ghost" onClick={() => { setEditing(r); setOpen(true); }}>Edit</Button>
                    <Button size="sm" variant="ghost" onClick={async () => { if (confirm("Delete category?")) { await del({ data: { id: r.id } }); refresh(); } }}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">No categories yet.</td></tr>}
          </tbody>
        </table>
      </CardContent></Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing?.id ? "Edit category" : "New category"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div><Label>Name</Label><Input value={editing.name ?? ""} onChange={(e) => {
                const name = e.target.value;
                setEditing((prev) => prev ? ({ ...prev, name, slug: (!prev.id && (!prev.slug || prev.slug === slugify(prev.name ?? ""))) ? slugify(name) : prev.slug }) : prev);
              }} /></div>
              <div><Label>Slug</Label><Input value={editing.slug ?? ""} onChange={(e) => setEditing({ ...editing, slug: slugify(e.target.value) })} /></div>
              <div><Label>Description</Label><Textarea rows={2} value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></div>
              <div><Label>Parent category</Label>
                <Select value={editing.parent_id ?? "none"} onValueChange={(v) => setEditing({ ...editing, parent_id: v === "none" ? null : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— None —</SelectItem>
                    {rows.filter((r) => r.id !== editing.id).map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <MediaPicker label="Category image" value={editing.icon ?? ""} onChange={(v) => setEditing({ ...editing, icon: v || null })} />
              <div><Label>Sort order</Label><Input type="number" value={editing.sort_order ?? 0} onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) || 0 })} /></div>
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
