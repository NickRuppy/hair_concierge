# Track B inventory: the paused new shampoo products (reconciled 2026-10-07)

Status: research/planning input only. Original snapshot 2026-10-05 (read-only, repo files); **reconciled 2026-10-07** against the catalog changes made since and Nick's rulings R5-R10 (`../rulings.md`). Details of what changed and why: `reconciliation-2026-10-07.md`. No web, no prod, no edits outside `plans/shampoo-v16/track-b/`. Anything inferred (rather than read) is marked *(inferred)*. Machine-readable rows: `inventory.json` (schema v2, same directory).

## Plain-language summary

- **38 products were paused on 2026-10-05; 34 still are.** 3 are now **already live**, 1 is a **confirmed duplicate** (dropped), 1 is **blocked** (Coco Water), and **33 are researchable** in 8 cells.
  - *Already live* (3, created 2026-10-07 by a parallel session, same EAN/name/size as the Track B rows): ISANA MED Jeden Tag (Ultra Sensitiv) `a1451c9b-fb55-406d-a81f-c513cc4ddcdf`, ISANA MED Totes Meer `8a90f0fa-9cb1-458a-93f3-c2374e6d8f16`, ISANA MED pH 5,5 hautneutral `94829f16-b21d-4061-9dcc-cbd43dcb4274`. They leave new creation.
  - *Dropped duplicate* (1): Pantene Pro-V Grow Abundant (EAN 8006530060042) = live "Pantene Grow Abundance" `7373656d-5fd7-46e8-81a3-2ef29e3c4c18`; its EAN is already attached in prod (Nick-confirmed 2026-10-07). No update needed.
  - *Blocked* (1): Garnier Fructis Coco Water (R7: stays in Track B, hunt for a deciding source; never classified from either conflicting formula list).
  - *Researchable* (33): **15 ready, 18 partial.** Even the ready ones need the formula re-frozen from live sources (stored text dates from 2026-09-02, no frozen packets).
- The other three new live shampoos are **not** among the 38: Balea Professional Hydra Volume `1311e51c-7941-4d2c-b9b4-7a450ee37f15` (recommended price-audit swap), ISANA MED Anti Schuppen `a836ef4f-f406-4557-b908-0155919e2c4f` and ISANA MED Ultra Sensitiv+ Anti-Schuppen `34697aec-761c-45e7-9a92-986f786dd022`. All six new live products are fine/normal-hair only (no coarse rows), so they do not change the coarse cells (inferred from the local research packages; prod not queried).
- **Protocol deviations: 4 remain, all numeric** (John Frieda Silber 1-3 min, Plantur DMG Clinical 2 min, Bali Gents 2 min, Plantur 21 min. 2 min). R9: standard template plus one documented extra step; **Nick approves each of the four in review**. The 4 non-numeric "kurz einwirken lassen" deviations are cleared by R8 (schauma For Men, ISANA Professional Keratin & Repair, ISANA MEN Energy Power; ISANA MED pH 5,5 is live and moot).
- **7 researchable products carry medically adjacent language** (dandruff, hair-loss/caffeine-root marketing); copy stays cosmetic.
- **R10:** Syoss Intense Repair, Elvital Bond Repair and ISANA Professional Plex are researched fresh like every other product; their v1.4 holdout results are not carried forward.
- **R5 (no-gap principle):** Track B prioritises a light oily-scalp shampoo that suits thick hair. Seven products are flagged as *(inferred)* candidates (1 strong, 3 plausible, 3 weak); none has formula, weight or thickness data yet, so this is a reading order, not a finding. See "Thick hair + oily scalp candidates".
- Everything else is administratively complete: all researchable products have a GS1-valid, cross-source-verified EAN, a candidate image and a protocol stamp; 32 of 33 have a price.

### Needs Nick (details in the last section)
1. Approve each of the four numeric-wait deviations in review (R9), after their research.
2. Coco Water: supply or approve a route to a deciding source (R7). It is also the strongest R5 candidate by name.
3. ISANA Anti-Schuppen Wasserminze & Grüner Tee may currently be unavailable at Rossmann (parallel-session note, 2026-10-06): decide whether to still research it.
4. Nothing else is open from the 2026-10-05 list: Pantene (dropped), non-numeric waits (R8) and the three holdout products (R10) are ruled.

## Counts

| | 2026-10-05 | 2026-10-07 |
|---|---:|---:|
| Paused (total) | 38 | 34 |
| Already live (moved out) | 0 | 3 |
| Duplicate of live (dropped) | 1 | 1 |
| Blocked | 1 | 1 |
| Researchable (in cells) | 36 | 33 |
| Ready (researchable) | 18 | 15 |
| Partial (researchable) | 18 | 18 |
| Cells | 8 | 8 |
| INCI text on file in repo (researchable) | 18 | 15 |
| Price missing (researchable) | 1 | 1 |
| Protocol deviations (numeric / non-numeric) | 4 / 4 | 4 / 0 (4 cleared by R8) |
| Medical-language flagged | 10 | 7 |
| Fresh-research (R10) products | 0 | 3 |
| Thick + oily scalp candidates (inferred) | - | 7 (1 strong, 3 plausible, 3 weak) |

