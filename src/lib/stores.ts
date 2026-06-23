import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Product } from "./catalog";

type CartItem = { slug: string; qty: number; product: Product };

type CartState = {
  items: CartItem[];
  coupon: string | null;
  add: (p: Product, qty?: number) => void;
  remove: (slug: string) => void;
  setQty: (slug: string, qty: number) => void;
  clear: () => void;
  applyCoupon: (code: string) => boolean;
  subtotal: () => number;
  discount: () => number;
  total: () => number;
  count: () => number;
};

const COUPONS: Record<string, number> = { TOPUP10: 0.1, WELCOME15: 0.15, FLASH25: 0.25 };

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      coupon: null,
      add: (p, qty = 1) =>
        set((s) => {
          const ex = s.items.find((i) => i.slug === p.slug);
          if (ex) return { items: s.items.map((i) => (i.slug === p.slug ? { ...i, qty: i.qty + qty } : i)) };
          return { items: [...s.items, { slug: p.slug, qty, product: p }] };
        }),
      remove: (slug) => set((s) => ({ items: s.items.filter((i) => i.slug !== slug) })),
      setQty: (slug, qty) =>
        set((s) => ({ items: s.items.map((i) => (i.slug === slug ? { ...i, qty: Math.max(1, qty) } : i)) })),
      clear: () => set({ items: [], coupon: null }),
      applyCoupon: (code) => {
        const c = code.trim().toUpperCase();
        if (COUPONS[c] != null) {
          set({ coupon: c });
          return true;
        }
        return false;
      },
      subtotal: () => get().items.reduce((s, i) => s + i.product.price * i.qty, 0),
      discount: () => {
        const c = get().coupon;
        return c ? get().subtotal() * (COUPONS[c] ?? 0) : 0;
      },
      total: () => Math.max(0, get().subtotal() - get().discount()),
      count: () => get().items.reduce((s, i) => s + i.qty, 0),
    }),
    { name: "topuphut-cart" },
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

export const useWishlist = makeSlugList("topuphut-wishlist");
export const useCompare = makeSlugList("topuphut-compare");

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
    { name: "topuphut-recent" },
  ),
);

type User = { name: string; email: string };
type AuthState = {
  user: User | null;
  login: (email: string, _password: string) => void;
  register: (name: string, email: string, _password: string) => void;
  logout: () => void;
};
export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      login: (email) => set({ user: { name: email.split("@")[0], email } }),
      register: (name, email) => set({ user: { name, email } }),
      logout: () => set({ user: null }),
    }),
    { name: "topuphut-auth" },
  ),
);
