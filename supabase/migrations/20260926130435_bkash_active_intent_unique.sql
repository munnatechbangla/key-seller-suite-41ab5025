CREATE UNIQUE INDEX IF NOT EXISTS payment_intents_bkash_one_active_per_order
  ON public.payment_intents (order_id)
  WHERE gateway = 'bkash' AND status = 'bkash_active';