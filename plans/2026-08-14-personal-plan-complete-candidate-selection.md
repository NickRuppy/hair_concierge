# Personal Plan complete candidate selection

## Outcome and source context

Stage 3 evaluates every active, lifecycle-active, Chaarlie-recommended product in the relevant category before authority ranks a recommendation or comparison alternative. A global catalog-order prefix can no longer hide valid candidates. After all hard eligibility gates, alternatives are ordered by the target-bearing properties shown to the user: full coverage first, then descending partial coverage, and never zero target matches.

This responds to the authenticated Shampoo reproduction where `OGX Renewing + Argan Oil of Morocco Shampoo` evaluated as ideal, but Stage 3 returned no alternative because the first matching normal-thickness, balanced-scalp Shampoo sat after the shared twelve-row cap.

Owning contracts:

- `plans/2026-08-02-personal-plan-computation-spec.md`: candidate selection applies target, thickness, exclusions, protocol readiness, and safe fit before ranking.
- `plans/2026-08-12-personal-plan-stage3-durable-fit-review.md`: top-three transport, exact fingerprint validation, and replacement semantics.
- `src/lib/personal-plan/products/authority/categories/*.ts`: deterministic category authorities.

Read-only production evidence gathered on 2026-08-14:

- 49 active recommended Shampoos exist; the first reproduced-context match is at global position 22.
- Four products match and have the required protocol; excluding the owned OGX leaves three alternatives.
- The current prefix contains zero matches: `correct_candidate_count = 4`, `current_loader_candidate_count = 0`, `bug_reproduces = true`.
- Conditioner (43), Leave-in (42), Mask (34), and Oil (41) also exceed twelve active recommended products.
- The full live catalog has 278 products. Category tables support set-based product access; only `application_guidance_protocols` lacks a matching product-ID index.
- Production-shaped target-grid audit found coverage-order inversions in Conditioner and both Leave-in roles. Current Leave-in prefixes can surface zero-target alternatives, while the other eight category authorities are currently strict enough to avoid that symptom; the shared invariant must nevertheless cover all ten categories.

## Chosen direction

Add a complete-catalog path beside the rollback-only legacy `.limit(STAGE3_AUTHORITY_LEGACY_CANDIDATE_LIMIT)` path, replacing N+1 hydration with a request-scoped, category/context-keyed batched fact snapshot when the existing rollout flag is enabled:

1. Page active recommended product rows for one category to exhaustion with a stable order and exact-count completeness check; no transport page size is a semantic cap.
2. Batch-load category specs, both protocol sources, and category-specific auxiliary rows in bounded product-ID chunks, then verify every page/chunk is complete before merging it.
3. Group by product ID and reuse current semantic selectors to build facts.
4. Define one deterministic comparison-row schema from category, role, and signed/effective target authority, independent of which products happen to survive or be displayed. Rich categories use fixed dimension IDs; Leave-in always uses heat protection as its third row for `pre_heat_application` and repair support otherwise. Compact categories use an explicit ordered set of up to three authority criterion IDs per category/role instead of a union derived from displayed products. Both ranking and final rendering consume this same schema.
5. Let existing authorities apply hard eligibility to the complete set and exclude the owned product. In `selectedComparisonCandidateAssessments`, keep the full unsliced assessment list and project every candidate onto the canonical row schema. Count `in_target` relations only on displayed rows with a real target. Remove candidates with zero matches, order by matched target count descending (therefore N/N before N-1/N), use authority verdict, current recommendation, and catalog order only as deterministic tie-breakers, and transport the resulting top three. `findStage3SelectedComparisonCandidate` must call this same selector so save lookup and display cannot diverge.
6. Cache the in-flight/completed candidate snapshot inside one Supabase persistence instance using category, role, hair thickness, and the canonical effective category decisions used by authority.
7. Preserve the existing independent owned-product path so a non-recommendable or inactive owned product can be judged without entering the replacement pool.

This keeps authority in TypeScript, bounds round trips by table count rather than product count, and guarantees full recall and target-coverage ranking before the UI limit.

Rejected:

