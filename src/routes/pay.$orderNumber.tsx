import { siteName } from "@/lib/cms/seo";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Header } from "@/components/site/Header";
import { ProductThumb } from "@/components/site/ProductThumb";
import { resolveLineImage } from "@/lib/cart-image";
import { Footer } from "@/components/site/Footer";
import {
  Loader2,
  ShieldCheck,
  CreditCard,
  XCircle,
  ExternalLink,
  Upload,
  ClipboardCheck,
  CheckCircle2,
  Clock,
  MessageCircle,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";
import { getOrderByNumberFn, getMyOrderByNumberFn, simulateGatewayPaymentFn } from "@/lib/orders.functions";
import { getOrderDeliveryAuthFn, getOrderDeliveryGuestFn } from "@/lib/delivery.functions";
import { useAuth } from "@/lib/stores";
import { useSettings } from "@/lib/cms/settings";
import { initPaymentFn } from "@/lib/payments/init.functions";
import {
  listEnabledGatewaysFn,
  submitManualPaymentFn,
  getMySubmissionForOrderFn,
  type GatewayRow,
} from "@/lib/payments/gateways.functions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { usePriceFormatter, formatPriceWithSymbol } from "@/lib/currency";


const BUILTIN_AUTO = new Set(["sslcommerz", "bkash", "stripe"]);

export const Route = createFileRoute("/pay/$orderNumber")({
  head: () => ({ meta: [{ title: `Complete Payment — ${siteName()}` }] }),
  component: PayPage,
  errorComponent: () => <div className="p-8 text-center">Payment page unavailable.</div>,
  notFoundComponent: () => <div className="p-8 text-center">Order not found.</div>,
});

type TimelineStep = { key: string; label: string; state: "done" | "current" | "todo" | "error" };

function buildTimeline(opts: {
  submitted: boolean;
  underReview: boolean;
  rejected: boolean;
  approved: boolean;
  hasLicense: boolean;
  isSubscription: boolean;
  subscriptionDelivered: boolean;
}): TimelineStep[] {
  const { submitted, underReview, rejected, approved, hasLicense, isSubscription, subscriptionDelivered } = opts;
  const s = (cond: "done" | "current" | "todo" | "error"): "done" | "current" | "todo" | "error" => cond;
  return [
    { key: "created", label: "Order Created", state: s("done") },
    {
      key: "submitted",
      label: "Payment Submitted",
      state: submitted || approved ? "done" : rejected ? "error" : "current",
    },
    {
      key: "review",
      label: rejected ? "Payment Rejected" : "Under Verification",
      state: rejected ? "error" : approved ? "done" : underReview ? "current" : "todo",
    },
    {
      key: "approved",
      label: "Payment Approved",
      state: approved ? "done" : rejected ? "todo" : "todo",
    },
    {
      key: "delivered",
      label: isSubscription ? "Subscription Delivered" : "License Delivered",
      state: isSubscription
        ? subscriptionDelivered ? "done" : approved ? "current" : "todo"
        : approved && hasLicense ? "done" : approved ? "current" : "todo",
    },
  ];
}

function OrderItemRow({ it }: { it: any }) {
  const formatPrice = usePriceFormatter();
  const img = resolveLineImage(it.product || it.products || it, it.variant);
  const name = it.product_name || it.products?.title || it.product?.name || it.product?.title || "Product";
  
  return (
    <div className="flex items-center gap-3 py-2 border-b border-border last:border-0 text-sm">
      <div className="h-10 w-10 shrink-0">
        <ProductThumb 
          src={img} 
          emoji={it.products?.emoji || it.product?.emoji} 
          alt={name} 
          size={40}
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{name}</div>
        <div className="text-[11px] text-muted-foreground">Qty {it.qty}</div>
      </div>
      <div className="font-semibold">{formatPrice(it.unit_price * it.qty)}</div>
    </div>
  );
}

function submittedFlag(orderNumber: string) {
  return `pay:submitted:${orderNumber}`;
}

function PayPage() {
  const formatPrice = usePriceFormatter();

  const { orderNumber } = Route.useParams();
  const navigate = useNavigate();
  const user = useAuth((s) => s.user);
  const fetchOrderPublic = useServerFn(getOrderByNumberFn);
  const fetchOrderAuthed = useServerFn(getMyOrderByNumberFn);
  const fetchOrder = user ? fetchOrderAuthed : fetchOrderPublic;
  const simulate = useServerFn(simulateGatewayPaymentFn);
  const initPayment = useServerFn(initPaymentFn);
  const listGateways = useServerFn(listEnabledGatewaysFn);
  const fetchSubmission = useServerFn(getMySubmissionForOrderFn);
  const support = useSettings((s) => s.settings.support);
  const contact = useSettings((s) => s.settings.contact);
  const loadSettings = useSettings((s) => s.load);
  const settingsLoaded = useSettings((s) => s.loaded);
  const qc = useQueryClient();
  const [working, setWorking] = useState<null | "paid" | "failed" | "redirect" | "manual">(null);
  const [resubmit, setResubmit] = useState(false);
  const [locallySubmitted, setLocallySubmitted] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(submittedFlag(orderNumber)) === "1";
  });

  useEffect(() => {
    if (!settingsLoaded) loadSettings();
  }, [settingsLoaded, loadSettings]);

  const q = useQuery({
    queryKey: ["order", orderNumber, user?.id ?? "guest"],
    queryFn: () => fetchOrder({ data: { orderNumber } }),
    refetchInterval: (query) => {
      const data = query.state.data as any;
      const status = data?.order?.status || data?.status;
      return status === "pending" ? 15000 : false;
    },
  });

  const subQ = useQuery({
    queryKey: ["submission", orderNumber],
    queryFn: () => fetchSubmission({ data: { orderNumber } }),
    enabled: !!user,
    refetchInterval: (query) => {
      const s = (query.state.data as { submission?: { status?: string } } | undefined)?.submission?.status;
      return s === "pending" ? 15000 : false;
    },
  });

  const gw = useQuery({ queryKey: ["enabled-gateways"], queryFn: () => listGateways() });

  const fetchDeliveryAuth = useServerFn(getOrderDeliveryAuthFn);
  const fetchDeliveryGuest = useServerFn(getOrderDeliveryGuestFn);
  const fetchDelivery = user ? fetchDeliveryAuth : fetchDeliveryGuest;
  const deliveryQ = useQuery({
    queryKey: ["delivery", orderNumber, user?.id ?? "guest"],
    queryFn: () => fetchDelivery({ data: { orderNumber } }),
    enabled: !!orderNumber,
    refetchInterval: (query) => {
      const items = (query.state.data as any[] | undefined) ?? [];
      const anyDelivered = items.some((it) => it?.manual_license || it?.fulfillment?.fulfillment_status === "delivered");
      return anyDelivered ? false : 8000;
    },
  });

  const order = q.data?.order || q.data;
  const assignments = (q.data?.assignments as unknown as Array<unknown>) || (q.data as any)?.order_items?.filter((it: any) => it.license_assignments)?.flatMap((it: any) => it.license_assignments) || [];
  const submission = subQ.data?.submission ?? subQ.data?.[0] ?? null;
  const slug: string = order?.payment_method ?? "";
  const gateway: GatewayRow | undefined = gw.data?.gateways.find((g) => g.slug === slug);
  const isManual = gateway?.type === "manual";
  const isCustomAuto = gateway?.type === "custom_auto";
  const isBuiltinAuto = gateway?.type === "builtin" && BUILTIN_AUTO.has(slug);

  const orderStatus = order?.status ?? "pending";
  const orderItems = (q.data?.items as any[]) || (q.data as any)?.order_items || [];
  const isSubscriptionOrder = orderItems.some((it: any) => it.product_type === "subscription" || it.delivery_type === "subscription" || it.product?.product_type === "subscription");
  const approved = orderStatus === "paid" || orderStatus === "completed";
  const rejected = submission?.status === "rejected";
  const pendingSubmission = submission?.status === "pending" || submission?.status === "under_review";
  const hasSubmission = !!submission || locallySubmitted;
  const submitted = hasSubmission && !approved;
  const underReview = pendingSubmission || (locallySubmitted && !rejected && !approved);
  const showForm = !approved && (!isManual ? true : (!hasSubmission || (rejected && resubmit)));
  const showSubmittedPanel = isManual && submitted && !rejected && !approved && !resubmit;

  useEffect(() => {
    if (approved && typeof window !== "undefined") {
      window.localStorage.removeItem(submittedFlag(orderNumber));
    }
  }, [approved, orderNumber]);

  const timeline = buildTimeline({
    submitted,
    underReview,
    rejected,
    approved,
    hasLicense:
      assignments.length > 0 ||
      (deliveryQ.data ?? []).some(
        (it: any) => it?.manual_license || it?.fulfillment?.fulfillment_status === "delivered",
      ),
    isSubscription: isSubscriptionOrder,
    subscriptionDelivered: isSubscriptionOrder && orderStatus === "completed",
  });

  const redirectToGateway = async () => {
    if (working || !order) return;
    setWorking("redirect");
    try {
      const res = await initPayment({ data: { orderNumber, gateway: slug } });
      if (!res.ok) throw new Error("Could not start gateway session");
      window.location.href = res.redirectUrl;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gateway init failed");
      setWorking(null);
    }
  };

  const run = async (outcome: "paid" | "failed") => {
    if (working) return;
    setWorking(outcome);
    try {
      const res = await simulate({ data: { orderNumber, outcome } });
      if (!res.ok) throw new Error("Gateway rejected the transaction");
      await qc.invalidateQueries({ queryKey: ["order", orderNumber] });
      toast.success(outcome === "paid" ? "Payment verified" : "Payment marked failed");
      navigate({ to: "/thank-you", search: { order: orderNumber } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not process payment");
      setWorking(null);
    }
  };

  const refreshStatus = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["order", orderNumber] }),
      qc.invalidateQueries({ queryKey: ["submission", orderNumber] }),
    ]);
    toast.success("Status refreshed");
  };

  const customerName = [order?.customer_first_name, order?.customer_last_name].filter(Boolean).join(" ") || (user?.name ?? "Customer");
  const customerEmail = order?.customer_email ?? user?.email ?? "";
  const whatsappHref = useMemo(() => {
    const num = (support.whatsapp_number || contact.whatsapp || "").replace(/[^\d+]/g, "");
    if (!num) return null;
    const msg = (support.greeting_message || "")
      .replaceAll("{{order_number}}", orderNumber)
      .replaceAll("{{customer_name}}", customerName)
      .replaceAll("{{customer_email}}", customerEmail)
      .replaceAll("{{order_status}}", orderStatus);
    return `https://wa.me/${num.replace(/^\+/, "")}?text=${encodeURIComponent(msg)}`;
  }, [support, contact, orderNumber, customerName, customerEmail, orderStatus]);

  return (
    <div className="min-h-screen">
      <Header />
      <div className="mx-auto w-full max-w-[760px] px-4 py-6 md:py-10">
        <div className="rounded-2xl bg-card border border-border p-5 sm:p-6 md:p-8 space-y-6 shadow-lg overflow-hidden">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground min-w-0">
              <ShieldCheck className="h-4 w-4 text-emerald-500 shrink-0" /> <span className="truncate">Secure checkout</span>
            </div>
            <span
              className={cn(
                "text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-full font-semibold shrink-0 whitespace-nowrap",
                approved ? ""
                : rejected ? "bg-destructive/15 text-destructive"
                : underReview ? "bg-amber-500/15 text-amber-600"
                : "bg-muted text-muted-foreground",
              )}
              style={approved ? { backgroundColor: "#0F3D2E", color: "#2EE59D" } : undefined}
            >
              {approved ? "Approved" : rejected ? "Rejected" : underReview ? "Under verification" : orderStatus}
            </span>
          </div>

          <div>
            <div className="text-xs text-muted-foreground">Order</div>
            <div className="font-bold text-2xl tracking-tight">#{orderNumber}</div>
          </div>

          {(q.isLoading || gw.isLoading) ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading…
            </div>
          ) : !order ? (
            <div className="p-4 rounded-xl bg-destructive/10 text-destructive text-sm">Order not found.</div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <SummaryRow label="Amount" value={formatPrice(order.total)} />
                <SummaryRow label="Method" value={gateway?.name ?? slug ?? "—"} />
              </div>

              {orderItems.length > 0 && (
                <div className="border border-border rounded-xl p-3 bg-muted/20">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-2">Order Summary</div>
                  <div className="divide-y divide-border">
                    {orderItems.map((it, idx) => (
                      <OrderItemRow key={idx} it={it} />
                    ))}
                  </div>
                </div>
              )}

              <Timeline steps={timeline} />

              {approved ? (
                <ApprovedPanel orderNumber={orderNumber} isSubscription={isSubscriptionOrder} subscriptionDelivered={orderStatus === "completed"} />
              ) : rejected && !resubmit ? (
                <RejectedPanel
                  reason={submission?.admin_note ?? null}
                  onResubmit={() => setResubmit(true)}
                  whatsappHref={support.enable_whatsapp ? whatsappHref : null}
                  whatsappLabel={support.whatsapp_button_text}
                  onRefresh={refreshStatus}
                />
              ) : showSubmittedPanel ? (
                <SubmittedPanel
                  supportName={support.support_name}
                  workingHours={support.working_hours}
                  whatsappHref={support.enable_whatsapp ? whatsappHref : null}
                  whatsappLabel={support.whatsapp_button_text}
                  onRefresh={refreshStatus}
                />
              ) : showForm && isManual && gateway ? (
                <ManualForm
                  gateway={gateway}
                  orderNumber={orderNumber}
                  working={working === "manual"}
                  onSubmitting={(v) => setWorking(v ? "manual" : null)}
                  onSubmitted={() => {
                    try { window.localStorage.setItem(submittedFlag(orderNumber), "1"); } catch { /* ignore */ }
                    setLocallySubmitted(true);
                    setResubmit(false);
                    setWorking(null);
                    qc.invalidateQueries({ queryKey: ["submission", orderNumber] });
                    qc.invalidateQueries({ queryKey: ["order", orderNumber] });
                  }}
                />
              ) : isBuiltinAuto || isCustomAuto ? (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    You will be redirected to <span className="font-medium">{gateway?.name ?? slug}</span> to complete payment.
                  </p>
                  <button
                    type="button"
                    onClick={redirectToGateway}
                    disabled={!!working}
                    className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-primary text-primary-foreground font-semibold shadow-glow disabled:opacity-60 transition-transform active:scale-[.98]"
                  >
                    {working === "redirect" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
                    Continue to {gateway?.name ?? slug} →
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">Sandbox controls — gateway adapter not yet implemented.</p>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => run("paid")}
                      disabled={!!working}
                      className="inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-primary text-primary-foreground font-semibold shadow-glow disabled:opacity-60"
                    >
                      {working === "paid" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                      Pay {formatPrice(order.total)}
                    </button>
                    <button
                      type="button"
                      onClick={() => run("failed")}
                      disabled={!!working}
                      className="inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-card border border-border font-semibold text-sm hover:bg-muted disabled:opacity-60"
                    >
                      {working === "failed" ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                      Simulate failure
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
}

function Timeline({ steps }: { steps: TimelineStep[] }) {
  return (
    <ol className="relative">
      {steps.map((s, i) => {
        const isLast = i === steps.length - 1;
        const dot =
          s.state === "done" ? "bg-emerald-500 text-white"
          : s.state === "current" ? "bg-amber-500 text-white animate-pulse"
          : s.state === "error" ? "bg-destructive text-white"
          : "bg-muted text-muted-foreground";
        const line =
          s.state === "done" ? "bg-emerald-500/60"
          : s.state === "error" ? "bg-destructive/60"
          : "bg-border";
        const Icon =
          s.state === "done" ? CheckCircle2
          : s.state === "error" ? AlertTriangle
          : s.state === "current" ? Clock
          : Clock;
        return (
          <li key={s.key} className="relative flex items-start gap-3 pb-5 last:pb-0">
            <div className="flex flex-col items-center self-stretch">
              <div className={cn("h-8 w-8 rounded-full grid place-items-center shadow-sm transition-all shrink-0", dot)}>
                <Icon className="h-4 w-4" />
              </div>
              {!isLast && <div className={cn("w-px flex-1 mt-1.5 min-h-8", line)} />}
            </div>
            <div className="pt-1 min-w-0">
              <div className={cn(
                "text-sm font-semibold",
                s.state === "todo" && "text-muted-foreground font-medium",
              )}>{s.label}</div>
              {s.state === "current" && <div className="text-[11px] text-muted-foreground">In progress…</div>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function SummaryRow({ label, value, className = "" }: { label: string; value: string; className?: string }) {
  return (
    <div className="rounded-xl bg-muted/40 p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`font-semibold text-sm ${className}`}>{value}</div>
    </div>
  );
}

function SubmittedPanel({
  supportName,
  workingHours,
  whatsappHref,
  whatsappLabel,
  onRefresh,
}: {
  supportName: string;
  workingHours: string;
  whatsappHref: string | null;
  whatsappLabel: string;
  onRefresh: () => void;
}) {
  return (
    <div className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent p-5 space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-full bg-emerald-500/20 text-emerald-600 grid place-items-center shrink-0">
          <CheckCircle2 className="h-5 w-5" />
        </div>
        <div>
          <div className="font-bold text-lg">Payment Proof Submitted</div>
          <p className="text-sm text-muted-foreground">
            Thank you. We have received your payment proof and our team is verifying it.
          </p>
          <div className="mt-2 inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400">
            <Clock className="h-3 w-3" /> Estimated verification: <span className="font-semibold">5–30 minutes</span>
          </div>
        </div>
      </div>
      {(supportName || workingHours) && (
        <div className="text-[11px] text-muted-foreground">
          {supportName}{workingHours ? ` · ${workingHours}` : ""}
        </div>
      )}
      <ActionButtons onRefresh={onRefresh} whatsappHref={whatsappHref} whatsappLabel={whatsappLabel} />
    </div>
  );
}

function RejectedPanel({
  reason,
  onResubmit,
  whatsappHref,
  whatsappLabel,
  onRefresh,
}: {
  reason: string | null;
  onResubmit: () => void;
  whatsappHref: string | null;
  whatsappLabel: string;
  onRefresh: () => void;
}) {
  return (
    <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5 space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-full bg-destructive/15 text-destructive grid place-items-center shrink-0">
          <XCircle className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="font-bold text-lg">Payment Rejected</div>
          <p className="text-sm text-muted-foreground">Your previous payment proof was not approved.</p>
          {reason && (
            <div className="mt-2 rounded-lg bg-background border border-border p-3 text-sm">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Reason from our team</div>
              <div className="whitespace-pre-line">{reason}</div>
            </div>
          )}
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onResubmit}
          className="inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-primary text-primary-foreground font-semibold shadow-glow text-sm"
        >
          <RefreshCw className="h-4 w-4" /> Resubmit Payment
        </button>
        {whatsappHref && (
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-card border border-border font-semibold text-sm hover:bg-muted"
          >
            <MessageCircle className="h-4 w-4 text-emerald-500" /> {whatsappLabel}
          </a>
        )}
      </div>
      <button
        type="button"
        onClick={onRefresh}
        className="w-full inline-flex items-center justify-center gap-2 py-2 rounded-lg text-xs text-muted-foreground hover:text-foreground"
      >
        <RefreshCw className="h-3 w-3" /> Check Status
      </button>
    </div>
  );
}

function ApprovedPanel({
  orderNumber,
  isSubscription,
  subscriptionDelivered,
}: {
  orderNumber: string;
  isSubscription: boolean;
  subscriptionDelivered: boolean;
}) {
  return (
    <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/15 via-emerald-500/5 to-transparent p-5 sm:p-6 space-y-6 animate-in fade-in zoom-in-95 duration-500">
      <div className="flex flex-col items-center text-center gap-3">
        <div className="h-14 w-14 rounded-full bg-emerald-500 text-white grid place-items-center shrink-0 shadow-glow">
          <CheckCircle2 className="h-7 w-7" strokeWidth={2.5} />
        </div>
        <div className="space-y-1">
          <div className="font-bold text-xl">Payment Approved</div>
          <div className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Order Verified Successfully</div>
          <p className="text-xs text-muted-foreground">
            {isSubscription
              ? subscriptionDelivered ? "Subscription delivered." : "Your subscription is awaiting admin delivery."
              : "License delivery completed."}
          </p>
        </div>
      </div>
      <Link
        to="/thank-you"
        search={{ order: orderNumber }}
        className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-primary text-primary-foreground font-semibold shadow-glow transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 active:scale-[.98] whitespace-nowrap"
        style={{ minHeight: 54 }}
      >
        <ClipboardCheck className="h-5 w-5 shrink-0" /> {isSubscription ? "View Subscription Status" : "View Delivery"}
      </Link>
    </div>
  );
}

function ActionButtons({
  onRefresh,
  whatsappHref,
  whatsappLabel: _whatsappLabel,
}: {
  onRefresh: () => void;
  whatsappHref: string | null;
  whatsappLabel: string;
}) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2 sm:gap-3 w-full">
        {whatsappHref ? (
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[52px] items-center justify-center gap-2 px-3 rounded-xl bg-emerald-500 text-white font-semibold text-sm hover:bg-emerald-600 active:scale-[.98] transition-all whitespace-nowrap"
          >
            <MessageCircle className="h-4 w-4 shrink-0" />
            <span className="hidden min-[380px]:inline">WhatsApp</span>
            <span className="min-[380px]:hidden">WhatsApp</span>
          </a>
        ) : (
          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex min-h-[52px] items-center justify-center gap-2 px-3 rounded-xl bg-card border border-border font-semibold text-sm hover:bg-muted transition-all whitespace-nowrap"
          >
            <RefreshCw className="h-4 w-4 shrink-0" /> Refresh
          </button>
        )}
        <Link
          to="/account"
          className="inline-flex min-h-[52px] items-center justify-center gap-2 px-3 rounded-xl bg-card border border-border font-semibold text-sm hover:bg-muted active:scale-[.98] transition-all whitespace-nowrap"
        >
          <span className="hidden min-[380px]:inline">My Orders</span>
          <span className="min-[380px]:hidden">Orders</span>
        </Link>
      </div>
      <button
        type="button"
        onClick={onRefresh}
        className="w-full inline-flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs text-muted-foreground hover:text-foreground"
      >
        <RefreshCw className="h-3 w-3" /> Check Status
      </button>
    </div>
  );
}

type CustomerField = {
  key: string;
  label: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  helpText?: string;
  options?: { label: string; value: string }[];
};
type GatewayInfoRow = { label: string; value: string };

function normalizeCustomerFields(cfg: Record<string, unknown>): CustomerField[] {
  const raw = cfg.customer_fields;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((f) => {
      if (!f || typeof f !== "object") return null;
      const r = f as Record<string, unknown>;
      const key = String(r.key ?? "").trim();
      const label = String(r.label ?? "").trim();
      if (!key || !label) return null;
      let options: { label: string; value: string }[] | undefined;
      if (Array.isArray(r.options)) {
        options = r.options
          .map((o) => {
            if (typeof o === "string") return { label: o, value: o };
            if (o && typeof o === "object") {
              const oo = o as Record<string, unknown>;
              const l = String(oo.label ?? oo.value ?? "").trim();
              const v = String(oo.value ?? oo.label ?? "").trim();
              if (!l) return null;
              return { label: l, value: v || l };
            }
            return null;
          })
          .filter((x): x is { label: string; value: string } => !!x);
      }
      return {
        key,
        label,
        type: String(r.type ?? "text").trim().toLowerCase(),
        placeholder: r.placeholder == null ? undefined : String(r.placeholder),
        required: Boolean(r.required),
        helpText: r.help_text == null && r.help == null ? undefined : String(r.help_text ?? r.help),
        options,
      } as CustomerField;
    })
    .filter((x): x is CustomerField => !!x);
}

function normalizeGatewayInfo(cfg: Record<string, unknown>): GatewayInfoRow[] {
  const raw = cfg.gateway_info;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((r) => {
      if (!r || typeof r !== "object") return null;
      const o = r as Record<string, unknown>;
      const label = String(o.label ?? "").trim();
      const value = String(o.value ?? "").trim();
      if (!label || !value) return null;
      return { label, value };
    })
    .filter((x): x is GatewayInfoRow => !!x);
}

function normalizeQr(cfg: Record<string, unknown>): { enabled: boolean; url: string } {
  const raw = cfg.qr;
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    return { enabled: o.enabled === true, url: String(o.url ?? "") };
  }
  return { enabled: false, url: "" };
}

function normalizedFieldType(field: CustomerField) {
  const type = (field.type || "text").toLowerCase();
  return type === "phone" ? "tel" : type;
}

function ManualForm({
  gateway,
  orderNumber,
  working,
  onSubmitting,
  onSubmitted,
}: {
  gateway: GatewayRow;
  orderNumber: string;
  working: boolean;
  onSubmitting: (v: boolean) => void;
  onSubmitted: () => void;
}) {
  const submit = useServerFn(submitManualPaymentFn);
  const cfg = (gateway.config as Record<string, unknown>) ?? {};
  const instructions = cfg.instructions == null ? "" : String(cfg.instructions);
  const gatewayInfo = useMemo(() => normalizeGatewayInfo(cfg), [cfg]);
  const customerFields = useMemo(() => normalizeCustomerFields(cfg), [cfg]);
  const qr = useMemo(() => normalizeQr(cfg), [cfg]);
  const requireScreenshot = useMemo(() => {
    const direct = cfg.require_screenshot;
    if (typeof direct === "boolean") return direct;
    if (typeof direct === "string") return direct === "true";
    const ps = cfg.payment_screenshot;
    if (ps && typeof ps === "object" && (ps as Record<string, unknown>).required === true) return true;
    return false;
  }, [cfg]);

  const [values, setValues] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<Record<string, File | null>>({});
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [qrUrl, setQrUrl] = useState<string>(() => (qr.url && !qr.url.startsWith("media://") ? qr.url : ""));

  useEffect(() => {
    let cancelled = false;
    if (!qr.enabled || !qr.url) { setQrUrl(""); return; }
    if (qr.url.startsWith("media://")) {
      setQrUrl("");
      import("@/lib/media/resolve").then(({ resolveStoredUrlAsync }) => {
        resolveStoredUrlAsync(qr.url).then((u) => { if (!cancelled) setQrUrl(u); }).catch(() => {});
      });
    } else {
      setQrUrl(qr.url);
    }
    return () => { cancelled = true; };
  }, [qr.enabled, qr.url]);

  const setVal = (k: string, v: string) => setValues((prev) => ({ ...prev, [k]: v }));
  const setFieldFile = (k: string, f: File | null) => setFiles((prev) => ({ ...prev, [k]: f }));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (working) return;
    for (const f of customerFields) {
      const isFile = normalizedFieldType(f) === "file";
      if (f.required && isFile && !files[f.key]) {
        return toast.error(`${f.label} is required`);
      }
      if (f.required && !isFile && !(values[f.key] ?? "").trim()) {
        return toast.error(`${f.label} is required`);
      }
    }
    if (requireScreenshot && !screenshotFile) {
      return toast.error("Payment Screenshot is required");
    }
    onSubmitting(true);
    try {
      const fileFields = customerFields.filter((f) => normalizedFieldType(f) === "file" && files[f.key]);
      const uploadedFiles: Record<string, string> = {};
      let screenshotPath: string | null = null;
      const hasAnyUpload = fileFields.length > 0 || (requireScreenshot && screenshotFile);
      if (hasAnyUpload) {
        setUploading(true);
        const { data: sess } = await supabase.auth.getSession();
        const ownerSegment = sess.session?.user?.id ?? "guest";
        for (const f of fileFields) {
          const selected = files[f.key];
          if (!selected) continue;
          const ext = selected.name.split(".").pop() || "bin";
          const safeKey = f.key.replace(/[^a-zA-Z0-9_-]/g, "_");
          const path = `submissions/${ownerSegment}/${orderNumber}/${safeKey}-${Date.now()}.${ext}`;
          const uploadRes = await supabase.storage.from("payments").upload(path, selected, { upsert: false, contentType: selected.type });
          if (uploadRes.error) throw new Error(uploadRes.error.message);
          uploadedFiles[f.key] = path;
        }
        if (requireScreenshot && screenshotFile) {
          const ext = screenshotFile.name.split(".").pop() || "bin";
          const path = `submissions/${ownerSegment}/${orderNumber}/screenshot-${Date.now()}.${ext}`;
          const uploadRes = await supabase.storage.from("payments").upload(path, screenshotFile, { upsert: false, contentType: screenshotFile.type });
          if (uploadRes.error) throw new Error(uploadRes.error.message);
          screenshotPath = path;
        }
        setUploading(false);
      }

      const allLines: string[] = [];
      const payload: Record<string, string> = {};
      for (const f of customerFields) {
        const v = normalizedFieldType(f) === "file" ? (uploadedFiles[f.key] ?? "") : (values[f.key] ?? "").trim();
        if (!v) continue;
        payload[f.key] = v;
        allLines.push(`${f.label}: ${v}`);
      }
      const composedNote = allLines.join("\n");


      await submit({
        data: {
          order_number: orderNumber,
          gateway_slug: gateway.slug,
          field_values: payload,
          note: composedNote || undefined,
          screenshot_url: screenshotPath ?? undefined,
        },
      });

      toast.success("Payment submitted — awaiting admin verification");
      onSubmitted();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not submit");
      onSubmitting(false);
      setUploading(false);
    }
  };

  const showQr = qr.enabled && !!qrUrl;
  const hasGatewayBlock = instructions || gatewayInfo.length > 0 || showQr;

  return (
    <form onSubmit={onSubmit} className="space-y-4 animate-in fade-in duration-300">
      {hasGatewayBlock && (
        <div className="rounded-xl border border-border bg-muted/40 p-4 space-y-3 text-sm">
          {instructions && <p className="whitespace-pre-line">{instructions}</p>}
          {gatewayInfo.length > 0 && (
            <div className="grid grid-cols-2 gap-2 pt-1">
              {gatewayInfo.map((r, i) => (
                <SummaryRow key={`${r.label}-${i}`} label={r.label} value={r.value} />
              ))}
            </div>
          )}
          {showQr && (
            <div className="pt-2">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Scan QR</div>
              <div className="h-40 w-40">
                <ProductThumb 
                  src={qrUrl} 
                  emoji="📱" 
                  alt="Payment QR" 
                  size={160} 
                  className="h-full w-full bg-white object-contain"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {customerFields.map((f) => (
        <FieldInput
          key={f.key}
          field={f}
          value={values[f.key] ?? ""}
          onChange={(v) => setVal(f.key, v)}
          file={files[f.key] ?? null}
          onFileChange={(file) => setFieldFile(f.key, file)}
        />
      ))}
      {requireScreenshot && (
        <div>
          <label className="block text-xs font-medium mb-1.5">
            Payment Screenshot <span className="text-destructive">*</span>
          </label>
          <label className="flex items-center gap-2 rounded-xl border border-dashed border-border bg-background px-3 py-2.5 text-sm cursor-pointer hover:border-primary/60">
            <Upload className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="truncate">
              {screenshotFile ? screenshotFile.name : "Upload payment screenshot (jpg, png, webp, pdf)"}
            </span>
            <input
              type="file"
              accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
              className="hidden"
              onChange={(e) => setScreenshotFile(e.target.files?.[0] ?? null)}
            />
          </label>
        </div>
      )}
      <button
        type="submit"
        disabled={working || uploading}
        className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-primary text-primary-foreground font-semibold shadow-glow disabled:opacity-60 transition-transform active:scale-[.98]"
      >
        {working || uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardCheck className="h-4 w-4" />}
        {uploading ? "Uploading…" : working ? "Submitting…" : "Submit Payment Proof"}
      </button>
      <p className="text-[11px] text-muted-foreground text-center">
        Your order will be marked paid after an admin verifies this submission.
      </p>
    </form>
  );
}

function FieldInput({ field, value, onChange, file, onFileChange }: { field: CustomerField; value: string; onChange: (v: string) => void; file: File | null; onFileChange: (file: File | null) => void }) {
  const { key, label, placeholder, required, helpText, options } = field;
  const type = normalizedFieldType(field);
  const baseCls = "w-full px-3 py-2 rounded-xl bg-card border border-border text-sm outline-none focus:border-primary";
  const labelNode = (
    <label className="text-xs font-semibold block mb-1.5">
      {label}{required && <span className="text-destructive"> *</span>}
    </label>
  );
  const helpNode = helpText ? <p className="text-[11px] text-muted-foreground mt-1">{helpText}</p> : null;

  let control: React.ReactNode;
  if (type === "textarea") {
    control = <textarea name={key} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} required={required} rows={3} className={baseCls} />;
  } else if (type === "select") {
    control = (
      <select name={key} value={value} onChange={(e) => onChange(e.target.value)} required={required} className={baseCls}>
        {placeholder && <option value="">{placeholder}</option>}
        {(options ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    );
  } else if (type === "file") {
    control = (
      <label className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-card border border-dashed border-border cursor-pointer hover:border-primary text-sm transition-colors">
        <Upload className="h-4 w-4 text-muted-foreground" />
        <span className="truncate">{file ? file.name : (placeholder ?? label)}</span>
        <input
          name={key}
          type="file"
          required={required}
          className="hidden"
          onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
        />
      </label>
    );
  } else {
    const inputType = ["email", "number", "tel", "text", "date"].includes(type) ? type : "text";
    control = <input name={key} type={inputType} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} required={required} className={baseCls} />;
  }
  return <div>{labelNode}{control}{helpNode}</div>;
}

