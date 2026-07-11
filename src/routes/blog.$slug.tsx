import { seoMeta, siteName, siteUrl } from "@/lib/cms/seo";
import { useSettings } from "@/lib/cms/settings";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { Breadcrumbs } from "@/components/site/PageHero";
import { blogPosts as staticPosts } from "@/lib/catalog";
import { blogGetBySlugPublicFn, blogListPublicFn, blogListCategoriesPublicFn } from "@/lib/blog.functions";
import { BlogImage, readingTimeLabel } from "@/components/site/BlogImage";
import {
  Calendar, ArrowLeft, ArrowRight, Clock, User, BadgeCheck, Send,
  Facebook, Twitter, Linkedin, MessageCircle, Link2, Check,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type Row = {
  id: string; slug: string; title: string; excerpt: string | null;
  cover_url: string | null; content_html: string | null; content_markdown: string | null;
  published_at: string | null; category_id: string | null; tag_ids: string[] | null;
  reading_time: number | null; word_count: number | null;
  og_image: string | null; meta_title: string | null; meta_description: string | null;
};

type RelatedCard = { slug: string; title: string; cover_url: string | null; published_at: string | null; reading: string };

export const Route = createFileRoute("/blog/$slug")({
  loader: async ({ params }) => {
    try {
      const [row, all, cats] = await Promise.all([
        blogGetBySlugPublicFn({ data: { slug: params.slug } }) as Promise<Row | null>,
        blogListPublicFn({ data: { post_type: "blog", limit: 100 } }) as Promise<Row[]>,
        blogListCategoriesPublicFn({ data: {} }).catch(() => [] as Array<{ id: string; name: string; slug: string }>),
      ]);
      if (!row) throw notFound();

      const catName = cats.find((c) => c.id === row.category_id)?.name ?? "Blog";
      const others = all.filter((p) => p.slug !== row.slug);
      const sameCat = row.category_id ? others.filter((p) => p.category_id === row.category_id) : [];
      const tagSet = new Set(row.tag_ids ?? []);
      const sameTag = tagSet.size > 0 ? others.filter((p) => (p.tag_ids ?? []).some((t) => tagSet.has(t))) : [];
      const seen = new Set<string>();
      const related: RelatedCard[] = [];
      for (const p of [...sameCat, ...sameTag, ...others]) {
        if (seen.has(p.slug)) continue;
        seen.add(p.slug);
        related.push({ slug: p.slug, title: p.title, cover_url: p.cover_url, published_at: p.published_at, reading: readingTimeLabel(p) });
        if (related.length === 3) break;
      }

      // prev/next by publish order (all is desc by published_at)
      const idx = all.findIndex((p) => p.slug === row.slug);
      const next = idx > 0 ? all[idx - 1] : null; // newer
      const prev = idx >= 0 && idx < all.length - 1 ? all[idx + 1] : null; // older

      const recent = others.slice(0, 5).map((p) => ({ slug: p.slug, title: p.title, published_at: p.published_at }));

      return {
        post: {
          slug: row.slug,
          title: row.title,
          excerpt: row.excerpt,
          category: catName,
          date: row.published_at ? new Date(row.published_at).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "",
          iso_date: row.published_at,
          cover_url: row.cover_url,
          content_html: row.content_html ?? row.content_markdown ?? null,
          reading: readingTimeLabel(row),
          author: "Editorial Team",
          author_role: `${siteName()} Staff`,
          og_image: row.og_image ?? row.cover_url ?? null,
          meta_title: row.meta_title,
          meta_description: row.meta_description,
          tag_ids: row.tag_ids ?? [],
        },
        related,
        prev: prev ? { slug: prev.slug, title: prev.title } : null,
        next: next ? { slug: next.slug, title: next.title } : null,
        recent,
        categories: cats.slice(0, 8),
      };
    } catch (e) {
      const s = staticPosts.find((p) => p.slug === params.slug);
      if (!s) throw notFound();
      return {
        post: {
          slug: s.slug, title: s.title, excerpt: s.excerpt, category: s.category, date: s.date,
          iso_date: null, cover_url: null, content_html: null,
          reading: `${Math.max(1, Math.round((s.excerpt ?? "").split(/\s+/).length / 220))} min read`,
          author: "Editorial Team", author_role: `${siteName()} Staff`,
          og_image: null, meta_title: null, meta_description: null, tag_ids: [] as string[],
        },
        related: [] as RelatedCard[], prev: null, next: null, recent: [], categories: [],
      };
    }
  },
  head: ({ loaderData }) => ({
    meta: seoMeta({
      title: loaderData?.post.meta_title || loaderData?.post.title,
      description: loaderData?.post.meta_description || loaderData?.post.excerpt || undefined,
      ogType: "article",
      image: loaderData?.post.og_image || undefined,
    }),
    scripts: loaderData?.post
      ? [{
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Article",
            headline: loaderData.post.title,
            description: loaderData.post.excerpt ?? undefined,
            image: loaderData.post.og_image ?? undefined,
            datePublished: loaderData.post.iso_date ?? undefined,
            author: { "@type": "Organization", name: loaderData.post.author },
          }),
        }]
      : [],
  }),
  component: PostPage,
  notFoundComponent: () => <div className="p-16 text-center"><Link to="/blog" className="text-primary">← Back to blog</Link></div>,
  errorComponent: () => <div className="p-8">Something went wrong.</div>,
});

