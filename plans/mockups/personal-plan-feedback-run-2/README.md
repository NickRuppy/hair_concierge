# Personal Plan Stage 2 Wash-Frequency Mockups

Decision target: replace the current repeated clock-icon cards and detached 8 to 1 rail with a clearer, lower-noise frequency picker for `wet_wash_frequency`.

Source context used:

- Current question copy: "Wie oft wäschst du deine Haare nass?" with the existing lead text.
- Current option labels from `PRODUCT_FREQUENCY_LABELS`, displayed high-to-low as the existing `WetWashFrequencyScale` does.
- Later Stage 3 product-frequency pattern: `ProductFrequencyPicker` wraps `DiscreteSlider`, with options created from `PRODUCT_FREQUENCIES` and `PRODUCT_FREQUENCY_LABELS`.
- Existing selected-card convention: plum border/ring, white card surface, circular check control.

## Artifacts

- Interactive comparison: `index.html`
- Screenshot renderer: `render-screenshots.mjs`
- Approved evidence: `screenshots/variant-d-desktop.png` and
  `screenshots/variant-d-mobile.png`

## Variants

### Variant A - Integrated Rank Badges

The 8 to 1 ordering is moved into each card as a compact `N von 8` badge. This preserves ordinal frequency without the separate misaligned rail. It also removes repeated clock icons and keeps each row as a familiar large tap target.

Tradeoff: the number can still read as a score unless the `von 8` label remains visible. The risk is lower than the current detached rail because the number now belongs to the chosen cadence row.

Initial recommendation: this was the smallest conceptual change, but it retained the list pattern and did not create continuity with Stage 3.

### Variant B - Compact Frequency Ladder

Each row has a small left-side intensity marker instead of a number. The selected row inverts to plum, so the selected state is very obvious and the list becomes denser.

Tradeoff: the bars are less explicit than numbers for exact ordinal order. This is useful if the product wants to avoid anything that can look like scoring, but it asks the user to infer the direction from the "Häufiger/Seltener" labels.

### Variant C - Calendar Rhythm Cards

Each option leads with the concrete cadence as a chip, such as `2 x/Woche` or `<1 x/Monat`. It avoids abstract ordinal scoring entirely and makes the answer semantic.

Tradeoff: it is visually heavier and takes more vertical space on mobile because the card grid collapses to one column. It is strongest when the product wants literal cadence comprehension over compactness.

### Variant D - Stage-3-Frequency Slider

This mirrors the later Stage 3 product-frequency picker: one horizontal `DiscreteSlider` spectrum, low-to-high from `Seltener als 1x/Monat` to `Täglich`, with the selected full label shown above the slider and compact stop labels below. The Stage 2-only `does_not_wash` value is shown below as a secondary option, not as a ninth slider stop.

Tradeoff: it is the most familiar across the Personal Plan journey once a user reaches Stage 3, and it removes all repeated cards. It also changes the Stage 2 choice from a list scan into a drag/tap spectrum, so accidental selection precision and accessibility copy matter more.

Reuse decision: direct `ProductFrequencyPicker` reuse is not viable without leaking product-specific copy (`Wie oft nutzt du dieses Produkt?`, `Nutzungshäufigkeit`) into Stage 2. Direct `DiscreteSlider` reuse is viable for the interaction, but Stage 2 should extract or wrap a shared frequency primitive that accepts question-specific legend, aria label, selected-label copy, and a separate secondary slot for non-frequency answers such as `does_not_wash`.

## Final decision

Nick selected Variant D on 2026-08-12: use the same discrete slider presentation in Stage 2 and Stage 3, with `Ich wasche meine Haare nicht nass / mit Shampoo` kept as the separate Stage 2-only branch below it.

## Assumptions

- The selected example is `weekly_2x`; all other options show the unselected state.
- A-C keep the no-wash answer visually separated after the frequency list, matching the current information architecture. D keeps it visually separated below the slider so the branch remains available without becoming a ninth stop.
- These are planning artifacts only. No production component, test, migration, config, or runtime route was changed.
