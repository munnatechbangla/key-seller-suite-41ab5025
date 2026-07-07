/**
 * P2C — Storefront Variant Selector.
 *
 * Additive, self-contained. Loads attributes + variants ONCE via the P2A
 * server functions, then does all matching client-side. Does NOT modify
 * checkout/orders/fulfillment — it passes a variant-adjusted Product into
 * the existing `useCart().add()` so downstream logic is unchanged.
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ShoppingCart, Zap, Check, AlertTriangle } from "lucide-react";
import {
  listProductAttributesFn,
  listProductVariantsFn,
  type ProductAttribute,
  type ProductVariant,
} from "@/lib/product-variants.functions";
import { useCart } from "@/lib/stores";
import type { Product } from "@/lib/catalog";

type Props = {
  product: Product;
  onVariantChange?: (v: ProductVariant | null) => void;
  onHasAttributes?: (has: boolean) => void;
};

function variantAvailable(v: ProductVariant) {
  if (v.status !== "active") return false;
  if (v.visibility && v.visibility !== "public") return false;
  if (v.stock != null && v.stock <= 0) return false;
  if (v.stock_status && v.stock_status === "out_of_stock") return false;
  return true;
}

function variantEffectivePrice(v: ProductVariant) {
  return v.sale_price != null && v.sale_price > 0 ? v.sale_price : v.price;
}

export function VariantSelector({ product, onVariantChange, onHasAttributes }: Props) {
  const listAttrs = useServerFn(listProductAttributesFn);
  const listVars = useServerFn(listProductVariantsFn);
  const cart = useCart();
  const navigate = useNavigate();
  // Read ?variant= without forcing a validateSearch on the parent route.
  const search = useSearch({ strict: false }) as { variant?: string };

  const attrsQ = useQuery({
    queryKey: ["variant-attrs", product.id],
    queryFn: () => listAttrs({ data: { productId: product.id } }),
    staleTime: 60_000,
  });
  const varsQ = useQuery({
    queryKey: ["variant-list", product.id],
    queryFn: () => listVars({ data: { productId: product.id } }),
    staleTime: 60_000,
  });

  const attributes = (attrsQ.data ?? []) as ProductAttribute[];
  const variants = (varsQ.data ?? []) as ProductVariant[];

  useEffect(() => {
    onHasAttributes?.(attributes.length > 0);
  }, [attributes.length, onHasAttributes]);

  // ---- selection state: attributeId -> optionId ----
  const [selection, setSelection] = useState<Record<string, string>>({});
  const [qty, setQty] = useState(1);
  const [priceKey, setPriceKey] = useState(0); // for fade animation

  // Preselect: from URL ?variant= if present, otherwise first available variant.
  useEffect(() => {
    if (!attributes.length || !variants.length) return;
    if (Object.keys(selection).length) return;
    const urlVariantId = search?.variant;
    const target =
      (urlVariantId && variants.find((v) => v.id === urlVariantId)) ||
      variants.find(variantAvailable) ||
      variants[0];
    if (!target) return;
    const map: Record<string, string> = {};
    for (const attr of attributes) {
      const match = attr.options.find((o) => target.attribute_option_ids?.includes(o.id));
      if (match) map[attr.id] = match.id;
    }
    setSelection(map);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attributes, variants]);

  const activeVariant = useMemo(() => {
    if (!attributes.length) return null;
    const picked = Object.values(selection);
    if (picked.length !== attributes.length) return null;
    return (
      variants.find((v) => {
        const set = new Set(v.attribute_option_ids ?? []);
        return picked.every((id) => set.has(id));
      }) ?? null
    );
  }, [selection, variants, attributes.length]);

  useEffect(() => {
    onVariantChange?.(activeVariant);
    setPriceKey((k) => k + 1);
    if (activeVariant?.id) {
      navigate({
        to: ".",
        search: (prev: Record<string, unknown>) => ({ ...prev, variant: activeVariant.id }),
        replace: true,
      }).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeVariant?.id]);

  // Determine which options should be enabled based on partial selection.
  function isOptionEnabled(attrId: string, optId: string) {
    const trial = { ...selection, [attrId]: optId };
    return variants.some((v) => {
      if (!variantAvailable(v)) return false;
      const set = new Set(v.attribute_option_ids ?? []);
      return Object.values(trial).every((id) => set.has(id));
    });
  }

  if (attrsQ.isLoading || varsQ.isLoading) {
    return <div className="h-40 rounded-2xl bg-muted/40 animate-pulse" />;
  }
  if (!attributes.length) return null;

  const fullySelected = Object.keys(selection).length === attributes.length;
  const outOfStock = activeVariant ? !variantAvailable(activeVariant) : false;
  const canBuy = !!activeVariant && !outOfStock;
  const price = activeVariant ? variantEffectivePrice(activeVariant) : product.price;
  const compareAt =
    activeVariant?.sale_price != null && activeVariant.sale_price > 0
      ? activeVariant.price
      : product.oldPrice;

  const handleAdd = (buy = false) => {
    if (!canBuy || !activeVariant) return;
    cart.add(product, qty, {
      variant_id: activeVariant.id,
      variant_name: activeVariant.name,
      sku: activeVariant.sku,
      price: activeVariant.price,
      sale_price: activeVariant.sale_price,
      thumbnail_url: activeVariant.thumbnail_url,
      selected_attributes: activeVariant.attributes ?? {},
      delivery_type: activeVariant.delivery_type,
      inventory_pool_id: activeVariant.inventory_pool_id,
      subscription_pool_id: activeVariant.subscription_pool_id,
      license_pool_id: activeVariant.license_pool_id,
    });
    if (buy) window.location.href = "/checkout";
    else toast.success(`${product.name} — ${activeVariant.name} added to cart`);
  };


  return (
    <div className="space-y-5" aria-label="Variant selector">
      {/* Attribute pickers */}
      <div className="space-y-4">
        {attributes.map((attr) => {
          const selected = selection[attr.id];
          const dt = attr.display_type ?? "select";
          return (
            <div key={attr.id}>
              <div className="text-sm font-semibold mb-2 flex items-center gap-2">
                <span>{attr.name}</span>
                {selected && (
                  <span className="text-muted-foreground font-normal">
                    :{" "}
                    {attr.options.find((o) => o.id === selected)?.label ??
                      attr.options.find((o) => o.id === selected)?.value}
                  </span>
                )}
              </div>

              {dt === "select" ? (
                <select
                  aria-label={attr.name}
                  className="h-11 w-full sm:w-64 rounded-xl border border-border bg-card px-3 text-sm"
                  value={selected ?? ""}
                  onChange={(e) => setSelection((s) => ({ ...s, [attr.id]: e.target.value }))}
                >
                  <option value="" disabled>
                    Choose {attr.name}
                  </option>
                  {attr.options.map((o) => {
                    const enabled = isOptionEnabled(attr.id, o.id);
                    return (
                      <option key={o.id} value={o.id} disabled={!enabled}>
                        {o.label ?? o.value}
                        {!enabled ? " (unavailable)" : ""}
                      </option>
                    );
                  })}
                </select>
              ) : dt === "color" ? (
                <div className="flex flex-wrap gap-2">
                  {attr.options.map((o) => {
                    const on = selected === o.id;
                    const enabled = isOptionEnabled(attr.id, o.id);
                    return (
                      <button
                        key={o.id}
                        type="button"
                        aria-label={o.label ?? o.value}
                        aria-pressed={on}
                        disabled={!enabled}
                        onClick={() => setSelection((s) => ({ ...s, [attr.id]: o.id }))}
                        className={`relative h-10 w-10 rounded-full border-2 transition-smooth focus:outline-none focus:ring-2 focus:ring-primary ${
                          on ? "border-primary ring-2 ring-primary/40" : "border-border"
                        } ${!enabled ? "opacity-40 cursor-not-allowed" : "hover:scale-105"}`}
                        style={{ backgroundColor: o.color ?? "#e5e7eb" }}
                        title={o.label ?? o.value}
                      >
                        {on && <Check className="h-4 w-4 text-white drop-shadow absolute inset-0 m-auto" />}
                      </button>
                    );
                  })}
                </div>
              ) : dt === "image" ? (
                <div className="flex flex-wrap gap-2">
                  {attr.options.map((o) => {
                    const on = selected === o.id;
                    const enabled = isOptionEnabled(attr.id, o.id);
                    return (
                      <button
                        key={o.id}
                        type="button"
                        aria-label={o.label ?? o.value}
                        aria-pressed={on}
                        disabled={!enabled}
                        onClick={() => setSelection((s) => ({ ...s, [attr.id]: o.id }))}
                        className={`h-16 w-16 rounded-xl border-2 overflow-hidden bg-card transition-smooth focus:outline-none focus:ring-2 focus:ring-primary ${
                          on ? "border-primary" : "border-border"
                        } ${!enabled ? "opacity-40 cursor-not-allowed" : "hover:border-primary"}`}
                      >
                        {o.image ? (
                          <img src={o.image} alt={o.label ?? o.value} className="h-full w-full object-cover" />
                        ) : (
                          <span className="text-xs">{o.label ?? o.value}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ) : (
                // "button" (default fallback)
                <div className="flex flex-wrap gap-2">
                  {attr.options.map((o) => {
                    const on = selected === o.id;
                    const enabled = isOptionEnabled(attr.id, o.id);
                    return (
                      <button
                        key={o.id}
                        type="button"
                        aria-pressed={on}
                        disabled={!enabled}
                        onClick={() => setSelection((s) => ({ ...s, [attr.id]: o.id }))}
                        className={`min-h-11 px-4 rounded-xl border text-sm font-medium transition-smooth focus:outline-none focus:ring-2 focus:ring-primary ${
                          on
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-card hover:border-primary"
                        } ${!enabled ? "opacity-40 line-through cursor-not-allowed" : ""}`}
                      >
                        {o.label ?? o.value}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Price + variant meta */}
      <div className="rounded-2xl bg-gradient-to-br from-primary/5 to-secondary/5 border border-primary/20 p-5">
        <div key={priceKey} className="animate-fade-in flex items-end gap-3 flex-wrap">
          <div className="text-4xl font-bold text-primary">${price.toFixed(2)}</div>
          {compareAt && compareAt > price && (
            <div className="flex gap-2 items-center">
              <span className="text-sm text-muted-foreground line-through">${compareAt.toFixed(2)}</span>
              <span className="text-xs font-bold text-accent">
                Save ${(compareAt - price).toFixed(2)}
              </span>
            </div>
          )}
          {activeVariant?.delivery_type && (
            <div className="sm:ml-auto inline-flex items-center gap-2 text-sm font-semibold text-accent">
              <Zap className="h-4 w-4" /> {activeVariant.delivery_type}
            </div>
          )}
        </div>

        {activeVariant && (
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            {activeVariant.sku && (
              <div>
                <div className="text-muted-foreground">SKU</div>
                <div className="font-semibold">{activeVariant.sku}</div>
              </div>
            )}
            <div>
              <div className="text-muted-foreground">Stock</div>
              <div className="font-semibold">
                {outOfStock ? (
                  <span className="text-destructive">Out of stock</span>
                ) : activeVariant.stock != null && activeVariant.stock <= 5 ? (
                  <span className="text-accent">Only {activeVariant.stock} left</span>
                ) : (
                  <span className="text-emerald-600">Available</span>
                )}
              </div>
            </div>
            {activeVariant.subscription_pool_id && (
              <div>
                <div className="text-muted-foreground">Type</div>
                <div className="font-semibold">Subscription</div>
              </div>
            )}
            {activeVariant.license_pool_id && (
              <div>
                <div className="text-muted-foreground">Type</div>
                <div className="font-semibold">License</div>
              </div>
            )}
          </div>
        )}
      </div>

      {!fullySelected && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <AlertTriangle className="h-4 w-4" /> Please select all options.
        </div>
      )}

      {/* Qty + Buy */}
      <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 sm:flex sm:flex-wrap sm:items-center sticky bottom-0 sm:static bg-background/95 sm:bg-transparent backdrop-blur sm:backdrop-blur-none py-3 sm:py-0 -mx-4 px-4 sm:mx-0 sm:px-0 border-t sm:border-0 border-border z-10">
        <div className="inline-flex items-center rounded-xl border border-border bg-card">
          <button
            onClick={() => setQty(Math.max(1, qty - 1))}
            className="w-10 h-11 grid place-items-center hover:bg-muted rounded-l-xl"
            aria-label="Decrease quantity"
          >
            −
          </button>
          <span className="w-10 text-center font-semibold" aria-live="polite">{qty}</span>
          <button
            onClick={() => setQty(qty + 1)}
            className="w-10 h-11 grid place-items-center hover:bg-muted rounded-r-xl"
            aria-label="Increase quantity"
          >
            +
          </button>
        </div>
        <button
          onClick={() => handleAdd(false)}
          disabled={!canBuy}
          className="min-w-0 flex-1 inline-flex items-center justify-center gap-2 h-11 px-4 sm:px-5 rounded-xl bg-card border border-primary text-primary font-semibold hover:bg-primary/5 transition-smooth disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ShoppingCart className="h-4 w-4" />
          {outOfStock ? "Out of Stock" : "Add to Cart"}
        </button>
        <button
          onClick={() => handleAdd(true)}
          disabled={!canBuy}
          className="col-span-2 sm:col-span-1 min-w-0 flex-1 inline-flex items-center justify-center gap-2 h-11 px-4 sm:px-5 rounded-xl bg-gradient-primary text-primary-foreground font-semibold shadow-glow hover:opacity-95 transition-smooth disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Zap className="h-4 w-4" />
          {outOfStock ? "Unavailable" : "Buy Now"}
        </button>
      </div>
    </div>
  );
}
