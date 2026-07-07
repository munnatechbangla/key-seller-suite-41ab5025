import { createFileRoute, Link } from "@tanstack/react-router";
import { blogListPublicFn } from "@/lib/blog.functions";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { PageHero } from "@/components/site/PageHero";
import { seoMeta, canonicalLink } from "@/lib/cms/seo";
import { Search } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/kb")({
  head: () => ({
    meta: seoMeta({ title: "Knowledge Base", description: "Guides, how-tos and answers.", path: "/kb" }),
    links: [canonicalLink("/kb")],
  }),
  loader: () => blogListPublicFn({ data: { post_type: "kb", limit: 500 } }),
  component: KBPage,
  errorComponent: () => <div className="p-8 text-center">Something went wrong.</div>,
});

type Row = { id: string; slug: string; title: string; excerpt: string | null };

function KBPage() {
  const rows = Route.useLoaderData() as Row[];
  const [q, setQ] = useState("");
  const filtered = rows.filter((r) => (r.title + " " + (r.excerpt ?? "")).toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="min-h-screen">
      <Header />
      <PageHero title="Knowledge Base" subtitle="Search articles, guides and answers" crumbs={[{ label: "Home", to: "/" }, { label: "Knowledge Base" }]} />
      <div className="container mx-auto px-4 py-10 max-w-4xl">
        <div className="relative mb-8">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search knowledge base..." className="w-full pl-12 pr-4 py-3 rounded-2xl bg-card border border-border outline-none focus:border-primary" />
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          {filtered.map((r) => (
            <Link key={r.id} to="/blog/$slug" params={{ slug: r.slug }} className="rounded-2xl bg-card border border-border p-5 hover:border-primary transition-smooth">
              <h3 className="font-bold text-lg">{r.title}</h3>
              {r.excerpt && <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{r.excerpt}</p>}
            </Link>
          ))}
          {filtered.length === 0 && <p className="text-muted-foreground col-span-full text-center py-8">No articles found.</p>}
        </div>
      </div>
      <Footer />
    </div>
  );
}
