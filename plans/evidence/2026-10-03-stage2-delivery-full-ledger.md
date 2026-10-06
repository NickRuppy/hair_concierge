# Stage 2 module delivery and refinement audit

Current bounded scope: **17 full test files /163 declaration sites; {'R': 151, 'F': 6, 'C': 6}.** Five conditional C cuts are staged in `/tmp` (163→163 during transfer→158 after cut). C6 is separate and not staged. No declaration credit claimed yet; no test/source/DB execution or repository write performed.

All163 callbacks and their file-local fixtures were read completely. The machine ledger contains complete callback text and exact current file hashes. This is a bounded semantic review, not a whole Personal Plan coverage claim.

## Ready five-C artifacts

- `/tmp/test-audit-stage2-delivery-edit.cjs` plus `-edit-plan.json`: check / transfer / cut, exact task cwd, all17 file hashes, all51 prospective strings AST-parsed before writes. Transfer retains every title; cut removes exactly five named callbacks and preserves every retained callback byte-for-byte from transfer. Snapshot originals and staged strings to unique `/tmp` folder; recheck all17 bytes before first write and again before per-file atomic replacement; receipt persists hashes. Multi-file rename is not a global filesystem transaction: interruption requires receipt-based main recovery.
- `/tmp/test-audit-stage2-delivery-edit-check.json`: static check passed, no repository writes. `node --check` passed. No compiler/typecheck claim.
- `/tmp/test-audit-stage2-delivery-controls.json`:9 unique owner mutations;6 TS syntax-parsed,3 SQL anchor-only checked. `/tmp/test-audit-stage2-delivery-controls-static.json` records limits. Main must run baseline, transfer, each intended RED and byte-exact restore GREEN, then cut and final focused coverage.
- `/tmp/test-audit-stage2-delivery-sites.json` and `-ledger.json`: complete scope membership and candidate fields.

## Runtime and support ownership

Active customer path: `/plan-start/page.tsx` checks feature/auth/journey admission, optional/refine URL and real persisted session; `PlanStartCustomerJourney` constructs the HTTP Stage2 gateway and renders `RefinementFlow`. Explicit module scope and accepted-plan origin remain separate. Questions use canonical path, required answer validation and source-keyed heat IDs. Final save runs PATCH through authoritative service; module completion uses user provenance ∪ explicit assumptions, delegates full close only when both modules user-complete, otherwise writes actual module RPC. Supabase adapter maps RPC outcomes and reads persisted lineage back into draft; Stage3 receives signed refined snapshot rather than recomputing target policy. No route or feature retirement found.

Supported operator path: `docs/local-qa-access.md:69` names `/labs/personal-plan-stage-2?scenario=ready`; page validates ten scenarios and rejects outside development. Preview client calls real fixture gateway and actual RefinementFlow. This is why fixture behavior is retained at consumer keepers, not deleted as fake production. `package.json:72` includes the Stage2 Playwright spec in the development journey command.

Native CI: `.github/workflows/ci.yml:158–160` runs top-level Node and nested Personal Plan runner; `scripts/ci/run-personal-plan-nested.mjs` recursively includes nested *.test.ts(x). Journey job at247 invokes package development browser command. Use native Node command below for proposed cuts; no browser sites are changed. Existing Playwright cohort remains13 declarations, including real geometry/cookie/keyboard/recovery assertions.

## Read limits

Fully read direct owners: refinement/{types,question-path,heat-events,session,gateway,fixture-gateway,http-gateway,module-scope,answer-provenance,module-status,assumed-defaults,stage1-adapter,production-persistence-gateway}; persistence/{stage2-refinement-service,stage2-refinement-supabase,stage2-optional-entry}; products/stage2-entry-adapter; both Stage2 PATCH/GET and completion POST route files; plan-start/page; refinement-flow and refinement-question components; optional-prefill and module-completion migrations; complete shared PGlite helper and COMPLETE_V3_PLAN_ENVELOPE. Preview page/client read with last completeAnswers tail previously read fixture-equivalent; no browser execution.

Plan-start-flow read for actual Stage2 helpers, HTTP gateway construction, handoff, back/exit and JSX bindings (145–328,675–690,887–1040,1145–1300), not all1550 lines. Canonical QA doc and CI/package relevant sections read; other docs were navigation only. Foundation SQL read relevant table constraints and full-completion function; other prerequisite migrations identified by harness but not fully reread. Actual PGlite query interface/types inspected; no new Postgres concurrency/JWT/dependency guarantee. Full Stage1 recommendation engine, optional-entry legacy mapper internals, journey options component and unrelated Stage3/medical logic not fully reread in this lane. No cut relies on those uninspected implementations. Existing18 question-wrapper cases are included as distinct input policy; wrappers not used outside tests can be cleaned at zero quota only after exact consumer rewrite, not deleted as18 contracts.

## Candidate contracts

### C1 — staged conditional C

Donor: `tests/personal-plan/persistence/stage2-refinement-service.test.ts:84` — Stage 2 service marks a saved answer's provenance as user

Keepers: `tests/personal-plan/persistence/stage2-refinement-service.test.ts:44` — Stage 2 service prunes server-side and persists the canonical next revision

**input:** Both fresh draft() inputs, user-1, same snapshotBuilder and persistence doubles; load then current_product_categories=[], expectedRevision0, persisted reply revision1. No input transfer required.

**actualFailure:** Real service may drop provenance while still saving answer/revision. Donor currently catches that; keeper lacks it until transfer.

**transfer:** Append exact saved.answerProvenance deepEqual {current_product_categories:"user"} to44. Preserve answer[] and revision1 assertions.

**callers:** PATCH stage-2 route→production persistence gateway→createStage2RefinementService.saveAnswer→applyUserAnswerProvenance→Supabase RPC payload.

**history:** e6eb60fd 2026-08-27 introduced per-answer provenance/module backend. This is live progress identity, not obsolete.

**cleanup:** Delete donor callback only. No unused import/helper unlocked; no production deletion.

**risk:** Transfer observes outgoing persistence payload, not committed DB; actual SQL provenance coverage remains separate.

**focusedValidation:** node --import ./tests/server-only-register.cjs --import tsx --test tests/personal-plan/persistence/stage2-refinement-service.test.ts

Controls: S2-C1-save-provenance-dropped

### C2 — staged conditional C

Donor: `tests/personal-plan-stage2-fixture-gateway.test.ts:284` — completeModule emulates an applied recompute outcome for habits, never for products

Keepers: `tests/personal-plan-stage2-module-entry.test.tsx:299` — the fixture gateway completes one module and delegates the closing one

