import type { Product } from "@/lib/catalog";

/**
 * Single source of truth for the price shown on product tiles / mini cards.
 * Mirrors the logic used by ProductCard so every surface renders the same value.
 */
export type ResolvedProductPrice = {
  price: number | null;
  oldPrice: number | null;
  fromLabel: boolean;
  unavailable: boolean;
};

export function resolveProductPrice(product: Product): ResolvedProductPrice {
  const isVariable = !!product.hasAttributes;
  if (isVariable) {
    const p = product.priceFrom;
    if (p == null || p <= 0) {
      return { price: null, oldPrice: null, fromLabel: false, unavailable: true };
    }
    const old = product.oldPriceFrom && product.oldPriceFrom > p ? product.oldPriceFrom : null;
    return { price: p, oldPrice: old, fromLabel: true, unavailable: false };
  }
  const p = product.price;
  if (p == null || p < 0) {
    return { price: null, oldPrice: null, fromLabel: false, unavailable: true };
  }
  const old = product.oldPrice && product.oldPrice > p ? product.oldPrice : null;
  return { price: p, oldPrice: old, fromLabel: false, unavailable: false };
}

export function formatPrice(n: number, symbol: string = "$"): string {
  if (n == null || isNaN(n)) return `${symbol}0.00`;
  return `${symbol}${n.toFixed(2)}`;
}
