import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { PageHero } from "@/components/site/PageHero";

export function LegalPage({ title, subtitle, sections }: { title: string; subtitle?: string; sections: { h: string; p: string }[] }) {
  return (
    <div className="min-h-screen">
      <Header />
      <PageHero title={title} subtitle={subtitle} crumbs={[{ label: "Home", to: "/" }, { label: title }]} />
      <div className="container mx-auto px-4 py-12 max-w-3xl space-y-8">
        {sections.map((s, i) => (
          <section key={i} className="space-y-3">
            <h2 className="text-xl font-bold">{s.h}</h2>
            <p className="text-muted-foreground leading-relaxed">{s.p}</p>
          </section>
        ))}
      </div>
      <Footer />
    </div>
  );
}
