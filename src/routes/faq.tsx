import { siteName } from "@/lib/cms/seo";
import { createFileRoute } from "@tanstack/react-router";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { PageHero } from "@/components/site/PageHero";
import { useState } from "react";
import { Search } from "lucide-react";
import { useLegalPage, type FaqGroup } from "@/lib/cms/legal";

export const Route = createFileRoute("/faq")({
  head: () => ({ meta: [{ title: `FAQ — ${siteName()}` }] }),
  component: FAQ,
});

const fallbackGroups: FaqGroup[] = [
  {
    name: "Orders & Delivery",
    items: [
      { q: "How fast is delivery?", a: "Most products are delivered instantly. Some (like IPTV) may take up to 30 minutes." },
      { q: "Where will I receive my product?", a: "Activation details and download links are sent to the email used during checkout." },
      { q: "I didn't receive my order — what now?", a: "Check spam first, then contact our 24/7 live chat. Most issues are resolved in minutes." },
    ],
  },
  {
    name: "Payments",
    items: [
      { q: "Which payment methods do you accept?", a: "Stripe, PayPal, SSLCommerz, bKash, Nagad, Rocket, crypto and bank transfer." },
      { q: "Is checkout secure?", a: "Yes, all transactions use 256-bit SSL encryption and PCI-compliant processors." },
    ],
  },
  {
    name: "Warranty & Refunds",
    items: [
      { q: "Do products come with warranty?", a: "Yes — every order includes a full subscription warranty. We'll replace any account that stops working." },
      { q: "What's your refund policy?", a: "Full refund within 24 hours if the product can't be delivered or activated. See Refund Policy for details." },
    ],
  },
];

function FAQ() {
  const [q, setQ] = useState("");
  const { data: page } = useLegalPage("faq");
  const groups = page?.content?.faq_groups ?? fallbackGroups;
  const title = page?.title ?? "Frequently asked questions";
  const subtitle = page?.subtitle ?? "Quick answers to the things customers ask most";

  return (
    <div className="min-h-screen">
      <Header />
      <PageHero title={title} subtitle={subtitle} crumbs={[{ label: "Home", to: "/" }, { label: "FAQ" }]} />
      <div className="container mx-auto px-4 py-12 max-w-3xl space-y-8">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search FAQs…" className="w-full pl-12 pr-4 py-3 rounded-2xl bg-card border border-border outline-none focus:border-primary" />
        </div>
        {groups.map((g) => {
          const items = g.items.filter((i) => (i.q + i.a).toLowerCase().includes(q.toLowerCase()));
          if (items.length === 0) return null;
          return (
            <section key={g.name} className="space-y-3">
              <h2 className="text-xl font-bold">{g.name}</h2>
              <div className="space-y-2">
                {items.map((it) => (
                  <details key={it.q} className="rounded-2xl bg-card border border-border p-5 group">
                    <summary className="font-semibold cursor-pointer flex justify-between items-center">{it.q}<span className="text-primary group-open:rotate-45 transition-smooth">+</span></summary>
                    <p className="text-sm text-muted-foreground mt-3">{it.a}</p>
                  </details>
                ))}
              </div>
            </section>
          );
        })}
      </div>
      <Footer />
    </div>
  );
}
