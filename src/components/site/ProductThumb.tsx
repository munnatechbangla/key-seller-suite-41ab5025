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

/** Square product thumbnail with media:// resolution, loading placeholder, and emoji fallback. */
export function ProductThumb({ src, emoji, alt = "", size = 64, className }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(Boolean(src));

  useEffect(() => {
    let alive = true;
    setFailed(false);
    setUrl(null);
    setLoading(Boolean(src));
    if (!src) return;
    if (/^(https?:|data:|blob:)/i.test(src) && !src.includes("/storage/v1/object/")) {
      setUrl(src);
      return () => { alive = false; };
    }
    resolveStoredUrlAsync(src).then((u) => {
      if (!alive) return;
      setUrl(u || null);
      if (!u) setLoading(false);
    });
    return () => { alive = false; };
  }, [src]);

  const showFallback = !src || failed || (!url && !loading);

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
        <>
          {loading && <div className="absolute inset-0 animate-pulse bg-muted/80" aria-label="Loading product image" />}
          {url && (
            <img
              src={url}
              alt={alt}
              loading="lazy"
              decoding="async"
              className={cn("absolute inset-0 h-full w-full object-cover transition-opacity", loading ? "opacity-0" : "opacity-100")}
              onLoad={() => setLoading(false)}
              onError={() => { setFailed(true); setLoading(false); }}
            />
          )}
        </>
      )}
    </div>
  );
}
