import { createFileRoute, notFound } from "@tanstack/react-router";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { cmsPublicGetPageBySlugFn } from "@/lib/cms.functions";
import { seoMeta, canonicalLink } from "@/lib/cms/seo";
import { useResolvedMediaUrl } from "@/lib/media/resolve";

type CmsPage = {
  slug: string;
  title: string;
  description: string | null;
  featured_image: string | null;
  excerpt: string | null;
  body_html: string | null;
  template: string | null;
  meta_title: string | null;
  meta_description: string | null;
  og_title: string | null;
  og_description: string | null;
  og_image: string | null;
  canonical_url: string | null;
  robots: string | null;
};

export const Route = createFileRoute("/$slug")({
  loader: async ({ params }) => {
    const res = await cmsPublicGetPageBySlugFn({ data: { slug: params.slug } });
    if (!res?.page) throw notFound();
    return { page: res.page as CmsPage };
  },
  head: ({ params, loaderData }) => {
    const p = loaderData?.page;
    if (!p) {
      return { meta: [{ title: "Not found" }, { name: "robots", content: "noindex" }] };
    }
    return {
      meta: [
        ...seoMeta({
          title: p.meta_title || p.title,
          description: p.meta_description || p.excerpt || p.description || undefined,
          ogTitle: p.og_title || p.meta_title || p.title,
          image: p.og_image || p.featured_image || undefined,
          path: `/${params.slug}`,
        }),
        ...(p.robots ? [{ name: "robots", content: p.robots }] : []),
      ],
      links: [canonicalLink(p.canonical_url || `/${params.slug}`)],
    };
  },
  component: CmsSlugPage,
  errorComponent: ({ error }) => (
    <div className="min-h-screen">
      <Header />
      <div className="container mx-auto px-4 py-24 text-center">
        <h1 className="text-2xl font-bold">Something went wrong</h1>
        <p className="text-muted-foreground mt-2">{String(error?.message ?? error)}</p>
      </div>
      <Footer />
    </div>
  ),
  notFoundComponent: () => (
    <div className="min-h-screen">
      <Header />
      <div className="container mx-auto px-4 py-24 text-center">
        <h1 className="text-3xl font-bold">Page not found</h1>
        <p className="text-muted-foreground mt-2">The page you're looking for doesn't exist.</p>
      </div>
      <Footer />
    </div>
  ),
});

function CmsSlugPage() {
  const { page } = Route.useLoaderData();
  const heroImg = useResolvedMediaUrl(page.featured_image);
  const isFullWidth = page.template === "full-width";
  return (
    <div className="min-h-screen">
      <Header />
      <article>
        {heroImg && (
          <div className="w-full bg-muted">
            <img src={heroImg} alt={page.title} className="w-full h-64 md:h-96 object-cover" />
          </div>
        )}
        <header className="container mx-auto px-4 pt-10 pb-6 max-w-3xl">
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight">{page.title}</h1>
          {page.excerpt && (
            <p className="mt-3 text-lg text-muted-foreground">{page.excerpt}</p>
          )}
        </header>
        <div className={isFullWidth ? "w-full" : "container mx-auto px-4 pb-16 max-w-3xl"}>
          {page.body_html ? (
            <div
              className="blog-prose"
              dangerouslySetInnerHTML={{ __html: page.body_html }}
            />
          ) : (
            <p className="text-muted-foreground">This page has no content yet.</p>
          )}
        </div>
      </article>
      <Footer />
    </div>
  );
}
