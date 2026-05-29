# PayPal Native Subscriptions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add native PayPal subscriptions as a first-class express payment option while preserving the existing Stripe checkout and one shared Premium membership entitlement model.

**Architecture:** Introduce provider-neutral billing subscription records and keep `profiles` as the access mirror. Stripe and PayPal both feed the same membership state, with PayPal isolated behind its own REST client, webhook verification, checkout button, cancellation route, feature flag, and plan-validation script. Access is protected by app-level and database-level double-subscription guards plus scheduled reconciliation.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Supabase Postgres/Auth, existing Stripe SDK, PayPal JS SDK via `@paypal/react-paypal-js`, PayPal REST APIs via server-side `fetch`, node:test via `tsx`, Playwright only for existing browser specs.

**Spec link:** `docs/superpowers/specs/2026-05-27-paypal-native-subscriptions-design.md`

**User situation:** German users expect PayPal as a familiar payment method, but Chaarlie cannot use PayPal through Stripe. PayPal must feel integrated without creating a second membership product or letting a user pay twice.

**Promised end-state:** The same Monthly, Quarterly, and Yearly Premium plans can be purchased through PayPal or Stripe. PayPal charges the same discounted displayed amounts, activates the same account flow, supports paid-through cancellation, and is downgrade-safe through webhooks plus reconciliation.

**Branch:** `codex/paypal-native-subscriptions` in `.worktrees/paypal-native-subscriptions`.

---

## Locked Decisions

- PayPal recurring prices are fixed at the discounted customer-facing amounts: `€7,49`, `€17,49`, `€49,99`.
- Existing Premium access blocks new checkout across both providers.
- PayPal approval-pending return states show an activation-pending screen and poll instead of throwing.
- Existing Stripe subscribers are backfilled into the new billing table.
- PayPal Product/Plans are created manually, then validated by `scripts/paypal/validate-plans.ts`.
- PayPal is hidden unless `NEXT_PUBLIC_PAYPAL_ENABLED=true`.
- Checkout UX uses PayPal as the express-first action, with "Karte / SEPA" as the expandable Stripe fallback.

## Scope Boundaries

In scope:

- `billing_subscriptions` plus `billing_webhook_events`.
- Stripe backfill and Stripe fulfillment writes to `billing_subscriptions`.
- Double-subscription guard for Stripe and PayPal checkout starts.
- PayPal plan validation script.
- PayPal checkout button, server client, activation, webhooks, cancellation, and reconciliation.
- Provider metadata on existing checkout-started events.
- Manual sandbox/live verification checklist.

Out of scope:

- PayPal refunds, disputes, invoice storage, and full revenue ledger.
- PayPal plan switching.
- Replacing Stripe Embedded Checkout or Stripe Customer Portal.
- Rebuilding Meta Pixel purchase tracking.
- New providers beyond Stripe and PayPal.

## Target File Map

