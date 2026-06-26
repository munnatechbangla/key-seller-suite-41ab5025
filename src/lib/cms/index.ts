export * from "./icons";
export * from "./site";
export * from "./home";
export * from "./homepage";

import {
  featuredQuery,
  trendingQuery,
  bestSellersQuery,
  productsBySlugsQuery,
  type Product,
} from "@/lib/catalog";
import { useSuspenseQuery } from "@tanstack/react-query";
import type { ProductSection } from "./home";

function curationQuery(source: ProductSection["source"]) {
  if (source === "featured") return featuredQuery();
  if (source === "trending") return trendingQuery();
  return bestSellersQuery();
}

export function useProductSection(section: ProductSection): Product[] {
  const items = useSuspenseQuery(curationQuery(section.source)).data;
  return section.limit ? items.slice(0, section.limit) : items;
}

export function useResolvedProducts(slugs: string[]): Product[] {
  return useSuspenseQuery(productsBySlugsQuery(slugs)).data;
}
