import type { Product } from "./catalog";
import type { CartVariantMeta } from "./stores";

/**
 * Resolve the display image for a cart line item.
 * Priority (variable): variant.thumbnail_url → product.thumbnailUrl → null
 * Priority (simple):   product.thumbnailUrl → null
 * Returns the raw media:// or URL string for use with ProductThumb.
 */
export function resolveLineImage(product: Product, variant?: CartVariantMeta | null): string | null {
  // it.variant metadata in useCart store usually contains thumbnail_url
  let url = variant?.thumbnail_url || product.thumbnailUrl || null;
  
  // If it's a bare storage path (no media:// and no protocol), wrap it.
  if (url && !url.startsWith("media://") && !/^(https?:|data:|blob:)/i.test(url)) {
    return `media://${url}`;
  }
  
  return url;
}
