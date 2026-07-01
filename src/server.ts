import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!body.includes('"unhandled":true') || !body.includes('"message":"HTTPError"')) {
    return response;
  }

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

// Security headers applied to every response. CSP is intentionally permissive
// for inline scripts/styles (TanStack SSR injects them) and for known
// third-party services (Supabase, Stripe, SSLCommerz, Google Fonts, GA/Meta).
// frame-ancestors covers iframe embedding (supersedes X-Frame-Options on
// modern browsers) and explicitly permits the Lovable editor preview.
const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "X-DNS-Prefetch-Control": "on",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Content-Security-Policy": [
    "default-src 'self' https: data: blob:",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https:",
    "style-src 'self' 'unsafe-inline' https:",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: https:",
    "connect-src 'self' https: wss:",
    "frame-src 'self' https:",
    "frame-ancestors 'self' https://*.lovable.app https://*.lovable.dev",
    "base-uri 'self'",
    "form-action 'self' https:",
    "object-src 'none'",
  ].join("; "),
};

function applySecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) {
    if (!headers.has(k)) headers.set(k, v);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

// On Cloudflare Workers, secrets and vars arrive via the `env` argument to
// fetch(), not via process.env. Nitro's cloudflare-module preset bridges
// wrangler.toml [vars] into process.env, but dashboard-set secrets
// (SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, RESEND_API_KEY, etc.) can be
// missing from process.env at the moment SSR modules first evaluate. Copy
// every string binding into process.env on the first request so downstream
// code that reads process.env.* keeps working unchanged.
let envBridged = false;
function bridgeEnvToProcess(env: unknown) {
  if (envBridged || !env || typeof env !== "object") return;
  const g = globalThis as { process?: { env?: Record<string, string> } };
  if (!g.process) g.process = { env: {} } as { env: Record<string, string> };
  if (!g.process.env) g.process.env = {};
  const targets: Array<Record<string, string>> = [g.process.env];
  try {
    // In some Cloudflare/workerd builds `process.env` is a distinct object
    // from what `node:process` exposes. Populate both to be safe.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const nodeProc = (globalThis as any).process;
    if (nodeProc?.env && !targets.includes(nodeProc.env)) targets.push(nodeProc.env);
  } catch {}
  for (const [k, v] of Object.entries(env as Record<string, unknown>)) {
    if (typeof v !== "string") continue;
    for (const t of targets) {
      try {
        if (t[k] === undefined) t[k] = v;
      } catch {}
    }
  }
  envBridged = true;
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      bridgeEnvToProcess(env);
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return applySecurityHeaders(await normalizeCatastrophicSsrResponse(response));
    } catch (error) {
      console.error(error);
      return applySecurityHeaders(new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      }));
    }
  },
};
