# One-time personal-plan payment recovery and observability

## Status and gates

- Status: PR1 implemented and verified in the local task worktree; it has not been committed, pushed, migrated, deployed, recovered, or publicly enabled. No production mutation is authorized by this document.
- Base inspected: task base `776c7ad2` on 2026-07-31. A fresh 2026-08-01 fetch found `origin/main` at `a8131d7c` (three commits ahead) with no overlapping task paths; integrate that base before publication.
- Production assignment: keep the real public gate `PERSONAL_PLAN_PRICING_EXPERIMENT_ENABLED=false` until every dark-launch gate in this plan passes. `PERSONAL_PLAN_ONE_TIME_QA_ENABLED` may expose only the existing signed QA/direct-variant path; it is not a public assignment flag.
- Mockup review: approved by Nick on 2026-07-31 with the instruction to implement.
- Designed-journey sign-off: approved by Nick on 2026-07-31, including the two-PR split and canonical activation direction.
- Counterpart review: completed with Claude Opus 4.8 at xhigh effort; locally reconciled in the findings ledger.
- Final verification: post-fix activation/welcome suite `43/43`, combined Stripe/PayPal suite `48/48`, full Node suite `2323/2323`, focused checkout/auth/webhook Playwright `94/94`, typecheck and production build passed, and lint passed with zero errors plus four unrelated existing warnings. The final adversarial re-review reported no blockers after the paid-Stripe fallback and fulfillment-lease race fixes.
- Durable artifacts: this plan and its HTML mockup stay with the future implementation PR.
- Transient artifacts: Claude's review output is kept outside the repository and discarded after its findings are reconciled into the ledger below.

## Outcome

A verified Stripe or PayPal payment for the €29.99 one-time personal plan must become durable business truth even when email, account creation, analytics delivery, or the return page temporarily fails. The same canonical activation path must then:

1. link the payment to the exact accepted consent and funnel session;
2. create or reuse the customer account without subscription semantics;
3. persist the paid purchase idempotently;
4. send and record the legally required durable-medium confirmation;
5. release the fixed personal plan and app access only after confirmation is accepted by the email provider;
6. record generation/finalization, delivery, and first-access evidence;
7. emit one canonical `purchase_completed` event from server-owned database truth;
8. show a safe paid-but-pending state instead of returning the customer to checkout; and
9. recover the already captured production test charge without charging it again.

The result must be independently reconcilable across Stripe or PayPal, Supabase, Customer.io, PostHog, Meta, and the funnel event store.

## Production evidence that drives the plan

The completed production credit-card test is a real captured payment, not a sandbox test. The sanitized audit found:

- Stripe Checkout is `complete` and `paid`; the €29.99 EUR charge is captured, approved, not refunded, and not disputed.
- Stripe created the payment-mode Checkout Session without a Customer object (`customer = null`, `customer_creation = if_required`).
- `billing_one_time_purchases` contains no row, the consent remains unbound to a user, and no confirmation, plan-delivery, first-access, or billing-analytics evidence exists.
- `assertOneTimeCheckoutSession()` currently rejects the valid paid session because it requires a Stripe Customer ID.
- confirmation is currently sent before purchase persistence in both Stripe and PayPal activation. A transient Customer.io failure can therefore leave captured money with no durable purchase or access record.
- one-time commerce metadata can be sourced from the latest shared funnel cookie during checkout prewarm/claim. In the test, another tab replaced that cookie, so provider metadata referred to a different membership session than the accepted one-time consent.
- the consent immutability trigger implements user binding backwards: it blocks the intended `null -> user` transition and permits the unsafe `user -> null` transition.
- `hasCurrentAppAccess()` currently grants access from a `paid` purchase alone, even if the required confirmation and delivery evidence are incomplete.
- the browser journey events were recorded, but the canonical server-owned `purchase_completed` event was never created because activation failed.

The live provider identifiers, email address, and lead ID must remain out of the repository and be supplied out-of-band to the guarded recovery command.

## Chosen direction

Build one provider-neutral, idempotent activation state machine around a canonical consent and a verified provider payment. Persist captured-payment truth before fallible fulfillment work, but gate plan release and app access on confirmation evidence.

### Why this direction

Three approaches were considered:

