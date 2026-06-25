import { seoMeta, siteName } from "@/lib/cms/seo";
import { createFileRoute } from "@tanstack/react-router";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { Zap, Users, Award, Globe } from "lucide-react";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: seoMeta({
      title: "About",
      description: `${siteName()} is the trusted marketplace for premium digital products. Learn about our mission, team and values.`,
    }),
  }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <div className="min-h-screen">
      <Header />
      <section className="bg-gradient-hero text-white">
        <div className="container mx-auto px-4 py-20 text-center max-w-3xl">
          <h1 className="text-4xl sm:text-5xl font-extrabold mb-4">Digital, done right.</h1>
          <p className="text-white/75 text-lg">
            We started TopupHut to make premium digital products affordable, accessible and
            instantly available — for everyone, everywhere.
          </p>
        </div>
      </section>

      <section className="container mx-auto px-4 py-16 grid lg:grid-cols-4 gap-6">
        {[
          { icon: Users, v: "200K+", l: "Customers worldwide" },
          { icon: Zap, v: "250+", l: "Digital products" },
          { icon: Award, v: "4.9★", l: "Average rating" },
          { icon: Globe, v: "120+", l: "Countries served" },
        ].map(({ icon: Icon, v, l }) => (
          <div key={l} className="rounded-2xl bg-card border border-border p-6 text-center hover:shadow-elegant transition-smooth">
            <div className="h-12 w-12 rounded-xl bg-gradient-primary text-primary-foreground grid place-items-center mx-auto mb-3 shadow-glow">
              <Icon className="h-5 w-5" />
            </div>
            <div className="text-3xl font-bold text-gradient">{v}</div>
            <div className="text-sm text-muted-foreground mt-1">{l}</div>
          </div>
        ))}
      </section>

      <section className="container mx-auto px-4 py-12 grid lg:grid-cols-2 gap-12 items-center">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-3">Our story</div>
          <h2 className="text-3xl font-bold mb-4">Built by digital natives, for digital natives.</h2>
          <p className="text-muted-foreground leading-relaxed mb-4">
            TopupHut was founded in 2021 with a simple belief — premium software and
            subscriptions should not cost more than the value they provide. By partnering
            directly with global vendors and automating delivery, we cut out the middlemen
            and pass the savings to you.
          </p>
          <p className="text-muted-foreground leading-relaxed">
            Today, we serve over 200,000 customers across 120 countries — students,
            freelancers, agencies and small businesses who deserve world-class tools
            without the world-class price tag.
          </p>
        </div>
        <div className="rounded-3xl bg-gradient-hero h-80 lg:h-96 shadow-premium relative overflow-hidden">
          <div className="absolute inset-0 grid place-items-center text-8xl opacity-90">🚀</div>
          <div className="absolute -top-10 -left-10 h-60 w-60 rounded-full bg-accent/30 blur-3xl" />
          <div className="absolute -bottom-10 -right-10 h-60 w-60 rounded-full bg-primary/40 blur-3xl" />
        </div>
      </section>
      <Footer />
    </div>
  );
}
