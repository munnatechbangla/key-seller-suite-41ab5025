import { siteName } from "@/lib/cms/seo";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { CheckCircle2, Package, Mail, MessageCircle, Loader2, Clock, XCircle } from "lucide-react";
import { z } from "zod";
import { getOrderByNumberFn, getMyOrderByNumberFn } from "@/lib/orders.functions";
import { useAuth } from "@/lib/stores";
import { toast } from "sonner";
import { useEffect, useRef } from "react";
import { track } from "@/lib/analytics/track";
import { OrderCustomFieldValues } from "@/components/orders/OrderCustomFieldValues";
import { DeliveryPanel } from "@/components/delivery/DeliveryPanel";
import { getOrderDeliveryAuthFn, getOrderDeliveryGuestFn } from "@/lib/delivery.functions";
import { FulfillmentPanel } from "@/components/fulfillment/FulfillmentPanel";

export const Route = createFileRoute("/thank-you")({
  validateSearch: z.object({ order: z.string().optional(), email: z.string().optional() }),
  head: () => ({ meta: [{ title: `Order Confirmed — ${siteName()}` }] }),
  component: ThankYou,
  errorComponent: () => <div className="p-8 text-center">Order page unavailable.</div>,
  notFoundComponent: () => <div className="p-8 text-center">Not found.</div>,
});

function ThankYou() {
  const { order, email } = Route.useSearch();
  const user = useAuth((s) => s.user);
  const fetchOrderPublic = useServerFn(getOrderByNumberFn);
  const fetchOrderAuthed = useServerFn(getMyOrderByNumberFn);
  const fetchOrder = user ? fetchOrderAuthed : fetchOrderPublic;
  const q = useQuery({
    queryKey: ["order", order, email, user?.id ?? "guest"],
    queryFn: () => fetchOrder({ data: { orderNumber: order!, email } }),
    enabled: !!order,
    // Poll while waiting for webhook to mark payment paid.
    refetchInterval: (query) => {
      const s = query.state.data?.paymentStatus;
      return s === "paid" || s === "failed" || s === "refunded" ? false : 4000;
    },
  });

  const fetchDeliveryAuth = useServerFn(getOrderDeliveryAuthFn);
  const fetchDeliveryGuest = useServerFn(getOrderDeliveryGuestFn);
  const fetchDelivery = user ? fetchDeliveryAuth : fetchDeliveryGuest;
  const deliveryQ = useQuery({
    queryKey: ["delivery", order, email, user?.id ?? "guest"],
    queryFn: () => fetchDelivery({ data: { orderNumber: order!, email } }),
    enabled: !!order && q.data?.paymentStatus === "paid",
  });

  const paymentStatus = q.data?.paymentStatus ?? "pending";
  const isPaid = paymentStatus === "paid";
  const isFailed = paymentStatus === "failed";
  const isPending = !isPaid && !isFailed;

  const fired = useRef(false);
  useEffect(() => {
    if (!isPaid || fired.current || !q.data) return;
    fired.current = true;
    track("purchase", {
      transaction_id: order,
      currency: q.data.order?.currency ?? "USD",
      value: Number(q.data.order?.total ?? 0),
      items: q.data.items.map((it) => ({
        item_id: it.id,
        item_name: it.product_name,
        price: Number(it.unit_price),
        quantity: it.qty,
      })),
    });
  }, [isPaid, q.data, order]);

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
                <p className="text-muted-foreground">Check your inbox for your order confirmation and delivery updates.</p>
              </div>
            </div>
          )}

          {isPending && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
              <Loader2 className="h-5 w-5 text-amber-600 mt-0.5 animate-spin" />
              <div className="text-sm">
                <div className="font-semibold">Waiting for the payment gateway to confirm your transaction…</div>
                <p className="text-muted-foreground">Your delivery status will update automatically as soon as payment is verified.</p>
              </div>
            </div>
          )}

          {isFailed && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-destructive/10 border border-destructive/30">
              <XCircle className="h-5 w-5 text-destructive mt-0.5" />
              <div className="text-sm">
                <div className="font-semibold">We couldn't verify this payment.</div>
                <p className="text-muted-foreground">No delivery was issued. Please retry payment or contact support.</p>
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
                <h3 className="font-bold mb-3 flex items-center gap-2"><Package className="h-4 w-4 text-primary" /> Your items</h3>
                <div className="space-y-2">
                  {q.data.items.map((it) => (
                    <div key={it.id} className="flex items-center gap-3 p-3 rounded-xl border border-border">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 grid place-items-center text-primary font-bold">{it.qty}×</div>
                      <div className="flex-1">
                        <div className="font-semibold text-sm">{it.product_name}</div>
                        <div className="text-xs text-muted-foreground">${Number(it.unit_price).toFixed(2)} each</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {isPaid && deliveryQ.data && deliveryQ.data.length > 0 && (
                <DeliveryPanel items={deliveryQ.data} />
              )}

              {isPaid && q.data.order?.id && (
                <div className="rounded-2xl border border-border bg-card p-4">
                  <h3 className="font-bold mb-3 text-sm">Order status</h3>
                  <FulfillmentPanel
                    orderId={q.data.order.id}
                    email={email}
                    authed={!!user}
                  />
                </div>
              )}

              {!isPaid && (
                <OrderCustomFieldValues
                  orderId={q.data.order?.id}
                  email={email}
                  authed={!!user}
                />
              )}
            </>
          )}

          <div className="grid grid-cols-2 gap-3">
            <a
              href="https://wa.me/8801000000000"
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-[52px] items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-emerald-500 px-4 text-sm font-semibold text-white shadow-sm transition-smooth hover:bg-emerald-600 hover:shadow-md"
            >
              <MessageCircle className="h-4 w-4 shrink-0" />
              <span className="sm:hidden">WhatsApp</span>
              <span className="hidden sm:inline">WhatsApp Support</span>
            </a>
            <Link
              to="/account"
              className="inline-flex min-h-[52px] items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-border bg-card px-4 text-sm font-semibold shadow-sm transition-smooth hover:bg-muted hover:shadow-md"
            >
              View my orders
            </Link>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
