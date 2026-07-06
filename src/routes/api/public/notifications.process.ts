// Queue worker — invoked by pg_cron every minute (and manually by admins).
// Auth: caller must present the Supabase publishable key as the `apikey` header.
// - Providers not configured: row stays `pending` with an informational
//   `last_error` and retry_count is NOT incremented — the moment an admin
//   configures the provider, delivery starts on the next cron tick.
// - Real provider failures: exponential backoff up to `max_retries`, then
//   the row is marked `failed` (dead queue) and no longer retried.
import { createFileRoute } from "@tanstack/react-router";
import { renderTemplate } from "@/lib/notifications/events";

const BATCH_SIZE = 25;

async function processQueue() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { deliverNotification } = await import("@/lib/notifications/delivery.server");

  const { data: settings } = await supabaseAdmin
    .from("communication_settings" as any)
    .select("*")
    .eq("id", "default")
    .maybeSingle();
  if (!settings) return { processed: 0, error: "no_settings" };
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
  if (rows.length === 0) return { processed: 0 };

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
      // Hold in queue; try again next cron tick once provider is configured.
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
    const nextRetry = (row.retry_count ?? 0) + 1;
    const dead = nextRetry >= maxRetries;
    const backoffMs = Math.min(60_000 * Math.pow(2, nextRetry), 3_600_000);
    await supabaseAdmin
      .from("notification_queue" as any)
      .update({
        retry_count: nextRetry,
        last_error: `[${(res as any).httpStatus ?? "-"}] ${res.error}`,
        status: dead ? "failed" : "pending",
        scheduled_at: dead ? row.scheduled_at : new Date(Date.now() + backoffMs).toISOString(),
      })
      .eq("id", row.id);
  }

  return { processed: rows.length, sent, failed, deferred };
}

export const Route = createFileRoute("/api/public/notifications/process")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apikey = request.headers.get("apikey") ?? request.headers.get("x-api-key");
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY;
        if (!apikey || !expected || apikey !== expected) {
          return new Response(JSON.stringify({ error: "unauthorized" }), {
            status: 401, headers: { "content-type": "application/json" },
          });
        }
        try {
          const result = await processQueue();
          return new Response(JSON.stringify({ ok: true, ...result }), {
            headers: { "content-type": "application/json" },
          });
        } catch (e: any) {
          return new Response(JSON.stringify({ ok: false, error: e?.message ?? "error" }), {
            status: 500, headers: { "content-type": "application/json" },
          });
        }
      },
    },
  },
});
