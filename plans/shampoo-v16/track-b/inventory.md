# Track B inventory: the paused new shampoo products (2026-10-05)

Status: research/planning input only. Built read-only from repo files in worktree `shampoo-v16`; no web, no prod, no edits outside `plans/shampoo-v16/track-b/`. Anything I inferred (rather than read) is marked *(inferred)*. Machine-readable rows: `inventory.json` (same directory).

## Plain-language summary

- **38 products are paused.** The plan's number (38) is right: 52 new products were researched administratively (admin batches 15/15/14/8); 14 were approved and went live on 2026-09-04 (5 pilot + wave 01 five + wave 02 four; all 14 match prod cohort X14 exactly by name); 52 - 14 = 38. The other figure you may see, "47 remaining" (focus-v15 plan, plan.md), counts the 52 minus only the 5 pilot products, before waves 01 and 02 ran. Both are consistent.
- **Of the 38: 18 ready, 18 partial, 1 blocked, 1 duplicate of a live product.** So **36 can be researched**, in 8 cells of 4-5.
  - *Ready* (18): EAN cross-source verified, price, image candidate, protocol stamp, and complete INCI text already stored in the repo (12 in admin batch-02 evidence, 5 in the draft manifest-04, 1 only in a v1.4 holdout formula file). Even these need the formula re-frozen from live sources, because the stored text dates from 2026-09-02 and was never frozen into a source packet.
  - *Partial* (18): administrative data complete except the INCI text was never stored in the repo (the formula packets lived in a discarded temp workspace). 2 of them also have a provisional-formula caveat (Being Max Moisture, Being Nourish + Shine), 1 has a formula conflict (Herbal Essences Blütensanft), 1 has no price (John Frieda Sheer Blonde).
  - *Blocked* (1): Garnier Fructis Coco Water - dm and Garnier formulas disagree materially for the same GTIN.
  - *Duplicate* (1): **Pantene Pro-V Grow Abundant (EAN 8006530060042) is already live** as "Pantene Grow Abundance" (prod id `7373656d-...`). It must not be created as new.
- Everything else is administratively complete: all 38 have a GS1-valid, cross-source-verified EAN (none excluded), all 38 have a candidate image, all have a protocol stamp with source text, 37/38 have a price.
- **8 protocol deviations** are recorded: 4 genuine numeric contact times (John Frieda Silber 1-3 min, Plantur DMG 2 min, Bali Gents 2 min, Plantur 21 min. 2 min) and 4 non-numeric "kurz einwirken lassen" that Nick's 2026-09-04 ruling would clear (needs his confirmation, see blockers).
- **10 products carry medically adjacent language** (dandruff, sensitive/itchy scalp, hair-loss/caffeine-root marketing); copy must stay cosmetic.
- **3 of the 38 are already v1.4 calibration holdout products** (same EAN, formula-source files exist): Syoss Intense Repair (holdout-v3), Elvital Bond Repair (holdout-v1, labelled `bond-repair-plus`), ISANA Professional Plex (holdout-v2). Relevant to the v1.6 gold/unseen set design: they are not unseen *(inferred consequence)*.

### Needs Nick (details in the last section)
1. Confirm Pantene Grow Abundant is dropped from new creation (duplicate).
2. Coco Water: needs a pack-bound formula source (a physical pack read is the likely route) or drop it.
3. Confirm the 2026-09-04 non-numeric-wait ruling applies to the 4 non-numeric deviations (schauma For Men, ISANA MED pH 5,5, ISANA Professional Keratin & Repair, ISANA MEN Energy Power).
4. Nothing is left "pending Nick's skim": the handoff's note on the 15 extension candidates was resolved by his plan confirmation and 2026-09-03 expansion approval; only a stale `PROPOSAL` header remains in `shampoo-wave-extension.json/.md`.

## Counts

| | Count |
|---|---:|
| Paused (total) | 38 |
| Ready | 18 |
| Partial | 18 |
| Blocked | 1 |
| Duplicate of live | 1 |
| Researchable (in cells) | 36 |
| INCI text on file in repo | 18 |
| Cross-source-verified EAN (all EANs) | 38 |
| Image candidate present | 38 |
| Price missing | 1 |
| Protocol deviations (numeric / non-numeric) | 4 / 4 |
| Medical-language flagged | 10 |

Accounting by admin batch: batch-01 15 products - 11 live, 4 paused (Coco Water, Dream Length, Blütensanft, Pantene Repair & Care XXL); batch-02 15 - 3 live, 12 paused; batch-03 14 - 0 live, 14 paused (one is the Pantene duplicate); batch-04 8 - 0 live, 8 paused. 4 + 12 + 14 + 8 = 38.

