# One-time PayPal capture recovery

## Outcome and source context

Make the €29.99 one-time PayPal flow safely convert provider approval into durable purchase/access state without duplicate capture, and prevent expected provider-lock state from appearing as a generic payment failure. This plan incorporates the 2026-08-01 production evidence and the Fable 5 high-effort review retained transiently at `/tmp/chaarlie-paypal-capture-bug-analysis.fable-review.md`.

## Chosen direction

- Reconcile provider truth before any repeat payment attempt.
- Request a complete PayPal capture representation, then retrieve the order as a read-only fallback when the response is minimal, insufficient, pending, or reports an already-captured order.
- Reuse the existing provider verification, activation-status polling, welcome recovery, and deterministic idempotency key.
- Keep provider validation strict: no access without exact order, merchant, token, amount/currency, completed capture, and timestamp evidence.
- Treat a PayPal-owned consent as an expected lock, not a Stripe failure.
- Add an operator-only reset for expired, provably uncaptured PayPal orders. The operator command must verify live provider truth before invoking a tightly guarded database RPC.

## Scope and non-goals

In scope:

- PayPal capture/retrieval orchestration and safe 422 classification.
- Existing-intent recovery and pending routing.
- Stripe-preparation and PayPal-expiry customer feedback.
- Safe diagnostic error codes.
- Operator-only expired-order unlock path for an exact merchant-matched `VOIDED` order, migration, runbook, and tests.
- Read-only reconciliation of the exact production test order and PayPal webhook subscription audit.

Non-goals:

- No change to €29.99 pricing, products, PayPal subscriptions, Stripe subscriptions, consent wording, or offer allocation.
- No automatic provider unlock in production.
- No provider capture, refund, reset, migration application, deployment, or experiment toggle during implementation.

## Target map

- `src/lib/paypal/order-intents.ts`: capture response header/type and provider error classification.
- `src/lib/paypal/order-activation.ts`: full-response retrieval fallback and recovery-safe activation.
- `src/app/api/paypal/capture-order/route.ts`: discriminated completed/pending/error contract.
- `src/components/checkout/paypal-one-time-button.tsx`: redirect recoverable/pending outcomes and show explicit terminal state.
- `src/app/api/stripe/create-checkout-session/route.ts` and `src/components/checkout/personal-plan-one-time-checkout.tsx`: explicit PayPal provider-lock response and neutral UI handling.
- `scripts/billing/`: read-only status/reconciliation and guarded reset CLI.
- `supabase/migrations/`: service-role-only guarded reset RPC if repository evidence confirms a DB transition is required.
- `tests/paypal-orders.test.ts`, `tests/personal-plan-one-time-checkout.test.tsx`, route/CLI contract tests.
- `docs/personal-plan-one-time-recovery-runbook.md`: operator sequence.

## Designed user journey

Status: **approved by Nick on 2026-08-01 with the instruction to implement this plan**.

1. A buyer opens the one-time checkout and accepts the immediate-performance consent.
2. Before a provider is selected, PayPal and card remain available and preloaded.
3. After PayPal owns this consent, PayPal remains usable. Card preparation no longer produces a red payment-failure box; the checkout shows one neutral line explaining that PayPal is already selected.
4. After PayPal approval:
   - completed capture: the app verifies provider truth, persists the purchase, and opens the existing welcome/plan flow;
   - pending capture: the app opens the existing welcome pending screen, which polls the read-only activation endpoint;
   - already captured but not persisted: the app retrieves and verifies the existing order, activates it without another capture, and continues to welcome;
   - expired and uncaptured: the buyer sees a concise terminal message asking them to contact support rather than retrying blindly. An operator can verify and reset the lock.
5. Invalid merchant, amount, token, currency, or capture evidence fails closed and grants no access.

## Mockup evidence

- `plans/mockups/2026-08-01-paypal-recovery-states.html`
- Selected direction: neutral provider-lock notice plus a concise expired-payment support state; pending payment uses the existing welcome polling surface.
- Mockup review: **approved by Nick on 2026-08-01**.

## Counterpart findings ledger

