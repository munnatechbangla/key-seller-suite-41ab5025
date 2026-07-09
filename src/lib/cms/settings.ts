// White-label runtime settings. Loaded from `site_settings` table with the
// existing demo config as fallback so nothing breaks if the row is missing.
import { create } from "zustand";
import { supabase } from "@/integrations/supabase/client";
import { siteConfig, socialLinks as defaultSocial } from "./site";

import brandOg from "@/assets/digitalnest-og.jpg.asset.json";

export type SiteBranding = {
  name: string;
  brand_lead: string;
  brand_accent: string;
  tagline: string;
  description: string;
  logo_url: string;
  light_logo_url: string;
  dark_logo_url: string;
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
  telegram: string;
  discord: string;
  github: string;
};


export type PaymentConfig = {
  currency: string;
  currency_symbol: string;
  sslcommerz_enabled: boolean;
  sslcommerz_mode: "sandbox" | "live";
  bkash_enabled: boolean;
  bkash_mode: "sandbox" | "live";
  nagad_enabled: boolean;
  nagad_mode: "sandbox" | "live";
  rocket_enabled: boolean;
  stripe_enabled: boolean;
  stripe_mode: "sandbox" | "live";
  paypal_enabled: boolean;
  paypal_mode: "sandbox" | "live";
  manual_enabled: boolean;
  manual_instructions: string;
};

export type AnalyticsConfig = {
  ga4_enabled: boolean;
  ga4_id: string;
  gtm_enabled: boolean;
  gtm_id: string;
  meta_pixel_enabled: boolean;
  meta_pixel_id: string;
  custom_header_enabled: boolean;
  custom_header: string;
  custom_footer_enabled: boolean;
  custom_footer: string;
};

export type ThemeConfig = {
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  font_family: string;
  font_url: string;
};

export type SupportConfig = {
  whatsapp_number: string;
  whatsapp_button_text: string;
  greeting_message: string;
  support_name: string;
  working_hours: string;
  enable_whatsapp: boolean;
  enable_telegram: boolean;
  enable_email: boolean;
  enable_live_chat: boolean;
};

export type SeoCenterConfig = {
  // Global SEO
  organization_type: string;
  company_name: string;
  canonical_domain: string;
  default_robots: string;
  default_og_image: string;
  default_twitter_image: string;
  // Verification
  google_site_verification: string;
  bing_site_verification: string;
  yandex_verification: string;
  pinterest_verification: string;
  facebook_domain_verification: string;
  // Extra Analytics
  tiktok_pixel_id: string;
  clarity_id: string;
  linkedin_partner_id: string;
  snap_pixel_id: string;
  custom_analytics: string;
  // Custom scripts
  head_scripts: string;
  body_start_scripts: string;
  body_end_scripts: string;
  footer_scripts: string;
  // Cookie consent
  cookie_enabled: boolean;
  cookie_banner_text: string;
  cookie_accept_label: string;
  cookie_reject_label: string;
  cookie_preferences_label: string;
  cookie_privacy_url: string;
  // Performance
  preconnect_urls: string;
  dns_prefetch_urls: string;
  lazy_loading: boolean;
  image_optimization: boolean;
  font_optimization: boolean;
  // Extra social
  extra_social: { label: string; href: string }[];
};

export type AllSettings = {
  branding: SiteBranding;
  contact: SiteContact;
  seo: SeoDefaults;
  email: EmailSenders;
  social: SocialLinksMap;
  payment: PaymentConfig;
  analytics: AnalyticsConfig;
  theme: ThemeConfig;
  support: SupportConfig;
  seo_center: SeoCenterConfig;
};

export const defaultSettings: AllSettings = {
  branding: {
    name: siteConfig.name,
    brand_lead: siteConfig.brandSplit.lead,
    brand_accent: siteConfig.brandSplit.accent,
    tagline: siteConfig.tagline,
    description: siteConfig.description,
    logo_url: "",
    light_logo_url: "",
    dark_logo_url: "",
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
    og_image: brandOg.url,
    twitter_image: brandOg.url,
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
    telegram: "",
    discord: "",
    github: "",
  },

  payment: {
    currency: "USD",
    currency_symbol: "$",
    sslcommerz_enabled: false,
    sslcommerz_mode: "sandbox",
    bkash_enabled: false,
    bkash_mode: "sandbox",
    nagad_enabled: false,
    nagad_mode: "sandbox",
    rocket_enabled: false,
    stripe_enabled: false,
    stripe_mode: "sandbox",
    paypal_enabled: false,
    paypal_mode: "sandbox",
    manual_enabled: true,
    manual_instructions: "",
  },
  analytics: {
    ga4_enabled: false,
    ga4_id: "",
    gtm_enabled: false,
    gtm_id: "",
    meta_pixel_enabled: false,
    meta_pixel_id: "",
    custom_header_enabled: false,
    custom_header: "",
    custom_footer_enabled: false,
    custom_footer: "",
  },
  theme: {
    primary_color: "#6C5CE7",
    secondary_color: "#8E44AD",
    accent_color: "#00D084",
    font_family: "Poppins",
    font_url: "https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&display=swap",
  },
  support: {
    whatsapp_number: "",
    whatsapp_button_text: "WhatsApp Support",
    greeting_message:
      "Hello,\nI need help regarding my order.\n\nOrder Number: {{order_number}}\nCustomer: {{customer_name}}\nEmail: {{customer_email}}\nStatus: {{order_status}}",
    support_name: "Support Team",
    working_hours: "Sat–Thu, 10:00–20:00",
    enable_whatsapp: true,
    enable_telegram: false,
    enable_email: true,
    enable_live_chat: false,
  },
  seo_center: {
    organization_type: "Organization",
    company_name: "",
    canonical_domain: "",
    default_robots: "index,follow",
    default_og_image: "",
    default_twitter_image: "",
    google_site_verification: "",
    bing_site_verification: "",
    yandex_verification: "",
    pinterest_verification: "",
    facebook_domain_verification: "",
    tiktok_pixel_id: "",
    clarity_id: "",
    linkedin_partner_id: "",
    snap_pixel_id: "",
    custom_analytics: "",
    head_scripts: "",
    body_start_scripts: "",
    body_end_scripts: "",
    footer_scripts: "",
    cookie_enabled: false,
    cookie_banner_text: "We use cookies to improve your experience. By using our site, you agree to our cookie policy.",
    cookie_accept_label: "Accept all",
    cookie_reject_label: "Reject",
    cookie_preferences_label: "Preferences",
    cookie_privacy_url: "/privacy",
    preconnect_urls: "",
    dns_prefetch_urls: "",
    lazy_loading: true,
    image_optimization: true,
    font_optimization: true,
    extra_social: [],
  },
};

