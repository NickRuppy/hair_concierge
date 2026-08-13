# Stage 3 mismatch visualization research

Date: 2026-08-13
Status: five alternatives prepared for evidence review

## Question

How can the `Passt nicht` review communicate, with materially less reading, which verified product aspects miss the target and why the selected alternative is better?

## Current mockup review

The reviewed mismatch state is truthful, but it repeats the same conclusion in four places: the verdict, the two product cards, three rails, and three explanatory paragraphs. Its rails also make the user translate marker letters through a legend before understanding the actual values. The result is technically transparent but slower to scan than the decision requires.

The repair should make the visual carry these three facts without requiring paragraph reading:

1. which criterion is being checked;
2. where the owned product sits relative to the target;
3. whether the alternative resolves that exact mismatch.

## External guidance applied

- [W3C: Use of Color](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color): color must not be the only carrier of meaning. Every mismatch/match therefore combines color with `×`/`✓`, a shape, and a visible text value.
- [W3C: Labels or Instructions](https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions.html): enough guidance is required to complete the task, but excessive instruction can be equally harmful. The variants remove repeated prose while retaining explicit action labels and product/target values.
- [Carbon: Data visualization legends](https://carbondesignsystem.com/data-visualization/legends/): direct labels reduce the association work created by detached legends. Variants 2 and 4 place `Deins`, `Ziel`, and `Alternative` directly on the values or marks.
- [Atlassian: Data visualization color](https://atlassian.design/foundations/color-new/data-visualization-color/): shapes, patterns, and direct labels should reinforce color. The target uses a distinct band/target shape, not another colored dot.
- [GOV.UK: Tag](https://design-system.service.gov.uk/components/tag/): status treatments should be short, readable, and not resemble interactive controls. Result chips remain compact, sentence-case, and visually separate from buttons.

## Shared constraints

All five variants use the same authority facts and decision contract:

- owned Conditioner: light care weight, protein-focused, high repair support;
- target: medium care weight, balanced care focus, medium repair support;
- verified alternative: medium, balanced, medium;
- primary action: `Diese Alternative wählen`;
- contained alternatives: keep the owned product or continue without Conditioner.

No variant invents a percentage, aggregate fit score, importance weighting, or causal hair-care claim. `3 Abweichungen` is only a count of the three displayed verified criteria.

## Five structural alternatives

| Variant               | Visual model                                              | What becomes easier                                  | Residual risk                                                                |
| --------------------- | --------------------------------------------------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------- |
| 1. Status rows        | One compact diagnostic row per criterion                  | Fast, explicit scan of every failure and correction  | Still reads like a list rather than a picture                                |
| 2. Comparison matrix  | `Deins / Ziel / Alternative` columns                      | Exact comparison is densest and most auditable       | Three columns are tight on the smallest mobile widths                        |
| 3. Product scorecards | Each product owns a three-chip criterion profile          | Product-level conclusion is immediate                | Target values repeat across both cards                                       |
| 4. Direct-label rails | One mini rail with values attached to each mark           | Closest to the current concept, but no legend lookup | Rails take more vertical space than the matrix                               |
| 5. Mismatch spotlight | One dominant failure plus two compact supporting failures | Lowest reading load and strongest hierarchy          | De-emphasizing two failures can imply a weighting the authority does not own |

## Review criteria

At `400×822`, a first-time user should be able to answer within the first viewport:

1. `Passt mein Produkt?`
2. `Welche Eigenschaften passen nicht?`
3. `Löst die Alternative genau diese Abweichungen?`
4. `Welche Entscheidung speichert der rote Button?`

The selected direction must also remain truthful when criteria collide, when there is no verified alternative, and when a dimension has no authoritative target. Those states remain part of the parent fit-review plan and are not redefined by this comparison-only prototype.
