import { seoMeta, siteName, canonicalLink } from "@/lib/cms/seo";
import { useSettings } from "@/lib/cms/settings";
import { createFileRoute } from "@tanstack/react-router";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import * as Icons from "lucide-react";
import { usePage } from "@/lib/cms/pages/hooks";
import { interpolate } from "@/lib/cms/pages/schemas";
import { useResolvedMediaUrl } from "@/lib/cms/site-logo";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: seoMeta({
      title: "About",
      description: `${siteName()} is the trusted marketplace for premium digital products. Learn about our mission, team and values.`,
      path: "/about",
    }),
    links: [canonicalLink("/about")],
  }),
  component: AboutPage,
});

function Icon({ name, className }: { name: string; className?: string }) {
  const C = (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[name] ?? Icons.Sparkles;
  return <C className={className} />;
}

function AboutPage() {
  const name = useSettings((s) => s.settings.branding.name);
  const { content } = usePage("about");
  const vars = { name };
  const stats = content.stats ?? [];
  const story = content.story;
  const { url: storyImage } = useResolvedMediaUrl(story?.image);

  return (
    <div className="min-h-screen">
      <Header />
      <section className="bg-gradient-hero text-white">
        <div className="container mx-auto px-4 py-20 text-center max-w-3xl">
          <h1 className="text-4xl sm:text-5xl font-extrabold mb-4">{interpolate(content.hero.title, vars)}</h1>
          <p className="text-white/75 text-lg">{interpolate(content.hero.subtitle, vars)}</p>
        </div>
      </section>

      {stats.length > 0 && (
        <section className="container mx-auto px-4 py-16 grid lg:grid-cols-4 gap-6">
          {stats.map((s) => (
            <div key={s.label} className="rounded-2xl bg-card border border-border p-6 text-center hover:shadow-elegant transition-smooth">
              <div className="h-12 w-12 rounded-xl bg-gradient-primary text-primary-foreground grid place-items-center mx-auto mb-3 shadow-glow">
                <Icon name={s.icon} className="h-5 w-5" />
              </div>
              <div className="text-3xl font-bold text-gradient">{s.value}</div>
              <div className="text-sm text-muted-foreground mt-1">{s.label}</div>
            </div>
          ))}
        </section>
      )}

      {story && (
        <section className="container mx-auto px-4 py-12 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            {story.badge && <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-3">{story.badge}</div>}
            <h2 className="text-3xl font-bold mb-4">{interpolate(story.heading, vars)}</h2>
            {(story.paragraphs ?? []).map((p, i) => (
              <p key={i} className="text-muted-foreground leading-relaxed mb-4 last:mb-0">{interpolate(p, vars)}</p>
            ))}
          </div>
          <div className="rounded-3xl bg-gradient-hero h-80 lg:h-96 shadow-premium relative overflow-hidden">
            <div className="absolute inset-0 grid place-items-center text-8xl opacity-90">🚀</div>
            <div className="absolute -top-10 -left-10 h-60 w-60 rounded-full bg-accent/30 blur-3xl" />
            <div className="absolute -bottom-10 -right-10 h-60 w-60 rounded-full bg-primary/40 blur-3xl" />
          </div>
        </section>
      )}
      <Footer />
    </div>
  );
}
