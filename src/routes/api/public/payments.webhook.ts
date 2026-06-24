// Public payment gateway webhook receiver.
//
// Real gateway integrations (SSLCommerz, bKash, Nagad, Stripe, PayPal) post
// signed callbacks here. The handler verifies an HMAC-SHA256 signature of the
// raw request body using PAYMENTS_WEBHOOK_SECRET (env), then delegates to the
// shared processPaymentCallback() so license keys and downloads are only
// generated once payment is verified. Replay protection lives in the database
// (payments.transaction_id is unique; orders pinned to status='paid' once).

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

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const raw = await request.text();
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
