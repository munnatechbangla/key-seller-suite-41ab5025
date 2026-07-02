import { siteName } from "@/lib/cms/seo";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { Loader2, ShieldCheck, CreditCard, XCircle, ExternalLink, Upload, ClipboardCheck } from "lucide-react";
import { getOrderByNumberFn, getMyOrderByNumberFn, simulateGatewayPaymentFn } from "@/lib/orders.functions";
import { useAuth } from "@/lib/stores";
import { initPaymentFn } from "@/lib/payments/init.functions";
import { listEnabledGatewaysFn, submitManualPaymentFn, type GatewayRow } from "@/lib/payments/gateways.functions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState } from "react";

const BUILTIN_AUTO = new Set(["sslcommerz", "bkash", "stripe"]);

export const Route = createFileRoute("/pay/$orderNumber")({
  head: () => ({ meta: [{ title: `Complete Payment — ${siteName()}` }] }),
  component: PayPage,
  errorComponent: () => <div className="p-8 text-center">Payment page unavailable.</div>,
  notFoundComponent: () => <div className="p-8 text-center">Order not found.</div>,
});

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
  const qc = useQueryClient();
  const [working, setWorking] = useState<null | "paid" | "failed" | "redirect" | "manual">(null);

  const q = useQuery({ queryKey: ["order", orderNumber, user?.id ?? "guest"], queryFn: () => fetchOrder({ data: { orderNumber } }) });
  const gw = useQuery({ queryKey: ["enabled-gateways"], queryFn: () => listGateways() });

  const order = q.data?.order;
  const alreadyDone = order && order.status !== "pending";
  const slug = order?.payment_method ?? "";
  const gateway: GatewayRow | undefined = gw.data?.gateways.find((g) => g.slug === slug);
  const isManual = gateway?.type === "manual";
  const isCustomAuto = gateway?.type === "custom_auto";
  const isBuiltinAuto = gateway?.type === "builtin" && BUILTIN_AUTO.has(slug);

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

  return (
    <div className="min-h-screen">
      <Header />
      <div className="container mx-auto px-4 py-16 max-w-xl">
        <div className="rounded-2xl bg-card border border-border p-6 space-y-5">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-emerald-500" /> Secure checkout
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Order</div>
            <div className="font-bold text-lg">#{orderNumber}</div>
          </div>

          {(q.isLoading || gw.isLoading) && (
            <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading…
            </div>
          )}

          {!q.isLoading && !order && (
            <div className="p-4 rounded-xl bg-destructive/10 text-destructive text-sm">Order not found.</div>
          )}

          {order && !q.isLoading && !gw.isLoading && (
            <>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <Row label="Amount" value={`$${Number(order.total).toFixed(2)} ${order.currency}`} />
                <Row label="Method" value={gateway?.name ?? slug ?? "—"} />
                <Row label="Order status" value={order.status} className="capitalize" />
                <Row label="Payment status" value={q.data?.paymentStatus ?? "pending"} className="capitalize" />
              </div>

              {alreadyDone ? (
                <div className="p-4 rounded-xl bg-primary/10 text-sm">
                  This order has already been processed.{" "}
                  <Link to="/thank-you" search={{ order: orderNumber }} className="font-semibold text-primary hover:underline">
                    View confirmation →
                  </Link>
                </div>
              ) : isManual && gateway ? (
                <ManualForm
                  gateway={gateway}
                  orderNumber={orderNumber}
                  working={working === "manual"}
                  onSubmitting={(v) => setWorking(v ? "manual" : null)}
                  onSubmitted={() => navigate({ to: "/thank-you", search: { order: orderNumber } })}
                />
              ) : isBuiltinAuto || isCustomAuto ? (
                <>
                  <p className="text-xs text-muted-foreground">
                    You will be redirected to <span className="font-medium">{gateway?.name ?? slug}</span> to complete payment.
                  </p>
                  <button
                    type="button"
                    onClick={redirectToGateway}
                    disabled={!!working}
                    className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-primary text-primary-foreground font-semibold shadow-glow disabled:opacity-60"
                  >
                    {working === "redirect" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
                    Continue to {gateway?.name ?? slug} →
                  </button>
                </>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground">
                    Sandbox controls — gateway adapter not yet implemented.
                  </p>
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
                </>
              )}
            </>
          )}
        </div>
      </div>
      <Footer />
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
        const path = `submissions/${orderNumber}/${Date.now()}.${ext}`;
        const { error } = await supabase.storage.from("payments").upload(path, file, { upsert: true, contentType: file.type });
        if (error) throw new Error(error.message);
        // Store the object path; admins fetch a short-lived signed URL on demand.
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
    <form onSubmit={onSubmit} className="space-y-4">
      {(instructions || accountName || accountNumber || qrUrl) && (
        <div className="rounded-xl border border-border bg-muted/40 p-4 space-y-2 text-sm">
          {instructions && <p className="whitespace-pre-line">{instructions}</p>}
          {(accountName || accountNumber) && (
            <div className="grid grid-cols-2 gap-2 pt-2">
              {accountName && <Row label="Account name" value={accountName} />}
              {accountNumber && <Row label="Account number" value={accountNumber} />}
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
        <label className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-card border border-dashed border-border cursor-pointer hover:border-primary text-sm">
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
        className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-primary text-primary-foreground font-semibold shadow-glow disabled:opacity-60"
      >
        {working || uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardCheck className="h-4 w-4" />}
        {uploading ? "Uploading…" : working ? "Submitting…" : "Submit payment proof"}
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

function Row({ label, value, className = "" }: { label: string; value: string; className?: string }) {
  return (
    <div className="rounded-xl bg-muted/40 p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`font-semibold ${className}`}>{value}</div>
    </div>
  );
}
