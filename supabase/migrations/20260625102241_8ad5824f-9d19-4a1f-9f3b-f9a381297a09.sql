-- Security hardening: revoke EXECUTE on privileged SECURITY DEFINER functions
-- from anon/authenticated. All callers use the service-role admin client.

REVOKE EXECUTE ON FUNCTION public.validate_coupon(text, numeric, uuid, text, uuid[]) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.apply_coupon_usage(uuid, uuid, uuid, text, numeric, numeric) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trg_recalc_rating_fn() FROM anon, authenticated, PUBLIC;

-- Defense-in-depth: ensure already-locked functions stay locked.
REVOKE EXECUTE ON FUNCTION public.mark_order_paid(uuid, text, jsonb) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.mark_order_failed(uuid, text, jsonb) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.assign_licenses_for_order(uuid) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.recalc_product_rating(uuid) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.user_purchased_product(uuid, uuid) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, PUBLIC;

-- Keep public access for functions intentionally callable by clients/RLS:
--   has_role(uuid, app_role)            -> used by RLS policies (anon+authenticated)
--   list_public_payment_gateways()      -> sanitized public read for checkout