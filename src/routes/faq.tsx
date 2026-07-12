import { siteName } from "@/lib/cms/seo";
import { createFileRoute } from "@tanstack/react-router";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { PageHero } from "@/components/site/PageHero";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { usePage } from "@/lib/cms/pages/hooks";
import type { FaqGroup } from "@/lib/cms/pages/schemas";

export const Route = createFileRoute("/faq")({
  head: () => ({ meta: [{ title: `FAQ — ${siteName()}` }] }),
  component: FAQ,
});

function FAQ() {
  const [q, setQ] = useState("");
  const { content } = usePage("faq");

  // Derive groups from either new (categories+items) or legacy (faq_groups) shape.
  const groups: FaqGroup[] = useMemo(() => {
    if (content.categories && content.categories.length > 0 && content.items && content.items.length > 0) {
      return content.categories.map((c) => ({
        name: c.name,
        items: content.items!.filter((i) => i.category_id === c.id).map((i) => ({ q: i.q, a: i.a })),
      })).filter((g) => g.items.length > 0);
    }
    return content.faq_groups ?? [];
  }, [content]);

  return (
    <div className="min-h-screen">
      <Header />
      <PageHero title={content.hero.title} subtitle={content.hero.subtitle} crumbs={[{ label: "Home", to: "/" }, { label: "FAQ" }]} />
      <div className="container mx-auto px-4 py-12 max-w-3xl space-y-8">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={content.search_placeholder} className="w-full pl-12 pr-4 py-3 rounded-2xl bg-card border border-border outline-none focus:border-primary" />
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
