import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Product } from "./catalog";
import { track } from "./analytics/track";

type CartItem = { slug: string; qty: number; product: Product };

type CartState = {
  items: CartItem[];
  coupon: string | null;
  couponDiscount: number;
  add: (p: Product, qty?: number) => void;
  remove: (slug: string) => void;
  setQty: (slug: string, qty: number) => void;
  clear: () => void;
  setCoupon: (code: string, discount: number) => void;
  clearCoupon: () => void;
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
      add: (p, qty = 1) =>
        set((s) => {
          const ex = s.items.find((i) => i.slug === p.slug);
          if (ex) return { items: s.items.map((i) => (i.slug === p.slug ? { ...i, qty: i.qty + qty } : i)) };
          return { items: [...s.items, { slug: p.slug, qty, product: p }] };
        }),
      remove: (slug) => set((s) => ({ items: s.items.filter((i) => i.slug !== slug) })),
      setQty: (slug, qty) =>
        set((s) => ({ items: s.items.map((i) => (i.slug === slug ? { ...i, qty: Math.max(1, qty) } : i)) })),
      clear: () => set({ items: [], coupon: null, couponDiscount: 0 }),
      setCoupon: (code, discount) => set({ coupon: code.trim().toUpperCase(), couponDiscount: discount }),
      clearCoupon: () => set({ coupon: null, couponDiscount: 0 }),
      subtotal: () => get().items.reduce((s, i) => s + i.product.price * i.qty, 0),
      discount: () => {
        const sub = get().subtotal();
        return Math.min(get().couponDiscount, sub);
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
