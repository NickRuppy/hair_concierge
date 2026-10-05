# Bucket 3 — current formula investigation

Read-only evidence; no catalog, identifier, queue, worker or production changes. Full raw INCI, normalized ordered diffs, live stored fields, provisional profiles, sources and decisions are in `bucket3-formulas.json`. Local formula packets and adapter runs are under `bucket3/`.

| Product | Old → current GTIN/pack | Fresh dm result, 2026-10-03 15:26 UTC | Recommended handling |
|---|---|---|---|
| Langhaarmädchen Beautiful Curls Shampoo | 4067796150735 → 4070765004649; 300 ml | €4.95, purchasable | New formula evidence version; narrow aloe declaration change does not prove either unchanged composition or materially different performance. No automatic alias. Continuity update versus separate version needs reviewed evidence. |
| Alverde Conditioner Glanz | 4066447592085 → 4066447919202; 200 ml | €1.25, **not purchasable** | Formula-property review plus separate availability hold. No price-only update. Old Romanian source now resolves to current GTIN; retain earlier captured old list with that provenance limit. |
| Schaebens Argan-Öl Haarmaske | 4003573025018/20 ml → 4003573125015/2×7 ml | €0.95, purchasable | Separate current catalog candidate; no old-barcode alias or overwrite. Old row lifecycle is a separate decision. |

Current offers: [Beautiful Curls](https://www.dm.de/p/d/1678985/langhaarmaedchen-shampoo-beautiful-curls), [Alverde Glanz](https://www.dm.de/p/d/1714048/alverde-naturkosmetik-conditioner-glanz), [Schaebens 14 ml](https://www.dm.de/p/d/3132757/schaebens-haarmaske-arganoel-2x7-ml). Stock comes from fresh official dm MCP name searches matched by exact GTIN/DAN, not indexed page text. Exact-GTIN search parsing failed; fresh detail and name-search calls succeeded. None of the three current GTINs is owned by a live catalog identifier row at this check.

The old Shampoo list declares Aloe Barbadensis Leaf Juice Powder at #5; current declares Leaf Juice at #2. The remaining list from Arginine onward matches. Alverde adds Pelargonium Graveolens Flower Oil and moves hydrolyzed wheat protein #13→#7. Neither positional change proves a concentration change. Schaebens changes 13 removed/17 added ingredient tokens, the conditioning base, GTIN and package; raw punctuation defects are preserved beside normalized comparison tokens.

Provisional Shampoo adapter output keeps `normal/balanced/gentle` and proposes `suitable_thicknesses=[normal,coarse]` versus stored `[coarse]`; fine remains conditional. Provisional Conditioner output proposes `weight=medium`, `repair_level=medium`, `balance_direction=balanced`, flags `[oils,proteins,humectants]`, and compatibility `stretches_bounces` for fine/normal/coarse. Stored values are light/low/balanced/no flags and fine only. These are review candidates, not approved changes.

The Mask ordinary-intake candidate supports presence flags and smoothing/slip/shine potential; concentration, balance and thickness eligibility remain unresolved. Conditioner engine rules were not transferred to Mask. New directions explicitly say damp lengths/ends, five minutes, rinse thoroughly.

Both local adapters ran successfully (`property_lane_ready`, `projection_ready`), but this comparison investigation was exposed to identity, claims and old catalog values before a blind receipt. It is therefore **not a certified blind-first research run**. Anonymous current-INCI packets are ready for a fresh assessor. All three remain `catalog_intake_ready=false` and `global_recommendation_ready=false` for the proposed current versions; their historical live rows remain active/recommended unchanged.

Decisions for Nick: approve the continuity/version treatment for Shampoo and Alverde after formula confirmation; decide whether to prepare the separate current Schaebens candidate; independently decide old unavailable-product lifecycle; then review exact proposed properties, current image, protocol and commercial payload before any guarded handoff.
