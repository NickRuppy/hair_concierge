# Billing Plan-Change Reliability Plan

## Status

Hardened through five read-only Claude review passes, confirmed by the product owner, and ready for implementation. The state-comparison mockup was explicitly approved on 16 July 2026. This plan is based on the current `origin/main` code and the production failure observed on 16 July 2026. No application, Stripe, or Supabase state is changed by this planning pass.

## Implementation Goal Contract

**Outcome:** A renewing member can schedule a monthly, quarterly, or yearly plan change for the next renewal. Billing analytics are emitted from persisted plan-change transitions and can never prevent, duplicate, or misreport the provider operation.

**Scope:** The authenticated plan-change command, its Stripe and PayPal provider paths, plan-change analytics/outbox delivery, Stripe cancellation ingestion, Profile membership state, and focused regression coverage.

**Verification:** Automated tests must prove the normal Stripe plan-change path reaches a persisted `scheduled` state when analytics insertion or delivery fails. Either Stripe cancellation signal must block switching through the live provider guard; new webhook updates must persist normalized cancellation state and hide the selector. The one known pre-deploy stale internal row must receive an explicit Stripe update replay/backfill before its selector-hide acceptance check. The linked database must contain the new cancellation timestamp column before timestamp-reading code is deployed.

**Stop conditions:** Do not change pricing, add immediate/prorated switching, redesign the Profile page, mutate a live subscription, deploy, or ship without separate authorization. Stop if provider behavior contradicts the next-renewal assumptions. Cancellation is the locked winner over a pending plan change; if Stripe permits a portal cancellation to coexist with a feature-owned schedule, stop before inventing unverified schedule-release behavior and return with provider evidence.

**Release decision:** Do not ship the one-line profile-projection deletion alone. Use two deployable commits/PRs: (1) urgent restore containing the invalid projection removal, live `cancel_at` guard, billing-first phase sequencing, applied-phase catch, and focused regression coverage; (2) hardening containing the handler injection seam/behavioral tests, cancellation timestamp migration/Profile date, poison isolation, and controlled retry drain. This limits the production outage without reopening cancellation risk. Each slice still requires its own verification and explicit ship/deploy authorization.

## Confirmed Failure

The visible `502` was not caused by canceling first and was not a browser CSP failure.

1. `src/app/api/billing/change-plan/route.ts` claims the plan-change ledger row and then awaits `recordPlanChangePhase(..., "requested")` before calling Stripe or PayPal.
2. That helper creates and immediately dispatches a billing analytics event.
3. Dispatch queries `profiles.cancel_at_period_end` in `src/lib/billing/analytics-outbox.ts`, but that column does not exist on `profiles` (`42703`).
4. The route marks the operation failed and returns `502`; Stripe therefore never receives a schedule request.

There is a separate state-model gap. The tested Stripe subscription was active with `cancel_at_period_end=false` but had a future `cancel_at` timestamp. Current webhook persistence, membership eligibility, and the live Stripe guard only inspect `cancel_at_period_end`, so Profile incorrectly continues to offer plan switching for a subscription that is already scheduled to end.

The live outbox was rechecked after the second review: it contains 4 events and 10 deliveries, all created on 16 July 2026 — Customer.io `processing` (4), PostHog `pending` (4), and Meta `pending` (2). There is no multi-day backlog in current production, but rollout must recover all 10 rows rather than assuming only the two rows from one request.

## Considered Approaches

| Approach | Complexity | Tradeoff | Decision |
| --- | --- | --- | --- |
| Billing-first transitions with deferred analytics | Medium | Fixes sequencing and preserves the existing ledger/outbox architecture | **Chosen** |
| Catch the current analytics error and remove the bad profile field | Low | Restores switching but leaves analytics in front of billing and cancellation state incomplete | Rejected |
| Rebuild plan changes as one database command/outbox transaction | High | Strongest coupling, but provider mutations cannot be inside the database transaction and the redesign is disproportionate | Rejected |

