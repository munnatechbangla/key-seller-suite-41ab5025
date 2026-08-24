import { seoMeta, siteName, siteUrl } from "@/lib/cms/seo";
import { useSettings } from "@/lib/cms/settings";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { Breadcrumbs } from "@/components/site/PageHero";
import { blogPosts as staticPosts } from "@/lib/catalog";
import { blogGetBySlugPublicFn, blogListPublicFn, blogListCategoriesPublicFn } from "@/lib/blog.functions";
import { BlogImage, readingTimeLabel } from "@/components/site/BlogImage";
import { ProductThumb } from "@/components/site/ProductThumb";
import {
  Calendar, ArrowLeft, ArrowRight, Clock, User, BadgeCheck, Send,
  Facebook, Twitter, Linkedin, MessageCircle, Link2, Check, Share2, Printer, X, ChevronLeft, ChevronRight,
} from "lucide-react";
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { toast } from "sonner";

type Row = {
  id: string; slug: string; title: string; excerpt: string | null;
  cover_url: string | null; content_html: string | null; content_markdown: string | null;
  published_at: string | null; category_id: string | null; tag_ids: string[] | null;
  reading_time: number | null; word_count: number | null;
  og_image: string | null; meta_title: string | null; meta_description: string | null;
};

type RelatedCard = { slug: string; title: string; cover_url: string | null; published_at: string | null; reading: string; category: string };

