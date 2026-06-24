import { createFileRoute, Link } from "@tanstack/react-router";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { PageHero } from "@/components/site/PageHero";
import { useCompare, useCart } from "@/lib/stores";
import { useProductsBySlugs, type Product } from "@/lib/catalog";
import { X, Check, ShoppingCart, GitCompare } from "lucide-react";

export const Route = createFileRoute("/compare")({
  head: () => ({ meta: [{ title: "Compare Products — TopupHut" }] }),
  component: ComparePage,
});

function ComparePage() {
  const cmp = useCompare();
  const cart = useCart();
  const items = useProductsBySlugs(cmp.slugs);

  return (
    <div className="min-h-screen">
      <Header />
      <PageHero title="Compare products" subtitle={`${items.length} items selected`} crumbs={[{ label: "Home", to: "/" }, { label: "Compare" }]} />
      <div className="container mx-auto px-4 py-10">
        {items.length === 0 ? (
          <div className="text-center py-16">
            <GitCompare className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Nothing to compare yet</h2>
            <p className="text-muted-foreground mb-5">Add products to compare side by side.</p>
            <Link to="/products" className="px-5 py-2.5 rounded-xl bg-gradient-primary text-primary-foreground font-semibold">Browse products</Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] border-separate border-spacing-0">
              <thead>
                <tr>
                  <th className="w-40 text-left text-sm text-muted-foreground p-3"></th>
                  {items.map((p) => p && (
                    <th key={p.slug} className="p-3 text-center">
                      <div className="rounded-2xl bg-card border border-border p-4 relative">
                        <button onClick={() => cmp.remove(p.slug)} className="absolute top-2 right-2 h-7 w-7 grid place-items-center rounded-lg hover:bg-muted"><X className="h-4 w-4" /></button>
                        <div className="text-5xl mb-2">{p.emoji}</div>
                        <Link to="/products/$slug" params={{ slug: p.slug }} className="font-semibold text-sm hover:text-primary line-clamp-2">{p.name}</Link>
                        <div className="text-primary font-bold mt-1">${p.price}</div>
                        <button onClick={() => cart.add(p)} className="mt-3 w-full py-2 rounded-lg bg-gradient-primary text-primary-foreground text-xs font-semibold inline-flex items-center justify-center gap-1">
                          <ShoppingCart className="h-3.5 w-3.5" /> Add
                        </button>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const rows: { label: string; fn: (p: Product) => string }[] = [
                    { label: "Price", fn: (p) => `$${p.price}` },
                    { label: "Rating", fn: (p) => `${p.rating} ★ (${p.reviews})` },
                    { label: "Delivery", fn: (p) => p.delivery },
                    { label: "Category", fn: (p) => p.category },
                    ...Object.keys(items[0]!.specs ?? {}).map((k) => ({ label: k, fn: (p: import("@/lib/catalog").Product) => p.specs?.[k] ?? "—" })),
                  ];
                  return rows.map((row, i) => (
                    <tr key={row.label} className={i % 2 ? "bg-muted/30" : ""}>
                      <td className="p-3 text-sm font-semibold">{row.label}</td>
                      {items.map((p) => p && <td key={p.slug} className="p-3 text-sm text-center text-muted-foreground">{row.fn(p)}</td>)}
                    </tr>
                  ));
                })()}
                <tr>
                  <td className="p-3 text-sm font-semibold">Features</td>
                  {items.map((p) => p && (
                    <td key={p.slug} className="p-3 text-xs">
                      <ul className="space-y-1">
                        {p.features?.slice(0, 4).map((f) => <li key={f} className="flex gap-1.5"><Check className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />{f}</li>)}
                      </ul>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}
