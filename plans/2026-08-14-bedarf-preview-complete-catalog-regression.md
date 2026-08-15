# Bedarfsplan complete-catalog preview regression fix

## Outcome and source context

Bedarfsplan cards show only the profile-specific example selected by the shared category authority. Basis cards no longer stay blank merely because their valid recommendation falls outside the first twelve catalog rows, and no generic image is loaded or swapped in first.

Source context:

- Current production screenshot supplied by Nick on 2026-08-14 shows reserved but empty Shampoo and Oil image slots on `/plan-start` Basis.
- The original reviewed image semantics and unchanged card layout remain owned by `plans/2026-08-14-bedarf-property-images-and-preload.md` and `plans/mockups/2026-08-14-bedarf-property-image-variants.html`.
- Read-only production replay for the exact affected initial-need source proved the Stage 1 preview response is source-matched and HTTP 200, but contains only Conditioner and Leave-in. Shampoo and Oil are omitted.
- The legacy direct loader evaluates only 12 candidates. All 12 live Shampoo candidates mismatch; the 12 Oil candidates contain no ideal recommendation for the first represented role.
- The existing complete batched authority loader evaluates 49 live Shampoo and 41 live Oil candidates and returns an image-backed recommendation for both. Measured live reads were 574 ms and 365 ms respectively, compared with 4.9 seconds for the four-category legacy preview computation.
- Oil exposed a second semantic defect: its uncovered-role authority result deliberately has a top-level `mismatch` verdict while carrying an exact, verified recommendation. The preview rejected that assignment-state verdict before evaluating the recommended product's own fit.

## Chosen direction

Let direct Stage 1 preview selection explicitly opt into the existing complete, paged, batched catalog loader and canonical authority semantics. Treat the first authority evaluation as recommendation selection, then re-evaluate that exact recommended product through the same authority before exposing its image. Preserve the 12-row loader as the default for direct callers; Stage 3 itself is canonically complete. Do not add a second matcher, generic fallback, UI swap, new cache, or persistence layer.

Refresh note, 2026-08-15: PR #408 is now the base authority for Stage 3. It evaluates the complete catalog before limiting visible alternatives and exposes the typed explicit-complete direct-loader mode used here. Stage 3's former environment rollback was subsequently retired; this distinct Stage 1 boundary remains.

## Scope and non-goals

In scope:

- consume PR #408's explicit complete-catalog option for direct recommendation-candidate selection;
- make the Stage 1 preview service opt into it at its loader boundary;
- keep Stage 1's explicit complete direct loading paired with canonical authority evaluation;
- pass the profile hair thickness through both Stage 1 authority evaluations so thickness-sensitive Mask and Bondbuilder candidates can resolve;
- prove candidates after row twelve can supply the exact authority-selected preview;
- separate uncovered-slot verdicts from the selected recommendation's own fit verdict;
- apply that select-then-verify rule consistently to every authority category that returns a valid uncovered-slot recommendation, including Oil, Kopfhautpflege, and Hitzeschutz;
- preserve per-category fail-closed behavior for genuinely missing authority recommendations or images.

Non-goals:

- generic/category-only fallback images;
- changing card layout, labels, copy, category order, roles, targets, or frequencies;
- changing any category authority rule or Stage 3 decision behavior;
- database migrations, catalog writes, deployment, flags, or production activation;
- persisting preview products into the signed Stage 1 snapshot.

## Target map

- `src/lib/personal-plan/products/authority/catalog-facts.ts`: PR #408 base authority; unchanged here and verified for bounded direct callers plus explicit complete direct loading.
- `src/lib/personal-plan/product-previews.ts`: Stage 1 Supabase preview loader opts into complete candidates.
- `tests/personal-plan/products/stage3-persistence-supabase.test.ts`: inherited PR #408 coverage for the bounded direct default plus explicit complete direct loading.
- `tests/personal-plan/product-previews.test.ts`: authority-selected image after the legacy boundary and per-category failure behavior.
- `tests/personal-plan-start.spec.ts`: existing production-shaped Basis/Optional journey remains the browser acceptance surface.

## Designed user journey

Status: confirmed. Nick rejected generic-first image swapping on 2026-08-14 and requested a sustainable investigation/fix.

1. An eligible user opens `/plan-start` on Basis.
2. The source-keyed preview request begins from server-rendered HTML as it does today.
3. The preview evaluates the complete relevant recommendation catalog through the existing shared authority and batched fact loader.
4. Each resolved Basis card receives only its profile-specific example image; no generic image is requested or shown first.
5. Resolved Optional images preload while Basis is visible, using the same exact URLs later rendered on Optional.
6. A category with genuinely no authority recommendation or image keeps the stable reserved slot and does not invent a fallback.
7. Text, navigation, and later stages remain available if preview evaluation fails.

## Planning evidence

- `plans/mockups/2026-08-14-bedarf-property-image-variants.html` remains the reviewed visual direction: unchanged card geometry, real packshot, explicit `Beispiel` semantics.
- The supplied production screenshot is the negative regression evidence: correct geometry and content, but missing Basis packshots.
- No new visual variant is introduced. Nick's correction is incorporated: never load a generic image and replace it with the specific image.
- Evidence review: confirmed.

## Ordered tasks

### 1. Make complete direct candidate selection explicit

Consumes: `Stage3RecommendationCandidateSelection` and the existing complete/legacy loader implementations.

Produces: a typed direct-selection option whose default remains legacy and whose explicit complete mode uses `loadRecommendationCandidates`.

- Add a regression with thirteen ordered candidates proving default direct selection still stops at twelve.
- Add the paired explicit-complete regression proving all thirteen are batched and available.
- Keep the direct-call default bounded while Stage 3 remains canonically complete.

