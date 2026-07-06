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
  "email_provider_enabled",
  "email_from_name",
  "email_from_address",
  "email_reply_to",
  "smtp_host",
  "smtp_port",
  "smtp_username",
  "smtp_secure",
  "whatsapp_provider",
  "whatsapp_provider_enabled",
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
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: secretRow } = await supabaseAdmin
      .from("communication_settings" as any)
      .select("email_api_key,smtp_password,whatsapp_access_token")
      .eq("id", "default")
      .maybeSingle();
    return {
      ...(data ?? {}),
      has_email_api_key: !!(secretRow as any)?.email_api_key,
      has_smtp_password: !!(secretRow as any)?.smtp_password,
      has_whatsapp_access_token: !!(secretRow as any)?.whatsapp_access_token,
    };
  });

const settingsInput = z.object({
  email_provider: z.enum(["none", "resend", "smtp", "ses", "mailgun", "postmark"]).optional(),
  email_provider_enabled: z.boolean().optional(),
  email_api_key: z.string().nullable().optional(),
  email_from_name: z.string().nullable().optional(),
  email_from_address: z.string().email().nullable().optional().or(z.literal("")),
  email_reply_to: z.string().email().nullable().optional().or(z.literal("")),
  smtp_host: z.string().nullable().optional(),
  smtp_port: z.number().int().nullable().optional(),
  smtp_username: z.string().nullable().optional(),
  smtp_password: z.string().nullable().optional(),
  smtp_secure: z.boolean().optional(),
  whatsapp_provider: z.enum(["none", "meta"]).optional(),
  whatsapp_provider_enabled: z.boolean().optional(),
  whatsapp_phone_number_id: z.string().nullable().optional(),
  whatsapp_business_account_id: z.string().nullable().optional(),
  whatsapp_access_token: z.string().nullable().optional(),
  whatsapp_verify_token: z.string().nullable().optional(),
  whatsapp_test_number: z.string().nullable().optional(),
  max_retries: z.number().int().min(1).max(10).optional(),
});

const SECRET_FIELDS = new Set(["email_api_key", "smtp_password", "whatsapp_access_token"]);

export const updateCommunicationSettingsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => settingsInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(data)) {
      if (v === undefined) continue;
      // Empty strings shouldn't overwrite stored secrets, and empty email fields become null.
      if (SECRET_FIELDS.has(k) && v === "") continue;
      if (v === "") { clean[k] = null; continue; }
      clean[k] = v;
    }
    const { error } = await (context.supabase as any)
      .from("communication_settings")
      .update(clean)
      .eq("id", "default");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

async function loadSettings() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("communication_settings" as any)
    .select("*")
    .eq("id", "default")
    .maybeSingle();
  if (!data) throw new Error("Settings not initialized");
  return data as any;
}

export const sendTestEmailFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      to: z.string().email(),
      subject: z.string().default("Test email from your store"),
      body: z.string().default("This is a test email sent from the notification engine."),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const s = await loadSettings();
    const { deliverNotification } = await import("@/lib/notifications/delivery.server");
    return deliverNotification(
      "email",
      { channel: "email", recipient: data.to, subject: data.subject, body: data.body },
      s,
    );
  });

export const sendTestWhatsAppFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      to: z.string().min(5),
      body: z.string().default("Test WhatsApp message from your store."),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const s = await loadSettings();
    const { deliverNotification } = await import("@/lib/notifications/delivery.server");
    return deliverNotification(
      "whatsapp",
      { channel: "whatsapp", recipient: data.to, body: data.body },
      s,
    );
  });

export const runNotificationQueueOnceFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { processNotificationQueue } = await import("@/lib/notifications/worker.server");
    return processNotificationQueue();
  });
