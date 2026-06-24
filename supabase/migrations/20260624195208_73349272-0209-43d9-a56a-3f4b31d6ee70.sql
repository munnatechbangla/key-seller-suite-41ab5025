REVOKE EXECUTE ON FUNCTION public.assign_licenses_for_order(UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_order_number() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assign_licenses_for_order(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.generate_order_number() TO service_role;