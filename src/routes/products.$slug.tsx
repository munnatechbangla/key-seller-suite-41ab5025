import { seoMeta, canonicalLink, productJsonLd, breadcrumbJsonLd, faqJsonLd, jsonLdScript } from "@/lib/cms/seo";
import { formatDescription } from "@/lib/content-utils";
import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";

const productSearchSchema = z.object({
  variant: fallback(z.string().optional(), undefined).optional(),
});
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { ProductCard } from "@/components/site/ProductCard";
import { FrequentlyBoughtTogether } from "@/components/site/FrequentlyBoughtTogether";
import { Breadcrumbs } from "@/components/site/PageHero";
import { ReviewsSection } from "@/components/site/ReviewsSection";
import { LiveVisitorsCounter } from "@/components/site/LiveVisitorsCounter";
import { SaleBadges } from "@/components/site/SaleBadges";
import { ShareButtons } from "@/components/site/ShareButtons";
import { StickyBuyBar } from "@/components/site/StickyBuyBar";
import { productQuery, relatedQuery, productsBySlugsQuery, useProduct, useRelated, useProductsBySlugs } from "@/lib/catalog";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState, useMemo, useRef } from "react";
import { validateSMMQuantity, calculateSMMPrice } from "@/lib/catalog";
import { 
  Star, ShoppingCart, Zap, ShieldCheck, Heart, Share2, 
  ChevronRight, ChevronLeft, Minus, Plus, Info, Check, 
  Image as ImageIcon, GitCompare, Truck, Lock, Package, Shield
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ProductThumb } from "@/components/site/ProductThumb";
import { reviewsQuery } from "@/lib/reviews";
import { useCart, useWishlist, useCompare, useRecent } from "@/lib/stores";
import { VariantSelector } from "@/components/site/VariantSelector";
import { ProductCustomFields, type ProductCustomFieldsHandle } from "@/components/site/ProductCustomFields";
import type { ProductVariant } from "@/lib/product-variants.functions";
import { listProductAttributesFn } from "@/lib/product-variants.functions";
import { toast } from "sonner";
import { track } from "@/lib/analytics/track";
import { productLayoutPublicResolveFn } from "@/lib/product-layouts.functions";
import { ProductLayoutRenderer, type ProductLayoutSection } from "@/components/cms/ProductLayoutRenderer";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useSettings } from "@/lib/cms/settings";
import { productBlocksPublicFn } from "@/lib/product-blocks.functions";
import { ProductContentBlocks, type ProductBlock } from "@/components/cms/ProductContentBlocks";
import { useCurrency, usePriceFormatter } from "@/lib/currency";

