# Phase 2 — SMM Service Customer-Facing Workflow

Implement the customer-facing quantity selection and pricing calculation for SMM products, ensuring validation and persistence across the cart and checkout flows.

## User Review Required

> [!IMPORTANT]
> The `place_order` database function (RPC) currently calculates totals server-side based on `regular_price` or `sale_price` columns. I will update the RPC in this phase to also account for SMM pricing logic (`smm_config`) when `product_type = 'smm_service'`.

## Proposed Changes

### Database & Types
- Update `products` table RLS or metadata to ensure `smm_config` is accessible.
- Update `order_items` migration to include a `smm_config_snapshot` column for historical data preservation.
- Update `place_order` RPC to handle SMM pricing logic server-side.

### Core Logic (`src/lib/catalog.ts`)
- Extend `Product` type to include `product_type` and `smm_config`.
- Add `calculateSMMPrice(quantity, config)` utility using the three pricing modes:
  - `per_unit`: `qty * price`
  - `per_1000`: `(qty / 1000) * price`
  - `quantity_tier`: Price based on tiers.
- Add `validateSMMQuantity(quantity, config)` utility for min/max/step validation.

### Product Detail (`src/routes/products.$slug.tsx`)
- Detect `product_type === 'smm_service'`.
- Render a new `SMMQuantitySelector` component instead of the standard quantity input.
- Show live price updates (Quantity, Price, Total) using `usePriceFormatter`.
- Integrate validation feedback in the UI.

### Cart & Store (`src/lib/stores.ts`)
- Update `CartItem` and `CartVariantMeta` to store `smm_config_snapshot` and `smm_quantity`.
- Ensure `effectiveUnitPrice` handles SMM products.
- Update `add` function to accept SMM snapshots.

### Checkout & Orders (`src/routes/checkout.tsx` & `src/lib/orders.functions.ts`)
- Pass SMM metadata to `placeOrder` RPC.
- Display SMM quantity and formatted total clearly in the checkout summary.
- Ensure `getOrderSummary` (used in Thank You / Admin pages) exposes SMM details.

### Admin View (`src/routes/admin.orders.tsx`)
- Update order details to show SMM-specific fields (Platform, Service, Quantity, Pricing Mode) instead of generic license fields.

## Technical Details
- **Pricing Logic**:
  - `per_unit`: Simple multiplication.
  - `per_1000`: `(quantity / 1000) * base_price`. If the admin configures a step of 1000, only full blocks are valid.
  - `quantity_tier`: `smm_config.tiers` (array of `{ min, price }`) will be searched for the highest applicable `min`.
- **Validation**:
  - Client-side: Real-time feedback in `SMMQuantitySelector`.
  - Server-side: `place_order` RPC will verify `quantity` against `smm_config` fetched from the `products` table.
- **Backward Compatibility**:
  - Existing products (License, Subscription, etc.) use their existing logic paths.
  - `CartItem` updates will be non-breaking (optional fields).

## Verification Plan

### Automated Tests
- Run `bun run build:dev` to ensure type stability.
- Use Playwright to simulate:
  - Valid/Invalid quantity input for an SMM product.
  - Add to cart and verify price calculation in cart subtotal.
  - Complete checkout and verify order summary displays SMM details.

### Manual Verification
- Test "Per Unit" product with ৳0.50 price.
- Test "Per 1,000" product with ৳100 price.
- Verify existing variable product (Size/Color) still works perfectly.
- Check Admin Order details for a new SMM order.
