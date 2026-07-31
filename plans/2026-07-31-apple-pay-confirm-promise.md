# Apple Pay confirmation Promise repair

**Status:** Approved by Nick for implementation on 31 July 2026

**Branch:** `codex/apple-pay-confirm-promise`

## Outcome and source context

Restore the existing live Apple Pay subscription journey so a successful Wallet authorization reaches Stripe Checkout confirmation instead of ending with the native `Payment Failed` state after tokenization.

The source evidence is the 31 July 2026 live incident: two unrelated Wallet cards tokenized successfully, both tokens remained unused, and Stripe created no PaymentIntent, Charge, Invoice, Subscription, or provider failure event. The deployed prepared-session synchronization fix was exercised through both synchronized and cold Checkout Sessions, so synchronization is not a sufficient cause.

Stripe's React wrapper changed in v6.5.0 to return async Element handler results because dropping the Promise can close Stripe's internal confirm-event window before an awaited `checkout.confirm(...)` executes. Production resolves `@stripe/react-stripe-js` 6.8.0, which preserves returned Promises, but Chaarlie explicitly discards the Promise with `void confirmCheckout(...)` at both Express Checkout render seams.

The discarded Promise is a confirmed code defect and the leading causal hypothesis. The causal link to the observed live failures is not yet closed because a genuinely entered `confirmCheckout` should synchronously emit `express_confirm_entered` and `offer_payment_method_selected`; the supplied traces are byte-identical pre-confirm snapshots, and PostHog did not show the latter event.

## Chosen direction

Repair and instrument the exact confirmation boundary in one focused production change:

1. Preserve the Promise returned by `confirmCheckout` through both `ExpressCheckoutElement` render paths.
2. Add a deterministic browser regression that fails while the callback returns `undefined` and passes only when it returns a thenable that stays pending through `checkout.confirm`.
3. Preserve the current synchronous entry marker and payment-method-selected event as the first evidence that Stripe dispatched `onConfirm` to the application.
4. Capture Stripe's bounded `checkout.confirm` error result through the PII-scrubbed Sentry path, and classify unknown thrown exceptions without serializing their raw objects, while keeping the existing generic German customer message.
5. Deploy the reviewed change to production and reconcile the first live iPhone attempt across browser telemetry, Stripe objects, webhook delivery, billing/entitlement rows, and settlement state.

This is preferred over an instrumentation-only live canary because the `void` is independently defective and returning the Promise is the upstream-supported contract. It is preferred over disabling Express Checkout because the provider/domain/session evidence shows Apple Pay eligibility and tokenization are healthy, while Embedded Checkout rollback would remove the affected path without repairing it.

## Scope and non-goals

### In scope

- Express Checkout `onConfirm` return semantics for the membership offer overlay.
- The injected lab renderer's matching callback contract.
- A red/green regression at that exact seam.
- Sanitized capture of the bounded Stripe confirmation result error plus safe classification of unknown thrown exceptions.
- Existing debug-trace assertions needed to distinguish callback entry from pre-entry failure.
- Production deployment and one explicitly user-driven iPhone Wallet attempt, followed by read-only reconciliation.

### Must remain unchanged

- €14.99/month subscription price and provider price IDs.
- Stripe Checkout Session creation, prepared-session synchronization, claim ownership, webhook handlers, entitlement semantics, Automatic Tax, recurring disclosure, PayPal, and card flows.
- Existing overlay hierarchy, German UI copy, close/retry behavior, and `/welcome` completion route.
- Apple Pay domain/payment-method configuration.
- No card, Wallet token, client secret, address, email, or full provider object may enter application logs or analytics.

### Non-goals

- Reworking prewarm/synchronization again without new evidence.
- Upgrading Stripe packages; production already contains the upstream return-forwarding fix.
- Adding a new product-analytics event solely for debugging.
- Running a Stripe test-mode or separate test-environment Wallet purchase; Nick explicitly chose the existing live environment.
- Refunding, canceling, or modifying any successful subscription without separate authorization after reconciliation.

