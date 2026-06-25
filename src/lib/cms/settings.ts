// White-label runtime settings. Loaded from `site_settings` table with the
// existing TopupHut config as fallback so nothing breaks if the row is missing.
import { create } from "zustand";
import { supabase } from "@/integrations/supabase/client";
import { siteConfig, socialLinks as defaultSocial } from "./site";

export type SiteBranding = {
  name: string;
  brand_lead: string;
  brand_accent: string;
  tagline: string;
  description: string;
  logo_url: string;
  favicon_url: string;
  footer_text: string;
  copyright: string;
};

export type SiteContact = {
  support_email: string;
  phone: string;
  whatsapp: string;
  telegram: string;
  address: string;
};

export type SeoDefaults = {
  site_title: string;
  meta_description: string;
  site_url: string;
  og_image: string;
  twitter_image: string;
  twitter_handle: string;
};

export type EmailSenders = {
  sender_name: string;
  sender_email: string;
  support_email: string;
  reply_to: string;
};

export type SocialLinksMap = {
  facebook: string;
  twitter: string;
  instagram: string;
  youtube: string;
  tiktok: string;
  linkedin: string;
};

export type PaymentConfig = {
  currency: string;
  currency_symbol: string;
  sslcommerz_enabled: boolean;
  bkash_enabled: boolean;
  nagad_enabled: boolean;
  rocket_enabled: boolean;
  stripe_enabled: boolean;
  paypal_enabled: boolean;
  manual_enabled: boolean;
  manual_instructions: string;
};

export type AllSettings = {
  branding: SiteBranding;
  contact: SiteContact;
  seo: SeoDefaults;
  email: EmailSenders;
  social: SocialLinksMap;
  payment: PaymentConfig;
};

export const defaultSettings: AllSettings = {
  branding: {
    name: siteConfig.name,
    brand_lead: siteConfig.brandSplit.lead,
    brand_accent: siteConfig.brandSplit.accent,
    tagline: siteConfig.tagline,
    description: siteConfig.description,
    logo_url: "",
    favicon_url: "",
    footer_text: "Crafted for digital enthusiasts. Instant delivery worldwide.",
    copyright: "© {year} {name}. All rights reserved.",
  },
  contact: {
    support_email: siteConfig.email,
    phone: "",
    whatsapp: siteConfig.whatsapp,
    telegram: siteConfig.telegram,
    address: "",
  },
  seo: {
    site_title: `${siteConfig.name} — Premium Digital Products`,
    meta_description: siteConfig.description,
    site_url: "",
    og_image: "",
    twitter_image: "",
    twitter_handle: "",
  },
  email: {
    sender_name: siteConfig.name,
    sender_email: "",
    support_email: siteConfig.email,
    reply_to: "",
  },
  social: {
    facebook: defaultSocial.find((s) => s.label === "Facebook")?.href ?? "",
    twitter: defaultSocial.find((s) => s.label === "Twitter")?.href ?? "",
    instagram: defaultSocial.find((s) => s.label === "Instagram")?.href ?? "",
    youtube: defaultSocial.find((s) => s.label === "YouTube")?.href ?? "",
    tiktok: "",
    linkedin: "",
  },
  payment: {
    currency: "USD",
    currency_symbol: "$",
    sslcommerz_enabled: false,
    bkash_enabled: false,
    nagad_enabled: false,
    rocket_enabled: false,
    stripe_enabled: false,
    paypal_enabled: false,
    manual_enabled: true,
    manual_instructions: "",
  },
};

type SettingsState = {
  settings: AllSettings;
  loaded: boolean;
  load: () => Promise<void>;
  setLocal: (next: AllSettings) => void;
};

function merge<T extends object>(base: T, override: Partial<T> | undefined | null): T {
  if (!override) return base;
  return { ...base, ...override } as T;
}

export const useSettings = create<SettingsState>((set) => ({
  settings: defaultSettings,
  loaded: false,
  setLocal: (next) => set({ settings: next, loaded: true }),
  load: async () => {
    try {
      const { data, error } = await supabase
        .from("site_settings")
        .select("group_key, setting_key, value");
      if (error || !data) {
        set({ loaded: true });
        return;
      }
      const next: AllSettings = JSON.parse(JSON.stringify(defaultSettings));
      for (const row of data) {
        const v = row.value as Record<string, unknown>;
        if (row.group_key === "site" && row.setting_key === "branding") {
          next.branding = merge(next.branding, v as Partial<SiteBranding>);
        } else if (row.group_key === "site" && row.setting_key === "contact") {
          next.contact = merge(next.contact, v as Partial<SiteContact>);
        } else if (row.group_key === "seo" && row.setting_key === "defaults") {
          next.seo = merge(next.seo, v as Partial<SeoDefaults>);
        } else if (row.group_key === "email" && row.setting_key === "senders") {
          next.email = merge(next.email, v as Partial<EmailSenders>);
        } else if (row.group_key === "social" && row.setting_key === "links") {
          next.social = merge(next.social, v as Partial<SocialLinksMap>);
        } else if (row.group_key === "payment" && row.setting_key === "config") {
          next.payment = merge(next.payment, v as Partial<PaymentConfig>);
        }
      }
      set({ settings: next, loaded: true });
    } catch {
      set({ loaded: true });
    }
  },
}));

export function formatCopyright(template: string, name: string): string {
  return template
    .replace("{year}", String(new Date().getFullYear()))
    .replace("{name}", name);
}