1. **Add `customer_creation: "always"` only.** This prevents the exact Stripe null-customer symptom for future sessions but does not repair the captured charge, PayPal ordering, consent binding, cross-tab attribution, email failure, duplicate-charge UX, delivery evidence, or analytics.
2. **Patch Stripe and PayPal independently.** This is quicker locally but preserves two subtly different definitions of a successful purchase and makes retries, recovery, and metrics drift likely.
3. **Canonical activation with provider adapters — chosen.** Stripe and PayPal continue to validate their own provider objects, then pass normalized payment truth to one activation service. This costs a focused refactor but gives one durable order of operations, one idempotency model, and one recovery path.

The old unmerged recovery branch is reference material only. It contains useful expired-session and PayPal lifecycle patterns but is not a complete solution to the observed failure and must not be merged wholesale.

### Approved release slicing

Keep the full outcome in this plan but deliver it as two reviewable releases:

1. **PR1 — payment and access correctness:** schema repair, canonical activation, both provider adapters, authoritative consent attribution, fulfillment retry, confirmation-gated access, generalization of the existing pending UI/status flow, server-owned `purchase_completed`, and the guarded recovery/reconciliation command. The real captured charge is recovered only after PR1 is deployed and its dry-run is approved.
2. **PR2 — dedicated dashboard and expanded operational presentation:** declarative PostHog dashboard, public-vs-internal views, trends/provider split, and polished operator health reporting, built on the now-correct canonical event.

This is preferred over one large PR because the revenue/access repair can be reviewed and deployed without coupling it to dashboard layout. It is also preferred over a surgical reorder inside the two existing provider functions: the observed failure already crosses Stripe, PayPal, consent binding, account resolution, access, retries, and analytics, so two patched definitions of success would preserve the main structural risk. Nick's journey sign-off on this plan also confirms this release split and the canonical-service choice.

## Invariants

### Provider truth

- A payment is accepted only after a fresh server-side provider read verifies product, amount `2999`, currency `EUR`, final paid/captured state, expected price/product or merchant identity, and no known refund/reversal/dispute.
- Provider transaction identity is unique. Replays return the existing activation state and never create a second purchase, account, confirmation, or analytics event.
- Future Stripe payment-mode sessions request `customer_creation: "always"` when no existing Customer is supplied.
- The already captured customerless Stripe session remains recoverable. `provider_customer_id` is nullable for this legacy/current exception; absence of a Customer ID is not absence of payment truth.
- `paid_at` comes from the verified provider capture/payment timestamp, not the Checkout Session creation time or the recovery run time.

### Consent and attribution

- `personal_plan_one_time_checkout_consents.id` is the canonical commerce context after the user accepts the checkbox.
- The consent's immutable `lead_id`, `funnel_session_id`, `offer_variant`, copy version/hash, and accepted time are authoritative for checkout metadata, purchase joins, fulfillment, and analytics.
- The current browser cookie may create a new journey before consent, but it cannot replace the authorized consent/session during prewarm, claim, provider order creation, return activation, recovery, or purchase analytics.
- Consent user binding is monotonic: `null -> exactly one matching user` is allowed once; changing or clearing a bound user is rejected.

### Persistence, confirmation, and access

- Verified captured payment is persisted before Customer.io or analytics delivery is attempted.
- A purchase has a first-class, unique `consent_id`; the join is not reconstructed from free-form metadata.
- `paid` means the provider captured funds. It does not by itself mean fulfillment is ready.
- The existing legal/business gate is preserved: the fixed plan is not released and app access is not granted until the durable-medium confirmation has been accepted by Customer.io (`confirmation_status IN ('sent', 'delivered')`).
- The pre-payment prepared artifact is treated as an internal draft. After confirmation, activation seals the attached `locked_plan` as the purchased fixed output, records its canonical SHA-256, and records finalization/delivery timestamps. The implementation must not invent timestamps that predate the actual post-confirmation step.
- First access is recorded idempotently on the first authenticated open of the purchased result or plan surface.
- Confirmation, fulfillment, analytics, and first-access recording are retryable side effects. Their failures never delete or hide the captured-payment record.

### Customer safety

