# Frequency slider label alignment

## Outcome and source context

Make every eight-stop product-frequency slider show one concise, self-contained, two-line German label directly under its own marker at mobile and desktop widths.

Approved evidence:

- `plans/mockups/frequency-slider-alignment/simple-wrap-mobile.png`
- `plans/mockups/frequency-slider-alignment/simple-wrap-desktop.png`
- Evidence and feedback record: `plans/mockups/frequency-slider-alignment/README.md`

The approved label presentation is:

| Canonical value | Visible line 1 | Visible line 2 |
| --- | --- | --- |
| `less_than_monthly` | `<1×/` | `Monat` |
| `monthly_1x` | `1×/` | `Monat` |
| `biweekly_1x` | `Alle 2` | `Wochen` |
| `weekly_1x` | `1×/` | `Woche` |
| `weekly_2x` | `2×/` | `Woche` |
| `weekly_3_4x` | `3–4×/` | `Woche` |
| `weekly_5_6x` | `5–6×/` | `Woche` |
| `daily_1x` | `1×/` | `Tag` |

The selected-value readout and slider `aria-valuetext` retain the existing full canonical wording such as `1x/Woche`. Each clickable label button uses the joined visible wording, such as `1×/Woche`, as its accessible name so visible text remains present in the control name.

## Chosen direction

Keep one continuous eight-stop slider and its current pointer, label-click, and keyboard interaction. Extend the generic slider stop presentation with optional two-line display content, then position every label button from the exact same percentage used by its marker. Use one shared canonical frequency-to-lines mapping for every qualifying product-frequency slider.

Reserve a fixed `2.75rem` label lane and use `min(12%, 2.5rem)` label-button width for this approved eight-stop presentation. The 40 px cap keeps the widest two-line label readable and tappable while limiting each edge overhang to the existing 20 px page padding. Exact marker/label centers take precedence over clamping the edge labels; responsive verification must prove there is no page-level horizontal overflow.

Implementation note: the first 375 px browser run disproved the planning assumption that surrounding page padding alone would absorb the edge-label overhang; the last label extended 13 px beyond the viewport. The rail and label lane are therefore inset together by 40 px for the two-line presentation. This keeps every marker and label on the same coordinate system, leaves enough separation between neighboring labels, and retains both edge labels fully inside the viewport even while the Stage 2 view transition is active.

Do not distribute the labels with `flex justify-between`; label text width must no longer affect label centers. Do not introduce grouped time-unit bands, multiple rails, or a wrapped drag path.

## Scope and non-goals

In scope:

- Stage 2 wet-wash question: `Wie oft wäschst du deine Haare nass?`.
- Stage 3 product capture: every `Wie oft nutzt du …?` frequency picker, including catalog selection and fallback product intake paths that render `ProductFrequencyPicker`.
- Earlier onboarding product drilldown: the `Wie oft?` slider shown for each selected product category.
- Shared slider rendering, canonical two-line presentation metadata, component regressions, and responsive browser checks.

Inspected and out of scope:

- Stage 2 heat-tool frequency questions use option cards, not the affected slider.
- `RoutineFrequencyControl` is a separate target-guidance control with three deliberately placed anchors and no text-width drift; its model and presentation remain unchanged.
- Routine summaries/editors, profile summaries, chat intake selects, and Bedarfsplan copy use canonical frequency text but not the affected slider label row.
- No changes to frequency values, ordering, normalization, recommendation logic, persistence, analytics identities, question routing, or save behavior.
- No global rewrite of `PRODUCT_FREQUENCY_LABELS`; full labels remain authoritative for readouts, summaries, and accessibility.
- The Stage 2 `does_not_wash` option remains a separate choice below the slider.

## Target map