type SettingsState = {
  settings: AllSettings;
  loaded: boolean;
  /** Cached resolved (signed) URL for branding.logo_url. Signed once per source-value change. */
  resolvedLogoUrl: string;
  /** Cached resolved (signed) URL for branding.favicon_url. */
  resolvedFaviconUrl: string;
  /** True only while the initial resolve is in-flight (first load / after save). */
  resolvingMedia: boolean;
  load: () => Promise<void>;
  setLocal: (next: AllSettings) => void;
};

function merge<T extends object>(base: T, override: Partial<T> | undefined | null): T {
  if (!override) return base;
  return { ...base, ...override } as T;
}

// Module-level cache of last-resolved source values. Skips re-signing when unchanged
// across page navigations, mounts, or repeat load() calls.
let lastResolvedLogoSrc: string | null = null;
let lastResolvedFaviconSrc: string | null = null;

// ---- Persistent branding cache (localStorage) ----
const BRANDING_CACHE_KEY = "dn.branding.cache.v1";
type BrandingCache = {
  logoSrc: string;
  faviconSrc: string;
  resolvedLogoUrl: string;
  resolvedFaviconUrl: string;
};

function readBrandingCache(): BrandingCache | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(BRANDING_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BrandingCache;
    if (typeof parsed?.resolvedLogoUrl !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeBrandingCache(c: BrandingCache) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(BRANDING_CACHE_KEY, JSON.stringify(c));
  } catch { /* ignore quota */ }
}

const hydrated = readBrandingCache();
if (hydrated) {
  lastResolvedLogoSrc = hydrated.logoSrc;
  lastResolvedFaviconSrc = hydrated.faviconSrc;
}

async function resolveBrandingMedia(
  branding: SiteBranding,
  set: (p: Partial<SettingsState>) => void,
  get: () => SettingsState,
) {
  const logoSrc = branding.logo_url || "";
  const favSrc = branding.favicon_url || "";
  const needsLogo = logoSrc !== lastResolvedLogoSrc;
  const needsFav = favSrc !== lastResolvedFaviconSrc;
  if (!needsLogo && !needsFav) return;
  set({ resolvingMedia: true });
  const { resolveStoredUrlAsync } = await import("@/lib/media/resolve");
  const [logo, fav] = await Promise.all([
    needsLogo ? resolveStoredUrlAsync(logoSrc) : Promise.resolve(undefined),
    needsFav ? resolveStoredUrlAsync(favSrc) : Promise.resolve(undefined),
  ]);
  const patch: Partial<SettingsState> = { resolvingMedia: false };
  if (logo !== undefined) { patch.resolvedLogoUrl = logo; lastResolvedLogoSrc = logoSrc; }
  if (fav !== undefined) { patch.resolvedFaviconUrl = fav; lastResolvedFaviconSrc = favSrc; }
  set(patch);
  const s = get();
  writeBrandingCache({
    logoSrc: lastResolvedLogoSrc ?? "",
    faviconSrc: lastResolvedFaviconSrc ?? "",
    resolvedLogoUrl: patch.resolvedLogoUrl ?? s.resolvedLogoUrl,
    resolvedFaviconUrl: patch.resolvedFaviconUrl ?? s.resolvedFaviconUrl,
  });
}

export const useSettings = create<SettingsState>((set, get) => ({
  settings: defaultSettings,
  loaded: false,
  resolvedLogoUrl: hydrated?.resolvedLogoUrl ?? "",
  resolvedFaviconUrl: hydrated?.resolvedFaviconUrl ?? "",
  resolvingMedia: false,
  setLocal: (next) => {
    set({ settings: next, loaded: true });
    void resolveBrandingMedia(next.branding, (p) => set(p as SettingsState), get);
  },
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
        } else if (row.group_key === "analytics" && row.setting_key === "config") {
          next.analytics = merge(next.analytics, v as Partial<AnalyticsConfig>);
        } else if (row.group_key === "theme" && row.setting_key === "config") {
          next.theme = merge(next.theme, v as Partial<ThemeConfig>);
        } else if (row.group_key === "site" && row.setting_key === "support") {
          next.support = merge(next.support, v as Partial<SupportConfig>);
        } else if (row.group_key === "seo_center" && row.setting_key === "config") {
          next.seo_center = merge(next.seo_center, v as Partial<SeoCenterConfig>);
        }
      }
      set({ settings: next, loaded: true });
      await resolveBrandingMedia(next.branding, (p) => set(p as SettingsState), get);
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
