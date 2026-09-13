// bKash Checkout (URL) / Payment (Sale) — server-only.
// Docs: https://developer.bka.sh/docs/grant-token-1 , create-payment, execute-payment, query-payment
//
// Flow:
//  1. grantToken()        POST {base}/tokenized/checkout/token/grant
//  2. createPayment()     POST {base}/tokenized/checkout/create   (mode "0011", intent "sale")
//                         -> { paymentID, bkashURL }  customer is redirected to bkashURL
//  3. callback route      -> executePayment() POST {base}/tokenized/checkout/execute
//                         -> queryPayment()  POST {base}/tokenized/checkout/payment/status  (fallback)
//  4. Only a strictly verified "Completed" result is passed to processPaymentCallback().
//
// NOTE: bKash's published samples are inconsistent (legacy /checkout/payment/create,
// /execute/{paymentID}, /payment/query/{paymentID}). This module uses the current
// tokenized-host endpoint family documented for Checkout (URL).
//
// Secrets (server-only env): BKASH_APP_KEY, BKASH_APP_SECRET, BKASH_USERNAME, BKASH_PASSWORD.

import { logPaymentEvent } from "./logger.server";

export type BkashMode = "sandbox" | "live";

const BASE: Record<BkashMode, string> = {
  sandbox: "https://tokenized.sandbox.bka.sh/v1.2.0-beta",
  live: "https://tokenized.pay.bka.sh/v1.2.0-beta",
};

function readCreds(mode: BkashMode) {
  const pick = (live?: string, sbx?: string, common?: string) =>
    (mode === "live" ? live : sbx) || common;
  return {
    appKey: pick(process.env.BKASH_LIVE_APP_KEY, process.env.BKASH_SANDBOX_APP_KEY, process.env.BKASH_APP_KEY),
    appSecret: pick(process.env.BKASH_LIVE_APP_SECRET, process.env.BKASH_SANDBOX_APP_SECRET, process.env.BKASH_APP_SECRET),
    username: pick(process.env.BKASH_LIVE_USERNAME, process.env.BKASH_SANDBOX_USERNAME, process.env.BKASH_USERNAME),
    password: pick(process.env.BKASH_LIVE_PASSWORD, process.env.BKASH_SANDBOX_PASSWORD, process.env.BKASH_PASSWORD),
  };
}

export function isBkashConfigured(mode: BkashMode): boolean {
  const c = readCreds(mode);
  return Boolean(c.appKey && c.appSecret && c.username && c.password);
}

// ---- token cache (in-memory, per worker instance) + in-flight dedupe ----
type CachedToken = { token: string; expiresAt: number };
const tokenCache = new Map<BkashMode, CachedToken>();
const inFlight = new Map<BkashMode, Promise<string>>();

async function requestToken(mode: BkashMode): Promise<string> {
  const { appKey, appSecret, username, password } = readCreds(mode);
  if (!appKey || !appSecret || !username || !password) throw new Error("Missing bKash credentials");

  const res = await fetch(`${BASE[mode]}/tokenized/checkout/token/grant`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      username,
      password,
    },
    body: JSON.stringify({ app_key: appKey, app_secret: appSecret }),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  const token = typeof json.id_token === "string" ? json.id_token : "";
  if (!token) {
    throw new Error(
      `bKash grant token failed: ${String(json.statusMessage ?? json.message ?? `HTTP ${res.status}`)}`,
    );
  }
  const ttl = Number(json.expires_in ?? 3600);
  tokenCache.set(mode, { token, expiresAt: Date.now() + Math.max(60, ttl - 120) * 1000 });
  return token;
}

async function getToken(mode: BkashMode): Promise<string> {
  const cached = tokenCache.get(mode);
  if (cached && cached.expiresAt > Date.now()) return cached.token;
  const pending = inFlight.get(mode);
  if (pending) return pending;
  const p = requestToken(mode).finally(() => inFlight.delete(mode));
  inFlight.set(mode, p);
  return p;
}

