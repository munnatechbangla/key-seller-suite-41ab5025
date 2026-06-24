export * from "./icons";
export * from "./site";
export * from "./home";

import { products, featured, trending, bestSellers, type Product } from "@/lib/catalog";
import type { ProductSection } from "./home";

export function resolveProductSection(section: ProductSection): Product[] {
  const source =
    section.source === "featured" ? featured :
    section.source === "trending" ? trending :
    bestSellers;
  return section.limit ? source.slice(0, section.limit) : source;
}

export function resolveProductsBySlugs(slugs: string[]): Product[] {
  return slugs.map((s) => products.find((p) => p.slug === s)).filter((p): p is Product => Boolean(p));
}
