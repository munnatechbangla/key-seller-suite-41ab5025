/**
 * Product editor persistence & safety infrastructure.
 * Owns: autosave scheduler + save queue, undo/redo history,
 * offline draft cache, conflict detection, and save status.
 * No business logic — pure client state around an existing save fn.
 */
import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from "react";

export type SaveStatus = "idle" | "saving" | "saved" | "error" | "offline";

type Listener = () => void;

function createExternal<T>(initial: T) {
  let value = initial;
  const listeners = new Set<Listener>();
  return {
    get: () => value,
    set: (next: T) => {
      if (Object.is(next, value)) return;
      value = next;
      listeners.forEach((l) => l());
    },
    subscribe: (cb: Listener) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
  };
}

/* ---------------- Save status store ---------------- */

const statusStore = createExternal<{
  status: SaveStatus;
  lastSavedAt: number | null;
  error: string | null;
}>({ status: "idle", lastSavedAt: null, error: null });

export function useSaveStatus() {
  return useSyncExternalStore(
    statusStore.subscribe,
    statusStore.get,
    () => ({ status: "idle" as SaveStatus, lastSavedAt: null, error: null }),
  );
}

/* ---------------- History (undo / redo) ---------------- */

type HistoryEntry = { label: string; snapshot: unknown; apply: (s: unknown) => void };
const HISTORY_LIMIT = 20;

const historyStore = createExternal<{
  past: HistoryEntry[];
  future: HistoryEntry[];
}>({ past: [], future: [] });

export function useHistoryState() {
  const s = useSyncExternalStore(historyStore.subscribe, historyStore.get, () => ({
    past: [] as HistoryEntry[],
    future: [] as HistoryEntry[],
  }));
  return { canUndo: s.past.length > 0, canRedo: s.future.length > 0 };
}

export function pushHistory(entry: HistoryEntry) {
  const s = historyStore.get();
  const past = [...s.past, entry].slice(-HISTORY_LIMIT);
  historyStore.set({ past, future: [] });
}

export function undo() {
  const s = historyStore.get();
  const last = s.past[s.past.length - 1];
  if (!last) return;
  last.apply(last.snapshot);
  historyStore.set({ past: s.past.slice(0, -1), future: [last, ...s.future].slice(0, HISTORY_LIMIT) });
}

export function redo() {
  const s = historyStore.get();
  const next = s.future[0];
  if (!next) return;
  next.apply(next.snapshot);
  historyStore.set({ past: [...s.past, next].slice(-HISTORY_LIMIT), future: s.future.slice(1) });
}

export function clearHistory() {
  historyStore.set({ past: [], future: [] });
}

/* ---------------- Save queue + autosave ---------------- */

type SaveFn = () => Promise<{ updated_at?: string | null } | void>;

type QueueState = { running: boolean; pending: SaveFn | null };
const queue: QueueState = { running: false, pending: null };

async function runQueue() {
  if (queue.running) return;
  const fn = queue.pending;
  if (!fn) return;
  queue.pending = null;
  queue.running = true;
  statusStore.set({ ...statusStore.get(), status: "saving", error: null });
  try {
    await fn();
    statusStore.set({ status: "saved", lastSavedAt: Date.now(), error: null });
  } catch (e: any) {
    const offline = typeof navigator !== "undefined" && !navigator.onLine;
    statusStore.set({
      status: offline ? "offline" : "error",
      lastSavedAt: statusStore.get().lastSavedAt,
      error: e?.message ?? String(e),
    });
  } finally {
    queue.running = false;
    if (queue.pending) void runQueue();
  }
}

/** Enqueue a save; latest wins, never runs in parallel. */
export function enqueueSave(fn: SaveFn) {
  queue.pending = fn;
  void runQueue();
}

export function retrySave(fn: SaveFn) {
  enqueueSave(fn);
}

/* ---------------- Offline draft cache ---------------- */

const draftKey = (id: string) => `lovable:product-draft:${id}`;

export function saveLocalDraft(id: string, data: unknown) {
  try {
    localStorage.setItem(draftKey(id), JSON.stringify({ data, at: Date.now() }));
  } catch {
    /* quota / disabled — ignore */
  }
}

