import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { PageHero } from "@/components/site/PageHero";

export function LegalPage({
  title,
  subtitle,
  sections,
  bodyMd,
}: {
  title: string;
  subtitle?: string | null;
  sections?: { h: string; p: string }[];
  bodyMd?: string | null;
}) {
  return (
    <div className="min-h-screen">
      <Header />
      <PageHero title={title} subtitle={subtitle ?? undefined} crumbs={[{ label: "Home", to: "/" }, { label: title }]} />
      <div className="container mx-auto px-4 py-12 max-w-3xl space-y-8">
        {sections?.map((s, i) => (
          <section key={i} className="space-y-3">
            <h2 className="text-xl font-bold">{s.h}</h2>
            <p className="text-muted-foreground leading-relaxed whitespace-pre-line">{s.p}</p>
          </section>
        ))}
        {bodyMd ? (
          <div className="prose prose-invert max-w-none text-muted-foreground whitespace-pre-line">{bodyMd}</div>
        ) : null}
      </div>
      <Footer />
    </div>
  );
}