async function authedPost(
  mode: BkashMode,
  path: string,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const { appKey } = readCreds(mode);
  const token = await getToken(mode);
  const res = await fetch(`${BASE[mode]}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: token,
      "X-APP-Key": appKey as string,
    },
    body: JSON.stringify(body),
  });
  return (await res.json().catch(() => ({}))) as Record<string, unknown>;
}

export type BkashCreateInput = {
  orderId: string;
  orderNumber: string;
  amount: number;
  payerReference: string;
  callbackURL: string;
  mode: BkashMode;
};

export type BkashCreateResult =
  | { ok: true; paymentID: string; bkashURL: string; raw: Record<string, unknown> }
  | { ok: false; reason: string; raw?: Record<string, unknown> };

export async function createBkashPayment(input: BkashCreateInput): Promise<BkashCreateResult> {
  if (!isBkashConfigured(input.mode)) return { ok: false, reason: "Missing bKash credentials" };

  let json: Record<string, unknown>;
  try {
    json = await authedPost(input.mode, "/tokenized/checkout/create", {
      mode: "0011",
      payerReference: input.payerReference.slice(0, 50) || input.orderNumber,
      callbackURL: input.callbackURL,
      amount: input.amount.toFixed(2),
      currency: "BDT",
      intent: "sale",
      merchantInvoiceNumber: input.orderNumber,
    });
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : "network_error" };
  }

  await logPaymentEvent({
    gateway: "bkash",
    event_type: "init",
    order_id: input.orderId,
    order_number: input.orderNumber,
    amount: input.amount,
    currency: "BDT",
    status: String(json.statusCode ?? "unknown"),
    request_body: { masked: true, mode: input.mode, merchantInvoiceNumber: input.orderNumber },
    response_body: json,
  });

  const paymentID = typeof json.paymentID === "string" ? json.paymentID : "";
  const bkashURL = typeof json.bkashURL === "string" ? json.bkashURL : "";
  if (!paymentID || !bkashURL) {
    return {
      ok: false,
      reason: String(json.statusMessage ?? json.errorMessage ?? "bKash create payment failed"),
      raw: json,
    };
  }
  return { ok: true, paymentID, bkashURL, raw: json };
}

export type BkashPaymentStatus = {
  ok: boolean;
  transactionStatus: string;
  paymentID?: string;
  trxID?: string;
  amount?: number;
  currency?: string;
  merchantInvoiceNumber?: string;
  raw: Record<string, unknown>;
  reason?: string;
};

function normalize(json: Record<string, unknown>): BkashPaymentStatus {
  const transactionStatus = String(json.transactionStatus ?? "");
  return {
    ok: transactionStatus === "Completed",
    transactionStatus,
    paymentID: typeof json.paymentID === "string" ? json.paymentID : undefined,
    trxID: typeof json.trxID === "string" ? json.trxID : undefined,
    amount: json.amount != null ? Number(json.amount) : undefined,
    currency: typeof json.currency === "string" ? json.currency : undefined,
    merchantInvoiceNumber:
      typeof json.merchantInvoiceNumber === "string" ? json.merchantInvoiceNumber : undefined,
    raw: json,
    reason: transactionStatus === "Completed"
      ? undefined
      : String(json.statusMessage ?? json.errorMessage ?? transactionStatus ?? "not_completed"),
  };
}

export async function executeBkashPayment(paymentID: string, mode: BkashMode): Promise<BkashPaymentStatus> {
  try {
    return normalize(await authedPost(mode, "/tokenized/checkout/execute", { paymentID }));
  } catch (e) {
    return { ok: false, transactionStatus: "", raw: {}, reason: e instanceof Error ? e.message : "network_error" };
  }
}

export async function queryBkashPayment(paymentID: string, mode: BkashMode): Promise<BkashPaymentStatus> {
  try {
    return normalize(await authedPost(mode, "/tokenized/checkout/payment/status", { paymentID }));
  } catch (e) {
    return { ok: false, transactionStatus: "", raw: {}, reason: e instanceof Error ? e.message : "network_error" };
  }
}
