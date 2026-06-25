
-- Setup state singleton
CREATE TABLE public.setup_state (
  id smallint PRIMARY KEY DEFAULT 1,
  is_completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  version integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT setup_state_singleton CHECK (id = 1)
);

GRANT SELECT ON public.setup_state TO anon, authenticated;
GRANT ALL ON public.setup_state TO service_role;

ALTER TABLE public.setup_state ENABLE ROW LEVEL SECURITY;

-- Anyone can read the singleton (only contains booleans + timestamps, no secrets)
CREATE POLICY "Public reads setup state"
  ON public.setup_state FOR SELECT
  USING (true);

-- Only admins can update or insert it
CREATE POLICY "Admins write setup state"
  ON public.setup_state FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_setup_state_updated_at
  BEFORE UPDATE ON public.setup_state
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed singleton row
INSERT INTO public.setup_state (id, is_completed) VALUES (1, false)
  ON CONFLICT (id) DO NOTHING;

-- First-admin claim: signed-in user becomes admin ONLY if no admin exists yet
-- and setup is not yet completed. Otherwise no-op.
CREATE OR REPLACE FUNCTION public.claim_first_admin()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  admin_exists boolean;
  is_done boolean;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  SELECT is_completed INTO is_done FROM public.setup_state WHERE id = 1;
  IF COALESCE(is_done, false) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'setup_already_completed');
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') INTO admin_exists;
  IF admin_exists THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'admin_exists');
  END IF;

  INSERT INTO public.user_roles (user_id, role)
    VALUES (uid, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;

  RETURN jsonb_build_object('ok', true, 'user_id', uid);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.claim_first_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_first_admin() TO authenticated;
