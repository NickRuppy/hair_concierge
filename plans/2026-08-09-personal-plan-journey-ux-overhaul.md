# Personal Plan launch-candidate hardening

Status: implementation, local readiness verification, and the final whole-branch review were completed and reconciled on 2026-08-09. The earlier audit mockup was approved with two corrections and its implementation remains task-owned worktree dirt. Nick reviewed the hardened mockup and complete designed journey and confirmed: “Works. Let's go. Let's go. Implement it.” Publication and production actions remain unperformed.

## 1. Outcome and source context

The internal-only Personal Plan becomes a fast, direct, and truthful journey: the quiz asks recurrence where it is relevant, Stage 1 and Stage 2 hand off without click-only interstitials, Stage 3 evaluates every exact product against the correct refined user context without crashing on valid multi-row catalog facts, authenticated confirmation-link replays recover idempotently, and saving/loading feedback reflects real backend work.

This plan integrates three sources of authority:

1. the 2026-08-09 UX audit at `/Users/nick/AI_work/hair_conscierge/ux-audits/2026-08-09-personal-plan-journey/report.md` (the summary says 23 findings but the body contains 24); its complete 24-item implementation ledger is inlined in this plan so the branch does not depend on that root-checkout-only artifact;
2. Nick's approved rendered overhaul and two corrections: no redundant `Deine Produkte sind vorbereitet` page, and a pending product's purpose stays on its product card rather than a duplicate gap section;
3. the post-audit hardened package received on 2026-08-09 covering Bondbuilder, direct handoffs, recurrence, grouped current-product semantics, the Stage 3 multi-row loader, auth replay, performance, atomic Stage 3 actions, copy, and multiplicity;
4. the PR #345 counterpart prerequisite received on 2026-08-09: standalone Heat has no suitable-thickness axis, and Heat runtime selection—not catalog insertion or UUID order—owns deterministic choice among truthful candidates.

Current implementation state matters: the dirty launch-candidate worktree already contains the earlier UX overhaul. Implementation must adjust those changes deliberately, never reset or clean them, and must not absorb PR #345 catalog writes.

Planning contract:

- **Outcome:** the approved visual overhaul plus the hardened package operate as one coherent launch candidate.
- **Constraints:** preserve Bedarf → Verfeinerung → Produkte → Routine → Anwendung; passive owner-scoped `/plan-start` reads; exact-product multiplicity; revision CAS; pending/unassigned/planned/mismatching products as non-executable; atomic Stage 4 completion; internal-only rollout.
- **Non-goals:** catalog data or write integration from PR #345, new catalog writes, migrations, production data or flags, deployment, merge, subscription changes, or a made-up two-product limit. Heat runtime validation and selection are in scope because they are prerequisites for handing PR #345 a safe runtime.
- **Done when:** every requirement below has a red-capable guard, the rendered slow/error/back/resume states match the reviewed mockup, performance targets are measured on seeded local data, the complete internal journey passes, and no publication or production action has occurred.

## 2. Chosen direction

### 2.1 Keep the approved UX overhaul

- Keep the persistent non-clickable five-stage header, coral primary actions, plum navigation/focus, semantic status chips, image-led cards, cookie clearance, safe Back behavior, Stage 2 carry-forward, grouped clear-fit confirmation, explicit exception decisions, and direct Stage 3 → Routine completion.
- Keep both annotated corrections: no Stage 3 handoff summary page; no duplicate purpose/gap box beside a pending product.
- Continue to track all 24 audit-body findings. Do not reopen the rejected Stage 2 heat-question merge; heat is explicitly owned elsewhere.

### 2.2 Bondbuilder: roughness corroborates but never qualifies alone

- `rough_surface` becomes supporting/corroborating evidence, not a strong Bondbuilder indicator.
- Natural hair with rough surface but no `breakage`, `hair_damage`, elasticity failure (`snaps`), or chemical stress resolves to `not_needed`.
- A rough surface may still corroborate a qualifying independent signal, such as breakage; it cannot create the optional route alone or count as one of two strong indicators.
- Update both signed category artifacts deliberately: `docs/personal-plan/categories/bondbuilder/decision.md` owns the product-policy threshold and `evidence.md` records the evidence boundary without presenting the policy as externally calibrated.
- Add an exact Lea regression fixture representing natural, untreated, rough-surface hair with no qualifying damage signal. Assert `not_needed`, no Bondbuilder Stage 1 card, and no chemically-stressed presentation copy.
- Make Stage 1 Bondbuilder presentation reason-aware. Chemical copy is allowed only when the decision contains a chemical-treatment reason; observed-damage routes use neutral structural-care wording.

### 2.3 Direct momentum through Stage 1 and Stage 2

- The final Stage 1 Basis/Optional CTA starts the first unresolved Stage 2 question. Remove the click-only Stage 1 transition screen.
- A newly created Stage 2 session skips the invitation screen on the normal Stage 1 path. Partial-session resume may retain a concise resume state because it communicates recovered progress rather than asking for a ceremonial click.
- Stage 2 completion automatically starts Stage 3 preparation. Show a loading bridge only while a real Stage 3 bootstrap request is pending. On success, replace it immediately with the first product screen.
- Handoff failure shows retry plus a safe Back route to the last Stage 2 question. Previously saved answers remain canonical.
- Returning from Stage 3 reopens the completed refinement at its last relevant question without immediately auto-bouncing back.

### 2.4 Put recurrence beside the concern it qualifies

