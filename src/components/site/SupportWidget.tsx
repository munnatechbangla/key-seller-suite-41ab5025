import { useMemo, useState } from "react";
import { useLocation } from "@tanstack/react-router";
import { Headphones, MessageCircle, Send, Facebook, Mail, ExternalLink, X } from "lucide-react";
import { useSettings, type SupportChannel, type SupportChannelType } from "@/lib/cms/settings";

type ResolvedChannel = { id: string; label: string; type: SupportChannelType; href: string };

function normalizeChannel(channel: SupportChannel): ResolvedChannel | null {
  const raw = channel.url.trim();
  if (!channel.enabled || !raw) return null;
  let href = raw;
  if (channel.type === "whatsapp") {
    if (/^https?:\/\//i.test(raw)) href = raw;
    else {
      const digits = raw.replace(/\D/g, "");
      if (!digits) return null;
      href = `https://wa.me/${digits}`;
    }
  } else if (channel.type === "telegram") {
    if (/^https?:\/\//i.test(raw)) href = raw;
    else href = `https://t.me/${raw.replace(/^@/, "")}`;
  } else if (channel.type === "messenger") {
    if (!/^https?:\/\//i.test(raw)) return null;
  } else if (channel.type === "email") {
    href = /^mailto:/i.test(raw) ? raw : `mailto:${raw}`;
  } else if (!/^(https?:\/\/|mailto:)/i.test(raw)) {
    return null;
  }
  return { id: channel.id, label: channel.label.trim() || channelTypeLabel(channel.type), type: channel.type, href };
}

function channelTypeLabel(type: SupportChannelType) {
  return ({ whatsapp: "WhatsApp", telegram: "Telegram", messenger: "Facebook Messenger", email: "Email", custom: "Contact us" })[type];
}

function ChannelIcon({ type }: { type: SupportChannelType }) {
  if (type === "whatsapp") return <MessageCircle className="h-5 w-5" />;
  if (type === "telegram") return <Send className="h-5 w-5" />;
  if (type === "messenger") return <Facebook className="h-5 w-5" />;
  if (type === "email") return <Mail className="h-5 w-5" />;
  return <ExternalLink className="h-5 w-5" />;
}

export function SupportWidget() {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const settings = useSettings((s) => s.settings);
  const support = settings.support;

  const channels = useMemo(() => {
    const configured = (support.channels ?? []).map(normalizeChannel).filter((item): item is ResolvedChannel => item !== null);
    const hasType = (type: SupportChannelType) => configured.some((item) => item.type === type);
    const legacy: ResolvedChannel[] = [];
    if (support.enable_whatsapp && support.whatsapp_number.trim() && !hasType("whatsapp")) {
      const item = normalizeChannel({ id: "legacy-whatsapp", type: "whatsapp", label: support.whatsapp_button_text || "WhatsApp Support", url: support.whatsapp_number, enabled: true });
      if (item) legacy.push(item);
    }
    const telegram = settings.contact.telegram || settings.social.telegram;
    if (support.enable_telegram && telegram?.trim() && !hasType("telegram")) {
      const item = normalizeChannel({ id: "legacy-telegram", type: "telegram", label: "Telegram", url: telegram, enabled: true });
      if (item) legacy.push(item);
    }
    if (support.enable_email && settings.contact.support_email?.trim() && !hasType("email")) {
      const item = normalizeChannel({ id: "legacy-email", type: "email", label: "Email Support", url: settings.contact.support_email, enabled: true });
      if (item) legacy.push(item);
    }
    return [...configured, ...legacy];
  }, [support, settings.contact.telegram, settings.contact.support_email, settings.social.telegram]);

  if (location.pathname.startsWith("/admin") || channels.length === 0) return null;

  return (
    <div className="fixed bottom-20 right-4 z-[70] flex flex-col items-end gap-3 sm:bottom-6 sm:right-6">
      {open && (
        <section className="w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-2xl" aria-label="Support options">
          <div className="flex items-start justify-between gap-3 bg-primary px-4 py-4 text-primary-foreground">
            <div className="min-w-0">
              <p className="font-semibold">{support.support_name || "Support Team"}</p>
              <p className="mt-1 text-xs opacity-90">Choose a channel to contact us</p>
              {support.working_hours && <p className="mt-1 text-xs opacity-80">{support.working_hours}</p>}
            </div>
            <button type="button" onClick={() => setOpen(false)} className="rounded-full p-1 transition hover:bg-white/15" aria-label="Close support options">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="max-h-[min(60vh,24rem)] space-y-2 overflow-y-auto p-3">
            {channels.map((channel) => (
              <a key={channel.id} href={channel.href} target={channel.type === "email" ? undefined : "_blank"} rel={channel.type === "email" ? undefined : "noopener noreferrer"} className="flex min-w-0 items-center gap-3 rounded-xl border border-border bg-background p-3 transition hover:border-primary/50 hover:bg-accent">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><ChannelIcon type={channel.type} /></span>
                <span className="min-w-0 flex-1 break-words text-sm font-medium">{channel.label}</span>
                <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground" />
              </a>
            ))}
          </div>
        </section>
      )}
      <button type="button" onClick={() => setOpen((value) => !value)} className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg ring-4 ring-primary/15 transition hover:scale-105 hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30" aria-label={open ? "Close support" : "Open support"} aria-expanded={open}>
        {open ? <X className="h-6 w-6" /> : <Headphones className="h-6 w-6" />}
      </button>
    </div>
  );
}
