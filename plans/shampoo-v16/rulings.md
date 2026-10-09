# Shampoo v1.6 — Nick's rulings ledger

Program-level rulings D1–D9 are summarized in `plan.md`. This ledger records the phase-1 decisions, one per entry, in the order Nick ruled them.

## R1 — Calibration set (2026-10-07)

Approved: the 12 gold products and 6 unseen products in `gold-set/gold-set-proposal.md`, with two changes:
- Lavera Basis Sensitiv (`3d94c017-9edb-4ba0-accd-4772e262f012`) is added as gold slot G13 (normal × irritated coverage).
- Cantu Shampoo Locken Pflege (G08) is replaced by Hask Curl Care Shampoo (`c07a181b-3d55-4d47-ad68-9c1e324d4496`) if formula freeze cannot confirm that the live product and the frozen "Cleansing Cream Shampoo" sources are the same SKU.

## R2 — Fine hair and moderate weight: three-tier fit, conditioner pattern (2026-10-07)

Nick: "moderate weight would be ok, not great — light weight would be great for fine hair". Chosen option C.
- Add a shampoo weight value (light / moderate / heavy, from research `weightPotential`) to the live shampoo spec and evaluate it like `conditioner.weight`: ideal → green/`ideal`, one step off → amber/`supportive` (shown, ranked below ideal), clearly off → red/not recommended. Scanner and plan share this authority.
- The T1 `conditional` fit therefore becomes a visible amber/`supportive` match instead of being dropped.
- This partially reopens D1 (matcher untouched): one new spec column + shampoo authority rule + scanner presentation, shipped as its own small PR before the catalog apply.
- Known consequence: the dandruff role never ranks `supportive` candidates today, so dandruff picks stay ideal-only unless a later ruling changes that.
- Verified 2026-10-07: live `product_shampoo_specs` has no weight column (columns: product_id, thickness, shampoo_bucket, scalp_route, cleansing_intensity, category_key); weight exists only in research.

## R3 — Heavy shampoo for normal hair = amber (2026-10-07)

Heavy weight on normal hair is one step off → amber / `supportive`, shown and ranked below light and moderate products (e.g. OGX Renewing stays visible for normal hair).

Clarification of R2 (Nick, same day): no new *research* property — the eight research properties stay as they are (build-up is already captured by `weightPotential`). The live shampoo spec gets one `weight` value projected from `weightPotential`, so the three-tier fit works in scanner and plan.

## R4 — Thickness never hides a scalp-concern product (2026-10-07)

- Balanced scalp (no scalp concern): full three-tier thickness/weight rule — green ideal, amber shown but ranked lower, red not shown.
- Any scalp concern (dandruff, irritated, dry, oily): the scalp match must be exact; thickness/weight can only make a product amber and rank it lower, never hide it. The dandruff role therefore accepts thickness-only amber candidates (intensity and scalp route still exact).
- Oily scalp keeps its own formula check (weight not high), so heavy shampoos never reach oily-scalp users regardless of thickness.
- Replaces the earlier "allow amber in the dandruff role" / "scalp-products-only widening" options. Expected effect: coarse × dandruff ~0 → ~5.

## R5 — Monday Volume exception + no-gap principle (2026-10-07)

- Monday Haircare Volume Kraft & Fülle (`6dc65df2-2466-43e4-bdc2-3a05803f305c`) keeps its coarse × oily row as a documented one-off exception to the S-OILY weight check, for now. Nick: "that doesn't sound good".
- **No-gap principle (Nick):** no hair-thickness × scalp profile may be left without a recommendable shampoo. This tightens D9 from "no loss without a ruling" to a hard invariant: every apply preflight fails closed if any profile cell has zero recommendable products, and exceptions are only a bridge.
- Action: Track B prioritises finding a lighter oily-scalp shampoo that suits thick hair (start with the caffeine/men cell C2). When one passes review, Monday's exception is removed.
- Baseline 2026-10-05 (recommended products per cell, live): fine 7/5/3/5/4, normal 4/5/2/3/3, coarse 4/1/2/2/2 (balanced/oily/dry/irritated/dandruff). Thinnest cells: coarse × oily (1), then 2-product cells.

## R6 — Deep cleansers may be listed in both categories (2026-10-07)

Nick: a "Tiefenreinigung" shampoo is fine to offer as a strong-cleansing regular shampoo too; ideally it has one entry in the deep-cleanser category and one in the regular shampoo category.
- Deep-cleansing wording does NOT remove a product from regular shampoo. The v1.6 draft rule ("moves to deep cleansing, out of regular shampoo") is replaced: such a product keeps its regular-shampoo entry with `cleansing_intensity = clarifying` and additionally gets (or keeps) a deep-cleanser entry.
- Schema fact (prod 2026-10-07): a product record has exactly one `category_key`, and `product_shampoo_specs.category_key` is only `shampoo`. Dual listing therefore means two product records, as Balea already has (`0f71ff9d…` regular shampoo, `375ee7a0…` "Shampoo Tiefenreinigung" deep cleanser, which owns the barcode).
- Cases: Balea Tiefenreinigung keeps both records. Herbal Essences Tiefenreinigung & Glanz and Wahre Schätze Aktivkohle get a deep-cleanser record if research confirms deep-cleanser wording + formula.

