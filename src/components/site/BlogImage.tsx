import { useEffect, useState } from "react";
import { resolveStoredUrlAsync } from "@/lib/media/resolve";
import { Newspaper } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  src?: string | null;
  alt?: string;
  className?: string;
  aspect?: string; // e.g. "aspect-[16/10]"
  eager?: boolean;
};

/**
 * Renders a blog featured image. Resolves `media://<path>` tokens from the
 * Media Library into signed URLs and shows a gradient + icon fallback when
 * the source is missing or fails to load. Never emits a broken image.
 */
export function BlogImage({ src, alt = "", className, aspect = "aspect-[16/10]", eager = false }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    setFailed(false);
    setUrl(null);
    if (!src) return;
    // Direct http(s)/data/blob → use as-is; media:// tokens & legacy storage URLs → resolve
    if (/^(https?:|data:|blob:)/i.test(src) && !src.includes("/storage/v1/object/")) {
      setUrl(src);
      return;
    }
    resolveStoredUrlAsync(src).then((u) => { if (alive) setUrl(u || null); });
    return () => { alive = false; };
  }, [src]);

  const showFallback = !src || failed || !url;

  return (
    <div className={cn("relative overflow-hidden bg-muted", aspect, className)}>
      {showFallback ? (
        <div className="absolute inset-0 grid place-items-center bg-gradient-to-br from-primary/15 via-secondary/10 to-accent/15">
          <Newspaper className="h-10 w-10 text-primary/50" aria-hidden />
        </div>
      ) : (
        <img
          src={url}
          alt={alt}
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}

export function readingTimeLabel(input: { reading_time?: number | null; word_count?: number | null; content_html?: string | null; content_markdown?: string | null }): string {
  if (input.reading_time && input.reading_time > 0) return `${input.reading_time} min read`;
  const words = input.word_count ?? (input.content_markdown ?? input.content_html ?? "").replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
  const mins = Math.max(1, Math.round(words / 220));
  return `${mins} min read`;
}
