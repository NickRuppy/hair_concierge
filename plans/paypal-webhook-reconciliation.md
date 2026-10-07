# PayPal webhook reconciliation

## Outcome and evidence

Stop repeat Sentry failures for PayPal events whose outcome is already safely settled, while keeping a failing delivery and alert for any subscription whose payment, access, or cancellation is still uncertain. Reconcile the affected live trials before calling the incident closed.

The production `payment_webhook_processing_failed` Sentry group combines distinct failures. On 2026-09-16 the canceled provider-only billing-clock check had no local checkout or billing row; later trial callbacks failed with missing original activation evidence, an unverified provider start, or a billing batch before the promised trial end. Read-only database evidence shows two newly canceled and released `trial_used` attempts with no billing projection, plus older reserved attempts with no access. The existing cancellation helper requires a fresh provider reread and an empty transaction list before it releases a trial reservation.

## Live case ledger (read-only snapshot, 2026-09-16)

| PayPal agreement | Local evidence | Required live check |
| --- | --- | --- |
| `I-69ESTM9ANYNB` | Provider-only clock verification marker; no app intent/billing row; previously observed canceled with zero transactions | Confirm current canceled state, zero balance, and empty complete transaction list before acknowledging redeliveries. |
| `I-EYRE7NUCK430` | Legacy v1; provider start mismatch in production log | PayPal Business now shows CANCELED by merchant on September 16, zero completed cycles; cancellation webhook `WH-0PA321954G784474G-65V82015PS898113V` succeeded and was recorded processed. The only visible PayPal activity was its $0 creation record. Its exact enrollment is released with `paypal:canceled:I-EYRE7NUCK430`; zero billing rows, payment events, identity claims, or linked user after release. |
| `I-B58A3HH594Y4` | Legacy v1; provider next billing before frozen end in production log | PayPal Business now shows CANCELED by merchant on September 16, zero completed cycles; cancellation webhook `WH-4HC48329HY1364515-3RA342169D369423E` succeeded and was recorded processed. The only visible PayPal activity was its $0 creation record. Its exact enrollment is released with `paypal:canceled:I-B58A3HH594Y4`; zero billing rows, payment events, identity claims, or linked user after release. |
| `I-2VHAG6NB172A`, `I-AW4JTPLB9P1G` | V2 API-proven attempts canceled and released as `trial_used`, with cancellation evidence and no billing row | Live PayPal failed ACTIVATED webhook resources already say `CANCELLED` after the subsequent cancellation. Verify narrow replay after release. |

The two reserved v1 agreements have different checkout emails; neither matches `info@chaarlie…`, but both are on Nick's PayPal payer account. Three later v2 agreements with a noon provider start were admitted with billing rows. The live PayPal Developer and Business Dashboard are signed in; the private Chrome Sentry issue is also available.

## Chosen direction and boundary

1. A signed activation callback for an already proven trial must replay the stored authorization proof and final enrollment state. A delayed webhook must not demand a second provider timestamp or rewrite the original clock. Unproven activations still require their canonical evidence.
2. A signed callback for the one canceled provider-only clock verification `I-69ESTM9ANYNB` may be acknowledged only when its exact `paypal-clock-verification:<uuid>` marker matches, the fresh provider subscription is canceled, no checkout intent or billing row exists, and its complete transaction list is empty. Other subscriptions and payment events continue to fail visibly.
3. Manually cancel and release only `I-EYRE7NUCK430` and `I-B58A3HH594Y4` after their final provider and payment checks. Nick authorized those identified test subscriptions. Preserve the existing fail-closed schedule behavior for all other agreements; no general auto-cancellation is added. Never grant access against an invalid billing clock.

No Sentry issue-wide mute, generic 2xx response, synthetic billing row, automatic customer charge, or change to validated active trials. No UI/copy changes are planned; customers continue to see the existing checkout recovery outcome.

## Decision coverage

