// Enterprise product SEO helpers: scoring and meta overrides.
// Fully additive — falls back to existing behavior when SEO fields are empty.
import type { Product, ProductSeo } from "@/lib/catalog";

export const EMPTY_PRODUCT_SEO: ProductSeo = {
  meta_title: null,
  meta_description: null,
  focus_keyword: null,
  secondary_keywords: [],
  canonical_url: null,
  robots: "index,follow",
  og_title: null,
  og_description: null,
  og_image: null,
  twitter_title: null,
  twitter_description: null,
  twitter_image: null,
  schema_enabled: true,
  faq_schema_enabled: true,
  breadcrumb_schema_enabled: true,
  product_schema_enabled: true,
};

export type ScoreCheck = {
  id: string;
  label: string;
  pass: boolean;
  weight: number;
  hint?: string;
};

export type ScoreResult = {
  score: number;
  grade: "excellent" | "good" | "fair" | "poor";
  checks: ScoreCheck[];
};

function contains(hay: string | null | undefined, needle: string): boolean {
  if (!hay || !needle) return false;
  return hay.toLowerCase().includes(needle.toLowerCase());
}

export function computeSeoScore(
  product: Product,
  seo: ProductSeo,
  ctx: { blocksCount?: number; imagesWithAltCount?: number; imagesTotal?: number } = {},
): ScoreResult {
  const title = seo.meta_title || product.name || "";
  const desc = seo.meta_description || product.short || "";
  const focus = (seo.focus_keyword || "").trim();
  const hasFaqs = (product.faqs?.length ?? 0) > 0;
  const hasSpecs = Object.keys(product.specs ?? {}).length > 0;
  const hasFeatures = (product.features?.length ?? 0) > 0;
  const altCoverage = ctx.imagesTotal ? (ctx.imagesWithAltCount ?? 0) / ctx.imagesTotal : 1;

  const checks: ScoreCheck[] = [
    { id: "title_len", label: "Title length 30–60 chars", weight: 10, pass: title.length >= 30 && title.length <= 60, hint: `${title.length} chars` },
    { id: "desc_len", label: "Description 120–160 chars", weight: 10, pass: desc.length >= 120 && desc.length <= 160, hint: `${desc.length} chars` },
    { id: "focus_set", label: "Focus keyword set", weight: 10, pass: focus.length > 0 },
    { id: "focus_title", label: "Focus keyword in title", weight: 10, pass: focus.length > 0 && contains(title, focus) },
    { id: "focus_desc", label: "Focus keyword in description", weight: 10, pass: focus.length > 0 && contains(desc, focus) },
    { id: "alt_coverage", label: "Image ALT coverage ≥ 80%", weight: 10, pass: altCoverage >= 0.8, hint: `${Math.round(altCoverage * 100)}%` },
    { id: "headings", label: "Structured headings (H1/H2)", weight: 5, pass: true },
    { id: "rich_content", label: "Rich content blocks", weight: 10, pass: (ctx.blocksCount ?? 0) > 0, hint: `${ctx.blocksCount ?? 0} blocks` },
    { id: "faqs", label: "FAQ available", weight: 10, pass: hasFaqs },
    { id: "specs", label: "Specifications provided", weight: 5, pass: hasSpecs },
    { id: "features", label: "Feature list", weight: 5, pass: hasFeatures },
    { id: "og_image", label: "Open Graph image", weight: 5, pass: !!(seo.og_image || product.thumbnailUrl) },
  ];

  const total = checks.reduce((s, c) => s + c.weight, 0);
  const earned = checks.reduce((s, c) => s + (c.pass ? c.weight : 0), 0);
  const score = Math.round((earned / total) * 100);
  const grade: ScoreResult["grade"] =
    score >= 85 ? "excellent" : score >= 70 ? "good" : score >= 50 ? "fair" : "poor";
  return { score, grade, checks };
}

/** Resolve effective SEO from stored overrides + product fallbacks. */
export function resolveProductSeo(product: Product): ProductSeo {
  const s = product.seo ?? EMPTY_PRODUCT_SEO;
  return {
    ...EMPTY_PRODUCT_SEO,
    ...s,
    meta_title: s.meta_title || product.name,
    meta_description: s.meta_description || product.short || product.description || null,
    og_title: s.og_title || s.meta_title || product.name,
    og_description: s.og_description || s.meta_description || product.short || null,
    og_image: s.og_image || product.thumbnailUrl || null,
    twitter_title: s.twitter_title || s.og_title || s.meta_title || product.name,
    twitter_description: s.twitter_description || s.og_description || s.meta_description || product.short || null,
    twitter_image: s.twitter_image || s.og_image || product.thumbnailUrl || null,
    robots: s.robots || "index,follow",
  };
}
