import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Product } from "./catalog";
import { track } from "./analytics/track";
import { storageKey } from "./storage-slug";

/**
 * P2D — Cart line items may carry a variant snapshot. When a variant is set,
 * `slug` is a compound line key (`${productSlug}::${variantId}`) so that
 * different variants of the same product coexist, while `productSlug` is
 * the actual product slug used for links and downstream lookups. Products
 * without variants keep `slug === productSlug` — fully backward compatible.
 */
export type CartVariantMeta = {
  variant_id: string;
  variant_name: string;
  sku: string | null;
  price: number;
  sale_price: number | null;
  thumbnail_url: string | null;
  selected_attributes: Record<string, string>;
  delivery_type: string | null;
  inventory_pool_id: string | null;
  subscription_pool_id: string | null;
  license_pool_id: string | null;
  smm_config_snapshot?: any | null;
};

type CartItem = {
  slug: string;              // line-id (variant-aware); backward-compat: equals productSlug when no variant
  productSlug: string;
  qty: number;
  product: Product;
  variant?: CartVariantMeta;
  smm_config_snapshot?: any;
  smm_quantity?: number;
};

function effectiveUnitPrice(i: CartItem): number {
  if (i.variant) return i.variant.sale_price != null && i.variant.sale_price > 0 ? i.variant.sale_price : i.variant.price;
  if (i.product.product_type === "smm_service" && i.smm_quantity && i.smm_config_snapshot) {
    const { calculateSMMPrice } = require("./catalog");
    return calculateSMMPrice(i.smm_quantity, i.smm_config_snapshot) / i.smm_quantity;
  }
  return i.product.price;
}

type CartState = {
  items: CartItem[];
  coupon: string | null;
  couponDiscount: number;
  productFieldValues: Record<string, Record<string, string>>; // productSlug -> field_id -> value
  add: (p: Product, qty?: number, variant?: CartVariantMeta, smmConfig?: any, smmQty?: number) => void;
  remove: (slug: string) => void;
  setQty: (slug: string, qty: number) => void;
  clear: () => void;
  setCoupon: (code: string, discount: number) => void;
  clearCoupon: () => void;
  setProductField: (productSlug: string, fieldId: string, value: string) => void;
  clearProductFields: (productSlugs?: string[]) => void;
  subtotal: () => number;
  discount: () => number;
  total: () => number;
  count: () => number;
};

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      coupon: null,
      couponDiscount: 0,
      productFieldValues: {},
      add: (p, qty = 1, variant, smmConfig, smmQty) =>
        set((s) => {
          const lineKey = variant ? `${p.slug}::${variant.variant_id}` : p.slug;
          let unit = variant
            ? (variant.sale_price != null && variant.sale_price > 0 ? variant.sale_price : variant.price)
            : p.price;
            
          if (p.product_type === "smm_service" && smmQty && smmConfig) {
            const { calculateSMMPrice } = require("./catalog");
            unit = calculateSMMPrice(smmQty, smmConfig) / smmQty;
          }
          track("add_to_cart", {
            currency: "USD",
            value: unit * qty,
            items: [{
              item_id: lineKey, item_name: variant ? `${p.name} — ${variant.variant_name}` : p.name,
              price: unit, quantity: qty, item_category: p.category,
            }],
          });
          const ex = s.items.find((i) => i.slug === lineKey);
          if (ex) return { items: s.items.map((i) => (i.slug === lineKey ? { ...i, qty: i.qty + qty } : i)) };
          return {
            items: [...s.items, { 
              slug: lineKey, 
              productSlug: p.slug, 
              qty: smmQty || qty, 
              product: p, 
              variant,
              smm_config_snapshot: smmConfig,
              smm_quantity: smmQty
            }],
          };
        }),
      remove: (slug) => set((s) => ({ items: s.items.filter((i) => i.slug !== slug) })),
      setQty: (slug, qty) =>
        set((s) => ({ items: s.items.map((i) => (i.slug === slug ? { ...i, qty: Math.max(1, qty) } : i)) })),
      clear: () => set({ items: [], coupon: null, couponDiscount: 0, productFieldValues: {} }),
      setCoupon: (code, discount) => {
        track("coupon_applied", { coupon: code.trim().toUpperCase(), discount });
        set({ coupon: code.trim().toUpperCase(), couponDiscount: discount });
      },
      clearCoupon: () => set({ coupon: null, couponDiscount: 0 }),
      setProductField: (productSlug, fieldId, value) =>
        set((s) => ({
          productFieldValues: {
            ...s.productFieldValues,
            [productSlug]: { ...(s.productFieldValues[productSlug] ?? {}), [fieldId]: value },
          },
        })),
      clearProductFields: (productSlugs) =>
        set((s) => {
          if (!productSlugs || productSlugs.length === 0) return { productFieldValues: {} };
          const next = { ...s.productFieldValues };
          for (const sl of productSlugs) delete next[sl];
          return { productFieldValues: next };
        }),
      subtotal: () => get().items.reduce((s, i) => s + effectiveUnitPrice(i) * i.qty, 0),
      discount: () => {
        const sub = get().subtotal();
        return Math.min(get().couponDiscount, sub);
      },
      total: () => Math.max(0, get().subtotal() - get().discount()),
      count: () => get().items.reduce((s, i) => s + i.qty, 0),
    }),

    {
      name: storageKey("cart"),
      merge: (persisted, current) => ({
        ...current,
        ...(persisted as object),
        productFieldValues: (persisted as any)?.productFieldValues ?? {},
      }),
    },
  ),
);

