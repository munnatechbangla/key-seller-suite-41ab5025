// Admin server functions for Communication Settings + test sends + manual worker run.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data, error } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
}

const PUBLIC_FIELDS = [
  "id",
  "email_provider",
  "email_from_name",
  "email_from_address",
  "email_reply_to",
  "smtp_host",
  "smtp_port",
  "smtp_username",
  "smtp_secure",
  "whatsapp_provider",
  "whatsapp_phone_number_id",
  "whatsapp_business_account_id",
  "whatsapp_verify_token",
  "whatsapp_test_number",
  "max_retries",
  "updated_at",
].join(",");

export const getCommunicationSettingsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await (context.supabase as any)
      .from("communication_settings")
      .select(PUBLIC_FIELDS)
      .eq("id", "default")
      .maybeSingle();
    if (error) throw new Error(error.message);
    // Also expose whether secrets are present without leaking values.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: secretRow } = await supabaseAdmin
      .from("communication_settings" as any)
      .select("smtp_password,whatsapp_access_token")
      .eq("id", "default")
      .maybeSingle();
    return {
      ...(data ?? {}),
      has_smtp_password: !!(secretRow as any)?.smtp_password,
      has_whatsapp_access_token: !!(secretRow as any)?.whatsapp_access_token,
      has_resend_api_key: !!process.env.RESEND_API_KEY,
    };
  });

const settingsInput = z.object({
  email_provider: z.enum(["resend", "smtp", "none"]).optional(),
  email_from_name: z.string().nullable().optional(),
  email_from_address: z.string().email().nullable().optional(),
  email_reply_to: z.string().email().nullable().optional(),
  smtp_host: z.string().nullable().optional(),
  smtp_port: z.number().int().nullable().optional(),
  smtp_username: z.string().nullable().optional(),
  smtp_password: z.string().nullable().optional(),
  smtp_secure: z.boolean().optional(),
  whatsapp_provider: z.enum(["meta", "none"]).optional(),
  whatsapp_phone_number_id: z.string().nullable().optional(),
  whatsapp_business_account_id: z.string().nullable().optional(),
  whatsapp_access_token: z.string().nullable().optional(),
  whatsapp_verify_token: z.string().nullable().optional(),
  whatsapp_test_number: z.string().nullable().optional(),
  max_retries: z.number().int().min(1).max(10).optional(),
});

export const updateCommunicationSettingsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => settingsInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    // Strip empty string secrets so we don't overwrite existing values with blanks.
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(data)) {
      if (v === undefined) continue;
      if ((k === "smtp_password" || k === "whatsapp_access_token") && v === "") continue;
      clean[k] = v;
    }
    const { error } = await (context.supabase as any)
      .from("communication_settings")
      .update(clean)
      .eq("id", "default");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Test sends ----------
export const sendTestEmailFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        to: z.string().email(),
        subject: z.string().default("Test email from your store"),
        body: z.string().default("This is a test email sent from the notification engine."),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: s } = await supabaseAdmin
      .from("communication_settings" as any)
      .select("*")
      .eq("id", "default")
      .maybeSingle();
    if (!s) throw new Error("Settings not initialized");
    const { deliverNotification } = await import("@/lib/notifications/delivery.server");
    const res = await deliverNotification(
      "email",
      { channel: "email", recipient: data.to, subject: data.subject, body: data.body },
      s as any,
    );
    return res;
  });

export const sendTestWhatsAppFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        to: z.string().min(5),
        body: z.string().default("Test WhatsApp message from your store."),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: s } = await supabaseAdmin
      .from("communication_settings" as any)
      .select("*")
      .eq("id", "default")
      .maybeSingle();
    if (!s) throw new Error("Settings not initialized");
    const { deliverNotification } = await import("@/lib/notifications/delivery.server");
    const res = await deliverNotification(
      "whatsapp",
      { channel: "whatsapp", recipient: data.to, body: data.body },
      s as any,
    );
    return res;
  });

// ---------- Manual worker run (admin) ----------
export const runNotificationQueueOnceFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const url = `${process.env.SUPABASE_URL ? "" : ""}`;
    void url;
    // Directly invoke the same processing logic instead of round-tripping HTTP.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { deliverNotification } = await import("@/lib/notifications/delivery.server");
    const { renderTemplate } = await import("@/lib/notifications/events");
    const { data: settings } = await supabaseAdmin
      .from("communication_settings" as any)
      .select("*")
      .eq("id", "default")
      .maybeSingle();
    if (!settings) return { processed: 0, error: "no_settings" };
    const maxRetries = (settings as any).max_retries ?? 3;
    const nowIso = new Date().toISOString();
    const { data: batch } = await supabaseAdmin
      .from("notification_queue" as any)
      .select("*")
      .eq("status", "pending")
      .lte("scheduled_at", nowIso)
      .order("scheduled_at", { ascending: true })
      .limit(25);
    const rows = (batch ?? []) as any[];
    if (rows.length === 0) return { processed: 0 };
    await supabaseAdmin
      .from("notification_queue" as any)
      .update({ status: "processing" })
      .in(
        "id",
        rows.map((r) => r.id),
      );
    let sent = 0;
    let failed = 0;
    for (const row of rows) {
      const payload = row.payload_json ?? {};
      const subj = row.rendered_subject
        ? renderTemplate(row.rendered_subject, payload)
        : row.rendered_subject;
      const body = row.rendered_body ? renderTemplate(row.rendered_body, payload) : "";
      const res = await deliverNotification(
        row.channel,
        { channel: row.channel, recipient: row.recipient, subject: subj, body, payload },
        settings as any,
      );
      if (res.ok) {
        sent++;
        await supabaseAdmin
          .from("notification_queue" as any)
          .update({ status: "sent", sent_at: new Date().toISOString(), last_error: null })
          .eq("id", row.id);
      } else {
        failed++;
        const nextRetry = (row.retry_count ?? 0) + 1;
        const dead = nextRetry >= maxRetries;
        const backoffMs = Math.min(60_000 * Math.pow(2, nextRetry), 3_600_000);
        await supabaseAdmin
          .from("notification_queue" as any)
          .update({
            retry_count: nextRetry,
            last_error: `[${res.httpStatus ?? "-"}] ${res.error}`,
            status: dead ? "failed" : "pending",
            scheduled_at: dead
              ? row.scheduled_at
              : new Date(Date.now() + backoffMs).toISOString(),
          })
          .eq("id", row.id);
      }
    }
    return { processed: rows.length, sent, failed };
  });