## Locked Behavior

- The plan change modifies the existing provider subscription and starts at the next renewal without proration or an immediate charge.
- The database plan-change ledger is the product source of truth for request, scheduled, reconciliation, applied, and failed states.
- Stripe/PayPal mutations and required ledger transitions are synchronous. Analytics and convenience metadata run only after the authoritative provider/ledger outcome.
- A side-effect failure may be logged and retried, but must not change a successful provider result into a client-visible failure.
- Keep the canonical analytics event name `subscription_updated` and phases `requested`, `approved`, `failed`, and `applied`; do not add a new event taxonomy.
- `requested` means the idempotent ledger claim succeeded. Its event timestamp comes from the persisted operation; the outbox record is created after the provider/ledger outcome and destination delivery runs after the response.
- `approved`, `failed`, and `applied` are emitted only after the corresponding ledger transition has persisted.
- Restrict plan-change analytics to Customer.io and PostHog. Do not emit Meta conversion events for a plan switch.
- A scheduled cancellation is never reversed by changing plans. The selector remains unavailable until renewal is explicitly resumed.
- Treat Stripe `cancel_at_period_end=true` and any non-null Stripe `cancel_at` as scheduled cancellation signals.
- If a user later requests cancellation while a plan change is pending, cancellation wins and the plan change must never silently resume renewal. The currently reproduced account does not exercise this reverse-order collision because Stripe reported `schedule=null`.
- Block switching for any non-null `cancel_at`, even if it is later than the next period end. This is intentionally conservative: a user who has scheduled an end date must explicitly resume renewal through the existing Stripe portal before Chaarlie changes billing cadence. The Profile management button remains the in-product path to that portal; no separate reactivation UI is added.
- Keep `cancel_scheduled_at`; it is load-bearing for showing the actual scheduled end date rather than labeling `current_period_end` as the end when those dates differ.
- Preserve the existing source-text safety assertions in `tests/billing-plan-change.test.ts`, including the literal Customer.io/PostHog destination contract. Do not weaken them to make a refactor pass.
- Accept normal deploy rollback for billing behavior rather than a product feature flag. The retry drain alone has an operational default-off kill switch because replay is separately authorized and destination-bounded.
- Keep `cancel_scheduled_at` required (`string | null`) on `BillingSubscriptionRow`, matching other database row fields, and optional on `BillingSubscriptionInput`. Input omission preserves the stored value; explicit `null` clears it.

## Target Flow

### Normal plan change

1. Authenticate and load the canonical billing subscription.
2. Reject locally known payment, cancellation, same-plan, or open-operation conflicts.
3. Atomically claim the idempotent plan-change ledger operation.
4. Retrieve and validate live provider truth. Stripe must reject either cancellation representation before creating a schedule.
5. Perform the provider mutation.
6. Persist `scheduled`, `pending_approval`, `reconciling`, or `failed` in the ledger.
7. After that outcome is durable, insert the `requested` event and the matching outcome event into the outbox, independently catching either insert failure. Use the operation's persisted timestamps.
8. Pass Next.js `after()` through the outbox's existing `defer` option so only destination delivery runs after the response.
9. Return the authoritative operation result. Auxiliary billing metadata and analytics cannot change the response after the ledger/provider outcome is known.

For every successful ledger claim, emit `requested` after the provider attempt finishes: pair it with `approved` for scheduled/reconciling outcomes, pair it with `failed` for terminal failures, and emit only `requested` for PayPal `pending_approval` or before returning an ambiguous-provider `503`. Reconciliation or PayPal approval emits the later outcome phase when provider truth becomes known.

### Deferred analytics

