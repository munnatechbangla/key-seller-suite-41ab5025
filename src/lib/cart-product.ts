import type { Product } from "@/lib/catalog";
import type { ProductVariant } from "@/lib/product-variants.functions";
import type { CartVariantMeta } from "@/lib/stores";

type CartAdder = {
  add: (product: Product, qty?: number, variant?: CartVariantMeta) => void;
};

export function isVariantAvailable(variant: ProductVariant) {
  if (variant.status !== "active") return false;
  if (variant.visibility && variant.visibility !== "public") return false;
  if (variant.stock != null && variant.stock <= 0) return false;
  if (variant.stock_status && variant.stock_status === "out_of_stock") return false;
  return true;
}

export function getVariantUnitPrice(variant: ProductVariant) {
  return variant.sale_price != null && variant.sale_price > 0 ? variant.sale_price : variant.price;
}

export function getVariantCompareAt(variant: ProductVariant) {
  return variant.sale_price != null && variant.sale_price > 0 ? variant.price : null;
}

export function toCartVariantMeta(variant: ProductVariant): CartVariantMeta {
  return {
    variant_id: variant.id,
    variant_name: variant.name,
    sku: variant.sku,
    price: variant.price,
    sale_price: variant.sale_price,
    thumbnail_url: variant.thumbnail_url,
    selected_attributes: variant.attributes ?? {},
    delivery_type: variant.delivery_type,
    inventory_pool_id: variant.inventory_pool_id,
    subscription_pool_id: variant.subscription_pool_id,
    license_pool_id: variant.license_pool_id,
  };
}

export function addProductSelectionToCart(
  cart: CartAdder,
  product: Product,
  qty = 1,
  variant?: ProductVariant | null,
) {
  cart.add(product, qty, variant ? toCartVariantMeta(variant) : undefined);
}