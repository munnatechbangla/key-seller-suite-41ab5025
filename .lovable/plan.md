# Plan - Fix SMM Service Product Flow & Database Schema

The SMM Service product flow is currently broken due to a database schema mismatch (`smm_config` column missing) and a frontend validation bug (`quantity_step` being passed as `undefined` or `NaN`). Additionally, a new Lovable Cloud project was recently initialized, requiring a schema bootstrap.

## Database & Schema Fixes
- Bootstrap the database with core tables (`products`, `profiles`, `user_roles`) to resolve global build errors.
- Apply the SMM Service migrations to add the `smm_config` column and required enums (`smm_service`, `smm_fulfillment`).
- Ensure all RLS policies and grants are correctly applied.

## Frontend & Logic Fixes
- Fix the `Admin Product Editor` to correctly map and parse SMM configuration fields as numbers before submission.
- Update the Zod validation schema in `src/lib/admin.functions.ts` to handle numeric coercion more robustly.
- Address TypeScript build errors in reviews and settings components by ensuring table types are correctly recognized.

## Verification
- Verify that a new SMM Service product can be created and saved successfully.
- Confirm that the `smm_config` data persists after a page reload.
- Ensure existing product types (Simple, Variable, etc.) remain functional.

## Technical Details
- Using `supabase--migration` to apply schema changes.
- Updating `src/routes/admin.products.index.tsx` and `src/routes/admin.products.$id.tsx` for payload sanitization.
- Refining `productSchema` in `src/lib/admin.functions.ts`.