```
supabase/migrations/20260527_add_billing_subscriptions.sql
  Add provider-neutral tables, indexes, Stripe backfill, and double-active partial unique index.

src/lib/billing/types.ts
  Shared provider, interval, entitlement, and billing row types.

src/lib/billing/subscriptions.ts
  Upsert, lookup, current-subscription, and double-subscription guard helpers.

src/lib/billing/entitlements.ts
  Mirror subscription state onto profiles and reconcile expired paid-through access.

src/lib/billing/webhook-events.ts
  Insert-first webhook idempotency helper.

src/lib/stripe/checkout-activation.ts
src/lib/stripe/webhook-handlers.ts
src/app/api/stripe/create-checkout-session/route.ts
  Preserve Stripe behavior, write billing records, and refuse duplicate active access.

src/lib/paypal/client.ts
  Server-only OAuth token and REST request helper.

src/lib/paypal/plans.ts
  Interval-to-plan mapping and expected price/interval definitions.

src/lib/paypal/subscriptions.ts
  Retrieve, verify, map status, derive paid-through date, and cancel PayPal subscriptions.

src/lib/paypal/checkout-activation.ts
  Provider-aware account activation and approval-pending handling.

src/lib/paypal/webhook-handlers.ts
src/app/api/paypal/webhook/route.ts
  Verified webhook route and idempotent lifecycle handlers.

src/app/api/paypal/cancel-subscription/route.ts
  Authenticated in-app PayPal cancellation.

src/app/api/billing/reconcile/route.ts
vercel.json
  Daily paid-through entitlement reconciliation.

src/components/checkout/payment-method-checkout.tsx
src/components/checkout/paypal-subscription-button.tsx
src/app/pricing/pricing-cards.tsx
src/components/quiz/result-offer-pricing.tsx
  Feature-flagged PayPal express checkout with lazy PayPal loading and expandable Stripe card/SEPA fallback.

src/app/welcome/page.tsx
src/app/welcome/welcome-client.tsx
src/app/api/auth/set-checkout-password/route.ts
src/app/api/auth/send-magic-link/route.ts
  Provider-aware welcome activation and activation-pending polling.

src/components/profile/manage-subscription-button.tsx
src/app/profile/page.tsx
  Provider-aware membership management and PayPal cancellation copy.

scripts/paypal/validate-plans.ts
  Validate dashboard-created PayPal plans against expected price and billing cadence.

tests/billing-paypal-server.test.ts
tests/paypal-webhook-handlers.test.ts
tests/paypal-cancel.test.ts
tests/payment-method-checkout.test.tsx
  New node-runner tests. Use `.test.ts`/`.test.tsx`, not `.spec.ts`.
```

---

## Task 1: Billing Foundation, Stripe Backfill, and Double-Pay Guard

**Files:**
- Create: `supabase/migrations/20260527_add_billing_subscriptions.sql`
- Create: `src/lib/billing/types.ts`
- Create: `src/lib/billing/subscriptions.ts`
- Create: `src/lib/billing/entitlements.ts`
- Create: `src/lib/billing/webhook-events.ts`
- Test: `tests/billing-paypal-server.test.ts`

- [ ] **Step 1: Write failing server tests**

Create `tests/billing-paypal-server.test.ts` using `node:test` and `node:assert/strict`. Cover:

- `upsertBillingSubscription` scopes uniqueness by `(provider, provider_subscription_id)`.
- `findCurrentBillingSubscriptionForUser` returns `active` before `past_due` before future paid-through `canceled`.
- `assertCanStartCheckout` throws for active, past-due, or future paid-through profile access.
- `mirrorBillingSubscriptionToProfile` keeps future paid-through PayPal cancellations active.
- `reconcileExpiredBillingEntitlements` downgrades expired paid-through rows and leaves future rows active.
- `claimWebhookEvent` returns `true` on first insert and `false` on duplicate `(provider, provider_event_id)`.

- [ ] **Step 2: Run the failing test**

Run:

```bash
npx tsx --test tests/billing-paypal-server.test.ts
```

Expected: fails because billing helpers do not exist yet.

- [ ] **Step 3: Add migration**

Create `supabase/migrations/20260527_add_billing_subscriptions.sql`:

```sql
CREATE TABLE IF NOT EXISTS billing_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('stripe', 'paypal')),
  provider_customer_id text,
  provider_subscription_id text NOT NULL,
  provider_status text NOT NULL,
  entitlement_status text NOT NULL CHECK (
    entitlement_status IN ('active', 'past_due', 'canceled', 'incomplete')
  ),
  interval text CHECK (interval IN ('month', 'quarter', 'year')),
  current_period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  cancelled_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_subscription_id)
);

CREATE TABLE IF NOT EXISTS billing_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL CHECK (provider IN ('stripe', 'paypal')),
  provider_event_id text NOT NULL,
  event_type text NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_event_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_billing_one_open_subscription_per_user
  ON billing_subscriptions (user_id)
  WHERE entitlement_status IN ('active', 'past_due', 'incomplete');

CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_user_id
  ON billing_subscriptions (user_id);

CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_provider_lookup
  ON billing_subscriptions (provider, provider_subscription_id);

CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_entitlement_expiry
  ON billing_subscriptions (entitlement_status, current_period_end);

INSERT INTO billing_subscriptions (
  user_id,
  provider,
  provider_customer_id,
  provider_subscription_id,
  provider_status,
  entitlement_status,
  interval,
  current_period_end,
  metadata
)
SELECT
  id,
  'stripe',
  stripe_customer_id,
  stripe_subscription_id,
  COALESCE(subscription_status, 'active'),
  CASE
    WHEN subscription_status IN ('active', 'past_due', 'canceled', 'incomplete')
      THEN subscription_status
    ELSE 'active'
  END,
  subscription_interval,
  current_period_end,
  jsonb_build_object('backfilled_from_profiles', true)
FROM profiles
WHERE stripe_subscription_id IS NOT NULL
ON CONFLICT (provider, provider_subscription_id) DO NOTHING;

COMMENT ON TABLE billing_subscriptions IS
  'Provider-neutral external subscription state for Stripe and PayPal.';
COMMENT ON TABLE billing_webhook_events IS
  'Insert-first idempotency ledger for payment-provider webhooks.';
```

- [ ] **Step 4: Add billing helpers**

Create:

- `src/lib/billing/types.ts`
- `src/lib/billing/subscriptions.ts`
- `src/lib/billing/entitlements.ts`
- `src/lib/billing/webhook-events.ts`

Required exports:

```ts
export type BillingProvider = "stripe" | "paypal"
export type BillingInterval = "month" | "quarter" | "year"
export type BillingEntitlementStatus = "active" | "past_due" | "canceled" | "incomplete"

export async function upsertBillingSubscription(...)
export async function findBillingSubscriptionByProviderId(...)
export async function findCurrentBillingSubscriptionForUser(...)
export async function assertCanStartCheckout(...)
export async function mirrorBillingSubscriptionToProfile(...)
export async function reconcileExpiredBillingEntitlements(...)
export async function claimWebhookEvent(...)
```

`assertCanStartCheckout` must check both:

- `billing_subscriptions` for open provider rows.
- `profiles.subscription_status/current_period_end` so existing paid-through users cannot buy again before all rows are backfilled or refreshed.

`claimWebhookEvent` must insert into `billing_webhook_events`; if Supabase reports a unique-conflict/duplicate-key error, return `false` and the caller must skip processing.

- [ ] **Step 5: Run server tests**

Run:

```bash
npx tsx --test tests/billing-paypal-server.test.ts
```

Expected: pass.

## Task 2: Stripe Compatibility and Checkout Guard

**Files:**
- Modify: `src/lib/stripe/checkout-activation.ts`
- Modify: `src/lib/stripe/webhook-handlers.ts`
- Modify: `src/app/api/stripe/create-checkout-session/route.ts`
- Test: `tests/billing-paypal-server.test.ts`

- [ ] **Step 1: Extend failing tests**

In `tests/billing-paypal-server.test.ts`, add tests that exercise Stripe-shaped objects and assert:

- `checkout.session.completed` still writes current profile fields.
- Stripe fulfillment also upserts a `provider = "stripe"` billing row.
- Stripe subscription delete still downgrades the profile and marks billing row canceled.
- `/api/stripe/create-checkout-session` refuses checkout when `assertCanStartCheckout` finds active/past-due/future-paid-through access.

- [ ] **Step 2: Run failing tests**

Run:

```bash
npx tsx --test tests/billing-paypal-server.test.ts
```

Expected: fails on missing Stripe billing writes and guard.

- [ ] **Step 3: Implement Stripe writes and guard**

Changes:

- In `ensureCheckoutAccount`, call `upsertBillingSubscription` after the profile upsert.
- In `handleSubscriptionUpdated`, update the Stripe billing row when a profile can be resolved by `stripe_customer_id`.
- In `handleSubscriptionDeleted`, mark the Stripe billing row canceled when a profile can be resolved.
- In `/api/stripe/create-checkout-session`, call `assertCanStartCheckout` for authenticated users and return `409` with a German-safe error key when access already exists.
- Keep all existing profile writes intact.

