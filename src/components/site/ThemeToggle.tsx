import { useEffect } from "react";
import { Sun, Moon, Monitor } from "lucide-react";
import { useTheme, applyTheme, type ThemeMode } from "@/lib/theme";

const options: { mode: ThemeMode; Icon: typeof Sun; label: string }[] = [
  { mode: "light", Icon: Sun, label: "Light" },
  { mode: "dark", Icon: Moon, label: "Dark" },
  { mode: "system", Icon: Monitor, label: "System" },
];

export function ThemeProviderEffect() {
  const mode = useTheme((s) => s.mode);
  useEffect(() => {
    applyTheme(mode);
    if (mode !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyTheme("system");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [mode]);
  return null;
}

export function ThemeToggle() {
  const mode = useTheme((s) => s.mode);
  const setMode = useTheme((s) => s.setMode);
  return (
    <div className="inline-flex items-center gap-0.5 p-1 rounded-xl bg-muted/60 border border-border" role="group" aria-label="Theme">
      {options.map(({ mode: m, Icon, label }) => (
        <button
          key={m}
          type="button"
          aria-label={label}
          aria-pressed={mode === m}
          onClick={() => setMode(m)}
          className={`h-8 w-8 grid place-items-center rounded-lg transition-smooth ${
            mode === m ? "bg-card shadow-elegant text-primary" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Icon className="h-4 w-4" />
        </button>
      ))}
    </div>
  );
}
