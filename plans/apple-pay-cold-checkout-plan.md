# Apple Pay cold-checkout simplification

## Outcome and source context

Apple Pay remains the first, prominent payment option in the offer checkout, but the application stops creating Stripe Checkout Sessions before the customer opens the checkout. A short, explicit loading state is acceptable; payment reliability is the priority.

Source decisions and evidence:

- Nick's decision in this task: keep Apple Pay visibly reserved from the start, accept a slightly longer load, and remove Session prewarming because its reliability cost is not worth the latency benefit.
- Recent fixes #288, #290, #291, and #312 show four distinct failures around the prepared-session lifecycle (claim synchronization, async confirmation, confirmation readiness, and idempotent preparation parameters) producing the same user-visible Apple Pay failure.
- The captured production wallet trace included `prepared_checkout_sync_started` and `prepared_checkout_sync_succeeded`, proving that real loaded production clients currently use the prepared path. A compatibility drain is therefore required rather than optional.
- Stripe documents that Express Checkout briefly has no visible buttons while it determines availability, and that the `ready` event is the authority for whether Apple Pay can be shown. The application may reserve layout space, but must not expose an actionable imitation Apple Pay button before Stripe reports Apple Pay available.
- Stripe recommends a new Checkout Session for each customer payment attempt. Membership cold checkout keeps the analytics `checkoutAttemptId` stable while the drawer is open, creates one Session for its private `checkoutSessionAttemptId`, reuses that scope only on transport retry, and rotates it on an explicit Stripe retry. The one-time offer creates its still-unbound prepared Session only inside an open, consented checkout, then claims it if Stripe is actually chosen.

## Chosen direction

Open the checkout drawer immediately and render the existing non-actionable Apple Pay loading slot in the first position. PayPal remains independently available. Create the Stripe Checkout Session only after explicit checkout intent:

- membership: start one cold Session when the checkout drawer opens;
- one-time personal plan: reserve the Apple Pay and card positions on drawer open, then create an unbound prepared Session only after the customer accepts the existing versioned consent text; retain the claim step solely to bind Stripe when the customer actually confirms with Apple Pay/card, so PayPal remains a real alternative.

The membership live path will no longer use `prepare`, `claim`, `runServerUpdate` activation, resolved-open waiting, hidden checkout mounting, or prepared-session fallback fencing. The one-time path keeps its narrower prepare/claim credential protocol because a normal Session created on consent immediately binds the consent row to Stripe and would make the still-visible PayPal path conflict. It does not prewarm: no provider work occurs before drawer open and consent; no prepared Session survives close/reopen. Stripe's `ready.availablePaymentMethods` remains the only authority that replaces the Apple Pay placeholder with the real Stripe-rendered button.

The server `prepare`/`claim` gate must be decoupled from the public prewarm flag because the one-time checkout continues to use that protocol after explicit consent. During the compatibility window it also permits older already-loaded membership clients to finish; after those assets drain, restrict the protocol to the one-time purchase contract rather than deleting it.

## Scope and non-goals

In scope:

- subscription and one-time result-offer checkout paths;
- immediate drawer opening with honest Stripe loading states;
- one-time consent-gated, drawer-local preparation and provider claim;
- Apple Pay eligibility, PayPal/card fallbacks, retry behavior, analytics, and Sentry payment failure signals;
- removal of background prewarm state, flags, hidden mounts, membership prepare/claim/sync code, and prewarm-specific tests/documentation;
- retention and focused hardening of the one-time prepare/claim contract required to keep Stripe and PayPal concurrently selectable.

Non-goals:

- changing prices, plans, entitlements, provider Dashboard configuration, webhook fulfillment, PayPal order semantics, or the consent wording;
- showing a fake actionable Apple Pay button or overriding Stripe eligibility;
- changing the standard pricing-page or membership-reactivation checkout unless shared code regression coverage requires it;
- deployment, production environment mutation, or a live charge before the normal ship and explicit production-test gates.

