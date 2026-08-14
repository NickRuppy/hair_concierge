# Anwendung shelf silhouette refinement

Status: approved for implementation on 2026-08-14

## Outcome and source context

Refine the existing `/anwendung` overview shelves so every standardized catalog product is presented inside the approved category-specific bottle silhouette, against a shelf surface that is visibly distinct from the neutral product-image canvas. Products should read larger and closer together without outline overlap, while provisional, open, missing-image, rest-day, navigation, and accessibility behavior remain truthful.

Source context:

- Existing Stage 5 plan: [`plans/2026-08-13-personal-plan-feedback-round-3.md`](./2026-08-13-personal-plan-feedback-round-3.md)
- Existing integrated page mockup: [`plans/mockups/2026-08-13-application-stacked-silhouettes.html`](./mockups/2026-08-13-application-stacked-silhouettes.html)
- Final reviewed silhouette/product board: [`plans/mockups/2026-08-14-application-shelf-final-signoff.html`](./mockups/2026-08-14-application-shelf-final-signoff.html)
- User feedback incorporated on 2026-08-14: ten distinct minimal product-family outlines; larger products; adjacent outline frames without overlap; widened oil and dry-shampoo forms; exact silhouette-contained fill; shelf/background contrast; background-free representative examples for dry shampoo, scalp care, and deep cleansing; and a smaller mask image inside its jar outline.

## Chosen direction

Keep the existing server-rendered shelf and accessibility contract, but replace the current silhouette geometry and image-fit rules with the signed-off ten-category system.

Authoritative presentation contract:

1. Standardized `product-images` assets render over `#f3f0e8`, using the same category path for the base fill, image clip, and final outline.
2. Product imagery uses contained placement rather than `slice`; each category owns explicit image bounds so packshots remain legible and the mask keeps extra breathing room.
3. The shelf surface is `#e9e3ed`, visibly different from the product canvas. The wooden rail remains a secondary grounding element.
4. Shelf slot frames abut with no layout gap. Every category keeps the reviewed fixed `viewBox="0 0 120 180"`; the approved paths already include the intended internal insets and must not be normalized through computed or category-specific view boxes.
5. A shelf row contains at most five visible shelf slots, counting confirmed products, provisional products, and open placeholders because every slot consumes the same visual space. A sixth slot continues on a second shelf row instead of becoming tiny or overlapping. Every row owns its own wooden rail and shadow, and the day-card shelf scene grows by one row height. Empty/rest shelves stay on the existing single-row rest-day treatment and never enter the chunked product-row layout.
6. Confirmed, provisional, and open states retain their existing semantics. Category color remains the identity color; provisional/open state is expressed through dash treatment and the existing clock/open markers, not a conflicting fill.
7. Nonstandard owner images and missing images remain in the neutral contained fallback. There is no runtime AI background removal, corner sampling, or CSS blending heuristic. The product-intake pipeline remains responsible for producing either a transparent cutout or the canonical `#f3f0e8` canvas.

Approved category geometry and image placement:

| Category | Approved path | Image bounds `(x, y, width, height)` |
| --- | --- | --- |
| Shampoo | `M2 178V76Q2 59 19 53L34 48V31H86V48L101 53Q118 59 118 76V178Z` | `(-5, 20, 130, 160)` |
| Conditioner | `M20 178L13 49Q12 31 30 25H90Q108 31 107 49L100 178Z` | `(-4, 17, 128, 164)` |
| Leave-in | `M28 178V73Q28 58 43 58H48V42H43V23H78L112 34L104 50H76L69 58H80Q94 58 94 73V178Z` | `(4, 16, 112, 166)` |
| Hitzeschutz | `M24 178L33 101Q28 70 45 54V31H75V54Q92 70 87 101L96 178Z` | `(16, 24, 88, 158)` |
| Öl | `M24 178V88Q24 70 43 62V49L36 22Q35 9 50 8H70Q85 9 84 22L77 49V62Q96 70 96 88V178Z` | `(3, 4, 114, 176)` |
| Maske | `M10 178L17 91H23V72H97V91H103L110 178Z` | `(14, 72, 92, 102)` |
| Kopfhautpflege | `M31 178V76Q31 61 46 61H50V46H48V28H69L92 10L101 18L78 49V61H84Q98 61 98 76V178Z` | `(16, 8, 88, 170)` |
| Trockenshampoo | `M28 178V42Q28 27 45 21V10H75V21Q92 27 92 42V178Z` | `(18, 4, 84, 174)` |
| Bondbuilder | `M18 25H102L94 148Q92 163 80 166V178H40V166Q28 163 26 148Z` | `(8, 12, 104, 168)` |
| Tiefenreinigendes Shampoo | `M23 178V73Q23 58 38 58H46V41H58V25H96L110 31L103 45H74V58H84Q98 58 98 73V178Z` | `(13, 18, 94, 160)` |