Live ones (matched to prod snapshot cohort X14, not paused): Honig Schätze, Syoss Intense Keratin, NIVEA Power Repair, schauma Repair & Pflege, Herbal Essences Fiji, GLISS Liquid Silk, GLISS Total Repair, Elvital Hydra Hyaluronic, Fructis Locken Methode, Being Big Hair, GLISS Sealing Miracle, h&s Classic Clean, ISANA Sensitiv, ISANA 2-in-1 Volumen.

## Overlap with the live catalog

Method: brand+name token similarity of all 38 against all 68 rows of `inputs/prod-shampoo-specs-2026-10-05.tsv`, plus an exact-EAN search of every tracked file for each of the 38 EANs (git grep), plus the June-2026 `data/product-catalog-snapshot.json` (239 products, all categories) for cross-category siblings.

- **One true duplicate:** Pantene Pro-V Grow Abundant Shampoo Anti-Haarverlust (batch-03 idx 11, EAN 8006530060042, 290 ml) = live "Pantene Grow Abundance" (`7373656d-5fd7-46e8-81a3-2ef29e3c4c18`). Evidence: the EAN, 290 ml and exact product id are in `data/scanner-catalog-coverage/2026-08-26/phase1-existing-identifier-backfill-e5-v1.json`; the same dm PDP link is in `live-baseline.json`; formula-source exists in `data/research/shampoo-inci/v1.3/products/pantene-grow-abundance/`. The name similarity score alone was only 0.33, so name matching would have missed it. Whether the EAN is already attached in prod is *(inferred: yes, because the E5 backfill was a prepared apply item)*; verify with a prod read in the apply lane. Disposition: remove from new creation; at most an `existing_product_updates` no-op.
- **No exact brand+name match** for any other paused product in the prod snapshot, and no EAN match to any other catalog or backfill file.
- **Near-name siblings that are different SKUs (do not merge):** Syoss Men/Color/Repair vs live Syoss Intense Volume/Fullness/Curls/Keratin; h&s Apple Fresh vs live h&s Classic Clean and Anti Schuppen Sensitive; ISANA Seidenglanz/Feuchtigkeit/Oil Repair/Anti-Schuppen/MED vs live ISANA Sensitiv and 2-in-1; Herbal Essences Blütensanft vs live Fiji and Tiefenreinigung; Elvital Dream Length/Color Glanz/Bond Repair vs live Elvital Hydra and "Ultimate Shampoo" (= Glycolic Gloss); GLISS Full Hair Magic vs live GLISS x3; Plantur DMG Clinical / Plantur 21 vs live Plantur 39; Fructis Keratin Sleek vs live Fructis Locken; Wahre Schätze Kokosmilch vs live Honig Schätze, Aktivkohle, Hafermilch; Balea Professional Plex Care vs live Balea Professional Ultimate Volume.
- **Conditioner/mask siblings in other categories** (June snapshot) are separate products: e.g. Balea Professional Plex Care 2in1 (Maske), Syoss Intense Keratin (Maske), Garnier Wahre Schätze Kokosmilch & Macadamia (Conditioner). Not duplicates.
- **Caveat:** the TSV only contains products that have `product_shampoo_specs` rows; a paused product that exists in the catalog without spec rows would not show there. The EAN search across tracked files found none *(limited to what is tracked in git, not prod)*.
- **Ancillary existing-product updates still open** (not new products, but part of the same wave): (a) rename `Ultimate Shampoo` -> `Elvital Glycolic Gloss Shampoo` (`88c230c5-...`): the 2026-10-05 prod snapshot still shows `Ultimate Shampoo`, so it was **not applied** (fact); (b) add EAN 4015100893007 to existing deep-cleansing product Gliss Scalp Balance Tiefenreinigung (`05753f93-...`, from admin batch-03): status unknown, product is not in the shampoo-specs snapshot.

## Research cells (<=5 each), ordered by readiness

Order is by mean readiness score (EAN verified 20, price 10, image 10, protocol+usage text 10, INCI on file 25, source URLs up to 5, base 20, minus 8 per source-gap flag and 3 per decision flag). Scores are my own heuristic, only for ordering. Ordering note: D5 wants scalp-condition rows listed first in Nick's review; C1 is the scalp cell and is second by readiness, so it can be moved first at no cost.

