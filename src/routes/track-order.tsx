import { siteName } from "@/lib/cms/seo";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { PageHero } from "@/components/site/PageHero";
import { useState } from "react";
import { Package, CheckCircle2, Search, Clock, XCircle, Loader2 } from "lucide-react";
import { getOrderByNumberFn } from "@/lib/orders.functions";
import { toast } from "sonner";
import { usePage } from "@/lib/cms/pages/hooks";

export const Route = createFileRoute("/track-order")({
  head: () => ({ meta: [{ title: `Track Order — ${siteName()}` }] }),
  component: TrackOrder,
});

type OrderResult = Awaited<ReturnType<typeof getOrderByNumberFn>>;

function TrackOrder() {
  const fetchOrder = useServerFn(getOrderByNumberFn);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<OrderResult | null>(null);
  const [notFound, setNotFound] = useState(false);
  const { content } = usePage("track-order");

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setLoading(true); setNotFound(false); setResult(null);
    try {
      const data = await fetchOrder({ data: { orderNumber: String(fd.get("order")), email: String(fd.get("email")) } });
      if (!data) setNotFound(true); else setResult(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not fetch order");
    } finally { setLoading(false); }
  };

  const stepFor = (status: string) => {
    const flow = ["pending", "paid", "processing", "completed"];
    if (status === "cancelled" || status === "refunded") return -1;
    return flow.indexOf(status);
  };

  return (
    <div className="min-h-screen">
      <Header />
      <PageHero title={content.hero.title} subtitle={content.hero.subtitle} crumbs={[{ label: "Home", to: "/" }, { label: "Track" }]} />
      <div className="container mx-auto px-4 py-12 max-w-2xl">
        {content.tracker.heading && <h2 className="text-xl font-bold mb-3">{content.tracker.heading}</h2>}
        <form onSubmit={submit} className="rounded-2xl bg-card border border-border p-5 space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <input name="order" required placeholder={content.tracker.placeholder_order} className="px-4 py-3 rounded-xl bg-muted/60 border border-border outline-none focus:border-primary text-sm" />
            <input name="email" required type="email" placeholder={content.tracker.placeholder_email} className="px-4 py-3 rounded-xl bg-muted/60 border border-border outline-none focus:border-primary text-sm" />
          </div>
          <button disabled={loading} className="w-full py-3 rounded-xl bg-gradient-primary text-primary-foreground font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-60">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} {content.tracker.button_label}
          </button>
          {content.tracker.help_text && <p className="text-xs text-muted-foreground text-center">{content.tracker.help_text}</p>}
        </form>

        {notFound && <div className="mt-6 p-5 rounded-2xl bg-card border border-border text-center text-sm text-muted-foreground">No order found with that ID and email.</div>}

        {result?.order && (
          <div className="rounded-2xl bg-card border border-border p-6 mt-6 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-muted-foreground">Order</div>
                <div className="font-bold">#{result.order.order_number}</div>
              </div>
              <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold capitalize">{result.order.status}</span>
            </div>

            <div className="space-y-4">
              {["pending","paid","processing","completed"].map((s, i) => {
                const cur = stepFor(result.order.status);
                const done = cur >= i && cur >= 0;
                const Icon = i === 3 ? CheckCircle2 : i === 0 ? Clock : Package;
                return (
                  <div key={s} className="flex gap-3 items-start">
                    <div className={`h-9 w-9 rounded-full grid place-items-center ${done ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground"}`}><Icon className="h-4 w-4" /></div>
                    <div className="flex-1">
                      <div className="font-semibold text-sm capitalize">{s}</div>
                    </div>
                  </div>
                );
              })}
              {(result.order.status === "cancelled" || result.order.status === "refunded") && (
                <div className="flex gap-3 items-start">
                  <div className="h-9 w-9 rounded-full grid place-items-center bg-destructive text-white"><XCircle className="h-4 w-4" /></div>
                  <div className="flex-1"><div className="font-semibold text-sm capitalize">{result.order.status}</div></div>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-border text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Items</span><span>{result.items.length}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Total</span><span className="font-bold">${Number(result.order.total).toFixed(2)}</span></div>
            </div>
          </div>
        )}

        {content.faq && content.faq.length > 0 && (
          <section className="mt-10 space-y-2">
            <h2 className="text-lg font-bold mb-3">Tracking help</h2>
            {content.faq.map((it) => (
              <details key={it.q} className="rounded-2xl bg-card border border-border p-4 group">
                <summary className="font-semibold cursor-pointer text-sm flex justify-between items-center">{it.q}<span className="text-primary group-open:rotate-45 transition-smooth">+</span></summary>
                <p className="text-sm text-muted-foreground mt-2">{it.a}</p>
              </details>
            ))}
          </section>
        )}
      </div>
      <Footer />
    </div>
  );
}