## Scope and non-goals

In scope:

- The `/anwendung` overview shelf presentation in `ApplicationDayCard`.
- The ten category geometry definitions, per-category image bounds, close packing, five-item row chunking, and shelf/product surface contrast.
- Regression coverage for standardized/fallback imagery, ten category mappings, contained image fit, row chunking, state semantics, and accessible summaries.
- Desktop and mobile review of complete, provisional/open, fallback, single-product, multi-product, overflow, and rest-day shelves.

Non-goals:

- No change to Stage 4 Routine authority, Stage 5 compiler ordering, day definitions, application detail pages, cadence, product selection, ownership, or executable-state rules.
- No product-catalog data mutation, image upload, background-removal batch, Supabase change, migration, feature flag, analytics, tracker, or chat change.
- No runtime image analysis or background removal.
- No publication, deployment, production activation, merge, or worktree cleanup in this implementation authorization.

## Target map

- `src/components/application/application-day-card.tsx`
  - Replace the current silhouette geometry with the approved map.
  - Add typed image bounds and stroke-aware view boxes.
  - Render standardized imagery with `xMidYMid meet` using category bounds.
  - Split shelves into ordered rows of at most five items and apply the approved surfaces/spacing.
  - Preserve existing accessible link summary and fallback/state hooks.
- `tests/personal-plan-stage5-view-adapter.test.ts`
  - Add the presentation regression guard before implementation.
  - Cover the ten mapped shapes, contained fit, mask bounds, two-row overflow, fallback behavior, state hooks, and accessible shelf summary.
- `plans/mockups/2026-08-14-application-shelf-final-signoff.html`
  - Commit as the final reviewed visual evidence.
- `plans/2026-08-14-application-shelf-silhouette-refinement.md`
  - Commit as the implementation and verification contract.

## Designed user journey

1. An eligible Personal Plan owner opens `/anwendung` and sees the existing vertically ordered wash-day cards.
2. Each non-rest day shows its Routine-authoritative products in application order on a cool lavender-grey shelf surface.
3. Each standardized product appears inside the approved silhouette for its category. The warm neutral canvas exists only inside the silhouette, and the product packshot is contained without crop or stretch.
4. Products and open placeholders appear larger and their fixed-view-box slot frames meet edge-to-edge without the outlines overlapping. Up to five visible slots appear on one rail; a sixth slot starts a second rail, with its own grounding rail and shadow, inside a taller version of the same day card.
5. Confirmed products use a solid category outline. Provisional products retain the dashed treatment and clock marker. Open categories retain the dashed empty silhouette and `Offen` marker.
6. A mask remains visibly smaller than its jar silhouette. Oil and dry shampoo retain their wider approved containers so normal packshots remain legible.
7. If a product image is missing or outside the standardized catalog path, the existing contained neutral fallback appears instead of pretending that the background matches.
8. A rest day continues to show the quiet rest-day visual and no products.
9. The user activates the whole day card to open the existing application detail page. Product objects remain decorative; assistive technology receives the existing complete day-level summary of category, exact product, and confirmed/provisional/open state.
10. Loading, unavailable, compiler-failure, and detail-page recovery behavior remain unchanged. Completion is the same reopenable Anwendung reference, now with the signed-off shelf presentation.

User-journey sign-off: **confirmed** on 2026-08-14 by the explicit “ship it” instruction after the final walkthrough. The confirmation includes that open placeholders count toward the five-slot row cap and that a shipped rollback would be revert plus redeploy rather than a feature flag.

## Planning evidence

- `plans/mockups/2026-08-13-application-stacked-silhouettes.html` answered the integrated-page hierarchy question: vertically stacked canonical days with one shelf per day were selected over the mobile carousel.
- `plans/mockups/2026-08-14-application-shelf-final-signoff.html` answered category differentiation, image clipping, surface contrast, packshot scale, proximity, oil/dry-shampoo width, background removal in representative examples, mask breathing room, and the overflow composition: two vertically stacked five-item rows, each with its own wooden rail.
- Evidence-review status: **confirmed** on 2026-08-14 through the iterative review ending with “Yeah I kinda like that. It looks good.”
- Selected direction: the ten shapes, per-category bounds, warm product canvas, cool shelf surface, close non-overlapping packing, and transparent/canonical-background imagery encoded above.
- Prototype disposition: none. Static rendered evidence settled the presentation decisions; production behavior will be implemented directly with repository tests.

