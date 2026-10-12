# Shampoo v1.6.1 test round: pre-registration v2 (2026-10-12)

This file records, before any sealed lane runs, the outcomes expected under the revised v1.6.1 candidate. The test then checks that only these values move. Version 2 replaces v1 from the same day; section 0 lists what changed. The machine-readable twin is `pre-registration.json` in this directory.

- **Standard:** `plans/shampoo-v161/candidate/classification-standard.md`, revision with rule-change rows 116–136.
  - The W-LINE rule decides whether a `payload_lipid` is *material*, and nothing else (row 130).
  - D1–D6 are decided (rows 131–136). S3 now also includes "fettendes Haar".
- **Packets:** the 23 packets in `test/packets/`. All Profi fingerprints match the v1.6-profi lane records.
- **Positions:** normalized ID-2 positions. Synonym entries split by a source are merged before counting (row 132), so G09 uses normalized positions.

## 0. Changes vs pre-registration v1

- **P32 Vichy Ultra-Sensitiv no longer moves.**
  - It stays `high`/`heavy`; normal stays `acceptable`; the `scalp_concern_floor_applied:fine` note stays; no new T4 flags.
  - Silicones, cationic polymers and the cationic conditioner now count wherever they are listed, so the convergence route that carried the v1.6 `high` stays open.
- **A13 Hair Biology is not constrained.** It contains no `payload_lipid`, so the W-line has no effect. `high` is reachable again through silicone + guar convergence, as in v1.6.
- **Material lists are lipid-only.** All other deposition families are listed as "other families" and read as in v1.6.
- **P31:** the W-line is fixed at 12 (row 133). The `Menthol` @10 alternative is gone.
- **P29:** `Menthol` @8 and `Camphor` @9 are no longer candidates, so they are not recorded as skipped (row 133).
- **P05 and P36:** grading of English pack-front text is now stated in the standard (row 131). Expectations are unchanged.
- **G09:** the text now requires W-line 7 in normalized positions (row 132).
- **P34:**
  - `Sulfated Castor Oil` is recorded as excluded (row 136).
  - `Capryloyl Glycine` is not a W-line candidate (row 135), but whether it counts as a cleansing surfactant is still open (R2).
- **Fallback codes:** no cohort product records `w_line_fallback_e3` or `w_line_none_visible` (row 134).
- **New ambiguity R1:** P40 is at risk of moving `moderate` → `high` (section 5).

## Baselines used

| Cohort | v1.6 baseline |
| --- | --- |
| P01–P40 (Profi) | `.worktrees/profi-shampoos/data/research/shampoo-inci/v1.6-profi/kit/lane-{a,b}/out`. `kit-r2` supersedes these for P05 (PR07), P25 (PR05), P35 (PR10) and P36 (PR06). |
| G05, G09, G12 | `data/research/shampoo-inci/v1.6/calibration/round-2`, records P06, P10, P11. Nick approved these on Aug 26. |
| U2-04 | `calibration/unseen-v2`, record Q01. |
| U3, U4 | `calibration/round-1`, records L04 and L02. These used early candidate `6edd1b14`, so they are weaker comparators. |
| A13 | **No v1.6 lane record.** Only the Aug-26 approval (`high`) and the v1.4 rerun-v3 result (`moderate`; lane A `high`, lane B `moderate`) exist. |

## 1. W-line per product (mechanical, before lanes)

Position notation: `@n` is the normalized position. Candidate classes: a = fragrance (closed classic-26 allergen list), b = preservative or capped active, c = sub-1 % active, d = alphabetical tail.

In every product the cap is the declared `Parfum`/`Fragrance`, and every W-line state is `candidate`. No product records a fallback code. A ✗ marks a skipped candidate (recorded as `w_line_skipped:<INCI>@<pos>`); ✓ marks the plausible candidate that sets the line.