- Once a verified paid provider transaction exists, no return, refresh, webhook retry, or status poll renders a purchase CTA for that transaction.
- A customer sees either activation, a calm paid-but-pending screen, or their plan—not a generic pricing redirect after payment.
- A duplicate or concurrent callback converges on the same user, consent, purchase, and analytics event.

## Data model and state machine

### Migration

Add a forward-only migration that:

1. adds `consent_id uuid` to `billing_one_time_purchases` with a unique foreign key to `personal_plan_one_time_checkout_consents(id) ON DELETE RESTRICT`;
2. makes `billing_one_time_purchases.user_id` nullable so verified captured-payment truth can be stored before account creation, while preserving authenticated RLS visibility only after binding;
3. backfills any resolvable rows from provider order/session references, aborts loudly if an existing paid row cannot be resolved, then validates `consent_id NOT NULL`;
4. changes bound consent/purchase profile foreign keys away from destructive `SET NULL`/`CASCADE` behavior so account deletion cannot erase or detach retained payment/consent evidence;
5. replaces the consent immutability function so only `OLD.user_id IS NULL AND NEW.user_id IS NOT NULL` is allowed, and only once;
6. adds a guarded database operation that binds the same user to consent and purchase atomically and rejects any mismatch;
7. adds bounded retry evidence for confirmation/finalization, either on the consent row (`attempts`, `last_error`, `next_attempt_at`, `processing_started_at`) or in a dedicated one-row-per-consent fulfillment job table; and
8. adds constraints/indexes needed to claim due work safely and to prevent more than one active fulfillment job.

Prefer a dedicated `personal_plan_one_time_fulfillment_jobs` table if adding retry fields to the immutable consent evidence would blur evidence and queue mechanics. The consent remains the historical record; the job row owns transient processing status.

The binding trigger must also allow the idempotent no-op `user -> same user`. It must reject `user A -> user B` and `user -> null`.

Production currently has no one-time purchase rows, so the `consent_id` backfill is expected to be a no-op there; the stuck charge gets its new purchase row only through the later recovery command. The migration still validates or aborts on any unexpected legacy row in another environment rather than guessing a consent.

### Canonical states

The API may expose a smaller customer-facing state, but internal state must distinguish:

```text
provider_paid
  -> purchase_recorded
  -> account_linked
  -> confirmation_pending | confirmation_failed_retryable
  -> confirmation_sent
  -> plan_finalized
  -> plan_delivered
  -> active
  -> first_access_recorded

terminal payment lifecycle overlays:
  refunded | reversed | disputed
```

`purchase_recorded` is the recovery anchor. Steps after it can resume independently. Refund, reversal, or dispute webhooks update the existing purchase and revoke one-time access through the same purchase record; they do not erase evidence.

## Canonical activation contract

Create a provider-neutral service, tentatively `src/lib/billing/personal-plan-one-time-activation.ts`, with a normalized input:

```ts
type VerifiedOneTimePayment = {
  provider: "stripe" | "paypal"
  providerTransactionId: string
  providerOrderId: string
  providerCustomerId?: string | null
  consentId: string
  email: string
  amountMinor: 2999
  currency: "eur"
  paidAt: string
  providerEvidence: Record<string, unknown>
}
```

The service owns the following idempotent order:

1. load and validate the canonical consent and its lead/funnel relationship;
2. upsert the verified captured purchase immediately with `consent_id`, `user_id = null`, and sanitized provider evidence;
3. create or reuse the auth user/profile using normalized email and provider identity, with a race-safe lookup;
4. bind that user to both consent and purchase atomically using a guarded database operation;
5. insert an idempotent billing analytics outbox event keyed by the provider transaction, using the consent's funnel session;
6. link the quiz/prepared artifact to the profile;
7. enqueue/claim the confirmation-and-finalization job;
8. attempt confirmation inline for the fast path; on failure persist retry state and return `pending` without undoing the durable payment/account work;
9. after Customer.io acceptance, seal/hash the fixed plan, record delivery evidence, and make entitlement eligible; and
10. return `active`, `pending`, or an irreversible provider/payment error.

This corrects a contradiction found during implementation mapping: if `user_id` stayed mandatory and account creation happened first, an account-service failure could still leave a captured provider payment with no local purchase row. The nullable pre-binding state is never an entitlement; it is only durable payment truth awaiting activation.

