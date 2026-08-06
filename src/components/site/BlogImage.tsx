import { useEffect, useState } from "react";
import { resolveStoredUrlAsync } from "@/lib/media/resolve";
import { Newspaper } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProductThumb } from "@/components/site/ProductThumb";

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
  return (
    <div className={cn("relative overflow-hidden bg-muted", aspect, className)}>
      <ProductThumb
        src={src}
        emoji="📄"
        alt={alt}
        size={1200}
        className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03] bg-transparent"
      />
    </div>
  );
}

export function readingTimeLabel(input: { reading_time?: number | null; word_count?: number | null; content_html?: string | null; content_markdown?: string | null }): string {
  if (input.reading_time && input.reading_time > 0) return `${input.reading_time} min read`;
  const words = input.word_count ?? (input.content_markdown ?? input.content_html ?? "").replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
  const mins = Math.max(1, Math.round(words / 220));
  return `${mins} min read`;
}