## Target map

- `src/components/checkout/stripe-offer-elements-checkout.tsx`
  - Return the confirmation Promise at both Express Checkout render seams.
- Preserve/capture the bounded confirmation result error safely; never send an arbitrary thrown Stripe object without stronger redaction.
  - Do not remove `void` from the ordinary Payment Element button `onClick`; React click handlers are outside Stripe's Express confirm-event contract.
- `src/components/checkout/offer-payment-overlay-lab.tsx`
  - Expose whether the injected `onConfirm` callback returned a thenable and whether it remained pending until checkout confirmation settled.
- `tests/offer-payment-overlay.spec.ts`
  - Add the red/green browser regression for the callback-return contract.
- `tests/stripe-offer-elements-checkout.test.tsx`
  - Add focused source/contract assertions only where they complement, rather than substitute for, the browser regression.
- `tests/checkout-observability.test.ts`
  - Extend PII/sanitization coverage if exception capture requires a new reason/status classification.
- `tests/personal-plan-one-time-checkout.test.tsx` and its existing browser coverage
  - Exercise the one-time caller as a regression/control path because it consumes the shared Stripe offer component, while leaving its purchase semantics unchanged.
- `docs/stripe-express-checkout-release.md`
  - Update only if the production verification/rollback receipt reveals a missing release instruction.

## Designed integration and user journey

**Actor and entry:** An eligible iPhone Safari user opens the existing €14.99/month offer and taps the existing payment CTA.

1. The existing overlay prepares or reuses a valid Stripe Checkout Session.
2. Apple Pay remains the first payment option above PayPal and card when Stripe reports it available.
3. The user taps Apple Pay and approves a Wallet card in the unchanged native sheet.
4. Stripe dispatches the Express Checkout confirm event. Chaarlie returns the full `confirmCheckout` Promise, keeping Stripe's confirm-event lifetime open.
5. Chaarlie runs the existing provider-lock and prepared-claim guard, then calls `checkout.confirm` with the same Express confirmation event.
6. On success, Stripe creates the expected subscription payment objects, webhooks activate the existing billing entitlement, and the existing `/welcome` completion flow appears.

**Cancellation:** Closing the native sheet keeps the overlay usable and releases the existing provider lock.

**Real decline or provider confirmation error:** The existing generic German error remains visible; PayPal/card and retry recovery remain available. Stripe's bounded confirm-result error is sent through the existing PII-scrubbed checkout exception path. Unknown thrown objects are reduced to a safe reason classification before capture.

**Three-way production reconciliation:**

1. No `express_confirm_entered`: Stripe did not dispatch `onConfirm` to the application. The Promise fix is not the incident cause; prepare the exact Stripe escalation package and do not attempt a second speculative application patch.
2. `express_confirm_entered` exists but `offer_payment_method_selected` does not: the application received `onConfirm`, but a pre-confirm guard rejected it. Use the existing bounded reason (`not_confirmable`, `prepared_checkout_not_synchronized`, or `provider_locked`) to investigate the application state; do not misclassify this as Stripe non-dispatch or Promise expiration.
3. Entry and payment-method selection both exist: the application reached the async confirmation path. A captured invalid/expired-confirm-event error confirms the Promise-lifetime diagnosis; another bounded error identifies a different confirm-path cause; success proceeds through normal reconciliation.

**Completion:** A successful live attempt produces one PaymentIntent/Charge/Invoice/Subscription, one webhook-driven entitlement, and the existing success UI. No new end-user surface, copy, hierarchy, or decision is introduced.

**Journey sign-off:** Confirmed by Nick on 31 July 2026. Nick accepted the direct-live tradeoff: repair the confirmed callback defect first, then use one controlled live attempt to determine whether it also closes this incident.

## Mockup evidence

No new mockup is required. This plan deliberately preserves every visible Chaarlie and native Apple Pay surface. The supplied `Payment Failed` screenshots are incident evidence, not a proposed design. The selected direction restores the already-designed success journey and changes only the invisible async callback contract plus failure telemetry.