**input:** Both use relevantCategories[], irritated=false, bridge=ineligible; fresh revision0; categories[]→weekly_2x→products completion at2; no_towel→drying[]→tools[]→night[]→habits completion at6. Keeper adds two rejecting calls which source proves return before state mutation.

**actualFailure:** Supported actual Labs fixture omits habits applied outcome or invents products recompute. Existing keeper already covers all donor statuses but not these fields.

**transfer:** At existing productsDone assert property absence with "recompute" in productsDone===false; at habitsDone assert exact {outcome:"applied"}.

**callers:** dev-only /labs/personal-plan-stage-2→Stage2PreviewClient→createPreviewGateway→createStage2FixtureGateway→actual RefinementFlow; canonical docs/local-qa-access.md69 and package journey lane explicitly use this supported route.

**history:** 4029faf0 2026-09-01 added both donor tests for honest update toast following actual habits recompute. Preserve that operator simulation contract; fixture is not retired.

**cleanup:** Delete callback and orphan comment for deleted pair when C3 also cut. No production/support removal.

**risk:** Asserts operator emulation, not actual production recompute. Closing/nonclosing branch distinctions must remain.

**focusedValidation:** node --import ./tests/server-only-register.cjs --import tsx --test tests/personal-plan-stage2-fixture-gateway.test.ts tests/personal-plan-stage2-module-entry.test.tsx

Controls: S2-C2-products-recompute-invented, S2-C2-closing-recompute-dropped

### C3 — staged conditional C

Donor: `tests/personal-plan-stage2-fixture-gateway.test.ts:326` — completeModule emulates an applied recompute outcome for a NON-closing habits completion too

Keepers: `tests/personal-plan-stage2-module-entry.test.tsx:950` — Modul 2 (habits) completing NON-closing hands back to the host — origin-independent

**input:** Identical neutral context; habits-only answers no_towel/drying[]/additionalHeatTools[]/night[]; same four completed IDs and revision4. Products unanswered. Keeper additionally loads and sends scoped session plus full host session through actual applyStage2ModuleCompletion with postAcceptModuleEntry=true.

**actualFailure:** Nonclosing fixture or actual UI dispatcher can drop applied recompute while status/handoff remain valid.

**transfer:** Assert exact habits.recorded.handedBack[0].moduleCompletion.recompute=={outcome:"applied"} after real dispatcher. Existing in_progress/noStage3/full-host/event assertions preserved.

**callers:** Same supported Labs caller as C2; actual PlanStartCustomerJourney passes onModuleComplete to RefinementFlow and reads payload.moduleCompletion.recompute?.outcome for moduleCompletionRoutineHref.

**history:** 4029faf0 2026-09-01 explicitly added habits-first nonclosing fixture outcome to support truthful toast.

**cleanup:** Delete callback only plus C2 shared orphan comment. No fixture/function deletion.

**risk:** No React hook/browser event proof claimed; dispatcher is actual runtime-used function with injected notification effects.

**focusedValidation:** node --import ./tests/server-only-register.cjs --import tsx --test tests/personal-plan-stage2-fixture-gateway.test.ts tests/personal-plan-stage2-module-entry.test.tsx

Controls: S2-C3-nonclosing-recompute-dropped, S2-C3-host-recompute-dropped

### C4 — staged conditional C

Donor: `tests/personal-plan-api-stage2.test.ts:561` — Stage 2 legacy completeAfterSave never runs the recompute lane

Keepers: `tests/personal-plan-api-stage2.test.ts:210` — Stage 2 final save reuses one authorized gateway for durable save and completion

**input:** Same admitted owner-1, neutral initial session, saved revision1; identical PATCH night_protection[], expectedRevision0, completeAfterSave:true. Only fixture opaque return ID differs (refined-legacy vs refined-1); route branches never inspect that string. Keeper retains exact opaque pass-through oracle and adds no-recompute.

**actualFailure:** Legacy fused completion accidentally invokes habits recompute despite returning unchanged JSON; donor catches extra dependency call.

**transfer:** Add counted runHabitsRecompute returning null to existing deps; assert count0 alongside exact [save,complete:1] call sequence and full response.

**callers:** Actual createHttpStage2RefinementGateway.saveAnswerAndComplete→PATCH route legacy branch. RefinementFlow and product-kind correction still use full close; legacy label is not retirement.

**history:** 4029faf0 2026-09-01 added explicit exclusion of full legacy completion from new habits recompute; keeper existed before that feature.

**cleanup:** Delete donor only; preserve all gateway/deps support and imports.

**risk:** JSON opaque ID difference carries no policy distinction. Keep products-module no-recompute as separate branch.

**focusedValidation:** node --import ./tests/server-only-register.cjs --import tsx --test tests/personal-plan-api-stage2.test.ts

Controls: S2-C4-legacy-unwanted-recompute

### C5 — staged conditional C

Donor: `tests/personal-plan/persistence/stage2-module-completion.test.ts:531` — a recorded projection is not replayed once the draft closed or its source moved

Keepers: `tests/personal-plan-complete-stage2-module-migration.test.ts:213` — a closed draft (status <> in_progress) maps to revision_conflict, never a silent success; `tests/personal-plan-complete-stage2-module-migration.test.ts:233` — stale_source is checked BEFORE the replay short-circuit: a moved Stage-1 source always reloads

**input:** Donor starts products [] +daily_1x, user provenance on both IDs, revision2; one service completion sets fake lineage, then directly calls local fake persistence after status complete and after source moves. Transfer retains real SQL keeper stale/no-projection rev0 input, then seeds same products answers/provenance+revision2 in actual SQL row; executes real module RPC products/2/schema1/computation test/hash a×64/{} snapshots, closes with result_refined_need_version_id=actual returned ID, and replays same SQL. Existing SQL233 already records then moves initial source before retry; its revision0 remains unchanged.

**actualFailure:** Donor asserted guard order, counts and lineage are all implemented in createModuleRefinementDb, so it cannot fail if production SQL removes the closed replay guard. Actual SQL must reject recorded closed projection and preserve lineage/version count.

**transfer:** SQL213 adds recorded-revision2/complete case and exact {outcome:revision_conflict,currentRevision:2}; verifies stored projection actual ID/revision2/handofftrue, exactly one refined version and byte-equivalent JSON lineage before/after replay. SQL233 adds actual stored products.needVersionId==first.refinedNeedVersionId after moved-source rejection; existing stale_source and versions1 retained.

**callers:** Route→real service.completeModule→createSupabaseStage2RefinementPersistence.completeModule→personal_plan_complete_stage2_module. Same row lineage read by adapter/mapDraft and module1-stage3-resume route loader.

