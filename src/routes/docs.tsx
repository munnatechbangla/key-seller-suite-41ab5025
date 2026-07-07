import { createFileRoute, Link } from "@tanstack/react-router";
import { blogListPublicFn } from "@/lib/blog.functions";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { PageHero } from "@/components/site/PageHero";
import { seoMeta, canonicalLink } from "@/lib/cms/seo";

export const Route = createFileRoute("/docs")({
  head: () => ({
    meta: seoMeta({ title: "Documentation", description: "Product documentation and tutorials.", path: "/docs" }),
    links: [canonicalLink("/docs")],
  }),
  loader: async () => {
    const [docs, tutorials] = await Promise.all([
      blogListPublicFn({ data: { post_type: "docs", limit: 500 } }),
      blogListPublicFn({ data: { post_type: "tutorial", limit: 500 } }),
    ]);
    return { docs, tutorials };
  },
  component: DocsPage,
  errorComponent: () => <div className="p-8 text-center">Something went wrong.</div>,
});

type Row = { id: string; slug: string; title: string; excerpt: string | null };

function Section({ title, rows }: { title: string; rows: Row[] }) {
  if (rows.length === 0) return null;
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-bold">{title}</h2>
      <div className="grid md:grid-cols-2 gap-4">
        {rows.map((r) => (
          <Link key={r.id} to="/articles/$slug" params={{ slug: r.slug }} className="rounded-2xl bg-card border border-border p-5 hover:border-primary transition-smooth">
            <h3 className="font-bold">{r.title}</h3>
            {r.excerpt && <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{r.excerpt}</p>}
          </Link>
        ))}
      </div>
    </section>
  );
}

function DocsPage() {
  const { docs, tutorials } = Route.useLoaderData() as { docs: Row[]; tutorials: Row[] };
  return (
    <div className="min-h-screen">
      <Header />
      <PageHero title="Documentation" subtitle="Guides, tutorials and reference" crumbs={[{ label: "Home", to: "/" }, { label: "Docs" }]} />
      <div className="container mx-auto px-4 py-10 max-w-4xl space-y-10">
        <Section title="Documentation" rows={docs} />
        <Section title="Tutorials" rows={tutorials} />
        {docs.length + tutorials.length === 0 && <p className="text-muted-foreground text-center py-8">No documentation yet.</p>}
      </div>
      <Footer />
    </div>
  );
}