Only the provider adapters may translate raw Stripe or PayPal payloads into `VerifiedOneTimePayment`. The canonical service must not trust client-supplied amount, price, email, status, consent, or attribution.

For the customerless Stripe recovery exception, account lookup and profile upsert use email plus session identity and leave `profiles.stripe_customer_id` unchanged/null. Helpers that currently require a non-null Customer ID must be made explicitly nullable instead of receiving a fabricated value.

## Stripe changes

- In `checkout-session-params.ts`, set `customer_creation: "always"` for one-time payment mode when `customerId` is absent. Keep `customer` and `customer_email` mutually exclusive.
- Split Stripe validation into provider-payment validation and optional Customer validation. Future sessions should have a Customer; legacy/current recovery may proceed with `null` only after all other payment and consent checks pass.
- Use the already-threaded `oneTimeConsentId` to load the consent's authoritative `funnel_session_id` during prepared-session claim. For one-time checkout, do not overwrite metadata or analytics attribution from `FUNNEL_SESSION_COOKIE` inside `claimPreparedCheckoutSession()` or `recordPreparedCheckoutStarted()`; the cookie remains valid for non-one-time flows.
- Resolve the consent from its bound Checkout Session reference and verify session metadata agrees. Metadata is a consistency check, not the source of truth.
- Make the webhook, `/welcome` return, password activation, magic-link activation, and status polling call or observe the same canonical activation service.
- A Customer.io failure returns the paid-pending state and an HTTP outcome that preserves Stripe webhook retry without causing the browser to redirect to pricing.

## PayPal changes

- Keep the existing Orders v2 merchant, amount, currency, custom ID, order, and capture validation.
- After capture validation, translate the order intent and consent into the same normalized activation input.
- Move purchase persistence before confirmation sending.
- Make capture return, PayPal webhook, recovery, and activation status converge on the canonical service.
- Preserve one provider per consent and write-once order/capture references.
- A captured order with a retryable confirmation failure returns paid-pending, never a recapture or new order.

## Confirmation and fulfillment retry

- Extend the existing authenticated `/api/billing/reconcile` cron to claim a small bounded batch of due one-time fulfillment jobs behind a dedicated production flag. Reuse its `CRON_SECRET`, lease/stale-processing pattern, attempt cap, and structured result reporting.
- Also attempt the job inline from the provider callback for normal speed.
- Use an idempotency key derived from `consent_id + confirmation copy version` when calling Customer.io if the API supports it; otherwise persist the first accepted provider reference and never resend after `sent`/`delivered`.
- Classify invalid consent/provider data as permanent; classify network/5xx/rate-limit errors as retryable with bounded backoff.
- Record no raw email, provider payload, or consent text in logs or Sentry. Use hashes/IDs that are already non-secret and Sentry-safe fingerprints.

## Access and delivery evidence

- Replace the one-time branch in `hasCurrentAppAccess()` with a joined entitlement predicate:
  - purchase status is `paid`;
  - purchase is linked to its consent and user;
  - confirmation is `sent` or `delivered`; and
  - fixed-plan finalization/delivery evidence is complete.
- Subscription and manual-grant behavior remains unchanged.
- Define one server helper for the one-time entitlement predicate and reuse it in middleware, pricing, result, tracker, profile, and API access checks.
- Add a richer one-time access-state resolver with at least `none | paid_pending | active | revoked`. Keep `hasCurrentAppAccess()` as the boolean compatibility surface (`true` only for `active`), while return/status/pending routes query the richer state directly.
- Reconcile every current caller explicitly:
  - `/welcome` and the provider-neutral activation-status route render/poll `paid_pending` without calling the boolean access gate;
  - `/pricing` and checkout duplicate guards redirect a `paid_pending` buyer to activation status instead of offering another purchase;
  - middleware and gated pages redirect an authenticated `paid_pending` buyer to the existing `plan-bereit`/activation waiting surface;
  - `plan-bereit/status` returns a non-403 `paid_pending` response for this state instead of `subscription_required`; and
  - tracker/profile/result APIs return a stable `activation_pending` response if reached before activation, while subscription/manual-grant behavior remains unchanged.