- In the Personal Plan quiz, place `admission_recurrence` immediately after `current_problems` and before `analysis_bridge`, hair-profile follow-ups, and scalp questions.
- If no current hair concern is selected, skip recurrence and continue to `analysis_bridge`.
- Move the conditional branch itself: `current_problems` becomes the concern/no-concern fork; recurrence continues to `analysis_bridge`; and the old `admission_recurrence` conflict fork is deleted.
- Re-anchor the later admission tail explicitly at `scalp_concerns`: after scalp concerns, route to `admission_conflict` when `derivePersonalPlanConflictPrompt(answers)` is true and otherwise to `admission_practical_cost`. This preserves the conditional conflict question after recurrence moves out of that tail.
- Keep `admission_recurrence` in the same visible progress section as `current_problems` (`goals_and_context`) after the move. The section stepper must not jump forward to `analysis` for one question and then backward again.
- Preserve history-stack Back behavior, saved draft/server-draft parsing, resume at recurrence, exact concern binding, and pruning when the selected concern changes or disappears.
- Conflict, practical-cost, and emotional-relevance questions remain reachable in their existing later admission order; add a red reachability guard for a conflict-eligible profile.

### 2.5 “Keine weiteren” is group-local

- On Stage 2 `current_product_categories`, the relevant/primary group remains untouched when the secondary-group empty action is chosen.
- Rename the secondary action to `Keine weiteren` and describe it as clearing only `Weitere unterstützte Kategorien`.
- Implement it through the existing grouped merge helper with an empty secondary selection, never `onLocalAnswerChange([])`.
- Do not impose a maximum. A rendered selection of at least three categories must remain valid and visible.

### 2.6 Resolve Stage 3 catalog facts from all applicable rows

The deployed P0 is a valid multi-row `product_shampoo_specs` result passed through `maybeSingle()`. It is not evidence that multiple owned products are invalid.

The local production schema establishes the bug-class boundary deliberately:

- `product_shampoo_specs` and `product_conditioner_specs` have composite primary keys and legitimately allow several rows per `product_id`. Conditioner already uses a plural read; Shampoo is the only category call site that must change from `one()` to `many()`.
- `product_leave_in_specs`, `product_heat_protectant_specs`, `product_oil_specs`, `product_mask_specs`, `product_scalp_care_specs`, `product_dry_shampoo_specs`, `product_bondbuilder_specs`, and `product_deep_cleansing_shampoo_specs` have `product_id` as their primary key and are schema-guaranteed zero-or-one per product. Their use of `maybeSingle()` is intentional and receives a schema-contract test rather than speculative multi-row logic.
- `product_oil_eligibility` is the separate plural relation and must continue to use `many()`. The requested Oil plurality guard protects this relation; `product_oil_specs` remains a single-row fact by schema.

This matches Supabase's current `maybeSingle()` contract: the query must produce zero or one row; legitimate plural relations must not be truncated with `.limit(1)` merely to silence the error.

- Load the current refined snapshot once for each Stage 3 evaluation request and pass the same immutable context through every subject evaluation. Existing active drafts resume without rewriting their stored payload.
- Keep product lookups category-local and owner/draft scoped. Catalog fact reads remain read-only.
- **Shampoo:** keep the shared `one()` helper for schema-unique category tables, but change the Shampoo call site to read all spec rows for the product. Filter by actual user hair thickness from the refined snapshot, signed role/bucket (`shampoo_everyday` or `shampoo_dandruff`), and signed scalp route. Keep cleansing intensity as evaluated fact data.
- **Conditioner:** read all base spec rows. Extend `selectConditionerSpec` to receive actual user thickness from `Stage3EvaluationContext`, then filter by thickness and signed Conditioner care direction; retain the existing weight/repair rerank facts.
- **Oil:** continue reading all eligibility rows and aggregate every supported role. Add an explicit plurality guard so this cannot regress to `maybeSingle()`.
- After filtering, accept one semantic match. If several rows have identical evaluation-relevant facts, canonicalize them to one deterministic fingerprint. If distinct applicable rows remain, return an `unknown` authority result with a recoverable limitation; never select the first row.
- Recommendation candidates remain many. Rank first by authority result (`ideal` before `supportive`), then existing catalog `sort_order`, German display name, and stable product id. A deterministic test must cover at least two eligible candidates.
- Multiple captured/owned products in one category remain separate decision subjects and must all survive evaluation, portfolio creation, and completion.
- A category with no searchable catalog returns a truthful empty/retry/manual-add state; it does not depend on PR #345 and never invents a recommendation.

### 2.7 Make auth confirmation replay idempotent

- Keep successful PKCE/OTP verification and quiz-to-profile linking unchanged.
- If verification fails because a link was already consumed, call `getUser()` before declaring it expired.
- With a valid authenticated session, redirect to a sanitized in-origin `next` destination when present; otherwise load the owner-scoped Personal Plan access state and redirect to its canonical current frontier (`/plan-start`, `/routine`, or `/anwendung`), falling back to the existing authenticated default only when no Personal Plan frontier exists.
- `type=recovery` continues to `/auth/update-password`; it must not be converted into a Personal Plan redirect.
- Without an authenticated session, invalid/consumed links keep the current expired-link recovery at `/auth?error=link_expired`.
- Reject protocol-relative, foreign-origin, backslash, and auth-confirm recursion targets. Do not retain token/code/error query material in the destination.
- Authenticated middleware routing from `/auth` removes auth-only `error`, `reason`, `code`, `token_hash`, and `type` parameters before redirecting. Browser Back/Forward cannot resurrect the expired-link screen for an already authenticated user.

### 2.8 Remove duplicate loads and artificial waits

