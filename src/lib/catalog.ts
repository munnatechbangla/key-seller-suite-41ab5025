import { queryOptions, useSuspenseQuery, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ---------------- Types (UI contract) ----------------
export type Category = {
  id: string;
  slug: string;
  name: string;
  emoji: string;
  description: string;
  count: number;
};

export type ProductBadge = string;

export type Product = {
  id: string;
  slug: string;
  name: string;
  category: string; // category slug (for filter/display)
  categoryName?: string;
  emoji: string;
  price: number;
  oldPrice?: number;
  rating: number;
  reviews: number;
  badge?: ProductBadge;
  delivery: string;
  short: string;
  description?: string;
  features?: string[];
  included?: string[];
  specs?: Record<string, string>;
  faqs?: { q: string; a: string }[];
  stock?: number;
  thumbnailUrl?: string | null;
  seo?: ProductSeo | null;
  hasAttributes?: boolean;
  priceFrom?: number | null;
  oldPriceFrom?: number | null;
};


export type ProductSeo = {
  meta_title: string | null;
  meta_description: string | null;
  focus_keyword: string | null;
  secondary_keywords: string[];
  canonical_url: string | null;
  robots: string | null;
  og_title: string | null;
  og_description: string | null;
  og_image: string | null;
  twitter_title: string | null;
  twitter_description: string | null;
  twitter_image: string | null;
  schema_enabled: boolean;
  faq_schema_enabled: boolean;
  breadcrumb_schema_enabled: boolean;
  product_schema_enabled: boolean;
};

// ---------------- Row -> UI mapping ----------------
type ProductRow = {
  id: string;
  slug: string;
  title: string;
  short_description: string | null;
  description: string | null;
  regular_price: number;
  sale_price: number | null;
  thumbnail_url: string | null;
  emoji: string | null;
  delivery_time: string | null;
  badge: string | null;
  rating: number;
  reviews_count: number;
  features: string[];
  included: string[];
  specs: Record<string, string>;
  stock_status: "in_stock" | "out_of_stock" | "on_backorder";
  product_categories?: { slug: string; name: string } | null;
  meta_title?: string | null;
  meta_description?: string | null;
  focus_keyword?: string | null;
  secondary_keywords?: unknown;
  canonical_url?: string | null;
  robots?: string | null;
  og_title?: string | null;
  og_description?: string | null;
  og_image?: string | null;
  twitter_title?: string | null;
  twitter_description?: string | null;
  twitter_image?: string | null;
  schema_enabled?: boolean | null;
  faq_schema_enabled?: boolean | null;
  breadcrumb_schema_enabled?: boolean | null;
  product_schema_enabled?: boolean | null;
};

const SELECT_PRODUCT = `
  id, slug, title, short_description, description,
  regular_price, sale_price, thumbnail_url, emoji, delivery_time, badge,
  rating, reviews_count, features, included, specs, stock_status,
  meta_title, meta_description, focus_keyword, secondary_keywords, canonical_url, robots,
  og_title, og_description, og_image, twitter_title, twitter_description, twitter_image,
  schema_enabled, faq_schema_enabled, breadcrumb_schema_enabled, product_schema_enabled,
  product_categories ( slug, name )
` as const;

export function mapProduct(row: ProductRow): Product {
  const price = row.sale_price != null ? Number(row.sale_price) : Number(row.regular_price);
  const oldPrice = row.sale_price != null ? Number(row.regular_price) : undefined;
  return {
    id: row.id,
    slug: row.slug,
    name: row.title,
    category: row.product_categories?.slug ?? "uncategorized",
    categoryName: row.product_categories?.name,
    emoji: row.emoji ?? "📦",
    price,
    oldPrice,
    rating: Number(row.rating ?? 0),
    reviews: row.reviews_count ?? 0,
    badge: row.badge ?? undefined,
    delivery: row.delivery_time ?? "Instant",
    short: row.short_description ?? "",
    description: row.description ?? undefined,
    features: row.features ?? [],
    included: row.included ?? [],
    specs: row.specs ?? {},
    stock: row.stock_status === "in_stock" ? 50 : 0,
    thumbnailUrl: row.thumbnail_url,
    seo: {
      meta_title: row.meta_title ?? null,
      meta_description: row.meta_description ?? null,
      focus_keyword: row.focus_keyword ?? null,
      secondary_keywords: Array.isArray(row.secondary_keywords) ? (row.secondary_keywords as string[]) : [],
      canonical_url: row.canonical_url ?? null,
      robots: row.robots ?? null,
      og_title: row.og_title ?? null,
      og_description: row.og_description ?? null,
      og_image: row.og_image ?? null,
      twitter_title: row.twitter_title ?? null,
      twitter_description: row.twitter_description ?? null,
      twitter_image: row.twitter_image ?? null,
      schema_enabled: row.schema_enabled ?? true,
      faq_schema_enabled: row.faq_schema_enabled ?? true,
      breadcrumb_schema_enabled: row.breadcrumb_schema_enabled ?? true,
      product_schema_enabled: row.product_schema_enabled ?? true,
    },
  };
}

// ---------------- API ----------------
async function fetchCategories(): Promise<Category[]> {
  const { data, error } = await supabase
    .from("product_categories")
    .select("id, slug, name, description, icon")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  // Get counts (one query)
  const { data: counts } = await supabase
    .from("products")
    .select("category_id")
    .eq("status", "published");
  const tally = new Map<string, number>();
  (counts ?? []).forEach((c) => {
    if (c.category_id) tally.set(c.category_id, (tally.get(c.category_id) ?? 0) + 1);
  });
  return (data ?? []).map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    description: r.description ?? "",
    emoji: r.icon ?? "📦",
    count: tally.get(r.id) ?? 0,
  }));
}