No database migration is expected. The existing immutable one-time consent row continues to be created only after the customer accepts the canonical consent text.

## Target map

- `src/components/quiz/result-offer-pricing.tsx`
  - delete subscription and one-time prewarm eligibility, debounce, readiness-gate, prepared claim, wallet fencing, and hidden-mount state;
  - open the overlay synchronously and start a cold attempt only from that explicit open;
  - retain checkout-attempt analytics and provider locking.
- `src/components/checkout/personal-plan-one-time-checkout.tsx`
  - retain `prepare`/`claim`, but do not mount or call Stripe until the drawer is open and consent is accepted;
  - create a fresh preparation credential for each open/retry and discard it on close so no background/stale preparation is reused;
  - keep PayPal as a sibling/secondary path before and after consent, preserve consent focus behavior, duplicate-access handling, provider locking, and fresh-attempt retry.
- `src/components/checkout/stripe-offer-elements-checkout.tsx`
  - retain the existing Apple Pay loading slot, Express Checkout `ready` authority, timeouts, confirm Promise handling, card loading, and failure observability;
  - remove membership-only prepared-session `runServerUpdate` synchronization props/effects while preserving the generic async `onBeforeConfirm` seam used by the one-time claim;
  - ensure a Stripe initialization failure leaves the secondary PayPal path rendered and offers one explicit Stripe retry.
- `src/components/checkout/payment-method-checkout.tsx`
  - simplify the offer-elements contract by removing prepared-session props;
  - keep PayPal independent while Stripe is loading or failed.
- `src/app/api/stripe/create-checkout-session/route.ts`
  - retain the strict one-time prepare/claim schema and consent-on-claim boundary;
  - add attempt-scoped idempotency to quiz-offer membership creates, where the current cold route has no idempotency key;
  - decouple `prepare`/`claim` from `NEXT_PUBLIC_OFFER_CHECKOUT_PREWARM_ENABLED`; after the compatibility window, restrict non-create actions to the one-time purchase contract.
- `src/lib/funnel/flags.ts`, `src/lib/stripe/offer-checkout-ready-gate.ts`, and `src/lib/stripe/prepared-checkout-credential.ts`
  - remove client-only prewarm flags and the ready gate;
  - retain `createPreparedCheckoutCredential`, `PreparedCheckoutCredential`, and the shared control/error helpers for the consent-gated one-time protocol.
- `src/lib/analytics/events.ts`, `src/lib/analytics/destinations/posthog.ts`, and payment observability helpers
  - stop emitting background/resolved-open prewarm outcome telemetry from the new client;
  - preserve generic checkout-opened, checkout-started, option-viewed/selected, initialization-failed, and customer-payment-error signals;
  - keep generic typed initialization/claim failure reporting without customer payment details.
- `src/app/labs/offer-page/page.tsx` and `src/components/checkout/offer-payment-overlay-lab.tsx`
  - replace the prewarm lifecycle lab with deterministic cold-session states: loading, ready, Apple Pay unavailable, Stripe initialization failure, retry, and one-time consent gating.
- Tests and docs:
  - rewrite `tests/result-offer-pricing-prewarm.spec.ts` as cold-checkout lifecycle coverage (renaming the file);
  - delete `tests/offer-checkout-ready-gate.test.ts` with its removed subject;
  - retain `tests/prepared-checkout-credential.test.ts` for one-time credential stability and control/error helpers;
  - rewrite `tests/payment-method-checkout.test.tsx` for the narrowed non-prepared component contract;
  - update `tests/personal-plan-one-time-checkout.test.tsx`, `tests/stripe-checkout-session-route-contract.test.ts`, `tests/offer-payment-overlay.spec.ts`, `tests/stripe-offer-elements-checkout.test.tsx`, analytics tests, and `docs/stripe-express-checkout-release.md`;
  - retain historical webhook/activation tests for already-created prepared Sessions until the compatibility path is retired.

## Designed user journey

### Membership on an Apple Pay-capable device

