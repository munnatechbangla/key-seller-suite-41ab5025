// Centralized SEO helper. Reads from the white-label settings store with a
// safe default fallback so head() works on both SSR and client.
import { defaultSettings, useSettings } from "./settings";

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
  return getSettings().seo.site_url || "";
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

/** Build a page title: "Page — Site Name" (or just Site Title for root). */
export function pageTitle(label?: string): string {
  const name = siteName();
  if (!label) return getSettings().seo.site_title || `${name}`;
  return `${label} — ${name}`;
}

/** Standard meta array for a route head(). */
export function seoMeta(opts: {
  title?: string;
  description?: string;
  ogTitle?: string;
  ogType?: string;
  image?: string;
  url?: string;
}) {
  const title = pageTitle(opts.title);
  const description = opts.description || siteDescription();
  const ogTitleVal = opts.ogTitle ? pageTitle(opts.ogTitle) : title;
  const image = opts.image || ogImage();
  const url = opts.url || siteUrl();
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
  return meta;
}
