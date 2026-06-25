
UPDATE public.site_settings SET value = jsonb_build_object(
  'name','DigitalNest',
  'brand_lead','Digital',
  'brand_accent','Nest',
  'tagline','Premium digital products at unbeatable prices.',
  'description','Premium digital products at unbeatable prices. Instant delivery, secure payments, and 24/7 support — trusted by 200,000+ customers worldwide.',
  'logo_url','/__l5e/assets-v1/602931d4-2a36-4b81-a21d-e1f1f898718c/digitalnest-logo.png',
  'favicon_url','/__l5e/assets-v1/602931d4-2a36-4b81-a21d-e1f1f898718c/digitalnest-logo.png',
  'footer_text','Crafted for digital enthusiasts. Instant delivery worldwide.',
  'copyright','© {year} {name}. All rights reserved.'
) WHERE group_key='site' AND setting_key='branding';

UPDATE public.site_settings SET value = value
  || jsonb_build_object('support_email','support@digitalnest.com')
WHERE group_key='site' AND setting_key='contact';

UPDATE public.site_settings SET value = value
  || jsonb_build_object(
    'site_title','DigitalNest — Premium Digital Products',
    'og_image','/__l5e/assets-v1/97337f21-76d7-44aa-8041-4469f173f125/digitalnest-og.jpg',
    'twitter_image','/__l5e/assets-v1/97337f21-76d7-44aa-8041-4469f173f125/digitalnest-og.jpg'
  )
WHERE group_key='seo' AND setting_key='defaults';

UPDATE public.site_settings SET value = value
  || jsonb_build_object('sender_name','DigitalNest','support_email','support@digitalnest.com')
WHERE group_key='email' AND setting_key='senders';
