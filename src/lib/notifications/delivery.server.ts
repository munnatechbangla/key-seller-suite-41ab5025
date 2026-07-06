// Server-only real delivery adapters. Never imported from client code.
import type { NotificationChannel } from "./events";
import type { OutboundNotification, ProviderResult } from "./providers";

export type CommsSettings = {
  email_provider: "resend" | "smtp" | "none";
  email_from_name: string | null;
  email_from_address: string | null;
  email_reply_to: string | null;
  smtp_host: string | null;
  smtp_port: number | null;
  smtp_username: string | null;
  smtp_password: string | null;
  smtp_secure: boolean;
  whatsapp_provider: "meta" | "none";
  whatsapp_phone_number_id: string | null;
  whatsapp_business_account_id: string | null;
  whatsapp_access_token: string | null;
  whatsapp_verify_token: string | null;
  whatsapp_test_number: string | null;
  max_retries: number;
};

function fromHeader(s: CommsSettings): string {
  const addr = s.email_from_address ?? "";
  return s.email_from_name ? `${s.email_from_name} <${addr}>` : addr;
}

// ---------- Email: Resend ----------
async function sendViaResend(
  msg: OutboundNotification,
  s: CommsSettings,
): Promise<ProviderResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, error: "missing_secret:RESEND_API_KEY" };
  if (!s.email_from_address) return { ok: false, error: "missing_setting:email_from_address" };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
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
    if (!res.ok) {
      return { ok: false, httpStatus: res.status, error: json?.message ?? `resend_${res.status}` };
    }
    return { ok: true, providerMessageId: json?.id, httpStatus: res.status };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "resend_network_error" };
  }
}

// ---------- Email: SMTP (architecture stub — activate via a follow-up phase) ----------
async function sendViaSmtp(_msg: OutboundNotification, _s: CommsSettings): Promise<ProviderResult> {
  return { ok: false, error: "smtp_adapter_not_activated" };
}

// ---------- WhatsApp: Meta Cloud API ----------
async function sendViaMetaWhatsApp(
  msg: OutboundNotification,
  s: CommsSettings,
): Promise<ProviderResult> {
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
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${s.whatsapp_access_token}`,
      },
      body: JSON.stringify(payload),
    });
    const json = (await res.json().catch(() => ({}))) as any;
    if (!res.ok) {
      const err = json?.error?.message ?? `whatsapp_${res.status}`;
      return { ok: false, httpStatus: res.status, error: err };
    }
    return {
      ok: true,
      providerMessageId: json?.messages?.[0]?.id,
      httpStatus: res.status,
    };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "whatsapp_network_error" };
  }
}

export async function deliverNotification(
  channel: NotificationChannel,
  msg: OutboundNotification,
  s: CommsSettings,
): Promise<ProviderResult> {
  if (channel === "email") {
    if (s.email_provider === "resend") return sendViaResend(msg, s);
    if (s.email_provider === "smtp") return sendViaSmtp(msg, s);
    return { ok: false, error: "email_provider_disabled" };
  }
  if (channel === "whatsapp") {
    if (s.whatsapp_provider === "meta") return sendViaMetaWhatsApp(msg, s);
    return { ok: false, error: "whatsapp_provider_disabled" };
  }
  return { ok: false, error: `channel_not_activated:${channel}` };
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
