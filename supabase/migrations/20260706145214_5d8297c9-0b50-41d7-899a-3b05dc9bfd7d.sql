
-- Inventory Dashboard reporting RPCs (admin-only)

CREATE OR REPLACE FUNCTION public.admin_inventory_summary()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _is_admin boolean;
  _totals jsonb;
  _pool_stats jsonb;
BEGIN
  SELECT public.has_role(auth.uid(), 'admin') INTO _is_admin;
  IF NOT COALESCE(_is_admin, false) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT jsonb_build_object(
    'total', COUNT(*),
    'available', COUNT(*) FILTER (WHERE status = 'available'),
    'assigned', COUNT(*) FILTER (WHERE status = 'assigned'),
    'reserved', COUNT(*) FILTER (WHERE status = 'reserved'),
    'disabled', COUNT(*) FILTER (WHERE status = 'disabled'),
    'expired', COUNT(*) FILTER (WHERE status = 'expired')
  )
  INTO _totals
  FROM public.inventory_items;

  WITH pool_avail AS (
    SELECT p.id,
           p.low_stock_threshold,
           p.is_active,
           COUNT(i.*) FILTER (WHERE i.status = 'available') AS available
    FROM public.inventory_pools p
    LEFT JOIN public.inventory_items i ON i.pool_id = p.id
    GROUP BY p.id
  )
  SELECT jsonb_build_object(
    'total_pools', COUNT(*),
    'out_of_stock_pools', COUNT(*) FILTER (WHERE is_active AND available = 0),
    'low_stock_pools', COUNT(*) FILTER (WHERE is_active AND available > 0 AND available <= COALESCE(low_stock_threshold, 10)),
    'disabled_pools', COUNT(*) FILTER (WHERE NOT is_active)
  )
  INTO _pool_stats
  FROM pool_avail;

  RETURN COALESCE(_totals, '{}'::jsonb) || COALESCE(_pool_stats, '{}'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_inventory_pool_stats()
RETURNS TABLE (
  pool_id uuid,
  pool_name text,
  inventory_type text,
  product_id uuid,
  product_name text,
  low_stock_threshold integer,
  is_active boolean,
  available bigint,
  assigned bigint,
  reserved bigint,
  disabled bigint,
  expired bigint,
  total bigint,
  last_assignment_at timestamptz,
  last_updated_at timestamptz,
  status text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT COALESCE(public.has_role(auth.uid(), 'admin'), false) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  RETURN QUERY
  SELECT p.id,
         p.name,
         p.inventory_type::text,
         p.product_id,
         pr.name,
         COALESCE(p.low_stock_threshold, 10),
         p.is_active,
         COUNT(i.*) FILTER (WHERE i.status = 'available')::bigint,
         COUNT(i.*) FILTER (WHERE i.status = 'assigned')::bigint,
         COUNT(i.*) FILTER (WHERE i.status = 'reserved')::bigint,
         COUNT(i.*) FILTER (WHERE i.status = 'disabled')::bigint,
         COUNT(i.*) FILTER (WHERE i.status = 'expired')::bigint,
         COUNT(i.*)::bigint,
         MAX(i.assigned_at),
         GREATEST(MAX(i.created_at), MAX(i.assigned_at), p.updated_at),
         CASE
           WHEN NOT p.is_active THEN 'disabled'
           WHEN COUNT(i.*) FILTER (WHERE i.status = 'available') = 0 THEN 'out_of_stock'
           WHEN COUNT(i.*) FILTER (WHERE i.status = 'available') <= COALESCE(p.low_stock_threshold, 10) THEN 'low_stock'
           ELSE 'healthy'
         END
  FROM public.inventory_pools p
  LEFT JOIN public.inventory_items i ON i.pool_id = p.id
  LEFT JOIN public.products pr ON pr.id = p.product_id
  GROUP BY p.id, pr.name
  ORDER BY p.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_inventory_recent_activity(_limit integer DEFAULT 30)
RETURNS TABLE (
  id uuid,
  action text,
  item_id uuid,
  pool_id uuid,
  pool_name text,
  actor_id uuid,
  actor_email text,
  meta jsonb,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT COALESCE(public.has_role(auth.uid(), 'admin'), false) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  RETURN QUERY
  SELECT l.id,
         l.action,
         l.item_id,
         i.pool_id,
         p.name,
         l.actor_id,
         u.email::text,
         l.meta,
         l.created_at
  FROM public.inventory_logs l
  LEFT JOIN public.inventory_items i ON i.id = l.item_id
  LEFT JOIN public.inventory_pools p ON p.id = i.pool_id
  LEFT JOIN auth.users u ON u.id = l.actor_id
  ORDER BY l.created_at DESC
  LIMIT GREATEST(1, LEAST(_limit, 200));
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_inventory_summary() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_inventory_pool_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_inventory_recent_activity(integer) TO authenticated;
