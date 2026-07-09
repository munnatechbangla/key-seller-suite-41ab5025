import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  adminListCategoriesFn,
  adminUpsertCategoryFn,
  adminDeleteCategoryFn,
  adminDuplicateCategoryFn,
  type AdminCategory,
} from "@/lib/categories.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MediaPicker } from "@/components/admin/MediaLibrary";
import { Plus, Pencil, Trash2, Copy, ExternalLink } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/categories")({
  component: AdminCategoriesPage,
});

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-");

type FormState = Partial<AdminCategory> & { id?: string };

function AdminCategoriesPage() {
  const qc = useQueryClient();
  const list = useServerFn(adminListCategoriesFn);
  const upsert = useServerFn(adminUpsertCategoryFn);
  const del = useServerFn(adminDeleteCategoryFn);
  const dup = useServerFn(adminDuplicateCategoryFn);

  const { data: cats = [], isLoading } = useQuery({
    queryKey: ["admin-categories"],
    queryFn: () => list(),
  });

  const [editing, setEditing] = useState<FormState | null>(null);
  const parentMap = useMemo(() => new Map((cats as AdminCategory[]).map((c) => [c.id, c.name])), [cats]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin-categories"] });

  const save = useMutation({
    mutationFn: async (f: FormState) => {
      if (!f.name?.trim()) throw new Error("Name is required");
      const payload: any = {
        id: f.id,
        parent_id: f.parent_id || null,
        name: f.name.trim(),
        slug: (f.slug?.trim() || slugify(f.name)),
        description: f.description || null,
        icon: f.icon || null,
        image_url: f.image_url || null,
        sort_order: Number(f.sort_order ?? 0),
        is_active: f.is_active ?? true,
        seo_title: f.seo_title || null,
        seo_description: f.seo_description || null,
      };
      return upsert({ data: payload });
    },
    onSuccess: () => {
      toast.success("Category saved");
      setEditing(null);
      invalidate();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const removeMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { toast.success("Category deleted"); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });

  const dupMut = useMutation({
    mutationFn: (id: string) => dup({ data: { id } }),
    onSuccess: () => { toast.success("Category duplicated"); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Categories</h1>
          <p className="text-sm text-muted-foreground">{cats.length} categories</p>
        </div>
        <Button onClick={() => setEditing({ is_active: true, sort_order: 0 })}>
          <Plus className="h-4 w-4 mr-1" /> New category
        </Button>
      </div>

      <div className="bg-background rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Image</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Parent</TableHead>
              <TableHead>Products</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Order</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">Loading…</TableCell></TableRow>
            )}
            {!isLoading && cats.length === 0 && (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-10">No categories yet. Create your first one.</TableCell></TableRow>
            )}
            {(cats as AdminCategory[]).map((c) => (
              <TableRow key={c.id}>
                <TableCell>
                  {c.image_url ? (
                    <img src={c.image_url} alt={c.name} className="h-10 w-10 rounded object-cover" />
                  ) : (
                    <div className="h-10 w-10 rounded bg-muted grid place-items-center text-lg">{c.icon || "📁"}</div>
                  )}
                </TableCell>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{c.slug}</TableCell>
                <TableCell className="text-sm">{c.parent_id ? parentMap.get(c.parent_id) ?? "—" : "—"}</TableCell>
                <TableCell>{c.product_count ?? 0}</TableCell>
                <TableCell>
                  {c.is_active ? <Badge>Active</Badge> : <Badge variant="secondary">Hidden</Badge>}
                </TableCell>
                <TableCell>{c.sort_order}</TableCell>
                <TableCell className="text-right space-x-1">
                  <Link to="/categories" className="inline-flex">
                    <Button variant="ghost" size="icon" title="View storefront"><ExternalLink className="h-4 w-4" /></Button>
                  </Link>
                  <Button variant="ghost" size="icon" title="Duplicate" onClick={() => dupMut.mutate(c.id)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" title="Edit" onClick={() => setEditing(c)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Delete"
                    onClick={() => {
                      if (confirm(`Delete "${c.name}"? Products will become uncategorized.`)) removeMut.mutate(c.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit category" : "New category"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <CategoryForm
              value={editing}
              onChange={setEditing}
              parents={(cats as AdminCategory[]).filter((c) => c.id !== editing.id)}
            />
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={() => editing && save.mutate(editing)} disabled={save.isPending}>
              {save.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CategoryForm({
  value,
  onChange,
  parents,
}: {
  value: FormState;
  onChange: (v: FormState) => void;
  parents: AdminCategory[];
}) {
  const set = (patch: Partial<FormState>) => onChange({ ...value, ...patch });
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label>Name *</Label>
          <Input
            value={value.name ?? ""}
            onChange={(e) => {
              const name = e.target.value;
              set({ name, slug: value.id ? value.slug : slugify(name) });
            }}
          />
        </div>
        <div>
          <Label>Slug</Label>
          <Input value={value.slug ?? ""} onChange={(e) => set({ slug: e.target.value })} />
        </div>
      </div>

      <div>
        <Label>Description</Label>
        <textarea
          className="w-full min-h-[70px] rounded-md border bg-background px-3 py-2 text-sm"
          value={value.description ?? ""}
          onChange={(e) => set({ description: e.target.value })}
        />
      </div>

      <MediaPicker
        label="Category image"
        value={value.image_url ?? ""}
        onChange={(v) => set({ image_url: v })}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <Label>Icon (emoji)</Label>
          <Input value={value.icon ?? ""} onChange={(e) => set({ icon: e.target.value })} placeholder="📦" />
        </div>
        <div>
          <Label>Parent category</Label>
          <select
            className="w-full h-10 rounded-md border bg-background px-3 text-sm"
            value={value.parent_id ?? ""}
            onChange={(e) => set({ parent_id: e.target.value || null })}
          >
            <option value="">— None —</option>
            {parents.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <Label>Sort order</Label>
          <Input
            type="number"
            value={value.sort_order ?? 0}
            onChange={(e) => set({ sort_order: Number(e.target.value) })}
          />
        </div>
      </div>

      <div className="flex items-center gap-6">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={value.is_active ?? true}
            onChange={(e) => set({ is_active: e.target.checked })}
          />
          Active (visible on storefront)
        </label>
      </div>

      <div className="border-t pt-4 space-y-4">
        <div className="text-sm font-semibold">SEO</div>
        <div>
          <Label>SEO title</Label>
          <Input value={value.seo_title ?? ""} onChange={(e) => set({ seo_title: e.target.value })} />
        </div>
        <div>
          <Label>SEO description</Label>
          <textarea
            className="w-full min-h-[60px] rounded-md border bg-background px-3 py-2 text-sm"
            value={value.seo_description ?? ""}
            onChange={(e) => set({ seo_description: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
}
