import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { resolveStoredUrlAsync } from "@/lib/media/resolve";
import { cn } from "@/lib/utils";

type Props = {
  src?: string | null;
  productId?: string | null;
  emoji?: string | null;
  alt?: string;
  size?: number; // px
  className?: string;
};

async function resolveProductGalleryFallback(productId: string | null | undefined, exclude?: string | null) {
  if (!productId) return "";
  try {
    const { data } = await supabase
      .from("product_images")
      .select("url")
      .eq("product_id", productId)
      .order("is_primary", { ascending: false })
      .order("sort_order", { ascending: true })
      .limit(6);
    for (const image of data ?? []) {
      const resolved = await resolveStoredUrlAsync(image.url);
      if (resolved && resolved !== exclude) return resolved;
    }
  } catch {
    // Keep the neutral visual fallback when gallery lookup is unavailable.
  }
  return "";
}

/** Square product thumbnail with stored URL resolution and gallery fallback. */
export function ProductThumb({ src, productId, emoji, alt = "", size = 64, className }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(Boolean(src));
  const [fallbackTried, setFallbackTried] = useState(false);

  useEffect(() => {
    let alive = true;
    setFailed(false);
    setUrl(null);
    setFallbackTried(false);
    setLoading(Boolean(src) || Boolean(productId));
    const resolve = async () => {
      const primary = await resolveStoredUrlAsync(src);
      if (!alive) return;
      if (primary) {
        setUrl(primary);
        setLoading(false);
        return;
      }
      if (productId) {
        setFallbackTried(true);
        const fallback = await resolveProductGalleryFallback(productId, src);
        if (!alive) return;
        if (fallback) {
          setUrl(fallback);
          setLoading(false);
          return;
        }
      }
      setLoading(false);
    };
    if (!src && !productId) {
      setLoading(false);
      return () => { alive = false; };
    }
    void resolve();
    return () => { alive = false; };
  }, [src, productId]);

  const handleImageError = async () => {
    setLoading(false);
    if (fallbackTried) {
      setFailed(true);
      return;
    }
    setFallbackTried(true);
    const fallback = await resolveProductGalleryFallback(productId, url);
    if (fallback) {
      setUrl(fallback);
      setLoading(true);
      setFailed(false);
      return;
    }
    setFailed(true);
  };

  const showFallback = failed || (!url && !loading);

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
              key={url}
              src={url}
              alt={alt}
              loading="lazy"
              decoding="async"
              className={cn("absolute inset-0 h-full w-full object-cover transition-opacity", loading ? "opacity-0" : "opacity-100")}
              onLoad={() => setLoading(false)}
              onError={() => { void handleImageError(); }}
            />
          )}
        </>
      )}
    </div>
  );
}
