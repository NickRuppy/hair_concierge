# Personal Plan bootstrap and draft idempotency

## Outcome and source context

Fix the two production defects diagnosed on 2026-09-02:

1. optional Stage 3 entry must return the complete decision-review bootstrap instead of exposing the recovery screen on the happy path;
2. an identical cross-document quiz-draft replay at `expectedRevision + 1` must succeed idempotently instead of becoming a false stale conflict.

The source evidence is the captured production request sequence, the read-only production draft snapshot, and the red-capable local reproductions from the diagnosis. No older unproven Stage 3 conflict is treated as causal evidence.

## Chosen direction

- Define one shared Stage 3 review-bundle completeness invariant and enforce it on both server composition and HTTP parsing. The shared predicate must exactly preserve the current `usesReviewBundles` pass/status gate and the production gateway's existing exclusion of `inventory_disposition` subjects.
- Require the optional-entry and canonical GET routes to use authoritative decision-review bundles for decision-ready drafts.
- Replace the quiz-draft update RPC in a new forward-only migration with a row-locked decision: exact revision saves normally; an identical `expectedRevision + 1` replay returns the current revision without writing; the existing bounded unload catch-up may update genuinely different content; all other conflicts remain rejected.
- Keep real stale/browser-generation conflict behavior and all current UI recovery surfaces unchanged.

## Scope and non-goals

In scope:

- Stage 3 bootstrap composition, optional-entry route wiring, client contract validation, and focused tests.
- A new Supabase migration for the existing quiz-draft update RPC plus executable PostgreSQL regression coverage.
- Focused and broader Personal Plan verification and repository review.

Non-goals:

- No UI, copy, navigation, recommendation-policy, rate-limit, auth, or browser-generation changes.
- No generic retry, automatic Stage 3 reload, cross-tab merge system, new mutation-ID protocol, or schema/table change.
- No production migration apply, deployment, commit, push, PR, merge, or cleanup in this task.

## Target map

- `src/lib/personal-plan/products/stage3-bootstrap-response-server.ts`
- `src/lib/personal-plan/products/bootstrap-response.ts`
- a small shared Stage 3 bootstrap review-contract module under `src/lib/personal-plan/products/`
- `src/app/api/personal-plan/stage-3/optional-entry/route.ts`
- `src/app/api/personal-plan/stage-3/route.ts`
- `tests/personal-plan-stage3-optional-entry-route.test.ts`
- `tests/personal-plan-stage3-bootstrap-response.test.ts`
- affected canonical Stage 3 route tests
- a new `supabase/migrations/20260902...personal_plan_quiz_draft...sql`
- a new PGlite-backed quiz-draft migration regression test
- existing quiz-draft route/client tests where contract assertions need updating

## Designed user journey

1. A user finishes the optional products module and enters Stage 3.
2. The optional-entry response already contains the authoritative evaluation and fit comparison for every fit-review subject.
3. Stage 3 opens directly on the existing comparison experience. The current “Passung wird aktualisiert” recovery state remains available only for genuine later failures.
4. Separately, when the quiz page reloads, the outgoing page may save the latest draft while the incoming page replays the same snapshot. The server recognizes identical content as the same successful save, returns the current revision, and server-backed resume remains active.
5. If another browser generation or genuinely different content owns the newer revision, the request still receives a real conflict and cannot overwrite it.

No new end-user surface, copy, decision, timing promise, or recovery control is introduced. The observable change is removal of two erroneous happy-path failures; therefore no visual mockup is required.

User-journey sign-off: confirmed by Nick on 2026-09-02 after the Claude-reviewed walkthrough.

## Planning evidence

- Stage 3 production trace: optional-entry `200` returned incomplete review data; the manual canonical GET `200` supplied it.
- Stage 3 red harness: one review subject with zero authority evaluations and zero fit comparisons.
- Draft production trace: one prepare `200`; reload produced draft saves `200` then `409`; the next reload saved cleanly.
- Draft red harness: two independent client heaps reproduced the false stale conflict.

Evidence review status: confirmed through the user’s acceptance of the two best-practice directions; no visual artifact is applicable because the existing UI is retained.

## Ordered tasks

### 1. Enforce complete Stage 3 decision bootstraps

Consumes: a loaded Stage 3 draft and authoritative review bundles keyed by `subjectKey`.

Produces: a bootstrap where every non-disposition decision subject has exactly one aligned authority evaluation and fit comparison.

