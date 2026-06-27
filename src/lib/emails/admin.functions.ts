import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data, error } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "admin",
  });
  if (error || !data) throw new Error("Forbidden");
}

export const adminGetEmailStatusFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { getEmailSystemStatus } = await import("./service.server");
    return getEmailSystemStatus();
  });

export const adminListEmailLogsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ status: z.string().optional(), limit: z.number().int().min(1).max(500).default(100) }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    let q = context.supabase
      .from("email_logs")
      .select("id, template_key, recipient, subject, status, attempts, error_message, sent_at, created_at")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.status) q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw error;
    return rows ?? [];
  });

export const adminListEmailTemplatesFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await context.supabase
      .from("email_templates")
      .select("*")
      .order("template_key");
    if (error) throw error;
    return data ?? [];
  });

const upsertSchema = z.object({
  id: z.string().uuid().optional(),
  template_key: z.string().min(1),
  name: z.string().min(1),
  subject: z.string().min(1),
  html_body: z.string().min(1),
  text_body: z.string().optional().nullable(),
  enabled: z.boolean().default(true),
});

export const adminUpsertEmailTemplateFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => upsertSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase
      .from("email_templates")
      .upsert(data, { onConflict: "template_key" });
    if (error) throw error;
    return { ok: true };
  });

export const adminRetryEmailFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { retryEmail } = await import("./service.server");
    return retryEmail(data.id);
  });

export const adminProcessQueueFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { processPendingEmails } = await import("./service.server");
    return processPendingEmails(50);
  });

export const adminSendTestEmailFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ recipient: z.string().email() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: settingsRow } = await supabaseAdmin
      .from("site_settings")
      .select("value")
      .eq("group_key", "email")
      .eq("setting_key", "senders")
      .maybeSingle();
    const s = (settingsRow?.value ?? {}) as Record<string, string>;
    if (!s.sender_email) {
      return { ok: false, error: "Configure sender email in Settings → Email first." };
    }
    const provider = process.env.RESEND_API_KEY ? "resend" : "none";
    if (provider === "none") {
      return { ok: false, error: "No provider configured. Add RESEND_API_KEY to send real emails." };
    }
    const { deliverEmail } = await import("./service.server");
    const result = await deliverEmail({
      to: data.recipient,
      subject: "Test email from your marketplace",
      html: `<p>This is a test email confirming your email transport is working.</p><p>Provider: <b>${provider}</b></p>`,
      from: s.sender_email,
      fromName: s.sender_name ?? "Marketplace",
      replyTo: s.reply_to,
    });
    await supabaseAdmin.from("email_logs").insert({
      template_key: "test_email",
      recipient: data.recipient,
      subject: "Test email from your marketplace",
      status: result.ok ? "sent" : "failed",
      provider: result.provider,
      error_message: result.error ?? null,
      sent_at: result.ok ? new Date().toISOString() : null,
    });
    return result;
  });
