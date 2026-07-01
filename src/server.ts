import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { bridgeRuntimeEnv, getRuntimeEnv } from "./lib/runtime-env";

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

async function injectPublicRuntimeEnv(response: Response, env: unknown): Promise<Response> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html") || !env || typeof env !== "object") return response;

  const bindings = env as Record<string, unknown>;
  const publicEnv: Record<string, string> = {};
  for (const key of ["SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY"]) {
    if (typeof bindings[key] === "string") publicEnv[key] = bindings[key] as string;
  }
  if (!publicEnv.SUPABASE_URL || !publicEnv.SUPABASE_PUBLISHABLE_KEY) return response;

  const payload = JSON.stringify(publicEnv).replace(/</g, "\\u003c");
  const script = `<script>globalThis.__digitalNestRuntimeEnv=Object.assign({},globalThis.__digitalNestRuntimeEnv,${payload});globalThis.process=globalThis.process||{};globalThis.process.env=Object.assign({},globalThis.process.env,${payload});</script>`;
  const html = await response.text();
  const body = html.includes("</head>") ? html.replace("</head>", `${script}</head>`) : `${script}${html}`;
  const headers = new Headers(response.headers);
  headers.delete("content-length");
  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      await bridgeRuntimeEnv(env);
      console.log("bridgeRuntimeEnv executed");
      console.log(`SUPABASE_URL available = ${Boolean(getRuntimeEnv("SUPABASE_URL"))}`);
      console.log(`SUPABASE_PUBLISHABLE_KEY available = ${Boolean(getRuntimeEnv("SUPABASE_PUBLISHABLE_KEY"))}`);
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      const normalized = await normalizeCatastrophicSsrResponse(response);
      return applySecurityHeaders(await injectPublicRuntimeEnv(normalized, env));
    } catch (error) {
      console.error(error);
      return applySecurityHeaders(new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      }));
    }
  },
};
