// Email queue + dispatcher. Sender domain is configured per-tenant via site_settings.
// The system runs in "development mode" until site_settings.email.sender_email
// is configured AND EMAILS_ENABLED=true is set as a runtime env var.
// Until then, emails are queued and logged with status='skipped' (or 'pending'
// if you want to replay them later after configuring a sender domain).
import { renderTemplate } from "./render";

type EnqueueArgs = {
  templateKey: string;
  recipient: string;
  vars?: Record<string, unknown>;
  // override the rendered subject (optional)
  subject?: string;
};

async function loadSenderSettings() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("site_settings")
    .select("group_key, setting_key, value")
    .in("group_key", ["email", "site"]);
  const out: {
    sender_name?: string;
    sender_email?: string;
    reply_to?: string;
    support_email?: string;
    site_name?: string;
    site_url?: string;
  } = {};
  for (const row of data ?? []) {
    const v = row.value as Record<string, unknown>;
    if (row.group_key === "email" && row.setting_key === "senders") {
      out.sender_name = v.sender_name as string;
      out.sender_email = v.sender_email as string;
      out.reply_to = v.reply_to as string;
      out.support_email = v.support_email as string;
    } else if (row.group_key === "site" && row.setting_key === "branding") {
      out.site_name = v.name as string;
    }
  }
  return out;
}

export async function getEmailSystemStatus() {
  const sender = await loadSenderSettings();
  const hasProvider = !!process.env.RESEND_API_KEY;
  const enabledFlag = (process.env.EMAILS_ENABLED ?? "false").toLowerCase() === "true";
  const hasSender = !!sender.sender_email;
  const sendingEnabled = hasProvider && hasSender && enabledFlag;
  const issues: string[] = [];
  if (!hasProvider) issues.push("RESEND_API_KEY is not set — add it as an environment variable.");
  if (!hasSender) issues.push("No sender email configured — set it in Settings → Email.");
  if (!enabledFlag) issues.push("EMAILS_ENABLED is not 'true' — emails are queued but not delivered.");
  return {
    sendingEnabled,
    devMode: !sendingEnabled,
    hasProvider,
    hasSender,
    enabledFlag,
    provider: hasProvider ? "resend" : "none",
    senderEmail: sender.sender_email ?? null,
    senderName: sender.sender_name ?? null,
    issues,
  };
}

export async function enqueueEmail(args: EnqueueArgs) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: tpl } = await supabaseAdmin
    .from("email_templates")
    .select("subject, html_body, enabled")
    .eq("template_key", args.templateKey)
    .maybeSingle();
  if (!tpl) {
    await supabaseAdmin.from("email_logs").insert({
      template_key: args.templateKey,
      recipient: args.recipient,
      subject: args.subject ?? args.templateKey,
      status: "failed",
      error_message: "template_not_found",
      payload: (args.vars ?? {}) as any,
    });
    return { ok: false, reason: "template_not_found" };
  }
  if (!tpl.enabled) {
    return { ok: true, skipped: "template_disabled" as const };
  }
  const sender = await loadSenderSettings();
  const vars = { site_name: sender.site_name ?? "Marketplace", ...(args.vars ?? {}) };
  const subject = args.subject ?? renderTemplate(tpl.subject || "", vars);
  const html = renderTemplate(tpl.html_body || "", vars);

  // Dev mode: no sender domain configured OR sending not enabled globally.
  const sendingEnabled =
    !!sender.sender_email &&
    (process.env.EMAILS_ENABLED ?? "false").toLowerCase() === "true";

  const status = sendingEnabled ? "pending" : "skipped";
  await supabaseAdmin.from("email_logs").insert({
    template_key: args.templateKey,
    recipient: args.recipient,
    subject,
    status,
    rendered_html: html,
    payload: vars as any,
    error_message: sendingEnabled ? null : "dev_mode_no_sender_domain",
  });
  return { ok: true, status };
}

// Process pending queue. Picks provider based on env: Resend if RESEND_API_KEY
// is set; SMTP placeholder otherwise (not implemented in the Worker runtime).
export async function processPendingEmails(limit = 25) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const sender = await loadSenderSettings();
  const sendingEnabled =
    !!sender.sender_email &&
    (process.env.EMAILS_ENABLED ?? "false").toLowerCase() === "true";
  if (!sendingEnabled) return { processed: 0, reason: "dev_mode" };

  const { data: rows } = await supabaseAdmin
    .from("email_logs")
    .select("id, attempts, recipient, subject, rendered_html")
    .eq("status", "pending")
    .lte("attempts", 5)
    .order("created_at", { ascending: true })
    .limit(limit);

  let ok = 0;
  for (const r of rows ?? []) {
    const result = await deliverEmail({
      to: r.recipient!,
      subject: r.subject ?? "Email Notification",
      html: r.rendered_html ?? "",
      from: sender.sender_email!,
      fromName: (sender.sender_name ?? sender.site_name ?? "Marketplace")!,
      replyTo: sender.reply_to ?? undefined,
    });
    const currentAttempts = r.attempts ?? 0;
    if (result.ok) {
      await supabaseAdmin
        .from("email_logs")
        .update({
          status: "sent",
          attempts: currentAttempts + 1,
          sent_at: new Date().toISOString(),
          provider: result.provider,
        })
        .eq("id", r.id);
      ok++;
    } else {
      await supabaseAdmin
        .from("email_logs")
        .update({
          status: currentAttempts + 1 >= 5 ? "failed" : "pending",
          attempts: currentAttempts + 1,
          error_message: result.error,
          provider: result.provider,
        })
        .eq("id", r.id);
    }
  }
  return { processed: ok };
}

type DeliverArgs = {
  to: string;
  subject: string;
  html: string;
  from: string;
  fromName: string;
  replyTo?: string;
};

export async function deliverEmail(
  args: DeliverArgs,
): Promise<{ ok: boolean; provider: string; error?: string }> {
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: `${args.fromName} <${args.from}>`,
          to: [args.to],
          subject: args.subject,
          html: args.html,
          reply_to: args.replyTo || undefined,
        }),
      });
      if (!res.ok) {
        const txt = await res.text();
        return { ok: false, provider: "resend", error: `resend_${res.status}: ${txt.slice(0, 200)}` };
      }
      return { ok: true, provider: "resend" };
    } catch (e: any) {
      return { ok: false, provider: "resend", error: e?.message ?? "resend_error" };
    }
  }
  // SMTP not supported in Worker runtime — return informative error so admin sees it.
  return { ok: false, provider: "none", error: "no_provider_configured (set RESEND_API_KEY)" };
}

export async function retryEmail(id: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin
    .from("email_logs")
    .update({ status: "pending", error_message: null } as any)
    .eq("id", id);
  return { ok: true };
}
