# Local QA access — logged-in and post-payment testing

How to get a correctly-authenticated local session for clicking through unmerged changes,
without re-deriving the auth setup every time. Written 2026-08-26; the "verified" markers
refer to that date on `main`.

## Which path do I need?

| What you want to click through                                                                     | Fastest path                                                    |
| -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Authenticated app surfaces: `/chat`, `/profile`, `/routine`, `/scan`, `/tracker`, `/onboarding`, … | **Dev login** — one URL (§1)                                    |
| Personal Plan stage UIs in isolation (Plan, Feinschliff, Stage 3–5)                                | **`/labs` harnesses** — no auth at all (§2)                     |
| The real post-payment handoff: checkout → `/welcome` auth → `/plan-bereit` → `/plan-start`         | **Local test-mode checkout** (§3 — read its blocker note first) |
| Post-payment verification in production                                                            | Field-test link or synthetic entitlement — pointers only (§4)   |

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
2. `LOCAL_DEV_LOGIN_ENABLED=1` in the `.env.local` of **the checkout you are actually
   running** (read by both the middleware — `src/lib/supabase/middleware.ts` — and the route
   handler). `worktree:new` copies ignored env files **once, at worktree creation**
   (`scripts/worktree-new.mjs`) — root changes never propagate to existing worktrees, so
   verify the flag inside the task worktree before concluding anything is broken. Root
   `.env.local` got the flag on 2026-08-26; worktrees created before then do not have it.
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

- `/labs/personal-plan-start` — Stage 1 Plan view
- `/labs/personal-plan-stage-2?scenario=ready` — Feinschliff (scenario values are validated
  per page; read the page's `SCENARIOS` set)
- `/labs/personal-plan-stage-1-2` — Stage 1→2 journey
- `/labs/personal-plan/stage-3` — products stage
- `/labs/personal-plan-application`, `/labs/personal-plan-application/[dayType]` — Anwendung
- `/labs/personal-plan-chapters`, `/labs/personal-plan-view-transition`,
  `/labs/personal-plan-routine-editor`, `/labs/offer-page`, `/labs/profile-reactivation`
- `/labs/scan` — the `/scan` flow on a **fake camera and a fake barcode detector**, so the
  scanner is clickable on a laptop with no webcam. Drive it from the browser console via
  `window.__scanLab`: `emit("4006381333931")` scans a barcode (two detections = one stable
  read; it then stays in frame), `emitNone(3)` takes it back out, `denyCamera("NotAllowedError")`
  makes the next camera acquisition fail, `stall()` kills the live stream, `startCamera()`
  releases a camera held by the `__SCAN_LAB_HOLD_CAMERA` boot flag, `holdDetection()` /
  `releaseDetection()` freeze one detection cycle mid-await (so a decode can be made to
  land while a sheet is open), `spot("4006381333931", "4006381333955")` holds the
  viewfinder's amber "spotted" state indefinitely (the value alternates, so the two
  consecutive matches a stable read needs never happen — `emit(value, 1)` cannot do this,
  its resting frame decodes on the very next cycle), and `events` /
  `transitions` / `state` expose what the flow tracked and where it is. `state.detection`
  (and the `detection` field on every entry in `transitions`) is what the VIEWFINDER is
  drawing — `searching` / `spotted` / `read` — read off the scanner root's
  `data-scan-detection`, so a state that only lasts a frame is still assertable from the
  transition history afterwards. The `/api/scan/*`
  calls are NOT mocked by the page — without a signed-in session every resolve fails, so
  for anything past the decode either use the dev login (§1) or intercept the routes the
  way `tests/scan-flow.spec.ts` does.

These are the right tool for UI/copy/layout review of a stage. They do not exercise
entitlement, routing, or persistence — that's §3.

## 3. Local post-payment handoff (env-dependent — verify on first use)

The only way to exercise checkout → `/welcome` → `/plan-bereit?lead=<id>` → `/plan-start`
locally with real routing is a real test-mode purchase, because enrollment resolution requires
a one-time purchase whose consent row links the exact lead.

