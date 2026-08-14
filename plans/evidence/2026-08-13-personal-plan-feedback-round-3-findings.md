# Personal Plan feedback round 3 — findings

Date: 2026-08-13
Source: eight authenticated screenshots supplied by Nick, current production deployment inspection, and a read-only trace of `main` at `53745c22bf2a3041959920a860677646ac929303`.

Implementation disposition: all findings below are implemented and locally verified on `codex/personal-plan-feedback-round-3`; publication and production remain separate gates.

## Executive finding

The screenshots expose three different classes of problem:

1. **Logic/policy defects in Stage 3:** a single-role category can still ask for role assignment when several products were captured, and a “supportive” alternative may be displayed even though it misses every strict target shown in the comparison.
2. **Missing user actions and catalog coverage in Stage 3:** a recommended category with no owned product can end in a passive empty state instead of offering verified recommendations and a product-search path.
3. **Visual implementation and direction gaps in Stages 4–5:** Routine diverges from the reviewed Bedarfsplan-first evidence; Anwendung deliberately uses a carousel and dense state pills, but Nick now wants a stacked, calmer presentation with better product imagery.

Production truth: `chaarlie.de` is currently serving Vercel deployment `dpl_Cf57hFwiYtsaeNJCTGGy5BCm796y`, status `READY`, built from exact Git SHA `53745c22bf2a3041959920a860677646ac929303` on `main`. The source findings below therefore describe the live artifact, not only local repository state.

## Findings ledger

| ID    | Stage | Reported symptom                                                                              | Classification                             | Confirmed cause                                                                                                                                                                                                                                                    | Proposed direction                                                                                                                                                                                                                                                                                         | Decision state                                             |
| ----- | ----- | --------------------------------------------------------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| F3-01 | 3     | Conditioner asks “Welche Aufgabe hat dein Conditioner?” although Conditioner has one purpose. | Logic/policy defect                        | The UI is skipped only for exactly one captured product plus one required role. Two or more captured Conditioners enter the role screen even though Conditioner legally supports only `conditioner_rinse_out` and uniquely permits several products for that role. | For Conditioner, assign every captured product to `conditioner_rinse_out` and skip the page. Other one-role categories still ask when several products were captured because their role accepts only one product and the screen chooses which one.                                                         | Implemented and verified.                                  |
| F3-02 | 3     | Product comparison does not look like the previously reviewed mockup.                         | Release/evidence mismatch                  | Screenshot 3 is the matrix shipped by PR #389. The earlier rail-based signed-off plan remained planning-only, then a later matrix direction was separately approved and shipped.                                                                                   | Treat the current matrix as live truth. Any redesign must start from the current matrix and today’s feedback, not the older rails artifact.                                                                                                                                                                | Confirmed; no question.                                    |
| F3-03 | 3     | Leave-in says it “passt teilweise” although no owned product exists.                          | Presentation-semantic defect               | The subject is an uncovered role, while the visible verdict describes the selected alternative. The page still uses owned-product comparison language and a `Deins` column with no product.                                                                        | Reuse the current comparison in a missing-product recommendation mode: compare two strict candidates side by side against the target, never frame an absent product as partly fitting, and never render a `Deins` column for it.                                                                           | Implemented and verified.                                  |
| F3-04 | 3     | The offered Leave-in alternative misses all three displayed targets.                          | Recommendation-policy mismatch             | Authority calls a candidate `supportive` when values are adjacent to target; the matrix marks only strict equality/overlap as “in target.” A candidate can therefore be eligible while showing three red misses. Current tests intentionally permit this.          | A product shown as a recommendation must satisfy every critical target-bearing dimension. Otherwise show no verified recommendation plus search/manual entry.                                                                                                                                              | Implemented and verified.                                  |
| F3-05 | 3     | Recommended Oil category with no owned product gives no useful action.                        | UX gap plus possible catalog-authority gap | With no eligible Oil candidate, the server allows only `leave_uncovered`; the UI shows “Noch kein Öl” and “Vorerst ohne Produkt fortfahren.” Candidate eligibility is strict by exact Oil role, thickness, protocol completeness, and leave-on weight.             | Always offer `Produkt suchen`. When verified candidates exist, show one recommendation plus up to two alternatives. When none qualify, say so honestly and keep search/manual entry available. Catalog gaps remain visible rather than being filled with a bad candidate.                                  | Implemented; all category-role strict-fit invariants pass. |
| F4-01 | 4     | “Deine Routine ist bereit” section is unnecessarily large.                                    | Visual implementation defect               | The live hero deliberately uses large padding and `text-4xl`/`sm:text-5xl`, occupying most of the first mobile viewport.                                                                                                                                           | Replace the hero card with a compact page header/status row. Keep `Anwendung ansehen` as the clear primary action without a large celebration block.                                                                                                                                                       | Implemented and verified.                                  |
| F4-02 | 4     | Routine cards are huge; imagery is small and left-heavy; page should resemble Bedarfsplan.    | Reviewed-evidence divergence               | The selected Stage 4 A artifact was Bedarfsplan-first with compact category-colored cards. Live cards add summary copy, role subcards, fact boxes, expandable details, and a small fixed `object-contain` image.                                                   | Restore the selected Bedarfsplan-first hierarchy: one compact colored card per category, larger recognizable product image on the left, concise cadence/status, details on demand.                                                                                                                         | Implemented and verified.                                  |
| F5-01 | 5     | Product images do not fill the shelf slots and the surrounding color feels wrong.             | Visual implementation defect               | Shelf slots are fixed narrow white boxes with padding and `object-contain`; the shelf background is a hard-coded warm gradient, independent of category. Catalog image URLs are forwarded unchanged.                                                               | Keep category-specific product silhouettes, remove the inner white card/padding, and make the silhouette canvas exactly match the catalog image background. Current sampled assets all use `#f3f0e8`; the full image fills/clips to the silhouette while the category remains visible through its outline. | Implemented and verified.                                  |
| F5-02 | 5     | Different days should be stacked, not a carousel.                                             | New product-direction decision             | Mobile explicitly uses `flex`, `snap-x`, `overflow-x-auto`, 82vw cards. This was the selected PR #387 carousel direction.                                                                                                                                          | Change mobile and desktop to a single vertical list of full-width day cards.                                                                                                                                                                                                                               | Implemented and verified.                                  |
| F5-03 | 5     | Anwendung status pills look bad.                                                              | Visual hierarchy issue, not false data     | The pills truthfully summarize partial days, provisional products, and unresolved details from the compiled Routine. Removing the underlying state would hide useful truth.                                                                                        | Replace the three decorative pills with one compact status sentence plus a local status on each affected day; retain exact counts/details where action is possible. Every day type uses the same full shelf-card composition.                                                                              | Implemented and verified.                                  |

