import { seoMeta, siteName } from "@/lib/cms/seo";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { Breadcrumbs } from "@/components/site/PageHero";
import { blogPosts } from "@/lib/catalog";
import { Calendar, Tag, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/blog/$slug")({
  loader: ({ params }) => {
    const post = blogPosts.find((p) => p.slug === params.slug);
    if (!post) throw notFound();
    return { post };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.post.title} — TopupHut Blog` },
      { name: "description", content: loaderData?.post.excerpt ?? "" },
    ],
  }),
  component: PostPage,
  notFoundComponent: () => <div className="p-16 text-center"><Link to="/blog" className="text-primary">← Back to blog</Link></div>,
  errorComponent: () => <div className="p-8">Something went wrong.</div>,
});

const toc = [
  { id: "intro", label: "Introduction" },
  { id: "features", label: "Key features" },
  { id: "pricing", label: "Pricing & value" },
  { id: "verdict", label: "Our verdict" },
];

function PostPage() {
  const { post } = Route.useLoaderData();
  const related = blogPosts.filter((p) => p.slug !== post.slug).slice(0, 3);

  return (
    <div className="min-h-screen">
      <Header />
      <div className="bg-gradient-hero text-white">
        <div className="container mx-auto px-4 py-10">
          <Breadcrumbs items={[{ label: "Home", to: "/" }, { label: "Blog", to: "/blog" }, { label: post.title }]} />
          <div className="text-sm text-white/70 flex items-center gap-3 mt-3">
            <span className="px-2.5 py-1 rounded-full bg-white/10">{post.category}</span>
            <span className="inline-flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> {post.date}</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-bold mt-3 max-w-3xl leading-tight">{post.title}</h1>
        </div>
      </div>

      <div className="container mx-auto px-4 py-12 grid lg:grid-cols-[1fr_260px] gap-10">
        <article className="prose-content space-y-6 max-w-3xl">
          <div className="aspect-[16/9] rounded-3xl bg-gradient-to-br from-primary/10 via-secondary/10 to-accent/10 grid place-items-center text-9xl">{post.emoji}</div>
          <p className="text-lg text-muted-foreground leading-relaxed">{post.excerpt}</p>
          <h2 id="intro" className="text-2xl font-bold scroll-mt-24">Introduction</h2>
          <p>In this guide we'll take a deep look at this premium digital subscription, its real-world value, and whether the upgrade is right for you.</p>
          <h2 id="features" className="text-2xl font-bold scroll-mt-24">Key features</h2>
          <p>From advanced capabilities to quality-of-life upgrades, here's what you actually get when you subscribe — and the parts most people overlook.</p>
          <ul className="list-disc list-inside space-y-1 text-muted-foreground">
            <li>Premium-only tools and exclusive content</li>
            <li>Higher quality and faster performance</li>
            <li>Priority support and warranty</li>
          </ul>
          <h2 id="pricing" className="text-2xl font-bold scroll-mt-24">Pricing & value</h2>
          <p>The retail price isn't the whole story. With TopupHut, you can get the same subscription for a fraction of the cost, with instant delivery and full warranty.</p>
          <h2 id="verdict" className="text-2xl font-bold scroll-mt-24">Our verdict</h2>
          <p>If you use the service even occasionally, the value is hard to beat. Check out the latest deals on TopupHut and grab yours today.</p>

          <div className="flex flex-wrap gap-2 pt-6 border-t border-border">
            {(post.tags as string[]).map((t) => (
              <span key={t} className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-muted text-xs font-medium"><Tag className="h-3 w-3" /> {t}</span>
            ))}
          </div>
        </article>

        <aside className="space-y-4 lg:sticky lg:top-24 self-start">
          <div className="rounded-2xl bg-card border border-border p-5">
            <h3 className="font-bold mb-3">Table of contents</h3>
            <ul className="space-y-2 text-sm">
              {toc.map((t) => <li key={t.id}><a href={`#${t.id}`} className="text-muted-foreground hover:text-primary">{t.label}</a></li>)}
            </ul>
          </div>
          <Link to="/blog" className="inline-flex items-center gap-2 text-sm text-primary font-semibold"><ArrowLeft className="h-4 w-4" /> All articles</Link>
        </aside>
      </div>

      <section className="container mx-auto px-4 pb-16">
        <h2 className="text-2xl font-bold mb-5">Related posts</h2>
        <div className="grid lg:grid-cols-3 gap-6">
          {related.map((p) => (
            <Link key={p.slug} to="/blog/$slug" params={{ slug: p.slug }} className="rounded-2xl bg-card border border-border overflow-hidden hover:shadow-premium transition-smooth">
              <div className="aspect-[16/10] bg-gradient-to-br from-primary/10 via-secondary/10 to-accent/10 grid place-items-center text-6xl">{p.emoji}</div>
              <div className="p-5">
                <div className="text-xs text-primary font-semibold mb-1">{p.category}</div>
                <h3 className="font-bold leading-tight">{p.title}</h3>
              </div>
            </Link>
          ))}
        </div>
      </section>
      <Footer />
    </div>
  );
}
