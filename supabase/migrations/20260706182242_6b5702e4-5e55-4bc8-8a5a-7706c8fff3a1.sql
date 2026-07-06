
ALTER TABLE public.communication_settings
  ADD COLUMN IF NOT EXISTS email_api_key TEXT,
  ADD COLUMN IF NOT EXISTS email_provider_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS whatsapp_provider_enabled BOOLEAN NOT NULL DEFAULT false;

-- Relax provider check to accept SES / Mailgun / Postmark as future-ready values.
ALTER TABLE public.communication_settings DROP CONSTRAINT IF EXISTS communication_settings_email_provider_check;
ALTER TABLE public.communication_settings
  ADD CONSTRAINT communication_settings_email_provider_check
  CHECK (email_provider IN ('none','resend','smtp','ses','mailgun','postmark'));

ALTER TABLE public.communication_settings ALTER COLUMN email_provider SET DEFAULT 'none';
ALTER TABLE public.communication_settings ALTER COLUMN whatsapp_provider SET DEFAULT 'none';
