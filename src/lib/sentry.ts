// Lightweight Sentry initializer. Active only when VITE_SENTRY_DSN is set.
// Uses dynamic import so the package is optional — install @sentry/browser
// to activate. Falls back to console error logging otherwise.
let initialized = false;

export async function initSentry(): Promise<void> {
  if (initialized || typeof window === "undefined") return;
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  if (!dsn) return;
  initialized = true;
  try {
    const mod: any = await import(/* @vite-ignore */ ("@sentry/browser" as string)).catch(() => null);
    if (!mod?.init) {
      console.info("[sentry] DSN configured but @sentry/browser not installed.");
      return;
    }
    mod.init({
      dsn,
      environment: import.meta.env.MODE,
      tracesSampleRate: 0.1,
    });
  } catch (err) {
    console.error("[sentry] init failed", err);
  }
}
