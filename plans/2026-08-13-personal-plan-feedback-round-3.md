# Personal Plan feedback round 3

Status: implemented, verified, and reviewed; awaiting separate publication authorization
Evidence review: confirmed for Stage 3 missing-product comparison, Stage 4 compact option A, and the complete Stage 5 ten-family matched-background silhouette map
Designed user-journey sign-off: confirmed by Nick on 2026-08-13

## 1. Outcome and source context

Repair all documented Stage 3–5 findings as three sequential, independently reviewable slices while preserving the five-stage Personal Plan authority model.

Source evidence:

- [Diagnosed findings](evidence/2026-08-13-personal-plan-feedback-round-3-findings.md)
- eight authenticated screenshots supplied by Nick on 2026-08-13
- live production deployment `dpl_Cf57hFwiYtsaeNJCTGGy5BCm796y`, built from exact `main` SHA `53745c22bf2a3041959920a860677646ac929303`
- current Stage 3 matrix implementation from PR #389
- prior Stage 4/5 alignment release from PR #387

Planning contract:

- **Outcome:** Stage 3 asks only questions that can change an answer, recommends only strict verified matches, and keeps missing-product categories actionable; Routine looks and scans like the Bedarfsplan; Anwendung stacks all day shelves vertically with correctly filled product silhouettes and calm truthful status.
- **Constraints:** preserve server-owned deterministic product authority, exact candidate/fingerprint validation, no silent ownership/executability changes, one category per Routine card, frozen Routine cadence, compiled Stage 5 truth, German UI, and Bedarf → Verfeinerung → Produkte → Routine → Anwendung.
- **Non-goals:** no Stage 1/2 redesign, new category, new hair-care rule, fuzzy catalog match, calendar/tracker, Routine mutation architecture change, database migration, feature activation, catalog publication, or production write.
- **Done when:** each slice has red-first regression coverage, desktop/mobile rendered evidence matches the selected artifacts, the full designed journey is signed off, focused/full Personal Plan verification is green, and one whole-branch code review finds no unresolved blocker before publication.

## 2. Chosen direction

### Slice A — Stage 3 questions and strict missing-product recommendations

1. Skip `SemanticRoleAssignment` only when the category authority says its sole role accepts multiple captured products. Conditioner therefore assigns every captured Conditioner to `Conditioner` automatically. Other one-role categories keep the screen when the user must still choose which captured product fills the role; multi-role categories such as Oil also keep it when mapping is ambiguous.
2. For a role with no owned product, an alternative is eligible for a recommendation slot only when its server evaluation is `ideal`. Existing owned-product comparison eligibility remains unchanged in this slice. `supportive` may describe an owned product the user can keep, but it is never presented as a strict recommendation for an uncovered role.
3. A missing-product subject reuses the existing product comparison component:
   - first strict candidate fixed as `Empfehlung 1`;
   - one candidate occupies the full comparison width; with two candidates, `Empfehlung 1` and `Alternative 2` appear side by side; with three, the first remains fixed while the existing switcher browses candidates 2/3;
   - the same evidence table compares both candidates to the target; there is no `Deins` column or absent-product fit verdict;
   - tapping/focusing a candidate selects it, and one sticky CTA saves only that selected exact candidate ID/fingerprint;
   - `Produkt suchen` remains available without changing ownership.
4. When no strict candidate exists, show the selected honest search-first state. `Produkt suchen` is primary and `Vorerst ohne Produkt fortfahren` remains an explicit secondary action when authorized.

### Slice B — compact Bedarfsplan-style Routine

1. Replace the large completion hero with a compact `✓ Routine aktiv` header, `Deine Routine`, short Bedarfsplan bridge copy, `Anpassen`, and one `Anwendung ansehen` CTA.
2. Use selected option A: one category-colored horizontal card per final Bedarfsplan category, larger product image on the left, compact identity/cadence/purpose/status on the right, and `Details` as the disclosure boundary.
3. Remove nested per-role cards, fact-box towers, and inline expanded application prose from the overview. Multi-role categories remain one category card and expose compact purpose chips; full detail stays in the existing detail surface.
4. Preserve Basis → Optional → Later ordering, planned/pending/gap/retained truth, initial active Routine behavior, and successor comparison flow.

### Slice C — vertically stacked Anwendung shelves

