import { Link, useNavigate } from "@tanstack/react-router";
import { Star, ShoppingCart, Zap, Heart, GitCompare, Check, X } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ProductThumb } from "@/components/site/ProductThumb";
import { useProduct } from "@/lib/catalog";
import { useCart, useWishlist, useCompare } from "@/lib/stores";
import { toast } from "sonner";
import { useState } from "react";
import { LiveVisitorsCounter } from "./LiveVisitorsCounter";
import { SaleBadges } from "./SaleBadges";

export function QuickViewModal({ slug, open, onOpenChange }: { slug: string | null; open: boolean; onOpenChange: (v: boolean) => void }) {
  const product = useProduct(slug ?? "");
  const cart = useCart();
  const wish = useWishlist();
  const cmp = useCompare();
  const [qty, setQty] = useState(1);
  const navigate = useNavigate();

  if (!product) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <div className="p-6 text-sm text-muted-foreground">Loading product…</div>
        </DialogContent>
      </Dialog>
    );
  }

  const inStock = (product.stock ?? 1) > 0;
  const off = product.oldPrice ? Math.round((1 - product.price / product.oldPrice) * 100) : 0;

  const addToCart = () => {
    cart.add(product, qty);
    toast.success(`${product.name} added to cart`);
  };
  const buyNow = () => {
    cart.add(product, qty);
    onOpenChange(false);
    navigate({ to: "/checkout" });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl p-0 overflow-hidden gap-0 [&>button]:hidden">
        <button
          onClick={() => onOpenChange(false)}
          aria-label="Close quick view"
          className="absolute right-3 top-3 z-10 h-9 w-9 grid place-items-center rounded-full bg-card/90 backdrop-blur border border-border hover:bg-muted"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="grid md:grid-cols-2 max-h-[88vh] overflow-y-auto">
          <div className="relative aspect-square md:aspect-auto bg-gradient-to-br from-primary/15 via-secondary/15 to-accent/15 grid place-items-center overflow-hidden">
            <ProductThumb
              src={product.thumbnailUrl}
              emoji={product.emoji}
              alt={product.name}
              size={600}
              className="h-full w-full"
            />
            {off > 0 && (
              <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-[10px] font-bold bg-accent text-accent-foreground">
                -{off}% OFF
              </span>
            )}
            <div className="absolute bottom-3 left-3 right-3 flex flex-wrap gap-1.5">
              <SaleBadges product={product} extra={{ stock: product.stock ?? null }} max={3} />
            </div>
          </div>

          <div className="p-5 sm:p-6 space-y-4">
            <div>
              <div className="text-[11px] text-muted-foreground uppercase tracking-wider">{product.category.replace("-", " ")}</div>
              <h2 className="text-xl sm:text-2xl font-bold leading-tight mt-1">{product.name}</h2>
              <div className="flex items-center gap-2 mt-2 text-xs">
                <div className="flex items-center gap-0.5">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className={`h-3.5 w-3.5 ${i < Math.floor(product.rating) ? "fill-accent text-accent" : "text-muted"}`} />
                  ))}
                </div>
                <span className="font-semibold">{product.rating}</span>
                <span className="text-muted-foreground">({product.reviews.toLocaleString()})</span>
              </div>
            </div>

            <p className="text-sm text-muted-foreground line-clamp-3">{product.short}</p>

            <div className="flex items-end gap-3 flex-wrap">
              <div className="text-3xl font-bold text-primary">{usePriceFormatter()(product.price)}</div>
              {product.oldPrice && (
                <div className="text-sm text-muted-foreground line-through mb-1">{usePriceFormatter()(product.oldPrice)}</div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              {inStock ? (
                <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
                  <Check className="h-3.5 w-3.5" /> In stock
                </span>
              ) : (
                <span className="text-destructive font-medium">Out of stock</span>
              )}
              <span className="inline-flex items-center gap-1 text-accent font-medium">
                <Zap className="h-3.5 w-3.5" /> {product.delivery} delivery
              </span>
              <LiveVisitorsCounter surface="product" seed={`qv-${product.slug}`} />
            </div>

            <div className="flex items-center gap-2">
              <div className="inline-flex items-center rounded-xl border border-border bg-card">
                <button onClick={() => setQty(Math.max(1, qty - 1))} className="w-9 h-10 grid place-items-center hover:bg-muted rounded-l-xl" aria-label="Decrease quantity">−</button>
                <span className="w-9 text-center font-semibold">{qty}</span>
                <button onClick={() => setQty(qty + 1)} className="w-9 h-10 grid place-items-center hover:bg-muted rounded-r-xl" aria-label="Increase quantity">+</button>
              </div>
              <button
                onClick={addToCart}
                disabled={!inStock}
                className="flex-1 inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl bg-card border border-primary text-primary font-semibold hover:bg-primary/5 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ShoppingCart className="h-4 w-4" /> Add
              </button>
              <button
                onClick={buyNow}
                disabled={!inStock}
                className="flex-1 inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl bg-gradient-primary text-primary-foreground font-semibold shadow-glow disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
              >
                <Zap className="h-4 w-4" /> Buy
              </button>
            </div>

            <div className="flex flex-wrap gap-2 text-xs">
              <button
                onClick={() => { wish.toggle(product.slug); toast(wish.has(product.slug) ? "Removed from wishlist" : "Added to wishlist"); }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border ${wish.has(product.slug) ? "bg-accent/10 border-accent text-accent" : "border-border hover:bg-muted"}`}
              >
                <Heart className={`h-3.5 w-3.5 ${wish.has(product.slug) ? "fill-accent" : ""}`} /> Wishlist
              </button>
              <button
                onClick={() => { cmp.toggle(product.slug); toast(cmp.has(product.slug) ? "Removed from compare" : "Added to compare"); }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border ${cmp.has(product.slug) ? "bg-primary/10 border-primary text-primary" : "border-border hover:bg-muted"}`}
              >
                <GitCompare className="h-3.5 w-3.5" /> Compare
              </button>
              <Link
                to="/products/$slug"
                params={{ slug: product.slug }}
                onClick={() => onOpenChange(false)}
                className="ml-auto inline-flex items-center gap-1 text-primary font-semibold hover:underline px-2 py-1.5"
              >
                View full details →
              </Link>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
