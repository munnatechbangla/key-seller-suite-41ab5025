-- Enums
CREATE TYPE public.order_status AS ENUM ('pending','paid','processing','completed','cancelled','refunded');
CREATE TYPE public.payment_status AS ENUM ('pending','paid','failed','refunded');
CREATE TYPE public.license_key_status AS ENUM ('available','assigned','revoked');

-- ORDERS
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT NOT NULL UNIQUE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  customer_name TEXT,
  phone TEXT,
  country TEXT,
  address TEXT,
  notes TEXT,
  status public.order_status NOT NULL DEFAULT 'pending',
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  coupon_code TEXT,
  payment_method TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.orders TO authenticated;
GRANT INSERT ON public.orders TO anon;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own orders" ON public.orders FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Users create own orders" ON public.orders FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "Guests create orders" ON public.orders FOR INSERT TO anon WITH CHECK (user_id IS NULL);
CREATE POLICY "Admins manage orders" ON public.orders FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER orders_updated BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ORDER ITEMS
CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_slug TEXT NOT NULL,
  product_name TEXT NOT NULL,
  unit_price NUMERIC(12,2) NOT NULL,
  qty INTEGER NOT NULL DEFAULT 1,
  line_total NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.order_items TO authenticated;
GRANT INSERT ON public.order_items TO anon;
GRANT ALL ON public.order_items TO service_role;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View own order items" ON public.order_items FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND (o.user_id = auth.uid() OR public.has_role(auth.uid(),'admin'))));
CREATE POLICY "Insert order items auth" ON public.order_items FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND (o.user_id = auth.uid() OR o.user_id IS NULL)));
CREATE POLICY "Insert order items anon" ON public.order_items FOR INSERT TO anon WITH CHECK (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.user_id IS NULL));

-- PAYMENTS
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  method TEXT NOT NULL,
  status public.payment_status NOT NULL DEFAULT 'pending',
  provider_ref TEXT,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.payments TO authenticated;
GRANT INSERT ON public.payments TO anon;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View own payments" ON public.payments FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND (o.user_id = auth.uid() OR public.has_role(auth.uid(),'admin'))));
CREATE POLICY "Insert payments auth" ON public.payments FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND (o.user_id = auth.uid() OR o.user_id IS NULL)));
CREATE POLICY "Insert payments anon" ON public.payments FOR INSERT TO anon WITH CHECK (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.user_id IS NULL));
CREATE TRIGGER payments_updated BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- LICENSE POOLS
CREATE TABLE public.license_pools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.license_pools TO authenticated;
GRANT ALL ON public.license_pools TO service_role;
ALTER TABLE public.license_pools ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage pools" ON public.license_pools FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER license_pools_updated BEFORE UPDATE ON public.license_pools FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- LICENSE KEYS
CREATE TABLE public.license_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id UUID NOT NULL REFERENCES public.license_pools(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  key_value TEXT NOT NULL UNIQUE,
  status public.license_key_status NOT NULL DEFAULT 'available',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.license_keys TO authenticated;
GRANT ALL ON public.license_keys TO service_role;
ALTER TABLE public.license_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage keys" ON public.license_keys FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER license_keys_updated BEFORE UPDATE ON public.license_keys FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- LICENSE ASSIGNMENTS
CREATE TABLE public.license_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id UUID NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  license_key_id UUID NOT NULL REFERENCES public.license_keys(id) ON DELETE RESTRICT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ
);
GRANT SELECT ON public.license_assignments TO authenticated;
GRANT ALL ON public.license_assignments TO service_role;
ALTER TABLE public.license_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View own assignments" ON public.license_assignments FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- DOWNLOADS
CREATE TABLE public.downloads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id UUID NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  file_url TEXT,
  download_count INTEGER NOT NULL DEFAULT 0,
  max_downloads INTEGER NOT NULL DEFAULT 5,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.downloads TO authenticated;
GRANT ALL ON public.downloads TO service_role;
ALTER TABLE public.downloads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View own downloads" ON public.downloads FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Update own downloads" ON public.downloads FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE TRIGGER downloads_updated BEFORE UPDATE ON public.downloads FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Order number generator
CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS TEXT LANGUAGE plpgsql SET search_path = public AS $$
DECLARE n TEXT;
BEGIN
  n := 'TH-' || to_char(now(),'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
  RETURN n;
END;$$;

-- License assignment function
CREATE OR REPLACE FUNCTION public.assign_licenses_for_order(_order_id UUID)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  item RECORD;
  i INTEGER;
  key_row RECORD;
  assigned INTEGER := 0;
  ord RECORD;
BEGIN
  SELECT * INTO ord FROM public.orders WHERE id = _order_id;
  IF NOT FOUND THEN RETURN 0; END IF;

  FOR item IN SELECT * FROM public.order_items WHERE order_id = _order_id LOOP
    FOR i IN 1..item.qty LOOP
      SELECT lk.* INTO key_row FROM public.license_keys lk
        WHERE lk.product_id = item.product_id AND lk.status = 'available'
        ORDER BY lk.created_at LIMIT 1 FOR UPDATE SKIP LOCKED;
      IF FOUND THEN
        UPDATE public.license_keys SET status='assigned' WHERE id = key_row.id;
        INSERT INTO public.license_assignments(order_item_id, order_id, license_key_id, user_id)
          VALUES (item.id, _order_id, key_row.id, ord.user_id);
        assigned := assigned + 1;
      END IF;
    END LOOP;

    INSERT INTO public.downloads(order_item_id, order_id, user_id, product_id, expires_at)
    VALUES (item.id, _order_id, ord.user_id, item.product_id, now() + interval '30 days');
  END LOOP;

  RETURN assigned;
END;$$;

GRANT EXECUTE ON FUNCTION public.assign_licenses_for_order(UUID) TO authenticated, anon, service_role;

CREATE INDEX idx_orders_user ON public.orders(user_id);
CREATE INDEX idx_order_items_order ON public.order_items(order_id);
CREATE INDEX idx_payments_order ON public.payments(order_id);
CREATE INDEX idx_license_keys_product_status ON public.license_keys(product_id, status);
CREATE INDEX idx_license_assignments_user ON public.license_assignments(user_id);
CREATE INDEX idx_downloads_user ON public.downloads(user_id);