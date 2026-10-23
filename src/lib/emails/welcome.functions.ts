import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Uses the authenticated user's identity; the client cannot choose a recipient.
export const ensureWelcomeEmailFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.auth.getUser();
    if (error || !data.user?.email) throw new Error("Unable to verify account email");

    const email = data.user.email.trim();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: previous, error: lookupError } = await supabaseAdmin
      .from("email_logs")
      .select("id, status")
      .eq("template_key", "welcome")
      .ilike("recipient", email)
      .in("status", ["sent", "pending"])
      .limit(1)
      .maybeSingle();
    if (lookupError) throw lookupError;
    if (previous) return { ok: true, alreadyQueuedOrSent: true };

    const metadata = (data.user.user_metadata ?? {}) as Record<string, unknown>;
    const name =
      (typeof metadata.full_name === "string" && metadata.full_name.trim()) ||
      (typeof metadata.name === "string" && metadata.name.trim()) ||
      email.split("@")[0] ||
      "there";
    const { sendWelcomeEmail } = await import("./triggers.server");
    const result = await sendWelcomeEmail(email, name);
    return { ok: true, alreadyQueuedOrSent: false, delivery: result };
  });
