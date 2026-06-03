# Stripe SEPA Sunset Containment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** `docs/superpowers/specs/2026-06-02-stripe-sepa-sunset-containment-design.md`

**User Situation:** Chaarlie wants to stop offering SEPA for new purchases because delayed settlement, pending states, possible reversals, and renewal uncertainty add too much operational risk. Users who have not already received app access through an active subscription should switch to another payment method.

**Promised End State:** New Stripe Checkout Sessions do not offer SEPA; completed unpaid SEPA Checkout Sessions do not grant new access; card Checkout still works; existing active SEPA subscriptions keep running under normal renewal/failure behavior; existing SEPA subscriptions are audited before any global Stripe/Dashboard disablement.

**Goal:** Ship a small SEPA containment patch instead of the larger checkout-attempt architecture refactor.

**Architecture:** Remove the local `stripe_checkout_intents` WIP from this release because the remote migration was never applied and SEPA is being sunset. Keep Stripe Dashboard payment methods for general configuration, but use server-side `excluded_payment_method_types: ["sepa_debit"]` on new Checkout Sessions to block SEPA at code level. Keep activation strict: completed unpaid Checkout Sessions do not grant new access. Treat existing SEPA renewals as an operational migration path rather than a checkout-flow refactor.

**Tech Stack:** Next.js App Router API routes, Stripe Node SDK (`apiVersion: "2026-04-22.dahlia"`), Supabase, Playwright tests, Node `tsx --test` tests.

---

## Locked Decisions

- Do not globally disable SEPA in Stripe Dashboard during this release.
- Do not rely on hiding SEPA in the frontend. Checkout methods are determined server-side by Stripe from Dashboard-managed methods.
- Stop new SEPA checkouts with `excluded_payment_method_types: ["sepa_debit"]` in `stripe.checkout.sessions.create`.
- Do not ship the larger `stripe_checkout_attempts` rename/service/webhook split for this release.
- Do not ship the current WIP `stripe_checkout_intents` duplicate guard in this release. The migration was not applied remotely, and the SEPA sunset patch does not need a new local lock table.
- Do not grant new access for completed unpaid SEPA Checkout. Users who hit this state should switch to another payment method.
- Existing SEPA renewals are grandfathered temporarily until audited and migrated.
- Existing SEPA renewal failures use the normal failed-payment path.
- Renewal migration must account for Stripe payment-method priority: if `subscription.default_payment_method` is SEPA, changing only `customer.invoice_settings.default_payment_method` may not be enough.

## Target File Map

- Modify: `src/app/api/stripe/create-checkout-session/route.ts`
- Create small helper for testability: `src/lib/stripe/checkout-session-params.ts`
- Modify: `src/lib/stripe/checkout-activation.ts`
- Modify/keep: `src/lib/stripe/webhook-handlers.ts`
- Modify/keep: `src/app/api/stripe/webhook/route.ts`
- Delete from final diff: `src/lib/stripe/checkout-intents.ts`
- Delete from final diff: `supabase/migrations/20260602_add_stripe_checkout_intents.sql`
- Modify tests:
  - `tests/billing-paypal-server.test.ts`
  - `tests/checkout-activation.spec.ts`
  - `tests/stripe-webhook-handlers.spec.ts`
  - `tests/customerio-stripe-webhook.test.ts`
  - `tests/stripe-purchase-analytics.spec.ts`
- Add operational doc: `docs/stripe-sepa-renewal-migration.md`

## Non-Goals

- No new checkout-attempt table.
- No new Stripe checkout-intents table.
- No `stripe_checkout_intents` to `stripe_checkout_attempts` rename.
- No broad webhook file split.
- No automatic migration of existing SEPA subscriptions in this release.
- No customer-facing email/copy implementation in this release.
- No cleanup of already duplicated live Stripe subscriptions in this release.

## Task 0: Remove Prior Stripe Checkout-Intents WIP From This Release

**Files:**

- Inspect: `git status --short`
- Delete: `src/lib/stripe/checkout-intents.ts`
- Delete: `supabase/migrations/20260602_add_stripe_checkout_intents.sql`
- Modify: `src/app/api/stripe/create-checkout-session/route.ts`
- Modify: `src/lib/stripe/webhook-handlers.ts`
- Modify: `tests/billing-paypal-server.test.ts`
- Modify: `tests/stripe-webhook-handlers.spec.ts`
- Modify: `tests/customerio-stripe-webhook.test.ts`

- [ ] **Step 1: Confirm the implementation starts from the containment scope**

Run:

```bash
git status --short
```

Expected: identify the current WIP references to `stripe_checkout_intents` so they can be removed cleanly.

- [ ] **Step 2: Delete the local checkout-intents files**

Remove these files from the final diff:

```text
src/lib/stripe/checkout-intents.ts
supabase/migrations/20260602_add_stripe_checkout_intents.sql
```

Expected: no production code depends on a local Stripe checkout-intents table.

- [ ] **Step 3: Remove checkout-intents from the Stripe checkout route**

In `src/app/api/stripe/create-checkout-session/route.ts`, remove:

- imports from `@/lib/stripe/checkout-intents`
- `findReusableStripeCheckoutIntent`
- `createStripeCheckoutIntent`
- `bindStripeCheckoutIntentToSession`
- `markStripeCheckoutIntentFailedById`
- `StripeCheckoutIntentConflictError`
- `StripeCheckoutIntentRow`
- `createStripeCheckoutIntentConflictResponse`
- `markStripeCheckoutIntentFailedBestEffort`
- `expireStripeCheckoutSessionBestEffort` if it only exists for checkout-intent bind failure compensation

Expected: the route creates a Stripe Checkout Session directly after existing identity/access checks, then returns `{ client_secret: session.client_secret }`.

- [ ] **Step 4: Remove checkout-intents from webhook handlers**

In `src/lib/stripe/webhook-handlers.ts`, remove:

- imports from `@/lib/stripe/checkout-intents`
- calls to `markStripeCheckoutIntentActivated`
- calls to `markStripeCheckoutIntentExpired`
- calls to `markStripeCheckoutIntentFailed`

Expected: existing subscription behavior, async failure revocation, dispute revocation, subscription updated/deleted, and `invoice.payment_failed` behavior remain intact.

- [ ] **Step 5: Remove checkout-intents tests and stubs**

In `tests/billing-paypal-server.test.ts`, remove:

- imports from `../src/lib/stripe/checkout-intents`
- the `stripe_checkout_intents` table stub branches
- tests for Stripe checkout-intent creation/bind/fail/expire
- tests for `createStripeCheckoutIntentConflictResponse`

In `tests/stripe-webhook-handlers.spec.ts` and `tests/customerio-stripe-webhook.test.ts`, remove `stripe_checkout_intents` table stub branches and assertions that only exist to verify intent marking.

Delete these whole intent-only webhook tests, because they have no remaining behavior once local checkout-intent marking is removed:

- `tests/stripe-webhook-handlers.spec.ts`: `checkout.session.expired releases a Stripe checkout intent lock`
- `tests/stripe-webhook-handlers.spec.ts`: `checkout.session.async_payment_succeeded marks Stripe checkout intent activated without changing access`
- `tests/customerio-stripe-webhook.test.ts`: `checkout.session.expired releases a Stripe checkout intent lock`
- `tests/customerio-stripe-webhook.test.ts`: `checkout.session.async_payment_succeeded marks Stripe checkout intent activated without changing access`

Preserve async-failed, dispute, subscription updated/deleted, and `invoice.payment_failed` tests. Those verify real subscription/access behavior, not local intent bookkeeping.

Expected: tests still cover PayPal checkout intents, Stripe access activation, Stripe async failure revocation, disputes, and Customer.io lifecycle behavior.

- [ ] **Step 6: Confirm abandoned architecture files are absent**

The following files should not exist in the final diff:

```text
supabase/migrations/20260602160000_add_stripe_checkout_attempts.sql
src/lib/stripe/checkout-attempts.ts
src/lib/stripe/checkout-session-service.ts
```

Expected: absent. If they exist only because of the abandoned architecture plan, remove them.

## Task 1: Block SEPA for New Stripe Checkout Sessions

**Files:**

- Modify: `src/app/api/stripe/create-checkout-session/route.ts`
- Create: `src/lib/stripe/checkout-session-params.ts`
- Test: `tests/billing-paypal-server.test.ts`

- [ ] **Step 1: Extract a small Checkout params helper and write a failing test**

Extract the Checkout Session params from `create-checkout-session/route.ts` into `src/lib/stripe/checkout-session-params.ts` so the SEPA exclusion can be tested without constructing a full Next request. Add a test equivalent to:

```ts
test("Stripe subscription checkout excludes SEPA for new sessions", () => {
  const params = buildStripeSubscriptionCheckoutSessionParams({
    priceId: "price_month",
    interval: "month",
    customerId: null,
    customerEmail: "buyer@example.com",
    origin: "https://chaarlie.de",
    discountCouponId: "coupon_50",
    leadId: "11111111-1111-4111-8111-111111111111",
  })

  assert.deepEqual(params.excluded_payment_method_types, ["sepa_debit"])
  assert.equal(params.mode, "subscription")
  assert.equal(params.ui_mode, "embedded_page")
  assert.deepEqual(params.line_items, [{ price: "price_month", quantity: 1 }])
})
```

- [ ] **Step 2: Preserve existing Checkout params while adding exclusion**

Update `stripe.checkout.sessions.create` so the created session includes:

```ts
excluded_payment_method_types: ["sepa_debit"],
```

Preserve the current params:

- `mode: "subscription"`
- `ui_mode: "embedded_page"`
- `line_items`
- `customer` or `customer_email`, never both
- `return_url`
- `automatic_tax`
- `consent_collection`
- existing German terms custom text
- discount coupon when configured
- lead metadata

- [ ] **Step 3: Run the focused test**

Run:

```bash
npx tsx --test tests/billing-paypal-server.test.ts
```

Expected: PASS.

## Task 2: Reject Unpaid SEPA Checkout for New Access

**Files:**

- Modify: `src/lib/stripe/checkout-activation.ts`
- Verify: `src/lib/stripe/purchase-analytics.ts`
- Test: `tests/checkout-activation.spec.ts`
- Test: `tests/stripe-purchase-analytics.spec.ts`

- [ ] **Step 1: Remove unpaid-SEPA activation**

In `src/lib/stripe/checkout-activation.ts`, `assertCheckoutPaymentAuthorized` must not return for `payment_status === "unpaid"` even when `subscription.default_payment_method.type === "sepa_debit"`.

The authorization rule for this release is:

```ts
session.status === "complete"
session.payment_status === "paid"
```

Any completed unpaid Checkout Session throws `checkout_session_unpaid`, including SEPA. This intentionally forces users who reached unpaid SEPA Checkout without existing access to use another payment method.

After removing the SEPA branch, drop the unused `sub` parameter from `assertCheckoutPaymentAuthorized` and update both call sites in `verifyCheckoutSessionForActivation` and `ensureCheckoutAccount`. The `session.status === "complete"` check remains in the existing session-shape validation; `assertCheckoutPaymentAuthorized` only needs to check `payment_status`.

- [ ] **Step 2: Update activation tests**

In `tests/checkout-activation.spec.ts`, replace the previous unpaid-SEPA-grants test with a rejection test:

```ts
test("verifyCheckoutSessionForActivation rejects complete unpaid SEPA sessions during SEPA sunset", async () => {
  const stripe = stripeForCheckoutActivation({
    default_payment_method: { id: "pm_sepa", type: "sepa_debit" },
  })

  await expect(verifyCheckoutSessionForActivation("cs_unpaid_sepa", stripe)).rejects.toMatchObject({
    code: "checkout_session_unpaid",
  })
})
```

- [ ] **Step 3: Verify analytics selected-method parsing**

`purchase-analytics.ts` may keep its existing local `default_payment_method` parser for this release. Analytics does not gate access, and a shared selected-payment helper is outside this containment patch.

Expected: analytics still reports `paymentMethodType` from the retrieved Subscription default payment method when available.

- [ ] **Step 4: Run activation tests**

Run:

```bash
npx playwright test tests/checkout-activation.spec.ts tests/auth-post-checkout-routes.spec.ts --project=chromium
npx tsx --test tests/stripe-purchase-analytics.spec.ts
```

Expected: PASS, including:

- unpaid SEPA rejects access
- unpaid card/non-SEPA rejects access
- SEPA offered but not selected rejects access

## Task 3: Preserve Existing Subscription Failure and Dispute Handling

**Files:**

- Modify/keep: `src/lib/stripe/webhook-handlers.ts`
- Modify/keep: `src/app/api/stripe/webhook/route.ts`
- Test: `tests/stripe-webhook-handlers.spec.ts`
- Test: `tests/customerio-stripe-webhook.test.ts`

- [ ] **Step 1: Verify only: keep webhook dispatch for delayed-payment events**

Ensure `src/app/api/stripe/webhook/route.ts` handles:

```text
checkout.session.completed
checkout.session.async_payment_failed
charge.dispute.created
customer.subscription.updated
customer.subscription.deleted
invoice.payment_failed
```

After removing local checkout-intent marking:

- keep `checkout.session.expired` routed to an explicit no-op/logging handler, or remove the case and handler together
- handle `checkout.session.async_payment_succeeded` as fulfillment for delayed non-SEPA payment methods, while explicitly skipping SEPA async success during the SEPA sunset

Recommended: keep `checkout.session.expired` as explicit no-op/logging, and keep `checkout.session.async_payment_succeeded` routed so Dashboard-managed delayed non-SEPA methods do not dead-end.

Expected in the current WIP: these events are already dispatched. Do not rewrite the dispatcher unless verification shows a missing case.

- [ ] **Step 2: Verify only: async failure revokes only the relevant subscription**

`checkout.session.async_payment_failed`, when received for an existing subscription/customer, should:

- identify the Stripe customer and subscription from the Checkout Session
- downgrade the matching profile if it still points at that subscription
- mark the matching Stripe billing row canceled/payment failed
- best-effort cancel the matching Stripe subscription if cancellable
- avoid clobbering a newer active subscription on the same profile