**history:** e6eb60fd 2026-08-27 introduced mock and actual migration suite. Old mock header says live verification deferred, but actual local PGlite suite exists in same history; this does not justify preserving mock-owned SQL proof.

**cleanup:** Delete whole donor callback only. Local fake remains for12 other actual-service scenarios; do not delete fake branches needed by retained service replay/error tests.

**risk:** Complete-row fixture must set a nonnull result ID to satisfy foundation CHECK at65; driver does. This seeds closed state rather than proving full-completion lifecycle. PGlite is single-connection: no lock-concurrency/PostgREST JWT claim. SQL validity and runtime result remain unexecuted pending main.

**focusedValidation:** node --import ./tests/server-only-register.cjs --import tsx --test tests/personal-plan/persistence/stage2-module-completion.test.ts tests/personal-plan-complete-stage2-module-migration.test.ts

Controls: S2-C5-closed-projection-replayed, S2-C5-moved-source-replayed, S2-C5-conflict-corrupts-lineage

### C6 — separate conditional C, NOT staged

Donor: `tests/personal-plan/persistence/stage2-module-completion.test.ts:376` — module completion records the projection lineage and the Modul-1 handoff marker

Keepers: `tests/personal-plan/persistence/stage2-module-completion.test.ts:252` — module completion projects a new refined version from user answers ∪ assumptions; `tests/personal-plan-complete-stage2-module-migration.test.ts:68` — happy path: lineage written, draft stays in_progress, plan head advances, previous Stage-3 draft staled, source change enqueued; `tests/personal-plan-complete-stage2-module-migration.test.ts:213` — a closed draft (status <> in_progress) maps to revision_conflict, never a silent success

**input:** Actual service setup is exactly products[]/daily_1x, two user IDs, revision2 as service252 (its extra old productDraft cannot affect projection). Donor only checks fake row.products={resultID,2,true}, then calls fake loadOrCreate directly to read true/in_progress. With C5 transfer, real SQL213 already creates/reads exact nonzero-revision2 products lineage; existing SQL68 reads open status, same module marker and revision-preservation from database.

**actualFailure:** This callback can catch service failing to invoke persistence or returning wrong version, already caught by252. Changing production SQL/mapDraft/loadExisting cannot affect its fake row/read assertions. A behavior-preserving fake removal should not require product retention.

**transfer:** No further assertion needed after C5 transfer. Keep service252 result.module/status/handoff/nextHref/version and snapshot input assertions; keep SQL68 real open state/head/outbox and SQL213 exact revision2 lineage. Full callback attached in machine evidence; no driver change proposed here.

**callers:** Real service and SQL remain live; fake toPersisted/loadOrCreate has only local test callers. This does not declare whole service or its SQL obsolete.

**history:** e6eb60fd introduced fake lineage tests alongside module backend; real migration keeper provides runtime storage ownership. Existing source header is historical context, not a current retention requirement.

**cleanup:** One callback only; no source/import/support deletion. Outside five-C driver pending main decision.

**risk:** Conditional on C5 transfer retained and real SQL controls passing. SQL213 also uses current row/source UUIDs rather than fake string IDs, correctly satisfying real FK constraints. No load adapter coverage is lost because donor never executed it.

**focusedValidation:** node --import ./tests/server-only-register.cjs --import tsx --test tests/personal-plan/persistence/stage2-module-completion.test.ts tests/personal-plan-complete-stage2-module-migration.test.ts

Controls: S2-C5-conflict-corrupts-lineage

## False proof repairs, no deletion credit

F sites are retained: API111 title claims gateway avoidance but only save avoidance observed; service44 says pruning on fresh empty input (actual pruning remains168); module-completion252 has useful real snapshot/result assertions plus mock-owned DB claims; module migration325 says NULL but passes nonexistent UUIDs; question-path-modules106 builds exact heat expectations with the same ID helper; Stage3 adapter88 never asserts its promised Oil role tier. No F repair is bundled into the requested five-C edit driver.

For Oil88, add literal target deepEqual `{category:"oil",roles:["dry_finish"],roleTargets:[{role:"dry_finish",tier:"optional",weight:"light",functionalBenefits:[]}]}` and retain coverage equality. A real stage2-entry-adapter role-target omission/tier rewrite must fail; no fixture mutation substitutes for that control. For question path106, independent expected IDs are `heat:ordinary_blow_dry`, `heat:diffuser_airflow_shaping`, `heat:straightener`; keep module order/membership assertions. NULL plan/draft needs literal null call if claiming null; current missing UUIDs must stay covered.

## Static guard / validation plan

From the exact task root:

```sh
node /tmp/test-audit-stage2-delivery-edit.cjs check
node --import ./tests/server-only-register.cjs --import tsx --test tests/personal-plan/persistence/stage2-refinement-service.test.ts tests/personal-plan-stage2-fixture-gateway.test.ts tests/personal-plan-api-stage2.test.ts tests/personal-plan/persistence/stage2-module-completion.test.ts tests/personal-plan-stage2-module-entry.test.tsx tests/personal-plan-complete-stage2-module-migration.test.ts
```

Main only: run baseline before transfer; then `...edit.cjs transfer`, same native command, nine controls serialized, byte restoration and same keeper GREEN for each, then `...edit.cjs cut`, same native command. Confirm163→158 using AST inventory and unchanged other callbacks. Broader native/c8 gate and <=2pp campaign threshold remain main-owned and mandatory. No Vitest wrapper is applicable to this repository’s Node/PGlite test surface. No browser invocation is needed for these five cuts; existing browser evidence is preserved but not newly validated.

Control restoration template: snapshot exact source bytes+SHA; require control.sourceSha256/current unique anchor; write just one real owner fault, execute exact retained keeper with native --test-name-pattern; capture intended assertion rather than syntax/setup error; finally restore original bytes and verify SHA even on failure, then restore-green. SQL mutations require actual migration reapplication in isolated PGlite; never an existing DB or remote provider.

## Complete declaration ledger

### tests/personal-plan-stage2-module-entry.test.tsx