- Reuse `recordBillingAnalyticsEvent(..., { defer })`: it durably inserts the outbox/delivery rows first and defers only destination dispatch. Do not create a second deferral abstraction.
- Call phase recording only after the provider outcome and ledger transition. Await each insert with an isolated catch/log so analytics cannot turn success into failure and one phase insert cannot suppress the other.
- Catch and log deferred delivery failures with operation ID and phase only; never throw them back into a billing route or webhook.
- Build `occurred_at` from ledger timestamps: `created_at` for requested, `approved_at ?? created_at` for approved, `applied_at ?? updated_at` for applied, and the persisted terminal `updated_at` for failed. The fallbacks satisfy nullable TypeScript fields without using wall-clock time.
- Preserve deterministic event keys so retries create one outbox event and one delivery row per destination.
- Add an automatic due-delivery drain to the existing authenticated daily billing reconciliation job after entitlement reconciliation completes. Await bounded destination-specific batches inside isolated try/catch blocks and return processed/error counts in the cron response so one vendor cannot starve another and outcomes remain visible. Keep the manual retry script for targeted recovery.
- Defer ledger-to-outbox reconstruction. The post-outcome insert has a narrow crash-only loss window, while deterministic event keys, five-attempt delivery retry, and the manual operator path cover the observed failure without introducing a second phase-mapping implementation.

### Cancellation state

- Add nullable `billing_subscriptions.cancel_scheduled_at timestamptz` as the canonical effective cancellation timestamp for Stripe and PayPal when the provider supplies or Chaarlie can safely derive it.
- Backfill it from `current_period_end` where `cancel_at_period_end=true` and a period end is known. This preserves existing Stripe and PayPal scheduled cancellations.
- On Stripe `subscription.updated`, derive the timestamp from `subscription.cancel_at`; otherwise use the current period end when `cancel_at_period_end=true`; clear it when neither signal exists.
- Preserve the existing boolean for compatibility, but normalize it to true at provider ingestion when either Stripe cancellation signal is present. Existing entitlement, display, selection, and analytics helpers can continue using the normalized boolean; do not add redundant provider-specific checks across them.
- Set `cancel_scheduled_at` from PayPal's known paid-through/current-period-end value in its cancellation route, webhook handler, and subscription-shape mapping; keep the current-period fallback for legacy rows without a timestamp.
- In `scheduleStripePlanChange`, independently inspect live Stripe truth and reject when either raw provider field is set. Map this to the existing cancellation conflict/`409` behavior rather than a generic `502`; do not add a clock comparison for `cancel_at`.
- For canceled-at-period-end Profile state, use `cancel_scheduled_at` as the displayed end date when available, otherwise fall back to `current_period_end`.
- Keep entitlement calculations on `current_period_end`. Stripe advances that period boundary while the active subscription continues and converges it with the cancellation boundary when cancellation takes effect; displaying `cancel_scheduled_at` does not change access grants.

## Implementation Steps

### Execution order

- **Urgent restore slice (deployable without a migration):** apply the Step 4 projection fix, the Step 2 live Stripe `cancel_at` guard, and the Step 3 billing-first sequencing/applied-phase catch. Add focused unit/source regressions and run the full slice verification before separately authorized deployment.
- **Hardening slice:** add the Step 3 handler injection seam/behavioral tests, then implement Step 1 migration/types, the remaining Step 2 webhook persistence, Step 5 poison/retry hardening, and Step 6 accurate Profile end date. Apply the additive migration before deploying code that reads/writes the new field.

### 1. Add the canonical cancellation timestamp

Create `supabase/migrations/20260716120000_add_billing_cancel_scheduled_at.sql`:

- add nullable `cancel_scheduled_at timestamptz` to `billing_subscriptions`;
- backfill current scheduled cancellations from `current_period_end`;
- document that it represents the provider-confirmed or safely derived access/renewal stop time;
- keep the change additive and compatible with the currently deployed code.

Update:

- `src/lib/billing/types.ts` to add the field to row/input types;
- `src/lib/billing/subscriptions.ts` to preserve the existing value in `upsertBillingSubscription` and add the field to the explicit `findVisibleBillingSubscriptionForUser` projection used by the membership route;
- `src/app/api/admin/users/route.ts` to add the field to its explicit admin projection;
- billing fixtures that construct complete subscription rows.

