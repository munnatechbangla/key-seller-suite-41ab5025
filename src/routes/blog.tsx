import { seoMeta, siteName } from "@/lib/cms/seo";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { PageHero } from "@/components/site/PageHero";
import { blogPosts } from "@/lib/catalog";
import { Calendar, ArrowRight, Send } from "lucide-react";

export const Route = createFileRoute("/blog")({
  head: () => ({
    meta: seoMeta({ title: "Blog", description: "Guides, reviews and tips on digital subscriptions, AI tools and streaming services." }),
  }),
  component: BlogPage,
});

const categories = ["All", "AI Tools", "Streaming", "Design", "IPTV"];

function BlogPage() {
  return (
    <div className="min-h-screen">
      <Header />
      <PageHero title={`${siteName()} Blog`} subtitle="Reviews, guides and pro tips on premium digital products" crumbs={[{ label: "Home", to: "/" }, { label: "Blog" }]} />
      <div className="container mx-auto px-4 py-10">
        <div className="flex gap-2 overflow-x-auto pb-2 mb-6">
          {categories.map((c, i) => (
            <button key={c} className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-smooth ${i === 0 ? "bg-gradient-primary text-primary-foreground" : "bg-card border border-border hover:border-primary"}`}>{c}</button>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {blogPosts.map((p) => (
            <Link key={p.slug} to="/blog/$slug" params={{ slug: p.slug }} className="rounded-2xl bg-card border border-border overflow-hidden hover:shadow-premium hover:-translate-y-1 transition-smooth group">
              <div className="aspect-[16/10] bg-gradient-to-br from-primary/10 via-secondary/10 to-accent/10 grid place-items-center text-7xl">{p.emoji}</div>
              <div className="p-5 space-y-2">
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="font-semibold text-primary">{p.category}</span>
                  <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" /> {p.date}</span>
                </div>
                <h3 className="font-bold text-lg leading-tight group-hover:text-primary transition-smooth">{p.title}</h3>
                <p className="text-sm text-muted-foreground line-clamp-2">{p.excerpt}</p>
                <div className="inline-flex items-center gap-1 text-sm font-semibold text-primary pt-2">Read article <ArrowRight className="h-3.5 w-3.5" /></div>
              </div>
            </Link>
          ))}
        </div>

        <section className="mt-16 rounded-3xl bg-gradient-hero text-white p-10 sm:p-14 text-center">
          <h2 className="text-3xl font-bold mb-2">Join our newsletter</h2>
          <p className="text-white/70 mb-6">Get weekly deals and product guides straight to your inbox.</p>
          <form onSubmit={(e) => e.preventDefault()} className="max-w-md mx-auto flex gap-2">
            <input type="email" required placeholder="you@email.com" className="flex-1 px-4 py-3 rounded-xl glass-dark text-white placeholder:text-white/40 outline-none" />
            <button className="px-5 rounded-xl bg-gradient-primary font-semibold inline-flex items-center gap-2 shadow-glow"><Send className="h-4 w-4" /> Subscribe</button>
          </form>
        </section>
      </div>
      <Footer />
    </div>
  );
}