| Line | Verdict | Declaration | Specific fault / limit |
|---:|:---:|---|---|
| 107 | R | the refine param carries a module and keeps plain refine=1 as the first open module | Query parser must preserve products/habits/first_open and reject unknown/array alternatives; changing refine=1 to unscoped breaks an external URL contract. |
| 128 | R | a scoped path keeps only its own module's questions in canonical order | Scoped conditional path must preserve canonical order and full stored completion while hiding the other module; truncating the completed set loses host state. |
| 179 | R | the entry module resolves products first and first_open always lands on a module | First-open resolution must select products before habits and fall back to products when all complete; returning null would re-enter the linear flow. |
| 202 | R | module entry resumes question-exact and never re-bridges a consumed handoff | Entry must resume the exact open question and keep explicit complete entries in question mode; bridge selection can replay a consumed handoff. |
| 299 | R | the fixture gateway completes one module and delegates the closing one | Fixture sequential products-first→habits-close result, CAS/incomplete errors, handoff markers and load state; retained primary for C2 recompute assertions. |
| 358 | R | the fixture gateway fuses the final module answer with its completion | Fused final answer must save then complete the requested module at the resulting revision; completing against the submitted revision causes conflict. |
| 379 | R | a module-scoped flow renders only its own module's questions | Actual RefinementFlow SSR must display module-specific heading/question and omit other module/chapter copy for products and habits. |
| 414 | R | plan-start turns a module deep link into a module-scoped Stage-2 entry | Actual plan-start resolver must honor both requested modules under explicit route admission; treating request as generic stage entry loses scope. |
| 455 | R | the accept escape hatch opens the products module with no chapter screen and no 5-stage bar | Failed-accept products escape hatch must render a question without invitation/five-stage chrome, and retain unaccepted origin despite explicit scope. |
| 523 | R | `?refine=1` behaves like an explicit entry into the first open module | first_open complete-draft pure entry semantics; retain as different explicit helper fixture from the longer accepted runtime journey, without claiming route/browser proof. |
| 548 | R | an explicit module deep link opens the module even on a complete direct-accept draft | Completed direct-accept session with explicit products/habits must reopen the requested module rather than reusing stored bridge; unscoped completed state remains bridge. |
| 588 | R | a module deep link renders the module's first question for a completed draft | Actual SSR completed-draft module entry must render first question while legacy unscoped complete draft remains bridge; consumer can misuse otherwise-correct scope helper. |
| 620 | R | a module-scoped session never leaves the flow | Host session selector must choose full unscoped state, including null fallback; a scoped path must not escape to Stage3. |
| 630 | R | leaving an explicit module entry returns to the Routine, not the Idealplan | Explicit entry exit matrix includes products/habits/first_open vs undefined and stage1/stage3 origin; dropping scope on reload changes destination. |
| 664 | R | Task 2.6: a habits-first module completion signals the toast only for an explicit module entry | Actual module-completion href helper preserves toast only for explicit accepted origin; path/query signal is a public arrival contract. |
| 715 | R | Task 2.2: the toast is claimed only when the server actually recomputed the routine | Recompute outcomes applied/unchanged/unavailable/absent distinguish truthful toast; explicit origin alone is insufficient. |
| 738 | R | Task 2.6: a Stage-3 completion signals the toast only when it followed an explicit module entry | Stage3 completion retains destination and appends update signal only for explicit accepted module journey, including existing URL query handling. |
| 812 | R | stage2ModuleCompletionRoutingProps threads the post-accept origin signal the host hands to RefinementFlow | Routing props must carry both module scope and accepted origin across Stage2 and reloaded Stage3; this is not browser proof but distinct origin matrix. |
| 877 | R | Modul 1 (products) completing NON-closing always bridges into Stage 3 | Products nonclosing must show Stage3 bridge and emit module/bridge events, never close or hand back; direct returned fixture carries real result into actual dispatcher. |
| 908 | R | Modul 1 (products) completing as the CLOSING module (habits-first order) is unaffected by origin — exactly today's completed-session path, never handed back | Products closing must show completed session for both accepted and unaccepted origin; origin-sensitive habits routing must not leak into products. |
| 950 | R | Modul 2 (habits) completing NON-closing hands back to the host — origin-independent | Habits nonclosing must hand full session back with only module event; retained primary for C3 recompute outcome at dispatcher output. |
| 999 | R | Modul 2 (habits) completing as the CLOSING module on a POST-ACCEPT run hands back to the host, not the bridge | Habits closing accepted origin must hand back full complete session and emit completed event without bridge; status alone must not route it. |
| 1041 | R | Modul 2 (habits) completing as the CLOSING module WITHOUT an accepted plan keeps the bridge (unaccepted-cohort exception) | Habits closing without accepted plan must retain Stage3 bridge, avoiding a routine redirect loop before activation. |
| 1082 | R | module questions carry the banner's coarse meter, verbatim from the server value | SSR module meter must use server supplied counts verbatim rather than derive assumed answers as completed; distinct server value intentionally differs from client path. |
| 1121 | R | an explicit module entry opens its first open question, never the resume chapter | Explicit module entry with partial progress must open exact question without resume shell; default linear entry remains separately meaningful. |
| 1157 | R | the bridge auto-handoff rule no longer implies a chapter presentation | Auto-handoff truth table must preserve explicit module continuation override and caller opt-out for linear flow; presentation must remain question/bridge. |
| 1171 | R | plan-start carries the banner's progress into an explicit module entry only | Route resolver must forward server progress only for explicit module entries; loading or using it on ordinary entry changes optional flow semantics. |
| 1256 | R | the secondary exit leaves for /routine only once the plan is accepted | Exit destination must use activated plan signal, not explicit module or frontier alone; unaccepted Stage2/Stage3 remains Stage1. |
| 1283 | R | the „Plan aktualisiert“ toast is never claimed for an initial activation | Initial activation must not claim an update toast even when reached by failed-accept module escape hatch; accepted origin distinguished from scope. |
| 1332 | R | a reloaded Modul-1 Stage-3 journey keeps its product scope when Back is pressed | Reloaded Stage3 products journey must retain product scope and origin when local stage switches Back; frozen initialJourney.stage must not discard refineModule. |
| 1347 | R | Back out of a reloaded Stage-3 module run renders the module's questions, not the resume shell | Actual SSR for reloaded Stage3 Back path must render product question, no resume shell; pure scope helper alone does not prove renderer consumption. |
| 1396 | R | the ?refine=1 direct-accept journey opens products and completes the edit end to end | Direct-accept refine=1 actual resolver→SSR→fixture save/complete journey includes revision recovery; retaining its fused save behavior is not redundant with pure entry state. |

### tests/personal-plan-api-stage2.test.ts

