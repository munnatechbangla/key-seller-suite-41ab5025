import { useEffect, useState } from "react";
import { resolveStoredUrlAsync } from "@/lib/media/resolve";
import { cn } from "@/lib/utils";

type Props = {
  src?: string | null;
  emoji?: string | null;
  alt?: string;
  size?: number; // px - used for fallback font sizing if needed, or default width/height
  className?: string;
};

/** Square product thumbnail with media:// resolution and emoji fallback. Never shows a broken icon. */
export function ProductThumb({ src, emoji, alt = "", size = 64, className }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [resolving, setResolving] = useState(!!src);

  useEffect(() => {
    let alive = true;
    setFailed(false);
    setUrl(null);
    if (!src) { setResolving(false); return; }
    setResolving(true);
    if (/^(https?:|data:|blob:)/i.test(src) && !src.includes("/storage/v1/object/")) {
      setUrl(src);
      setResolving(false);
      return;
    }
    resolveStoredUrlAsync(src).then((u) => { if (alive) { setUrl(u || null); setResolving(false); } });
    return () => { alive = false; };
  }, [src]);

  const showFallback = !resolving && (!src || failed || !url);


  return (
    <div
      className={cn("relative shrink-0 rounded-lg bg-muted flex items-center justify-center", className)}
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
          className="h-full w-full object-contain"
          onError={() => setFailed(true)}
        />
      )}
      {/* Invisible spacer to maintain aspect ratio if no dimensions are provided via className */}
      {!className?.includes("w-") && !className?.includes("h-") && (
        <div style={{ width: size, height: size }} className="pointer-events-none invisible" />
      )}
    </div>
  );
}
