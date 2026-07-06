
-- ============ Communication settings (singleton) ============
CREATE TABLE IF NOT EXISTS public.communication_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  email_provider TEXT NOT NULL DEFAULT 'resend' CHECK (email_provider IN ('resend','smtp','none')),
  email_from_name TEXT,
  email_from_address TEXT,
  email_reply_to TEXT,
  smtp_host TEXT,
  smtp_port INTEGER,
  smtp_username TEXT,
  smtp_password TEXT,
  smtp_secure BOOLEAN NOT NULL DEFAULT true,
  whatsapp_provider TEXT NOT NULL DEFAULT 'meta' CHECK (whatsapp_provider IN ('meta','none')),
  whatsapp_phone_number_id TEXT,
  whatsapp_business_account_id TEXT,
  whatsapp_access_token TEXT,
  whatsapp_verify_token TEXT,
  whatsapp_test_number TEXT,
  max_retries INTEGER NOT NULL DEFAULT 3,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (id = 'default')
);
GRANT SELECT, INSERT, UPDATE ON public.communication_settings TO authenticated;
GRANT ALL ON public.communication_settings TO service_role;
ALTER TABLE public.communication_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage communication settings" ON public.communication_settings;
CREATE POLICY "Admins manage communication settings"
  ON public.communication_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS trg_communication_settings_updated ON public.communication_settings;
CREATE TRIGGER trg_communication_settings_updated
BEFORE UPDATE ON public.communication_settings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.communication_settings (id) VALUES ('default')
ON CONFLICT (id) DO NOTHING;