Accounting by admin batch (2026-10-07), still paused: batch-01 4 (Coco Water blocked, Dream Length, Blütensanft, Pantene Repair & Care XXL); batch-02 10 (12 minus Jeden Tag and pH 5,5, now live); batch-03 13 (14 minus the dropped Pantene duplicate); batch-04 7 (8 minus Totes Meer, now live). 4 + 10 + 13 + 7 = 34 = 33 researchable + 1 blocked. Original: 4 + 12 + 14 + 8 = 38.

Live ones in the original wave (matched to prod snapshot cohort X14, not paused): Honig Schätze, Syoss Intense Keratin, NIVEA Power Repair, schauma Repair & Pflege, Herbal Essences Fiji, GLISS Liquid Silk, GLISS Total Repair, Elvital Hydra Hyaluronic, Fructis Locken Methode, Being Big Hair, GLISS Sealing Miracle, h&s Classic Clean, ISANA Sensitiv, ISANA 2-in-1 Volumen.

## Newly live products and the parallel ISANA MED research

Prod now has 74 products with shampoo specs (68 at the 2026-10-05 snapshot). Match method: brand + name + size and EAN against the 38 rows.

| Live product | Prod id | EAN | Match in Track B | Research package (submission id) |
|---|---|---|---|---|
| ISANA MED Shampoo Jeden Tag (Ultra Sensitiv), 200 ml | `a1451c9b-fb55-406d-a81f-c513cc4ddcdf` | 4305615629223 | **b02-i11** (identical EAN, name, size) | `b0462a7d-938b-4d59-83c4-a8af7ce26d68` |
| ISANA MED Shampoo Totes Meer, 200 ml | `8a90f0fa-9cb1-458a-93f3-c2374e6d8f16` | 4305615629230 | **b04-i00** (identical) | `d2f27a6f-6f1f-4c70-bfd9-83eaffd1bcca` |
| ISANA MED Shampoo pH 5,5 hautneutral, 400 ml | `94829f16-b21d-4061-9dcc-cbd43dcb4274` | 4068134039743 | **b02-i12** (identical) | `8f87957a-f3dd-4ef1-84fd-29efed572049` |
| ISANA MED Shampoo Anti Schuppen, 200 ml | `a836ef4f-f406-4557-b908-0155919e2c4f` | 4305615629209 | none (not the Wasserminze & Grüner Tee product, EAN 4305615566146) | `337d26bc-0cf8-4471-a536-434f75bdae7f` |
| ISANA MED Ultra Sensitiv+ Anti-Schuppen Shampoo, 200 ml | `34697aec-761c-45e7-9a92-986f786dd022` | 4068134169129 | none | `c76157b5-2df1-4dbd-9a09-e16d39a644c3` |
| Balea Professional Shampoo Hydra Volume, 250 ml | `1311e51c-7941-4d2c-b9b4-7a450ee37f15` | 4066447990126 | none (Track B has Balea Plex Care, a different SKU) | `41e9950e-0da7-459d-b190-e56918242d20` (2026-10-05 package) |

**Where the ISANA MED research lives and which standard it used.**
- Durable but gitignored (`/ops/*` is in `.gitignore`): `/Users/nick/AI_work/hair_conscierge/ops/product-intake-research/2026-10-06/<submission-id>/` (root checkout). Each package has `payload.json` (final product, sources, identifiers, specs, field rationales, review), `validation.json`, images and an `approval.md`; its `research.md` is an empty template. Hydra Volume: `.../2026-10-05/41e9950e-.../`.
- Not durable (session scratchpad only): `/private/tmp/claude-501/-Users-nick-AI-work-hair-conscierge/400d6eb2-12b2-48ab-8924-d69f4d5e664d/scratchpad/isana-med/` holds the per-product INCI and all-property reports (`isana-med-*.md/json`), `range.md` (Rossmann range check) and `uebersicht.md`. Copy anything Track B wants to keep.
- Standard: **Shampoo-Standard v1.6 CANDIDATE** (payload `draft.engine`: shampoo-standard, state `pending_lock`, target v1.6): not locked, not calibrated, one researcher per product, no blind double run. Nick signed off the values 2026-10-07. Specs: fine + normal only, `cleansing_intensity` regular, weight low. Totes Meer is `irritationen/irritated` by Nick's ruling (the candidate's default was `normal`). Anti Schuppen has both a dandruff row and an oily row. Protocols use the normative TARGETED/DANDRUFF templates (the packs carry no directions).

## Overlap with the live catalog

Method (original, 2026-10-05): brand+name token similarity of all 38 against the 68 rows of `../inputs/prod-shampoo-specs-2026-10-05.tsv`, plus an exact-EAN search of every tracked file; re-run on 2026-10-07 against the six new live products (EAN and brand+name+size).