| Surface | Current role | Planned change |
| --- | --- | --- |
| `src/lib/vocabulary/frequencies.ts` | Canonical values, full labels, and compact-label helper | Add one authoritative two-line slider-label mapping/helper without changing canonical full labels. |
| `src/lib/vocabulary/index.ts` | Public vocabulary barrel used by onboarding and vocabulary tests | Export the new two-line helper and its type if separately named. |
| `src/components/ui/slider.tsx` | Generic rail, markers, thumb, and flex-distributed desktop/mobile label spans | Accept optional two-line display content, remove the `sm:inline`/`sm:hidden` split for stops carrying it, reserve the fixed label lane, and place each label at the marker's exact `index / maxIndex` coordinate. |
| `src/components/ui/frequency-slider-field.tsx` | Shared Stage 2 and Stage 3 frequency wrapper | Attach the canonical two-line display content to recognized product-frequency stops. |
| `src/components/personal-plan-refinement/refinement-options.tsx` | Stage 2 wet-wash slider caller | No bespoke layout; verify it inherits the shared mapping and preserves `does_not_wash`. |
| `src/components/personal-plan-products/index.tsx` and `stage3-products-flow.tsx` | Stage 3 product-frequency caller and options | Verify every Stage 3 frequency picker inherits the shared mapping; remove presentation duplication only if it becomes provably unused. |
| `src/components/onboarding/screens/product-drilldown-screen.tsx` | Direct `DiscreteSlider` usage with bespoke abbreviations | Replace the local string-replacement labels with the shared canonical two-line mapping. |
| `tests/product-frequency-vocabulary.test.ts` | Canonical vocabulary regression | Pin all eight visible line pairs separately from the unchanged full labels. |
| `tests/personal-plan-stage2-refinement-ui.test.tsx` | Wet-wash component regression | Pin two-line visible content, matching compact label-button names, canonical slider `aria-valuetext`, selected state, and the separate no-wash branch. |
| `tests/personal-plan-stage3-components.test.tsx` | Product picker regression | Pin shared line pairs, full `aria-valuetext`, disabled behavior, and eight-stop ordering. |
| Focused onboarding component test, added beside existing onboarding UI tests | Product drilldown regression | Prove the direct slider uses the same line pairs and preserves its full selected readout. |
| `tests/personal-plan-stage2-refinement.spec.ts`, `tests/personal-plan-stage1-2-3.spec.ts`, and `tests/personal-plan-stage3.spec.ts` | Responsive browser journeys and existing label selectors | Add geometry/overflow assertions and migrate label-button selectors from canonical ASCII names to the approved visible `×` names. |

## Designed user journey

Status: **confirmed by Nick on 2026-08-15**.

1. A user reaches either the Stage 2 wet-wash question, a Stage 3 product-frequency question, or an onboarding product drilldown.
2. The user sees the same continuous eight-stop rail and the same rare-to-daily order as today.
3. Beneath every marker is one concise label rendered on exactly two lines, for example `3–4×/` above `Woche`.
4. Each label center shares the exact horizontal coordinate of its marker. Long or short wording cannot shift neighboring labels.
5. The user clicks a label, clicks or drags the rail, or uses Arrow, Home, or End keys. The thumb, fill, selected label emphasis, and full selected-value readout update to the same canonical value.
6. On mobile, including 375 px, 390 px, and 430 px widths, all eight labels remain visible without horizontal scrolling or collision. On desktop, the same two-line system remains aligned and visually consistent.
7. Disabled/saving states preserve the current inability to change the value. Stage 2 users can still choose the separate no-wash option; doing so leaves the rail unselected exactly as today.
8. The user continues through the existing save and recovery flow. No persistence, conflict, retry, or completion behavior changes.

Meaningful variants:

- Stage 2 owns wet-wash-specific question copy and the separate no-wash choice.
- Stage 3 owns product-specific question copy and may render the same picker repeatedly for different products and categories.
- Onboarding owns its compact `Wie oft?` header but uses the same rail labels.

## Planning evidence

Evidence review: **confirmed** through iterative review on 2026-08-15.

- The original runtime captures proved that marker coordinates were correct while the `flex justify-between` label row drifted according to text width.
- Equal-column grouped, two-rail, and grouped-unit designs were rejected because they either remained cramped or introduced unnecessary visual structure.
- Nick clarified that each existing marker should keep one self-contained label that simply wraps to two lines.
- Nick approved the simple-wrap direction, then approved replacing `pro` with `/` to reduce density.
- The final selected mobile and desktop screenshots are the two `simple-wrap-*.png` artifacts linked above.