**Mockup review status:** Not applicable — no visual or copy change.

## Ordered tasks

### 1. Establish a red callback-return regression

- Extend the existing payment-overlay lab so its injected Apple Pay renderer records the raw return value of `onConfirm` without awaiting or transforming it.
- Expose whether it is thenable and whether settlement occurs only after the mocked `checkout.confirm` settles.
- Add a Playwright assertion that fails against the current `void confirmCheckout(...)` implementation.
- Include the shared component's one-time caller as a green regression/control path; do not change its payment or entitlement semantics.
- Run it once red before changing production code.

**Complete when:** The focused browser command fails for `undefined` at the real injected renderer seam and no unrelated assertion is red.

### 2. Preserve the Express confirmation Promise

- Change the injected renderer callback type from `void` to the actual Promise-returning contract.
- Remove `void` from both Express Checkout `onConfirm` callbacks.
- Do not reorder guards, pre-confirm synchronization, provider locking, or customer-facing error handling.

**Complete when:** The red browser test passes and proves `checkout.confirm` remains inside the returned Promise lifecycle.

### 3. Preserve decisive, sanitized failure evidence

- Send only the SDK-bounded `checkout.confirm` result error through `captureCheckoutException`, with provider, stage, source, attempt ID, status, and a bounded reason classification.
- In the thrown-exception branch, derive a narrow safe reason such as `confirm_event_invalid` or `exception` from the message, but capture only a new sanitized application error plus that reason; do not send the unknown thrown object.
- Keep raw technical messages out of Wallet debug traces, PostHog properties, UI copy, and console logs.
- Keep `express_confirm_entered` and `offer_payment_method_selected` synchronous and before the first `await`.

**Complete when:** Observability tests prove the context contains no payment secrets/PII and the customer still sees the existing generic error.

### 4. Run payment-focused and repository verification

- Use the repository's Node 22 runtime and a clean lockfile-aligned dependency installation; the root checkout's stale `node_modules` must not be used as Stripe-wrapper evidence.
- Run focused Node tests, the offer overlay Playwright test, the full checkout/prewarm browser group, and `npm run ci:verify`.
- Invoke `ready-check` on the complete tree and record its canonical fingerprint.
- Invoke the `request-code-review` skill as the repository's single review router and run the current `AGENTS.md`-mandated Claude whole-branch counterpart review for a Codex-orchestrated payment change; verify every finding locally.

**Complete when:** Receipts share one fingerprint, no blocking finding remains, and PayPal/card/prewarm regression checks are green.

### 5. Publish and production-verify

- Use `ship-it` for the exact reviewed content: focused commit, push, and draft PR.
- Refresh PR head, checks, review state, conversations, and artifact disposition before requesting/performing the separately guarded merge.
- Let the normal main deployment reach production; do not modify Stripe configuration or price objects.
- Confirm the deployed SHA before Nick performs one live iPhone Apple Pay attempt.
- Reconcile browser markers, Checkout Session, token use, PaymentIntent, Charge, Invoice, Subscription, webhooks, billing/entitlement rows, and settlement.
- If the attempt succeeds, do not cancel/refund it without separate instruction.
- If it fails before `onConfirm`, stop application patching and prepare a Stripe escalation with the exact request/time/device/session evidence.

**Complete when:** The production attempt is fully reconciled and the incident is either closed by a successful confirmation or narrowed to a proven upstream non-dispatch failure.

## Verification

### Automated

```bash
npx playwright test tests/offer-payment-overlay.spec.ts --project=chromium --grep "confirmation Promise"
npx tsx --test tests/stripe-offer-elements-checkout.test.tsx tests/payment-method-checkout.test.tsx tests/checkout-observability.test.ts
npx tsx --test tests/personal-plan-one-time-checkout.test.tsx
npx playwright test tests/offer-payment-overlay.spec.ts tests/result-offer-pricing-prewarm.spec.ts --project=chromium
npm run ci:verify
```

