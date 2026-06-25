# Phase 7 — SEO + Analytics + Reviews + Search

Large multi-area phase. Building in 4 slices so each ships green and reviewable.

## Slice 1 — SEO Suite (dynamic, white-label)

**Files**
- `src/lib/cms/seo.ts` — extend with `buildProductJsonLd`, `buildBreadcrumbJsonLd`, `buildOrganizationJsonLd`, `buildFaqJsonLd`, `buildReviewJsonLd`. All read base URL + brand from `site_settings` (no hardcoded domain).
- `src/routes/__root.tsx` — Organization JSON-LD + sitewide OG/Twitter defaults from settings.
- `src/routes/products.$slug.tsx` — dynamic `head()`: title, description, canonical, og:image (product image), Product + Breadcrumb + (if reviews) AggregateRating + FAQ JSON-LD from loader data.
- `src/routes/products.tsx`, `categories.tsx`, `about.tsx`, `contact.tsx` — canonical + per-route OG.
- `src/routes/sitemap[.]xml.ts` — server route enumerating static routes + all published products + categories from Supabase.
- `public/robots.txt` — `Allow: /`, `Sitemap: <base>/sitemap.xml` (base read at build via env fallback; runtime sitemap is dynamic).

## Slice 2 — Analytics Settings (configurable)

**DB**: new `analytics` settings group in `site_settings` (`ga4_id`, `gtm_id`, `meta_pixel_id`, `gsc_verification`, `bing_verification`).

**Files**
- `src/lib/analytics/injector.tsx` — `<AnalyticsScripts />` component that reads settings and injects GA4/GTM/Meta Pixel + verification meta tags. Mounted in `__root.tsx`.
- `src/routes/admin.settings.tsx` — new "Analytics & SEO" tab with form fields for all IDs.

## Slice 3 — Product Reviews

**DB migration**
- `product_reviews` already exists (10 cols). Add columns if missing: `status` (pending/approved/rejected), `helpful_count`, `is_verified_purchase`. Add RPC `mark_review_helpful(_review_id)`.
- Add trigger to recompute `products.rating_avg` and `rating_count` on approved review insert/update.

**Files**
- `src/lib/reviews/reviews.functions.ts` — `listProductReviewsFn`, `submitReviewFn` (auto-detect verified purchase via paid orders), `voteHelpfulFn`.
- `src/lib/reviews/admin.functions.ts` — `listReviewsAdminFn`, `moderateReviewFn` (approve/reject/delete).
- `src/components/products/ProductReviews.tsx` — rating breakdown bar chart, sort dropdown (newest / highest / lowest / most helpful), submit form (gated to authed users), helpful vote button, verified badge.
- `src/routes/products.$slug.tsx` — wire Reviews tab to new component.
- `src/routes/admin.reviews.tsx` — moderation queue (pending / all, approve / reject / delete buttons).
- `src/routes/admin.tsx` sidebar — add "Reviews" link.

## Slice 4 — Search Improvements

**DB migration**
- Add `products.search_tsv tsvector` generated column + GIN index over `name`, `short_description`, `description`.
- New `search_queries` table (query, count, last_searched_at) for trending.

**Files**
- `src/lib/search/search.functions.ts` — `searchProductsFn` (FTS via `websearch_to_tsquery`), `suggestProductsFn` (prefix), `getTrendingSearchesFn`, `logSearchFn`.
- `src/components/SearchBar.tsx` — autocomplete dropdown with suggestions + recent (localStorage via Zustand) + trending sections.
- `src/components/Header.tsx` — replace plain input with `SearchBar`.
- `src/routes/products.tsx` — consume `q` search param via FTS function.
- `src/routes/admin.search.tsx` — top searches table (KPI).

## Cross-cutting

- All new SQL migrations include explicit `GRANT` blocks per project rules.
- All settings JSON merges preserve existing keys.
- White-label: every site URL flows from `seo` settings group → `getSiteUrl()` helper; no hardcoded `topuphut` strings introduced.

## Return shape

At the end of each slice I'll report: files modified, per-area completion %, marketplace readiness, SEO score, resale readiness.

## Confirmation

Reply "go" to start with Slice 1 (SEO Suite). I can also re-order if you want Reviews or Analytics first.