## Detailed diagnosis and red-capable seams

### F3-01 — Conditioner should not ask an answerless purpose question

Current path:

- `Stage3ProductsFlow` renders `SemanticRoleAssignment` only when `phase === "roles"`.
- `canAutoAssignRoles` currently requires both `working.length === 1` and `requiredRoles.length === 1`.
- Conditioner legally admits only `conditioner_rinse_out`, but its category policy permits several captured products. Two captured products therefore force an unnecessary screen with one possible role.

Red regression:

- two captured Conditioner products plus the sole `conditioner_rinse_out` role must persist both assignments and never render `SemanticRoleAssignment`;
- a genuinely multi-role Oil category must still render role assignment when authority cannot infer a unique mapping.

Primary seams:

- `src/components/personal-plan-products/stage3-products-flow.tsx`
- `src/lib/personal-plan/products/authorities.ts`
- `tests/personal-plan-stage3-flow.test.tsx`
- `tests/personal-plan-stage3.spec.ts`

### F3-03/F3-04 — absent product and unsuitable-looking alternative

Current path:

- no owned product creates an `uncovered_role` subject;
- same-category active/recommended candidates are evaluated and ranked `ideal` before `supportive`;
- Leave-in considers adjacent values supportive;
- comparison evidence uses strict target equality/overlap, so the same candidate can show outside-target on every row;
- exact product ID and fact fingerprint are revalidated on replacement save, so this is not an arbitrary client-side candidate.

Red regressions:

- an uncovered role with candidates renders the current comparison grammar in recommendation mode with no `Deins` column and no owned-product verdict;
- a candidate outside every authoritative target cannot be labeled or actioned as a recommended replacement;
- candidate selection remains bound to the exact server-authored ID/fingerprint.

Policy decision:

- **Selected by Nick on 2026-08-13:** an alternative may be called a recommendation only when all critical target-bearing dimensions are in target. Otherwise show no verified recommendation plus search/manual entry.
- Rejected: “clear improvement” and “closest available” alternatives in the recommendation slot.

Primary seams:

- `src/lib/personal-plan/products/authority/categories/leave-in.ts`
- `src/lib/personal-plan/products/fit-comparison.ts`
- `src/components/personal-plan-products/product-fit-comparison.tsx`
- `tests/personal-plan-product-fit-comparison.test.tsx`
- `tests/personal-plan/products/stage3-fit-comparison.test.ts`

