import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Zap, Shield, Headphones, RefreshCw, Star, ArrowRight, Check, Play, Sparkles,
  Gift, Clock, Users, Award, ChevronRight,
} from "lucide-react";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { Section } from "@/components/site/Section";
import { ProductCard } from "@/components/site/ProductCard";
import { categories, featured, trending, bestSellers, products, type Product } from "@/lib/catalog";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TopupHut — Premium Digital Products at Unbeatable Prices" },
      { name: "description", content: "Shop ChatGPT Plus, Netflix, Spotify, Canva Pro, IPTV, antivirus, gift cards and more. Instant digital delivery, 24/7 support." },
      { property: "og:title", content: "TopupHut — Premium Digital Marketplace" },
      { property: "og:description", content: "Premium digital subscriptions & license keys delivered instantly." },
    ],
  }),
  component: Home,
});

function Home() {
  return (
    <div className="min-h-screen">
      <Header />
      <main>
        <Hero />
        <TrustStrip />
        <CategoriesGrid />
        <FlashDeals />
        <FeaturedProducts />
        <WhyChoose />
        <BestSellers />
        <Stats />
        <Testimonials />
        <FAQ />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden bg-gradient-hero text-white">
      <div className="absolute inset-0 opacity-50 pointer-events-none">
        <div className="absolute -top-40 -left-20 h-96 w-96 rounded-full bg-primary/40 blur-3xl animate-float" />
        <div className="absolute top-20 right-0 h-96 w-96 rounded-full bg-secondary/40 blur-3xl animate-float" style={{ animationDelay: "1.5s" }} />
        <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-accent/30 blur-3xl animate-float" style={{ animationDelay: "3s" }} />
      </div>

      <div className="container mx-auto px-4 pt-16 pb-24 lg:pt-24 lg:pb-32 relative grid lg:grid-cols-2 gap-12 items-center">
        <div className="space-y-6">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass-dark text-sm">
            <Sparkles className="h-4 w-4 text-accent" />
            <span>Trusted by 200,000+ customers worldwide</span>
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-[1.05] tracking-tight">
            Premium digital products,
            <span className="block text-gradient">delivered in seconds.</span>
          </h1>
          <p className="text-lg text-white/75 max-w-xl leading-relaxed">
            ChatGPT Plus, Netflix, Canva Pro, Spotify, IPTV, software keys & gift cards —
            up to 70% off retail. Instant activation, lifetime warranty, 24/7 support.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link to="/products" className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-primary text-primary-foreground font-semibold shadow-glow hover:scale-105 transition-smooth">
              Browse Products <ArrowRight className="h-4 w-4" />
            </Link>
            <button className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl glass-dark text-white font-semibold hover:bg-white/15 transition-smooth">
              <Play className="h-4 w-4 fill-white" /> Watch Demo
            </button>
          </div>
          <div className="flex flex-wrap gap-6 pt-6 text-sm">
            {[
              { icon: Zap, label: "Instant delivery" },
              { icon: Shield, label: "Secure checkout" },
              { icon: RefreshCw, label: "Money-back guarantee" },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-2 text-white/80">
                <div className="h-8 w-8 grid place-items-center rounded-lg bg-white/10">
                  <Icon className="h-4 w-4 text-accent" />
                </div>
                {label}
              </div>
            ))}
          </div>
        </div>

        <div className="relative h-[480px] hidden lg:block">
          <FloatingCard className="absolute top-0 left-8 w-64" delay="0s" product={products[0]} />
          <FloatingCard className="absolute top-24 right-0 w-64" delay="1.2s" product={products[3]} />
          <FloatingCard className="absolute bottom-8 left-0 w-64" delay="2.4s" product={products[1]} />
          <FloatingCard className="absolute bottom-0 right-12 w-64" delay="0.8s" product={products[6]} />
        </div>
      </div>
    </section>
  );
}

