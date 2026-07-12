import { siteName } from "@/lib/cms/seo";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { ProductCard } from "@/components/site/ProductCard";
import { PageHero } from "@/components/site/PageHero";
import { ProductThumb } from "@/components/site/ProductThumb";
import { useSearchResults } from "@/lib/catalog";
import { resolveProductPrice, formatPrice } from "@/lib/product-price";
import { Search, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";
import { z } from "zod";
import { track } from "@/lib/analytics/track";

export const Route = createFileRoute("/search")({
  validateSearch: z.object({ q: z.string().optional() }),
  head: () => ({ meta: [{ title: `Search — ${siteName()}` }] }),
  component: SearchPage,
});

const trending = ["ChatGPT Plus", "Netflix", "Canva Pro", "Spotify", "IPTV", "Office 365"];

function SearchPage() {
  const { q: initial } = Route.useSearch();
  const [q, setQ] = useState(initial ?? "");
  const results = useSearchResults(q);
  useEffect(() => {
    const v = q.trim();
    if (!v) return;
    const t = setTimeout(() => track("search", { search_term: v, results: results.length }), 600);
    return () => clearTimeout(t);
  }, [q, results.length]);

  return (
    <div className="min-h-screen">
      <Header />
      <PageHero title="Search products" subtitle="Find any digital product instantly" crumbs={[{ label: "Home", to: "/" }, { label: "Search" }]} />
      <div className="container mx-auto px-4 py-10">
        <div className="relative max-w-2xl mx-auto">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <input
            autoFocus value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Search ChatGPT, Netflix, Canva, IPTV…"
            className="w-full pl-12 pr-4 py-4 rounded-2xl bg-card border-2 border-border focus:border-primary outline-none text-lg shadow-elegant"
          />
          {q && results.length > 0 && (
            <div className="absolute top-full mt-2 w-full rounded-2xl bg-card border border-border shadow-premium overflow-hidden z-10">
              {results.slice(0, 5).map((p) => {
                const rp = resolveProductPrice(p);
                return (
                  <Link key={p.slug} to="/products/$slug" params={{ slug: p.slug }} className="flex items-center gap-3 p-3 hover:bg-muted">
                    <ProductThumb src={p.thumbnailUrl} emoji={p.emoji} alt={p.name} size={64} />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm truncate">{p.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{p.short}</div>
                    </div>
                    <div className="text-primary font-bold text-sm whitespace-nowrap">
                      {rp.unavailable ? (
                        <span className="text-muted-foreground font-medium">Unavailable</span>
                      ) : (
                        <>
                          {rp.fromLabel && <span className="text-[10px] font-medium text-muted-foreground mr-1">From</span>}
                          {formatPrice(rp.price!)}
                        </>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {!q && (
          <div className="max-w-2xl mx-auto mt-8">
            <h3 className="font-semibold mb-3 flex items-center gap-2"><TrendingUp className="h-4 w-4 text-primary" /> Trending searches</h3>
            <div className="flex flex-wrap gap-2">
              {trending.map((t) => (
                <button key={t} onClick={() => setQ(t)} className="px-4 py-2 rounded-full bg-card border border-border hover:border-primary hover:text-primary text-sm transition-smooth">{t}</button>
              ))}
            </div>
          </div>
        )}

        {q && (
          <div className="mt-10">
            <p className="text-sm text-muted-foreground mb-4">{results.length} result{results.length !== 1 ? "s" : ""} for "{q}"</p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
              {results.map((p) => <ProductCard key={p.slug} product={p} />)}
            </div>
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}
