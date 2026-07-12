import { createFileRoute, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { PAGE_META, PAGE_SLUGS } from "@/lib/cms/pages/schemas";
import { Eye, EyeOff, ExternalLink, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/admin/pages")({
  component: AdminPagesIndex,
});

function AdminPagesIndex() {
  const { data: rows = [] } = useQuery({
    queryKey: ["admin_pages_index"],
    queryFn: async () => {
      const { data } = await supabase.from("legal_pages").select("id,slug,is_published,updated_at");
      return data ?? [];
    },
  });
  const bySlug = new Map(rows.map((r: any) => [r.slug, r]));

  return (
    <div className="p-6 max-w-5xl">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">Pages</h1>
        <p className="text-sm text-muted-foreground">Edit the content of every default page. Layouts stay locked.</p>
      </header>
      <div className="rounded-xl border border-border bg-card divide-y divide-border">
        {PAGE_SLUGS.map((slug) => {
          const row = bySlug.get(slug) as any;
          const published = row?.is_published ?? false;
          return (
            <Link
              key={slug}
              to="/admin/pages/$slug"
              params={{ slug }}
              className="flex items-center gap-4 p-4 hover:bg-muted/40 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{PAGE_META[slug].title}</span>
                  <span className="text-xs text-muted-foreground">/{slug}</span>
                </div>
                <div className="text-xs text-muted-foreground">{PAGE_META[slug].description}</div>
              </div>
              <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${published ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground"}`}>
                {published ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                {published ? "Published" : "Draft"}
              </span>
              <a
                href={PAGE_META[slug].frontendPath}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-xs text-primary hover:underline inline-flex items-center gap-1"
              >
                View <ExternalLink className="h-3 w-3" />
              </a>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