- [ ] **Step 3: Verify only: dispute revocation resolves the disputed subscription**

`charge.dispute.created` should:

- resolve the disputed charge's subscription when possible
- revoke/cancel that subscription
- avoid canceling a newer unrelated subscription when the disputed subscription cannot be resolved
- log a warning when resolution fails

- [ ] **Step 4: Run webhook tests**

Run:

```bash
npx playwright test tests/stripe-webhook-handlers.spec.ts --project=chromium
npx tsx --test tests/customerio-stripe-webhook.test.ts
```

Expected: PASS.

## Task 4: Document Existing SEPA Renewal Handling

**Files:**

- Create: `docs/stripe-sepa-renewal-migration.md`

- [ ] **Step 1: Write the operational migration doc**

Create `docs/stripe-sepa-renewal-migration.md` with:

```md
# Stripe SEPA Renewal Migration

## Current Policy

New Checkout Sessions exclude SEPA Direct Debit in code. Existing SEPA subscriptions are grandfathered temporarily and must be audited before any global Stripe Dashboard disablement.

## Audit

Find active/trialing/past_due Stripe subscriptions where the actual selected/default payment method is `sepa_debit`.

Record:

- Stripe customer ID
- Stripe subscription ID
- customer email
- subscription status
- current period end
- whether `subscription.default_payment_method` is SEPA
- whether `customer.invoice_settings.default_payment_method` is SEPA

## Migration Choice

If `subscription.default_payment_method` is SEPA, prefer a subscription-specific payment update link or a setup-mode card flow that updates `subscription.default_payment_method`.

If only `customer.invoice_settings.default_payment_method` is SEPA, a Customer Portal `payment_method_update` flow may be sufficient because it sets the customer invoice default payment method.

## Recommended Rollout

1. Keep existing SEPA renewals active while auditing.
2. Send affected users a card update request.
3. For small numbers, use Stripe Dashboard subscription payment update links.
4. For larger numbers, build a card-only setup Checkout flow and update `subscription.default_payment_method`.
5. After a deadline, decide whether to keep grandfathering, cancel at period end, or enforce card-only renewal.

## Do Not Do Yet

Do not globally disable SEPA in Stripe Dashboard until the audit confirms existing SEPA subscriptions have been migrated or intentionally grandfathered.
```

- [ ] **Step 2: Verify current Stripe Portal route**

Confirm `src/app/api/stripe/portal-session/route.ts` still creates a generic Billing Portal session. This can be used for users who only need to update the customer invoice default payment method, but it may not override a subscription-level SEPA default.

## Task 5: Final Verification

**Files:**

- All files touched above.

- [ ] **Step 1: Run focused payment tests**

Run:

```bash
npx tsx --test tests/billing-paypal-server.test.ts tests/customerio-stripe-webhook.test.ts tests/stripe-purchase-analytics.spec.ts
npx playwright test tests/checkout-activation.spec.ts tests/auth-post-checkout-routes.spec.ts tests/stripe-webhook-handlers.spec.ts --project=chromium
```

Expected: PASS.

- [ ] **Step 2: Run repo quality gates**

Run:

```bash
npm run ci:verify
npm run test:playwright:contracts
git diff --check
```

Expected: PASS. Existing unrelated lint warnings may remain only if `npm run ci:verify` already tolerates them.

- [ ] **Step 3: Manual Stripe smoke**

In test mode:

- Start a new Checkout Session and confirm SEPA is not displayed.
- Complete a card Checkout and confirm `/welcome` still works.
- Replay or simulate a completed unpaid SEPA Checkout and confirm `/welcome` does not grant access.
- Replay or simulate a non-SEPA `checkout.session.async_payment_succeeded` and confirm it grants access.
- Replay or simulate a SEPA `checkout.session.async_payment_succeeded` and confirm it remains no-grant during the sunset.
- Simulate `checkout.session.async_payment_failed` and confirm access is revoked for the relevant subscription.

Rollback path: if excluding SEPA causes an unexpected Checkout issue, remove the single `excluded_payment_method_types: ["sepa_debit"]` param and redeploy. Stripe Dashboard payment-method settings are intentionally left unchanged in this release.

- [ ] **Step 4: Review gate**

Before shipping:

- request code review
- run Claude code review
- request the Codex `ready-check` skill because this touches payment trust and onboarding access

## Self-Review Checklist

- The plan blocks SEPA for new Checkout at server level, not frontend level.
- The plan does not globally disable SEPA before renewal audit.
- Completed unpaid SEPA Checkout does not grant new access.
- SEPA delayed failure/dispute revocation remains active.
- Renewal migration notes distinguish customer default payment method from subscription default payment method.
- The abandoned checkout-attempt architecture is not part of this release.