- [ ] **Step 4: Run tests**

Run:

```bash
npx tsx --test tests/billing-paypal-server.test.ts
npx playwright test tests/stripe-webhook-handlers.spec.ts
```

Expected: pass.

## Task 3: PayPal Client, Plan Mapping, and Plan Validation

**Files:**
- Create: `src/lib/paypal/client.ts`
- Create: `src/lib/paypal/plans.ts`
- Create: `src/lib/paypal/subscriptions.ts`
- Create: `scripts/paypal/validate-plans.ts`
- Modify: `package.json`
- Test: `tests/billing-paypal-server.test.ts`

- [ ] **Step 1: Install dependency**

Run:

```bash
npm install @paypal/react-paypal-js
```

Expected: `package.json` and lockfile update.

- [ ] **Step 2: Extend failing PayPal tests**

In `tests/billing-paypal-server.test.ts`, add tests for:

- `getPayPalPlanId("month" | "quarter" | "year")`.
- missing plan ID throws.
- expected plan definitions are EUR `7.49`, `17.49`, `49.99`.
- PayPal `ACTIVE` maps to `active`.
- PayPal `APPROVAL_PENDING` maps to `incomplete`.
- PayPal `SUSPENDED` maps to `past_due`.
- PayPal `CANCELLED` maps to provider cancellation without immediate paid-through downgrade.
- `validatePayPalPlanShape` rejects wrong amount, currency, or interval count.

- [ ] **Step 3: Implement PayPal server modules**

Create:

- `src/lib/paypal/client.ts`: server-only OAuth and `paypalRequest<T>()`.
- `src/lib/paypal/plans.ts`: interval-to-env mapping and expected plan shapes.
- `src/lib/paypal/subscriptions.ts`: retrieve, verify, status mapping, paid-through derivation, cancellation, and plan-shape validation.

PayPal plan expected shapes:

```ts
month: { amount: "7.49", currency: "EUR", intervalUnit: "MONTH", intervalCount: 1 }
quarter: { amount: "17.49", currency: "EUR", intervalUnit: "MONTH", intervalCount: 3 }
year: { amount: "49.99", currency: "EUR", intervalUnit: "YEAR", intervalCount: 1 }
```

- [ ] **Step 4: Add validation script**

Create `scripts/paypal/validate-plans.ts`:

- Reads the three `PAYPAL_PLAN_ID_*` env vars.
- Retrieves each plan through PayPal REST.
- Verifies active status, price, currency, interval unit, and interval count.
- Exits non-zero with a precise message if any plan mismatches.

Add script to `package.json`:

```json
"paypal:validate-plans": "tsx scripts/paypal/validate-plans.ts"
```

- [ ] **Step 5: Run tests**

Run:

```bash
npx tsx --test tests/billing-paypal-server.test.ts
npm run typecheck
```

Expected: pass.

## Task 4: PayPal Activation and Approval-Pending Welcome Flow

**Files:**
- Create: `src/lib/paypal/checkout-activation.ts`
- Create: `src/app/api/paypal/activation-status/route.ts`
- Modify: `src/app/welcome/page.tsx`
- Modify: `src/app/welcome/welcome-client.tsx`
- Modify: `src/app/api/auth/set-checkout-password/route.ts`
- Modify: `src/app/api/auth/send-magic-link/route.ts`
- Test: `tests/billing-paypal-server.test.ts`

- [ ] **Step 1: Extend failing activation tests**

In `tests/billing-paypal-server.test.ts`, add tests for:

- Active PayPal subscription activates a new user with provider-verified email.
- Client-submitted email is ignored.
- Existing user with same email is reused.
- `APPROVAL_PENDING` does not mirror Premium immediately and returns an activation-pending result.
- Provider-aware activation hash uses `sha256("paypal:" + subscriptionId)`.
- Stripe activation hash remains `sha256(sessionId)`.

- [ ] **Step 2: Run failing tests**

Run:

```bash
npx tsx --test tests/billing-paypal-server.test.ts
```

Expected: fails until PayPal activation exists.

- [ ] **Step 3: Implement PayPal activation**