export type ProductSort = "popular" | "newest" | "oldest" | "price-asc" | "price-desc" | "rating" | "best-selling";
export type ProductsFilter = { categorySlug?: string | null; sort?: ProductSort; limit?: number };

async function fetchProducts(filter: ProductsFilter = {}): Promise<Product[]> {
  let q = supabase
    .from("products")
    .select(SELECT_PRODUCT)
    .eq("status", "published");
  if (filter.categorySlug) {
    const { data: cat } = await supabase
      .from("product_categories")
      .select("id")
      .eq("slug", filter.categorySlug)
      .maybeSingle();
    if (cat) q = q.eq("category_id", cat.id);
  }
  switch (filter.sort) {
    case "newest": q = q.order("created_at", { ascending: false }); break;
    case "oldest": q = q.order("created_at", { ascending: true }); break;
    case "price-asc": q = q.order("sale_price", { ascending: true, nullsFirst: false }).order("regular_price", { ascending: true }); break;
    case "price-desc": q = q.order("sale_price", { ascending: false, nullsFirst: false }).order("regular_price", { ascending: false }); break;
    case "rating": q = q.order("rating", { ascending: false }); break;
    case "best-selling": q = q.order("sales_count", { ascending: false }); break;
    default: q = q.order("reviews_count", { ascending: false });
  }
  if (filter.limit) q = q.limit(filter.limit);
  const { data, error } = await q;
  if (error) throw error;
  return ((data ?? []) as unknown as ProductRow[]).map(mapProduct);
}

async function fetchProductBySlug(slug: string): Promise<Product | null> {
  const { data, error } = await supabase
    .from("products")
    .select(SELECT_PRODUCT)
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const product = mapProduct(data as unknown as ProductRow);
  const { data: faqs } = await supabase
    .from("product_faqs")
    .select("question, answer")
    .eq("product_id", product.id)
    .order("sort_order", { ascending: true });
  product.faqs = (faqs ?? []).map((f) => ({ q: f.question, a: f.answer }));
  return product;
}

async function fetchProductsBySlugs(slugs: string[]): Promise<Product[]> {
  if (slugs.length === 0) return [];
  const { data, error } = await supabase
    .from("products")
    .select(SELECT_PRODUCT)
    .in("slug", slugs)
    .eq("status", "published");
  if (error) throw error;
  const items = ((data ?? []) as unknown as ProductRow[]).map(mapProduct);
  const order = new Map(slugs.map((s, i) => [s, i] as const));
  return items.sort((a, b) => (order.get(a.slug) ?? 0) - (order.get(b.slug) ?? 0));
}

async function fetchCurated(table: "featured_products" | "trending_products" | "best_sellers"): Promise<Product[]> {
  const { data, error } = await supabase
    .from(table)
    .select(`sort_order, products!inner ( ${SELECT_PRODUCT} )`)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as unknown as { products: ProductRow }[])
    .map((r) => mapProduct(r.products))
    .filter(Boolean);
}

async function fetchRelated(slug: string, n = 4): Promise<Product[]> {
  const current = await fetchProductBySlug(slug);
  if (!current) return [];
  const sameCat = await fetchProducts({ categorySlug: current.category, limit: n + 1 });
  const filtered = sameCat.filter((p) => p.slug !== slug).slice(0, n);
  if (filtered.length >= n) return filtered;
  const fillers = await fetchProducts({ limit: n + 1 });
  return [...filtered, ...fillers.filter((p) => p.slug !== slug && !filtered.find((f) => f.slug === p.slug))].slice(0, n);
}

