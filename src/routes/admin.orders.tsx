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
import { FulfillmentPanel } from "@/components/fulfillment/FulfillmentPanel";
import { LicenseAssignmentPanel } from "@/components/admin/LicenseAssignmentPanel";
import { formatPrice } from "@/lib/product-price";


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
              <OrderRow key={o.id} order={o} onStatusChange={(s: string) => update.mutate({ orderId: o.id, status: s })} />
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function OrderRow({ order: o, onStatusChange }: { order: any; onStatusChange: (s: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <TableRow>
        <TableCell className="font-mono text-xs">
          <button type="button" onClick={() => setOpen((v) => !v)} className="hover:underline">
            {open ? "▾" : "▸"} {o.order_number}
          </button>
        </TableCell>
        <TableCell>
          <div className="font-medium">{o.customer_name ?? "—"}</div>
          <div className="text-xs text-muted-foreground">{o.email}</div>
        </TableCell>
        <TableCell>{formatPrice(Number(o.total))} {o.currency !== "BDT" ? `(${o.currency})` : ""}</TableCell>
        <TableCell className="text-sm">{o.payment_method ?? "—"}</TableCell>
        <TableCell>
          <select
            className="h-8 rounded border bg-background px-2 text-xs"
            value={o.status}
            onChange={(e) => onStatusChange(e.target.value)}
          >
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </TableCell>
        <TableCell className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleString()}</TableCell>
      </TableRow>
      {open && (
        <TableRow>
          <TableCell colSpan={6} className="bg-muted/30 space-y-4">
            <div className="rounded-lg border bg-background p-4 space-y-3">
              <h3 className="font-semibold text-sm">Ordered products</h3>
              {Array.isArray(o.order_items) && o.order_items.length > 0 ? (
                <div className="space-y-3">
                  {o.order_items.map((item: any) => {
                    const attributes = item.selected_attributes && typeof item.selected_attributes === "object"
                      ? Object.entries(item.selected_attributes as Record<string, unknown>).filter(([, value]) => value != null && String(value).trim() !== "")
                      : [];
                    return (
                      <div key={item.id} className="rounded-md border p-3 space-y-1.5">
                        <div className="font-medium">{item.product_name ?? item.product_slug ?? "Product"}</div>
                        {item.variant_name ? (
                          <div className="text-sm">
                            <span className="text-muted-foreground">Selected variant: </span>
                            <span className="font-semibold">{item.variant_name}</span>
                          </div>
                        ) : null}
                        {attributes.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {attributes.map(([key, value]) => (
                              <span key={key} className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs">
                                <span className="text-muted-foreground">{key.replace(/[-_]/g, " ")}:</span>
                                <span className="font-medium">{String(value)}</span>
                              </span>
                            ))}
                          </div>
                        ) : null}
                        {item.sku_snapshot ? <div className="text-xs text-muted-foreground">SKU: {item.sku_snapshot}</div> : null}
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm pt-1">
                          <span>Quantity: <strong>{item.qty}</strong></span>
                          <span>Unit price: <strong>{formatPrice(Number(item.unit_price ?? 0))}</strong></span>
                          <span>Line total: <strong>{formatPrice(Number(item.line_total ?? 0))}</strong></span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No order item details were returned for this order.</p>
              )}
            </div>
            <FulfillmentPanel orderId={o.id} authed isAdmin />
            <LicenseAssignmentPanel orderId={o.id} />
            <OrderCustomFieldValues orderId={o.id} authed compact />
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
