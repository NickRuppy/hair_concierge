# Mask calibration round 2 — freeze-gate report (2026-10-06)

Standard: v0.5 · Reference: reference-key-v1 (round-1 sign-off 2026-10-06) · Blind lane: `blind-lane-v1/`
(zero-inheritance, Opus, attestations `prohibitedFilesAccessed: false` on all 19 records).

## 1. Cohort rerun — GATE PASS

**97/97 value cells agree, zero value disagreements** across the 12 classified products
(g0 + six profile fields + bond_route) plus the #13 exclusion reproduced. Bar: leave-in's
zero-value-disagreement gate. Confidence/marker-status differences were allowed and occurred
(e.g. the blind lane carries #02's bond crediting at *low* confidence with review routing —
the rules-only version of the E11 human resolution; #06's marker read as unresolved where the
key has plausible — see seam S1).

**Independence caveat (recorded by the lane itself):** the v0.5 standard's ruling notes name
several cohort products and outcomes (E2/E7/E10/E11/E12 annotations). The rerun on those
fields is confirmation-grade rather than perfectly blind; the unseen set below compensates.
The lane attests it derived every value from the rules, not the annotations.

## 2. Unseen adversarial set (6 products, example-disjoint)

| Product | G0 | cond / weight / care / repair / primary / secondary | bond |
|---|---|---|---|
| u1 Balea Plex Care 2in1 | in (Maske-Modus; Pre-Wash-Modus uncovered) | moderate / high (boundary oil) / protein (E12-capped) / medium / repair / – | none |
| u2 Wahre Schätze 1-Minute-Kur | in (single mode, 1 min) | moderate / high (boundary oil, seam S2) / moisture / low / general / – | none |
| u3 John Frieda Wunder-Kur | in (single mode, 3–5 min) | moderate / moderate / moisture (low conf, seam S3) / low / smoothing / – | none |
| u4 Isana Feuchtigkeit 3in1 | in (Kur-Modus; 2 leave-on modes uncovered) | moderate / moderate / moisture / low / general / – | none |
| u5 Olaplex N°.3PLUS | **excluded_pre_shampoo_bondbuilder_protocol** — trap passed | — | — |
| u6 Balea Silberglanz 2in1 | **excluded_color_depositing** (CI 60730) — trap passed | — | — |

Both traps were refused for the right reasons. u1's Plex claim earned `bond_route: none` +
`claim_formula_mismatch` + `bond_claim_review`, with the new E12 `tail_protein_cluster` flag
firing on its three tail proteins while the genuine above-tail Hydrolyzed Pea Protein @6
carried the protein route (orchestrator-verified against the packet INCI). Note: u2 and u3
were re-run once after their reserve packets were found defective (truncated INCI / unpinned
variant) and replaced with full dm/Müller verbatim captures — a packet repair, not a
classification retry.

## 3. Seam triage (combined ambiguity flags from both lanes)

Open for ruling before freeze (presented to Nick 2026-10-06):

- **S1 — Marker-plausibility scope.** Which species make a marker implausible under §3.1.1's
  architecture clause? Both lanes independently chose the "primary base" reading (tail-side
  co-quats/oils don't flip the marker); a strict reading would flip u3 (chelator above three
  heavy oils → weight could become high) and would have flipped cohort #07/#09/#08/#12.
- **S2 — Oil band mapping.** Lexicon "mid" band (soy/sunflower/apricot) vs the standard's
  R4a/R4b split is unmapped; on u2 a single boundary-position soy oil decides weight
  high-vs-low.
- **S3 — Balanced reading (b) clause-4 text + DPG class.** §9.3 says reading (b) "requires all
  four" clauses while its confidence rule contemplates clause-4 failure; and whether
  Dipropylene Glycol counts as humectant leg or solvent decides u3's care_direction
  (moisture vs the shelf's first real neither_dominant candidate).
- **S4 — Single-token repair headline.** u1's `repair` primary rests on one above-tail protein
  species; the focus-verdict text says "not merely one protein token".
- **S5 — Mode scoping vs product-form exclusions.** u6's Kur mode clears the mode test, but
  the lane excluded the whole product because the pigment acts in every mode; the standard
  should state that form exclusions are mode-independent.

Codified-by-triage (lane readings adopted as operational notes, no value impact): "nasses
Haar" post-wash reading; booster-above-preservative ordering only tests the marker species
itself; G0 needs an `insufficient_information` stop value distinct from charter exclusions;
E1 boundary note on full-list conjuncts is informational.

## 4. Status

Cohort gate: **PASS**. Freeze of v1.0 proceeds once S1–S5 are ruled and (if any ruling moves
an unseen value) the affected unseen records are re-derived. The cohort reference key is
untouched by S1–S5 (no cohort value depends on an open seam).
