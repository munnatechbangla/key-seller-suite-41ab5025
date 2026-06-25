// Generic webhook receiver for "custom_auto" gateways. The slug in the URL
// identifies the gateway row; signature verification and payload parsing are
// driven entirely from payment_gateways.config.webhook.
//
// External services POST to:
//   /api/public/payments/custom-webhook/{gateway_slug}
//
// Replay protection: webhook_events (gateway, event_id) is unique.

import { createFileRoute } from "@tanstack/react-router";
import { logPaymentEvent, claimWebhookEvent } from "@/lib/payments/logger.server";

export const Route = createFileRoute("/api/public/payments/custom-webhook/$slug")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const slug = params.slug;
        const raw = await request.text();
        const ip = request.headers.get("x-forwarded-for") || null;

        const {
          verifyWebhookSignature, extractWebhookEventId, extractTransactionId,
          extractOrderNumber, extractStatus,
        } = await import("@/lib/payments/custom-auto.server");
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: gw, error: gwErr } = await supabaseAdmin
          .from("payment_gateways")
          .select("id, slug, type, is_enabled, config")
          .eq("slug", slug)
          .maybeSingle();
        if (gwErr || !gw) {
          return json({ ok: false, error: "gateway_not_found" }, 404);
        }
        if (gw.type !== "custom_auto") {
          return json({ ok: false, error: "wrong_gateway_type" }, 400);
        }
        if (!gw.is_enabled) {
          return json({ ok: false, error: "gateway_disabled" }, 403);
        }

        const cfg = (gw.config as Record<string, unknown>) ?? {};
        const headerName = ((cfg.webhook as Record<string, unknown>)?.signature_header as string) || "X-Signature";
        const sigHeader = request.headers.get(headerName) || request.headers.get(headerName.toLowerCase());

        const sigCheck = verifyWebhookSignature(raw, sigHeader, cfg);
        if (!sigCheck.valid) {
          await logPaymentEvent({
            gateway: slug, event_type: "error", status: "failed",
            signature_valid: false, ip_address: ip,
            request_body: safeParse(raw), error_message: `invalid_signature:${sigCheck.reason}`,
          });
          return json({ ok: false, error: "invalid_signature" }, 401);
        }

        const payload = safeParse(raw);
        const orderNumber = extractOrderNumber(payload);
        const txn = extractTransactionId(payload, cfg);
        const status = extractStatus(payload, cfg);
        const eventId = extractWebhookEventId(payload, cfg, txn || `${slug}-${Date.now()}`);

        if (!orderNumber || !txn) {
          await logPaymentEvent({
            gateway: slug, event_type: "ipn", signature_valid: true,
            ip_address: ip, request_body: payload,
            error_message: "missing_order_or_txn", status: "failed",
          });
          return json({ ok: false, error: "missing_order_or_transaction_id" }, 400);
        }

        const isReplay = await claimWebhookEvent(slug, eventId);
        if (isReplay) {
          await logPaymentEvent({
            gateway: slug, event_type: "replay", signature_valid: true,
            order_number: orderNumber, transaction_id: txn, ip_address: ip,
            request_body: payload, status: "duplicate",
          });
          return json({ ok: true, replay: true });
        }

        await logPaymentEvent({
          gateway: slug, event_type: "ipn", signature_valid: true,
          order_number: orderNumber, transaction_id: txn, ip_address: ip,
          request_body: payload, status,
        });

        if (status === "pending") {
          return json({ ok: true, pending: true });
        }

        const { processPaymentCallback } = await import("@/lib/payments.server");
        try {
          const result = await processPaymentCallback({
            orderNumber, transactionId: txn,
            status: status === "paid" ? "paid" : "failed",
            gateway: slug,
            raw: payload as Record<string, unknown>,
          });
          await logPaymentEvent({
            gateway: slug, event_type: status === "paid" ? "success" : "failed",
            order_number: orderNumber, transaction_id: txn, status,
            response_body: result as unknown,
          });
          return json(result);
        } catch (e) {
          const msg = e instanceof Error ? e.message : "callback_failed";
          await logPaymentEvent({
            gateway: slug, event_type: "error",
            order_number: orderNumber, transaction_id: txn,
            error_message: msg, status: "failed",
          });
          return json({ ok: false, error: msg }, 500);
        }
      },
    },
  },
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
function safeParse(raw: string): unknown {
  try { return JSON.parse(raw); } catch { return { _raw: raw }; }
}
