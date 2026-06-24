
REVOKE ALL ON FUNCTION public.assign_licenses_for_order(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assign_licenses_for_order(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.mark_order_paid(uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_order_paid(uuid, text, jsonb) TO service_role;

REVOKE ALL ON FUNCTION public.mark_order_failed(uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_order_failed(uuid, text, jsonb) TO service_role;