function FloatingCard({ product, className = "", delay = "0s" }: { product: Product; className?: string; delay?: string }) {
  return (
    <div className={`glass-dark rounded-2xl p-4 shadow-premium animate-float ${className}`} style={{ animationDelay: delay }}>
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-xl bg-gradient-primary grid place-items-center text-2xl shadow-glow">
          {product.emoji}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold truncate">{product.name}</div>
          <div className="flex items-center gap-1 text-xs text-white/60">
            <Star className="h-3 w-3 fill-accent text-accent" /> {product.rating} · {product.delivery}
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm font-bold text-accent">${product.price}</div>
          {product.oldPrice && <div className="text-[10px] text-white/40 line-through">${product.oldPrice}</div>}
        </div>
      </div>
    </div>
  );
}

function TrustStrip() {
  const items = [
    { icon: Zap, title: "Instant Delivery", desc: "Email + dashboard, 24/7" },
    { icon: Shield, title: "100% Secure", desc: "Encrypted payments" },
    { icon: RefreshCw, title: "Money-Back", desc: "30-day guarantee" },
    { icon: Headphones, title: "Live Support", desc: "WhatsApp, chat, email" },
  ];
  return (
    <div className="container mx-auto px-4 -mt-12 relative z-10">
      <div className="glass rounded-3xl shadow-premium p-6 grid grid-cols-2 md:grid-cols-4 gap-6">
        {items.map(({ icon: Icon, title, desc }) => (
          <div key={title} className="flex items-center gap-3">
            <div className="h-12 w-12 grid place-items-center rounded-2xl bg-gradient-primary text-primary-foreground shadow-elegant shrink-0">
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-sm">{title}</div>
              <div className="text-xs text-muted-foreground">{desc}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CategoriesGrid() {
  return (
    <Section
      eyebrow="Shop by category"
      title="Everything digital, one marketplace"
      subtitle="From AI tools to streaming, software to gift cards — discover 250+ premium products."
      action={
        <Link to="/categories" className="text-sm font-semibold text-primary inline-flex items-center gap-1 hover:gap-2 transition-all">
          View all <ChevronRight className="h-4 w-4" />
        </Link>
      }
    >
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {categories.map((c) => (
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

function FlashDeals() {
  return (
    <Section
      eyebrow="⚡ Flash deals"
      title="Limited time offers"
      subtitle="Hurry — these prices vanish in 24 hours."
      action={<Countdown />}
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        {trending.map((p) => <ProductCard key={p.slug} product={p} />)}
      </div>
    </Section>
  );
}

function Countdown() {
  return (
    <div className="flex items-center gap-2">
      {[{ v: "11", l: "hrs" }, { v: "42", l: "min" }, { v: "18", l: "sec" }].map(({ v, l }) => (
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

function FeaturedProducts() {
  return (
    <Section eyebrow="Hand picked" title="Featured products" subtitle="Customer favorites this week.">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        {featured.map((p) => <ProductCard key={p.slug} product={p} />)}
      </div>
    </Section>
  );
}

function WhyChoose() {
  const items = [
    { icon: Zap, title: "Lightning Fast", desc: "Auto-delivery within seconds of payment. No waiting, no hassle." },
    { icon: Shield, title: "Authentic & Warranted", desc: "Every license verified. Lifetime replacement guarantee." },
    { icon: Gift, title: "Best Prices", desc: "Save up to 70% vs official retail. Bulk discounts available." },
    { icon: Headphones, title: "24/7 Support", desc: "WhatsApp, live chat, email — real humans, not bots." },
    { icon: Award, title: "Trusted Vendor", desc: "200K+ orders delivered with 4.9★ rating." },
    { icon: Clock, title: "Easy Refunds", desc: "Not happy? Get your money back within 30 days." },
  ];
  return (
    <div className="bg-muted/40">
      <Section eyebrow="Why TopupHut" title="The smarter way to buy digital">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {items.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="rounded-2xl bg-card border border-border p-6 hover:shadow-elegant hover:border-primary/30 transition-smooth">
              <div className="h-12 w-12 rounded-xl bg-gradient-primary grid place-items-center text-primary-foreground shadow-glow mb-4">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-lg mb-1.5">{title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

function BestSellers() {
  return (
    <Section eyebrow="🔥 Best sellers" title="What everyone's buying">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        {bestSellers.map((p) => <ProductCard key={p.slug} product={p} />)}
      </div>
    </Section>
  );
}

function Stats() {
  const stats = [
    { v: "200K+", l: "Happy customers" },
    { v: "250+", l: "Digital products" },
    { v: "4.9★", l: "Average rating" },
    { v: "24/7", l: "Support uptime" },
  ];
  return (
    <div className="container mx-auto px-4 py-16">
      <div className="rounded-3xl bg-gradient-hero text-white p-10 lg:p-16 shadow-premium relative overflow-hidden">
        <div className="absolute -top-20 -right-20 h-80 w-80 rounded-full bg-primary/40 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 h-80 w-80 rounded-full bg-accent/30 blur-3xl" />
        <div className="relative grid grid-cols-2 lg:grid-cols-4 gap-8 text-center">
          {stats.map((s) => (
            <div key={s.l}>
              <div className="text-4xl lg:text-5xl font-extrabold text-gradient mb-1">{s.v}</div>
              <div className="text-sm text-white/70">{s.l}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Testimonials() {
  const reviews = [
    { name: "Sarah M.", role: "Designer", text: "Got Canva Pro for a fraction of the price and it activated in under a minute. Insane service.", emoji: "👩‍🎨" },
    { name: "James K.", role: "Developer", text: "Bought ChatGPT Plus here three times. Always instant, always works. Support is unmatched.", emoji: "👨‍💻" },
    { name: "Priya R.", role: "Student", text: "Spotify + Netflix for less than my morning coffee. TopupHut is now my go-to.", emoji: "👩‍🎓" },
  ];
  return (
    <Section eyebrow="Loved by customers" title="What our buyers say">
      <div className="grid md:grid-cols-3 gap-5">
        {reviews.map((r) => (
          <div key={r.name} className="rounded-2xl bg-card border border-border p-6 hover:shadow-elegant transition-smooth">
            <div className="flex gap-0.5 mb-3">
              {Array.from({ length: 5 }).map((_, i) => (
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
  const faqs = [
    { q: "How fast is delivery?", a: "Most products are delivered automatically within seconds of payment confirmation, directly to your dashboard and email." },
    { q: "Is it safe and legal?", a: "Yes. All our products are authentic, sourced through authorized channels, and come with a lifetime replacement warranty." },
    { q: "What payment methods do you accept?", a: "Stripe, PayPal, bKash, Nagad, Rocket, SSLCommerz, crypto and direct bank transfer." },
    { q: "Do you offer refunds?", a: "Absolutely — 30-day money-back guarantee if the product doesn't work as advertised." },
    { q: "Can I use my purchase on multiple devices?", a: "Each product page lists exact device limits. Most subscriptions support 1–5 simultaneous devices." },
  ];
  return (
    <div className="bg-muted/40">
      <Section eyebrow="FAQ" title="Frequently asked questions">
        <div className="max-w-3xl mx-auto space-y-3">
          {faqs.map((f, i) => (
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
  return (
    <div className="container mx-auto px-4 py-16">
      <div className="rounded-3xl bg-gradient-primary text-primary-foreground p-10 lg:p-16 shadow-premium relative overflow-hidden text-center">
        <div className="absolute -top-24 -right-24 h-80 w-80 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 h-80 w-80 rounded-full bg-accent/30 blur-3xl" />
        <div className="relative max-w-2xl mx-auto space-y-5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 text-xs font-semibold">
            <Users className="h-3.5 w-3.5" /> Join 200,000+ smart buyers
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold">Save 70% on your favorite digital products.</h2>
          <p className="text-white/85 text-lg">Get exclusive coupons, flash sales and early access — straight to your inbox.</p>
          <form className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto pt-2" onSubmit={(e) => e.preventDefault()}>
            <input
              type="email"
              required
              placeholder="Enter your email"
              className="flex-1 px-4 py-3 rounded-xl bg-white/15 backdrop-blur text-white placeholder:text-white/60 outline-none focus:bg-white/20 border border-white/20"
            />
            <button className="px-6 py-3 rounded-xl bg-accent text-accent-foreground font-semibold hover:scale-105 transition-smooth inline-flex items-center justify-center gap-2">
              <Check className="h-4 w-4" /> Subscribe
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