| Line | Verdict | Declaration | Specific fault / limit |
|---:|:---:|---|---|
| 84 | R | Stage 2 API preserves feature/auth boundaries and no-store responses | Feature disabled, anonymous and admitted GET must retain exact HTTP status and no-store responses. |
| 96 | R | Stage 2 fails closed before constructing its gateway when Stage 1 is not reached | Stage1 access denial must occur before gateway construction; merely refusing gateway.load would still create unauthorized persistence seam. |
| 111 | F | Stage 2 save rejects malformed JSON and unexpected body fields before reaching the gateway | F: request rejects malformed JSON and unexpected fields before save; test only counts save calls, while run constructs gateway before parsing, so title overclaims construction avoidance. |
| 141 | R | Stage 2 save applies release and auth boundaries before parsing caller input | Release/auth decisions must precede parsing hostile request input; malformed JSON must not mask 404/401 boundary. |
| 157 | R | Stage 2 save derives the owner server-side and maps validation, conflict and temporary failures | Owner comes from authenticated identity, with distinct invalid/question/conflict/temporary codes and HTTP mappings; caller owner must never be trusted. |
| 210 | R | Stage 2 final save reuses one authorized gateway for durable save and completion | Real PATCH must save before completing at returned revision, preserve session+handoff JSON and avoid recompute; C4 keeper. |
| 246 | R | Stage 2 module save completes exactly the requested module on the same gateway | Module PATCH uses requested module and same authorized gateway; literal saved revision rather than caller revision must reach completion. |
| 293 | R | Stage 2 module save rejects an unknown module and a doubled completion request | Unknown module and simultaneous full/module flags must reject without save; schema interaction not interchangeable with ordinary bad fields. |
| 327 | R | Stage 2 module save reports a durable saved page when the module completion fails | Module failure after durable save must expose savedSession alongside typed failure, allowing client completion-only retry. |
| 358 | R | Stage 2 module save fails closed on a gateway that cannot project a module | Module request on gateway lacking completeModule must fail closed with durable savedSession; legacy gateway compatibility branch. |
| 385 | R | Stage 2 save without a completion flag stays a plain save for existing clients | No completion flag must remain plain save response for existing clients; accidental completion would change their state. |
| 421 | R | Stage 2 final save reports a durable saved page when completion fails | Full completion failure after durable save must expose savedSession; separate route branch from module completion. |
| 452 | R | Stage 2 habits module completion (non-closing) runs the recompute lane and reports its outcome | Nonclosing habits calls recompute with owner/version and attaches result; products behavior does not cover this dispatch. |
| 487 | R | Stage 2 habits module completion (closing, status complete) also runs the recompute lane | Closing habits still calls recompute despite status complete; an early-return-on-complete regression is unique. |
| 522 | R | Stage 2 products module completion never runs the recompute lane | Products module must never call recompute; distinct module branch from legacy full completion. |
| 561 | C C4 | Stage 2 legacy completeAfterSave never runs the recompute lane | C4: identical night_protection[] expectedRevision0 completeAfterSave:true path to line210; move zero recompute calls into that existing stronger ordering/response keeper. |
| 595 | R | Stage 2 habits module completion omits the recompute field entirely when there is no active routine | No active routine returns null and omits recompute property entirely; absent field differs from unchanged/unavailable. |
| 625 | R | Stage 2 habits module completion isolates a throwing recompute lane behind a 200 with outcome unavailable | Throwing recompute must not turn a durable module success into HTTP failure; only unavailable outcome reaches client. |
| 658 | R | Stage 2 habits module completion reports an unavailable orchestrator result without leaking its reason or retryability | Explicit unavailable orchestrator result must hide reason/retryability from response; logs may retain diagnostics. |
| 692 | R | Stage 2 habits recompute lane reports transition timing and a structured log line | Timing event and structured server log must identify habits operation/outcome without losing completion response; observability contract. |
| 746 | R | Stage 2 completion is a separate strict POST with owner-derived success, conflict and temporary failure outcomes | Separate completion POST schema/owner/status/error matrix remains live through HTTP retry path; not duplicated by fused PATCH. |

### tests/personal-plan-stage2-refinement.spec.ts

| Line | Verdict | Declaration | Specific fault / limit |
|---:|:---:|---|---|
| 101 | R | ready completes the neutral journey only after saving and exposes an opaque bridge | Real browser neutral keyboard journey must save every page before opaque bridge and preserve revision/ID marker; SSR cannot prove dispatch/focus. |
| 136 | R | keeps every wet-wash label centered on its marker across mobile and desktop widths | Wet-wash label geometry and keyboard interaction across375/390/430/1280 widths; DOM coordinates independent of source classes. |
| 164 | R | conditional journey keeps ordered heat events separate and never renders a result | Conditional browser path must keep source-specific heat pages ordered and qualifying protection required; no recommendation result rendered prematurely. |
| 201 | R | save failure retains the local choice and retry advances | Save failure must retain local selected answer and retry it rather than advance or clear it. |
| 217 | R | complete failure preserves the saved revision and retries completion directly | Completion failure must retain saved revision and retry completion without saving same answer again. |
| 236 | R | revision conflict reloads canonical progress instead of retaining stale local selection | CAS conflict must reload canonical later progress and discard stale local selection instead of overwriting it. |
| 257 | R | resume and completed fixtures preserve their canonical entry points | Resume and completed fixture entry must land on canonical open question versus stored bridge and allow edit/back behavior. |
| 280 | R | mobile dock portals cleanly without horizontal overflow; tablet and desktop do not | Mobile dock portals without overflow at375, while768/1280 remain nonportal; real computed geometry/DOM required. |
| 342 | R | mobile dock offsets the cookie banner without prior consent and keeps Continue clickable | Cookie banner without prior consent must remain above dock and Continue clickable; cookie-aware offset lifecycle is not plain viewport layout. |
| 411 | R | a module entry walks only its own module and finishes it | Habits-only real browser run must exclude product questions, leave first question appropriately and return completion marker to host. |
| 443 | R | a module 1 entry hands the finished module into Stage 3 | Products-only browser completion must expose actual bridge/opaque ID without walking habits. |
| 465 | R | a module deep link opens the module on a completed direct-accept draft | Explicit completed-draft module link must open products while ordinary complete preview preserves bridge. |
| 484 | R | unknown preview scenarios return 404 | Unknown Labs scenario must return404; supported operator route validates scenario rather than arbitrary fixture dispatch. |

### tests/personal-plan/persistence/stage2-module-completion.test.ts

