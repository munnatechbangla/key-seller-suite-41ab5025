import { useEffect, useRef, useState } from "react";
import { X, ShoppingBag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMarketplace } from "@/lib/cms/marketplace";
import { STORAGE_SLUG } from "@/lib/storage-slug";

type Purchase = {
  first_name: string;
  country: string | null;
  product_name: string;
  product_slug: string;
  product_thumbnail: string | null;
  purchased_at: string;
};

const DEMO_NAMES = ["Rahim", "Aisha", "James", "Maria", "Karim", "Sofia", "Liam", "Noor", "Diego", "Yuki"];
const DEMO_COUNTRIES = ["BD", "US", "UK", "DE", "AE", "IN", "BR", "JP", "ES", "CA"];
const DEMO_PRODUCTS = [
  { name: "ChatGPT Plus", slug: "chatgpt-plus" },
  { name: "Canva Pro", slug: "canva-pro" },
  { name: "Netflix Premium", slug: "netflix-premium" },
  { name: "Spotify Premium", slug: "spotify-premium" },
  { name: "CapCut Pro", slug: "capcut-pro" },
  { name: "Adobe Creative Cloud", slug: "adobe-creative-cloud" },
];

function timeAgo(iso: string): string {
  const diff = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
  return `${Math.floor(diff / 86400)} days ago`;
}

function rand<T>(a: T[]): T { return a[Math.floor(Math.random() * a.length)]; }

function genDemo(): Purchase {
  const p = rand(DEMO_PRODUCTS);
  return {
    first_name: rand(DEMO_NAMES),
    country: rand(DEMO_COUNTRIES),
    product_name: p.name,
    product_slug: p.slug,
    product_thumbnail: null,
    purchased_at: new Date(Date.now() - Math.floor(Math.random() * 30 * 60 * 1000)).toISOString(),
  };
}

const CLOSE_KEY = `${STORAGE_SLUG}_rp_closed`;

export function RecentlyPurchasedPopup() {
  const cfg = useMarketplace((s) => s.config.recently_purchased);
  const speed = useMarketplace((s) => s.config.ui.animation_speed_ms);
  const [item, setItem] = useState<Purchase | null>(null);
  const [visible, setVisible] = useState(false);
  const pool = useRef<Purchase[]>([]);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (!cfg.enabled) return;
    if (cfg.hide_after_close && typeof window !== "undefined" && localStorage.getItem(CLOSE_KEY) === "1") return;

    let cancelled = false;

    async function loadPool() {
      if (cfg.demo_mode) {
        pool.current = Array.from({ length: 10 }, genDemo);
        return;
      }
      try {
        const { data } = await supabase.rpc("list_recent_public_purchases", { _limit: 20 });
        if (data && (data as any[]).length > 0) {
          pool.current = (data as any) as Purchase[];
        } else {
          pool.current = Array.from({ length: 10 }, genDemo);
        }
      } catch {
        pool.current = Array.from({ length: 10 }, genDemo);
      }
    }

    function schedule() {
      const min = Math.max(2, cfg.min_delay_seconds);
      const max = Math.max(min + 1, cfg.max_delay_seconds);
      const delay = (min + Math.random() * (max - min)) * 1000;
      timer.current = window.setTimeout(showOne, delay);
    }

    function showOne() {
      if (cancelled || pool.current.length === 0) { schedule(); return; }
      const next = pool.current[Math.floor(Math.random() * pool.current.length)];
      setItem(next);
      setVisible(true);
      window.setTimeout(() => setVisible(false), Math.max(2, cfg.display_seconds) * 1000);
      schedule();
    }

    loadPool().then(() => schedule());

    return () => {
      cancelled = true;
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [cfg.enabled, cfg.demo_mode, cfg.min_delay_seconds, cfg.max_delay_seconds, cfg.display_seconds, cfg.hide_after_close]);

  if (!cfg.enabled || !item) return null;

  const close = () => {
    setVisible(false);
    if (cfg.hide_after_close && typeof window !== "undefined") {
      localStorage.setItem(CLOSE_KEY, "1");
    }
  };

  return (
    <div
      role="status"
      aria-live="polite"
      style={{ transitionDuration: `${speed}ms` }}
      className={[
        "fixed z-50 pointer-events-none",
        "left-1/2 -translate-x-1/2 bottom-20",
        "md:left-4 md:translate-x-0 md:bottom-6",
        "transition-all ease-out",
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3 pointer-events-none",
      ].join(" ")}
    >
      <a
        href={`/products/${item.product_slug}`}
        className="pointer-events-auto group flex items-center gap-3 max-w-[92vw] md:max-w-sm bg-card border border-border shadow-2xl rounded-2xl p-3 pr-9 hover:border-primary/40 transition-colors"
      >
        <div className="relative h-12 w-12 shrink-0 rounded-xl bg-gradient-to-br from-primary/15 via-secondary/15 to-accent/15 grid place-items-center overflow-hidden">
          {item.product_thumbnail ? (
            <img src={item.product_thumbnail} alt="" className="h-full w-full object-cover" />
          ) : (
            <ShoppingBag className="h-5 w-5 text-primary" />
          )}
        </div>
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">{item.first_name}</span>
            {cfg.show_country && item.country ? <span> from {item.country}</span> : null}
            <span> purchased</span>
          </div>
          <div className="text-sm font-semibold truncate">{item.product_name}</div>
          <div className="text-[11px] text-muted-foreground">{timeAgo(item.purchased_at)}</div>
        </div>
      </a>
      <button
        onClick={close}
        aria-label="Dismiss notification"
        className="pointer-events-auto absolute top-2 right-2 h-6 w-6 grid place-items-center rounded-full bg-muted hover:bg-muted/70 text-muted-foreground"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