function initials(name: string) {
  return name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

function slugify(text: string, i: number) {
  const base = text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return base ? `${base}${i ? `-${i}` : ""}` : `section-${i}`;
}


function ShareBar({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false);
  const enc = encodeURIComponent;
  const items = [
    { key: "fb", label: "Facebook", Icon: Facebook, href: `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}` },
    { key: "tw", label: "X (Twitter)", Icon: Twitter, href: `https://twitter.com/intent/tweet?url=${enc(url)}&text=${enc(title)}` },
    { key: "li", label: "LinkedIn", Icon: Linkedin, href: `https://www.linkedin.com/sharing/share-offsite/?url=${enc(url)}` },
    { key: "wa", label: "WhatsApp", Icon: MessageCircle, href: `https://wa.me/?text=${enc(`${title} ${url}`)}` },
    { key: "tg", label: "Telegram", Icon: Send, href: `https://t.me/share/url?url=${enc(url)}&text=${enc(title)}` },
  ];
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); setCopied(true); toast.success("Link copied"); setTimeout(() => setCopied(false), 1800); }
    catch { toast.error("Could not copy"); }
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      {items.map(({ key, label, Icon, href }) => (
        <a key={key} href={href} target="_blank" rel="noopener noreferrer" aria-label={`Share on ${label}`}
          className="h-9 w-9 grid place-items-center rounded-lg border border-border text-muted-foreground hover:text-primary hover:border-primary/50 hover:bg-primary/5 transition-colors">
          <Icon className="h-4 w-4" />
        </a>
      ))}
      <button onClick={copy} aria-label={copied ? "Link copied" : "Copy link"}
        className="h-9 w-9 grid place-items-center rounded-lg border border-border text-muted-foreground hover:text-primary hover:border-primary/50 hover:bg-primary/5 transition-colors">
        {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Link2 className="h-4 w-4" />}
      </button>
    </div>
  );
}