- **One true duplicate (dropped):** Pantene Pro-V Grow Abundant Shampoo Anti-Haarverlust (b03-i11, EAN 8006530060042, 290 ml) = live "Pantene Grow Abundance" (`7373656d-5fd7-46e8-81a3-2ef29e3c4c18`). The name similarity score alone was only 0.33, so name matching would have missed it. Resolved 2026-10-07: EAN already attached in prod; no new product, no update.
- **Three already-live matches:** b02-i11, b04-i00, b02-i12 (table above).
- **No exact brand+name match** for any other paused product, and no EAN match to any other catalog or backfill file.
- **Near-name siblings that are different SKUs (do not merge):** Syoss Men/Color/Repair vs live Syoss Intense Volume/Fullness/Curls/Keratin; h&s Apple Fresh vs live h&s Classic Clean and Anti Schuppen Sensitive; ISANA Seidenglanz/Feuchtigkeit/Oil Repair/Anti-Schuppen Wasserminze vs live ISANA Sensitiv and 2-in-1, and now vs the live ISANA MED Anti Schuppen and Ultra Sensitiv+ Anti-Schuppen (different EANs); Herbal Essences Blütensanft vs live Fiji and Tiefenreinigung; Elvital Dream Length/Color Glanz/Bond Repair vs live Elvital Hydra and "Ultimate Shampoo" (= Glycolic Gloss); GLISS Full Hair Magic vs live GLISS x3; Plantur DMG Clinical / Plantur 21 vs live Plantur 39; Fructis Keratin Sleek vs live Fructis Locken; Wahre Schätze Kokosmilch vs live Honig Schätze, Aktivkohle, Hafermilch; Balea Professional Plex Care vs live Balea Professional Hydra Volume (replaced Ultimate Volume) .
- **Conditioner/mask siblings in other categories** (June snapshot) are separate products, not duplicates.
- **Caveat:** the TSV only contains products with `product_shampoo_specs` rows, and the six new live products were matched from local research packages and the task brief, not from a fresh prod read.
- **Ancillary existing-product updates still open** (not new products; status not re-verified on 2026-10-07): (a) rename `Ultimate Shampoo` -> `Elvital Glycolic Gloss Shampoo` (`88c230c5-1020-4648-a10e-c2a1e8c87e0e`): not applied in the 2026-10-05 snapshot; (b) add EAN 4015100893007 to Gliss Scalp Balance Tiefenreinigung (`05753f93-907f-427d-a4dc-0a690ff3a76d`): status unknown. (c) The Pantene EAN no-op is no longer needed.

## Research cells (<=5 each)

Two orders. **Review order** puts the scalp-condition cell first (D5). **Research start order** puts C2 first because R5 names the caffeine/men cell as the place to start the hunt for a light oily-scalp shampoo that suits thick hair; C1 (scalp-condition) is second there. The remaining cells are ordered by mean readiness (EAN verified 20, price 10, image 10, protocol+usage text 10, INCI on file 25, source URLs up to 5, base 20, minus 8 per source-gap flag and 3 per decision flag; my own heuristic, only for ordering).

| Review order (D5) | Research start (R5) | Cell | Archetype | Members | n | Ready/Partial | Mean score | Thick + oily scalp candidates (inferred) |
|---:|---:|---|---|---|---:|---:|---:|---|
| 1 | 2 | C1 | Scalp-condition: anti-dandruff (D5: list first for Nick) | ISANA Shampoo Anti-Schuppen Wasserminze & Grüner Tee; head&shoulders Anti-Schuppen Shampoo Apple Fresh | 2 | 1/1 | 85.0 | head&shoulders Anti-Schuppen Shampoo Apple Fresh (plausible) |
| 2 | 1 | C2 | Koffein / Wurzel / Men; R5 priority cell (light oily-scalp shampoo for thick hair); hair-loss-adjacent language, keep cosmetic | Syoss Men Intense Power Deep Caring Shampoo; Dr. Wolff Plantur DMG Clinical Shampoo; Bali Gents Coffein Activator Shampoo; Plantur 21 Nutri-Coffein Shampoo #langehaare; ISANA MEN Shampoo Energy Power | 5 | 2/3 | 81.4 | Syoss Men Intense Power Deep Caring Shampoo (plausible), Dr. Wolff Plantur DMG Clinical Shampoo (weak), Bali Gents Coffein Activator Shampoo (plausible), Plantur 21 Nutri-Coffein Shampoo #langehaare (weak) |
| 3 | 3 | C3 | Repair / protein / Plex-bond / keratin | Syoss Intense Repair Deep Caring Shampoo; L’Oréal Paris Elvital Bond Repair Shampoo Anti-Haarschäden; Balea PROFESSIONAL Shampoo Plex Care; ISANA PROFESSIONAL Shampoo Keratin & Repair; ISANA PROFESSIONAL Plex Shampoo | 5 | 5/0 | 96.0 | - |
| 4 | 4 | C5 | Color / blonde / shine | Syoss Intense Color Deep Caring Shampoo; ISANA Shampoo Seidenglanz Magnolie & Lotus; JOHN FRIEDA Intensiv Silbershampoo; John Frieda Sheer Blonde Sheer Blonde Refresh & Shine Shampoo | 4 | 3/1 | 87.2 | - |
| 5 | 5 | C6 | Moisture / hydration / oil-nourish | Jean&Len Hydration Shampoo Pfirsich Chia; ISANA Shampoo Oil Repair Marulaöl; ISANA Shampoo Feuchtigkeit; Being Max Moisture Shampoo; IDA WARG Beauty Moisture Shampoo | 5 | 3/2 | 85.8 | - |
| 6 | 6 | C4 | Mainstream silicone repair / length / sleek | L'Oréal Paris Elvital Dream Length Super Aufbau Shampoo; Pantene Pro-V Repair & Care XXL Shampoo; L’Oréal Paris Elvital Color Glanz Pflege Farbschutz Shampoo; Schwarzkopf Gliss Full Hair Magic Fülle-Shampoo | 4 | 1/3 | 79.0 | - |
| 7 | 7 | C7 | Curl / frizz / Being brand set | Being Bye Bye Anti-Frizz Shampoo; Being Curl Power Locken Shampoo; Being NOURISH + SHINE Daily Clean Shampoo; AUSSIE Shampoo Bouncy Curls | 4 | 0/4 | 71.2 | - |
| 8 | 8 | C8 | Mild everyday / natural-claim | Herbal Essences Blütensanft Rosenduft Shampoo; schauma Shampoo For Men; Garnier Fructis Keratin Sleek Shampoo; Garnier Wahre Schätze Shampoo Kokosmilch & Macadamia Normales & Trockenes Haar | 4 | 0/4 | 69.8 | schauma Shampoo For Men (weak) |

