# Conditioner-Vergleich: Zielprofil-Eignung entfernen, Haardicke als Dimension

**Branch:** `codex/conditioner-comparison-thickness`
**Status:** Implemented. Evidence review + journey sign-off confirmed by Nick 2026-08-17
(mockup `plans/mockups/conditioner-comparison-thickness.html`; journey unchanged — same screen,
row swap only). Color-coded row relations (green/yellow/red) confirmed preserved — they are
relation-driven in the existing component and apply to the new row automatically.

## Problem

The Stage-3 comparison table for conditioner carries a category-exclusive leading row
"Zielprofil-Eignung" (`conditionerTargetFitEvidenceRow`, `src/lib/personal-plan/products/fit-comparison.ts:581`).
It is a binary pass/fail gate, not a comparable dimension, its rationale is tautological
("Das Produkt muss das bestätigte Zielprofil vollständig abdecken."), and no other category has
an equivalent (bondbuilder's leading "Anwendung" row carries real product info and stays).
Conditioner is also the only wash-care category without a "Geeignete Haardicke" row, even though
its `targetFit` fact is internally derived from hair thickness + care direction
(`selectConditionerSpec`, `src/lib/personal-plan/products/authority/catalog-facts.ts:926`).

Decision (Nick, 2026-08-17): scratch the gate row entirely; add thickness as a normal dimension
computed like the other categories; verdict summary stays row-derived (counts / Im Ziel / Außerhalb)
plus authority verdict for the headline — same mechanism as every other category. If the dimension
cap turns out to be a problem, dropping thickness is the fallback, not keeping the gate row.

## Changes

1. **Remove the gate row** — delete `conditionerTargetFitEvidenceRow` and its call in
   `evidenceRowsFromDimensions` (`fit-comparison.ts:562`). Bondbuilder's leading row is untouched.
2. **Add conditioner thickness dimension** — in `conditionerDimensions` (`fit-comparison.ts:889`)
   append `conditioner.suitable_thicknesses` / "Geeignete Haardicke", kind `set`, `THICKNESS_STOPS`,
   target `input.hairThickness`, product value `facts.suitableThicknesses` — byte-for-byte the same
   pattern as `shampoo.suitable_thicknesses` (`fit-comparison.ts:876`) and
   `oil.suitable_thicknesses`. Relation resolves via the existing generic set-overlap path
   (`relationToTarget`), no conditioner-specific relation logic.
3. **Raise the dimension cap** — `dimensions.slice(0, 3)` → `slice(0, 4)` in
   `evidenceRowsFromDimensions` (`fit-comparison.ts:534`). Only conditioner produces 4 dimensions;
   all other categories keep their current tables.
4. **Reword the authority mismatch copy** (follow-up bundled in) — in
   `src/lib/personal-plan/products/authority/categories/conditioner.ts`:
   - `conditioner.role` fail message → name the concrete axes, e.g.
     "Keine Produktvariante deckt deine Haardicke und Pflegerichtung gemeinsam ab."
     (label "Conditioner-Zielprofil" → "Haardicke + Pflegerichtung" or similar; final copy at
     implementation, German, telegram style).
   - No behavior change to the authority verdicts themselves.
5. **Tests** — update `tests/personal-plan/products/stage3-fit-comparison.test.ts`
   (asserts `conditioner.target_fit` at ~855): assert the row is gone, assert the new
   `conditioner.suitable_thicknesses` row (target label, product values, `outside_target` relation
   on a thickness mismatch), and assert other categories' rows unchanged. Sweep
   `tests/personal-plan-product-fit-comparison.test.tsx` for gate-row references.

## Cross-category explainability (added during implementation, per Nick's request)

Audit finding: in the comparison view, criteria copy only rendered when no dimension table exists.
Any mismatch without a red row therefore showed "Passt nicht" over an all-green/yellow table —
today this hits safety/retired mismatches in every category, and post-change it would hit the
conditioner case where variants cover the user's thickness but none matches thickness + care
direction jointly (this is common, not rare).

Fix: `UnexplainedMismatchEvidence` in `product-fit-comparison.tsx` — renders the failing criteria
("Warum passt es nicht?") only when the verdict is mismatch AND no visible row is `outside_target`
for the owned product. All categories get it automatically; when a red row already explains the
verdict, nothing extra renders. The headline verdict stays authority-driven in all categories
(it gates allowed actions); rows + this block are the explanation layer.

## Verification

- `npm run ci:verify`
- Drive the flow: Stage 3 → Produkte prüfen → conditioner with a target-fit mismatch product;
  confirm table shows 4 dimension rows, no gate row, summary counts consistent, detail card
  auto-selects the failing row (`preferredEvidenceRow` needs no change — row-derived).
- Spot-check one non-conditioner category (shampoo) to confirm its table is unchanged.

## Evidence

- Mockup: `plans/mockups/conditioner-comparison-thickness.html` (before/after table)
- Evidence review: ☐ confirmed by Nick
- Journey sign-off: ☐ (existing journey unchanged except table rows; walkthrough = same screen,
  row swap only)