1. Replace the mobile `snap-x` carousel and desktop grid with one vertical list of full-width day cards in canonical sort order.
2. Every day type uses the same full day-card + virtual-shelf composition. One-product days show one product on the shelf; no-product days show an honest rest placeholder on the same shelf.
3. Preserve distinct category silhouettes, but make them data-driven by product category rather than array position. Use the revised ten-family SVG silhouette map plus a neutral fallback: Shampoo large inverted squeeze tube; Conditioner extra-broad pump; Leave-in extended trigger sprayer; Heat Protection teardrop atomiser; Oil compact pipette vial; Mask low XL jar; Scalp Treatment long angled applicator; Dry Shampoo straight aerosol can; Bond Builder wedge-shaped inverted treatment tube; Deep Cleanse squared apothecary pump. Extend the presentation-only shelf slot with the category key required to select the correct silhouette.
4. Remove the inner white tile/padding. Standardized catalog images from the public `product-images` pipeline fill and clip to the silhouette against the shared `#f3f0e8` canvas, making the image rectangle disappear. Nonstandard or untrusted owner imagery uses the neutral contained-image fallback instead of pretending to blend. No runtime corner-color sampling is introduced.
5. Preserve provisional/open semantics with dashed outline, icon, accessible label, and local day status.
6. Replace the three top pills with one compact summary sentence derived from the same aggregate counts. Each partial day repeats only its local status; no state truth is discarded.

## 3. Scope and non-goals

In scope:

- Conditioner-safe sole-role auto-assignment for one or many captured products;
- strict uncovered-role recommendation eligibility and missing-product comparison/search states;
- comparison-column labels/selection behavior without a separate design system;
- Routine overview hierarchy, density, image scale, and responsive composition;
- Anwendung day-list layout, shelf-slot presentation contract, image/background treatment, and status hierarchy;
- red-first component, flow, authority, adapter, and browser coverage.

Out of scope:

- changes to the meaning of an owned product's `supportive` verdict;
- relaxing strict Oil role/thickness/protocol/weight eligibility;
- inserting a product into `user_products`, Routine, or executable Anwendung merely because it was viewed or searched;
- changing immutable portfolio/Routine schemas or semantic hashes for imagery/layout;
- changing provisional/unresolved compilation truth;
- migrations, deployment, runtime flags, production repair, or catalog writes.

## 4. Target map

### Stage 3

- `src/components/personal-plan-products/stage3-products-flow.tsx`
  - auto-assign all captures only for a sole role whose category authority explicitly permits multiple products;
  - provide the missing-product comparison selection state and existing search re-entry;
  - preserve exact decision save/recovery.
- `src/components/personal-plan-products/product-fit-comparison.tsx`
  - reuse `ProductCard`, alternative navigation, evidence matrix, and sticky action boundary;
  - parameterize compared product IDs/column labels for owned-versus-alternative and recommendation-versus-alternative modes, while retaining the current rich evidence matrix and rendering compact category criteria through their existing compact rows;
  - add an honest no-strict-candidate search state.
- `src/lib/personal-plan/products/fit-comparison.ts`
  - for uncovered roles, filter to `ideal` before ranking and applying the three-candidate cap so a pinned supportive candidate cannot hide a strict match;
  - retain supportive owned-product evaluation without converting it into a recommendation.
- category authority adapters under `src/lib/personal-plan/products/authority/categories/`
  - no scoring rewrite expected; verify every category/role's `ideal` semantics actually satisfy all critical target-bearing criteria;
  - if one adapter violates that invariant, fix that adapter with a deterministic regression rather than client-side filtering.
- Stage 3 search API/gateway remains the product-search authority and must accept only signed current/refined or inventory-only categories as already shipped.
- Tests:
  - `tests/personal-plan-stage3-flow.test.tsx`
  - `tests/personal-plan-stage3.spec.ts`
  - `tests/personal-plan-product-fit-comparison.test.tsx`
  - `tests/personal-plan/products/stage3-fit-comparison.test.ts`
  - `tests/personal-plan/products/stage3-authority.test.ts`
  - Stage 3 search API/gateway tests.

### Stage 4

- `src/components/routine/personal-plan/routine-page.tsx`
  - compact page header and primary/secondary action placement.
- `src/components/routine/personal-plan/routine-section.tsx`
  - preserve category grouping/order while tightening overview spacing.
- `src/components/routine/personal-plan/routine-item-card.tsx`
  - selected option A layout, larger left image, compact roles/cadence/status, detail boundary;
  - preserve planned/pending/gap/retained states and category color mapping.
- No change to `src/lib/personal-plan/routine/load-view.ts` or immutable payloads is expected; image/name hydration stays presentation-only.
- Tests:
  - `tests/personal-plan-stage4-ui.test.tsx`
  - `tests/personal-plan-stage4-route-ui.test.tsx`
  - `tests/personal-plan-routine-load-view-performance.test.ts`.