## Note — catalog moved since the 2026-10-05 snapshot

Prod now has 74 products with shampoo specs (was 68). New: Balea Professional Hydra Volume (`1311e51c…`, recommended, 2026-10-05, price-audit swap) and five ISANA MED shampoos created 2026-10-07 by another session (`34697aec…`, `94829f16…`, `8a90f0fa…`, `a836ef4f…`, `a1451c9b…`, not recommended). Several of these overlap Track B cell C1. Re-snapshot and reconcile Track B before any Track B research starts.

## R7 — Fructis Coco Water: hunt for a deciding source (2026-10-07)

Keep it in Track B. Before classification, resolve the dm vs Garnier formula conflict for the same GTIN with an exact-pack manufacturer source, an independent exact-GTIN retailer source, or a physical pack photo. Until resolved it stays blocked (never classified from either conflicting list).

## R8 — "kurz einwirken lassen" = normal use (2026-10-07)

The 2026-09-04 ruling applies to the paused products too: non-numeric wording like "kurz einwirken lassen" is ordinary `TPL-SHAMPOO-STD` use, no deviation, nothing special shown. Applies to schauma For Men, ISANA MED pH 5,5, ISANA Professional Keratin & Repair, ISANA MEN Energy Power.

## R9 — Numeric wait times = STD + one documented extra step (2026-10-07)

John Frieda Silber (1–3 min), Plantur DMG Clinical (2 min), Bali Gents (2 min), Plantur 21 (min. 2 min): standard shampoo template plus one extra application step stating the manufacturer's contact time, recorded as a documented deviation in the manifest. Nick approves each of the four in review.

## R10 — Earlier holdout products are researched fresh (2026-10-07)

Syoss Intense Repair, Elvital Bond Repair, ISANA Professional Plex: full v1.6 research like every other Track B product; their v1.4 holdout results are NOT carried forward (Nick: there was a reason they were put on hold). Decide on them after the fresh research; the old results are only a comparison point.

## R11 — C2 humectant element; DERMAXPRO thick hair = amber (2026-10-09)

Trace glycols and aloe juice alone do not satisfy C2's humectant element. H&S DERMAXPRO Beruhigende Pflege → conditioning `moderate` → coarse `acceptable` (amber). Recommendation adopted.

## R12 — Dandruff + irritated scalp combination (2026-10-09, scope pending)

Nick: a dandruff shampoo with explicit soothing wording (e.g. Guhl Anti Schuppen: "Deine juckende Kopfhaut wird beruhigt…") is the right product for people with dandruff AND an irritated scalp, for whom regular anti-dandruff shampoos may be too harsh. Verified 2026-10-09: the live profile stores one `scalp_condition` (single value) and the shampoo secondary bucket only derives from scalp type (oily/dry/balanced) when the condition is dandruff — the combination dandruff + irritated cannot be expressed today. Ruled option A: record it in research only — the product's research record carries `dandruff` primary + `sensitive` secondary as a research fact; live rows stay dandruff-only, so irritated-only users never receive an anti-dandruff active. Follow-up (option C, separate project): let the profile express dandruff + irritated together and prefer such products. Handoff: memory `handover_scalp_combination.md`.

## R13 — Lock path (2026-10-09)

Apply R11/R12 + the round-2 wording clarifications, then run the unseen check on fresh Track B products; lock v1.6 if it holds. No third calibration round.

## R14 — Lock v1.6 (2026-10-10)

Nick approved locking after round 1 (97.4%), round 2 (97.1%) and the unseen check v2 (95.8%). Adjudication: Garnier Wahre Schätze Kokosmilch & Macadamia weight = `moderate` (genuine low/moderate boundary, resolved conservatively per P0/W3 → fine `acceptable`). Aussie Bouncy Curls stays `needs_research` until its formula source is re-verified.

## R15 — Anti-dandruff is the path; sensitive is a sub-attribute (2026-10-10)

Nick: anti-dandruff shampoos with their own sensitive-scalp claim (e.g. "Anti Schuppen … Sensitive") are dandruff products first — "it's more like a path: they need to be anti-dandruff, and then within anti-dandruff they can be for sensitive scalp or not." So any product whose primary target is `dandruff` projects dandruff rows only, whether its sensitive wording is bundled (R12) or a separate claim. Sensitive suitability is recorded in research (`researchCombinationTargets: ["sensitive"]` when the S-SENSITIVE formula gate passes) for the dandruff + irritated profile follow-up (`handover_scalp_combination.md`). An irritated-only user is never sent to an anti-dandruff active. N1 coverage of the irritated cells is checked before any apply.
