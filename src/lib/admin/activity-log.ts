/**
 * Client-side product activity log (UX layer only).
 *
 * Phase 4.9A-4 stores an audit trail per product in localStorage so admins can
 * see recent actions without requiring schema changes. This does NOT touch any
 * business logic, orders, payments or fulfillment paths.
 */
import { useSyncExternalStore } from "react";

export type ActivityKind =
  | "created"
  | "edited"
  | "saved"
  | "published"
  | "unpublished"
  | "duplicated"
  | "imported"
  | "exported"
  | "seo_updated"
  | "variants_generated"
  | "downloads_added"
  | "preview_generated";

export interface ActivityEntry {
  id: string;
  productId: string;
  kind: ActivityKind;
  message: string;
  actor?: string | null;
  at: number;
}

const KEY = "lovable.admin.activity.v1";
const LIMIT_PER_PRODUCT = 50;

type Store = Record<string, ActivityEntry[]>;

const listeners = new Set<() => void>();
let cache: Store | null = null;

function read(): Store {
  if (cache) return cache;
  if (typeof window === "undefined") return (cache = {});
  try {
    const raw = window.localStorage.getItem(KEY);
    cache = raw ? (JSON.parse(raw) as Store) : {};
  } catch {
    cache = {};
  }
  return cache!;
}

function write(next: Store) {
  cache = next;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* quota – ignore */
    }
  }
  listeners.forEach((l) => l());
}

export function logActivity(
  productId: string,
  kind: ActivityKind,
  message: string,
  actor?: string | null,
) {
  if (!productId) return;
  const store = { ...read() };
  const entry: ActivityEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    productId,
    kind,
    message,
    actor: actor ?? null,
    at: Date.now(),
  };
  const prev = store[productId] ?? [];
  store[productId] = [entry, ...prev].slice(0, LIMIT_PER_PRODUCT);
  write(store);
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

const EMPTY: ActivityEntry[] = [];
export function useProductActivity(productId: string): ActivityEntry[] {
  return useSyncExternalStore(
    subscribe,
    () => read()[productId] ?? EMPTY,
    () => EMPTY,
  );
}

export function clearActivity(productId: string) {
  const store = { ...read() };
  delete store[productId];
  write(store);
}