| Order | Cell | Archetype | Members | Ready/Partial | Mean score |
|---:|---|---|---|---:|---:|
| 1 | C3 | Repair / protein / Plex-bond / keratin | Syoss Intense Repair Deep Caring Shampoo; L’Oréal Paris Elvital Bond Repair Shampoo Anti-Haarschäden; Balea PROFESSIONAL Shampoo Plex Care; ISANA PROFESSIONAL Shampoo Keratin & Repair; ISANA PROFESSIONAL Plex Shampoo | 5/0 | 96.0 |
| 2 | C1 | Scalp-condition (dandruff + sensitive-scalp targeted); D5 says list first for Nick | ISANA Shampoo Anti-Schuppen Wasserminze & Grüner Tee; ISANA MED Shampoo Jeden Tag (Ultra Sensitiv); ISANA MED Shampoo pH 5,5 hautneutral; head&shoulders Anti-Schuppen Shampoo Apple Fresh; ISANA MED Shampoo Totes Meer | 4/1 | 91.8 |
| 3 | C5 | Color / blonde / shine | Syoss Intense Color Deep Caring Shampoo; ISANA Shampoo Seidenglanz Magnolie & Lotus; JOHN FRIEDA Intensiv Silbershampoo; John Frieda Sheer Blonde Sheer Blonde Refresh & Shine Shampoo | 3/1 | 87.2 |
| 4 | C6 | Moisture / hydration / oil-nourish | Jean&Len Hydration Shampoo Pfirsich Chia; ISANA Shampoo Oil Repair Marulaöl; ISANA Shampoo Feuchtigkeit; Being Max Moisture Shampoo; IDA WARG Beauty Moisture Shampoo | 3/2 | 85.8 |
| 5 | C2 | Koffein / Wurzel / Men (hair-loss-adjacent language, keep cosmetic) | Syoss Men Intense Power Deep Caring Shampoo; Dr. Wolff Plantur DMG Clinical Shampoo; Bali Gents Coffein Activator Shampoo; Plantur 21 Nutri-Coffein Shampoo #langehaare; ISANA MEN Shampoo Energy Power | 2/3 | 81.4 |
| 6 | C4 | Mainstream silicone repair / length / sleek | L'Oréal Paris Elvital Dream Length Super Aufbau Shampoo; Pantene Pro-V Repair & Care XXL Shampoo; L’Oréal Paris Elvital Color Glanz Pflege Farbschutz Shampoo; Schwarzkopf Gliss Full Hair Magic Fülle-Shampoo | 1/3 | 79.0 |
| 7 | C7 | Curl / frizz / Being brand set | Being Bye Bye Anti-Frizz Shampoo; Being Curl Power Locken Shampoo; Being NOURISH + SHINE Daily Clean Shampoo; AUSSIE Shampoo Bouncy Curls | 0/4 | 71.2 |
| 8 | C8 | Mild everyday / natural-claim | Herbal Essences Blütensanft Rosenduft Shampoo; schauma Shampoo For Men; Garnier Fructis Keratin Sleek Shampoo; Garnier Wahre Schätze Shampoo Kokosmilch & Macadamia Normales & Trockenes Haar | 0/4 | 69.8 |

Held outside cells: **Fructis Coco Water** (blocked, would join C8 or C4 once its formula is resolved) and **Pantene Grow Abundant** (duplicate, drop).

Cell notes:
- **C3** is the most ready cell, but 3 of 5 members are v1.4 calibration holdouts (Syoss Intense Repair, Elvital Bond Repair, ISANA Professional Plex), and Keratin & Repair carries the non-numeric-wait ruling question.
- **C1** carries the DANDRUFF and TARGETED templates; copy must stay cosmetic. Three of five have non-DE direction fallbacks recorded (ISANA MED x3). H&S Apple Fresh has no INCI on file; use current GTIN 8001090896049.
- **C2** is all medically adjacent language (caffeine, root, "clinical", growth factor). Three genuine numeric-wait deviations (Plantur DMG, Plantur 21, Bali Gents).
- **C7 and C8** are least ready: no INCI on file for any member, Being formulas partly provisional or non-DE, brand-site JPG images to re-check against the product-only bar.
- Archetype grouping is mine from names, claims and templates *(inferred)*; no INCI-based clustering was done (no formula work in this task).

## Per-product inventory

Columns: bucket; EAN (all cross-source verified: yes for all); price EUR; template and deviation; INCI on file where; source URL count; image present (all yes). Full detail incl. URLs, usage text, claims and flags is in `inventory.json`.