### F3-05 — recommended but not owned

Desired state contract:

- one verified best recommendation is primary;
- up to two additional verified alternatives are browsable;
- `Produkt suchen` is always available for a recommended category that the user does not own;
- if no candidate passes authority, the state says that no verified recommendation is currently available and still lets the user search/add a product;
- searching or planning a product never silently marks it owned or executable.

Red regressions:

- candidate present: recommendation plus alternatives plus search action;
- candidate absent: honest empty recommendation plus search action plus explicit continue-without;
- candidate missing exact Oil role, thickness eligibility, protocol, or required leave-on weight remains ineligible.

Primary seams:

- `src/lib/personal-plan/products/authority/categories/oil.ts`
- `src/components/personal-plan-products/product-fit-comparison.tsx`
- `src/components/personal-plan-products/stage3-products-flow.tsx`
- Stage 3 search API/gateway tests

### F4-01/F4-02 — Routine density and Bedarfsplan continuity

Current source deliberately creates the observed density:

- page hero: large padding and 4xl/5xl heading;
- category cards: summary, role rows, two fact tiles, expanded application details, and separate detail action;
- image: fixed 96×112 container with inner padding and `object-contain`;
- one-column mobile layout keeps imagery above/left until the `sm` breakpoint.

The retained Stage 4 A evidence already specifies the desired foundation: one category card per final Bedarfsplan category, category tint, recognizable product image, compact cadence/status, and detail disclosure.

Red verification:

- component assertions for one card per category and bounded information hierarchy;
- 390×844 and desktop rendered screenshots against the revised artifact;
- first viewport shows header plus at least the first complete category card;
- long product names and multiple roles do not overflow or recreate nested card towers.

Primary seams:

- `src/components/routine/personal-plan/routine-page.tsx`
- `src/components/routine/personal-plan/routine-section.tsx`
- `src/components/routine/personal-plan/routine-item-card.tsx`
- `tests/personal-plan-stage4-ui.test.tsx`

### F5-01/F5-02/F5-03 — Anwendung hierarchy

Current source deliberately creates the carousel and imagery treatment:

- overview: `flex snap-x overflow-x-auto`, grid only from `md`;
- day card: 82vw/min-270 nonshrinking snap card;
- shelf: fixed white 58px product slots, inset product art, warm hard-coded background;
- status pills: aggregate real partial/provisional/unresolved compiled state.

Red verification:

- mobile overview is a vertical list with no horizontal scroll/snap classes;
- every day is fully visible in document order and remains keyboard-accessible;
- category-shaped outlines with the matched `#f3f0e8` image canvas retain complete product identity and honest missing/planned state without category-filled tiles;
- one compact status summary preserves the same underlying partial/provisional/unresolved counts;
- selecting a day still opens the existing ordered application sequence and back returns to the same overview.

Primary seams:

- `src/components/application/application-overview.tsx`
- `src/components/application/application-day-card.tsx`
- `src/components/application/application-view-adapter.ts`
- `tests/personal-plan-stage5-view-adapter.test.ts`
- `tests/personal-plan-stage5-route.test.tsx`

## Scope boundary

This finding pass began as read-only diagnosis. Nick subsequently approved the selected evidence, final designed journey, and implementation. Commit, push, PR, migration, deployment, catalog publication, and production writes remain unauthorized.

## Baseline verification

The focused Stage 3–5 diagnostic suite passed **126/126** on the exact production source SHA. This is useful red-loop evidence because several passing tests explicitly encode the unwanted behavior:

- a supportive replacement is allowed while outside the displayed strict targets;
- multiple products in a category can enter role assignment;
- current Stage 4 content exists but has no responsive density/image-size contract;
- current Stage 5 tests preserve state truth but do not constrain carousel layout, shelf color, or image fill.

Command:

```sh
node --import ./tests/server-only-register.cjs --import tsx --test \
  tests/personal-plan-product-fit-comparison.test.tsx \
  tests/personal-plan-stage3-flow.test.tsx \
  tests/personal-plan-stage3-components.test.tsx \
  tests/personal-plan-stage3-contracts.test.ts \
  tests/personal-plan-stage4-ui.test.tsx \
  tests/personal-plan-stage4-route-ui.test.tsx \
  tests/personal-plan-routine-load-view-performance.test.ts \
  tests/personal-plan-stage5-view-adapter.test.ts \
  tests/personal-plan-stage5-route.test.tsx
```