Held outside cells: **Fructis Coco Water** (blocked, R7; would join C1, the scalp/oily-roots cell, once its formula is resolved). Dropped: **Pantene Grow Abundant** (duplicate). Moved out as live: b02-i11, b04-i00, b02-i12 (formerly C1).

Cell notes:
- **C1** was rebuilt: it lost its three ISANA MED rows to the live catalog and is now the two dandruff rows. It stays small on purpose (D5: Nick reviews the scalp cell first); there is no archetype-similar product to pad it with. ISANA Wasserminze may be unavailable at Rossmann (see flags).
- **C2** is all medically adjacent language (caffeine, root, "clinical", growth factor). Three numeric-wait deviations (R9: Plantur DMG, Plantur 21, Bali Gents), one R8-cleared (ISANA MEN Energy Power). R5 priority cell.
- **C3** is the most ready cell. R10: Syoss Intense Repair, Elvital Bond Repair, ISANA Professional Plex are researched fresh (holdout results are a comparison point only); Keratin & Repair's non-numeric wait is cleared by R8.
- **C7 and C8** are least ready: no INCI on file for any member, Being formulas partly provisional or non-DE, brand-site JPG images to re-check against the product-only bar. schauma For Men (C8): R8-cleared.
- Archetype grouping is mine from names, claims and templates *(inferred)*; no INCI-based clustering was done.

## Thick hair + oily scalp candidates (R5, inferred)

R5: no hair-thickness x scalp profile may be left without a recommendable shampoo; the weakest cell today is coarse x oily (one product, Monday Volume Kraft & Fülle, kept only as a documented exception). Track B looks for a **lighter oily-scalp shampoo that suits thick hair**. Basis here is **names and on-file claims only** *(inferred)*: no formula, weight, thickness or oily-scalp evidence has been read for any of these, and none of the names claims "thick hair". Treat this as a reading order for the research cells. The six new live products do not help: all are fine/normal only.

| Strength (inferred) | Product | Cell | Basis |
|---|---|---|---|
| strong | Garnier Fructis Coco Water, fettiger Ansatz & trockene Spitzen | held (blocked, R7) | Name states "fettiger Ansatz" (oily roots). Resolving the R7 formula conflict is therefore also an R5 task. |
| plausible | head&shoulders Apple Fresh | C1 | Anti-dandruff, daily-use fresh variant; no claims text on file. |
| plausible | Syoss Men Intense Power Deep Caring | C2 | Men line "for normal hair"; on-file claim: cleansing/refreshing, caffeine-energy complex. "Deep Caring" muddies the weight reading. |
| plausible | Bali Gents Coffein Activator | C2 | Men/caffeine shampoo applied on the scalp; no claims text on file. |
| weak | Plantur 21 Nutri-Coffein #langehaare | C2 | Caffeine shampoo for long hair; length-care positioning suggests a richer formula. |
| weak | Dr. Wolff Plantur DMG Clinical | C2 | Root/caffeine positioning only. |
| weak | schauma Shampoo For Men | C8 | Mild everyday men shampoo, 400 ml; no oily-scalp claim on file. |

Counter-signals on file (not candidates on their own claims): ISANA MEN Energy Power claims "feines & energieloses Haar" (fine hair); ISANA Anti-Schuppen Wasserminze & Grüner Tee claims "dry hair and flaky scalp" (dry scalp). Decision rule for later: a candidate only counts if the fresh v1.6 research gives it an oily scalp route and a low weight that the thick-hair rule accepts; then Monday's coarse x oily exception can be removed (R5).

## Per-product inventory

Columns: cell; EAN (all cross-source verified); price EUR; template and deviation; INCI on file where; source URL count; readiness bucket (score; the 2026-10-05 heuristic). Rows are ordered by review order, then held/live/dropped rows. Full detail incl. URLs, usage text, claims, rulings applied and flags is in `inventory.json` (`disposition`, `rulings_applied`, `already_live`, `thick_oily_scalp_candidate`).

