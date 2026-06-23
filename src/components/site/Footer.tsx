import { Link } from "@tanstack/react-router";
import { Zap, Facebook, Twitter, Instagram, Youtube, Send } from "lucide-react";

export function Footer() {
  return (
    <footer className="mt-24 bg-gradient-hero text-white">
      <div className="container mx-auto px-4 py-16 grid gap-10 md:grid-cols-2 lg:grid-cols-5">
        <div className="lg:col-span-2 space-y-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-xl bg-gradient-primary grid place-items-center shadow-glow">
              <Zap className="h-5 w-5 text-primary-foreground" strokeWidth={2.5} />
            </div>
            <span className="font-bold text-2xl">
              Topup<span className="text-gradient">Hut</span>
            </span>
          </Link>
          <p className="text-white/70 max-w-sm text-sm leading-relaxed">
            Premium digital products at unbeatable prices. Instant delivery, secure payments,
            and 24/7 support — trusted by 200,000+ customers worldwide.
          </p>
          <div className="flex gap-2 pt-2">
            {[Facebook, Twitter, Instagram, Youtube].map((Icon, i) => (
              <a key={i} href="#" className="h-10 w-10 grid place-items-center rounded-xl glass-dark hover:bg-white/15 transition-smooth">
                <Icon className="h-4 w-4" />
              </a>
            ))}
          </div>
        </div>

        <FooterCol title="Company" links={[["About", "/about"], ["Contact", "/contact"], ["Blog", "/blog"], ["Categories", "/categories"]]} />
        <FooterCol title="Support" links={[["FAQ", "/faq"], ["Track Order", "/track-order"], ["Support Center", "/support"], ["Refund Policy", "/refund"], ["Privacy Policy", "/privacy"], ["Terms", "/terms"]]} />

        <div className="space-y-3">
          <h4 className="font-semibold text-lg">Newsletter</h4>
          <p className="text-white/70 text-sm">Get exclusive deals & 10% off your first order.</p>
          <form className="flex gap-2" onSubmit={(e) => e.preventDefault()}>
            <input
              type="email"
              required
              placeholder="you@email.com"
              className="flex-1 px-3 py-2.5 rounded-xl glass-dark text-white placeholder:text-white/40 text-sm outline-none focus:border-white/40"
            />
            <button className="h-10 w-10 grid place-items-center rounded-xl bg-gradient-primary hover:opacity-90 transition-smooth">
              <Send className="h-4 w-4" />
            </button>
          </form>
          <div className="flex flex-wrap gap-1.5 pt-3">
            {["VISA", "MC", "AMEX", "PP", "STRIPE", "BTC"].map((p) => (
              <span key={p} className="text-[10px] font-bold px-2 py-1 rounded-md glass-dark">{p}</span>
            ))}
          </div>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="container mx-auto px-4 py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-white/60">
          <p>© {new Date().getFullYear()} TopupHut. All rights reserved.</p>
          <p>Crafted for digital enthusiasts. Instant delivery worldwide.</p>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div className="space-y-3">
      <h4 className="font-semibold text-lg">{title}</h4>
      <ul className="space-y-2">
        {links.map(([label, href]) => (
          <li key={label}>
            <a href={href} className="text-sm text-white/70 hover:text-accent transition-smooth">{label}</a>
          </li>
        ))}
      </ul>
    </div>
  );
}