type SlugListState = {
  slugs: string[];
  toggle: (slug: string) => void;
  has: (slug: string) => boolean;
  remove: (slug: string) => void;
  clear: () => void;
};

const makeSlugList = (name: string) =>
  create<SlugListState>()(
    persist(
      (set, get) => ({
        slugs: [],
        toggle: (slug) =>
          set((s) => ({ slugs: s.slugs.includes(slug) ? s.slugs.filter((x) => x !== slug) : [...s.slugs, slug] })),
        has: (slug) => get().slugs.includes(slug),
        remove: (slug) => set((s) => ({ slugs: s.slugs.filter((x) => x !== slug) })),
        clear: () => set({ slugs: [] }),
      }),
      { name },
    ),
  );

export const useWishlist = makeSlugList(storageKey("wishlist"));
export const useCompare = makeSlugList(storageKey("compare"));

type RecentState = {
  slugs: string[];
  push: (slug: string) => void;
};
export const useRecent = create<RecentState>()(
  persist(
    (set) => ({
      slugs: [],
      push: (slug) => set((s) => ({ slugs: [slug, ...s.slugs.filter((x) => x !== slug)].slice(0, 8) })),
    }),
    { name: storageKey("recent") },
  ),
);

import { supabase } from "@/integrations/supabase/client";
import type { User as SupabaseUser } from "@supabase/supabase-js";

export type AuthUser = { id: string; name: string; email: string; avatar?: string };
type AuthState = {
  user: AuthUser | null;
  loading: boolean;
  initialized: boolean;
  init: () => () => void;
  login: (email: string, password: string) => Promise<{ error: string | null }>;
  register: (name: string, email: string, password: string) => Promise<{ error: string | null }>;
  logout: () => Promise<void>;
};

const toAuthUser = (u: SupabaseUser | null | undefined): AuthUser | null => {
  if (!u) return null;
  const meta = (u.user_metadata ?? {}) as Record<string, unknown>;
  const name = (meta.full_name as string) || (meta.name as string) || (u.email?.split("@")[0] ?? "User");
  return {
    id: u.id,
    email: u.email ?? "",
    name,
    avatar: (meta.avatar_url as string) || undefined,
  };
};

export const useAuth = create<AuthState>()((set, get) => ({
  user: null,
  loading: true,
  initialized: false,
  init: () => {
    if (get().initialized) return () => {};
    set({ initialized: true });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      set({ user: toAuthUser(session?.user), loading: false });
    });
    void supabase.auth.getSession().then(({ data }) => {
      set({ user: toAuthUser(data.session?.user), loading: false });
    });
    return () => sub.subscription.unsubscribe();
  },
  login: async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  },
  register: async (name, email, password) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
        data: { full_name: name },
      },
    });
    return { error: error?.message ?? null };
  },
  logout: async () => {
    await supabase.auth.signOut();
  },
}));
