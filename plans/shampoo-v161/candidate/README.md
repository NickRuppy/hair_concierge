# Shampoo classification v1.6.1 — candidate

Status: **candidate, not locked** (drafted 2026-10-12; revised the same day for the W-LINE scope ruling and the pre-registration defects D1–D6). Not lane-tested, not calibrated, not production-active. The locked method stays v1.6 (`docs/research/shampoo-inci/v1.6/`, byte-frozen and untouched). Next step: re-check the pre-registration against this revision (`plans/shampoo-v161/test/pre-registration.md`), then the sealed lanes (`plans/shampoo-v161/plan.md`).

| File | Purpose |
| --- | --- |
| `classification-standard.md` | Full v1.6 text plus S1–S4 and the D1–D6 fixes only, with a v1.6.1 preamble. New or changed text is marked "(v1.6.1)". |
| `rule-changes-v1.6.1.md` | Rows 116–136 in the v1.6 ledger format, plus the products expected to move. |
| `diff-vs-v1.6.patch` | `diff -u` of the locked v1.6 standard against the candidate. |

## What changed (S1–S4)

- **S1, DS1 (Section 11).** `Selenium Sulfide` / `Selenium Disulfide` are recognized anti-dandruff actives next to `Piroctone Olamine` and `Climbazole`. An informational note records the EU label warnings; no user copy.
- **S2, W-LINE (6.7), scoped to lipids.** A materiality line for `payload_lipid` only: oils, butters, waxy or hydrogenated lipids and the other payload lipids of 6.3/6.4. It decides the lipid leg of W-RICH, the lipid condition of W1 (c) and whether a lipid counts toward the `high` convergence route. Silicones, cationic polymers, cationic conditioners and every other family keep their v1.6 reading, with no position test, because they deposit at low dose through dilution deposition, while the weight an oil or butter leaves scales with its quantity (Nick's ruling of 2026-10-12, option (a), on the A13 Hair Biology finding).
  - Candidates: fragrance or one of the classic 26 Annex III allergens (closed list), a listed preservative or capped active, a typical sub-1 % active, or the second entry of an alphabetical run of at least 7 entries. A candidate counts only if it passes a plausibility test.
  - The line is never later than E3. C2, the Section 5 anchor and every gate keep E3.
- **S3, E2 (13.3).** "fettiges Haar", "fettige Haare" and "für fettiges Haar" count as oily claims, like "schnell fettendes Haar". Length terms, protective wording and "Haartyp" attribute fields do not.
- **S4, C3 and C3b (Section 4).** Sulfolaurates are mild anionics. `Sulfated Castor Oil` is neither a cleansing route nor a buffer. `Cocamidopropylamine Oxide` is an amphoteric buffer only. Laureth-8 sulfates are strong ether sulfates with a high-EO counter-signal. Where a named member decides the value, its confidence is limited. The evidence limits are stated in the rule.

## Pre-registration fixes (D1–D6)

- **D1 (CL-SRC, E1, E2).** A claim printed on the exact product's pack is graded at its pack grade in any language: `pack_front` `high`, `pack_back` `moderate`. E1's foreign-language downgrade applies to manufacturer web pages only. E2 gains a closed list of English equivalents for `dandruff` ("dandruff", "anti-dandruff") and `oily` ("oily/greasy scalp", "oily/greasy roots", "oily/greasy hair", "excess sebum").
- **D2 (W-LINE 1a).** The allergen candidates are the classic 26 Annex III allergens, named by INCI. Allergens added by Regulation (EU) 2023/1545 do not count.
- **D3 (W-LINE 3).** The E3 marker is itself a candidate. When it sets the line, no fallback code is recorded. `w_line_fallback_e3` applies only when nothing up to the marker is plausible, which means no surfactant is listed before it. `w_line_none_visible` applies only without a marker.
- **D4 (W-LINE intro).** Split synonym entries are merged per ID-2 before any W-line position is counted.
- **D5 (W-LINE 1, 2).** `Capryloyl Glycine` is not a candidate. Its surfactant status is unclear, so it counts against plausibility in (ii) and never for it in (i) (P0). That moves P34's line from 19 to 32; see *Still open*.
- **D6 (6.4).** `Sulfated Castor Oil` has no weight family. It is recorded as excluded.

## Expected W-line and weight under the revised scope

Positions are normalized ID-2 positions, read from `plans/shampoo-v161/test/packets/`. "Partner" means the silicone or cationic system of W-RICH, read as in v1.6. Reset values come from the v1.6 lane records.

| Product | W-line (cap) | Material `payload_lipid` | Non-lipid deposition (v1.6 reading) | Expected weight |
| --- | --- | --- | --- | --- |
| P01 Maria Nila Head & Hair Heal | 21 `Benzoic Acid` (cap `Parfum/Fragrance` @37). The candidates @7, @10, @12 and @13 are skipped for `PPG-2 Hydroxyethyl Cocamide` @19 | Sunflower @15 | Guar @16, amodimethicone copolymer @18, Quaternium-95 @26 | v1.6 `moderate` → **`high`**. Sunflower now establishes W-RICH and reset is weak, so the rich route holds. Live `moderate` → `heavy`. |
| P02 Maria Nila Pure Volume | 21 `Potassium Sorbate` (cap @33). `Panthenol` @7 is skipped for `PPG-2 Hydroxyethyl Cocamide` @17 | Sunflower @8 | Cationic wheat copolymer @9, silicone copolymer @12, Quaternium-95 @16, guar @18; proteins @11/@13 | **`high`**, as in v1.6. The material sunflower @8 decides W-RICH, and with weak reset the rich route holds. The convergence route is open too (silicone + cationic). Live `heavy`. |
| P03 Maria Nila True Soft | 25 `Alpha-Isomethyl Ionone` (cap @31). `Dehydroacetic Acid` @19 is skipped for `PPG-2 Hydroxyethyl Cocamide` @22 | Argan @7, sunflower @9 | Guar @13, quat @15, silicone copolymer @16, Quaternium-95 @21; proteins @8/@12 | **`high`**, as in v1.6. Live `heavy`. |
| P25 OLAPLEX No.4 | 63 `Benzoic Acid` (cap `Parfum (Fragrance)` @71). Six earlier candidates are skipped | Sunflower @24, apricot @25, argan @26, serinate @29 | PQ-10/PQ-11/guar @30–32, amodimethicone @34, silicone copolymer @35, Quaternium-95 @52 | **`high`**, as in v1.6, with `low` confidence and status `needs_research`. Lane B moves `moderate` → `high`, because its "richness cannot be shown from order" is answered by the material oils. Live `heavy`. |
| P32 Vichy Dercos Ultra-Sensitiv | 10 `Benzoic Acid`, classes b + d (alphabetical run @9–37; cap `Parfum / Fragrance` @38) | None: apricot oil @30 is after the line | `Amodimethicone` @9, cetrimonium @14, dimethicone copolymer @18, PQ-10 @25, PQ-7 @26 | **`high`**, as in v1.6 (both lanes). W-RICH is closed, but the convergence route both lanes used is untouched. Live `heavy`. Fits, notes and flags are unchanged. The earlier `moderate` expectation and its T4 flags are withdrawn. |
| A13 Hair Biology Revitalize & Soothe | 11 `Parfum`, the marker itself, with no fallback code | None in the formula | `Dimethiconol` @10, `Dimethicone` @13, guar @15 | **`high` reachable again**: silicone + guar converge as in v1.6. W1 does not apply, because the set has no amodimethicone. The band is a whole-formula call against a sulfate chassis whose reset is not limited. There is no v1.6 lane baseline (Aug-26 approval `high`; the v1.4 rerun split `high`/`moderate`), so the result is not scored as a move. |

The weight movers in the cohort are P01 (`moderate` → `high`) and P25 lane B (`moderate` → `high`, lane-level only). Under the revised scope no product moves lighter.

## Open questions for Nick

Questions 1 (alkanolamide breadth, option (a)), 4 (sulfated castor oil: weight family settled by D6) and 9 (P05: settled by D1) are ruled or closed. The rest of the defaults were accepted in `plan.md`.

### Still open

- **D5 (`Capryloyl Glycine` in plausibility test (ii)).** The ruling settled only that it is not a candidate. Counting it as a cleansing surfactant in (ii) is a cautious closure decided in this candidate. Under it, P34's W-line is 32 (`Parfum`), not 19, and `Hydrogenated Castor Oil` @23 becomes material. The band stays `moderate` because reset is not limited. The alternative, "not a surfactant", gives 19, matching both v1.6 lanes' reading of it as an active. The pre-registration lists 19 as primary, so it needs updating either way.
- **"fettendes Haar" without "schnell".** `plan.md` records the default "fettendes Haar counts (S3)", but the E2 text still lists only "schnell fettendes Haar" and the "fettiges Haar" family. This revision did not change that, because it was not in its brief. It decides Sebamed "Haartyp: … fettendes Haar" only where the phrase is not an attribute field.
- **Questions 5 and 8 from the first draft.** Whether the high-EO counter-signal should extend to every ether sulfate with 8 or more EO (question 5), and whether the selenium-sulfide warning should become a 13.9 code (question 8). Neither is touched here.
