import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import { getRuntimeEnv } from "@/lib/runtime-env";

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
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
    return fetch(input, { ...init, headers });
  };
}

export function createServerSupabaseClient(accessToken?: string | null) {
  const SUPABASE_URL = getRuntimeEnv("SUPABASE_URL");
  const SUPABASE_PUBLISHABLE_KEY = getRuntimeEnv("SUPABASE_PUBLISHABLE_KEY");

  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    const missing = [
      ...(!SUPABASE_URL ? ["SUPABASE_URL"] : []),
      ...(!SUPABASE_PUBLISHABLE_KEY ? ["SUPABASE_PUBLISHABLE_KEY"] : []),
    ];
    throw new Error(`Missing Supabase environment variable(s): ${missing.join(", ")}.`);
  }

  const globalOptions: { fetch: typeof fetch; headers?: Record<string, string> } = {
    fetch: createSupabaseFetch(SUPABASE_PUBLISHABLE_KEY),
  };

  // Propagate the caller's JWT to PostgREST so auth.uid() resolves inside
  // SECURITY DEFINER RPCs. Must be set at construction time — mutating
  // `sb.rest.headers` after the fact does NOT reach PostgREST.
  if (accessToken && accessToken.split(".").length === 3) {
    globalOptions.headers = { Authorization: `Bearer ${accessToken}` };
  }

  return createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: globalOptions,
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

export function paymentRpcSecret(): string | null {
  return getRuntimeEnv("PAYMENTS_WEBHOOK_SECRET") || getRuntimeEnv("PAYMENT_WEBHOOK_SECRET") || null;
}
