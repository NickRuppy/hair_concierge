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
