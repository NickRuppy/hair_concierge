# Routine card mobile restyle

## Outcome and source context

Restyle Stage 4 Routine so its product cards read as compact siblings of the shipped Bedarfsplan cards instead of wide desktop panels. The selected evidence is Option A in [`plans/mockups/2026-08-14-routine-card-bedarf-variants.html`](./mockups/2026-08-14-routine-card-bedarf-variants.html).

Source surfaces:

- `src/components/personal-plan-start/need-card.tsx` owns the Bedarfsplan card scale and category styling to inherit.
- `src/components/personal-plan-start/need-plan-screen.tsx` owns the Bedarfsplan content measure and page hierarchy to inherit.
- The user-provided Routine screenshot shows the current failure: oversized image and card area, status split across distant anchors, weak centering, and inconsistent information grouping.
- Official mobile guidance used only for presentation constraints: a card represents one coherent content unit, aligned content improves scanning, responsive layout must preserve hierarchy, and interactive targets remain at least 44–48 px.

## Chosen direction

Implement **Option A — Bedarfsplan sibling**.

- Constrain the Routine content column to the Bedarfsplan measure: `max-w-[430px]` by default and `sm:max-w-[560px]`.
- Use the Bedarfsplan page hierarchy: 11 px overline, 23 px mobile / 28 px larger-screen page title, 11.5 px mobile lead, 13 px section title, and no oversized display typography inside cards. Keep all supporting card labels and metadata at 11 px or larger.
- Use category-tinted 19 px cards with 10–12 px padding and a deliberately flat `58px × 76px` image well at every width. This is the Bedarfsplan narrow-mobile image size and stays smaller than its ordinary `66px × 82px` image. The image remains centered inside its well and never grows into a separate desktop visual column.
- Use one fixed reading order: category → exact product → purpose → `cadence · timing · status`.
- Remove purpose pills, floating fit/status badges, the distant active-count label inside each card, and the detached `Details` text action.
- Make the relevant card or item row the single detail affordance, with a right-pointing chevron and a minimum 44 px target. It continues to call the existing `onItemDetail` bottom-sheet flow and does not introduce a second detail implementation. Unlike Bedarfsplan's inline expander, the Routine button has no `aria-expanded`, `aria-controls`, or rotating/down chevron.
- Omit the redundant default `✓ Passt` presentation. Preserve consequential states in plain text: planned purchase, pending review, conscious override, missing Basis item, excluded/not recommended, and later/optional state.
- Collapse status and fit to exactly one plain-text row value with this precedence: if `getRoutineStatus(...).label` is anything other than `Aktiv`, show it; otherwise show a non-default fit label such as `Bewusste Wahl` / `Mit Einschränkung`; otherwise show `Aktiv`. Never concatenate status and fit and never render the default `✓ Passt`.
- Preserve category grouping. A category with one Routine item is one compact actionable row. A category with multiple roles uses a non-interactive category shell with a small category header and renders each product/role as its own minimum-44-px actionable sub-row. The shell is never a button, so no nested interactive elements are created.
- Copy the exact Bedarfsplan category tint, border, and dot values into the Routine presentation component with an ownership comment; do not export or modify Bedarfsplan code and do not use Routine's current Tailwind amber/sky palette.
- Keep existing Routine actions in the page header and reflow them beneath the lead within the narrow measure. Do not implement the first mockup's fixed bottom CTA.
- Stack the existing header actions beneath the lead at every width; do not restore the current `sm:` side column inside the narrow measure.
- Apply the same `430px` / `560px` measure and 23 px / 28 px heading hierarchy to the unavailable and authority-repair branch so Routine recovery does not revert to a wide `max-w-2xl` panel with a 3xl heading.
- Do not add a section-level product count; it was illustrative in the first mockup and adds no required Routine information.

## Scope and non-goals

In scope:

- Routine page width, type hierarchy, section spacing, card padding, image sizing/alignment, metadata grouping, status presentation, and detail affordance.
- Responsive behavior at narrow mobile, ordinary mobile, tablet, and desktop widths.
- Regression coverage for all existing Routine states and multi-role category behavior.

