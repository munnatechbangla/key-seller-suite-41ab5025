CREATE OR REPLACE FUNCTION public.get_order_fulfillments(_order_id uuid, _email text DEFAULT NULL::text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  ord public.orders%ROWTYPE;
  rows jsonb;
BEGIN
  SELECT * INTO ord FROM public.orders WHERE id = _order_id;
  IF NOT FOUND THEN RETURN '[]'::jsonb; END IF;

  IF NOT public.has_role(auth.uid(),'admin'::public.app_role) THEN
    IF ord.user_id IS NOT NULL AND auth.uid() IS DISTINCT FROM ord.user_id THEN
      IF _email IS NULL OR ord.email IS NULL OR lower(_email) <> lower(ord.email) THEN
        RAISE EXCEPTION 'Forbidden';
      END IF;
    END IF;
    IF ord.user_id IS NULL AND _email IS NOT NULL AND ord.email IS NOT NULL
       AND lower(_email) <> lower(ord.email) THEN
      RAISE EXCEPTION 'Forbidden';
    END IF;
  END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.created_at), '[]'::jsonb) INTO rows
  FROM (
    SELECT
      f.*,
      p.title AS product_title,
      p.slug AS product_slug,
      p.product_type AS product_type,
      p.delivery_type AS product_delivery_type
    FROM public.order_fulfillments f
    LEFT JOIN public.products p ON p.id = f.product_id
    WHERE f.order_id = _order_id
  ) t;
  RETURN rows;
END
$function$;