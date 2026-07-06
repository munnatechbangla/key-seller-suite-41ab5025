-- Regression fix: RLS policies across public tables (products, categories, etc.)
-- reference public.has_role() in their USING clauses. The prior security
-- lockdown revoked EXECUTE from anon, so any anonymous SELECT that hits a
-- policy calling has_role() now errors with "permission denied for function
-- has_role", crashing the homepage. Re-grant EXECUTE to anon for the
-- helper functions that RLS policies invoke. This does NOT weaken RLS:
-- has_role only returns booleans about role membership; the policies still
-- enforce access.

DO $$
DECLARE
  sig text;
BEGIN
  FOR sig IN
    SELECT format('%I.%I(%s)', n.nspname, p.proname, pg_get_function_identity_arguments(p.oid))
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname IN ('has_role', 'user_purchased_product')
  LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon, authenticated', sig);
  END LOOP;
END $$;
