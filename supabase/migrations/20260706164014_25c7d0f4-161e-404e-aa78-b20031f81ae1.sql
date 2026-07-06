
-- =========================
-- ENUMS
-- =========================
DO $$ BEGIN
  CREATE TYPE public.subscription_account_status AS ENUM ('available','assigned','expired','disabled','maintenance');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.subscription_profile_status AS ENUM ('available','assigned','blocked');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.subscription_assignment_status AS ENUM ('active','expired','replaced','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.product_delivery_type AS ENUM ('license','download','subscription','manual','external');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.subscription_mode AS ENUM ('shared_account','individual_account','profile_based','email_password','activation_code','custom');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =========================
-- PRODUCTS additive columns (optional; existing flows unchanged)
-- =========================
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS delivery_type public.product_delivery_type,
  ADD COLUMN IF NOT EXISTS subscription_mode public.subscription_mode;

-- =========================
-- SUBSCRIPTION ACCOUNTS
-- =========================
CREATE TABLE IF NOT EXISTS public.subscription_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  provider text,
  account_email text NOT NULL,
  account_password_encrypted text,
  recovery_email text,
  recovery_password_encrypted text,
  two_factor_enabled boolean NOT NULL DEFAULT false,
  notes text,
  status public.subscription_account_status NOT NULL DEFAULT 'available',
  maximum_profiles integer NOT NULL DEFAULT 1,
  used_profiles integer NOT NULL DEFAULT 0,
  renewal_date timestamptz,
  expiry_date timestamptz,
  auto_renew boolean NOT NULL DEFAULT false,
  last_checked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscription_accounts TO authenticated;
GRANT ALL ON public.subscription_accounts TO service_role;

ALTER TABLE public.subscription_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_manage_subscription_accounts"
  ON public.subscription_accounts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE INDEX IF NOT EXISTS idx_sub_accounts_product ON public.subscription_accounts(product_id);
CREATE INDEX IF NOT EXISTS idx_sub_accounts_status ON public.subscription_accounts(status);
CREATE INDEX IF NOT EXISTS idx_sub_accounts_expiry ON public.subscription_accounts(expiry_date);

CREATE TRIGGER trg_sub_accounts_updated
  BEFORE UPDATE ON public.subscription_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================
-- SUBSCRIPTION PROFILES
-- =========================
CREATE TABLE IF NOT EXISTS public.subscription_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_account_id uuid NOT NULL REFERENCES public.subscription_accounts(id) ON DELETE CASCADE,
  profile_name text NOT NULL,
  pin_code text,
  avatar text,
  slot_number integer,
  status public.subscription_profile_status NOT NULL DEFAULT 'available',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (subscription_account_id, slot_number)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscription_profiles TO authenticated;
GRANT ALL ON public.subscription_profiles TO service_role;

ALTER TABLE public.subscription_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_manage_subscription_profiles"
  ON public.subscription_profiles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE INDEX IF NOT EXISTS idx_sub_profiles_account ON public.subscription_profiles(subscription_account_id);
CREATE INDEX IF NOT EXISTS idx_sub_profiles_status ON public.subscription_profiles(status);

CREATE TRIGGER trg_sub_profiles_updated
  BEFORE UPDATE ON public.subscription_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================
-- SUBSCRIPTION ASSIGNMENTS
-- =========================
CREATE TABLE IF NOT EXISTS public.subscription_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  order_item_id uuid REFERENCES public.order_items(id) ON DELETE SET NULL,
  customer_id uuid,
  email text,
  subscription_account_id uuid REFERENCES public.subscription_accounts(id) ON DELETE SET NULL,
  profile_id uuid REFERENCES public.subscription_profiles(id) ON DELETE SET NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  renewal_required boolean NOT NULL DEFAULT false,
  status public.subscription_assignment_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscription_assignments TO authenticated;
GRANT ALL ON public.subscription_assignments TO service_role;

ALTER TABLE public.subscription_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_manage_subscription_assignments"
  ON public.subscription_assignments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "customer_view_own_subscription_assignments"
  ON public.subscription_assignments FOR SELECT TO authenticated
  USING (customer_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_sub_assign_order ON public.subscription_assignments(order_id);
CREATE INDEX IF NOT EXISTS idx_sub_assign_customer ON public.subscription_assignments(customer_id);
CREATE INDEX IF NOT EXISTS idx_sub_assign_account ON public.subscription_assignments(subscription_account_id);
CREATE INDEX IF NOT EXISTS idx_sub_assign_status ON public.subscription_assignments(status);

CREATE TRIGGER trg_sub_assign_updated
  BEFORE UPDATE ON public.subscription_assignments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================
-- SUBSCRIPTION LOGS
-- =========================
CREATE TABLE IF NOT EXISTS public.subscription_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_account_id uuid REFERENCES public.subscription_accounts(id) ON DELETE SET NULL,
  profile_id uuid REFERENCES public.subscription_profiles(id) ON DELETE SET NULL,
  assignment_id uuid REFERENCES public.subscription_assignments(id) ON DELETE SET NULL,
  action text NOT NULL,
  actor_id uuid,
  message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.subscription_logs TO authenticated;
GRANT ALL ON public.subscription_logs TO service_role;

ALTER TABLE public.subscription_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_view_subscription_logs"
  ON public.subscription_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "admin_insert_subscription_logs"
  ON public.subscription_logs FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE INDEX IF NOT EXISTS idx_sub_logs_account ON public.subscription_logs(subscription_account_id);
CREATE INDEX IF NOT EXISTS idx_sub_logs_created ON public.subscription_logs(created_at DESC);

-- =========================
-- DASHBOARD STATS FUNCTION
-- =========================
CREATE OR REPLACE FUNCTION public.admin_subscription_dashboard()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE result jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  SELECT jsonb_build_object(
    'total_accounts', (SELECT count(*) FROM public.subscription_accounts),
    'available', (SELECT count(*) FROM public.subscription_accounts WHERE status = 'available'),
    'assigned', (SELECT count(*) FROM public.subscription_accounts WHERE status = 'assigned'),
    'disabled', (SELECT count(*) FROM public.subscription_accounts WHERE status = 'disabled'),
    'maintenance', (SELECT count(*) FROM public.subscription_accounts WHERE status = 'maintenance'),
    'expired', (SELECT count(*) FROM public.subscription_accounts WHERE status = 'expired' OR (expiry_date IS NOT NULL AND expiry_date < now())),
    'expiring_soon', (SELECT count(*) FROM public.subscription_accounts WHERE expiry_date IS NOT NULL AND expiry_date > now() AND expiry_date < now() + interval '7 days'),
    'replacement_queue', (SELECT count(*) FROM public.subscription_assignments WHERE renewal_required = true AND status = 'active'),
    'active_assignments', (SELECT count(*) FROM public.subscription_assignments WHERE status = 'active')
  ) INTO result;
  RETURN result;
END $$;

REVOKE ALL ON FUNCTION public.admin_subscription_dashboard() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_subscription_dashboard() TO authenticated;
