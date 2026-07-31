# Hair portrait length progression

## Outcome and source context

The personal-plan quiz should show five unmistakably different hair lengths for every selected
texture, with one coherent visual step between adjacent choices. This plan responds to Nick's
2026-07-31 screenshot of the curly length question, where `Mittellang` and `Lang` appeared almost
identical.

The live 720×720 assets were measured by taking the lowest row containing at least 18 opaque
hair-fill pixels. The personal-plan-only `very long` overrides were included because they are what
the user actually sees.

| Texture  | Live endpoints (px)     | Live adjacent gaps (px) |
| -------- | ----------------------- | ----------------------- |
| Straight | 439, 466, 515, 575, 674 | 27, 49, 60, 99          |
| Wavy     | 415, 457, 504, 612, 659 | 42, 47, 108, 47         |
| Curly    | 413, 503, 559, 581, 697 | 90, 56, 22, 116         |
| Coily    | 416, 495, 574, 651, 694 | 79, 79, 77, 43          |

The curly `Mittellang → Lang` movement is only 22 px (3.1% of the source canvas), while the next
movement is 116 px. The funnel-only coily `very long` override is also 306 px wide after a 466 px
`long` asset and starts 24 px higher, so it changes head scale and width as well as length.

Done means the quiz and downstream portrait surfaces use one canonical 20-cell library with
unmistakably different adjacent choices at the approved 416/480/544/608/672 px endpoints, while
texture, line weight, framing, body composition, labels, and selection behavior remain unchanged.

## Chosen direction

Nick selected **A · Uniform ladder** on 2026-07-31 after comparing it with the targeted-repair
variant. This intentionally replaces the previously approved texture-specific/coily-compressed
spacing with one product-wide classification scale.

Use one shared anatomical ladder for all four textures:

| Quiz choice | Target endpoint | Canvas share | Intended landmark |
| ----------- | --------------- | ------------ | ----------------- |
| Sehr kurz   | 416 px          | 57.8%        | above/around ears |
| Kurz        | 480 px          | 66.7%        | jaw/chin          |
| Mittellang  | 544 px          | 75.6%        | shoulders         |
| Lang        | 608 px          | 84.4%        | chest/upper back  |
| Sehr lang   | 672 px          | 93.3%        | waist/lower back  |

Re-author only the canonical assets that fall outside the target tolerances. Use the existing
neighboring cells as image-edit references so the correction adds or removes visible hair rather
than mechanically stretching curl shapes. Preserve head size and silhouette width from one
neighbor to the next. Replace the two funnel-only overrides with the corrected canonical
`curly-very-long.webp` and `coily-very-long.webp`, then remove the override code and redundant files.

The 64 px ladder is a visual classification scale, not a claim that real hair grows in equal
anatomical increments or that curl shrinkage is identical across textures.

## Scope and non-goals

In scope:

- measure and correct the five length endpoints for straight, wavy, curly, and coily portraits;
- keep adjacent head scale and silhouette width coherent, especially for the two current overrides;
- make the shared portrait library the only source used by the personal-plan quiz and downstream
  portrait surfaces, including the main quiz portrait and protected portrait lab;
- add a repeatable asset-geometry regression gate and update the portrait handoff documentation;
- verify the real two-column mobile question for all four texture choices.

Non-goals:

- changing the five labels, descriptions, option order, card layout, selector behavior, or quiz
  answer values;
- changing texture classification, treatment mapping, recommendation logic, profile-summary
  photography, loading behavior, analytics, or result content;
- adding runtime CSS transforms or runtime image generation;
- regenerating cells that already satisfy the target and coherence tolerances without a visible
  quality reason.

## Target map

- `public/images/quiz/hair-portrait/{texture}-{length}.webp`: corrected canonical runtime assets;
  retain 720×720 transparent WebP output and the current palette.
- `public/images/funnels/personal-plan-quiz/portrait-curly-very-long.webp` and
  `portrait-coily-very-long.webp`: delete after the personal-plan override map has no callers.
- `src/components/personal-plan-quiz/personal-plan-quiz.tsx`: remove
  `PERSONAL_PLAN_PORTRAIT_OVERRIDES` and always resolve the canonical manifest asset.
- `scripts/portrait/measure-bounds.mjs`: measure hair-fill top, bottom, and maximum width in
  addition to raw alpha bounds; make the threshold and output usable by the regression test.