| ID | Cell | Product | Size | EAN(s) | EUR | Template / deviation | INCI on file | Src | Bucket (score) | Flags |
|---|---|---|---|---|---:|---|---|---:|---|---|
| b02-i09 | C1 | ISANA Shampoo Anti-Schuppen Wasserminze & Grüner Tee | 300 ml | 4305615566146 | 0.65 | DANDRUFF | yes (admin-02) | 2 | ready (97) | info, medical |
| b03-i01 | C1 | head&shoulders Anti-Schuppen Shampoo Apple Fresh | 500 ml | 8001090896049 | 6.95 | DANDRUFF | no | 3 | partial (73) | info, medical, r5_candidate |
| b02-i01 | C2 | Syoss Men Intense Power Deep Caring Shampoo | 440 ml | 4015100860443 | 3.49 | STD | yes (admin-02) | 3 | ready (98) | medical, r5_candidate |
| b04-i04 | C2 | ISANA MEN Shampoo Energy Power | 300 ml | 4305615633428 | 0.65 | STD (R8: non-numeric wait cleared) | yes (draft manifest-04) | 2 | ready (91) | info, medical, resolved |
| b03-i00 | C2 | Dr. Wolff Plantur DMG Clinical Shampoo | 250 ml | 4008666770004 | 19.95 | STD + extra step (R9, Nick approves) | no | 3 | partial (73) | info, medical, r5_candidate |
| b03-i07 | C2 | Bali Gents Coffein Activator Shampoo | 200 ml | 4262391993507 | 6.99 | STD + extra step (R9, Nick approves) | no | 3 | partial (73) | info, medical, r5_candidate |
| b03-i12 | C2 | Plantur 21 Nutri-Coffein Shampoo #langehaare | 200 ml | 4008666755520 | 7.95 | STD + extra step (R9, Nick approves) | no | 2 | partial (72) | info, medical, r5_candidate |
| b02-i03 | C3 | Syoss Intense Repair Deep Caring Shampoo | 440 ml | 4015100860382 | 3.49 | STD | yes (admin-02) + v1.4 holdout | 4 | ready (99) | info, ruling |
| b04-i01 | C3 | Balea PROFESSIONAL Shampoo Plex Care | 250 ml | 4070765006285 | 1.95 | STD | yes (draft manifest-04) | 2 | ready (97) | info |
| b04-i03 | C3 | ISANA PROFESSIONAL Plex Shampoo | 250 ml | 4305615975917 | 1.99 | STD | yes (draft manifest-04) + v1.4 holdout | 2 | ready (97) | info, ruling |
| b04-i02 | C3 | ISANA PROFESSIONAL Shampoo Keratin & Repair | 250 ml | 4305615830940 | 1.29 | STD (R8: non-numeric wait cleared) | yes (draft manifest-04) | 2 | ready (94) | resolved |
| b03-i09 | C3 | L’Oréal Paris Elvital Bond Repair Shampoo Anti-Haarschäden | 200 ml | 3600524074654 | 6.95 | STD | holdout only (comparison point, R10) | 3 | ready (93) | info, ruling |
| b02-i02 | C5 | Syoss Intense Color Deep Caring Shampoo | 440 ml | 4015100860368 | 3.49 | STD | yes (admin-02) | 3 | ready (98) | - |
| b02-i08 | C5 | ISANA Shampoo Seidenglanz Magnolie & Lotus | 300 ml | 4305615566160 | 0.65 | STD | yes (admin-02) | 3 | ready (98) | info |
| b02-i14 | C5 | JOHN FRIEDA Intensiv Silbershampoo | 250 ml | 5037156297133 | 9.99 | STD + extra step (R9, Nick approves) | yes (admin-02) | 3 | ready (98) | info |
| b04-i06 | C5 | John Frieda Sheer Blonde Sheer Blonde Refresh & Shine Shampoo | 250 ml | 5037156296105 | - | STD | no | 3 | partial (55) | info, source_gap |
| b02-i05 | C6 | Jean&Len Hydration Shampoo Pfirsich Chia | 300 ml | 4262401738968 | 4.29 | STD | yes (admin-02) | 2 | ready (97) | info |
| b02-i10 | C6 | ISANA Shampoo Oil Repair Marulaöl | 300 ml | 4068134071118 | 0.65 | STD | yes (admin-02) | 2 | ready (97) | info |
| b02-i13 | C6 | ISANA Shampoo Feuchtigkeit | 300 ml | 4068134071132 | 0.65 | STD | yes (admin-02) | 2 | ready (97) | info |
| b03-i06 | C6 | IDA WARG Beauty Moisture Shampoo | 250 ml | 7340074775217 | 12.99 | STD | no | 3 | partial (73) | info |
| b03-i02 | C6 | Being Max Moisture Shampoo | 354 ml | 4895248005902 | 6.79 | STD | no | 3 | partial (65) | source_gap |
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
| b03-i10 | C8 | schauma Shampoo For Men | 400 ml | 4015100890792 | 1.95 | STD (R8: non-numeric wait cleared) | no | 2 | partial (69) | r5_candidate, resolved |
| b01-i13 | C8 | Herbal Essences Blütensanft Rosenduft Shampoo | 350 ml | 8700216212748 | 3.95 | STD | no | 3 | partial (65) | source_gap |
| b01-i04 | - | Garnier Fructis Shampoo Coco Water, fettiger Ansatz & trockene Spitzen | 400 ml | 3600541970533 | 3.45 | STD | no | 3 | blocked | blocker, r5_candidate |
| b02-i11 | - | ISANA MED Shampoo Jeden Tag (Ultra Sensitiv) | 200 ml | 4305615629223 | 1.79 | TARGETED | yes (admin-02) | 2 | already_live (97) | info, medical, resolved |
| b04-i00 | - | ISANA MED Shampoo Totes Meer | 200 ml | 4305615629230 | 0.99 | TARGETED | yes (draft manifest-04) | 2 | already_live (97) | info, medical, resolved |
| b02-i12 | - | ISANA MED Shampoo pH 5,5 hautneutral | 400 ml | 4068134039743 | 1.69 | TARGETED (R8: non-numeric wait cleared) | yes (admin-02) | 3 | already_live (95) | info, medical, resolved |
| b03-i11 | - | Pantene Pro-V Grow Abundant Shampoo Anti-Haarverlust | 290 ml | 8006530060042 | 7.95 | STD | no | 2 | dropped_duplicate | resolved |