- Add decision-ready optional-entry and parser regression tests first and record their failure on current behavior.
- Centralize the required subject-key calculation and exact bundle-coverage check.
- Make server composition fail closed when a decision-ready bootstrap lacks authoritative bundles, and preserve the existing optional-entry-to-canonical-GET recovery by transporting that failure as an explicit bootstrap contract violation.
- Keep product-capture and need-revision drafts outside the completeness gate by sharing the exact current pass/status predicate.
- Lift the production gateway's existing non-disposition subject filter into the shared contract instead of re-deriving it.
- In optional entry, construct the same production gateway used by canonical GET, repair and cache the RPC-returned draft through that gateway, then compose the draft and its bound `reviewDecisionBundles` from that one cached revision. Do not retain the obsolete authority-only fallback callback in the bootstrap composer.
- Preserve product-capture, need-revision, completed, and inventory-disposition behavior.

Complete when the optional-entry route returns one repaired revision with aligned bundles for a decision-ready fixture, incomplete server/client envelopes fail closed through the existing canonical-GET fallback, and focused Stage 3 tests pass.

### 2. Make identical quiz-draft revision replays idempotent

Consumes: draft ID, browser generation, expected revision, sanitized draft JSON, and the existing bounded catch-up flag.

Produces: an atomic RPC result with these rules:

- current revision equals expected: persist and increment;
- current revision equals expected + 1 and stored JSON equals incoming JSON: return current metadata without writing;
- current revision equals expected + 1, JSON differs, and bounded catch-up is explicitly allowed: persist and increment;
- otherwise: return no row, preserving the route’s real `409` behavior.

- Add a PGlite PostgreSQL regression test first and record failure because the forward migration does not yet exist.
- Add a forward-only `CREATE OR REPLACE FUNCTION` migration using one row lock before branching.
- Name the migration `20260902120000_personal_plan_quiz_draft_idempotent_replay.sql`, after the existing `20260902090000` and `20260902091000` migrations.
- Preserve the exact RPC arguments `(uuid, integer, integer, jsonb, boolean)` and return columns `(revision, browser_generation, expires_at)`; do not add a replay flag or require `DROP FUNCTION`.
- Preserve active/unexpired, browser-generation, TTL, privilege, and service-role boundaries.
- Treat only an identical `expectedRevision + 1` replay as a no-op. Return the stored expiry unchanged and document that the no-op intentionally does not extend TTL. Gaps of two or more revisions remain conflicts.
- Prove identical replay is a no-op, different normal replay conflicts, bounded catch-up still works, and wrong generation conflicts.

Complete when the executable database test and existing draft client/route tests pass.

### 3. Verify and review the complete tree

Consumes: both implemented slices and their red/green evidence.

Produces: matching verification and review receipts for one canonical content fingerprint.

- Run focused tests, migration uniqueness, typecheck, lint on changed files, and the broader Personal Plan suite proportionate to runtime.
- Run `ready-check` and the repository’s single `request-code-review` router.
- Resolve supported findings and refresh affected evidence.

Complete when no blocking verified finding remains and all artifacts are classified.

## Verification

Automated:

- focused Stage 3 optional-entry/bootstrap/API tests;
- new PGlite draft migration test plus existing quiz-draft route/client tests;
- Supabase migration-version uniqueness;
- TypeScript typecheck and lint;
- broader `npm run test:personal-plan` when focused checks are green.

Manual/browser:

- No production or authenticated browser replay: it would create production state and is not needed to validate these deterministic server contracts.
- Review the response-state journey through route/component integration tests: decision-ready optional entry must not expose the missing-bundle recovery branch.
- Prove a gateway-prepared optional draft and its review bundles use one cached revision, and prove a typed incomplete-bundle response still triggers the existing client contract fallback.

Migration/live state:

- Execute the new function against an isolated PGlite table fixture.
- Do not apply the migration to local or production Supabase in this authorization.

## Review and handoff

- Branch: `codex/personal-plan-bootstrap-draft-idempotency`
- Worktree: `.worktrees/personal-plan-bootstrap-draft-idempotency`
- Claude plan review: completed on 2026-09-02 with Opus at `high` effort after restoring the documented 15-minute review budget. Verdict: approve with revisions.
- Required code review: repository `request-code-review` router after final verification. Claude's first code-review pass found the cross-revision composition and fallback regressions; both were fixed and locally revalidated before the final pass.
- Plan, code, migration, and tests: commit candidates, but remain uncommitted until separately authorized.
- Stop point: verified review-ready local branch; no publication or production mutation.

Residual risk: production concurrency timing cannot be replayed without a production write, so the atomic PostgreSQL regression is the release oracle for the reload race.

## Claude findings ledger

