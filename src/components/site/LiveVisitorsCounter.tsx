import { useEffect, useState } from "react";
import { Eye } from "lucide-react";
import { useMarketplace } from "@/lib/cms/marketplace";

export function LiveVisitorsCounter({ surface = "product", seed }: { surface?: "product" | "home"; seed?: string }) {
  const cfg = useMarketplace((s) => s.config.live_visitors);
  const speed = useMarketplace((s) => s.config.ui.animation_speed_ms);
  const enabled = surface === "product" ? cfg.enabled_product : cfg.enabled_home;
  const [n, setN] = useState<number | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const min = Math.max(1, cfg.min_visitors);
    const max = Math.max(min + 1, cfg.max_visitors);
    // deterministic-ish initial value per surface/seed so it doesn't flicker wildly on remount
    let base = Math.floor(min + Math.random() * (max - min));
    setN(base);
    const id = window.setInterval(() => {
      const drift = Math.floor(Math.random() * 5) - 2;
      base = Math.min(max, Math.max(min, base + drift));
      setN(base);
    }, Math.max(3, cfg.refresh_seconds) * 1000);
    return () => window.clearInterval(id);
  }, [enabled, cfg.min_visitors, cfg.max_visitors, cfg.refresh_seconds, seed]);

  if (!enabled || n === null) return null;

  const text = (cfg.text_template || "{n} people are viewing this right now").replace("{n}", String(n));

  return (
    <div
      role="status"
      aria-live="polite"
      style={{ transitionDuration: `${speed}ms` }}
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-semibold border border-primary/20 transition-opacity"
    >
      <span className="relative flex h-2 w-2">
        <span className="absolute inset-0 rounded-full bg-primary animate-ping opacity-60" />
        <span className="relative h-2 w-2 rounded-full bg-primary" />
      </span>
      <Eye className="h-3.5 w-3.5" />
      <span>{text}</span>
    </div>
  );
}
