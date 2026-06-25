
CREATE TABLE public.email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key text UNIQUE NOT NULL,
  name text NOT NULL,
  subject text NOT NULL,
  html_body text NOT NULL,
  text_body text,
  variables jsonb NOT NULL DEFAULT '[]'::jsonb,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_templates TO authenticated;
GRANT ALL ON public.email_templates TO service_role;
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage email_templates" ON public.email_templates
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_email_templates_updated_at BEFORE UPDATE ON public.email_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key text NOT NULL,
  recipient text NOT NULL,
  subject text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  attempts int NOT NULL DEFAULT 0,
  max_attempts int NOT NULL DEFAULT 3,
  error_message text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  rendered_html text,
  provider text,
  provider_message_id text,
  sent_at timestamptz,
  next_retry_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_logs TO authenticated;
GRANT ALL ON public.email_logs TO service_role;
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read email_logs" ON public.email_logs
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admins write email_logs" ON public.email_logs
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_email_logs_updated_at BEFORE UPDATE ON public.email_logs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX email_logs_status_idx ON public.email_logs(status, next_retry_at);
CREATE INDEX email_logs_created_idx ON public.email_logs(created_at DESC);

INSERT INTO public.email_templates(template_key, name, subject, html_body, variables) VALUES
('welcome','Welcome','Welcome to {{site_name}}','<h1>Welcome {{name}}!</h1><p>Thanks for joining {{site_name}}.</p>','["site_name","name"]'::jsonb),
('order_confirmation','Order Confirmation','Order {{order_number}} received','<h1>Hi {{name}},</h1><p>We received your order <strong>{{order_number}}</strong> totaling {{currency}}{{total}}.</p>','["site_name","name","order_number","total","currency"]'::jsonb),
('payment_success','Payment Success','Payment received for {{order_number}}','<h1>Payment confirmed</h1><p>Your payment of {{currency}}{{total}} for order {{order_number}} is confirmed.</p>','["site_name","order_number","total","currency"]'::jsonb),
('license_delivery','License Delivery','Your license keys for {{order_number}}','<h1>Your licenses</h1><p>Order {{order_number}}</p><pre>{{license_block}}</pre>','["site_name","order_number","license_block"]'::jsonb),
('download_delivery','Download Delivery','Your downloads for {{order_number}}','<h1>Downloads ready</h1><p>Order {{order_number}}</p><div>{{download_block}}</div>','["site_name","order_number","download_block"]'::jsonb),
('refund','Refund Processed','Refund issued for {{order_number}}','<h1>Refund processed</h1><p>{{currency}}{{amount}} refunded for order {{order_number}}.</p>','["site_name","order_number","amount","currency"]'::jsonb),
('password_reset','Password Reset','Reset your {{site_name}} password','<h1>Reset password</h1><p>Click <a href="{{reset_url}}">here</a> to reset your password.</p>','["site_name","reset_url"]'::jsonb);
