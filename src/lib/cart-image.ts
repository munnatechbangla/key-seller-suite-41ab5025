import type { Product } from "./catalog";
import type { CartVariantMeta } from "./stores";

/**
 * Resolve the display image for a cart line item.
 * Priority (variable): variant.thumbnail_url → product.thumbnailUrl → null
 * Priority (simple):   product.thumbnailUrl → null
 * Returns null when no image is available; caller can render an emoji/placeholder.
 */
export function resolveLineImage(product: Product, variant?: CartVariantMeta | null): string | null {
  if (variant?.thumbnail_url) return variant.thumbnail_url;
  if (product.thumbnailUrl) return product.thumbnailUrl;
  return null;
}
