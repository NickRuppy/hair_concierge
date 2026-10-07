# Track B reconciliation, 2026-10-07

Reconciles the 2026-10-05 Track B inventory (38 paused products, 8 cells) with the catalog changes made since and with Nick's rulings R5 to R10 in `../rulings.md`. Result is in `inventory.md` and `inventory.json` (schema v2) in this directory. Read-only inputs only: repo files, the root checkout's gitignored `ops/product-intake-research/` packages, and one parallel session's scratchpad. No web, no prod, no database.

## Result in one table

| | Before (2026-10-05) | After (2026-10-07) |
|---|---:|---:|
| Paused | 38 | 34 |
| Already live (moved out of new creation) | 0 | 3 |
| Confirmed duplicate (dropped) | 1 | 1 |
| Blocked (Coco Water, R7) | 1 | 1 |
| Researchable, in cells | 36 | 33 |
| Ready / partial | 18 / 18 | 15 / 18 |
| Cells | 8 | 8 (C1 rebuilt, order changed) |
| Deviations numeric / non-numeric | 4 / 4 | 4 / 0 |
| Medical-language flagged | 10 | 7 |

## 1. Matches against the six new live products

Matched by brand + name + size, and by EAN where the local packages carry one. Prod was not queried; the ids come from the task brief and the packages' own records.

| Live product (prod id) | Result |
|---|---|
| ISANA MED Shampoo Jeden Tag (Ultra Sensitiv), 200 ml (`a1451c9b-fb55-406d-a81f-c513cc4ddcdf`, EAN 4305615629223) | **already_live** = Track B b02-i11 (identical EAN, name, size) |
| ISANA MED Shampoo Totes Meer, 200 ml (`8a90f0fa-9cb1-458a-93f3-c2374e6d8f16`, EAN 4305615629230) | **already_live** = b04-i00 |
| ISANA MED Shampoo pH 5,5 hautneutral, 400 ml (`94829f16-b21d-4061-9dcc-cbd43dcb4274`, EAN 4068134039743) | **already_live** = b02-i12 |
| ISANA MED Shampoo Anti Schuppen, 200 ml (`a836ef4f-f406-4557-b908-0155919e2c4f`, EAN 4305615629209) | No match. Not the Track B "ISANA Shampoo Anti-Schuppen Wasserminze & Grüner Tee" (EAN 4305615566146). |
| ISANA MED Ultra Sensitiv+ Anti-Schuppen Shampoo, 200 ml (`34697aec-761c-45e7-9a92-986f786dd022`, EAN 4068134169129) | No match. |
| Balea Professional Shampoo Hydra Volume, 250 ml (`1311e51c-7941-4d2c-b9b4-7a450ee37f15`, EAN 4066447990126) | No match. Track B's Balea item is Plex Care (a different SKU). It is the price-audit replacement for Balea Ultimate Volume. |

The three matches carry `disposition: already_live` and an `already_live` block in the JSON (prod id, live name, EAN, package path, spec summary). They no longer belong to any cell. The three non-matches are listed under `new_live_not_in_track_b`.

## 2. Where the ISANA MED research lives, and the standard it used

- **Durable but not in git:** `/Users/nick/AI_work/hair_conscierge/ops/product-intake-research/2026-10-06/<submission-id>/` in the root checkout (`/ops/*` is gitignored). Submission ids: Jeden Tag `b0462a7d-938b-4d59-83c4-a8af7ce26d68`, Totes Meer `d2f27a6f-6f1f-4c70-bfd9-83eaffd1bcca`, Anti Schuppen `337d26bc-0cf8-4471-a536-434f75bdae7f`, pH 5,5 `8f87957a-f3dd-4ef1-84fd-29efed572049`, Ultra Sensitiv+ Anti-Schuppen `c76157b5-2df1-4dbd-9a09-e16d39a644c3`. Each `payload.json` holds the final product values, sources, identifiers, spec rows, field rationales and Nick's review stamp; `research.md` in the packages is an empty template. Hydra Volume: `.../2026-10-05/41e9950e-0da7-459d-b190-e56918242d20/`.
- **Not durable:** the full per-product INCI and property reports are only in the session scratchpad `/private/tmp/claude-501/-Users-nick-AI-work-hair-conscierge/400d6eb2-12b2-48ab-8924-d69f4d5e664d/scratchpad/isana-med/` (`isana-med-*.md/json`, `range.md`, `uebersicht.md`, `rework.sql`). Anything Track B wants to keep needs to be copied out.
- **Standard:** Shampoo-Standard **v1.6 candidate**. The payload's `draft.engine` says shampoo-standard, state `pending_lock`, target v1.6. Not locked, not calibrated, one researcher per product, no blind double run (the session's own overview says so). Nick signed off the values 2026-10-07. Outcome: fine + normal only (no coarse rows), `cleansing_intensity` regular, weight low. Totes Meer is `irritationen/irritated` by Nick's ruling (the candidate default was `normal`). Anti Schuppen has a dandruff row and an oily row; Ultra Sensitiv+ has dandruff only.
- Protocols are the normative TARGETED / DANDRUFF templates (the packs carry no directions). Those templates include a "2 bis 3 Minuten einwirken lassen" step. That is template text, not an R8 or R9 deviation.