export const Route = createFileRoute("/blog/$slug")({
  loader: async ({ params }) => {
    try {
      const [row, all, cats] = await Promise.all([
        blogGetBySlugPublicFn({ data: { slug: params.slug } }) as Promise<Row | null>,
        blogListPublicFn({ data: { post_type: "blog", limit: 100 } } as any) as Promise<Row[]>,
        blogListCategoriesPublicFn({ data: {} } as any).catch(() => [] as Array<{ id: string; name: string; slug: string }>),
      ]);
      if (!row) throw notFound();

      const catName = cats.find((c) => c.id === row.category_id)?.name ?? "Blog";
      const catNameFor = (id: string | null) => cats.find((c) => c.id === id)?.name ?? "Blog";
      const others = all.filter((p) => p.slug !== row.slug);
      const sameCat = row.category_id ? others.filter((p) => p.category_id === row.category_id) : [];
      const tagSet = new Set(row.tag_ids ?? []);
      const sameTag = tagSet.size > 0 ? others.filter((p) => (p.tag_ids ?? []).some((t) => tagSet.has(t))) : [];
      const seen = new Set<string>();
      const related: RelatedCard[] = [];
      for (const p of [...sameCat, ...sameTag, ...others]) {
        if (seen.has(p.slug)) continue;
        seen.add(p.slug);
        related.push({ slug: p.slug, title: p.title, cover_url: p.cover_url, published_at: p.published_at, reading: readingTimeLabel(p), category: catNameFor(p.category_id) });
        if (related.length === 3) break;
      }

      const idx = all.findIndex((p) => p.slug === row.slug);
      const next = idx > 0 ? all[idx - 1] : null;
      const prev = idx >= 0 && idx < all.length - 1 ? all[idx + 1] : null;

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
          author_bio: `Writing about ${catName.toLowerCase()}, digital deals, and product guides for ${siteName()}.`,
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
        totalPosts: all.length,
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
          author_bio: `Writing for ${siteName()}.`,
          og_image: null, meta_title: null, meta_description: null, tag_ids: [] as string[],
        },
        related: [] as RelatedCard[], prev: null, next: null, recent: [], categories: [], totalPosts: 0,
      };
    }
  },
  head: ({ loaderData }) => {
    const cover = loaderData?.post.cover_url ?? undefined;
    return {
      meta: seoMeta({
        title: loaderData?.post.meta_title || loaderData?.post.title,
        description: loaderData?.post.meta_description || loaderData?.post.excerpt || undefined,
        ogType: "article",
        image: loaderData?.post.og_image || undefined,
      }),
      links: [
        { rel: "preconnect", href: "https://fonts.googleapis.com" },
        { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
        ...(cover && /^https?:\/\//.test(cover) ? [{ rel: "preload", as: "image", href: cover, fetchpriority: "high" } as const] : []),
      ],
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
    };
  },
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

function ShareBar({ url, title, vertical = false }: { url: string; title: string; vertical?: boolean }) {
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
    try { await navigator.clipboard.writeText(url); setCopied(true); toast.success("✓ Link Copied"); setTimeout(() => setCopied(false), 1800); }
    catch { toast.error("Could not copy"); }
  };
  return (
    <div className={vertical ? "flex flex-col gap-1" : "flex flex-wrap items-center gap-2"}>
      {items.map(({ key, label, Icon, href }) => (
        <a key={key} href={href} target="_blank" rel="noopener noreferrer" aria-label={`Share on ${label}`}
          className="h-9 w-9 grid place-items-center rounded-lg border border-border text-muted-foreground hover:text-primary hover:border-primary/50 hover:bg-primary/5 transition-colors focus-visible:ring-2 focus-visible:ring-primary">
          <Icon className="h-4 w-4" />
        </a>
      ))}
      <button onClick={copy} aria-label={copied ? "Link copied" : "Copy link"}
        className="h-9 w-9 grid place-items-center rounded-lg border border-border text-muted-foreground hover:text-primary hover:border-primary/50 hover:bg-primary/5 transition-colors focus-visible:ring-2 focus-visible:ring-primary">
        {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Link2 className="h-4 w-4" />}
      </button>
    </div>
  );
}

function MobileShareFab({ url, title }: { url: string; title: string }) {
  const [open, setOpen] = useState(false);
  const nativeShare = async () => {
    if (typeof navigator !== "undefined" && (navigator as unknown as { share?: (d: ShareData) => Promise<void> }).share) {
      try { await (navigator as unknown as { share: (d: ShareData) => Promise<void> }).share({ title, url }); return; } catch { /* fallthrough */ }
    }
    setOpen((v) => !v);
  };
  return (
    <div className="share-fab no-print">
      {open && (
        <div className="mb-3 p-3 rounded-2xl border border-border bg-card shadow-premium">
          <ShareBar url={url} title={title} />
        </div>
      )}
      <button onClick={nativeShare} aria-label="Share article"
        className="h-14 w-14 rounded-full bg-gradient-primary text-white grid place-items-center shadow-glow">
        <Share2 className="h-5 w-5" />
      </button>
    </div>
  );
}

function highlightIn(root: HTMLElement, term: string) {
  const clean = term.trim();
  if (!clean) return () => {};
  const re = new RegExp(`(${clean.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => {
      const p = n.parentElement;
      if (!p) return NodeFilter.FILTER_REJECT;
      if (["SCRIPT", "STYLE", "MARK", "CODE", "PRE"].includes(p.tagName)) return NodeFilter.FILTER_REJECT;
      return n.nodeValue && re.test(n.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    },
  });
  const marks: HTMLElement[] = [];
  const nodes: Text[] = [];
  let node: Node | null;
  while ((node = walker.nextNode())) nodes.push(node as Text);
  nodes.forEach((n) => {
    const frag = document.createDocumentFragment();
    const parts = (n.nodeValue ?? "").split(re);
    parts.forEach((p, i) => {
      if (i % 2 === 1) {
        const m = document.createElement("mark");
        m.className = "blog-highlight";
        m.textContent = p;
        marks.push(m);
        frag.appendChild(m);
      } else if (p) frag.appendChild(document.createTextNode(p));
    });
    n.parentNode?.replaceChild(frag, n);
  });
  return () => marks.forEach((m) => { const t = document.createTextNode(m.textContent ?? ""); m.parentNode?.replaceChild(t, m); });
}

function PostPage() {
  const { post, related, prev, next, recent, categories, totalPosts } = Route.useLoaderData();
  const brand = useSettings((s) => s.settings.branding.name);
  const [toc, setToc] = useState<{ id: string; text: string; level: number }[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [images, setImages] = useState<{ src: string; alt: string }[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState<number>(-1);
  const [progress, setProgress] = useState(0);
  const articleRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const root = articleRef.current;
    if (!root || !post.content_html) return;

    const headings = Array.from(root.querySelectorAll("h2, h3, h4")) as HTMLElement[];
    const tocList: { id: string; text: string; level: number }[] = [];
    headings.forEach((h, i) => {
      const text = (h.textContent ?? "").trim();
      if (!text) return;
      const id = h.id || slugify(text, i);
      h.id = id;
      tocList.push({ id, text, level: h.tagName === "H2" ? 2 : h.tagName === "H3" ? 3 : 4 });
    });
    setToc(tocList);

    const imgEls = Array.from(root.querySelectorAll("img")) as HTMLImageElement[];
    const collected: { src: string; alt: string }[] = [];
    const imgHandlers: Array<[HTMLImageElement, (e: MouseEvent) => void]> = [];
    imgEls.forEach((img, idx) => {
      img.loading = "lazy";
      img.decoding = "async";
      if (!img.alt) img.alt = post.title;
      collected.push({ src: img.currentSrc || img.src, alt: img.alt });
      const onClick = (e: MouseEvent) => { e.preventDefault(); setLightboxIndex(idx); };
      img.addEventListener("click", onClick);
      img.style.cursor = "zoom-in";
      imgHandlers.push([img, onClick]);
    });
    setImages(collected);

    // Search highlight from ?q=
    let cleanupHighlight: () => void = () => {};
    if (typeof window !== "undefined") {
      const q = new URLSearchParams(window.location.search).get("q");
      if (q) cleanupHighlight = highlightIn(root, q);
    }

    return () => {
      imgHandlers.forEach(([img, fn]) => img.removeEventListener("click", fn));
      cleanupHighlight();
    };
  }, [post.content_html, post.title]);

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

  const closeLightbox = useCallback(() => setLightboxIndex(-1), []);
  useEffect(() => {
    if (lightboxIndex < 0) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeLightbox();
      else if (e.key === "ArrowRight") setLightboxIndex((i) => (i + 1) % Math.max(1, images.length));
      else if (e.key === "ArrowLeft") setLightboxIndex((i) => (i - 1 + images.length) % Math.max(1, images.length));
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prevOverflow; };
  }, [lightboxIndex, images.length, closeLightbox]);

  const shareUrl = useMemo(() => {
    const base = siteUrl() || (typeof window !== "undefined" ? window.location.origin : "");
    return `${base}/blog/${post.slug}`;
  }, [post.slug]);

  const progressPct = Math.round(progress);
  const currentImg = lightboxIndex >= 0 ? images[lightboxIndex] : null;

  const AuthorBlock = (
    <div className="flex items-start gap-3">
      <div className="h-12 w-12 shrink-0 grid place-items-center rounded-full bg-gradient-primary text-white font-bold">
        {initials(post.author)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-sm font-semibold truncate">{post.author}</span>
          <BadgeCheck className="h-3.5 w-3.5 text-primary shrink-0" aria-label="Verified" />
        </div>
        <div className="text-xs text-muted-foreground truncate">{post.author_role}</div>
        <p className="text-xs text-muted-foreground mt-1.5 line-clamp-3">{post.author_bio}</p>
        <div className="text-[11px] text-muted-foreground mt-2 font-medium">{totalPosts} published article{totalPosts === 1 ? "" : "s"}</div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen">
      <div className="reading-progress no-print" aria-hidden="true"><span style={{ ["--p" as string]: `${progress}%` } as React.CSSProperties} /></div>
      <div className="reading-progress-label no-print" aria-live="polite">Reading Progress {progressPct}%</div>
      <Header />

      {/* Desktop floating share rail */}
      <div className="share-rail no-print" aria-label="Share this article">
        <ShareBar url={shareUrl} title={post.title} vertical />
      </div>

      {/* Hero */}
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

      <div className="container mx-auto px-4 -mt-6 md:-mt-10 max-w-5xl">
        <BlogImage src={post.cover_url} alt={post.title} aspect="aspect-[16/9]" className="rounded-2xl md:rounded-3xl shadow-premium" eager />
      </div>

      <div className="container mx-auto px-4 pt-10 pb-16 max-w-6xl grid gap-10 lg:grid-cols-[minmax(0,1fr)_280px]">
        <article ref={articleRef} className="min-w-0 max-w-[820px] mx-auto lg:mx-0 w-full">
          {post.content_html ? (
            <div className="blog-prose" dangerouslySetInnerHTML={{ __html: post.content_html }} />
          ) : (
            <div className="blog-prose">
              <p>Check out the latest deals on {brand} and grab yours today.</p>
            </div>
          )}

          {/* Author box (desktop) */}
          <div className="mt-12 rounded-2xl border border-border bg-card p-5 sm:p-6 hidden md:block">
            {AuthorBlock}
          </div>

          {/* Actions: Share + Print */}
          <div className="mt-8 flex items-center justify-between flex-wrap gap-3">
            <div className="text-sm font-semibold text-muted-foreground">Share this article</div>
            <div className="flex items-center gap-3 flex-wrap">
              <ShareBar url={shareUrl} title={post.title} />
              <button
                type="button"
                onClick={() => typeof window !== "undefined" && window.print()}
                className="no-print inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-border text-sm text-muted-foreground hover:text-primary hover:border-primary/50 hover:bg-primary/5 transition-colors focus-visible:ring-2 focus-visible:ring-primary"
                aria-label="Print article"
              >
                <Printer className="h-4 w-4" /> Print Article
              </button>
            </div>
          </div>

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

          {related.length > 0 && (
            <section className="mt-14">
              <h2 className="text-2xl font-bold mb-5">Related articles</h2>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {related.map((r: RelatedCard) => (
                  <Link key={r.slug} to="/blog/$slug" params={{ slug: r.slug }} className="group flex flex-col rounded-2xl bg-card border border-border overflow-hidden hover:shadow-premium hover:-translate-y-1 hover:border-primary/40 transition-smooth">
                    <div className="overflow-hidden">
                      <div className="transition-transform duration-500 group-hover:scale-105">
                        <BlogImage src={r.cover_url} alt={r.title} />
                      </div>
                    </div>
                    <div className="p-4 flex-1 flex flex-col">
                      <span className="self-start text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary">{r.category}</span>
                      <h3 className="mt-2 font-bold leading-tight line-clamp-2 group-hover:text-primary transition-smooth">{r.title}</h3>
                      <div className="mt-auto pt-3 text-xs text-muted-foreground inline-flex items-center gap-3 flex-wrap">
                        {r.published_at && <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" /> {new Date(r.published_at).toLocaleDateString()}</span>}
                        <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> {r.reading}</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          <section className="mt-14 rounded-3xl bg-gradient-hero text-white p-6 sm:p-10 text-center no-print">
            <h2 className="text-2xl sm:text-3xl font-bold">Stay in the loop</h2>
            <p className="text-white/75 mt-2 max-w-xl mx-auto">Fresh guides, product reviews and exclusive deals — straight to your inbox. No spam.</p>
            <form onSubmit={(e) => e.preventDefault()} className="mt-5 max-w-md mx-auto grid grid-cols-[minmax(0,1fr)_auto] gap-2">
              <input type="email" required placeholder="you@email.com" aria-label="Email address" className="min-w-0 px-4 py-3 rounded-xl glass-dark text-white placeholder:text-white/40 outline-none" />
              <button className="px-5 py-3 rounded-xl bg-gradient-primary font-semibold inline-flex items-center gap-2 shadow-glow"><Send className="h-4 w-4" /> Subscribe</button>
            </form>
          </section>

          {/* Mobile accordions */}
          <div className="mt-10 space-y-3 lg:hidden no-print">
            <details className="rounded-2xl border border-border bg-card p-4 group" open>
              <summary className="cursor-pointer font-semibold text-sm flex items-center justify-between">Author <ChevronRight className="h-4 w-4 transition-transform group-open:rotate-90" /></summary>
              <div className="mt-3">{AuthorBlock}</div>
            </details>
            {toc.length > 0 && (
              <details className="rounded-2xl border border-border bg-card p-4 group">
                <summary className="cursor-pointer font-semibold text-sm flex items-center justify-between">Table of contents <ChevronRight className="h-4 w-4 transition-transform group-open:rotate-90" /></summary>
                <ul className="mt-3 space-y-0.5">
                  {toc.map((h) => (
                    <li key={h.id} style={{ paddingLeft: `${(h.level - 2) * 12}px` }}>
                      <a href={`#${h.id}`} data-active={activeId === h.id} className="toc-link line-clamp-2">{h.text}</a>
                    </li>
                  ))}
                </ul>
              </details>
            )}
            {categories.length > 0 && (
              <details className="rounded-2xl border border-border bg-card p-4 group">
                <summary className="cursor-pointer font-semibold text-sm flex items-center justify-between">Categories <ChevronRight className="h-4 w-4 transition-transform group-open:rotate-90" /></summary>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {categories.map((c: { id: string; name: string; slug: string }) => (
                    <span key={c.id} className="text-xs px-2 py-1 rounded-full bg-muted text-foreground/80">{c.name}</span>
                  ))}
                </div>
              </details>
            )}
          </div>
        </article>

        {/* Sticky sidebar */}
        <aside className="hidden lg:block no-print">
          <div className="sticky top-24 space-y-6">
            <div className="rounded-2xl border border-border bg-card p-4">
              {AuthorBlock}
              <div className="mt-3 pt-3 border-t border-border text-xs text-muted-foreground flex items-center gap-3 flex-wrap">
                <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> {post.reading}</span>
                {post.date && <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" /> {post.date}</span>}
                <span className="inline-flex items-center gap-1"><User className="h-3 w-3" /> {brand}</span>
              </div>
            </div>

            {toc.length > 0 && (
              <div className="rounded-2xl border border-border bg-card p-4">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">On this page</div>
                <ul className="space-y-0.5 max-h-[60vh] overflow-y-auto pr-1">
                  {toc.map((h) => (
                    <li key={h.id} style={{ paddingLeft: `${(h.level - 2) * 12}px` }}>
                      <a href={`#${h.id}`} data-active={activeId === h.id} className="toc-link line-clamp-2">{h.text}</a>
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

            <div className="rounded-2xl border border-border bg-gradient-hero text-white p-4">
              <div className="text-sm font-semibold">Newsletter</div>
              <p className="text-xs text-white/75 mt-1">Get new posts in your inbox.</p>
              <form onSubmit={(e) => e.preventDefault()} className="mt-3 grid gap-2">
                <input type="email" required placeholder="you@email.com" aria-label="Email address" className="min-w-0 px-3 py-2 rounded-lg glass-dark text-white placeholder:text-white/40 text-sm outline-none" />
                <button className="px-3 py-2 rounded-lg bg-gradient-primary font-semibold text-sm inline-flex items-center justify-center gap-1.5"><Send className="h-3.5 w-3.5" /> Subscribe</button>
              </form>
            </div>

            <Link to="/blog" className="inline-flex items-center gap-2 text-sm text-primary font-semibold">
              <ArrowLeft className="h-4 w-4" /> All articles
            </Link>
          </div>
        </aside>
      </div>

      <MobileShareFab url={shareUrl} title={post.title} />

      <Footer />

      {currentImg && (
        <div className="lightbox" role="dialog" aria-modal="true" aria-label="Image preview" onClick={closeLightbox}>
          {images.length > 1 && (
            <>
              <button
                type="button"
                className="lightbox-nav prev"
                aria-label="Previous image"
                onClick={(e) => { e.stopPropagation(); setLightboxIndex((i) => (i - 1 + images.length) % images.length); }}
              ><ChevronLeft className="h-6 w-6" /></button>
              <button
                type="button"
                className="lightbox-nav next"
                aria-label="Next image"
                onClick={(e) => { e.stopPropagation(); setLightboxIndex((i) => (i + 1) % images.length); }}
              ><ChevronRight className="h-6 w-6" /></button>
            </>
          )}
          <button type="button" aria-label="Close" onClick={closeLightbox} className="absolute top-4 right-4 h-10 w-10 rounded-full bg-white/10 text-white grid place-items-center hover:bg-white/20">
            <X className="h-5 w-5" />
          </button>
          <img src={currentImg.src} alt={currentImg.alt} onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}