1. The customer taps the selected plan's payment CTA.
2. The checkout drawer opens immediately. The first row reserves Apple Pay with `Apple Pay wird geladen …`; PayPal is visible and usable; card shows its own loading state.
3. The browser creates exactly one fresh Checkout Session for this explicit checkout attempt. No Session existed before the tap.
4. Stripe reports `applePay: true` through the Express Checkout `ready` event. The non-actionable placeholder is replaced in place by Stripe's real Apple Pay button; PayPal and card remain in the same order.
5. The customer taps the real Apple Pay button and completes Face ID. The existing awaited confirmation handler runs once.
6. Stripe/webhook fulfillment and the existing result/account journey complete unchanged.

### One-time personal plan

1. The customer taps `Haarplan für €29,99 freischalten`; the drawer opens immediately.
2. The canonical consent checkbox appears above payment methods. Apple Pay's first position is reserved but non-actionable and says it becomes available after consent; PayPal remains visible and focuses the consent checkbox if chosen too early; card is likewise reserved.
3. When the customer accepts the canonical consent, the client creates one fresh unbound prepared Session inside this open drawer. Stripe resolves Apple Pay eligibility while PayPal remains selectable.
4. If the customer chooses Stripe, the existing awaited pre-confirm claim records the immutable consent and binds that same Session before confirmation. If the customer chooses PayPal, no Stripe claim occurs and PayPal binds instead.

### Meaningful variants and recovery

- Apple Pay ineligible: Stripe reports no Apple Pay. The reserved row disappears without an error; PayPal and card move up and remain usable.
- Stripe initialization slow: the Apple Pay and card loading states remain bounded by existing timeouts; PayPal remains independently usable.
- Stripe initialization fails: show `Apple Pay und Karte konnten gerade nicht geladen werden. Nutze PayPal oder versuche es erneut.` PayPal remains usable. `Stripe erneut laden` keeps the open-drawer analytics attempt stable. After a known provider/response failure it starts a fresh private Session-attempt scope; after an uncertain network transport failure it reuses the same idempotency scope once so a Session whose response was lost can be recovered safely.
- PayPal selected first: provider locking prevents Stripe creation/confirmation for that attempt and the customer completes PayPal unchanged.
- Close before payment: no confirmation occurs and the drawer-local preparation is discarded. Reopening creates a new explicit attempt; no hidden Session is created while the offer is merely viewed.
- Plan change: close the current attempt and create a fresh Session only after the next explicit checkout open, using the newly selected immutable price/interval.
- Duplicate access or existing purchase: preserve the current dialog and do not offer a retry that can create duplicate entitlement.
- Late Stripe callback after timeout/close: it cannot reinsert Apple Pay into a closed or fenced attempt.

Completion is unchanged: only provider-confirmed payment plus existing webhook/activation logic grants membership or produces the one-time plan.

Journey sign-off: **confirmed by Nick**. Apple Pay remains visually first without Session prewarming; the one-time consent gate and the documented loading, eligibility, fallback, and retry states match the intended journey.

### Open owner decision

- **Membership Session idempotency — recommended: add it.** For `action: "create"` on the quiz-result membership offer, use an idempotency key scoped to a private `checkoutSessionAttemptId`, while the analytics `checkoutAttemptId` remains the identity of the open drawer. Pin the request's funnel event ID and authoritative funnel-session attribution to that drawer attempt so every Stripe creation parameter remains stable on transport retry. An explicit Stripe retry rotates only the Session-attempt ID; reopen or plan change creates a new drawer attempt as well. The current membership cold route has no idempotency key, so leaving it unchanged would rely only on client-side attempt behavior.

Decision status: **confirmed by Nick**. Add membership attempt-scoped idempotency as recommended.

## Mockup evidence

Selected rendered prototype:

- `plans/mockups/apple-pay-cold-checkout.html` — responsive review source;
- `plans/mockups/apple-pay-cold-checkout.png` — four-state review sheet covering consent-gated loading, ready, Apple Pay unavailable, and Stripe initialization failure.

