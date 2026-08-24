-- 1. Newsletter
CREATE TABLE IF NOT EXISTS public.newsletter_subscribers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email text NOT NULL UNIQUE,
    status text DEFAULT 'active',
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now()
);

-- 2. Payment Logs and Gateways
CREATE TABLE IF NOT EXISTS public.payment_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE,
    gateway text,
    event_type text,
    payload jsonb DEFAULT '{}'::jsonb,
    status text,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.payment_gateways (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    slug text NOT NULL UNIQUE,
    type text NOT NULL,
    config jsonb DEFAULT '{}'::jsonb,
    is_active boolean DEFAULT true,
    sort_order int DEFAULT 0,
    created_at timestamptz DEFAULT now()
);

-- 3. RLS
ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_gateways ENABLE ROW LEVEL SECURITY;

-- 4. Policies (Idempotent)
DROP POLICY IF EXISTS "Admins have full access" ON public.newsletter_subscribers;
CREATE POLICY "Admins have full access" ON public.newsletter_subscribers FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins have full access" ON public.payment_logs;
CREATE POLICY "Admins have full access" ON public.payment_logs FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins have full access" ON public.payment_gateways;
CREATE POLICY "Admins have full access" ON public.payment_gateways FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 5. GRANTS
GRANT ALL ON public.newsletter_subscribers, public.payment_logs, public.payment_gateways TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.newsletter_subscribers, public.payment_logs, public.payment_gateways TO authenticated;
GRANT SELECT ON public.newsletter_subscribers, public.payment_gateways TO anon;
