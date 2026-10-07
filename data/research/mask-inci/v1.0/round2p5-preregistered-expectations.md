# Round 2.5 — pre-registered expectations (written BEFORE the blind lane ran)

Author: orchestrator session, 2026-10-06. Committed before dispatching the blind lane so that
deviations are provable surprises, not post-hoc rationalizations. Purpose: targeted validation of
the three value-moving round-3 rulings (E14, E15, E16) plus the E2 marker convention and the E13
mechanism, each on at least one fresh product the standard has never seen.

Expectations are at RULE level (what each targeted rule must do), not full 8-field predictions.
A lane outcome that honors every rule-level expectation counts as PASS even if untargeted fields
land differently than guessed; any violation of a rule-level expectation is a SURPRISE and goes
to Nick.

## q1 Wahre Schätze Avocado-Öl & Sheabutter (E14 heavy + E2 convention)

- **E2**: PARFUM sits last behind its own declared allergens (Linalool, Coumarin, Benzyl Alcohol)
  — the lane must NOT use it as the marker. Marker candidates are Caprylyl Glycol @10 (booster in
  a preservative pair with Benzoic Acid @14) or Benzoic Acid @14; either is acceptable, and an
  unresolved-marker verdict is acceptable if the lane argues the pair reading fails.
- **E14 heavy**: Shea Butter @9 must be read as HEAVY band. If the marker resolves at @10 or
  later, shea is above it and weight must be `high` (heavy anchor above marker). If the marker is
  unresolved, weight must fall conservatively (moderate + review), never `low` (sunflower @6 /
  avocado @8, both mid band, block the lean test under any reading that leaves them above ~1%).
- **E13**: whatever marker is chosen, Cetearyl Alcohol @2 + SAPDMA @3 (the establishing base)
  sit above it → marker plausible, not implausible.

## q2 Swiss-o-Par Arganöl (E14 mid)

- **E14 mid**: Argania Spinosa @7 sits above Parfum @9 — mid band. It must BLOCK `low` and must
  NOT alone establish `high`.
- Paraffinum Liquidum @4 is an occlusive — if the standard's occlusive/R4 rules independently
  support `high` via the occlusive stack, `high` is acceptable WITH that rationale; `high` justified
  by argan alone is a FAIL of E14. Expected outcome: `moderate` or occlusive-stack-justified `high`.
- Marker: Parfum @9, ordinary; establishing base (@2 Cetyl Alcohol, @3 Cetrimonium Chloride)
  above it → plausible (E13). Tail cationics (Cetrimonium Bromide @14) → candidate_below_tail,
  never implausible.

## q3 Syoss Intense Repair (E16 positive gate)

- **E16 PASS side**: Hydrolyzed Keratin @6 + Hydrolyzed Soy Protein @7 are TWO distinct
  qualifying hydrolysates above the marker (Parfum @11) → the repair headline gate is SATISFIED.
  Expected: care_direction `protein`, repair_support ≥ medium, primary_focus `repair`.
  If the lane withholds the repair headline here, E16's positive branch is broken → SURPRISE.
- **E13**: Amodimethicone @12 and Shea @13 below the marker → `candidate_below_tail` flag +
  review, marker stays plausible (base @2–@5 above).
- bond_route `none` ("Repair" naming + keratin is not bond chemistry).

## q4 Fructis Keratin Sleek (E16 interplay + booster limb + claim mismatch)

- **Booster limb (§3.1.1 third limb)**: Caprylyl Glycol @12 (booster) sits ABOVE Phenoxyethanol
  @15 (the first marker-class preservative) — this is the booster-above-preservative ordering
  involving the marker species itself → expected `tail_marker: unresolved` (the #11 Elvital case).
  A resolved marker with explicit reasoning why the limb doesn't fire is acceptable only if that
  reasoning is grounded in the standard's text; silently ignoring the limb is a FAIL.
- **E16 under unresolved marker**: the three proteins @9–11 cannot be certified "above the
  marker" if the marker is unresolved → repair headline must NOT fire; conservative values + review
  expected. (If the lane resolves the marker legitimately, three distinct hydrolysates above it
  satisfy E16 and `repair` headline is then correct — either way the GATE's logic must be cited.)
- **Claim mismatch**: product is named "Keratin" but contains NO keratin (corn/soy/wheat only)
  → `claim_formula_mismatch` must fire.
- **E14**: Sunflower @6 / Argan @7 mid band; Shea @8 heavy. Same reading obligations as q1.
- Directions: post-shampoo, several minutes, rinse → in_category, single mode.

## Disposition

- All four PASS → rules E13/E14/E16 + E2 convention hold on fresh products; freeze proceeds
  (E15 remains validated on u3 only — carried as a freeze note; no second natural candidate
  found on this shelf pass).
- Any SURPRISE → to Nick before freeze.

## Addendum (written before q5/q6 lane dispatch, after q1-q4 results)

q3's G0 stop was correct conservative behavior — the Rossmann directions genuinely omit the rinse
step (verified on the full page text), so the engine refused per §2.3; the E16-positive branch
therefore moves to q5, and q6 becomes the negative control.

## q5 Balea Professional Keratin Repair (E16 POSITIVE)

- Marker PARFUM @18, ordinary position (preservatives @19-20 behind it do not disturb it; no
  booster above it); establishing base @2-3 above → plausible (E13).
- **E16 PASS side**: FOUR distinct hydrolysates @7/@9/@10/@11, all above the marker → repair
  headline gate SATISFIED. Expected: care_direction protein, repair_support medium (no bond
  chemistry), primary_focus repair. Withholding the headline here = E16 overshoot = SURPRISE.
- E14: Glycine Soja @6 mid band → blocks low, no high alone; expected weight moderate.
- bond none ("Keratin Repair" naming is not bond chemistry).

## q6 Syoss Intense Keratin (E16 NEGATIVE control)

- Marker PARFUM @11; base @2-5 above → plausible. Amodimethicone @10 sits ABOVE the marker.
- **E16 FAIL side**: only ONE plain hydrolysate (Hydrolyzed Keratin @6, not quaternized) → repair
  headline must NOT fire; expected primary_focus general or smoothing (one silicone above marker
  is not an E9 system → smoothing focus likely unavailable → general), repair_support per its own
  rules (protein route present → medium), care_direction protein or moisture per §9.3 legs.
  A repair headline here = E16 negative branch broken = SURPRISE.
- Directions: the Anwendungshinweis block omits the rinse, but the same page's product
  description states it explicitly — packet carries both; G0 in_category expected. If the lane
  stops anyway, that is an acceptable §1.1-conservative outcome, recorded not failed.
- E13: Shea @12 below marker → candidate_below_tail + review.
