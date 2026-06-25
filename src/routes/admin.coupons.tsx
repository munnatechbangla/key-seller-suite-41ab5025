import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  adminListCouponsFn,
  adminUpsertCouponFn,
  adminDeleteCouponFn,
  adminToggleCouponFn,
} from "@/lib/coupons.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/admin/coupons")({ component: AdminCoupons });

type Coupon = {
  id: string;
  code: string;
  description: string | null;
  type: "percent" | "fixed" | "free_product" | "free_download";
  value: number;
  min_order_amount: number | null;
  max_discount: number | null;
  usage_limit: number | null;
  per_user_limit: number | null;
  first_order_only: boolean;
  new_customer_only: boolean;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
  used_count: number;
  revenue_generated: number;
};

function AdminCoupons() {
  const list = useServerFn(adminListCouponsFn);
  const upsert = useServerFn(adminUpsertCouponFn);
  const del = useServerFn(adminDeleteCouponFn);
  const toggle = useServerFn(adminToggleCouponFn);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["admin-coupons"], queryFn: () => list() });
  const [editing, setEditing] = useState<Partial<Coupon> | null>(null);

  const save = useMutation({
    mutationFn: (p: any) => upsert({ data: p }),
    onSuccess: () => { toast.success("Saved"); qc.invalidateQueries({ queryKey: ["admin-coupons"] }); setEditing(null); },
    onError: (e: any) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["admin-coupons"] }); },
  });
  const tog = useMutation({
    mutationFn: (v: { id: string; is_active: boolean }) => toggle({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-coupons"] }),
  });

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Coupons</h1>
          <p className="text-sm text-muted-foreground">Manage discount codes, limits, and targeting.</p>
        </div>
        <Button onClick={() => setEditing({ type: "percent", value: 10, per_user_limit: 1, is_active: true })}>
          <Plus className="h-4 w-4 mr-1" /> New coupon
        </Button>
      </div>

      <div className="rounded-lg border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Value</TableHead>
              <TableHead>Used</TableHead>
              <TableHead>Revenue</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={7}>Loading…</TableCell></TableRow>}
            {(data as Coupon[] | undefined)?.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-mono font-semibold">{c.code}</TableCell>
                <TableCell><Badge variant="secondary">{c.type}</Badge></TableCell>
                <TableCell>{c.type === "percent" ? `${c.value}%` : `$${Number(c.value).toFixed(2)}`}</TableCell>
                <TableCell>{c.used_count}{c.usage_limit ? ` / ${c.usage_limit}` : ""}</TableCell>
                <TableCell>${Number(c.revenue_generated).toFixed(2)}</TableCell>
                <TableCell>
                  <Switch checked={c.is_active} onCheckedChange={(v) => tog.mutate({ id: c.id, is_active: v })} />
                </TableCell>
                <TableCell className="text-right space-x-2">
                  <Button size="sm" variant="ghost" onClick={() => setEditing(c)}><Pencil className="h-4 w-4" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => { if (confirm(`Delete ${c.code}?`)) remove.mutate(c.id); }}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit coupon" : "New coupon"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Code"><Input value={editing.code ?? ""} onChange={(e) => setEditing({ ...editing, code: e.target.value.toUpperCase() })} /></Field>
              <Field label="Type">
                <select className="w-full h-10 px-3 rounded-md border bg-background text-sm"
                  value={editing.type ?? "percent"}
                  onChange={(e) => setEditing({ ...editing, type: e.target.value as Coupon["type"] })}>
                  <option value="percent">Percent</option>
                  <option value="fixed">Fixed amount</option>
                  <option value="free_product">Free product</option>
                  <option value="free_download">Free download</option>
                </select>
              </Field>
              <Field label="Value"><NumberInput value={editing.value} onChange={(v) => setEditing({ ...editing, value: v ?? 0 })} /></Field>
              <Field label="Min order amount"><NumberInput value={editing.min_order_amount} onChange={(v) => setEditing({ ...editing, min_order_amount: v })} /></Field>
              <Field label="Max discount"><NumberInput value={editing.max_discount} onChange={(v) => setEditing({ ...editing, max_discount: v })} /></Field>
              <Field label="Total usage limit"><NumberInput value={editing.usage_limit} onChange={(v) => setEditing({ ...editing, usage_limit: v == null ? null : Math.floor(v) })} /></Field>
              <Field label="Per-user limit"><NumberInput value={editing.per_user_limit} onChange={(v) => setEditing({ ...editing, per_user_limit: v == null ? null : Math.floor(v) })} /></Field>
              <Field label="Starts at"><Input type="datetime-local" value={editing.starts_at?.slice(0, 16) ?? ""} onChange={(e) => setEditing({ ...editing, starts_at: e.target.value || null })} /></Field>
              <Field label="Ends at"><Input type="datetime-local" value={editing.ends_at?.slice(0, 16) ?? ""} onChange={(e) => setEditing({ ...editing, ends_at: e.target.value || null })} /></Field>
              <div className="col-span-2 grid grid-cols-2 gap-3">
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!editing.first_order_only} onChange={(e) => setEditing({ ...editing, first_order_only: e.target.checked })} /> First order only</label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!editing.new_customer_only} onChange={(e) => setEditing({ ...editing, new_customer_only: e.target.checked })} /> New customer only</label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editing.is_active !== false} onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })} /> Active</label>
              </div>
              <Field label="Description" className="col-span-2"><Textarea value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></Field>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={() => editing && save.mutate({
              ...editing,
              value: Number(editing.value ?? 0),
              min_order_amount: editing.min_order_amount != null ? Number(editing.min_order_amount) : null,
              max_discount: editing.max_discount != null ? Number(editing.max_discount) : null,
            })} disabled={save.isPending}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return <div className={className}><Label className="text-xs">{label}</Label>{children}</div>;
}

function NumberInput({ value, onChange }: { value: number | null | undefined; onChange: (v: number | null) => void }) {
  return <Input type="number" step="0.01" value={value ?? ""} onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))} />;
}