Create `src/lib/paypal/checkout-activation.ts`:

- `verifyPayPalSubscriptionForActivation(subscriptionId)` retrieves provider data.
- `ensurePayPalCheckoutAccount(subscription, deps)` mirrors Stripe account activation.
- Active PayPal state creates/reuses user, writes billing row, mirrors Premium, links quiz metadata.
- Approval-pending state returns `{ status: "pending" }` and does not grant access yet.
- Activation hash is `sha256("paypal:" + subscriptionId)`.

- [ ] **Step 4: Add welcome pending flow**

Modify `/welcome`:

- Stripe path remains `/welcome?session_id=...`.
- PayPal path is `/welcome?provider=paypal&subscription_id=...`.
- Active PayPal renders the existing account activation choices.
- Pending PayPal renders German copy:
  - "Wir aktivieren dein Abo..."
  - "Das dauert normalerweise nur ein paar Sekunden."
- `WelcomeClient` polls `/api/paypal/activation-status?subscription_id=...` for a short bounded interval and then reloads or transitions when activation completes.

- [ ] **Step 5: Make auth routes provider-aware**

Update password and magic-link routes to accept either:

```json
{ "session_id": "cs_..." }
```

or:

```json
{ "provider": "paypal", "subscription_id": "I-..." }
```

Provider verification must derive email from Stripe/PayPal, never from the client.

- [ ] **Step 6: Run tests**

Run:

```bash
npx tsx --test tests/billing-paypal-server.test.ts
npx playwright test tests/auth-post-checkout-routes.spec.ts
```

Expected: pass.

## Task 5: PayPal Webhooks with Real Idempotency

**Files:**
- Create: `src/lib/paypal/webhook-handlers.ts`
- Create: `src/app/api/paypal/webhook/route.ts`
- Test: `tests/paypal-webhook-handlers.test.ts`

- [ ] **Step 1: Write failing webhook tests**

Create `tests/paypal-webhook-handlers.test.ts` with:

- `BILLING.SUBSCRIPTION.ACTIVATED` claims event ID, retrieves subscription, writes billing row, mirrors active entitlement.
- Duplicate event ID returns without changing state a second time.
- `PAYMENT.SALE.COMPLETED` refreshes paid-through date.
- `BILLING.SUBSCRIPTION.PAYMENT.FAILED` sets `past_due` and keeps access.
- `BILLING.SUBSCRIPTION.CANCELLED` marks `cancel_at_period_end = true` and keeps future paid-through access.
- `BILLING.SUBSCRIPTION.EXPIRED` downgrades to Free.
- `PAYMENT.SALE.REFUNDED` and `PAYMENT.SALE.REVERSED` are logged as unhandled-but-known events without mutating entitlement.

- [ ] **Step 2: Run failing tests**

Run:

```bash
npx tsx --test tests/paypal-webhook-handlers.test.ts
```

Expected: fails because handlers do not exist.

- [ ] **Step 3: Implement handlers**

Create `src/lib/paypal/webhook-handlers.ts`.

Every handler entry must call:

```ts
const claimed = await claimWebhookEvent(deps.supabase, "paypal", event.id, event.event_type)
if (!claimed) return { skipped: true }
```

before mutating profile or billing state.

Supported mutating events:

- `BILLING.SUBSCRIPTION.ACTIVATED`
- `PAYMENT.SALE.COMPLETED`
- `BILLING.SUBSCRIPTION.PAYMENT.FAILED`
- `BILLING.SUBSCRIPTION.CANCELLED`
- `BILLING.SUBSCRIPTION.SUSPENDED`
- `BILLING.SUBSCRIPTION.EXPIRED`

Known log-only events:

- `BILLING.SUBSCRIPTION.CREATED`
- `BILLING.SUBSCRIPTION.UPDATED`
- `PAYMENT.SALE.REFUNDED`
- `PAYMENT.SALE.REVERSED`

- [ ] **Step 4: Implement verified route**

Create `src/app/api/paypal/webhook/route.ts`:

