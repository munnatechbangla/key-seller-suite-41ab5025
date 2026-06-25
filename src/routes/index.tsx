import { seoMeta, siteName, canonicalLink } from "@/lib/cms/seo";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Star, ChevronRight, Calendar, ArrowRight, ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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
import {
  resolveIcon,
  useProductSection,
  useResolvedProducts,
  heroConfig,
  trustStripItems,
  whyChooseItems,
  whyChooseSection,
  statsItems,
  testimonials,
  testimonialsSection,
  homeFaqs,
  faqSection,
  flashDealCountdown,
  productSections,
  categoriesSection,
  newsletterCta,
} from "@/lib/cms";
import { categoriesQuery } from "@/lib/catalog";

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
    context.queryClient.ensureQueryData(productsBySlugsQuery(heroConfig.floatingProductSlugs));
  },
  component: Home,
  errorComponent: () => <div className="p-8 text-center">Something went wrong loading the homepage.</div>,
  notFoundComponent: () => <div className="p-8 text-center">Page not found.</div>,
});

function Home() {
  return (
    <div className="min-h-screen">
      <Header />
      <main>
        <Hero />
        <TrustStrip />
        <CategoriesGrid />
        {productSections.map((s, i) => (
          <ProductSectionBlock key={s.id} section={s} action={i === 0 ? <Countdown /> : undefined} />
        ))}
        <WhyChoose />
        <Stats />
        <Testimonials />
        <BlogSection />
        <FAQ />
        <PaymentMethods />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}

function Hero() {
  const BadgeIcon = resolveIcon(heroConfig.badge.icon);
  const floatingProducts = useResolvedProducts(heroConfig.floatingProductSlugs);
  // 6 cards in a tidy 3-row × 2-col grid — no overlaps at any breakpoint.
  const durations = ["6s", "7s", "8s", "6.5s", "7.5s", "8.5s"];
  const delays = ["0s", "1.2s", "2.4s", "0.6s", "1.8s", "3s"];
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
            <span>{heroConfig.badge.text}</span>
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-[1.05] tracking-tight">
            {heroConfig.title.lead}
            <span className="block text-gradient">{heroConfig.title.accent}</span>
          </h1>
          <p className="text-lg text-white/75 max-w-xl leading-relaxed">{heroConfig.description}</p>
          <div className="flex flex-wrap gap-3 pt-2">
            {heroConfig.ctas.map((cta) => {
              const Icon = cta.icon ? resolveIcon(cta.icon) : null;
              const classes =
                cta.variant === "primary"
                  ? "inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-primary text-primary-foreground font-semibold shadow-glow hover:scale-105 transition-smooth"
                  : "inline-flex items-center gap-2 px-6 py-3.5 rounded-xl glass-dark text-white font-semibold hover:bg-white/15 transition-smooth";
              const content = (
                <>
                  {cta.variant === "ghost" && Icon ? <Icon className="h-4 w-4 fill-white" /> : null}
                  {cta.label}
                  {cta.variant === "primary" && Icon ? <Icon className="h-4 w-4" /> : null}
                </>
              );
              return cta.to ? (
                <Link key={cta.label} to={cta.to} className={classes}>{content}</Link>
              ) : (
                <a key={cta.label} href={cta.href ?? "#"} className={classes}>{content}</a>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-6 pt-6 text-sm">
            {heroConfig.trustItems.map((item) => {
              const Icon = resolveIcon(item.icon);
              return (
                <div key={item.label} className="flex items-center gap-2 text-white/80">
                  <div className="h-8 w-8 grid place-items-center rounded-lg bg-white/10">
                    <Icon className="h-4 w-4 text-accent" />
                  </div>
                  {item.label}
                </div>
              );
            })}
          </div>
        </div>

        <div className="hidden lg:grid grid-cols-2 gap-4 self-stretch content-center">
          {floatingProducts.slice(0, 6).map((p, i) => (
            <FloatingCard
              key={p.slug}
              product={p}
              delay={delays[i % delays.length]}
              duration={durations[i % durations.length]}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function FloatingCard({ product, delay = "0s", duration = "7s" }: { product: Product; delay?: string; duration?: string }) {
  return (
    <div className="glass-dark rounded-2xl p-3.5 shadow-premium animate-float" style={{ animationDelay: delay, animationDuration: duration }}>
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-xl bg-gradient-primary grid place-items-center overflow-hidden text-xl shadow-glow shrink-0">
          {product.thumbnailUrl ? (
            <img src={product.thumbnailUrl} alt={product.name} className="h-full w-full object-cover" />
          ) : (
            <span>{product.emoji}</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold truncate">{product.name}</div>
          <div className="flex items-center gap-1 text-xs text-white/60">
            <Star className="h-3 w-3 fill-accent text-accent" /> {product.rating} · {product.delivery}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-sm font-bold text-accent">${product.price}</div>
          {product.oldPrice && <div className="text-[10px] text-white/40 line-through">${product.oldPrice}</div>}
        </div>
      </div>
    </div>
  );
}

function TrustStrip() {
  return (
    <div className="container mx-auto px-4 -mt-12 relative z-10">
      <div className="bg-card border border-border rounded-3xl shadow-premium p-6 grid grid-cols-2 md:grid-cols-4 gap-6">
        {trustStripItems.map((item) => {
          const Icon = resolveIcon(item.icon);
          return (
            <div key={item.title} className="flex items-center gap-3">
              <div className="h-12 w-12 grid place-items-center rounded-2xl bg-gradient-primary text-primary-foreground shadow-elegant shrink-0">
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-sm text-foreground">{item.title}</div>
                <div className="text-xs text-muted-foreground">{item.desc}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CategoriesGrid() {
  return (
    <Section
      eyebrow={categoriesSection.eyebrow}
      title={categoriesSection.title}
      subtitle={categoriesSection.subtitle}
      action={
        <Link to="/categories" className="text-sm font-semibold text-primary inline-flex items-center gap-1 hover:gap-2 transition-all">
          {categoriesSection.viewAllLabel} <ChevronRight className="h-4 w-4" />
        </Link>
      }
    >
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {useCategories().map((c) => (
          <Link
            key={c.slug}
            to="/products"
            className="group relative rounded-2xl bg-card border border-border p-5 hover:border-primary/40 hover:shadow-premium hover:-translate-y-1 transition-smooth overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-primary opacity-0 group-hover:opacity-5 transition-smooth" />
            <div className="text-4xl mb-3">{c.emoji}</div>
            <div className="font-semibold text-sm">{c.name}</div>
            <div className="text-xs text-muted-foreground mt-1">{c.count} products</div>
          </Link>
        ))}
      </div>
    </Section>
  );
}

function ProductSectionBlock({ section, action }: { section: (typeof productSections)[number]; action?: React.ReactNode }) {
  const items = useProductSection(section);
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
  return (
    <div className="bg-muted/40">
      <Section eyebrow={whyChooseSection.eyebrow} title={whyChooseSection.title}>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {whyChooseItems.map((item) => {
            const Icon = resolveIcon(item.icon);
            return (
              <div key={item.title} className="rounded-2xl bg-card border border-border p-6 hover:shadow-elegant hover:border-primary/30 transition-smooth">
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
  return (
    <div className="container mx-auto px-4 py-16">
      <div className="rounded-3xl bg-gradient-hero text-white p-10 lg:p-16 shadow-premium relative overflow-hidden">
        <div className="absolute -top-20 -right-20 h-80 w-80 rounded-full bg-primary/40 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 h-80 w-80 rounded-full bg-accent/30 blur-3xl" />
        <div className="relative grid grid-cols-2 lg:grid-cols-4 gap-8 text-center">
          {statsItems.map((s) => (
            <div key={s.label}>
              <div className="text-4xl lg:text-5xl font-extrabold text-gradient mb-1">{s.value}</div>
              <div className="text-sm text-white/70">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Testimonials() {
  return (
    <Section eyebrow={testimonialsSection.eyebrow} title={testimonialsSection.title}>
      <div className="grid md:grid-cols-3 gap-5">
        {testimonials.map((r) => (
          <div key={r.name} className="rounded-2xl bg-card border border-border p-6 hover:shadow-elegant transition-smooth">
            <div className="flex gap-0.5 mb-3">
              {Array.from({ length: r.rating }).map((_, i) => (
                <Star key={i} className="h-4 w-4 fill-accent text-accent" />
              ))}
            </div>
            <p className="text-sm leading-relaxed text-foreground/90 mb-5">"{r.text}"</p>
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-full bg-gradient-primary grid place-items-center text-xl">{r.emoji}</div>
              <div>
                <div className="font-semibold text-sm">{r.name}</div>
                <div className="text-xs text-muted-foreground">{r.role}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

function FAQ() {
  return (
    <div className="bg-muted/40">
      <Section eyebrow={faqSection.eyebrow} title={faqSection.title}>
        <div className="max-w-3xl mx-auto space-y-3">
          {homeFaqs.map((f, i) => (
            <details key={i} className="group rounded-2xl bg-card border border-border p-5 hover:border-primary/30 transition-smooth [&_summary::-webkit-details-marker]:hidden">
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
  const BadgeIcon = resolveIcon(newsletterCta.badge.icon);
  const BtnIcon = resolveIcon(newsletterCta.button.icon);
  return (
    <div className="container mx-auto px-4 py-16">
      <div className="rounded-3xl bg-gradient-primary text-primary-foreground p-10 lg:p-16 shadow-premium relative overflow-hidden text-center">
        <div className="absolute -top-24 -right-24 h-80 w-80 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 h-80 w-80 rounded-full bg-accent/30 blur-3xl" />
        <div className="relative max-w-2xl mx-auto space-y-5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 text-xs font-semibold">
            <BadgeIcon className="h-3.5 w-3.5" /> {newsletterCta.badge.text}
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold">{newsletterCta.title}</h2>
          <p className="text-white/85 text-lg">{newsletterCta.subtitle}</p>
          <form className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto pt-2 items-stretch" onSubmit={(e) => e.preventDefault()}>
            <input
              type="email"
              required
              placeholder={newsletterCta.placeholder}
              className="flex-1 h-12 px-4 rounded-xl bg-white/15 backdrop-blur text-white placeholder:text-white/60 outline-none focus:bg-white/20 border border-white/20"
            />
            <button className="h-12 px-6 rounded-xl bg-accent text-accent-foreground font-semibold hover:scale-105 transition-smooth inline-flex items-center justify-center gap-2">
              <BtnIcon className="h-4 w-4" /> {newsletterCta.button.label}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