- On finalization, hash the canonical serialized `locked_plan`, then record `generation_started_at`, `generation_completed_at`, `generated_content_sha256`, `delivery_provider`, `delivery_reference`, and `delivered_at` in a constraint-valid order.
- On the first authenticated result/plan read, set `first_accessed_at` only if null. Anonymous bearer-style result access must not count as the buyer's authenticated first access.
- Refund/reversal/dispute updates immediately make the one-time entitlement predicate false while leaving historical confirmation/delivery evidence intact.

## Paid-but-pending customer journey

The proposed layout is in `plans/mockups/2026-07-31-one-time-payment-recovery-and-dashboard.html`.

### Happy path

1. The customer pays once through Stripe or PayPal.
2. The provider callback verifies and records the payment and account.
3. The welcome page briefly shows `Zahlung bestätigt` while confirmation and plan release finish.
4. The status endpoint returns `active`; the page reveals password/magic-link activation or redirects an already signed-in buyer to the fixed plan.
5. First authenticated access is recorded.

### Retryable delay

1. Payment and purchase are already durable.
2. The page shows `Wir schließen deinen Zugang ab` with payment complete and the remaining steps in progress.
3. It polls a provider-neutral status endpoint. The endpoint reads durable state; it does not create a second provider charge.
4. After the bounded fast-path window, the copy changes to `Das dauert gerade länger als erwartet` and explicitly says the payment is safely recorded and the buyer will not be charged again.
5. The page offers `Status erneut prüfen`, login (if useful), and support—never another checkout CTA.
6. Cron/provider retry completes confirmation and activation even if the tab is closed; Customer.io then gives the customer the durable return path.

### Irreversible validation failure

Before capture, the normal checkout error may be shown. After a provider reports captured funds, an inconsistent amount/product/consent becomes an operator incident: persist sanitized evidence where safe, alert Sentry, show the paid-pending/support state, and require manual reconciliation. Do not silently grant access and do not ask for another payment.

## Mockup evidence

- Artifact: `plans/mockups/2026-07-31-one-time-payment-recovery-and-dashboard.html`.
- Left side: narrow mobile paid-pending state, progress hierarchy, explicit no-double-charge timeout copy, retry, and support recovery.
- Right side: proposed dedicated PostHog dashboard with headline metrics, full one-time funnel, daily trend, provider split, and data-quality/activation guardrails. All displayed numbers are labeled illustrative.
- The mockup is responsive in its source design. Automated `file://` browser navigation was blocked by the browser security policy, so no bypass was attempted; Nick's local visual review remains the mockup gate.
- Review status: approved by Nick on 2026-07-31 with the instruction to implement.

## Recovery of the already captured production charge

Add a guarded operator script under `scripts/billing/`, dry-run by default. A write requires both `--apply` and an exact out-of-band `--confirm-session=<provider-session-id>` value.

Dry-run checks:

- `PERSONAL_PLAN_PRICING_EXPERIMENT_ENABLED` is false, so neither public pricing arm is assigned; any `PERSONAL_PLAN_ONE_TIME_QA_ENABLED` access remains signed/direct QA only;
- the provider object is freshly retrieved and verifies the fixed product, €29.99 EUR amount, complete/paid/captured state, expected live price/product, and no refund/reversal/dispute;
- the exact canonical consent exists and its lead/session/product match;
- no conflicting purchase exists by provider transaction, consent, user/product, or order;
- the target email/account resolution is unambiguous; and
- the script prints a sanitized execution preview without provider IDs, email, payment method, or raw metadata.

Apply mode invokes the same canonical activation service used by live callbacks. It must never handcraft purchase, consent, access, or analytics rows. Re-running the command must report `already recovered` and produce no duplicate side effects.

After apply, the operator receipt verifies:

- one bound consent and one user/profile;
- one paid purchase linked by `consent_id`;
- confirmation and delivery/finalization state;
- one canonical billing analytics outbox event and the state of each delivery destination;
- one eligible app entitlement and accessible fixed plan;
- the correct one-time funnel session/variant; and
- live Stripe remains captured and unrepeated.

Refunding the real test charge is explicitly outside this recovery command and requires separate authorization after the recovered path has been verified.

## One-time offer dashboard

Create a separate PostHog dashboard named `Persönlicher Haarplan — Einmalkauf: Funnel & Umsatz`. Do not mutate the existing general offer dashboard.

