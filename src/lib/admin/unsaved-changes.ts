import { useEffect } from "react";

// Lightweight per-tab "dirty" registry. Tabs call `useMarkDirty(key, isDirty)`
// while they hold unsaved local state; the product editor reads `useIsDirty()`
// to drive the beforeunload guard and Save-Draft affordances.
const dirty = new Map<string, boolean>();
const listeners = new Set<() => void>();

function notify() {
  for (const l of listeners) l();
}

export function setDirty(key: string, value: boolean) {
  const prev = dirty.get(key) ?? false;
  if (prev === value) return;
  if (value) dirty.set(key, true);
  else dirty.delete(key);
  notify();
}

export function useMarkDirty(key: string, value: boolean) {
  useEffect(() => {
    setDirty(key, value);
    return () => setDirty(key, false);
  }, [key, value]);
}

export function useIsDirty(): boolean {
  const [, force] = useForce();
  useEffect(() => {
    listeners.add(force);
    return () => {
      listeners.delete(force);
    };
  }, [force]);
  return dirty.size > 0;
}

function useForce() {
  const [n, setN] = (require("react") as typeof import("react")).useState(0);
  return [n, () => setN((x: number) => x + 1)] as const;
}

export function useBeforeUnloadGuard(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [active]);
}
