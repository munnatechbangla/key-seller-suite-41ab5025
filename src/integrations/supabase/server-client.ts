import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import { getRuntimeEnv } from "@/lib/runtime-env";

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );

    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }

    if (isNewSupabaseApiKey(supabaseKey) && headers.get("Authorization") === `Bearer ${supabaseKey}`) {
      headers.delete("Authorization");
    }

    headers.set("apikey", supabaseKey);
    if (url.includes("/rpc/submit_manual_payment_proof")) {
      const authorization = headers.get("Authorization");
      console.log("[payment-proof-audit] createServerSupabaseClient outbound fetch", {
        url,
        hasAuthorizationHeader: Boolean(authorization),
        authorizationScheme: authorization?.split(" ")[0] ?? null,
        authorizationIsPublishableKey: authorization === `Bearer ${supabaseKey}`,
        clientType: authorization ? "authenticated-bearer" : "anonymous-publishable",
      });
    }
    return fetch(input, { ...init, headers });
  };
}

export function createServerSupabaseClient() {
  console.log("getRuntimeEnv SUPABASE_URL:", !!getRuntimeEnv("SUPABASE_URL"));
  console.log("getRuntimeEnv SUPABASE_PUBLISHABLE_KEY:", !!getRuntimeEnv("SUPABASE_PUBLISHABLE_KEY"));
  const SUPABASE_URL = getRuntimeEnv("SUPABASE_URL");
  const SUPABASE_PUBLISHABLE_KEY = getRuntimeEnv("SUPABASE_PUBLISHABLE_KEY");

  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    const missing = [
      ...(!SUPABASE_URL ? ["SUPABASE_URL"] : []),
      ...(!SUPABASE_PUBLISHABLE_KEY ? ["SUPABASE_PUBLISHABLE_KEY"] : []),
    ];
    throw new Error(`Missing Supabase environment variable(s): ${missing.join(", ")}.`);
  }

  return createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: { fetch: createSupabaseFetch(SUPABASE_PUBLISHABLE_KEY) },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

export function paymentRpcSecret(): string | null {
  return getRuntimeEnv("PAYMENTS_WEBHOOK_SECRET") || getRuntimeEnv("PAYMENT_WEBHOOK_SECRET") || null;
}