import { createFileRoute } from "@tanstack/react-router";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { PageHero } from "@/components/site/PageHero";
import { useState } from "react";
import { Package, Truck, CheckCircle2, Search } from "lucide-react";

export const Route = createFileRoute("/track-order")({
  head: () => ({ meta: [{ title: "Track Order — TopupHut" }] }),
  component: TrackOrder,
});

function TrackOrder() {
  const [tracked, setTracked] = useState(false);
  const steps = [
    { Icon: CheckCircle2, label: "Order placed", done: true, time: "Jun 22 · 14:02" },
    { Icon: Package, label: "Payment confirmed", done: true, time: "Jun 22 · 14:03" },
    { Icon: Truck, label: "Delivered to email", done: true, time: "Jun 22 · 14:05" },
  ];
  return (
    <div className="min-h-screen">
      <Header />
      <PageHero title="Track your order" subtitle="Enter your order ID and email to see status" crumbs={[{ label: "Home", to: "/" }, { label: "Track" }]} />
      <div className="container mx-auto px-4 py-12 max-w-2xl">
        <form onSubmit={(e) => { e.preventDefault(); setTracked(true); }} className="rounded-2xl bg-card border border-border p-5 space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <input required placeholder="Order ID (e.g. TH-A1B2C)" className="px-4 py-3 rounded-xl bg-muted/60 border border-border outline-none focus:border-primary text-sm" />
            <input required type="email" placeholder="Email used at checkout" className="px-4 py-3 rounded-xl bg-muted/60 border border-border outline-none focus:border-primary text-sm" />
          </div>
          <button className="w-full py-3 rounded-xl bg-gradient-primary text-primary-foreground font-semibold inline-flex items-center justify-center gap-2"><Search className="h-4 w-4" /> Track order</button>
        </form>

        {tracked && (
          <div className="rounded-2xl bg-card border border-border p-6 mt-6 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-muted-foreground">Order</div>
                <div className="font-bold">#TH-A1B2C</div>
              </div>
              <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 text-xs font-bold">Delivered</span>
            </div>
            <div className="space-y-4">
              {steps.map((s, i) => (
                <div key={i} className="flex gap-3 items-start">
                  <div className={`h-9 w-9 rounded-full grid place-items-center ${s.done ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground"}`}><s.Icon className="h-4 w-4" /></div>
                  <div className="flex-1">
                    <div className="font-semibold text-sm">{s.label}</div>
                    <div className="text-xs text-muted-foreground">{s.time}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}
