# bKash Tokenized Checkout (URL-based) — Implementation Plan

## What the customer will experience

1. On the pay page, choose bKash and click "Continue with bKash".
2. The site creates a bKash payment and sends the customer to bKash's hosted page (wallet number, OTP, PIN).
3. bKash returns the customer to the site. The server finalizes ("executes") the payment with bKash, marks the order paid, and delivers licenses exactly like SSLCommerz does today.
4. Success -> `/thank-you?order=...`; failure/cancel -> back to `/pay/{orderNumber}` with a message.

No checkout UI, order flow, schema, RLS, or other gateway changes.

## Verified bKash API facts (official docs, developer.bka.sh)

- Base URLs: sandbox `https://tokenized.sandbox.bka.sh/v1.2.0-beta`, live `https://tokenized.pay.bka.sh/v1.2.0-beta`.
- Grant Token: `POST {base}/tokenized/checkout/token/grant`, headers `username`, `password`, JSON body `{ app_key, app_secret }`; returns `id_token`, `expires_in` (3600s), `refresh_token`, `statusCode`.
- Create Payment: `POST {base}/tokenized/checkout/create`, headers `Authorization: <id_token>`, `X-App-Key`; body `{ mode: "0011", payerReference, callbackURL, amount (string), currency: "BDT", intent: "sale", merchantInvoiceNumber }`; returns `paymentID`, `bkashURL`, `statusCode` ("0000" = ok).
- Callback: bKash redirects the browser to `callbackURL?paymentID=...&status=success|failure|cancel`. The callback is not a payment confirmation; only Execute Payment is.
- Execute Payment: `POST {base}/tokenized/checkout/execute`, same auth headers, body `{ paymentID }`; success has `transactionStatus: "Completed"`, `trxID`, `amount`, `merchantInvoiceNumber`. A paymentID can be executed once and expires after 24h.
- Query Payment (safety net if execute times out): `POST {base}/tokenized/checkout/payment/status`, body `{ paymentID }`.
- bKash only accepts BDT.

## Files to change

### 1. NEW `src/lib/payments/bkash.server.ts` (server-only, never bundled to browser)
- `readCreds(mode)`: reads `BKASH_APP_KEY`, `BKASH_APP_SECRET`, `BKASH_USERNAME`, `BKASH_PASSWORD` from `process.env` inside functions (same names already expected by `src/lib/payments/admin.functions.ts` line 49). Live-specific overrides `BKASH_LIVE_*` / `BKASH_SANDBOX_*` are honored first, mirroring the SSLCommerz pattern.
- `isBkashConfigured(mode)`.
- `getBkashToken(mode)`: grant-token call with an in-memory cache keyed by mode (token + expiry, refreshed 5 minutes early; concurrent calls deduplicated). Falls back to a fresh grant on 401/expired token.
- `createBkashPayment({...})`: builds the create request (amount fixed to 2 decimals, `merchantInvoiceNumber = orderNumber`, `payerReference = phone or orderNumber`, `callbackURL = {baseUrl}/api/public/payments/bkash/callback?order=...`), logs via `logPaymentEvent`, returns `{ ok, paymentID, bkashURL, raw }` or `{ ok:false, reason, raw }`.
- `executeBkashPayment(paymentID, mode)` and `queryBkashPayment(paymentID, mode)`: return a normalized `{ ok, transactionStatus, trxID, amount, merchantInvoiceNumber, raw, reason }`.
- All network/JSON errors are caught and returned as `{ ok:false, reason }`; bKash `statusCode !== "0000"` / `errorCode` map to readable reasons. Secrets are never logged (`request_body: { masked: true, mode }` like SSLCommerz).

### 2. EDIT `src/lib/payments/init.functions.ts`
- Add `if (data.gateway === "bkash") { ... }` directly after the SSLCommerz block (before the custom-auto lookup). Mirrors the SSLCommerz branch exactly:
  - checks `settings.bkash_enabled` and `settings.bkash_mode` from the existing `site_settings` payment config;
  - checks `isBkashConfigured(mode)`;
  - calls `createBkashPayment(...)`;
  - inserts a `payment_intents` row (`gateway: "bkash"`, `gateway_session_id: paymentID`, `redirect_url: bkashURL`, status `redirected` / `failed`);
  - returns `{ ok: true, gateway: "bkash", redirectUrl: bkashURL }`.
- Currency: bKash accepts BDT only; the same mapping used for SSLCommerz is applied (USD orders are charged as BDT amount as stored in the order, consistent with current SSLCommerz behavior).
- No other lines change; "Gateway not implemented" remains the fallthrough for anything else.

### 3. NEW `src/routes/api/public/payments.bkash.callback.ts`
- Handles `GET` (bKash redirects the browser with `paymentID` and `status`).
- Loads the order via `get_order_basic_by_number` and the latest bKash intent via `get_latest_payment_intent` (existing RPCs) to determine mode and verify the `paymentID` matches the intent.
- `status=success`: `claimWebhookEvent("bkash", paymentID, orderId)` for idempotency, then `executeBkashPayment`. If execute returns a network/timeout error, falls back to `queryBkashPayment`. On `transactionStatus === "Completed"` with matching invoice and amount, calls the existing `processPaymentCallback({ status: "paid", gateway: "bkash", transactionId: trxID })`; otherwise `status: "failed"`.
- `status=failure|cancel`: logs the event; no order mutation.
- Redirects: paid -> `/thank-you?order=...`; anything else -> `/pay/{orderNumber}?bkash=failed|cancelled`.
- Every step logged with `logPaymentEvent` (event types `callback`, `execute`, `query`).

### 4. Secrets (via the secure secret store, not code/chat)
- After you approve, I will open the secure secret form for `BKASH_APP_KEY`, `BKASH_APP_SECRET`, `BKASH_USERNAME`, `BKASH_PASSWORD`. Values go straight to the encrypted store; I never see them. `.env.example` already lists these names, no change needed there.
- Enable bKash and choose Sandbox/Live in Admin -> Settings -> Payments (already exists: `bkash_enabled`, `bkash_mode`).

## Not changed
- `src/routes/checkout.tsx`, `src/routes/pay.$orderNumber.tsx` (bKash is already in `BUILTIN_AUTO`), all SSLCommerz/custom/manual gateway code, `payments.server.ts`, database schema, RLS, `payment_intents` structure, order/fulfillment flow.

## Verification after implementation
- Typecheck passes.
- Sandbox end-to-end: place an order, choose bKash, confirm redirect to `bkashURL`, complete with bKash sandbox test wallet, confirm callback executes payment, order becomes paid, and license delivery/thank-you page work.
- Confirm `bkash.server.ts` is not present in the browser bundle and secrets never appear in payment logs.
