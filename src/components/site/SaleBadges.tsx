import { useMarketplace, formatBadge } from "@/lib/cms/marketplace";
import type { Product } from "@/lib/catalog";

type Extra = { stock?: number | null; salesCount?: number | null; createdAt?: string | null };

export function SaleBadges({ product, extra, max = 3 }: { product: Product; extra?: Extra; max?: number }) {
  const sp = useMarketplace((s) => s.config.social_proof);
  const items: { key: string; label: string; bg: string; fg: string }[] = [];

  const stock = extra?.stock ?? product.stock ?? null;
  const sales = extra?.salesCount ?? null;
  const createdAt = extra?.createdAt ?? null;

  if (sp.bestseller.enabled && (product as any).isBestSeller) {
    items.push({ key: "bs", label: sp.bestseller.label, bg: sp.bestseller.color, fg: sp.bestseller.text_color });
  }
  if (sp.trending.enabled && (product as any).isTrending) {
    items.push({ key: "tr", label: sp.trending.label, bg: sp.trending.color, fg: sp.trending.text_color });
  }
  if (sp.new_arrival.enabled && createdAt) {
    const days = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24);
    if (days <= sp.new_arrival.days) {
      items.push({ key: "nw", label: sp.new_arrival.label, bg: sp.new_arrival.color, fg: sp.new_arrival.text_color });
    }
  }
  if (sp.low_stock.enabled && stock !== null && stock > 0 && stock <= sp.low_stock.threshold) {
    items.push({ key: "ls", label: formatBadge(sp.low_stock.label, stock), bg: sp.low_stock.color, fg: sp.low_stock.text_color });
  }
  if (sp.sold_count.enabled && sales !== null && sales >= sp.sold_count.threshold) {
    items.push({ key: "sc", label: formatBadge(sp.sold_count.label, sales), bg: sp.sold_count.color, fg: sp.sold_count.text_color });
  }

  if (items.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {items.slice(0, max).map((b) => (
        <span
          key={b.key}
          className="px-2 py-0.5 rounded-full text-[10px] font-bold shadow-sm"
          style={{ background: b.bg, color: b.fg }}
        >
          {b.label}
        </span>
      ))}
    </div>
  );
}
