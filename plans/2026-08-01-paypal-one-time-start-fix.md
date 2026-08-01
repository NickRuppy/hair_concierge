# PayPal one-time checkout start fix

## Outcome and source context

The production one-time offer must open PayPal reliably and must not fail silently when the
server cannot create a PayPal Orders v2 order. The source evidence is Nick's 2026-08-01 screen
recording plus the production trace for the affected checkout attempt: the local intent row was
created without a provider order because `PAYPAL_MERCHANT_ID` was absent in Vercel Production.
The same trace exposed a stale-cookie attribution mismatch.

## Chosen direction

Treat this as one production payment-path repair:

1. restore and validate the live merchant identifier required by order creation and capture
   verification;
2. make the already-designed PayPal start-error message reachable for server/order failures;
3. use the authorized lead/session as the canonical attribution context, never an unrelated
   browser cookie;
4. deploy only after regression tests, readiness checks, and a read-only high-effort counterpart
   review.

## Scope and non-goals

In scope:

- one-time PayPal order creation and its client error state;
- canonical funnel metadata/events for that order;
- Vercel Production `PAYPAL_MERCHANT_ID` configuration and a production redeployment;
- focused regression coverage and provider/live verification.

Non-goals:

- no PayPal Product or Billing Plan (Orders v2 remains the one-time purchase primitive);
- no price, consent, offer allocation, Stripe, Apple Pay, entitlement, or fulfilment redesign;
- no real PayPal charge during automated verification;
- no changes to the membership checkout.

## Target map

- `src/components/checkout/paypal-one-time-button.tsx`: render the existing start-error copy for
  a failed/incomplete create-order response while avoiding duplicate telemetry.
- `src/app/api/paypal/create-order-intent/route.ts`: bind metadata, touch resolution, and
  `checkout_started` to the authorized lead/session context.
- `src/lib/funnel/server.ts` only if a narrowly testable canonical-context helper is required.
- `tests/personal-plan-one-time-checkout.test.tsx`: client regression contract.
- `tests/paypal-orders.test.ts` or a focused route/helper test: merchant/configuration and
  attribution regression contracts.
- `docs/personal-plan-one-time-provider-setup.md`: make the production merchant-ID preflight
  explicit if current instructions cannot prevent recurrence.
- Vercel Production environment: add the live PayPal merchant identifier without exposing it.

## Designed user journey

Actor: a quiz completer assigned the one-time offer, with the checkout consent accepted.

1. The user opens the existing checkout; PayPal, card, and any eligible wallet stay preloaded.
2. The user taps PayPal. The page selects PayPal and requests a server-owned one-time order.
3. On success, PayPal opens its normal authorization flow. The server records
   `checkout_started` against the exact authorized result/funnel session.
4. If order creation cannot start, the drawer stays usable and shows the existing message:
   “PayPal-Zahlung konnte nicht gestartet werden. Bitte versuche es erneut.” The user can retry
   PayPal or use card; the failure is recorded once.
5. Consent and existing-access/provider-conflict cases retain their existing dedicated behavior
   and are not relabeled as generic PayPal failures.
6. No automated step approves or captures a real payment. Completion for this release is a
   provider order/popup start plus clean server/analytics evidence; a paid end-to-end check is a
   separate manual action.

User-journey sign-off: confirmed by Nick's instruction to fix and ship the reproduced silent
PayPal-start failure immediately on 2026-08-01.

## Mockup evidence

The supplied recording is the current-state artifact. The selected direction does not change
layout, hierarchy, wording, or payment-method prominence: it makes the existing German
`role="alert"` start-error state reachable. Nick reviewed the reproduced failure and explicitly
authorized this repair. Mockup review: confirmed; no new visual asset is needed because the
proposal reuses the already-implemented error presentation unchanged.

## Ordered tasks

1. Add red regression checks for the silent create-order failure and stale-cookie attribution.
   Complete when the focused tests fail for the observed reasons.
2. Implement the smallest UI and route changes. Complete when a failed order response renders
   the retry copy once and successful metadata/events use the authorized session.
3. Recover the live merchant ID from the signed-in PayPal business account or a non-charging
   provider lookup, add it to Vercel Production, and verify presence without printing its value.
   Complete when the live environment inventory contains the key and the deployed runtime can
   create an unapproved one-time order.
4. Reconcile the original failed local intent as diagnostic history only; do not bind it to a new
   provider order or activate access. Complete when no existing payment truth is mutated.
5. Run focused tests, typecheck/lint/build as required by readiness, a read-only high-effort
   counterpart plan/code review, and the repo review router. Complete when no verified blocker
   remains on the reviewed fingerprint.
6. Commit, push, and open a draft PR under the explicit “ship” authorization. Merge/deployment of
   code remains a separate gate; the Vercel environment repair may be applied immediately because
   it is the direct production configuration fix.

## Verification

Automated:

- focused node tests for one-time PayPal UI, Orders v2 validation, and canonical attribution;
- `npm run typecheck`;
- risk-proportionate lint/build and repo readiness checks.

Manual/browser:

- production one-time offer loads PayPal alongside the other methods;
- after consent, PayPal click creates an Orders v2 order and opens authorization;
- forced/non-production server failure shows the retry message without blurring or unloading
  other payment methods;
- no real payment is approved or captured by automated verification.

Live state:

- Vercel Production contains `PAYPAL_MERCHANT_ID` and a fresh deployment uses it;
- the new diagnostic order intent has a provider order ID;
- its metadata and `checkout_started` event use the authorized funnel session;
- no new access/purchase record appears without capture.

## Review and handoff

- Worktree: `.worktrees/paypal-one-time-start-fix` on
  `codex/paypal-one-time-start-fix`, based on fresh `origin/main`.
- Review gates: Claude Code plan review on `high`, final readiness, local review router, and
  Claude Code whole-branch review on `high` before push.
- Rollout risk: a merchant-ID typo blocks both create/capture validation, so live value recovery
  and non-secret presence/provider checks are mandatory.
- Artifact disposition: this plan and code/tests are committed; transient review reports and
  extracted recording frames are discarded; provider diagnostic orders may expire naturally.
- Publication stop: commit, push, and draft PR. Do not merge without separate authorization.

### Findings ledger

| ID  | Type                | Evidence                                                                               | Decision | Plan change                                                                                                                   | Revalidation                                     |
| --- | ------------------- | -------------------------------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| R1  | defect              | Production inventory lacks `PAYPAL_MERCHANT_ID`; order builder fails closed without it | accepted | Live configuration and non-capturing provider order remain mandatory before calling production fixed                          | Verify Vercel key presence and provider order ID |
| R2  | defect              | One-time route preferred a browser cookie over its stored checkout authorization       | accepted | Canonical context now comes from the authorized result session                                                                | Focused attribution contract + broad node suite  |
| R3  | defect              | Create-order failure suppressed the PayPal SDK callback before rendering an error      | accepted | Render existing retry copy before suppressing duplicate SDK handling                                                          | Focused UI contract + local drawer inspection    |
| R4  | tradeoff            | Source-contract tests do not replace a full live provider interaction                  | accepted | Keep a non-capturing live order-start as the final operational proof                                                          | Pending merchant-ID configuration                |
| R5  | review availability | Two configured Claude/Fable bridge attempts on `high` returned empty reports           | deferred | Do not treat empty output as approval; use a separate read-only high-judgment review and disclose the unavailable counterpart | Fallback review found no blocking code defects   |

Counterpart/fallback review status: the configured external bridge was unavailable; the independent
read-only fallback review found no blocking plan or code findings. Code is ready for a draft PR.
Production PayPal remains blocked on R1/R4.
