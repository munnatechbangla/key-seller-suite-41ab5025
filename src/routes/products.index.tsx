import { seoMeta, siteName } from "@/lib/cms/seo";
import { createFileRoute } from "@tanstack/react-router";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { ProductCard } from "@/components/site/ProductCard";
import { useCategories, useProducts, type ProductSort, categoriesQuery, productsQuery } from "@/lib/catalog";
import { useState } from "react";
import { Filter, Grid3x3, List } from "lucide-react";

export const Route = createFileRoute("/products/")({
  head: () => ({
    meta: [
      { title: "All Digital Products — TopupHut" },
      { name: "description", content: "Browse our full catalog of premium digital products: ChatGPT, Netflix, Canva, Spotify, software keys, gift cards & more." },
      { property: "og:title", content: "Shop All Products — TopupHut" },
      { property: "og:description", content: "Premium digital products at the best prices." },
    ],
  }),
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(categoriesQuery());
    context.queryClient.ensureQueryData(productsQuery({ sort: "popular" }));
  },
  component: ProductsPage,
  errorComponent: () => <div className="p-8 text-center">Failed to load products.</div>,
  notFoundComponent: () => <div className="p-8 text-center">Not found.</div>,
});

function ProductsPage() {
  const [cat, setCat] = useState<string | null>(null);
  const [sort, setSort] = useState<ProductSort>("popular");

  const categories = useCategories();
  const list = useProducts({ categorySlug: cat, sort });

  return (
    <div className="min-h-screen">
      <Header />
      <div className="bg-gradient-hero text-white">
        <div className="container mx-auto px-4 py-12">
          <div className="text-xs text-white/60 mb-2">Home / Products</div>
          <h1 className="text-3xl sm:text-4xl font-bold">All Digital Products</h1>
          <p className="text-white/70 mt-2">{list.length} premium items — instant delivery</p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-10 grid lg:grid-cols-[260px_1fr] gap-8">
        <aside className="space-y-6">
          <div className="rounded-2xl bg-card border border-border p-5">
            <div className="flex items-center gap-2 font-semibold mb-4">
              <Filter className="h-4 w-4 text-primary" /> Categories
            </div>
            <div className="space-y-1">
              <button
                onClick={() => setCat(null)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-smooth ${
                  !cat ? "bg-primary/10 text-primary font-semibold" : "hover:bg-muted"
                }`}
              >
                All products
              </button>
              {categories.map((c) => (
                <button
                  key={c.slug}
                  onClick={() => setCat(c.slug)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2 transition-smooth ${
                    cat === c.slug ? "bg-primary/10 text-primary font-semibold" : "hover:bg-muted"
                  }`}
                >
                  <span>{c.emoji}</span> {c.name}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl bg-card border border-border p-5">
            <div className="font-semibold mb-3">Price range</div>
            <input type="range" min={0} max={100} defaultValue={50} className="w-full accent-[var(--primary)]" />
            <div className="flex justify-between text-xs text-muted-foreground mt-2">
              <span>$0</span><span>$100+</span>
            </div>
          </div>
        </aside>

        <div>
          <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
            <div className="flex gap-1">
              <button className="h-10 w-10 grid place-items-center rounded-lg bg-primary text-primary-foreground"><Grid3x3 className="h-4 w-4" /></button>
              <button className="h-10 w-10 grid place-items-center rounded-lg hover:bg-muted"><List className="h-4 w-4" /></button>
            </div>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as ProductSort)}
              className="px-3 py-2 rounded-lg bg-card border border-border text-sm outline-none focus:border-primary"
            >
              <option value="popular">Most popular</option>
              <option value="price-asc">Price: low to high</option>
              <option value="price-desc">Price: high to low</option>
              <option value="rating">Top rated</option>
            </select>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-3 gap-5">
            {list.map((p) => <ProductCard key={p.slug} product={p} />)}
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
