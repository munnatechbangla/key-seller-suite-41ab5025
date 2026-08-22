import { useSettings } from "./cms/settings";

/**
 * Hook to get the current currency configuration.
 */
export function useCurrency() {
  const settings = useSettings((s) => s.settings.payment);
  
  return {
    code: settings.currency || "BDT",
    symbol: settings.currency_symbol || "৳",

  };
}

/**
 * Hook to get a centralized price formatter.
 */
export function usePriceFormatter() {
  const { symbol } = useCurrency();
  
  return (price: number | null | undefined) => {
    if (price == null || isNaN(price)) return `${symbol}0.00`;
    return `${symbol}${price.toFixed(2)}`;
  };
}

/**
 * Static price formatter (not a hook).
 * Uses a default symbol if not provided.
 * Useful for non-React contexts or when symbol is already available.
 */
export function formatPriceWithSymbol(price: number | null | undefined, symbol: string = "$") {
  if (price == null || isNaN(price)) return `${symbol}0.00`;
  return `${symbol}${price.toFixed(2)}`;
}

/**
 * Global helper to format price for non-React contexts using default symbol.
 * Deprecates the one in product-price.ts to avoid duplication.
 */
export function formatPrice(n: number | null | undefined, symbol: string = "$"): string {
  return formatPriceWithSymbol(n, symbol);
}