| Slot | Cap | Candidates tested | W-line | Material `payload_lipid` | Not material `payload_lipid` |
| --- | --- | --- | --- | --- | --- |
| A13 | @11 | Parfum @11 ✓ | **11** Parfum (a) | none (no lipid) | none |
| G05 | @27 | Tocopherol @23 ✓ | **23** Tocopherol (c) | Soy oil @6, Dicaprylyl Ether @13 | none |
| G09 | @10 | Panthenol @7 ✓ | **7** Panthenol (c) | none | Hydrogenated Castor Oil @15, Apricot oil @21 |
| G12 | @13 | Biotin @7 ✓ | **7** Biotin (c) | none (no lipid) | none |
| P01 | @37 | Biotinoyl Tripeptide-1 @7 ✗, Acetyl Tetrapeptide-3 @10 ✗, Piroctone Olamine @12 ✗, Tocopheryl Acetate @13 ✗ (all fail (ii) on PPG-2 Hydroxyethyl Cocamide @19); Benzoic Acid @21 ✓ | **21** Benzoic Acid (b) | Sunflower @15 | none |
| P02 | @33 | Panthenol @7 ✗ (fails (ii) on PPG-2 HE Cocamide @17); Potassium Sorbate @21 ✓ | **21** Potassium Sorbate (b) | Sunflower @8 | none |
| P03 | @31 | Dehydroacetic Acid @19 ✗ (fails (ii) on PPG-2 HE Cocamide @22); Alpha-Isomethyl Ionone @25 ✓ | **25** Alpha-Isomethyl Ionone (a) | Argan @7, Sunflower @9 | none |
| P05 | @21 | Selenium Sulfide @9 ✗ (fails (ii) on Coco-Glucoside @12); Sodium Benzoate @14 ✓ | **14** Sodium Benzoate (b) | none (no lipid) | none |
| P06 | @19 | Piroctone Olamine @9 ✓ | **9** Piroctone Olamine (b) | none (no lipid) | none |
| P09 | @45 | Panthenol @11, Tocopherol @12, Biotin @13, Tocopheryl Acetate @15 ✗ (fail (ii) on Sodium Methyl Cocoyl Taurate @33); Phenoxyethanol @40 ✓ | **40** Phenoxyethanol (b) | Shea @19, Evening Primrose @20, Rosa Canina @24, Jojoba Esters @25 | none |
| P25 | @71 | Biotin @12, Sodium Hyaluronate @13, Panthenol @14, Tocopherol @15 ✗ (fail (ii) on surfactants @36/@41/@42/@44 and wax @37); Caprylyl Glycol @33 ✗; Ethylhexylglycerin @43 ✗ (fails (ii) on @44); Benzoic Acid @63 ✓ | **63** Benzoic Acid (b) | oils @24–26 | none |
| P29 | @17 | Fragrance @17 ✓ | **17** Fragrance (a) | Sunflower @6 | none |
| P30 | @16 | Fragrance @16 ✓ | **16** Fragrance (a) | Argan @9, Avocado @10 | none |
| P31 | @12 | Parfum @12 ✓ (classes a + d; alphabetical run @11–19) | **12** Parfum | ceramide @11 (if read as `payload_lipid`, R3) | none |
| P32 | @38 | Benzoic Acid @10 ✓ (classes b + d; run @9–37) | **10** Benzoic Acid | none | Apricot oil @30 |
| P34 | @32 | Piroctone Olamine @19 ✓ (record alternative: @32 under R2) | **19** Piroctone Olamine (b) | Polyricinoleate @12 | Hydrogenated Castor Oil @23 (fatty acids @24/@25 if read as lipid) |
| P35 | @11 | Piroctone Olamine @8 ✓ | **8** (b) | none (no lipid) | none |
| P36 | @10 | Piroctone Olamine @8 ✓ | **8** (b) | none (no lipid) | none |
| P39 | @11 | Phenoxyethanol @9 ✗ (fails (ii) on Disodium 2-Sulfolaurate @10); Fragrance @11 ✓ | **11** Fragrance (a) | none (no lipid) | none |
| P40 | @13 | Fragrance @13 ✓ | **13** Fragrance (a) | Argan @7, Avocado @8 | none |
| U2-04 | @14 | Panthenol @11 ✓ | **11** Panthenol (c) | Hydrogenated Vegetable Oil @7 | none |
| U3 | @21 | Panthenol @4 ✗ (fails (ii) on surfactants @5/@7); Caffeine @9 ✓ | **9** Caffeine (c) | none (no lipid) | none |
| U4 | @21 | Citric Acid @10 ✓ (class d; run @9–15) | **10** Citric Acid | Nigella oil @5 | none |

Alphabetical runs of at least 7 entries occur only in P31, P32 and U4. None of them contains the earliest cleansing surfactant, so no product records `w_line_unordered_list`.

## 2. Expected outcomes per product