## Ordered tasks

### 1. Add canonical slider-display lines without changing frequency semantics

Consumes: the exact eight-line-pair matrix in this plan and existing `ProductFrequency` values.

Change `src/lib/vocabulary/frequencies.ts` to expose a typed helper or record that returns the approved two-line pair for every `ProductFrequency`, and export it from `src/lib/vocabulary/index.ts` for the direct onboarding caller and vocabulary tests. Keep `PRODUCT_FREQUENCY_LABELS`, metadata, aliases, sort order, and comparison helpers unchanged.

Add/update `tests/product-frequency-vocabulary.test.ts` to prove exhaustive coverage, exact German copy, and unchanged canonical full labels.

Produces: one typed, exhaustive `ProductFrequency -> readonly [line1, line2]` presentation contract.

Completion criterion: all eight canonical values return the approved pair and existing vocabulary tests prove no semantic label or normalization drift.

### 2. Align generic slider labels to marker coordinates

Consumes: optional two-line label content on `SliderStop`; existing marker percentage `index / maxIndex`.

Extend `SliderStop` with optional two-line display content. For stops carrying it, replace the current `hidden sm:inline` / `sm:hidden` label pair at every breakpoint with two explicit block elements; do not depend on incidental browser wrapping. Reserve a deliberate `2.75rem`-high relative label lane so content below never rises under the absolute labels. Absolutely position each label button with the same calculated percentage as its marker, `translateX(-50%)`, `white-space: nowrap`, and `width: min(12%, 2.5rem)`. Use `data-slider-stop-marker` and `data-slider-stop-label` plus the stop index/value as the shared geometry hooks.

The clickable label button must set an explicit `aria-label={line1 + line2}` (for example `3–4×/Woche`) so block-level text does not introduce an accessible-name space and the visible label is contained in its name. The slider track's `aria-valuetext` continues to use the canonical full label (for example `3-4x/Woche`). The single-line fallback is retained only for non-canonical test fixtures; both runtime callers use two-line frequency labels.

Keep the existing single-line/full-label fallback for non-frequency callers. Preserve pointer rounding, label clicking, dragging, keyboard navigation, disabled behavior, fill, markers, and thumb positions. Add stable test hooks only where required for geometry assertions; do not expose product-specific semantics from the generic component.

Add focused component coverage proving:

- the marker and label for index `i` emit the same `left: <n>%` inline style in rendered markup;
- two-line content renders as two explicit lines (with `<1×/` asserted as escaped `&lt;1×/` in static HTML);
- label-button accessible names match their visible compact text while slider `aria-valuetext` remains canonical;
- selected and disabled states remain intact;
- generic stops without two-line content still render.

Produces: a backwards-compatible `DiscreteSlider` presentation contract with geometry that cannot drift from its markers.

Completion criterion: static component tests prove matching emitted percentages, explicit line markup, and emitted accessibility attributes without special-casing the fourth stop inside the generic component. Click, drag, keyboard, and real pixel geometry are proven only by Task 4 Playwright checks.

### 3. Wire every qualifying product-frequency surface to the shared presentation

Consumes: the canonical two-line helper from Task 1 and slider contract from Task 2.

- In `FrequencySliderField`, attach two-line content whenever a stop value is a canonical `ProductFrequency`. This automatically covers Stage 2 wet wash and every Stage 3 `ProductFrequencyPicker` instance.
- In `product-drilldown-screen.tsx`, replace the local string-replacement abbreviation table with the same helper while keeping its existing selected full-label readout and direct `DiscreteSlider` use.
- Remove the now-unused compact-label path completely: `productFrequencyShortLabel`, `SliderStop.shortLabel`, the override block in `frequency-slider-field.tsx`, `Stage3FrequencyOption.shortLabel`, its passthrough in `index.tsx`, its construction in `stage3-products-flow.tsx`, and the onboarding `.replace()` chain. Repository search already shows no other consumers.