| ID | Cell | Product | Size | EAN(s) | EUR | Template / deviation | INCI on file | Src | Bucket (score) | Flags |
|---|---|---|---|---|---:|---|---|---:|---|---|
| b02-i03 | C3 | Syoss Intense Repair Deep Caring Shampoo | 440 ml | 4015100860382 | 3.49 | STD | yes (admin-02) + holdout | 4 | ready (99) | info |
| b04-i01 | C3 | Balea PROFESSIONAL Shampoo Plex Care | 250 ml | 4070765006285 | 1.95 | STD | yes (draft manifest-04) | 2 | ready (97) | info |
| b04-i03 | C3 | ISANA PROFESSIONAL Plex Shampoo | 250 ml | 4305615975917 | 1.99 | STD | yes (draft manifest-04) + holdout | 2 | ready (97) | info |
| b04-i02 | C3 | ISANA PROFESSIONAL Shampoo Keratin & Repair | 250 ml | 4305615830940 | 1.29 | STD / dev:non-numeric | yes (draft manifest-04) | 2 | ready (94) | decision |
| b03-i09 | C3 | L’Oréal Paris Elvital Bond Repair Shampoo Anti-Haarschäden | 200 ml | 3600524074654 | 6.95 | STD | holdout only | 3 | ready (93) | info |
| b02-i09 | C1 | ISANA Shampoo Anti-Schuppen Wasserminze & Grüner Tee | 300 ml | 4305615566146 | 0.65 | DANDRUFF | yes (admin-02) | 2 | ready (97) | info, medical |
| b02-i11 | C1 | ISANA MED Shampoo Jeden Tag (Ultra Sensitiv) | 200 ml | 4305615629223 | 1.79 | TARGETED | yes (admin-02) | 2 | ready (97) | info, medical |
| b04-i00 | C1 | ISANA MED Shampoo Totes Meer | 200 ml | 4305615629230 | 0.99 | TARGETED | yes (draft manifest-04) | 2 | ready (97) | info, medical |
| b02-i12 | C1 | ISANA MED Shampoo pH 5,5 hautneutral | 400 ml | 4068134039743 | 1.69 | TARGETED / dev:non-numeric | yes (admin-02) | 3 | ready (95) | decision, info, medical |
| b03-i01 | C1 | head&shoulders Anti-Schuppen Shampoo Apple Fresh | 500 ml | 8001090896049 | 6.95 | DANDRUFF | no | 3 | partial (73) | info, medical |
| b02-i02 | C5 | Syoss Intense Color Deep Caring Shampoo | 440 ml | 4015100860368 | 3.49 | STD | yes (admin-02) | 3 | ready (98) | - |
| b02-i08 | C5 | ISANA Shampoo Seidenglanz Magnolie & Lotus | 300 ml | 4305615566160 | 0.65 | STD | yes (admin-02) | 3 | ready (98) | info |
| b02-i14 | C5 | JOHN FRIEDA Intensiv Silbershampoo | 250 ml | 5037156297133 | 9.99 | STD / dev:numeric | yes (admin-02) | 3 | ready (98) | info |
| b04-i06 | C5 | John Frieda Sheer Blonde Sheer Blonde Refresh & Shine Shampoo | 250 ml | 5037156296105 | - | STD | no | 3 | partial (55) | info, source_gap |
| b02-i05 | C6 | Jean&Len Hydration Shampoo Pfirsich Chia | 300 ml | 4262401738968 | 4.29 | STD | yes (admin-02) | 2 | ready (97) | info |
| b02-i10 | C6 | ISANA Shampoo Oil Repair Marulaöl | 300 ml | 4068134071118 | 0.65 | STD | yes (admin-02) | 2 | ready (97) | info |
| b02-i13 | C6 | ISANA Shampoo Feuchtigkeit | 300 ml | 4068134071132 | 0.65 | STD | yes (admin-02) | 2 | ready (97) | info |
| b03-i06 | C6 | IDA WARG Beauty Moisture Shampoo | 250 ml | 7340074775217 | 12.99 | STD | no | 3 | partial (73) | info |
| b03-i02 | C6 | Being Max Moisture Shampoo | 354 ml | 4895248005902 | 6.79 | STD | no | 3 | partial (65) | source_gap |
| b02-i01 | C2 | Syoss Men Intense Power Deep Caring Shampoo | 440 ml | 4015100860443 | 3.49 | STD | yes (admin-02) | 3 | ready (98) | medical |
| b04-i04 | C2 | ISANA MEN Shampoo Energy Power | 300 ml | 4305615633428 | 0.65 | STD / dev:non-numeric | yes (draft manifest-04) | 2 | ready (91) | decision, medical |
| b03-i00 | C2 | Dr. Wolff Plantur DMG Clinical Shampoo | 250 ml | 4008666770004 | 19.95 | STD / dev:numeric | no | 3 | partial (73) | info, medical |
| b03-i07 | C2 | Bali Gents Coffein Activator Shampoo | 200 ml | 4262391993507 | 6.99 | STD / dev:numeric | no | 3 | partial (73) | info, medical |
| b03-i12 | C2 | Plantur 21 Nutri-Coffein Shampoo #langehaare | 200 ml | 4008666755520 | 7.95 | STD / dev:numeric | no | 2 | partial (72) | info, medical |
| b02-i04 | C4 | L’Oréal Paris Elvital Color Glanz Pflege Farbschutz Shampoo | 400 ml | 3600524137731 | 4.79 | STD | yes (admin-02) | 3 | ready (98) | info |
| b01-i12 | C4 | L'Oréal Paris Elvital Dream Length Super Aufbau Shampoo | 1000 ml | 3600524062637 | 9.95 | STD | no | 3 | partial (73) | info |
| b03-i08 | C4 | Schwarzkopf Gliss Full Hair Magic Fülle-Shampoo | 250 ml | 4015100861723 | 2.99 | STD | no | 3 | partial (73) | info |
| b01-i14 | C4 | Pantene Pro-V Repair & Care XXL Shampoo | 500 ml | 8700216422413 | 5.95 | STD | no | 2 | partial (72) | info |
| b03-i03 | C7 | Being Bye Bye Anti-Frizz Shampoo | 354 ml | 4895248005889 | 6.79 | STD | no | 4 | partial (74) | info |
| b03-i04 | C7 | Being Curl Power Locken Shampoo | 354 ml | 4895248005896 | 6.79 | STD | no | 4 | partial (74) | info |
| b04-i07 | C7 | AUSSIE Shampoo Bouncy Curls | 300 ml | 8006530325530 | 4.95 | STD | no | 2 | partial (72) | info |
| b03-i05 | C7 | Being NOURISH + SHINE Daily Clean Shampoo | 354 ml | 4895248005865 | 7.95 | STD | no | 3 | partial (65) | info, source_gap |
| b03-i13 | C8 | Garnier Fructis Keratin Sleek Shampoo | 200 ml | 3600542638777 | 3.95 | STD | no | 3 | partial (73) | - |
| b04-i05 | C8 | Garnier Wahre Schätze Shampoo Kokosmilch & Macadamia Normales & Trockenes Haar | 250 ml | 3600542462402 | 2.49 | STD | no | 2 | partial (72) | - |
| b03-i10 | C8 | schauma Shampoo For Men | 400 ml | 4015100890792 | 1.95 | STD / dev:non-numeric | no | 2 | partial (69) | decision |
| b01-i13 | C8 | Herbal Essences Blütensanft Rosenduft Shampoo | 350 ml | 8700216212748 | 3.95 | STD | no | 3 | partial (65) | source_gap |
| b01-i04 | held | Garnier Fructis Shampoo Coco Water, fettiger Ansatz & trockene Spitzen | 400 ml | 3600541970533 | 3.45 | STD | no | 3 | blocked | blocker |
| b03-i11 | none (duplicate) | Pantene Pro-V Grow Abundant Shampoo Anti-Haarverlust | 290 ml | 8006530060042 | 7.95 | STD | no | 2 | duplicate | duplicate |

