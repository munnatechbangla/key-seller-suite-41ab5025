import { seoMeta, siteName, canonicalLink } from "@/lib/cms/seo";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { useCategories, categoriesQuery } from "@/lib/catalog";
import { ChevronRight } from "lucide-react";

export const Route = createFileRoute("/categories")({
  head: () => ({
    meta: seoMeta({
      title: "All Categories",
      description: "Explore every category: AI tools, streaming, design, IPTV, software, gift cards and more.",
      path: "/categories",
    }),
    links: [canonicalLink("/categories")],
  }),
  loader: ({ context }) => { context.queryClient.ensureQueryData(categoriesQuery()); },
  component: CategoriesPage,
  errorComponent: () => <div className="p-8 text-center">Failed to load categories.</div>,
  notFoundComponent: () => <div className="p-8 text-center">Not found.</div>,
});

function CategoriesPage() {
  const categories = useCategories();
  return (
    <div className="min-h-screen">
      <Header />
      <div className="bg-gradient-hero text-white">
        <div className="container mx-auto px-4 py-12">
          <div className="text-xs text-white/60 mb-2">Home / Categories</div>
          <h1 className="text-3xl sm:text-4xl font-bold">Shop by Category</h1>
          <p className="text-white/70 mt-2">Find exactly what you need across {categories.length} curated collections.</p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {categories.map((c) => (
          <Link
            key={c.slug}
            to="/products"
            className="group rounded-2xl bg-card border border-border p-6 hover:border-primary/40 hover:shadow-premium hover:-translate-y-1 transition-smooth flex gap-4"
          >
            <div className="h-16 w-16 rounded-2xl bg-gradient-primary grid place-items-center text-3xl shadow-glow shrink-0">
              {c.emoji}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-lg">{c.name}</h3>
                <ChevronRight className="h-5 w-5 text-primary group-hover:translate-x-1 transition-transform" />
              </div>
              <p className="text-sm text-muted-foreground mt-1">{c.description}</p>
              <div className="text-xs text-primary font-semibold mt-2">{c.count} products →</div>
            </div>
          </Link>
        ))}
      </div>
      <Footer />
    </div>
  );
}