| ID  | Type                   | Evidence                                                                    | Decision         | Plan change                                                                                                                | Revalidation                                                           |
| --- | ---------------------- | --------------------------------------------------------------------------- | ---------------- | -------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| C1  | defect                 | Composer's bundle gate excludes product capture and need revision           | accepted         | Share the exact gate; do not infer it only from subject count                                                              | Stage 3 capture/need-revision tests                                    |
| C2  | defect                 | Production gateway excludes inventory dispositions from fit review subjects | accepted         | Lift and reuse that exact filter                                                                                           | Mixed decision/disposition contract test                               |
| C3  | defect                 | Optional entry currently has no authority-review gateway                    | accepted         | Construct the production gateway and share one repaired cached draft plus canonical review-bundle wiring after persistence | Decision-ready optional-entry route and production-gateway cache tests |
| C4  | defect                 | `CREATE OR REPLACE FUNCTION` cannot change the RPC return/signature         | accepted         | Preserve arguments and return columns exactly                                                                              | PGlite function-call assertions and route tests                        |
| C5  | defect                 | Two `20260902` migrations already precede this work                         | accepted         | Pin the new migration to `20260902120000`                                                                                  | Migration-version uniqueness test                                      |
| T1  | tradeoff               | Identical `expected + 1` success also applies to normal autosave            | accepted by user | Apply the idempotent result to the diagnosed incoming-page half of the reload race                                         | Two-client replay test plus divergent-content conflict test            |
| T2  | scope/product decision | Post-review journey confirmation was required                               | accepted by user | Implement the designed journey exactly as reviewed                                                                         | Record sign-off above                                                  |

Transient Claude report: discard after the accepted findings and decisions are recorded here.

## Claude code-review findings ledger

| ID  | Type            | Decision                         | Resolution                                                                                                                                                                  | Revalidation                                                                     |
| --- | --------------- | -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| CR1 | hard defect     | accepted                         | Added `prepareLoadedDraft` so optional entry returns the same repaired cached revision used for its bundles                                                                 | Production-gateway cache test and optional-route revision test                   |
| CR2 | hard defect     | accepted                         | Mapped incomplete server bundles to a typed bootstrap contract response that the browser converts back to `Stage3BootstrapContractError`, preserving canonical-GET fallback | Optional and canonical route tests, HTTP gateway test, plan-start fallback tests |
| CR3 | behavioral gap  | accepted                         | Pinned identical-content catch-up as the same no-write replay; divergent catch-up still advances                                                                            | PGlite migration test                                                            |
| CR4 | low-risk note   | accepted as fail-closed behavior | Duplicate required subject keys remain a contract failure; upstream draft mutation validation owns reachability                                                             | Existing duplicate/misaligned bundle test                                        |
| CR5 | maintainability | rejected                         | The browser's all-inventory-disposition rendering predicate is intentionally narrower than the transport pass gate; sharing it caused the acknowledgement-only regression   | Stage 3 flow regression failed under the suggestion and passed after restoration |

## Final verification receipt

- Rebased verification base: `59d01817` (`origin/main`); task commit before this receipt refresh: `f5d0d60d` on `codex/personal-plan-bootstrap-draft-idempotency`.
- Focused route/gateway/database verification: 109/109 passed after the first code-review fixes; the final PGlite boundary suite passed 5/5 after integer and ACL hardening.
- Broad verification: `npm run test:personal-plan` passed 2,654/2,654; `npm run ci:verify` passed typecheck, lint, and the production Next.js build. Lint retained five unrelated pre-existing warnings and reported no errors.
- Migration timestamp uniqueness and `git diff --check`: passed.
- Claude final whole-change code review and bounded follow-up review: Opus at `high` effort returned `APPROVE` with no hard defects. Its supported non-blocking findings were resolved by adding privacy-safe optional-entry failure logging and complete operation timing, requiring canonical review bundles at the route type boundary, consolidating the review-bundle type, aligning the Labs fixture filter, testing the external-draft owner check, restoring deliberately polluted legacy RPC privileges, bounding the request schema, and hardening both integer-boundary write branches.
- Rebase verification: `npm run test:personal-plan` passed 2,655/2,655; `npm run ci:verify` passed typecheck, lint with five unrelated pre-existing warnings, and the production build.
- Production migration `20260902120000_personal_plan_quiz_draft_idempotent_replay` was applied from an isolated exact-file push and verified in migration history, function guards, and service-role-only ACLs before application merge.
- Accepted residual risk: no authenticated browser replay or contended two-connection database race was run. Deterministic route/component coverage, isolated PostgreSQL execution, and direct production definition/ACL verification are the release oracles for this server-only change.
- Artifact disposition: this plan, implementation, migration, and tests are committed in PR #506. Claude reports and command logs remain transient outside the repository.
