# Recover concurrent PayPal trial account creation

## Outcome and evidence

An unpaid trial's webhook, welcome SSR and activation poll can simultaneously create the same new Chaarlie account. Preserve the existing account/password/admission contract while recovering the proven generic Auth failure instead of rendering a transient 500/recovery panel. This independently testable slice does not remove the provider notification wait; faster activation remains requested and is being designed separately in the same task.

Historical production evidence: Auth `/admin/users` failed with `unexpected_failure` HTTP500, internal SQLSTATE23505 `users_email_partial_key` INSERT users at 2026-09-15 19:48:25Z; a successful creation of the incident user happened that second. Masked live comparisons confirm checkout intent, lead, Auth and profile emails match and differ from PayPal payer email. The user could use a genuinely new signup email and hit this race. Source: external `/Users/nick/.codex/artifacts/paypal-activation-delay-2026-09-16/investigation.md` and sanitized Auth receipt. No paid entitlement or PayPal-identity duplicate is inferred from this error.

## Decision coverage

- Confirmed with Nick: 2026-09-16 “let's fix it” includes account failure and a meaningful delay reduction; his signup-vs-payer distinction was checked with masked live equality comparisons (signup/Auth/profile equal, payer differs). Existing payment dates, ownership, user journey and password protections remain.
- Inherited: identity comes from intent.email; email equality alone cannot prove checkout ownership. Current server-owned activation hash plus uninitialized-password predicate authorizes this checkout's initial password, regardless of which concurrent request created its user. All provider/admission/CAS gates remain authoritative.
- Implementation defaults: trial-only bounded reconciliation on the observed generic Auth failure; use exact profile lookup and authoritative admin getUserById, not an incomplete listUsers scan. No distributed lease without evidence that bounded recovery is insufficient. No schema change for this slice.
- Open consequential assumptions for this slice: none. Faster API-confirmed activation has a separately approved provenance contract and is being implemented in this same task.
- Coverage acknowledgement: user's current explicit fix request; no repeated approval required for preserving current identity/initial-password semantics.
- Internal revalidation: worktree codex/paypal-trial-fast-activation, fresh main23debe30. Prior proposal's blanket recovered `canSetInitialPassword:false` would send a new same-checkout user to existing-account login; instead use the already-existing authoritative capability predicate. This restores parity with the normal retry path; it does not grant capability from email.
- Undiscussed consequential assumptions affecting this identity-recovery slice: none.

## Journey and scope

Same screens/copy: new user authorizes PayPal, existing welcome flow reconciles, initial password is available only for the proven same checkout and only before initialization. If a competing request already created the account for this checkout, the losing request recovers that exact user and continues. An unrelated existing user retains normal login requirements; missing or conflicting ownership preserves failure/retry rather than granting access. No new UI or user action; the intended normal journey is unchanged. No layout mockup needed for this contract-preserving internal race fix.

No production account mutation during development; no payment-authority change, payer-email linking, global duplicate classifier broadening, auth-trigger alteration, automatic session, or bypass of provider schedule/admission guards.

## Implementation contract

1. Add an exact behavioral regression at `ensurePayPalTrialAccountIdentity` in `tests/paypal-trial-identity-race.test.ts`: first profile read misses, create returns the generic500 while the winner becomes visible, authoritative Auth metadata matches this checkout. Record its failure before code changes. Derive expected identity/capability independently.
2. Preserve original Auth error as `Error.cause` in the shared create helper so trial code can recognize status500/code unexpected_failure without matching arbitrary error strings. Keep existing explicit duplicate behavior for non-trial callers unchanged.
3. In the trial creation branch only, handle that exact generic failure with at most three exact profile/Auth rereads (immediate, then short capped waits, at most250ms total scheduled wait, plus database/Auth request latency). Require normalized profile/Auth emails equal intent.email, Auth identity ID matches profile ID, and server app_metadata activation hash equals this checkout token's hash. Reject any known intent/enrollment owner mismatch. Existing caller rechecks the enrollment CAS winner before admission. Never create a second user during recovery; no provider/payer lookup or first1000 listUsers scan.
4. Return the existing exact user as not newly created; use `canSetInitialPasswordForPayPalCheckout` for any not-newly-created trial identity, as the existing-profile branch already does. A previously initialized password disables initial-password capability. No session or password is written by this helper.
5. Missing/mismatched candidate or exhausted rereads rethrows the original error; no profile upsert before recovery validation. Unrelated generic errors without a trusted same-checkout winner remain errors. Auth-read errors do not turn into success. All downstream checkout-access, owner binding, provider schedule and atomic trial admission checks remain unchanged.

Implementation surfaces: src/lib/paypal/checkout-activation.ts and the focused trial identity test. Additional route/admission integration tests where they cover the actual error seam. No migration.

## Verification

- Red then green focused identity regression with real exported helper and injected external Auth/DB boundaries. Cover immediate/delayed winner visibility; missing/wrong hash; Auth email/ID mismatch; candidate absent; previously initialized password; mismatched known owner; unrelated errors; no extra user creation; no rejected-candidate writes; payer email never used.
- Existing PayPal trial activation/status and checkout-password suites plus relevant paid PayPal account tests protect unchanged callers and access semantics.
- Deterministically coordinate two helper calls to reproduce one success/one generic error. If available, run isolated Auth+Postgres integration, not production credentials or synthetic production signup. If unavailable, state that limitation; mocked tests demonstrate application recovery, not upstream duplicate-error generation, which is separately proven by production logs.
- Typecheck, lint, production build, focused browser/route flow as applicable. Full user-authenticated production retry remains a release verification step, not inferred from static/anonymous GETs.
- Read-only Claude/high plan review before implementation; whole-branch counterpart review and ready-check before publication. Root validates findings and exact final content.

## Handoff and artifact disposition

Commit chosen plan, implementation and meaningful regressions. Archive sanitized red/green/review receipts outside repository in `/Users/nick/.codex/artifacts/paypal-trial-fast-activation-2026-09-16/`. Discard temporary probes. Continue the requested faster activation design independently; do not claim this slice speeds provider notification. Stop before new publication, migration or deployment unless covered by explicit authorization for this new release.

## Plan review disposition and implementation evidence

Claude/high review approved with revisions; no technical blockers. Accepted the missing clean-422 duplicate regression and exposing authoritative Auth ID in the wrapper. All not-new trial creation results now reuse the existing password capability predicate. The suggested additional signup-vs-payer approval is unnecessary: read-only production comparisons established the cause and Nick already requested this repair; identity semantics are unchanged. Three reads with 250ms total scheduled wait is a bounded recovery opportunity, not an Auth request-latency guarantee.

Root ran the 12 focused identity tests green and a real isolated GoTrue2.188.1/Postgres17 two-caller collision green, after recorded behavioral red. Both actual Auth sessions were observed blocked before releasing the barrier; one Auth user and profile result. Fixture uses actual Auth/profile trigger but a SQL-backed profile adapter rather than PostgREST; production RLS/full browser journey remain separate evidence. External receipts: identity-plan-review.md, root-identity-auth-green.log and root-identity-notice-green.log in the task artifact directory.
