# Shampoo v1.6: Gold set and unseen set (proposal for Nick)

Status: proposal, 2026-10-05. Nothing classified yet, no production access, no commits. Source of the live specs: `plans/shampoo-v16/inputs/prod-shampoo-specs-2026-10-05.tsv`.

## What I picked and the logic

- 12 gold products from the products that already have research (C50 plus X14). Each one has exactly one job in the set.
- The five scalp-condition rows come first, because you review those first: 2 dandruff, 2 irritated, 1 dry.
- The hard cases are real ones: products where the two lanes disagreed before (cited per row), products whose live label contradicts the formula, and the products that exercise the two v1.5 changes (the new `moisture` focus, and `gentle` no longer being a focus).
- The unseen set (6) is built to cover what the gold set structurally cannot: true deep-cleansers, a hair-loss-adjacent claim, a dandruff product that also gets an oily-scalp route, and a rich coarse formula with a mild chassis. This is the same "choose the unseen set to close the gold set's blind spots" idea the leave-in round used.
- Excluded on purpose: all 10 holdout-v3 products, and the live Elvital Hydra Hyaluronic (see risk 1).

## Gold set (12)

Order = review order. Rows 1 to 5 are the scalp-condition rows.

| Slot | Role | Product | Cohort | Live today (thickness:scalp/intensity; recommended?) | Why this product |
| --- | --- | --- | --- | --- | --- |
| G01 | Dandruff, clear case | Guhl Anti Schuppen | C50 | normal:dandruff/regular; yes | Plain anti-dandruff shampoo with a single official formula source. It is the calibration anchor: if the lanes disagree here, the standard has a real gap. Same Guhl base as G11, so the pair tests how much anti-dandruff active is needed before a product counts as dandruff support. |
| G02 | Dandruff with soothing / "gentle" language | Head & Shoulders DERMAXPRO Shampoo Beruhigende Pflege | C50 | fine:dandruff/gentle and coarse:dandruff/gentle; yes | Sold as soothing, but the formula is a strong anti-dandruff cleanser. Today's live label says "gentle", which is the word v1.5 retires as a focus. Covers both fine and coarse dandruff rows. |
| G03 | Irritated scalp, mildest formula | Sebamed Every-Day Shampoo | C50 | fine:irritated/gentle; yes | The mildest formula in the catalog (sulfate-light, no heavy conditioning). Anchors the "irritated" side with a product that is clearly gentle. |
| G04 | Irritated scalp, hard case: label vs formula, hair-loss claim | Pantene Grow Abundance | C50 | fine:irritated/regular; yes | Marketed against hair loss, contains an anti-dandruff active near the top of the list, strong cleansing, and no explicit sensitive-scalp claim. The live "irritated" label looks wrong, and it is currently recommended. This is the row where a classification error would send a product toward users it should not go to, and it sits next to the cosmetic vs medical-adjacent boundary. |
| G05 | Dry scalp route; "gentle" language case; earlier hard case | Wahre Schätze Sanfte Hafermilch | C50 | normal:dry/gentle; yes | v1.4 gave it `gentle` as its focus, which v1.5 removes, so the standard must say what it becomes. Its weight was re-checked in the v3 weight correction (blind ID W004). The earlier shadow comparison projected "irritated" where the live label says "dry". |
| G06 | Oily scalp / clarifying | Salthouse Anti Fett | C50 | fine:oily/clarifying; yes | Labeled clarifying, but the formula is a moderate cleanser. It is also the control case from the v2 weight audit: a single conditioning polymer does not make a product "moderate weight". That is exactly the kind of rule v1.6 must not bring back by accident. Single official source. |
| G07 | 2-in-1 with conditioning | ISANA Shampoo & Spülung 2 in 1 Volumen Malve & Acai | X14 | fine:balanced/regular; no | Rich 2-in-1 architecture with a volume claim. Earlier lanes split on conditioning level (moderate vs high) and on a repair secondary focus (pilot review, 2026-09-03). |
| G08 | Suspicious live label | Cantu Shampoo Locken Pflege | C50 | coarse:balanced/gentle; yes | Live label says gentle for a curl shampoo whose formula is a strong cleanser (olefin sulfonate) that the research reads as periodic-use. Also an earlier lane split on weight (moderate vs high, v2 rerun). Identity needs checking first, see risk 6. |
| G09 | Curl / coarse rich formula | Syoss Intense Curls | C50 | coarse:balanced/gentle; yes | Clean German official source. Silicones, keratin and polymer conditioning on a standard sulfate base: the typical "rich curl" shape. Live label says gentle again, so G08 vs G09 shows whether "gentle" tracks the formula or the marketing. |
| G10 | Moisture focus (new in v1.5) | Garnier Fructis Locken Methode Feuchtigkeits-Shampoo | X14 | coarse:balanced/regular and normal:balanced/regular; no | The v1.5 pilot call: dominantly moisture claim, humectant plus conditioning formula, but a strong cleanser underneath. Tests moisture vs repair vs general without a mild chassis to make it easy. |
| G11 | Earlier hard case: formula conflict and hidden anti-dandruff active | Guhl Hyaluron+ | C50 | fine:balanced/gentle; yes | Re-checked in the v3 weight correction (W006). Its official German formula and the Rossmann / dm-AT formula differ under the same barcode, and the official one contains an anti-dandruff active deep in the list although the product is an everyday "Hyaluron" shampoo that is currently recommended. Tests both formula pinning and the dandruff-support threshold (pairs with G01). |
| G12 | Fine-hair volume, light formula | Balea Professional Ultimate Volume | C50 | fine:balanced/regular; yes | Light, low-conditioning volume shampoo with a single official formula source. The fine-hair "light" anchor, so we can see that the standard does not over-credit conditioning. |

