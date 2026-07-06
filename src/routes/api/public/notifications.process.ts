// Queue worker HTTP endpoint. Auth: Supabase publishable key in `apikey` header.
import { createFileRoute } from "@tanstack/react-router";

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
          const { processNotificationQueue } = await import("@/lib/notifications/worker.server");
          const result = await processNotificationQueue();
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
