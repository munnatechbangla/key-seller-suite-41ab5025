import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { defaults, type PageSlug } from "./schemas";

export type PageRow = {
  id: string;
  slug: string;
  title: string | null;
  subtitle: string | null;
  content: Record<string, unknown> | null;
  is_published: boolean;
  seo_title: string | null;
  seo_description: string | null;
  canonical_url: string | null;
  updated_at: string;
};

/** Deep-merge helper — later overrides shallow-null/undefined fall back to earlier. */
function merge<T>(defaultsVal: T, override: unknown): T {
  if (override == null) return defaultsVal;
  if (Array.isArray(defaultsVal)) {
    return (Array.isArray(override) ? override : defaultsVal) as T;
  }
  if (typeof defaultsVal === "object" && defaultsVal && typeof override === "object") {
    const out: Record<string, unknown> = { ...(defaultsVal as Record<string, unknown>) };
    for (const [k, v] of Object.entries(override as Record<string, unknown>)) {
      out[k] = merge((defaultsVal as Record<string, unknown>)[k], v);
    }
    return out as T;
  }
  return (override === "" ? defaultsVal : (override as T));
}

/** Fetch a page row and return merged content (defaults + saved). Always returns non-null content. */
export function usePage<K extends PageSlug>(slug: K) {
  const q = useQuery({
    queryKey: ["cms_page", slug],
    queryFn: async () => {
      const { data } = await supabase
        .from("legal_pages")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();
      return (data as unknown as PageRow) ?? null;
    },
    staleTime: 60_000,
  });

  const row = q.data;
  const content = merge(defaults[slug] as unknown, row?.content ?? {}) as (typeof defaults)[K];
  return { row, content, isLoading: q.isLoading };
}