- `/plan-start` resolves the existing owner-scoped Stage 1 snapshot on the server and passes the adapted plan into the client journey. Initial render must not repeat `/api/personal-plan/stage-1`; retry may explicitly refresh after a real failure.
- A Stage 3 bootstrap response contains entry context, canonical draft, requirements, and any authority evaluations. The entry adapter and `Stage3ProductsFlow` share that response; the component does not call `loadOrCreate` again on mount.
- `/plan-bereit` enables the CTA as soon as its first readiness result is `ready`. The three short progress messages may advance with real state, but they do not impose the existing 6.6-second minimum. Preserve the 20-attempt / approximately 30-second recovery boundary.
- Seeded-local measurement targets: Stage 1 content p75 ≤1.0s and p95 ≤2.0s; first Stage 3 screen p75 ≤1.5s and p95 ≤3.0s; ready-on-first-poll CTA ≤1.8s.

### 2.9 One atomic category finalization and truthful saving state

- Add one revision-guarded `finalize_capture_category` mutation to the existing state-machine/API contract. Its payload is the complete category assignment set plus the exact uncovered roles and reason.
- The state machine validates category ownership, allowed roles, uniqueness, and complete coverage against signed requirements, then replaces assignments, records uncovered roles exactly once, and advances the category in one saved revision.
- Use the same mutation for `Ich habe dafür kein Produkt` (empty assignments plus every required role uncovered) and `saveRolesAndContinue` (chosen assignments plus only the missing roles uncovered).
- Reuse the existing visible `Wird gespeichert` label, but promote its backing state into a synchronous in-flight state before the request. Expose that real state through ARIA and the shared header, disable competing actions, and guard against duplicate submission. Conflict/error restores retry without losing the canonical server draft.
- Do not broaden this mutation into Stage 4: Routine proposal staging remains the existing atomic completion seam and must stage once.
- Replace interpolated `Dein {categoryLabel}` headings with an exhaustive category-heading map and static coverage for all ten categories.
- Derive the shared journey header's Stage 3 state from actual idle/saving/saved/error/conflict state, not from a label string or hard-coded saved value.

### 2.10 Make standalone Heat validation axis-aware and selection deterministic

- The signed standalone Heat contract does not contain a `suitable_thicknesses` axis. Common fact validation must therefore accept verified Heat facts without that field; it must not seed or infer fake `fine`, `normal`, or `coarse` support.
- Category adapters that genuinely require thickness continue to fail closed when their supported-thickness facts are absent.
- Heat recommendation selection owns a deterministic total-order policy over truthfully represented signed dimensions: shared fit first, then verified availability, then finite price, then normalized display name.
- Unknown availability or missing signed comparison facts remain unresolved. Known-unavailable candidates are excluded rather than winning through a low or missing price.
- UUID, insertion order, and catalog default `sort_order` never decide Heat. If two candidates remain exactly tied on every signed comparison dimension, return unresolved rather than inventing a product claim or depending on an incidental id.
- Load only the existing read-only catalog facts needed by this policy (`price_eur` and `purchase_link_status`). Do not absorb any PR #345 catalog rows, seeds, migrations, or writes.

## 3. Scope and non-goals

### In scope

- Existing audit overhaul surfaces: `/plan-bereit`, `/plan-start`, Stage 2, Stage 3, Routine, Anwendung, cookie clearance, shared header/tokens.
- Personal Plan quiz ordering and recurrence resume semantics.
- Bondbuilder signed decision/evidence files, deterministic computation, exact Lea fixture, and Stage 1 presentation copy.
- Stage 3 authority fact loading/evaluation, deterministic candidate selection including standalone Heat's axis-aware runtime contract, category-finalization mutation, UI in-flight protection, and production-shaped route/browser tests.
- `/auth/confirm` replay and authenticated middleware cleanup.
- Owner-scoped bootstrap/read-path consolidation and seeded-local performance evidence.

### Must remain true

- `/plan-start` is a passive owner-scoped read; no draft is created merely to inspect progress.
- Stage 3 exact-product multiplicity is preserved, including multiple owned products and multiple valid spec/eligibility rows.
- Pending, planned, mismatching, unknown, and uncovered products/roles remain non-executable.
- Stage 4 owns whole-Routine confirmation; Stage 5 consumes only confirmed in-hand executable items.
- Current revision CAS, lost-response recovery, and idempotent Stage 4 staging remain intact.
- Rollout stays internal-only.

### Explicit non-goals

- Heat catalog data or any write integration from PR #345. The bounded Heat runtime contract in §2.10 is explicitly in scope.
- Catalog approvals, uploads, migrations, seed changes, or production writes.
- A maximum-two-products rule; none exists.
- New image ingestion, hair-care evidence research beyond the confirmed Bondbuilder policy correction, billing changes, deployment, merge, cancellation, or refund.

## 4. Target map

### Bondbuilder and presentation

- `src/lib/personal-plan/categories/bondbuilder.ts`
- `docs/personal-plan/categories/bondbuilder/decision.md`
- `docs/personal-plan/categories/bondbuilder/evidence.md`
- `src/components/personal-plan-start/snapshot-adapter.ts`
- `tests/personal-plan/categories/bondbuilder.test.ts`
- `tests/personal-plan-start-ui.test.tsx`

### Quiz and Stage 1/2 handoffs

- `src/lib/personal-plan-quiz/flow.ts`
- `src/components/personal-plan-quiz/personal-plan-quiz.tsx`
- `src/lib/personal-plan-quiz/{persistence,server-draft,draft}.ts`
- `src/components/personal-plan-start/plan-start-flow.tsx`
- `src/components/personal-plan-refinement/{refinement-flow,refinement-question,refinement-options}.tsx`
- `src/lib/personal-plan/refinement/{question-path,session}.ts`
- `tests/personal-plan-quiz.test.ts`
- `tests/personal-plan-stage2-*.{test.ts,test.tsx,spec.ts}`
- `tests/personal-plan-stage1-2-3.spec.ts`

