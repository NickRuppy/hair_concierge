# Refinement status delivery37 — complete bounded ledger

**30 R / 0 F / 5 conditional C / 2 conditional D.** All37 callback/import/helper/table bodies in the exact five-file scope were read. This is a single complete semantic pass followed by comparison against existing actual-owner boundaries. Seven candidate declarations are not applied credit; proposed37→37→30. Source retirement: none.

Canonical candidate bodies, exact assertion lists, existing keeper before/after bodies, operative equivalence and declared limits are in `candidates.json`; full15 phase files are in `snapshots`. Unchanged28 surviving callbacks include five existing unchanged keepers; excluding all seven donor/keeper pairs gives23 unrelated callbacks. Only two keeper bodies change. No held F was identified; none is silently repaired.

## tests/personal-plan/refinement/module-status.test.ts

### R — a fully auto-accepted draft leaves both modules open and assumptions active

Original line44; full declaration SHA256 `954c9646b451e08f3b856d97c9bb17d093b190fbb70ca48c92a2e0b842a80148`.

Explicit assumed provenance leaves both modules open and wrapper true. A regression counting all completed synthetic IDs as user IDs makes both complete and wrapper false. Retained primary keeper for D1; default generation itself is not the oracle under test.

Owner/evidence: module-status.ts38–60 -> answer-provenance.ts:userAnsweredQuestionIds -> assumed-defaults.ts:selectStage2Answers/question-path.

### R — a draft the user answered end to end has no open module and no assumptions

Original line59; full declaration SHA256 `61be81a72e8be16b546578e9c7b9f9b93728c7ed68cb58fc36f476ec3b332583`.

Both explicit user modules must be complete and assumptions boolean false. Inverting the live wrapper or hardcoding true passes all open-draft cases but fails here. The HTTP progress builder does not call stage2AssumptionsActive; keep its separate proposal-accept contract.

Owner/evidence: module-status.ts58–60; routine/proposal-service.ts322–330.

### R — one user-answered module keeps assumptions active while the other stays open

Original line74; full declaration SHA256 `a716d0a951b04c6ccb2b6d51ba1bea14b83e853cc20aeb94a66c8dbdc8edb8ac`.

Products user/habits assumed: complete/open split, nonempty habit open IDs, and true assumptions. Replacing some with every in the wrapper or counting assumed habits as answered fails; all-open and all-complete cases cannot protect this asymmetric truth-table cell.

Owner/evidence: module-status.ts38–60; question-path.ts:getStage2ModulePathStates.

### D — an untouched draft runs on assumptions

Original line90; full declaration SHA256 `446fbaf5b301bf457e7da79f5b0113bbb1e22c8b03ac1272777971be732e4d35`.

stage2AssumptionsActive(input) true already exact on same post-selection input. Untouched [] user IDs and fully defaulted all-assumed IDs both reduce to userAnsweredQuestionIds=[]; selectStage2Answers(...,[])={} regardless stored answers. Same context, fixed point and status; wrapper boolsame. Retained autoaccepted keeper also asserts both module statuses.

Owner/evidence: Untouched assumptions boolean duplicate.

Primary keeper: `tests/personal-plan/refinement/module-status.test.ts` — **a fully auto-accepted draft leaves both modules open and assumptions active**. See D1 complete union; no new input/call.

### R — legacy answers without a provenance entry count as user answers

Original line101; full declaration SHA256 `daa57298a459de44f446c4b37ea6b9a04b43f2a99f8ef7942e5b7ff16fa9b3ff`.

Missing provenance entries on completed legacy IDs default to user, so assumptions false. Replacing provenance[id] ?? user with assumed downgrades old persisted progress. Explicit-user sibling does not protect this fallback.

Owner/evidence: answer-provenance.ts:userAnsweredQuestionIds; module-status.ts38–60.

## tests/personal-plan/refinement/refinement-status.test.ts

### C — a fresh plan with no draft: both modules open, progress 2/4, banner points at products

Original line35; full declaration SHA256 `a5a07b72e0b3d1db9b7b8fa1673601f5da82460272aacf9cb016a0e22afd0a10`.

