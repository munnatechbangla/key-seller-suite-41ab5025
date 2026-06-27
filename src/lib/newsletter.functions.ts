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
  .middleware([(await import("@/lib/security/csrf.server")).csrfGuard])
  .inputValidator((d: unknown) => subscribeSchema.parse(d))
  .handler(async ({ data }): Promise<SubscribeResult> => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const email = data.email.toLowerCase();
      const { data: existing } = await supabaseAdmin
        .from("newsletter_subscribers")
        .select("id, status")
        .eq("email", email)
        .maybeSingle();
      if (existing) {
        if (existing.status !== "subscribed") {
          await supabaseAdmin
            .from("newsletter_subscribers")
            .update({ status: "subscribed", unsubscribed_at: null })
            .eq("id", existing.id);
        }
        return { ok: true, already: true };
      }
      const { error } = await supabaseAdmin.from("newsletter_subscribers").insert({
        email,
        name: data.name ?? null,
        source: data.source ?? "homepage",
      });
      if (error) return { ok: false, reason: "error", message: error.message };
      return { ok: true, already: false };
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
