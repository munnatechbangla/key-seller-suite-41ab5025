import { seoMeta, canonicalLink } from "@/lib/cms/seo";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Star, ChevronRight, Calendar, ArrowRight, ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState, type ReactElement } from "react";
import { useQuery as useTQuery } from "@tanstack/react-query";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { Section } from "@/components/site/Section";
import { ProductCard } from "@/components/site/ProductCard";
import { blogPosts } from "@/lib/catalog";
import {
  useCategories,
  featuredQuery,
  trendingQuery,
  bestSellersQuery,
  productsBySlugsQuery,
  type Product,
} from "@/lib/catalog";
import { useProductSection, useResolvedProducts, resolveIcon } from "@/lib/cms";
import { useHomepage, defaultHomepageConfig, type HomeProductSection, type SectionId } from "@/lib/cms/homepage";
import { listEnabledGatewaysFn } from "@/lib/payments/gateways.functions";
import { useServerFn } from "@tanstack/react-start";
import { categoriesQuery } from "@/lib/catalog";
import { flashDealCountdown } from "@/lib/cms/home";

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
    context.queryClient.ensureQueryData(productsBySlugsQuery(defaultHomepageConfig.hero.floatingProductSlugs));
  },
  component: Home,
  errorComponent: () => <div className="p-8 text-center">Something went wrong loading the homepage.</div>,
  notFoundComponent: () => <div className="p-8 text-center">Page not found.</div>,
});

function Home() {
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
        {config.sectionOrder.map((id) => {
          const node = renderers[id]?.();
          return node ? <div key={id}>{node}</div> : null;
        })}
      </main>
      <Footer />
    </div>
  );
}

function Hero() {
  const hero = useHomepage((s) => s.config.hero);
  const BadgeIcon = resolveIcon(hero.badge.icon);
  const floatingProducts = useResolvedProducts(hero.floatingProductSlugs);
  const durations = ["6.5s", "8s", "7s", "7.8s", "6.8s", "8.4s"];
  const delays = ["0s", "1.4s", "0.6s", "2.2s", "1s", "2.8s"];
  const PrimaryIcon = hero.primaryCta.icon ? resolveIcon(hero.primaryCta.icon) : null;
  const SecondaryIcon = hero.secondaryCta.icon ? resolveIcon(hero.secondaryCta.icon) : null;
  return (
    <section className="relative overflow-hidden bg-gradient-hero text-white">
      <div className="absolute inset-0 opacity-50 pointer-events-none">
        <div className="absolute -top-40 -left-20 h-96 w-96 rounded-full bg-primary/40 blur-3xl animate-float" />
        <div className="absolute top-20 right-0 h-96 w-96 rounded-full bg-secondary/40 blur-3xl animate-float" style={{ animationDelay: "1.5s" }} />
        <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-accent/30 blur-3xl animate-float" style={{ animationDelay: "3s" }} />
      </div>

      <div className="container mx-auto px-4 pt-14 pb-20 lg:pt-20 lg:pb-24 relative grid lg:grid-cols-[1.05fr_1fr] gap-10 items-center">
        <div className="space-y-6">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass-dark text-sm">
            <BadgeIcon className="h-4 w-4 text-accent" />
            <span>{hero.badge.text}</span>
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-[1.05] tracking-tight">
            {hero.title.lead}
            <span className="block text-gradient">{hero.title.accent}</span>
          </h1>
          <p className="text-lg text-white/75 max-w-xl leading-relaxed">{hero.description}</p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link to={hero.primaryCta.to} className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-primary text-primary-foreground font-semibold shadow-glow hover:scale-105 transition-smooth">
              {hero.primaryCta.label}
              {PrimaryIcon ? <PrimaryIcon className="h-4 w-4" /> : null}
            </Link>
            <a href={hero.secondaryCta.href || "#"} className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl glass-dark text-white font-semibold hover:bg-white/15 transition-smooth">
              {SecondaryIcon ? <SecondaryIcon className="h-4 w-4 fill-white" /> : null}
              {hero.secondaryCta.label}
            </a>
          </div>
          <div className="flex flex-wrap gap-6 pt-6 text-sm">
            {hero.trustItems.map((item) => {
              const Icon = resolveIcon(item.icon);
              return (
                <div key={item.id} className="flex items-center gap-2 text-white/80">
                  <div className="h-8 w-8 grid place-items-center rounded-lg bg-white/10">
                    <Icon className="h-4 w-4 text-accent" />
                  </div>
                  {item.label}
                </div>
              );
            })}
          </div>
        </div>

        <div className="hidden lg:grid grid-cols-2 gap-4 self-center">
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

function FloatingCard({ product, delay = "0s", duration = "7s", size = "md", className = "" }: { product: Product; delay?: string; duration?: string; size?: "sm" | "md"; className?: string }) {
  const isMd = size === "md";
  return (
    <div className={`relative glass-dark rounded-2xl shadow-premium animate-float ring-1 ring-white/10 hover:ring-accent/40 transition-smooth ${isMd ? "p-4" : "p-3"} ${className}`} style={{ animationDelay: delay, animationDuration: duration }}>
      <div className="absolute -inset-px rounded-2xl bg-gradient-primary opacity-20 blur-xl pointer-events-none" />
      <div className="relative flex items-center gap-3">
        <div className={`${isMd ? "h-12 w-12" : "h-10 w-10"} rounded-xl bg-gradient-primary grid place-items-center overflow-hidden text-xl shadow-glow shrink-0`}>
          {product.thumbnailUrl ? (
            <img src={product.thumbnailUrl} alt={product.name} className="h-full w-full object-cover" />
          ) : (
            <span>{product.emoji}</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className={`${isMd ? "text-sm" : "text-xs"} font-semibold truncate`}>{product.name}</div>
          <div className="flex items-center gap-1 text-[11px] text-white/60">
            <Star className="h-3 w-3 fill-accent text-accent" /> {product.rating} · {product.delivery}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className={`${isMd ? "text-sm" : "text-xs"} font-bold text-accent`}>${product.price}</div>
          {product.oldPrice && <div className="text-[10px] text-white/40 line-through">${product.oldPrice}</div>}
        </div>
      </div>
    </div>
  );
}

function TrustStrip() {
  const items = useHomepage((s) => s.config.trust.items.filter((i) => i.enabled));
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
          <Link key={c.slug} to="/products" className="group relative rounded-2xl bg-card border border-border p-5 sm:p-6 hover:border-primary/40 hover:shadow-premium hover:-translate-y-1 transition-smooth overflow-hidden">
            <div className="absolute inset-0 bg-gradient-primary opacity-0 group-hover:opacity-[0.06] transition-smooth" />
            <div className="text-4xl sm:text-5xl mb-3 group-hover:scale-110 transition-smooth origin-left">{c.emoji}</div>
            <div className="font-semibold text-sm sm:text-base leading-tight">{c.name}</div>
            <div className="text-xs text-muted-foreground mt-1">{c.count} products</div>
          </Link>
        ))}
      </div>
    </Section>
  );
}

