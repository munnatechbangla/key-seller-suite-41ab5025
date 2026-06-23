import { createFileRoute } from "@tanstack/react-router";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { Mail, MessageCircle, MapPin, Send } from "lucide-react";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact TopupHut — We're Here 24/7" },
      { name: "description", content: "Reach the TopupHut support team via WhatsApp, email or live chat. 24/7 response, real humans." },
      { property: "og:title", content: "Contact TopupHut" },
      { property: "og:description", content: "Get in touch with our support team — 24/7." },
    ],
  }),
  component: ContactPage,
});

function ContactPage() {
  return (
    <div className="min-h-screen">
      <Header />
      <section className="bg-gradient-hero text-white">
        <div className="container mx-auto px-4 py-16 text-center">
          <h1 className="text-4xl sm:text-5xl font-extrabold mb-3">Get in touch</h1>
          <p className="text-white/75 max-w-xl mx-auto">Questions, orders, partnerships — we'd love to hear from you.</p>
        </div>
      </section>

      <section className="container mx-auto px-4 py-16 grid lg:grid-cols-3 gap-6">
        {[
          { icon: Mail, title: "Email us", value: "support@topuphut.com", href: "mailto:support@topuphut.com" },
          { icon: MessageCircle, title: "WhatsApp", value: "+1 (555) 010-2024", href: "#" },
          { icon: MapPin, title: "Office", value: "Remote-first, worldwide", href: "#" },
        ].map(({ icon: Icon, title, value, href }) => (
          <a key={title} href={href} className="rounded-2xl bg-card border border-border p-6 hover:shadow-premium hover:border-primary/40 transition-smooth">
            <div className="h-12 w-12 rounded-xl bg-gradient-primary text-primary-foreground grid place-items-center shadow-glow mb-4">
              <Icon className="h-5 w-5" />
            </div>
            <div className="font-semibold mb-1">{title}</div>
            <div className="text-sm text-muted-foreground">{value}</div>
          </a>
        ))}
      </section>

      <section className="container mx-auto px-4 pb-20">
        <form onSubmit={(e) => e.preventDefault()} className="max-w-2xl mx-auto rounded-3xl bg-card border border-border p-8 shadow-elegant space-y-5">
          <h2 className="text-2xl font-bold">Send a message</h2>
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
            <Send className="h-4 w-4" /> Send message
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
