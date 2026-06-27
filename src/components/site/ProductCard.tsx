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
  const off = product.oldPrice ? Math.round((1 - product.price / product.oldPrice) * 100) : 0;
  const cart = useCart();
  const wish = useWishlist();
  const wished = wish.has(product.slug);
  const quickViewEnabled = useMarketplace((s) => s.config.product_experience.quick_view_enabled);
  const [quickOpen, setQuickOpen] = useState(false);

  return (
    <article className="group relative rounded-2xl bg-card border border-border overflow-hidden hover:shadow-2xl hover:border-primary/30 hover:-translate-y-1.5 transition-all duration-300 ease-out">
      {quickViewEnabled && (
        <QuickViewModal slug={quickOpen ? product.slug : null} open={quickOpen} onOpenChange={setQuickOpen} />
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
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Star className="h-3.5 w-3.5 fill-accent text-accent" />
          <span className="font-semibold text-foreground">{product.rating}</span>
          <span>({product.reviews.toLocaleString()})</span>
          <span className="ml-auto inline-flex items-center gap-1 text-accent font-medium">
            <Zap className="h-3 w-3" /> {product.delivery}
          </span>
        </div>
        <Link to="/products/$slug" params={{ slug: product.slug }} className="block">
          <h3 className="font-semibold text-sm leading-snug line-clamp-2 min-h-10 hover:text-primary transition-smooth">{product.name}</h3>
        </Link>
        <p className="text-xs text-muted-foreground line-clamp-2">{product.short}</p>
        <div className="flex items-end justify-between pt-2">
          <div>
            <div className="text-lg font-bold text-primary">${product.price}</div>
            {product.oldPrice && (
              <div className="text-xs text-muted-foreground line-through">${product.oldPrice}</div>
            )}
          </div>
          <button
            onClick={() => { cart.add(product); toast.success("Added to cart"); }}
            aria-label="Add to cart"
            className="h-10 w-10 grid place-items-center rounded-xl bg-gradient-primary text-primary-foreground hover:shadow-glow transition-smooth"
          >
            <ShoppingCart className="h-4 w-4" />
          </button>
        </div>
      </div>
    </article>
  );
}
