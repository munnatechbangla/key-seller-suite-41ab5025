// Homepage Builder — single JSON config stored in `site_settings`
// (group_key='homepage', setting_key='config'). Every section is editable
// from the Admin Panel. Defaults mirror the original `home.ts` values so the
// storefront keeps rendering even when the row is missing.
import { create } from "zustand";
import { supabase } from "@/integrations/supabase/client";
import type { IconName } from "./icons";
import {
  heroConfig as defaultHero,
  trustStripItems as defaultTrust,
  categoriesSection as defaultCategories,
  productSections as defaultProductSections,
  whyChooseSection as defaultWhyChooseSection,
  whyChooseItems as defaultWhyChoose,
  statsItems as defaultStats,
  testimonialsSection as defaultTestimonialsSection,
  testimonials as defaultTestimonials,
  homeFaqs as defaultFaqs,
  faqSection as defaultFaqSection,
  newsletterCta as defaultNewsletter,
} from "./home";
import { footerColumns as defaultFooterColumns, siteConfig as defaultSiteConfig } from "./site";

// ---------------- Types ----------------

export type HeroProductSource = "manual" | "featured" | "latest";

export type HomeHero = {
  enabled: boolean;
  badge: { icon: IconName; text: string };
  title: { lead: string; accent: string };
  description: string;
  primaryCta: { label: string; to: string; icon?: IconName };
  secondaryCta: { label: string; href: string; icon?: IconName };
  trustItems: { id: string; icon: IconName; label: string }[];
  featureBadges?: HeroFeatureBadge[];
  /** @deprecated use productSource + manualProductSlugs */
  floatingProductSlugs: string[];
  productSource?: HeroProductSource;
  manualProductSlugs?: string[];
};

export type HeroFeatureBadge = {
  id: string;
  enabled: boolean;
  icon: IconName;
  title: string;
  subtitle?: string;
  url?: string;
};

export const HERO_FEATURE_BADGES_MAX = 6;

export type HomeTrustItem = { id: string; icon: IconName; title: string; desc: string; enabled: boolean };

export type HomeCategorySource = "manual" | "featured" | "latest";

export type HomeCategoriesSection = {
  enabled: boolean;
  eyebrow: string;
  title: string;
  subtitle: string;
  viewAllLabel: string;
  limit: number;
  source?: HomeCategorySource;
  manualCategoryIds?: string[];
  featuredCategoryIds?: string[];
};

export type HomeProductSectionSource = "featured" | "trending" | "bestSellers" | "latest" | "manual";

export type HomeSectionCountdown = {
  enabled: boolean;
  endsAt: string; // ISO date string
  label?: string;
  hideAfterExpiry: boolean;
  expiredMessage?: string;
};

export type HomeProductSection = {
  id: string;
  enabled: boolean;
  eyebrow: string;
  title: string;
  subtitle: string;
  source: HomeProductSectionSource;
  limit: number;
  manualProductSlugs?: string[];
  countdown?: HomeSectionCountdown;
};


export type HomeWhyChooseItem = { id: string; icon: IconName; title: string; desc: string; enabled: boolean };
export type HomeWhyChoose = { enabled: boolean; eyebrow: string; title: string; items: HomeWhyChooseItem[] };

export type HomeStatItem = { id: string; icon?: IconName; value: string; label: string; enabled: boolean };
export type HomeStats = { enabled: boolean; items: HomeStatItem[] };

export type HomeTestimonial = { id: string; name: string; role: string; emoji: string; rating: number; text: string; enabled: boolean };
export type HomeTestimonialsSort = "latest" | "random";
export type HomeTestimonials = {
  enabled: boolean;
  eyebrow: string;
  title: string;
  /** @deprecated no longer used — testimonials come from approved product reviews */
  items: HomeTestimonial[];
  limit: number;
  minRating: number;
  sort: HomeTestimonialsSort;
};

export type HomeBlog = {
  enabled: boolean;
  eyebrow: string;
  title: string;
  subtitle: string;
  limit: number;
  showImage: boolean;
  showDate: boolean;
  showExcerpt: boolean;
  showReadMore: boolean;
  viewAllLabel: string;
};

export type HomeFaqItem = { id: string; q: string; a: string; enabled: boolean };
export type HomeFaq = { enabled: boolean; eyebrow: string; title: string; items: HomeFaqItem[] };

export type HomeNewsletter = {
  enabled: boolean;
  badge: { icon: IconName; text: string };
  title: string;
  subtitle: string;
  placeholder: string;
  buttonLabel: string;
  buttonIcon: IconName;
  successMessage: string;
};

export type HomeAnnouncementBar = {
  enabled: boolean;
  text: string;
  highlight: string;
  buttonLabel: string;
  buttonUrl: string;
  countdownEnabled: boolean;
  countdownEndsAt: string; // ISO date string
  backgroundColor: string; // CSS color, empty = default gradient
  textColor: string; // CSS color, empty = default
  closable: boolean;
  sticky: boolean;
  showOnDesktop: boolean;
  showOnMobile: boolean;
};

export type HeaderNavItem = {
  id: string;
  label: string;
  url: string;
  enabled: boolean;
  exact?: boolean;
};

