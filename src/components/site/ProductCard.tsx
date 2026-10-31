import { Link } from "@tanstack/react-router";
import { Star, ShoppingCart, Zap, Heart, Eye } from "lucide-react";
import type { Product } from "@/lib/catalog";
import { useCart, useWishlist } from "@/lib/stores";
import { formatPrice } from "@/lib/product-price";
import { SaleBadges } from "@/components/site/SaleBadges";
import { useMarketplace } from "@/lib/cms/marketplace";
import { toast } from "sonner";
import { useState, useEffect, lazy, Suspense } from "react";
import { useResolvedMediaUrl } from "@/lib/cms/site-logo";
import { supabase } from "@/integrations/supabase/client";
import { resolveStoredUrlAsync } from "@/lib/media/resolve";

const QuickViewModal = lazy(() =>
  import("@/components/site/QuickViewModal").then((m) => ({ default: m.QuickViewModal })),
);


export function ProductCard({ product, listingActions = false, viewMode = "grid" }: { product: Product; listingActions?: boolean; viewMode?: "grid" | "list" }) {
  const { url: thumbnailSrc, loading: thumbnailLoading } = useResolvedMediaUrl(product.thumbnailUrl);
  const [thumbnailFailed, setThumbnailFailed] = useState(false);
  const [thumbnailLoaded, setThumbnailLoaded] = useState(false);
  const [thumbnailFallbackSrc, setThumbnailFallbackSrc] = useState<string | null>(null);
  const [thumbnailFallbackTried, setThumbnailFallbackTried] = useState(false);
  const displayThumbnailSrc = thumbnailFallbackSrc ?? thumbnailSrc;
  useEffect(() => {
    setThumbnailFailed(false);
    setThumbnailLoaded(false);
    setThumbnailFallbackSrc(null);
    setThumbnailFallbackTried(false);
  }, [product.id, product.thumbnailUrl, thumbnailSrc]);
  const handleThumbnailError = async () => {
    setThumbnailLoaded(false);
    if (thumbnailFallbackTried) {
      setThumbnailFailed(true);
      return;
    }
    setThumbnailFallbackTried(true);
    try {
      const { data } = await supabase
        .from("product_images")
        .select("url")
        .eq("product_id", product.id)
        .order("is_primary", { ascending: false })
        .order("sort_order", { ascending: true })
        .limit(4);
      for (const image of data ?? []) {
        const url = await resolveStoredUrlAsync(image.url);
        if (url && url !== thumbnailSrc) {
          setThumbnailFallbackSrc(url);
          return;
        }
      }
    } catch {
      // Keep the visual fallback if the gallery cannot be resolved.
    }
    setThumbnailFailed(true);
  };
  const isVariable = !!product.hasAttributes;
  const hasVariantPrice = product.priceFrom != null && product.priceFrom > 0;
  const displayPrice = isVariable ? (hasVariantPrice ? product.priceFrom! : null) : product.price;
  const displayOld = isVariable ? (product.oldPriceFrom ?? null) : (product.oldPrice ?? null);
  const minOrderQuantity = Math.max(1, Number(product.minOrderQuantity ?? 1));
  const showMinimumOrderTotal = !isVariable && minOrderQuantity > 1;
  const cardPrice = showMinimumOrderTotal ? (displayPrice ?? 0) * minOrderQuantity : displayPrice;
  const cardOldPrice = showMinimumOrderTotal && displayOld != null ? displayOld * minOrderQuantity : displayOld;
  const off = displayPrice != null && displayOld && displayOld > displayPrice
    ? Math.round((1 - displayPrice / displayOld) * 100)
    : 0;
  const showSelectOptions = isVariable && !hasVariantPrice;

  const cart = useCart();
  const wish = useWishlist();
  const wished = wish.has(product.slug);
  const quickViewEnabled = useMarketplace((s) => s.config.product_experience.quick_view_enabled);
  const [quickOpen, setQuickOpen] = useState(false);

  return (
    <article className={`group relative rounded-2xl bg-card border border-border overflow-hidden hover:shadow-2xl hover:border-primary/30 hover:-translate-y-1.5 transition-all duration-300 ease-out ${viewMode === "list" ? "flex flex-row items-stretch" : ""}`} >
      {quickViewEnabled && quickOpen && (
        <Suspense fallback={null}>
          <QuickViewModal slug={product.slug} open={quickOpen} onOpenChange={setQuickOpen} />
        </Suspense>
      )}

      <Link to="/products/$slug" params={{ slug: product.slug }} className={viewMode === "list" ? "flex w-24 sm:w-32 md:w-40 shrink-0 items-center" : "block"}>
        <div className={`relative aspect-square bg-gradient-to-br from-primary/10 via-secondary/10 to-accent/10 grid place-items-center overflow-hidden ${viewMode === "list" ? "w-full" : ""}`} >
          {product.thumbnailUrl && !thumbnailFailed && thumbnailLoading ? (
            <div className="absolute inset-0 animate-pulse bg-muted/70" aria-label="Loading product image" />
          ) : product.thumbnailUrl && displayThumbnailSrc && !thumbnailFailed ? (
            <>
              {!thumbnailLoaded && <div className="absolute inset-0 animate-pulse bg-muted/70" aria-label="Loading product image" />}
              <img
                src={displayThumbnailSrc}
                alt={product.name}
                loading="lazy"
                decoding="async"
                onLoad={() => setThumbnailLoaded(true)}
                onError={handleThumbnailError}
                className={`h-full w-full object-cover transition-opacity group-hover:scale-110 transition-transform duration-500 ease-out ${thumbnailLoaded ? "opacity-100" : "opacity-0"}`}
              />
            </>
          ) : (
            <span className="text-7xl group-hover:scale-110 transition-smooth">{product.emoji}</span>
          )}
           {off > 0 && (
            <span className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-[10px] font-bold bg-accent text-accent-foreground">
              -{off}%
            </span>
          )}
         </div>
      </Link>
      <div className="absolute top-3 right-3 mt-9 flex flex-col gap-2 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-smooth">
        <button
          onClick={(e) => { e.preventDefault(); wish.toggle(product.slug); toast(wished ? "Removed from wishlist" : "Added to wishlist"); }}
          aria-label="Wishlist"
          className="h-8 w-8 grid place-items-center rounded-full bg-card/90 backdrop-blur border border-border hover:border-primary/40"
        >
          <Heart className={`h-4 w-4 ${wished ? "fill-accent text-accent" : ""}`} />
        </button>
        {quickViewEnabled && (
          <button
            onClick={(e) => { e.preventDefault(); setQuickOpen(true); }}
            aria-label="Quick view"
            className="h-8 w-8 grid place-items-center rounded-full bg-card/90 backdrop-blur border border-border hover:border-primary/40"
          >
            <Eye className="h-4 w-4" />
          </button>
        )}
      </div>
      <div className={`min-w-0 flex-1 space-y-2 ${viewMode === "list" ? "p-3 sm:p-4 md:p-5" : "p-4"}`} >
        {(product.badge || product.stock === 0 || product.isTrending || product.isBestSeller || (product.salesCount ?? 0) > 0 || product.createdAt) && (
          <div className="flex flex-wrap items-center gap-1.5">
            {product.badge && (
              <span className="inline-flex max-w-full rounded-full bg-gradient-primary px-2.5 py-1 text-[10px] font-bold text-primary-foreground shadow-sm">
                {product.badge}
              </span>
            )}
            <SaleBadges
              product={product}
              extra={{ stock: product.stock ?? null, salesCount: product.salesCount ?? null, createdAt: product.createdAt ?? null }}
              max={3}
            />
          </div>
        )}
        <div className={`flex min-w-0 items-center gap-1 text-xs text-muted-foreground ${viewMode === "list" ? "gap-1 sm:gap-2" : ""}`} >
          <Star className="h-3.5 w-3.5 fill-accent text-accent" />
          <span className="font-semibold text-foreground">{product.rating}</span>
          <span>({product.reviews.toLocaleString()})</span>
          <span className={`ml-auto inline-flex min-w-0 max-w-[58%] items-center justify-end gap-1 font-medium whitespace-nowrap ${product.deliveryMode === "instant" ? "text-emerald-500" : product.deliveryMode === "fast" ? "text-blue-500" : product.deliveryMode === "manual" ? "text-amber-600" : product.deliveryMode === "extended" ? "text-violet-500" : "text-muted-foreground"}`}>
            <Zap className="h-3 w-3 shrink-0" />
            <span className="truncate text-[11px]">{product.deliveryMode === "instant" ? "Instant" : product.deliveryMode === "fast" ? "Fast" : product.deliveryMode === "manual" ? "Manual" : product.deliveryMode === "extended" ? "Extended" : "Delivery varies"}</span>
          </span>
        </div>
        <Link to="/products/$slug" params={{ slug: product.slug }} className="block">
          <h3 className={`font-semibold leading-snug line-clamp-2 hover:text-primary transition-smooth ${viewMode === "list" ? "text-xs sm:text-sm md:text-base min-h-0" : "text-sm min-h-10"}`}>{product.name}</h3>
        </Link>
        <p className={`text-xs text-muted-foreground line-clamp-2 ${viewMode === "list" ? "hidden sm:block" : ""}`}>{product.short}</p>
        {listingActions ? (
          <div className="flex flex-col gap-2 pt-2">
            <div className="min-w-0">
              {isVariable ? (
                showSelectOptions ? null : (
                  <>
                    <div className="text-lg font-bold text-primary">
                      <span className="text-xs font-medium text-muted-foreground mr-1">From</span>
                      {formatPrice(displayPrice ?? 0)}
                    </div>
                    {displayOld && displayOld > (displayPrice ?? 0) && (
                      <div className="text-xs text-muted-foreground line-through">{formatPrice(displayOld)}</div>
                    )}
                  </>
                )
              ) : (
                <>
                  <div className="text-lg font-bold text-primary">
                    {<span className="text-xs font-medium text-muted-foreground mr-1">{showMinimumOrderTotal ? "From" : "Price"}</span>}
                    {formatPrice(cardPrice ?? 0)}
                  </div>
                  {cardOldPrice && cardOldPrice > (cardPrice ?? 0) && (
                    <div className="text-xs text-muted-foreground line-through">{formatPrice(cardOldPrice)}</div>
                  )}
                </>
              )}
            </div>
            <Link
              to="/products/$slug"
              params={{ slug: product.slug }}
              aria-label={`Buy now: ${product.name}`}
              className="w-full h-10 px-4 inline-flex items-center justify-center whitespace-nowrap overflow-hidden text-ellipsis rounded-full bg-gradient-primary text-primary-foreground text-sm font-semibold leading-none hover:shadow-glow transition-smooth"
            >
              Buy Now
            </Link>
          </div>
        ) : isVariable ? (
          <div className="flex flex-col gap-2 pt-2">
            <div className="min-w-0">
              {showSelectOptions ? (
                <div className="text-sm font-semibold text-primary whitespace-nowrap">View Options</div>
              ) : (
                <>
                  <div className="text-lg font-bold text-primary">
                    <span className="text-xs font-medium text-muted-foreground mr-1">From</span>
                    {formatPrice(displayPrice ?? 0)}
                  </div>
                  {displayOld && displayOld > (displayPrice ?? 0) && (
                    <div className="text-xs text-muted-foreground line-through">{formatPrice(displayOld)}</div>
                  )}
                </>
              )}
            </div>
            <Link
              to="/products/$slug"
              params={{ slug: product.slug }}
              aria-label="View options"
              className="w-full h-9 md:h-[38px] lg:h-10 px-4 inline-flex items-center justify-center whitespace-nowrap overflow-hidden text-ellipsis rounded-full bg-gradient-primary text-primary-foreground text-sm font-semibold leading-none hover:shadow-glow transition-smooth"
            >
              View Options
            </Link>
          </div>
        ) : (
          <div className="flex flex-wrap items-end justify-between gap-2 pt-2">
            <div className="min-w-0 flex-1">
              <div className="text-lg font-bold text-primary">
                {<span className="text-xs font-medium text-muted-foreground mr-1">{showMinimumOrderTotal ? "From" : "Price"}</span>}
                {formatPrice(cardPrice ?? 0)}
              </div>
              {cardOldPrice && cardOldPrice > (cardPrice ?? 0) && (
                <div className="text-xs text-muted-foreground line-through">{formatPrice(cardOldPrice)}</div>
              )}
            </div>
            <button
              onClick={() => { cart.add(product); toast.success("Added to cart"); }}
              aria-label="Add to cart"
              className="shrink-0 h-10 w-10 grid place-items-center rounded-xl bg-gradient-primary text-primary-foreground hover:shadow-glow transition-smooth"
            >
              <ShoppingCart className="h-4 w-4" />
            </button>
          </div>
        )}

      </div>
    </article>
  );
}