## Ordered tasks

### 1. Lock the presentation contract with a red regression guard

Consumes: the geometry table, image bounds, five-per-row rule, and existing `ApplicationPageView` test fixtures.

Change `tests/personal-plan-stage5-view-adapter.test.ts` so the current implementation fails for the intended reasons:

- standardized images must use `xMidYMid meet`, not `slice`;
- the exact ten approved `d` path values and per-category image bounds must replace the current geometry;
- mask uses the approved reduced image bounds;
- ten slots produce two ordered `data-application-shelf-row` rails of five, with a mixed fixture proving open placeholders count toward the cap;
- the scene hook emits `#e9e3ed`, the silhouette base emits `#f3f0e8`, and the old `#fffdfb` → `#f7efe7` shelf gradient is absent;
- existing fallback, confirmed/provisional/open, and accessible-summary assertions remain green.

Completion criterion: the focused test fails against the current tree only on the new presentation expectations, and the red proof is recorded in the implementation receipt.

### 2. Implement the approved silhouette and packing system

Consumes: Task 1 regression guard.

Produces: one typed silhouette contract containing path, category color, and image bounds while retaining the shared fixed `0 0 120 180` view box; standardized rendering that uses the contract consistently for fill, clip, image, and outline; ordered shelf rows capped at five slots, each with its own rail. The current unused silhouette `label` field is removed rather than carried into the new contract.

Implement row structure explicitly:

- add one `SHELF_SLOTS_PER_ROW = 5` constant and one pure order-preserving slice helper;
- when `day.shelf` is non-empty, map the full mixed slot array through that helper, so confirmed, provisional, and open slots all count;
- replace the fixed-height single flex scene with an auto-height outer shelf surface that stacks `data-application-shelf-row` wrappers;
- each row wrapper is a relative flex lane with zero inter-slot gap, enough top/bottom padding to contain the full SVG stroke and status markers, and its own absolute wooden rail plus shadow;
- preserve outer rounded clipping for the shelf surface only after manual verification proves no SVG stroke or marker is clipped; otherwise retain the rounded surface without clipping and keep all row decoration locally contained;
- keep the empty/rest branch separate, at the existing single-row height, with no product-row hook.

Change `src/components/application/application-day-card.tsx` without changing semantic DTOs or compiler order. Keep the card link as the sole interactive target and preserve all existing `data-application-*` and accessibility semantics unless a new stable hook is explicitly added by Task 1.

Completion criterion: the focused Stage 5 view-adapter test passes, `git diff --check` passes, and no unrelated file changes are present.

### 3. Verify the integrated responsive states

Consumes: completed Tasks 1–2.

Verify representative 390px mobile and desktop widths for:

- one confirmed product;
- a confirmed + provisional + open shelf;
- five and ten standardized products;
- mask, oil, dry shampoo, scalp care, and deep-cleansing shapes;
- missing/nonstandard image fallback;
- rest day;
- overview-to-detail activation and accessible day naming.

Completion criterion: focused automated checks and browser/manual evidence match the reviewed mockup, no outline overlaps or background rectangles are visible, and any deviation is reconciled before ready-check.

## Verification

Automated:

- Red/green: `node --test --import tsx tests/personal-plan-stage5-view-adapter.test.ts`
- Focused Stage 5 suite: `npm run test:personal-plan-stage5`
- Personal Plan suite if presentation dependencies expand: `npm run test:personal-plan`
- Repository hygiene: `git diff --check`
- Ready-check-selected typecheck/lint/build checks on the final tree.

Manual/browser:

- Render the authenticated Anwendung overview at representative mobile and desktop widths.
- Compare complete, partial, open, fallback, overflow, and rest shelves with `plans/mockups/2026-08-14-application-shelf-final-signoff.html`.
- Confirm neighboring outline strokes do not overlap, no outline stroke or status marker is clipped by the scene, the mask has visible internal breathing room, product imagery is not cropped, and the shelf surface is distinct from the product canvas.
- Confirm the day card remains the only interactive target and the detail route is unchanged.

