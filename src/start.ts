import { createStart, createMiddleware } from "@tanstack/react-start";
import { env as cloudflareEnv } from "cloudflare:workers";

import { renderErrorPage } from "./lib/error-page";
import { bridgeRuntimeEnv } from "./lib/runtime-env";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";

// Use Cloudflare's supported runtime binding API. A standard Fetch Request does
// not expose request.runtime.cloudflare.env, so attempting to read bindings
// from getRequest() can silently leave server functions with stale build-time
// values such as EMAILS_ENABLED=false.
const bridgeEnvMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    await bridgeRuntimeEnv(cloudflareEnv);
  } catch (error) {
    // Keep the request alive; email status/logging will surface missing config.
    console.error("[runtime-env] Could not bridge Cloudflare bindings", error);
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