Implement the input merge explicitly: destructure `cancel_scheduled_at` as a tri-state input, preserve `existing.cancel_scheduled_at` when it is `undefined`, write the supplied timestamp when it is a string, and clear only on explicit `null`. Stripe normalization must always send `string | null`, never `undefined`; unrelated upserts omit the key.

Do not add a duplicate field to `profiles`.

### 2. Normalize Stripe cancellation ingestion and live validation

Update `src/lib/stripe/webhook-handlers.ts` so the Stripe subscription shape accepts `cancel_at`, derives the ISO timestamp, persists it, and clears it on resumption. Update `src/app/api/stripe/webhook/route.ts` to classify cancellation analytics from either Stripe signal and include the normalized timestamp in event payloads.

Update `src/lib/stripe/subscription-plan-change.ts` to reject a live subscription when `cancel_at_period_end` is true or `cancel_at` is non-null before schedule creation. Keep the existing provider conflict handling and German client behavior.

Update the three PayPal cancellation-writing paths so `cancel_scheduled_at` is populated from their known paid-through/current-period-end value. In `BILLING.SUBSCRIPTION.CANCELLED`, use the existing billing row's `current_period_end`; do not assume that the cancellation webhook payload carries a new period end. Normalize the existing boolean at the Stripe ingestion boundary; do not touch entitlement/display/selection helpers solely to re-check raw Stripe fields. The production-unused but test-covered `formatBillingMembershipStatus` helper is explicitly out of scope and must not be deleted.

### 3. Move all plan-change analytics off the critical path

Refactor `recordPlanChangePhase` in `src/lib/billing/plan-change.ts` to accept/use the persisted transition timestamp instead of `new Date()` and pass the existing `defer` option through to `recordBillingAnalyticsEvent`. Use it consistently in:

- `src/app/api/billing/change-plan/route.ts`;
- `src/app/api/billing/change-plan/paypal/return/route.ts`;
- `src/app/api/billing/change-plan/paypal/cancel/route.ts`;
- `src/lib/paypal/stale-plan-change.ts` through an injected defer dependency, updating both callers in the change-plan route and membership route;
- `src/lib/stripe/webhook-handlers.ts`, adding defer plumbing from the Stripe webhook route through `handleSubscriptionUpdated` to `applyPlanChangeAtRenewal`;
- `src/lib/paypal/webhook-handlers.ts`, passing its existing `PayPalWebhookDeps.defer` through its renewal call to `applyPlanChangeAtRenewal`.

Move every plan-change analytics insert after the authoritative provider/ledger outcome and catch failures independently. In particular, the `requested` call must no longer sit between `claimPlanChange` and `scheduleStripePlanChange`/`initiatePayPalPlanChange`. Destination delivery must always use the injected deferred callback.

Inside `applyPlanChangeAtRenewal`, catch phase-recording failure after the interval and ledger have been updated. Analytics failure must not prevent Stripe/PayPal webhook completion or the subsequent legacy-profile mirror. Add the defer seam to the Stripe handler; it does not currently exist there.

Keep metadata persistence separate from analytics. Continue to catch metadata failures after the authoritative ledger transition; do not group metadata and analytics in one `try` if that would prevent one side effect from running when the other fails.

Keep the orchestration in `src/app/api/billing/change-plan/route.ts`, but export a focused `handleChangePlan(request, deps)` beneath `POST`. Inject the authenticated `userId`, admin client, Stripe client, defer function, phase recorder, ledger claim/advance/read functions, and Stripe/PayPal schedule/reconcile calls. `POST` owns cookies/auth and supplies those production dependencies. This preserves the route's existing source-contract assertions while enabling behavioral call-order and failure-isolation tests. Do not move provider/reconciliation logic to a new module in this fix.

### 4. Repair the analytics profile projection