> **⛔ Not yet blessed as a default recipe (2026-08-26).** One-time activation enqueues a
> purchase-completed analytics event to Customer.io, Meta, and PostHog
> (`src/lib/billing/personal-plan-one-time-activation.ts` →
> `BILLING_ANALYTICS_EXTERNAL_DESTINATIONS` in `src/lib/billing/analytics-outbox.ts`).
> Only the PostHog destination carries the `is_internal_test` marker; **Meta and Customer.io
> have no internal-test suppression** — they skip only when their env keys are absent, which
> is an accident of configuration, not a guarantee. The `billing_subscriptions_classified`
> `is_test` views cover subscriptions only, **not** `billing_one_time_purchases`. Until
> internal-test suppression for Meta/Customer.io is implemented and proven, a "local" test
> purchase can create real production analytics state. Before first use: either verify those
> destination env keys are absent locally and accept the DB-side residue consciously, or land
> the suppression fix — then update this section.

**There is currently no supported synthetic/seeded local path to Personal Plan access.** The
dedicated QA-owner RPC was deliberately retired
(`supabase/migrations/20260811054910_remove_personal_plan_test_owner.sql`), and seeding a
subscription row (the Playwright `tests/tracker-page.spec.ts` pattern) yields ordinary app
access like dev login — it cannot create the lead/consent/purchase/artifact chain
`/plan-start` requires. If a guarded, cleanup-capable seeding helper is wanted, that is a
deliberate design task for Nick to authorize — do not improvise one with service-role writes.

Recipe (Personal Plan one-time purchase, once the blocker above is resolved):

