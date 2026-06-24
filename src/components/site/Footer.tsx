import { Link } from "@tanstack/react-router";
import { Zap, Send } from "lucide-react";
import { siteConfig, footerColumns, socialLinks, paymentBadges, resolveIcon } from "@/lib/cms";

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
              {siteConfig.brandSplit.lead}<span className="text-gradient">{siteConfig.brandSplit.accent}</span>
            </span>
          </Link>
          <p className="text-white/70 max-w-sm text-sm leading-relaxed">{siteConfig.description}</p>
          <div className="flex gap-2 pt-2">
            {socialLinks.map((s) => {
              const Icon = resolveIcon(s.icon);
              return (
                <a key={s.label} href={s.href} aria-label={s.label} className="h-10 w-10 grid place-items-center rounded-xl glass-dark hover:bg-white/15 transition-smooth">
                  <Icon className="h-4 w-4" />
                </a>
              );
            })}
          </div>
        </div>

        {footerColumns.map((col) => (
          <FooterCol key={col.title} title={col.title} links={col.links} />
        ))}

        <div className="space-y-3">
          <h4 className="font-semibold text-lg">{siteConfig.newsletter.title}</h4>
          <p className="text-white/70 text-sm">{siteConfig.newsletter.subtitle}</p>
          <form className="flex gap-2" onSubmit={(e) => e.preventDefault()}>
            <input
              type="email"
              required
              placeholder={siteConfig.newsletter.placeholder}
              className="flex-1 px-3 py-2.5 rounded-xl glass-dark text-white placeholder:text-white/40 text-sm outline-none focus:border-white/40"
            />
            <button aria-label="Subscribe" className="h-10 w-10 grid place-items-center rounded-xl bg-gradient-primary hover:opacity-90 transition-smooth">
              <Send className="h-4 w-4" />
            </button>
          </form>
          <div className="flex flex-wrap gap-1.5 pt-3">
            {paymentBadges.map((p) => (
              <span key={p.code} title={p.label} className="text-[10px] font-bold px-2 py-1 rounded-md glass-dark">{p.code}</span>
            ))}
          </div>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="container mx-auto px-4 py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-white/60">
          <p>© {new Date().getFullYear()} {siteConfig.name}. All rights reserved.</p>
          <p>Crafted for digital enthusiasts. Instant delivery worldwide.</p>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: { label: string; href: string }[] }) {
  return (
    <div className="space-y-3">
      <h4 className="font-semibold text-lg">{title}</h4>
      <ul className="space-y-2">
        {links.map((l) => (
          <li key={l.label}>
            <a href={l.href} className="text-sm text-white/70 hover:text-accent transition-smooth">{l.label}</a>
          </li>
        ))}
      </ul>
    </div>
  );
}