- Read raw body.
- Verify via PayPal `/v1/notifications/verify-webhook-signature` using `PAYPAL_WEBHOOK_ID`.
- Return 400 on failed verification.
- Dispatch to `handlePayPalWebhookEvent`.

- [ ] **Step 5: Run tests**

Run:

```bash
npx tsx --test tests/paypal-webhook-handlers.test.ts
```

Expected: pass.

## Task 6: Checkout UI with Feature Flag and Lazy PayPal

**Files:**
- Create: `src/components/checkout/payment-method-checkout.tsx`
- Create: `src/components/checkout/paypal-subscription-button.tsx`
- Modify: `src/app/pricing/pricing-cards.tsx`
- Modify: `src/components/quiz/result-offer-pricing.tsx`
- Test: `tests/payment-method-checkout.test.tsx`

- [ ] **Step 1: Write failing UI tests**

Create `tests/payment-method-checkout.test.tsx` using `node:test`, `node:assert/strict`, and `renderToStaticMarkup` where possible. Cover:

- PayPal option is hidden unless `NEXT_PUBLIC_PAYPAL_ENABLED=true`.
- With PayPal enabled, the checkout renders PayPal first, then an "oder" divider, then a "Karte / SEPA" fallback.
- The Stripe Embedded Checkout area is collapsed until "Karte / SEPA" is selected.
- User-facing copy does not mention "Stripe", "native", "nativ integriert", "über Stripe", or "keine doppelte Zahlung".
- Checkout does not show paid-through cancellation copy; paid-through semantics are reserved for profile/cancellation UI.
- Selected plan copy stays unchanged.
- PayPal success URL is `/welcome?provider=paypal&subscription_id=...`.
- Provider metadata for `checkout_started` includes `provider`.

- [ ] **Step 2: Run failing UI tests**

Run:

```bash
npx tsx --test tests/payment-method-checkout.test.tsx tests/result-offer-page.test.tsx
```

Expected: fails until checkout shell exists.

- [ ] **Step 3: Build checkout shell**

Create `PaymentMethodCheckout`:

- Shows the official PayPal button as the first express checkout action when PayPal is enabled.
- Shows an "oder" divider and a "Karte / SEPA" control below PayPal.
- Expands the existing Stripe Embedded Checkout only after the user selects "Karte / SEPA".
- Matches the aligned mockup in `docs/mockups/paypal-offer-payment-mockup.html`.
- Keeps checkout copy customer-facing and German-only: no provider implementation labels such as "über Stripe" or "nativ integriert".
- Does not surface double-payment prevention or paid-through cancellation semantics as checkout value propositions.
- Shows PayPal only when `NEXT_PUBLIC_PAYPAL_ENABLED === "true"`.
- Calls existing Stripe Embedded Checkout path unchanged.
- Lazy-loads the PayPal button with `next/dynamic`.
- Tracks `checkout_started` with `provider`, `interval`, `lead_id`, and `source`.

- [ ] **Step 4: Build PayPal button**

Create `PayPalSubscriptionButton`:

- Uses `@paypal/react-paypal-js`.
- SDK options include `client-id`, `vault=true`, `intent=subscription`, `currency=EUR`.
- `createSubscription` uses `getPayPalPlanId(interval)`.
- `onApprove` redirects to `/welcome?provider=paypal&subscription_id=${data.subscriptionID}`.
- German error copy: "PayPal-Zahlung konnte nicht gestartet werden. Bitte versuche es erneut."

- [ ] **Step 5: Replace Stripe-only panels**

Modify:

- `src/app/pricing/pricing-cards.tsx`
- `src/components/quiz/result-offer-pricing.tsx`

Keep existing plan selection and Stripe fetch-client-secret behavior.

- [ ] **Step 6: Run UI tests**

Run:

```bash
npx tsx --test tests/payment-method-checkout.test.tsx tests/result-offer-page.test.tsx
npm run typecheck
```

Expected: pass.

## Task 7: PayPal In-App Cancellation and Profile Provider Query

