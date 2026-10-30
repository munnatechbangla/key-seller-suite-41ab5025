export * from "./icons";
export * from "./site";
export * from "./home";
export * from "./homepage";

import {
  featuredQuery,
  trendingQuery,
  bestSellersQuery,
  heroLatestQuery,
  productsBySlugsQuery,
  productsQuery,
  type Product,
} from "@/lib/catalog";
import { useSuspenseQuery } from "@tanstack/react-query";
import type { HomeProductSection, HomeProductSectionSource } from "./homepage";

function curationQuery(
  source: Exclude<HomeProductSectionSource, "manual">,
  categorySlug?: string,
  limit?: number,
): ReturnType<typeof featuredQuery> {
  if (source === "featured") return featuredQuery();
  if (source === "trending") return trendingQuery();
  if (source === "latest") return heroLatestQuery(24) as unknown as ReturnType<typeof featuredQuery>;
  if (source === "bestSellers") return bestSellersQuery();
  if (source === "allProducts") {
    return productsQuery({ sort: "newest", limit: limit || undefined }) as unknown as ReturnType<typeof featuredQuery>;
  }
  // An unselected category intentionally returns no products, never the full catalog.
  return productsQuery({
    categorySlug: categorySlug || "__no-category-selected__",
    sort: "newest",
    limit: limit || undefined,
  }) as unknown as ReturnType<typeof featuredQuery>;
}



/**
 * Resolves the products for a homepage product section.
 * - "manual" with slugs → productsBySlugs (preserves order)
 * - "manual" with empty slugs → falls back to "featured"
 * - any other source → the matching curated list
 */
export function useProductSection(section: Pick<HomeProductSection, "source" | "limit" | "manualProductSlugs">): Product[] {
  const manualSlugs = section.manualProductSlugs ?? [];
  const useManual = section.source === "manual" && manualSlugs.length > 0;
  const fallbackSource: Exclude<HomeProductSectionSource, "manual"> =
    section.source === "manual" ? "featured" : section.source;

  const manual = useSuspenseQuery(productsBySlugsQuery(manualSlugs));
  const curated = useSuspenseQuery(curationQuery(fallbackSource, section.categorySlug, section.limit));

  const items = useManual ? manual.data : curated.data;
  return section.limit ? items.slice(0, section.limit) : items;
}


export function useResolvedProducts(slugs: string[]): Product[] {
  return useSuspenseQuery(productsBySlugsQuery(slugs)).data;
}