The exact commands may use the repository's worktree server wrapper when required, but the named test coverage and behavior must remain the same.

### Manual/browser

- Existing lab: Apple Pay first, PayPal/card unchanged, cancel/retry/provider-lock paths intact.
- Production iPhone: same price/disclosure/sheet, one deliberate authorization attempt only after deployed-SHA confirmation.

### Live-state reconciliation

- Session belongs to the expected attempt and remains the approved monthly subscription.
- Success: token consumed, PaymentIntent and Charge succeeded, Invoice paid, Subscription active, expected webhook events delivered once, local entitlement active, settlement consistent.
- Failure: exact last successful boundary recorded; no inference from native `Payment Failed`; no retry/requeue/provider mutation without new authorization.

### Rollback

- Fast containment: set `NEXT_PUBLIC_STRIPE_EXPRESS_CHECKOUT_ENABLED=false` and redeploy to restore Embedded Checkout in the offer overlay.
- Do not treat disabling only prewarming as rollback for this incident; the cold Session path already failed.
- Code rollback is safe because there are no migrations or provider configuration changes.

## Review and handoff

- Durable artifacts to commit: this plan, regression tests, focused code fix, and any necessary release-note delta.
- Transient counterpart output: keep outside the repository and discard after findings are reconciled.
- Migrations: none.
- Counterpart review: completed with Claude Opus at `xhigh`; material findings are reconciled below. Transient report remains outside the repository and will be discarded after implementation handoff.
- Journey sign-off: confirmed.
- Implementation stop before publication: none; Nick requested the fix be prepared for live release.
- Publication boundary: `ship-it` may commit, push, and open a draft PR after matching readiness/review receipts. The exact reviewed PR head and live checks must still be surfaced at the repository's separate guarded merge boundary.

## Residual risk

- A passing automated regression proves the merchant-side Promise contract, not the hosted Stripe.js implementation.
- The first live attempt may still show that Stripe never dispatches `onConfirm`; that is a different upstream boundary, not permission for another speculative fix.
- Production confirmation creates real billing objects and potentially a real subscription. Reconciliation is read-only; cancellation/refund remains separate.

## Counterpart findings ledger

| ID  | Type              | Evidence                                                                                               | Decision                   | Plan change                                                                                                                                                | Revalidation                                                      |
| --- | ----------------- | ------------------------------------------------------------------------------------------------------ | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| H1  | defect            | `express_confirm_entered` precedes the guard; payment-method selection follows the guard               | accepted                   | Added three-way reconciliation for non-dispatch, guard rejection, and async confirmation                                                                   | Browser regression plus live marker reconciliation                |
| H2  | tradeoff          | Removing `void` cannot cause Stripe to dispatch an event it never emitted                              | accepted by explicit scope | The live deploy repairs a confirmed defect with a secondary, not guaranteed, chance of closing this incident; direct live repair was Nick's requested path | One live attempt stops at the exact three-way boundary            |
| S1  | workflow          | Claude cited stale `CLAUDE.md` Codex-rescue wording                                                    | rejected                   | Current root `AGENTS.md` remains authoritative: `request-code-review` is the router and Claude is the counterpart for Codex orchestration                  | Review receipt cites the current instructions                     |
| S2  | scope             | Shared component is also consumed by the one-time checkout                                             | accepted                   | Added one-time regression/control coverage without behavior changes                                                                                        | Focused one-time tests and browser coverage                       |
| S3  | defect-prevention | A third `void confirmCheckout(...)` is a normal React button click                                     | accepted                   | Explicitly fence line 1238 from the Express-only edit                                                                                                      | Diff inspection and focused tests                                 |
| S4  | privacy defect    | Current Sentry scrubber does not guarantee removal of secrets/PII from arbitrary thrown Stripe objects | accepted                   | Capture only the bounded confirm-result error; classify unknown exceptions and emit a sanitized application error                                          | Checkout observability tests with secret-bearing hostile fixtures |