ID = `b<admin batch>-i<source_product_index>` inside `plans/scan-db-expansion/research/shampoo-v14/admin/batch-0N.json`. Multi-EAN rows: none among the 38 (Honig Schätze, the only multi-size-EAN product, is live).

### Flag detail (non-empty only)

- **b02-i03 Syoss Intense Repair Deep Caring Shampoo**
  - [info] Same EAN 4015100860382 is already a v1.4 calibration holdout (data/research/shampoo-inci/holdout-v3/products/syoss-intense-repair, captured 2026-09-01). Seen product for calibration/unseen-set purposes; formula-source file exists.
- **b04-i01 Balea PROFESSIONAL Shampoo Plex Care**
  - [info] Official dm packshot re-requested at 985x4000 and visually verified (notes-04).
- **b04-i03 ISANA PROFESSIONAL Plex Shampoo**
  - [info] Same EAN 4305615975917 is a v1.4 calibration holdout (holdout-v2/isana-professional-plex, official source, captured 2026-08-26).
  - [info] DE shop showed price but product was online-unavailable (notes-04).
- **b04-i02 ISANA PROFESSIONAL Shampoo Keratin & Repair**
  - [decision] Recorded deviation is NON-numeric 'kurz einwirken lassen' (notes-04 called it 'genuine' pre-ruling); Nick's 2026-09-04 ruling makes it ordinary STD - needs confirmation.
- **b03-i09 L’Oréal Paris Elvital Bond Repair Shampoo Anti-Haarschäden**
  - [info] Same EAN 3600524074654 is a v1.4 calibration holdout (holdout-v1/loreal-elvital-bond-repair-plus, captured 2026-08-26, official source, INCI on file there). Rossmann shows a shorter formula (non-blocking).
- **b02-i09 ISANA Shampoo Anti-Schuppen Wasserminze & Grüner Tee**
  - [medical] Anti-dandruff (Piroctone Olamine), TPL-SHAMPOO-DANDRUFF, cosmetic framing only (D5 scalp-condition).
  - [info] Candidate image and INCI come from Rossmann.dk exact-EAN page; German PDP has less INCI visibility (notes-02).
