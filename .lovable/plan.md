# Pages CMS — Per-Page Editors (Blog-style)

Frontend layouts stay locked. Only content becomes CMS-editable, stored in existing `legal_pages.content` JSONB (already exists, no schema change needed).

## Storage (no migration)

Use the existing `legal_pages` table for all 8 pages. Each page uses one row keyed by slug (`about`, `contact`, `faq`, `support`, `track-order`, `privacy-policy`, `terms`, `refund-policy`). Structured fields go in `content` JSONB. SEO uses existing `seo_title` / `seo_description` / `canonical_url` columns.

Per-page JSON shapes (typed in `src/lib/cms/pages/schemas.ts`):

- **about**: `hero{title,subtitle,image}`, `mission`, `vision`, `team[]{name,role,avatar,bio}`, `cta{title,subtitle,button_label,button_url}`
- **contact**: `hero`, `form{title,subtitle,submit_label,success_message}`, `email`, `phone`, `whatsapp`, `address`, `map_embed`, `hours[]{day,hours}`
- **faq**: `hero`, `search_placeholder`, `categories[]{id,name}`, `items[]{category_id,q,a}`, `cta`
- **support**: `hero`, `cards[]{icon,title,body,link}`, `contact_methods[]{icon,label,value,href}`, `cta`
- **track-order**: `hero`, `tracker{heading,placeholder,button_label,help_text}`, `faq[]{q,a}`
- **privacy / terms / refund**: `hero{title,subtitle}`, `sections[]{h,p}`, plus existing SEO columns

Defaults live next to each schema so pages render pixel-identically before any editing.

## Server functions (`src/lib/pages.functions.ts`)

- `pageGetPublicFn({slug})` — anon read of `legal_pages` by slug
- `pageAdminGetFn({slug})` — admin read (auto-creates row from defaults on first open)
- `pageAdminUpsertFn({slug, patch})` — merges patch into `content`, updates SEO columns
- `pagesAdminListFn()` — lists the 8 fixed pages with last-updated timestamps

## Admin UI

- Sidebar item **Pages** in `src/routes/admin.tsx` (between Blog and Categories)
- `src/routes/admin.pages.tsx` — index list of the 8 pages (Blog-style card grid)
- `src/routes/admin.pages.$slug.tsx` — dispatches to per-page editor by slug
- `src/components/admin/pages/` — one editor per page (`AboutEditor.tsx`, `ContactEditor.tsx`, etc.). Each renders only its own fields with repeaters for arrays (team, hours, FAQ, categories, cards). Uses existing `MediaPicker`, `RichTextEditor`, `IconPicker`, save/publish toolbar mirroring blog editor.
- Shared SEO panel component reused across all editors.

## Frontend wiring (no layout changes)

Each existing route file swaps its hardcoded strings for values from `usePage(slug)` with defaults as fallback. Zero JSX structure changes:

- `about.tsx`, `contact.tsx`, `faq.tsx`, `support.tsx`, `track-order.tsx` — read structured content
- `privacy.tsx`, `terms.tsx`, `refund.tsx` — already use `useLegalPage`; just ensure defaults + hero fields are honored

Shared `src/lib/cms/pages/usePage.ts` hook (React Query, 60s stale) returns typed content with defaults merged in — guarantees backward compatibility when a page has never been edited.

## Out of scope

No database migration. No layout/design changes. No new route paths. `CmsPageView` stays unused for these 8 routes.
