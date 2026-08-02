# Payment monitor closure

## Outcome and source context

Close the remaining operational gaps from the payment-failure observability rollout:

- the authenticated production integrity route completes instead of failing on one confirmed
  pre-cutover internal PayPal test subscription that is unavailable to the current REST app;
- every `payment_monitor_failed` result has a verifiable Sentry delivery receipt;
- the existing Mac LaunchAgent is enabled only after a clean production run and then proves one
  successful scheduled execution.

Current evidence:

- `POST https://chaarlie.de/api/billing/payment-monitor` reproducibly returns HTTP 500 with
  `paypal:incomplete_pagination:unknown`.
- Production contains 38 PayPal subscription rows: 21 active and 17 canceled. Exactly one row was
  created on 2026-05-28, before the current `Chaarlie_prod` live app was created on 2026-05-31;
  the other 37 rows were created afterward.
- PayPal's live error log for `Chaarlie_prod` shows repeated 404 `RESOURCE_NOT_FOUND` responses
  only for that pre-cutover subscription. Nick confirmed it was his own production test.
- A controlled monitor failure on 2026-08-02 did not create a Sentry issue tagged
  `payment.signal:payment_monitor_failed`.
- The route discards the boolean result of `Sentry.flush`, so production currently cannot
  distinguish successful delivery from a timed-out or disabled transport.
- The LaunchAgent configuration and Keychain secret are valid, but the service is unloaded and
  has no successful run receipt.

## Chosen direction

Classify the single confirmed test row explicitly and fail closed for every other provider error.

1. A billing row is omitted from the PayPal renewal-transaction scan only when its metadata contains
   both an internal-test marker and the closed exclusion reason `pre_cutover_rest_app`.
2. The exclusion is data-driven rather than a hard-coded PayPal ID or email. Unknown 404s, generic
   internal-test rows, malformed exclusions, and customer rows all continue to make the provider
   scan incomplete and emit `payment_monitor_failed`.
3. The operator classification write is guarded by the exact expected provider, creation window,
   current state, and existing metadata. It merges metadata without changing entitlement or payment
   truth. The raw PayPal reference is never placed in logs, Sentry, or committed artifacts.
4. No second live app or multi-credential adapter is introduced. The current `Chaarlie_prod` app
   already supports PayPal Subscriptions and Orders v2 for one-time payments.
5. Monitor reporting returns a real, non-empty Sentry event ID and observes the Sentry flush result.
   A failed flush is
   retried once within the route budget and remains an explicit monitor failure if delivery cannot
   be confirmed.
6. Production configuration validates that the public checkout client ID and primary server client
   ID identify the intended `Chaarlie_prod` app.
7. Production activation requires a controlled, PII-safe failure visible in Sentry followed by a
   clean HTTP 200 run. Only then is the LaunchAgent bootstrapped and kickstarted.

### Settled legacy-test decision

Nick confirmed on 2026-08-02 that the sole pre-cutover subscription was his own production test and
authorized retiring it from customer-payment monitoring. Same PayPal merchant ownership does not
make a REST resource accessible to every app credential. The exclusion is therefore scoped to this
confirmed test classification, not to merchant identity and not to provider 404 generally.

## Scope and non-goals

In scope:

- explicit billing-row test/exclusion metadata and a guarded one-row classification command;
- Sentry capture/flush delivery receipts for monitor failures;
- focused tests, runbook updates, production verification, and LaunchAgent activation.

Non-goals:

- checkout UI, pricing, payment authorization, capture, webhook entitlement semantics, or customer
  messaging;
- changing provider or local entitlement/payment status for the test subscription;
- weakening reconciliation by accepting unclassified PayPal 404, deadline, cap, or pagination
  failures;
- Sentry Cron monitoring; scheduling remains the Mac LaunchAgent plus daily Vercel fallback.

## Target map

- `src/lib/billing/payment-integrity-runtime.ts` — explicit internal-test exclusion predicate.
- `src/lib/billing/payment-integrity.ts` — closed counters/failures for ownership gaps if needed.
- `src/lib/observability/payment.ts` — return a safe Sentry event receipt.
- `src/app/api/billing/payment-monitor/route.ts` and
  `src/app/api/billing/reconcile/route.ts` — require telemetry delivery confirmation on failures.
- `scripts/billing/` — guarded dry-run-first one-row classification command.
- `tests/payment-integrity-runtime.test.ts`, `tests/payment-monitor-route.test.ts`, and focused PayPal
  webhook/shape tests — regression guards.
- `docs/operations/payment-failure-monitoring.md` — ownership, failure, activation, and recovery
  procedure.
- `/Users/nick/Library/LaunchAgents/com.chaarlie.payment-monitor.plist` and installed wrapper —
  activation targets only; no repository copy of secrets.

## Designed operator journey

There is no end-user surface, copy, timing, or payment-flow change.

1. Operator runs the legacy-test classification command in dry-run mode.
2. The command verifies exactly one matching PayPal row and reports only its provider, current state,
   creation month, internal-test state, and whether the exclusion is already applied. It does not
   print an email, user ID, raw subscription ID, or secret.