### Stage 3 loader, actions, and performance

- `src/lib/personal-plan/products/authority/{catalog-facts,contracts,evaluate}.ts`
- `src/lib/personal-plan/products/authority/categories/{shampoo,conditioner,oil}.ts`
- `src/lib/personal-plan/products/{gateway,production-persistence-gateway,stage3-persistence-supabase,state-machine,inventory-search}.ts`
- `src/app/api/personal-plan/stage-3/route.ts`
- `src/components/personal-plan-products/{index,stage3-products-flow}.tsx`
- `src/components/personal-plan-start/plan-start-flow.tsx`
- `src/app/plan-start/page.tsx`
- `src/app/plan-bereit/{personal-plan-ready-client,transition}.ts*`
- Stage 3 gateway, authority, persistence, API, flow, state-machine, browser, and persisted Stage 1–5 tests.

### Auth replay

- `src/app/auth/confirm/route.ts`
- `src/lib/supabase/middleware.ts`
- `src/lib/personal-plan/journey-access-loader.ts` only through an injected owner-scoped frontier resolver
- `tests/auth-post-checkout-routes.spec.ts`
- focused middleware/route unit tests and an auth replay Back/Forward browser spec

## 5. Designed user journey

Evidence status: **confirmed by Nick on 2026-08-09**. User-journey sign-off: **confirmed by Nick on 2026-08-09**.

1. **Quiz concern sequence.** After the user selects one or more current hair concerns, the next screen asks how often the primary concern recurs. With no selected concern, this screen is skipped. Back returns to the concern selection; changing/removing the concern clears an incompatible recurrence answer. The journey then continues to analysis and later scalp questions.
2. **Confirmation-link entry.** A fresh email link verifies and follows its safe intended destination. Reopening the consumed link while already signed in quietly follows the sanitized destination or current Personal Plan frontier. Recovery links still open password reset. A signed-out invalid link still explains that it expired and offers recovery. Back/Forward does not re-show an auth error to a signed-in user.
3. **Ready transition.** When readiness is already known on the first poll, `Plan ansehen` becomes usable immediately rather than waiting 6.6 seconds. If readiness is genuinely pending, progress copy continues until ready. At approximately 30 seconds or on a hard error, the existing retry/support recovery appears.
4. **Stage 1.** The server-rendered Bedarfsplan appears without a duplicate browser fetch. Natural rough-surface-only Lea sees no Bondbuilder recommendation and no chemical-stress wording. A genuinely chemically treated profile may see a Bondbuilder card whose explanation names the actual reason. The final Stage 1 CTA enters the first unresolved refinement question directly.
5. **Stage 2 current products.** Relevant product categories and additional supported categories remain separate. `Keine weiteren` clears only the additional group. Selecting three or more categories remains valid. Saved Back/resume behavior is unchanged.
6. **Stage 2 completion.** The final answer saves once, then the UI shows `Produkte werden vorbereitet` only while the real Stage 3 bootstrap is pending. Success reveals the first product category immediately. Failure offers retry and Back to the last refinement question without losing answers.
7. **Stage 3 product capture.** The bootstrap response is reused; there is no second `loadOrCreate`. Search may show multiple deterministic candidates. No catalog result produces an honest empty/manual-add path. Multiple owned products in one category remain visible.
8. **Stage 3 product evaluation.** Shampoo and Conditioner facts are selected from all applicable rows using the signed role/target plus the user's actual thickness and refined context. Oil combines all eligibility rows. Distinct unresolved spec ambiguity becomes a visible recoverable unknown state, never a crash or arbitrary first-row choice.
   Standalone Heat is verified without a fake thickness claim. If more than one Heat candidate is eligible, selection follows shared fit, verified availability, finite price, and stable normalized name; an exact signed-dimension tie remains unresolved instead of falling through to UUID order.
9. **Stage 3 category finalization.** Choosing no product or saving role assignments immediately changes the shared header to `Wird gespeichert`, disables competing actions, sends one revision-guarded request, records every uncovered role once, and advances. Error/conflict re-enables a safe retry. Pending/mismatching/unknown items remain non-executable.
10. **Review and completion.** Clear fits can still be confirmed together; exceptions remain individual. The pending-product purpose stays on its card. After the last decision, Stage 4 staging occurs once and the user lands directly on the real Routine—never an extra product-summary page.
11. **Routine and Anwendung.** The accepted Routine remains the authority boundary. Only confirmed, in-hand, executable products reach Anwendung. Reopening `/plan-start` resumes the owner-scoped persisted frontier without creating state.

Meaningful states in the evidence and tests: new/resumed refinement, Back after Stage 3, ready-first-poll/pending/timeout, fresh/consumed/recovery/foreign auth link, single/multiple/3+ products, Shampoo and Conditioner multi-row specs, Oil eligibility plurality, multiple deterministic candidates, multiple owned products in one category, no catalog, pending, unknown ambiguity, mutation conflict/error/retry, missing image, mobile/desktop, cookie present/absent.

## 6. Planning evidence

Artifact: [`plans/mockups/2026-08-09-personal-plan-journey-ux-overhaul.html`](mockups/2026-08-09-personal-plan-journey-ux-overhaul.html)

The original artifact proved the shortened image-led Stage 3 direction and was confirmed after removing the redundant handoff page and duplicate pending-purpose section. The revised artifact additionally makes these new decisions concrete:

- direct Stage 1 → first Stage 2 question → real-work-only Stage 3 loading;
- recurrence immediately after concern selection, including the no-concern skip;
- group-local `Keine weiteren` with a 3+ category example;
- reason-aware Bondbuilder behavior for Lea versus a chemical-treatment route;
- real saving, no-catalog, auth replay, timeout, Back, and resume states.

Decision question: does this direct-momentum journey and its recovery language exactly match the intended experience while the backend remains fail-closed?

Evidence review status: **confirmed by Nick on 2026-08-09**. The earlier Stage 3 visual direction and the hardened sections are approved.

## 7. Coverage ledger

### Original audit

All 24 body findings remain covered: C1; M1–M11; m1–m9; c1–c3. The implemented/retained dispositions are pending-action advancement; Stage 2 carry-forward; honest uncovered roles; unambiguous auto-assignment; safe Back and scroll/focus; cookie clearance; persistent stepper; removed intros/empty screens; grouped clear fits; jargon/meta-copy cleanup; German headings; `Leave-in`; normal-scalp answer; common-first frequency; simplified capture; undo through Back; named manual products; title/footer/copy/status/desktop fixes.

### Hardened package

| ID  | Requirement                                          | Planned proof                                                                                                          |
| --- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| D1  | Roughness-only natural hair is not a Bondbuilder job | Exact Lea computation + rendered-copy regression; signed docs updated                                                  |
| D2  | Direct Stage 1/2 handoffs                            | Connected browser path with no click-only transition/invitation/bridge                                                 |
| D3  | Recurrence follows concern                           | Flow/history/persistence/resume tests with no-concern skip                                                             |
| D4  | `Keine weiteren` is group-local                      | Render + grouped merge test; primary selections preserved                                                              |
| A1  | Shampoo multi-row P0                                 | ≥2 Shampoo spec rows, Stage 3 GET 200, no `PGRST116`                                                                   |
| A2  | Conditioner contextual selection                     | Multi-row thickness + care-direction exact/ambiguous tests                                                             |
| A3  | Oil plurality and deterministic candidates           | Multiple eligibility rows + ≥2 catalog candidates                                                                      |
| A4  | Exact-product multiplicity and completion            | Multiple owned same-category products survive; completion stages once                                                  |
| B1  | Auth replay                                          | Fresh/consumed/recovery/foreign-next route tests + Back/Forward browser                                                |
| C1  | Duplicate loads and fixed delay                      | Request counters + seeded-local p75/p95/first-poll timing receipt                                                      |
| D5  | Atomic Stage 3 actions                               | One PATCH, one revision, uncovered roles exactly once, duplicate-click guard                                           |
| E1  | Grammar and saving                                   | Exhaustive ten-category headings + actual header save-state tests                                                      |
| F1  | No max two                                           | Rendered 3+ multi-select check; no new cap logic                                                                       |
| G1  | Heat thickness axis                                  | Verified standalone Heat succeeds without `suitable_thicknesses`; thickness-dependent categories still fail closed     |
| G2  | Deterministic Heat selection                         | Shared fit → availability → price → normalized name; UUID/insertion independent; exact signed-dimension tie unresolved |
| G3  | PR #345 data excluded                                | No PR #345 catalog rows, seeds, migrations, or writes in task diff                                                     |

## 8. Ordered tasks

### Task 1 — Correct signed Bondbuilder policy and reason-aware presentation

Consumes: confirmed D1 policy, current category decision/evidence files, Stage 1 snapshot adapter.

Produces: revised signed policy/evidence, deterministic runtime threshold, exact Lea fixture, and reason-aware presentation.

- Write the Lea test first and prove current roughness-only behavior fails.
- Reclassify `rough_surface` as corroborating-only while preserving chemical and independent damage routes.
- Update decision tables, reason semantics, fixtures, and evidence limitations together.
- Derive Bondbuilder presentation copy from actual reason facts; assert untreated users never receive chemical-stress copy.

Complete when category tests and Stage 1 rendered tests prove the exact positive and negative routes and the signed artifacts match runtime behavior.

### Task 2 — Reorder recurrence and make the Stage 2 category groups truthful

Consumes: Personal Plan quiz screen graph/history, Stage 2 grouped-category helper.

Produces: new recurrence sequence and `Keine weiteren` group-local semantics without schema changes.

- Move recurrence in the canonical screen sequence and update next-screen special cases.
- Reassign recurrence to the `goals_and_context` progress section, move the no-concern fork to `current_problems`, route recurrence to `analysis_bridge`, and remove recurrence's old conflict fork.
- Make `scalp_concerns` the new explicit later-tail fork: `derivePersonalPlanConflictPrompt(answers) ? "admission_conflict" : "admission_practical_cost"`.
- Preserve concern binding, Back/history, local/server draft resume, skip/prune behavior, and conflict-screen reachability for an eligible profile.
- Route the secondary empty action through `mergeGroupedCategorySelection(..., [])` and update copy/ARIA text.
- Add a rendered 3+ multi-select test; do not add selection limits.

Complete when flow, persistence, history, Stage 2 UI, and browser tests cover concern/no-concern/resume, a reachable conflict prompt, plus primary-preserving `Keine weiteren`.

### Task 3 — Make Stage 1/2 handoffs direct and remove duplicate bootstrap work

Consumes: server-resolved journey access, existing Stage 1 snapshot, Stage 2 session/handoff result, Stage 3 draft response.

Produces: server-provided `PlanStartReadyViewModel`, direct Stage 2 entry mode, and a single `Stage3Bootstrap` response reused by the component.

