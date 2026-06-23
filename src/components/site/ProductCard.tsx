import { Star, ShoppingCart, Zap } from "lucide-react";
import type { Product } from "@/lib/catalog";

export function ProductCard({ product }: { product: Product }) {
  const off = product.oldPrice ? Math.round((1 - product.price / product.oldPrice) * 100) : 0;
  return (
    <article className="group relative rounded-2xl bg-card border border-border overflow-hidden hover:shadow-premium hover:-translate-y-1 transition-smooth">
      <div className="relative aspect-square bg-gradient-to-br from-primary/10 via-secondary/10 to-accent/10 grid place-items-center overflow-hidden">
        <span className="text-7xl group-hover:scale-110 transition-smooth">{product.emoji}</span>
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
        <h3 className="font-semibold text-sm leading-snug line-clamp-2 min-h-10">{product.name}</h3>
        <p className="text-xs text-muted-foreground line-clamp-2">{product.short}</p>
        <div className="flex items-end justify-between pt-2">
          <div>
            <div className="text-lg font-bold text-primary">${product.price}</div>
            {product.oldPrice && (
              <div className="text-xs text-muted-foreground line-through">${product.oldPrice}</div>
            )}
          </div>
          <button className="h-10 w-10 grid place-items-center rounded-xl bg-gradient-primary text-primary-foreground hover:shadow-glow transition-smooth">
            <ShoppingCart className="h-4 w-4" />
          </button>
        </div>
      </div>
    </article>
  );
}