-- ============ Enqueue helper ============
CREATE OR REPLACE FUNCTION public.enqueue_notification(
  _event_key TEXT,
  _channel TEXT,
  _recipient TEXT,
  _payload JSONB
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tpl RECORD;
  new_id UUID;
  rendered_subj TEXT;
  rendered_body TEXT;
BEGIN
  IF _recipient IS NULL OR length(trim(_recipient)) = 0 THEN
    RETURN NULL;
  END IF;

  SELECT * INTO tpl FROM public.notification_templates
   WHERE event_key = _event_key AND channel = _channel AND is_enabled = true
   ORDER BY updated_at DESC LIMIT 1;

  IF NOT FOUND THEN
    -- No template configured yet: still enqueue a bare row so admins see the event.
    rendered_subj := NULL;
    rendered_body := '';
  ELSE
    rendered_subj := tpl.subject;
    rendered_body := COALESCE(tpl.body, '');
  END IF;

  INSERT INTO public.notification_queue
    (event_key, channel, recipient, payload_json, template_id, rendered_subject, rendered_body, status)
  VALUES
    (_event_key, _channel, _recipient, COALESCE(_payload,'{}'::jsonb), tpl.id, rendered_subj, rendered_body, 'pending')
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;
REVOKE ALL ON FUNCTION public.enqueue_notification(TEXT,TEXT,TEXT,JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enqueue_notification(TEXT,TEXT,TEXT,JSONB) TO service_role;

-- Enqueue for all enabled channels of an event.
CREATE OR REPLACE FUNCTION public.enqueue_event(
  _event_key TEXT,
  _recipient TEXT,
  _payload JSONB
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  n INTEGER := 0;
BEGIN
  IF _recipient IS NULL OR length(trim(_recipient)) = 0 THEN
    RETURN 0;
  END IF;
  FOR r IN
    SELECT DISTINCT channel FROM public.notification_templates
     WHERE event_key = _event_key AND is_enabled = true
  LOOP
    PERFORM public.enqueue_notification(_event_key, r.channel, _recipient, _payload);
    n := n + 1;
  END LOOP;
  RETURN n;
END;
$$;
REVOKE ALL ON FUNCTION public.enqueue_event(TEXT,TEXT,JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enqueue_event(TEXT,TEXT,JSONB) TO service_role;

-- ============ Auto-enqueue triggers (fail-safe) ============
CREATE OR REPLACE FUNCTION public.trg_notify_order_created()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  BEGIN
    PERFORM public.enqueue_event(
      'order.created',
      NEW.email,
      jsonb_build_object(
        'order_number', NEW.order_number,
        'customer_name', NEW.customer_name,
        'total', NEW.total,
        'currency', NEW.currency
      )
    );
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_notify_order_status()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    BEGIN
      IF NEW.status::TEXT = 'completed' THEN
        PERFORM public.enqueue_event('order.completed', NEW.email,
          jsonb_build_object('order_number', NEW.order_number, 'customer_name', NEW.customer_name));
      ELSIF NEW.status::TEXT = 'manual_review' THEN
        PERFORM public.enqueue_event('order.manual_review', NEW.email,
          jsonb_build_object('order_number', NEW.order_number, 'customer_name', NEW.customer_name));
      END IF;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_order_created ON public.orders;
CREATE TRIGGER notify_order_created AFTER INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.trg_notify_order_created();

DROP TRIGGER IF EXISTS notify_order_status ON public.orders;
CREATE TRIGGER notify_order_status AFTER UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.trg_notify_order_status();

CREATE OR REPLACE FUNCTION public.trg_notify_payment()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  ord RECORD;
  ev TEXT;
BEGIN
  BEGIN
    IF TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status THEN
      SELECT email, order_number, customer_name INTO ord FROM public.orders WHERE id = NEW.order_id;
      IF ord.email IS NULL THEN RETURN NEW; END IF;
      IF NEW.status::TEXT IN ('paid','completed','succeeded') THEN ev := 'payment.received';
      ELSIF NEW.status::TEXT IN ('failed','declined') THEN ev := 'payment.failed';
      ELSE ev := NULL;
      END IF;
      IF ev IS NOT NULL THEN
        PERFORM public.enqueue_event(ev, ord.email,
          jsonb_build_object('order_number', ord.order_number, 'customer_name', ord.customer_name,
                             'amount', NEW.amount, 'currency', NEW.currency));
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_payment ON public.payments;
CREATE TRIGGER notify_payment AFTER INSERT OR UPDATE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.trg_notify_payment();

CREATE OR REPLACE FUNCTION public.trg_notify_inventory_assigned()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  BEGIN
    PERFORM public.enqueue_event('inventory.assigned', NEW.email,
      jsonb_build_object('order_id', NEW.order_id));
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS notify_inventory_assigned ON public.inventory_assignments;
CREATE TRIGGER notify_inventory_assigned AFTER INSERT ON public.inventory_assignments
FOR EACH ROW EXECUTE FUNCTION public.trg_notify_inventory_assigned();

CREATE OR REPLACE FUNCTION public.trg_notify_license_assigned()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ord RECORD;
BEGIN
  BEGIN
    SELECT email, order_number, customer_name INTO ord FROM public.orders WHERE id = NEW.order_id;
    IF ord.email IS NULL THEN RETURN NEW; END IF;
    PERFORM public.enqueue_event('license.assigned', ord.email,
      jsonb_build_object('order_number', ord.order_number, 'customer_name', ord.customer_name));
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS notify_license_assigned ON public.license_assignments;
CREATE TRIGGER notify_license_assigned AFTER INSERT ON public.license_assignments
FOR EACH ROW EXECUTE FUNCTION public.trg_notify_license_assigned();

CREATE OR REPLACE FUNCTION public.trg_notify_subscription_assignment()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  ord RECORD;
  ev TEXT;
BEGIN
  BEGIN
    SELECT email, order_number, customer_name INTO ord FROM public.orders WHERE id = NEW.order_id;
    IF ord.email IS NULL THEN RETURN NEW; END IF;
    IF TG_OP = 'INSERT' THEN ev := 'subscription.assigned';
    ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
      IF NEW.status::TEXT = 'expiring_soon' THEN ev := 'subscription.expiring';
      ELSIF NEW.status::TEXT = 'renewed' THEN ev := 'subscription.renewed';
      ELSIF NEW.status::TEXT = 'cancelled' THEN ev := 'subscription.cancelled';
      ELSIF NEW.status::TEXT = 'expired' THEN ev := 'subscription.expired';
      ELSE ev := NULL;
      END IF;
    ELSE ev := NULL;
    END IF;
    IF ev IS NOT NULL THEN
      PERFORM public.enqueue_event(ev, ord.email,
        jsonb_build_object('order_number', ord.order_number, 'customer_name', ord.customer_name,
                           'remaining_days', NEW.remaining_days, 'renewal_date', NEW.renewal_date));
    END IF;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS notify_subscription_assignment ON public.subscription_assignments;
CREATE TRIGGER notify_subscription_assignment AFTER INSERT OR UPDATE ON public.subscription_assignments
FOR EACH ROW EXECUTE FUNCTION public.trg_notify_subscription_assignment();
