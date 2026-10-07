# Refinement status delivery37 — conditional seven-declaration layer plan

Propose **5 C + 2 D**, subject to main's preservation review and native/fault proof: exact five-file cohort **37 → 37 → 30**. No new test declaration, input, fixture, data row, table case, owner invocation, skip or schema call. The complete first-pass ledger retains30 sites and holds no F. Second-layer comparison identifies one repeated pure-response layer and two narrow duplicate subsets. No source/helper/export retirement follows: the shared owners serve live HTTP, Routine/PlanStart, completion, resume and proposal-accept paths.

## Accepted-input boundary, not matching titles

The status route calls actual `loadRefinementStatusForUser`, which calls actual `loadRefinementStatusSource` and `loadModuleBannerDismissals`, then the same `buildRefinementStatusResponse` tested directly. The tests fake only the Supabase query surface: eq/order/limit filter supplied rows, while real loaders derive trigger context, map lineage, compute user provenance, resolve assumptions/path, derive module states, validate schema and serialize public results. No fake returns the expected status/progress/banner or implements their policy.

The route snapshot `renderedOrder=[shampoo,conditioner]`, empty scalp concerns and empty decisions yields exactly the direct tests' `relevantCategories=[shampoo,conditioner]`, `hasReportedIrritatedScalp=false`, `dryShampooBridgeEligibility=ineligible`. A missing draft maps to empty answers/completed/provenance/projections. Empty dismissal rows yield a new empty Set equivalent by membership; the stored product dismissal yields Set(products). Row IDs/timestamps/query selectors are additional route-level assembly inputs and do not replace the model contract.

|Candidate|Donor / existing primary keeper|Exact assertion union / transfer|
|---|---|---|
|C1|Pure fresh plan at refinement-status.test.ts35 → route fresh at125|Ordered products/habits open,2/4,false handoff,visible products/undismissed banner already observed. Add `assert.ok(body.modules[0].openQuestionCount > 0, "fresh products module must expose open questions")`. Existing schema-validity assertion is owned by actual builder `.parse` plus route200, explained below.|
|C2|Pure partial at61 → route partial|Exact answers `{currentProductCategories:[shampoo]}`, one completed user ID, empty lineage/dismissals; product open,count1,2/4 already exact. No transfer needed.|
|C3|Pure products complete at80 → route products lineage|Both use the two product IDs as user and exact products projection; complete/open,3/4,true handoff,visible habits banner all already exact. Different frequency validity path is expressly bounded below. No transfer.|
|C4|Pure both complete at111 → route both complete|Same six IDs/user provenance, no_towel and empty drying/tools/night, both projections. Ordered complete/complete,4/4,true handoff,invisible/null/undismissed banner all already exact. Same frequency qualification. No transfer.|
|C5|Pure current-module dismissal at175 → route stored dismissal|Same empty model inputs plus Set(products). Hidden products/dismissed banner already exact; add product module statusopen observation on existing body.|
|D1|module-status untouched at90 → existing fully autoaccepted at44|Both yield userQuestionIds=[], then `selectStage2Answers(...,[])={}`; same context and fixed-point path. Existing wrapper true plus both statesopen subsumes lone true assertion. No transfer.|
|D2|presentation no-active at315 → existing no-matching-complete-draft at213|Both actual Routine loads receive same consumed active/pending-null plan fields and return activeVersionnull; current refined pointer is not consumed by that loader. Existing HTTP200 and routineProductsnull subsume both donor assertions. No transfer.|

`candidates.json` contains complete original bodies, all original assertions, full keeper before/after bodies, hashes and the narrow readset argument for each. No inputs were moved to another declaration. The seven primary keepers remain existing declarations; only two change. All other28 surviving callbacks remain byte-identical, including five unchanged keepers. Excluding every donor and keeper gives23 unrelated callbacks. The ten migration tests and SQL source are unchanged in all three phases.

## C1 schema acceptance is retained without a new schema call

