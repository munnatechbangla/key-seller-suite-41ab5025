// Email queue + dispatcher. Sender domain is NOT bound to topuphut.com.
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
      payload: args.vars ?? {},
    });
    return { ok: false, reason: "template_not_found" };
  }
  if (!tpl.enabled) {
    return { ok: true, skipped: "template_disabled" as const };
  }
  const sender = await loadSenderSettings();
  const vars = { site_name: sender.site_name ?? "Marketplace", ...(args.vars ?? {}) };
  const subject = args.subject ?? renderTemplate(tpl.subject, vars);
  const html = renderTemplate(tpl.html_body, vars);

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
    payload: vars,
    error_message: sendingEnabled ? null : "dev_mode_no_sender_domain",
  });
  return { ok: true, status };
}

// Process pending queue. Hook a real provider (Resend/SES/SMTP) here later;
// for now, simulate success so the lifecycle is exercised in dev.
export async function processPendingEmails(limit = 25) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const sender = await loadSenderSettings();
  const sendingEnabled =
    !!sender.sender_email &&
    (process.env.EMAILS_ENABLED ?? "false").toLowerCase() === "true";
  if (!sendingEnabled) return { processed: 0, reason: "dev_mode" };

  const { data: rows } = await supabaseAdmin
    .from("email_logs")
    .select("id, attempts, max_attempts")
    .eq("status", "pending")
    .lte("attempts", 5)
    .order("created_at", { ascending: true })
    .limit(limit);
  let ok = 0;
  for (const r of rows ?? []) {
    // TODO: integrate real provider. For now mark sent.
    const { error } = await supabaseAdmin
      .from("email_logs")
      .update({
        status: "sent",
        attempts: r.attempts + 1,
        sent_at: new Date().toISOString(),
        provider: "stub",
      })
      .eq("id", r.id);
    if (!error) ok++;
  }
  return { processed: ok };
}

export async function retryEmail(id: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin
    .from("email_logs")
    .update({ status: "pending", error_message: null, next_retry_at: null })
    .eq("id", id);
  return { ok: true };
}
