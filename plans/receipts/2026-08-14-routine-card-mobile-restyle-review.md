# Routine card mobile restyle — code-review receipt

## Review identity

- Branch: `codex/routine-card-mobile-restyle`
- Base: `origin/main` at `6ca24b64196d1d9414aa9ea1d25e5b9cf8e1a825`
- Reviewed canonical content fingerprint: `2d8f75a066ae800c06f62f28e4175ccce865ca14853615b8cb8e9eb859b7da11`
- Scope: all four modified implementation/test files plus the approved plan and two HTML decision mockups.
- Review lanes: normal correctness, responsive-layout, accessibility, and maintainability review in the main session; two read-only Claude counterpart passes at `high`, with the second pass run after the type-legibility correction.

## Findings and rulings

No blocking findings remain.

Resolved findings:

1. Supporting labels and metadata initially rendered at 8–10 px. The final design keeps every supporting card value at 11 px or larger, updates the retained mockups and plan contract, and was remeasured at four widths.
2. A missing Basis-product warning was visible but its button-level accessible name only exposed `Basis-Lücke`. The full warning is now included in the accessible name.
3. The single-item eyebrow used truncation on the flex container. Text now owns its own truncating span.
4. Status color initially followed raw availability, which could conflict with higher-priority excluded/not-recommended labels. The final mapping honors displayed-status precedence before availability.
5. Compact accessible names had dropped explicit field context. Whole-row buttons now announce `Zweck`, `Produkt`, `Kategorie`, `Status`, and `Rhythmus` explicitly.
6. The grouped-card count was not pinned. The focused UI test now asserts `2 Anwendungen` alongside the single category shell and separate role actions.

Confirmed intentional tradeoffs:

- The desktop content measure remains capped at 560 px because the approved Bedarfsplan-based direction is a centered, focused plan column rather than a wide desktop card grid.
- The overview shows one consequential status token. Routine-fit detail that is not the winning state remains in the existing detail sheet rather than becoming a second overview badge.
- The whole-row inward focus ring is retained to keep keyboard focus visible inside edge-to-edge grouped rows.
- The non-detail group rendering remains available for callers that intentionally provide a read-only overview; current Routine sections consistently pass the shared detail callback through.

## Verification considered

- Focused Stage 4 UI suite — 10/10 passed on the final tree.
- Full Personal Plan suite — 1479/1479 passed on the final tree.
- Final typecheck and scoped ESLint — passed with zero errors.
- Final exact-tree `npm run ci:verify` — passed with zero lint errors, typecheck success, and a production build with 126 generated routes.
- Browser verification — no overflow at 320, 390, 560, or 1280 px; four detail targets; minimum row height 82 px; minimum card font size 11 px.
- `git diff --check` — passed.

## Artifact disposition

- Commit later if publication is explicitly authorized: implementation, tests, approved plan, two HTML mockups, and readiness/review receipts.
- Transient preview route, screenshots, server output, and reviewer scratch files are not retained in the repository.
- No staging, commit, push, PR, merge, deployment, migration, feature activation, catalog publication, or production write occurred.

## Bottom line

Ready for a separate explicit `ship it` gate. No blocking findings.
