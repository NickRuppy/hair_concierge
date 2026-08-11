# Personal Plan Stage 3 authorization integrity and latency

Status: integrity slice approved for local implementation after high-effort counterpart review; latency RPC deferred behind sub-phase measurement. Nick explicitly requested deeper proof and resolution of the severe Stage 3 save failures and delays on 2026-08-11. No migration application, deployment, flag, or production write is authorized by this plan.

## Outcome and source context

Prevent every Stage 3 product write from landing against a draft whose refined source is no longer current. Instrument the authorization sub-phases needed to decide whether a privileged owner-state snapshot is justified; do not present one removed round trip as a proven multi-second fix.

Production evidence from deployment `dpl_Ag9AJS7fNT7JjgyxduFPNYwTUzaD`:

- repeated `PATCH /api/personal-plan/stage-3` conflicts took 1.58-3.89 seconds;
- successful Stage 3 saves took 2.20-4.12 seconds;
- the generic journey phase alone took 1.07-2.95 seconds on conflicts and 1.15-2.65 seconds on successful writes;
- gateway work on successful writes remained a separate 0.61-1.41 seconds.

Repository diagnosis:

- a TypeScript-only Stage 3 loader would still require almost every current database read and therefore cannot honestly explain away the observed latency;
- the full loader pays an entitlement wave, then prepared-artifact/plan reads, then refined-snapshot/current-draft reads;
- the Stage 3 route currently checks only generic reachability before accepting caller plan/refined/draft identifiers;
- `personal_plan_save_product_draft` owner-scopes and revision-checks a draft but does not verify that its refined source is still the parent plan's current refined source. Completion does perform that check.

## Approaches

| Approach                                                           | Easier                                                                                                                                                                       | Harder / residual risk                                                                                                                 | Decision                                                                               |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| A. TypeScript-only Stage 3 loader                                  | No migration; removes Stage 4/5 computation and narrows payloads.                                                                                                            | Normally removes no database read and retains sequential waves; not a credible material latency fix.                                   | Use its narrow return contract and route binding, but not as the performance solution. |
| B. Current-entitlement check plus one service-role owner-state RPC | Keeps revocation fresh on every request; collapses artifact/plan/refined/draft authorization facts into one database round trip; exact identifiers can be bound server-side. | Adds a migration and a privileged read boundary that must be exhaustively owner-scoped, minimally granted, and schema-tested.          | Defer until the new phase trace shows these reads are material.                        |
| C. Signed or cached browser capability                             | Can make repeated interactions fastest.                                                                                                                                      | Weakens immediate revocation/source freshness, introduces expiry/replay/key-rotation behavior, and expands the browser trust boundary. | Reject for this repair.                                                                |

## Chosen direction after counterpart review

Implement the confirmed integrity gap and sub-phase instrumentation first. Defer the owner-state RPC until one deployed trace identifies `artifact+plan` and `refined+draft` round trips as a material share of the journey phase. The local latency acceptance criterion is instrumentation coverage, not an unmeasured speed target.

The integrity response contract is explicit:

- persistence returns `stale_source` when the draft's refined version is not the parent plan's current refined version;
- the production gateway raises `Stage3AuthoritySnapshotError("stale_refined_source")` rather than folding this into `revision_conflict`;
- the PATCH route returns `409 { error: "stale_refined_source" }`;
- the HTTP gateway preserves that code and the client offers a current-state reload, never a retry against the obsolete draft.

Add an in-band gateway/route regression proving a normal client mutation is rejected after the plan pointer advances. This complements, rather than substitutes for, SQL/source-contract proof.

Instrument the current full loader as three named sub-phases—`entitlement`, `artifact_plan`, and `refined_draft`—and propagate or log them in the existing Stage 3 timing family without user identifiers. The local acceptance criterion is deterministic timing coverage for the three phases available on each path. A separately authorized deployed trace decides the next performance slice.

The deferred owner-state RPC remains Approach B. If measurement justifies it, it keeps current rollout/entitlement checks per request, then uses one service-role-only, owner/lead-scoped snapshot for artifact/plan/refined/draft facts. It must follow the repository's `SECURITY DEFINER SET search_path = ''`, schema-qualification, and service-role-only grant pattern. GET binding is defense-in-depth because its existing create/load RPC already checks current source; PATCH current-source enforcement is the load-bearing fix.

## Scope and non-goals

In the immediate integrity/instrumentation slice:

- current-refined-source enforcement in the product-draft save RPC;
- truthful persistence/gateway/HTTP/client handling of `stale_refined_source`;
- in-band gateway/route plus SQL/source-contract regression proof;
- entitlement/artifact-plan/refined-draft instrumentation and deterministic timing tests.

Deferred until measurement:

- the owner-state read RPC and service-role binding;
- a Stage 3-specific access loader using the RPC snapshot;
- exact defense-in-depth binding across GET/search/intake/complete;
- additional route timing work beyond what the measurement requires.

Non-goals:

- caching or weakening per-request entitlement/revocation checks;
- merging the authorization RPC with product mutation or completion;
- changing Stage 3 UX, product authority, category logic, or the five-stage journey;
- solving generic catalog duplication;
- claiming production latency improvement before a separately authorized deployment and measured before/after trace;
- applying the migration, deploying, activating flags, or changing production data.

