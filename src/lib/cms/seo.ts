// Centralized SEO helper. Reads from the white-label settings store with a
// safe default fallback so head() works on both SSR and client. All values
// are dynamic — no hardcoded domain or brand.
import { defaultSettings, useSettings } from "./settings";
import { formatPriceWithSymbol } from "@/lib/currency";

export function getSettings() {
  try {
    return useSettings.getState().settings;
  } catch {
    return defaultSettings;
  }
}

export function siteName(): string {
  return getSettings().branding.name || defaultSettings.branding.name;
}

export function siteTagline(): string {
  return getSettings().branding.tagline || defaultSettings.branding.tagline;
}

export function siteDescription(): string {
  return getSettings().seo.meta_description || getSettings().branding.description || defaultSettings.seo.meta_description;
}

export function siteUrl(): string {
  const u = getSettings().seo.site_url || "";
  return u.replace(/\/$/, "");
}

export function ogImage(): string {
  return getSettings().seo.og_image || "";
}

export function twitterImage(): string {
  return getSettings().seo.twitter_image || getSettings().seo.og_image || "";
}

export function twitterHandle(): string {
  return getSettings().seo.twitter_handle || "";
}

export function logoUrl(): string {
  return getSettings().branding.logo_url || "";
}

/** Build an absolute URL when site_url is set; otherwise return the relative path. */
export function absUrl(path: string): string {
  const base = siteUrl();
  const clean = path.startsWith("/") ? path : `/${path}`;
  return base ? `${base}${clean}` : clean;
}

/** Build a page title: "Page — Site Name" (or just Site Title for root). */
export function pageTitle(label?: string): string {
  const name = siteName();
  if (!label) return getSettings().seo.site_title || `${name}`;
  return `${label} — ${name}`;
}

/** Standard meta array for a route head(). Pass `path` for self-referencing og:url. */
export function seoMeta(opts: {
  title?: string;
  description?: string;
  ogTitle?: string;
  ogType?: string;
  image?: string;
  path?: string;
  url?: string;
  noindex?: boolean;
}) {
  const title = pageTitle(opts.title);
  const description = opts.description || siteDescription();
  const ogTitleVal = opts.ogTitle ? pageTitle(opts.ogTitle) : title;
  const image = opts.image || ogImage();
  const url = opts.url || (opts.path ? absUrl(opts.path) : siteUrl());
  const handle = twitterHandle();
  const meta: Array<Record<string, string>> = [
    { title },
    { name: "description", content: description },
    { property: "og:title", content: ogTitleVal },
    { property: "og:description", content: description },
    { property: "og:type", content: opts.ogType || "website" },
    { property: "og:site_name", content: siteName() },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: ogTitleVal },
    { name: "twitter:description", content: description },
  ];
  if (image) {
    meta.push({ property: "og:image", content: image });
    meta.push({ name: "twitter:image", content: twitterImage() || image });
  }
  if (url) meta.push({ property: "og:url", content: url });
  if (handle) meta.push({ name: "twitter:site", content: handle });
  if (opts.noindex) meta.push({ name: "robots", content: "noindex,nofollow" });
  return meta;
}

/** Canonical <link> entry. Pass to head().links — leaf routes only. */
export function canonicalLink(path: string) {
  return { rel: "canonical" as const, href: absUrl(path) };
}

// -------------------- JSON-LD builders --------------------

export function organizationJsonLd() {
  const s = getSettings();
  const url = siteUrl();
  const logo = logoUrl();
  const sameAs = Object.values(s.social).filter(Boolean);
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: siteName(),
    description: siteDescription(),
    ...(url && { url }),
    ...(logo && { logo }),
    ...(sameAs.length && { sameAs }),
    ...(s.contact.support_email && {
      contactPoint: [{
        "@type": "ContactPoint",
        email: s.contact.support_email,
        contactType: "customer support",
        ...(s.contact.phone && { telephone: s.contact.phone }),
      }],
    }),
  };
}

export function websiteJsonLd() {
  const url = siteUrl();
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: siteName(),
    ...(url && { url }),
    ...(url && {
      potentialAction: {
        "@type": "SearchAction",
        target: `${url}/search?q={search_term_string}`,
        "query-input": "required name=search_term_string",
      },
    }),
  };
}

export function breadcrumbJsonLd(items: Array<{ name: string; path: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: absUrl(it.path),
    })),
  };
}

export function productJsonLd(p: {
  name: string;
  slug: string;
  description?: string | null;
  image?: string | null;
  price: number;
  oldPrice?: number;
  currency?: string;
  rating?: number;
  reviews?: number;
  brand?: string;
  category?: string;
  sku?: string;
  inStock?: boolean;
  reviewSamples?: Array<{
    author: string;
    rating: number;
    body?: string | null;
    title?: string | null;
    createdAt?: string;
  }>;
}) {
  const currency = p.currency || getSettings().payment.currency || "USD";
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    ...(p.description && { description: p.description }),
    ...(p.image && { image: [p.image] }),
    ...(p.sku && { sku: p.sku }),
    ...(p.brand && { brand: { "@type": "Brand", name: p.brand } }),
    ...(p.category && { category: p.category }),
    offers: {
      "@type": "Offer",
      url: absUrl(`/products/${p.slug}`),
      priceCurrency: currency,
      price: p.price.toFixed(2),
      availability: `https://schema.org/${p.inStock === false ? "OutOfStock" : "InStock"}`,
      itemCondition: "https://schema.org/NewCondition",
    },
  };
  if (p.rating && p.reviews && p.reviews > 0) {
    data.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: p.rating.toFixed(1),
      reviewCount: p.reviews,
    };
  }
  if (p.reviewSamples && p.reviewSamples.length > 0) {
    data.review = p.reviewSamples.map((r) => ({
      "@type": "Review",
      reviewRating: { "@type": "Rating", ratingValue: r.rating, bestRating: 5 },
      author: { "@type": "Person", name: r.author },
      ...(r.title && { name: r.title }),
      ...(r.body && { reviewBody: r.body }),
      ...(r.createdAt && { datePublished: r.createdAt }),
    }));
  }
  return data;
}

export function faqJsonLd(items: Array<{ q: string; a: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((it) => ({
      "@type": "Question",
      name: it.q,
      acceptedAnswer: { "@type": "Answer", text: it.a },
    })),
  };
}

export function articleJsonLd(a: {
  title: string;
  slug: string;
  description?: string;
  image?: string;
  author?: string;
  publishedAt?: string;
  updatedAt?: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: a.title,
    ...(a.description && { description: a.description }),
    ...(a.image && { image: [a.image] }),
    ...(a.author && { author: { "@type": "Person", name: a.author } }),
    ...(a.publishedAt && { datePublished: a.publishedAt }),
    ...(a.updatedAt && { dateModified: a.updatedAt }),
    publisher: {
      "@type": "Organization",
      name: siteName(),
      ...(logoUrl() && { logo: { "@type": "ImageObject", url: logoUrl() } }),
    },
    mainEntityOfPage: absUrl(`/blog/${a.slug}`),
  };
}

/** Helper to drop a JSON-LD object into head().scripts. */
export function jsonLdScript(data: unknown) {
  return {
    type: "application/ld+json" as const,
    children: JSON.stringify(data),
  };
}