Feedback incorporated: Apple Pay remains visually first from drawer open; short loading is accepted; Session prewarming is removed; PayPal remains independently usable; the one-time path respects the existing consent boundary.

Mockup review: **confirmed by Nick**. No visual corrections requested.

Artifact disposition: commit the plan, HTML prototype, and PNG with the implementation PR. Discard the transient counterpart review after incorporating verified findings.

## Ordered tasks

1. **Freeze the intended cold-attempt contract in tests.** Add red tests proving no provider request occurs from offer visibility/page mount, the drawer opens before Stripe resolves, membership starts one `create` call on open, one-time starts no Stripe call before drawer open or consent and one fresh `prepare` after consent, and a retry receives a new Session-attempt/preparation ID without fabricating another drawer-open event. Completion: all new tests fail for the current background-prewarm implementation for the expected reasons.
2. **Simplify membership orchestration.** Remove prepared checkout state, gates, flags, early Stripe loading, hidden overlay mounting, claim/sync callbacks, and suppression fencing from `MembershipResultOfferPricing`; open the overlay synchronously and use the existing cold `fetchClientSecret`. Completion: membership cold lifecycle tests pass and the source has no membership `prepare` or `claim` call.
3. **Simplify one-time orchestration without weakening consent or provider choice.** Keep the drawer and non-actionable payment placeholders mounted, but mount Stripe only after accepted consent; create a fresh drawer-local preparation, retain the awaited claim only when Stripe is confirmed, and never reuse the preparation after close/reopen. Completion: tests prove no provider request before consent, `accepted_at` cannot precede acceptance, PayPal remains usable before/after Stripe readiness, and each open/retry owns a fresh credential.
4. **Narrow the shared Stripe component.** Remove membership-only prepared-session `runServerUpdate` activation/synchronization state and props while preserving the generic awaited `onBeforeConfirm` claim seam, Express Checkout readiness, `canConfirm` behavior, provider locks, timeouts, retry, and Sentry signals. Completion: component tests cover loading → ready, unavailable, load error, one-time claim allow/reject, confirmation success/failure, and stale late callbacks.
5. **Update the route and compatibility seam.** Add quiz-offer membership Session-attempt idempotency, pin the funnel event ID per drawer attempt, and resolve the exact supplied funnel session with only a same-session signed-cookie fallback when building Stripe parameters. Preserve the strict one-time prepare/claim schema and consent/provider binding, but remove its runtime dependency on the public prewarm flag. Completion: route tests cover same-Session-attempt replay and explicit-retry freshness without rotating analytics identity, stable parameters, one-time consent/credential rejection, and prepare/claim availability with the public prewarm flag absent.
6. **Replace the prewarm lab and browser suite.** Rename scenarios and assertions around explicit cold checkout. Completion: the deterministic lab proves the four mockup states at 390×844 and desktop, including PayPal remaining actionable while Stripe loads/fails and no layout jump when Apple Pay becomes ready.
7. **Remove dead background-prewarm infrastructure and document rollout.** Delete unused client prewarm flags, the ready gate, and stale lifecycle documentation; retain the historical preparation analytics vocabulary for dashboard continuity plus the one-time credential/control helpers and claim seam. Completion: `rg` finds no provider work before explicit open/consent and docs distinguish membership cold create from one-time consent-gated prepare/claim.
8. **Compatibility retirement follow-up.** Nick owns the operational trigger, with Codex performing the check: start a 14-day observation window from production deployment and require zero sanitized membership `prepare`/`claim` requests during the full window. Then open a separate reviewed diff that restricts server `prepare`/`claim` actions to `purchaseKind: "personal_plan_once"` while retaining historical webhook/activation safety. If any membership call appears, restart the 14-day window from its timestamp. Completion: the zero-use evidence is recorded and subscription preparation is rejected without changing the one-time journey.

## Verification

### Automated

