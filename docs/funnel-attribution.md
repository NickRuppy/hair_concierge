# Funnel Attribution

## Package URLs

Funnel packages are defined in `src/lib/funnel/packages.ts`. The homepage always uses
`default_organic`; campaign packages use `/lp/<slug>`. UTM parameters and `fbclid` describe the
traffic source but never select a package.

To add a package, add one registry entry with a stable English `key` and `slug`, then set its
landing and offer variant snapshots. Do not rename a key after traffic has been recorded.

## Runtime Flags

- `FUNNEL_ATTRIBUTION_ENABLED=true` enables signed cookies and Supabase recording. It defaults off.
- `FUNNEL_COOKIE_SIGNING_SECRET` is required when attribution is enabled. Use a long random secret.
- `FUNNEL_META_CUSTOM_DATA_ENABLED=true` allows only `funnel_package_key` into Meta custom data. It
  defaults off. Set the matching `NEXT_PUBLIC_FUNNEL_META_CUSTOM_DATA_ENABLED=true` so browser Pixel
  events include the same package key. The public flag must be configured before a fresh production
  build because Next.js inlines it at build time.
- `META_CAPI_ACCESS_TOKEN` authenticates server-side Meta CAPI delivery and must remain a Vercel
  server secret.
- `META_PIXEL_ID` and `NEXT_PUBLIC_META_PIXEL_ID` must identify the same Meta dataset. Browser/server
  Purchase deduplication cannot work when the two channels send to different datasets.

On funnel and public-flow routes that mount `MetaPixelProvider`, Meta events are queued from the first
page view regardless of the cookie-banner choice. The analytics runtime initializes the Pixel after
first paint and flushes the queue in order. Legal, contact, and other routes without those tracking
providers remain tracking-free. The banner and stored consent remain in place, but do not gate this
Meta path. This is an explicit production-test behavior, not a statement that the setup satisfies
German/EU consent requirements; reverting it requires a code rollback and redeploy.

The database migration and code can be deployed while attribution remains disabled. Before enabling
the master flag in production, confirm the German privacy/legal classification of the pre-consent,
first-party attribution cookies.

## Production Status

On 2026-07-11, migration `20260711120000_funnel_attribution.sql` was applied surgically to Supabase
project `pqdkhefxsxkyeqelqegq` and recorded as applied. Rollback-only production smoke transactions
verified event-ID idempotency, repeated occurrences, first-touch immutability, milestone timestamps,
and three package journeys linked by one visitor ID; both transactions left zero test rows.

Vercel production has `FUNNEL_ATTRIBUTION_ENABLED=true` and a dedicated signing secret configured.
The configuration takes effect when the matching application code is deployed. As of 2026-07-13,
both Meta package-key flags and matching browser/server Pixel IDs are configured for production; a
Chaarlie-only `META_CAPI_ACCESS_TOKEN` is stored as a server secret. Each production deployment must
be built after those public values are configured so Next.js can inline them.

## Milestones

The session summary records the first occurrence of:

1. `landing_viewed`
2. `quiz_started`
3. `quiz_completed`
4. `lead_captured`
5. `offer_viewed`
6. `checkout_started`
7. `purchase_completed`

`funnel_events` keeps every genuine occurrence. Browser event IDs are reused across Supabase,
PostHog, Customer.io, and Meta. Confirmed purchases reuse the existing billing event key.

## Starter Report

```sql
select
  package_key,
  count(*) as sessions,
  count(quiz_started_at) as quiz_starts,
  count(quiz_completed_at) as quiz_completions,
  count(lead_captured_at) as leads,
  count(checkout_started_at) as checkout_starts,
  count(purchase_completed_at) as purchases,
  round(100.0 * count(purchase_completed_at) / nullif(count(*), 0), 2) as purchase_rate_pct
from public.funnel_sessions
where first_seen_at >= now() - interval '7 days'
group by package_key
order by sessions desc;
```

Original and latest browser-level touches are derived from immutable journey rows rather than by
rewriting an older session:

```sql
select
  visitor_id,
  (array_agg(first_touch order by first_seen_at asc))[1] as original_touch,
  (array_agg(first_touch order by first_seen_at desc))[1] as latest_touch
from public.funnel_sessions
group by visitor_id;
```

Meta campaign and ad reporting explains which ad delivered traffic. Chaarlie's package key explains
which coherent landing-and-offer journey the visitor received. Keep both dimensions when reconciling.

## Pre-enable Baseline

The initial dated baseline is recorded in
`docs/funnel-attribution-pre-enable-baseline-2026-07-11.md`.

Before production enablement, save one dated, bounded comparison window with quiz starts, quiz
completions, leads, checkout starts, and confirmed purchases. Record the exact timezone, PostHog and
Customer.io event definitions, Stripe/PayPal confirmation definitions, and known consent or dedupe
gaps. Repeat the same definitions after enablement so the comparison remains like for like.
