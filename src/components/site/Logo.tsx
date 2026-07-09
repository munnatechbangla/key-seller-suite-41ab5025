import { Link } from "@tanstack/react-router";
import { useSettings } from "@/lib/cms/settings";
import { useSiteLogo } from "@/lib/cms/site-logo";
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

// Uniform sizing — every surface (Header, Footer, Admin, Auth) renders the
// same dimensions for a given size token.
const sizeMap: Record<NonNullable<LogoProps["size"]>, string> = {
  sm: "text-xl",
  md: "text-2xl",
  lg: "text-2xl",
};

// Responsive height + max-width caps so the <img> never collapses in a flex row.
const imgSizeMap: Record<NonNullable<LogoProps["size"]>, string> = {
  sm: "h-7 sm:h-8 max-w-[140px]",
  md: "h-8 sm:h-9 md:h-10 max-w-[180px]",
  lg: "h-9 sm:h-10 md:h-11 max-w-[200px]",
};


/**
 * Single source of truth for brand mark. When Admin → Branding sets a
 * logo URL, render it as an image; otherwise fall back to the text wordmark
 * ("Digital" + gradient "Nest"). Weight is locked at 800 (font-extrabold).
 */
export function Logo({ variant = "light", size = "md", asPlainText, className }: LogoProps) {
  const branding = useSettings((s) => s.settings.branding);
  const logoUrl = useSiteLogo();
  const lead = branding.brand_lead || branding.name || "Digital";
  const accent = branding.brand_accent || "Nest";

  const leadClass = variant === "dark" ? "text-white" : "text-foreground";

  const content = logoUrl ? (
    <img
      src={logoUrl}
      alt={branding.name}
      className={cn("w-auto object-contain select-none", imgHeightMap[size], className)}
      draggable={false}
    />
  ) : (
    <span
      className={cn(
        "font-extrabold tracking-tight leading-none select-none inline-flex max-w-full min-w-0",
        sizeMap[size],
        className,
      )}
    >
      <span className={`${leadClass} min-w-0 truncate`}>{lead}</span>
      <span className="text-gradient min-w-0 truncate">{accent}</span>
    </span>
  );

  if (asPlainText) return content;
  return (
    <Link to="/" aria-label={branding.name} className="inline-flex min-w-0 max-w-full items-center">
      {content}
    </Link>
  );
}