- raising 12 to another arbitrary number;
- hydrating the full catalog through the current per-product loader;
- duplicating all ten authorities in SQL/RPC ranking;
- paging until three fits appear, which cannot prove global ideal-before-supportive ranking without scanning the remainder.

## Scope and non-goals

In scope:

- all ten categories: Shampoo, Conditioner, Leave-in, Heat Protectant, Oil, Mask, Scalp Care, Dry Shampoo, Bondbuilder, Deep Cleansing Shampoo;
- complete candidate recall, batched facts/protocols/auxiliary rows, and request-local promise caching;
- one shared all-category target-coverage invariant: full matches first, then descending partial matches, zero matches excluded before the top-three limit;
- exact owned-product loading outside candidate eligibility;
- existing top-three transport and fingerprint validation;
- truthful decision controls: when an alternative is shown, expose both the authority-appropriate keep action and `Diese Alternative wählen`; when exhaustive evaluation finds no positive-match alternative, do not offer a misleading replacement search;
- rare-empty continuity with the comparison surface: keep the owned-product card and evidence matrix while removing the absent alternative product/navigation/column;
- truthful exhausted-catalog copy after complete evaluation;
- one additive active product-guidance index if the final predicate proves it useful;
- production-shaped completeness, query-count, latency, payload, and browser regressions.

Constraints:

- authority remains deterministic and server-owned;
- no product bypasses lifecycle, recommendation, category, role, target, protocol, safety, or fit checks;
- missing facts remain unknown/fail-closed;
- selected candidate ID/fingerprint are freshly revalidated before save and completion;
- image/price/size stay outside authority fingerprints;
- cache scope is one route/persistence instance;
- batch failure remains unavailable, never a partial list presented as complete.
- target coverage is derived only from target-bearing rows the comparison can substantiate; unknown or missing evidence never counts as a match;
- a pinned/current recommendation may break a tie only among candidates with equal target coverage and may never leapfrog a better-covered product;
- displayed target coverage is the primary presentation order even when that means a higher-covered `supportive` candidate appears before a lower-covered `ideal` candidate; the verdict remains visible and its definition is unchanged;
- transport pagination and bounded `.in(...)` chunks are correctness-preserving only: all pages/chunks finish before authority ranks;
- tables currently read with `.maybeSingle()` retain fail-closed multiplicity checks after grouping;
- the complete-catalog hydrator is rollout-gated until production-shaped performance and live coverage evidence pass.

Non-goals:

- category inclusion, targets, roles, hard-eligibility rules, or ideal/supportive verdict definitions (only the post-eligibility presentation order changes);
- normal comparison layout, carousel, actions, portfolio schema, Routine, or Anwendung changes;
- catalog additions or metadata repair;
- relative-superiority claims;
- long-lived/cross-request caching;
- publication, migration application, deployment, writes, activation, merge, or cleanup.

## Target map