The original direct test does `refinementStatusResponseSchema.safeParse(result).success` after `buildRefinementStatusResponse` has already called `refinementStatusResponseSchema.parse(...)`. Current schema is a structural object of literal enums/booleans/integer counts with no transformations or serialization-sensitive Date/undefined fields. Installed Zod parse/safeParse both run the same schema and differ by throw versus success/error result. A schema that rejects this fresh response makes the actual builder throw, the actual loader return unavailable, and the actual route return503 instead of its existing asserted200. NextResponse.json directly delegates Response.json and forwards the result; the route does not rebuild the response fields. Therefore the keeper's real successful request and literal body checks own the existing acceptance observation. Adding another `safeParse` call solely to reproduce a tautological assertion would add an invocation without independent proof, so none is proposed.

The C1-schema control changes real builder openQuestionCount to length+0.5. This is syntactically valid source but violates the real integer schema. Required intended failure is the existing first HTTP200 assertion receiving503. It does not claim validation is bypassed or simulate a fake schema failure. The separate C1-open-count control sets count0: schema still accepts it, so only the newly transferred positive-count observation catches that fault at its exact explanatory assertion.

## C3/C4: daily is invalid here; do not call this alias normalization

Direct models store `daily_1x`, included in PRODUCT_FREQUENCIES. Route fixtures store legacy `daily`; although vocabulary has a separate alias normalizer, this path does NOT call it. `resolveAssumedAnswers` retains the user-owned field, then `isStage2QuestionAnswerValid` rejects `daily`; the actual assumption rule replaces it with `weekly_2x` before fixed point. The direct model retains valid daily_1x. These different resolved answer values are not byte-equivalent.

The removed declarations assert only response state/progress/handoff/banner, never a resolved frequency, assumed-rule list, dose, validity result, or effective answer payload. Their asserted output reads:

1. original user question IDs/provenance, which are identical;
2. resolved ordered question IDs: `getOrderedQuestionIds` reads irritated scalp, dry-shampoo eligibility/category/bridge choice, oil category and drying/heat-tool selections; **it never reads wetWashFrequency**;
3. `getStage2ModulePathStates(ordered IDs, user IDs)`, not resolved answer validity;
4. exact same projection handoff and dismissal membership.

Consequently both cases produce the same complete/open or complete/complete states and exactly the same builder inputs from that boundary onward. A bug in completed-module counting, persisted handoff or banner selection is caught at the route. A bug rejecting the route's invalid field prematurely fails more strongly there. A frequency-specific projection/validation contract is outside these donors' assertions and remains in distinct typed/assumption/Stage2 tests; no change to those cases is proposed. Remaining pure banner-reappearance and module user-complete tests also retain valid-frequency paths; they are not counted as newly read supporting suites. Main should reject C3/C4 if it identifies a specific current donor-observed fault escaping this readset closure, rather than copying daily_1x into an added route call.

## D1/D2 limits

D1 does not retire provenance selection: explicit all-assumed, all-user, mixed products-user/habits-assumed and missing-provenance legacy cases remain. `stage2AssumptionsActive` is actually called by the proposal-service default dependency before clearing the legacy flag; its separate boolean result must not be replaced by route progress assertions. Only the duplicate empty-user-set result is removed. Both inputs pass a truthy empty array into `resolveAssumedAnswers`; it selects no answer keys from either object, producing exactly{} before any answer/path rule. The retained all-assumed case is stronger because it also catches accidentally counting synthetic completion as user completion.

D2 does not retire presentation loading or pointer authority. The retained keeper has a nonmatching stale completed draft and current refined pointer, while donor has null pointer/no draft. In both, answer presentation is null and routine active/pending pointers are null. `loadOwnerRoutinePlan` selects id/revisions/active/pending; `loadPersonalPlanRoutineView` never reads current_refined_need_version_id. It takes the same no-active path and returns personal_plan_incomplete/activeVersionnull. The route's same final inactive ternary returns null. The extra answer query is an assembly difference, but donor asserts neither absence of query nor draft-read behavior; its whole200/null output subset remains. Pointer matching, included active products, stale authority repair and auth remain separate retained tests.

