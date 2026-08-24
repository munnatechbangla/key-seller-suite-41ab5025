-- 1. Landing Page Sections
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

-- 2. Column Fixes
ALTER TABLE public.email_logs 
  ADD COLUMN IF NOT EXISTS attempts int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_attempt_at timestamptz;

ALTER TABLE public.product_reviews
  ADD COLUMN IF NOT EXISTS product_name text,
  ADD COLUMN IF NOT EXISTS product_slug text;

ALTER TABLE public.user_roles 
  ADD COLUMN IF NOT EXISTS permissions jsonb DEFAULT '[]'::jsonb;

-- 3. Function placeholders (to ensure they exist before ALTER)
CREATE OR REPLACE FUNCTION public.list_recent_public_purchases()
RETURNS jsonb LANGUAGE plpgsql AS $$ BEGIN RETURN '[]'::jsonb; END; $$;

CREATE OR REPLACE FUNCTION public.start_fulfillment_for_order(_order_id uuid)
RETURNS void LANGUAGE plpgsql AS $$ BEGIN RETURN; END; $$;

-- 4. RPC Security (Search Path)
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

-- 5. ENABLE RLS EVERYWHERE
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE 'ALTER TABLE public.' || quote_ident(r.tablename) || ' ENABLE ROW LEVEL SECURITY';
    END LOOP;
END $$;

-- 6. DEFAULT POLICIES
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Admins have full access" ON public.%I', r.tablename);
        EXECUTE format('CREATE POLICY "Admins have full access" ON public.%I FOR ALL TO authenticated USING (public.has_role(auth.uid(), ''admin''))', r.tablename);
    END LOOP;
END $$;

-- 7. GRANTS
GRANT ALL ON public.landing_page_sections TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.landing_page_sections TO authenticated;
GRANT SELECT ON public.landing_page_sections TO anon;