3. With explicit production-write authorization, the operator applies the metadata-only update.
4. Operator runs focused and repository verification, then publishes/deploys through the normal
   guarded workflow.
5. Operator triggers a PII-safe controlled monitor failure and confirms the corresponding Sentry
   issue/event ID and tags.
6. Operator runs the real monitor. It returns HTTP 200 only when every non-excluded PayPal row is
   scanned completely. Any future unclassified provider error still fails the monitor.
7. Operator bootstraps and kickstarts the LaunchAgent, verifies exit status zero and a success log,
   and confirms the 30-minute interval remains loaded.
8. If the Mac sleeps or is offline, the next local run resumes; the daily Vercel reconciliation
   remains the cloud fallback.

Operator-journey sign-off: confirmed by Nick on 2026-08-02 for the known internal test row.

## Mockup evidence

No mockup is required: the task changes only server reconciliation, telemetry delivery, operator
tooling, and a local scheduler. It has no end-user surface or feedback-state change.

## Ordered tasks

1. Add red tests proving that only a row carrying both the internal-test marker and the closed
   pre-cutover exclusion reason is skipped. Completion: unknown 404s, customer rows, malformed
   exclusions, and internal tests without an exclusion still fail closed.
2. Implement the predicate and filter after enumerating all PayPal billing rows but before provider
   calls. Completion: no raw reference hard-code, customer scans are unchanged, and the excluded
   count cannot consume the provider candidate cap.
3. Add the guarded dry-run-first one-row classification command. Completion: dry-run output is
   aggregate and PII-safe; apply requires the expected project, provider, creation window, current
   row state, and an explicit confirmation flag.
4. Make Sentry delivery observable and bounded. Completion: route tests prove a real non-empty
   capture event ID, successful flush, one retry, and explicit failure when capture returns no event
   ID or both flush attempts fail. Final delivery proof remains a Sentry API lookup for that ID.
5. Update the runbook with exclusion and activation procedures. Completion: commands, stop gates,
   safe output, and rollback are explicit.
6. Run `npm run ci:verify`, then use the repository `ready-check` and `request-code-review` skills,
   including the required read-only Claude whole-branch review. Completion: matching content
   fingerprints and no verified blockers.
7. After separate publication authorization, ship/deploy, apply only the guarded test-classification
   write,
   verify the controlled Sentry event and HTTP 200, then activate the LaunchAgent. Completion: a
   successful production response and scheduled-run log are recorded.

## Verification

Automated:

- focused payment integrity, monitor route, PayPal webhook/shape, and operator-command tests;
- typecheck, lint, production build, and relevant repository test suites;
- secret/PII scans and diff checks.

Live/read-only before publication:

- authenticated production repro remains HTTP 500 for the known PayPal ownership gap;
- classification command dry-run reports exactly one expected safe match;
- Sentry query confirms the pre-fix controlled failure is absent.

Live after publication authorization:

- controlled failure creates exactly one Sentry issue with closed payment tags and no PII;
- real monitor returns HTTP 200 with complete current-merchant coverage;
- all 37 non-excluded PayPal subscriptions complete under `Chaarlie_prod` and the one excluded row
  remains explicitly classified as Nick's internal pre-cutover test;
- LaunchAgent is loaded, kickstarted, exits zero, logs success, and remains scheduled at 1800s;
- daily reconcile returns success for the integrity branch.

## Review and handoff

- Branch: `codex/payment-monitor-closure`
- Worktree: `.worktrees/payment-monitor-closure`
- Durable artifacts: plan, source/tests, operator command, and runbook are committed.
- Transient Claude output: keep outside the repository and discard after findings are reconciled.
- Stop before commit, push, PR, merge, deployment, production data writes, Sentry workflow mutation,
  or LaunchAgent activation unless separately authorized.
- Residual risk: the excluded provider subscription may still exist in Nick's PayPal payer account.
  This change neither cancels it nor changes local entitlement; cancellation is a separate provider
  operation if Nick wants to stop future test renewals.
- No runtime kill-switch is added: this is an operator-only fail-closed monitor, not a customer
  payment path. Rollback is the guarded code rollback plus leaving the LaunchAgent unloaded; a flag
  that restores today's failing scan would not provide a safer customer outcome.

## Counterpart findings ledger

| ID | Type | Evidence | Decision | Plan change | Revalidation |
| --- | --- | --- | --- | --- | --- |
| C1 | defect | PayPal subscription objects contain no merchant/payee field | accepted | Define operational ownership through credential-scoped retrieval | Shape and backfill tests |
| C2 | defect | Merchant-only SQL filtering would hide unknown active rows | accepted | Enumerate all rows, then partition and fail closed | Runtime regression test |
| C3 | defect | `Sentry.flush()` is not a per-event delivery receipt | accepted | Require real event ID plus Sentry API lookup | Route test and controlled live event |
| C4 | tradeoff | Optional historical adapter could be speculative | superseded | Nick confirmed one merchant; build additional app adapter only when the audit proves app-scoped ownership | Live-app audit |
| C5 | tradeoff | Suggested runtime kill-switch | rejected | Operator-only path already fails closed and remains unloaded until verified | Rollback/runbook review |
