import { siteName } from "@/lib/cms/seo";
import { useSettings } from "@/lib/cms/settings";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { PageHero } from "@/components/site/PageHero";
import { MessageCircle, Mail, Phone, HelpCircle, FileText, RefreshCcw } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/support")({
  head: () => ({ meta: [{ title: `Support Center — ${siteName()}` }] }),
  component: SupportPage,
});

const quick = [
  { Icon: HelpCircle, t: "FAQ", d: "Quick answers", to: "/faq" },
  { Icon: FileText, t: "Track order", d: "Check your delivery", to: "/track-order" },
  { Icon: RefreshCcw, t: "Refunds", d: "Refund policy & requests", to: "/refund" },
];

function SupportPage() {
  const contact = useSettings((s) => s.settings.contact);
  const channels = [
    { Icon: MessageCircle, t: "Live chat", d: "Average reply in 2 min", link: "#", action: "Start chat", color: "bg-emerald-500" },
    contact.support_email && { Icon: Mail, t: "Email support", d: contact.support_email, link: `mailto:${contact.support_email}`, action: "Send email", color: "bg-primary" },
    contact.whatsapp && { Icon: Phone, t: "WhatsApp", d: contact.whatsapp, link: `https://wa.me/${contact.whatsapp.replace(/[^0-9]/g, "")}`, action: "Open WhatsApp", color: "bg-emerald-600" },
  ].filter(Boolean) as Array<{ Icon: any; t: string; d: string; link: string; action: string; color: string }>;
  return (
    <div className="min-h-screen">
      <Header />
      <PageHero title="Support center" subtitle="We're here 24/7. Pick the fastest way to reach us." crumbs={[{ label: "Home", to: "/" }, { label: "Support" }]} />
      <div className="container mx-auto px-4 py-12 space-y-12">
        <div className="grid md:grid-cols-3 gap-5">
          {channels.map((c) => (
            <a key={c.t} href={c.link} className="rounded-2xl bg-card border border-border p-6 hover:shadow-premium hover:-translate-y-1 transition-smooth">
              <div className={`h-12 w-12 rounded-xl ${c.color} text-white grid place-items-center mb-4`}><c.Icon className="h-6 w-6" /></div>
              <h3 className="font-bold">{c.t}</h3>
              <p className="text-sm text-muted-foreground mb-4">{c.d}</p>
              <span className="text-sm font-semibold text-primary">{c.action} →</span>
            </a>
          ))}
        </div>

        <div>
          <h2 className="text-2xl font-bold mb-5">Help yourself</h2>
          <div className="grid sm:grid-cols-3 gap-4">
            {quick.map((q) => (
              <Link key={q.t} to={q.to} className="rounded-2xl bg-card border border-border p-5 flex items-center gap-3 hover:border-primary transition-smooth">
                <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary grid place-items-center"><q.Icon className="h-5 w-5" /></div>
                <div><div className="font-semibold">{q.t}</div><div className="text-xs text-muted-foreground">{q.d}</div></div>
              </Link>
            ))}
          </div>
        </div>

        <section className="max-w-2xl">
          <h2 className="text-2xl font-bold mb-5">Open a support ticket</h2>
          <form onSubmit={(e) => { e.preventDefault(); toast.success("Ticket submitted — we'll reply within an hour."); (e.currentTarget as HTMLFormElement).reset(); }} className="rounded-2xl bg-card border border-border p-6 space-y-4">
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
            <button className="px-5 py-3 rounded-xl bg-gradient-primary text-primary-foreground font-semibold">Submit ticket</button>
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