### Stage 5

- `src/components/application/application-overview.tsx`
  - replace pills with compact aggregate sentence and vertical day list.
- `src/components/application/application-day-card.tsx`
  - one full shelf card for every day type;
  - complete category-derived silhouette map, matched canvas color, full image clipping for standardized assets, and honest provisional/open/fallback states;
  - preserve existing `data-*` and accessibility hooks used by route/browser coverage.
- `src/components/application/application-types.ts`
- `src/components/application/application-view-adapter.ts`
  - make the shelf representation explicit for every day type and add the product category key to both product and open slots; preserve counts and product order.
- `src/lib/routines/personal-plan/application/compiler.ts`
  - no behavior change expected; category and status already exist on compiled product blocks.
- Tests:
  - `tests/personal-plan-stage5-view-adapter.test.ts`
  - `tests/personal-plan-stage5-route.test.tsx`
  - `npm run test:personal-plan-stage5`.

## 5. Designed user journey

### Stage 3 — product capture and role inference

1. The user captures one or several products in a category.
2. If the category has one required role **and** that authority permits multiple products in it (Conditioner), the system assigns all captured products to it and saves without showing a purpose question.
3. If several roles are possible—or a sole role still requires choosing one product—the current assignment screen remains and the user maps products deliberately.
4. Save, conflict, stale-authority, and lost-response recovery remain canonical and do not duplicate products or decisions.

### Stage 3 — owned product review

1. Existing owned-product reviews keep the current verdict-first matrix.
2. A supportive owned product may still be kept; this slice does not change the existing replacement policy for owned-product comparisons.
3. Selecting a replacement still persists only the exact selected product ID and fact fingerprint.

### Stage 3 — recommended category, no owned product

1. The page says that the product is missing; it never says an absent product `passt teilweise`.
2. With one strict candidate, it uses the full comparison width. With two, `Empfehlung 1` and `Alternative 2` appear side by side. With three, the first remains fixed and the existing switcher browses candidates 2/3. The same rich matrix—or existing compact criterion rows for compact categories—shows the candidates against the target.
3. The user taps one product card to select it. The single sticky CTA names the selected option and saves only that candidate after server revalidation.
4. `Produkt suchen` opens the existing category search. Viewing or selecting a search result does not mark it owned; the normal explicit plan/decision save remains required.
5. With no strict candidate, the page explains that no verified match currently satisfies every critical target. `Produkt suchen` is primary; continue-without is secondary when allowed.
6. Completion still proceeds directly to Routine after every role/product decision is resolved.

### Stage 4 — Routine

1. `/routine` opens with a compact active header and the first category card already visible in the initial mobile viewport.
2. Basis, Optional, and Later follow the final Bedarfsplan order. Each category appears once.
3. The larger left image and category color make the exact product recognizable. Cadence, purpose(s), and active/planned/pending/gap status are scannable without opening nested cards.
4. `Details` opens the existing full detail boundary. `Anpassen` retains the current edit/successor behavior. `Anwendung ansehen` opens Stage 5 only when its existing journey frontier permits it.
5. Missing images use the neutral category fallback; long names and multi-role categories wrap without increasing the card into a nested tower.

### Stage 5 — Anwendung

1. `/anwendung` shows one compact truthful summary sentence, then every canonical day card vertically in order. There is no horizontal carousel.
2. Every day card contains the same full virtual shelf. Product days show category-shaped product silhouettes; one-product days show one silhouette; rest/no-product days show an empty/rest marker on the same shelf.
3. Each standardized catalog image fills/clips to its mapped category silhouette and shares the `#f3f0e8` image canvas so no inner rectangle is visible. Nonstandard imagery uses a neutral contained fallback. Category is indicated by outline/shape, not a conflicting fill color.
4. Provisional products and open slots remain visibly and accessibly marked. A partial day carries one local status instead of repeating global pills.
5. Selecting a day opens the existing ordered application sequence. Back returns to the vertical overview and preserved context.
6. Missing or nonstandard imagery falls back honestly; it never stretches, recolors, or invents a product image.

### Completion and recovery

- no strict recommendation → search or explicit continue-without;
- search/API failure → retain manual intake/retry without losing current decision context;
- Stage 3 conflict/staleness → canonical reload before another save;
- Routine authority mismatch → existing fail-closed recovery;
- partial Anwendung → usable day with exact unresolved/provisional truth;
- missing image → neutral fallback inside the correct shelf structure.

