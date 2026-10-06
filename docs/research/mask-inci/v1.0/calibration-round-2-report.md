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

Presented to Nick 2026-10-06 — **all five RULED the same day (E13–E17, Standard v0.6; ledger `plans/mask-inci/round1-rule-rulings.md`, "Escalation rulings (round-3, 2026-10-06)")**:

- **S1 — Marker-plausibility scope.** Which species make a marker implausible under §3.1.1's
  architecture clause? Both lanes independently chose the "primary base" reading (tail-side
  co-quats/oils don't flip the marker); a strict reading would flip u3 (chelator above three
  heavy oils → weight could become high) and would have flipped cohort #07/#09/#08/#12.
  **RULED — E13:** leave-in T16 wording; only species *establishing* conditioning/weight can make
  the marker implausible; below-marker extras earn nothing, carry `candidate_below_tail`, and route
  to review where they would have qualified an anchor. No value moves.
- **S2 — Oil band mapping.** Lexicon "mid" band (soy/sunflower/apricot) vs the standard's
  R4a/R4b split is unmapped; on u2 a single boundary-position soy oil decides weight
  high-vs-low.
  **RULED — E14:** three bands; heavy (butters, lanolin, coconut, castor) = R4b; mid (olive, argan,
  soy, apricot, sunflower, macadamia …) blocks `low`, never makes `high`; light = R4a. u2 weight
  `high` → **`moderate`**. Cohort near-miss recorded: reference-key-v1 #08 places
  `Helianthus Annuus Seed Oil` @17 *above* its marker (Potassium Sorbate @18); under E14 that
  reading would block #08's `low`. The blind lane's marker (`Leuconostoc/Radish Root Ferment
  Filtrate` @15, an R8 tail-class preservative) puts the oil in the tail and keeps `low`. The key's
  value stands but its marker reading should be checked against §3.1's R8 list before freeze
  (key not edited here).
- **S3 — Balanced reading (b) clause-4 text + DPG class.** §9.3 says reading (b) "requires all
  four" clauses while its confidence rule contemplates clause-4 failure; and whether
  Dipropylene Glycol counts as humectant leg or solvent decides u3's care_direction
  (moisture vs the shelf's first real neither_dominant candidate).
  **RULED — E15:** DPG and carrier/solvent glycols of its class are solvents, never humectant legs
  (lexicon family 7 note); reading (b) requires all four clauses and is unavailable when any fails.
  u3 `care_direction` `moisture` (low) → **`balanced` / `neither_dominant` (moderate)** — reading
  (b)'s first reached case.
- **S4 — Single-token repair headline.** u1's `repair` primary rests on one above-tail protein
  species; the focus-verdict text says "not merely one protein token".
  **RULED — E16:** the `repair` headline needs `bond_route ≠ none` or a label-strong protein route
  (≥ 2 distinct hydrolysates, or one quaternized protein derivative, above the marker); one plain
  hydrolysate keeps its care route and `repair_support_level` but not the headline. u1
  `primary_focus` `repair` → **`general`** (secondary stays empty). Cohort #05/#08 pass the gate.
- **S5 — Mode scoping vs product-form exclusions.** u6's Kur mode clears the mode test, but
  the lane excluded the whole product because the pigment acts in every mode; the standard
  should state that form exclusions are mode-independent.
  **RULED — E17:** formula-level exclusions (pigment, bond-builder chemistry-plus-protocol) apply
  to the whole product in every mode. u6 unchanged.

Codified-by-triage (lane readings adopted as operational notes in v0.6, marked "round-2 triage,
2026-10-06", no value impact): "nasses
Haar" post-wash reading; booster-above-preservative ordering only tests the marker species
itself; G0 needs an `insufficient_information` stop value distinct from charter exclusions;
E1 boundary note on full-list conjuncts is informational.

## 4. Status

Cohort gate: **PASS**. **All seams S1–S5 ruled (E13–E17, 2026-10-06); Standard v0.6.** Three
unseen values moved and the affected records were re-derived under v0.6
(`rederivedUnder: "mask-inci-v0.6 (E13-E17)"`), not patched:

| Record | Field | v0.5 lane | v0.6 |
|---|---|---|---|
| u1 Balea Plex Care 2in1 | primary_focus | repair | **general** (E16) |
| u2 Wahre Schätze 1-Minute-Kur | weight_potential | high | **moderate** (E14); thickness echo gains `fine` |
| u3 John Frieda Wunder-Kur | care_direction | moisture (low) | **balanced / neither_dominant (moderate)** (E15) |

All three also gain an E13 `candidate_below_tail` note + `candidate_below_tail_review` (tail
co-quats on u1; tail coconut oil on u2; tail coconut + castor on u3) — review routing only, no
value moves. u4 (not re-derived here) has the same E13 exposure (Shea Butter @10, SAPDMA @12 in the
tail) and its BTAC @5 boundary note is now informational (full-list conjunct); neither moves a
value. u5/u6 unchanged. Cohort records with tail-side extras that would have qualified an anchor would likewise carry the E13 note and review routing when next regenerated (hinweise/review surface only). The cohort reference key is untouched by E13–E17 (no cohort value moves;
the #08 marker-reading near-miss under E14 is noted in §3 S2 for a pre-freeze key check).
**Freeze of v1.0 can proceed.**

## 5. Round 2.5 — targeted validation of the round-3 rulings (2026-10-06)

Purpose: E14/E15/E16 were value-moving rules validated on n=1 each; before freeze, six fresh
products (q1–q6, `blind-packets-round2p5/`) tested them against expectations **pre-registered
and committed before each lane dispatch** (`round2p5-preregistered-expectations.md`). Same
zero-inheritance Opus lane protocol; records in `blind-lane-v2p5/`.

| Product | Target | Outcome vs pre-registration |
|---|---|---|
| q1 WS Avocado+Shea | E14 heavy + E2 Parfum-last | PASS (conservative branch: booster-limb → marker unresolved → moderate+review; Parfum never used as marker) |
| q2 Swiss-o-Par Arganöl | E14 mid | PASS (argan blocked low, did not make high; `high` carried by Paraffinum Liquidum under the standard's own occlusive-hydrocarbon heavy core) |
| q3 Syoss Intense Repair | E16 positive (intended) | CORRECT G0 STOP — the Rossmann source genuinely omits the rinse step; §1.1/§2.3 refused to classify. E16-positive moved to q5. |
| q4 Fructis "Keratin" Sleek | booster limb + claim mismatch + E16 under unresolved | PASS on all three (marker unresolved; claim_formula_mismatch for keratin-free "Keratin" naming; repair headline withheld) |
| q5 Balea Keratin Repair | E16 POSITIVE | PASS — four hydrolysates above the marker → repair headline fired (protein / medium / repair) |
| q6 Syoss Intense Keratin | E16 NEGATIVE control | PASS — single plain keratin → headline withheld (general), repair_support medium kept |

**Verdict: all rule-level pre-registered expectations held.** E16 is validated on both branches;
E14 on mid-blocks (q2, q5) and on the conservative heavy path (q1); the booster limb, E2
convention, E13 flags and the G0 stop value all behaved. E15 remains validated on u3 only (no
second natural reading-(b) candidate surfaced on this shelf pass) — carried as a freeze note.

Round-2.5 triage codifications (no value changes): lexicon hydrocarbon-banding alignment
(Paraffinum Liquidum/Petrolatum = heavy band, as the standard already stated); §2.1 operational
note that rinse evidence counts from anywhere in the exact-product source (with
`product_form_ambiguity` review), while a source with no rinse text stops at
`insufficient_information`.

## 6. Final status

Cohort gate PASS (97/97) · unseen set final under v0.6 · round-2.5 targeted validation PASS
(6/6 vs pre-registered expectations). **Calibration is closed; freeze of v1.0 may proceed.**
