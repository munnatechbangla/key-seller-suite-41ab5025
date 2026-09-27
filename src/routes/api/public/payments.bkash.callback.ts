import { createFileRoute } from "@tanstack/react-router";

type OrderRow = {
  id: string;
  order_number: string;
  total: number;
  currency: string;
  status: string;
};

type IntentRow = {
  id: string;
  mode: string;
  status: string;
  gateway_session_id: string | null;
  amount: number;
  currency: string;
};

type BkashResult = {
  paymentID?: unknown;
  trxID?: unknown;
  transactionStatus?: unknown;
  merchantInvoiceNumber?: unknown;
  amount?: unknown;
  currency?: unknown;
};

function redirect(path: string): Response {
  return new Response(null, { status: 302, headers: { Location: path } });
}

function payPath(orderNumber: string, status: "failed" | "cancelled" | "pending"): string {
  return `/pay/${encodeURIComponent(orderNumber)}?bkash=${status}`;
}

function cents(value: unknown): bigint | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const match = String(value).match(/^(\d+)(?:\.(\d{1,2}))?$/);
  if (!match) return null;
  return BigInt(match[1]) * 100n + BigInt((match[2] ?? "").padEnd(2, "0"));
}

function validCompletedPayment(data: BkashResult, order: OrderRow, paymentID: string): boolean {
  const expected = cents(Number(order.total).toFixed(2));
  const received = cents(data.amount);
  return data.transactionStatus === "Completed"
    && data.paymentID === paymentID
    && data.merchantInvoiceNumber === order.order_number
    && data.currency === "BDT"
    && order.currency === "BDT"
    && expected !== null
    && received === expected;
}

function safeProviderResult(data: BkashResult, mode: string) {
  return {
    mode,
    paymentID: typeof data.paymentID === "string" ? data.paymentID : null,
    trxID: typeof data.trxID === "string" ? data.trxID : null,
    transactionStatus: typeof data.transactionStatus === "string" ? data.transactionStatus : null,
    merchantInvoiceNumber: typeof data.merchantInvoiceNumber === "string" ? data.merchantInvoiceNumber : null,
    amount: data.amount == null ? null : String(data.amount),
    currency: typeof data.currency === "string" ? data.currency : null,
  };
}

