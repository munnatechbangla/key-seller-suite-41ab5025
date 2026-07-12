
ALTER TABLE public.cms_pages
  ADD COLUMN IF NOT EXISTS featured_image TEXT,
  ADD COLUMN IF NOT EXISTS excerpt TEXT,
  ADD COLUMN IF NOT EXISTS body_html TEXT,
  ADD COLUMN IF NOT EXISTS template TEXT NOT NULL DEFAULT 'default',
  ADD COLUMN IF NOT EXISTS show_in_header BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS show_in_footer BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS menu_order INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS open_new_tab BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS cms_pages_status_slug_idx ON public.cms_pages (status, slug);
CREATE INDEX IF NOT EXISTS cms_pages_nav_idx ON public.cms_pages (show_in_header, show_in_footer, menu_order);

-- Seed CMS copies of existing hardcoded pages (drafts so /$slug catch-all
-- won't shadow the real routes until admin publishes them).
INSERT INTO public.cms_pages (slug, title, description, page_type, status, template)
VALUES
  ('about',           'About Us',        'Learn more about our company.',      'standard', 'draft', 'default'),
  ('contact',         'Contact',         'Get in touch with our team.',        'standard', 'draft', 'contact'),
  ('faq',             'FAQ',             'Frequently asked questions.',        'standard', 'draft', 'faq'),
  ('privacy',         'Privacy Policy',  'How we handle your data.',           'legal',    'draft', 'default'),
  ('terms',           'Terms of Service','Terms and conditions of use.',       'legal',    'draft', 'default'),
  ('refund',          'Refund Policy',   'Our refund and return policy.',      'legal',    'draft', 'default'),
  ('support',         'Support Center',  'Help and support resources.',        'standard', 'draft', 'default'),
  ('track-order',     'Track Order',     'Track your order status.',           'standard', 'draft', 'default')
ON CONFLICT (slug) DO NOTHING;
