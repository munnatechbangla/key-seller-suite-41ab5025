// Public payment gateway webhook receiver.
//
// Security layers (in order):
//   1. Per-IP rate limiting (in-memory sliding window).
//   2. Body size cap (defensive).
//   3. HMAC-SHA256 signature verification over the raw body using
//      PAYMENTS_WEBHOOK_SECRET.
//   4. Optional timestamp window (x-th-timestamp) to block replays of
//      previously-captured signed payloads outside a 5-minute skew.
//   5. Database-level idempotency: payments.transaction_id is unique and
//      orders pin to status='paid' once via mark_order_paid().
//
// Delegates to processPaymentCallback() so license keys, downloads, and
// transactional emails are only generated once payment is verified.

import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";
import { z } from "zod";

const bodySchema = z.object({
  orderNumber: z.string().min(1),
  transactionId: z.string().min(1),
  status: z.enum(["paid", "failed"]),
  gateway: z.string().min(1),
  raw: z.record(z.unknown()).optional(),
});

const MAX_BODY_BYTES = 32 * 1024;
const TIMESTAMP_SKEW_MS = 5 * 60 * 1000;

function verifySignature(rawBody: string, header: string | null): boolean {
  if (!header) return false;
  const secret = process.env.PAYMENTS_WEBHOOK_SECRET;
  if (!secret) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  try { return timingSafeEqual(a, b); } catch { return false; }
}

function verifyTimestamp(header: string | null): boolean {
  if (!header) return true; // optional header — legacy callers may omit
  const ts = Number(header);
  if (!Number.isFinite(ts)) return false;
  return Math.abs(Date.now() - ts) <= TIMESTAMP_SKEW_MS;
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { rateLimit, clientIp } = await import("@/lib/payments/rate-limit.server");
        const ip = clientIp(request);
        const rl = rateLimit(`webhook:${ip}`, { limit: 60, windowMs: 60_000 });
        if (!rl.ok) {
          return new Response(JSON.stringify({ ok: false, error: "rate_limited" }), {
            status: 429,
            headers: { "Content-Type": "application/json", "Retry-After": String(rl.retryAfter) },
          });
        }

        const raw = await request.text();
        if (raw.length > MAX_BODY_BYTES) {
          return new Response(JSON.stringify({ ok: false, error: "payload_too_large" }), { status: 413, headers: { "Content-Type": "application/json" } });
        }
        if (!verifyTimestamp(request.headers.get("x-th-timestamp"))) {
          return new Response(JSON.stringify({ ok: false, error: "stale_timestamp" }), { status: 401, headers: { "Content-Type": "application/json" } });
        }
        const sig = request.headers.get("x-th-signature");
        if (!verifySignature(raw, sig)) {
          return new Response(JSON.stringify({ ok: false, error: "invalid_signature" }), { status: 401, headers: { "Content-Type": "application/json" } });
        }
        let parsed;
        try { parsed = bodySchema.parse(JSON.parse(raw)); } catch (e) {
          return new Response(JSON.stringify({ ok: false, error: "invalid_body", detail: e instanceof Error ? e.message : "parse" }), { status: 400, headers: { "Content-Type": "application/json" } });
        }
        const { processPaymentCallback } = await import("@/lib/payments.server");
        try {
          const result = await processPaymentCallback(parsed);
          return new Response(JSON.stringify(result), { status: 200, headers: { "Content-Type": "application/json" } });
        } catch (e) {
          return new Response(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : "server_error" }), { status: 500, headers: { "Content-Type": "application/json" } });
        }
      },
    },
  },
});