The public view excludes `is_internal_test IN ('true', '1')` and requires the one-time arm plus a non-empty canonical funnel session. It contains:

1. headline cards for unique offer sessions, checkout opens, paid purchases, offer-to-purchase conversion, and gross captured revenue;
2. a session funnel: offer viewed → pricing viewed → checkout intent → checkout opened → provider initialized → payment option viewed → method selected → canonical purchase completed;
3. a daily trend for offer sessions, checkout starts, purchases, conversion, and revenue;
4. provider/method breakdown where properties are non-sensitive and consistently populated; and
5. a data-quality panel separating internal QA, missing attribution, wrong-arm/session joins, and checkout sessions without canonical purchase events.

PostHog cannot by itself prove provider/DB reconciliation. Pair the dashboard with the operator reconciliation receipt and a production health check that reports counts only:

- provider captured payment without purchase row;
- purchase without confirmation/finalization;
- purchase without outbox event;
- outbox destination permanently failed; and
- wrong or missing canonical funnel session.

Implement the dashboard as a declarative script plus tests, following the existing PostHog scripts: dry-run default, exact project confirmation for writes, exact-title collision/drift checks, attach each insight exactly once, then re-read the live dashboard. Dashboard creation occurs only after canonical `purchase_completed` is repaired; otherwise it would institutionalize incomplete data.

## Target map

The exact file list may narrow during implementation, but ownership is expected in these surfaces:

- **Schema:** new migration with a timestamp after the current latest `supabase/migrations/20260731124000_add_personal_plan_quiz_drafts.sql`.
- **Canonical activation:** new `src/lib/billing/personal-plan-one-time-activation.ts`; updates to `purchases.ts`, `personal-plan-one-time-consents.ts`, `subscriptions.ts`, and billing types.
- **Stripe adapter:** `src/lib/stripe/checkout-session-params.ts`, `checkout-activation.ts`, `webhook-handlers.ts`, `src/app/api/stripe/create-checkout-session/route.ts`, Stripe session/webhook/welcome paths.
- **PayPal adapter:** `src/lib/paypal/order-activation.ts`, `order-intents.ts`, `webhook-handlers.ts`, capture/create/status routes.
- **Customer state:** generalize the existing `mode="pending"` and PayPal polling in `src/app/welcome/page.tsx`, `welcome-client.tsx`, and `src/app/api/paypal/activation-status/route.ts` into a provider-neutral one-time activation-status path; add the missing Stripe pending branch instead of building a second UI.
- **Fulfillment/access:** prepared-artifact/profile-link helpers, result/plan authenticated access paths, and `/api/billing/reconcile`.
- **Analytics:** billing outbox creation/destinations plus a one-time dashboard declaration, guarded update script, and tests.
- **Operations:** guarded one-time recovery and reconciliation scripts plus a short release runbook.
- **Tests:** focused unit, route, migration, provider replay, cross-tab attribution, access, retry, recovery, and dashboard declaration tests.

## Ordered implementation tasks

### 1. Lock the current failure with tests

- Add a Stripe fixture for a valid paid one-time Checkout Session with `customer = null` and prove it can be normalized for recovery but is not accepted from unverified client input.
- Add regression tests showing the current cookie cannot replace consent attribution during prewarm/claim.
- Add Stripe and PayPal tests where Customer.io fails after capture: purchase remains durable, response is pending, and replay finishes activation without duplicate rows/events.
- Add database tests for the intended consent user-binding transition and forbidden clearing/change.

### 2. Apply the schema repair

- Add/validate purchase-to-consent linkage and monotonic user binding.
- Add fulfillment job/lease/retry state and database constraints.
- Regenerate or update local database types if the repository workflow requires them.
- Test forward migration from the current production shape; no destructive rewrite or rollback dependency.

### 3. Build canonical activation

- Extract shared account resolution, consent binding, purchase-first persistence, quiz/profile linking, confirmation/finalization, outbox insertion, and stable result states.
- Make concurrency and replay tests pass for webhook/return/status overlap.
- Ensure logs and errors are sanitized.

### 4. Adapt Stripe and fix authoritative attribution

