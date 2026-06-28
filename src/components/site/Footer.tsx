
import { Send, Facebook, Twitter, Instagram, Youtube, Linkedin, Github, MessageSquare } from "lucide-react";
import { siteConfig, footerColumns, paymentBadges } from "@/lib/cms";
import { useSettings, formatCopyright } from "@/lib/cms/settings";
import { Logo } from "@/components/site/Logo";

export function Footer() {
  const s = useSettings((st) => st.settings);
  const social: { label: string; href: string; Icon: typeof Facebook }[] = [
    { label: "Facebook", href: s.social.facebook, Icon: Facebook },
    { label: "Instagram", href: s.social.instagram, Icon: Instagram },
    { label: "X (Twitter)", href: s.social.twitter, Icon: Twitter },
    { label: "LinkedIn", href: s.social.linkedin, Icon: Linkedin },
    { label: "YouTube", href: s.social.youtube, Icon: Youtube },
    { label: "Telegram", href: s.social.telegram, Icon: Send },
    { label: "Discord", href: s.social.discord, Icon: MessageSquare },
    { label: "GitHub", href: s.social.github, Icon: Github },
  ].filter((x) => !!x.href);
  return (
    <footer className="mt-24 bg-gradient-hero text-white">
      <div className="container mx-auto px-4 py-16 grid grid-cols-[minmax(0,1fr)] gap-10 md:grid-cols-2 lg:gap-8 lg:grid-cols-[minmax(0,1.8fr)_repeat(3,minmax(0,1fr))_minmax(0,1.4fr)]">
        <div className="min-w-0 lg:col-span-1 space-y-4">
          <Logo size="lg" variant="dark" />

          <p className="text-white/70 max-w-sm text-sm leading-relaxed break-words">{s.branding.description}</p>
          {social.length > 0 && (
            <div className="pt-2">
              <div className="text-xs font-semibold uppercase tracking-wider text-white/50 mb-2.5">Follow us</div>
              <div className="flex flex-wrap gap-2">
                {social.map((item) => (
                  <a
                    key={item.label}
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={item.label}
                    title={item.label}
                    className="h-10 w-10 grid place-items-center rounded-xl glass-dark hover:bg-white/15 hover:text-accent transition-smooth"
                  >
                    <item.Icon className="h-4 w-4" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>


        {footerColumns.map((col) => (
          <FooterCol key={col.title} title={col.title} links={col.links} />
        ))}

        <div className="min-w-0 flex flex-col gap-3">
          <h4 className="font-semibold text-lg">{siteConfig.newsletter.title}</h4>
          <p className="text-white/70 text-sm leading-relaxed">{siteConfig.newsletter.subtitle}</p>
          <form className="flex w-full min-w-0 gap-2 items-stretch" onSubmit={(e) => e.preventDefault()}>
            <input
              type="email"
              required
              placeholder={siteConfig.newsletter.placeholder}
              className="min-w-0 flex-1 h-11 px-3 rounded-xl glass-dark text-white placeholder:text-white/40 text-sm outline-none focus:border-white/40"
            />
            <button aria-label="Subscribe" className="h-11 w-11 shrink-0 grid place-items-center rounded-xl bg-gradient-primary hover:opacity-90 transition-smooth">
              <Send className="h-4 w-4" />
            </button>
          </form>
          <div className="mt-1">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-white/45 mb-1.5">We accept</div>
            <div className="flex min-w-0 flex-wrap gap-1.5">
              {paymentBadges.map((p) => (
                <span key={p.code} title={p.label} className="min-w-0 max-w-full truncate text-[10px] font-bold px-2 py-1 rounded-md glass-dark">{p.code}</span>
              ))}
            </div>
          </div>
        </div>

      </div>

      <div className="border-t border-white/10">
        <div className="container mx-auto px-4 py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-white/60">
          <p>{formatCopyright(s.branding.copyright, s.branding.name)}</p>
          <p>{s.branding.footer_text}</p>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: { label: string; href: string }[] }) {
  return (
    <div className="min-w-0 space-y-3">
      <h4 className="font-semibold text-lg">{title}</h4>
      <ul className="space-y-2">
        {links.map((l) => (
          <li key={l.label}>
            <a href={l.href} className="text-sm text-white/70 hover:text-accent transition-smooth break-words">{l.label}</a>
          </li>
        ))}
      </ul>
    </div>
  );
}