Two ordered open module pairs; products open count >0; progress2/4; handofffalse; visible products banner; valid response schema. Only open count observation is new. Same derived trigger context; draft null maps to {},[],{},{} and empty dismissal Set. Exactly equal builder arguments. Schema parse already inside builder; successful200 plus public literals owns acceptance, no extra schema invocation.

Owner/evidence: Fresh model -> existing actual HTTP fresh plan.

Primary keeper: `tests/personal-plan-refinement-status-route.test.ts` — **fresh plan with no refinement draft: both modules open, progress 2/4**. See C1 complete union; no new input/call.

### C — partial products answers: products stays open with the correct open-question count

Original line61; full declaration SHA256 `8eff4ac7acb31e68b21ca44d5e653e08b9759b557ba0e81492eb6a1814c666ba`.

products statusopen, openQuestionCount1, progress2/4 already exact. Exact same trigger, currentProductCategories shampoo, completed current_product_categories user, no projections/dismissals. Fake query returns row; real source loader, provenance/path/build/schema execute.

Owner/evidence: Partial model -> existing actual HTTP partial draft.

Primary keeper: `tests/personal-plan-refinement-status-route.test.ts` — **partial products user-answers: products open with the correct open-question count**. See C2 complete union; no new input/call.

### C — products module complete via lineage: 3/4 and the handoff marker is surfaced

Original line80; full declaration SHA256 `18c6041d890beef7b701be673f6bb981c4e49c43674fd3684050706369908e30`.

productscomplete, habitsopen, progress3/4, handofftrue, visible habits banner already exact. daily_1x donor valid; daily route invalid and re-assumed weekly_2x. Frequency never affects getOrderedQuestionIds; user IDs/provenance, product categories, context and projection are identical. Returned states depend on ordered IDs plus user set, not resolved frequency. No validity/answer output asserted by donor.

Owner/evidence: Products complete model -> actual HTTP lineage result.

Primary keeper: `tests/personal-plan-refinement-status-route.test.ts` — **products module complete via lineage: 3/4 and the handoff marker is set**. See C3 complete union; no new input/call.

### C — both modules complete: 4/4, no open module left, banner not visible

Original line111; full declaration SHA256 `a68dfc7e59b871674a49ad17d604e20f3931e22d88ddac498f92c8491f7aedba`.

ordered two complete states, progress4/4, handofftrue, invisible/null/undismissed banner already exact. Same six user IDs/provenance, no_towel, empty drying/tools/night, categories, context and projections. Only daily_1x vs daily differs; same frequency validity repair caveat as C3; ordered path and completion sets identical.

Owner/evidence: Both complete model -> actual HTTP complete draft.

Primary keeper: `tests/personal-plan-refinement-status-route.test.ts` — **both modules complete: 4/4**. See C4 complete union; no new input/call.

### R — assumed-only answers (no user provenance) count as open, matching direct-accept semantics

Original line153; full declaration SHA256 `fd185e9489a647273d69719d6071d45d702a746e06db2d849731c4aaf9985cd5`.

Assumed product IDs must yield open products and2/4 after the actual builder. The fresh route has no completed IDs and cannot itself expose a filter that counts supplied assumed IDs as user. Keep this builder-facing provenance gate; module tests do not directly own public progress math.

Owner/evidence: answer-provenance.ts:userAnsweredQuestionIds; module-status.ts38–52; refinement-status.ts63–99.

### C — banner: dismissing the current open module hides it without affecting the module list

Original line175; full declaration SHA256 `2fdf1dbe087dc9368a3a5fc4e0af5f76092b2093bf9e230a83c73f9986965651`.

hidden products banner dismissedtrue already asserted; transfer products stillopen assertion. Same empty draft inputs and derived context; real lifecycle load maps existing user/kind/product mark into exact dismissedModules Set(products). Time inert in repository read.

Owner/evidence: Dismissed model -> actual HTTP stored dismissal.

Primary keeper: `tests/personal-plan-refinement-status-route.test.ts` — **banner reflects a stored dismissal for the current open module**. See C5 complete union; no new input/call.

