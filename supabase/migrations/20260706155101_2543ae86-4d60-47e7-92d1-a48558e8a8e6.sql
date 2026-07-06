
-- Lock down SECURITY DEFINER functions in public schema.
-- Revoke EXECUTE from PUBLIC/anon/authenticated, then grant back explicitly.

DO $$
DECLARE
  fn record;
  sig text;
  anon_public text[] := ARRAY[
    'validate_coupon','subscribe_newsletter','list_public_payment_gateways',
    'list_recent_public_purchases','get_order_summary_by_number',
    'get_order_custom_field_values','save_order_custom_field_values',
    'submit_manual_payment_proof','place_order','process_payment_callback',
    'log_payment_event','claim_webhook_event','get_order_basic_by_number',
    'insert_audit_log','get_latest_payment_intent','update_payment_intent_status'
  ];
  authed_only text[] := ARRAY[
    'has_role','user_purchased_product','claim_first_admin',
    'admin_bulk_import_inventory','admin_get_asset_usage',
    'admin_inventory_pool_stats','admin_inventory_recent_activity',
    'admin_inventory_summary','admin_list_inventory_pools',
    'admin_list_media_assets','admin_mark_order_paid',
    'admin_release_inventory_assignment','admin_replace_inventory_assignment',
    'admin_update_order_custom_field_value'
  ];
BEGIN
  FOR fn IN
    SELECT n.nspname AS schema, p.proname AS name,
           pg_get_function_identity_arguments(p.oid) AS args
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.prosecdef = true
  LOOP
    sig := format('%I.%I(%s)', fn.schema, fn.name, fn.args);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', sig);

    IF fn.name = ANY(anon_public) THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon, authenticated', sig);
    ELSIF fn.name = ANY(authed_only) THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', sig);
    END IF;
  END LOOP;
END $$;
