import { Check } from "lucide-react";

export type WizardStep = {
  id: string;
  label: string;
  tab: string;
  done: boolean;
};

export function WizardSteps({
  steps,
  currentTab,
  onJump,
}: {
  steps: WizardStep[];
  currentTab: string;
  onJump: (tab: string) => void;
}) {
  return (
    <ol className="flex items-center gap-1 overflow-x-auto rounded-lg border bg-card p-2 text-xs">
      {steps.map((step, i) => {
        const current = step.tab === currentTab;
        const state: "done" | "current" | "future" = current
          ? "current"
          : step.done
            ? "done"
            : "future";
        const dot =
          state === "done"
            ? "bg-emerald-500 border-emerald-500 text-white"
            : state === "current"
              ? "bg-primary border-primary text-primary-foreground"
              : "bg-muted border-border text-muted-foreground";
        const text =
          state === "done"
            ? "text-emerald-600"
            : state === "current"
              ? "text-primary font-medium"
              : "text-muted-foreground";
        return (
          <li key={step.id} className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => onJump(step.tab)}
              className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 hover:bg-muted transition"
            >
              <span
                className={`inline-flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-semibold ${dot}`}
              >
                {state === "done" ? <Check className="h-3 w-3" /> : i + 1}
              </span>
              <span className={text}>{step.label}</span>
            </button>
            {i < steps.length - 1 && (
              <span className="text-muted-foreground/40">›</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