- Load the existing Stage 1 version owner-scoped on the server and pass it to `PlanStartProductionGate`; no initial browser Stage 1 API call.
- Remove Stage 1 transition and auto-begin only genuinely new Stage 2 sessions on this path.
- Define one bootstrap value containing entry context, canonical draft, requirements, and authority evaluations. `Stage3ProductsFlow` initializes from it and skips mount `loadOrCreate`.
- Keep resume, retry, Back, stale-source, and direct-route behavior explicit.
- Remove the ready-story minimum gate while retaining the readiness poll recovery horizon.

Complete when request counters prove one Stage 1 read and one Stage 3 load, the connected browser journey has no click-only handoff, recovery still works, and seeded-local timings meet the three targets.

### Task 4 — Fix Stage 3 multi-row authority loading fail-closed

Consumes: Task 3 bootstrap boundary, current refined snapshot, signed category targets, catalog fact tables.

Produces: request-scoped `Stage3EvaluationContext`, contextual multi-row resolvers, deterministic candidate ordering, and no-crash route behavior.

- Load/validate the current refined version and snapshot once per evaluate/resolve request.
- Keep the shared `one()` helper unchanged for schema-unique tables. Change only the Shampoo call site to a plural read and add a Shampoo selection function with contextual filtering/canonicalization.
- Thread user thickness into `selectConditionerSpec`, tighten selection to thickness plus care direction, and preserve rerank facts.
- Guard Oil eligibility plurality and deterministic recommendation ordering; separately assert that `product_oil_specs` is single-row by its `product_id` primary key.
- Add a schema-contract test documenting which category spec tables are product-id unique and which are contextual plural relations, so a future schema change cannot silently reintroduce `PGRST116` through `one()`.
- Preserve each captured product as a separate subject and fail unknown on semantic ambiguity.

Complete when all required red guards pass: Shampoo ≥2 rows returns 200/no `PGRST116`; Oil plurality; ≥2 deterministic candidates; multiple owned products; full post-capture GET 200; no-catalog recovery; completion stages once.

### Task 5 — Finalize Stage 3 categories atomically and expose real save state

Consumes: signed category requirements, current CAS save seam, existing capture/assignment UI.

Produces: `finalize_capture_category`, one-request UI actions, exhaustive headings, and actual shared-header state.

- Add state-machine invariants and gateway/API contract tests before UI changes.
- Replace sequential no-product and role-save calls with one mutation each.
- Add synchronous in-flight state, disabled actions, ARIA status, duplicate-click suppression, retry/conflict recovery.
- Keep uncovered roles exactly once and non-executable.
- Add exhaustive heading coverage for every category and derive the header state from the mutation state machine.

Complete when state-machine/gateway/API/component/browser tests prove one PATCH, one revision, exact gaps, no duplicates, truthful header transitions, and safe recovery.

### Task 6 — Make authenticated auth-confirm replay idempotent

Consumes: existing redirect sanitizer, Supabase session, owner-scoped journey access resolver, middleware authenticated routing.

Produces: a pure redirect-decision seam plus route/middleware/browser guards.

- Test fresh success, consumed+authenticated, consumed+signed-out, recovery, same-origin next, foreign/protocol-relative/backslash next, and no-next frontier.
- Keep quiz linking only after successful verification; replay must not repeat side effects.
- Strip auth-only query material in authenticated middleware redirects.
- Verify browser Back/Forward cannot restore the expired screen.

Complete when route/middleware tests and the browser replay path pass without weakening expired-link recovery or recovery-password behavior.

### Task 7 — Harden standalone Heat runtime validation and selection

Consumes: the signed standalone Heat decision contract, existing read-only authority facts, and PR #345's runtime prerequisite report.

Produces: category-axis-aware validation and a deterministic, fail-closed Heat candidate comparator without catalog writes.

- Add category-focused red guards proving standalone Heat facts are known without `suitable_thicknesses` while thickness-dependent categories remain unknown when that axis is absent.
- Carry existing `price_eur` and `purchase_link_status` facts through the authority loader.
- Rank truthfully comparable Heat candidates by shared fit, verified availability, finite price, and normalized display name.
- Exclude known-unavailable candidates, refuse unknown comparison data, and leave an exact signed-dimension tie unresolved.
- Prove output is independent of input order and UUID ordering. Do not use default `sort_order` as a hidden Heat policy dimension.

Complete when focused authority/persistence/gateway/schema tests pass and the task diff contains no PR #345 catalog data, migrations, or writes.

### Task 8 — Reverify the whole internal launch candidate

Consumes: Tasks 1–7, retained audit overhaul implementation, original audit matrix, internal fixtures.

Produces: final automated, performance, browser, and review receipts plus a reconciled findings ledger.

- Run focused red guards, `npm run test:personal-plan`, full Node, typecheck, lint, and production build.
- Run persisted Stage 1–5, auth replay, Stage 3 multi-row, mobile/desktop/cookie/error/resume browser paths serially against the task server.
- Record seeded-local timing samples and request counts; do not infer p75/p95 from one run.
- Inspect the final diff for PR #345 catalog writes and production mutations; the bounded Heat authority runtime paths from Task 7 are expected.
- Run one repository code-review lane after implementation; Claude plan review is the single planning counterpart lane.

Complete when no blocker remains, every ledger item has evidence, internal-only gates are intact, and the task stops before publication or production action.

## 9. Verification

### Automated

