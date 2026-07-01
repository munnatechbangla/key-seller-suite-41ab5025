import { createStart, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { bridgeRuntimeEnv } from "./lib/runtime-env";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";

// Ensures Cloudflare Worker bindings are bridged into process.env / the runtime
// env store BEFORE any server function or route handler runs. TanStack server
// function requests are dispatched by Nitro's cloudflare-module preset, which
// stashes the raw Worker `env` object on `globalThis.__env__` per request.
// src/server.ts's bridge only runs for the SSR entry; server-fn RPC calls can
// reach the handler through Nitro's router without touching src/server.ts, so
// we re-bridge here for every server request.
const bridgeEnvMiddleware = createMiddleware().server(async ({ next }) => {
  const g = globalThis as typeof globalThis & {
    __env__?: Record<string, unknown>;
    __digitalNestCloudflareEnv?: Record<string, unknown>;
  };
  const env = g.__env__ ?? g.__digitalNestCloudflareEnv;
  if (env) {
    try {
      await bridgeRuntimeEnv(env);
    } catch {
      // Non-fatal: fall through and let downstream code report the missing env.
    }
  }
  return next();
});

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth],
  requestMiddleware: [bridgeEnvMiddleware, errorMiddleware],
}));
