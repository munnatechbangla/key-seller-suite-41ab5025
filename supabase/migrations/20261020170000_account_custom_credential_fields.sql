ALTER TABLE public.inventory_items
  ADD COLUMN IF NOT EXISTS credential_fields jsonb NOT NULL DEFAULT '[]'::jsonb;
COMMENT ON COLUMN public.inventory_items.credential_fields IS
  'Account-workflow-only list of additional customer-facing credentials: [{"label":"Authenticator Code","value":"..."}]';