1. **Webhook forwarding:** `stripe listen --forward-to localhost:<port>/api/stripe/webhook`.
   Put the printed dev-only `whsec_…` in the worktree's `.env.local` as
   `STRIPE_WEBHOOK_SECRET` (it is different from the dashboard endpoint's secret). Restart
   the dev server.
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

4. **Pay with a Stripe test card** (4242 4242 4242 4242).
5. **Complete the `/welcome` authentication step — do not skip it.** Stripe returns the buyer
   to `/welcome`, where an unauthenticated buyer must set a password
   (`/api/auth/set-checkout-password`) or request a magic link before entering the plan
   (`src/app/welcome/welcome-client.tsx`). This is one of the most failure-prone parts of the
   post-payment flow and is part of what this lane exists to test.
6. The forwarded `checkout.session.completed` webhook creates the purchase + consent;
   `/plan-bereit` flips from `paid_pending` to ready; continue into `/plan-start` Stage 1–5,
   verifying lead/consent/purchase provenance, no `/onboarding` detour, and refresh/resume.
7. **Clean up:** revoke or expire the test access via the supported path, and confirm no
   residual auth/data/analytics state (check the outbox rows for the event).

For **membership subscription** post-payment, the same `stripe listen` setup applies with the
normal offer and the test-mode subscription price ids; subscription rows created from
`cs_test_…` sessions are classified as test by
`supabase/migrations/20260822140000_billing_subscriptions_classified_views.sql`, but the same
analytics-outbox caveat applies.

**Verification discipline:** local click-through on an unmerged branch is evidence for
`ready-check` (`.agents/skills/ready-check/SKILL.md`) — run it on the exact tree under review,
name the evidence tier used (labs / dev login / test checkout), and record what each tier does
and does not prove in the receipt.

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

For scan dm-enrichment QA, do not treat `/labs/scan` as persistence proof: its UI can exercise
the sheet, but `/api/scan/*` uses the real production-backed data path when authenticated. Before
any controlled smoke, read the current flag and cap, preflight that the labelled QA account and
barcode have no open scan submission, and use one confirmation only. Record the resulting
submission ID privately; do not delete, reject, or publish it automatically. A failed smoke means
switch the flag off and verify a plain unknown-sheet fallback without a dm call.

The server defaults to `SCAN_RETAILER_ENRICHMENT_ENABLED=false`. Its
`SCAN_RETAILER_ENRICHMENT_TIMEOUT_MS` cap defaults to `1500` ms; only whole
numbers from `1` to `10000` are valid. Set both in the task worktree's
`.env.local` and restart the dev server after changes. There is intentionally
no tracked `.env.example` in this repository: blanket environment-file
ignoring makes it an unreliable configuration source.

# Partner access QA

Use the dedicated partner route and an isolated/local database migration for creator-flow QA.
Do not use a production creator or send real Customer.io messages. The personal credential may be
projected locally with `PARTNER_ACCESS_INVITATION_SIGNING_SECRET`; verify that opening or refreshing
the URL does not mutate the invitation and that only `Los geht’s` begins the claim. For the complete
operator contract and environment keys, see `docs/partner-access-operations.md`.

**Existing-account case (fresh start on an already-used account):** sign up a plain test account —
not the §1 dev-login fixture, which already seeds a paid legacy `profiles` period and would hit the
paid exemption instead of a fresh start — and either complete the legacy `/onboarding` flow, or take
it through a full Personal Plan via the local post-payment lane (§3) to get a finished plan. Note its
e-mail, then create and claim a partner invitation for that same e-mail in `/admin/partner-access`.
Verify the quiz starts at step 1 (not resumed) and that opening `/chat` mid-quiz routes to `/quiz`
rather than the chat surface — this exercises the claim's fresh-start reset
(`docs/partner-access-operations.md`, "Neustart") end to end.

**Former field-test moderator case:** take an account whose email-bound field-test moderator
membership has already ended or been revoked (§4 pointer, `docs/personal-plan-field-test-access.md`
— creating or resetting a moderator roster is production-authorized tooling, not a local seed), then
create and claim a partner invitation for that same e-mail and sign in as that account. Verify it
gets independent app access from the partner grant instead of being blocked as an ended moderator —
this exercises the middleware re-check at `src/lib/supabase/middleware.ts` where an active partner
grant is checked once a moderator membership is found `ended`/`unavailable`.

# Discovery-call QA

The discovery-call toolkit is off by default. For a local walkthrough set both
`DISCOVERY_CALL_TOOLKIT_ENABLED=true` and a `DISCOVERY_ENROLLMENT_SIGNING_SECRET` of at least 32
characters in the worktree's `.env.local`, then restart the dev server. With the flag off the
invite page and its two public APIs answer `410` and the checklist and admin cockpit answer `404`,
so nothing is reachable to test.

Create the local enrollment with `npm run discovery -- create --name="…" --email="…"` (dry-run
without `--apply`). Never point the CLI at production for QA: a production write additionally
requires `ALLOW_DISCOVERY_PRODUCTION_WRITE=1`, `--apply`, `--confirm-project=pqdkhefxsxkyeqelqegq`
and a matching Supabase URL, and that combination is the operator path, not a QA path. The invite
credential lives in the URL fragment (`/beratung/einladung#code=…`), so it never reaches a server
log — copy the whole link, not a truncated one. The participant journey is invite → `/quiz`
(legacy, never an `/lp/*` link) → `/beratung/produkte` (one flat product list, no category tiles) →
„Fertig" → review „Passt das so?" → „Stimmt so – abschicken"; the operator side is
`/admin/beratung`. For the complete operator contract, the environment keys, the manual research
reconciliation and the two analytics caveats, see `docs/discovery-call-runbook.md`.

The flat checklist needs both batch-5 migrations applied to the local database
(`20260924120000_discovery_intake_usage_product_type.sql`, then
`20260924140000_discovery_admin_item_usage.sql`); without them adds, confirm-submit and the cockpit's
usage correction fail. A complete local walkthrough covers:

1. Add one product each by search, scan and typed name. An oil asks „Wann benutzt du das Öl?", a
   conditioner/mask/leave-in „Wie benutzt du das?", a shampoo „Wie oft benutzt du das?" — the
   detected answer is preselected.
2. Type a name the classifier cannot place and answer „Weiß ich nicht": the item is stored with no
   product type, no usage and no research submission.
3. „Fertig" → „Passt das so?" → „Stimmt so – abschicken": every category without a product becomes an
   explicit „benutzt sie nicht" in the same call.
4. In the cockpit (`/admin/beratung/<enrollmentId>`): the „Weiß ich nicht" product reads
   „Kategorie offen" and „Finalisieren" is blocked („Erst Kategorie festlegen"). Set its
   „Produkttyp" and „Benutzt als", save, then „Recherche starten" opens its research from the type.
5. „Kategorie ändern" on a product with a usage (e.g. conditioner → Maske): its row reads
   „Benutzt als Maske · Produkt: Conditioner", the vacated category turns into „benutzt sie nicht"
   and the moved step's decisions are gone. While finalized the correction is refused
   („Erst Finalisierung aufheben").
6. Finalize, open the PDF: the moved product carries „als Haarmaske benutzt".
