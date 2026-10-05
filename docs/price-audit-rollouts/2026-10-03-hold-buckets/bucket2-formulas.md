# Bucket2 declaration-change review — 2026-10-03

Read-only research completed for all three products. Full declarations, exact ordered diffs, source versions, timestamps, live catalog rows and protocol payloads: [bucket2-formulas.json](bucket2-formulas.json). No repository or production writes. Source fetches and adapter replay remain under `/tmp/chaarlie-buckets`.

## Proposed rule

Separate product association, declaration/version evidence, category facts, application instructions and commerce availability. Neither changed ingredient order nor changed fragrance declarations establish unchanged chemistry, changed concentration or a reformulation. Preserve older source versions and the unknown old canonical catalog formula. Independently research the current exact German product. A reviewed same-product commerce association can be reasonable when identity has a strong bridge, current category/protocol facts remain supported and the actual package is purchasable. It must not silently merge recognition identifiers, inherit old research values, or promote a product.

## Findings

| Product | Current exact DE candidate | Current category assessment | Commerce recommendation |
|---|---|---|---|
| Balea Professional Oil Repair Intensiv Spülung | GTIN4070765001402; dm DAN1703916;200ml;€1.25; available | Fresh v1.6 proposal: weight medium, repair_level medium, balance_direction balanced; ingredient_flags oils/proteins/humectants; fine/normal/coarse with stretches_bounces. Live is rich/high/protein/coarse-only. | Hold routine commerce-only refresh until the material research delta and product association are reviewed. |
| got2b Schutzengel | GTIN4015100894141; dm DAN1267310;200ml;€4.95; available | Retain format=spray, provides_heat_protection=true, suitable_thicknesses=[]. Base damp-hair use remains supported. Brand source adds optional reapplication advice; proposed reapplication=optional instead of not_stated. | Eligible for reviewed same-product commerce association under proposed rule; chemical continuity remains unknown. |
| Balea Hitzeschutzspray2-Phasen | GTIN4070765016758; dm DAN1460813;200ml;€1.95 | Retain format=spray, provides_heat_protection=true, suitable_thicknesses=[]; either-state use, required reapplication, shaking and15cm distance remain source-backed. | Hold available-commerce refresh: current dm PDP says temporarily unavailable; fresh MCP search says purchasable=true. |

Live product/spec/protocol readback:2026-10-03T15:19:40Z. All current candidate GTINs are unowned in the catalog. All three old GTINs returned Product not found from the fresh dm MCP query at15:19:23Z. All three products are active; Conditioner and got2b are already recommended, Balea heat is not. These are observed states, not renewed approval.

## Declaration comparisons

**Conditioner:** the17-ingredient older dm PL/IT indexed lists for4066447365443 differ from current18-ingredient DE list by Hydrolyzed Keratin rank14→7 and the added Tetramethyl Acetyloctahydronaphthalenes declaration. No ingredients disappear in that comparison. A same-old-GTIN Croatian list has only15 ingredients and lacks two of the oils. The historical German catalog formula was not retained; these regional indexed versions cannot be substituted for it. Current DE source is sufficiently resolved for fresh classification.

**got2b:** there are at least two old-GTIN first-party declarations. The older22-ingredient index swaps Parfum/Cetrimonium order and lacks three current fragrance declarations while including Citronellol/Benzyl Benzoate. A more recent26-ingredient old-GTIN cache already has the current first17 ingredients and differs mainly by removal of Citronellol, Terpineol, Benzyl Benzoate plus Linalyl Acetate/Benzyl Salicylate order. The JSON preserves both comparisons instead of selecting a convenient formula history.

**Balea heat:** the older25-ingredient DE index adds Citral in the current22-ingredient declaration and removes Linalyl Acetate, Tetramethyl Acetyloctahydronaphthalenes, Citrus Aurantium Peel Oil and Pinene. First15 ingredients and relative order of retained ingredients are unchanged. Regional old-GTIN dm pages already show the shorter list, so chemistry and chronology remain unresolved. The old220°C versus current200°C claims stay source metadata; the binary heat field remains supported.

## Verification and readiness

The actual Conditioner Production Adapter returned `projection_ready`. Formula sequence/hashes, full envelope schema, and policy/runbook SHA256 pins all passed. The proposed mapped weight, care direction and thickness fit remain visibly uncertain. No chemical concentrations, measured efficacy, numerical contact time or heat engine were invented. Manufacturer positioning and catalog values were excluded from classification reasoning; this was not an independently blinded research run.

All three are ready for this bounded research review. All three remain `catalog_intake_ready=false` and `global_recommendation_ready=false` for a renewed current-version handoff: exact association approval, current-pack image comparison, source/protocol review and normalized preflight/promotion checks were not completed. Conditioner additionally needs classification approval; Balea heat needs availability resolution. Existing recommendation flags do not satisfy these new checks.

Nick's consequential decisions are the proposed same-product association policy and the changed Conditioner profile. Availability is a verification issue, not a preference question. Optional got2b reapplication follows the existing heat contract and must not create a mandatory second application. Any identifier addition, product write or promotion remains separately gated.

## Primary sources

- [Current Conditioner DE identity, INCI, directions and offer](https://www.dm.de/p/d/1703916/balea-professional-conditioner-oil-repair-intensiv)
- [Current got2b DE offer](https://www.dm.de/p/d/1267310/got2b-hitzeschutzspray-schutzengel) and [official brand INCI/directions](https://www.got2b.de/haarstyling/produkt/settings/schutzengel-hitzeschutz-spray.html)
- [Current Balea heat DE identity, INCI, directions and availability](https://www.dm.de/p/d/1460813/balea-hitzeschutzspray)
- [Older got2b URL, cached old-GTIN declaration](https://www.dm.de/hitzeschutzspray-schutzengel-p4015100800128.html)
- [Conditioner PL source: indexed old version differs from current opened page](https://www.dm.pl/p/d/1703916/balea-professional-odzywka-do-w-osow-oil-repair-intensiv)
- [Conditioner IT old-GTIN indexed source](https://www.dm-drogeriemarkt.it/balea-professional-balsamo-ristrutturante-oil-repair-con-cheratina-p4066447365443.html)
- [Conditioner HR regional conflicting declaration](https://www.dm.hr/p/d/1703916/balea-professional-oil-repair-intensiv-regenerator-za-kosu-za-ostecenu-i-suhu-kosu)

Historical source crawl ages and current retrieval dates are retained separately in JSON. The missing immutable German catalog INCI remains explicitly null for all three.