export const Route = createFileRoute("/products/$slug")({
  validateSearch: zodValidator(productSearchSchema),
  loader: async ({ params, context }) => {
    // We need currency code for head metadata, but useSettings is a hook.
    // In TanStack Start loader context, we don't have easy access to Zustand store state without mounting.
    // However, the head() function can access loaderData.
    const product = await context.queryClient.ensureQueryData(productQuery(params.slug));
    if (!product) throw notFound();
    context.queryClient.ensureQueryData(relatedQuery(params.slug, 4));
    const reviews = await context.queryClient.ensureQueryData(reviewsQuery(product.id));
    
    // Fetch settings directly from Supabase for the loader if needed, 
    // or just pass a default since SEO currency is usually just for schema.
    // To keep it simple and reactive, we'll try to get it from the store if possible,
    // but head() runs during SSR where the store might not be hydrated.
    return { product, reviews };
  },
  head: ({ loaderData, params }) => {
    const p = loaderData?.product;
    const reviews = loaderData?.reviews ?? [];
    const path = `/products/${params.slug}`;
    
    // We can't use hooks here. We'll use a default or try to pass it through loaderData if we really need it to be dynamic for SEO.
    const settings = useSettings.getState().settings;
    const currencyCode = settings.payment.currency || "USD";

    if (!p) return { meta: seoMeta({ path }) };
    const seo = p.seo ?? null;
    const scripts: Array<{ type: string; children: string }> = [];
    if (seo?.schema_enabled !== false) {
      if (seo?.product_schema_enabled !== false) {
        scripts.push(jsonLdScript(productJsonLd({
          name: p.name,
          slug: p.slug,
          description: seo?.meta_description || p.short || p.description || null,
          image: seo?.og_image || p.thumbnailUrl || null,
          price: p.price,
          oldPrice: p.oldPrice,
          rating: p.rating,
          reviews: p.reviews,
          category: p.categoryName ?? p.category,
          inStock: (p.stock ?? 1) > 0,
          reviewSamples: reviews.slice(0, 5).map((r) => ({
            author: r.display_name || "Verified Customer",
            rating: r.rating,
            title: r.title,
            body: r.body,
            createdAt: r.created_at,
          })),
        })));
      }
      if (seo?.breadcrumb_schema_enabled !== false) {
        scripts.push(jsonLdScript(breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Products", path: "/products" },
          { name: p.name, path },
        ])));
      }
      if (seo?.faq_schema_enabled !== false && p.faqs && p.faqs.length) {
        scripts.push(jsonLdScript(faqJsonLd(p.faqs)));
      }
    }
    const meta = seoMeta({
      title: seo?.meta_title || p.name,
      description: seo?.meta_description || p.short || undefined,
      ogTitle: seo?.og_title || undefined,
      ogType: "product",
      image: seo?.og_image || p.thumbnailUrl || undefined,
      path,
      noindex: seo?.robots ? /noindex/i.test(seo.robots) : false,
    });
    if (seo?.og_description) {
      const idx = meta.findIndex((m) => (m as any).property === "og:description");
      if (idx >= 0) meta[idx] = { property: "og:description", content: seo.og_description };
    }
    if (seo?.twitter_title) meta.push({ name: "twitter:title", content: seo.twitter_title });
    if (seo?.twitter_description) meta.push({ name: "twitter:description", content: seo.twitter_description });
    if (seo?.twitter_image) meta.push({ name: "twitter:image", content: seo.twitter_image });
    meta.push(
      { property: "product:price:amount", content: p.price.toFixed(2) },
      { property: "product:price:currency", content: (p as any).currency_code || (p as any).currency || currencyCode },
      { property: "og:price:amount", content: p.price.toFixed(2) },
      { property: "og:price:currency", content: (p as any).currency_code || (p as any).currency || currencyCode },
      { property: "product:availability", content: (p.stock ?? 1) > 0 ? "in stock" : "out of stock" },
    );
    const canonicalHref = seo?.canonical_url || undefined;
    return {
      meta,
      links: [canonicalHref ? { rel: "canonical" as const, href: canonicalHref } : canonicalLink(path)],
      scripts,
    };
  },
  component: ProductPage,
  notFoundComponent: () => (
    <div className="min-h-screen grid place-items-center p-8 text-center">
      <div>
        <h1 className="text-2xl font-bold mb-2">Product not found</h1>
        <Link to="/products" className="text-primary underline">Browse all products</Link>
      </div>
    </div>
  ),
  errorComponent: () => <div className="p-8">Something went wrong.</div>,
});

function ProductPage() {
  const { slug } = Route.useParams();
  const product = useProduct(slug)!;
  const { code: currencyCode } = useCurrency();

  // Phase 4.3A: if this product resolves to a dynamic Product Layout, render it.
  const resolveLayout = useServerFn(productLayoutPublicResolveFn);
  const layoutQuery = useQuery({
    queryKey: ["product-layout-resolve", product.id],
    queryFn: () => resolveLayout({ data: { product_id: product.id } }),
    staleTime: 60_000,
  });
  const dynamicLayout = layoutQuery.data as { layout: any; sections: ProductLayoutSection[] } | null | undefined;

  const push = useRecent((s) => s.push);
  useEffect(() => { push(product.slug); }, [product.slug, push]);
  useEffect(() => {
    track("view_item", {
      currency: currencyCode,
      value: product.price,
      items: [{ item_id: product.slug, item_name: product.name, price: product.price, item_category: product.category }],
    });
  }, [product.slug, product.price, product.name, product.category]);

  if (dynamicLayout && dynamicLayout.sections?.length) {
    return (
      <div className="min-h-screen">
        <Header />
        <ProductLayoutRenderer product={product} sections={dynamicLayout.sections} />
        <Footer />
      </div>
    );
  }

  return <LegacyProductPage />;
}

