// @ts-nocheck
import { seoMeta, siteName, canonicalLink } from "@/lib/cms/seo";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { PageHero } from "@/components/site/PageHero";
import { blogPosts as staticPosts } from "@/lib/catalog";
import { blogListPublicFn, blogListCategoriesPublicFn } from "@/lib/blog.functions";
import { Calendar, ArrowRight, Send, Clock } from "lucide-react";
import { BlogImage, readingTimeLabel } from "@/components/site/BlogImage";

export const Route = createFileRoute("/blog/")({
  head: () => ({
    meta: seoMeta({ title: "Blog", description: "Guides, reviews and tips on digital subscriptions, AI tools and streaming services.", path: "/blog" }),
    links: [canonicalLink("/blog")],
  }),
  component: BlogPage,
});

type Card = { slug: string; title: string; excerpt: string; category: string; date: string; cover_url?: string | null; reading?: string };

function BlogPage() {
  const listFn = useServerFn(blogListPublicFn);
  const catsFn = useServerFn(blogListCategoriesPublicFn);
  const { data: dbPosts, isLoading } = useQuery({
    queryKey: ["blog", "public", "list"],
    queryFn: () => listFn({ data: { post_type: "blog", limit: 100 } }),
    staleTime: 30_000,
  });
  const { data: cats } = useQuery({
    queryKey: ["blog", "public", "cats"],
    queryFn: () => catsFn({ data: {} }),
    staleTime: 60_000,
  });
  const catNameById = new Map<string, string>();
  (cats ?? []).forEach((c: { id: string; name: string }) => catNameById.set(c.id, c.name));

  const cards: Card[] = (dbPosts && dbPosts.length > 0)
    ? dbPosts.map((p) => ({
        slug: p.slug,
        title: p.title,
        excerpt: p.excerpt ?? "",
        category: (p.category_id && catNameById.get(p.category_id)) || "Blog",
        date: p.published_at ? new Date(p.published_at).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "",
        cover_url: p.cover_url,
        reading: readingTimeLabel(p),
      }))
    : staticPosts.map((p) => ({ slug: p.slug, title: p.title, excerpt: p.excerpt, category: p.category, date: p.date }));

  return (
    <div className="min-h-screen">
      <Header />
      <PageHero title={`${siteName()} Blog`} subtitle="Reviews, guides and pro tips on premium digital products" crumbs={[{ label: "Home", to: "/" }, { label: "Blog" }]} />
      <div className="container mx-auto px-4 py-10">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {isLoading && !dbPosts ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-border bg-card overflow-hidden animate-pulse">
                <div className="aspect-[16/10] bg-muted" />
                <div className="p-5 space-y-2">
                  <div className="h-3 w-24 bg-muted rounded" />
                  <div className="h-5 w-3/4 bg-muted rounded" />
                  <div className="h-4 w-full bg-muted rounded" />
                  <div className="h-4 w-2/3 bg-muted rounded" />
                </div>
              </div>
            ))
          ) : (
            cards.map((p) => (
              <Link key={p.slug} to="/blog/$slug" params={{ slug: p.slug }} className="group flex h-full flex-col rounded-2xl bg-card border border-border overflow-hidden hover:shadow-premium hover:-translate-y-1 transition-smooth">
                <div className="overflow-hidden">
                  <BlogImage src={p.cover_url} alt={p.title} />
                </div>
                <div className="p-5 flex flex-1 flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">{p.category || "General"}</span>
                    {p.date && <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" /> {p.date}</span>}
                    {p.reading && <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> {p.reading}</span>}
                  </div>
                  <h3 className="font-bold text-lg leading-tight group-hover:text-primary transition-smooth line-clamp-2">{p.title}</h3>
                  <p className="text-sm text-muted-foreground line-clamp-3">{p.excerpt}</p>
                  <div className="inline-flex items-center gap-1 text-sm font-semibold text-primary pt-2 mt-auto">
                    Read article <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>

        <section className="mt-16 rounded-3xl bg-gradient-hero text-white p-6 sm:p-14 text-center">
          <h2 className="text-3xl font-bold mb-2">Join our newsletter</h2>
          <p className="text-white/70 mb-6">Get weekly deals and product guides straight to your inbox.</p>
          <form onSubmit={(e) => e.preventDefault()} className="max-w-md mx-auto grid grid-cols-[minmax(0,1fr)_auto] gap-2">
            <input type="email" required placeholder="you@email.com" className="min-w-0 px-4 py-3 rounded-xl glass-dark text-white placeholder:text-white/40 outline-none" />
            <button className="px-5 py-3 rounded-xl bg-gradient-primary font-semibold inline-flex items-center gap-2 shadow-glow"><Send className="h-4 w-4 shrink-0" /> Subscribe</button>
          </form>
        </section>
      </div>
      <Footer />
    </div>
  );
}
