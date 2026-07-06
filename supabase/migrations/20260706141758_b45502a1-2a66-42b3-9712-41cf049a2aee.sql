
-- Enums
DO $$ BEGIN
  CREATE TYPE public.inventory_type AS ENUM ('license_key','account','download_token','api_key','gift_code','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.inventory_item_status AS ENUM ('available','reserved','assigned','expired','disabled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Pools
CREATE TABLE IF NOT EXISTS public.inventory_pools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  inventory_type public.inventory_type NOT NULL DEFAULT 'license_key',
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  variation_id uuid REFERENCES public.product_variations(id) ON DELETE SET NULL,
  low_stock_threshold int NOT NULL DEFAULT 5,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_pools TO authenticated;
GRANT ALL ON public.inventory_pools TO service_role;
ALTER TABLE public.inventory_pools ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage inventory pools" ON public.inventory_pools
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role));

CREATE INDEX IF NOT EXISTS idx_inventory_pools_product ON public.inventory_pools(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_pools_variation ON public.inventory_pools(variation_id);

-- Items
CREATE TABLE IF NOT EXISTS public.inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id uuid NOT NULL REFERENCES public.inventory_pools(id) ON DELETE CASCADE,
  inventory_type public.inventory_type NOT NULL DEFAULT 'license_key',
  value text NOT NULL,
  username text,
  password text,
  notes text,
  status public.inventory_item_status NOT NULL DEFAULT 'available',
  expires_at timestamptz,
  assigned_order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  assigned_user_id uuid,
  assigned_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_items TO authenticated;
GRANT ALL ON public.inventory_items TO service_role;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage inventory items" ON public.inventory_items
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role));

CREATE UNIQUE INDEX IF NOT EXISTS uq_inventory_items_pool_value ON public.inventory_items(pool_id, value);
CREATE INDEX IF NOT EXISTS idx_inventory_items_pool_status ON public.inventory_items(pool_id, status);
CREATE INDEX IF NOT EXISTS idx_inventory_items_status ON public.inventory_items(status);
CREATE INDEX IF NOT EXISTS idx_inventory_items_assigned_order ON public.inventory_items(assigned_order_id);

-- Assignments
CREATE TABLE IF NOT EXISTS public.inventory_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  order_item_id uuid REFERENCES public.order_items(id) ON DELETE SET NULL,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  pool_id uuid REFERENCES public.inventory_pools(id) ON DELETE SET NULL,
  item_id uuid REFERENCES public.inventory_items(id) ON DELETE SET NULL,
  user_id uuid,
  email text,
  status text NOT NULL DEFAULT 'active',
  assigned_at timestamptz NOT NULL DEFAULT now(),
  released_at timestamptz,
  replaced_by_assignment_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_assignments TO authenticated;
GRANT ALL ON public.inventory_assignments TO service_role;
ALTER TABLE public.inventory_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage inventory assignments" ON public.inventory_assignments
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role));

CREATE INDEX IF NOT EXISTS idx_inventory_assignments_order ON public.inventory_assignments(order_id);
CREATE INDEX IF NOT EXISTS idx_inventory_assignments_user ON public.inventory_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_inventory_assignments_item ON public.inventory_assignments(item_id);

-- Logs
CREATE TABLE IF NOT EXISTS public.inventory_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id uuid REFERENCES public.inventory_pools(id) ON DELETE SET NULL,
  item_id uuid REFERENCES public.inventory_items(id) ON DELETE SET NULL,
  assignment_id uuid REFERENCES public.inventory_assignments(id) ON DELETE SET NULL,
  action text NOT NULL,
  actor_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_logs TO authenticated;
GRANT ALL ON public.inventory_logs TO service_role;
ALTER TABLE public.inventory_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view inventory logs" ON public.inventory_logs
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role));

CREATE INDEX IF NOT EXISTS idx_inventory_logs_pool ON public.inventory_logs(pool_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_logs_item ON public.inventory_logs(item_id, created_at DESC);

-- updated_at triggers
DROP TRIGGER IF EXISTS trg_inventory_pools_updated ON public.inventory_pools;
CREATE TRIGGER trg_inventory_pools_updated BEFORE UPDATE ON public.inventory_pools
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_inventory_items_updated ON public.inventory_items;
CREATE TRIGGER trg_inventory_items_updated BEFORE UPDATE ON public.inventory_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Pool stats helper
CREATE OR REPLACE FUNCTION public.admin_list_inventory_pools()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE rows jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin'::public.app_role) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.created_at DESC), '[]'::jsonb) INTO rows FROM (
    SELECT p.*,
      pr.title AS product_title, pr.slug AS product_slug,
      (SELECT count(*) FROM public.inventory_items i WHERE i.pool_id = p.id) AS total_items,
      (SELECT count(*) FROM public.inventory_items i WHERE i.pool_id = p.id AND i.status = 'available') AS available_items,
      (SELECT count(*) FROM public.inventory_items i WHERE i.pool_id = p.id AND i.status = 'assigned') AS assigned_items,
      (SELECT count(*) FROM public.inventory_items i WHERE i.pool_id = p.id AND i.status = 'disabled') AS disabled_items
    FROM public.inventory_pools p
    LEFT JOIN public.products pr ON pr.id = p.product_id
  ) t;
  RETURN rows;
