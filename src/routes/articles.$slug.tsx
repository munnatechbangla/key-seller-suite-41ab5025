import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { blogGetBySlugPublicFn, blogSubmitCommentFn } from "@/lib/blog.functions";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { Breadcrumbs } from "@/components/site/PageHero";
import { seoMeta, canonicalLink, jsonLdScript } from "@/lib/cms/seo";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Calendar, ArrowLeft, Clock } from "lucide-react";

export const Route = createFileRoute("/articles/$slug")({
  loader: async ({ params }) => {
    const post = await blogGetBySlugPublicFn({ data: { slug: params.slug } });
    if (!post) throw notFound();
    return { post };
  },
  head: ({ loaderData, params }) => {
    const p = loaderData?.post as Post | undefined;
    const title = p?.meta_title || p?.title || "Article";
    const desc = p?.meta_description || p?.excerpt || undefined;
    const scripts = [];
    if (p?.schema_article) {
      scripts.push(jsonLdScript({
        "@context": "https://schema.org",
        "@type": "Article",
        headline: p.title,
        description: desc,
        image: p.og_image || p.cover_url || undefined,
        datePublished: p.published_at,
        dateModified: p.updated_at,
      }));
    }
    return {
      meta: seoMeta({ title, description: desc, ogType: "article", image: p?.og_image || p?.cover_url || undefined }),
      links: [p?.canonical_url ? { rel: "canonical" as const, href: p.canonical_url } : canonicalLink(`/articles/${params.slug}`)],
      scripts,
    };
  },
  component: ArticlePage,
  notFoundComponent: () => <div className="p-16 text-center"><Link to="/blog" className="text-primary">← Back to blog</Link></div>,
  errorComponent: () => <div className="p-8">Something went wrong.</div>,
});

type Post = {
  id: string; slug: string; title: string; subtitle: string | null; excerpt: string | null;
  content_html: string | null; content_markdown: string | null;
  cover_url: string | null; og_image: string | null;
  post_type: string; published_at: string | null; updated_at: string;
  reading_time: number | null; version: string | null; release_date: string | null;
  meta_title: string | null; meta_description: string | null; canonical_url: string | null;
  schema_article: boolean; allow_comments: boolean;
};

function ArticlePage() {
  const { post } = Route.useLoaderData() as { post: Post };
  const submit = useServerFn(blogSubmitCommentFn);
  const [name, setName] = useState(""); const [email, setEmail] = useState(""); const [body, setBody] = useState("");
  const html = post.content_html || (post.content_markdown ? `<pre style="white-space:pre-wrap;font-family:inherit">${escapeHtml(post.content_markdown)}</pre>` : "");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;
    try {
      await submit({ data: { post_id: post.id, body, guest_name: name || undefined, guest_email: email || undefined } });
      toast.success("Comment submitted for review");
      setBody("");
    } catch (err) { toast.error((err as Error).message); }
  };

  return (
    <div className="min-h-screen">
      <Header />
      <div className="bg-gradient-hero text-white">
        <div className="container mx-auto px-4 py-10">
          <Breadcrumbs items={[{ label: "Home", to: "/" }, { label: "Articles" }, { label: post.title }]} />
          <div className="text-sm text-white/70 flex items-center gap-3 mt-3">
            <span className="px-2.5 py-1 rounded-full bg-white/10">{post.post_type}</span>
            {post.version && <span className="px-2.5 py-1 rounded-full bg-white/10">v{post.version}</span>}
            {post.published_at && <span className="inline-flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> {new Date(post.published_at).toLocaleDateString()}</span>}
            {post.reading_time && <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {post.reading_time} min</span>}
          </div>
          <h1 className="text-3xl sm:text-5xl font-bold mt-3 max-w-3xl leading-tight">{post.title}</h1>
          {post.subtitle && <p className="text-white/80 mt-3 max-w-3xl">{post.subtitle}</p>}
        </div>
      </div>

      <div className="container mx-auto px-4 py-12 max-w-3xl space-y-6">
        {post.cover_url && <img src={post.cover_url} alt={post.title} className="w-full rounded-3xl" />}
        {post.excerpt && <p className="text-lg text-muted-foreground leading-relaxed">{post.excerpt}</p>}
        <article className="prose-content" dangerouslySetInnerHTML={{ __html: html }} />

        {post.allow_comments && (
          <section className="pt-8 border-t border-border">
            <h2 className="text-xl font-bold mb-4">Leave a comment</h2>
            <form onSubmit={onSubmit} className="space-y-2 max-w-xl">
              <div className="grid grid-cols-2 gap-2">
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className="px-3 py-2 rounded-xl bg-card border border-border outline-none" />
                <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="px-3 py-2 rounded-xl bg-card border border-border outline-none" />
              </div>
              <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} placeholder="Your comment..." className="w-full px-3 py-2 rounded-xl bg-card border border-border outline-none" />
              <button className="px-5 py-2 rounded-xl bg-gradient-primary text-primary-foreground font-semibold">Submit</button>
            </form>
          </section>
        )}

        <Link to="/blog" className="inline-flex items-center gap-2 text-sm text-primary font-semibold"><ArrowLeft className="h-4 w-4" /> All articles</Link>
      </div>
      <Footer />
    </div>
  );
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}