ID = `b<admin batch>-i<source_product_index>` inside `plans/scan-db-expansion/research/shampoo-v14/admin/batch-0N.json`. Multi-EAN rows: none among the 38.

### Flag detail (non-empty only)

Flag kinds: `info`, `medical`, `source_gap`, `blocker`, `resolved` (settled by a ruling or by the catalog), `ruling` (R-ruling consequence), `r5_candidate` (inferred).

- **b02-i09 ISANA Shampoo Anti-Schuppen Wasserminze & Grüner Tee**
  - [medical] Anti-dandruff (Piroctone Olamine), TPL-SHAMPOO-DANDRUFF, cosmetic framing only (D5 scalp-condition).
  - [info] Candidate image and INCI come from Rossmann.dk exact-EAN page; German PDP has less INCI visibility (notes-02).
  - [info] R5 counter-signal (inferred): Claims "dry hair and flaky scalp" (dry-scalp positioning), so not an oily-scalp candidate on its own claim.
  - [info] Availability (parallel-session notes, 2026-10-06, scratchpad only): Rossmann lists this product as "online nicht verfügbar". Re-check availability and the image/INCI source (Rossmann.dk) before research.
- **b03-i01 head&shoulders Anti-Schuppen Shampoo Apple Fresh**
  - [medical] Anti-dandruff, TPL-SHAMPOO-DANDRUFF, cosmetic framing only (D5 scalp-condition).
  - [info] Current GTIN 8001090896049 (500 ml); historical 8700216219907 deliberately not attached (notes-03).
  - [r5_candidate] Thick hair + oily scalp candidate (plausible, inferred): Anti-dandruff, daily-use "Apple Fresh" variant. No claims text on file; oily-scalp/light-weight fit depends on the formula (not yet read).
- **b02-i01 Syoss Men Intense Power Deep Caring Shampoo**
  - [medical] Growth-factor/caffeine 'energy' marketing: keep cosmetic, never hair-loss efficacy (notes-02).
  - [r5_candidate] Thick hair + oily scalp candidate (plausible, inferred): Men line "for normal hair"; on-file claim: cleansing/refreshing with caffeine-energy complex. Product name says "Deep Caring", so weight is unclear.
- **b04-i04 ISANA MEN Shampoo Energy Power**
  - [info] Name correction: frozen selection said 'Energy Effect', current exact-EAN pack/PDP says 'Energy Power' (admin snapshot already uses Energy Power).
  - [resolved] Non-numeric wait ("kurz einwirken lassen") cleared by R8 (2026-10-07): ordinary STD use, no deviation.
  - [medical] Caffeine/keratin 'energy' language: cosmetic only (low).
  - [info] R5 counter-signal (inferred): Claims "feines & energieloses Haar" (targets fine hair), so not a thick-hair candidate on its own claim.
- **b03-i00 Dr. Wolff Plantur DMG Clinical Shampoo**
  - [medical] 'Clinical'/root marketing is medically adjacent (hair-loss-adjacent); keep cosmetic, flag in notes.
  - [info] Genuine numeric deviation: '2 Minuten einwirken lassen'. Highest price in set (19.95 EUR). Image was 'recovered' product-only dm asset (notes-03).
  - [r5_candidate] Thick hair + oily scalp candidate (weak, inferred): Clinical root/caffeine positioning; 19.95 EUR; no claims text on file.
- **b03-i07 Bali Gents Coffein Activator Shampoo**
  - [medical] Caffeine/AnaGain/root language: cosmetic only, not a scalp-condition claim.
  - [info] Genuine numeric deviation: '2 Minuten einwirken lassen'.
  - [r5_candidate] Thick hair + oily scalp candidate (plausible, inferred): Men/caffeine "Activator" shampoo applied on the scalp; no claims text on file.
