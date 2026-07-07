import { createFileRoute, Link } from "@tanstack/react-router";
import { blogListPublicFn } from "@/lib/blog.functions";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { PageHero } from "@/components/site/PageHero";
import { seoMeta, canonicalLink } from "@/lib/cms/seo";

export const Route = createFileRoute("/changelog")({
  head: () => ({
    meta: seoMeta({ title: "Changelog", description: "Product updates and release notes.", path: "/changelog" }),
    links: [canonicalLink("/changelog")],
  }),
  loader: () => blogListPublicFn({ data: { post_type: "changelog", limit: 500 } }),
  component: ChangelogPage,
  errorComponent: () => <div className="p-8 text-center">Something went wrong.</div>,
});

type Row = { id: string; slug: string; title: string; excerpt: string | null; version: string | null; release_date: string | null };

function ChangelogPage() {
  const rows = Route.useLoaderData() as Row[];
  return (
    <div className="min-h-screen">
      <Header />
      <PageHero title="Changelog" subtitle="What's new and improved" crumbs={[{ label: "Home", to: "/" }, { label: "Changelog" }]} />
      <div className="container mx-auto px-4 py-10 max-w-3xl space-y-6">
        {rows.map((r) => (
          <div key={r.id} className="rounded-2xl bg-card border border-border p-6">
            <div className="flex items-center gap-3 mb-2">
              {r.version && <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-semibold">v{r.version}</span>}
              {r.release_date && <span className="text-xs text-muted-foreground">{r.release_date}</span>}
            </div>
            <Link to="/blog/$slug" params={{ slug: r.slug }} className="text-xl font-bold hover:text-primary">{r.title}</Link>
            {r.excerpt && <p className="text-sm text-muted-foreground mt-2">{r.excerpt}</p>}
          </div>
        ))}
        {rows.length === 0 && <p className="text-muted-foreground text-center py-8">No release notes yet.</p>}
      </div>
      <Footer />
    </div>
  );
}