| Surface                                                            | Responsibility                                                                                                                |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/personal-plan/products/authority/catalog-facts.ts`        | Build category facts from complete product and batch snapshots; retain the twelve-row legacy path only for flag-off rollback. |
| `src/lib/personal-plan/products/authority/catalog-batching.ts`     | Exact-count pagination, bounded set loading, grouping, and multiplicity guards.                                               |
| `src/lib/personal-plan/products/fit-comparison.ts`                 | Project full-set candidate coverage; exclude zero matches and sort coverage-first before top three.                           |
| `src/lib/personal-plan/products/fit-comparison-schema.ts`          | Deterministic category/role row schemas shared by ranking and rendering.                                                      |
| `src/lib/personal-plan/products/stage3-persistence-supabase.ts`    | Request-local promise caches keyed by effective authority context.                                                            |
| `src/lib/personal-plan/products/production-persistence-gateway.ts` | Preserve fresh revalidation and concurrent-subject correctness.                                                               |
| `src/components/personal-plan-products/product-fit-comparison.tsx` | Preserve the legitimate-empty hierarchy with the Prüfpunkt, Deins, and Ziel columns while omitting alternative content.       |
| `tests/personal-plan/products/stage3-persistence-supabase.test.ts` | Limit/set-aware doubles, all-category batching, cache behavior, exact starvation regression, and fingerprint parity.          |
| `tests/personal-plan/products/stage3-catalog-facts.test.ts`        | Complete and unknown authority tests.                                                                                         |
| `tests/personal-plan/products/stage3-fit-comparison.test.ts`       | Full-set target-coverage ranking, zero-match exclusion, owned exclusion, and top-three transport across every category/role.  |
| `tests/personal-plan-product-fit-comparison.test.tsx`              | Exhaustive fallback wording, table structure, recovery, and unchanged normal comparison actions.                              |
| `scripts/personal-plan/benchmark-stage3-review-readiness.ts`       | Production-shaped batch/query-count benchmark.                                                                                |
| Stage 3 browser/API tests                                          | Existing desktop/mobile decision journey proof.                                                                               |

## Category batch map

All categories load `products`, `product_application_protocols`, and active German product-scoped `application_guidance_protocols`. Extra sources:

| Category        | Sources                                                         | Existing authority context                             |
| --------------- | --------------------------------------------------------------- | ------------------------------------------------------ |
| Shampoo         | `product_shampoo_specs`                                         | thickness, target bucket/route, intensity, role        |
| Conditioner     | `product_conditioner_specs`, `product_conditioner_rerank_specs` | thickness, direction, weight, repair, target           |
| Leave-in        | `product_leave_in_specs`                                        | roles, weight, direction, repair, functions, heat      |
| Heat Protectant | `product_heat_protectant_specs`                                 | heat capability, format, protocol                      |
| Oil             | `product_oil_specs`, `product_oil_eligibility`                  | roles, weight, thickness eligibility, heat             |
| Mask            | `product_mask_specs`                                            | weight, direction, repair, functions                   |
| Scalp Care      | `product_scalp_care_specs`                                      | role, format, rinse mode                               |
| Dry Shampoo     | `product_dry_shampoo_specs`                                     | effect, color/sensitivity fit, format                  |
| Bondbuilder     | `product_bondbuilder_specs`, outgoing `product_relationships`   | standalone/add-on relation, treatment/application mode |
| Deep Cleansing  | `product_deep_cleansing_shampoo_specs`                          | reset role, scalp focus, color suitability             |

## Designed user journey

Actor: a paid Personal Plan owner reaches Stage 3 with current signed Bedarf/refinement authority.

1. Stage 3 loads and evaluates the exact owned product.
2. The server pages the active recommended category catalog to an exact-count proof, batch-loads all required facts, and only then evaluates it, regardless of `sort_order` position or transport page/chunk boundaries.
3. Existing hard gates first remove anything unsafe, wrong-role, wrong-category, protocol-incomplete, inactive, or otherwise ineligible. The server then scores every survivor against the target-bearing properties displayed in the comparison, removes 0/N candidates, and sorts N/N before N-1/N before lower non-zero coverage. Only after this does it take the first three.
4. If one to three target-matching alternatives exist, Stage 3 preserves the current one-at-a-time carousel: the first/highest-covered alternative is displayed beside the owned product, arrows move through `Alternative 1 von N` up to three, and both the alternative card and comparison-table `Alternative` column update together. The currently displayed alternative always has an explicit `Diese Alternative wählen` action. The owned product's verdict controls hierarchy: if it fits, `Mein Produkt behalten` remains primary and replacement is secondary; if it does not fit, replacement is primary and keeping it is the explicit override. Browsing changes presentation only and choosing binds the exact displayed candidate/fingerprint.
5. Only when no hard-eligible candidate matches even one displayed target after exhaustive evaluation does the rare state appear. It keeps the same title, verdict, owned-product card, evidence matrix, and authority-valid owned-product action, but removes the alternative card, navigation, matrix column, and replacement search. Beneath the matrix it states that the full catalog was checked.
6. If a required batch fails, the existing retryable unavailable state appears; partial data never becomes `keine Alternative`.
7. Save and completion rebuild authority and revalidate the selected ID/fingerprint before portfolio/Routine creation.
8. Completion proceeds to Routine unchanged.

Variants:

- inactive/non-recommended owned product: evaluated, never admitted as candidate;
- multiple same-context owned products: share candidate snapshot, retain distinct owned facts/keys;
- different role/target: distinct cache key;
- incomplete facts: unknown, never confident;
- candidate after old row twelve: ranked normally;
- equal coverage: existing deterministic authority/current-recommendation/catalog tie-breaks apply;
- genuine no-positive-match set: honest fallback with the valid owned-product decision, never a misleading 0/N alternative or unfulfillable search promise.

End-user evidence review: **confirmed by Nick on 2026-08-14** after revising the normal carousel/action controls, removing exceptional-state search, and visually checking the larger product imagery on desktop and mobile.

User-journey sign-off: **confirmed by Nick on 2026-08-14**. The normal state preserves the existing up-to-three one-at-a-time carousel and binds the exact displayed alternative; the rare state preserves the same table without an alternative column or replacement search; the 0.5% alert/rollback threshold remains the activation gate.

## Planning evidence

- Live read-only SQL: four correct candidates versus zero under current prefix.
- Live schema/index inspection: batchable category sources; one missing product-guidance index.
- Live read-only `EXPLAIN (ANALYZE, BUFFERS)`: contextual Shampoo query returned four rows in about 19 ms.
- `plans/artifacts/personal-plan-candidate-selection/no-alternative-table-review.html`, desktop/mobile rare-state renders, `comparison-actions-visible-product-images-v3.png`, and `normal-alternative-actions-visible-product-images-mobile-v3.png`: reviewed current carousel and exceptional-state table evidence with realistic German copy and product imagery.

No logic prototype is needed: production data and existing authorities settle the architecture. The rare state reuses the existing comparison hierarchy and interaction model.

## Ordered tasks

### Task 1 — make the persistence harness capable of proving completeness

First replace the shared-array Supabase double with product-keyed table rows and teach its chain to honor `.limit()`, `.range()`, exact counts, `.in()`, stable ordering, and `.maybeSingle()` duplicate failures. Add focused meta-tests proving that the double truncates under the current query, returns the correct per-product facts, supports chunked ID sets, and raises the same duplicate-row failure as production.

Then add a regression with at least 21 earlier non-matches followed by the owned OGX-equivalent and three matches. Generalize across all ten categories by placing the only valid candidate after the former cap and supplying required auxiliary facts/protocols. Add a transport-scale fixture beyond one product page and beyond one fact chunk so completeness is proven across boundaries, not just beyond twelve. Add target-grid fixtures for every category/role asserting coverage-descending order and zero-match exclusion; include the production-shaped Conditioner `[2,1,2]` inversion and both Leave-in roles where current prefixes can surface 0/3.

Assert no pre-eligibility numeric limit, complete ID-set batch reads, unknown handling for missing facts, and independent owned-product loading.

Complete when the harness meta-tests are green, while the Shampoo completeness case, all-category later-candidate matrix, cross-page/chunk regression, Conditioner ordering case, and Leave-in zero-match cases fail on current code for the intended reasons.

### Task 2 — implement complete batched fact hydration

Consumes: Task 1 red fixtures.

Verify and complete the partially built set-based hydrator already in the worktree; do not recreate it. It must return a product-ID fact map, fetch products in stable exact-counted pages until the reported count is satisfied, and fetch specs, auxiliary rows, and both protocol sources in bounded product-ID chunks. Require the merged page/chunk cardinality to match the exact source result rather than accepting partial data. Preserve multi-row Shampoo/Conditioner/Oil semantics and fingerprints. For Leave-in, Heat Protectant, Mask, Scalp Care, Dry Shampoo, Bondbuilder, Deep Cleansing Shampoo, and Conditioner rerank rows, throw the existing unavailable error when grouping finds more than one row for a product where `.maybeSingle()` previously enforced uniqueness.

Preserve `STAGE3_AUTHORITY_LEGACY_CANDIDATE_LIMIT = 12` and `loadLegacyRecommendationCandidates` solely as the existing feature-flag-off rollback path. The enabled complete path must have no pre-eligibility numeric cap. Retain `STAGE3_FIT_COMPARISON_ALTERNATIVE_LIMIT = 3` only after evaluation. Preserve the already-independent owned-product loader and assert that behavior rather than rebuilding it.

Complete when the completeness portion of Task 1 is green, exact counts prove there is no silent 1,000-row ceiling, duplicates still fail closed, the exact Shampoo case yields three alternatives after owned exclusion, existing category authority tests remain green, and typecheck is green at the task boundary.

### Task 2b — implement shared target-coverage ordering

Consumes: Task 1 target-grid red fixtures and Task 2 complete candidate set.

In `fit-comparison.ts`, first extract a canonical ordered row schema from category, role, and effective target authority. It must not depend on the candidate set. For Leave-in, the role decides the third row: heat protection for `pre_heat_application`, repair support otherwise. For compact categories, define and test the explicit ordered authority criterion IDs used as the visible rows. Use that schema both to render the final table and to project every full-set hard-eligible candidate before slicing. Count only visible schema rows with a non-null target whose candidate relation is `in_target`; retain the denominator for tests and diagnostics. Exclude 0/N, sort match count descending, then use verdict, current recommendation, and catalog order as tie-breakers before applying `STAGE3_FIT_COMPARISON_ALTERNATIVE_LIMIT`.

Coverage intentionally outranks the existing `ideal`/`supportive` sort key because Nick explicitly selected 3/3 → 2/3 → 1/3 → never 0/3. This changes ordering, not verdict calculation or copy. Route both `buildStage3FitComparison` and `findStage3SelectedComparisonCandidate` through the same coverage-aware bounded selector; no display-only ordering fork is allowed.

Complete when the Conditioner `[2,1,2]` reproduction becomes `[2,2,1]`, both Leave-in roles exclude 0/3, all five compact categories are explicitly present in the all-category/role target-grid invariant, each candidate's ranking numerator/denominator equals the rows visible for it in the final table, equal-coverage tie order remains deterministic, display and `findStage3SelectedComparisonCandidate` choose the same product in an equal-coverage tie, exact selected candidate/fingerprint lookup remains stable, and typecheck is green.

### Task 3 — deduplicate request work without stale authority

Consumes: Task 2 candidate snapshot; independent of Task 2b ranking internals.

Verify and complete the partially built promise-valued cache inside `createSupabaseStage3ProductionPersistence`, storing before await so concurrent reviews coalesce. Build the cache key from category, role, thickness, authority version, and a canonical fingerprint of the effective category decisions that `authoritativeReview` actually passes to authority, including product-load-resolution overrides; do not key against stale signed targets when effective decisions differ. Keep owned facts subject-specific. Fold heat-carrier products into the same bounded raw-fact batching mechanism, while caching resolved heat coverage separately by draft authority/inventory fingerprint plus heat routes. Failures never become empty results.

Complete when identical concurrent contexts perform one batch, effective-decision overrides cannot collide with signed-only contexts, distinct contexts do not collide, heat-carrier resolution has no sequential per-product N+1, failure returns unavailable, and fresh replacement validation rebuilds authority in its new request.

### Task 4 — add the proven guidance lookup index

Consumes: Task 2 final predicate.

Generate a migration with Supabase CLI. Add the smallest partial/product-first index matching active German product guidance only after `EXPLAIN` at representative cardinality proves use. Run migration verification and security/performance advisors. Add no speculative indexes elsewhere. If the planner does not use it at representative scale, record the evidence and omit the migration.

Complete when the index path is proven at representative scale with no new advisor finding.

### Task 5 — preserve comparison truth and replacement safety

Consumes: Tasks 2–3, including Task 2b.

Prove full-set coverage-first top-three ordering, zero-match exclusion, owned exclusion, the already-independent loading of inactive/non-recommended owned products, relation evidence, fingerprints, replacement save/conflict/revalidation, portfolio-v3 planned identity, replaced-owned `Nicht verwendet`, and completion with a candidate beyond the old cap. Ensure every normal comparison exposes `Diese Alternative wählen` for the displayed candidate alongside the authority-valid keep/override action. Refactor only `FitOnlyReview` to reuse the current comparison table styling with the owned-product and target columns; omit the alternative product card, navigation, alternative matrix column, alternative detail panel, and `Produkt suchen`. Preserve mismatch, pending, unknown, unavailable, and uncovered strings and states. Rollback/incomplete results must not claim exhaustion.

Complete when component/API/gateway tests and rendered evidence prove normal comparison actions/layout unchanged, the exhausted-catalog state matches the reviewed desktop/mobile artifact, and its text appears only after a proven complete zero-candidate result.

### Task 6 — production-shaped performance and journey evidence

Consumes: Tasks 2–4.

Benchmark complete category counts with headroom, actual per-query latency multiplied by observed query count and returned-row volume, full candidate revalidation CPU, same-context coalescing, different-context separation, payload at or below 64 KiB, and warm p95 at or below 3,000 ms. Do not treat fewer persistence-method calls as a latency improvement. Run a migrated browser/API replay for the exact Shampoo case and a genuine empty case. Before release, perform a privacy-safe read-only production catalog coverage audit for every category/context fixture.

Verify and extend the existing complete-catalog hydrator flag, telemetry, and tests for guarded rollout. Verify both the old and new paths before publication; activation is a separate production decision after the new-path evidence passes. The legacy twelve-row path exists only as the flag-off rollback state, not as the end state.

Treat missing alternatives as a coverage exception, not a routine outcome. Before activation, require zero empty results across the canonical all-category/context coverage matrix; any non-zero fixture blocks release for explicit catalog-gap review. After guarded activation, emit privacy-safe reason-coded telemetry and alert/rollback if legitimate-empty exceeds the agreed rarity threshold (recommended: 0.5% of assessable owned-product reviews).

Complete when focused suites, all Personal Plan tests, Stage 3 Chromium, typecheck, lint, flags-off build, migration checks/advisors, and ready-check pass on Node 22.

## Verification

Automated:

- exact >12 Shampoo regression and all-category later-candidate matrix;
- all-category/role invariant that target-bearing alternatives are ordered by descending substantiated match count and never include 0/N;
- production-shaped Conditioner 2/3-before-1/3 regression and Leave-in post-wash/pre-heat 0/3 exclusion regressions;
- exact-count pagination above the configured PostgREST row ceiling and bounded fact chunks;
- duplicate-row fail-closed coverage for every formerly `.maybeSingle()` table;
- category authority, batching, cache, replacement, portfolio, Routine regressions;
- production-shaped Stage 3 benchmark;
- `npm run test:personal-plan`, nested suite, Stage 3 Playwright, typecheck, lint, flags-off build, `git diff --check` on Node 22.

Database/live-state:

- local migrated verification;
- representative `EXPLAIN (ANALYZE, BUFFERS)`;
- security/performance advisors;
- read-only production catalog coverage before deployment;
- no production migration, deployment, activation, or customer replay without separate authorization.

Manual/browser:

- OGX-equivalent plus three late alternatives on desktop and 390 px mobile;
- exact focused alternative persists;
- normal comparison preserves the existing one-at-a-time, up-to-three alternative carousel; arrows update the displayed product and its table column together;
- normal comparison visibly exposes both keep/override and exact displayed-alternative selection;
- genuine no-positive-match state retains the comparison table with only `Prüfpunkt | Deins | Ziel` and does not offer replacement search;
- batch failure shows retryable unavailable;
- no overflow, broken image, or CTA occlusion.

## Reconciled implementation ledger

Snapshot reconciled after the 2026-08-14 counterpart review detected task-aligned files changing during its read-only pass. No live writer remained when checked; all unexpected edits are preserved for audit.

- Task 1: **complete** — the set-aware harness proves 505 products across two exact-count pages and six URL-safe fact chunks, multi-page fact sources, all ten category sources, duplicate singleton failure, and exact-count mismatch failure.
- Task 2: **complete** — the enabled path has no semantic candidate cap, batches category facts and protocols, preserves the independent owned-product loader, and fails closed on incomplete reads. The private twelve-row loader remains rollback-only.
- Task 2b: **complete** — one category/role schema drives both visible rows and pre-slice coverage; the Conditioner `[2,1,2]` regression is `[2,2,1]`, Leave-in pre-heat always uses the heat target, and 0/N alternatives are excluded across the category/role matrix.
- Task 3: **complete for the approved request scope** — promise caches coalesce identical category contexts and separate different contexts; heat carrier facts use bounded product/spec/protocol batches. Fresh save/completion revalidation remains request-local through the existing gateway.
- Task 4: **omitted by design** — the live representative guidance query completed in about 19 ms and the planner did not establish a justified new index; no speculative migration was added.
- Task 5: **complete** — normal comparisons retain exact keep/replace actions; the rare state preserves `Prüfpunkt | Deins | Ziel`, omits the absent alternative, and distinguishes complete-catalog exhaustion from rollback uncertainty.
- Task 6: **complete** — 1,519 Personal Plan tests and 16 Chromium journeys pass; the previously failing Tracker drawer check passes after inheriting PR #402; typecheck and the default-off build pass. The eight-review benchmark runs the production Supabase complete-catalog adapter with 20 ms query latency: 45 bounded queries, 232 returned rows, 57,106 response bytes against 65,536 bytes, and 206.31 ms warm p95 against 3,000 ms. HTTP transport omits the redundant raw rail model only after complete evidence rows are built; visible rows, rationales, values, products, and decision fingerprints remain intact.

## Review and handoff

- Worktree: `.worktrees/personal-plan-candidate-selection`; branch: `codex/personal-plan-candidate-selection`.
- Plan and selected copy artifact: **commit** with implementation PR after evidence review and journey sign-off.
- SQL/EXPLAIN/counterpart transient output: **discard** after concise findings are incorporated.
- Implementation uses `implementation-loop`, including `ready-check` and `request-code-review`.
- Shipping authorization covers commit, push, and a draft PR only. Stop before migration application, deployment, writes, activation, merge, or cleanup without separate authorization.

Counterpart review result: the original recall architecture remains sound, but the 2026-08-14 revision was blocked until the moving worktree was reconciled, pre-slice per-candidate coverage was specified against `fit-comparison.ts`, and verdict-versus-coverage precedence was explicit. Those points are now incorporated above. The suggested recall-only split remains rejected because Nick explicitly requires coverage-first behavior across every category.

Final review receipt:

- Normal correctness and structural lenses reviewed the full uncommitted task tree against base `6ca24b64196d1d9414aa9ea1d25e5b9cf8e1a825`; the post-review delta fixes deterministic batch ordering, jointly observes cached candidate/heat promises, lowers UUID chunks to 100, and covers raw-protocol parity, rollback, multi-page facts, and dual failure.
- `npm run test:personal-plan`: 1,519 passed; `npm run test:playwright:personal-plan-stage3`: 16 passed; the exact previously failing Tracker drawer test: 1 passed; `npx tsc --noEmit`: passed; targeted ESLint, Prettier check, `git diff --check`, and default-off production build: passed.
- Benchmark: the production Supabase complete-catalog adapter exercised the paged products query and all four Conditioner batch sources with 20 ms/query; 45 bounded queries returned 232 rows, warm p95 was 206.31 ms versus 3,000 ms, and the response was 57,106 bytes versus 65,536 bytes. The transport regression test failed with the raw dimension present, then passed after the route projection removed it while preserving evidence rows.
- Final selected evidence comprises the HTML review artifact plus two rare-state and two normal-comparison desktop/mobile renders. Superseded renders, browser scratch output, manifests, and Claude reports were discarded.
- Review fingerprint after all code/test fixes and before this receipt-only plan update: `dbf9d3f0b8ccd86ebe9132868785559ba9eb0c2dfa02189428dafb3a9944f95b`. Activation refresh rebased the task onto `origin/main` at `de5d7751`; the final content fingerprint is recorded in the PR receipt.

Status: recall, coverage-first selection, the reviewed comparison/rare-state UI, and response-payload reduction are complete in draft PR #401. Merge, deployment, full-catalog activation, and the privacy-safe production coverage audit remain the authorized release steps.
