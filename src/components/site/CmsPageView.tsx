import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { cmsPublicGetPageBySlugFn } from "@/lib/cms.functions";
import { resolveStoredUrlAsync } from "@/lib/media/resolve";

type CmsPage = {
  slug: string;
  title: string;
  description: string | null;
  featured_image: string | null;
  excerpt: string | null;
  body_html: string | null;
  template: string | null;
};

/**
 * Single source of truth for rendering a published CMS page.
 * If the slug is missing or unpublished, renders a 404.
 */
export function CmsPageView({ slug }: { slug: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["cms-page", slug],
    queryFn: () => cmsPublicGetPageBySlugFn({ data: { slug } }),
    staleTime: 30_000,
  });

  const page = (data?.page ?? null) as CmsPage | null;

  const [heroImg, setHeroImg] = useState("");
  useEffect(() => {
    let alive = true;
    resolveStoredUrlAsync(page?.featured_image ?? null).then((u) => {
      if (alive) setHeroImg(u);
    });
    return () => { alive = false; };
  }, [page?.featured_image]);

  useEffect(() => {
    if (!page) return;
    const prev = document.title;
    document.title = page.title;
    return () => { document.title = prev; };
  }, [page?.title]);

  if (isLoading) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="container mx-auto px-4 py-24 text-center text-muted-foreground">
          Loading…
        </div>
        <Footer />
      </div>
    );
  }

  if (!page) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="container mx-auto px-4 py-24 text-center">
          <h1 className="text-4xl font-extrabold">404 — Page not found</h1>
          <p className="text-muted-foreground mt-3">
            The page <code>/{slug}</code> is not published or has been removed.
          </p>
        </div>
        <Footer />
      </div>
    );
  }

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
            <div className="blog-prose" dangerouslySetInnerHTML={{ __html: page.body_html }} />
          ) : (
            <p className="text-muted-foreground">This page has no content yet.</p>
          )}
        </div>
      </article>
      <Footer />
    </div>
  );
}