END; $$;

-- Bulk import (dedupes; returns counts)
CREATE OR REPLACE FUNCTION public.admin_bulk_import_inventory(_pool_id uuid, _items jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  p public.inventory_pools%ROWTYPE;
  entry jsonb;
  inserted int := 0;
  skipped int := 0;
  v text;
  u text;
  pw text;
  n text;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin'::public.app_role) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  SELECT * INTO p FROM public.inventory_pools WHERE id = _pool_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'pool_not_found'; END IF;

  FOR entry IN SELECT * FROM jsonb_array_elements(COALESCE(_items,'[]'::jsonb)) LOOP
    v := NULLIF(trim(entry->>'value'),'');
    IF v IS NULL THEN skipped := skipped + 1; CONTINUE; END IF;
    u := NULLIF(entry->>'username','');
    pw := NULLIF(entry->>'password','');
    n := NULLIF(entry->>'notes','');
    BEGIN
      INSERT INTO public.inventory_items(pool_id, inventory_type, value, username, password, notes, created_by)
      VALUES (_pool_id, p.inventory_type, v, u, pw, n, auth.uid());
      inserted := inserted + 1;
    EXCEPTION WHEN unique_violation THEN
      skipped := skipped + 1;
    END;
  END LOOP;

  INSERT INTO public.inventory_logs(pool_id, action, actor_id, metadata)
  VALUES (_pool_id, 'import', auth.uid(), jsonb_build_object('inserted', inserted, 'skipped', skipped));

  RETURN jsonb_build_object('ok', true, 'inserted', inserted, 'skipped', skipped);
END; $$;

-- Auto-assign inventory for a paid order (safe to call from mark_order_paid)
CREATE OR REPLACE FUNCTION public.assign_inventory_for_order(_order_id uuid)
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  ord public.orders%ROWTYPE;
  item RECORD;
  i int;
  inv RECORD;
  pool_row public.inventory_pools%ROWTYPE;
  assigned_count int := 0;
  new_assignment_id uuid;
BEGIN
  SELECT * INTO ord FROM public.orders WHERE id = _order_id;
  IF NOT FOUND THEN RETURN 0; END IF;

  FOR item IN SELECT * FROM public.order_items WHERE order_id = _order_id LOOP
    SELECT * INTO pool_row FROM public.inventory_pools
      WHERE product_id = item.product_id AND is_active = true
      ORDER BY created_at ASC LIMIT 1;
    IF NOT FOUND THEN CONTINUE; END IF;

    FOR i IN 1..item.qty LOOP
      -- skip if already assigned for this order_item slot
      IF (SELECT count(*) FROM public.inventory_assignments
          WHERE order_item_id = item.id AND status = 'active') >= item.qty THEN
        EXIT;
      END IF;

      SELECT * INTO inv FROM public.inventory_items
        WHERE pool_id = pool_row.id AND status = 'available'
        ORDER BY created_at ASC LIMIT 1 FOR UPDATE SKIP LOCKED;
      IF NOT FOUND THEN EXIT; END IF;

      UPDATE public.inventory_items
        SET status = 'assigned',
            assigned_order_id = _order_id,
            assigned_user_id = ord.user_id,
            assigned_at = now()
      WHERE id = inv.id;

      INSERT INTO public.inventory_assignments(order_id, order_item_id, product_id, pool_id, item_id, user_id, email)
      VALUES (_order_id, item.id, item.product_id, pool_row.id, inv.id, ord.user_id, ord.email)
      RETURNING id INTO new_assignment_id;

      INSERT INTO public.inventory_logs(pool_id, item_id, assignment_id, action, actor_id, metadata)
      VALUES (pool_row.id, inv.id, new_assignment_id, 'assign', NULL, jsonb_build_object('order_id', _order_id));

      assigned_count := assigned_count + 1;
    END LOOP;
  END LOOP;

  RETURN assigned_count;
END; $$;

-- Hook auto-assignment into mark_order_paid (append-only; does not change payment logic)
CREATE OR REPLACE FUNCTION public.mark_order_paid(_order_id uuid, _transaction_id text, _gateway_response jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  ord RECORD;
  pay RECORD;
  assigned INT := 0;
  inv_assigned INT := 0;
BEGIN
  SELECT * INTO ord FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'order_not_found'); END IF;

  IF ord.status = 'paid' THEN
    RETURN jsonb_build_object('ok', true, 'already', true, 'order_id', _order_id);
  END IF;

  IF _transaction_id IS NOT NULL THEN
    PERFORM 1 FROM public.payments WHERE transaction_id = _transaction_id AND order_id <> _order_id;
    IF FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'duplicate_transaction'); END IF;
  END IF;

  SELECT * INTO pay FROM public.payments WHERE order_id = _order_id ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
  IF FOUND THEN
    UPDATE public.payments
      SET status = 'paid', paid_at = now(),
          transaction_id = COALESCE(_transaction_id, transaction_id),
          gateway_response = COALESCE(_gateway_response, gateway_response),
          provider_ref = COALESCE(_transaction_id, provider_ref)
      WHERE id = pay.id;
  ELSE
    INSERT INTO public.payments(order_id, amount, currency, method, status, paid_at, transaction_id, gateway_response, provider_ref)
    VALUES (_order_id, ord.total, ord.currency, COALESCE(ord.payment_method,'unknown'), 'paid', now(), _transaction_id, _gateway_response, _transaction_id);
  END IF;

  UPDATE public.orders SET status = 'paid' WHERE id = _order_id;

  SELECT public.assign_licenses_for_order(_order_id) INTO assigned;
  SELECT public.assign_inventory_for_order(_order_id) INTO inv_assigned;

  RETURN jsonb_build_object('ok', true, 'order_id', _order_id, 'licenses_assigned', assigned, 'inventory_assigned', inv_assigned);
