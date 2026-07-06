import { siteName } from "@/lib/cms/seo";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Header } from "@/components/site/Header";
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
  Download,
  AlertTriangle,
  Sparkles,
} from "lucide-react";
import { getOrderByNumberFn, getMyOrderByNumberFn, simulateGatewayPaymentFn } from "@/lib/orders.functions";
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
}): TimelineStep[] {
  const { submitted, underReview, rejected, approved, hasLicense } = opts;
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
      label: "License Delivered",
      state: approved && hasLicense ? "done" : approved ? "current" : "todo",
    },
  ];
}

function submittedFlag(orderNumber: string) {
  return `pay:submitted:${orderNumber}`;
}

function PayPage() {
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
      const data = query.state.data as { order?: { status?: string } } | undefined;
      const status = data?.order?.status;
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

  const order = q.data?.order;
  const assignments = (q.data?.assignments as unknown as Array<unknown>) ?? [];
  const submission = subQ.data?.submission ?? null;
  const slug: string = order?.payment_method ?? "";
  const gateway: GatewayRow | undefined = gw.data?.gateways.find((g) => g.slug === slug);
  const isManual = gateway?.type === "manual";
  const isCustomAuto = gateway?.type === "custom_auto";
  const isBuiltinAuto = gateway?.type === "builtin" && BUILTIN_AUTO.has(slug);

  const orderStatus = order?.status ?? "pending";
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
    hasLicense: assignments.length > 0,
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
                <SummaryRow label="Amount" value={`${Number(order.total).toFixed(2)} ${order.currency}`} />
                <SummaryRow label="Method" value={gateway?.name ?? slug ?? "—"} />
              </div>

              <Timeline steps={timeline} />

              {approved ? (
                <ApprovedPanel orderNumber={orderNumber} />
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
                      Pay ${Number(order.total).toFixed(2)}
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

function ApprovedPanel({ orderNumber }: { orderNumber: string }) {
  return (
    <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/15 via-emerald-500/5 to-transparent p-5 sm:p-6 space-y-6 animate-in fade-in zoom-in-95 duration-500">
      <div className="flex flex-col items-center text-center gap-3">
        <div className="h-14 w-14 rounded-full bg-emerald-500 text-white grid place-items-center shrink-0 shadow-glow">
          <CheckCircle2 className="h-7 w-7" strokeWidth={2.5} />
        </div>
        <div className="space-y-1">
          <div className="font-bold text-xl">Payment Approved</div>
          <div className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Order Verified Successfully</div>
          <p className="text-xs text-muted-foreground">License delivery completed.</p>
        </div>
      </div>
      <Link
        to="/thank-you"
        search={{ order: orderNumber }}
        className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-primary text-primary-foreground font-semibold shadow-glow transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 active:scale-[.98] whitespace-nowrap"
        style={{ minHeight: 54 }}
      >
        <Download className="h-5 w-5 shrink-0" /> Download Product
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
  const cfg = gateway.config as Record<string, unknown>;
  const instructions = (cfg.instructions as string) || "";
  const accountName = (cfg.account_name as string) || "";
  const accountNumber = (cfg.account_number as string) || "";
  const qrUrl = (cfg.qr_url as string) || "";
  const requireTxn = cfg.require_transaction_id !== false;
  const requireScreenshot = cfg.require_screenshot === true;
  const [txn, setTxn] = useState("");
  const [senderName, setSenderName] = useState("");
  const [senderAccount, setSenderAccount] = useState("");
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (working) return;
    if (requireTxn && !txn.trim()) return toast.error("Transaction ID is required");
    if (requireScreenshot && !file) return toast.error("Screenshot is required");
    onSubmitting(true);
    try {
      let screenshot_url: string | undefined;
      if (file) {
        setUploading(true);
        const ext = file.name.split(".").pop() || "png";
        const { data: sess } = await supabase.auth.getSession();
        const ownerSegment = sess.session?.user?.id ?? "guest";
        const path = `submissions/${ownerSegment}/${orderNumber}/${Date.now()}.${ext}`;
        const uploadRes = await supabase.storage.from("payments").upload(path, file, { upsert: false, contentType: file.type });
        if (uploadRes.error) throw new Error(uploadRes.error.message);
        screenshot_url = path;
        setUploading(false);
      }
      await submit({
        data: {
          order_number: orderNumber,
          gateway_slug: gateway.slug,
          transaction_id: txn.trim() || undefined,
          sender_name: senderName.trim() || undefined,
          sender_account: senderAccount.trim() || undefined,
          screenshot_url,
          note: note.trim() || undefined,
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

  return (
    <form onSubmit={onSubmit} className="space-y-4 animate-in fade-in duration-300">
      {(instructions || accountName || accountNumber || qrUrl) && (
        <div className="rounded-xl border border-border bg-muted/40 p-4 space-y-2 text-sm">
          {instructions && <p className="whitespace-pre-line">{instructions}</p>}
          {(accountName || accountNumber) && (
            <div className="grid grid-cols-2 gap-2 pt-2">
              {accountName && <SummaryRow label="Account name" value={accountName} />}
              {accountNumber && <SummaryRow label="Account number" value={accountNumber} />}
            </div>
          )}
          {qrUrl && (
            <div className="pt-2">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Scan QR</div>
              <img src={qrUrl} alt="Payment QR" className="h-40 w-40 rounded-lg border border-border bg-white object-contain" />
            </div>
          )}
        </div>
      )}

      <FieldInput label={`Transaction ID${requireTxn ? " *" : ""}`} value={txn} onChange={setTxn} placeholder="e.g. 8A7B6C5D" />
      <div className="grid grid-cols-2 gap-3">
        <FieldInput label="Sender name" value={senderName} onChange={setSenderName} />
        <FieldInput label="Sender account" value={senderAccount} onChange={setSenderAccount} />
      </div>
      <div>
        <label className="text-xs font-semibold block mb-1.5">
          Payment screenshot{requireScreenshot ? " *" : " (optional)"}
        </label>
        <label className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-card border border-dashed border-border cursor-pointer hover:border-primary text-sm transition-colors">
          <Upload className="h-4 w-4 text-muted-foreground" />
          <span className="truncate">{file ? file.name : "Choose image…"}</span>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>
      </div>
      <div>
        <label className="text-xs font-semibold block mb-1.5">Note (optional)</label>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="w-full px-3 py-2 rounded-xl bg-card border border-border text-sm outline-none focus:border-primary" />
      </div>
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

function FieldInput({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="text-xs font-semibold block mb-1.5">{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full px-3 py-2 rounded-xl bg-card border border-border text-sm outline-none focus:border-primary" />
    </div>
  );
}
