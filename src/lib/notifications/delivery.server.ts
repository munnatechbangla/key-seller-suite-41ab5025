// Server-only delivery adapters. Never imported from client code.
// All credentials come from `communication_settings` — no environment secret is required.
import type { NotificationChannel } from "./events";
import type { OutboundNotification, ProviderResult } from "./providers";

export type CommsSettings = {
  email_provider: "none" | "resend" | "smtp" | "ses" | "mailgun" | "postmark";
  email_provider_enabled: boolean;
  email_api_key: string | null;
  email_from_name: string | null;
  email_from_address: string | null;
  email_reply_to: string | null;
  smtp_host: string | null;
  smtp_port: number | null;
  smtp_username: string | null;
  smtp_password: string | null;
  smtp_secure: boolean;
  whatsapp_provider: "none" | "meta";
  whatsapp_provider_enabled: boolean;
  whatsapp_phone_number_id: string | null;
  whatsapp_business_account_id: string | null;
  whatsapp_access_token: string | null;
  whatsapp_verify_token: string | null;
  whatsapp_test_number: string | null;
  max_retries: number;
};

// Distinguishable outcome: `not_configured` means "hold in queue, don't count as a retry".
export type DeliveryOutcome = ProviderResult | { ok: false; not_configured: true; error: string };

function fromHeader(s: CommsSettings): string {
  const addr = s.email_from_address ?? "";
  return s.email_from_name ? `${s.email_from_name} <${addr}>` : addr;
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ---------- Email: Resend ----------
async function sendViaResend(msg: OutboundNotification, s: CommsSettings): Promise<ProviderResult> {
  if (!s.email_api_key) return { ok: false, error: "missing_setting:email_api_key" };
  if (!s.email_from_address) return { ok: false, error: "missing_setting:email_from_address" };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${s.email_api_key}`,
      },
      body: JSON.stringify({
        from: fromHeader(s),
        to: [msg.recipient],
        subject: msg.subject ?? "(no subject)",
        text: msg.body,
        html: `<pre style="font-family:inherit;white-space:pre-wrap">${escapeHtml(msg.body)}</pre>`,
        reply_to: s.email_reply_to ?? undefined,
      }),
    });
    const json = (await res.json().catch(() => ({}))) as any;
    if (!res.ok) return { ok: false, httpStatus: res.status, error: json?.message ?? `resend_${res.status}` };
    return { ok: true, providerMessageId: json?.id, httpStatus: res.status };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "resend_network_error" };
  }
}

// ---------- Email: Mailgun ----------
async function sendViaMailgun(msg: OutboundNotification, s: CommsSettings): Promise<ProviderResult> {
  if (!s.email_api_key) return { ok: false, error: "missing_setting:email_api_key" };
  const domain = (s.email_from_address ?? "").split("@")[1];
  if (!domain) return { ok: false, error: "missing_setting:email_from_address" };
  try {
    const params = new URLSearchParams({
      from: fromHeader(s),
      to: msg.recipient,
      subject: msg.subject ?? "(no subject)",
      text: msg.body,
    });
    if (s.email_reply_to) params.set("h:Reply-To", s.email_reply_to);
    const res = await fetch(`https://api.mailgun.net/v3/${domain}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`api:${s.email_api_key}`)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });
    const json = (await res.json().catch(() => ({}))) as any;
    if (!res.ok) return { ok: false, httpStatus: res.status, error: json?.message ?? `mailgun_${res.status}` };
    return { ok: true, providerMessageId: json?.id, httpStatus: res.status };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "mailgun_network_error" };
  }
}

// ---------- Email: Postmark ----------
async function sendViaPostmark(msg: OutboundNotification, s: CommsSettings): Promise<ProviderResult> {
  if (!s.email_api_key) return { ok: false, error: "missing_setting:email_api_key" };
  if (!s.email_from_address) return { ok: false, error: "missing_setting:email_from_address" };
  try {
    const res = await fetch("https://api.postmarkapp.com/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-Postmark-Server-Token": s.email_api_key,
      },
      body: JSON.stringify({
        From: fromHeader(s),
        To: msg.recipient,
        Subject: msg.subject ?? "(no subject)",
        TextBody: msg.body,
        ReplyTo: s.email_reply_to ?? undefined,
      }),
    });
    const json = (await res.json().catch(() => ({}))) as any;
    if (!res.ok) return { ok: false, httpStatus: res.status, error: json?.Message ?? `postmark_${res.status}` };
    return { ok: true, providerMessageId: json?.MessageID, httpStatus: res.status };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "postmark_network_error" };
  }
}

// ---------- Stubs — configurable now, activated in a follow-up phase. ----------
async function sendViaSmtp(_m: OutboundNotification, _s: CommsSettings): Promise<ProviderResult> {
  return { ok: false, error: "smtp_adapter_not_activated" };
}
async function sendViaSes(_m: OutboundNotification, _s: CommsSettings): Promise<ProviderResult> {
  return { ok: false, error: "ses_adapter_not_activated" };
}

// ---------- WhatsApp: Meta Cloud API ----------
async function sendViaMetaWhatsApp(msg: OutboundNotification, s: CommsSettings): Promise<ProviderResult> {
  if (!s.whatsapp_access_token || !s.whatsapp_phone_number_id) {
    return { ok: false, error: "missing_setting:whatsapp_credentials" };
  }
  try {
    const url = `https://graph.facebook.com/v20.0/${s.whatsapp_phone_number_id}/messages`;
    const payload =
      (msg.payload?.whatsapp_template as any) ?? {
        messaging_product: "whatsapp",
        to: msg.recipient,
        type: "text",
        text: { body: msg.body },
      };
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${s.whatsapp_access_token}` },
      body: JSON.stringify(payload),
    });
    const json = (await res.json().catch(() => ({}))) as any;
    if (!res.ok) return { ok: false, httpStatus: res.status, error: json?.error?.message ?? `whatsapp_${res.status}` };
    return { ok: true, providerMessageId: json?.messages?.[0]?.id, httpStatus: res.status };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "whatsapp_network_error" };
  }
}

export async function deliverNotification(
  channel: NotificationChannel,
  msg: OutboundNotification,
  s: CommsSettings,
): Promise<DeliveryOutcome> {
  if (channel === "email") {
    if (!s.email_provider_enabled || s.email_provider === "none") {
      return { ok: false, not_configured: true, error: "Provider not configured" };
    }
    switch (s.email_provider) {
      case "resend": return sendViaResend(msg, s);
      case "mailgun": return sendViaMailgun(msg, s);
      case "postmark": return sendViaPostmark(msg, s);
      case "smtp": return sendViaSmtp(msg, s);
      case "ses": return sendViaSes(msg, s);
    }
  }
  if (channel === "whatsapp") {
    if (!s.whatsapp_provider_enabled || s.whatsapp_provider === "none") {
      return { ok: false, not_configured: true, error: "Provider not configured" };
    }
    if (s.whatsapp_provider === "meta") return sendViaMetaWhatsApp(msg, s);
  }
  // SMS / push / webhook: architecture only.
  return { ok: false, not_configured: true, error: "Provider not configured" };
}
