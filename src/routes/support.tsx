import { siteName } from "@/lib/cms/seo";
import { useSettings } from "@/lib/cms/settings";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { PageHero } from "@/components/site/PageHero";
import * as Icons from "lucide-react";
import { toast } from "sonner";
import { usePage } from "@/lib/cms/pages/hooks";

export const Route = createFileRoute("/support")({
  head: () => ({ meta: [{ title: `Support Center — ${siteName()}` }] }),
  component: SupportPage,
});

function Icon({ name, className }: { name: string; className?: string }) {
  const C = (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[name] ?? Icons.HelpCircle;
  return <C className={className} />;
}

function SupportPage() {
  const contact = useSettings((s) => s.settings.contact);
  const { content } = usePage("support");

  // Fill contact_methods with settings fallbacks if placeholders reference {support_email}/{whatsapp}
  const channels = content.contact_methods.map((m) => {
    let value = m.value;
    let href = m.href;
    if (/\{support_email\}/i.test(value) || /\{support_email\}/i.test(href)) {
      value = value.replace(/\{support_email\}/gi, contact.support_email ?? "");
      href = href.replace(/\{support_email\}/gi, contact.support_email ?? "");
    }
    if (/\{whatsapp\}/i.test(value) || /\{whatsapp\}/i.test(href)) {
      const w = contact.whatsapp ?? "";
      value = value.replace(/\{whatsapp\}/gi, w);
      href = href.replace(/\{whatsapp\}/gi, w.replace(/[^0-9]/g, ""));
    }
    return { ...m, value, href };
  });

  return (
    <div className="min-h-screen">
      <Header />
      <PageHero title={content.hero.title} subtitle={content.hero.subtitle} crumbs={[{ label: "Home", to: "/" }, { label: "Support" }]} />
      <div className="container mx-auto px-4 py-12 space-y-12">
        <div className="grid md:grid-cols-3 gap-5">
          {channels.map((c) => (
            <a key={c.label} href={c.href} className="rounded-2xl bg-card border border-border p-6 hover:shadow-premium hover:-translate-y-1 transition-smooth">
              <div className={`h-12 w-12 rounded-xl ${c.color ?? "bg-primary"} text-white grid place-items-center mb-4`}><Icon name={c.icon} className="h-6 w-6" /></div>
              <h3 className="font-bold">{c.label}</h3>
              <p className="text-sm text-muted-foreground mb-4">{c.value}</p>
              <span className="text-sm font-semibold text-primary">Open →</span>
            </a>
          ))}
        </div>

        <div>
          <h2 className="text-2xl font-bold mb-5">Help yourself</h2>
          <div className="grid sm:grid-cols-3 gap-4">
            {content.cards.map((q) => (
              <Link key={q.title} to={q.link ?? "#"} className="rounded-2xl bg-card border border-border p-5 flex items-center gap-3 hover:border-primary transition-smooth">
                <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary grid place-items-center"><Icon name={q.icon} className="h-5 w-5" /></div>
                <div><div className="font-semibold">{q.title}</div><div className="text-xs text-muted-foreground">{q.body}</div></div>
              </Link>
            ))}
          </div>
        </div>

        <section className="max-w-2xl">
          <h2 className="text-2xl font-bold mb-5">{content.ticket_form.heading}</h2>
          <form onSubmit={(e) => { e.preventDefault(); toast.success(content.ticket_form.success_message); (e.currentTarget as HTMLFormElement).reset(); }} className="rounded-2xl bg-card border border-border p-6 space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Your name" name="name" required />
              <Field label="Email" name="email" type="email" required />
            </div>
            <Field label="Order ID (optional)" name="order" />
            <Field label="Subject" name="subject" required />
            <div>
              <label className="text-sm font-semibold block mb-1.5">Message</label>
              <textarea name="msg" rows={5} required className="w-full px-4 py-3 rounded-xl bg-muted/60 border border-border outline-none focus:border-primary text-sm" />
            </div>
            <button className="px-5 py-3 rounded-xl bg-gradient-primary text-primary-foreground font-semibold">{content.ticket_form.submit_label}</button>
          </form>
        </section>
      </div>
      <Footer />
    </div>
  );
}

function Field({ label, name, type = "text", required }: { label: string; name: string; type?: string; required?: boolean }) {
  return (
    <div>
      <label className="text-sm font-semibold block mb-1.5">{label}</label>
      <input name={name} type={type} required={required} className="w-full px-4 py-2.5 rounded-xl bg-muted/60 border border-border outline-none focus:border-primary text-sm" />
    </div>
  );
}