### R — banner reappears once a different module becomes the next open one, even if the old dismissal is still stored

Original line191; full declaration SHA256 `39de1e6bfaed70dba0dc630165caa43e1d8719d188d6f72d1282af94156be096`.

Stored products dismissal must not hide the newly open habits banner. A global any-dismissal check instead of membership for nextOpenModule suppresses this transition; existing route dismissal tests cover only the current products module. Input/Set must not be changed or new route call added to manufacture removal.

Owner/evidence: refinement-status.ts79–98; lifecycle/repository.ts:isModuleBannerDismissed.

## tests/personal-plan-refinement-answer-provenance-migration.test.ts

### R — the provenance backfill labels a synthetic draft on a CLEARED-flag plan 'assumed'

Original line122; full declaration SHA256 `ac97ab0e7fa7bf6672d029896d6233294a7dce4a3c00c42837718716c5f0f078`.

Real migration sees a cleared plan flag plus synthetic conditional draft; explicit scalp/bridge IDs must be labelled assumed along with base IDs. A flag-only cohort predicate loses all labels; omitting optional per-question CASE branches loses explicit conditional defaults. PGlite executes actual SQL on fixture schema.

Owner/evidence: migration:UPDATE backfill cohort OR EXISTS and per-ID CASE.

### R — the provenance backfill still labels a synthetic draft on a flagged plan 'assumed'

Original line144; full declaration SHA256 `2062a017d350abddae5db9127caccd8c38693e73e8554d51815ad81c64c468e8`.

Flagged plain draft labels every default assumed. A regression removing plan.unrefined_direct_accept from evidence can be caught by flagged/mixed sibling; this case also pins all plain default per-ID labels directly. No one stronger existing keeper establishes this complete flagged payload union without new query.

Owner/evidence: migration:plan.unrefined_direct_accept OR EXISTS; default per-ID CASE.

### R — the provenance backfill leaves a plan without direct-acceptance evidence entirely 'user'

Original line161; full declaration SHA256 `8a6eb39983e2bbab670a42a9a479e29e62f1049b600a40d616a666954ca49bc7`.

No direct-acceptance evidence means all completed IDs remain user even if some values equal assumptions. A universal default-value heuristic without evidence gate changes these legitimate user labels. Input contains heat and nondefault values, but all-user outcome is the independent cohort boundary.

Owner/evidence: migration:WHEN evidence.direct_accepted AND... THEN assumed ELSE user.

### R — the provenance backfill splits a reopened, partially refined draft per answer

Original line194; full declaration SHA256 `9c27f30229c2b96c4df9e20251b3bfee95de78de3adbc4944b5fb9ba3f905a6b`.

Reopened successor borrows cohort evidence from another completed synthetic draft while classifying each current answer independently; wet frequency/drying/heat changed by user remain user and copied defaults assumed. Same-draft-only evidence or whole-draft labelling fails this exact SQL result.

Owner/evidence: migration:synthetic.personal_plan_id = d.personal_plan_id; per-ID CASE.

### R — the provenance backfill keeps an assumed-valued heat event 'assumed' inside the cohort

Original line233; full declaration SHA256 `32539b0e6d2940c38a3f0de8b41e6909315d03979c6657eb3796a9258fdc900c`.

A selected straightener event with exact default frequency/protection remains assumed inside flagged cohort while the selected tool itself is user. Treating every heat:* ID as user or ignoring protection default fails. Plain default drafts have no heat event IDs.

Owner/evidence: migration:WHEN q.question_id LIKE heat:% branch.

### R — the provenance backfill errs to 'assumed' for a draft indistinguishable from the defaults

Original line261; full declaration SHA256 `9af0515063111b63c9980d0ccebdf38d73d60a0b0d1c42e194bf04711d13e47e`.

Unflagged plain fully default-valued draft must choose conservative assumed labels. Retain explicit missing scalp/bridge/heat keys on the synthetic signature: COALESCE allows absent optional defaults. Conditional cleared case supplies two optional fields; reopened case observes a different successor projection and not this entire row. No new SELECT/row used to manufacture union.