Update Stage 2, Stage 3, and onboarding component regressions to pin the correct visible lines, matching compact label-button names, and unchanged canonical selected-value readouts.

Rewrite the four obsolete Stage 2 assertions for `&lt; 1x/M`, `2 Wo.`, and full-label ordering, and migrate all affected role selectors in `personal-plan-stage2-refinement.spec.ts`, `personal-plan-stage1-2-3.spec.ts`, and `personal-plan-stage3.spec.ts` from names such as `1x/Woche` / `2x/Woche` to `1×/Woche` / `2×/Woche`. Do not change the slider track's canonical `aria-valuetext` assertions.

Produces: the same approved label system on all three mapped slider surfaces.

Completion criterion: repository search shows every `DiscreteSlider` product-frequency caller either receives the canonical two-line mapping or is explicitly documented as a different control; focused tests pass for Stage 2, Stage 3, and onboarding.

### 4. Verify responsive geometry and the complete user-visible interaction

Consumes: the wired component behavior from Task 3 and existing Labs/browser fixtures.

Extend the Stage 2 and Stage 3 Playwright coverage to assert at 375 px, 390 px, 430 px, and 1280 px that:

- all eight label buttons are present and remain within the viewport;
- each label center, including stops 0 and 7, matches its marker center within a one-pixel rounding tolerance while the edge boxes may occupy page padding;
- every label renders exactly two visible lines with the approved copy;
- choosing `1x/Woche` by label, rail/pointer, and keyboard keeps the thumb, label emphasis, full readout, and `aria-valuetext` synchronized;
- the page has no horizontal overflow;
- Stage 2 no-wash and Stage 3 disabled/saving behavior remain unchanged.

Cover onboarding with a deterministic markup-level `ProductDrilldownScreen` component regression and no new Labs or production route. The shared `DiscreteSlider` geometry is already proven in Stage 2/3 browser tests; manually inspect onboarding through the existing authenticated flow when the local environment is available, but do not make live Supabase credentials a focused-test requirement.

Capture final mobile and desktop screenshots from the unchanged real page layouts and compare them against the approved planning evidence.

Produces: automated geometry/accessibility proof plus final runtime screenshots.

Completion criterion: focused tests and responsive browser checks pass on the implemented component, and the final screenshots match the approved simple-wrap structure without collisions or overflow.

## Verification

Automated:

- `npm run test:node` for the vocabulary, generic slider, Stage 2/3 component, and onboarding component regressions under the repository's top-level test glob.
- `npm run test:playwright:personal-plan-stage3` to build once and then run both the Stage 3 lab suite and the Stage 2/integrated journey suite with their required gates and servers.
- `npm run ci:verify` for typecheck, full lint, and production build after focused tests pass.

Manual/browser:

- Stage 2 Labs wet-wash question at 375 px and 1280 px.
- Stage 3 Labs frequency selection after catalog choice and fallback intake at 375 px and 1280 px.
- Onboarding product drilldown at 375 px and 1280 px through a deterministic fixture or the existing authenticated journey when available.
- Check the rare, monthly, biweekly, weekly, and daily labels; do not validate only the selected fourth stop.
- Check label click, track click/drag, Arrow keys, Home, End, disabled state, and Stage 2 no-wash recovery.

Live-state/migration:

- No migration, Supabase write, production flag, deployment, or live-state verification is required for implementation readiness.

Evidence-sensitive review:

- Compare final screenshots with `simple-wrap-mobile.png` and `simple-wrap-desktop.png`.
- Treat any collision, one-line fallback, grouped unit decoration, or marker/label center drift as a blocker.

## Review and handoff

- Work only in `/Users/nick/AI_work/hair_conscierge/.worktrees/frequency-slider-alignment` on `codex/frequency-slider-alignment`.
- Run the repository `implementation-loop`; it owns `ready-check` and `request-code-review` before review-ready handoff.
- The counterpart review's claim that these skills do not exist is rejected: they are repository-owned Codex skills under `.agents/skills` and are mandated by `AGENTS.md`, not Claude commands under `.claude/`.
- Publication remains separately gated. No commit, push, PR, merge, deployment, or production activation is authorized by plan approval.
- User-journey sign-off was confirmed by Nick on 2026-08-15; implementation is authorized within this plan's scope.