export type HomeHeaderNav = {
  items: HeaderNavItem[];
};

export type HomePaymentLogo = {
  id: string;
  enabled: boolean;
  logo: string; // media:// token or absolute URL
  title: string;
  subtitle?: string;
  url?: string;
  badge?: string;
};

export type HomePaymentMethods = {
  enabled: boolean;
  title: string;
  subtitle: string;
  trustLabel: string;
  logos: HomePaymentLogo[];
  logosMigrated?: boolean;
};

// Stable section ids drive both visibility and rendering order.
export type SectionId =
  | "hero"
  | "trust"
  | "categories"
  | "productSections"
  | "whyChoose"
  | "stats"
  | "testimonials"
  | "blog"
  | "faq"
  | "paymentMethods"
  | "newsletter";

export type HomepageConfig = {
  sectionOrder: SectionId[];
  hero: HomeHero;
  trust: { enabled: boolean; items: HomeTrustItem[] };
  categories: HomeCategoriesSection;
  productSections: HomeProductSection[];
  whyChoose: HomeWhyChoose;
  stats: HomeStats;
  testimonials: HomeTestimonials;
  blog: HomeBlog;
  faq: HomeFaq;
  newsletter: HomeNewsletter;
  paymentMethods: HomePaymentMethods;
  announcementBar: HomeAnnouncementBar;
  headerNav: HomeHeaderNav;
};

// ---------------- Defaults ----------------

const uid = (p: string, i: number) => `${p}-${i + 1}`;

export const STATS_DEFAULT_ICONS: IconName[] = ["Users", "Gift", "Star", "Headphones"];

export const defaultHomepageConfig: HomepageConfig = {
  sectionOrder: [
    "hero",
    "trust",
    "categories",
    "productSections",
    "whyChoose",
    "stats",
    "testimonials",
    "blog",
    "faq",
    "paymentMethods",
    "newsletter",
  ],
  hero: {
    enabled: true,
    badge: defaultHero.badge,
    title: defaultHero.title,
    description: defaultHero.description,
    primaryCta: {
      label: defaultHero.ctas[0]?.label ?? "Browse Products",
      to: defaultHero.ctas[0]?.to ?? "/products",
      icon: defaultHero.ctas[0]?.icon,
    },
    secondaryCta: {
      label: defaultHero.ctas[1]?.label ?? "Watch Demo",
      href: defaultHero.ctas[1]?.href ?? "#",
      icon: defaultHero.ctas[1]?.icon,
    },
    trustItems: defaultHero.trustItems.map((t, i) => ({ id: uid("hero-trust", i), ...t })),
    featureBadges: defaultHero.trustItems.slice(0, HERO_FEATURE_BADGES_MAX).map((t, i) => ({
      id: uid("hero-badge", i),
      enabled: true,
      icon: t.icon,
      title: t.label,
      subtitle: "",
      url: "",
    })),
    floatingProductSlugs: defaultHero.floatingProductSlugs.slice(0, 12),
    productSource: "manual",
    manualProductSlugs: defaultHero.floatingProductSlugs.slice(0, 12),
  },
  trust: {
    enabled: true,
    items: defaultTrust.map((t, i) => ({ id: uid("trust", i), enabled: true, ...t })),
  },
  categories: {
    enabled: true,
    eyebrow: defaultCategories.eyebrow,
    title: defaultCategories.title,
    subtitle: defaultCategories.subtitle,
    viewAllLabel: defaultCategories.viewAllLabel,
    limit: 10,
    source: "manual",
    manualCategoryIds: [],
    featuredCategoryIds: [],
  },
  productSections: defaultProductSections.map((s) => ({
    id: s.id,
    enabled: true,
    eyebrow: s.eyebrow,
    title: s.title,
    subtitle: s.subtitle ?? "",
    source: s.source,
    limit: s.limit ?? 8,
  })),
  whyChoose: {
    enabled: true,
    eyebrow: defaultWhyChooseSection.eyebrow,
    title: defaultWhyChooseSection.title,
    items: defaultWhyChoose.map((w, i) => ({ id: uid("why", i), enabled: true, ...w })),
  },
  stats: {
    enabled: true,
    items: defaultStats.map((s, i) => ({
      id: uid("stat", i),
      enabled: true,
      icon: STATS_DEFAULT_ICONS[i % STATS_DEFAULT_ICONS.length],
      value: s.value,
      label: s.label,
    })),
  },
  testimonials: {
    enabled: true,
    eyebrow: defaultTestimonialsSection.eyebrow,
    title: defaultTestimonialsSection.title,
    items: defaultTestimonials.map((t, i) => ({ id: uid("test", i), enabled: true, ...t })),
    limit: 6,
    minRating: 4,
    sort: "latest",
  },
  blog: {
    enabled: true,
    eyebrow: "From the blog",
    title: "Guides, reviews and pro tips",
    subtitle: "",
    limit: 3,
    showImage: true,
    showDate: true,
    showExcerpt: true,
    showReadMore: true,
    viewAllLabel: "View all articles",
  },
  faq: {
    enabled: true,
    eyebrow: defaultFaqSection.eyebrow,
    title: defaultFaqSection.title,
    items: defaultFaqs.map((f, i) => ({ id: uid("faq", i), enabled: true, q: f.q, a: f.a })),
  },
  newsletter: {
    enabled: true,
    badge: defaultNewsletter.badge,
    title: defaultNewsletter.title,
    subtitle: defaultNewsletter.subtitle,
    placeholder: defaultNewsletter.placeholder,
    buttonLabel: defaultNewsletter.button.label,
    buttonIcon: defaultNewsletter.button.icon,
    successMessage: "Thanks — check your inbox to confirm.",
  },
  paymentMethods: {
    enabled: true,
    title: "We accept secure payments",
    subtitle: "Pay confidently with your preferred provider — all transactions are encrypted.",
    trustLabel: "100% Secure Checkout",
    logos: [],
    logosMigrated: false,
  },
  announcementBar: {
    enabled: true,
    text: "Up to 70% OFF on Premium Digital Products • Instant Delivery 24/7",
    highlight: "🔥 Flash Sale",
    buttonLabel: "Shop deals",
    buttonUrl: "/products?flash-sale=true",
    countdownEnabled: false,
    countdownEndsAt: "",
    backgroundColor: "",
    textColor: "",
    closable: false,
    sticky: false,
    showOnDesktop: true,
    showOnMobile: true,
  },
  headerNav: {
    items: [
      { id: "nav-home", label: "Home", url: "/", enabled: true, exact: true },
      { id: "nav-products", label: "Products", url: "/products", enabled: true },
      { id: "nav-categories", label: "Categories", url: "/categories", enabled: true },
      { id: "nav-blog", label: "Blog", url: "/blog", enabled: true },
      { id: "nav-about", label: "About", url: "/about", enabled: true },
      { id: "nav-contact", label: "Contact", url: "/contact", enabled: true },
    ],
  },
};