Completion: the loader mode is intentional at each call site and no bounded direct caller silently widens.

Refresh disposition: completed by PR #408 and retained unchanged on the refreshed branch.

### 2. Opt Stage 1 preview into complete candidates and verify recommendation fit

Consumes: the explicit direct-selection option.

Produces: the preview candidate loader requests the complete catalog for every rendered category, evaluates its normalized facts with canonical semantics, and only emits a recommendation after evaluating that exact product as `ideal`.

- Add a preview regression where the first twelve products cannot match and a later image-backed product is the authority recommendation.
- Make that Shampoo regression use a condition-derived route and valid cleansing intensity so loader and evaluator completeness cannot drift apart.
- Add an Oil regression proving an uncovered-slot `mismatch` can carry a valid recommendation, while the selected Oil's own authority evaluation must still pass.
- Add a non-Oil regression proving the same authority contract for an uncovered Kopfhautpflege recommendation.
- Add exact-fit Mask and Bondbuilder regressions that expose their images while unsuitable thicknesses still fail closed.
- Preserve source hash validation, first-ordered-role semantics, and per-category failure isolation.

Completion: the preview response contains the later exact product/image without a second matcher or fallback image.

### 3. Verify the integrated journey and performance boundary

Consumes: the updated loader and preview service.

Produces: automated and live read-only evidence.

- Run focused loader, preview, UI, and browser tests.
- Run the full Personal Plan suite.
- Recompute the affected production source read-only and confirm Shampoo and Oil now resolve with images.
- Record cold/warm preview timing; treat a regression above the current multi-second legacy computation as blocking.

Completion: Basis-specific images resolve, Optional preload remains exact, and no generic image URL appears in the rendered plan model.

## Verification

Automated:

- focused catalog loader regressions;
- `tests/personal-plan/product-previews.test.ts`;
- `tests/personal-plan-start-ui.test.tsx`;
- production-shaped Personal Plan start browser test;
- `npm run test:personal-plan`;
- scoped TypeScript/ESLint/Prettier and `git diff --check`.

Manual/browser:

- Basis contains only specific preview URLs after response;
- Optional exact URLs begin loading while Basis is visible;
- no generic-to-specific image swap;
- reserved geometry remains stable on a deliberately empty category.

Live-state:

- read-only replay only; no Supabase write or migration.

## Review and handoff

- Worktree: `.worktrees/bedarfsplan-basis-image-regression`
- Branch: `codex/bedarfsplan-basis-image-regression`
- Counterpart plan review: completed read-only on 2026-08-15 with `claude-opus-4-8` at high effort. Its supported blocker found that Stage 1 paired complete loading with legacy evaluation semantics; canonical evaluation and the derived irritation-route regression resolve that drift. The observability suggestion remains a non-blocking follow-up outside this focused repair.
- Evidence review: confirmed.
- User-journey sign-off: confirmed by Nick's explicit rejection of generic-first swapping and request for a sustainable fix.
- Artifact disposition: plan, code, and regression tests commit; transient review output discard.
- Stop point: verified review-ready worktree. Commit, push, PR, merge, deployment, and production writes require separate authorization.

## Implementation evidence

- Stage 3 base proof: PR #408 loads and evaluates the complete catalog before limiting visible alternatives, with an explicit 13th-candidate direct-loading regression. Complete Stage 3 behavior is now canonical.
- Refreshed Stage 1 red guard: removing `completeCatalog: true` made the focused service test fail with `undefined !== true`; restoring it passes.
- Complete-semantics red guard: legacy evaluation semantics made the irritation Shampoo regression return no preview; canonical evaluation passes.
- Thickness-context red guard: exact-fit, active, recommendable, image-backed Mask and Bondbuilder candidates both returned no preview while the shared authority input omitted `hairThickness`; adding the snapshot thickness made both pass, while unsuitable-thickness variants remain empty.
- Red guard 2: a verified recommended Oil produced no preview because the uncovered-slot `mismatch` was rejected before evaluating the recommendation itself.
- Focused Stage 1 proof: all 10 preview-service regressions passed, including complete-mode irritation, uncovered-slot Oil and Kopfhautpflege, and exact-fit/fail-closed Mask and Bondbuilder cases.
- Focused integrated Stage 1/Stage 3 proof: 131 tests passed across preview, persistence, fit-comparison, direct-loader-boundary, and production-coverage contracts before the final focused additions; the full suite below contains the final regressions.
- Full Personal Plan proof against PR #408 after the counterpart correction: 1,575 tests passed.
- Live read-only Stage 3 coverage audit: all 21 category/role targets passed with complete candidate counts and zero failures.
- Live read-only Stage 1 replay: the exact affected source returned image-backed `ideal` previews for Shampoo, Conditioner, Leave-in, and Oil; synthetic read-only irritation and dandruff variants also returned image-backed `ideal` Shampoo previews. The affected-plan cold run was 2,131 ms and the warm condition variants were 238-246 ms. No production data was written.
- Production-shaped browser proof: all three `/plan-start` scenarios passed, including Optional image requests starting while Basis is visible and exact URL reuse after navigation.
- TypeScript, scoped ESLint, Prettier, and `git diff --check` pass.
- Normal and structural code review: completed on the refreshed diff. No blocking correctness defects remain. The review's supported low-risk findings were incorporated by documenting and testing the cross-category uncovered-slot behavior and by naming the injected-candidate regression accurately; PR #408 retains the actual pagination-boundary proof.
- Counterpart review limitation: none. Both the plan review and final code review completed read-only; transient reviewer output was discarded.