Currently recommended: 10 of 12 (G07 and G10 are X14 and not yet recommended).

Bench (use if a slot fails its identity check before the freeze):

- G08 Cantu: Hask Curl Care (same pattern: gentle label on a strong cleanser, US formula, official US source).
- G11 Guhl Hyaluron+: Head & Shoulders Anti Schuppen Sensitive (official and retailer formulas differ), or OGX Rosemary Mint (v3 weight re-check W027, sulfate-free clarifying by label).
- G04 Pantene Grow: Head & Shoulders DERMAXPRO Haarshampoo Sensitive Pflege (coarse:irritated/gentle, same pattern, but sources disagree).
- G09 Syoss Intense Curls: Langhaarmädchen Beautiful Curls (a truly mild isethionate chassis, to contrast with G08).
- G07: Being Big Hair (X14; earlier lane split on cleansing strength, moderate vs strong).

## Unseen set (6)

All 4 never-researched legacy products, plus two researched products that stay out of the gold set.

| Slot | Product | Cohort | Live today (recommended?) | Why it is in the unseen set |
| --- | --- | --- | --- | --- |
| U1 | Balea Tiefenreinigung | L4 | fine:oily/clarifying; yes | Deep-cleansing shampoo with no research yet. Identity problem first, see risk 2. |
| U2 | Herbal Essences Tiefenreinigung & Glanz Shampoo Limettenduft | L4 | all three thicknesses balanced/clarifying; no | Second deep-cleanser shape, and the only one live for all thicknesses. User-submitted, never researched. |
| U3 | Plantur 39 Phyto-Coffein-Shampoo für feines, brüchiges Haar | L4 | fine:balanced/regular; no | Caffeine / hair-thinning positioning with no research yet. Tests the cosmetic vs medically-adjacent boundary on a product the gold set cannot show (G04 is the nearest). |
| U4 | Wahre Schätze Aktivkohle | L4 | normal:oily/clarifying; yes | Third clarifying shape (charcoal, "fettige Kopfhaut"), currently recommended, no research yet. |
| U5 | head&shoulders Anti-Schuppen Shampoo Classic Clean | X14 | dandruff and oily rows at all three thicknesses (6 rows); no | Dandruff product that also earns an oily-scalp route. Shows whether the standard produces the same multiple-row output blind. Note: its formula and v1.4 / v1.5 results already exist from the pilot, which makes it a free regression check. |
| U6 | OGX Keratin Oil Shampoo | C50 | coarse:dry/gentle; yes | Rich coarse formula on a sulfate-free taurate chassis, covering the coarse dry cell that the gold set misses. |

