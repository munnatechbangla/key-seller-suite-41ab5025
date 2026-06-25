// SSLCommerz Hosted Checkout — Phase 5B.1
// Docs: https://developer.sslcommerz.com/doc/v4/
//
// Flow:
//  1. initSslcommerzSession() POSTs to /gwprocess/v4/api.php with our
//     store_id + store_passwd (env). Response includes GatewayPageURL.
//  2. Customer is redirected there and pays.
//  3. SSLCommerz sends an IPN POST to ipn_url AND redirects the customer to
//     success_url / fail_url / cancel_url. Both paths call validateSslcommerzPayment()
//     to confirm the transaction with /validator/api/validationserverAPI.php.
//  4. Only validated transactions are passed to processPaymentCallback() so
//     licenses/downloads are delivered exactly once (mark_order_paid is idempotent
//     and payments.transaction_id is unique).

import { logPaymentEvent } from "./logger.server";

type Mode = "sandbox" | "live";

export type SslcInitInput = {
  orderId: string;
  orderNumber: string;
  amount: number;
  currency: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  customerAddress?: string;
  productName: string;
  baseUrl: string;            // e.g. https://project--xxx.lovable.app
  mode: Mode;
};

export type SslcInitResult =
  | { ok: true; gatewayUrl: string; sessionKey: string; raw: Record<string, unknown> }
  | { ok: false; reason: string; raw?: Record<string, unknown> };

function endpoints(mode: Mode) {
  const host = mode === "live" ? "https://securepay.sslcommerz.com" : "https://sandbox.sslcommerz.com";
  return {
    init: `${host}/gwprocess/v4/api.php`,
    validate: `${host}/validator/api/validationserverAPI.php`,
  };
}

function readCreds(mode: Mode) {
  const store_id = mode === "live"
    ? process.env.SSLCOMMERZ_LIVE_STORE_ID || process.env.SSLCOMMERZ_STORE_ID
    : process.env.SSLCOMMERZ_SANDBOX_STORE_ID || process.env.SSLCOMMERZ_STORE_ID;
  const store_passwd = mode === "live"
    ? process.env.SSLCOMMERZ_LIVE_STORE_PASSWORD || process.env.SSLCOMMERZ_STORE_PASSWORD
    : process.env.SSLCOMMERZ_SANDBOX_STORE_PASSWORD || process.env.SSLCOMMERZ_STORE_PASSWORD;
  return { store_id, store_passwd };
}

export function isSslcommerzConfigured(mode: Mode): boolean {
  const { store_id, store_passwd } = readCreds(mode);
  return Boolean(store_id && store_passwd);
}

export async function initSslcommerzSession(input: SslcInitInput): Promise<SslcInitResult> {
  const { store_id, store_passwd } = readCreds(input.mode);
  if (!store_id || !store_passwd) {
    return { ok: false, reason: "Missing SSLCommerz credentials" };
  }

  const { init } = endpoints(input.mode);
  const tranId = input.orderNumber;
  const successUrl = `${input.baseUrl}/api/public/payments/sslcommerz/return?type=success&order=${encodeURIComponent(tranId)}`;
  const failUrl    = `${input.baseUrl}/api/public/payments/sslcommerz/return?type=fail&order=${encodeURIComponent(tranId)}`;
  const cancelUrl  = `${input.baseUrl}/api/public/payments/sslcommerz/return?type=cancel&order=${encodeURIComponent(tranId)}`;
  const ipnUrl     = `${input.baseUrl}/api/public/payments/sslcommerz/ipn`;

  const body = new URLSearchParams({
    store_id,
    store_passwd,
    total_amount: input.amount.toFixed(2),
    currency: input.currency || "BDT",
    tran_id: tranId,
    success_url: successUrl,
    fail_url: failUrl,
    cancel_url: cancelUrl,
    ipn_url: ipnUrl,
    product_name: input.productName.slice(0, 250),
    product_category: "Digital",
    product_profile: "general",
    cus_name: input.customerName || input.customerEmail,
    cus_email: input.customerEmail,
    cus_phone: input.customerPhone || "0000000000",
    cus_add1: input.customerAddress || "N/A",
    cus_city: "N/A",
    cus_country: "Bangladesh",
    shipping_method: "NO",
    num_of_item: "1",
  });

  let res: Response;
  try {
    res = await fetch(init, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : "network_error" };
  }

  let json: Record<string, unknown>;
  try {
    json = (await res.json()) as Record<string, unknown>;
  } catch {
    return { ok: false, reason: `Invalid SSLCommerz response (HTTP ${res.status})` };
  }

  await logPaymentEvent({
    gateway: "sslcommerz",
    event_type: "init",
    order_id: input.orderId,
    order_number: input.orderNumber,
    amount: input.amount,
    currency: input.currency,
    status: (json.status as string) ?? "unknown",
    request_body: { masked: true, mode: input.mode },
    response_body: json,
  });

  if (json.status !== "SUCCESS" || typeof json.GatewayPageURL !== "string") {
    return { ok: false, reason: (json.failedreason as string) || "SSLCommerz init failed", raw: json };
  }

  return {
    ok: true,
    gatewayUrl: json.GatewayPageURL,
    sessionKey: String(json.sessionkey ?? ""),
    raw: json,
  };
}

export type SslcValidationResult = {
  ok: boolean;
  status: string;
  tranId?: string;
  valId?: string;
  amount?: number;
  currency?: string;
  cardType?: string;
  bankTranId?: string;
  raw: Record<string, unknown>;
  reason?: string;
};

export async function validateSslcommerzPayment(valId: string, mode: Mode): Promise<SslcValidationResult> {
  const { store_id, store_passwd } = readCreds(mode);
  if (!store_id || !store_passwd) {
    return { ok: false, status: "config_error", raw: {}, reason: "missing_credentials" };
  }
  const { validate } = endpoints(mode);
  const url = `${validate}?val_id=${encodeURIComponent(valId)}&store_id=${encodeURIComponent(store_id)}&store_passwd=${encodeURIComponent(store_passwd)}&v=1&format=json`;

  let res: Response;
  try {
    res = await fetch(url, { method: "GET" });
  } catch (e) {
    return { ok: false, status: "network_error", raw: {}, reason: e instanceof Error ? e.message : "network" };
  }
  let json: Record<string, unknown>;
  try { json = (await res.json()) as Record<string, unknown>; }
  catch { return { ok: false, status: "invalid_response", raw: {} }; }

  const status = String(json.status ?? "");
  const valid = status === "VALID" || status === "VALIDATED";
  return {
    ok: valid,
    status,
    tranId: typeof json.tran_id === "string" ? json.tran_id : undefined,
    valId: typeof json.val_id === "string" ? json.val_id : undefined,
    amount: json.amount ? Number(json.amount) : undefined,
    currency: typeof json.currency === "string" ? json.currency : undefined,
    cardType: typeof json.card_type === "string" ? json.card_type : undefined,
    bankTranId: typeof json.bank_tran_id === "string" ? json.bank_tran_id : undefined,
    raw: json,
    reason: valid ? undefined : status,
  };
}