- `scripts/portrait/README.md`: replace the prior uneven/texture-specific hem record with the
  approved target ladder, tolerances, and candidate review process.
- `tests/hair-portrait-assets.test.ts` or one focused sibling test: assert geometry, canonical
  source selection, complete asset inventory, and absence of personal-plan overrides.
- `plans/mockups/2026-07-31-portrait-length-progression.html`: commit as the reviewed current versus
  target evidence.

## Designed user journey

1. A user selects their texture in the personal-plan quiz and reaches `Wie lang ist dein Haar?`.
2. The screen still presents the same five German answers in the same two-column card grid.
3. Every card shows the selected texture. The hair endpoint advances by one consistent visual step
   from `Sehr kurz` through `Sehr lang`; `Mittellang` and `Lang` no longer look interchangeable.
4. The user taps the closest length. The existing selected border, check indicator, answer
   persistence, and next-step behavior remain unchanged.
5. If the user goes back and changes texture, the same five target landmarks appear in the new
   texture without a width, head-scale, or framing jump in the `very long` cell.
6. Later portrait surfaces resolve the same corrected canonical texture×length asset, so the
   selected length does not visually change between the quiz and the profile/result experience.
7. Existing missing-answer and image-failure behavior remains unchanged. This work introduces no
   new loading, error, or recovery state.

User-journey sign-off: **confirmed by Nick on 2026-07-31 and reconfirmed after the final Coily
shape repair**. The correction changes only the visible silhouettes of `Mittellang`, `Lang`, and
`Sehr lang`; question order, labels, selection, persistence, canonical reuse, and recovery behavior
remain exactly as described above.

## Mockup evidence

- [Interactive current-versus-target comparison](mockups/2026-07-31-portrait-length-progression.html)
  uses the exact live assets and supports all four textures plus both target models.
- The left panel includes the live personal-plan overrides and measured endpoints.
- The right panel uses the canonical assets and an explicit geometry-only transformation to preview
  the 64 px ladder. It is not a production-asset proposal: implementation must re-author pixels so
  curl shape, head scale, width, and line weight remain natural.
- Desktop and 390×844 rendering were checked; all images loaded and the mobile page had no
  horizontal overflow.
- Variant A previews the universal 64 px ladder. Variant B leaves straight/wavy unchanged, repairs
  curly `long` to 622 px and coily `long` to 626 px, and replaces both overrides with the canonical
  `very long` cells.
- The final Coily current-versus-proposed review was rendered at product size on both product and
  dark backgrounds. The approved direction is preserved in the committed
  [product board](../scripts/portrait/review/2026-07-31-length-progression-product-board.webp) and
  [dark transparency board](../scripts/portrait/review/2026-07-31-length-progression-dark-board.webp):
  rounded cloud/bell silhouettes, gently tapering sides, and curved scalloped hems for
  `Mittellang`, `Lang`, and `Sehr lang`; `Sehr kurz` and `Kurz` remain unchanged.

Mockup review: **confirmed by Nick on 2026-07-31; option A selected; final Coily shape repair
approved and publication authorized after reviewing the current-versus-proposed overview**.

## Ordered tasks

### 1. Lock the measurement oracle before changing assets

- Extend the portrait measurement utility to report hair-fill `top`, `bottom`, and `maxWidth` from
  the committed 720×720 WebPs with one pinned oracle:
  - convert to RGBA;
  - qualifying hair-fill pixel has alpha `> 200`;
  - BT.601 luminance is `(0.299*r + 0.587*g + 0.114*b) / 255`;
  - qualifying luminance is strictly `> 0.78` and `< 0.985`;
  - a qualifying row contains at least 18 such pixels;
  - `top`/`bottom` are the first/last qualifying rows and `maxWidth` is the largest
    `maxX - minX + 1` span across qualifying rows.
- Add a focused failing regression test for all 20 canonical cells:
  - endpoint target ±8 px and adjacent-gap target ±12 px for the selected A or B contract;
  - adjacent `short` through `very long` maximum widths within 20%;
  - adjacent `short` through `very long` hair-fill tops within 32 px;
  - exactly 20 personalized 720×720 transparent WebPs plus the generic fallback.
- Assert that the personal-plan component has no separate texture×length source map.

