import { createFileRoute, notFound } from "@tanstack/react-router";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { SectionRenderer, type CmsSection } from "@/components/cms/SectionRenderer";
import { landingPublicGetBySlugFn } from "@/lib/landing.functions";

export const Route = createFileRoute("/l/$slug")({
  loader: async ({ params }) => {
    const result = await landingPublicGetBySlugFn({ data: { slug: params.slug } });
    if (!result) throw notFound();
    return result as { page: any; sections: CmsSection[] };
  },
  head: ({ loaderData }) => {
    const p = (loaderData as any)?.page;
    if (!p) return { meta: [] };
    const title = p.meta_title || p.title;
    const desc = p.meta_description || p.description || "";
    const meta: any[] = [
      { title },
      { name: "description", content: desc },
      { property: "og:title", content: p.og_title || title },
      { property: "og:description", content: p.og_description || desc },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ];
    if (p.og_image) {
      meta.push({ property: "og:image", content: p.og_image });
      meta.push({ name: "twitter:image", content: p.og_image });
    }
    if (p.robots) meta.push({ name: "robots", content: p.robots });
    const links = p.canonical_url ? [{ rel: "canonical", href: p.canonical_url }] : [];
    return { meta, links };
  },
  errorComponent: ({ error }) => <div className="p-10 text-center">Failed to load: {String(error)}</div>,
  notFoundComponent: () => (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center"><h1 className="text-2xl font-bold">Page not found</h1><p className="text-muted-foreground">This landing page doesn't exist or isn't published.</p></div>
    </div>
  ),
  component: LandingPage,
});

function LandingPage() {
  const { page, sections } = Route.useLoaderData();
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        {sections.map((s: CmsSection) => <SectionRenderer key={s.id} section={s} />)}
        {sections.length === 0 && <div className="p-10 text-center text-muted-foreground">This page is empty.</div>}
      </main>
      <Footer />
      {/* keep title reference to avoid unused var */}
      <span className="hidden">{page?.title}</span>
    </div>
  );
}