- **b02-i11 ISANA MED Shampoo Jeden Tag (Ultra Sensitiv)**
  - [medical] Sensitive-scalp positioning, TPL-SHAMPOO-TARGETED, cosmetic only (D5 scalp-condition).
  - [info] German PDP exposes no directions; protocol cites exact-EAN Rossmann Turkey page (non-DE fallback).
  - [info] Near-name sibling in v1.4 holdout-v1: 'ISANA MED Shampoo Jeden Tag' EAN 4305615629216 (urea formula). Different EAN and slug; do NOT merge (inferred: separate SKU).
- **b04-i00 ISANA MED Shampoo Totes Meer**
  - [medical] Sensitive/itchy-scalp positioning, TPL-SHAMPOO-TARGETED, cosmetic only (D5 scalp-condition).
  - [info] German PDP exposes no directions; protocol cites Rossmann Hungary wet-hair/rinse fallback (non-DE).
- **b02-i12 ISANA MED Shampoo pH 5,5 hautneutral**
  - [medical] Sensitive-scalp / pH-skin-neutral, TPL-SHAMPOO-TARGETED (D5 scalp-condition).
  - [decision] Recorded protocol deviation is a NON-numeric wait ('kurz einwirken lassen'); Nick's 2026-09-04 ruling treats that as ordinary STD use (plan says remainder not reopened) - needs confirmation.
  - [info] Directions come from a Ukrainian retailer (Hmarka); DE + first-party TR Rossmann corroborate EAN. No German directions on file.
- **b03-i01 head&shoulders Anti-Schuppen Shampoo Apple Fresh**
  - [medical] Anti-dandruff, TPL-SHAMPOO-DANDRUFF, cosmetic framing only (D5 scalp-condition).
  - [info] Current GTIN 8001090896049 (500 ml); historical 8700216219907 deliberately not attached (notes-03).
- **b02-i08 ISANA Shampoo Seidenglanz Magnolie & Lotus**
  - [info] Full INCI from exact-barcode Drogas retailer page, not German Rossmann (notes-02).
- **b02-i14 JOHN FRIEDA Intensiv Silbershampoo**
  - [info] Genuine numeric deviation: '1-3 Minuten einwirken lassen' (stays a deviation under the 2026-09-04 ruling).
  - [info] Older/other-retailer formula variant documented, not merged (notes-02).
- **b04-i06 John Frieda Sheer Blonde Sheer Blonde Refresh & Shine Shampoo**
  - [source_gap] No price captured (price_eur absent; schema allows it, apply lane/price-audit should fill).
  - [info] Older same-EAN formula on Rossmann DK recorded as version conflict; dm DE + manufacturer formula is the current one (notes-04).
- **b02-i05 Jean&Len Hydration Shampoo Pfirsich Chia**
  - [info] Manufacturer INCI ends with Genistein, dm omits it (formula-tail conflict, notes-02); INCI on file is the manufacturer version.
- **b02-i10 ISANA Shampoo Oil Repair Marulaöl**
  - [info] Directions from exact-EAN Rossmann Hungary first-party page (non-DE) (notes-02).
- **b02-i13 ISANA Shampoo Feuchtigkeit**
  - [info] EAN 4068134071132 was recovered 2026-09-03 via Rossmann + Drogas; cross-source true (receipt.json).
- **b03-i06 IDA WARG Beauty Moisture Shampoo**
  - [info] Rossmann is identity/price/image source; formula via brand pro-size 500 ml page + Apotea (notes-03).
- **b03-i02 Being Max Moisture Shampoo**
  - [source_gap] Formula authority provisional: Rossmann hides INCI; formula from manufacturer + Superdrug (non-DE) (notes-03).
- **b02-i01 Syoss Men Intense Power Deep Caring Shampoo**
  - [medical] Growth-factor/caffeine 'energy' marketing: keep cosmetic, never hair-loss efficacy (notes-02).
- **b04-i04 ISANA MEN Shampoo Energy Power**
  - [decision] Name correction: frozen selection said 'Energy Effect', current exact-EAN pack/PDP says 'Energy Power' (admin snapshot already uses Energy Power).
  - [decision] Recorded deviation is NON-numeric 'kurz einwirken lassen' - same ruling confirmation as above.
  - [medical] Caffeine/keratin 'energy' language: cosmetic only (low).
- **b03-i00 Dr. Wolff Plantur DMG Clinical Shampoo**
  - [medical] 'Clinical'/root marketing is medically adjacent (hair-loss-adjacent); keep cosmetic, flag in notes.
  - [info] Genuine numeric deviation: '2 Minuten einwirken lassen'. Highest price in set (19.95 EUR). Image was 'recovered' product-only dm asset (notes-03).
