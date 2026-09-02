import { cn } from "@/lib/utils";

const HTML_TAG = /<\/?[a-z][\s\S]*>/i;

/**
 * Renders saved rich-text/HTML content with its original formatting.
 * Falls back to preserving line breaks when the stored value is plain text.
 */
export function RichText({ html, className }: { html?: string | null; className?: string }) {
  const value = html ?? "";
  if (!value.trim()) return null;
  const isHtml = HTML_TAG.test(value);
  return (
    <div
      className={cn("rich-content", !isHtml && "is-plain", className)}
      dangerouslySetInnerHTML={{ __html: isHtml ? value : escapeHtml(value) }}
    />
  );
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
