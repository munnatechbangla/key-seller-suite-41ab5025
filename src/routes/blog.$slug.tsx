import { seoMeta, siteName } from "@/lib/cms/seo";
import { useSettings } from "@/lib/cms/settings";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { Breadcrumbs } from "@/components/site/PageHero";
import { blogPosts as staticPosts } from "@/lib/catalog";
import { blogGetBySlugPublicFn } from "@/lib/blog.functions";
import { Calendar, ArrowLeft } from "lucide-react";

type LoadedPost = {
  slug: string;
  title: string;
  excerpt: string | null;
  category: string;
  date: string;
  cover_url: string | null;
  content_html: string | null;
  emoji?: string;
};

export const Route = createFileRoute("/blog/$slug")({
  loader: async ({ params }) => {
    // Try DB first
    try {
      const row = await blogGetBySlugPublicFn({ data: { slug: params.slug } });
      if (row) {
        const post: LoadedPost = {
          slug: row.slug,
          title: row.title,
          excerpt: row.excerpt,
          category: "Blog",
          date: row.published_at ? new Date(row.published_at).toLocaleDateString() : "",
          cover_url: row.cover_url,
          content_html: row.content_html ?? (row.content_markdown ?? null),
        };
        return { post };
      }
    } catch {
      // fall through
    }
    // Fallback to static
    const s = staticPosts.find((p) => p.slug === params.slug);
    if (!s) throw notFound();
    const post: LoadedPost = {
      slug: s.slug, title: s.title, excerpt: s.excerpt, category: s.category, date: s.date,
      cover_url: null, content_html: null, emoji: s.emoji,
    };
    return { post };
  },
  head: ({ loaderData }) => ({
    meta: seoMeta({
      title: loaderData?.post.title,
      description: loaderData?.post.excerpt ?? undefined,
      ogType: "article",
    }),
  }),
  component: PostPage,
  notFoundComponent: () => <div className="p-16 text-center"><Link to="/blog" className="text-primary">← Back to blog</Link></div>,
  errorComponent: () => <div className="p-8">Something went wrong.</div>,
});

function PostPage() {
  const { post } = Route.useLoaderData();
  const brand = useSettings((s) => s.settings.branding.name);

  return (
    <div className="min-h-screen">
      <Header />
      <div className="bg-gradient-hero text-white">
        <div className="container mx-auto px-4 py-10">
          <Breadcrumbs items={[{ label: "Home", to: "/" }, { label: "Blog", to: "/blog" }, { label: post.title }]} />
          <div className="text-sm text-white/70 flex items-center gap-3 mt-3">
            <span className="px-2.5 py-1 rounded-full bg-white/10">{post.category}</span>
            {post.date && <span className="inline-flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> {post.date}</span>}
          </div>
          <h1 className="text-3xl sm:text-5xl font-bold mt-3 max-w-3xl leading-tight">{post.title}</h1>
        </div>
      </div>

      <div className="container mx-auto px-4 py-12 grid lg:grid-cols-[1fr_260px] gap-10">
        <article className="prose-content space-y-6 max-w-3xl">
          {post.cover_url ? (
            <img src={post.cover_url} alt={post.title} className="aspect-[16/9] w-full rounded-3xl object-cover" />
          ) : (
            <div className="aspect-[16/9] rounded-3xl bg-gradient-to-br from-primary/10 via-secondary/10 to-accent/10 grid place-items-center text-9xl">{post.emoji ?? "📝"}</div>
          )}
          {post.excerpt && <p className="text-lg text-muted-foreground leading-relaxed">{post.excerpt}</p>}
          {post.content_html ? (
            <div className="prose prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: post.content_html }} />
          ) : (
            <p className="text-muted-foreground">Check out the latest deals on {brand} and grab yours today.</p>
          )}
        </article>

        <aside className="space-y-4 lg:sticky lg:top-24 self-start">
          <Link to="/blog" className="inline-flex items-center gap-2 text-sm text-primary font-semibold"><ArrowLeft className="h-4 w-4" /> All articles</Link>
          <div className="text-xs text-muted-foreground">Published by {siteName()}</div>
        </aside>
      </div>
      <Footer />
    </div>
  );
}