Artifact disposition:

- **Commit:** this plan; a trimmed `README.md` that references only retained evidence; `capture-simple-wrap.mjs`; `simple-wrap-mobile.png`; `simple-wrap-desktop.png`; `capture-implemented.mjs`; and the final `implemented-mobile.png` / `implemented-desktop.png` runtime captures.
- **Discard before review-ready handoff:** `capture-current.mjs`, `current-*.png`, `proposed-*.png`, `frequency-slider-alignment.png`, `index.html`, `two-row-options.html`, and `two-row-options.png`. These are rejected or superseded planning explorations.
- **Archive:** none.

Residual risks:

- Edge labels extend around the first and last marker centers but are capped at 40 px; responsive verification across 375/390/430 px must prove they remain inside page padding without overflow.
- A visual-only test that checks text presence but not geometry would miss the original defect; marker/label center assertions are required.
- Onboarding uses the generic slider directly and can regress independently if its direct wiring is omitted.

## Findings ledger

| ID | Type | Evidence | Decision | Plan change | Revalidation |
| --- | --- | --- | --- | --- | --- |
| F1 | defect | Runtime marker positions use `index / 7`; label row uses `flex justify-between` with variable text widths. | accepted | Task 2 binds label and marker coordinates. | Geometry assertions at mobile and desktop widths. |
| F2 | scope/product decision | Two rails and grouped-unit variants added structure and looked worse. | rejected | Explicit non-goals; discard rejected artifacts. | Final screenshots compared only with simple-wrap evidence. |
| F3 | scope/product decision | User clarified every marker keeps one label wrapping into exactly two lines. | accepted | Exact line-pair matrix and explicit two-line rendering. | Component and browser text-line assertions. |
| F4 | scope/product decision | `pro` remained cramped; `/` was approved as the compact equivalent. | accepted | Exact line-pair matrix uses `/`. | Vocabulary and screenshot review. |
| F5 | tradeoff | Routine has a different three-anchor target-guidance slider without the reported drift. | deferred/out of scope | Documented inspected non-goal. | Repository search during Task 3. |
| F6 | defect | Counterpart review found that absolute buttons would collapse the in-flow label row. | accepted | Pin a `2.75rem` lane in Task 2. | Static markup plus browser spacing checks. |
| F7 | defect | Counterpart review found the existing `sm:` split could leave desktop on full labels. | accepted | Remove the split for two-line stops at all breakpoints. | Desktop screenshot and markup assertion. |
| F8 | defect | Counterpart review found the vocabulary barrel and README disposition were incomplete. | accepted | Add the barrel target and trim README to retained evidence. | Typecheck, import test, and link inspection. |
| F9 | tradeoff | Visible compact text would not be contained in canonical button aria-labels for edge values. | accepted with correction | Label buttons use joined visible text; slider `aria-valuetext` remains canonical. | Accessibility-name assertions and browser selection tests. |
| F10 | tradeoff | Exact edge centering requires label boxes to extend beyond rail endpoints. | accepted | Permit bleed into existing page padding; no clamping. | One-pixel center and zero-page-overflow browser assertions. |
| F11 | defect | Re-review found a fixed percentage width could overflow at 390/430 px. | accepted with correction | Cap width with `min(12%, 2.5rem)` and test common phone widths. | 375/390/430 px overflow and center assertions. |
| F12 | defect | Re-review found existing button selectors use canonical ASCII names. | accepted | Migrate all three affected browser spec files to explicit visible `×` names. | Composite Personal Plan Playwright script. |
| F13 | tradeoff | Slider labels use typographic `×`/`–` while canonical readouts and `aria-valuetext` retain existing vocabulary; daily marker says `1×/Tag` while readout says `Täglich`. | accepted from approved evidence | Limit typographic compact copy to label buttons; no global vocabulary rewrite. | Visual comparison plus separate button-name and track-valuetext assertions. |