Owner/evidence: migration:OR EXISTS default signature COALESCE optional fields.

### R — the provenance backfill writes an empty map for a draft with no completed answers

Original line282; full declaration SHA256 `bf139a8ad9ab043081f032335fcb39992541142796db6f9aa74d1ea0d859bf07`.

No completed IDs produces {} rather than null, regardless flagged cohort. Removing outer COALESCE of jsonb_object_agg violates empty-map/default contract. Other tests have nonempty completed arrays.

Owner/evidence: migration:SET answer_provenance = COALESCE(backfill.provenance, {}::jsonb).

### R — the save RPC keeps a 5-argument compatibility overload for the migrate-then-deploy window

Original line299; full declaration SHA256 `f54573670a785439c56da5b1f6a270ed87640ffdd1075fbabbd430668c601ed7`.

Real pg_proc signatures5+6 remain callable across migrate-before-deploy; legacy save revision1 creates no invented provenance, current save revision2 writes explicit user. Removing old overload or wrong delegation/revision behavior fails. Current TS source using6 is not evidence old deployment compatibility is obsolete.

Owner/evidence: migration:both CREATE OR REPLACE personal_plan_save_refinement_draft overloads.

### R — the 5-argument compatibility overload preserves backfilled provenance instead of wiping it

Original line356; full declaration SHA256 `e5c4272d99f1b18153973cb5f648b1d0ce75e3d3ecd7322f3398497e78b0b12d`.

Legacy5arg save carries exact surviving backfilled map, prunes dropped night ID, invents no new oil label, preserves user/assumed labels. Delegating with{} or failing entry.key = ANY filter fails actual SQL readback; current6arg replacement semantics differ.

Owner/evidence: migration:5arg COALESCE(jsonb_object_agg...entry.key=ANY...), delegating6arg CAS.

### R — the 6-argument save RPC still rejects a non-object provenance payload

Original line409; full declaration SHA256 `216f2c8429d1900ec5aa56c51aadac74e5fb958c8eeefab056138b9564244425`.

Valid answers{}, valid seeded owner/draft/revision, but provenance[] must return invalid_source/invalid_answer_provenance. Wrong/nonexistent-answer guard is not causing this rejection; removing object validation reaches an attempted invalid persistence operation, not the expected structured rejection.

Owner/evidence: migration:6arg jsonb_typeof(p_answer_provenance) <> object.

## tests/personal-plan-refinement-presentation-route.test.ts

### R — returns the refinement answers bound to the current refined need version

Original line162; full declaration SHA256 `38dfe8c28b9288bf587b8aa8ea00d422e4166401b8966ab0aec5c532bbd404ad`.

Actual route must read complete answers bound to current refined pointer even when stale draft has newer timestamp; preserves towel/night/completed IDs,200/no-store and no active routine=null. Dropping exact pointer equality returns stale towel and fails. This cannot be replaced by newest-row sorting.

Owner/evidence: presentation route:loadCompletedDraft; load-view.ts actual no-active branch.

### R — returns null answers when no complete draft matches the pointer

Original line213; full declaration SHA256 `f105c2ebabac5c1c3d97bc3a98e94f3af89a1800bd4d45e4ef9a23d5a9e550ea`.

Mismatched complete draft yields answersnull/completed[] and routineProductsnull under200. Removing result_refined_need_version_id filter leaks stale answers. Retained primary D2 keeper also protects same actual no-active result projection.

Owner/evidence: presentation route:loadCompletedDraft and GET; routine/load-view.ts.

### R — returns included routine products of the active version

Original line266; full declaration SHA256 `6440e834318e18a8365c67104d386471291ea5746e7fe41b38c5edc9a04dddf1`.

Actual validated active Routine with matching source category order yields two owned/planned summaries with independent German name/category/purpose literals and excludes pending_review. Removing kind filtering or authority linkage changes observed output. Fake tables do not manufacture labels/list; route/load-view produce them.

Owner/evidence: presentation route:routineProductSummary/GET; routine/load-view.ts; routine/repository.ts owner reads.

### D — routineProducts is null without an active routine

