// White-label conversion / marketplace features config.
// Stored as a single JSON blob in site_settings (group_key='marketplace', setting_key='config').
import { create } from "zustand";
import { supabase } from "@/integrations/supabase/client";

export type RecentlyPurchasedConfig = {
  enabled: boolean;
  demo_mode: boolean;
  min_delay_seconds: number;
  max_delay_seconds: number;
  display_seconds: number;
  show_country: boolean;
  hide_after_close: boolean;
};

export type LiveVisitorsConfig = {
  enabled_product: boolean;
  enabled_home: boolean;
  min_visitors: number;
  max_visitors: number;
  refresh_seconds: number;
  text_template: string; // {n} placeholder
};

export type BadgeConfig = {
  enabled: boolean;
  label: string;
  color: string;        // background
  text_color: string;
};

export type SocialProofConfig = {
  sold_count: BadgeConfig & { threshold: number }; // hide if sales < threshold
  low_stock: BadgeConfig & { threshold: number };  // show if stock <= threshold
  bestseller: BadgeConfig;
  trending: BadgeConfig;
  new_arrival: BadgeConfig & { days: number };
};

export type ProductExperienceConfig = {
  quick_view_enabled: boolean;
  sticky_buy_bar_enabled: boolean;
  share_buttons_enabled: boolean;
};

export type MarketplaceConfig = {
  recently_purchased: RecentlyPurchasedConfig;
  live_visitors: LiveVisitorsConfig;
  social_proof: SocialProofConfig;
  product_experience: ProductExperienceConfig;
  ui: {
    animation_speed_ms: number;
  };
};

export const defaultMarketplace: MarketplaceConfig = {
  recently_purchased: {
    enabled: true,
    demo_mode: true,
    min_delay_seconds: 8,
    max_delay_seconds: 25,
    display_seconds: 6,
    show_country: true,
    hide_after_close: true,
  },
  live_visitors: {
    enabled_product: true,
    enabled_home: false,
    min_visitors: 8,
    max_visitors: 64,
    refresh_seconds: 12,
    text_template: "{n} people are viewing this right now",
  },
  social_proof: {
    sold_count:  { enabled: true,  label: "{n} sold",       color: "#0EA5E9", text_color: "#ffffff", threshold: 5 },
    low_stock:   { enabled: true,  label: "Only {n} left",  color: "#EF4444", text_color: "#ffffff", threshold: 5 },
    bestseller:  { enabled: true,  label: "Bestseller",     color: "#F59E0B", text_color: "#1f1300" },
    trending:    { enabled: true,  label: "Trending",       color: "#8B5CF6", text_color: "#ffffff" },
    new_arrival: { enabled: true,  label: "New",            color: "#10B981", text_color: "#ffffff", days: 14 },
  },
  ui: { animation_speed_ms: 300 },
};

function deepMerge<T>(base: T, over: any): T {
  if (!over || typeof over !== "object") return base;
  const out: any = Array.isArray(base) ? [...(base as any)] : { ...(base as any) };
  for (const k of Object.keys(over)) {
    const bv = (base as any)?.[k];
    const ov = over[k];
    out[k] = bv && typeof bv === "object" && !Array.isArray(bv) ? deepMerge(bv, ov) : ov;
  }
  return out;
}

type State = {
  config: MarketplaceConfig;
  loaded: boolean;
  load: () => Promise<void>;
  setLocal: (c: MarketplaceConfig) => void;
};

export const useMarketplace = create<State>((set) => ({
  config: defaultMarketplace,
  loaded: false,
  setLocal: (c) => set({ config: c, loaded: true }),
  load: async () => {
    try {
      const { data } = await supabase
        .from("site_settings")
        .select("value")
        .eq("group_key", "marketplace")
        .eq("setting_key", "config")
        .maybeSingle();
      const merged = deepMerge(defaultMarketplace, (data?.value as any) ?? {});
      set({ config: merged, loaded: true });
    } catch {
      set({ loaded: true });
    }
  },
}));

export function formatBadge(template: string, n: number): string {
  return template.replace("{n}", String(n));
}
