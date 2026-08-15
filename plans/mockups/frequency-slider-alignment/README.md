# Frequency slider alignment evidence

## Decision this evidence resolves

Make each of the eight frequency labels visually belong to the same discrete position as its marker and thumb, without changing values, persistence, or interaction semantics.

## Runtime finding

`DiscreteSlider` positions the rail markers and thumb at exact `index / 7` coordinates, but its label row uses `flex justify-between`. Because label widths differ, label centers do not share the marker coordinates. The drift is clearest for `1x/Woche` in the desktop capture.

## Approved evidence

`simple-wrap-desktop.png` and `simple-wrap-mobile.png` show the clarified treatment:

- Keep one continuous eight-stop rail and the existing interaction.
- Keep every marker in the same position.
- Give every marker one self-contained label forced onto exactly two lines, for example `3–4×/` / `Woche`.
- Position each two-line label from the same percentage as its marker instead of distributing labels by text width.
- Use the same concise German labels at desktop and mobile widths; the selected label remains plum and bold.
- Use `/` rather than the word `pro` to reduce horizontal density while preserving the familiar frequency notation.

The equal-column, two-rail, and grouped-unit explorations were rejected by user feedback and are intentionally not retained as durable evidence.

## Implemented evidence

`implemented-mobile.png` and `implemented-desktop.png` are fresh captures of the production component after implementation. `capture-implemented.mjs` records the deterministic Stage 2 Labs path used to create them. They retain the approved two-line structure while insetting the rail and label lane enough to keep both edge labels inside the 375 px viewport.

## Non-goals

- No frequency value, ordering, recommendation, persistence, or question-flow changes.
- No change to the separate `does_not_wash` option.
- No production component edits before designed-journey sign-off.
