import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getRuntimeEnv } from "@/lib/runtime-env";

// Public endpoint: always return the same response to avoid account enumeration.
// The recovery link is generated server-side and is never written to email_logs.
export const requestPasswordResetEmailFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ email: z.string().trim().email().max(254) }).parse(input),
  )
  .handler(async ({ data }) => {
    const email = data.email.trim().toLowerCase();

    try {
      // A service-role key is required to create a recovery link without exposing
      // privileged credentials to the browser. Fail closed if it is not configured.
      if (!getRuntimeEnv("SUPABASE_SERVICE_ROLE_KEY")) {
        console.error("[password-reset-email] Missing SUPABASE_SERVICE_ROLE_KEY runtime binding");
        return { ok: true };
      }

      const resendKey = getRuntimeEnv("RESEND_API_KEY");
      const emailsEnabled = (getRuntimeEnv("EMAILS_ENABLED") ?? "false").toLowerCase() === "true";
      if (!resendKey || !emailsEnabled) {
        console.error("[password-reset-email] Email provider is not enabled", {
          hasResendKey: Boolean(resendKey),
          emailsEnabled,
        });
        return { ok: true };
      }

      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { count: recentCount, error: rateLimitError } = await supabaseAdmin
        .from("email_logs")
        .select("id", { count: "exact", head: true })
        .eq("template_key", "password_reset")
        .ilike("recipient", email)
        .gte("created_at", new Date(Date.now() - 15 * 60 * 1000).toISOString());

      // Fail closed if the rate-limit check cannot be performed.
      if (rateLimitError || (recentCount ?? 0) >= 3) {
        if (rateLimitError) console.error("[password-reset-email] Rate-limit lookup failed", rateLimitError.message);
        else console.warn("[password-reset-email] Rate limit reached");
        return { ok: true };
      }

      const { data: template, error: templateError } = await supabaseAdmin
        .from("email_templates")
        .select("subject, html_body, enabled")
        .eq("template_key", "password_reset")
        .maybeSingle();
      if (templateError || !template?.enabled) {
        console.error("[password-reset-email] Password reset template unavailable", {
          queryFailed: Boolean(templateError),
          enabled: Boolean(template?.enabled),
        });
        return { ok: true };
      }

      const { data: settings, error: settingsError } = await supabaseAdmin
        .from("site_settings")
        .select("group_key, setting_key, value")
        .in("group_key", ["email", "site", "seo"]);
      if (settingsError) {
        console.error("[password-reset-email] Could not load email settings", settingsError.message);
        return { ok: true };
      }

      let senderEmail = "";
      let senderName = "TopupHut";
      let replyTo = "";
      let siteName = "TopupHut";
      let siteUrl = getRuntimeEnv("SITE_URL") || getRuntimeEnv("PUBLIC_SITE_URL") || "https://topuphut.com";

      for (const row of settings ?? []) {
        const value = row.value as Record<string, unknown>;
        if (row.group_key === "email" && row.setting_key === "senders") {
          senderEmail = typeof value.sender_email === "string" ? value.sender_email : "";
          senderName = typeof value.sender_name === "string" && value.sender_name ? value.sender_name : senderName;
          replyTo = typeof value.reply_to === "string" ? value.reply_to : "";
        }
        if (row.group_key === "site" && row.setting_key === "branding") {
          siteName = typeof value.name === "string" && value.name ? value.name : siteName;
        }
        if (row.group_key === "seo" && row.setting_key === "defaults") {
          const configuredUrl = typeof value.site_url === "string" ? value.site_url.trim() : "";
          if (configuredUrl) siteUrl = configuredUrl;
        }
      }

      if (!senderEmail) {
        console.error("[password-reset-email] Sender email is not configured");
        return { ok: true };
      }
      siteUrl = siteUrl.replace(/\/+$/, "");

      // Supabase Admin API generates recovery links directly for existing accounts.
      // For unknown accounts it returns an error; the public response remains generic.
      const { data: generated, error: generateError } = await supabaseAdmin.auth.admin.generateLink({
        type: "recovery",
        email,
        options: { redirectTo: `${siteUrl}/auth/reset` },
      });
      const actionLink = generated?.properties?.action_link;
      if (generateError || !actionLink || !generated.user?.email) {
        console.error("[password-reset-email] Supabase recovery link generation failed", {
          hasError: Boolean(generateError),
          hasActionLink: Boolean(actionLink),
          hasUserEmail: Boolean(generated?.user?.email),
          error: generateError?.message,
        });
        return { ok: true };
      }

      const { renderTemplate } = await import("./render");
      const vars = { site_name: siteName, reset_url: actionLink };
      const subject = renderTemplate(template.subject, vars);
      const html = renderTemplate(template.html_body, vars);
      const { deliverEmail } = await import("./service.server");
      const delivery = await deliverEmail({
        to: generated.user.email,
        subject,
        html,
        from: senderEmail,
        fromName: senderName,
        replyTo,
      });

      // Do not store rendered HTML or the recovery URL: it is a bearer credential.
      const { error: logError } = await supabaseAdmin.from("email_logs").insert({
        template_key: "password_reset",
        recipient: generated.user.email,
        subject,
        status: delivery.ok ? "sent" : "failed",
        provider: delivery.provider,
        error_message: delivery.error ?? null,
        payload: { reset_link_sent: delivery.ok },
        sent_at: delivery.ok ? new Date().toISOString() : null,
        attempts: 1,
      });
      if (logError) console.error("[password-reset-email] Could not write email log", logError.message);
    } catch (error) {
      // Avoid logging the email address or the generated recovery link.
      console.error("[password-reset-email] Request could not be processed", error instanceof Error ? error.message : "unknown error");
    }

    return { ok: true };
  });
