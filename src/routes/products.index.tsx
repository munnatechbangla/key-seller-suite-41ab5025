import { seoMeta, siteName, canonicalLink } from "@/lib/cms/seo";
import { createFileRoute } from "@tanstack/react-router";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { ProductCard } from "@/components/site/ProductCard";
import { formatPrice } from "@/lib/product-price";
import { useCategories, useProducts, type ProductSort, categoriesQuery, productsQuery } from "@/lib/catalog";
import { useEffect, useState } from "react";
import { Filter, Grid3x3, List } from "lucide-react";

export const Route = createFileRoute("/products/")({
  validateSearch: (search: Record<string, unknown>) => ({
    category: typeof search.category === "string" ? search.category : undefined,
  }),
  head: () => ({
    meta: seoMeta({
      title: "All Digital Products",
      description: "Browse our full catalog of premium digital products.",
      path: "/products",
    }),
    links: [canonicalLink("/products")],
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
  const { category: cat } = Route.useSearch();
  const navigate = Route.useNavigate();
  const [sort, setSort] = useState<ProductSort>("popular");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [maxPriceFilter, setMaxPriceFilter] = useState<number | null>(null);

  const categories = useCategories();
  const selectedCategory = categories.find((category) => category.slug === cat);
  const invalidCategory = Boolean(cat && !selectedCategory);
  const list = useProducts({ categorySlug: cat, sort });

  useEffect(() => {
    setMaxPriceFilter(null);
  }, [cat]);

  const getEffectivePrice = (product: (typeof list)[number]) => {
    const variable = Boolean(product.hasAttributes);
    if (variable && product.priceFrom == null) return Number.POSITIVE_INFINITY;
    const basePrice = variable ? Number(product.priceFrom) : Number(product.price);
    const quantity = Math.max(1, Number(product.minOrderQuantity ?? 1));
    return !variable && quantity > 1 ? basePrice * quantity : basePrice;
  };
  const finitePrices = list.map(getEffectivePrice).filter(Number.isFinite);
  const sliderMax = Math.max(1, Math.ceil(Math.max(0, ...finitePrices)));
  const activeMaxPrice = Math.min(maxPriceFilter ?? sliderMax, sliderMax);
  const priceFilteredList = list.filter((product) => getEffectivePrice(product) <= activeMaxPrice);
  const displayedProducts = [...priceFilteredList].sort((a, b) => {
    if (sort === "price-asc") return getEffectivePrice(a) - getEffectivePrice(b);
    if (sort === "price-desc") return getEffectivePrice(b) - getEffectivePrice(a);
    if (sort === "rating") return b.rating - a.rating;
    if (sort === "popular") return b.reviews - a.reviews;
    return 0;
  });

  return (
    <div className="min-h-screen">
      <Header />
      <div className="bg-gradient-hero text-white">
        <div className="container mx-auto px-4 py-12">
          <div className="text-xs text-white/60 mb-2">Home / {selectedCategory ? `Categories / ${selectedCategory.name}` : "Products"}</div>
          <h1 className="text-3xl sm:text-4xl font-bold">{invalidCategory ? "Category not found" : selectedCategory?.name ?? "All Digital Products"}</h1>
          <p className="text-white/70 mt-2">{invalidCategory ? "This category could not be found." : `${list.length} premium items — instant delivery`}</p>
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
                onClick={() => navigate({ search: (prev) => ({ ...prev, category: undefined }) })}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-smooth ${
                  !cat ? "bg-primary/10 text-primary font-semibold" : "hover:bg-muted"
                }`}
              >
                All products
              </button>
              {categories.map((c) => (
                <button
                  key={c.slug}
                  onClick={() => navigate({ search: (prev) => ({ ...prev, category: c.slug }) })}
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
            <label htmlFor="product-price-range" className="block text-sm text-muted-foreground mb-2">
              Up to {formatPrice(activeMaxPrice)}
            </label>
            <input
              id="product-price-range"
              type="range"
              min={0}
              max={sliderMax}
              step={1}
              value={Math.min(activeMaxPrice, sliderMax)}
              onChange={(event) => setMaxPriceFilter(Number(event.target.value))}
              aria-label="Maximum product price"
              className="w-full accent-[var(--primary)]"
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-2">
              <span>{formatPrice(0)}</span><span>{formatPrice(sliderMax)}+</span>
            </div>
            {maxPriceFilter !== null && maxPriceFilter < sliderMax && (
              <button
                type="button"
                onClick={() => setMaxPriceFilter(null)}
                className="mt-3 text-xs font-medium text-primary hover:underline"
              >
                Clear price filter
              </button>
            )}
          </div>
        </aside>

        <div>
          <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                aria-label="Grid view"
                aria-pressed={viewMode === "grid"}
                className={`h-10 w-10 grid place-items-center rounded-lg ${viewMode === "grid" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
              ><Grid3x3 className="h-4 w-4" /></button>
              <button
                type="button"
                onClick={() => setViewMode("list")}
                aria-label="List view"
                aria-pressed={viewMode === "list"}
                className={`h-10 w-10 grid place-items-center rounded-lg ${viewMode === "list" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
              ><List className="h-4 w-4" /></button>
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

          {displayedProducts.length > 0 ? (
            <div className={viewMode === "grid" ? "grid grid-cols-2 lg:grid-cols-3 gap-5" : "grid grid-cols-1 gap-4"}>
              {displayedProducts.map((p) => <ProductCard key={p.slug} product={p} listingActions viewMode={viewMode} />)}
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-card p-8 text-center text-muted-foreground">
              {maxPriceFilter !== null && priceFilteredList.length === 0
                ? "No products match this price range. Increase the maximum price or clear the filter."
                : invalidCategory ? "The requested category does not exist. Please choose a category from the list." : selectedCategory ? `No published products are currently available in ${selectedCategory.name}.` : "No products are currently available."}
            </div>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
}