## Target map

- `supabase/migrations/<generated>_personal_plan_stage3_current_source_guard.sql`: hardened `personal_plan_save_product_draft` current-source CAS only.
- `src/lib/personal-plan/journey-access-loader.ts`: named authorization sub-phase timing seam without changing allow/deny behavior.
- `src/app/api/personal-plan/stage-3/route.ts`: retain the existing route contract and expose truthful stale-source recovery/timing.
- `src/lib/personal-plan/products/stage3-persistence-supabase.ts` and its contracts only as required to map `stale_source` truthfully.
- existing journey-loader, Stage 3 API, persistence, database contract, and Playwright test suites.

## Designed integration journey

1. The authenticated Stage 3 request resolves the current user server-side.
2. Current app rollout and active qualified entitlement are checked as today; revocation remains effective on the next request.
3. Existing owner-state reads and authority validation run unchanged, now recording `entitlement`, `artifact_plan`, and `refined_draft` sub-phases.
4. A valid product mutation reaches the existing gateway with the current draft revision.
5. The save RPC locks the draft and parent plan and independently rejects a draft whose refined source ceased to be current between authorization and mutation.
6. `stale_refined_source` triggers a current-state reload; it is never shown as a revision-conflict retry.
7. Genuine revision conflicts still return `latestDraft` and use the already-fixed deliberate fresh-revision retry.
8. Successful completion keeps its independent current-source check and opens Routine directly.

Completion: an obsolete owner draft cannot be written through the normal PATCH path, current mutations remain revisioned, recovery reloads current authority, and production-ready sub-phase telemetry can decide whether the deferred RPC is worth its privileged boundary.

## Ordered tasks

1. Add red source/database and in-band tests for the integrity gap.
   - Prove the existing save function accepts an old active owner draft after the plan pointer changes.
   - Prove the normal gateway/route mutation path reaches the gap today and maps the new stale outcome distinctly from a revision conflict.
   - Completion: tests fail on the current migration set for the exact missing properties.

2. Add the current-source guard migration.
   - Generate the filename with `supabase migration new`.
   - Replace the product-draft save function with parent-plan/current-source locking/checks plus unchanged payload/revision behavior.
   - Preserve the existing `invalid_source` rejection behavior and add `stale_source` alongside the typed `saved` and `revision_conflict` persistence outcomes.
   - Completion: local migration reset and database tests prove grants, current/stale/foreign cases, concurrent pointer drift, and unchanged successful CAS.

3. Instrument current authorization sub-phases without changing access behavior.
   - Record `entitlement`, `artifact_plan`, and `refined_draft` around the existing calls.
   - Add deterministic tests that allowed and fail-closed paths report the phases they reached.
   - Completion criterion: the code can distinguish the untouched enrollment long pole from later owner-state reads; no performance claim is required locally.

4. Map stale-source recovery through the whole client/server path.
   - Gateway maps `stale_source` to `Stage3AuthoritySnapshotError("stale_refined_source")`.
   - Route returns 409 with the distinct error code; HTTP gateway preserves it.
   - Client recovery reloads the server frontier and never repeats the obsolete mutation.
   - Preserve existing error/status semantics, rate limits, owner-derived gateway construction, and revision-conflict payload.

5. Verify the whole journey.
   - Focused red/green tests, migration reset/database gates, all Personal Plan tests, TypeScript/lint/format/diff.
   - Browser: current product search/save works; one injected revision conflict retries with the fresh revision; stale source cannot save; completion reaches Routine.
   - After separate publication/deployment authorization only: compare the same production route phase p50/p95 against the recorded baseline.

## Verification and stop conditions

Required automated evidence:

- focused journey-loader and all Stage 3 route tests;
- product-draft persistence and SQL/source-contract tests;
- local Supabase migration reset/pgTAP or repo-equivalent database gate;
- `npm run test:personal-plan` and the Personal Plan Playwright suites;
- TypeScript, scoped ESLint, Prettier, and `git diff --check`;
- ready-check plus one whole-tree counterpart review on the final fingerprint.

Stop and re-plan if:

- the integrity migration cannot preserve the current service-role-only boundary;
- local database proof cannot reproduce the stale-source race;
- `stale_refined_source` cannot be kept distinct from a normal revision conflict through the client/server path.

No commit, push, PR, deployment, migration application, feature activation, or production data write is part of this task without a separate explicit gate.

## Review and handoff

- Worktree: `.worktrees/personal-plan-debug-polish` on `codex/personal-plan-debug-polish`.
- This plan follows production timing evidence and a read-only route/loader audit; it makes no unmeasured speed claim.
- High-effort Claude plan review returned `Approve with revisions`. Incorporated: remove the unproven multi-second RPC claim, instrument the three authorization waves, add in-band proof, define the stale-source HTTP/client contract, and treat the function replacement as a two-sided contract change.
- Rollback is code/migration revert before publication. After a production migration, rollback requires restoring the prior function body and coordinating any deployed client that depends on the new stale-source outcome; this is not a purely additive rollback. No destructive data rollback is expected because the migration only tightens a write precondition.
- Artifact disposition: this plan and migration/tests are `commit`; raw production logs and reviewer output are summarized then discarded.
