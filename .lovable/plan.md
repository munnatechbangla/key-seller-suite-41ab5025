# Phase 7 — Resale Packaging & White Label Completion

Phase 7 covers 8 workstreams. Shipping them in one turn would risk regressions (it touches branding, storage keys, theming, a new admin section, a setup wizard that gates first-run routing, and a docs generator). I will deliver it as **5 sequential slices**, each independently verifiable.

## Slice 1 — Branding & LocalStorage Hardcodes (Tasks 1 + 2)
- Add `branding.slug` to `defaultSettings` and the admin Branding form (default `topuphut`).
- Replace literal "TopupHut" / `support@topuphut.com` / `privacy@topuphut.com` in:
  - `src/routes/about.tsx`, `faq.tsx`, `privacy.tsx`, `terms.tsx`, `refund.tsx`, `auth.login.tsx`, `account.tsx`, `contact.tsx`
  - `src/components/site/Footer.tsx`, hero/testimonial sections, `src/lib/cms/site.ts` static demo content
  - Reads pull from `useSettings(...)` (branding.name / contact.support_email / seo.site_url).
- Refactor Zustand persisted stores (`useCart`, `useWishlist`, `useCompare`, `useRecent`) to compute keys from `settings.branding.slug` at hydration time, with a one-time migration that copies any existing `topuphut-*` payload into the new slug-prefixed key.

## Slice 2 — Theme Settings (Task 4)
- Extend `SiteBranding` with `primary_color`, `secondary_color`, `accent_color`, `font_family`.
- Inject CSS variables (`--primary`, `--secondary`, `--accent`, `--font-sans`) at runtime from `useSettings` via a `ThemeVarsBridge` mounted in `__root.tsx`.
- Add a "Theme" subsection in `admin.settings.tsx` (color pickers + font selector).
- No Tailwind config changes — variables already drive the design tokens in `styles.css`.

## Slice 3 — Legal Pages CMS (Task 3)
- Migration: `legal_pages` table (`slug`, `title`, `body_md`, `is_published`, timestamps) with admin-write / public-read RLS + GRANTs.
- Seed rows for `terms`, `privacy`, `refund`, `faq` using the current static copy.
- Refactor `src/routes/{terms,privacy,refund,faq}.tsx` to load from the table (markdown rendered via existing components).
- New admin route `src/routes/admin.legal.tsx` (list + edit, markdown textarea).

## Slice 4 — Setup Wizard + Env Validator (Tasks 5 + 7)
- Wizard at `/setup` (7 steps) guarded by a `setup_completed` flag in `site_settings`. Public `setupStatus` server fn; `__root.tsx` redirects to `/setup` when incomplete and no admin exists.
- Wizard writes admin role, branding, contact, site URL, currency, and flips the flag.
- Env Validator: server fn that probes Supabase reachability, `payments` bucket, sender email config, analytics IDs, enabled gateways. Renders as a "System Health" card on `admin.index.tsx`.

## Slice 5 — Demo Data Manager + Documentation Generator (Tasks 6 + 8)
- `admin.tools.demo.tsx` with admin-only server fns: `seedDemoData`, `resetDemoData`, `clearDemoOrders`, `clearDemoCustomers` (idempotent, tagged via `is_demo` columns added in a small migration where missing).
- `admin.system.docs.tsx` — renders four bundled markdown templates (Installation, Gateway Setup, Email Setup, White Label) with the live `site_settings` values interpolated, plus a "Download .md" button per doc.

## Per-slice exit criteria
After each slice I will: run `tsgo --noEmit`, smoke-test affected routes, and post a short report. You approve before I start the next slice.

## Final report (after Slice 5)
WHITE LABEL / RESALE / DEPLOYMENT / PRODUCTION scores, full file list, migration list, build + typecheck confirmation.

---

**Reply "go slice 1"** (or any specific slice number) to start. If you want a different order, say so and I'll re-plan.