- **b03-i12 Plantur 21 Nutri-Coffein Shampoo #langehaare**
  - [medical] Caffeine/root language: cosmetic only.
  - [info] Genuine numeric deviation: 'mindestens 2 Minuten einwirken lassen'.
  - [r5_candidate] Thick hair + oily scalp candidate (weak, inferred): Caffeine shampoo for long hair (#langehaare); length-care positioning makes a light weight less likely.
- **b02-i03 Syoss Intense Repair Deep Caring Shampoo**
  - [info] Same EAN 4015100860382 is already a v1.4 calibration holdout (data/research/shampoo-inci/holdout-v3/products/syoss-intense-repair, captured 2026-09-01). Seen product for calibration/unseen-set purposes; formula-source file exists.
  - [ruling] R10: full fresh v1.6 research; v1.4 holdout result not carried forward (Nick: there was a reason it was put on hold). The old formula-source/result is only a comparison point.
- **b04-i01 Balea PROFESSIONAL Shampoo Plex Care**
  - [info] Official dm packshot re-requested at 985x4000 and visually verified (notes-04).
- **b04-i03 ISANA PROFESSIONAL Plex Shampoo**
  - [info] Same EAN 4305615975917 is a v1.4 calibration holdout (holdout-v2/isana-professional-plex, official source, captured 2026-08-26).
  - [info] DE shop showed price but product was online-unavailable (notes-04).
  - [ruling] R10: full fresh v1.6 research; v1.4 holdout result not carried forward (Nick: there was a reason it was put on hold). The old formula-source/result is only a comparison point.
- **b04-i02 ISANA PROFESSIONAL Shampoo Keratin & Repair**
  - [resolved] Non-numeric wait ("kurz einwirken lassen") cleared by R8 (2026-10-07): ordinary STD use, no deviation.
- **b03-i09 L’Oréal Paris Elvital Bond Repair Shampoo Anti-Haarschäden**
  - [info] Same EAN 3600524074654 is a v1.4 calibration holdout (holdout-v1/loreal-elvital-bond-repair-plus, captured 2026-08-26, official source, INCI on file there). Rossmann shows a shorter formula (non-blocking).
  - [ruling] R10: full fresh v1.6 research; v1.4 holdout result not carried forward (Nick: there was a reason it was put on hold). The old formula-source/result is only a comparison point.
  - [info] The only INCI on file is the v1.4 holdout formula-source file. Under R10 treat it as a comparison point only; the fresh formula capture is mandatory (as for every Track B product).
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
  - [resolved] Non-numeric wait ("kurz einwirken lassen") cleared by R8 (2026-10-07): ordinary STD use, no deviation.
  - [r5_candidate] Thick hair + oily scalp candidate (weak, inferred): Mild everyday men shampoo, 400 ml; no oily-scalp claim on file.
- **b01-i13 Herbal Essences Blütensanft Rosenduft Shampoo**
  - [source_gap] Exact-EAN formula conflict between dm DE and Shop Apotheke; dm DE formula selected; draft specs were 'guessed-conservative' (notes-01).
- **b01-i04 Garnier Fructis Shampoo Coco Water, fettiger Ansatz & trockene Spitzen**
  - [blocker] Material formula conflict for GTIN 3600541970533: dm exact-GTIN formula vs Garnier manufacturer formula disagree (wave-02/blocked-products.json: material_formula_conflict). R7: hunt for a deciding source (exact-pack manufacturer source, independent exact-GTIN retailer source, or a physical pack photo). Stays blocked; do not classify from either list.
  - [r5_candidate] Thick hair + oily scalp candidate (strong, inferred): Product name states "fettiger Ansatz & trockene Spitzen" (oily roots). Blocked by R7 until the formula conflict is resolved; no thickness or weight claim on file.
- **b02-i11 ISANA MED Shampoo Jeden Tag (Ultra Sensitiv)**
  - [medical] Sensitive-scalp positioning, TPL-SHAMPOO-TARGETED, cosmetic only (D5 scalp-condition).
  - [info] German PDP exposes no directions; protocol cites exact-EAN Rossmann Turkey page (non-DE fallback).
  - [info] Near-name sibling in v1.4 holdout-v1: 'ISANA MED Shampoo Jeden Tag' EAN 4305615629216 (urea formula). Different EAN and slug; do NOT merge (inferred: separate SKU).
  - [resolved] Created in prod 2026-10-07 by a parallel session (a1451c9b-fb55-406d-a81f-c513cc4ddcdf). Moved out of new creation; Track B does not research it again.
- **b04-i00 ISANA MED Shampoo Totes Meer**
  - [medical] Sensitive/itchy-scalp positioning, TPL-SHAMPOO-TARGETED, cosmetic only (D5 scalp-condition).
  - [info] German PDP exposes no directions; protocol cites Rossmann Hungary wet-hair/rinse fallback (non-DE).
  - [resolved] Created in prod 2026-10-07 by a parallel session (8a90f0fa-9cb1-458a-93f3-c2374e6d8f16). Moved out of new creation; Track B does not research it again.
- **b02-i12 ISANA MED Shampoo pH 5,5 hautneutral**
  - [medical] Sensitive-scalp / pH-skin-neutral, TPL-SHAMPOO-TARGETED (D5 scalp-condition).
  - [info] Directions come from a Ukrainian retailer (Hmarka); DE + first-party TR Rossmann corroborate EAN. No German directions on file.
  - [resolved] Created in prod 2026-10-07 by a parallel session (94829f16-b21d-4061-9dcc-cbd43dcb4274). Moved out of new creation; Track B does not research it again.
- **b03-i11 Pantene Pro-V Grow Abundant Shampoo Anti-Haarverlust**
  - [resolved] Confirmed duplicate of live "Pantene Grow Abundance" (7373656d-5fd7-46e8-81a3-2ef29e3c4c18); EAN 8006530060042 is already attached in prod. Dropped from new creation. No existing_product_updates no-op needed.

## Data-state caveats the research cells should know

- **No frozen source packets exist for any of the remaining products** except Coco Water's blocked packet (`pilot/waves/wave-02/fructis-coco-water/source-packet.json`). All stored INCI text, claims, directions and prices date from the 2026-09-02/03 administrative pass and must be re-captured and fingerprinted by the cells.
- **Draft manifests carry invalidated classification.** `shampoo-manifest-01..04.json` property projections, `category_specs`, thickness/concern eligibility were quarantined on 2026-09-03 and must not be used as priors. The classification-free `admin/batch-0N.json` is the right administrative source; for the batch-04 INCI texts I read the INCI string out of the draft manifest's `authority_facts` evidence (text is source INCI, not a classification), flagged in `inci_location`.
- **Images are candidates only.** Final cutouts go through the local image pipeline; Being Bye Bye, Being Nourish + Shine, Plantur DMG, and ISANA Anti-Schuppen (Rossmann.dk URL) are the ones to re-check first *(inferred from source domain/notes)*.
- **Prices are 2026-09-02 values**; the price-audit lane exists (#633), so refresh before apply. John Frieda Sheer Blonde has none.
- Several protocols rely on **non-DE exact-EAN fallbacks** for directions (ISANA Oil Repair; ISANA Anti-Schuppen from Rossmann.dk). Under the generic-rinse-out ruling STD stamps still stand.
- **The ISANA MED research used a candidate standard** (v1.6 pending_lock). If the standard changes at lock, those five live products need a re-run; Track B products researched later under the locked standard are not comparable one-to-one.
- `shampoo-wave-extension.json/.md` still carry the header `PROPOSAL - not yet reviewed by Nick` (stale; plan and 2026-09-03 approval supersede it).

## Blockers and decisions needing Nick

1. **Fructis Coco Water (b01-i04) is blocked (R7).** The 400 ml dm exact-GTIN formula and the Garnier manufacturer formula conflict materially. Resolution needs an exact-pack manufacturer source, an independent exact-GTIN retailer source, or a physical pack photo. Until then it is never classified from either list. It is also the strongest R5 candidate by name.
2. **Numeric-wait deviations (4), R9:** John Frieda Silber (1-3 min), Plantur DMG Clinical (2 min), Bali Gents (2 min), Plantur 21 (min. 2 min). Each ships as the standard shampoo template plus one extra application step stating the manufacturer's contact time, recorded as a documented deviation in the manifest. Nick approves each of the four in review.
3. **ISANA Anti-Schuppen Wasserminze & Grüner Tee availability.** The parallel session noted on 2026-10-06 that Rossmann lists it as "online nicht verfügbar". Confirm whether it is still worth researching, or whether it should come out of Track B.
4. **ISANA MED live products vs the candidate standard.** They are live under v1.6 candidate values. Nothing to decide now; re-check them when v1.6 locks.
5. **Medical-language products (7):** nothing to decide now; they need cosmetic-only copy and a flag in the notes per the playbook rule.

Resolved since 2026-10-05: Pantene Grow Abundant duplicate (dropped, no update needed); non-numeric wait ruling (R8, clears schauma For Men, ISANA Professional Keratin & Repair, ISANA MEN Energy Power; ISANA MED pH 5,5 live); the three holdout products (R10: researched fresh); Coco Water route (R7).

## Sources read

Original: `shampoo-v14/plan.md`, `focus-v15-engine-expansion-plan.md`, `admin/batch-01..04.json`, `admin/receipt.json`, `shampoo-manifest-01..04.json`, `shampoo-manifest-scannable-14.json`, `scannable-14-preflight-receipt.json`, `approved-manifest-sync-receipt.json`, `pilot/waves/wave-02/blocked-products.json` and Coco Water source packet, `shampoo-research-notes-01..04.md`, `shampoo-research-handoff.md`, `shampoo-wave-research-execution-plan.md`, `selection-batch1-draft.json`, `shampoo-wave-extension.json`, `inputs/prod-shampoo-specs-2026-10-05.tsv`, `src/lib/product-intake/expansion-manifest.ts`, `data/research/shampoo-inci/holdout-v1/v2/v3` formula sources, `data/scanner-catalog-coverage/2026-08-26/*` (Pantene), `data/product-catalog-snapshot.json`, `docs/scan-db-expansion-playbook.md`.
Added 2026-10-07: `plans/shampoo-v16/rulings.md`; root-checkout `ops/product-intake-research/2026-10-06/*/{payload,submission,validation}.json` and `2026-10-05/41e9950e-*/payload.json`; the parallel session's scratchpad `isana-med/{range,uebersicht}.md`; `plans/2026-10-05-price-audit-four-buckets-handover.md` (Hydra Volume).