**Files:**
- Create: `src/app/api/paypal/cancel-subscription/route.ts`
- Modify: `src/components/profile/manage-subscription-button.tsx`
- Modify: `src/app/profile/page.tsx`
- Test: `tests/paypal-cancel.test.ts`

- [ ] **Step 1: Write failing cancellation tests**

Create `tests/paypal-cancel.test.ts` covering:

- unauthenticated requests return 401.
- Stripe users are rejected by the PayPal cancellation route.
- PayPal users call PayPal cancel API with their provider subscription ID.
- future paid-through cancellation keeps profile access active.
- expired paid-through cancellation downgrades to Free.
- profile query returns the current provider using `billing_subscriptions` filtered by current access state.

- [ ] **Step 2: Run failing tests**

Run:

```bash
npx tsx --test tests/paypal-cancel.test.ts
```

Expected: fails until route and query helper exist.

- [ ] **Step 3: Implement cancellation route**

Create `src/app/api/paypal/cancel-subscription/route.ts`:

- Authenticate user.
- Load current billing subscription by user.
- Require `provider === "paypal"`.
- Call `cancelPayPalSubscription(subscriptionId, "User requested cancellation in Chaarlie")`.
- Update billing row to `provider_status = "CANCELLED"`, `cancel_at_period_end = true`, and `cancelled_at = now`.
- Mirror the profile through entitlement helper.

- [ ] **Step 4: Update profile UI query**

In `src/app/profile/page.tsx`, load provider details with an explicit query equivalent to:

```ts
.from("billing_subscriptions")
.select("provider, provider_status, entitlement_status, interval, current_period_end, cancel_at_period_end")
.eq("user_id", user.id)
.in("entitlement_status", ["active", "past_due", "canceled"])
.order("current_period_end", { ascending: false, nullsFirst: false })
.limit(1)
.maybeSingle()
```

Use Stripe Portal for `provider === "stripe"`. Use in-app PayPal cancellation for `provider === "paypal"`.

German PayPal copy:

- "Dein Abo bleibt bis zum {date} aktiv."
- "Danach wird es nicht verlängert."
- "Zahlungsmethode ändern: Bitte aktualisiere deine Zahlungsquelle direkt in PayPal."
- Confirm button: "Abo kündigen"

- [ ] **Step 5: Run cancellation tests**

Run:

```bash
npx tsx --test tests/paypal-cancel.test.ts
```

Expected: pass.

## Task 8: Reconciliation, Cron, and Final Verification

**Files:**
- Create: `src/app/api/billing/reconcile/route.ts`
- Create: `vercel.json`
- Modify: `src/lib/customerio-tracking.ts` only if event typing blocks provider metadata.
- Test: `tests/billing-paypal-server.test.ts`

- [ ] **Step 1: Add route tests**

In `tests/billing-paypal-server.test.ts`, cover:

- reconciliation route requires `Authorization: Bearer ${CRON_SECRET}`.
- expired canceled/past-due rows downgrade to Free.
- future paid-through rows remain active.
- Stripe rows backfilled from profiles are included in reconciliation.

- [ ] **Step 2: Implement route**

Create `src/app/api/billing/reconcile/route.ts`:

- Runtime `nodejs`.
- Check `Authorization: Bearer ${CRON_SECRET}`.
- Use service-role Supabase client.
- Load Free tier ID.
- Call `reconcileExpiredBillingEntitlements`.
- Return JSON `{ downgraded: number }`.

- [ ] **Step 3: Add cron config**

Create `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/billing/reconcile",
      "schedule": "15 2 * * *"
    }
  ]
}
```

Do not add unrelated deploy config. Future Vercel config must be merged into this file.

- [ ] **Step 4: Add env docs**

Required env vars:

```bash
NEXT_PUBLIC_PAYPAL_ENABLED=false
NEXT_PUBLIC_PAYPAL_CLIENT_ID=...
PAYPAL_CLIENT_ID=...
PAYPAL_CLIENT_SECRET=...
PAYPAL_WEBHOOK_ID=...
PAYPAL_ENVIRONMENT=sandbox
PAYPAL_PLAN_ID_MONTHLY=...
PAYPAL_PLAN_ID_QUARTERLY=...
PAYPAL_PLAN_ID_ANNUAL=...
CRON_SECRET=...
```