In `src/lib/billing/analytics-outbox.ts`, stop selecting `profiles.cancel_at_period_end`. In the destination profile type and Customer.io adapter, remove that nonexistent profile fallback. Cancellation traits must come from the canonical billing event payload, where they are already available for lifecycle events.

Add a focused source-contract test that captures the exact `profiles` projection passed to the Supabase fake and rejects `cancel_at_period_end`; do not claim that the fake validates the real schema. Pair it with an explicit linked-database predeploy query that verifies every selected profile column exists. This is separate from deferral: deferred broken analytics would no longer break billing, but delivery still needs to work.

The removed Customer.io profile fallback is intentionally not replaced for plan-change events: their payload does not describe a cancellation, so the cancellation trait should be absent rather than guessed. Cancellation lifecycle events continue to provide the canonical value in their event payload.

### 5. Add the missing automatic retry drain

Extend `src/app/api/billing/reconcile/route.ts` with an injected analytics-dispatch dependency, `export const maxDuration = 60`, and a `BILLING_ANALYTICS_RETRY_ENABLED` kill switch defaulting off until the first measured replay is approved. After entitlement reconciliation succeeds, when enabled, await Customer.io, PostHog, and Meta batches of at most 10 deliveries each through `Promise.allSettled`, and include per-destination processed/error counts in the authenticated cron response. Preserve the entitlement result and continue other destinations when one fails or the bounded drain is cut short.

Harden the shared `dispatchDelivery` function used by both `dispatchBillingAnalyticsEvent` and `dispatchBillingAnalyticsDue`. After a row is claimed, catch profile lookup and destination exceptions, convert them into `markDeliveryFailed`, continue the caller's delivery/batch loop, and allow the existing five-attempt policy to reach `failed_permanent`. A poison row may be reclaimed after 15 minutes but must not loop forever without incrementing attempts or abort later destinations.

Keep `scripts/billing-analytics/retry-outbox.ts` as the targeted operator path and add the currently missing package script. Use destination-specific manual commands after deployment to recover the measured 10 deliveries; the daily job is the ongoing safety net.

### 6. Keep Profile state honest

Update the membership response/state builder so the already-normalized cancellation boolean still produces `canceled_at_period_end` but sets the existing `renewalAt` field to `cancel_scheduled_at ?? current_period_end`. The German label already treats `renewalAt` as next billing/end date, and the same value may continue into `ManageSubscriptionButton`; no new client field or copy change is needed. Existing `ProfilePlanSwitcher` behavior already returns `null` for every non-`manageable` state; preserve it rather than rewriting the component.

Preserve the current German messaging and management route. Do not add a new reactivation flow in this fix. After a Stripe portal return, the next membership refresh/webhook update should show the canceled state; if the webhook has not arrived yet, the provider-side plan-change guard remains the final safety boundary and returns a recoverable `409` rather than mutating the subscription.

## Test Plan

### Focused automated tests

- `tests/billing-plan-change.test.ts`
  - scheduled cancellation is detected from the boolean or timestamp;
  - membership state hides switching and uses the cancellation timestamp;
  - persisted phase timestamps are used in analytics events;
  - plan-change event keys remain idempotent and destination-limited.
- Add a focused command/route test:
  - active monthly Stripe subscription schedules annual at renewal;
  - existing source-contract assertions remain intact, while the injected handler records and asserts the behavioral call order `claim -> provider mutation -> ledger outcome -> requested/outcome outbox inserts`;
  - destination dispatch is deferred and does not run before the handler returns;
  - analytics insertion failure and vendor dispatch failure do not change the successful response or ledger state;
  - provider failure persists `failed` before scheduling failed analytics;
  - PayPal `pending_approval` and ambiguous provider responses emit `requested` only; approval/reconciliation later emits the outcome phase;
  - retries with the same operation remain idempotent.
- Existing Stripe plan-change fake tests:
  - reject `cancel_at_period_end=true`;
  - reject non-null `cancel_at` even when the boolean is false;
  - normal active subscription still creates/updates the feature-owned schedule with no proration.
