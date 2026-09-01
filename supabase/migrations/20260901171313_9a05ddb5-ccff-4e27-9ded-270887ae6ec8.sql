CREATE OR REPLACE FUNCTION public.list_recent_public_purchases(_limit integer DEFAULT 10)
 RETURNS TABLE(first_name text, country text, product_name text, product_slug text, product_thumbnail text, purchased_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    COALESCE(NULLIF(split_part(COALESCE(o.customer_name, ''), ' ', 1), ''), 'A customer') AS first_name,
    NULLIF(o.country, '') AS country,
    p.title AS product_name,
    p.slug AS product_slug,
    p.thumbnail_url AS product_thumbnail,
    o.created_at AS purchased_at
  FROM public.orders o
  JOIN public.order_items oi ON oi.order_id = o.id
  JOIN public.products p ON p.id = oi.product_id
  WHERE o.status IN ('processing','completed')
    AND p.status = 'published'
    AND p.visibility = 'public'
  ORDER BY o.created_at DESC
  LIMIT GREATEST(1, LEAST(_limit, 50));
$function$;