function PostPage() {
  const { post, related, prev, next, recent, categories } = Route.useLoaderData();
  const brand = useSettings((s) => s.settings.branding.name);
  const [toc, setToc] = useState<{ id: string; text: string; level: number }[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null);
  const [progress, setProgress] = useState(0);
  const articleRef = useRef<HTMLElement | null>(null);

  // Enhance article DOM: heading IDs, lazy images, click-to-zoom
  useEffect(() => {
    const root = articleRef.current;
    if (!root || !post.content_html) return;

    const headings = Array.from(root.querySelectorAll("h2, h3, h4")) as HTMLElement[];
    const toc: { id: string; text: string; level: number }[] = [];
    headings.forEach((h, i) => {
      const text = (h.textContent ?? "").trim();
      if (!text) return;
      const id = h.id || slugify(text, i);
      h.id = id;
      toc.push({ id, text, level: h.tagName === "H2" ? 2 : h.tagName === "H3" ? 3 : 4 });
    });
    setToc(toc);

    const imgs = Array.from(root.querySelectorAll("img")) as HTMLImageElement[];
    const imgHandlers: Array<[HTMLImageElement, (e: MouseEvent) => void]> = [];
    imgs.forEach((img) => {
      img.loading = "lazy";
      img.decoding = "async";
      if (!img.alt) img.alt = post.title;
      const onClick = (e: MouseEvent) => { e.preventDefault(); setLightbox({ src: img.currentSrc || img.src, alt: img.alt }); };
      img.addEventListener("click", onClick);
      imgHandlers.push([img, onClick]);
    });

    return () => { imgHandlers.forEach(([img, fn]) => img.removeEventListener("click", fn)); };
  }, [post.content_html, post.title]);

  // Scroll spy + reading progress
  useEffect(() => {
    const onScroll = () => {
      const doc = document.documentElement;
      const total = doc.scrollHeight - doc.clientHeight;
      setProgress(total > 0 ? Math.min(100, Math.max(0, (doc.scrollTop / total) * 100)) : 0);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (toc.length === 0) return;
    const els = toc.map((h) => document.getElementById(h.id)).filter(Boolean) as HTMLElement[];
    if (els.length === 0) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveId(visible[0].target.id);
      },
      { rootMargin: "-88px 0px -70% 0px", threshold: [0, 1] },
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [toc]);

  // Lightbox: close on Escape
  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setLightbox(null); };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prevOverflow; };
  }, [lightbox]);

  const shareUrl = useMemo(() => {
    const base = siteUrl() || (typeof window !== "undefined" ? window.location.origin : "");
    return `${base}/blog/${post.slug}`;
  }, [post.slug]);

  return (
    <div className="min-h-screen">
      <div className="reading-progress" aria-hidden="true"><span style={{ ["--p" as string]: `${progress}%` } as React.CSSProperties} /></div>
      <Header />

      {/* Hero (compact) */}
      <section className="bg-gradient-hero text-white">
        <div className="container mx-auto px-4 pt-8 pb-10 md:pt-10 md:pb-14 max-w-4xl">
          <Breadcrumbs items={[{ label: "Home", to: "/" }, { label: "Blog", to: "/blog" }, { label: post.title }]} />
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
            <span className="px-2.5 py-1 rounded-full bg-white/15 font-semibold uppercase tracking-wide">{post.category}</span>
            {post.date && <span className="inline-flex items-center gap-1 text-white/75"><Calendar className="h-3.5 w-3.5" /> {post.date}</span>}
            <span className="inline-flex items-center gap-1 text-white/75"><Clock className="h-3.5 w-3.5" /> {post.reading}</span>
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mt-4 leading-[1.15] tracking-tight">{post.title}</h1>
          {post.excerpt && <p className="mt-4 text-white/80 text-base md:text-lg leading-relaxed max-w-3xl">{post.excerpt}</p>}
        </div>
      </section>

      {/* Featured image, tight to hero */}
      <div className="container mx-auto px-4 -mt-6 md:-mt-10 max-w-5xl">
        <BlogImage src={post.cover_url} alt={post.title} aspect="aspect-[16/9]" className="rounded-2xl md:rounded-3xl shadow-premium" eager />
      </div>

      {/* Body + sidebar */}
      <div className="container mx-auto px-4 pt-10 pb-16 max-w-6xl grid gap-10 lg:grid-cols-[minmax(0,1fr)_280px]">
        <article ref={articleRef} className="min-w-0 max-w-[820px] mx-auto lg:mx-0 w-full">
          {post.content_html ? (
            <div className="blog-prose" dangerouslySetInnerHTML={{ __html: post.content_html }} />
          ) : (
            <div className="blog-prose">
              <p>Check out the latest deals on {brand} and grab yours today.</p>
            </div>
          )}


          {/* Author box */}
          <div className="mt-12 rounded-2xl border border-border bg-card p-5 sm:p-6 flex items-start gap-4">
            <div className="h-14 w-14 shrink-0 grid place-items-center rounded-full bg-gradient-primary text-white font-bold text-lg">
              {initials(post.author)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold truncate">{post.author}</h3>
                <BadgeCheck className="h-4 w-4 text-primary" aria-label="Verified" />
                <span className="text-xs text-muted-foreground">· {post.author_role}</span>
              </div>
              <div className="mt-1 text-xs text-muted-foreground flex flex-wrap items-center gap-3">
                {post.date && <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" /> {post.date}</span>}
                <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> {post.reading}</span>
                <span className="inline-flex items-center gap-1"><User className="h-3 w-3" /> {brand}</span>
              </div>
            </div>
          </div>

          {/* Share */}
          <div className="mt-8 flex items-center justify-between flex-wrap gap-3">
            <div className="text-sm font-semibold text-muted-foreground">Share this article</div>
            <ShareBar url={shareUrl} title={post.title} />
          </div>

          {/* Prev / Next */}
          {(prev || next) && (
            <div className="mt-10 grid gap-4 sm:grid-cols-2">
              {prev ? (
                <Link to="/blog/$slug" params={{ slug: prev.slug }} className="group rounded-2xl border border-border bg-card p-5 hover:border-primary/50 hover:shadow-premium transition-smooth">
                  <div className="text-xs font-semibold text-muted-foreground inline-flex items-center gap-1"><ArrowLeft className="h-3 w-3" /> Previous</div>
                  <div className="mt-1 font-semibold line-clamp-2 group-hover:text-primary transition-smooth">{prev.title}</div>
                </Link>
              ) : <div />}
              {next ? (
                <Link to="/blog/$slug" params={{ slug: next.slug }} className="group rounded-2xl border border-border bg-card p-5 hover:border-primary/50 hover:shadow-premium transition-smooth text-right sm:col-start-2">
                  <div className="text-xs font-semibold text-muted-foreground inline-flex items-center gap-1 justify-end w-full">Next <ArrowRight className="h-3 w-3" /></div>
                  <div className="mt-1 font-semibold line-clamp-2 group-hover:text-primary transition-smooth">{next.title}</div>
                </Link>
              ) : null}
            </div>
          )}

          {/* Related */}
          {related.length > 0 && (
            <section className="mt-14">
              <h2 className="text-2xl font-bold mb-5">Related articles</h2>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {related.map((r: RelatedCard) => (
                  <Link key={r.slug} to="/blog/$slug" params={{ slug: r.slug }} className="group flex flex-col rounded-2xl bg-card border border-border overflow-hidden hover:shadow-premium hover:-translate-y-1 transition-smooth">
                    <BlogImage src={r.cover_url} alt={r.title} />
                    <div className="p-4 flex-1 flex flex-col">
                      <div className="text-xs text-muted-foreground inline-flex items-center gap-3">
                        {r.published_at && <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" /> {new Date(r.published_at).toLocaleDateString()}</span>}
                        <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> {r.reading}</span>
                      </div>
                      <h3 className="mt-2 font-bold leading-tight line-clamp-2 group-hover:text-primary transition-smooth">{r.title}</h3>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Newsletter */}
          <section className="mt-14 rounded-3xl bg-gradient-hero text-white p-6 sm:p-10 text-center">
            <h2 className="text-2xl sm:text-3xl font-bold">Stay in the loop</h2>
            <p className="text-white/75 mt-2 max-w-xl mx-auto">Fresh guides, product reviews and exclusive deals — straight to your inbox. No spam.</p>
            <form onSubmit={(e) => e.preventDefault()} className="mt-5 max-w-md mx-auto grid grid-cols-[minmax(0,1fr)_auto] gap-2">
              <input type="email" required placeholder="you@email.com" className="min-w-0 px-4 py-3 rounded-xl glass-dark text-white placeholder:text-white/40 outline-none" />
              <button className="px-5 py-3 rounded-xl bg-gradient-primary font-semibold inline-flex items-center gap-2 shadow-glow"><Send className="h-4 w-4" /> Subscribe</button>
            </form>
          </section>
        </article>

        {/* Sticky sidebar */}
        <aside className="hidden lg:block">
          <div className="sticky top-24 space-y-6">
            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 grid place-items-center rounded-full bg-gradient-primary text-white font-bold text-sm">{initials(post.author)}</div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold flex items-center gap-1 truncate">{post.author} <BadgeCheck className="h-3.5 w-3.5 text-primary shrink-0" /></div>
                  <div className="text-xs text-muted-foreground truncate">{post.author_role}</div>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-border text-xs text-muted-foreground flex items-center gap-3">
                <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> {post.reading}</span>
                {post.date && <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" /> {post.date}</span>}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Share</div>
              <ShareBar url={shareUrl} title={post.title} />
            </div>

            {toc.length > 0 && (
              <div className="rounded-2xl border border-border bg-card p-4">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">On this page</div>
                <ul className="space-y-1.5 text-sm">
                  {toc.map((h) => (
                    <li key={h.id} className={h.level === 3 ? "pl-3" : ""}>
                      <a href={`#${h.id}`} className="text-muted-foreground hover:text-primary line-clamp-2">{h.text}</a>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {recent.length > 0 && (
              <div className="rounded-2xl border border-border bg-card p-4">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Recent posts</div>
                <ul className="space-y-2 text-sm">
                  {recent.map((r: { slug: string; title: string; published_at: string | null }) => (
                    <li key={r.slug}>
                      <Link to="/blog/$slug" params={{ slug: r.slug }} className="block group">
                        <div className="font-medium leading-snug line-clamp-2 group-hover:text-primary transition-colors">{r.title}</div>
                        {r.published_at && <div className="text-xs text-muted-foreground mt-0.5">{new Date(r.published_at).toLocaleDateString()}</div>}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {categories.length > 0 && (
              <div className="rounded-2xl border border-border bg-card p-4">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Categories</div>
                <div className="flex flex-wrap gap-1.5">
                  {categories.map((c: { id: string; name: string; slug: string }) => (
                    <span key={c.id} className="text-xs px-2 py-1 rounded-full bg-muted text-foreground/80">{c.name}</span>
                  ))}
                </div>
              </div>
            )}

            {post.tag_ids.length > 0 && (
              <div className="rounded-2xl border border-border bg-card p-4">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Tags</div>
                <div className="flex flex-wrap gap-1.5">
                  {post.tag_ids.slice(0, 12).map((t: string) => (
                    <span key={t} className="text-xs px-2 py-1 rounded-full border border-border text-muted-foreground">#{t.slice(0, 6)}</span>
                  ))}
                </div>
              </div>
            )}

            <Link to="/blog" className="inline-flex items-center gap-2 text-sm text-primary font-semibold">
              <ArrowLeft className="h-4 w-4" /> All articles
            </Link>
          </div>
        </aside>
      </div>

      <Footer />
    </div>
  );
}
