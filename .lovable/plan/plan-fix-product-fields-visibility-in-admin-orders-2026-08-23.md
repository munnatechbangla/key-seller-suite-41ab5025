# Plan - Fix Product Fields Visibility in Admin Orders

The user reported that product field values (like a custom email field) are not appearing in the Admin Orders details after a customer places an order, despite an earlier attempt to fix this. I will debug the end-to-end flow, verify the persistence logic in the checkout, and ensure the admin UI correctly fetches and displays these values.

## Steps

### 1. Database & Persistence Audit
- Verify the `save_order_custom_field_values` RPC in Supabase.
- Ensure the `order_custom_field_values` table has the correct data for test orders.
- Fix the checkout logic to ensure `saveOrderCustomFieldsGuestFn` / `saveOrderCustomFieldsAuthFn` are called correctly with the captured values from the cart.

### 2. Frontend Flow Fixes
- **Checkout Persistence**: Improve `src/routes/checkout.tsx` to handle custom field saving more robustly. I already added a filter for non-empty values and better error handling that doesn't block the order completion but logs/warns.
- **Admin UI Rendering**: Refine `src/routes/admin.orders.tsx` to ensure `OrderCustomFieldValues` is properly integrated and receives the necessary props (`authed={true}`, `isAdmin={true}`).
- **Component Polish**: Ensure `src/components/orders/OrderCustomFieldValues.tsx` correctly handles grouping and displays the "Customer Provided Information" section clearly.

### 3. End-to-End Verification
- Create a test order with a custom product field (e.g., "Email").
- Verify the database record in `order_custom_field_values`.
- Open the order in the Admin Panel and confirm the value is visible under "Customer Provided Information".
- Test both authenticated and guest checkout scenarios.

## Technical Details

- **Files to modify**:
    - `src/routes/checkout.tsx`: Persistence logic during order placement.
    - `src/routes/admin.orders.tsx`: Layout and prop passing for the order details view.
    - `src/components/orders/OrderCustomFieldValues.tsx`: Visual grouping and data display.
- **Data Source**: `order_custom_field_values` table via `get_order_custom_field_values` RPC.
- **RLS**: Verified that the RPC uses `SECURITY DEFINER` to bypass RLS for authorized fetches.