Original line315; full declaration SHA256 `d94cbe8d916ce8aa660cbe50d178b3c6f83a2ba93ba4474ada06b3c4a193ab5d`.

status200 and routineProductsnull already literal assertions. Both existing route calls have active_routine_version_id=null and pendingproposal=null, equal plan revision/source revision/ID/user. Current refined pointer differs but is never read by loadPersonalPlanRoutineView; completed draft lookup yields null in keeper. Both return answersnull and view.activeVersionnull. Extra discarded stale draft row cannot affect routine list.

Owner/evidence: No-active presentation subset duplicate.

Primary keeper: `tests/personal-plan-refinement-presentation-route.test.ts` — **returns null answers when no complete draft matches the pointer**. See D2 complete union; no new input/call.

### R — routineProducts is null when the active routine is authority_repair_required

Original line340; full declaration SHA256 `9c3939f6582fce3e42e409fdacf849cfb9f83a06bf065fe6832006b3fcc418e2`.

Missing immutable refined source makes active view authority_repair_required; route must expose routineProductsnull instead of stale frozen items. Same no-active null output has different authority branch; retain.

Owner/evidence: routine/load-view.ts:hasMatchingSourceCategoryOrder/repairRequiredView; presentation GET.

### R — refinement presentation API rejects unauthenticated reads

Original line377; full declaration SHA256 `040bde3ba09c84a9565b9a711d95693d9fc9c14fcb9ba77d1b1beb4d130a5537`.

Unauthenticated presentation GET returns401 before client construction (fixture throws if attempted). This guards separate route ownership, not repeated status-route auth.

Owner/evidence: presentation route:createRefinementPresentationRouteHandlers GET.

## tests/personal-plan-refinement-status-route.test.ts

### R — fresh plan with no refinement draft: both modules open, progress 2/4

Original line118; full declaration SHA256 `bad81e5552ef7653a71b1712db928cefe5526ca580c095de6a1a0db2d71d0288`.

Canonical fresh HTTP keeper: real plan/source/draft/lifecycle reads plus derive/builder/schema and JSON delivery produce ordered open modules,2/4,false handoff,visible products banner,200/no-store. Transfer adds products open count >0; schema exception becomes503 and is caught by200. Query fake only filters supplied rows.

Owner/evidence: refinement-status route GET -> loader -> source/derive/map -> builder/module/schema.

### R — partial products user-answers: products open with the correct open-question count

Original line139; full declaration SHA256 `f1454bc0bd680f377be7ca39d9b0f2affeb1b42b0652f98c2583c2aa243eec32`.

Canonical partial HTTP keeper pins real loaded one completed user ID, remaining products count1/open and2/4. Incrementing count or counting a partial module complete fails. Keep auth/loader/model assembly at strongest existing boundary.

Owner/evidence: same chain; question-path.ts:getStage2ModulePathStates.

### R — products module complete via lineage: 3/4 and the handoff marker is set

Original line165; full declaration SHA256 `974961a1b80cd15af0e79c4db7195db243b9e0e483f3fad7cf40e1fac6997f58`.

Canonical products-complete HTTP keeper pins products complete/habits open,3/4,persisted true handoff and habits banner. Discarding mapModuleProjections stage3Handoff, reversing module completion, or selecting first module unconditionally fails. daily is intentionally not rewritten by this proposal.

Owner/evidence: same chain; mapModuleProjections; exact daily validity caveat in plan.

### R — both modules complete: 4/4

Original line197; full declaration SHA256 `3586d769766ff39e1819555a96a17c0364f2b328097d001ec07483f68793c0b2`.

Canonical both-complete HTTP keeper pins two complete states,4/4,true handoff and invisible/null/undismissed banner. Clamping completedModuleCount to1 or treating no next module as dismissed fails.

Owner/evidence: same chain; exact daily validity caveat in plan.

### R — banner reflects a stored dismissal for the current open module

Original line245; full declaration SHA256 `80cf00d350bd46e98ea7546aff853d52e91aa7cf238e0c1a0b587127e141787e`.