- **b03-i07 Bali Gents Coffein Activator Shampoo**
  - [medical] Caffeine/AnaGain/root language: cosmetic only, not a scalp-condition claim.
  - [info] Genuine numeric deviation: '2 Minuten einwirken lassen'.
- **b03-i12 Plantur 21 Nutri-Coffein Shampoo #langehaare**
  - [medical] Caffeine/root language: cosmetic only.
  - [info] Genuine numeric deviation: 'mindestens 2 Minuten einwirken lassen'.
- **b02-i04 L’Oréal Paris Elvital Color Glanz Pflege Farbschutz Shampoo**
  - [info] Exact 400 ml formula differs from the 1000 ml formula/GTIN; never merge. Directions are generic-rinse-out policy ('guessed-conservative' protocol confidence, notes-02).
- **b01-i12 L'Oréal Paris Elvital Dream Length Super Aufbau Shampoo**
  - [info] 1000 ml pack only; no 300 ml alias (notes-01).
- **b03-i08 Schwarzkopf Gliss Full Hair Magic Fülle-Shampoo**
  - [info] Minor late-formula difference visible between sources (notes-03).
- **b01-i14 Pantene Pro-V Repair & Care XXL Shampoo**
  - [info] 500 ml frozen; never infer 1000/300 ml aliases. EAN corroborated by dm DE+AT and Rossmann exact-EAN (notes-01).
- **b03-i03 Being Bye Bye Anti-Frizz Shampoo**
  - [info] Formula from Being ES page; candidate image is a brand-site 'CAROUSEL' JPG - re-check product-only/front-facing bar (notes-03; inferred risk).
- **b03-i04 Being Curl Power Locken Shampoo**
  - [info] Formula from Being brand page (non-DE manufacturer).
- **b04-i07 AUSSIE Shampoo Bouncy Curls**
  - [info] EAN corroborated by official P&G/for-me record that labels it 'Aussie Shampoo Curls'; GTIN is the identity bridge (receipt.json ean_recoveries).
- **b03-i05 Being NOURISH + SHINE Daily Clean Shampoo**
  - [source_gap] Formula authority provisional: global-English formula + minor later-order difference; identity/EAN confidence 'inferred' in notes-03.
  - [info] Candidate image is a brand-site JPG; re-check product-only bar (inferred risk).
- **b03-i10 schauma Shampoo For Men**
  - [decision] Draft recorded a deviation for NON-numeric 'kurz einwirken lassen'; Nick's 2026-09-04 ruling treats that as ordinary STD (plan: remainder not reopened) - needs confirmation.
- **b01-i13 Herbal Essences Blütensanft Rosenduft Shampoo**
  - [source_gap] Exact-EAN formula conflict between dm DE and Shop Apotheke; dm DE formula selected; draft specs were 'guessed-conservative' (notes-01).
- **b01-i04 Garnier Fructis Shampoo Coco Water, fettiger Ansatz & trockene Spitzen**
  - [blocker] Material formula conflict: dm exact-GTIN formula vs Garnier manufacturer formula disagree; wave-02/blocked-products.json status material_formula_conflict. Needs exact-pack manufacturer asset or independent exact-GTIN corroboration (or a physical pack read).
- **b03-i11 Pantene Pro-V Grow Abundant Shampoo Anti-Haarverlust**
  - [duplicate] ALREADY IN CATALOG as 'Pantene Grow Abundance' (prod id 7373656d-5fd7-46e8-81a3-2ef29e3c4c18, cohort C50, rec=true). Identical EAN 8006530060042 / 290 ml sits in data/scanner-catalog-coverage/2026-08-26/phase1-existing-identifier-backfill-e5-v1.json for that exact product id. Must NOT be created as new; at most an existing_product_updates no-op.

## Data-state caveats the research cells should know

