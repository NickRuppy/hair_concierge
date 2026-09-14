# Reactivation webhook completion — implementation contract

Outcome: a verified successful subscription activation closes its exact reactivation checkout reservation without requiring a browser return, allowing a later eligible repurchase.

Scope: shared Stripe/PayPal subscription activation, provider-bound idempotent reservation completion, existing welcome-page completion callers and regression tests. No new UI, copy, pricing, checkout timing policy, schema migration or operational backfill. Existing affected attempts remain analysis-only.

Decision coverage: confirmed. This repairs the server-side completion gap identified after PR #539; it implements the existing approved returning-customer journey. Nick approved the concrete fix and lost-browser-return/repeated-webhook tests with “Yeah I guess that sounds useful” on 2026-09-14. Original journey decisions are retained in `returning-customer-checkout/plan.md`.

Internal revalidation: fresh worktree from `c986b3f7`, including merged checkout fix `26419861` and subsequent scanner changes. The new code must close only the authenticated activation owner's reservation with the exact persisted provider reference. An uncertain, failed, mismatched or unbound payment never releases the lock. Completion persistence failures must remain retryable. Repeated successful delivery is harmless.

Undiscussed consequential assumptions affecting this handoff: none.

Implementation defaults: extend the existing completion helper with exact provider/reference guards and idempotent completed handling; call it at verified subscription activation success boundaries. Keep ordinary and one-time checkout behavior unchanged. No alternative recovery policy or provider creation mechanism is introduced.

Verification: demonstrate the current lost-browser-return failure before editing activation code; cover both providers, repeated webhook delivery, completion write failure/retry, ownership/reference mismatch and uncertain payment outcomes. Verify a completed reservation no longer prevents a fresh reservation after access expiry using actual existing SQL in isolated fixtures. Run affected tests and Node 22 `ci:verify`; obtain one read-only Claude whole-diff review and inspect findings.

Stop: verified local branch before commit/push/PR, merge, deployment or production writes. The earlier publication and migration/merge authorizations were completed for PR #539.

Artifact disposition: retain this contract and source/tests for the follow-up PR; archive transient test/reviewer output outside the repository. Preserve the previous merged worktree's ignored Supabase cache.

Implementation handoff (2026-09-14): Stripe and PayPal shared verified-activation paths now complete only the matching account/provider/reference reservation, with exact repeated completion accepted. PayPal uses its persisted reservation FK and local intent ID, validates the durable active billing owner, and guards the intent activation update against concurrent quarantine. Welcome-page completion is delegated to these shared paths. Completion failures propagate so webhook delivery can retry.

Observed evidence: 180/180 focused Node tests and 32/32 existing Stripe activation Playwright tests pass. Recorded failing-before-fix guards cover missing server completion, SQL reservation release, PayPal quarantine and reservation-FK consistency. Lifecycle tests execute the existing migration SQL in isolated PGlite; provider calls use fixtures. No real payment or production user simulation was performed.

Review: read-only Claude Opus 4.8 at high effort found no blocking defects; Codex inspected the changed source, composed callers and tests. Existing Stripe return-page error presentation remains a limitation: a database failure during activation/completion can surface an error page while a failed webhook remains retryable. There is no real webhook-to-production-database end-to-end proof. Final repository-check results and matching content fingerprints are recorded outside the repository in `/tmp/reactivation-webhook-completion-reviews/`.