- Bondbuilder computation and Stage 1 presentation tests, including exact Lea.
- Quiz flow/history/draft/server-draft tests for recurrence order, skip, Back, and resume.
- Stage 2 grouped-selection/UI tests for `Keine weiteren` and 3+ selection.
- Stage 1 page/server-hydration request-count tests.
- Stage 3 authority fact, category adapter, gateway, persistence, API, state-machine, component, and flow tests for every A/D/E guard.
- Heat authority tests for the absent thickness axis, required-axis fail-closed behavior, availability/budget ordering, input/UUID independence, and exact-tie unresolved behavior.
- Auth confirm and middleware decision tests plus existing post-checkout routing suite.
- `npm run test:personal-plan`, `npm run test:node`, `npm run typecheck`, `npm run lint`, `npm run build`, and `git diff --check`.

### Browser and rendered evidence

- 375×844, short mobile, and 1440×900.
- Direct Stage 1 → first Stage 2 question → real-work loading → first Stage 3 product screen.
- Recurrence after concerns; no-concern skip; Back/resume.
- `Keine weiteren` preserves primary selections; 3+ selections remain visible.
- Ready-first-poll, genuine pending, timeout/error, cookie present/absent.
- Multi-row Shampoo/Conditioner, Oil plurality, multiple owned products, no catalog, pending, ambiguous unknown, atomic save/error/conflict/duplicate click.
- Fresh/consumed/recovery/foreign auth link and Back/Forward.
- Stage 3 completion opens `/routine` directly and stages once.

### Performance

- Seed one stable local user/dataset and run enough cold/warm iterations to report p75 and p95 rather than a best-case screenshot.
- Measure navigation/request start to first stable Stage 1 content, Stage 2 handoff start to first interactive Stage 3 heading, and ready page load to enabled CTA.
- Record sample count, environment, cold/warm mix, request counts, p75, p95, and maximum; failed/error runs are reported separately, not discarded silently.

Seeded-local receipt (isolated local Supabase + Next development server + Chromium, one cold navigation plus eight warm navigations per surface):

| Surface                                      |     Cold | Warm p75 | Warm p95 | Warm max | Request proof                                                                 |
| -------------------------------------------- | -------: | -------: | -------: | -------: | ----------------------------------------------------------------------------- |
| Ready on first poll → enabled `Plan ansehen` |   819 ms |   287 ms |   301 ms |   301 ms | first ready response enables the CTA; no 6.6 s minimum                        |
| Stage 1 stable `Deine Basis`                 | 1,090 ms |   253 ms |   311 ms |   311 ms | zero browser `/api/personal-plan/stage-1` reads after server entry resolution |
| Stage 3 stable `Dein Shampoo`                |   554 ms |   351 ms |   363 ms |   363 ms | exactly one `/api/personal-plan/stage-3` bootstrap read per navigation        |

All measured warm percentiles meet the signed targets. No sample failed or was discarded.

### Live-state and safety boundary

- No production data, flags, config, deployment, migration, subscription, cancellation, refund, or merge action.
- No PR #345 catalog rows, seeds, migrations, or writes. Only the reviewed Heat runtime validation/selection prerequisite is included.
- A later authenticated production walkthrough remains separate explicit authorization and reuses the existing paid account.

## 10. Review and handoff

- Worktree: `/Users/nick/AI_work/hair_conscierge/.worktrees/personal-plan-launch-candidate`
- Branch: `codex/personal-plan-launch-candidate`
- Draft PR: #344, unmerged.
- Branch gate: reuse this exact dirty worktree; preserve all task-owned changes.
- Counterpart plan review: read-only Claude Opus 4.8 at `high`, no edits. Initial and focused verdicts: **approve with revisions**. All defect findings from both passes are incorporated below. The remaining performance-sampling choice is retained because the hardened package explicitly requires those targets; the audit evidence is carried by the in-plan 24-item ledger.
- Final whole-working-tree review: read-only Claude Opus 4.8 at `high`, no edits. It returned seven candidate defects plus maintainability observations. Five defects and the progress semantics observation were accepted and fixed; two findings were rejected as contradictions of explicit signed behavior, with the intended behavior made visible and regression-tested. The reconciled branch has no known review blocker. Transient output at `/tmp/personal-plan-launch-candidate-final-claude-review.md` is **discard** unless Nick requests retention.
- Revised evidence review: **confirmed by Nick on 2026-08-09**.
- Revised designed user-journey sign-off: **confirmed by Nick on 2026-08-09** (“Works. Let's go. Let's go. Implement it.”).
- Implementation handoff: completed locally through `implementation-loop`, including ready-check and one repository code-review lane.
- Commit/push remain separate publication authorization. Deployment, migrations, flags, production data, merge, cancellation, and refund remain excluded.
- Artifact disposition: this plan and revised mockup are **commit** artifacts. Transient Claude output and browser/performance scratch data are **discard** unless promoted into a concise receipt.

Residual risks:

- Multi-row catalog facts may reveal genuine semantic ambiguity; the correct launch behavior is recoverable unknown, not silent selection.
- Heat candidates that tie on every signed, truthfully represented selection dimension remain unresolved. Adding another tie-break dimension is a separate signed product decision; UUID/insertion order is not an acceptable fallback.
- Direct handoffs reduce explanatory pauses, so real loading/error feedback and Back recovery must be visually immediate.
- Auth replay must not turn a consumed foreign link into an open redirect or repeat quiz-linking side effects.
- Performance targets require representative seeded-local sampling; a single fast run is not evidence.
- The existing dirty worktree spans the entire journey. Integration must review the combined diff rather than treating the hardened package as an isolated patch.

Final local readiness receipt:

- `npm run test:personal-plan`: 907 passed, 0 failed.
- `npm run test:node`: 3,166 reported tests, 0 failed.
- `npm run typecheck`: passed.
- `npm run lint`: passed with 0 errors and 4 pre-existing warnings.
- `npm run build`: passed.
- Stage 3 connected browser suite: 15 passed.
- Isolated persisted Stage 1–5 browser suite: 2 passed; completion staged once and the performance/request-count receipt above was emitted.
- Unchanged-surface browser evidence retained from this working tree: auth routing 37 passed, Stage 4 1 passed, and Stage 5 2 passed.
- `git diff --check`: passed; no PR #345 catalog data, migration, seed, or production write is present.

### Counterpart findings ledger

| ID   | Type     | Evidence                                                                         | Decision                                | Plan change                                                                                                                                   | Revalidation                                                   |
| ---- | -------- | -------------------------------------------------------------------------------- | --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| CR1  | defect   | Shared `one()` uses `maybeSingle()` across category specs                        | accepted with scope correction          | Schema audit now distinguishes composite-key Shampoo/Conditioner from product-id-unique tables; no plural relation is truncated               | Schema-contract + multi-row route tests; focused Claude rerun  |
| CR2  | defect   | Oil eligibility is already plural-safe; Oil base spec uses `one()`               | accepted and clarified                  | Plurality guard targets `product_oil_eligibility`; `product_oil_specs` is explicitly protected by its product-id PK                           | Oil plurality + schema-contract tests                          |
| CR3  | defect   | Moving recurrence crosses the current section map                                | accepted                                | Recurrence stays in `goals_and_context`; stepper continuity is an acceptance check                                                            | Flow/render/browser tests                                      |
| CR4  | defect   | No-concern skip currently lives after scalp questions                            | accepted                                | Fork moves to `current_problems`; recurrence routes to analysis; old scalp branch is removed                                                  | Concern/no-concern/back/resume tests                           |
| CR5  | defect   | `Wird gespeichert` text already exists but is not the full state contract        | accepted                                | Task now reuses the copy and makes state atomic, header-derived, ARIA-visible, and action-locking                                             | Component/browser duplicate-click tests                        |
| CR6  | tradeoff | Independent workstreams could be split across PRs                                | rejected for this handoff               | Nick explicitly requested integration into the existing launch-candidate plan/worktree; one combined review remains required                  | Final combined-diff review                                     |
| CR7  | tradeoff | No new runtime switch for Bondbuilder/recurrence                                 | accepted                                | Internal-only rollout remains the guard; before any production publication rollback is an exact commit revert, not a new behavior flag        | Diff/release-boundary inspection                               |
| CR8  | defect   | Moving both existing recurrence branches would orphan `admission_conflict`       | accepted                                | Conflict routing is re-anchored at `scalp_concerns`; recurrence goes directly to analysis                                                     | Conflict-eligible reachability + concern/no-concern flow tests |
| CR9  | defect   | Conditioner is already plural; only Shampoo uses the unsafe single-row call site | accepted                                | Conditioner scope is filter-tightening; only the Shampoo call site changes to `many()`                                                        | Shampoo PGRST116 + Conditioner thickness/care-direction tests  |
| CR10 | defect   | The shared `one()` helper also serves schema-unique category tables              | accepted                                | Shared helper remains; a Shampoo-specific plural path is added                                                                                | Schema-contract + all-category regression tests                |
| CR11 | tradeoff | Downgrade seeded-local percentile evidence for an internal-only gate             | rejected for this handoff               | The explicit hardened package requires p75/p95 targets, so Task 8 retains representative cold/warm sampling                                   | Timing receipt with sample count and request counts            |
| CR12 | evidence | Root-only audit report is not present in this worktree                           | accepted without duplicating the report | The plan's 24-item ledger is the branch-owned execution source; no second audit copy is created                                               | Ledger-to-diff closure review                                  |
| CR13 | defect   | Search errors removed the manual-intake escape hatch                             | accepted and fixed                      | Manual intake is available after a failed search; idle arrival remains intentionally search-led                                               | Component + Stage 3 browser tests                              |
| CR14 | defect   | A blocked/slow automatic Routine navigation could leave an endless handoff       | accepted and fixed                      | Completion remains direct; after four seconds still mounted, a `Routine öffnen` recovery CTA appears                                          | Deterministic component test + connected browser completion    |
| CR15 | defect   | GET erased `stale_refined_source` as a retryable 503                             | accepted and fixed                      | GET preserves the typed 409; mounted stale retries reload the server frontier while transient failures retry in place                         | API, HTTP gateway, and Plan Start resume tests                 |
| CR16 | defect   | Bootstrap-only Back read the unresolved entry prop                               | accepted and fixed                      | Back reads `resolvedEntryContext`, preserving known-owned category skips                                                                      | Bootstrap-only Back regression                                 |
| CR17 | defect   | Unknown current-product load was encoded as known-empty ownership                | accepted and fixed                      | Product-load context is omitted when unknown; an explicitly known-empty load still carries empty categories                                   | Adapter + state-machine regression                             |
| CR18 | defect   | UI no longer forced every role to be assigned                                    | rejected as contrary to signed behavior | Unchecked roles intentionally become `not_ready_to_decide` non-executable gaps; copy now says they remain open and dead validation is removed | Role-flow and atomic-finalization tests                        |
| CR19 | risk     | Consumed link cannot prove that the active session owns the original link        | rejected as a scope change              | Explicit replay contract follows the active authenticated session and remains owner-scoped; it never exposes another account's data           | Route matrix + middleware Back/Forward browser tests           |
| CR20 | a11y     | `role=progressbar` on the ordered list overrode list semantics                   | accepted and fixed                      | Progress semantics moved to a wrapper; the ordered list and `aria-current=step` retain native meaning                                         | Journey-header rendered regression                             |
