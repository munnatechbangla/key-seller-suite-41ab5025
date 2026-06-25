import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

export type LegalSection = { h: string; p: string };
export type FaqItem = { q: string; a: string };
export type FaqGroup = { name: string; items: FaqItem[] };

export type LegalContent = {
  sections?: LegalSection[];
  faq_groups?: FaqGroup[];
  body_md?: string;
};

export type LegalPage = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  content: LegalContent;
  is_published: boolean;
  seo_title: string | null;
  seo_description: string | null;
  canonical_url: string | null;
  updated_at: string;
};

export async function fetchLegalPage(slug: string): Promise<LegalPage | null> {
  const { data, error } = await supabase
    .from("legal_pages")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error) return null;
  return (data as unknown as LegalPage) ?? null;
}

export function useLegalPage(slug: string) {
  return useQuery({
    queryKey: ["legal_page", slug],
    queryFn: () => fetchLegalPage(slug),
    staleTime: 60_000,
  });
}