| ID  | Type             | Evidence                                                                                                                    | Decision                | Plan change                                                      | Revalidation                       |
| --- | ---------------- | --------------------------------------------------------------------------------------------------------------------------- | ----------------------- | ---------------------------------------------------------------- | ---------------------------------- |
| F1  | defect           | 2xx provider response plus app 409 proves local validation failure, but not whether provider state was completed or pending | accepted                | reconciliation is step 0; root cause wording remains conditional | read-only order GET                |
| F2  | defect           | expired intent plus immutable consent lock closes Stripe and fresh PayPal                                                   | accepted                | operator-only guarded reset                                      | DB and CLI tests                   |
| F3  | defect           | every PayPal 422 is currently treated as failed, including already captured                                                 | accepted                | retrieve and verify on `ORDER_ALREADY_CAPTURED`                  | provider-error tests               |
| F4  | scope            | recovery, polling, and safe observability largely exist                                                                     | accepted                | extend existing seams only                                       | source-contract and behavior tests |
| F5  | product decision | automatic versus operator unlock                                                                                            | accepted recommendation | operator-only unlock; no automatic mutation                      | runbook review                     |
| F6  | product decision | pending user feedback                                                                                                       | accepted recommendation | existing welcome pending screen                                  | mockup/journey sign-off            |

## Ordered tasks

1. Add failing tests for minimal capture response retrieval, already-captured 422 retrieval, pending outcome, and invalid full responses. Complete when tests distinguish provider truth without a second capture.
2. Implement `Prefer: return=representation` and bounded GET fallback using existing retrieval/verification functions. Complete when completed replay activates, pending stays pending, and invalid evidence fails closed.
3. Add discriminated route/client behavior for completed, pending, provider lock, and expired intent. Complete when no expected lock renders as a generic payment failure.
4. Add failing database/CLI tests, then implement an operator-only reset path that requires expired created intent, absent capture/purchase, exact expected references, an exact merchant-matched `VOIDED` provider response, and atomic order-bound capture claiming. A provider `404` fails closed because it may represent an environment/account mismatch. Complete when unsafe resets and stale in-flight captures are rejected and dry-run is default.
5. Extend existing safe observability with activation error code/recovery path while retaining token/reference redaction. Complete when tests prove no bearer capability is logged.
6. Update the recovery runbook and perform read-only production reconciliation/webhook audit. Complete when the exact test order has a documented provider status and no external mutation was made.
7. Run focused tests, `ready-check`, and `request-code-review`; fix verified findings and refresh receipts. Complete when both receipts match the exact tree.

## Verification

Automated:

- Focused PayPal order/route/UI/operator tests.
- Migration lint/local test where available.
- Typecheck, lint, and repository CI gate through `ready-check`.

Manual/browser:

- Mockup and designed-journey sign-off before UI implementation.
- Local checkout overlay inspection with provider-unlocked, PayPal-locked, pending, and expired fixtures.

Live-state checks:

- Read-only GET of the exact PayPal order before another test.
- PayPal webhook subscription audit for capture completed/pending/denied/refunded/reversed events.
- No new live capture until code is deployed and the stuck order is reconciled.

## Review and handoff

- Worktree: `.worktrees/paypal-capture-recovery-fix`
- Branch: `codex/paypal-capture-recovery-fix`, based on fresh `origin/main`.
- Mockup review: approved on 2026-08-01.
- Designed journey sign-off: approved on 2026-08-01.
- Artifacts: plan, mockup, runbook, migration, code, and tests commit; Fable report discard from `/tmp` after handoff.
- Stop before commit, push, PR, merge, migration application, deployment, provider mutation, or live payment.

## Local implementation receipt

- Implemented full capture representation, one bounded read-only order recovery, already-captured reconciliation, distinct pending/invalid outcomes, neutral PayPal provider lock, and expired-intent support state.
- Added an operator-only reset that defaults to dry-run and accepts only an exact order and configured-merchant match in terminal `VOIDED` state with zero captures. PayPal `404`, missing merchant configuration, ambiguous provider responses, active intents, capture/purchase evidence, Stripe binding, and reference races fail closed.
- Capture persistence now uses an exact-order compare-and-set before direct or webhook activation. A reset and an in-flight capture therefore serialize on the intent row: only one can succeed.
- Focused payment/UI/reset tests, repository node tests, typecheck, lint, production build, and diff checks passed. Four unrelated pre-existing lint warnings remain.
- Local browser inspection confirmed the approved one-time overlay and provider preload. Synthetic lab identity cannot reproduce a real consent-bound provider lock; the approved mockup plus source tests cover the locked and expired states.
- No migration or provider mutation was performed. The exact live PayPal order and webhook subscription audit remains pending a signed-in `info@chaarlie.de` PayPal browser session.
