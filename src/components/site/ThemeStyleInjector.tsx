import { useEffect } from "react";
import { useSettings, type ThemeConfig } from "@/lib/cms/settings";

/**
 * Applies dynamic theme tokens (colors + font family) from `site_settings`
 * to the document root via CSS custom properties. Overrides the static
 * tokens in `styles.css` at runtime so every page updates instantly.
 */
export function applyThemeTokens(theme: ThemeConfig) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (theme.primary_color) root.style.setProperty("--primary", theme.primary_color);
  if (theme.secondary_color) root.style.setProperty("--secondary", theme.secondary_color);
  if (theme.accent_color) root.style.setProperty("--accent", theme.accent_color);
  if (theme.primary_color) root.style.setProperty("--primary-glow", theme.primary_color);
  if (theme.primary_color && theme.secondary_color) {
    root.style.setProperty(
      "--gradient-primary",
      `linear-gradient(135deg, ${theme.primary_color}, ${theme.secondary_color})`,
    );
    if (theme.accent_color) {
      root.style.setProperty(
        "--gradient-accent",
        `linear-gradient(135deg, ${theme.primary_color} 0%, ${theme.secondary_color} 60%, ${theme.accent_color} 100%)`,
      );
    }
  }
  if (theme.font_family) {
    root.style.setProperty(
      "--font-sans",
      `"${theme.font_family}", ui-sans-serif, system-ui, sans-serif`,
    );
  }
}

function ensureFontLink(url: string) {
  if (typeof document === "undefined" || !url) return;
  const id = "dyn-theme-font";
  let link = document.getElementById(id) as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    document.head.appendChild(link);
  }
  if (link.href !== url) link.href = url;
}

export function ThemeStyleInjector() {
  const theme = useSettings((s) => s.settings.theme);
  useEffect(() => {
    applyThemeTokens(theme);
    ensureFontLink(theme.font_url);
  }, [theme]);
  return null;
}
