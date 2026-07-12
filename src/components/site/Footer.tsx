import { useEffect, useState } from "react";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { useHomepage } from "@/lib/cms/homepage";
import { useCmsFooterPages } from "@/lib/cms/nav-pages";
import { useSettings, formatCopyright } from "@/lib/cms/settings";
import { resolveIcon } from "@/lib/cms/icons";
import { resolveStoredUrlAsync } from "@/lib/media/resolve";
import { Logo } from "@/components/site/Logo";

function ResolvedImg({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    if (!src) { setUrl(null); return; }
    if (/^(https?:|data:|blob:)/i.test(src) && !src.includes("/storage/v1/object/")) {
      setUrl(src);
      return;
    }
    resolveStoredUrlAsync(src).then((u) => { if (alive) setUrl(u || null); });
    return () => { alive = false; };
  }, [src]);
  if (!url) return <span className={className} aria-hidden />;
  return <img src={url} alt={alt} className={className} loading="lazy" decoding="async" />;
}

export function Footer() {
  const s = useSettings((st) => st.settings);
  const f = useHomepage((st) => st.config.footer);

  const brandName = f.brand.name || s.branding.name;
  const brandDescription = f.brand.description || s.branding.description;
  const bottomLeft = f.bottom.leftText || formatCopyright(f.brand.copyright || s.branding.copyright, brandName);
  const bottomRight = f.bottom.rightText || s.branding.footer_text;

  const socials = (f.socials.items ?? []).filter((it) => it.enabled && it.url);
  const companyItems = (f.companyLinks.items ?? []).filter((it) => it.enabled);
  const supportItems = (f.supportLinks.items ?? []).filter((it) => it.enabled);
  const payments = (f.paymentLogos.items ?? []).filter((it) => it.enabled);

  return (
    <footer className="mt-24 bg-gradient-hero text-white">
      <div className="container mx-auto px-4 py-16 grid grid-cols-[minmax(0,1fr)] gap-10 md:grid-cols-2 lg:gap-8 lg:grid-cols-[minmax(0,1.55fr)_repeat(2,minmax(0,0.9fr))_minmax(0,1.75fr)]">
        <div className="min-w-0 lg:col-span-1 space-y-4">
          {f.brand.logo ? (
            <ResolvedImg src={f.brand.logo} alt={brandName} className="h-10 w-auto object-contain" />
          ) : (
            <Logo size="lg" variant="dark" forceTheme="dark" />
          )}

          <p className="text-white/70 max-w-sm text-sm leading-relaxed break-words">{brandDescription}</p>

          {f.socials.enabled && socials.length > 0 && (
            <div className="pt-2">
              <div className="text-xs font-semibold uppercase tracking-wider text-white/50 mb-2.5">{f.socials.label}</div>
              <div className="flex flex-wrap gap-2">
                {socials.map((item) => {
                  const Icon = resolveIcon(item.icon);
                  return (
                    <a
                      key={item.id}
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={item.tooltip || item.icon}
                      title={item.tooltip || item.icon}
                      className="h-10 w-10 grid place-items-center rounded-xl glass-dark hover:bg-white/15 hover:text-accent hover:-translate-y-0.5 hover:shadow-[0_8px_24px_-8px_color-mix(in_oklab,var(--accent)_60%,transparent)] transition-all duration-300"
                    >
                      <Icon className="h-4 w-4" />
                    </a>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <FooterCol title={f.companyLinks.title} items={companyItems} />
        <FooterCol title={f.supportLinks.title} items={supportItems} />

        <div className="min-w-0 flex flex-col gap-3">
          {f.newsletter.enabled && (
            <>
              <h4 className="font-semibold text-lg">{f.newsletter.title}</h4>
              <p className="text-white/70 text-sm leading-relaxed">{f.newsletter.subtitle}</p>
              <form
                className="flex w-full min-w-0 gap-2 sm:gap-2.5 items-stretch"
                onSubmit={(e) => { e.preventDefault(); if (f.newsletter.successMessage) toast.success(f.newsletter.successMessage); }}
              >
                <input
                  type="email"
                  required
                  placeholder={f.newsletter.placeholder}
                  className="min-w-0 flex-1 h-12 sm:h-11 px-4 sm:px-3 py-3 sm:py-2 rounded-xl glass-dark text-white placeholder:text-white/50 text-sm leading-none outline-none border border-white/15 focus:border-accent/60 focus:ring-2 focus:ring-accent/30 transition-all"
                />
                <button aria-label={f.newsletter.buttonText || "Subscribe"} className="h-12 w-12 sm:h-11 sm:w-11 shrink-0 grid place-items-center rounded-xl bg-gradient-primary hover:opacity-90 hover:shadow-[0_8px_24px_-8px_color-mix(in_oklab,var(--primary)_60%,transparent)] transition-smooth">
                  <Send className="h-4 w-4" />
                </button>
              </form>
            </>
          )}

          {f.paymentLogos.enabled && payments.length > 0 && (
            <div className="mt-1">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-white/45 mb-1.5">{f.paymentLogos.label}</div>
              <div className="flex min-w-0 flex-wrap gap-1.5 items-center">
                {payments.map((p) => {
                  const inner = p.logo ? (
                    <ResolvedImg src={p.logo} alt={p.title} className="h-6 w-auto object-contain" />
                  ) : (
                    <span className="min-w-0 max-w-full truncate text-[10px] font-bold px-2 py-1 rounded-md glass-dark">{p.title}</span>
                  );
                  const badge = (
                    <span key={p.id} title={p.title} className="inline-flex items-center h-8 px-2 rounded-md glass-dark">
                      {inner}
                    </span>
                  );
                  return p.url ? (
                    <a key={p.id} href={p.url} target="_blank" rel="noopener noreferrer" aria-label={p.title} title={p.title} className="inline-flex">
                      {badge}
                    </a>
                  ) : badge;
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="container mx-auto px-4 py-5 flex flex-col md:flex-row items-center md:justify-between gap-2 md:gap-3 text-xs text-white/60 text-center md:text-left">
          <p>{bottomLeft}</p>
          <p>{bottomRight}</p>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, items }: { title: string; items: { id: string; title: string; url: string; openInNewTab?: boolean }[] }) {
  return (
    <div className="min-w-0 space-y-3">
      <h4 className="font-semibold text-lg">{title}</h4>
      <ul className="space-y-2">
        {items.map((l) => (
          <li key={l.id}>
            <a
              href={l.url}
              target={l.openInNewTab ? "_blank" : undefined}
              rel={l.openInNewTab ? "noopener noreferrer" : undefined}
              className="text-sm text-white/70 hover:text-accent transition-smooth break-words"
            >
              {l.title}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