async function handle(request: Request): Promise<Response> {
  const { rateLimit, clientIp } = await import("@/lib/payments/rate-limit.server");
  const ip = clientIp(request);
  const limited = rateLimit(`bkash-callback:${ip}`, { limit: 60, windowMs: 60_000 });
  if (!limited.ok) return new Response("rate_limited", { status: 429 });

  const url = new URL(request.url);
  let orderNumber = url.searchParams.get("order") ?? "";
  let paymentID = url.searchParams.get("paymentID") ?? "";
  let callbackStatus = url.searchParams.get("status") ?? "";

  if (request.method === "POST") {
    const body = await request.text();
    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      try {
        const parsed = JSON.parse(body) as Record<string, unknown>;
        orderNumber ||= typeof parsed.order === "string" ? parsed.order : "";
        paymentID ||= typeof parsed.paymentID === "string" ? parsed.paymentID : "";
        callbackStatus ||= typeof parsed.status === "string" ? parsed.status : "";
      } catch {
        return new Response("invalid_callback", { status: 400 });
      }
    } else {
      const form = new URLSearchParams(body);
      orderNumber ||= form.get("order") ?? "";
      paymentID ||= form.get("paymentID") ?? "";
      callbackStatus ||= form.get("status") ?? "";
    }
  }

  callbackStatus = callbackStatus.toLowerCase();
  if (!orderNumber || !paymentID || !["success", "failure", "cancel"].includes(callbackStatus)) {
    return new Response("invalid_callback", { status: 400 });
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: orderData, error: orderError } = await supabaseAdmin
    .from("orders")
    .select("id, order_number, total, currency, status")
    .eq("order_number", orderNumber)
    .maybeSingle();
  const order = orderData as OrderRow | null;
  if (orderError || !order) return redirect(payPath(orderNumber, "failed"));
  if (["paid", "completed"].includes(order.status)) {
    return redirect(`/thank-you?order=${encodeURIComponent(order.order_number)}`);
  }

  const { data: intentData, error: intentError } = await supabaseAdmin
    .from("payment_intents")
    .select("id, mode, status, gateway_session_id, amount, currency")
    .eq("order_id", order.id)
    .eq("gateway", "bkash")
    .eq("gateway_session_id", paymentID)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const intent = intentData as IntentRow | null;
  if (intentError || !intent || intent.gateway_session_id !== paymentID) {
    const { logPaymentEvent } = await import("@/lib/payments/logger.server");
    await logPaymentEvent({ gateway: "bkash", event_type: "callback", order_number: order.order_number, transaction_id: paymentID, status: "intent_not_found" });
    return redirect(payPath(order.order_number, "failed"));
  }

  if (intent.currency !== "BDT" || Number(intent.amount) !== Number(order.total) || order.currency !== "BDT") {
    const { logPaymentEvent } = await import("@/lib/payments/logger.server");
    await logPaymentEvent({ gateway: "bkash", event_type: "error", order_id: order.id, order_number: order.order_number, transaction_id: paymentID, status: "amount_or_currency_mismatch", currency: order.currency });
    return redirect(payPath(order.order_number, "failed"));
  }

  const mode = intent.mode === "live" ? "live" : "sandbox";
  let providerCompleted: BkashResult | null = null;
  if (callbackStatus === "failure" || callbackStatus === "cancel") {
    const { queryBkashPayment } = await import("@/lib/payments/bkash.server");
    const providerStatus = await queryBkashPayment(paymentID, mode);
    const providerResult = providerStatus.ok ? providerStatus.data as BkashResult : null;
    const expectedCents = cents(Number(order.total).toFixed(2));
    const providerCents = cents(providerResult?.amount);
    const providerIdentityMatches = providerResult?.paymentID === paymentID
      && providerResult.merchantInvoiceNumber === order.order_number
      && providerResult.currency === "BDT"
      && order.currency === "BDT"
      && expectedCents !== null
      && providerCents === expectedCents;
    if (providerIdentityMatches && providerResult?.transactionStatus === "Completed") {
      providerCompleted = providerResult;
    }
    const confirmedState = providerIdentityMatches && providerResult?.transactionStatus === "Failed"
      ? "failed"
      : providerIdentityMatches && ["Canceled", "Cancelled"].includes(String(providerResult?.transactionStatus))
        ? "cancelled"
        : null;
    if (confirmedState) {
      await supabaseAdmin.from("payment_intents").update({
        status: confirmedState,
        gateway_payment_id: paymentID,
        response_payload: safeProviderResult(providerResult!, mode),
      }).eq("id", intent.id);
      await supabaseAdmin.from("payments").update({ status: "failed" })
        .eq("order_id", order.id)
        .eq("method", "bkash")
        .eq("status", "pending");
    }
    const { logPaymentEvent } = await import("@/lib/payments/logger.server");
    await logPaymentEvent({ gateway: "bkash", event_type: "callback", order_id: order.id, order_number: order.order_number, transaction_id: paymentID, status: providerCompleted ? "completed_despite_browser_failure" : confirmedState ?? "unconfirmed_failure_callback" });
    if (!providerCompleted) return redirect(payPath(order.order_number, confirmedState ?? "pending"));
  }

  const { data: claimData, error: claimError } = await supabaseAdmin.rpc("claim_webhook_event", {
    _gateway: "bkash",
    _event_id: `execute:${paymentID}`,
    _order_id: order.id,
  });
  if (claimError && !providerCompleted) {
    const { logPaymentEvent } = await import("@/lib/payments/logger.server");
    await logPaymentEvent({ gateway: "bkash", event_type: "error", order_id: order.id, order_number: order.order_number, transaction_id: paymentID, status: "replay_claim_failed" });
    return redirect(payPath(order.order_number, "pending"));
  }

  const { executeBkashPayment, queryBkashPayment } = await import("@/lib/payments/bkash.server");
  let verified: BkashResult | null = providerCompleted;
  if (claimData) {
    const query = await queryBkashPayment(paymentID, mode);
    if (query.ok) verified = query.data as BkashResult;
  } else if (!verified) {
    const execution = await executeBkashPayment(paymentID, mode);
    if (execution.ok) {
      verified = execution.data as BkashResult;
      if (verified.transactionStatus !== "Completed") {
        const query = await queryBkashPayment(paymentID, mode);
        if (query.ok) verified = query.data as BkashResult;
      }
    } else if (execution.uncertain) {
      const query = await queryBkashPayment(paymentID, mode);
      if (query.ok) verified = query.data as BkashResult;
    }
  }

  if (!verified || !validCompletedPayment(verified, order, paymentID) || typeof verified.trxID !== "string" || !verified.trxID) {
    await supabaseAdmin.from("payment_intents").update({
      status: "bkash_active",
      gateway_payment_id: paymentID,
      response_payload: verified ? safeProviderResult(verified, mode) : { status: "unverified" },
    }).eq("id", intent.id);
    const { logPaymentEvent } = await import("@/lib/payments/logger.server");
    await logPaymentEvent({ gateway: "bkash", event_type: "validate", order_id: order.id, order_number: order.order_number, transaction_id: paymentID, status: "verification_incomplete" });
    return redirect(payPath(order.order_number, "pending"));
  }

  const { processPaymentCallback } = await import("@/lib/payments.server");
  let processed: Awaited<ReturnType<typeof processPaymentCallback>>;
  try {
    processed = await processPaymentCallback({
      orderNumber: order.order_number,
      transactionId: verified.trxID,
      status: "paid",
      gateway: "bkash",
      raw: safeProviderResult(verified, mode),
    }, supabaseAdmin);
  } catch {
    const { logPaymentEvent } = await import("@/lib/payments/logger.server");
    await logPaymentEvent({ gateway: "bkash", event_type: "error", order_id: order.id, order_number: order.order_number, transaction_id: paymentID, status: "order_callback_failed" });
    return redirect(payPath(order.order_number, "pending"));
  }
  if (!processed.ok) return redirect(payPath(order.order_number, "pending"));

  await supabaseAdmin.from("payment_intents").update({
    status: "paid",
    gateway_payment_id: paymentID,
    response_payload: safeProviderResult(verified, mode),
  }).eq("id", intent.id);
  return redirect(`/thank-you?order=${encodeURIComponent(order.order_number)}`);
}

export const Route = createFileRoute("/api/public/payments/bkash/callback")({
  server: {
    handlers: {
      GET: ({ request }) => handle(request),
      POST: ({ request }) => handle(request),
    },
  },
});