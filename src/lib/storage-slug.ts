// White-label storage slug. Determines the prefix for all localStorage
// keys used by zustand `persist` stores so multiple deployments on the
// same browser do not collide.
//
// Precedence:
//   1. `VITE_APP_SLUG` env var (build-time, per deployment)
//   2. `topuphut` (default demo slug, preserves backward compatibility
//      for existing TopupHut installations)
//
// Anything that needs a per-install key should call `storageKey("cart")`
// instead of hardcoding a literal.
export const STORAGE_SLUG: string =
  ((import.meta as unknown as { env?: { VITE_APP_SLUG?: string } }).env?.VITE_APP_SLUG ?? "topuphut")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-");

export function storageKey(suffix: string): string {
  return `${STORAGE_SLUG}-${suffix}`;
}