function LegacyProductPage() {
  const { slug } = Route.useParams();
  const product = useProduct(slug)!;
  const formatPrice = usePriceFormatter();
  const related = useRelated(slug, 4);
  const [qty, setQty] = useState(1);
  const [smmQty, setSmmQty] = useState<number>(0);

  useEffect(() => {
    if (product?.product_type === "smm_service" && product.smm_config) {
      setSmmQty(Number(product.smm_config.min_quantity || 1));
    }
  }, [product]);

  const smmPrice = useMemo(() => {
    if (product?.product_type === "smm_service" && product.smm_config) {
      return calculateSMMPrice(smmQty, product.smm_config);
    }
    return 0;
  }, [product, smmQty]);
  const [tab, setTab] = useState<"desc" | "specs" | "reviews" | "faq">("desc");
  const [activeVariant, setActiveVariant] = useState<ProductVariant | null>(null);
  const fetchAttrs = useServerFn(listProductAttributesFn);
  const attrsProbe = useQuery({
    queryKey: ["variant-attrs", product.id],
    queryFn: () => fetchAttrs({ data: { productId: product.id } }),
    staleTime: 60_000,
  });
  const hasAttrs = !!product.hasAttributes || (attrsProbe.data?.length ?? 0) > 0;
  const cart = useCart();
  const wish = useWishlist();
  const cmp = useCompare();
  const recent = useRecent((s) => s.slugs);

  // Phase 4.3B: dynamic Rich Content blocks — falls back to static description when none.
  const fetchBlocks = useServerFn(productBlocksPublicFn);
  const blocksQuery = useQuery({
    queryKey: ["product-content-blocks", product.id],
    queryFn: () => fetchBlocks({ data: { product_id: product.id } }),
    staleTime: 60_000,
  });
  const richBlocks = (blocksQuery.data ?? []) as ProductBlock[];


  const off = product.oldPrice ? Math.round((1 - product.price / product.oldPrice) * 100) : 0;
  const recentSlugs = recent.filter((s) => s !== product.slug).slice(0, 4);
  const recentProducts = useProductsBySlugs(recentSlugs);

  const customFieldsRef = useRef<ProductCustomFieldsHandle | null>(null);
  const validateCustomFields = () => customFieldsRef.current?.validate() ?? true;
  const guardCustomFields = () => {
    if (!validateCustomFields()) { toast.error("Please complete the product details"); return false; }
    return true;
  };
  const addToCart = () => {
    if (!guardCustomFields()) return;
    
    if (product.product_type === "smm_service") {
      const validation = validateSMMQuantity(smmQty, product.smm_config);
      if (!validation.valid) {
        toast.error(validation.error);
        return;
      }
      cart.add(product, 1, undefined, product.smm_config, smmQty);
      toast.success("Added SMM service to cart");
      return;
    }
    
    cart.add(product, qty, activeVariant ? {
      variant_id: activeVariant.id,
      variant_name: activeVariant.name,
      price: Number(activeVariant.price),
      sale_price: activeVariant.sale_price ? Number(activeVariant.sale_price) : null,
      sku: activeVariant.sku || null,
      thumbnail_url: activeVariant.thumbnail_url || null,
      license_pool_id: activeVariant.license_pool_id || null,
      delivery_type: activeVariant.delivery_type || null,
      inventory_pool_id: activeVariant.inventory_pool_id || null,
      subscription_pool_id: activeVariant.subscription_pool_id || null,
      selected_attributes: activeVariant.attributes || {}
    } : undefined);
    toast.success("Added to cart");
  };
  const navigate = useNavigate();
  const buyNow = () => {
    if (!guardCustomFields()) return;
    
    if (product.product_type === "smm_service") {
      const validation = validateSMMQuantity(smmQty, product.smm_config);
      if (!validation.valid) {
        toast.error(validation.error);
        return;
      }
      cart.add(product, 1, undefined, product.smm_config, smmQty);
    } else {
      cart.add(product, qty, activeVariant ? {
        variant_id: activeVariant.id,
        variant_name: activeVariant.name,
        price: Number(activeVariant.price),
        sale_price: activeVariant.sale_price ? Number(activeVariant.sale_price) : null,
        sku: activeVariant.sku || null,
        thumbnail_url: activeVariant.thumbnail_url || null,
        license_pool_id: activeVariant.license_pool_id || null,
        delivery_type: activeVariant.delivery_type || null,
        inventory_pool_id: activeVariant.inventory_pool_id || null,
        subscription_pool_id: activeVariant.subscription_pool_id || null,
        selected_attributes: activeVariant.attributes || {}
      } : undefined);
    }
    navigate({ to: "/checkout" });
  };

  // Gallery images (public read on product_images)
  const galleryQuery = useQuery({
    queryKey: ["product-gallery", product.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_images")
        .select("id, url, alt, is_primary, sort_order")
        .eq("product_id", product.id)
        .order("is_primary", { ascending: false })
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as { id: string; url: string; alt: string | null; is_primary: boolean; sort_order: number }[];
    },
    staleTime: 60_000,
  });
  const galleryImages = galleryQuery.data ?? [];
  const featuredImage =
    galleryImages.find((g) => g.is_primary)?.url ??
    galleryImages[0]?.url ??
    product.thumbnailUrl ??
    null;
  const [activeImage, setActiveImage] = useState<string | null>(null);
  useEffect(() => { setActiveImage(null); }, [product.id]);
  // Resolve active variant thumbnail if present, fallback to gallery/featured
  const variantThumb = activeVariant?.thumbnail_url;
  const heroImage = activeImage ?? variantThumb ?? featuredImage;

  return (
    <div className="min-h-screen">
      <Header />
      <div className="bg-gradient-hero text-white">
        <div className="container mx-auto px-4 py-6">
          <Breadcrumbs items={[{ label: "Home", to: "/" }, { label: "Products", to: "/products" }, { label: product.name }]} />
        </div>
      </div>

      <div className="container mx-auto px-4 py-10 grid grid-cols-[minmax(0,1fr)] lg:grid-cols-2 gap-10">
        <div className="min-w-0 space-y-4">
          <div className="relative aspect-square rounded-3xl bg-gradient-to-br from-primary/15 via-secondary/15 to-accent/15 grid place-items-center overflow-hidden shadow-elegant">
            <ProductThumb
              src={heroImage}
              emoji={product.emoji}
              alt={activeVariant?.name || product.name}
              size={800}
              className="h-full w-full object-cover animate-fade-in bg-transparent"
            />
            {product.badge && (
              <span className="absolute top-4 left-4 px-3 py-1.5 rounded-full text-xs font-bold bg-gradient-primary text-primary-foreground shadow-elegant">
                {product.badge}
              </span>
            )}
            {off > 0 && (
              <span className="absolute top-4 right-4 px-3 py-1.5 rounded-full text-xs font-bold bg-accent text-accent-foreground">
                -{off}% OFF
              </span>
            )}
          </div>
          {galleryImages.length > 0 ? (
            <div className="grid grid-cols-4 gap-3">
              {galleryImages.slice(0, 8).map((img) => {
                const isActive = (activeImage ?? featuredImage) === img.url;
                return (
                  <button
                    key={img.id}
                    type="button"
                    onClick={() => setActiveImage(img.url)}
                    className={cn(
                      "aspect-square rounded-xl overflow-hidden bg-card border transition-smooth",
                      isActive ? "border-primary ring-2 ring-primary/40" : "border-border hover:border-primary"
                    )}
                  >
                    <ProductThumb
                      src={img.url}
                      emoji={product.emoji}
                      alt={img.alt ?? product.name}
                      size={200}
                      className="w-full h-full object-cover"
                    />
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-3">
              {[product.emoji, "✨", "🔐", "⚡"].map((e, i) => (
                <div key={i} className="aspect-square rounded-xl bg-card border border-border grid place-items-center text-4xl">{e}</div>
              ))}
            </div>
          )}
        </div>

        <div className="min-w-0 space-y-5">
          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2">{product.category.replace("-", " ")}</div>
            <h1 className="text-3xl sm:text-4xl font-bold leading-tight">{product.name}</h1>
            <div className="flex items-center gap-3 mt-3 text-sm">
              <div className="flex items-center gap-1">
                {[...Array(5)].map((_, i) => <Star key={i} className={`h-4 w-4 ${i < Math.floor(product.rating) ? "fill-accent text-accent" : "text-muted"}`} />)}
                <span className="font-semibold ml-1">{product.rating}</span>
              </div>
              <span className="text-muted-foreground">({product.reviews.toLocaleString()} reviews)</span>
              <span className="text-emerald-600 font-medium inline-flex items-center gap-1"><Check className="h-4 w-4" /> In stock</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <SaleBadges product={product} extra={{ stock: product.stock ?? null, salesCount: (product as any).salesCount ?? null, createdAt: (product as any).createdAt ?? null }} max={4} />
            <LiveVisitorsCounter surface="product" seed={product.slug} />
          </div>


          {hasAttrs ? (
            <VariantSelector
              product={product}
              onVariantChange={setActiveVariant}
              beforeAdd={validateCustomFields}
              beforeButtons={<ProductCustomFields ref={customFieldsRef} productSlug={product.slug} />}
            />
          ) : product.product_type === "smm_service" ? (
            <>
              <div className="rounded-2xl bg-gradient-to-br from-primary/5 to-secondary/5 border border-primary/20 p-5 space-y-4">
                <div className="flex items-end justify-between gap-4 flex-wrap">
                  <div>
                    <div className="text-sm font-medium text-muted-foreground mb-1">Total Price</div>
                    <div className="text-4xl font-bold text-primary">{formatPrice(smmPrice)}</div>
                    {product.smm_config?.pricing_mode === 'per_1000' && (
                      <div className="text-xs text-muted-foreground mt-1">
                        Rate: {formatPrice(Number(product.smm_config.price || 0))} per 1,000
                      </div>
                    )}
                  </div>
                  <div className="inline-flex items-center gap-2 text-sm font-semibold text-accent">
                    <Zap className="h-4 w-4" /> {product.delivery} delivery
                  </div>
                </div>

                <div className="pt-4 border-t border-primary/10">
                  <label className="block text-sm font-bold text-foreground mb-2">
                    Enter Quantity ({product.smm_config?.min_quantity || 1} - {product.smm_config?.max_quantity || 'Max'})
                  </label>
                  <div className="flex gap-3">
                    <div className="relative flex-1">
                      <input
                        type="number"
                        value={smmQty}
                        onChange={(e) => setSmmQty(Number(e.target.value))}
                        min={product.smm_config?.min_quantity || 1}
                        max={product.smm_config?.max_quantity}
                        step={product.smm_config?.quantity_step || 1}
                        className="w-full h-11 px-4 rounded-xl border border-border bg-card focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-semibold"
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground pointer-events-none">
                        UNITS
                      </div>
                    </div>
                  </div>
                  {product.smm_config?.quantity_step > 1 && (
                    <p className="text-[10px] text-muted-foreground mt-1.5 uppercase tracking-wider font-bold">
                      Step: {product.smm_config.quantity_step} units
                    </p>
                  )}
                </div>
              </div>

              <ProductCustomFields ref={customFieldsRef} productSlug={product.slug} />

              <div className="flex gap-3 flex-wrap items-center">
                <button onClick={addToCart} className="min-w-0 flex-1 inline-flex items-center justify-center gap-2 h-11 px-4 sm:px-5 rounded-xl bg-card border border-primary text-primary font-semibold hover:bg-primary/5 transition-smooth">
                  <ShoppingCart className="h-4 w-4" /> Add to Cart
                </button>
                <button onClick={buyNow} className="min-w-0 flex-1 inline-flex items-center justify-center gap-2 h-11 px-4 sm:px-5 rounded-xl bg-gradient-primary text-primary-foreground font-semibold shadow-glow hover:opacity-95 transition-smooth">
                  <Zap className="h-4 w-4" /> Buy Now
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="rounded-2xl bg-gradient-to-br from-primary/5 to-secondary/5 border border-primary/20 p-5 flex items-end gap-4 flex-wrap">
                <div>
                  <div className="text-4xl font-bold text-primary">{formatPrice(product.price)}</div>
                  {product.oldPrice && (
                    <div className="flex gap-2 items-center mt-1">
                      <span className="text-sm text-muted-foreground line-through">{formatPrice(product.oldPrice)}</span>
                      <span className="text-xs font-bold text-accent">Save {formatPrice(product.oldPrice - product.price)}</span>
                    </div>
                  )}
                </div>
                <div className="sm:ml-auto inline-flex min-w-0 items-center gap-2 text-sm font-semibold text-accent">
                  <Zap className="h-4 w-4" /> {product.delivery} delivery
                </div>
              </div>

              <ul className="space-y-2">
                {product.features?.slice(0, 4).map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <Check className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" /> {f}
                  </li>
                ))}
              </ul>

              <ProductCustomFields ref={customFieldsRef} productSlug={product.slug} />

              <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 sm:flex sm:flex-wrap sm:items-center">
                <div className="inline-flex items-center rounded-xl border border-border bg-card">
                  <button onClick={() => setQty(Math.max(1, qty - 1))} className="w-10 h-11 grid place-items-center hover:bg-muted rounded-l-xl">−</button>
                  <span className="w-10 text-center font-semibold">{qty}</span>
                  <button onClick={() => setQty(qty + 1)} className="w-10 h-11 grid place-items-center hover:bg-muted rounded-r-xl">+</button>
                </div>
                <button onClick={addToCart} className="min-w-0 flex-1 inline-flex items-center justify-center gap-2 h-11 px-4 sm:px-5 rounded-xl bg-card border border-primary text-primary font-semibold hover:bg-primary/5 transition-smooth">
                  <ShoppingCart className="h-4 w-4" /> Add to Cart
                </button>
                <button onClick={buyNow} className="col-span-2 sm:col-span-1 min-w-0 flex-1 inline-flex items-center justify-center gap-2 h-11 px-4 sm:px-5 rounded-xl bg-gradient-primary text-primary-foreground font-semibold shadow-glow hover:opacity-95 transition-smooth">
                  <Zap className="h-4 w-4" /> Buy Now
                </button>
              </div>
            </>
          )}



          <div className="flex min-w-0 gap-2 flex-wrap text-sm">
            <button onClick={() => { wish.toggle(product.slug); toast(wish.has(product.slug) ? "Removed from wishlist" : "Added to wishlist"); }} className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border ${wish.has(product.slug) ? "bg-accent/10 border-accent text-accent" : "border-border hover:bg-muted"}`}>
              <Heart className={`h-4 w-4 ${wish.has(product.slug) ? "fill-accent" : ""}`} /> Wishlist
            </button>
            <button onClick={() => { cmp.toggle(product.slug); toast(cmp.has(product.slug) ? "Removed from compare" : "Added to compare"); }} className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border ${cmp.has(product.slug) ? "bg-primary/10 border-primary text-primary" : "border-border hover:bg-muted"}`}>
              <GitCompare className="h-4 w-4" /> Compare
            </button>
            <div className="min-w-0 sm:ml-auto">
              <ShareButtons
                path={`/products/${product.slug}`}
                title={product.name}
                description={product.short ?? undefined}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 pt-4 border-t border-border">
            {[{ Icon: Truck, t: "Instant Delivery" }, { Icon: Shield, t: "Full Warranty" }, { Icon: Lock, t: "Secure Payment" }].map((b) => (
              <div key={b.t} className="text-center text-xs">
                <b.Icon className="h-5 w-5 text-primary mx-auto mb-1" />
                <div className="font-semibold">{b.t}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 pb-12">
        <div className="flex gap-1 border-b border-border overflow-x-auto">
          {(["desc", "specs", "reviews", "faq"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-5 py-3 text-sm font-semibold whitespace-nowrap border-b-2 transition-smooth ${tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              {{ desc: "Description", specs: "Specifications", reviews: "Reviews", faq: "FAQ" }[t]}
            </button>
          ))}
        </div>

        <div className="py-8">
          {tab === "desc" && (
            richBlocks.length > 0 ? (
              <ProductContentBlocks blocks={richBlocks} product={product} />
            ) : (
              <div className="grid md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <div 
                    className="text-muted-foreground leading-relaxed prose prose-sm max-w-none dark:prose-invert"
                    dangerouslySetInnerHTML={{ __html: formatDescription(product.description || "") }}
                  />
                  <h3 className="font-semibold mt-6">Key features</h3>
                  <ul className="space-y-2">
                    {product.features?.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm"><Check className="h-4 w-4 text-emerald-600 mt-0.5" /> {f}</li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-2xl bg-card border border-border p-6 space-y-3">
                  <h3 className="font-semibold flex items-center gap-2"><Package className="h-4 w-4 text-primary" /> What's included</h3>
                  <ul className="space-y-2">
                    {product.included?.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm"><Check className="h-4 w-4 text-primary mt-0.5" /> {f}</li>
                    ))}
                  </ul>
                  <h3 className="font-semibold flex items-center gap-2 pt-3 border-t border-border"><Truck className="h-4 w-4 text-primary" /> Delivery info</h3>
                  <p className="text-sm text-muted-foreground">Delivered in {product.delivery} after payment confirmation, sent directly to your email.</p>
                </div>
              </div>
            )
          )}
          {tab === "specs" && (
            <div className="rounded-2xl bg-card border border-border overflow-hidden max-w-2xl">
              {Object.entries(product.specs ?? {}).map(([k, v], i) => (
                <div key={k} className={`grid grid-cols-2 px-5 py-3 text-sm ${i % 2 ? "bg-muted/40" : ""}`}>
                  <span className="font-semibold">{k}</span>
                  <span className="text-muted-foreground">{v}</span>
                </div>
              ))}
            </div>
          )}
          {tab === "reviews" && <ReviewsSection productId={product.id} />}
          {tab === "faq" && (
            <div className="space-y-3 max-w-3xl">
              {product.faqs?.map((f) => (
                <details key={f.q} className="rounded-2xl bg-card border border-border p-5 group">
                  <summary className="font-semibold cursor-pointer flex justify-between items-center">{f.q}<span className="text-primary group-open:rotate-45 transition-smooth">+</span></summary>
                  <p className="text-sm text-muted-foreground mt-3">{f.a}</p>
                </details>
              ))}
            </div>
          )}
        </div>

        <FrequentlyBoughtTogether
          current={product}
          candidates={related}
          currentVariant={activeVariant}
          currentHasAttributes={hasAttrs || !!product.hasAttributes}
        />

        <section className="mt-12">
          <h2 className="text-2xl font-bold mb-5">Related products</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
            {related.map((p) => <ProductCard key={p.slug} product={p} />)}
          </div>
        </section>

        {recentProducts.length > 0 && (
          <section className="mt-12">
            <h2 className="text-2xl font-bold mb-5">Recently viewed</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
              {recentProducts.map((p) => p && <ProductCard key={p.slug} product={p} />)}
            </div>
          </section>
        )}
      </div>
      <Footer />
      <StickyBuyBar product={product} variant={activeVariant} hasAttributes={hasAttrs} />
    </div>
  );
}