## 6. Planning evidence

### Stage 3

- [Interactive missing-product states](mockups/2026-08-13-stage3-not-owned-strict-recommendations.html)
- [Rendered review image](artifacts/personal-plan-feedback-round-3/stage3-not-owned-strict-recommendations.png)
- Question answered: how to keep no-owned recommendations simple without introducing another maintained visual grammar.
- Feedback incorporated: Nick rejected the distinct recommendation card and selected the same two-product/table comparison grammar used for owned-product reviews.
- Evidence status: confirmed.

### Stage 4

- [Compared Routine options](mockups/2026-08-13-routine-density-options.html)
- [Rendered comparison](artifacts/personal-plan-feedback-round-3/routine-density-options.png)
- Question answered: image-left Bedarfsplan continuity versus a right-image composition.
- Selected: option A, image left.
- Evidence status: confirmed.

### Stage 5

- [Final stacked-silhouette artifact](mockups/2026-08-13-application-stacked-silhouettes.html)
- [Rendered final direction](artifacts/personal-plan-feedback-round-3/application-stacked-silhouettes.png)
- [Complete category silhouette map](mockups/2026-08-13-application-category-silhouette-map.html)
- [Rendered category map](artifacts/personal-plan-feedback-round-3/application-category-silhouette-map.png)
- Rejected exploration retained for history: [slot/free-product comparison](mockups/2026-08-13-application-stack-image-options.html).
- Questions answered: preserve category silhouettes, remove image-background seams, place days vertically, retain state truth without pills, and use the shelf composition for every day type.
- Feedback incorporated: category-filled slots and free-floating products were rejected; matched-background, full-image silhouettes and a full shelf per day were selected. Direct sampling confirmed the three supplied catalog assets use `#f3f0e8` at all corners. Two map revisions then moved from small bottle variations to ten deliberately different packaging families.
- Evidence status: complete ten-family silhouette map and matched-background full-shelf direction confirmed by Nick.

Disposition: commit the selected plan, findings, HTML mockups, and final rendered images with implementation. The rendered PNGs are intentionally ignored by the repository-wide `*.png` rule and therefore require explicit `git add -f` after final approval. Retain rejected HTML only as decision history; discard transient local image-download/color-sampling files and reviewer output.

## 7. Ordered tasks

### Task 1 — lock red Stage 3 regressions

Replace the current two-Conditioner role-screen expectation with a red test proving all Conditioner products auto-assign to its multiple-product sole role. Add a control proving a one-role/single-product role still asks the user which captured product fills it, and preserve paired multi-role Oil coverage. Add missing-product component fixtures for 1/2/3 ideal candidates, selected-card behavior, exact ID/fingerprint save, search, no strict candidate, and supportive-candidate exclusion. Audit every category/role's `ideal` semantics before implementation; add invariants proving every uncovered-role recommendation is ideal and satisfies all target-bearing critical criteria. If that audit fails, stop and revise the plan rather than silently rewriting scoring.

Completion: tests fail on `53745c22` for the reported behavior and distinguish policy from presentation.

### Task 2 — implement Stage 3 inference and strict comparison reuse

Narrow sole-role assignment to category authorities that explicitly allow multiple products in their sole role. For uncovered roles, filter strict candidates at the server-owned comparison boundary before ranking/capping, then parameterize the current matrix for recommendation-versus-alternative mode. Reuse the existing search and sticky-action boundaries. Preserve fingerprints, retries, exact save authority, and direct Routine handoff.

Consumes: current canonical draft, category policy, authority evaluation, bounded candidate facts.
Produces: saved sole-role assignments or a missing-product review containing 0–3 strict candidates and one selected exact candidate.

Completion: focused Stage 3 tests and hydrated mobile/desktop journeys pass for Conditioner, Leave-in, and each Oil role.

### Task 3 — lock and implement compact Routine

Add red component assertions for the compact header, one category card, bounded overview facts, no nested application-detail disclosure in the overview, and preserved statuses/actions. Implement selected option A without changing the Routine view/payload authority.

Consumes: existing grouped Routine view plus presentation-only image/name hydration.
Produces: compact Bedarfsplan-style overview; detail/successor behavior unchanged.

Completion: component tests pass and 390×844 plus desktop screenshots show header + first full card in the initial viewport, with long-name/multi-role/gap/pending cases contained.

### Task 4 — lock and implement vertical Anwendung shelves