Why these six: the gold set has one clarifying product (and it is a moderate one), so all three true deep-cleanser shapes land in the unseen set. If they all pass blind, that is strong evidence. If they fail, we learn it before lock, not after. Option for Nick: after research, move one of U1 / U4 into the gold set if the deep-cleansing rules look underexercised.

## Coverage: gold and unseen vs every thickness x scalp-route cell in prod

"Rows" counts spec rows (68 products produce 89 rows). "Rec." is how many of those rows belong to a currently recommended product.

| Thickness | Scalp route | Rows in prod | Rec. | Gold covers | Unseen covers |
| --- | --- | --- | --- | --- | --- |
| fine | balanced | 16 | 7 | G07, G11, G12 | U2, U3 |
| fine | oily | 6 | 5 | G06 | U1, U5 |
| fine | dry | 3 | 3 | none | none |
| fine | irritated | 6 | 5 | G03, G04 | none |
| fine | dandruff | 5 | 4 | G02 | U5 |
| normal | balanced | 13 | 4 | G10 | U2 |
| normal | oily | 6 | 5 | none | U4, U5 |
| normal | dry | 3 | 2 | G05 | none |
| normal | irritated | 4 | 3 | none | none |
| normal | dandruff | 4 | 3 | G01 | U5 |
| coarse | balanced | 14 | 4 | G08, G09, G10 | U2 |
| coarse | oily | 2 | 1 | none | U5 |
| coarse | dry | 2 | 2 | none | U6 |
| coarse | irritated | 2 | 2 | none | none |
| coarse | dandruff | 3 | 2 | G02 | U5 |

Cleansing intensity: gentle is covered by G02, G03, G05, G08, G09, G11; regular by G01, G04, G07, G10, G12; clarifying by G06 (and U1, U2, U4).

### Holes I could not fill from the existing catalog

1. **Gold has no row for fine x dry, normal x oily, normal x irritated, coarse x oily, coarse x dry, coarse x irritated.** With 12 products this is the trade-off: every scalp route has at least one gold product, but not every thickness x route pair. The gaps are all in small cells (2 to 6 rows). The unseen set covers coarse x dry, coarse x oily and normal x oily.
2. **Still uncovered by gold or unseen: fine x dry, normal x irritated, coarse x irritated.** The products that live there (Balea 2 in 1 Urea 5%, Neqi Moisture Mystery, Sebamed Urea 5%; Lavera Basis Sensitiv, Guhl Kopfhaut Sensitive, Balea Kopfhaut Sensitive; the two coarse irritated products Head & Shoulders DERMAXPRO Sensitive Pflege and Sante Sensitive Care) are the same archetypes as G03/G04/G05, so the rules they exercise are covered, only the thickness projection is not. Cheapest fix if you want it: add Lavera Basis Sensitiv (a natural, coco-sulfate sensitive shampoo) as a 13th gold product.
3. **No true deep-cleanser in the gold set**, by design (see unseen set). The catalog's only researched clarifying products are moderate-strength ones (Salthouse Anti Fett, OGX Rosemary Mint).
4. **Coarse x oily has only one recommended product** (Monday Haircare Volume Kraft & Fülle). Not a gold-set matter, but any v1.6 change touching that cell is a D9 risk.
5. **No sulfate-free "natural" chassis is in gold** except G03. Lavera and Sante (coco-sulfate, glucoside) would add it; they are bench items, not gaps in the rule coverage.

