import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, ShoppingCart } from "lucide-react";
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

  const allSlugs = useMemo(() => [current.slug, ...items.map((p) => p.slug)], [current.slug, items]);
  const [selected, setSelected] = useState<Record<string, boolean>>(
    () => Object.fromEntries(allSlugs.map((s) => [s, true])),
  );

  if (items.length < 1) return null;

  const lineup: Product[] = [current, ...items];
  const total = lineup.reduce((s, p) => (selected[p.slug] ? s + p.price : s), 0);
  const oldTotal = lineup.reduce((s, p) => (selected[p.slug] ? s + (p.oldPrice ?? p.price) : s), 0);
  const savings = Math.max(0, oldTotal - total);
  const picked = lineup.filter((p) => selected[p.slug]);

  const addAll = () => {
    if (picked.length === 0) {
      toast.error("Select at least one item");
      return;
    }
    picked.forEach((p) => cart.add(p, 1));
    toast.success(`Added ${picked.length} item${picked.length === 1 ? "" : "s"} to cart`);
  };

  const toggle = (slug: string) =>
    setSelected((s) => ({ ...s, [slug]: !s[slug] }));

  return (
    <section className="mt-12">
      <h2 className="text-2xl font-bold mb-5">Frequently bought together</h2>
      <div className="rounded-2xl border border-border bg-card p-5 lg:p-6 grid lg:grid-cols-[1fr_280px] gap-6">
        <div className="flex flex-wrap items-stretch gap-3">
          {lineup.map((p, i) => (
            <div key={p.slug} className="flex items-stretch gap-3">
              <label className="relative flex flex-col items-center gap-2 cursor-pointer w-32 sm:w-36">
                <input
                  type="checkbox"
                  checked={!!selected[p.slug]}
                  onChange={() => toggle(p.slug)}
                  className="absolute top-2 left-2 h-4 w-4 accent-primary z-10"
                  aria-label={`Include ${p.name}`}
                />
                <div className={`aspect-square w-full rounded-xl border-2 grid place-items-center text-5xl overflow-hidden transition-smooth ${selected[p.slug] ? "border-primary" : "border-border opacity-60"}`}>
                  {p.thumbnailUrl ? (
                    <img src={p.thumbnailUrl} alt={p.name} className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <span>{p.emoji}</span>
                  )}
                </div>
                <div className="text-xs font-semibold text-center line-clamp-2 leading-tight">{p.name}</div>
                <div className="text-xs">
                  <span className="font-bold text-primary">${p.price.toFixed(2)}</span>
                  {p.oldPrice && p.oldPrice > p.price && (
                    <span className="ml-1 line-through text-muted-foreground">${p.oldPrice.toFixed(2)}</span>
                  )}
                </div>
              </label>
              {i < lineup.length - 1 && (
                <div className="self-center text-2xl text-muted-foreground font-light">+</div>
              )}
            </div>
          ))}
        </div>

        <div className="border-t lg:border-t-0 lg:border-l border-border pt-4 lg:pt-0 lg:pl-6 flex flex-col justify-center gap-3">
          <div className="text-sm text-muted-foreground">{picked.length} item{picked.length === 1 ? "" : "s"} selected</div>
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