async function searchProducts(q: string): Promise<Product[]> {
  if (!q.trim()) return [];
  const term = `%${q.trim()}%`;
  const { data, error } = await supabase
    .from("products")
    .select(SELECT_PRODUCT)
    .eq("status", "published")
    .or(`title.ilike.${term},short_description.ilike.${term},description.ilike.${term}`)
    .limit(40);
  if (error) throw error;
  return ((data ?? []) as unknown as ProductRow[]).map(mapProduct);
}

// ---------------- Query options ----------------
export const categoriesQuery = () =>
  queryOptions({ queryKey: ["catalog", "categories"], queryFn: fetchCategories });

export const productsQuery = (filter: ProductsFilter = {}) =>
  queryOptions({
    queryKey: ["catalog", "products", filter.categorySlug ?? null, filter.sort ?? "popular", filter.limit ?? null],
    queryFn: () => fetchProducts(filter),
  });

export const productQuery = (slug: string) =>
  queryOptions({ queryKey: ["catalog", "product", slug], queryFn: () => fetchProductBySlug(slug) });

export const productsBySlugsQuery = (slugs: string[]) =>
  queryOptions({
    queryKey: ["catalog", "products-by-slugs", [...slugs].sort().join(",")],
    queryFn: () => fetchProductsBySlugs(slugs),
  });

export const featuredQuery = () =>
  queryOptions({ queryKey: ["catalog", "featured"], queryFn: () => fetchCurated("featured_products") });
export const trendingQuery = () =>
  queryOptions({ queryKey: ["catalog", "trending"], queryFn: () => fetchCurated("trending_products") });
export const bestSellersQuery = () =>
  queryOptions({ queryKey: ["catalog", "best-sellers"], queryFn: () => fetchCurated("best_sellers") });

export const relatedQuery = (slug: string, n = 4) =>
  queryOptions({ queryKey: ["catalog", "related", slug, n], queryFn: () => fetchRelated(slug, n) });

export const searchQuery = (q: string) =>
  queryOptions({ queryKey: ["catalog", "search", q], queryFn: () => searchProducts(q), enabled: q.trim().length > 0 });

// ---------------- Hooks (suspense for primary loads) ----------------
export const useCategories = () => useSuspenseQuery(categoriesQuery()).data;
export const useProducts = (f: ProductsFilter = {}) => useSuspenseQuery(productsQuery(f)).data;
export const useProduct = (slug: string) => useSuspenseQuery(productQuery(slug)).data;
export const useProductsBySlugs = (slugs: string[]) => useQuery(productsBySlugsQuery(slugs)).data ?? [];
export const useFeatured = () => useSuspenseQuery(featuredQuery()).data;
export const useTrending = () => useSuspenseQuery(trendingQuery()).data;
export const useBestSellers = () => useSuspenseQuery(bestSellersQuery()).data;
export const useRelated = (slug: string, n = 4) => useSuspenseQuery(relatedQuery(slug, n)).data;
export const useSearchResults = (q: string) => useQuery(searchQuery(q)).data ?? [];

// ---------------- Blog (still local until we ship blog tables) ----------------
export type BlogPost = {
  slug: string;
  title: string;
  emoji: string;
  category: string;
  date: string;
  excerpt: string;
  tags: string[];
};

export const blogPosts: BlogPost[] = [
  { slug: "chatgpt-plus-guide", title: "ChatGPT Plus in 2026: Is It Still Worth It?", emoji: "🤖", category: "AI Tools", date: "Jun 15, 2026", excerpt: "We break down every Plus-only feature and where it actually saves you time.", tags: ["AI", "ChatGPT", "Productivity"] },
  { slug: "netflix-vs-prime", title: "Netflix vs Prime Video: Which Premium Plan Wins?", emoji: "🎬", category: "Streaming", date: "Jun 10, 2026", excerpt: "Pricing, library, 4K support and family sharing compared side by side.", tags: ["Streaming", "Netflix", "Prime"] },
  { slug: "best-iptv-2026", title: "Best IPTV Services of 2026 (Honest Review)", emoji: "📺", category: "IPTV", date: "Jun 02, 2026", excerpt: "Channel count, stability, EPG quality and what to avoid when buying IPTV.", tags: ["IPTV", "Streaming"] },
  { slug: "canva-pro-tips", title: "10 Canva Pro Tricks Every Creator Should Know", emoji: "🎨", category: "Design", date: "May 28, 2026", excerpt: "Magic Studio, brand kits, animations and template hacks that save hours.", tags: ["Design", "Canva"] },
];