- **Status:** the two live legacy trials are canceled and their reservations released with post-write verification. The code fix is local and verified, pending separate publication/deployment authorization and production retry verification.
- **Confirmed with Nick:** Resolve recurring errors properly, including the cause; do not merely hide alerts (2026-09-16 request). The earlier provider-only clock subscription should stay canceled and not be retried. Nick explicitly authorized canceling and releasing the identified test subscriptions after seeing them in PayPal (2026-09-16).
- **Inherited from evidence or contract:** Trial access requires verified provider schedule and admitted billing projection (`trial-account-admission.ts`). A canceled, released enrollment records provider cancellation and no transaction (`neutralizePayPalTrialAgreement`). Provider-only test lacks an app checkout and is already canceled. Read-only production rows show both still-reserved schedule incidents used legacy v1 requests; the later v2 requests with a noon provider start have admitted successfully.
- **Implementation defaults:** Reuse current webhook claim/idempotency path and payment helpers; fail closed on missing test identity, malformed timestamps, transaction-list failure, or a nonempty list. Keep tests at the existing handler and trial seams.
- **Open consequential assumptions:** None for the two named Nick-payer subscriptions. Any other subscription requires its own identity, payment, and entitlement evidence before cancellation or release. The generalized legacy auto-cancellation draft was removed after counterpart review because the authorization covered Nick's two subscriptions, not every future legacy mismatch.
- **Coverage acknowledgement:** Nick requested full resolution and explicitly chose cancellation/release for his test subscriptions on 2026-09-16.
- **Internal revalidation:** Current `origin/main` at `e7b93c67`; production logs and read-only Supabase rows checked on 2026-09-16. Recheck after review and before live action.
- **Undiscussed consequential assumptions affecting this handoff:** None for the two identified Nick-payer subscriptions. The clock-test exception is limited to the one identified subscription under the request to resolve the current repeated alerts.

## Ordered tasks

1. **Finalize trial callback replay.** Add a failing regression for a verified ACTIVATED event whose resource snapshot is already `CANCELLED`, while the attempt has immutable API or webhook proof and the enrollment was released after provider cancellation. Skip repinning only when that proof is persisted and the fresh subscription is also canceled; continue through the existing recovery method and assert 2xx/idempotency with no access or clock rewrite. Keep an unproven canceled event or an unproven event without its original timestamp failing. Target `src/lib/paypal/trial-account-admission.ts` and `tests/paypal-trial-activation.test.ts`.
2. **Acknowledge the provider-only canceled test.** Add failing handler tests for the exact subscription ID and `paypal-clock-verification:<uuid>` marker, canceled provider state, zero outstanding balance, no local intent/billing row, empty complete transaction list, and a successful acknowledgment. A completed free trial cycle is allowed only when the transaction list is empty. Prove rejection for a different ID, active, charged, missing/malformed marker, app-owned subscription, transaction read failure, payment sale, or any missing proof. Implement in `src/lib/paypal/webhook-handlers.ts` using the existing server-only test shim: `node --import ./tests/server-only-register.cjs --import tsx --test tests/paypal-webhook-handlers.test.ts`. No entitlement mutation.
3. **Reconcile the two live legacy trials.** Completed September 16: Nick canceled both in PayPal; PayPal showed `CANCELED` and zero completed cycles, both cancellation webhooks returned success and were stored as processed, and the exact reservations were released through `release_trial_enrollment` after guards for zero billing rows, payment events, consumed claims, and users. A post-write reread confirmed the evidence and absence of identity source associations. Verify any later signed activation redelivery returns 2xx after the code fix is deployed. No change to general legacy schedule disposition.
4. **Close out alerting.** Check Sentry and Vercel after production release; no blanket issue resolution until all event classes stop failing or are individually accounted for. Remove the exact clock-test ID exception in a later cleanup once its pending PayPal retries have drained; track that removal with the incident.

## Verification and handoff

- Use Node 22. Capture red tests before each change, then focused PayPal handler/trial suites, TypeScript/lint, ready-check, and request-code-review. Run the repository Claude counterpart plan review before implementation and whole-branch review before publication.
- Provider cancellation is authorized for the two named Nick-payer subscriptions; the browser-control policy requires Nick to make the final cancellation clicks. Release remains gated on observing final provider cancellation, no payment, and no billing/access projection. Code verification alone is not proof that live subscriptions, payment history, access, and pending webhook deliveries are reconciled.
- Worktree: `.worktrees/paypal-webhook-reconciliation`, branch `codex/paypal-webhook-reconciliation`. Commit this plan with the eventual PR. Keep transient review output outside the repo. Stop before commit/push/PR/merge/deploy until separately authorized by the project workflow.