- Targeted Node/Vitest suites for request schema, idempotency, consent evidence, checkout-attempt reducer, analytics, and payment observability.
- Playwright cold-checkout lifecycle suite at 390×844 and desktop for membership and one-time variants.
- Existing `tests/offer-payment-overlay.spec.ts` wallet readiness/timeout/late-callback suite.
- Existing Stripe route, webhook, one-time confirmation, PayPal, duplicate-access, and entitlement tests.
- `npm run ci:verify` plus the repository's payment-focused targeted checks and ready-check workflow.

### Manual and browser

- Inspect the rendered German checkout against the approved mockup on narrow mobile and desktop.
- Confirm no `/api/stripe/create-checkout-session` request occurs before checkout open; for one-time, confirm no Stripe request occurs before consent and the first request is `prepare`, not `create`.
- Confirm PayPal can be selected while Stripe is loading or after Stripe initialization failure.
- Confirm Stripe's real Apple Pay button appears only after `ready.availablePaymentMethods.applePay` is true and occupies the reserved first row without a layout jump.
- Confirm unavailable Apple Pay removes the row quietly and card/PayPal remain functional.
- Confirm close, reopen, plan change, duplicate access, provider conflict, retry, network failure, and delayed callback behavior.

### Live-state and release

- Before merge, verify the branch against a fresh `origin/main`, run `ready-check`, and run one whole-branch counterpart code review through `request-code-review`/Claude as required by the repository workflow.
- After deploy, use an explicitly internal production account and physical iPhone Safari to run one real Apple Pay membership or one-time purchase appropriate to the live offer. Native Face ID/Wallet completion cannot be proven by desktop automation.
- Correlate the checkout-attempt ID through browser analytics, Stripe Session/payment outcome, webhook/entitlement, and Sentry; verify no `payment_checkout_initialization_failed`, `customer_payment_error_observed`, or monitor discrepancy is produced for the successful attempt.
- Exercise one controlled Stripe initialization failure in the lab/staging seam and verify Sentry receives the typed failure while PayPal remains usable.
- Nick/Codex observe sanitized legacy membership `prepare`/`claim` usage for 14 consecutive days after deployment; zero calls schedules the compatibility cleanup, while any call restarts the window.
- Production containment/rollback lever: disable `NEXT_PUBLIC_STRIPE_EXPRESS_CHECKOUT_ENABLED` and redeploy. Membership returns to the existing Embedded Checkout path; the one-time offer becomes PayPal-only because no non-Express one-time Stripe fallback exists. Verify both containment behaviors before merge; neither is the intended Apple Pay experience.

### Evidence-sensitive review

- Stripe documentation is authoritative for Express Checkout availability and real button rendering.
- The physical-device production check is a release verification boundary, not evidence that every issuer will authorize every Apple Pay transaction.
- A successful UI confirmation is not sufficient by itself; provider success, webhook activation, entitlement/delivery, and reconciliation monitoring must agree.

## Review and handoff

### Counterpart findings ledger

