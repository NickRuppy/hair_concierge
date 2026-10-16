# Natural-base contrast round 2 — source notes

Captured 2026-10-02. These are exact cosmetic carrier-material declarations for a blind comparison input. The records intentionally contain **no weight data**, no product-property classifications, and no hair-intake eligibility conclusion.

| Cases | Capture result | Eligibility limit |
| --- | --- | --- |
| N01, N04, N05 | Complete: PRIMAVERA official DE cosmetic base-oil pages, each with a one-ingredient declaration. | The selected products are skin-care oils; no hair direction observed. `benchmark_material_only`. |
| N02, N06 | Complete: exact FR/EU cosmetic carrier/oil seller pages, each with a one-ingredient declaration. | The accessed product pages establish cosmetic-material identity, not Hair Concierge intake eligibility. `benchmark_material_only`. |
| N03 | Complete: Aroma-Zone official cosmetic emollient page declares `Caprylic / capric triglycerides`; the official EU nomenclature receipt records `CAPRYLIC/CAPRIC TRIGLYCERIDE`. | MCT is a resolved cosmetic material but not whole coconut. No hair direction observed. `benchmark_material_only`. |
| N07 | Complete: Alepia official 100 ml cosmetic oil page publishes `Ricinus Communis (Castor) Seed Oil`. | The page contains hair-use content, but that content is deliberately not promoted to an engine-intake decision. `benchmark_material_only`. |
| N08 | Complete: Biopark Cosmetics Coconut Oil Organic, 100ml, initially re-used from round-1 E01 then current manufacturer page re-opened. | Current exact product text binds `Cocos Nucifera Fruit Oil` to its named cold-pressed, unrefined coconut oil. This is product-specific, not a generic alias. `benchmark_material_only`. |

## Source handling

- The one selected declaration in each record is the product page's raw declaration, including capitalization, parentheses, asterisk, and the N07 specificity gap. No INCI strings were merged or expanded.
- N07's first Naissance candidate published only `Ricinus Communis`. It is retained in N07 as `prior_source_inci_specificity`, but is not the selected declaration. Alepia's exact 100 ml cosmetic product supplies the full `Ricinus Communis (Castor) Seed Oil` declaration.
- N03 retains Aroma-Zone's raw product display `Caprylic / capric triglycerides`. The normalization receipt points to the EU common-nomenclature entry `CAPRYLIC/CAPRIC TRIGLYCERIDE` for glycerides mixed decanoyl and octanoyl. This is an orthographic/nomenclature receipt only.
- N08 has a known manufacturer/retailer display-specificity difference (`Cocos Nucifera Fruit Oil` versus a shortened retailer display). Biopark's currently inspected product page binds its exact raw declaration to "Cold-pressed, unrefined coconut oil". That receipt remains limited to the named product; it creates no generic Fruit Oil alias.
- The product pages establish cosmetic identity and one carrier material only. They do **not** establish a Hair Concierge product-intake path, an active catalog item, hair-use suitability, concentration behavior, or any weight outcome.
- No food-only product and no hand-made/assumed declaration was selected. N03's source explicitly calls the product cosmetic and provides the exact Caprylic/Capric Triglyceride declaration; it is not treated as a whole-coconut substitute.
