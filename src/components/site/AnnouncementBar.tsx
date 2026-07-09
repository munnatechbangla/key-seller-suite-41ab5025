import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useHomepage } from "@/lib/cms/homepage";

function useCountdown(endsAt: string, enabled: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled || !endsAt) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [enabled, endsAt]);
  if (!enabled || !endsAt) return null;
  const end = Date.parse(endsAt);
  if (Number.isNaN(end)) return null;
  const diff = Math.max(0, end - now);
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return { d, h, m, s, done: diff === 0 };
}

export function AnnouncementBar() {
  const bar = useHomepage((st) => st.config.announcementBar);
  const [closed, setClosed] = useState(false);
  const countdown = useCountdown(bar?.countdownEndsAt ?? "", !!bar?.countdownEnabled);

  if (!bar || !bar.enabled || closed) return null;

  const visibilityClass = [
    bar.showOnDesktop ? "md:block" : "md:hidden",
    bar.showOnMobile ? "block" : "hidden md:block",
  ].join(" ");

  const style: React.CSSProperties = {};
  if (bar.backgroundColor) style.background = bar.backgroundColor;
  if (bar.textColor) style.color = bar.textColor;

  const useDefaultBg = !bar.backgroundColor;
  const useDefaultFg = !bar.textColor;

  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <div
      className={`${visibilityClass} ${bar.sticky ? "sticky top-0 z-[60]" : ""} ${
        useDefaultBg ? "bg-gradient-primary" : ""
      } ${useDefaultFg ? "text-primary-foreground" : ""} text-xs sm:text-sm`}
      style={style}
      role="region"
      aria-label="Site announcement"
    >
      <div className="container mx-auto flex items-center gap-3 py-2 px-3 sm:px-4 min-w-0">
        {bar.highlight && (
          <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-white/15 backdrop-blur px-2.5 py-0.5 text-[10px] sm:text-xs font-bold uppercase tracking-wide">
            {bar.highlight}
          </span>
        )}
        <div className="flex-1 min-w-0 truncate">
          <span>{bar.text}</span>
          {countdown && !countdown.done && (
            <span className="ml-3 inline-flex items-center gap-1 font-mono font-semibold">
              {countdown.d > 0 && <span>{countdown.d}d</span>}
              <span>{pad(countdown.h)}:{pad(countdown.m)}:{pad(countdown.s)}</span>
            </span>
          )}
        </div>
        {bar.buttonLabel && bar.buttonUrl && (
          <a
            href={bar.buttonUrl}
            className="shrink-0 rounded-full bg-white/20 hover:bg-white/30 px-3 py-1 text-[11px] sm:text-xs font-semibold transition"
          >
            {bar.buttonLabel}
          </a>
        )}
        {bar.closable && (
          <button
            type="button"
            aria-label="Dismiss announcement"
            onClick={() => setClosed(true)}
            className="shrink-0 rounded-full p-1 hover:bg-white/20 transition"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