| Line | Verdict | Declaration | Specific fault / limit |
|---:|:---:|---|---|
| 252 | F | module completion projects a new refined version from user answers ∪ assumptions | F subset: real service snapshot projection retains daily user answer and assumed gentle towel/air-dry while result stays in_progress. Fake head/outbox/product-staling assertions do not prove SQL; keep projection oracle and narrow commentary. |
| 299 | R | products-first completion keeps assumption-only heat use unresolved | Actual snapshot must not resolve assumption-only heat into protectant need; selected owned heat with unconfirmed habit differs from explicitly answered heat. |
| 343 | R | products-first completion without owned heat protection preserves non-heat decisions | Known-empty owned categories must preserve non-heat decisions and not invent owned heat routes; independent input from heat-owned case. |
| 376 | C C6 | module completion records the projection lineage and the Modul-1 handoff marker | C6 conditional: callback only reads local fake lineage/loadOrCreate after same actual service setup as252; real SQL68 and new SQL213 own exact open/recorded revision2 lineage. |
| 401 | R | habits-first module completion writes a version without a Stage-3 handoff marker | Habits-first snapshot preserves rough-rubbing behavior, defaults missing products and returns no Stage3 handoff; distinct partial-module projection. |
| 431 | R | a module whose questions are not all user-answered is rejected and writes nothing | Incomplete requested products module must reject before any persistence write; no later SQL guard knows question completeness. |
| 449 | R | an assumed answer never counts as the user having completed the module | All answers present but assumed provenance must not qualify as user-complete module; answer presence alone is not completion. |
| 470 | R | replaying the same module completion returns the first result without a second version | Service must map persistence already_projected replay into stable module result without extra write; real cached service behavior separate from SQL replay implementation. |
| 490 | R | a lost revision race maps to a typed revision conflict and writes nothing | Lost revision race maps persistence revision_conflict into typed reloadable error; sequential mock injects boundary outcome rather than proving database locking. |
| 508 | R | a moved Stage-1 source maps to a reloadable conflict and writes nothing | Moved source maps persistence stale_source into reloadable conflict; transport mapping distinct from SQL guard order. |
| 531 | C C5 | a recorded projection is not replayed once the draft closed or its source moved | C5: asserted closed/moved outcomes are local fake calls; move recorded+closed state to SQL213 and lineage retention to SQL233 before removing. |
| 568 | R | completing the second module closes the draft exactly like today's full completion | Service must delegate second complete module to full completion, preserve actual computed hash and close result; module RPC itself cannot infer question completeness. |
| 598 | R | a rejected module id fails before any persistence call | Invalid module must fail before either persistence method; prevents invalid key access/write. |

### tests/personal-plan-stage2-fixture-gateway.test.ts

| Line | Verdict | Declaration | Specific fault / limit |
|---:|:---:|---|---|
| 43 | R | loads detached canonical snapshots and resumes at the first unresolved question | Fixture load must detach answers/trigger arrays so operator UI mutation cannot rewrite canonical saved state. |
| 56 | R | saves full answers in order, including a completed empty multi-select | Save empty selected array must be a completed answer and advance revision/path in order; unanswered is not empty. |
| 78 | R | rejects invalid and out-of-order answers without mutating state | Invalid/out-of-order saves reject without mutation; fixture must model recovery honestly for browser harness. |
| 101 | R | editing a completed parent prunes stale conditional answers and completions | Editing completed parent categories must prune stale conditional children/completion; direct save order differs from initial canonicalization. |
| 139 | R | one-shot save failure retries safely and a stale client reloads external progress | One-shot failure retries once and stale client sees external revision; actual supported fixture failure injection contract. |
| 166 | R | completion rejects an unresolved path and repeats one deterministic opaque handoff | Incomplete completion rejects; completed path returns deterministic opaque handoff and replay remains stable. |
| 207 | R | a completed fixture loads with a detached canonical handoff | Completed fixture load detaches canonical handoff so mutation cannot change future loads. |
| 230 | R | one-shot completion failure preserves progress and retries truthfully | One-shot complete failure preserves saved progress and next completion succeeds without extra answer writes. |
| 270 | R | production construction fails closed | Fixture construction must be unavailable in production both explicit runtime and NODE_ENV; operator support must not become public execution seam. |
| 284 | C C2 | completeModule emulates an applied recompute outcome for habits, never for products | C2: exact same products-first→habits-close sequence as module-entry299; transfer property absence and applied outcome. |
| 326 | C C3 | completeModule emulates an applied recompute outcome for a NON-closing habits completion too | C3: exact same habits-only seed rev4 as module-entry950; transfer applied outcome to actual dispatcher host payload. |

### tests/personal-plan-complete-stage2-module-migration.test.ts

| Line | Verdict | Declaration | Specific fault / limit |
|---:|:---:|---|---|
| 68 | R | happy path: lineage written, draft stays in_progress, plan head advances, previous Stage-3 draft staled, source change enqueued | Real SQL must persist products lineage, leave draft open/revision0, advance plan head/source revision, stale old product draft and enqueue exact source key. |
| 151 | R | replay at the same revision returns the first result without writing a second version | Real same-revision module retry must return first version without second insert/head advance; lost-response storage idempotence. |
| 189 | R | CAS mismatch on the draft revision maps to revision_conflict and writes nothing | Real mismatched revision must return conflict without writes; CAS differs from closed status and stale source. |
| 213 | R | a closed draft (status <> in_progress) maps to revision_conflict, never a silent success | Real closed status must conflict; retained C5 keeper adds recorded projection at revision2 before closure, alongside original stale/no-projection case. |
| 233 | R | stale_source is checked BEFORE the replay short-circuit: a moved Stage-1 source always reloads | Real moved initial source must win over recorded replay; existing same-revision retry and restored in_progress isolate guard order. C5 adds lineage unchanged oracle. |
| 291 | R | a NULL module id is rejected as invalid_source / invalid_module | SQL NULL module must fail explicitly rather than slip through SQL three-valued NOT IN semantics. |
| 308 | R | an unrecognized module id is rejected the same way as NULL | Unknown non-null module must reject with same public reason; distinct SQL null behavior retained. |
| 325 | F | a NULL plan or draft id (invalid source) is rejected before any other guard | F: title says NULL plan/draft but actual inputs are nonexistent UUIDs. Preserve those missing-row cases; rename accurately and optionally add literal null separately after review. |
| 352 | R | "the second (closing) module completion is a SERVICE-LEVEL delegation, not reachable inside this SQL " +     "function: completing 'habits' after 'products' via the RPC directly does not close the draft" | Direct module RPC must leave second habits completion open; real full-completion RPC separately closes. Service owns question completeness, SQL must not guess. |
| 427 | R | EXECUTE is granted only to service_role | Actual has_function_privilege and SET ROLE deny anon/authenticated and permit service_role; raw database grants not Supabase JWT/RLS integration. |

### tests/personal-plan-stage2-question-path-modules.test.ts

