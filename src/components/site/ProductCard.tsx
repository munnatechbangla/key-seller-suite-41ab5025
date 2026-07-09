import { Link } from "@tanstack/react-router";
import { Star, ShoppingCart, Zap, Heart, Eye } from "lucide-react";
import type { Product } from "@/lib/catalog";
import { useCart, useWishlist } from "@/lib/stores";
import { SaleBadges } from "@/components/site/SaleBadges";
import { useMarketplace } from "@/lib/cms/marketplace";
import { toast } from "sonner";
import { useState, lazy, Suspense } from "react";

const QuickViewModal = lazy(() =>
  import("@/components/site/QuickViewModal").then((m) => ({ default: m.QuickViewModal })),
);


export function ProductCard({ product }: { product: Product }) {
  const isVariable = !!product.hasAttributes;
  const hasVariantPrice = product.priceFrom != null && product.priceFrom > 0;
  const displayPrice = isVariable ? (hasVariantPrice ? product.priceFrom! : null) : product.price;
  const displayOld = isVariable ? (product.oldPriceFrom ?? null) : (product.oldPrice ?? null);
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
    <article className="group relative rounded-2xl bg-card border border-border overflow-hidden hover:shadow-2xl hover:border-primary/30 hover:-translate-y-1.5 transition-all duration-300 ease-out">
      {quickViewEnabled && quickOpen && (
        <Suspense fallback={null}>
          <QuickViewModal slug={product.slug} open={quickOpen} onOpenChange={setQuickOpen} />
        </Suspense>
      )}

      <Link to="/products/$slug" params={{ slug: product.slug }} className="block">
        <div className="relative aspect-square bg-gradient-to-br from-primary/10 via-secondary/10 to-accent/10 grid place-items-center overflow-hidden">
          {product.thumbnailUrl ? (
            <img
              src={product.thumbnailUrl}
              alt={product.name}
              loading="lazy"
              className="h-full w-full object-cover group-hover:scale-110 transition-transform duration-500 ease-out"
            />
          ) : (
            <span className="text-7xl group-hover:scale-110 transition-smooth">{product.emoji}</span>
          )}
          {product.badge && (
            <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-[10px] font-bold bg-gradient-primary text-primary-foreground shadow-elegant">
              {product.badge}
            </span>
          )}
          {off > 0 && (
            <span className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-[10px] font-bold bg-accent text-accent-foreground">
              -{off}%
            </span>
          )}
          <div className="absolute bottom-2 left-2 right-2 flex justify-start">
            <SaleBadges product={product} extra={{ stock: product.stock ?? null }} max={2} />
          </div>
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
      <div className="p-4 space-y-2">
        <div className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
          <Star className="h-3.5 w-3.5 fill-accent text-accent" />
          <span className="font-semibold text-foreground">{product.rating}</span>
          <span>({product.reviews.toLocaleString()})</span>
          <span className="ml-auto inline-flex min-w-0 items-center gap-1 text-accent font-medium">
            <Zap className="h-3 w-3" /> {product.delivery}
          </span>
        </div>
        <Link to="/products/$slug" params={{ slug: product.slug }} className="block">
          <h3 className="font-semibold text-sm leading-snug line-clamp-2 min-h-10 hover:text-primary transition-smooth">{product.name}</h3>
        </Link>
        <p className="text-xs text-muted-foreground line-clamp-2">{product.short}</p>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2 pt-2">
          <div className="min-w-0">
            {showSelectOptions ? (
              <div className="text-sm font-semibold text-primary">Select Options</div>
            ) : (
              <>
                <div className="text-lg font-bold text-primary">
                  {isVariable && <span className="text-xs font-medium text-muted-foreground mr-1">From</span>}
                  ${(displayPrice ?? 0).toFixed(2)}
                </div>
                {displayOld && displayOld > (displayPrice ?? 0) && (
                  <div className="text-xs text-muted-foreground line-through">${displayOld.toFixed(2)}</div>
                )}
              </>
            )}
          </div>
          {isVariable ? (
            <Link
              to="/products/$slug"
              params={{ slug: product.slug }}
              aria-label="Select options"
              className="h-9 sm:h-10 px-3 sm:px-4 inline-flex items-center justify-center rounded-xl bg-gradient-primary text-primary-foreground text-[13px] sm:text-sm font-semibold whitespace-nowrap hover:shadow-glow transition-smooth"
            >
              Options
            </Link>

          ) : (
            <button
              onClick={() => { cart.add(product); toast.success("Added to cart"); }}
              aria-label="Add to cart"
              className="h-10 w-10 grid place-items-center rounded-xl bg-gradient-primary text-primary-foreground hover:shadow-glow transition-smooth"
            >
              <ShoppingCart className="h-4 w-4" />
            </button>
          )}
        </div>

      </div>
    </article>
  );
}