Non-goals:

- No changes to Bedarfsplan source, product selection, Routine compilation, authority, cadence calculation, persistence, proposal lifecycle, Stage 5 data, or product image source.
- No new pills, icon system, card abstraction, recommendation copy, animations, or data fields.
- No commit, push, PR, deployment, flags, migrations, or production writes in the implementation handoff.

## Target map

- `src/components/routine/personal-plan/routine-page.tsx`
  - Match the Bedarfsplan content measure and page type scale in both available and unavailable/recovery branches while preserving the existing actions, proposal copy, blocking-gap message, section order, and application gate. Stack actions beneath the lead at every width.
- `src/components/routine/personal-plan/routine-section.tsx`
  - Confirm whether any edit is required: its existing `space-y-2.5` already matches Bedarfsplan. Change only if a stable card-list hook or a demonstrated spacing correction is needed.
- `src/components/routine/personal-plan/routine-item-card.tsx`
  - Rebuild `RoutineCategoryCard` presentation around the selected compact row, copy the exact Bedarfsplan color values locally, preserve status semantics, and route card/item activation to `onDetail`.
  - Leave the currently unrendered singular `RoutineItemCard` untouched; deleting dead code is unrelated cleanup and would broaden the review surface.
- `tests/personal-plan-stage4-ui.test.tsx`
  - Update presentation assertions and add regression cases for the single-item affordance, multi-role item affordances, exceptional statuses, missing images, long product names, and removal of detached `Details`/default `✓ Passt` output.
- Browser evidence produced during implementation
  - Capture production-component output at 320 px, 390 px, 560 px, and desktop width using a local fixture/authenticated path. Keep final review screenshots with the PR only if they are durable evidence; discard any temporary harness.

## Designed user journey

Evidence-review status: **confirmed — Option A and supplemental single/multi-role states approved on 2026-08-14**.

User-journey sign-off: **confirmed on 2026-08-14**.

1. A Personal Plan user enters Stage 4 after exact products have been selected or opens an existing active Routine.
2. The page uses the same narrow, centered visual measure as Bedarfsplan. The user sees the existing Routine state, concise title and lead, then `Deine Basis` first.
3. Each product appears as a compact category-tinted row. A small, centered product image supports recognition; category, exact product name, purpose, cadence, timing, and actionable status follow one reading path.
4. Default fit does not create another badge or pill. Consequential states remain visible as plain text. A missing required Basis product keeps its explicit warning and continues to block `Anwendung ansehen`.
5. Tapping a single-product card opens the existing product detail sheet. If a category contains multiple roles, the category shell is static and each product/role row is separately tappable and opens the matching existing detail.
6. Optional and `Später ergänzen` sections keep their current order and semantics with the same compact layout. `Nicht verwendete Produkte` remains collapsed below them.
7. `Anpassen`, proposal review, and `Anwendung ansehen` remain available under their existing eligibility rules. Loading, unavailable, authority-repair, and proposal states retain their current recovery paths; only their surrounding visual hierarchy is aligned where shared Routine layout applies.
8. The user completes the page by opening a product detail, editing the Routine, reviewing a proposal, or proceeding to Anwendung exactly as before.

## Planning evidence

- Selected artifact: [`plans/mockups/2026-08-14-routine-card-bedarf-variants.html`](./mockups/2026-08-14-routine-card-bedarf-variants.html)
- State-completion artifact: [`plans/mockups/2026-08-14-routine-card-option-a-states.html`](./mockups/2026-08-14-routine-card-option-a-states.html)
- Question answered: how to make Routine cards smaller, properly aligned, and visibly related to Bedarfsplan without losing exact-product information.
- Selected direction: Option A, using Bedarfsplan hierarchy and scale with a `58px × 76px` product image and one plain metadata line.
- Feedback incorporated: rejected centered showcase cards, oversized typography, decorative metadata pills, dispersed status, inflated card height, and generic mobile-card styling.
- Counterpart-driven clarification: the selected direction now shows single-product and real multi-role category structures, preserves the existing detail sheet, keeps actions in the header, fixes the image at `58px × 76px`, copies the Bedarfsplan palette locally, and omits the illustrative section count.
- Evidence-review status: confirmed for Option A and its single/multi-role state completion.
- Artifact disposition: commit the selected HTML mockup; discarded the rejected first HTML direction and moved its generated screenshot to Trash.