Weight values are shown as v1.6 → v1.6.1. **MOVES** marks a product with a pre-registered change; everything else must stay as in v1.6.

| Slot | `weightPotential` | Live `weight` | Other expected changes | Status |
| --- | --- | --- | --- | --- |
| A13 | none → not pre-registered | — | The W-line has no effect (no lipid). `high` is reachable through silicone + guar convergence, as in v1.6; the strong reset argues `moderate`. Lanes must not cite the W-line. | no baseline, not scored |
| G05 | moderate → moderate | moderate | none | SAME |
| G09 | moderate → moderate | moderate | none (lipids @15/@21 are not material and never end W1) | SAME |
| G12 | low → low | light | none | SAME |
| **P01** | moderate → **high** | moderate → **heavy** | Fit: normal ideal → **acceptable**; fine stays acceptable, now via T6 (note `scalp_concern_floor_applied:fine` added); coarse stays ideal. Flags: `review_thickness_boundary` for normal and coarse removed. | **MOVES** |
| P02 | high → high | heavy | none | SAME |
| P03 | high → high | heavy | none | SAME |
| **P05** | low → low | light | S1 applies: `dandruffSupport` becomes `supported` and the dandruff path passes (English pack-front text, row 131). `usageRole` → treatment; `focusPrimary` → scalp_active; target → dandruff (`schuppen` rows, gentle); protocol role → dandruff; S-FAIL flag removed. | **MOVES** |
| P06 | low → low | light | `cleansingStrength` low, unchanged | SAME |
| P09 | high → high | heavy | none | SAME |
| P25 | cautious high → high (confidence `low`) | heavy | lane B moves moderate → high; status stays `needs_research` | SAME (cautious value) |
| **P29** | moderate → moderate | moderate | S3: the oily claim qualifies and S-OILY passes, so the target moves ordinary → **oily**. The T4 flag on fine is removed. S4: lane B `cleansingStrength` strong → moderate and `usageRole` alternating → regular. | **MOVES** |
| P30 | high → high | heavy | none | SAME |
| **P31** | moderate → moderate | moderate | S1: `supported`; dandruff path passes. `usageRole` → treatment; `focusPrimary` → scalp_active; target → dandruff; combination → `["oily"]`; notes `suits_dandruff_with_oily_scalp` and `dandruff_bundled_comfort_wording` added; S-FAIL flag removed; lane A's T4 flag on fine removed. | **MOVES** |
| P32 | high → high | heavy | none (convergence route stays open) | SAME |
| **P34** | moderate → moderate | moderate | S4: `cleansingStrength` strong → **moderate** (moderate confidence, neighbor strong); intensity stays regular. `Sulfated Castor Oil` is recorded as excluded. | **MOVES** |
| P35 | low → low | light | `cleansingStrength` stays strong (moderate confidence, neighbor moderate) | SAME |
| P36 | low → low | light | same as P35; the dandruff target now rests on stated text | SAME |
| P39 | low → low | light | `cleansingStrength` low (moderate confidence, neighbor moderate); lane B moves strong → low and intensity → gentle | lane B **MOVES** |
| P40 | moderate → moderate | moderate | none (at risk under R1) | SAME |
| U2-04 | moderate → moderate | moderate | none | SAME |
| U3 | low → low | light | none | SAME |
| U4 | low → low | light | none (a "Haartyp" attribute field never qualifies; the oily target stays through "schnell fettende Kopfhaut") | SAME |

## 3. Derivation notes

**The W-line is now lipid-only.**

- A lipid leg can only:
  - open where v1.6 lanes refused it on position (P01, P25 lane B), or
  - close where `high` rested on a post-line lipid. No product in this cohort has that case: P32's `high` rests on silicone and cationic convergence, not on the apricot oil @30.
- Silicone and cationic partners are read as in v1.6. Products whose W-RICH lipid leg is material but whose reset is not weak keep the rich route closed: G05, P29, P31, P34, U2-04 and U4. Their bands stay as in v1.6.

**P01 (moderate → high).**

- Both v1.6 lanes refused W-RICH only because of the oil's position.
- Under the revised text:
  - sunflower oil @15 is material (W-line 21);
  - guar @16 and the amino-silicone @18 count without a position test;
  - `resetCapacity` is weak in both lanes (C6 `low`).