Complete when the test fails on the current curly 22/116 px gaps and coily override-width class
without changing runtime behavior.

### 2. Produce and review corrected candidate assets outside the runtime directory

- Use image-editing with the current cell and its two nearest length neighbors as references.
- Preserve texture language, fill and ink colors, line weight, highlight treatment, canvas framing,
  transparent background, and existing `ownBody` behavior.
- Re-author the visible hairstyle first, then use the offline endpoint normalizer only for final
  pixel precision and preservation of the original cell's maximum width. Do not add a face, add a
  second body, change the card background, or introduce a runtime transform.
- Measure every candidate before it can enter `public/`.
- Render one white product board and one dark transparency/body-composition board covering all 20
  cells. Review endpoint rhythm, adjacent width, head scale, and exactly one body treatment.

Complete when all candidates pass the numeric oracle and the two boards show a coherent row for
each texture without new style or transparency defects.

### 3. Replace the canonical assets and remove funnel drift

- Copy only approved candidates over their canonical WebPs.
- Remove the two personal-plan override files and the override resolver in
  `personal-plan-quiz.tsx`.
- Keep the existing manifest, labels, answer values, shared SVG body, and `ownBody` flags unchanged.
- Update the portrait README with the approved ladder and the exact candidate/measurement workflow.

Complete when every portrait surface resolves through `PORTRAIT_ASSET_MANIFEST`, repository search
finds no personal-plan portrait override, and the focused asset tests pass.

### 4. Verify the real quiz and downstream reuse

- In the real personal-plan funnel, choose each texture and inspect all five cards at 390×844 and a
  representative desktop viewport.
- Render the main quiz portrait and the protected `/labs/portrait` gallery because canonical asset
  edits change those surfaces as well as the personal-plan funnel.
- Confirm the 64 px rhythm at product size, no clipping or overlap, one shoulder treatment per card,
  stable card/selector geometry, and no horizontal overflow.
- Select at least curly `medium`, curly `long`, and coily `very long`; continue and go back to confirm
  persistence and the existing selected state.
- Verify that a selected portrait on the later profile/result surface uses the same canonical file.

Complete when the designed journey matches the reviewed mockup and no interaction, accessibility,
or layout regression is visible.

## Verification

Automated:

- focused portrait geometry and source-selection tests;
- existing `tests/hair-portrait-assets.test.ts`;
- existing personal-plan quiz component and funnel-entry tests;
- `npm run test:node`;
- `npm run ci:verify`;
- `git diff --check`.

Manual/browser:

- all four texture rows in the actual two-column length question at 390×844 and desktop;
- current-versus-final product board plus dark transparency/body board;
- curly `medium` versus `long` and coily `long` versus `very long` called out explicitly;
- quiz back/change/selection persistence and downstream canonical portrait reuse.

No migration, provider, production-data, analytics, or medically adjacent verification is in scope.

## Review and handoff

- Worktree: `.worktrees/portrait-length-progression`
- Branch: `codex/portrait-length-progression`
- Plan artifact: commit with the implementation.
- Mockup artifact: commit with the implementation after Nick confirms the visual direction.
- Generated intermediate candidates and rejected boards: discard or archive outside the repository;
  never leave them unclassified in the worktree.
- Counterpart plan review: complete and reconciled.
- Mockup review: confirmed; option A selected.
- Designed-user-journey sign-off: confirmed.
- Implementation handoff: use `implementation-loop` only after both user-facing approval gates are
  confirmed.
- Implementation status: complete and locally review-ready on 2026-07-31. Publication remains a
  separate authorization.
- Publication: stop at a local review-ready branch; commit/push/draft PR require separate
  authorization.

## Implementation receipt

Final measured endpoints:

| Texture  | Final endpoints (px)    | Final adjacent gaps (px) |
| -------- | ----------------------- | ------------------------ |
| Straight | 415, 480, 545, 608, 674 | 65, 65, 63, 66           |
| Wavy     | 415, 480, 544, 612, 671 | 65, 64, 68, 59           |
| Curly    | 413, 480, 545, 609, 673 | 67, 65, 64, 64           |
| Coily    | 416, 483, 543, 609, 676 | 67, 60, 66, 67           |

- White and dark 20-cell review boards:
  `scripts/portrait/review/2026-07-31-length-progression-product-board.webp` and
  `scripts/portrait/review/2026-07-31-length-progression-dark-board.webp`.
