import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { adminListOrdersFn, adminUpdateOrderStatusFn } from "@/lib/admin.functions";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { OrderCustomFieldValues } from "@/components/orders/OrderCustomFieldValues";

export const Route = createFileRoute("/admin/orders")({ component: AdminOrders });

const STATUSES = ["pending", "paid", "processing", "completed", "cancelled", "refunded", "failed"];

function AdminOrders() {
  const list = useServerFn(adminListOrdersFn);
  const setStatus = useServerFn(adminUpdateOrderStatusFn);
  const qc = useQueryClient();
  const [status, setStatusFilter] = useState<string>("");
  const [search, setSearch] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["admin-orders", status, search],
    queryFn: () => list({ data: { status: status || undefined, search: search || undefined } }),
  });

  const update = useMutation({
    mutationFn: (v: { orderId: string; status: any }) => setStatus({ data: v }),
    onSuccess: () => {
      toast.success("Status updated");
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Orders</h1>
        <p className="text-sm text-muted-foreground">{data?.length ?? 0} results</p>
      </div>
      <div className="flex gap-2">
        <Input placeholder="Search order # or email…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
        <select className="h-10 rounded-md border bg-background px-3 text-sm" value={status} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <div className="bg-background rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order #</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Method</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Loading…</TableCell></TableRow>}
            {(data ?? []).map((o: any) => (
              <OrderRow key={o.id} order={o} onStatusChange={(s) => update.mutate({ orderId: o.id, status: s })} />
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