- Add future Customer creation.
- Normalize validated payment with the customerless recovery exception.
- Thread consent authority through preparation, claim, webhook, return, password, magic link, and status.
- Preserve Apple Pay prewarm behavior and its existing timeout/fallback contract.
- Read `paid_at` from the verified PaymentIntent/Charge timestamp and make account/profile helpers explicitly tolerate the verified customerless recovery exception.

### 5. Adapt PayPal

- Move capture activation to the canonical service.
- Preserve merchant/capture validation, duplicate guard, and lifecycle status updates.
- Test return/webhook concurrency and retryable confirmation failure.

### 6. Complete fulfillment, entitlement, and first-access evidence

- Implement inline plus cron retry.
- Gate access on purchase + confirmation + finalization/delivery.
- Record fixed-output hash and authenticated first access.
- Verify subscription/manual access remain unchanged.
- Add a caller-matrix test for middleware, pricing, `plan-bereit/status`, billing access, result, tracker, profile, and reactivate behavior across `none`, `paid_pending`, `active`, and `revoked`.

### 7. Generalize the existing paid-pending UI

- Extend the existing PayPal `mode="pending"` screen/poller to the approved one-time copy and provider-neutral status contract, then add the Stripe pending path.
- Ensure no paid state links back to checkout.
- Test accessibility, mobile layout, network errors, long-running pending, active transition, and already-signed-in redirect.

### 8. Repair canonical analytics and add observability

- Insert one outbox event only after the purchase row exists, keyed by provider transaction.
- Resolve server-side PostHog/funnel attribution from the consent session and preserve `is_internal_test` from that session.
- Add Sentry fingerprints for payment-recorded/fulfillment-pending, permanent validation mismatch, retry exhaustion, and provider-vs-database reconciliation gaps.
- Add count-only operational reconciliation output.

### 9. Dark-deploy PR1 and recover the real charge

- Run the full local/CI verification and whole-branch counterpart review for PR1.
- Merge and deploy schema/code with public assignment still off.
- Verify migrations, environment flags, cron authentication, Stripe/PayPal webhook delivery, Customer.io, and Sentry.
- Run the recovery script dry-run, inspect the sanitized preview, then request explicit apply authorization for the real production charge.
- Apply once and complete the post-apply receipt.

### 10. Run controlled production tests

- Use the existing signed QA/direct-variant mechanism with public assignment off.
- Run one controlled live Stripe card payment and one controlled live PayPal payment. Apple Pay is verified separately once its shared platform bug is fixed.
- For each payment, reconcile provider → consent → user → purchase → confirmation → finalization/delivery → access → analytics destinations.
- Verify refresh, duplicate callback, closed-tab recovery, and paid-pending retry without new charges.

### 11. Add the dedicated dashboard as PR2

- Add declarative insights and guarded create/attach script with tests.
- Dry-run against production, apply with exact project confirmation, re-read and visually inspect desktop/mobile dashboard layout.
- Keep existing dashboards unchanged.

### 12. Request public experiment enablement

- Confirm both controlled provider receipts still pass and the dedicated dashboard reads the canonical event correctly.
- Request separate authorization to set `PERSONAL_PLAN_PRICING_EXPERIMENT_ENABLED=true`; enabling the public experiment is not implied by merging or deploying either PR.

## Verification matrix

### Deterministic and database

- Unit tests for provider normalization, idempotency keys, consent authority, monotonic binding, entitlement predicate, status mapping, and retry classification.
- Migration tests for a fresh database and current production-shaped data.
- Concurrency tests for webhook + return + status poll and PayPal capture + webhook.
- Replay tests prove exactly one user, consent binding, purchase, confirmation acceptance, finalization, and outbox event.
- Refund/reversal/dispute tests revoke access but preserve evidence.

### Routes and UX

- Stripe/PayPal return routes show pending instead of redirecting to pricing after captured payment.
- Pending polling transitions to active; timeout copy remains actionable and never shows checkout.
- Password/magic-link activation works for both providers and an existing signed-in user.
- Responsive browser review at narrow mobile and desktop widths; keyboard/focus and reduced-motion checks.
- Existing membership checkout, Apple Pay prewarm/fallback, PayPal subscription, and manual grants regressions pass.

### Analytics and operations

