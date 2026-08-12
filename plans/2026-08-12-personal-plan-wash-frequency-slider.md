# Personal Plan wash-frequency slider

## Outcome

Replace the Stage 2 wet-wash frequency card stack and detached rank rail with the same discrete frequency-slider design used later for product frequency in Stage 3.

## Reviewed evidence and decision

- Reviewed mockup: `plans/mockups/personal-plan-feedback-run-2/`, Variant D on desktop and mobile.
- Product decision: use the eight canonical frequency stops from rare to daily.
- Keep `Ich wasche meine Haare nicht nass / mit Shampoo` as a separate option below the slider, not as a ninth stop.
- Reuse the same slider presentation and interaction as Stage 3; only the Stage 2 question copy, accessibility label, and separate no-wash branch differ.
- Nick approved this journey on 2026-08-12.

## Implementation

1. Extract the Stage 3 frequency field presentation into a small shared component around `DiscreteSlider`.
2. Use that shared field in both `ProductFrequencyPicker` and `WetWashFrequencyScale`.
3. Preserve the canonical `WetWashFrequency` value model and existing `does_not_wash` branch.
4. Remove the Stage 2 rank rail, repeated clock cards, and their obsolete styling hooks.

## User journey

1. The user reaches `Wie oft wäschst du deine Haare nass?`.
2. An eight-stop slider runs from `Seltener als 1x/Monat` to `Täglich`, matching the later product-frequency interaction.
3. Clicking a stop, dragging the thumb, or using the keyboard updates the selected label without leaving the question.
4. If the user does not wet-wash, they choose the separate button below the slider; the existing no-wash question path remains unchanged.
5. The user explicitly continues with `Weiter`; choosing a stop does not auto-advance.

## Error and recovery behavior

- Saving/disabled states disable slider pointer, label-button, and keyboard interaction using the shared component contract.
- Existing Stage 2 save conflict, retry, and resume behavior remains unchanged.
- A resumed `does_not_wash` answer highlights only the separate option and leaves the slider unselected.

## Verification

- Component regression for the eight canonical stops, selected value, slider accessibility, and no-wash separation.
- Regression proving the obsolete rank rail and repeated option-card icons are absent.
- Existing Stage 2 refinement flow tests and Stage 3 frequency-picker tests remain green.
- Typecheck, formatting, and rendered desktop/mobile flow inspection.

## Non-goals

- No change to frequency semantics or recommendation logic.
- No change to Stage 2 persistence or transition latency in this slice.
- No product-search changes; those ship separately in PR #371.
