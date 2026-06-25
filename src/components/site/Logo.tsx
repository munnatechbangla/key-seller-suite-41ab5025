import { Link } from "@tanstack/react-router";
import { useSettings } from "@/lib/cms/settings";
import { cn } from "@/lib/utils";

type LogoProps = {
  /** Visual variant. `light` = gradient on light bg, `dark` = white text on dark bg (footer/hero). */
  variant?: "light" | "dark";
  /** Render size. */
  size?: "sm" | "md" | "lg";
  /** Render without a Link wrapper. */
  asPlainText?: boolean;
  className?: string;
};

const sizeMap: Record<NonNullable<LogoProps["size"]>, string> = {
  sm: "text-lg",
  md: "text-xl",
  lg: "text-2xl",
};

/**
 * Single source of truth for brand wordmark. Text-only — no icon, no symbol,
 * no badge. Splits the brand name into two halves (`brand_lead` + `brand_accent`)
 * coming from `site_settings.branding` and styles the accent half with the
 * theme's primary→secondary gradient.
 */
export function Logo({ variant = "light", size = "md", asPlainText, className }: LogoProps) {
  const branding = useSettings((s) => s.settings.branding);
  const lead = branding.brand_lead || branding.name || "Digital";
  const accent = branding.brand_accent || "Nest";

  const content = (
    <span
      className={cn(
        "font-extrabold tracking-tight leading-none select-none",
        sizeMap[size],
        variant === "dark" ? "text-white" : "text-foreground",
        className,
      )}
    >
      {lead}
      <span className={variant === "dark" ? "text-gradient" : "text-gradient"}>{accent}</span>
    </span>
  );

  if (asPlainText) return content;
  return (
    <Link to="/" aria-label={branding.name} className="inline-flex items-center">
      {content}
    </Link>
  );
}