- `tests/stripe-webhook-handlers.spec.ts`
  - `cancel_at` is persisted and normalized;
  - resumption clears cancellation state;
  - legacy boolean cancellation still works.
- Stripe and PayPal renewal tests:
  - both handlers pass defer semantics into `applyPlanChangeAtRenewal`;
  - outbox insertion failure after the applied ledger transition cannot prevent webhook completion or profile mirroring.
- `tests/billing-analytics-outbox.test.ts` and destination tests
  - captured profile projection excludes the known-invalid field;
  - Customer.io receives cancellation traits from event payload;
  - a throwing profile lookup/destination marks only that delivery failed and both immediate-event and due-batch dispatch continue;
  - stale `processing` delivery can retry and eventually retire after the maximum attempts.
- Billing reconciliation route tests:
  - due analytics dispatch runs after entitlement reconciliation;
  - retry is disabled by default, enabling it passes `limit: 10` to each destination, processed/error counts are returned, and one dispatch failure cannot erase the entitlement result or stop other destinations;
  - the route declares the chosen 60-second maximum duration;
  - authentication remains required.
- Migration contract test:
  - additive column and safe backfill.

### Commands

Run with the repository-required Node 22 runtime:

```bash
npm run ci:verify
npx tsx --test tests/billing-plan-change.test.ts tests/billing-analytics-outbox.test.ts tests/billing-analytics-destinations.test.ts
npx playwright test tests/stripe-webhook-handlers.spec.ts --project=chromium
npm run test:node
```

Run broader billing/PayPal tests if the shared subscription input or defer plumbing changes their fixtures.

Restart the development server before manual verification of deep `src/lib/billing/*` changes. After automated verification, run the repo's `$ready-check` and final `$request-code-review` workflows against `origin/main...HEAD` before any ship authorization.

### Database verification

Before code deployment, apply the new migration through the repo's normal linked Supabase workflow and verify:

- `billing_subscriptions.cancel_scheduled_at` exists and is nullable;
- existing `cancel_at_period_end=true` rows have the expected backfill where `current_period_end` is known;
- service-role queries and current RLS/function privileges remain unchanged.
- the exact `profiles` columns selected by billing analytics exist; `cancel_at_period_end` remains sourced from billing event payloads, not `profiles`.

Do not use `db push` if it would apply unrelated local-only migrations; use the repository's surgical linked-query/migration-repair procedure in that case.

### Manual smoke test

Use Stripe test mode or an explicitly approved internal subscription; never mutate a real customer for verification.

1. Start with an active renewing monthly subscription and no open plan-change operation.
2. Select annual and confirm. Verify a feature-owned Stripe schedule exists, the ledger is `scheduled`, Profile shows the pending annual plan and effective date, and the response succeeds even if analytics delivery is temporarily disabled.
3. Verify Customer.io/PostHog outbox rows appear once per phase and retry independently. Plan changes intentionally produce no Meta event. Trigger a synthetic throwing delivery and verify the next destination still runs while the poison row becomes retryable rather than remaining `processing`.
4. Remove/clean up the test schedule through the approved test procedure.
5. Schedule cancellation through the customer portal. Verify Profile no longer shows the plan selector and displays the correct end date.
6. Resume renewal. Verify the cancellation timestamp/boolean clear and switching becomes available again.

The currently canceled internal test subscription cannot be the initial happy-path switch test until renewal is explicitly resumed. That external mutation requires separate approval during verification.

## Rollout and Recovery

### Urgent restore

1. Re-run the linked-database profile-column check before changing/deploying the projection.
2. Verify and, with separate authorization, deploy the no-migration urgent restore slice.
3. Confirm active renewing plan changes no longer return `502`, `cancel_at` subscriptions return the known `409`, and no provider mutation occurs for cancellation conflicts.

### Hardening