## Ordered tasks

### 1. Establish red presentation contracts for the compact card

Consumes: existing `RoutinePage` fixtures, `RoutineCategoryCard` state helpers, and selected mockup rules.

Change `tests/personal-plan-stage4-ui.test.tsx` first so it requires:

- Bedarfsplan-aligned page/card hooks and compact layout tokens copied from `NeedCard`'s article/button grid and focus treatment;
- no detached `Details` label or default `✓ Passt` badge;
- one merged status value following the exact precedence rule above, with no contradictory or duplicated status/fit tokens;
- product name, purpose, cadence, timing, and consequential status in stable reading order;
- one detail activation target for a single-item category and one per item for a multi-role category;
- preserved Basis gap, planned purchase, pending review, override, optional/later, and missing-image behavior;
- both generated single-role and multi-role accessible names still include purpose, category, product, status, and cadence.
- explicit inversion/removal of the old assertions currently requiring three `Details` labels and `✓ Passt` in `tests/personal-plan-stage4-ui.test.tsx`, plus intentional updates to both aria-label generators and the exact accessible-name assertion after the final markup order is fixed.

Produces: failing focused component tests that distinguish the old dispersed card from Option A.

Completion criterion: the focused Stage 4 UI test fails for the intended presentation/interaction reasons before production edits.

### 2. Implement the Bedarfsplan-aligned Routine hierarchy

Consumes: the red tests and selected visual tokens.

Update `routine-page.tsx`, `routine-section.tsx`, and `RoutineCategoryCard` so the page measure, typography, category tints, image well, reading order, and whole-row detail affordance match the chosen direction. Preserve all existing action callbacks, eligibility rules, state labels, semantic grouping, and warnings. Reuse current helpers rather than duplicating status or cadence logic.

Copy Bedarfsplan's image inset (`h-[94%] w-[78%] object-contain`) and use `min-h-11` or a larger explicit minimum on every product button. Implement the single-status precedence as one local presentation helper backed by tests.

Produces: production components that satisfy the compact presentation contract with no Routine data changes.

Completion criterion: focused Stage 4 UI tests pass and the diff contains no changes under `src/lib/personal-plan/`, API routes, persistence, or migrations.

### 3. Verify responsive and state-complete behavior

Consumes: production component output from Task 2.

Run the focused Stage 4 component suite, scoped lint/type checks, and browser verification at 320, 390, 560, and desktop widths. Verify long product names, missing image fallback, single and multiple roles, Basis gap, planned product, pending review, informed override, optional/later sections, retained products, proposal state, and application gating. Check that cards do not overflow, images remain centered, interactive targets are at least 44 px, focus indication is visible, and keyboard activation opens the existing detail flow.

Produces: test output and responsive screenshots suitable for final review.

Completion criterion: automated checks pass and visual evidence matches the selected mockup at every required width without horizontal overflow or clipped text/state.

## Verification

Automated:

- `node --import ./tests/server-only-register.cjs --import tsx --test tests/personal-plan-stage4-ui.test.tsx`
- `npm run test:personal-plan`
- relevant Personal Plan browser journey checks selected by the repository ready-check / CI path classifier
- scoped ESLint for changed TSX/test files
- repository typecheck or the narrowest repository-approved equivalent, with unrelated blockers reported exactly

Manual/browser:

- 320 px: no image/text collision, product name remains readable, and each action target remains usable.
- 390 px: selected Option A hierarchy matches the reviewed artifact.
- 560 px and desktop: the Routine remains centered and does not expand into wide horizontal panels.
- Keyboard: focus is visible and Enter/Space opens the matching existing product detail.
- State matrix: active, planned, pending, override, missing Basis, optional/later, multi-role, missing image, long name, proposal, and retained-product states.

Migration/live-state checks:

- None. No database, migration, feature flag, deployment, or production write is in scope.

Evidence-sensitive review:

- Compare production screenshots directly with the selected mockup and the Bedarfsplan source component tokens.
- Confirm no weak/default fit state is promoted into a decorative badge and no consequential state disappears.

## Counterpart findings ledger

| ID  | Type                   | Evidence                                                                             | Decision                      | Plan change                                                                                       | Revalidation                          |
| --- | ---------------------- | ------------------------------------------------------------------------------------ | ----------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------- |
| C1  | defect                 | A whole-card button cannot contain per-role buttons for real multi-role categories   | accepted                      | Added a non-interactive category shell and separate product/role buttons; added state mockup      | Re-review revised plan                |
| C2  | defect                 | Existing tests explicitly require `Details`, `✓ Passt`, and an exact accessible name | accepted                      | Named the assertions that Task 1 must invert or update                                            | Focused red/green test run            |
| C3  | tradeoff               | Bedarfsplan palette differs from Routine's current Tailwind palette                  | accepted                      | Copy exact Bedarfsplan presentation values locally without changing Bedarfsplan                   | Screenshot comparison                 |
| C4  | scope/product decision | First mockup moved the CTA to a fixed bottom bar                                     | rejected                      | Keep and responsively reflow current Routine header actions                                       | Responsive browser review             |
| C5  | scope/product decision | Bedarfsplan uses `66×82`, shrinking to `58×76` below 360 px                          | accepted as flat smaller size | Pin Routine image to `58×76` at every width                                                       | 320–desktop screenshots               |
| C6  | scope/product decision | First mockup illustrated a section product count                                     | rejected                      | Do not add the count                                                                              | Markup assertion                      |
| C7  | tradeoff               | Singular `RoutineItemCard` is not rendered by Stage 4                                | deferred                      | Leave dead-code cleanup out of this visual change                                                 | Diff review                           |
| C8  | defect                 | Status and fit currently render from two sources and can duplicate or contradict     | accepted                      | Pin one-value precedence: non-active Routine status, then exceptional fit, then `Aktiv`           | State-matrix component tests          |
| C9  | defect                 | Focused Stage 4 test does not cover the full `personal_plan_journey` blast radius    | accepted                      | Require `npm run test:personal-plan` plus repository-selected browser journey checks              | Full suite run                        |
| C10 | tradeoff               | Recovery branch could retain a wide measure and oversized heading                    | accepted                      | Align recovery branch to the same 430/560 measure and 23/28 heading                               | Recovery screenshot                   |
| C11 | tradeoff               | Header actions could remain in a cramped `sm:` side column                           | accepted                      | Stack actions under the lead at every width                                                       | Responsive screenshots                |
| C12 | tradeoff               | Local token copy can drift from Bedarfsplan                                          | accepted                      | Keep the local copy with a source ownership comment; avoid a new shared abstraction in this slice | Diff review against `NeedCard` values |

## Review and handoff

- Worktree: `/Users/nick/AI_work/hair_conscierge/.worktrees/routine-card-mobile-restyle`
- Branch: `codex/routine-card-mobile-restyle`
- Planning evidence review: confirmed for Option A and supplemental single/multi-role states.
- User-journey sign-off: confirmed.
- Counterpart review: complete. First pass identified the multi-role interaction blocker; the second pass found no blockers and its remaining correctness/verification findings are incorporated above.
- Implementation gate after sign-off: `implementation-loop`, which will run repository ready-check and request-code-review before review-ready handoff.
- Artifact disposition: commit this plan and the selected HTML mockup with the eventual implementation; discard transient browser screenshots unless intentionally retained as PR evidence.
- Stop point: implementation-ready local changes only. Publication remains separately authorized.