export function readLocalDraft<T = unknown>(id: string): { data: T; at: number } | null {
  try {
    const raw = localStorage.getItem(draftKey(id));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearLocalDraft(id: string) {
  try {
    localStorage.removeItem(draftKey(id));
  } catch {
    /* ignore */
  }
}

/* ---------------- Autosave hook (debounced) ---------------- */

export function useAutosave<T>({
  id,
  data,
  save,
  enabled = true,
  debounceMs = 1500,
  intervalMs = 30_000,
}: {
  id: string;
  data: T;
  save: (data: T) => Promise<{ updated_at?: string | null } | void>;
  enabled?: boolean;
  debounceMs?: number;
  intervalMs?: number;
}) {
  const dataRef = useRef(data);
  dataRef.current = data;
  const lastSerialized = useRef<string>(JSON.stringify(data));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(() => {
    const serialized = JSON.stringify(dataRef.current);
    if (serialized === lastSerialized.current) return;
    lastSerialized.current = serialized;
    const snapshot = dataRef.current;
    enqueueSave(async () => {
      try {
        const res = await save(snapshot);
        clearLocalDraft(id);
        return res;
      } catch (err) {
        // Offline / network — persist locally for recovery.
        saveLocalDraft(id, snapshot);
        throw err;
      }
    });
  }, [id, save]);

  // Debounced change detection.
  useEffect(() => {
    if (!enabled) return;
    const serialized = JSON.stringify(data);
    if (serialized === lastSerialized.current) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, debounceMs);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [data, enabled, debounceMs, flush]);

  // Fixed interval fallback (~30s).
  useEffect(() => {
    if (!enabled) return;
    const iv = setInterval(flush, intervalMs);
    return () => clearInterval(iv);
  }, [enabled, intervalMs, flush]);

  // Flush on tab hide / unload.
  useEffect(() => {
    if (!enabled) return;
    const handler = () => flush();
    window.addEventListener("visibilitychange", handler);
    window.addEventListener("pagehide", handler);
    return () => {
      window.removeEventListener("visibilitychange", handler);
      window.removeEventListener("pagehide", handler);
    };
  }, [enabled, flush]);

  return { flushNow: flush };
}

/* ---------------- Online recovery ---------------- */

export function useOnlineRecovery(retry: () => void) {
  useEffect(() => {
    const handler = () => {
      if (statusStore.get().status === "offline") retry();
    };
    window.addEventListener("online", handler);
    return () => window.removeEventListener("online", handler);
  }, [retry]);
}

/* ---------------- Conflict detection ---------------- */

const conflictStore = createExternal<{ conflictedAt: string | null }>({ conflictedAt: null });

export function useConflict() {
  return useSyncExternalStore(conflictStore.subscribe, conflictStore.get, () => ({ conflictedAt: null }));
}

export function markConflict(remoteUpdatedAt: string | null) {
  conflictStore.set({ conflictedAt: remoteUpdatedAt });
}

export function clearConflict() {
  conflictStore.set({ conflictedAt: null });
}

/** Detects when the server row's updated_at changed while the user was editing. */
export function useConflictWatcher(remoteUpdatedAt: string | null | undefined, isDirty: boolean) {
  const baseline = useRef<string | null>(null);
  useEffect(() => {
    if (!remoteUpdatedAt) return;
    if (baseline.current === null) {
      baseline.current = remoteUpdatedAt;
      return;
    }
    if (isDirty && remoteUpdatedAt !== baseline.current) {
      markConflict(remoteUpdatedAt);
    }
    if (!isDirty) {
      baseline.current = remoteUpdatedAt;
      clearConflict();
    }
  }, [remoteUpdatedAt, isDirty]);
}

/* ---------------- Keyboard shortcuts ---------------- */

export type EditorShortcuts = {
  onSave?: () => void;
  onPreview?: () => void;
  onDuplicate?: () => void;
  onPublish?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onHelp?: () => void;
};

export function useEditorShortcuts(handlers: EditorShortcuts) {
  const ref = useRef(handlers);
  ref.current = handlers;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod && e.key !== "Escape" && e.key !== "?") return;
      const target = e.target as HTMLElement | null;
      const editable =
        !!target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          (target as HTMLElement).isContentEditable);

      if (mod && e.key.toLowerCase() === "s") {
        e.preventDefault();
        ref.current.onSave?.();
      } else if (mod && e.shiftKey && e.key.toLowerCase() === "p") {
        e.preventDefault();
        ref.current.onPublish?.();
      } else if (mod && e.key.toLowerCase() === "p") {
        e.preventDefault();
        ref.current.onPreview?.();
      } else if (mod && e.key.toLowerCase() === "d") {
        e.preventDefault();
        ref.current.onDuplicate?.();
      } else if (mod && e.shiftKey && e.key.toLowerCase() === "z") {
        e.preventDefault();
        ref.current.onRedo?.();
      } else if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        ref.current.onUndo?.();
      } else if (!mod && e.key === "?" && !editable) {
        ref.current.onHelp?.();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

/* ---------------- Formatters ---------------- */

export function formatSavedAt(ts: number | null): string {
  if (!ts) return "";
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

// Tiny hook consumers can use to memo an incremental diff for reference —
// callers pass this to their save fn to send only changed keys.
export function useShallowDiff<T extends Record<string, unknown>>(current: T, baseline: T) {
  return useMemo(() => {
    const patch: Record<string, unknown> = {};
    for (const k of Object.keys(current)) {
      if (!Object.is(current[k], baseline[k])) patch[k] = current[k];
    }
    return patch;
  }, [current, baseline]);
}
