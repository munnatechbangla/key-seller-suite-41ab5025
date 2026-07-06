// Shared queue processor. Called by the cron worker route and by the admin "Run once" action.
import { renderTemplate } from "@/lib/notifications/events";
import { deliverNotification } from "@/lib/notifications/delivery.server";

const BATCH_SIZE = 25;

export async function processNotificationQueue() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: settings } = await supabaseAdmin
    .from("communication_settings" as any)
    .select("*")
    .eq("id", "default")
    .maybeSingle();
  if (!settings) return { processed: 0, error: "no_settings" as const };
  const maxRetries: number = (settings as any).max_retries ?? 3;

  const nowIso = new Date().toISOString();
  const { data: batch } = await supabaseAdmin
    .from("notification_queue" as any)
    .select("*")
    .eq("status", "pending")
    .lte("scheduled_at", nowIso)
    .order("scheduled_at", { ascending: true })
    .limit(BATCH_SIZE);

  const rows = (batch ?? []) as any[];
  if (rows.length === 0) return { processed: 0, sent: 0, failed: 0, deferred: 0 };

  await supabaseAdmin
    .from("notification_queue" as any)
    .update({ status: "processing" })
    .in("id", rows.map((r) => r.id));

  let sent = 0, failed = 0, deferred = 0;
  for (const row of rows) {
    const payload = row.payload_json ?? {};
    const subj = row.rendered_subject ? renderTemplate(row.rendered_subject, payload) : row.rendered_subject;
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
      continue;
    }

    if ("not_configured" in res && res.not_configured) {
      deferred++;
      await supabaseAdmin
        .from("notification_queue" as any)
        .update({
          status: "pending",
          last_error: "Provider not configured",
          scheduled_at: new Date(Date.now() + 60_000).toISOString(),
        })
        .eq("id", row.id);
      continue;
    }

    failed++;
    const httpStatus = "httpStatus" in res ? res.httpStatus : undefined;
    const nextRetry = (row.retry_count ?? 0) + 1;
    const dead = nextRetry >= maxRetries;
    const backoffMs = Math.min(60_000 * Math.pow(2, nextRetry), 3_600_000);
    await supabaseAdmin
      .from("notification_queue" as any)
      .update({
        retry_count: nextRetry,
        last_error: `[${httpStatus ?? "-"}] ${res.error}`,
        status: dead ? "failed" : "pending",
        scheduled_at: dead ? row.scheduled_at : new Date(Date.now() + backoffMs).toISOString(),
      })
      .eq("id", row.id);
  }

  return { processed: rows.length, sent, failed, deferred };
}
