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
  /** @deprecated use productSource + manualProductSlugs */
  floatingProductSlugs: string[];
  productSource?: HeroProductSource;
  manualProductSlugs?: string[];
};

export type HomeTrustItem = { id: string; icon: IconName; title: string; desc: string; enabled: boolean };

export type HomeCategoriesSection = {
  enabled: boolean;
  eyebrow: string;
  title: string;
  subtitle: string;
  viewAllLabel: string;
  limit: number;
};

export type HomeProductSection = {
  id: string;
  enabled: boolean;
  eyebrow: string;
  title: string;
  subtitle: string;
  source: "featured" | "trending" | "bestSellers";
  limit: number;
};

export type HomeWhyChooseItem = { id: string; icon: IconName; title: string; desc: string; enabled: boolean };
export type HomeWhyChoose = { enabled: boolean; eyebrow: string; title: string; items: HomeWhyChooseItem[] };

export type HomeStatItem = { id: string; icon?: IconName; value: string; label: string; enabled: boolean };
export type HomeStats = { enabled: boolean; items: HomeStatItem[] };

export type HomeTestimonial = { id: string; name: string; role: string; emoji: string; rating: number; text: string; enabled: boolean };
export type HomeTestimonials = { enabled: boolean; eyebrow: string; title: string; items: HomeTestimonial[] };

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

export type HomePaymentMethods = {
  enabled: boolean;
  title: string;
  subtitle: string;
  trustLabel: string;
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
    items: defaultStats.map((s, i) => ({ id: uid("stat", i), enabled: true, value: s.value, label: s.label })),
  },
  testimonials: {
    enabled: true,
    eyebrow: defaultTestimonialsSection.eyebrow,
    title: defaultTestimonialsSection.title,
    items: defaultTestimonials.map((t, i) => ({ id: uid("test", i), enabled: true, ...t })),
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
    hero: { ...base.hero, ...(override.hero ?? {}) },
    trust: { ...base.trust, ...(override.trust ?? {}) },
    categories: { ...base.categories, ...(override.categories ?? {}) },
    whyChoose: { ...base.whyChoose, ...(override.whyChoose ?? {}) },
    stats: { ...base.stats, ...(override.stats ?? {}) },
    testimonials: { ...base.testimonials, ...(override.testimonials ?? {}) },
    blog: { ...base.blog, ...(override.blog ?? {}) },
    faq: { ...base.faq, ...(override.faq ?? {}) },
    newsletter: { ...base.newsletter, ...(override.newsletter ?? {}) },
    paymentMethods: { ...base.paymentMethods, ...(override.paymentMethods ?? {}) },
    announcementBar: { ...base.announcementBar, ...(override.announcementBar ?? {}) },
    productSections: override.productSections ?? base.productSections,
    sectionOrder: override.sectionOrder ?? base.sectionOrder,
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