// ---------------- Store ----------------

type State = {
  config: HomepageConfig;
  loaded: boolean;
  load: () => Promise<void>;
  setLocal: (next: HomepageConfig) => void;
};

export function mergeConfig(base: HomepageConfig, override: Partial<HomepageConfig> | null | undefined): HomepageConfig {
  if (!override) return base;
  return {
    ...base,
    ...override,
    hero: (() => {
      const merged = { ...base.hero, ...(override.hero ?? {}) };
      const fb = (override.hero as HomeHero | undefined)?.featureBadges;
      merged.featureBadges =
        Array.isArray(fb) && fb.length > 0 ? fb.slice(0, HERO_FEATURE_BADGES_MAX) : base.hero.featureBadges;
      return merged;
    })(),
    trust: { ...base.trust, ...(override.trust ?? {}) },
    categories: { ...base.categories, ...(override.categories ?? {}) },
    whyChoose: { ...base.whyChoose, ...(override.whyChoose ?? {}) },
    stats: (() => {
      const merged = { ...base.stats, ...(override.stats ?? {}) };
      merged.items = (merged.items ?? []).map((it, i) => ({
        ...it,
        icon: it.icon ?? STATS_DEFAULT_ICONS[i % STATS_DEFAULT_ICONS.length],
      }));
      return merged;
    })(),
    testimonials: { ...base.testimonials, ...(override.testimonials ?? {}) },
    blog: { ...base.blog, ...(override.blog ?? {}) },
    faq: { ...base.faq, ...(override.faq ?? {}) },
    newsletter: { ...base.newsletter, ...(override.newsletter ?? {}) },
    paymentMethods: (() => {
      const merged = { ...base.paymentMethods, ...(override.paymentMethods ?? {}) };
      merged.logos = Array.isArray(merged.logos) ? merged.logos : [];
      return merged;
    })(),
    announcementBar: { ...base.announcementBar, ...(override.announcementBar ?? {}) },
    headerNav: {
      items:
        Array.isArray(override.headerNav?.items) && override.headerNav!.items.length > 0
          ? override.headerNav!.items
          : base.headerNav.items,
    },
    productSections: Array.isArray(override.productSections) ? override.productSections : base.productSections,
    sectionOrder: Array.isArray(override.sectionOrder) && override.sectionOrder.length > 0 ? override.sectionOrder : base.sectionOrder,
  };
}

export const useHomepage = create<State>((set) => ({
  config: defaultHomepageConfig,
  loaded: false,
  setLocal: (next) => set({ config: next, loaded: true }),
  load: async () => {
    try {
      const { data, error } = await supabase
        .from("site_settings")
        .select("value")
        .eq("group_key", "homepage")
        .eq("setting_key", "config")
        .maybeSingle();
      if (error || !data) {
        set({ loaded: true });
        return;
      }
      const merged = mergeConfig(defaultHomepageConfig, data.value as Partial<HomepageConfig>);
      set({ config: merged, loaded: true });
    } catch {
      set({ loaded: true });
    }
  },
}));

// ---------------- Helpers ----------------

export function reorder<T>(arr: T[], from: number, to: number): T[] {
  if (to < 0 || to >= arr.length) return arr;
  const next = arr.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export const newId = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