- **No frozen source packets exist for any of the 38** except Coco Water's blocked packet (`pilot/waves/wave-02/fructis-coco-water/source-packet.json`). The v1.4 lane only froze packets for the first 14. All stored INCI text, claims, directions and prices date from the 2026-09-02/03 administrative pass and must be re-captured and fingerprinted by the cells.
- **Draft manifests carry invalidated classification.** `shampoo-manifest-01..04.json` property projections, `category_specs`, thickness/concern eligibility were quarantined on 2026-09-03 and must not be used as priors. The classification-free `admin/batch-0N.json` is the right administrative source, but note admin batch-04 omitted authority-facts INCI for 4/0-4/4 and batch-01/03 never stored INCI at all. For the 5 batch-04 INCI texts I read the INCI string out of the draft manifest's `authority_facts` evidence (text is source INCI, not a classification), flagged in `inci_location`.
- **Images are candidates only** (research-time visual QA claims in notes). Final cutouts go through the local image pipeline; Being Bye Bye, Being Nourish + Shine, Plantur DMG, and ISANA Anti-Schuppen (Rossmann.dk URL) are the ones to re-check first *(inferred from source domain/notes)*.
- **Prices are 2026-09-02 values**; the price-audit lane now exists (#633), so refresh before apply. John Frieda Sheer Blonde has none.
- Several protocols rely on **non-DE exact-EAN fallbacks** for directions (ISANA MED x3, ISANA Oil Repair, ISANA MED pH from a Ukrainian retailer). Under the generic-rinse-out ruling STD/TARGETED stamps still stand, but TARGETED/DANDRUFF evidence 'is not weakened' per the execution plan.
- Draft deviation records still use pre-ruling logic (e.g. notes-04 calls non-numeric waits 'genuine').
- `shampoo-wave-extension.json/.md` still carry the header `PROPOSAL - not yet reviewed by Nick` (stale; plan and 2026-09-03 approval supersede it).

## Blockers and decisions needing Nick

1. **Pantene Pro-V Grow Abundant (b03-i11) is a live duplicate.** Proposed (not decided): drop from Track B; the apply lane verifies in prod whether EAN 8006530060042 is already attached to `7373656d-...` and, if not, adds it through `existing_product_updates`. Confirm.
2. **Fructis Coco Water (b01-i04) is blocked.** The 400 ml dm exact-GTIN formula and the Garnier manufacturer formula conflict materially. Resolution needs an exact-pack manufacturer asset or an independent exact-GTIN source; a physical pack photo/scan from Nick is the practical route *(inferred)*. Alternative: drop it from the wave.
3. **Non-numeric contact-time ruling.** Nick ruled on 2026-09-04 that non-numeric wording ("kurz einwirken lassen") is ordinary `TPL-SHAMPOO-STD` use, not a deviation, but plan.md says the paused 38 are not reopened by it. Four drafts still record such deviations: schauma For Men (b03-i10), ISANA MED pH 5,5 (b02-i12, also from a Ukrainian-retailer source), ISANA Professional Keratin & Repair (b04-i02), ISANA MEN Energy Power (b04-i04). Recommendation *(inferred)*: apply the ruling and clear them; confirm.
4. **Genuine numeric-wait deviations (4):** John Frieda Silber (1-3 min), Plantur DMG Clinical (2 min), Bali Gents Coffein Activator (2 min), Plantur 21 Nutri-Coffein (min. 2 min). They stay deviations under the ruling and are surfaced in the validator's deviation-flagged list for human review; confirm they ship as STD with the deviation recorded, or hold them.
5. **Calibration-holdout products in Track B (3):** Syoss Intense Repair, Elvital Bond Repair, ISANA Professional Plex. Decide whether Track B researching them under v1.6 is acceptable given they were used in v1.4 holdouts, and whether the unseen set must exclude them *(inferred relevance to D2)*.
6. **Ancillary:** the Glycolic Gloss rename (`88c230c5-...`) is still unapplied in prod; the Gliss Scalp Balance EAN add is of unknown status. Include both in the first Track B apply batch? (They are not new products.)
7. **Medical-language products (10):** nothing to decide now; they need cosmetic-only copy and a flag in the notes per the playbook rule.

Not blockers (resolved by the files): the 15 extension candidates "pending Nick's skim" in `shampoo-research-handoff.md` were confirmed in `shampoo-wave-research-execution-plan.md` ("Nick confirms this plan ... includes the 15 extension candidates") and by the 2026-09-03 expansion approval in `focus-v15-engine-expansion-plan.md`.

## Sources read

`shampoo-v14/plan.md`, `focus-v15-engine-expansion-plan.md`, `admin/batch-01..04.json`, `admin/receipt.json`, `shampoo-manifest-01..04.json`, `shampoo-manifest-scannable-14.json`, `scannable-14-preflight-receipt.json`, `approved-manifest-sync-receipt.json`, `pilot/waves/wave-02/blocked-products.json` and Coco Water source packet, `shampoo-research-notes-01..04.md`, `shampoo-research-handoff.md`, `shampoo-wave-research-execution-plan.md`, `selection-batch1-draft.json`, `shampoo-wave-extension.json`, `inputs/prod-shampoo-specs-2026-10-05.tsv`, `src/lib/product-intake/expansion-manifest.ts`, `data/research/shampoo-inci/holdout-v1/v2/v3` formula sources, `data/scanner-catalog-coverage/2026-08-26/*` (Pantene), `data/product-catalog-snapshot.json`, `docs/scan-db-expansion-playbook.md`.