| Line | Verdict | Declaration | Specific fault / limit |
|---:|:---:|---|---|
| 36 | R | every base question on a minimal path maps to a module and both modules are present | Minimal canonical path assigns product questions before habits and both modules present; wrong base category mapping would mis-scope UI. |
| 59 | R | oil conditional question belongs to the products module | Oil branch must belong to products when oil selected; conditional assignment absent from neutral browser. |
| 71 | R | dry-shampoo conditional questions belong to the products module | Existing and bridge Dry Shampoo conditional questions belong to products; distinct branching inputs retain. |
| 84 | R | scalp conditional question belongs to the products module | Scalp detail conditional question belongs to products; mapping must not follow prose heading alone. |
| 95 | R | zero heat events: habits module has no derived heat ids, still includes night protection | No heat sources creates zero heat questions while retaining night protection; empty-list omission path. |
| 106 | F | multiple heat events: each derived heat id belongs to habits, in path order | F subset: module heat ordering/membership is real, but exact expected IDs come from owner helper. Replace expected IDs with independent heat: literals; no deletion credit. |
| 131 | R | module status is open while a current-path question is unanswered, complete once all are | Partial products questions leave products open and answered empty+does_not_wash completes only products; habits remains open. |
| 154 | R | an invalid marked-complete answer does not count toward module completion | Invalid marked-complete category cannot count toward module completion; membership filter must use validated completion. |
| 166 | R | totality: every canonical question id the path can produce has a module, and unmapped ids fail loudly | Every reachable canonical static/derived ID has module mapping and unknown ID throws; compiled question namespace is independently consumed by UI and telemetry. |

### tests/personal-plan-stage2-question-path.test.ts

| Line | Verdict | Declaration | Specific fault / limit |
|---:|:---:|---|---|
| 18 | R | unknown bridge eligibility suppresses and prunes stale bridge answers | Unknown bridge eligibility must omit/prune stale bridge answer rather than treating unknown as eligible or ineligible with retained facts. |
| 37 | R | Dry Shampoo branches distinguish existing use, accepted bridge, and decline | Existing dry-shampoo use, accepted optional bridge and declined bridge produce different question paths; all retained literals matter. |
| 70 | R | ineligible bridge omits both bridge pages while an irritated quiz requires clarification | Ineligible bridge removes both pages; irritated context still requires clarification independently. |
| 89 | R | conditional parent edits prune only stale descendants | Parent edits remove only unreachable oil/dry-shampoo/heat descendants and preserve still-reachable answers. |
| 127 | R | path inserts irritation, Oil and separately ordered heat questions without changing base order | Irritation/Oil/ordered separate heat events insert at canonical positions without changing base order. |
| 153 | R | completion distinguishes completed empty multi-select pages from unanswered and validates values | Completed empty arrays count, absent arrays do not; invalid vocabulary and missing compound parts keep path incomplete. |
| 193 | R | invalid, duplicate, and out-of-order arrays cannot count as completed | Unsupported duplicate and out-of-order arrays must not count as completed; validation intentionally rejects malformed persisted/client shapes. |
| 208 | R | a completed but invalid compound towel page remains unresolved and strips an orphan technique | Missing towel technique remains unresolved and orphan technique is stripped when material disappears/no_towel. |
| 233 | R | an invalid marked-complete answer is absent from both canonical completion lists | Invalid marked-complete answer must disappear from both top-level and nested completion lists; differing consumers must not read contradictory truth. |

### tests/personal-plan-stage1-stage2-adapter.test.ts

| Line | Verdict | Declaration | Specific fault / limit |
|---:|:---:|---|---|
| 74 | R | a real Stage 1 snapshot drives Stage 2 triggers and a refined Stage 1 recomputation | Real Stage1 output triggers conditional refinement, mapped answered facts and refined recomputation; includes exact heat IDs and category consequences. |
| 146 | R | refined towel technique projects only explicit rough rubbing as mechanical exposure | Only explicit rough_rubbing projects mechanical exposure; other towel techniques must not invent it. |
| 164 | R | completed current-product categories clear current-product-load deferrals | Explicit completed current categories clears unknown load deferrals; null/unknown and known-empty remain distinct. |
| 202 | R | current product categories stay inventory-routing facts instead of frequency load | Category ownership is inventory routing only, not frequency load; adding category must not fabricate reset demand. |
| 259 | R | the adapter rejects an incomplete refinement contract | Incomplete authoritative path cannot produce refined Stage1 snapshot. |
| 273 | R | an untriggered scalp detail stays an explicit unknown | Untriggered scalp detail remains explicit unknown even if stale answer supplied; no false confident cosmetic input. |
| 294 | R | an ineligible bridge, no wet washing and no heat remain explicit canonical facts | Ineligible bridge, does_not_wash and no heat map to explicit canonical absence rather than unknown. |
| 334 | R | an existing Dry Shampoo records an accepted bridge without asking the bridge question | Already-owned dry shampoo records accepted bridge without requiring the optional bridge question. |

### tests/personal-plan/persistence/stage2-refinement-service.test.ts

| Line | Verdict | Declaration | Specific fault / limit |
|---:|:---:|---|---|
| 44 | F | Stage 2 service prunes server-side and persists the canonical next revision | F title only: current [] save guards canonical payload and revision1 plus C1 provenance union; it contains no stale input that proves pruning. Dedicated168 remains primary pruning owner. |
| 84 | C C1 | Stage 2 service marks a saved answer's provenance as user | C1: same fresh draft, user1, [] save rev0 as44; exact persistence provenance assertion moves to44. |
| 121 | R | Stage 2 service flips an existing assumed answer to user when the user re-answers it | Existing assumed wet-wash answer must become user when changed, while other assumed provenance remains; distinct old-state transition. |
| 168 | R | Stage 2 service prunes provenance for ids a path change dropped from completion | Path-changing category edit must remove dry-shampoo answer provenance and retain only still-completed user entries. |
| 219 | R | Stage 2 service maps CAS loss to a typed reloadable revision conflict | Persistence CAS failure becomes typed revision_conflict and reloadable cache state; caller must not accept saved local revision. |
| 253 | R | Stage 2 service refuses completion before the authoritative path is complete | Full completion requires authoritative complete path; snapshot builder/persistence must not be invoked for unresolved input. |
| 281 | R | Stage 2 re-edit creates an in-progress successor without rewriting completed history | Re-edit complete draft must create in_progress successor and preserve completed historical version, answers and IDs. |
| 340 | R | Stage 2 completion recomputes the refined Need snapshot from the immutable initial input | Completion uses immutable initial input and actual recomputation output/hash; merely returning a stub snapshot would miss projection. |

