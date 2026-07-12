import { useQuery } from "@tanstack/react-query";
import { cmsPublicListNavPagesFn } from "@/lib/cms.functions";

export type CmsNavPage = {
  slug: string;
  title: string;
  show_in_header: boolean;
  show_in_footer: boolean;
  menu_order: number;
  open_new_tab: boolean;
};

export function useCmsNavPages() {
  return useQuery({
    queryKey: ["cms-nav-pages"],
    queryFn: () => cmsPublicListNavPagesFn(),
    staleTime: 60_000,
  });
}

export function useCmsHeaderPages() {
  const { data } = useCmsNavPages();
  return ((data ?? []) as CmsNavPage[])
    .filter((p) => p.show_in_header)
    .sort((a, b) => (a.menu_order ?? 0) - (b.menu_order ?? 0));
}

export function useCmsFooterPages() {
  const { data } = useCmsNavPages();
  return ((data ?? []) as CmsNavPage[])
    .filter((p) => p.show_in_footer)
    .sort((a, b) => (a.menu_order ?? 0) - (b.menu_order ?? 0));
}
