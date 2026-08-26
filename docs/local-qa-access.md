# Local QA access — logged-in and post-payment testing

How to get a correctly-authenticated local session for clicking through unmerged changes,
without re-deriving the auth setup every time. Written 2026-08-26; the "verified" markers
refer to that date on `main`.

## Which path do I need?

| What you want to click through | Fastest path |
| --- | --- |
| Authenticated app surfaces: `/chat`, `/profile`, `/routine`, `/scan`, `/tracker`, `/onboarding`, … | **Dev login** — one URL (§1) |
| Personal Plan stage UIs in isolation (Idealplan, Feinschliff, Stage 3–5) | **`/labs` harnesses** — no auth at all (§2) |
| The real post-payment handoff: checkout → `/plan-bereit` → `/plan-start` → Stage 1–5 | **Local test-mode checkout** (§3) |
| Post-payment verification in production | Field-test link or synthetic entitlement — pointers only (§4) |

Do not mix them: the dev-login account can never reach the Personal Plan journey (§1 limits),
and no amount of clicking will fix that. Pick the row that matches the surface under test.

## 1. Dev login (verified)

One URL signs the browser in as a paid test user:

```
http://localhost:<port>/api/dev/login?next=/chat
```

`next` accepts any app-relative path (`?next=/routine`, `?next=/profile`, …); it defaults to `/chat`.

Requirements — all three, or the route 404s / bounces:

1. `NODE_ENV=development` (any `next dev` server qualifies; production builds never expose this).
2. `LOCAL_DEV_LOGIN_ENABLED=1` in `.env.local` (set on 2026-08-26; the flag is read by both
   the middleware — `src/lib/supabase/middleware.ts` — and the route handler).
3. Hostname `localhost` — and use `localhost` anyway, never `127.0.0.1`: Next dev via
   `127.0.0.1` renders but silently never hydrates.

What it does (`src/app/api/dev/login/route.ts`, `src/lib/dev/local-login.ts`): creates or
refreshes `local-dev@hairconscierge.test`, seeds a paid `profiles` row
(`subscription_status=active`, 30-day period end — the **legacy** entitlement fallback in
`hasCurrentAppAccess`), a wavy/fine `hair_profiles` row, and a two-product routine inventory,
then signs the browser in and redirects. Every subscription-gated route in
`SUB_REQUIRED_PREFIXES` passes. Override the identity with
`LOCAL_DEV_LOGIN_EMAIL` / `LOCAL_DEV_LOGIN_PASSWORD` when you need a second account.

**What it does NOT give you:** a Personal Plan enrollment. There is no quiz lead, no one-time
purchase, no plan artifact, so `/plan-start` shows „Dieser Planbereich ist gerade nicht
verfügbar“ and `/plan-bereit` has no canonical lead (readiness is keyed to the enrollment's
artifact lead in `src/lib/personal-plan/enrollment.ts`). That is by design — use §2 or §3.

Troubleshooting:

- **307 redirect to `/quiz`** from `/api/dev/login` → the flag is unset, or the dev server was
  started before the flag was added. Env changes need a full dev-server restart.
- **404 JSON** → non-development build or non-localhost hostname.
- Stale behavior after editing deep lib code → restart the dev server; hot reload serves stale
  deep-lib modules.

## 2. `/labs` harnesses (verified)

Dev-only pages (`NODE_ENV !== "development"` → 404; the `/labs` prefix is also classified as a
development route in `src/lib/auth/route-classification.ts`). No login, no seeded data — each
page fabricates its own scenario. Useful ones under `src/app/labs/`:

- `/labs/personal-plan-start` — Stage 1 Idealplan view
- `/labs/personal-plan-stage-2?scenario=ready` — Feinschliff (scenario values are validated
  per page; read the page's `SCENARIOS` set)
- `/labs/personal-plan-stage-1-2` — Stage 1→2 journey
- `/labs/personal-plan/stage-3` — products stage
- `/labs/personal-plan-application`, `/labs/personal-plan-application/[dayType]` — Anwendung
- `/labs/personal-plan-chapters`, `/labs/personal-plan-view-transition`,
  `/labs/personal-plan-routine-editor`, `/labs/offer-page`, `/labs/profile-reactivation`

These are the right tool for UI/copy/layout review of a stage. They do not exercise
entitlement, routing, or persistence — that's §3.

## 3. Local post-payment handoff (env-dependent — verify on first use)

The only way to test checkout → `/plan-bereit?lead=<id>` → `/plan-start` locally with real
routing is a real test-mode purchase, because enrollment resolution requires a one-time
purchase whose consent row links the exact lead.

Recipe (Personal Plan one-time purchase):

1. **Webhook forwarding:** `stripe listen --forward-to localhost:<port>/api/stripe/webhook`.
   Put the printed dev-only `whsec_…` in `.env.local` as `STRIPE_WEBHOOK_SECRET` (it is
   different from the dashboard endpoint's secret). Restart the dev server.
2. **Test-mode Stripe env:** `STRIPE_SECRET_KEY` must be a test-mode key and
   `STRIPE_PRICE_ID_PERSONAL_PLAN_ONCE` a test-mode price. Note: the launch checklist
   (`docs/personal-plan-one-time-provider-setup.md`) only created **live** resources — if
   checkout errors on the price, create a test-mode product/price
   (`metadata.product_kind=personal_plan_once`, 29,99 €, tax inclusive) once and record the id
   here.
3. **Reach the one-time offer:** complete the Personal Plan quiz locally in a fresh browser
   context (creates the lead + funnel session). With `PERSONAL_PLAN_ONE_TIME_QA_ENABLED=1`
   and `PERSONAL_PLAN_ONE_TIME_QA_SIGNING_SECRET` set, generate a token bound to that exact
   lead and session:

   ```bash
   npx tsx scripts/create-personal-plan-one-time-qa-token.ts --lead-id <lead> --session-id <session>
   ```

   Open `/result/<leadId>?qa=<token>` — the QA arm assigns and the one-time checkout becomes
   reachable. (Lead and session ids: from the result URL and the `funnel_sessions` row for
   the lead.)
4. **Pay with a Stripe test card** (4242 4242 4242 4242). The forwarded
   `checkout.session.completed` webhook creates the purchase + consent; `/plan-bereit` flips
   from `paid_pending` to ready; continue into `/plan-start` Stage 1–5.
5. Test-mode purchases are automatically excluded from the canonical billing views: the
   `is_test` predicate matches `cs_test_…` checkout sessions
   (`supabase/migrations/20260822140000_billing_subscriptions_classified_views.sql`,
   mirrored in `src/lib/billing/entitlements.ts`).

For **membership subscription** post-payment, the same `stripe listen` setup applies with the
normal offer and the test-mode subscription price ids.

**Fallback — direct seeding** (when a provider round-trip isn't the point): follow the
Playwright pattern (e.g. `tests/tracker-page.spec.ts`) — service-role upsert of the
entitlement rows with an explicit test marker in `metadata` (`qa_seed`/`ci_seed`/`local_test`),
never a bare row. Marker-less rows pollute `billing_subscriptions_current`.

## 4. Production paths (pointers only)

- **Field-test link** (free activation, no provider, five-stage journey):
  `docs/personal-plan-field-test-access.md`. Requires explicitly authorized production writes.
- **Synthetic post-payment entitlement**: the procedure in
  `.agents/skills/simulated-user-review/SKILL.md` ("Production post-payment route
  verification without a provider charge"). Requires explicit authorization.

## Safety

Local dev talks to the **production** Supabase project (`pqdkhefxsxkyeqelqegq`) — there is no
local database in the normal workflow. Every row you seed is real: always carry a test marker
in `metadata`, never sign in with or mutate a customer account, and never widen a rollout flag
for a local test. When a step here turns out stale, fix this file in the same PR as the fix.