- So the rich route of the `high` anchor holds. Expected confidence is `moderate` with neighbor `moderate`.
- Thickness effects:
  - **T1:** fine becomes `not_suited`, which T6 lifts to `acceptable` (dandruff target); normal becomes `acceptable`; coarse stays `ideal`.
  - **T4:** with neighbor `moderate`, no tier would drop, so the v1.6 flags are removed.
- Live display (T7): normal green → amber; coarse amber → green.

**P32 (high, unchanged).**

- The apricot oil @30 sits after the W-line, so W-RICH is not established.
- The convergence route still holds: two silicones, PQ-10, PQ-7 and cetrimonium, read position-independently. Reset is weak, so the v1.6 `high` stands.
- Item 6 applies only to bands below `high` that cite a post-line lipid, so it does not apply here.

**S1 (selenium sulfide).**

- **P31.** The dandruff claim is the product name "Anti-Schuppen" (graded `high`). Under R17.1/R17.2:
  - the oily wording in the name and in the manufacturer directions ("für normales bis fettiges Haar", newly E2) feeds only the combination;
  - S-OILY passes with C moderate, W moderate and K moderate;
  - "Lindert Juckreiz auf der Kopfhaut" is bundled with the dandruff claim; S-SENSITIVE fails because no comfort route is prominent;
  - focus becomes `scalp_active` (section 7.2); `focusSecondary` stays `[]`.
- **P05.**
  - The pack-front text is graded `high` in any language, and "dandruff" is on the closed English list.
  - Cleansing is `low`, so the rows are gentle: amber, and not ranked in the dandruff role.
  - The combination stays `[]`, because S-OILY fails on cleansing `low`.

**S3 (oily-hair lexicon).**

- **P29.** The DE manufacturer unit "Normales bis fettiges Haar …" is graded `moderate` (Wayback capture, graded as manufacturer as in v1.6).
  - S-OILY passes on every lane value.
  - Focus is already `clarifying` (F6).
- **No other cohort product changes:**
  - "fettendes Haar" occurs only in P34, as "fettender Haaransatz", which already qualified.
  - P35 and P36 carry it only in retailer copy, graded `low`.

**S4 (surfactant classes).**

| Product | Expected `cleansingStrength` | Why |
| --- | --- | --- |
| P39 | `low` | C6: the sulfolaurate @2 is the earliest surfactant, with prominent amphoterics |
| P06 | unchanged | The sulfolaurate is not the earliest surfactant |
| P34 | `moderate` | C5: `Sulfated Castor Oil` is no route; four buffers remain |
| P29 | `moderate`, neighbor `strong` | The amine oxide @16 is the deciding second buffer |
| P35, P36 | `strong`, neighbor `moderate` | Laureth-8 sulfate is the only reinforcing route |
| P25, P40 | unchanged | The amine oxide does not decide the value |

## 4. Pass criteria

### 4.1 Mechanical pre-check

The orchestrator recomputes all 23 W-lines before the lanes run. Each must equal section 1: position, INCI, classes, cap and skipped list. Any difference is a rule-text defect.

### 4.2 Expected movements (exhaustive)

1. **P01:**
   - `weightPotential` moderate → high
   - `weight` moderate → heavy
   - `thicknessFit.normal` ideal → acceptable
   - `review_thickness_boundary` normal and coarse removed
   - note `scalp_concern_floor_applied:fine` added
2. **P31:**
   - `dandruffSupport` → supported
   - `usageRole` → treatment
   - `focusPrimary` → scalp_active
   - target ordinary → dandruff, with `schuppen`/dandruff rows for fine, normal and coarse
   - `requiredProtocolRoles` → `[shampoo_dandruff]`
   - `researchCombinationTargets` → `["oily"]`
   - notes `suits_dandruff_with_oily_scalp` and `dandruff_bundled_comfort_wording` added
   - `review_specialist_gate_failed:dandruff` removed; lane A's `review_thickness_boundary:fine` removed
3. **P05:**
   - `dandruffSupport` → supported
   - `usageRole` → treatment
   - `focusPrimary` → scalp_active
   - target → dandruff (gentle rows)
   - `requiredProtocolRoles` → `[shampoo_dandruff]`
   - `review_specialist_gate_failed:dandruff` removed
   - an optional note `dandruff_oily_scalp_wording` is allowed (R4)