| ID  | Type                   | Evidence                                                                                                                                                         | Decision                                                     | Plan change                                                                                                                                                                                                                         | Revalidation                                                                               |
| --- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| C1  | defect                 | `route.ts` gates legacy `prepare`/`claim` with the public prewarm flag, so removing that flag could turn an old client's claim into a 404.                       | accepted                                                     | Decouple temporary server compatibility from `NEXT_PUBLIC_OFFER_CHECKOUT_PREWARM_ENABLED`; test legacy calls with the public flag absent.                                                                                           | Route-contract test plus final counterpart pass.                                           |
| C2  | defect                 | `prepared-checkout-credential.ts` owns the credential and control/error helpers used by the one-time provider-choice protocol.                                   | accepted after architecture correction                       | Retain the entire helper for the consent-gated one-time path; remove only background orchestration around it.                                                                                                                       | One-time credential and control/error tests.                                               |
| C3  | defect                 | A normal one-time `create` is schema-forbidden and immediately binds the consent row to Stripe, which would make visible PayPal conflict.                        | rejected as a target after implementation evidence           | Keep strict prepare/claim for one-time, start it only after open+consent, and remove it only from membership.                                                                                                                       | One-time PayPal/Stripe provider-choice tests plus route contract.                          |
| C4  | defect                 | The plan omitted the repository CI command and production containment lever.                                                                                     | accepted                                                     | Require `npm run ci:verify`; verify the existing Express Checkout flag still falls back to Embedded Checkout.                                                                                                                       | Ready-check and manual flag-off lab check.                                                 |
| C5  | scope/product decision | Production trace contains prepared-session sync events, proving old live assets can use the path.                                                                | accepted from observed evidence; no new user decision needed | Keep a bounded compatibility drain owned by Nick/Codex; require zero sanitized membership prepare/claim calls for 14 consecutive days, restarting the window after any call, then remove dormant membership support in a follow-up. | Record the 14-day zero-use check after deploy.                                             |
| C6  | defect                 | Three tests still referenced exports/props scheduled for deletion.                                                                                               | accepted                                                     | Delete the ready-gate test, narrow the credential-helper test, and rewrite the payment-method contract test.                                                                                                                        | `npm run ci:verify` plus targeted suites.                                                  |
| C7  | scope/product decision | Quiz-offer membership cold creation currently has no Stripe idempotency key.                                                                                     | accepted by Nick                                             | Add an immutable private `checkoutSessionAttemptId`-scoped key for quiz-offer membership create only, without changing the drawer analytics identity.                                                                               | Same-Session-attempt replay and explicit-retry freshness route tests.                      |
| C8  | defect                 | Creating/binding a normal one-time Stripe Session on consent would lock the attempt to Stripe before the customer chooses between Stripe and PayPal.             | accepted from route and consent-row evidence                 | Preserve one-time two-phase provider binding, but eliminate all before-open/before-consent preparation and cross-open reuse.                                                                                                        | Browser and route tests proving PayPal remains usable and only Stripe confirmation claims. |
| C9  | defect                 | An attempt-scoped Stripe idempotency key would still fail if retries regenerated `funnelEventId` or rebuilt attribution from a mutable browser cookie.           | accepted during integration                                  | Pin the funnel event ID per attempt, send the offer's funnel-session ID, and resolve that exact server-side session when building Stripe parameters.                                                                                | Focused source/route contracts plus full checkout tests.                                   |
| C10 | defect                 | Rotating the analytics `checkoutAttemptId` on Stripe retry would create provider events with no matching drawer-open event, corrupting joins and Meta semantics. | accepted after final code review                             | Keep `checkoutAttemptId` stable while the drawer remains open; rotate only `checkoutSessionAttemptId`, which is used solely for Stripe Session idempotency.                                                                         | Controller, orchestration source contract, route-option tests, and final review.           |

- Counterpart review: Claude Opus 4.8, high effort, read-only; the refreshed pass approved the corrected one-time provider-lock architecture with no correctness blocker and required the bounded compatibility-retirement owner/trigger now recorded in Task 8.
- Transient review artifact: discard after verified findings are incorporated; do not commit it.

- Planning worktree: `.worktrees/apple-pay-cold-checkout-plan` on `codex/apple-pay-cold-checkout-plan`.
- Implementation starts only after Nick reviews the mockup and explicitly confirms the designed journey.
- Implementation uses the normal `implementation-loop`, then `ready-check` and `request-code-review`. Publication uses `ship-it`; merge remains a separate explicit authorization.
- Rollout risks: older loaded clients may still call legacy `prepare`/`claim`, so the server compatibility path cannot depend on the removed public prewarm flag; one-time consent must not be recorded early; PayPal must not be hidden behind Stripe initialization; a placeholder must never impersonate an actionable Apple Pay button.
- Current stop point: mockup review and user-journey sign-off. No production configuration, deployment, or live payment is authorized by this plan.

Sign-off status: mockup **confirmed**; designed journey **confirmed**; membership idempotency **confirmed**; implementation **authorized**.