Add red view/component/browser coverage for vertical order, absence of horizontal snap/scroll, the same required full shelf structure across multi-product/single-product/rest days, all ten category silhouettes plus fallback, standardized-vs-nonstandard image treatment, provisional/open semantics, preserved test hooks, and compact aggregate/local status. Extend only the presentation DTO needed for category shape.

Consumes: current compiled `category`, product order, image URL, status, provisional count, unresolved count.
Produces: vertical `ApplicationDayView` cards with category-shaped shelf slots and unchanged detail routes.

Completion: `npm run test:personal-plan-stage5` passes and mobile/desktop overview→day→back visual journeys match the selected artifact.

### Task 5 — integrated verification and review

Run focused Stage 3/4/5 tests, `npm run test:personal-plan`, typecheck, lint, build, `npm run test:playwright:personal-plan-stage3`, and the relevant Stage 4/5 Playwright journey at 375/390px and desktop. Verify no product-search action silently changes ownership, no image/layout field enters immutable hashes, exact candidate recovery remains valid, day order remains canonical, and every documented finding is covered. Run `ready-check` and the single `request-code-review` router on the integrated branch.

Completion: same-head checks are green, rendered evidence matches, no P1/P2 finding remains, and publication is ready for a separate explicit `ship it` gate.

## 8. Verification

Automated:

- focused red/green Stage 3 component, flow, authority, fit-comparison, search, and browser tests;
- Stage 4 UI/route/load-view tests;
- `npm run test:personal-plan-stage5`;
- `npm run test:personal-plan`;
- `npm run typecheck`;
- `npm run lint`;
- `npm run build`;
- repository `ci:verify` through `ready-check` when implementation is complete.

Manual/browser:

- Stage 3 at 375/390px and desktop: one/many Conditioner, multi-role Oil, owned supportive product, no-owned 1/2/3 ideal candidates, no strict candidate, search/retry, long names, exact selection/focus/keyboard behavior;
- Routine at 390×844 and desktop: active, planned, pending, required gap, optional, retained, multi-role, missing image, long name, successor attention;
- Anwendung at 390×844 and desktop: canonical vertical day order, multi/single/rest shelves, matched image canvas, provisional/open/fallback, partial and complete states, overview→day→back;
- no horizontal page/day rail overflow and no required content hidden by shell/footer navigation.

Migration/live-state:

- no migration or production write expected;
- pre-publication live check is read-only and confirms the candidate/catalog image contracts used by the exact tester journey;
- no new runtime flag for this response-shape/UI correction; rollback is the normal guarded revert/redeploy path;
- deployment and production activation remain separate authorization.

Evidence-sensitive review:

- compare implementation to the selected Stage 3, Stage 4 A, and final Stage 5 artifacts;
- reject any substitute design that reintroduces a new recommendation component, the large Routine hero, a day carousel, the three pills, index-based silhouettes, or a visible inner image rectangle.

## 9. Review and handoff

- Branch/worktree: `codex/personal-plan-feedback-round-3` in `.worktrees/personal-plan-feedback-round-3`, based on current `origin/main` `53745c22`.
- Baseline: focused diagnostic suite passed 126/126; several passing assertions intentionally encode the unwanted behavior and must be replaced red-first.
- Counterpart plan review: complete and reconciled. Accepted: Conditioner-only multiplicity guard, ideal-before-cap filtering for uncovered roles, explicit one-candidate layout, compact-category rendering, complete category silhouette map, standardized-image fallback, preserved test hooks, exact Playwright runner, and ignored-PNG handling. Rejected after repository verification: the claim that `implementation-loop`, `ready-check`, and `request-code-review` are unavailable; they are repository skills mandated by `AGENTS.md`.
- Evidence review: Stage 3, Stage 4 A, and the complete Stage 5 ten-family matched-background/full-shelf direction confirmed.
- Designed user-journey sign-off: confirmed by Nick on 2026-08-13 after counterpart reconciliation and two silhouette-distinction revisions.
- Rollout risk: uncovered-role candidate eligibility changes availability across categories; release only after exhaustive category/role invariant coverage. Owned-product comparison policy remains unchanged. Stage 4/5 are presentation-only but still require authenticated mobile journey review.
- Artifact disposition: selected plan/findings/mockups/renders `commit`; rejected option HTML `commit` as compact decision history; transient reviewer output and sampling files `discard`.
- Stop point: no production implementation, commit, push, PR, migration, deploy, activation, or production write is authorized by this planning pass. After sign-off, hand off to `implementation-loop`; later publication requires explicit `ship it`.
