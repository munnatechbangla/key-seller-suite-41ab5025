REVOKE EXECUTE ON FUNCTION public.recalc_product_rating(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.user_purchased_product(uuid, uuid) FROM anon, authenticated;