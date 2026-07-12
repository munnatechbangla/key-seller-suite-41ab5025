import { useEffect, useState } from "react";
import { resolveStoredUrlAsync } from "@/lib/media/resolve";
import { cn } from "@/lib/utils";

type Props = {
  src?: string | null;
  emoji?: string | null;
  alt?: string;
  size?: number; // px
  className?: string;
};

/** Square product thumbnail with media:// resolution and emoji fallback. Never shows a broken icon. */
export function ProductThumb({ src, emoji, alt = "", size = 64, className }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    setFailed(false);
    setUrl(null);
    if (!src) return;
    if (/^(https?:|data:|blob:)/i.test(src) && !src.includes("/storage/v1/object/")) {
      setUrl(src);
      return;
    }
    resolveStoredUrlAsync(src).then((u) => { if (alive) setUrl(u || null); });
    return () => { alive = false; };
  }, [src]);

  const showFallback = !src || failed || !url;

  return (
    <div
      className={cn("relative shrink-0 overflow-hidden rounded-lg bg-muted", className)}
      style={{ width: size, height: size }}
    >
      {showFallback ? (
        <div className="absolute inset-0 grid place-items-center bg-gradient-to-br from-primary/10 via-secondary/10 to-accent/10 text-2xl">
          <span aria-hidden>{emoji || "📦"}</span>
        </div>
      ) : (
        <img
          src={url}
          alt={alt}
          loading="lazy"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}