- Final-review repair: regenerated `coily-short` with a continuous outer contour after the
  product-size review exposed dotted edge artifacts. The repaired canonical cell measures
  `64–483px` with `445px` maximum width and remains inside the approved ladder tolerances.
- Overview-review repair: regenerated `coily-very-short` after the same dotted edge artifact
  was visible at product size. The repaired canonical cell measures `106–416px` with `330px`
  maximum width and keeps the approved very-short endpoint.
- Final Coily shape repair: regenerated `coily-medium`, `coily-long`, and `coily-very-long` as one
  coordinated family after Nick rejected their parallel sides and flat hems. The approved cells
  measure `65–543px / 410px`, `42–609px / 420px`, and `41–676px / 399px` and retain the target
  ladder while replacing the rectangular silhouettes with rounded, gently tapered forms.
- Browser evidence: the real curly length question at 390×844 loaded the five canonical assets,
  showed 170×190 cards without horizontal overflow, and preserved `Mittellang` after continue/back.
  After the final Coily repair, the exact canonical `/labs/portrait` gallery rendered the approved
  five-cell Coily row on both white and dark backgrounds with no browser-console errors; its image
  URLs resolve directly to the shared `/images/quiz/hair-portrait/coily-*.webp` files.
- Automated evidence: focused portrait/quiz suite 17/17; repository Node suite 2,126/2,126;
  `npm run ci:verify` passed typecheck, lint, and production build. Lint retained four unrelated
  pre-existing warnings and produced zero errors. The task started from `30ce958f`; before push,
  remote metadata was refreshed and the final task commit was replayed conflict-free onto the
  then-current `origin/main`. The canonical content fingerprint remained identical across the
  replay.
- Counterpart whole-worktree code review: no hard defects. Its one actionable low-risk parser
  finding was fixed; the affected source and focused checks were rerun.
- Artifact disposition: implementation plan, approved mockup, canonical assets, two review boards,
  measurement/finalization tools, source simplification, and regression tests belong in the change.
  Generated source renders and chroma-key intermediates remain outside the repository; worktree
  candidates were moved to a temporary recovery archive and are not part of the change.

Residual risks:

- an image can satisfy the endpoint target while still changing curl character or apparent head
  size, so numeric gates cannot replace the two visual boards;
- `ownBody` very-short assets need special care because moving the entire image would also move or
  distort the shoulders;
- strict equal endpoints are a clarity device; if the product-size review makes one texture appear
  shorter because of curl shrinkage, that would be a product decision requiring Nick's approval,
  not an automatic tolerance change.

Rollback: static-asset and override-removal changes roll back together with a guarded Git revert;
there is no migration, data repair, or production-state cleanup.

## Counterpart review ledger

| ID  | Type                   | Evidence                                                                                                                         | Decision         | Plan change                                                                                                                                                  | Revalidation                                                                                       |
| --- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| C1  | scope/product decision | The uniform ladder replaces the 2026-07-22 approved texture-specific/coily-compressed ladder and would move roughly 15/20 cells. | accepted by Nick | Nick selected option A after comparing the interactive variants; the plan now preserves only the uniform path.                                               | Verify every texture against the 64 px ladder.                                                     |
| C2  | defect                 | The current script measures raw alpha, while the audit used an unstated hair-fill threshold.                                     | accepted         | Pinned canvas, alpha, luminance, row-count, and width formulas in Task 1.                                                                                    | Run the oracle twice against unchanged assets and compare byte-identical output.                   |
| C3  | defect                 | Canonical edits also affect the main quiz renderer and `/labs/portrait`.                                                         | accepted         | Named both surfaces in scope and manual verification.                                                                                                        | Browser-check both surfaces after asset replacement.                                               |
| C4  | tradeoff               | Global top/width gates can over-constrain generated raster art.                                                                  | accepted in part | Keep endpoint correctness automated; treat top/width as coherence guardrails plus visual-board review, and tune their exact enforcement after A/B selection. | Reject numerically passing assets with visible distortion; do not waive endpoint clarity silently. |
| C5  | defect                 | The plan lacked a rollback line.                                                                                                 | accepted         | Added guarded Git-revert rollback.                                                                                                                           | Verify assets and code removal land in one logical change.                                         |
