# Truthful payment error feedback

**Status:** Approved; implementation in progress on `codex/payment-error-feedback`
**Worktree:** `.worktrees/payment-error-feedback`
**Branch:** `codex/payment-error-feedback`
**Delivery:** First, independently shippable branch

## 1. Outcome and source context

Every live checkout answers three questions in one compact German feedback card:

1. What safely-observed thing failed?
2. Was a new payment started, failed, pending, or already successful?
3. What should the customer do next?

The triggering production URL hit an existing-access conflict before Stripe was called. At incident time the customer saw generic card-reconnect guidance; the CSP Report-Only warning was unrelated. The current branch already preserves `duplicate_access` as a distinct state and opens `ActiveSubscriptionDialog`; this plan migrates that corrected state inline and generalizes the truthful feedback contract across all checkouts.

Sources:

- Approved rendered direction: [payment feedback states with reporting hidden](./mockups/2026-08-10-payment-feedback-states.html?reporting=off).
- Final-state mockup for the later reporting delivery: [payment feedback states](./mockups/2026-08-10-payment-feedback-states.html).
- [Stripe card decline guidance](https://docs.stripe.com/declines/card) and [decline-code reference](https://docs.stripe.com/declines/codes).

## 2. Chosen direction

Add one shared, icon-led checkout feedback component and one closed classifier across:

- result-offer membership;
- €29.99 one-time Personal Plan;
- membership reactivation;
- their Stripe card/Apple Pay and PayPal paths.

Callers pass typed payment state, including whether provider confirmation started, never arbitrary customer-facing error strings. Known safe structured provider codes may select a specific correction; sensitive and unknown codes collapse to generic recovery. Existing-access and pending states suppress controls that could create a second payment.

The new presentation is default-off behind `NEXT_PUBLIC_PAYMENT_FEEDBACK_V2_ENABLED=true`, following the repository's exact-`"true"` public flag convention. Flag-off keeps the current checkout presentation; feedback classification tests still run. Activation and rollback are separate release gates.

This delivery contains no case reporting. `Problem melden` remains hidden until the independent [payment support lifecycle plan](./2026-08-10-payment-support-lifecycle.md) passes its database, privacy, Customer.io, and rollout gates.

## 3. Scope and non-goals

### In scope

- Replace generic Stripe feedback and any remaining provider-derived customer errors with a more specific closed German taxonomy. Stripe already discards raw message prose today; its gain is safe specificity and payment-truth actions, not closing a current raw-message leak.
- Preserve and inline existing-access outcomes; no nested checkout dialog.
- State payment truth as `not_started`, `failed`, `pending`, or `succeeded`.
- Give only actions compatible with that truth: login/profile, reload, correct details, switch method, or check status.
- Persist classified feedback for overlay-based one-time and result-membership checkouts when the sheet closes or a request settles during its exit animation; show it when checkout reopens. Reactivation is an always-visible surface and has no hidden-settlement variant.
- Match the approved styling at desktop and mobile widths.
- Add deterministic Labs fixtures and regression tests across every live checkout.

### Non-goals

- No support-case table/API, report affordance, Sentry customer-report signal, email, operator command, retention, or privacy-copy change; those belong to the second plan.
- No checkout/pricing/provider redesign or entitlement-rule change.
- No raw Stripe/PayPal message, sensitive decline meaning, or guessed issuer cause.
- No repair of a distinct Stripe preparation/idempotency mechanism.
- No claim to close older swipe-dismiss or empty-server-response silence paths. Those are a separately named companion investigation; this plan proves only that a classified hidden-settlement state renders on reopen.
- No deployment, activation, merge, or production mutation.

## 4. Authoritative feedback contract

`PaymentFeedbackKind` is the only customer-visible classification:

| Kind                               | Truth                     | Meaning                                                     | Recovery                                                          |
| ---------------------------------- | ------------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------- |
| `access_already_active`            | `not_started`             | Existing access blocked a new checkout; nothing new charged | Result/one-time: email login; authenticated reactivation: profile |
| `checkout_not_loaded`              | `not_started`             | Provider UI/session could not be prepared                   | Reload; use other method                                          |
| `details_invalid`                  | `failed`                  | Safe structured code identifies a correctable field         | Correct named field and retry                                     |
| `card_declined`                    | `failed`                  | Issuer rejected the card without unsafe speculation         | Other card or PayPal; bank if persistent                          |
| `provider_temporarily_unavailable` | `not_started` or `failed` | Provider/network/processing path unavailable                | Retry once; other method                                          |
| `payment_not_completed`            | `failed`                  | Final failure with no safe specific reason                  | Retry with another method                                         |
| `payment_status_pending`           | `pending`                 | Provider outcome is not final                               | Do not pay again; check status                                    |
| `access_activation_delayed`        | `succeeded`               | Payment succeeded but access is delayed                     | Do not pay again; check status                                    |

The discriminated union carries `kind`, `truth`, `provider`, `method`, `confirmationPhase: "before_confirm" | "after_confirm"`, `errorFamily`, `retryable`, and safe primary/secondary actions. Copy and actions derive from the union. `confirmationPhase` determines whether `provider_temporarily_unavailable` truth is `not_started` or `failed`.

### Stripe input

Use the installed Custom Checkout `StripeCheckoutConfirmResult`. When `result.error.code === "paymentFailed"`, consume `result.error.paymentFailed.declineCode`; never parse `result.error.message`. Remove the local message-only `StripeOfferConfirmResult` narrowing. `expressCheckoutConfirmEvent.paymentFailed(...)` is only the outbound wallet rejection method.

- Correctable safe codes such as invalid number/CVC/expiry and expired card map to `details_invalid`.
- Insufficient funds, unsupported card, and ordinary issuer declines map to `card_declined`.
- Issuer unavailable, processing/network, and provider-load errors map according to whether confirmation started.
- Lost/stolen/fraudulent/merchant-blacklist, null, and unknown codes stay generic.

PayPal consumes the app's existing closed error/status codes, including `checkout_access_already_exists`, and recovery state machine. User cancellation stays neutral. Pending/activation-delay retains the existing duplicate-payment protection.

The existing payment observability payload gains only the closed safe `payment.feedback_kind` tag/context. Provider error prose and sensitive decline codes remain excluded; existing error family/truth/retryability stay consistent with the feedback classifier.

### Existing-access callers

| Current caller                         | New inline owner               | Copy/action                                  |
| -------------------------------------- | ------------------------------ | -------------------------------------------- |
| `personal-plan-one-time-checkout.tsx`  | one-time body                  | `Zugang bereits aktiv`; email login          |
| `offer-payment-overlay-lab.tsx`        | Labs fixture                   | one-time and membership review variants      |
| `paypal-subscription-button.tsx`       | parent `PaymentMethodCheckout` | `Mitgliedschaft bereits aktiv`; email login  |
| `result-offer-pricing.tsx`             | result-offer body              | `Mitgliedschaft bereits aktiv`; email login  |
| `membership-reactivation-checkout.tsx` | reactivation body              | `Mitgliedschaft bereits aktiv`; `Zum Profil` |

Remove `ActiveSubscriptionDialog` only after all callers migrate. Preserve safe email prefill and every explicit `returnDestination`.

## 5. Target map

- `src/lib/checkout/payment-feedback.ts` — taxonomy, pure Stripe/PayPal mapping, truth, actions, copy.
- `src/components/checkout/payment-feedback-card.tsx` — shared accessible card.
- `src/components/checkout/stripe-offer-elements-checkout.tsx` — consume real structured confirm results.
- `src/lib/stripe/prepared-stripe-checkout-state.ts` and `src/app/api/stripe/create-checkout-session/route.ts` — retain distinct duplicate-access outcome.
- `src/components/checkout/personal-plan-one-time-checkout.tsx` — one-time inline states and reopen persistence.
- `src/components/checkout/payment-method-checkout.tsx` — shared membership ownership/provider switching.
- `src/components/checkout/paypal-one-time-button.tsx`, `src/components/checkout/paypal-subscription-button.tsx`, `src/lib/checkout/paypal-one-time-recovery.ts` — closed PayPal mapping.
- `src/components/checkout/active-subscription-dialog.tsx` — remove after caller migration.
- `src/components/quiz/result-offer-pricing.tsx`, `src/components/reactivation/membership-reactivation-checkout.tsx` — contextual inline states/actions.
- `src/components/checkout/offer-payment-overlay-lab.tsx` — deterministic fixtures.
- `src/lib/observability/payment.ts` and `src/lib/observability/payment-client.ts` — safe closed feedback-kind context; no raw provider detail.

Tests:

- new `tests/payment-feedback.test.ts` and `tests/payment-feedback-card.test.tsx`;
- extend `tests/stripe-offer-elements-checkout.test.tsx`, `tests/personal-plan-one-time-checkout.test.tsx`, `tests/payment-method-checkout.test.tsx`, and `tests/paypal-one-time-recovery.test.ts`;
- rewrite `tests/payment-duplicate-dialog.test.tsx` as inline existing-access coverage;
- extend `tests/offer-payment-overlay.spec.ts` and `tests/result-offer-pricing-cold-checkout.spec.ts` for responsive/reopen proof.

## 6. Designed user journey — confirmed

### Existing access

1. A supported checkout detects existing access before a new payment.
2. Payment methods disappear. The inline card says access is active, `Keine neue Zahlung gestartet`, and offers email login or, for authenticated reactivation, profile.
3. The customer continues without paying again.

### Checkout cannot load

1. Provider setup fails before confirmation, including a request settling while the sheet is hidden.
2. On the open or reopened overlay sheet the card says which provider connection failed and `Es wurde nichts abgebucht.` The always-visible reactivation surface updates inline.
3. The customer reloads or switches method.

### Card/details rejected

1. A safe structured code names a correctable field; otherwise the card says only that the bank declined the card.
2. The customer corrects it, uses another card, or switches to PayPal. No raw/sensitive provider prose appears.

### Pending or paid-but-not-active

1. The card says the status is unresolved or access is delayed.
2. It says `Bitte nicht erneut zahlen`, suppresses new-payment controls, and offers status checking.

Completion means the customer has a truthful state and one safe path forward. Nick explicitly confirmed this journey on 2026-08-10.

## 7. Planning evidence

- Artifact: [rendered mockup](./mockups/2026-08-10-payment-feedback-states.html?reporting=off).
- Decision answered: keep the checkout concise while clearly stating failure, payment truth, and recovery in current Chaarlie styling.
- Incorporated feedback: less copy; exact safe failure; practical next action; existing-access context; modern spacing/alignment/type scale.
- Evidence review: **confirmed** 2026-08-10.
- Journey sign-off: **confirmed** 2026-08-10.
- Disposition: commit HTML; discard transient screenshots.

## 8. Ordered tasks

### Task 1 — Classifier and regression oracle

**Consumes:** SDK types, prepared-checkout/PayPal states, §4.
**Produces:** typed union and pure classifiers.

- Test every kind/truth/action first.
- Test that `confirmationPhase` selects `not_started` before confirmation and `failed` after confirmation.
- Prove safe codes become specific, sensitive/unknown codes stay generic, and raw messages cannot influence copy.
- Prove PayPal pending forbids another payment and cancellation is neutral.

**Complete when:** focused classifier tests pass and no caller needs arbitrary error strings.

### Task 2 — Shared card and one-time migration

**Consumes:** Task 1 and approved mockup.
**Produces:** accessible card in one-time Stripe/PayPal plus Labs fixtures.

- Implement status semantics, focus, 44px+ actions, stable responsive layout.
- Migrate one-time duplicate access inline and suppress payment controls.
- Cover every applicable state and hidden-settlement/reopen regression.

**Complete when:** one-time/Labs match evidence and existing-access/pending/reopen states cannot create a duplicate or remain silent.

### Task 3 — Membership and reactivation migration

**Consumes:** Tasks 1–2.
**Produces:** same contract in result-membership and reactivation; no checkout dialog callers.

- Route PayPal subscription duplicate outcomes to the parent inline card and persist result-membership overlay failures across close/reopen.
- Apply the caller/action table and preserve locks, analytics, defaults, and return destinations.
- Rewrite dialog assertions and extend membership/reactivation components. Stop before deleting `ActiveSubscriptionDialog`; delete it only after a repository search and tests prove all callers migrated.

**Complete when:** all three live checkout contexts render the shared contract and every access action lands correctly.

## 9. Verification

Automated:

- Focused tests named above plus existing checkout/payment-monitor regressions.
- `npm run ci:verify`.
- `implementation-loop` runs repository `ready-check` and `request-code-review` before review-ready handoff.

Browser:

- Desktop/mobile fixtures for every kind, long German wrapping, keyboard/focus/status announcement, provider switching, and payment-control suppression.
- Existing access preserves login/profile destination.
- A failure that settles while hidden appears on reopen.
- Reporting-off mode contains no `Problem melden` affordance.
- Flag-off preserves the current checkout presentation; flag-on renders the new card; switching off does not change payment/backend truth.

## 10. Review and handoff

- Implement only in this task worktree through `implementation-loop`.
- Explicitly do not over-credit this delivery as fixing the separate swipe-dismiss/empty-response silence mechanisms; open a named companion investigation instead.
- Keep `NEXT_PUBLIC_PAYMENT_FEEDBACK_V2_ENABLED` default-off through publication; activation and rollback proof require separate authorization.
- Review whole-branch behavior after implementation; do not rerun planning review on unchanged scope.
- Publication requires later `ship-it` authorization. Merge/deploy/activation remain separate.
- Commit this plan and shared mockup. Discard counterpart files and screenshots.
- Next independent delivery: [payment support lifecycle](./2026-08-10-payment-support-lifecycle.md).

## 11. Decisions and counterpart reconciliation

- Every live checkout, not one-time only — confirmed.
- Split UX from support lifecycle — confirmed.
- Older swipe-dismiss/empty-response silence paths — separate companion fix, confirmed.
- Visual evidence and designed journey — confirmed.
- Accepted review findings: rewrite duplicate-dialog test; enumerate callers; split one-time/membership tasks; preserve hidden-settlement state; reframe historical incident.
- Rejected finding: `result.error.decline_code`; installed SDK proves `result.error.paymentFailed.declineCode`.
- Reconciled final review: inline-all-callers remains confirmed user intent; added confirmation phase, overlay-only reopen scope, safe feedback-kind telemetry, deletion stop-gate, and default-off kill switch.
