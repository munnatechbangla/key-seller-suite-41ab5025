import { useMemo, useState, lazy, Suspense, useEffect } from "react";
const ProductThumb = lazy(() => import("@/components/site/ProductThumb").then(m => ({ default: m.ProductThumb })));
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import {
  Loader2, RefreshCw, RotateCcw, XCircle, CheckCircle2, Clock, AlertTriangle,
  PackageSearch, PackageCheck, ShieldAlert, Circle, Send, KeyRound, Activity, Save, BarChart3
} from "lucide-react";
import { toast } from "sonner";
import { ManualLicenseDeliveryPanel } from "@/components/admin/ManualLicenseDeliveryPanel";
import { adminListManualLicenseDeliveriesFn } from "@/lib/manual-license.functions";
import { updateSmmFulfillmentFn } from "@/lib/smm-fulfillment.functions";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  getOrderFulfillmentsAuthFn,
  getOrderFulfillmentsGuestFn,
  getFulfillmentTimelineAuthFn,
  getFulfillmentTimelineGuestFn,
  adminRetryFulfillmentFn,
  adminRestartFulfillmentFn,
  adminCancelFulfillmentFn,
  adminStartFulfillmentForOrderFn,
  adminMarkSubscriptionDeliveredFn,
  type FulfillmentRow,
  type FulfillmentStatus,
} from "@/lib/fulfillment.functions";