Migration/live state:

- None. No migration, Supabase mutation, image upload, feature flag, deployment, or production write is required or authorized.

Evidence-sensitive review:

- Ready-check must record the exact content fingerprint and responsive visual evidence.
- Request-code-review must review the complete branch against `origin/main`; verification and review receipts must match the same fingerprint.

## Review and handoff

- Branch: `codex/application-shelf-silhouettes`
- Worktree: `.worktrees/application-shelf-silhouettes`
- Counterpart plan review: complete and reconciled after one blocker-driven recheck. Accepted findings are recorded below; transient output is discarded.
- Evidence review: confirmed.
- Designed-user-journey sign-off: confirmed on 2026-08-14.
- Implementation gate: cleared by the confirmed journey and explicit “ship it” authorization.
- Final implementation gates: `ready-check` followed by `request-code-review` on the complete tree.
- Artifact disposition:
  - commit: this plan, the final mockup evidence, production code, focused tests, ready-check receipt, and code-review receipt;
  - discard: transient Claude plan/code review output and temporary browser captures unless intentionally promoted into the receipt;
  - archive: none currently.
- Rollback boundary: this presentation-only change adds no feature flag. If it is later shipped and needs rollback, the rollback is a code revert plus redeploy. This tradeoff is included in the final journey confirmation before implementation.
- Stop point: verified review-ready local branch. Do not commit, push, open a PR, merge, deploy, activate flags, mutate production, or clean up the worktree without separate authorization.

## Findings ledger

| ID | Type | Evidence | Decision | Plan change | Revalidation |
| --- | --- | --- | --- | --- | --- |
| P-01 | scope/product decision | The catalog pipeline already standardizes final images to transparent cutouts composited on the neutral canvas; the current shelf recognizes the public `product-images` path. | accepted | Keep background cleanup in intake and retain a neutral runtime fallback; no runtime AI or sampling. | Focused fallback tests and responsive visual review. |
| P-02 | tradeoff | The approved paths intentionally retain category-specific internal insets inside one shared `0 0 120 180` view box. | accepted | Keep the reviewed shared view box and use gapless slot frames; do not compute or invent category-specific view boxes. | Five- and ten-product visual review at mobile and desktop widths. |
| P-03 | scope/product decision | The overview already exposes day cards as accessible links with decorative shelves. | accepted | Preserve the link-level shelf summary and keep product objects non-interactive. | Existing accessible-summary assertion plus browser accessibility inspection. |
| C-01 | defect | Counterpart review verified that the reviewed mockup uses the same `0 0 120 180` view box for all ten categories, while the first plan draft invented unspecified per-category view boxes. | accepted | Removed computed/stroke-aware view boxes from the contract, journey, tasks, and ledger. | Exact shared-view-box assertion and visual comparison. |
| C-02 | defect | The current scene is fixed-height with one rail; two product rows require explicit geometry. The reviewed final board already shows two five-item rows with one rail each. | accepted | Specify one rail and shadow per product row, dynamic day-card shelf height, and unchanged single-row rest-day handling. | Ten-product mobile/desktop visual review. |
| C-03 | defect | Existing tests already prove all ten category keys render, so that assertion alone cannot be the required red proof. | accepted | Require exact new path and image-bound assertions, plus `meet`, row hooks, and surface contrast. | Record focused red failure before component changes. |
| C-04 | tradeoff | A presentation-only change has no feature flag; rollback would require revert plus redeploy. | accepted | The user accepted the rollback boundary through the final walkthrough and explicit “ship it” authorization. | User-journey sign-off confirmed on 2026-08-14. |
| C-05 | defect | “Distinct surfaces” was not a checkable static-markup criterion. | accepted | Pin the test to `#e9e3ed` on the shelf, `#f3f0e8` on the silhouette, and absence of the old warm gradient. | Focused red/green test. |
| C-06 | scope/product decision | The shelf array mixes products and open placeholders; a visual cap must count one consistent unit. | accepted | Five visible slots per row, including open placeholders, were accepted through the final walkthrough and explicit “ship it” authorization. | Mixed-slot row test plus visual review. |
| C-07 | defect | The first corrected draft still named two rows without defining the fixed-height/single-rail DOM replacement. | accepted | Specify one cap constant, pure order-preserving chunk helper, auto-height outer surface, per-row relative lanes, and one rail/shadow per lane. | Ten-slot static markup and mobile/desktop visual review. |
