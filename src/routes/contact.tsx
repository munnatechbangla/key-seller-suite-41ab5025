import { createFileRoute } from "@tanstack/react-router";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { Mail, MessageCircle, MapPin, Phone, Send, Clock } from "lucide-react";
import { useSettings } from "@/lib/cms/settings";
import { seoMeta, canonicalLink } from "@/lib/cms/seo";
import { usePage } from "@/lib/cms/pages/hooks";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: seoMeta({
      title: "Contact",
      description: "Reach our support team via WhatsApp, email or live chat. 24/7 response, real humans.",
      path: "/contact",
    }),
    links: [canonicalLink("/contact")],
  }),
  component: ContactPage,
});

function ContactPage() {
  const contactSettings = useSettings((s) => s.settings.contact);
  const social = useSettings((s) => s.settings.social);
  const { content } = usePage("contact");

  const email = content.email || contactSettings.support_email;
  const whatsapp = content.whatsapp || contactSettings.whatsapp;
  const telegram = content.telegram || contactSettings.telegram;
  const phone = content.phone || contactSettings.phone;
  const address = content.address || contactSettings.address;

  const cards: Array<{ icon: any; title: string; value: string; href: string }> = [];
  if (email) cards.push({ icon: Mail, title: "Email us", value: email, href: `mailto:${email}` });
  if (whatsapp) cards.push({ icon: MessageCircle, title: "WhatsApp", value: whatsapp, href: `https://wa.me/${whatsapp.replace(/[^0-9]/g, "")}` });
  if (telegram) cards.push({ icon: Send, title: "Telegram", value: telegram, href: social.facebook ? telegram : `https://t.me/${telegram.replace(/^@/, "")}` });
  if (phone) cards.push({ icon: Phone, title: "Phone", value: phone, href: `tel:${phone}` });
  if (address) cards.push({ icon: MapPin, title: "Office", value: address, href: "#" });
  const hoursSummary = content.hours && content.hours.length > 0 ? content.hours.map((h) => `${h.day}: ${h.hours}`).join(" · ") : "24/7 Support";
  cards.push({ icon: Clock, title: "Business hours", value: hoursSummary, href: "#" });

  return (
    <div className="min-h-screen">
      <Header />
      <section className="bg-gradient-hero text-white">
        <div className="container mx-auto px-4 py-16 text-center">
          <h1 className="text-4xl sm:text-5xl font-extrabold mb-3">{content.hero.title}</h1>
          <p className="text-white/75 max-w-xl mx-auto">{content.hero.subtitle}</p>
        </div>
      </section>

      <section className="container mx-auto px-4 py-16 grid lg:grid-cols-3 gap-6">
        {cards.map(({ icon: Icon, title, value, href }) => (
          <a key={title} href={href} className="rounded-2xl bg-card border border-border p-6 hover:shadow-premium hover:border-primary/40 transition-smooth">
            <div className="h-12 w-12 rounded-xl bg-gradient-primary text-primary-foreground grid place-items-center shadow-glow mb-4">
              <Icon className="h-5 w-5" />
            </div>
            <div className="font-semibold mb-1">{title}</div>
            <div className="text-sm text-muted-foreground break-words">{value}</div>
          </a>
        ))}
      </section>

      {content.map_embed && (
        <section className="container mx-auto px-4 pb-4">
          <div className="rounded-3xl overflow-hidden border border-border aspect-[16/6]" dangerouslySetInnerHTML={{ __html: content.map_embed }} />
        </section>
      )}

      <section className="container mx-auto px-4 pb-20">
        <form onSubmit={(e) => e.preventDefault()} className="max-w-2xl mx-auto rounded-3xl bg-card border border-border p-8 shadow-elegant space-y-5">
          <h2 className="text-2xl font-bold">{content.form.title}</h2>
          {content.form.subtitle && <p className="text-sm text-muted-foreground -mt-3">{content.form.subtitle}</p>}
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Name" type="text" placeholder="Your full name" />
            <Field label="Email" type="email" placeholder="you@email.com" />
          </div>
          <Field label="Subject" type="text" placeholder="How can we help?" />
          <div>
            <label className="text-sm font-medium block mb-1.5">Message</label>
            <textarea rows={5} className="w-full px-4 py-2.5 rounded-xl bg-muted/50 border border-border focus:bg-card focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-sm transition-smooth" placeholder="Tell us more..." />
          </div>
          <button className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-primary text-primary-foreground font-semibold shadow-glow hover:scale-[1.02] transition-smooth">
            <Send className="h-4 w-4" /> {content.form.submit_label}
          </button>
        </form>
      </section>
      <Footer />
    </div>
  );
}

function Field({ label, ...rest }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <div>
      <label className="text-sm font-medium block mb-1.5">{label}</label>
      <input
        {...rest}
        className="w-full px-4 py-2.5 rounded-xl bg-muted/50 border border-border focus:bg-card focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-sm transition-smooth"
      />
    </div>
  );
}
