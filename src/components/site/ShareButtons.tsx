import { useState } from "react";
import { Share2, Link2, Facebook, Twitter, MessageCircle, Send, Check } from "lucide-react";
import { useMarketplace } from "@/lib/cms/marketplace";
import { siteUrl, siteName } from "@/lib/cms/seo";
import { toast } from "sonner";

function buildUrl(path: string): string {
  const base = siteUrl();
  if (base) return `${base}${path.startsWith("/") ? path : `/${path}`}`;
  if (typeof window !== "undefined") return `${window.location.origin}${path}`;
  return path;
}

export function ShareButtons({ path, title, description }: { path: string; title: string; description?: string }) {
  const enabled = useMarketplace((s) => s.config.product_experience.share_buttons_enabled);
  const [copied, setCopied] = useState(false);

  if (!enabled) return null;

  const url = buildUrl(path);
  const text = `${title}${description ? ` — ${description}` : ""}`;
  const enc = encodeURIComponent;

  const targets = [
    { key: "fb", label: "Share on Facebook", Icon: Facebook, href: `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}` },
    { key: "tw", label: "Share on X", Icon: Twitter, href: `https://twitter.com/intent/tweet?url=${enc(url)}&text=${enc(title)}` },
    { key: "wa", label: "Share on WhatsApp", Icon: MessageCircle, href: `https://wa.me/?text=${enc(`${text} ${url}`)}` },
    { key: "tg", label: "Share on Telegram", Icon: Send, href: `https://t.me/share/url?url=${enc(url)}&text=${enc(title)}` },
  ];

  const nativeShare = async () => {
    if (typeof navigator !== "undefined" && (navigator as any).share) {
      try {
        await (navigator as any).share({ title, text: description || title, url });
        return;
      } catch { /* user cancelled */ }
    }
    void copyLink();
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copied");
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Could not copy link");
    }
  };

  return (
    <div className="inline-flex items-center gap-1 flex-wrap" aria-label={`Share ${siteName()} product`}>
      <button
        onClick={nativeShare}
        className="h-9 px-3 inline-flex items-center gap-1.5 rounded-lg border border-border hover:bg-muted text-xs font-semibold"
        aria-label="Share"
      >
        <Share2 className="h-4 w-4" /> Share
      </button>
      <button
        onClick={copyLink}
        className="h-9 w-9 grid place-items-center rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
        aria-label={copied ? "Link copied" : "Copy link"}
      >
        {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Link2 className="h-4 w-4" />}
      </button>
      {targets.map(({ key, label, Icon, href }) => (
        <a
          key={key}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={label}
          className="h-9 w-9 grid place-items-center rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
        >
          <Icon className="h-4 w-4" />
        </a>
      ))}
    </div>
  );
}
