
INSERT INTO public.site_settings (group_key, setting_key, value, is_public)
VALUES ('marketplace', 'config', '{}'::jsonb, true)
ON CONFLICT (group_key, setting_key) DO UPDATE SET is_public = true;

CREATE OR REPLACE FUNCTION public.list_recent_public_purchases(_limit int DEFAULT 10)
RETURNS TABLE(first_name text, country text, product_name text, product_slug text, product_thumbnail text, purchased_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
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
  WHERE o.status IN ('paid','completed')
  ORDER BY o.created_at DESC
  LIMIT GREATEST(1, LEAST(_limit, 50));
$$;

GRANT EXECUTE ON FUNCTION public.list_recent_public_purchases(int) TO anon, authenticated;
