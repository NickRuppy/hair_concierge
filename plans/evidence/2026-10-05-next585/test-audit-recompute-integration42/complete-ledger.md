# Recompute activation / production integration: complete 42-site second-layer judgment

**30R / 4 conditional C / 8 held F / 0D.** Target cohort 42→42→38; proof cohort adds the existing SQL migration suite10 and adapter suite6, giving 58→58→54. No new inputs, cases, loops, owner calls or SQL reads. Only two complementary assertions are proposed, on a result and row already read by the real SQL keeper. No production owner retirement: all five primary owners remain live.

The complete machine ledger is `judgments.json`, with original full callback bodies/locations/hashes. `per-site-ledger.md` records a specific failure and keeper distinction for every one of the 42 target declarations. The distinction matters: eight copied-policy tests are **F**, not automatically D and not credited as independent SQL correctness proof.

## New boundary question and actual current paths

This scope is different from `/tmp/test-audit-refinement-recompute-complete-ledger.md`'s prior113: that report covered assumed-defaults33, intents32, orchestrator26 and rehydration22. Here the complete five files are routine-reactivation14 (305 lines), recompute-activation13 (545), module-driven-classification9 (179), production-deps4 (145) and production-lane2 (557). All 1,731 target lines, helper bodies and existing parameter rows were read. The current five file hashes exactly match navigation575.

Actual entry paths:

- Stage2 API's production `runHabitsRecompute` at `src/app/api/personal-plan/stage-2/route.ts:290–312` checks the owner's current plan/active Routine, then calls the real orchestrator with `createProductionStage3RecomputeDeps`. The surrounding release/auth and gateway route remain; no route retirement or gate changes proposed.
- `routine/production-sync-service.ts:29–37` supplies the production refinement lane to `createRoutineSourceSyncService`. The sync API and `routine/acquisition.ts:54` both use this construction. `source-sync-service.ts:322–381` classifies each refined_need claim, settles stale targets, leaves linear claims to existing terminal behavior, runs real recompute for module-driven lineage and maps retryable/terminal outcomes.
- Production deps creates actual persistence, gateway, compiler, cadence reader and stager; its routine-state reader composes `loadOwnerRoutinePlan` + `loadOwnerRoutineVersion`, parses `routinePayloadV1Schema`, and normalizes legacy draft metadata. Its classification reads server current-head plus canonical `mapModuleProjections`; its reactivator makes real historical stage/confirm RPC calls. No tested export in this cohort is orphaned.
- Gateway `complete` at :917 onwards rebuilds canonical portfolio and calls real stager at :1014, which invokes `personal_plan_complete_draft_activate_v2`. SQL v2 delegates to initial-v1 / normal stage / confirm owners; therefore SQL is the activation policy owner, not the mirror's JavaScript world.

## Four exact conditional cuts and full unions

### C1 — copied closing-lineage success

Donor `tests/personal-plan-refinement-recompute-activation.test.ts:252`, **a module-driven recompute activates the successor immediately instead of proposing it**.

The fake `createV2Client` takes a nonempty products lineage pointing at refined-module-1 and a matching closing result refined-module-2, with a previous active Routine from another refined version and no prior Routine on the target. It manufactures completed/null receipt, new active last-version pointer, null pending pointer and one accepted proposal. The real stager validates and relays that receipt; it does not implement the fake activation/lineage code.

Existing actual policy keeper: SQL suite :479, **the closing completion of a Modul-1-projected draft activates the successor immediately (result_refined_need_version_id branch)**. It creates products projection and then closes the draft through real RPCs, positively asserts the two refined ids differ, activates through v2, and already asserts completed, null proposal id, actual active pointer equals returned new Routine, old active differs, pending pointer null and proposal statuses exactly `["accepted"]`. This is the full donor policy assertion union on the same operative closing-lineage shape. No transfer needed.

Independent real adapter keeper: nested stager suite :96, **activation-aware delegating RPC permits no proposal pointer for first activation**, asserts complete returned envelope including completed/null, plus exact v2 RPC name and source CAS. JSON payload/proposalDelta text in donor versus adapter keeper differs (`recompute`/`initial`, extra empty plannedPurchases), but the actual adapter only bounded-JSON-validates and forwards these fields; no field value dispatch exists. Both are admitted bounded JSON with the same numeric CAS/identity envelope and no provenance mark. Existing adapter first callback separately captures every sent request field. Dropping C1 loses no actual adapter branch.