1. Apply and verify the additive database migration before deploying timestamp-reading code.
2. Before enabling the first drain, re-query delivery counts by destination/status. The planning snapshot was 10 deliveries total (4 Customer.io processing, 4 PostHog pending, 2 Meta pending; oldest 16 July 2026), so any material delta must be reviewed before replay.
3. Deploy the compatible hardening code with `BILLING_ANALYTICS_RETRY_ENABLED` unset/off.
4. Replay/resend the affected internal account's latest `customer.subscription.updated` event (or perform an equivalent targeted backfill) so its pre-deploy `cancel_at` becomes normalized in Supabase; then verify Profile hides the selector and shows the correct end date.
5. Run destination-specific targeted retries after the stale-processing window and confirm the measured backlog is either delivered or explicitly retired. The two Meta rows in the planning snapshot are unrelated lifecycle/purchase deliveries, not plan-change events.
6. After the manual replay proves isolation and counts, explicitly authorize/enable the daily drain and confirm the cron reports future due-delivery results per destination.
7. Run the approved internal-account smoke sequence.

Rollback code normally if provider scheduling regresses. Keep the nullable database column in place during rollback; removing it is unnecessary and would make rollback riskier. A provider-success/local-persistence failure continues to use the existing `reconciling` state and must not be retried blindly.

## Non-Goals

- Fixing legacy subscriptions attached to another Stripe account; the earlier portal issue was limited to internal historical test users.
- Changing plan prices, defaults, discounts, trials, or billing anchors.
- Immediate or prorated plan changes.
- Canceling or replacing an already scheduled plan change through Profile.
- Provider migration between Stripe and PayPal.
- A broader analytics taxonomy, consent, or Customer.io redesign.
- Historical analytics reconstruction beyond safe recovery of existing outbox deliveries.

## Designed User Journey — Confirmed

1. A member with an active, renewing Stripe or PayPal subscription opens `Profil > Mitgliedschaft` and sees the existing plan selector with the current interval disabled.
2. The member chooses a different interval and confirms the next-renewal switch. Chaarlie validates live provider truth, schedules or begins the provider change, persists the outcome, and then records analytics. Analytics failure cannot change the user-visible billing result.
3. On success, Profile continues to show the current interval and the already-designed pending target/effective date state until the renewal webhook applies the new interval. There is no immediate charge or proration.
4. A subscription with either Stripe cancellation signal is treated as scheduled to end. The plan selector is hidden after canonical state is updated, the accurate end date is shown, and the existing management button remains available so the member can resume renewal through Stripe before switching.
5. If a pre-deploy stale row has not yet received the normalized cancellation state, the live Stripe guard returns the existing recoverable `409` and performs no provider mutation. The targeted webhook replay/backfill then makes Profile show the correct canceled state.
6. Payment-problem, manual-grant, legacy/unmanageable, pending, and reconciling states retain their existing controls and messaging.

No new layout, hierarchy, or German UI copy is introduced; the reviewed direction preserves the existing Profile surface shown during diagnosis and corrects which existing state is rendered. Nick explicitly confirmed this journey and the conservative cancellation, two-slice rollout, and controlled-retry decisions on 16 July 2026.

## State Mockup — Confirmed

The implementation keeps the existing membership card and controls. The comparison shows the only intended UI difference: a normally renewing membership retains `Plan ändern`; a membership with cancellation scheduled hides the selector while keeping `Verwalten` available for reactivation.

- HTML: `/Users/nick/.codex/visualizations/2026/07/16/019f6a28-2db0-73a2-978c-cb6c3b69ff38/billing-membership-states.html`
- Selected direction: existing layout and German copy; state logic only.
- Review status: explicitly confirmed by Nick on 16 July 2026 before implementation workers were dispatched.

## Implementation Handoff

Implement from current `origin/main` using the two locked slices above: urgent no-migration restore first, then migration-backed cancellation/Profile and retry hardening. This planning worktree may be reused only if still fresh and clean. Keep live provider, migration apply, replay, environment, and deployment actions outside the implementation loop until explicitly authorized.
