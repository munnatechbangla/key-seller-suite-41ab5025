# Subscription Product Workflow — Independent Track

Goal: Subscription products get a manual-delivery workflow. License and Download workflows stay exactly as they are. Product Type == `subscription` is the switch.

## Scope

Only touched code paths:
- Fulfillment DB functions — branch on `products.product_type = 'subscription'`
- New admin action: **Mark Subscription Delivered**
- Storefront timeline + delivery card for subscription orders
- Admin order row — show subscription info + delivery button

Untouched: license_keys, license_assignments, license_pools, downloads, product_downloads, and every `delivery_type in ('license_key','download','downloadable','external','account','manual')` renderer.

## Database changes (single migration)

1. Update `public.start_fulfillment_for_order(_order_id)`:
   - When the row's product is `product_type = 'subscription'`, insert the fulfillment with `delivery_type = 'subscription'` and `fulfillment_status = 'manual_review'` (waiting for admin), and **skip** all license/download provisioning branches.
   - All other product types keep their current path unchanged.

2. New RPC `public.admin_mark_subscription_delivered(_fulfillment_id uuid, _note text)`:
   - Admin-only (checks `has_role`).
   - Guards: the fulfillment's product must be `subscription`.
   - Sets `fulfillment_status = 'delivered'`, `completed_at = now()`, appends `metadata.delivery_note`, writes a `fulfillment_logs` entry `event = 'subscription_delivered'`, and marks parent `orders.status = 'completed'` when all items are delivered.

3. `get_order_fulfillments` — no schema change; already returns `delivery_type`. Front-end uses that to branch.

## Server functions

`src/lib/fulfillment.functions.ts`
- Add `adminMarkSubscriptionDeliveredFn` calling the new RPC.

## Frontend

`src/components/fulfillment/FulfillmentPanel.tsx`
- When `f.delivery_type === 'subscription'`:
  - Hide Retry/Restart/Cancel license buttons.
  - Show a single admin **Mark Subscription Delivered** button (disabled once `delivered`).
  - Replace timeline UI with the fixed 5-step subscription checklist:
    Order Created → Payment Submitted → Under Verification → Payment Approved → Subscription Delivered.
    Steps derive from: order exists, manual_payment_submissions row, submission status, order.status = 'paid', fulfillment.status = 'delivered'.
- Other delivery types: existing UI unchanged.

`src/components/delivery/DeliveryPanel.tsx`
- Rewrite only the `SubscriptionBody` renderer:
  - Before delivery: "Subscription pending — awaiting delivery".
  - After delivery (fulfillment delivered): green "Subscription Delivered — Delivered successfully" + delivery date.
  - No Download button, no license UI.

`src/routes/admin.orders.tsx`
- Existing expanded row already shows `FulfillmentPanel` + `OrderCustomFieldValues`. Add customer email + subscription delivery note field beside the new button (rendered inside the panel).

`src/routes/thank-you.tsx`
- Remove the "No license keys were issued" message when the item is a subscription; rely on `DeliveryPanel`'s subscription renderer.

## Verification checklist (delivered at end)

- ✅ Subscription workflow: manual approve → Mark Delivered → customer sees Delivered
- ✅ License workflow untouched (same RPCs, same UI branches)
- ✅ Download workflow untouched