**Important equivalence limit:** donor is NOT a valid real-SQL fixture: its minimal portfolio omits SQL-required arrays/source metadata. The SQL keeper is not claimed to run identical serialized request bytes. Donor policy inputs live only in the fake world. We preserve the observable policy contract on existing valid real rows, and separately preserve the donor's actual executable adapter branch. Do not report an end-to-end adapter→SQL fixture where none exists.

### C2 — copied module projection success

Donor :279, **a module-1 projection activates immediately even before the closing module**. Nonempty products projection directly names the target; closing result null. Entire donor assertion union is completed-result null proposal plus world pending pointer null.

Existing real SQL keeper :238, **a module-driven recompute activates the successor immediately instead of proposing it**, executes real products module completion (no terminal close), then v2; already asserts completed/null, active switched, null pending, exactly one accepted proposal. The same retained adapter nullable-success callback above preserves real adapter receipt admission. No transfer or new input. Disabling the real projection condition must fail the existing keeper's null-proposal assertion.

### C3 — copied direct-accept provenance success

Donor :511, **the direct-accept provenance is written by the same transaction that activates**. Actual adapter receives `markUnrefinedDirectAccept: true`; fake world has no active Routine and mutates `unrefinedDirectAccept=true` and active Routine to routine-1. It never proves transaction atomicity.

Independent adapter keeper :166, **routine-proposal adapter forwards the atomic direct-accept provenance flag**, already observes exactly true in real RPC args (completed response retained). SQL keeper :638, **the direct-accept provenance write is atomic with activation**, already uses a valid first-activation input with flag true; observes provenance false before, completed response, stored provenance true after, and exact CAS equality. Required transfer uses its existing `after` row and `result`, adding only:

```ts
assert.ok(after.active_routine_version_id, "the provenance write leaves an active Routine")
assert.equal(
  after.active_routine_version_id,
  result.routineVersionId,
  "the provenance write accompanies the activated Routine",
)
```

The positive receipt prevents null-equals-null from passing. This preserves the donor's active-pointer assertion without adding any SQL read or owner call. `routine-1` is a fake sequential id, not a supported id-format contract; real generated identifier must equal the activation's returned id. The keeper proves successful same-RPC persisted effects and CAS; **it does not prove failure rollback**, which remains explicitly unresolved under F8.

### C4 — private provenance CAS source spelling

Donor :59, **the recompute-activation migration keeps the provenance write out of the revision CAS**. It slices source at `IF p_mark_unrefined_direct_accept THEN`, requires `UPDATE public.personal_plans`, prohibits exactly `revision = revision + 1`.

Same existing real SQL provenance keeper :638 directly observes the stored provenance change and `after.revision === result.revision`. Updating revision by 1 would be caught for the intended owner reason, as would a differently spelled increment that the old regexp misses. Its requirement to contain one SQL spelling is an implementation artifact, not a separate publication/storage protocol. Source-security/additive migration declaration :17 remains entirely intact. No assertion transfer for C4.

## Held F cases; no silent proof upgrade

All eight remaining mirror callbacks remain byte-identical in the proposal. Their exact fields are in per-site-ledger.md:

- Linear proposal storage: real keeper currently lacks the complete `[pending]` proposal-table assertion; adding a query would violate this batch's no-new-calls constraint. Do not pretend pointer equals full table state.
- “another plan” case has no foreign plan in its fixture, only mismatching version ids; not a security proof.
- Later completion on same version evaluates firstFromVersion exclusively in the fake. Existing SQL suite explicitly does not construct this second-draft state. No real guard sensitivity claimed.
- First activation fake `world.proposals=[]` is not established by a query in the current real first-activation keeper.
- Two replay mirrors execute meaningful real adapter `already_completed` response handling (one null, one non-null), unlike existing adapter tests' completed responses. Actual SQL replay coverage alone does not replace that adapter contract. They need honest ownership/fixture repair before any cut.
- Fresh confirm failure and provenance-write failure roll back using fake `Object.assign(world,snapshot)`. Mutation of real SQL rollback behavior cannot affect them. Existing adapter transport rejection proof remains; actual SQL rollback-failure proof is not supplied by either mirror. No new fault/input injection is added here.

