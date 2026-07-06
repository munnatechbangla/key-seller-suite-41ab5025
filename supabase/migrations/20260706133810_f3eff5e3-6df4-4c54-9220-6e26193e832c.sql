
CREATE TABLE public.order_custom_field_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  product_slug text,
  field_id uuid REFERENCES public.product_custom_fields(id) ON DELETE SET NULL,
  field_name text NOT NULL,
  field_label text NOT NULL,
  field_type text NOT NULL,
  value text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_id, product_id, field_name)
);

GRANT SELECT ON public.order_custom_field_values TO authenticated;
GRANT ALL ON public.order_custom_field_values TO service_role;

ALTER TABLE public.order_custom_field_values ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners read own order custom values"
  ON public.order_custom_field_values FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_custom_field_values.order_id
        AND o.user_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

CREATE POLICY "Admins manage order custom values"
  ON public.order_custom_field_values FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE INDEX idx_order_custom_field_values_order ON public.order_custom_field_values(order_id);

CREATE TRIGGER trg_order_custom_field_values_updated_at
  BEFORE UPDATE ON public.order_custom_field_values
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Save function: validates ownership + field rules
CREATE OR REPLACE FUNCTION public.save_order_custom_field_values(
  _order_id uuid,
  _values jsonb,
  _email text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  ord public.orders%ROWTYPE;
  entry jsonb;
  f public.product_custom_fields%ROWTYPE;
  v text;
  order_product_ids uuid[];
BEGIN
  SELECT * INTO ord FROM public.orders WHERE id = _order_id LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'order_not_found'); END IF;

  IF ord.user_id IS NOT NULL AND auth.uid() IS DISTINCT FROM ord.user_id
     AND NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    IF _email IS NULL OR ord.email IS NULL OR lower(_email) <> lower(ord.email) THEN
      RAISE EXCEPTION 'Forbidden';
    END IF;
  END IF;

  IF ord.user_id IS NULL AND _email IS NOT NULL AND ord.email IS NOT NULL
     AND lower(_email) <> lower(ord.email)
     AND NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT COALESCE(array_agg(DISTINCT oi.product_id), '{}'::uuid[])
    INTO order_product_ids
    FROM public.order_items oi WHERE oi.order_id = _order_id;

  FOR entry IN SELECT * FROM jsonb_array_elements(COALESCE(_values, '[]'::jsonb)) LOOP
    SELECT * INTO f FROM public.product_custom_fields
      WHERE id = NULLIF(entry->>'field_id','')::uuid LIMIT 1;
    IF NOT FOUND THEN CONTINUE; END IF;
    IF NOT f.is_enabled THEN CONTINUE; END IF;
    IF NOT (f.product_id = ANY(order_product_ids)) THEN CONTINUE; END IF;

    v := NULLIF(entry->>'value','');

    IF f.is_required AND (v IS NULL OR length(trim(v)) = 0) THEN
      RAISE EXCEPTION 'field_required:%', f.name;
    END IF;

    IF v IS NOT NULL THEN
      IF f.min_length IS NOT NULL AND length(v) < f.min_length THEN
        RAISE EXCEPTION 'field_min_length:%', f.name;
      END IF;
      IF f.max_length IS NOT NULL AND length(v) > f.max_length THEN
        RAISE EXCEPTION 'field_max_length:%', f.name;
      END IF;
      IF f.regex_pattern IS NOT NULL AND v !~ f.regex_pattern THEN
        RAISE EXCEPTION 'field_regex:%', f.name;
      END IF;
      IF f.field_type::text = 'email' AND v !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
        RAISE EXCEPTION 'field_email:%', f.name;
      END IF;
      IF f.field_type::text = 'url' AND v !~* '^https?://' THEN
        RAISE EXCEPTION 'field_url:%', f.name;
      END IF;
      IF f.field_type::text = 'number' AND v !~ '^-?[0-9]+(\.[0-9]+)?$' THEN
        RAISE EXCEPTION 'field_number:%', f.name;
      END IF;
    END IF;

    INSERT INTO public.order_custom_field_values(
      order_id, product_id, product_slug, field_id, field_name, field_label, field_type, value
    ) VALUES (
      _order_id, f.product_id,
      (SELECT slug FROM public.products WHERE id = f.product_id),
      f.id, f.name, f.label, f.field_type::text, v
    )
    ON CONFLICT (order_id, product_id, field_name) DO UPDATE
      SET value = EXCLUDED.value,
          field_label = EXCLUDED.field_label,
          field_type = EXCLUDED.field_type,
          field_id = EXCLUDED.field_id,
          updated_at = now();
  END LOOP;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- Read function
CREATE OR REPLACE FUNCTION public.get_order_custom_field_values(
  _order_id uuid,
  _email text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  ord public.orders%ROWTYPE;
  rows jsonb;
BEGIN
  SELECT * INTO ord FROM public.orders WHERE id = _order_id LIMIT 1;
  IF NOT FOUND THEN RETURN '[]'::jsonb; END IF;

  IF ord.user_id IS NOT NULL AND auth.uid() IS DISTINCT FROM ord.user_id
     AND NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    IF _email IS NULL OR ord.email IS NULL OR lower(_email) <> lower(ord.email) THEN
      RAISE EXCEPTION 'Forbidden';
    END IF;
  END IF;

  IF ord.user_id IS NULL AND _email IS NOT NULL AND ord.email IS NOT NULL
     AND lower(_email) <> lower(ord.email)
     AND NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(v) ORDER BY v.product_slug, v.field_name), '[]'::jsonb)
    INTO rows
    FROM public.order_custom_field_values v
    WHERE v.order_id = _order_id;
  RETURN rows;
END;
$$;

-- Admin update
CREATE OR REPLACE FUNCTION public.admin_update_order_custom_field_value(
  _id uuid,
  _value text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  UPDATE public.order_custom_field_values SET value = _value, updated_at = now() WHERE id = _id;
  RETURN jsonb_build_object('ok', true);
END;
$$;
