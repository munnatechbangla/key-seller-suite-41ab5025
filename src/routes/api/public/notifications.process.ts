// Queue worker — invoked by pg_cron every minute (and manually from admin UI).
// Auth: caller must present the Supabase publishable key as `apikey` header.
// This endpoint pulls a batch of pending notifications, delivers via the
// configured provider, and retries with exponential-ish backoff up to max_retries.
import { createFileRoute } from "@tanstack/react-router";
import { renderTemplate } from "@/lib/notifications/events";

const BATCH_SIZE = 25;

async function processQueue() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { deliverNotification } = await import("@/lib/notifications/delivery.server");

  const { data: settingsRow } = await supabaseAdmin
    .from("communication_settings" as any)
    .select("*")
    .eq("id", "default")
    .maybeSingle();
  const settings = settingsRow as any;
  if (!settings) return { processed: 0, error: "no_settings" };
  const maxRetries: number = settings.max_retries ?? 3;

  // Claim a batch atomically-ish: pick pending rows scheduled now, mark processing.
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

  const ids = rows.map((r) => r.id);
  await supabaseAdmin
    .from("notification_queue" as any)
    .update({ status: "processing" })
    .in("id", ids);

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
      {
        channel: row.channel,
        recipient: row.recipient,
        subject: subj,
        body,
        payload,
      },
      settings,
    );
    if (res.ok) {
      sent++;
      await supabaseAdmin
        .from("notification_queue" as any)
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          last_error: null,
        })
        .eq("id", row.id);
    } else {
      failed++;
      const nextRetry = (row.retry_count ?? 0) + 1;
      const dead = nextRetry >= maxRetries;
      const backoffMs = Math.min(1000 * 60 * Math.pow(2, nextRetry), 1000 * 60 * 60);
      const patch: Record<string, unknown> = {
        retry_count: nextRetry,
        last_error: `[${res.httpStatus ?? "-"}] ${res.error}`,
      };
      if (dead) {
        patch.status = "failed";
      } else {
        patch.status = "pending";
        patch.scheduled_at = new Date(Date.now() + backoffMs).toISOString();
      }
      await supabaseAdmin.from("notification_queue" as any).update(patch).eq("id", row.id);
    }
  }
  return { processed: rows.length, sent, failed };
}

export const Route = createFileRoute("/api/public/notifications/process")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apikey = request.headers.get("apikey") ?? request.headers.get("x-api-key");
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY;
        if (!apikey || !expected || apikey !== expected) {
          return new Response(JSON.stringify({ error: "unauthorized" }), {
            status: 401,
            headers: { "content-type": "application/json" },
          });
        }
        try {
          const result = await processQueue();
          return new Response(JSON.stringify({ ok: true, ...result }), {
            headers: { "content-type": "application/json" },
          });
        } catch (e: any) {
          return new Response(JSON.stringify({ ok: false, error: e?.message ?? "error" }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }
      },
    },
  },
});
