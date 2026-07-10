import { seoMeta, canonicalLink } from "@/lib/cms/seo";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Star, ChevronRight, Calendar, ArrowRight, ShieldCheck, BadgeCheck } from "lucide-react";
import { Reveal } from "@/components/site/Reveal";
import { useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import { useQuery as useTQuery } from "@tanstack/react-query";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { Section } from "@/components/site/Section";
import { ProductCard } from "@/components/site/ProductCard";
import { blogPosts } from "@/lib/catalog";
import { resolveProductPrice, formatPrice } from "@/lib/product-price";
import {
  useCategories,
  featuredQuery,
  trendingQuery,
  bestSellersQuery,
  productsBySlugsQuery,
  heroFeaturedQuery,
  heroLatestQuery,
  type Product,
} from "@/lib/catalog";
import { useProductSection, useResolvedProducts, resolveIcon } from "@/lib/cms";
import { useHomepage, defaultHomepageConfig, type HomeProductSection, type SectionId } from "@/lib/cms/homepage";
import { listEnabledGatewaysFn } from "@/lib/payments/gateways.functions";
import { subscribeNewsletterFn } from "@/lib/newsletter.functions";
import { useServerFn } from "@tanstack/react-start";
import { categoriesQuery } from "@/lib/catalog";
import { flashDealCountdown } from "@/lib/cms/home";
import { cmsPublicGetPageBySlugFn } from "@/lib/cms.functions";
import { HomepageRenderer } from "@/components/cms/SectionRenderer";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: seoMeta({ path: "/" }),
    links: [canonicalLink("/")],
  }),
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(categoriesQuery());
    context.queryClient.ensureQueryData(featuredQuery());
    context.queryClient.ensureQueryData(trendingQuery());
    context.queryClient.ensureQueryData(bestSellersQuery());
    context.queryClient.ensureQueryData(productsBySlugsQuery(defaultHomepageConfig.hero.manualProductSlugs ?? defaultHomepageConfig.hero.floatingProductSlugs));
  },
  component: Home,
  errorComponent: () => <div className="p-8 text-center">Something went wrong loading the homepage.</div>,
  notFoundComponent: () => <div className="p-8 text-center">Page not found.</div>,
});

function Home() {
  // Additive: if an admin has published a CMS homepage, render that instead.
  const cmsHome = useTQuery({
    queryKey: ["cms-home"],
    queryFn: () => cmsPublicGetPageBySlugFn({ data: { slug: "home" } }),
    staleTime: 60_000,
  });
  if (cmsHome.data) {
    return (
      <div className="min-h-screen">
        <Header />
        <main>
          <HomepageRenderer sections={cmsHome.data.sections as any} />
        </main>
        <Footer />
      </div>
    );
  }
  const config = useHomepage((s) => s.config);
  const renderers: Record<SectionId, () => ReactElement | null> = {
    hero: () => (config.hero.enabled ? <Hero /> : null),
    trust: () => (config.trust.enabled ? <TrustStrip /> : null),
    categories: () => (config.categories.enabled ? <CategoriesGrid /> : null),
    productSections: () => <ProductSectionsBlock />,
    whyChoose: () => (config.whyChoose.enabled ? <WhyChoose /> : null),
    stats: () => (config.stats.enabled ? <Stats /> : null),
    testimonials: () => (config.testimonials.enabled ? <Testimonials /> : null),
    blog: () => (config.blog.enabled ? <BlogSection /> : null),
    faq: () => (config.faq.enabled ? <FAQ /> : null),
    paymentMethods: () => (config.paymentMethods.enabled ? <PaymentMethods /> : null),
    newsletter: () => (config.newsletter.enabled ? <CTA /> : null),
  };
  return (
    <div className="min-h-screen">
      <Header />
      <main>
        {config.sectionOrder.map((id, i) => {
          const node = renderers[id]?.();
          if (!node) return null;
          // Hero already animates internally; wrap the rest in Reveal.
          return id === "hero" ? (
            <div key={id}>{node}</div>
          ) : (
            <Reveal key={id} delay={Math.min(i * 40, 200)}>
              {node}
            </Reveal>
          );
        })}
      </main>
      <Footer />
    </div>
  );
}