4. **P29:**
   - target ordinary → oily, with `dehydriert-fettig` rows for fine, normal and coarse
   - target confidence high → moderate
   - `review_thickness_boundary:fine` removed
   - lane B only: `cleansingStrength` strong → moderate and `usageRole` alternating → regular
5. **P34:**
   - `cleansingStrength` strong → moderate (neighbor strong)
   - the `usageRole` neighbor may lose `alternating`
   - `Sulfated Castor Oil` recorded as excluded
6. **P39, lane B only:**
   - `cleansingStrength` → low (moderate confidence, neighbor moderate)
   - intensity → gentle
   - status → projected
7. **P25, lane B only:** `weightPotential` moderate → high. Confidence stays `low` and the status stays `needs_research`.

### 4.3 Must not change

Everything else must equal v1.6 for that lane. In particular:

- every `conditioningLevel`;
- every weight other than P01 and P25 lane B;
- **P32 completely**: `high`/`heavy`, normal `acceptable`, floor note, I3 flags, and no T4 flags;
- P02, P03, P09 and P30 `high`;
- **P40 `moderate`**;
- all gold and unseen products;
- P35 and P36.

Splits between the v1.6 lanes that are unrelated to v1.6.1 are not scored: P02 focus, P06 scalp comfort and combination, and G12 conditioning.

### 4.4 Agreement bars

- W-line: 23/23 lanes agree. P34 is checked against its record alternative until R2 is fixed.
- `weightPotential`: 23/23 lanes agree.
- Overall agreement is at or above the v1.6 bars.
- No disagreement is caused by the v1.6.1 text.

### 4.5 Not scored

- **A13** has no v1.6 baseline. Its band is reported to Nick, with the Aug-26 `high` and the v1.4 `moderate` alongside.
- **U3 and U4** come from round-1 baselines. Drift there that S1–S4 do not explain counts as baseline drift.

## 5. Remaining rule-text ambiguities

- **R1 (consequential): may silicone/cationic position still inform depositionLoad/persistence?**
  - The text says non-lipid families "keep their v1.6 reading … wherever they are listed", and the W-RICH partner must be "present and plausibly persistent, wherever it is listed". Its stated reason is "a late listing does not make them light".
  - Both v1.6 lanes kept P40 at `moderate` precisely because its only cationic partners (@26, @30) are trace, after the fragrance.
  - Read strictly, P40 has a material lipid leg (argan @7, avocado @8), position-blind cationic partners and weak reset (C6). That would satisfy the W-RICH rich route and make it `high`.
  - The same question decides A13 between `high` and `moderate`.
  - Fix: one sentence stating whether position may still inform the whole-formula depositionLoad/persistence judgment for non-lipid families, as in v1.6. Until then, P40 is pre-registered as `moderate`, and a move to `high` is adjudicated as R1.
- **R2 (record only): Capryloyl Glycine.** It is excluded as a candidate, but its cleansing-surfactant status for W-LINE (ii) is not decided. C3's unlisted-surfactant rule (an acylate counts as a mild anionic) would make P34's Piroctone Olamine @19 implausible, giving a W-line of 32. Row 135 asserts 19. The band is unaffected.
- **R3 (record only): borderline lipid families.** Whether these count as `payload_lipid` or `weak_refatter` now decides whether the W-line applies at all: `2-Oleamido-1,3-Octadecanediol` (P31 @11), `Hydrogenated Coconut Acid` (P32 @19), and `Stearic Acid`/`Palmitic Acid` (P34 @24/25, where the v1.6 lanes split). No band in this cohort is affected.
- **R4 (note only): P05 "SCALP WITH OILY OR DRY DANDRUFF".** It is unclear whether "oily … dandruff" matches the English term "oily scalp". Only the note `dandruff_oily_scalp_wording` depends on it.

## Addendum after candidate row 137 (orchestrator, 2026-10-12, before any lane ran)

- R1 resolved toward v1.6 behaviour for non-lipid families: P40 Moroccanoil Clarifying expected `moderate` (unchanged), A13 Hair Biology `high` reachable via the v1.6 deposition judgment.
- R2 resolved: `Capryloyl Glycine` is not a cleansing surfactant → P34 GLYNT W-line @19 (`Piroctone Olamine`), band `moderate` unchanged.
- R3: payload_lipid membership per 6.3/6.4 as in v1.6 (no expectation change).
- R4: "oily … dandruff" on P05 is a dandruff claim, not an oily claim → no oily target/combination from it.
