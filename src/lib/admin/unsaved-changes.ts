import { useEffect, useSyncExternalStore } from "react";

// Lightweight per-tab "dirty" registry. Tabs call `useMarkDirty(key, isDirty)`
// while they hold unsaved local state; the product editor reads `useIsDirty()`
// to drive the beforeunload guard.
const dirty = new Set<string>();
const listeners = new Set<() => void>();

function notify() {
  for (const l of listeners) l();
}

export function setDirty(key: string, value: boolean) {
  const had = dirty.has(key);
  if (value === had) return;
  if (value) dirty.add(key);
  else dirty.delete(key);
  notify();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function getSnapshot() {
  return dirty.size;
}

export function useMarkDirty(key: string, value: boolean) {
  useEffect(() => {
    setDirty(key, value);
    return () => setDirty(key, false);
  }, [key, value]);
}

export function useIsDirty(): boolean {
  const size = useSyncExternalStore(subscribe, getSnapshot, () => 0);
  return size > 0;
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
