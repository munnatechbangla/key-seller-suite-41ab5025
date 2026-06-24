import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { Loader2, ShieldCheck, CreditCard, XCircle } from "lucide-react";
import { getOrderByNumberFn, simulateGatewayPaymentFn } from "@/lib/orders.functions";
import { toast } from "sonner";
import { useState } from "react";

export const Route = createFileRoute("/pay/$orderNumber")({
  head: () => ({ meta: [{ title: "Complete Payment — TopupHut" }] }),
  component: PayPage,
  errorComponent: () => <div className="p-8 text-center">Payment page unavailable.</div>,
  notFoundComponent: () => <div className="p-8 text-center">Order not found.</div>,
});

function PayPage() {
  const { orderNumber } = Route.useParams();
  const navigate = useNavigate();
  const fetchOrder = useServerFn(getOrderByNumberFn);
  const simulate = useServerFn(simulateGatewayPaymentFn);
  const qc = useQueryClient();
  const [working, setWorking] = useState<null | "paid" | "failed">(null);

  const q = useQuery({
    queryKey: ["order", orderNumber],
    queryFn: () => fetchOrder({ data: { orderNumber } }),
  });

  const order = q.data?.order;
  const alreadyDone = order && order.status !== "pending";

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
            <ShieldCheck className="h-4 w-4 text-emerald-500" /> Secure sandbox checkout
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Order</div>
            <div className="font-bold text-lg">#{orderNumber}</div>
          </div>

          {q.isLoading && <div className="flex items-center justify-center py-8 text-muted-foreground text-sm"><Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading order…</div>}

          {!q.isLoading && !order && (
            <div className="p-4 rounded-xl bg-destructive/10 text-destructive text-sm">Order not found.</div>
          )}

          {order && (
            <>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <Row label="Amount" value={`$${Number(order.total).toFixed(2)} ${order.currency}`} />
                <Row label="Method" value={order.payment_method ?? "—"} />
                <Row label="Order status" value={order.status} className="capitalize" />
                <Row label="Payment status" value={q.data?.paymentStatus ?? "pending"} className="capitalize" />
              </div>

              {alreadyDone ? (
                <div className="p-4 rounded-xl bg-primary/10 text-sm">
                  This order has already been processed.{" "}
                  <Link to="/thank-you" search={{ order: orderNumber }} className="font-semibold text-primary hover:underline">View confirmation →</Link>
                </div>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground">
                    Real payment gateways post a signed webhook to <code>/api/public/payments/webhook</code> after the customer pays.
                    While merchant credentials are not connected, use the sandbox controls below to drive the same verified-callback flow.
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => run("paid")}
                      disabled={!!working}
                      className="inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-primary text-primary-foreground font-semibold shadow-glow disabled:opacity-60"
                    >
                      {working === "paid" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />} Pay ${Number(order.total).toFixed(2)}
                    </button>
                    <button
                      type="button"
                      onClick={() => run("failed")}
                      disabled={!!working}
                      className="inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-card border border-border font-semibold text-sm hover:bg-muted disabled:opacity-60"
                    >
                      {working === "failed" ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />} Simulate failure
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

function Row({ label, value, className = "" }: { label: string; value: string; className?: string }) {
  return (
    <div className="rounded-xl bg-muted/40 p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`font-semibold ${className}`}>{value}</div>
    </div>
  );
}
