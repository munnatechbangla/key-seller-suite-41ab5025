import type { Product } from "@/lib/catalog";

type Extra = { stock?: number | null; salesCount?: number | null; createdAt?: string | null };

/**
 * Only renders the system-critical stock badge.
 * Promotional/social-proof labels (New, Trending, Bestseller, etc.) must be
 * explicitly set as the product's custom badge by an admin.
 */
export function SaleBadges({ product, extra }: { product: Product; extra?: Extra; max?: number }) {
  const stock = extra?.stock ?? product.stock ?? null;

  if (stock === null || stock > 0) return null;

  return (
    <div className="min-w-0 max-w-[48%] shrink-0">
      <span
        className="block truncate whitespace-nowrap rounded-full bg-red-500 px-1.5 py-0.5 text-[9px] font-bold text-white shadow-sm"
        title="Out of Stock"
      >
        Out of Stock
      </span>
    </div>
  );
}
