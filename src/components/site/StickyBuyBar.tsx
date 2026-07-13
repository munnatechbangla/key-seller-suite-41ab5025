import { useEffect, useState } from "react";
import { ShoppingCart, Zap } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import type { Product } from "@/lib/catalog";
import { useCart, type CartVariantMeta } from "@/lib/stores";
import { useMarketplace } from "@/lib/cms/marketplace";
import { toast } from "sonner";
import type { ProductVariant } from "@/lib/product-variants.functions";
import { addProductSelectionToCart, getVariantCompareAt, getVariantUnitPrice, isVariantAvailable } from "@/lib/cart-product";

type Props = {
  product: Product;
  threshold?: number;
  variant?: ProductVariant | null;
  hasAttributes?: boolean;
};

export function StickyBuyBar({ product, threshold = 480, variant, hasAttributes }: Props) {
  const enabled = useMarketplace((s) => s.config.product_experience.sticky_buy_bar_enabled);
  const speed = useMarketplace((s) => s.config.ui.animation_speed_ms);
  const cart = useCart();
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);

  const inStock = hasAttributes
    ? !!variant && isVariantAvailable(variant)
    : (product.stock ?? 1) > 0;

  useEffect(() => {
    if (!enabled || !inStock) { setVisible(false); return; }
    const onScroll = () => setVisible(window.scrollY > threshold);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [enabled, inStock, threshold]);

  if (!enabled) return null;
  if (hasAttributes && !variant) return null;
  if (!inStock) return null;

  // Variable products must NEVER fall back to product.price.
  const unitPrice = variant ? getVariantUnitPrice(variant) : product.price;
  const compareAt = variant ? getVariantCompareAt(variant) : (product.oldPrice ?? null);
  const off = compareAt && compareAt > unitPrice ? Math.round((1 - unitPrice / compareAt) * 100) : 0;
  const thumb = variant?.thumbnail_url ?? product.thumbnailUrl ?? null;
  const label = variant ? `${product.name} — ${variant.name}` : product.name;

  const onAdd = () => { addProductSelectionToCart(cart, product, 1, variant); toast.success(`${label} added to cart`); };
  const onBuy = () => { addProductSelectionToCart(cart, product, 1, variant); navigate({ to: "/checkout" }); };

  return (
    <div
      role="region"
      aria-label="Buy bar"
      style={{ transitionDuration: `${speed}ms` }}
      className={[
        "md:hidden fixed left-0 right-0 z-40 bottom-16",
        "border-t border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80",
        "shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.25)]",
        "transition-transform ease-out",
        visible ? "translate-y-0" : "translate-y-full pointer-events-none",
      ].join(" ")}
    >
      <div className="px-3 py-2 flex items-center gap-2">
        <div className="h-11 w-11 shrink-0 rounded-lg bg-gradient-to-br from-primary/15 via-secondary/15 to-accent/15 grid place-items-center overflow-hidden">
          {thumb ? (
            <img src={thumb} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="text-2xl">{product.emoji}</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold truncate">{label}</div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-sm font-bold text-primary">${unitPrice.toFixed(2)}</span>
            {compareAt && compareAt > unitPrice && (
              <>
                <span className="text-[11px] text-muted-foreground line-through">${compareAt.toFixed(2)}</span>
                {off > 0 && <span className="text-[10px] font-bold text-accent">-{off}%</span>}
              </>
            )}
          </div>
        </div>
        <button
          onClick={onAdd}
          aria-label="Add to cart"
          className="h-10 w-10 grid place-items-center rounded-lg bg-card border border-primary text-primary"
        >
          <ShoppingCart className="h-4 w-4" />
        </button>
        <button
          onClick={onBuy}
          className="h-10 px-3 inline-flex items-center gap-1.5 rounded-lg bg-gradient-primary text-primary-foreground text-sm font-semibold shadow-glow"
        >
          <Zap className="h-4 w-4" /> Buy
        </button>
      </div>
    </div>
  );
}
