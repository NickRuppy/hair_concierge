# Purchase, registration and intake owner cutover

Task `codex/test-audit-pruning`, pinned original base `21e0e41f`. Original goal: remove 20% of the least useful tests and maintain coverage within 2%. Fully integrated proof remains at 181; 209 net removals are now applied with focused proof. This batch conditionally removes 23 original Node declarations and adds no declarations. No target-completion claim or publication authorization.

Read-only first [ledger](2026-10-02-purchase-registration-ledger.md) and independent [layer plan](2026-10-02-purchase-registration-layer-plan.md) provide exact names, locations, history, caller/CI evidence and input mappings. Their line anchors are historical; main resolves current AST titles. One second-pass typo is corrected here: the P10 inactive-entitlement keeper at line 427 belongs to `auth-intake-state.test.ts`, not `authenticated-app-route-access.test.ts`.

## Decision coverage

- Settled by request: original count target and coverage budget, autonomous production reachability audit.
- Settled by invoked skill: delete redundant lower layers after stronger proof and remove their obsolete test-only exports. The `hasQuizDiagnostics` alias is transparent, called only by one internal resolver and tests; the canonical quiz-completion function remains unchanged.
- Routine defaults: exact inputs and independent expected output survive; monotonic dependency counters observe forbidden work even when errors are swallowed. Existing parameterized keepers absorb real handler behavior, not quota-only helper grouping. Validation rejects/reverses unsupported cuts; no coverage waiver.
- Open consequential choices: none. No current feature, entitlement, payment rule, account ownership, provider configuration, database, deployment, environment or user experience changes.

Coverage acknowledgement: Nick supplied the target and constraint and explicitly delegated retirement discovery. Internal revalidation: both read-only passes confirmed actual helper invocation, current delivery owners and the assertion gaps. Undiscussed consequential assumptions affecting this handoff: none.

## Exact applied scope

Main owns six test files: purchase-completion journey, free-registration contract and journey, auth-intake state, authenticated-app route access; middleware suite is a retained validation sibling. Source cleanup only removes the alias in `src/lib/auth/intake-state.ts` and replaces its internal call with the already-imported canonical function.

1. Eleven purchase cuts: transfer HTTP success and pending zero-provision assertions into the existing payment-settles keeper; foreign-session classification/activation/provision counters into the stronger ownership keeper; PayPal pending HTTP 200 into the pending-to-active keeper; helper retry/capture/blocked outcomes into the actual webhook runner keeper. Shared flag/auth gates return before body parsing, so retain their existing PayPal-shaped handler proof and remove the weaker Stripe-shaped duplicates. Existing routine-not-accepted convergence and runner success already cover two other duplicates.
2. Seven registration cuts: first-send identity, one mail, zero lead writes, exact lead-rate key and no capability consultation move to the actual HTTP endpoint keeper. Real delivered-email plus actual confirmation journeys own positive nested context, bind policy and claimed-lead correction refusal; their copied linker is explicitly not evidence of real storage. Transfer eight exact rate-key inputs into the existing actual send/key keeper, retaining its original three sequential Gmail aliases. Each new input uses fresh fixture state and independently literal expected key, exact raw mail address and zero writes. Repair malformed-input keeper with an external lead-read counter, preserving all original malformed shapes and zero rate/mail assertions.
3. Five intake cuts: transfer exact null scalp/completeness and missing-field cases into existing actual scan-access keepers, keep missing-profile rejection, then remove three alias tests and the alias itself. Preserve all original meaningful field values by literal fixtures; do not only reuse a differently configured completed profile. Remove two exact lower duplicates whose existing intake-state/redirect keepers have the same effective inputs and stronger outcomes. Keep distinct middleware onboarding-false and missing-hair-profile scenarios.

## Sequence and verification

No checkout code/test edit during any test, mutation or c8 reporting window. Establish native baseline; transfer assertions and repair first; require green before cutting; remove exact AST sites/source alias; require native green and count. No env-file load, provider/browser/application server/database action is required by these injected fixtures.

Actual-owner mutations must fail the intended keeper: completion response and early provisioning; foreign-owner work before guard; preparse flag/auth; webhook retry/capture/duplicate attempts/blocked mapping; registration key normalization and raw-address preservation, plain resend capability bypass and lead limiter; confirmation bind/nesting/claimed lead refusal; early invalid lead read; each exact quiz completeness input and inactive-entitlement redirect. Compare real red logs, restore bytes and green; retain negative controls that reveal protection by another guard without claiming they failed.

Independent preservation reads all removed contracts and actual control logs. Then main runs typecheck/lint/build, freezes whole code tree, measures native coverage against original baseline, and requires exact unchanged sorted failure names. Report global, relative and conservative original-path coverage (deleted source charged zero), plus raw per-file diagnostics. Global/conservative drops exceeding 2% reject the batch. Whole-branch counterpart review follows final source changes. Preserve unrelated edits and all original failing tests. No commit/push/PR/deployment.

Before and after native reproduction (all files remain):

```sh
node --import ./tests/server-only-register.cjs --import tsx --test tests/freemium-purchase-completion-journey.test.ts tests/free-registration-contract.test.ts tests/auth-intake-state.test.ts tests/free-registration-journey.test.ts tests/authenticated-app-route-access.test.ts tests/auth-middleware-personal-plan-routine.test.ts
```

Rollback restores only this batch's frozen files, preserving previous campaign changes. Persistent evidence stays here; detailed transient reviewer/test reports remain outside the repository. Coverage and the full 20% goal are unproven until their respective gates finish.

Counterpart disposition: Claude independently checked all titles, current owners and alias callers; no technical blocker or Nick decision. Corrected the mistaken P10 companion path on disk. Sole code/test writer is main; all delegated briefs are read-only. Before each mutation/c8/transfer window main requires its previous native sessions to return final exit status (including reporting), checks process inventory for task-owned `--test`/c8/mutation runners, and opens one exclusive window. No writer subagent is dispatched. The main applies P1–P10 sequentially; each transfer must pass before its donor is deleted.