function Hero() {
  const hero = useHomepage((s) => s.config.hero);
  const BadgeIcon = resolveIcon(hero.badge.icon);
  const source = hero.productSource ?? "manual";
  const manualSlugs = (hero.manualProductSlugs && hero.manualProductSlugs.length > 0
    ? hero.manualProductSlugs
    : hero.floatingProductSlugs) ?? [];
  const manualQ = useTQuery({ ...productsBySlugsQuery(manualSlugs), enabled: source === "manual" });
  const featuredQ = useTQuery({ ...heroFeaturedQuery(12), enabled: source === "featured" });
  const latestQ = useTQuery({ ...heroLatestQuery(12), enabled: source === "latest" });
  const pool: Product[] =
    source === "featured" ? (featuredQ.data ?? [])
      : source === "latest" ? (latestQ.data ?? [])
      : (manualQ.data ?? []);
  const floatingProducts: Product[] = pool.slice(0, 6);
  const durations = ["10s", "11.5s", "9s", "12s", "9.5s", "11s"];
  const delays = ["0s", "1.6s", "0.8s", "2.4s", "1.2s", "3s"];
  const PrimaryIcon = hero.primaryCta.icon ? resolveIcon(hero.primaryCta.icon) : null;
  const SecondaryIcon = hero.secondaryCta.icon ? resolveIcon(hero.secondaryCta.icon) : null;
  return (
    <section className="relative overflow-hidden bg-gradient-hero text-white">
      <div className="absolute inset-0 opacity-50 pointer-events-none">
        <div className="absolute -top-40 left-0 h-96 w-96 max-w-full rounded-full bg-primary/40 blur-3xl animate-float" />
        <div className="absolute top-20 right-0 h-80 w-80 max-w-full rounded-full bg-secondary/40 blur-3xl animate-float" style={{ animationDelay: "1.5s" }} />
        <div className="absolute bottom-0 left-1/3 h-72 w-72 max-w-[70vw] rounded-full bg-accent/30 blur-3xl animate-float" style={{ animationDelay: "3s" }} />
      </div>

      <div className="container mx-auto px-4 pt-14 pb-20 lg:pt-20 lg:pb-24 relative grid xl:grid-cols-[1.05fr_1fr] gap-10 items-center">
        <div className="min-w-0 space-y-6">
          <div className="inline-flex max-w-full min-w-0 items-center gap-2 px-4 py-1.5 rounded-full glass-dark text-sm">
            <BadgeIcon className="h-4 w-4 text-accent" />
            <span className="min-w-0 truncate">{hero.badge.text}</span>
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-[1.05] tracking-tight">
            {hero.title.lead}
            <span className="block text-gradient">{hero.title.accent}</span>
          </h1>
          <p className="text-lg text-white/75 max-w-xl leading-relaxed">{hero.description}</p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link
              to={hero.primaryCta.to}
              className="group relative inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-primary text-primary-foreground font-semibold shadow-glow hover:shadow-[0_18px_60px_-12px_color-mix(in_oklab,var(--primary-glow)_70%,transparent)] hover:scale-[1.03] active:scale-[0.99] transition-all duration-300 ease-out overflow-hidden"
            >
              <span className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-colors duration-300" />
              <span className="relative">{hero.primaryCta.label}</span>
              {PrimaryIcon ? (
                <PrimaryIcon className="relative h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
              ) : null}
            </Link>
            <a
              href={hero.secondaryCta.href || "#"}
              className="group inline-flex items-center gap-2 px-6 py-3.5 rounded-xl glass-dark text-white font-semibold hover:bg-white/15 hover:scale-[1.02] transition-all duration-300"
            >
              {SecondaryIcon ? <SecondaryIcon className="h-4 w-4 fill-white transition-transform duration-300 group-hover:scale-110" /> : null}
              {hero.secondaryCta.label}
            </a>
          </div>
          <div className="flex min-w-0 flex-wrap gap-6 pt-6 text-sm">
            {hero.trustItems.map((item) => {
              const Icon = resolveIcon(item.icon);
              return (
                <div key={item.id} className="flex min-w-0 items-center gap-2 text-white/80">
                  <div className="h-8 w-8 shrink-0 grid place-items-center rounded-lg bg-white/10">
                    <Icon className="h-4 w-4 text-accent" />
                  </div>
                  <span className="min-w-0 break-words">{item.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="hidden xl:grid grid-cols-2 gap-6 xl:gap-7 self-center">
          {floatingProducts.slice(0, 2).map((p, i) => (
            <FloatingCard key={p.slug} product={p} size="md" className="col-span-2" delay={delays[i]} duration={durations[i]} />
          ))}
          {floatingProducts.slice(2, 6).map((p, i) => (
            <FloatingCard key={p.slug} product={p} size="sm" delay={delays[i + 2]} duration={durations[i + 2]} />
          ))}
        </div>
      </div>
    </section>
  );
}

function FloatingCard({ product, delay = "0s", duration = "10s", size = "md", className = "" }: { product: Product; delay?: string; duration?: string; size?: "sm" | "md"; className?: string }) {
  const isMd = size === "md";
  return (
    <Link
      to="/products/$slug"
      params={{ slug: product.slug }}
      aria-label={`View ${product.name}`}
      className={`group relative block cursor-pointer rounded-2xl animate-float transition-all duration-500 ease-out hover:-translate-y-1.5 ${className}`}
      style={{ animationDelay: delay, animationDuration: duration }}
    >
      <div className="absolute -inset-1 rounded-[1.25rem] bg-gradient-primary opacity-25 blur-2xl pointer-events-none group-hover:opacity-60 transition-opacity duration-500" />
      <div
        className={`relative rounded-2xl border border-white/15 bg-white/[0.07] backdrop-blur-2xl ring-1 ring-inset ring-white/5 shadow-[0_20px_60px_-25px_rgba(0,0,0,0.65),inset_0_1px_0_0_rgba(255,255,255,0.08)] group-hover:border-accent/40 group-hover:ring-accent/20 transition-all duration-500 ${isMd ? "p-4" : "p-3.5"}`}
      >
        <div className="absolute inset-x-3 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent pointer-events-none" />
        <div className="flex items-center gap-3">
          <div className={`${isMd ? "h-12 w-12" : "h-11 w-11"} shrink-0 rounded-xl bg-gradient-primary grid place-items-center overflow-hidden text-xl shadow-glow ring-1 ring-white/20`}>
            {product.thumbnailUrl ? (
              <img src={product.thumbnailUrl} alt={product.name} className="h-full w-full object-cover" loading="lazy" decoding="async" />
            ) : (
              <span>{product.emoji}</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className={`${isMd ? "text-sm" : "text-[13px]"} font-semibold truncate text-white leading-tight`}>{product.name}</div>
            <div className="mt-1 inline-flex items-center gap-1.5 text-[10px] font-semibold text-emerald-300/95">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)] animate-pulse" />
              <span className="tracking-wide uppercase">Instant delivery</span>
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className={`${isMd ? "text-sm" : "text-[13px]"} font-bold text-accent leading-tight`}>${product.price}</div>
            {product.oldPrice && <div className="text-[10px] text-white/40 line-through">${product.oldPrice}</div>}
          </div>
        </div>
      </div>
    </Link>
  );
}


function TrustStrip() {
  const rawItems = useHomepage((s) => s.config.trust.items);
  const items = useMemo(() => rawItems.filter((i) => i.enabled), [rawItems]);
  return (
    <div className="container mx-auto px-4 -mt-12 relative z-10">
      <div className="bg-card border border-border rounded-3xl shadow-premium p-4 sm:p-6 grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-5 items-stretch">
        {items.map((item) => {
          const Icon = resolveIcon(item.icon);
          return (
            <div key={item.id} className="flex h-full items-center gap-3 sm:gap-4 rounded-2xl p-3 sm:p-2 bg-muted/40 md:bg-transparent">
              <div className="h-12 w-12 sm:h-14 sm:w-14 grid place-items-center rounded-2xl bg-primary/10 text-primary shrink-0">
                <Icon className="h-6 w-6 sm:h-7 sm:w-7" />
              </div>
              <div className="min-w-0">
                <div className="font-bold text-sm sm:text-base text-foreground leading-tight">{item.title}</div>
                <div className="text-xs sm:text-[13px] text-muted-foreground mt-1 leading-snug">{item.desc}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CategoriesGrid() {
  const cfg = useHomepage((s) => s.config.categories);
  const cats = useCategories().slice(0, cfg.limit);
  return (
    <Section
      eyebrow={cfg.eyebrow}
      title={cfg.title}
      subtitle={cfg.subtitle}
      action={
        <Link to="/categories" className="text-sm font-semibold text-primary inline-flex items-center gap-1 hover:gap-2 transition-all">
          {cfg.viewAllLabel} <ChevronRight className="h-4 w-4" />
        </Link>
      }
    >
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 sm:gap-5">
        {cats.map((c) => (
          <Link
            key={c.slug}
            to="/products"
            className="group relative rounded-2xl bg-card border border-border p-5 sm:p-6 hover:border-primary/50 hover:shadow-premium hover:-translate-y-1.5 transition-all duration-400 ease-out overflow-hidden"
          >
            <div className="absolute -inset-px rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none [background:linear-gradient(135deg,color-mix(in_oklab,var(--primary)_25%,transparent),transparent_60%)]" />
            <div className="absolute inset-0 bg-gradient-primary opacity-0 group-hover:opacity-[0.05] transition-opacity duration-500" />
            <div className="relative text-4xl sm:text-5xl mb-3 group-hover:scale-110 group-hover:-rotate-3 transition-transform duration-400 origin-left">{c.emoji}</div>
            <div className="relative font-semibold text-sm sm:text-base leading-tight group-hover:text-primary transition-colors duration-300">{c.name}</div>
            <div className="relative text-xs text-muted-foreground mt-1">{c.count} products</div>
          </Link>
        ))}
      </div>
    </Section>
  );
}

function ProductSectionsBlock() {
  const rawSections = useHomepage((s) => s.config.productSections);
  const sections = useMemo(() => rawSections.filter((p) => p.enabled), [rawSections]);
  return (
    <>
      {sections.map((s, i) => (
        <ProductSectionBlock key={s.id} section={s} action={i === 0 ? <Countdown /> : undefined} />
      ))}
    </>
  );
}

function ProductSectionBlock({ section, action }: { section: HomeProductSection; action?: React.ReactNode }) {
  const items = useProductSection({
    id: section.id,
    eyebrow: section.eyebrow,
    title: section.title,
    subtitle: section.subtitle,
    source: section.source,
    limit: section.limit,
  });
  return (
    <Section eyebrow={section.eyebrow} title={section.title} subtitle={section.subtitle} action={action}>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        {items.map((p) => <ProductCard key={p.slug} product={p} />)}
      </div>
    </Section>
  );
}

function Countdown() {
  const segments = [
    { v: String(flashDealCountdown.hours).padStart(2, "0"), l: "hrs" },
    { v: String(flashDealCountdown.minutes).padStart(2, "0"), l: "min" },
    { v: String(flashDealCountdown.seconds).padStart(2, "0"), l: "sec" },
  ];
  return (
    <div className="flex items-center gap-2">
      {segments.map(({ v, l }) => (
        <div key={l} className="h-14 w-14 rounded-xl bg-gradient-primary text-primary-foreground grid place-items-center shadow-elegant">
          <div className="text-center leading-none">
            <div className="text-lg font-bold">{v}</div>
            <div className="text-[9px] opacity-80 mt-0.5">{l}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function WhyChoose() {
  const cfg = useHomepage((s) => s.config.whyChoose);
  const items = cfg.items.filter((i) => i.enabled);
  return (
    <div className="bg-muted/40">
      <Section eyebrow={cfg.eyebrow} title={cfg.title}>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {items.map((item) => {
            const Icon = resolveIcon(item.icon);
            return (
              <div key={item.id} className="rounded-2xl bg-card border border-border p-6 hover:shadow-elegant hover:border-primary/30 transition-smooth">
                <div className="h-12 w-12 rounded-xl bg-gradient-primary grid place-items-center text-primary-foreground shadow-glow mb-4">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="font-semibold text-lg mb-1.5">{item.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
              </div>
            );
          })}
        </div>
      </Section>
    </div>
  );
}

function Stats() {
  const rawItems = useHomepage((s) => s.config.stats.items);
  const items = useMemo(() => rawItems.filter((i) => i.enabled), [rawItems]);
  const fallbackIcons = ["Users", "Gift", "Star", "Headphones"] as const;
  return (
    <div className="container mx-auto px-4 py-16">
      <div className="rounded-3xl bg-gradient-hero text-white p-6 sm:p-10 lg:p-14 shadow-premium relative overflow-hidden">
        <div className="absolute top-0 right-0 h-72 w-72 max-w-full rounded-full bg-primary/40 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 h-72 w-72 max-w-full rounded-full bg-accent/30 blur-3xl pointer-events-none" />
        <div className="relative grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
          {items.map((s, i) => {
            const Icon = resolveIcon(s.icon ?? fallbackIcons[i % fallbackIcons.length]);
            return (
              <div
                key={s.id}
                className="group relative rounded-2xl border border-white/15 bg-white/[0.07] backdrop-blur-xl p-5 sm:p-6 text-center shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)] hover:border-white/30 hover:bg-white/[0.1] hover:-translate-y-0.5 transition-all duration-300 animate-fade-in"
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <div className="mx-auto mb-3 h-11 w-11 grid place-items-center rounded-xl bg-white/10 ring-1 ring-inset ring-white/15 text-accent">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight leading-none">
                  <CountUp value={s.value} />
                </div>
                <div className="mt-2 text-xs sm:text-sm font-medium text-white/85">{s.label}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function CountUp({ value, duration = 1400 }: { value: string; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const match = /^([\d.]+)(.*)$/.exec(value);
  const target = match ? parseFloat(match[1]) : NaN;
  const suffix = match ? match[2] : "";
  const [display, setDisplay] = useState(Number.isFinite(target) ? "0" : value);
  useEffect(() => {
    if (!Number.isFinite(target) || !ref.current) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { setDisplay(String(target)); return; }
    const node = ref.current;
    let raf = 0; let start = 0; let done = false;
    const isInt = Number.isInteger(target);
    const step = (t: number) => {
      if (!start) start = t;
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      const v = target * eased;
      setDisplay(isInt ? String(Math.round(v)) : v.toFixed(1));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    const io = new IntersectionObserver((entries) => {
      if (done) return;
      if (entries.some((e) => e.isIntersecting)) { done = true; raf = requestAnimationFrame(step); io.disconnect(); }
    }, { threshold: 0.3 });
    io.observe(node);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, [target, duration]);
  return <span ref={ref}>{display}{suffix}</span>;
}

function Testimonials() {
  const cfg = useHomepage((s) => s.config.testimonials);
  const items = cfg.items.filter((t) => t.enabled);
  return (
    <Section eyebrow={cfg.eyebrow} title={cfg.title}>
      <div className="grid md:grid-cols-3 gap-5 items-stretch">
        {items.map((r) => (
          <div
            key={r.id}
            className="group relative flex flex-col h-full rounded-2xl bg-card border border-border p-6 hover:border-primary/30 hover:shadow-premium hover:-translate-y-1 transition-all duration-400 ease-out"
          >
            <div className="absolute -top-3 left-6 text-5xl leading-none text-primary/15 select-none pointer-events-none font-serif">"</div>
            <div className="flex gap-0.5 mb-3">
              {Array.from({ length: r.rating }).map((_, i) => (
                <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
              ))}
            </div>
            <p className="text-sm leading-relaxed text-foreground/90 mb-5 flex-1">"{r.text}"</p>
            <div className="flex items-center gap-3 mt-auto">
              <div className="h-12 w-12 shrink-0 rounded-full bg-gradient-primary grid place-items-center text-xl ring-2 ring-background shadow-elegant">{r.emoji}</div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <div className="font-semibold text-sm truncate">{r.name}</div>
                  <BadgeCheck className="h-4 w-4 shrink-0 text-primary" aria-label="Verified buyer" />
                </div>
                <div className="text-xs text-muted-foreground truncate">{r.role}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

function BlogSection() {
  const cfg = useHomepage((s) => s.config.blog);
  const posts = blogPosts.slice(0, cfg.limit);
  if (!posts.length) return null;
  return (
    <Section
      eyebrow={cfg.eyebrow}
      title={cfg.title}
      subtitle={cfg.subtitle || undefined}
      action={
        <Link to="/blog" className="text-sm font-semibold text-primary inline-flex items-center gap-1 hover:gap-2 transition-all">
          {cfg.viewAllLabel} <ChevronRight className="h-4 w-4" />
        </Link>
      }
    >
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 items-stretch">
        {posts.map((p) => (
          <Link key={p.slug} to="/blog/$slug" params={{ slug: p.slug }} className="group flex flex-col rounded-2xl bg-card border border-border overflow-hidden hover:shadow-premium hover:-translate-y-1 transition-smooth">
            {cfg.showImage && (
              <div className="aspect-[16/10] bg-gradient-to-br from-primary/10 via-secondary/10 to-accent/10 grid place-items-center text-7xl">{p.emoji}</div>
            )}
            <div className="p-5 flex-1 flex flex-col gap-2">
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="font-semibold text-primary">{p.category}</span>
                {cfg.showDate && (
                  <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" /> {p.date}</span>
                )}
              </div>
              <h3 className="font-bold text-base leading-snug group-hover:text-primary transition-smooth line-clamp-2">{p.title}</h3>
              {cfg.showExcerpt && <p className="text-sm text-muted-foreground line-clamp-2">{p.excerpt}</p>}
              {cfg.showReadMore && (
                <div className="inline-flex items-center gap-1 text-sm font-semibold text-primary pt-2 mt-auto">
                  Read article <ArrowRight className="h-3.5 w-3.5" />
                </div>
              )}
            </div>
          </Link>
        ))}
      </div>
    </Section>
  );
}

function PaymentMethods() {
  const cfg = useHomepage((s) => s.config.paymentMethods);
  const listFn = useServerFn(listEnabledGatewaysFn);
  const { data } = useTQuery({
    queryKey: ["home", "payment-gateways"],
    queryFn: () => listFn(),
    staleTime: 60_000,
  });
  const gateways = data?.gateways ?? [];
  return (
    <div className="container mx-auto px-4 py-16">
      <div className="rounded-3xl bg-card border border-border p-6 sm:p-8 text-center">
        <div className="inline-flex items-center gap-2 text-xs font-semibold text-primary mb-2">
          <ShieldCheck className="h-4 w-4" /> {cfg.trustLabel}
        </div>
        <h3 className="text-xl sm:text-2xl font-bold text-foreground mb-1">{cfg.title}</h3>
        <p className="text-sm text-muted-foreground mb-6">{cfg.subtitle}</p>
        {gateways.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            {gateways.map((g) => (
              <div key={g.id} title={g.name} className="h-14 grid place-items-center rounded-xl border border-border bg-muted/40 px-2 hover:border-primary/40 transition-smooth">
                {g.logo_url ? (
                  <img src={g.logo_url} alt={g.name} className="max-h-8 max-w-full object-contain" loading="lazy" />
                ) : (
                  <span className="text-xs font-bold tracking-tight text-foreground/80">{g.name}</span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground italic">No payment methods configured yet.</p>
        )}
      </div>
    </div>
  );
}

function FAQ() {
  const cfg = useHomepage((s) => s.config.faq);
  const items = cfg.items.filter((f) => f.enabled);
  return (
    <div className="bg-muted/40">
      <Section eyebrow={cfg.eyebrow} title={cfg.title}>
        <div className="max-w-3xl mx-auto space-y-3">
          {items.map((f) => (
            <details
              key={f.id}
              className="group rounded-2xl bg-card border border-border p-5 hover:border-primary/30 open:border-primary/50 open:shadow-elegant transition-all duration-300 [&_summary::-webkit-details-marker]:hidden"
            >
              <summary className="flex items-center justify-between gap-4 cursor-pointer font-semibold list-none group-open:text-primary transition-colors">
                <span>{f.q}</span>
                <span className="h-8 w-8 shrink-0 grid place-items-center rounded-full bg-primary/10 text-primary group-open:bg-primary group-open:text-primary-foreground transition-all duration-300">
                  <ChevronRight className="h-4 w-4 group-open:rotate-90 transition-transform duration-300" />
                </span>
              </summary>
              <p className="text-sm text-muted-foreground mt-3 leading-relaxed animate-fade-in">{f.a}</p>
            </details>
          ))}
        </div>
      </Section>
    </div>
  );
}

function CTA() {
  const cfg = useHomepage((s) => s.config.newsletter);
  const BadgeIcon = resolveIcon(cfg.badge.icon);
  const BtnIcon = resolveIcon(cfg.buttonIcon);
  const subscribe = useServerFn(subscribeNewsletterFn);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "err">("idle");
  const [message, setMessage] = useState<string>("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = email.trim();
    if (!value || !/^\S+@\S+\.\S+$/.test(value)) {
      setStatus("err");
      setMessage("Please enter a valid email address.");
      return;
    }
    setStatus("loading");
    try {
      const r = await subscribe({ data: { email: value, source: "homepage" } });
      if (r.ok) {
        setStatus("ok");
        setMessage(r.already ? "You're already subscribed — thanks!" : "Thanks! You're subscribed.");
        setEmail("");
      } else {
        setStatus("err");
        setMessage(r.message || "Subscription failed. Please try again.");
      }
    } catch (err) {
      setStatus("err");
      setMessage(err instanceof Error ? err.message : "Subscription failed.");
    }
  };

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="rounded-3xl bg-gradient-primary text-primary-foreground p-6 sm:p-10 lg:p-16 shadow-premium relative overflow-hidden text-center">
        <div className="absolute top-0 right-0 h-72 w-72 max-w-full rounded-full bg-white/10 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-72 w-72 max-w-full rounded-full bg-accent/30 blur-3xl" />
        <div className="relative max-w-2xl mx-auto space-y-5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 text-xs font-semibold">
            <BadgeIcon className="h-3.5 w-3.5" /> {cfg.badge.text}
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold">{cfg.title}</h2>
          <p className="text-white/85 text-lg">{cfg.subtitle}</p>
          <form className="flex min-w-0 flex-col sm:flex-row gap-3 max-w-md mx-auto pt-2 items-stretch" onSubmit={submit}>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={cfg.placeholder}
              maxLength={254}
              disabled={status === "loading"}
              className="min-w-0 flex-1 h-12 px-4 rounded-xl bg-white/15 backdrop-blur text-white placeholder:text-white/60 outline-none focus:bg-white/20 border border-white/20 disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={status === "loading"}
              className="h-12 px-6 rounded-xl bg-accent text-accent-foreground font-semibold hover:scale-105 transition-smooth inline-flex items-center justify-center gap-2 disabled:opacity-60 disabled:hover:scale-100"
            >
              <BtnIcon className="h-4 w-4" /> {status === "loading" ? "Subscribing…" : cfg.buttonLabel}
            </button>
          </form>
          {message && (
            <p
              role="status"
              className={`text-sm pt-1 ${status === "ok" ? "text-emerald-100" : "text-red-100"}`}
            >
              {message}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
