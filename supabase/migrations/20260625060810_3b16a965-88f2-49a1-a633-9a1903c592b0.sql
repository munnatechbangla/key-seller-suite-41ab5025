-- White-label settings: one table, grouped key-value JSON.
-- Groups: site, seo, email, social, payment
CREATE TABLE public.site_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_key TEXT NOT NULL,
  setting_key TEXT NOT NULL,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_public BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (group_key, setting_key)
);

GRANT SELECT ON public.site_settings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_settings TO authenticated;
GRANT ALL ON public.site_settings TO service_role;

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

-- Anyone (including anon) can read public settings; admins can read all.
CREATE POLICY "Public settings readable by all"
  ON public.site_settings FOR SELECT
  USING (is_public = true OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert settings"
  ON public.site_settings FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update settings"
  ON public.site_settings FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete settings"
  ON public.site_settings FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_site_settings_updated_at
  BEFORE UPDATE ON public.site_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed TopupHut as the demo configuration. Payment settings stay private.
INSERT INTO public.site_settings (group_key, setting_key, value, is_public) VALUES
  ('site', 'branding', '{
    "name": "TopupHut",
    "brand_lead": "Topup",
    "brand_accent": "Hut",
    "tagline": "Premium digital products at unbeatable prices.",
    "description": "Premium digital products at unbeatable prices. Instant delivery, secure payments, and 24/7 support — trusted by 200,000+ customers worldwide.",
    "logo_url": "",
    "favicon_url": "",
    "footer_text": "",
    "copyright": "© {year} {name}. All rights reserved."
  }'::jsonb, true),
  ('site', 'contact', '{
    "support_email": "support@topuphut.com",
    "phone": "",
    "whatsapp": "",
    "telegram": "",
    "address": ""
  }'::jsonb, true),
  ('seo', 'defaults', '{
    "site_title": "TopupHut — Premium Digital Products",
    "meta_description": "Premium digital products at unbeatable prices. Instant delivery, secure payments, and 24/7 support.",
    "site_url": "",
    "og_image": "",
    "twitter_image": "",
    "twitter_handle": ""
  }'::jsonb, true),
  ('email', 'senders', '{
    "sender_name": "TopupHut",
    "sender_email": "",
    "support_email": "support@topuphut.com",
    "reply_to": ""
  }'::jsonb, false),
  ('social', 'links', '{
    "facebook": "",
    "twitter": "",
    "instagram": "",
    "youtube": "",
    "tiktok": "",
    "linkedin": ""
  }'::jsonb, true),
  ('payment', 'config', '{
    "currency": "USD",
    "currency_symbol": "$",
    "sslcommerz_enabled": false,
    "bkash_enabled": false,
    "stripe_enabled": false,
    "manual_enabled": true,
    "manual_instructions": ""
  }'::jsonb, false);
