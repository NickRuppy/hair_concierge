# Personal Plan search-result status

## Outcome

Make Stage 3 product search read like a familiar ranked search result list instead of labelling every candidate with an unsupported confidence claim.

## Reviewed evidence and decision

- Reviewed surface: the production OGX search-result card showing `Wahrscheinlich dein Produkt`.
- Search relevance is already communicated by result order and the complete brand + product identity.
- `Wahrscheinlich dein Produkt` and `Eindeutiger Treffer` do not represent actionable states and imply more certainty than the current match heuristic supports.
- Nick approved removing both labels on 2026-08-12.

## User journey

1. The user searches for a product and sees ranked cards with image, full product name, and brand.
2. An ordinary ready result has no pill.
3. A result that cannot yet be assessed keeps the consequential `Analyse ausstehend` status.
4. Selecting a result adds the check and `Ausgewählt`; the user can still change the selection.

## Verification

- Component regression proves confidence labels are absent.
- The same regression proves pending-analysis and selected states remain visible.
- Stage 3 component suite, typecheck, and diff hygiene remain green.

## Non-goals

- No change to backend search ranking, confidence calculation, product identity, or selection behavior.
