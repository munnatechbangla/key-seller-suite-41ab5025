# Plan: Fix Downloadable Product Delivery Workflow

Refactor the fulfillment timeline and delivery labels to dynamically reflect the product type (Downloadable vs. License vs. Subscription).

## User Review Required

> [!IMPORTANT]
> The implementation uses existing database fields (`product_type`, `delivery_type`) to distinguish between downloadable and license-based products.

## Proposed Changes

### Storefront & Order Status

#### [src/routes/pay.$orderNumber.tsx]
- Update `buildTimeline` to accept `isDownloadable` and `anyDelivered` flags.
- Modify the final timeline step label to show "Download Available" for downloadable products when approved/delivered.
- Update `PayPage` to detect if any product in the order is downloadable.

#### [src/routes/thank-you.tsx]
- Ensure `FulfillmentPanel` (which handles the timeline visualization) is correctly informed about the product types.

### Components

#### [src/components/delivery/DeliveryPanel.tsx]
- (Verification) Confirm existing logic handles `download` / `downloadable` types correctly. It already has a `DownloadBody` renderer, but I will verify labels like "License Delivered" are not used in its headers.

#### [src/components/fulfillment/FulfillmentPanel.tsx]
- Update `SubscriptionCard` logic to be generic or create a `DownloadableCard` equivalent for the checklist-style timeline.
- Ensure the 5-step checklist in the customer view shows "Download Available" instead of "License Delivered" for downloadable products.

## Technical Details

- Detection logic: `it.product_type === 'download' || it.delivery_type === 'download'`.
- Timeline labels:
  - License: `License Delivered`
  - Downloadable: `Download Available`
  - Subscription: `Subscription Delivered`