- A public one-time session produces one canonical `purchase_completed` across outbox destinations with the consent's session/arm.
- Internal QA remains isolated and cannot enter public dashboard denominators.
- Dashboard queries deduplicate by funnel session and distinguish navigation, checkout intent, initialization, payment-option exposure, and purchase.
- Reconciliation catches intentionally seeded missing purchase, fulfillment, outbox, and attribution gaps.
- Sentry and logs contain no email, consent text, payment method details, or raw provider payload.

### Production gates

- Public assignment remains off.
- Deployment is healthy and the new migration is verified.
- The existing captured charge is recovered idempotently with no second charge.
- One controlled Stripe and one controlled PayPal production transaction pass the full receipt.
- PR1 provider/access/recovery gates pass before PR2 creates the dedicated dashboard; the dashboard is then live and re-read from PostHog before public assignment is considered.
- Public experiment enablement remains a separate explicit decision.

## Non-goals

- Changing the €29.99 price, product copy, offer-page visual hierarchy, or membership packages.
- Enabling public assignment as part of implementation or deployment.
- Redesigning the subscription entitlement model.
- Resolving the platform-wide Apple Pay bug beyond preserving the current shared prewarm behavior.
- Automatically refunding the real test charge.
- Making new legal conclusions; implementation preserves the already chosen immediate-performance consent and confirmation-before-release invariant. Any semantic change to that legal model requires separate counsel review.

## Review and handoff

Implementation may begin only after:

1. Nick reviews the paid-pending and dashboard mockup;
2. Nick explicitly signs off on the ordered customer journey, two-PR release split, canonical-service direction, and recovery behavior;
3. Claude's plan review is reconciled below; and
4. no unresolved product/legal decision remains.

Implementation then follows the repository's implementation loop in this worktree, with test-first coverage for deterministic state transitions, ready-check, whole-branch Claude review, and the normal ship/merge/deploy approval boundaries.

## Counterpart findings ledger

| Finding                                                                                                                       | Disposition                            | Evidence / plan change                                                                                                                                                                                                                                            |
| ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Named public kill-switch did not exist.                                                                                       | Accepted                               | Replaced it with the real `PERSONAL_PLAN_PRICING_EXPERIMENT_ENABLED=false` public gate and documented signed `PERSONAL_PLAN_ONE_TIME_QA_ENABLED` behavior. No new one-time public flag is recommended because the intended experiment enables both arms together. |
| Tightening `hasCurrentAppAccess()` would turn paid-pending buyers into generic 403/redirect behavior across existing callers. | Accepted                               | Added a richer one-time access state and an explicit caller reconciliation/test matrix, including non-403 `plan-bereit/status` behavior.                                                                                                                          |
| The plan described a new pending UI although PayPal already has `mode="pending"` and polling.                                 | Accepted                               | Task 7 now generalizes the existing path and adds Stripe/provider-neutral behavior instead of duplicating it.                                                                                                                                                     |
| Latest migration is `20260731124000`, not `20260731123000`.                                                                   | Accepted                               | Target now requires a later timestamp.                                                                                                                                                                                                                            |
| Consent binding must allow `null -> user` and repeated same-user no-op.                                                       | Accepted                               | Added exact allowed and rejected transitions.                                                                                                                                                                                                                     |
| Cross-tab fix should reuse already-threaded consent ID rather than imply all plumbing is absent.                              | Accepted                               | Narrowed the task to deriving the authoritative session from the consent during one-time claim/analytics.                                                                                                                                                         |
| Stripe currently uses Checkout Session creation time as `paid_at`.                                                            | Accepted                               | Provider capture/payment time is now an explicit adapter requirement.                                                                                                                                                                                             |
| `provider_customer_id` is already nullable, but profile/account helpers still require a Customer ID.                          | Accepted                               | No redundant purchase-column change; the plan now makes downstream helpers nullable for the verified recovery exception.                                                                                                                                          |
| Split urgent recovery from dashboard/expanded observability.                                                                  | Accepted and approved                  | Added PR1 payment/access correctness and PR2 dashboard/expanded presentation; Nick approved implementation on 2026-07-31.                                                                                                                                         |
| Prefer a surgical reorder instead of a canonical activation service.                                                          | Rejected; canonical direction approved | The failure spans two providers, consent, access, retry, account, and analytics. PR1 stays narrow but uses one canonical activation definition to prevent repeat drift; Nick approved implementation on 2026-07-31.                                               |