## Identity risks visible in the inputs

Fix or confirm items 1 to 6 before the formulas are frozen for the lanes.

1. **Elvital Hydra Hyaluronic (live product cc9318d2, X14, 1000 ml, barcode 3600524099299) has the same ingredient list as a holdout-v3 product (300 ml, barcode 3600524137465).** Same formula, different pack. I excluded it from both sets; it also means the live X14 row cannot count as unseen anywhere.
2. **Balea Tiefenreinigung (U1) is a legacy duplicate.** The approved owner of the real barcode (4070765001020) is a different row, in the deep-cleansing category (375ee7a0). The shampoo row has no barcode by an earlier ruling, and its shop link is an older dm URL for a different pack code. Before research: decide whether this row is the same product (then it probably should not be researched or recommended twice) or an older pack or formula. Herbal Essences Tiefenreinigung (U2) is also matched in the scanner ledger as a deep-cleansing candidate by its barcode, so check which category should own it.
3. **OGX Renewing Argan:** the research cohort lists a blocked legacy duplicate (a stale OGX Renewing row f41badc9, replaced by the live row 2ecd3c9d). The blocked row has no specs in prod, so it does not appear in the 68, but it stays blocked until Catalog Authority confirms. Not in either set.
4. **Head & Shoulders DERMAXPRO Beruhigende Pflege (G02): the formula source has no barcode and no pack size.** One official German page, no cross-check. Needs one confirmed barcode before freeze.
5. **Guhl Hyaluron+ (G11): two different formulas under one barcode (4072600720219).** Guhl's German page lists hydrogenated vegetable oil; Rossmann and dm-AT list glycol distearate and glycine instead. The research pinned the Guhl page. Confirm that pin, because it decides which formula the lanes see. Possible reformulation.
6. **Cantu (G08): the name does not match the sources.** The product here is "Locken Pflege", barcode 810006945461 (a US code), but all three formula sources are for "Cleansing Cream Shampoo" (Cantu UK, dm, Rossmann "sulfate-free"). Confirm it is the same product before using it as a gold row, or swap to the bench pick.
7. **Not in the sets but visible in the inputs:**
   - L'Oréal "Ultimate Shampoo" (88c230c5, C50, live name never renamed): the admin batch says its barcode is 3600524128005, the research formula file says 3600524293543. It is researched as "Elvital Glycolic Gloss", and four source records disagree on the list. Resolve the barcode and rename before it is classified.
   - Garnier Wahre Schätze Honig Schätze (X14): three barcodes, one still held back for pack binding.
   - Head & Shoulders Anti Schuppen Sensitive (C50): the official and retailer lists differ (dimethicone, niacinamide), so possible variant mix-up.
   - Sante Sensitive Care: no barcode in the formula source.
   - Hair Biology Revitalize & Soothe and OGX Rosemary Mint: formula identity was low-rated in the first research round; both were fixed by the v3 source overrides, but it stays retailer-only.
   - The four L4 products have no research folder in the repo at all, so U1 to U4 need a full identity and formula packet from scratch. U2, U3 and U4 appear user-submitted or legacy, and U4's brand string "Wahre Schätze" differs from the X14 sibling "Garnier Wahre Schätze".
   - Hask products use US barcodes and US-market formulas, relevant only if you pick them from the bench.
8. **Already-seen products.** G07 and G10 and U5 are X14 products already blind-classified in the v1.4 pilot with v1.5 overlays. The new lanes classify fresh, so it is clean, but the earlier adjudications give a free regression check.

## Do not give the lanes

Live specs, earlier lane results or the adjudications. The lanes get the frozen formula packet and the standard only. The "live today" column above is for your review and for the later projection check, not for the blind pass.
