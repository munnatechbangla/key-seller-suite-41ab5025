import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, ShoppingCart, Plus } from "lucide-react";
import { useCart } from "@/lib/stores";
import type { Product } from "@/lib/catalog";

export function FrequentlyBoughtTogether({
  current,
  candidates,
}: {
  current: Product;
  candidates: Product[];
}) {
  const cart = useCart();
  const items = useMemo(
    () => candidates.filter((p) => p.slug !== current.slug).slice(0, 3),
    [candidates, current.slug],
  );

  // Default: only the current product is selected. Recommended items start unchecked.
  const [selected, setSelected] = useState<Record<string, boolean>>(() => ({
    [current.slug]: true,
  }));

  if (items.length < 1) return null;

  const lineup: Product[] = [current, ...items];
  const isSelected = (slug: string) => slug === current.slug || !!selected[slug];
  const total = lineup.reduce((s, p) => (isSelected(p.slug) ? s + p.price : s), 0);
  const oldTotal = lineup.reduce(
    (s, p) => (isSelected(p.slug) ? s + (p.oldPrice ?? p.price) : s),
    0,
  );
  const savings = Math.max(0, oldTotal - total);
  const picked = lineup.filter((p) => isSelected(p.slug));

  const addAll = () => {
    if (picked.length === 0) {
      toast.error("Select at least one item");
      return;
    }
    picked.forEach((p) => cart.add(p, 1));
    toast.success(`Added ${picked.length} item${picked.length === 1 ? "" : "s"} to cart`);
  };

  const toggle = (slug: string) => {
    if (slug === current.slug) return; // current product is locked
    setSelected((s) => ({ ...s, [slug]: !s[slug] }));
  };

  return (
    <section className="mt-12">
      <h2 className="text-2xl font-bold mb-5">Frequently bought together</h2>
      <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 lg:p-6 grid lg:grid-cols-[1fr_280px] gap-6">
        {/* Products: vertical stack on mobile, horizontal on sm+ */}
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-stretch gap-3">
          {lineup.map((p, i) => {
            const checked = isSelected(p.slug);
            const locked = p.slug === current.slug;
            return (
              <div
                key={p.slug}
                className="flex sm:flex-row items-stretch gap-3 w-full sm:w-auto"
              >
                <label
                  className={`relative flex flex-row sm:flex-col items-center gap-3 sm:gap-2 w-full sm:w-36 rounded-xl sm:rounded-none border sm:border-0 border-border p-3 sm:p-0 ${locked ? "cursor-default" : "cursor-pointer"}`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={locked}
                    onChange={() => toggle(p.slug)}
                    className="h-5 w-5 sm:h-4 sm:w-4 sm:absolute sm:top-2 sm:left-2 accent-primary z-10 shrink-0 disabled:opacity-80"
                    aria-label={locked ? `${p.name} (this product)` : `Include ${p.name}`}
                  />
                  <div
                    className={`h-20 w-20 sm:h-auto sm:w-full sm:aspect-square shrink-0 rounded-xl border-2 grid place-items-center text-4xl sm:text-5xl overflow-hidden transition-smooth ${checked ? "border-primary" : "border-border opacity-60"}`}
                  >
                    {p.thumbnailUrl ? (
                      <img
                        src={p.thumbnailUrl}
                        alt={p.name}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <span>{p.emoji}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 sm:flex-none sm:w-full text-left sm:text-center">
                    <div className="text-sm sm:text-xs font-semibold sm:line-clamp-2 leading-tight">
                      {p.name}
                      {locked && (
                        <span className="ml-2 sm:ml-0 sm:block text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                          This item
                        </span>
                      )}
                    </div>
                    <div className="text-xs mt-1">
                      <span className="font-bold text-primary">${p.price.toFixed(2)}</span>
                      {p.oldPrice && p.oldPrice > p.price && (
                        <span className="ml-1 line-through text-muted-foreground">
                          ${p.oldPrice.toFixed(2)}
                        </span>
                      )}
                    </div>
                  </div>
                </label>
                {i < lineup.length - 1 && (
                  <div className="hidden sm:flex self-center text-2xl text-muted-foreground font-light">
                    +
                  </div>
                )}
                {i < lineup.length - 1 && (
                  <div className="flex sm:hidden justify-center">
                    <div className="h-8 w-8 grid place-items-center rounded-full bg-muted text-muted-foreground">
                      <Plus className="h-4 w-4" />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="border-t lg:border-t-0 lg:border-l border-border pt-4 lg:pt-0 lg:pl-6 flex flex-col justify-center gap-3">
          <div className="text-sm text-muted-foreground">
            {picked.length} item{picked.length === 1 ? "" : "s"} selected
          </div>
          <div>
            <div className="text-3xl font-bold text-primary">${total.toFixed(2)}</div>
            {savings > 0 && (
              <div className="text-xs text-emerald-600 font-semibold inline-flex items-center gap-1 mt-1">
                <Check className="h-3.5 w-3.5" /> Save ${savings.toFixed(2)}
              </div>
            )}
          </div>
          <button
            onClick={addAll}
            disabled={picked.length === 0}
            className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl bg-gradient-primary text-primary-foreground font-semibold shadow-glow disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ShoppingCart className="h-4 w-4" /> Add Selected to Cart
          </button>
        </div>
      </div>
    </section>
  );
}