Canonical stored-dismissal HTTP keeper loads exact user/kind/products record into Set and returns hidden/dismissed products banner. Transfer pins product module stays open; changing dismissal into completion would otherwise escape this keeper.

Owner/evidence: loader -> lifecycle/repository.ts loadModuleBannerDismissals -> builder.

### R — in_progress draft wins over a completed draft on the same initial need version

Original line264; full declaration SHA256 `8c1b48a99e7060aa30b88fd7b3c5bf0313702af0a00de0bb8b15e49b77d42408`.

Two persisted drafts: in_progress wins over complete on same source. Reading complete first or dropping status filter returns completed progress4/4 instead of2/4. Fixture recency favors in_progress, so not a complete proof against every combined-query ordering rewrite, but current distinct source/status gate is meaningful.

Owner/evidence: refinement-status-read.ts:loadCurrentDraft.

### R — initial need version with neither a Stage-1 lead nor a prepared-artifact source degrades to 503

Original line312; full declaration SHA256 `96e5a8a516fd741dfb82084baeed6484dd9dec684ad5658efe2b7b9de95710c7`.

Need row with neither prepared artifact nor Stage1 source must become503. Treating legacy source-less row as a valid empty source returns200. Distinct from nonexistent plan404/auth401; preserve.

Owner/evidence: refinement-status-read.ts:loadInitialNeedSnapshot -> loader catch -> route503.

### R — no personal plan: typed 404

Original line323; full declaration SHA256 `c5240d71349596ee1b4cc0f6373c1cb35e571c0b9585e5ecdce3d1608d77b776`.

No owner plan returns404 with exact no_personal_plan error body. Throwing unavailable or returning empty status misclassifies actual missing plan.

Owner/evidence: source loadPlan -> loader discriminant -> route404.

### R — rejects unauthenticated reads

Original line331; full declaration SHA256 `e83fb008cfb6e5f003b045a42f52aaec13988d3f875a7662c65db9a746fbe199`.

Unauthenticated status GET returns401. Removing auth gate yields no-plan404 on this fixture; route-level auth remains an independent contract from presentation route. Fixture does not separately prove zero query calls, and no stronger ordering claim is made.

Owner/evidence: status route GET.

## Read limits

Read completely: all five owned tests; refinement status builder/loader/source loader, module-status, answer-provenance, assumed-defaults, direct-acceptance defaults, question-path, stage1-adapter, types, heat-events, module1-stage3-resume, lifecycle repository, routine load-view, vocabulary frequencies/onboarding-care, both HTTP route owners, and the complete provenance migration.

Read as supporting slices only: stage2-refinement-supabase1–140,150–212,235–287 (source/load/reopen/save/projection mapping); stage2-refinement-service282–330 (completion/module gate); routine repository1–138 (owner plan/version/pending/refined reads); proposal-service285–336 (accept/assumption call); direct-acceptance accept370–435 (synthetic defaults/provenance save); Routine page110–157; PlanStart332–370; Profile620–705; feinschliff-einstieg plan1–98. These are not new whole-file test or service audit credits.

Dependency evidence: installed Zod4.4.3 parse/safeParse core1–57 and classic method bindings; NextResponse.json94–97 delegates Response.json and forwards body/status/headers; PGlite exported types and query/exec documentation785–850 establish actual SQL engine APIs, not a stub. No dependency engine internals or deployed database/RLS equivalence was exhaustively audited. TypeScript parser read for static snapshots only; hash-only parser/config/lock guards do not imply semantic read.

CI: root3 tests route through package.json:test:node/.github/workflows/ci.yml158; nested2 are discovered by the fully read scripts/ci/run-personal-plan-nested.mjs and ci.yml160. Focused native command in commands.json handles all5. No test was run by this agent.

History: scoped git log identifies e6eb60fd modular backend for model/status/module/provenance and4bdda99a profile presentation for its distinct owner. Current default bindings, Profile fetches, Routine banner and PlanStart progress prove ongoing delivery; age/dark-plan wording is not retirement evidence. Existing dismiss8, Stage2 UI/persistence/optional migrations and broader journey ledgers are excluded from new count. No remote history lookup or runtime/DB access.
