-- 1. Secondary Landing Page Tables
CREATE TABLE IF NOT EXISTS public.landing_page_sections (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    page_id uuid REFERENCES public.landing_pages(id) ON DELETE CASCADE,
    section_key text NOT NULL,
    section_type text NOT NULL,
    title text,
    json_content jsonb DEFAULT '{}'::jsonb,
    sort_order int DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now()
);

-- 2. Email Logs extension
ALTER TABLE public.email_logs 
  ADD COLUMN IF NOT EXISTS attempts int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_attempt_at timestamptz;

-- 3. Product Reviews extensions
ALTER TABLE public.product_reviews
  ADD COLUMN IF NOT EXISTS product_name text,
  ADD COLUMN IF NOT EXISTS product_slug text;

-- 4. User Roles extensions
ALTER TABLE public.user_roles 
  ADD COLUMN IF NOT EXISTS permissions jsonb DEFAULT '[]'::jsonb;

-- 5. RPC Search Path and Security Polish
ALTER FUNCTION public.has_role(uuid, public.app_role) SET search_path = public;
ALTER FUNCTION public.list_recent_public_purchases() SET search_path = public;
ALTER FUNCTION public.start_fulfillment_for_order(uuid) SET search_path = public;
ALTER FUNCTION public.validate_coupon(text, uuid, numeric) SET search_path = public;
ALTER FUNCTION public.get_order_fulfillments(uuid) SET search_path = public;
ALTER FUNCTION public.get_fulfillment_timeline(uuid) SET search_path = public;
ALTER FUNCTION public.admin_retry_fulfillment(uuid) SET search_path = public;
ALTER FUNCTION public.admin_restart_fulfillment(uuid) SET search_path = public;
ALTER FUNCTION public.admin_cancel_fulfillment(uuid) SET search_path = public;
ALTER FUNCTION public.admin_mark_subscription_delivered(uuid) SET search_path = public;
ALTER FUNCTION public.admin_list_inventory_pools() SET search_path = public;

-- 6. ENABLE RLS EVERYWHERE (Mass resolve ERROR 3)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE 'ALTER TABLE public.' || quote_ident(r.tablename) || ' ENABLE ROW LEVEL SECURITY';
    END LOOP;
END $$;

-- 7. DEFAULT POLICIES (Mass resolve INFO 1)
-- Admins can do everything
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Admins have full access" ON public.%I', r.tablename);
        EXECUTE format('CREATE POLICY "Admins have full access" ON public.%I FOR ALL TO authenticated USING (public.has_role(auth.uid(), ''admin''))', r.tablename);
    END LOOP;
END $$;

-- 8. GRANTS
GRANT ALL ON public.landing_page_sections TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.landing_page_sections TO authenticated;
GRANT SELECT ON public.landing_page_sections TO anon;