END;
$function$;

-- Admin action helpers
CREATE OR REPLACE FUNCTION public.admin_release_inventory_assignment(_assignment_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a public.inventory_assignments%ROWTYPE;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin'::public.app_role) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  SELECT * INTO a FROM public.inventory_assignments WHERE id = _assignment_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  UPDATE public.inventory_assignments SET status='released', released_at=now() WHERE id = _assignment_id;
  IF a.item_id IS NOT NULL THEN
    UPDATE public.inventory_items SET status='available', assigned_order_id=NULL, assigned_user_id=NULL, assigned_at=NULL WHERE id = a.item_id;
  END IF;
  INSERT INTO public.inventory_logs(pool_id,item_id,assignment_id,action,actor_id) VALUES (a.pool_id,a.item_id,a.id,'release',auth.uid());
  RETURN jsonb_build_object('ok', true);
END; $$;

CREATE OR REPLACE FUNCTION public.admin_replace_inventory_assignment(_assignment_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  a public.inventory_assignments%ROWTYPE;
  new_item RECORD;
  new_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin'::public.app_role) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  SELECT * INTO a FROM public.inventory_assignments WHERE id = _assignment_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;

  SELECT * INTO new_item FROM public.inventory_items
    WHERE pool_id = a.pool_id AND status='available'
    ORDER BY created_at ASC LIMIT 1 FOR UPDATE SKIP LOCKED;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason','no_available_inventory'); END IF;

  UPDATE public.inventory_assignments SET status='replaced', released_at=now() WHERE id = _assignment_id;
  IF a.item_id IS NOT NULL THEN
    UPDATE public.inventory_items SET status='disabled' WHERE id = a.item_id;
  END IF;

  UPDATE public.inventory_items
    SET status='assigned', assigned_order_id=a.order_id, assigned_user_id=a.user_id, assigned_at=now()
  WHERE id = new_item.id;

  INSERT INTO public.inventory_assignments(order_id,order_item_id,product_id,pool_id,item_id,user_id,email)
  VALUES (a.order_id,a.order_item_id,a.product_id,a.pool_id,new_item.id,a.user_id,a.email)
  RETURNING id INTO new_id;

  UPDATE public.inventory_assignments SET replaced_by_assignment_id = new_id WHERE id = _assignment_id;

  INSERT INTO public.inventory_logs(pool_id,item_id,assignment_id,action,actor_id,metadata)
  VALUES (a.pool_id,new_item.id,new_id,'replace',auth.uid(), jsonb_build_object('previous', _assignment_id));

  RETURN jsonb_build_object('ok', true, 'assignment_id', new_id);
END; $$;
