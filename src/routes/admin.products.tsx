import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
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
import { Pencil, Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/admin/products")({ component: AdminProducts });

type Row = {
  id: string; title: string; slug: string;
  regular_price: number | string; sale_price: number | string | null;
  status: string; stock_status: string; is_featured: boolean; sales_count: number;
};

function AdminProducts() {
  const list = useServerFn(adminListProductsFn);
  const upsert = useServerFn(adminUpsertProductFn);
  const del = useServerFn(adminDeleteProductFn);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["admin-products"], queryFn: () => list() });
  const [editing, setEditing] = useState<Partial<Row> | null>(null);

  const save = useMutation({
    mutationFn: (payload: any) => upsert({ data: payload }),
    onSuccess: () => {
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["admin-products"] });
      setEditing(null);
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

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Products</h1>
          <p className="text-sm text-muted-foreground">{data?.length ?? 0} products</p>
        </div>
        <Button onClick={() => setEditing({ status: "published", regular_price: 0 })}>
          <Plus className="h-4 w-4 mr-1" /> New product
        </Button>
      </div>

      <div className="bg-background rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
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
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Loading…</TableCell></TableRow>
            )}
            {(data ?? []).map((p: Row) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.title}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{p.slug}</TableCell>
                <TableCell>${Number(p.sale_price ?? p.regular_price).toFixed(2)}</TableCell>
                <TableCell><Badge variant={p.status === "published" ? "default" : "secondary"}>{p.status}</Badge></TableCell>
                <TableCell>{p.sales_count ?? 0}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" asChild>
                      <a href={`/admin/products/${p.id}`}>Manage</a>
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setEditing(p)}><Pencil className="h-4 w-4" /></Button>
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

      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit product" : "New product"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Title</Label><Input value={editing.title ?? ""} onChange={(e) => setEditing({ ...editing, title: e.target.value })} /></div>
                <div><Label>Slug</Label><Input value={editing.slug ?? ""} onChange={(e) => setEditing({ ...editing, slug: e.target.value })} /></div>
                <div><Label>Regular price</Label><Input type="number" step="0.01" value={String(editing.regular_price ?? 0)} onChange={(e) => setEditing({ ...editing, regular_price: parseFloat(e.target.value) })} /></div>
                <div><Label>Sale price</Label><Input type="number" step="0.01" value={editing.sale_price == null ? "" : String(editing.sale_price)} onChange={(e) => setEditing({ ...editing, sale_price: e.target.value === "" ? null : parseFloat(e.target.value) })} /></div>
                <div><Label>Status</Label>
                  <select className="w-full h-10 rounded-md border bg-background px-3 text-sm" value={editing.status ?? "published"} onChange={(e) => setEditing({ ...editing, status: e.target.value })}>
                    <option value="published">published</option>
                    <option value="draft">draft</option>
                    <option value="archived">archived</option>
                  </select>
                </div>
                <div><Label>Thumbnail URL</Label><Input value={(editing as any).thumbnail_url ?? ""} onChange={(e) => setEditing({ ...editing, thumbnail_url: e.target.value } as any)} /></div>
              </div>
              <div><Label>Short description</Label><Textarea rows={2} value={(editing as any).short_description ?? ""} onChange={(e) => setEditing({ ...editing, short_description: e.target.value } as any)} /></div>
              <div><Label>Description</Label><Textarea rows={4} value={(editing as any).description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value } as any)} /></div>
            </div>
          )}
          <DialogFooter>
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
