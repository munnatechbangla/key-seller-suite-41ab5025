CREATE OR REPLACE FUNCTION public.assign_licenses_for_order(_order_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  item RECORD;
  i INTEGER;
  found_key_id uuid;
  assigned INTEGER := 0;
  ord RECORD;
BEGIN
  SELECT * INTO ord FROM public.orders WHERE id = _order_id;
  IF NOT FOUND THEN RETURN 0; END IF;

  FOR item IN SELECT * FROM public.order_items WHERE order_id = _order_id LOOP
    FOR i IN 1..item.qty LOOP
      found_key_id := NULL;

      IF item.license_pool_id_snapshot IS NOT NULL THEN
        SELECT lk.id INTO found_key_id FROM public.license_keys lk
          WHERE lk.pool_id = item.license_pool_id_snapshot
            AND lk.status = 'available'
          ORDER BY lk.created_at LIMIT 1 FOR UPDATE SKIP LOCKED;
      END IF;

      IF found_key_id IS NULL THEN
        SELECT lk.id INTO found_key_id FROM public.license_keys lk
          WHERE lk.product_id = item.product_id AND lk.status = 'available'
          ORDER BY lk.created_at LIMIT 1 FOR UPDATE SKIP LOCKED;
      END IF;

      IF found_key_id IS NOT NULL THEN
        UPDATE public.license_keys SET status='assigned' WHERE id = found_key_id;
        INSERT INTO public.license_assignments(order_item_id, order_id, license_key_id, user_id)
          VALUES (item.id, _order_id, found_key_id, ord.user_id);
        assigned := assigned + 1;
      END IF;
    END LOOP;

    INSERT INTO public.downloads(order_item_id, order_id, user_id, product_id, expires_at)
    VALUES (item.id, _order_id, ord.user_id, item.product_id, now() + interval '30 days');
  END LOOP;

  RETURN assigned;
END; $function$;