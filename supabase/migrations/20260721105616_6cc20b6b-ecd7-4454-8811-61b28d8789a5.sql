
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE public.manual_license_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  order_item_id uuid NOT NULL UNIQUE REFERENCES public.order_items(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  customer_id uuid,
  license_name text NOT NULL,
  license_key text NOT NULL,
  expiry_date date,
  platform text,
  instructions text,
  delivered_by uuid,
  delivered_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.manual_license_deliveries TO authenticated;
GRANT ALL ON public.manual_license_deliveries TO service_role;

ALTER TABLE public.manual_license_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage manual license deliveries"
  ON public.manual_license_deliveries
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Customers view own manual license deliveries"
  ON public.manual_license_deliveries
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = manual_license_deliveries.order_id
        AND o.user_id = auth.uid()
    )
  );

CREATE INDEX idx_manual_license_deliveries_order ON public.manual_license_deliveries(order_id);

CREATE TRIGGER trg_manual_license_deliveries_updated
  BEFORE UPDATE ON public.manual_license_deliveries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