## 3. Rulings applied

- **R5 (no-gap, light oily-scalp shampoo for thick hair):** added a `thick_oily_scalp_candidate` field and a candidates table in `inventory.md`. Seven products, all *inferred from names and on-file claims only*: strong = Fructis Coco Water ("fettiger Ansatz" in the name; blocked); plausible = head&shoulders Apple Fresh, Syoss Men Intense Power, Bali Gents Coffein Activator; weak = Plantur 21, Plantur DMG Clinical, schauma For Men. Counter-signals on file: ISANA MEN Energy Power claims fine hair; ISANA Wasserminze claims dry scalp. None has formula, weight or thickness data. The six new live products add no coarse rows, so coarse x oily is unchanged (inferred from the local packages).
- **R7 (Coco Water):** stays in Track B as `blocked`. Resolution routes recorded: exact-pack manufacturer source, independent exact-GTIN retailer source, or a physical pack photo. Never classified from either conflicting list. Held outside the cells; it would join C1 once resolved.
- **R8 ("kurz einwirken lassen" = standard use):** cleared the recorded non-numeric deviations on schauma For Men, ISANA Professional Keratin & Repair, ISANA MEN Energy Power (`protocol_deviation_kind: cleared_R8`, original kept in `protocol_deviation_original`). The ISANA MED pH 5,5 deviation is moot because the product is live; its live protocol records no deviation.
- **R9 (numeric waits):** John Frieda Silber (1-3 min), Plantur DMG Clinical (2 min), Bali Gents (2 min), Plantur 21 (min. 2 min) are marked `documented_extra_step_pending_nick_approval`: standard template plus one documented extra step, Nick approves each in review.
- **R10 (earlier holdouts):** Syoss Intense Repair, Elvital Bond Repair, ISANA Professional Plex get a ruling flag: full fresh v1.6 research, v1.4 holdout results not carried forward, old results only a comparison point. Bond Repair's only INCI on file is the holdout formula-source file, now labelled "comparison point only". The counts keep it as INCI on file; the fresh capture is mandatory for every product anyway.
- **Pantene Pro-V Grow Abundant (b03-i11):** `dropped_duplicate`. EAN 8006530060042 is already attached in prod to `7373656d-5fd7-46e8-81a3-2ef29e3c4c18`, so no new product and no `existing_product_updates` no-op.

## 4. Cell rebuild

- **C1 (scalp-condition) lost its three ISANA MED members to the live catalog**, leaving ISANA Anti-Schuppen Wasserminze & Grüner Tee and head&shoulders Apple Fresh. No other product shares the dandruff archetype, so C1 stays at two rather than being padded with unlike products. Coco Water would join C1 once unblocked.
- All other cells keep their membership: C2 (5), C3 (5), C5 (4), C6 (5), C4 (4), C7 (4), C8 (4). Total 2 + 5 + 5 + 4 + 5 + 4 + 4 + 4 = 33.
- **Review order (D5):** C1, C2, C3, C5, C6, C4, C7, C8 (scalp cell first; C2 second because it is the R5 cell; the rest by mean readiness).
- **Research start order (R5):** C2, C1, C3, C5, C6, C4, C7, C8. R5 says to start the oily-scalp hunt with the caffeine/men cell; D5 says to list scalp rows first for Nick. Both are kept as separate fields instead of picking one.
- Mean readiness scores were recomputed (C1 is now 85.0); the scoring heuristic itself is unchanged.

## 5. Conflicts, tensions and open points

1. **D5 vs R5 ordering.** D5 wants the scalp cell first in Nick's review; R5 wants C2 researched first. Resolved as two orders (above); Nick may prefer one.
2. **ISANA Wasserminze may be unavailable.** The parallel session's range check (2026-10-06) records Rossmann showing it "online nicht verfügbar". Its image and INCI already came from Rossmann.dk. Worth confirming before spending research on it.
3. **Candidate standard.** The five ISANA MED products are live on v1.6 candidate values, not the locked standard. If the lock changes anything, they need a re-run; Track B products researched later may not be comparable one-to-one.
4. **Totes Meer** was set to `irritated` by Nick against the candidate default (`normal`). The packages record the deviation.
5. **Template wait step.** The live TARGETED / DANDRUFF templates carry "2-3 Minuten einwirken lassen" even though the packs state no directions. Not a conflict with R8 or R9 (those cover pack wording on STD products), but the same product wording would mean different things on STD versus TARGETED; flag if Track B researches a TARGETED product.
6. **Prod not re-queried.** Product ids and "live" status come from the task brief and local packages. The two open ancillary updates (Glycolic Gloss rename `88c230c5-1020-4648-a10e-c2a1e8c87e0e`, Gliss Scalp Balance EAN add `05753f93-907f-427d-a4dc-0a690ff3a76d`) were not re-verified.
7. **No conflict with R1 to R4 or R6** was found in this input; R6 (deep cleansers in both categories) does not touch any remaining Track B product.
