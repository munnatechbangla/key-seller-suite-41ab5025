import { siteName } from "@/lib/cms/seo";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { CheckCircle2, Download, Mail, MessageCircle, KeyRound, Loader2, Clock, XCircle } from "lucide-react";
import { z } from "zod";
import { getOrderByNumberFn } from "@/lib/orders.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/thank-you")({
  validateSearch: z.object({ order: z.string().optional(), email: z.string().optional() }),
  head: () => ({ meta: [{ title: `Order Confirmed — ${siteName()}` }] }),
  component: ThankYou,
  errorComponent: () => <div className="p-8 text-center">Order page unavailable.</div>,
  notFoundComponent: () => <div className="p-8 text-center">Not found.</div>,
});

function ThankYou() {
  const { order, email } = Route.useSearch();
  const fetchOrder = useServerFn(getOrderByNumberFn);
  const q = useQuery({
    queryKey: ["order", order, email],
    queryFn: () => fetchOrder({ data: { orderNumber: order!, email } }),
    enabled: !!order,
    // Poll while waiting for webhook to mark payment paid.
    refetchInterval: (query) => {
      const s = query.state.data?.paymentStatus;
      return s === "paid" || s === "failed" || s === "refunded" ? false : 4000;
    },
  });

  const paymentStatus = q.data?.paymentStatus ?? "pending";
  const isPaid = paymentStatus === "paid";
  const isFailed = paymentStatus === "failed";
  const isPending = !isPaid && !isFailed;

  return (
    <div className="min-h-screen">
      <Header />
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-xl mx-auto text-center">
          <div className="relative inline-grid place-items-center mb-6">
            {isPaid && (
              <>
                <div className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping" />
                <div className="relative h-24 w-24 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 grid place-items-center shadow-glow">
                  <CheckCircle2 className="h-12 w-12 text-white" strokeWidth={2.5} />
                </div>
              </>
            )}
            {isPending && (
              <div className="relative h-24 w-24 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 grid place-items-center shadow-glow">
                <Clock className="h-12 w-12 text-white" strokeWidth={2.5} />
              </div>
            )}
            {isFailed && (
              <div className="relative h-24 w-24 rounded-full bg-gradient-to-br from-rose-400 to-rose-600 grid place-items-center shadow-glow">
                <XCircle className="h-12 w-12 text-white" strokeWidth={2.5} />
              </div>
            )}
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold mb-2">
            {isPaid ? "Thank you for your order!" : isFailed ? "Payment failed" : "Awaiting payment confirmation"}
          </h1>
          <p className="text-muted-foreground">
            Order <b className="text-primary">#{order ?? "—"}</b>
            {q.data?.order && <> · payment status <span className="capitalize font-semibold">{paymentStatus}</span></>}
          </p>
          {q.data?.order && (
            <p className="mt-1 text-sm text-muted-foreground">
              Total <b>${Number(q.data.order.total).toFixed(2)}</b> · {q.data.items.length} item{q.data.items.length !== 1 ? "s" : ""}
            </p>
          )}
          {isPending && order && (
            <div className="mt-4">
              <Link to="/pay/$orderNumber" params={{ orderNumber: order }} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-primary text-primary-foreground font-semibold text-sm">
                Complete payment
              </Link>
            </div>
          )}
        </div>

        <div className="max-w-2xl mx-auto mt-10 rounded-2xl bg-card border border-border p-6 space-y-5">
          {isPaid && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-primary/5 border border-primary/20">
              <Mail className="h-5 w-5 text-primary mt-0.5" />
              <div className="text-sm">
                <div className="font-semibold">Confirmation email sent</div>
                <p className="text-muted-foreground">Check your inbox for download links and activation instructions.</p>
              </div>
            </div>
          )}

          {isPending && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
              <Loader2 className="h-5 w-5 text-amber-600 mt-0.5 animate-spin" />
              <div className="text-sm">
                <div className="font-semibold">Waiting for the payment gateway to confirm your transaction…</div>
                <p className="text-muted-foreground">License keys and downloads will appear here automatically as soon as payment is verified.</p>
              </div>
            </div>
          )}

          {isFailed && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-destructive/10 border border-destructive/30">
              <XCircle className="h-5 w-5 text-destructive mt-0.5" />
              <div className="text-sm">
                <div className="font-semibold">We couldn't verify this payment.</div>
                <p className="text-muted-foreground">No license keys were issued. Please retry payment or contact support.</p>
              </div>
            </div>
          )}

          {q.isLoading && (
            <div className="flex items-center justify-center py-6 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading your order…
            </div>
          )}

          {q.data && (
            <>
              <div>
                <h3 className="font-bold mb-3 flex items-center gap-2"><Download className="h-4 w-4 text-primary" /> Your items</h3>
                <div className="space-y-2">
                  {q.data.items.map((it) => (
                    <div key={it.id} className="flex items-center gap-3 p-3 rounded-xl border border-border">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 grid place-items-center text-primary font-bold">{it.qty}×</div>
                      <div className="flex-1">
                        <div className="font-semibold text-sm">{it.product_name}</div>
                        <div className="text-xs text-muted-foreground">${Number(it.unit_price).toFixed(2)} each</div>
                      </div>
                      <button disabled={!isPaid} className="px-3 py-2 rounded-lg bg-gradient-primary text-primary-foreground text-xs font-semibold inline-flex items-center gap-1 disabled:opacity-50">
                        <Download className="h-3.5 w-3.5" /> {isPaid ? "Download" : "Locked"}
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {isPaid && q.data.assignments.length > 0 && (
                <div>
                  <h3 className="font-bold mb-3 flex items-center gap-2"><KeyRound className="h-4 w-4 text-primary" /> License keys</h3>
                  <div className="space-y-2">
                    {q.data.assignments.map((a) => {
                      const key = (a as { license_keys: { key_value: string } | null }).license_keys?.key_value ?? "";
                      return (
                        <div key={a.id} className="flex items-center gap-3 p-3 rounded-xl border border-border">
                          <code className="flex-1 font-mono text-sm break-all">{key}</code>
                          <button
                            type="button"
                            onClick={() => { navigator.clipboard.writeText(key); toast.success("Copied"); }}
                            className="px-3 py-2 rounded-lg bg-card border border-border text-xs font-semibold hover:bg-muted"
                          >
                            Copy
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}

          <div className="flex flex-wrap gap-3">
            <a href="https://wa.me/8801000000000" target="_blank" rel="noreferrer" className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-500 text-white font-semibold text-sm hover:bg-emerald-600">
              <MessageCircle className="h-4 w-4" /> WhatsApp Support
            </a>
            <Link to="/account" className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-card border border-border font-semibold text-sm hover:bg-muted">
              View my orders
            </Link>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