The other30 R outcomes are not broad “defined schema” retentions: the ledger names each exact branch or response token, including staged versus confirm stale_source handling, pending proposal preservation, owner-scoped lineage filters, legacy source normalization and actual capture/disposition transitions. It also bounds weak titles (e.g. missing/foreign plan fake only supplies null, already-staged test doesn't separately observe RPC count).

## Source/support cleanup and history

No production or shared fixture deletion. The remaining eight mirrors still use `createV2Client`, `emptyWorld`, `V2World`, `stageRequest` and the stager imports; retain all. The first migration source guard still uses readFile/migrationPath. No orphan support removal is unlocked by the four Cs.

History: `e6eb60fd` (2026-08-27, modular backend PR467) introduced activation wrapper + native model during migration rollout; `4029faf0` (2026-09-01, modular exit PR486) added actual recompute integration and real SQL closing/projection requirements. Current `plans/2026-08-31-feinschliff-modular-exit.md:85` specifically requires a real-PGlite lane for closing and projection paths. This supports moving policy ownership toward the existing actual SQL tests; it does not authorize changing plan policy or deleting unique replay/error contracts. The SQL test header calls itself complementary to the mirror; that historical description does not make copied fake outcomes fault-sensitive.

## Verification and immutable proposal

Artifacts:

- `sites.json` includes full exact bodies of target42, real SQL10 and adapter6.
- `judgments.json`, `per-site-ledger.md`: complete42 verdicts.
- `candidates.json`: exact four donors, whole keepers and after bodies.
- `manifest.json`: all21 phase snapshots, current34 readset/dependency hashes; counts42→42→38 and58→58→54.
- `snapshots/{before,transfer,cut}/...`, `complete.diff`: only two test files change; no source file change. All53 surviving callbacks other than the one explicitly strengthened SQL keeper are byte-identical. The target38 survivors all remain unchanged.
- `controls.json`: seven exact unique-owner faults with commands and intended assertion lines/text for all phases. Five are SQL replacements, only statically checked for unique anchors; two TypeScript mutants parse. **None executed.** `provenance-clears-active` intentionally has no before oracle; it proves the newly transferred assertion after main applies it. SQL fault controls must fail by intended assertion, not parser, import, missing function, or setup error.

Read-only static generation parsed all21 prospective TS files and validated counts and exact callback preservation. Recheck current file hashes before main applies; other agents/main may advance this tree. No mutation runner/editor supplied here: main owns application and clean→red→exact restore→clean proof.

Native focused command for main after the frozen575 window closes (not run here):

```sh
node --import ./tests/server-only-register.cjs --import tsx --test tests/personal-plan/refinement-recompute/routine-reactivation.test.ts tests/personal-plan-refinement-recompute-activation.test.ts tests/personal-plan/refinement-recompute/module-driven-classification.test.ts tests/personal-plan/refinement-recompute/production-deps.test.ts tests/personal-plan/refinement-recompute/production-lane.test.ts tests/personal-plan-refinement-recompute-activation-migration.test.ts tests/personal-plan/persistence/routine-proposal-stager.test.ts
```

Top-level suites are in package `test:node`; nested suites are discovered recursively by `scripts/ci/run-personal-plan-nested.mjs`; CI runs both. Both stronger keeper lanes run in the existing native CI, with no optional environment/DB skip in these callbacks. PGlite is a local WASM Postgres dependency (`0.3.14`) instantiated afresh by the fixture and closed by t.after. Its types expose query/exec/close; the fixture reads and executes real migration files. Minimal foreign-key target tables and auth.uid are stubbed; product catalog data and Supabase JWT transport are not validated. PGlite is single-connection, so no lock scheduling/concurrency proof is claimed.

## Exact read limits

In addition to all five target suites, read the entire actual SQL10 keeper suite (1,068 lines), all507 lines of its shared fixture, entire adapter6 keeper suite (192 lines), full primary TS owners (routine-reactivation242, module-classifier87, production-deps140, orchestrator323, stager245), full rehydration289, complete v2 activation migration and initial-v1 delegate. Read full stage-completion and confirm functions in routine-backend migration, plus real entry and dependency methods listed above. Gateway completion/receipt/cache behavior, canonical mapper, routine payload schema and repository methods were read in relevant sections, not full huge Stage3/domain files. Source-sync worker, Stage2 route, broad intents/cadence/recommendation and historical prerequisite migrations were not completely reread; their untouched behavior is not recertified. Prior113 evidence is navigation/context, not reused as a fresh full-body claim.

No compile, native test, DB instantiation, browser, source mutation, provider/network or environment operation. All files written are under /tmp. This is conditional evidence for main review and controls, not an applied reduction or full-suite proof.



## tests/personal-plan/refinement-recompute/routine-reactivation.test.ts

| Line | Verdict | Declaration and evidence |
|---:|---|---|
| 115 | R | **stages the historical Routine as a successor of the current one and confirms it** — Real service delivers historical source identifiers, revision, payload and source_sync origin, then confirms using the revision/proposal returned by stage. SQL A→B→A keeper verifies resulting lineage but not this exact full request union or origin, so retain. Fake does not enforce SQL ownership. |
| 151 | R | **the direct operation keys name the exact transition, so a repeated flip stages afresh** — Exact first transition key plus different keys after current-active/revision moves. Existing SQL repeated flip detects reuse, but not the literal deterministic key contract; no change to that named idempotency convention proposed. |
| 170 | R | **an identical retry at the same plan revision reuses the same fingerprint inputs** — Same real service run twice with unchanged plan state must give identical direct keys. Repeated-flip keeper changes plan state and cannot independently prove unchanged-state retry stability. This equality alone would pass missing keys; preceding exact-key keeper independently protects existence. |
| 188 | R | **a still-pending proposal for the target Routine is reported, never staged over** — Actual owner sees target pending proposal, returns proposal_pending, issues no RPC; exact four query filters are observed. SQL repeated-flip input has accepted proposals and cannot protect pending review ownership. |
| 204 | R | **a missing or foreign plan row gets its own terminal reason** — Null plan returns distinct plan_unavailable and zero RPC. Foreign is only simulated as absent; filters are not asserted here, so retain the missing-row outcome without claiming SQL foreign-owner proof. |
| 211 | R | **does nothing when the historical Routine is already the active one** — Same historical/current routine identity returns unchanged with zero RPC; SQL flip fixture intentionally starts on another active routine. |
| 220 | R | **reports no_routine_for_draft when nothing was ever compiled from the draft** — Two existing inputs cover absent portfolio and absent routine, both no_routine_for_draft; absent portfolio additionally zero RPC. Removing either post-join guard changes this terminal classification; no rows added. |
| 235 | R | **a moved plan between the read and the stage is a retryable conflict** — Three actual stage response tokens map to conflict: stale_active_version, revision_conflict, source_revision_conflict. Confirm-error test exercises later RPC and different token set; SQL keeper has successful CAS, no competing writer. |
| 242 | R | **a moved plan between the stage and the confirm is a retryable conflict** — Actual confirm revision_conflict/stale_source map to conflict. Same token stale_source is terminal at stage, so collapsing the two outcome maps is a concrete escaped regression. |
| 254 | R | **a stale_proposal confirm is terminal, never retried** — Actual confirm stale_proposal remains terminal confirm_rejected. Adding it to CONFIRM_CONFLICTS causes an endless deterministic retry; accepted SQL flip does not return this token. |
| 265 | R | **a refused staging is terminal, not retried** — Actual stage suppressed_rejected/invalid_source/stale_source and transport error all map stage_rejected. Preserve refusal and error branch distinctions; no successful SQL scenario observes these results. |
| 282 | R | **an already-staged identical proposal is confirmed rather than re-staged** — Actual service accepts already_staged receipt, then reaches confirm (fixture returns accepted). Rejecting that stage outcome breaks replay without affecting staged success. Title overstates re-staging observation: it does not count calls independently. |
| 295 | R | **an already-accepted proposal counts as activated, not as a failure** — Actual service accepts already_accepted confirmation. SQL flip confirms newly pending proposals; rejecting the idempotent success token escapes that happy path. |
| 301 | R | **an unrecognised confirm outcome is terminal** — Actual service rejects unrecognized invalid_source confirmation as confirm_rejected. It is the default unrecognized-token branch, complementing specifically prohibited retry token stale_proposal. |

## tests/personal-plan-refinement-recompute-activation.test.ts

| Line | Verdict | Declaration and evidence |
|---:|---|---|
| 17 | R | **the recompute-activation migration wraps the existing RPCs instead of copying them** — Mixed independent migration contract remains: additive delegates/no copied inserts, service-only grants, empty search_path, no migration invocation, lineage/prior-version guards, fresh error/replay branch, provenance/nudge. Some individual private greps are weak; cannot delete this whole declaration using current SQL keeper union. |
| 59 | C4 | **the recompute-activation migration keeps the provenance write out of the revision CAS** — Private UPDATE/revision spelling oracle is subsumed by actual existing provenance SQL keeper: persisted true and persisted plan revision exactly equal returned revision. No new query or input needed. |
| 252 | C1 | **a module-driven recompute activates the successor immediately instead of proposing it** — Copied-SQL closing-lineage world assertions map completely to existing real closing-completion SQL keeper plus retained adapter completed/null receipt keeper. No real SQL policy executes in donor. |
| 279 | C2 | **a module-1 projection activates immediately even before the closing module** — Copied-SQL module-projection null-receipt/null-pending assertions already exist at real module-projection SQL keeper; adapter null delivery remains independently exercised. |
| 300 | F | **today's linear refinement keeps its pending proposal** — Mock computes linear gate and pending proposal array. Actual SQL linear keeper proves pending pointer and unchanged active, but does not read all proposal statuses. Hold full donor union; do not call copied array proof SQL coverage. Actual adapter completed/non-null receipt is independently retained. |
| 322 | F | **a refined version from another plan's module lineage never activates this one** — Claimed foreign-plan security input has no plan owner/id on any supplied lineage row; it only supplies a different version string. Mock ignores SQL scope filters. No current exact real foreign-lineage boundary keeper found; hold, do not manufacture cross-plan inputs. |
| 350 | F | **a later recompute on the same module-projected version proposes instead of activating** — firstFromVersion and prior routine source are evaluated only in createV2Client. Real migration keeper explicitly has no same-version second-completion input. A real SQL prior-version guard fault survives this test; retain pending real-owner proof, not as effective regression coverage. |
| 381 | F | **the first Routine still activates without any proposal** — Fake initial activation mutates world and asserts zero proposals; real initial SQL keeper has no proposal-table emptiness read. Full union not established without a new query. Retained adapter null receipt proof does not prove fake world storage. |
| 398 | F | **replaying a module-driven completion reports the activation, not a pending proposal** — Fake replay accepted-branch policy duplicates real SQL replay, but this is also the actual adapter already_completed/null receipt case. Existing adapter keepers only exercise completed/null. Hold until an existing real request path also preserves this serializer branch; do not add a new response row for quota. |
| 443 | F | **an unconfirmable proposal on the replay path degrades to its pending proposal** — Fake stale replay policy matches real SQL keeper, but actual adapter already_completed/non-null receipt remains a distinct response input not covered by the existing adapter keepers. Retain; model world is not real rollback/security evidence. |
| 486 | F | **an unconfirmable proposal the completion itself staged still fails loudly** — Fresh confirm failure and rollback happen exclusively in fake RPC code. Adapter catches its rejected promise, a separate transport keeper covers that real behavior. No real SQL rollback-input keeper found in current scope; this is not proof of transaction rollback. |
| 511 | C3 | **the direct-accept provenance is written by the same transaction that activates** — True mark reaches real adapter in donor; identical flag forwarding already asserted by retained adapter keeper. Existing SQL provenance keeper proves persisted true; add active pointer equality using its existing after/result objects to preserve second assertion without another read. |
| 527 | F | **a failing provenance write rolls the whole completion back** — Injected provenanceWriteFails triggers fake snapshot restore, not a PostgreSQL failure. Adapter catch is real but already covered by transport failure keeper. No current SQL provenance failure injection observed; hold and disclose absence of real atomic-rollback proof. |

## tests/personal-plan/refinement-recompute/module-driven-classification.test.ts

| Line | Verdict | Declaration and evidence |
|---:|---|---|
| 69 | R | **a superseded refined version is stale without reading the refinement lineage** — Different current refined id returns stale_target before lineage read; exact table sequence personal_plans only. Removing early head guard would produce module_driven for stale projection. |
| 87 | R | **a plan without a current refined version is stale rather than module-driven** — Present plan with null current head rejects rather than classifying module-driven. Missing row is another optional-chain input; source consumer treats this claim as superseded, not retriable read failure. |
| 92 | R | **a missing plan row is stale rather than an exception** — Missing plan exercises null receiver of optional-chain. Removing null-safe property access throws instead of stale_target; present-null-head keeper remains green. |
| 97 | R | **a module projection naming the current version is module-driven, owner-scoped on both reads** — Valid current habits projection recognized by canonical mapper; complete exact plan/user and draft plan/user query filters observed. Worker test fixtures supplying classification do not establish actual query ownership. |
| 120 | R | **a completed module draft whose result is the current version is module-driven** — Nonempty known products lineage points at previous version, while closing result equals current: distinct OR branch. Removing result-id comparison fails this with projection keeper green. |
| 136 | R | **a module-driven plan whose lineage names only other versions is not module-driven** — Known nonempty lineage and result both reference previous version: rejects current as not_module_driven. A loose nonempty-lineage check would wrongly recompute; empty-lineage case would still pass. |
| 152 | R | **a linear refinement completion carries no module lineage and stays on today's terminal path** — Empty projection with matching closing result remains linear/not_module_driven. Dropping nonempty-known-module requirement incorrectly admits linear completion. |
| 161 | R | **a plan with no refinement draft at all is not module-driven** — No refinement rows returns not_module_driven. Returning module_driven for empty rows or dereferencing first row is distinct from a populated linear row; genuine no-draft legacy input remains. |
| 170 | R | **read failures surface instead of being misclassified as not module-driven** — Plan and draft infrastructure errors reject with exact messages rather than stale/not-module classification. Both actual read sites matter to outbox retry; no error input exists in successful SQL activation keepers. |

## tests/personal-plan/refinement-recompute/production-deps.test.ts

| Line | Verdict | Declaration and evidence |
|---:|---|---|
| 64 | R | **the production routine-state reader returns null with a single read when the plan has no active routine** — Actual production dependency constructor composes repository; null active routine returns null with exactly one plan read. Always fetching version would violate cost/path even if result remains null. |
| 78 | R | **the production routine-state reader composes the plan and version rows, translating undefined source-draft fields to null** — Real adapter parses valid routine payload and maps omitted legacy source-draft fields to explicit null, with full result equality. Existing production-lane supplies routineState directly and cannot detect repository join/mapping errors. |
| 107 | R | **the production routine-state reader carries real source-draft fields through unchanged** — Present draft id/revision remain exact rather than normalized to null. Legacy-undefined keeper cannot catch unconditional null mapping. |
| 133 | R | **the production routine-state reader rejects a routine version row missing its source refined-need id** — Missing source-refined id rejects; same valid payload shape is positive in preceding two callbacks. Removing source guard returns invalid success and fails. Rejection is broad (not exact error), but full-file positive controls make generic constructor failure visible; no separate F repair asserted. |

## tests/personal-plan/refinement-recompute/production-lane.test.ts

| Line | Verdict | Declaration and evidence |
|---:|---|---|
| 512 | R | **a rebuilt draft for a person who owns products completes and activates** — Real orchestrator+gateway+rehydration+state transitions handle owned category initially capture-incomplete; completion applied, rebuilt completed, exact assignment and owned_active decision. Compiler/stager/I/O are mocked, so no SQL activation or compiler proof. Retained-product sibling changes authority/disposition state and asserts no assignment/decision union. |
| 537 | R | **a retained (unassigned) product's disposition never blocks the recompute** — Adds existing unassigned owned capture-b; actual state machine derives sole acknowledged not_assigned_to_final_role disposition with 64hex fingerprint, and orchestration completes. Removing acknowledgment blocks real gateway completion. One-product keeper has no disposition branch; no merger/new rows proposed. |
