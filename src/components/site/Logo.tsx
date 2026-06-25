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

// Uniform sizing — every surface (Header, Footer, Admin, Auth) renders the
// same dimensions for a given size token.
const sizeMap: Record<NonNullable<LogoProps["size"]>, string> = {
  sm: "text-xl",
  md: "text-2xl",
  lg: "text-2xl",
};

/**
 * Single source of truth for brand wordmark. Text-only — no icon, no symbol,
 * no badge. "Digital" (lead) renders in solid white; "Nest" (accent) uses the
 * theme primary→secondary gradient. Weight is locked at 800 (font-extrabold).
 */
export function Logo({ variant = "light", size = "md", asPlainText, className }: LogoProps) {
  const branding = useSettings((s) => s.settings.branding);
  const lead = branding.brand_lead || branding.name || "Digital";
  const accent = branding.brand_accent || "Nest";

  // Lead half: white on dark surfaces, foreground on light — keeps contrast in
  // both themes while preserving the "white DIGITAL" treatment on hero/footer.
  const leadClass = variant === "dark" ? "text-white" : "text-foreground";


  const content = (
    <span
      className={cn(
        "font-extrabold tracking-tight leading-none select-none inline-flex",
        sizeMap[size],
        className,
      )}
    >
      <span className={leadClass}>{lead}</span>
      <span className="text-gradient">{accent}</span>
    </span>
  );

  if (asPlainText) return content;
  return (
    <Link to="/" aria-label={branding.name} className="inline-flex items-center">
      {content}
    </Link>
  );
}
