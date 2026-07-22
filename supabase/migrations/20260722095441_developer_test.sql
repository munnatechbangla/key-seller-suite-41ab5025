CREATE TABLE IF NOT EXISTS public.developer_test (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now()
);

GRANT ALL ON public.developer_test TO service_role;

ALTER TABLE public.developer_test ENABLE ROW LEVEL SECURITY;