const STATUS_META: Record<FulfillmentStatus, { label: string; color: string; icon: any }> = {
  pending:           { label: "Pending",           color: "bg-muted text-muted-foreground",                icon: Clock },
  processing:        { label: "Processing",        color: "bg-blue-500/15 text-blue-700 dark:text-blue-300", icon: Loader2 },
  waiting_inventory: { label: "Waiting Inventory", color: "bg-amber-500/15 text-amber-700 dark:text-amber-300", icon: PackageSearch },
  manual_review:     { label: "Manual Review",     color: "bg-purple-500/15 text-purple-700 dark:text-purple-300", icon: ShieldAlert },
  delivered:         { label: "Delivered",         color: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300", icon: PackageCheck },
  partial:           { label: "Partial",           color: "bg-blue-500/15 text-blue-700 dark:text-blue-300", icon: BarChart3 },
  failed:            { label: "Failed",            color: "bg-red-500/15 text-red-700 dark:text-red-300",   icon: AlertTriangle },
  cancelled:         { label: "Cancelled",         color: "bg-muted text-muted-foreground",                icon: XCircle },
};

function StatusBadge({ status }: { status: FulfillmentStatus }) {
  const m = STATUS_META[status];
  const Icon = m.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${m.color}`}>
      <Icon className={`h-3.5 w-3.5 ${status === "processing" ? "animate-spin" : ""}`} />
      {m.label}
    </span>
  );
}

function Timeline({ fulfillmentId, email, authed }: { fulfillmentId: string; email?: string; authed: boolean }) {
  const fetchAuth = useServerFn(getFulfillmentTimelineAuthFn);
  const fetchGuest = useServerFn(getFulfillmentTimelineGuestFn);
  const fetcher = authed ? fetchAuth : fetchGuest;
  const q = useQuery({
    queryKey: ["fulfillment-timeline", fulfillmentId],
    queryFn: () => fetcher({ data: { fulfillmentId, email } }),
  });

  if (q.isLoading) {
    return <div className="text-xs text-muted-foreground flex items-center gap-2"><Loader2 className="h-3 w-3 animate-spin" /> Loading timeline…</div>;
  }
  const logs = q.data ?? [];
  if (!logs.length) return <div className="text-xs text-muted-foreground">No events yet.</div>;

  return (
    <ol className="relative border-s border-border ps-4 space-y-3">
      {logs.map((l) => (
        <li key={l.id} className="text-xs">
          <span className="absolute -start-1.5 mt-1 h-3 w-3 rounded-full bg-primary" />
          <div className="font-semibold text-foreground capitalize">{l.event.replace(/_/g, " ")}</div>
          {l.message && <div className="text-muted-foreground">{l.message}</div>}
          <div className="text-[10px] text-muted-foreground/70">{new Date(l.created_at).toLocaleString()}</div>
        </li>
      ))}
    </ol>
  );
}

type Props = {
  orderId: string;
  email?: string;
  authed: boolean;
  isAdmin?: boolean;
  compact?: boolean;
};

export function FulfillmentPanel({ orderId, email, authed, isAdmin = false, compact = false }: Props) {
  const qc = useQueryClient();
  const fetchAuth = useServerFn(getOrderFulfillmentsAuthFn);
  const fetchGuest = useServerFn(getOrderFulfillmentsGuestFn);
  const fetcher = authed ? fetchAuth : fetchGuest;

  const q = useQuery({
    queryKey: ["order-fulfillments", orderId, authed],
    queryFn: () => fetcher({ data: { orderId, email } }),
    refetchInterval: (query) => {
      const rows = query.state.data as FulfillmentRow[] | undefined;
      if (!rows?.length) return 6000;
      const pending = rows.some((r) => ["pending", "processing", "waiting_inventory"].includes(r.fulfillment_status));
      return pending ? 5000 : false;
    },
  });

  const retry = useServerFn(adminRetryFulfillmentFn);
  const restart = useServerFn(adminRestartFulfillmentFn);
  const cancel = useServerFn(adminCancelFulfillmentFn);
  const startForOrder = useServerFn(adminStartFulfillmentForOrderFn);
  const listManualLicenses = useServerFn(adminListManualLicenseDeliveriesFn);

  const licenseItemsQ = useQuery({
    queryKey: ["admin-manual-license", orderId],
    queryFn: () => listManualLicenses({ data: { orderId } }),
    enabled: isAdmin,
  });
  const licenseOrderItemIds = useMemo(() => {
    const set = new Set<string>();
    for (const it of (licenseItemsQ.data?.items ?? []) as Array<{ order_item_id: string }>) {
      set.add(it.order_item_id);
    }
    return set;
  }, [licenseItemsQ.data]);
  const licenseProductIds = useMemo(() => {
    const set = new Set<string>();
    for (const it of (licenseItemsQ.data?.items ?? []) as Array<{ product_id: string }>) {
      if (it.product_id) set.add(it.product_id);
    }
    return set;
  }, [licenseItemsQ.data]);

  if (typeof window !== "undefined" && isAdmin) {
    // eslint-disable-next-line no-console
    console.debug("[FulfillmentPanel]", {
      orderId,
      licenseItemsQStatus: licenseItemsQ.status,
      licenseItemsError: (licenseItemsQ.error as any)?.message,
      licenseItems: licenseItemsQ.data?.items,
      fulfillmentRows: (q.data ?? []).map((r: any) => ({
        id: r.id,
        product_id: r.product_id,
        order_item_id: r.order_item_id,
        delivery_type: r.delivery_type,
        product_type: r.product_type,
        product_delivery_type: r.product_delivery_type,
        status: r.fulfillment_status,
      })),
    });
  }

  const invalidate = () => qc.invalidateQueries({ queryKey: ["order-fulfillments", orderId] });

  const retryMut = useMutation({
    mutationFn: (fulfillmentId: string) => retry({ data: { fulfillmentId } }),
    onSuccess: () => { toast.success("Fulfillment retried"); invalidate(); qc.invalidateQueries({ queryKey: ["fulfillment-timeline"] }); },
    onError: (e: any) => toast.error(e?.message ?? "Retry failed"),
  });
  const restartMut = useMutation({
    mutationFn: (fulfillmentId: string) => restart({ data: { fulfillmentId } }),
    onSuccess: () => { toast.success("Fulfillment restarted"); invalidate(); qc.invalidateQueries({ queryKey: ["fulfillment-timeline"] }); },
    onError: (e: any) => toast.error(e?.message ?? "Restart failed"),
  });
  const cancelMut = useMutation({
    mutationFn: (fulfillmentId: string) => cancel({ data: { fulfillmentId, reason: "Cancelled by admin" } }),
    onSuccess: () => { toast.success("Fulfillment cancelled"); invalidate(); qc.invalidateQueries({ queryKey: ["fulfillment-timeline"] }); },
    onError: (e: any) => toast.error(e?.message ?? "Cancel failed"),
  });
  const startMut = useMutation({
    mutationFn: () => startForOrder({ data: { orderId } }),
    onSuccess: () => { toast.success("Fulfillment started"); invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? "Failed to start"),
  });

  const rows = useMemo(() => q.data ?? [], [q.data]);

  if (q.isLoading) {
    return <div className="text-sm text-muted-foreground flex items-center gap-2 py-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading fulfillment…</div>;
  }

  if (!rows.length) {
    return (
      <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground flex items-center justify-between gap-3">
        <span>No fulfillment lifecycle yet for this order.</span>
        {isAdmin && (
          <button
            onClick={() => startMut.mutate()}
            disabled={startMut.isPending}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
          >
            {startMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            Start fulfillment
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {isAdmin && (
        <div className="space-y-4">
          {rows
            .filter((f) => f.product_type === "smm_service" && f.order_item_id)
            .map((f) => (
              <SmmFulfillmentPanel
                key={`smm-${f.id}`}
                orderItemId={f.order_item_id!}
                qty={f.qty || 1}
                current={f.smm_fulfillment}
                onUpdated={invalidate}
              />
            ))}
        </div>
      )}
      {!compact && (
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-primary" />
          <h4 className="font-semibold text-sm">Fulfillment</h4>
        </div>
      )}
      {rows.map((f) => {
        const isSubscription = f.delivery_type === "subscription" || f.product_type === "subscription" || f.product_delivery_type === "subscription";
        const isDownloadable = f.delivery_type === "download" || f.product_type === "download" || f.product_delivery_type === "download";
        const isSmm = f.product_type === "smm_service";

        if (isSmm) return null; // Rendered above in specialized panel


        if (isSubscription || (isDownloadable && !isAdmin)) {
          return (
            <ChecklistCard
              key={f.id}
              f={f}
              isAdmin={isAdmin && isSubscription}
              type={isSubscription ? "subscription" : "download"}
              onDelivered={() => {
                invalidate();
                qc.invalidateQueries({ queryKey: ["fulfillment-timeline"] });
              }}
            />
          );
        }
        const matchedByProduct =
          !!(f as any).product_id && licenseProductIds.has((f as any).product_id);
        const resolvedOrderItemId =
          f.order_item_id ??
          ((licenseItemsQ.data?.items ?? []) as Array<{ order_item_id: string; product_id: string }>)
            .find((it) => it.product_id === (f as any).product_id)?.order_item_id ??
          null;
        const isLicense =
          f.is_license_key === true ||
          f.product_type === "license_key" ||
          f.product_delivery_type === "license_key" ||
          f.delivery_type === "license_key" ||
          (!!f.order_item_id && licenseOrderItemIds.has(f.order_item_id)) ||
          matchedByProduct;
        if (typeof window !== "undefined" && isAdmin) {
          // eslint-disable-next-line no-console
          console.debug("[FulfillmentPanel row]", {
            fulfillment_id: f.id,
            product_id: (f as any).product_id,
            order_item_id: f.order_item_id,
            resolvedOrderItemId,
            delivery_type: f.delivery_type,
            product_type: f.product_type,
            product_delivery_type: f.product_delivery_type,
            matchedByProduct,
            isLicense,
          });
        }
        if (isLicense && isAdmin && resolvedOrderItemId) {
          return (
            <LicenseKeyCard
              key={f.id}
              f={{ ...f, order_item_id: resolvedOrderItemId }}
              orderId={orderId}
              email={email}
              authed={authed}
              compact={compact}
              onCancel={() => cancelMut.mutate(f.id)}
              cancelPending={cancelMut.isPending}
            />
          );
        }

        return (
        <div key={f.id} className="rounded-xl border border-border p-3 space-y-2 bg-card">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="text-sm font-semibold">{f.product_title ?? "Item"}</div>
              <div className="text-[11px] text-muted-foreground">
                {f.delivery_type ? `Delivery: ${f.delivery_type}` : "Delivery pending"}
                {f.attempt_count > 0 ? ` • Attempts: ${f.attempt_count}` : ""}
              </div>
            </div>
            <StatusBadge status={f.fulfillment_status} />
          </div>

          {f.failure_reason && (
            <div className="text-xs text-red-600 dark:text-red-400">{f.failure_reason}</div>
          )}

          {isAdmin && (
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => retryMut.mutate(f.id)}
                disabled={retryMut.isPending || f.fulfillment_status === "delivered" || f.fulfillment_status === "cancelled"}
                className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-[11px] font-medium hover:bg-muted disabled:opacity-50"
              >
                <RefreshCw className="h-3 w-3" /> Retry
              </button>
              <button
                onClick={() => restartMut.mutate(f.id)}
                disabled={restartMut.isPending}
                className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-[11px] font-medium hover:bg-muted disabled:opacity-50"
              >
                <RotateCcw className="h-3 w-3" /> Restart
              </button>
              <button
                onClick={() => cancelMut.mutate(f.id)}
                disabled={cancelMut.isPending || f.fulfillment_status === "cancelled"}
                className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-[11px] font-medium text-red-600 hover:bg-red-500/10 disabled:opacity-50"
              >
                <XCircle className="h-3 w-3" /> Cancel
              </button>
            </div>
          )}

          {!compact && (
            <details className="pt-1">
              <summary className="cursor-pointer text-[11px] font-medium text-muted-foreground hover:text-foreground">View timeline</summary>
              <div className="pt-2">
                <Timeline fulfillmentId={f.id} email={email} authed={authed} />
              </div>
            </details>
          )}
        </div>
        );
      })}
    </div>
  );
}

// ============================================================
// SMM Fulfillment Panel (Admin-only controls)
// ============================================================
function SmmFulfillmentPanel({ 
  orderItemId, 
  qty, 
  current, 
  onUpdated 
}: { 
  orderItemId: string; 
  qty: number; 
  current: any; 
  onUpdated: () => void;
}) {
  const update = useServerFn(updateSmmFulfillmentFn);
  const [status, setStatus] = useState<string>(current?.status || "pending");
  const [delivered, setDelivered] = useState<number>(current?.delivered_quantity || 0);
  const [notes, setNotes] = useState<string>(current?.admin_notes || "");

  const mut = useMutation({
    mutationFn: () => update({ data: { 
      orderItemId, 
      status: status as any, 
      deliveredQuantity: delivered, 
      adminNotes: notes 
    }}),
    onSuccess: () => {
      toast.success("SMM fulfillment updated");
      onUpdated();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remaining = Math.max(0, qty - delivered);

  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-4">
      <div className="flex items-center gap-2 text-primary">
        <Activity className="h-4 w-4" />
        <h4 className="font-bold text-sm uppercase tracking-wider">SMM Fulfillment Control</h4>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold uppercase text-muted-foreground">Fulfillment Status</label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-9 bg-background">
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="processing">Processing</SelectItem>
              <SelectItem value="partial">Partial</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
              <SelectItem value="refunded">Refunded</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-bold uppercase text-muted-foreground">Delivered Quantity</label>
          <div className="flex items-center gap-2">
            <Input 
              type="number" 
              value={delivered} 
              onChange={(e) => {
                const val = parseInt(e.target.value) || 0;
                setDelivered(Math.min(qty, Math.max(0, val)));
              }}
              className="h-9 bg-background"
            />
            <div className="text-[10px] whitespace-nowrap text-muted-foreground">/ {qty}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 text-xs">
        <div className="p-2 rounded bg-background border border-border">
          <div className="text-muted-foreground mb-0.5 text-[10px] uppercase">Ordered</div>
          <div className="font-bold">{qty.toLocaleString()}</div>
        </div>
        <div className="p-2 rounded bg-background border border-border">
          <div className="text-muted-foreground mb-0.5 text-[10px] uppercase">Remaining</div>
          <div className="font-bold text-primary">{remaining.toLocaleString()}</div>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-[10px] font-bold uppercase text-muted-foreground">Admin Notes (Internal)</label>
        <Textarea 
          value={notes} 
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Internal notes about this SMM delivery..."
          className="min-h-[60px] text-xs bg-background"
        />
      </div>

      <button
        type="button"
        onClick={() => mut.mutate()}
        disabled={mut.isPending}
        className="w-full inline-flex items-center justify-center gap-2 py-2 rounded-lg bg-primary text-primary-foreground font-semibold text-xs hover:opacity-90 disabled:opacity-50 transition-all"
      >
        {mut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
        Update SMM Fulfillment
      </button>

      {current?.updated_at && (
        <div className="text-[10px] text-center text-muted-foreground italic">
          Last updated: {new Date(current.updated_at).toLocaleString()}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Subscription-only card: fixed 5-step checklist + admin deliver
// ============================================================
function ChecklistCard({
  f,
  isAdmin,
  onDelivered,
  type,
}: {
  f: FulfillmentRow;
  isAdmin: boolean;
  onDelivered: () => void;
  type: "subscription" | "download";
}) {
  const markDelivered = useServerFn(adminMarkSubscriptionDeliveredFn);
  const [note, setNote] = useState("");
  const mut = useMutation({
    mutationFn: () => markDelivered({ data: { fulfillmentId: f.id, note: note || undefined } }),
    onSuccess: () => {
      toast.success(`${type === "subscription" ? "Subscription" : "Download"} marked delivered`);
      setNote("");
      onDelivered();
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to mark delivered"),
  });

  const delivered = f.fulfillment_status === "delivered";
  const paymentApproved = delivered || ["processing", "manual_review", "waiting_inventory"].includes(f.fulfillment_status);
  const underVerification = paymentApproved || f.fulfillment_status === "pending";

  const steps: { label: string; done: boolean }[] = [
    { label: "Order Created", done: true },
    { label: "Payment Submitted", done: true },
    { label: "Under Verification", done: underVerification },
    { label: "Payment Approved", done: paymentApproved },
    { 
      label: type === "subscription" ? "Subscription Delivered" : "Download Available", 
      done: delivered 
    },
  ];

  const deliveredAt = (f.metadata as any)?.delivered_at ?? f.completed_at;
  const deliveryNote = (f.metadata as any)?.delivery_note as string | undefined;

  return (
    <div className="rounded-xl border border-border p-4 space-y-3 bg-card">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="text-sm font-semibold">{f.product_title ?? (type === "subscription" ? "Subscription" : "Download")}</div>
          <div className="text-[11px] text-muted-foreground">{type === "subscription" ? "Subscription product" : "Downloadable product"}</div>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
            delivered
              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
              : "bg-amber-500/15 text-amber-700 dark:text-amber-300"
          }`}
        >
          {delivered ? <PackageCheck className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
          {delivered 
            ? (type === "subscription" ? "Subscription Delivered" : "Download Available") 
            : "Payment Approved"}
        </span>
      </div>

      <ol className="space-y-1.5">
        {steps.map((s) => (
          <li key={s.label} className="flex items-center gap-2 text-xs">
            {s.done ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            ) : (
              <Circle className="h-4 w-4 text-muted-foreground/50" />
            )}
            <span className={s.done ? "font-medium text-foreground" : "text-muted-foreground"}>
              {s.label}
            </span>
          </li>
        ))}
      </ol>

      {delivered && (
        <div className="rounded-lg bg-emerald-500/10 p-3 text-xs space-y-1">
          <div className="font-semibold text-emerald-700 dark:text-emerald-300">Delivered successfully</div>
          {deliveredAt && (
            <div className="text-muted-foreground">
              {new Date(deliveredAt).toLocaleString()}
            </div>
          )}
          {deliveryNote && <div className="text-muted-foreground">Note: {deliveryNote}</div>}
        </div>
      )}

      {isAdmin && !delivered && (
        <div className="space-y-2 pt-1 border-t border-border">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Delivery note (optional) — e.g. account details sent via email"
            className="w-full min-h-[60px] rounded-md border border-border bg-background p-2 text-xs"
          />
          <button
            type="button"
            onClick={() => mut.mutate()}
            disabled={mut.isPending}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
          >
            {mut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
            Mark {type === "subscription" ? "Subscription" : "Download"} Delivered
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================
// License Key card: inline Manual License Delivery editor
// ============================================================
function LicenseKeyCard({
  f,
  orderId,
  email,
  authed,
  compact,
  onCancel,
  cancelPending,
}: {
  f: FulfillmentRow;
  orderId: string;
  email?: string;
  authed: boolean;
  compact: boolean;
  onCancel: () => void;
  cancelPending: boolean;
}) {
  const delivered = f.fulfillment_status === "delivered";
  return (
    <div className="rounded-xl border border-border p-3 space-y-3 bg-card">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="text-sm font-semibold flex items-center gap-1.5">
            <KeyRound className="h-4 w-4 text-primary" />
            {f.product_title ?? "License Key"}
          </div>
          <div className="text-[11px] text-muted-foreground">
            Delivery: license_key
            {f.attempt_count > 0 ? ` • Attempts: ${f.attempt_count}` : ""}
          </div>
        </div>
        <StatusBadge status={f.fulfillment_status} />
      </div>

      {f.failure_reason && (
        <div className="text-xs text-red-600 dark:text-red-400">{f.failure_reason}</div>
      )}

      <ManualLicenseDeliveryPanel orderId={orderId} orderItemId={f.order_item_id!} hideHeader />

      {!delivered && f.fulfillment_status !== "cancelled" && (
        <div className="flex gap-2 pt-1">
          <button
            onClick={onCancel}
            disabled={cancelPending}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-[11px] font-medium text-red-600 hover:bg-red-500/10 disabled:opacity-50"
          >
            <XCircle className="h-3 w-3" /> Cancel
          </button>
        </div>
      )}

      {!compact && (
        <details className="pt-1">
          <summary className="cursor-pointer text-[11px] font-medium text-muted-foreground hover:text-foreground">View timeline</summary>
          <div className="pt-2">
            <Timeline fulfillmentId={f.id} email={email} authed={authed} />
          </div>
        </details>
      )}
    </div>
  );
}