## Held false positives / current risks

- Do not consolidate banner reappearance: dismissed products while habits is next open is a distinct Set-membership contract missing from current route inputs.
- Do not consolidate assumed-only model with empty route fixture: nonempty supplied assumed IDs can be incorrectly counted as user progress; a fresh empty fixture alone misses that fault.
- Retain all ten real migration replays. Conditional versus absent optional defaults, cleared flag versus flagged evidence, successor borrowing evidence, per-answer heat attribution, empty map, old5/new6 arities, prune/preserve/no-invention and malformed provenance each assert a distinct SQL/storage state. Inputs constructed by the production default builder are deliberately compared against independently written migration SQL, not a mock-owned receipt. Historical deploy-window overloads remain and current source uses6; neither fact alone retires compatibility.
- No provenance or progress policy repair is bundled. Status logic retains original completed user IDs even when a malformed stored answer is re-assumed; this is current implementation behavior, not a new endorsement or a claimed bug fix. Route fixture bytes remain unchanged.
- Auth/no-store/404/503 and draft priority stay. Route mocks are deterministic query substitutes, not real database/RLS/concurrency proof. SQL tests execute PGlite only when main runs them; schema fixture is not a production schema or two-session race proof.
- No F was proven in this bounded pass. Missing stronger assertions elsewhere are not automatically F or deletion opportunities. No baseline failure was run or removed by this worker.

## Conditional actual-owner proof

`controls.json` provides13 isolated, source-hashed, uniquely scoped, syntactically parsed descriptors with exact expected values and transfer/cut keeper assertion lines:

- fresh positive count, schema integer acceptance, module order and base progress;
- partial remaining count;
- products handoff and next-open habits;
- both-module progress and no-open undismissed banner;
- stored dismissal and dismissal-not-completion;
- wrapper assumptions result;
- no-active presentation null result.

Every prospective mutation changes production source in memory only during authoring; nothing was applied. Main must execute serially with clean exact selected1 → intended `ERR_ASSERTION` at FIRST keeper frame/operator/decoded expected values or explicit message → byte-exact restoration → clean exact selected1. No timeout, import/setup error, generic503 except the declared schema acceptance control, unrelated assertion or fake-owned source may count. The13 controls are proposed mechanisms, not claimed evidence. No local SQL source faults are needed for this packet because no migration declaration/source is removed.

Main's native command is in `commands.json` and must run whole five-file cohort before/transfer/cut. Only two added assertions are applied first with all donors present; one has explicit assert.ok message to avoid Node22 source-inspection ambiguity. Then main reviews/runs controls before any cut. CI/campaign/global coverage remain root gates; no new operator driver has been authorized or supplied.

## Exact artifacts, source guards and read depth

All15 full snapshots are parsed; original selected navigation hashes match current five files. `manifest.json` pins47 exact test/source/support/dependency/config files, never shared Git config or a new metadata exception. Hashing dependencies is not semantic read credit. `survivors.json` proves28 byte-identical surviving callback statements and identifies both changed keepers. `transfer.diff` is two assertion additions; `complete.diff` additionally removes seven declarations and only two now-unused type/schema import entries from pure model file. All fixture/helper declarations remain; shared NO_DISMISSALS, dismissals, trigger and remaining types are still needed by two retained model callbacks. No source/test bytes were written in the repository.

Complete and sliced read scopes, current caller chain, dependency inspection, CI and bounded history are in `complete-ledger.md`. Existing dismiss8, Stage2 delivery/UI/persistence/optional migrations and broader routine/SQL suites receive zero new declaration credit from supporting owner reads. This packet does not claim all transitive source, SDK, schema or historical issues were audited.