function ProductSectionsBlock() {
  const sections = useHomepage((s) => s.config.productSections.filter((p) => p.enabled));
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
  const items = useHomepage((s) => s.config.stats.items.filter((i) => i.enabled));
  return (
    <div className="container mx-auto px-4 py-16">
      <div className="rounded-3xl bg-gradient-hero text-white p-10 lg:p-16 shadow-premium relative overflow-hidden">
        <div className="absolute -top-20 -right-20 h-80 w-80 rounded-full bg-primary/40 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 h-80 w-80 rounded-full bg-accent/30 blur-3xl" />
        <div className="relative grid grid-cols-2 lg:grid-cols-4 gap-8 text-center">
          {items.map((s, i) => (
            <div key={s.id} className="animate-fade-in" style={{ animationDelay: `${i * 80}ms` }}>
              <div className="text-4xl lg:text-5xl font-extrabold text-gradient mb-1">
                <CountUp value={s.value} />
              </div>
              <div className="text-sm text-white/70">{s.label}</div>
            </div>
          ))}
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
          <div key={r.id} className="flex flex-col h-full rounded-2xl bg-card border border-border p-6 hover:shadow-elegant transition-smooth">
            <div className="flex gap-0.5 mb-3">
              {Array.from({ length: r.rating }).map((_, i) => (
                <Star key={i} className="h-4 w-4 fill-accent text-accent" />
              ))}
            </div>
            <p className="text-sm leading-relaxed text-foreground/90 mb-5 flex-1">"{r.text}"</p>
            <div className="flex items-center gap-3 mt-auto">
              <div className="h-12 w-12 shrink-0 rounded-full bg-gradient-primary grid place-items-center text-xl">{r.emoji}</div>
              <div className="min-w-0">
                <div className="font-semibold text-sm truncate">{r.name}</div>
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
    <div className="container mx-auto px-4 pb-4">
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
            <details key={f.id} className="group rounded-2xl bg-card border border-border p-5 hover:border-primary/30 transition-smooth [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex items-center justify-between cursor-pointer font-semibold">
                {f.q}
                <ChevronRight className="h-5 w-5 text-primary group-open:rotate-90 transition-transform" />
              </summary>
              <p className="text-sm text-muted-foreground mt-3 leading-relaxed">{f.a}</p>
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
  return (
    <div className="container mx-auto px-4 py-16">
      <div className="rounded-3xl bg-gradient-primary text-primary-foreground p-10 lg:p-16 shadow-premium relative overflow-hidden text-center">
        <div className="absolute -top-24 -right-24 h-80 w-80 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 h-80 w-80 rounded-full bg-accent/30 blur-3xl" />
        <div className="relative max-w-2xl mx-auto space-y-5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 text-xs font-semibold">
            <BadgeIcon className="h-3.5 w-3.5" /> {cfg.badge.text}
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold">{cfg.title}</h2>
          <p className="text-white/85 text-lg">{cfg.subtitle}</p>
          <form className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto pt-2 items-stretch" onSubmit={(e) => { e.preventDefault(); }}>
            <input type="email" required placeholder={cfg.placeholder} className="flex-1 h-12 px-4 rounded-xl bg-white/15 backdrop-blur text-white placeholder:text-white/60 outline-none focus:bg-white/20 border border-white/20" />
            <button className="h-12 px-6 rounded-xl bg-accent text-accent-foreground font-semibold hover:scale-105 transition-smooth inline-flex items-center justify-center gap-2">
              <BtnIcon className="h-4 w-4" /> {cfg.buttonLabel}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
