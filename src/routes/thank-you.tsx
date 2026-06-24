import { createFileRoute, Link } from "@tanstack/react-router";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { ProductCard } from "@/components/site/ProductCard";
import { useFeatured, featuredQuery } from "@/lib/catalog";
import { CheckCircle2, Download, Mail, MessageCircle } from "lucide-react";
import { z } from "zod";

export const Route = createFileRoute("/thank-you")({
  validateSearch: z.object({ order: z.string().optional() }),
  head: () => ({ meta: [{ title: "Order Confirmed — TopupHut" }] }),
  loader: ({ context }) => { context.queryClient.ensureQueryData(featuredQuery()); },
  component: ThankYou,
  errorComponent: () => <div className="p-8 text-center">Order page unavailable.</div>,
  notFoundComponent: () => <div className="p-8 text-center">Not found.</div>,
});

function ThankYou() {
  const { order } = Route.useSearch();
  const recommended = useFeatured().slice(0, 4);
  return (
    <div className="min-h-screen">
      <Header />
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-xl mx-auto text-center">
          <div className="relative inline-grid place-items-center mb-6">
            <div className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping" />
            <div className="relative h-24 w-24 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 grid place-items-center shadow-glow">
              <CheckCircle2 className="h-12 w-12 text-white" strokeWidth={2.5} />
            </div>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold mb-2">Thank you for your order!</h1>
          <p className="text-muted-foreground">Your order <b className="text-primary">#{order ?? "TH-DEMO"}</b> has been confirmed.</p>
        </div>

        <div className="max-w-2xl mx-auto mt-10 rounded-2xl bg-card border border-border p-6 space-y-5">
          <div className="flex items-start gap-3 p-4 rounded-xl bg-primary/5 border border-primary/20">
            <Mail className="h-5 w-5 text-primary mt-0.5" />
            <div className="text-sm">
              <div className="font-semibold">Confirmation email sent</div>
              <p className="text-muted-foreground">Check your inbox for download links and activation instructions.</p>
            </div>
          </div>

          <div>
            <h3 className="font-bold mb-3 flex items-center gap-2"><Download className="h-4 w-4 text-primary" /> Your downloads</h3>
            <div className="space-y-2">
              {recommended.slice(0, 2).map((p) => (
                <div key={p.slug} className="flex items-center gap-3 p-3 rounded-xl border border-border">
                  <span className="text-3xl">{p.emoji}</span>
                  <div className="flex-1">
                    <div className="font-semibold text-sm">{p.name}</div>
                    <div className="text-xs text-muted-foreground">Ready to download</div>
                  </div>
                  <button className="px-3 py-2 rounded-lg bg-gradient-primary text-primary-foreground text-xs font-semibold inline-flex items-center gap-1">
                    <Download className="h-3.5 w-3.5" /> Download
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <a href="https://wa.me/8801000000000" target="_blank" rel="noreferrer" className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-500 text-white font-semibold text-sm hover:bg-emerald-600">
              <MessageCircle className="h-4 w-4" /> WhatsApp Support
            </a>
            <Link to="/account" className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-card border border-border font-semibold text-sm hover:bg-muted">
              View my orders
            </Link>
          </div>
        </div>

        <section className="mt-16">
          <h2 className="text-2xl font-bold mb-5">You may also like</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
            {recommended.map((p) => <ProductCard key={p.slug} product={p} />)}
          </div>
        </section>
      </div>
      <Footer />
    </div>
  );
}