### tests/personal-plan-stage2-stage3-adapter.test.ts

| Line | Verdict | Declaration | Specific fault / limit |
|---:|:---:|---|---|
| 39 | R | builds Stage 3 entry requirements and inventory prompts in refined rendered order | Refined rendered order determines Stage3 category requirements and inventory prompts; routing must not resort stage decisions arbitrarily. |
| 88 | F | authority snapshot preserves Oil role tier and exact Stage 1 coverage without recomputation | F: target.category assertion cannot prove advertised Oil dry_finish/optional/light role target retention. Add exact literal target object while preserving coverage assertion. |
| 124 | R | preserves refined rendered order and appends current-only inventory in canonical order | Current-only inventory appends in canonical order after rendered needs, without reordering authoritative needs. |
| 166 | R | admits owned deferred heat protection without inventing routes or other inventory decisions | Owned deferred heat protectant stays visible without inventing heat routes or extra inventory decisions; unknown qualification not omission. |
| 230 | R | preserves unknown current product load instead of encoding known-empty authority facts | Unknown current product load must remain unknown rather than known empty in signed authority facts. |
| 251 | R | preserves an explicitly known empty current product load | Explicit known-empty load must remain known empty rather than unknown; distinct signature/policy contract. |
| 276 | R | rejects an unrefined snapshot and blank opaque entry IDs | Unrefined source and blank opaque IDs must reject before constructing entry context. |

### tests/personal-plan/persistence/stage2-optional-entry.test.ts

| Line | Verdict | Declaration | Specific fault / limit |
|---:|:---:|---|---|
| 77 | R | buildOptionalStage2Seed overlays trusted legacy facts as user provenance and keeps inherited defaults assumed | Trusted legacy overlay becomes user provenance while inherited defaults stay assumed; plan progress must not overcount defaults. |
| 110 | R | buildOptionalStage2Seed consumes empty usable Stage2 mappings without converting a parent | Empty usable mapping must report nothing_usable and preserve parent without fabricated answers/provenance. |
| 128 | R | buildOptionalStage2Seed prunes a partial towel prefill from a parent that had complete assumed towel handling | Partial towel legacy prefill invalidates completed assumed towel instead of retaining misleading completion/provenance. |
| 149 | R | openOptionalRefinement sends a prepared overlay only for a fully assumed completed parent | Eligible fully-assumed completed parent maps real legacy data into prepared RPC request with owner, source, revision and seed receipt. |
| 225 | R | openOptionalRefinement lets an existing in-progress draft win without reading legacy rows | Current in_progress draft wins and legacy rows are never read; prevents old facts overwriting user edits. |
| 249 | R | openOptionalRefinement skips legacy reads for non-migration or unaccepted plans | Non-migration or unaccepted plans skip legacy read/overlay and retain fallback prepared request. |
| 291 | R | openOptionalRefinement skips overlay when the completed parent has any user provenance | Any user provenance in completed parent blocks overlay; partial assumptions must not overwrite real answers. |

### tests/personal-plan-stage2-heat-events.test.ts

| Line | Verdict | Declaration | Specific fault / limit |
|---:|:---:|---|---|
| 12 | R | heat events retain distinct source-keyed identities | Heat IDs preserve exact source identity, and selected-source list distinguishes same tool-family sources. |
| 20 | R | all sources have the approved event mapping and source-order projection | Actual projection preserves source order, tool/route mapping and qualifying protection across four-source combination; not full seven-source oracle. |
| 57 | R | every approved source retains its exact ID and mapping | All seven literal source mappings remain independently asserted; current four-source composed keeper cannot absorb remaining sources without new input. Ignore redundant expected-fixture echo only. |
| 119 | R | all protection consistency values are valid for a qualifying event | All approved protection consistency values accepted for qualifying event; no narrowing accepted stored vocabulary. |
| 131 | R | projection rejects missing protection and protection on ordinary airflow | Missing qualifying protection and extraneous ordinary-airflow protection reject distinctly, before projection. |

### tests/personal-plan-optional-stage2-prefill-migration.test.ts

| Line | Verdict | Declaration | Specific fault / limit |
|---:|:---:|---|---|
| 176 | R | optional Stage 2 RPC creates one seeded successor and records the receipt atomically | Real optional RPC writes single seeded successor plus one-time receipt; repeat does not rewrite user state or create another draft. |
| 239 | R | optional Stage 2 RPC skips existing user state and blocks unaccepted or wrong-owner plans | Real RPC rejects wrong owner and unaccepted/noneligible plans while preserving existing user state; eligibility stub limits paid-authority claim. |
| 305 | R | optional Stage 2 RPC grants execute only to service_role | Raw optional RPC execution grants remain service_role only; client roles cannot seed/refill stored answers. |

### tests/personal-plan-stage2-session.test.ts

| Line | Verdict | Declaration | Specific fault / limit |
|---:|:---:|---|---|
| 33 | R | creates a canonical session from Slice A and detaches snapshots | Canonical session clones trigger context/answer arrays so caller mutation does not change source snapshot; initial path must derive from facts. |
| 49 | R | canonicalizes stale conditional data in a resumed session | Resumed stale conditional data is pruned while supplied revision remains intact; load canonicalization is distinct from edit transition. |
| 68 | R | rejects status and handoff combinations that cannot be true | Complete without handoff and in_progress with handoff reject; mutually inconsistent durable/session status must not enter flow. |

### tests/personal-plan-stage2-gateway.test.ts

| Line | Verdict | Declaration | Specific fault / limit |
|---:|:---:|---|---|
| 6 | R | typed refinement errors expose stable recovery codes | Error instance exposes stable recovery code and message; client/server both branch on these protocol values. |
| 14 | R | production refinement failures share the frozen unavailable and snapshot codes | Unavailable/unsupported-version/too-large error codes stay constructible and distinguishable; lower enum constructor owner is not replaced by unrelated HTTP failures. |

### tests/personal-plan-stage2-refinement-types.test.ts

| Line | Verdict | Declaration | Specific fault / limit |
|---:|:---:|---|---|
| 16 | R | Stage 2 accepts exactly the approved current-product categories | Exact supported current-product category values are a persisted-answer vocabulary independent of helper spellings; accidental expansion/reorder changes UI/storage contract. |
| 31 | R | Stage 2 vocabulary arrays preserve the approved stable order | Literal approved option arrays preserve stable storage values and display order across wet wash, heat, oil, towel, night and symptom inputs; not an export-name inventory. |