- [ ] **Step 5: Run automated verification**

Run:

```bash
npx tsx --test tests/billing-paypal-server.test.ts tests/paypal-webhook-handlers.test.ts tests/paypal-cancel.test.ts tests/payment-method-checkout.test.tsx tests/result-offer-page.test.tsx
npm run typecheck
npm run lint
npm run build
```

Expected: all pass.

- [ ] **Step 6: Run manual PayPal sandbox verification**

Run:

```bash
npm run paypal:validate-plans
npm run dev:worktree
```

Manual checks:

- PayPal is hidden when `NEXT_PUBLIC_PAYPAL_ENABLED=false`.
- PayPal appears as the first express checkout action when enabled.
- "Karte / SEPA" appears below an "oder" divider and expands the existing Stripe Embedded Checkout.
- Checkout copy does not mention "Stripe", "native", "nativ integriert", or "keine doppelte Zahlung" to customers.
- Monthly, Quarterly, Yearly PayPal plan IDs validate as EUR `7.49`, `17.49`, `49.99`.
- Existing Premium user cannot start a second Stripe or PayPal checkout.
- PayPal sandbox approval that returns pending shows "Wir aktivieren dein Abo..." and then reaches account activation.
- New PayPal subscriber can set password and reach onboarding.
- Existing PayPal subscriber is reused by email without duplicate account creation.
- PayPal webhook replay is idempotent.
- PayPal cancellation stops renewal and keeps access through paid-through date.
- Reconciliation downgrades expired PayPal access.
- Existing Stripe checkout and Stripe Customer Portal still work.

## PayPal Dashboard Setup

Manual setup:

- Create sandbox REST app.
- Create Catalog Product for Chaarlie Premium.
- Create three active Billing Plans:
  - Monthly: EUR `7.49`, month x1.
  - Quarterly: EUR `17.49`, month x3.
  - Yearly: EUR `49.99`, year x1.
- Register webhook endpoint `/api/paypal/webhook`.
- Subscribe to:
  - `BILLING.SUBSCRIPTION.CREATED`
  - `BILLING.SUBSCRIPTION.ACTIVATED`
  - `BILLING.SUBSCRIPTION.UPDATED`
  - `BILLING.SUBSCRIPTION.CANCELLED`
  - `BILLING.SUBSCRIPTION.SUSPENDED`
  - `BILLING.SUBSCRIPTION.EXPIRED`
  - `BILLING.SUBSCRIPTION.PAYMENT.FAILED`
  - `PAYMENT.SALE.COMPLETED`
  - `PAYMENT.SALE.REFUNDED`
  - `PAYMENT.SALE.REVERSED`
- Run `npm run paypal:validate-plans` before enabling PayPal in any environment.

## Verification Summary

Automated:

- `npx tsx --test tests/billing-paypal-server.test.ts`
- `npx tsx --test tests/paypal-webhook-handlers.test.ts`
- `npx tsx --test tests/paypal-cancel.test.ts`
- `npx tsx --test tests/payment-method-checkout.test.tsx`
- `npx tsx --test tests/result-offer-page.test.tsx`
- `npx playwright test tests/stripe-webhook-handlers.spec.ts tests/auth-post-checkout-routes.spec.ts`
- `npm run typecheck`
- `npm run lint`
- `npm run build`

Manual:

- `npm run paypal:validate-plans`
- PayPal sandbox checkout.
- PayPal webhook replay.
- PayPal approval-pending welcome flow.
- PayPal in-app cancellation.
- Reconciliation downgrade.
- Stripe regression checkout and Stripe Customer Portal.
- Browser review for pricing and quiz offer checkout on desktop and mobile.

## Ready Check

Because this touches payment UX, cancellation UX, account activation, analytics, and trust-sensitive German copy, run `ready-check` before shipping.

## Next Skill

Use `superpowers:subagent-driven-development` next after refreshing or recreating this worktree from current `origin/main`.
