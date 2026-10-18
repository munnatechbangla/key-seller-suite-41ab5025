import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Reveal — scroll-in fade + slide-up. Runs once, respects prefers-reduced-motion.
 * Pure presentation; no re-renders after reveal.
 */
export function Reveal({
  children,
  delay = 0,
  className = "",
  as: Tag = "div",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  as?: "div" | "section";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    // On small/mobile viewports, never leave content hidden while waiting
    // for an intersection callback. Some mobile browsers can delay or miss
    // the callback for sections inside animated/scrolling layouts.
    const isMobile = window.matchMedia("(max-width: 767px)").matches;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (isMobile || reduceMotion || typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }

    const reveal = () => setShown(true);
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          reveal();
          io.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -60px 0px" },
    );
    io.observe(node);

    // Fail open rather than keeping a homepage section invisible indefinitely.
    const fallbackId = window.setTimeout(() => {
      reveal();
      io.disconnect();
    }, 1800);

    return () => {
      io.disconnect();
      window.clearTimeout(fallbackId);
    };
  }, []);

  const Comp = Tag as "div";
  return (
    <Comp
      ref={ref as never}
      style={{ transitionDelay: shown ? `${delay}ms` : "0ms" }}
      className={`will-change-transform transition-all duration-700 ease-out ${
        shown ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      } ${className}`}
    >
      {children}
    </Comp>
  );
}
