import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { csrfGuard } from "@/lib/security/csrf.server";


const subscribeSchema = z.object({
  email: z.string().trim().email().max(254),
  name: z.string().trim().max(120).optional(),
  source: z.string().trim().max(60).optional(),
});

export type SubscribeResult =
  | { ok: true; already: boolean }
  | { ok: false; reason: "invalid" | "rate_limited" | "error"; message: string };

export const subscribeNewsletterFn = createServerFn({ method: "POST" })
  .middleware([csrfGuard])
  .inputValidator((d: unknown) => subscribeSchema.parse(d))
  .handler(async ({ data }): Promise<SubscribeResult> => {
    try {
      const { createServerSupabaseClient } = await import("@/integrations/supabase/server-client");
      const sb: any = createServerSupabaseClient();
      const { data: result, error } = await sb.rpc("subscribe_newsletter", {
        _email: data.email.toLowerCase(),
        _name: data.name ?? null,
        _source: data.source ?? "homepage",
      });
      if (error) return { ok: false, reason: "error", message: error.message };
      const r = result as { ok: boolean; already?: boolean; reason?: string } | null;
      if (!r?.ok) return { ok: false, reason: "error", message: r?.reason ?? "unknown" };
      return { ok: true, already: Boolean(r.already) };
    } catch (e) {
      return { ok: false, reason: "error", message: e instanceof Error ? e.message : "Unknown error" };
    }
  });

export const adminListSubscribersFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("newsletter_subscribers")
      .select("id, email, name, source, status, created_at, confirmed_at, unsubscribed_at")
      .order("created_at", { ascending: false })
      .limit(2000);
    if (error) throw new Error(error.message);
    return { items: data ?? [] };
  });
