---
category: dry_shampoo
document_type: evidence
status: reviewed
evidence_version: 1
last_reviewed_at: 2026-08-06
decision_file: docs/personal-plan/categories/dry-shampoo/decision.md
---

# Personal Plan Dry Shampoo evidence

## Status

This file preserves the evidence-sensitive conclusions and Drogerie-market review used for the Dry Shampoo decision. It separates external guidance and verified finished-product positioning from deterministic Personal Plan policy. Manufacturer and retailer pages establish product claims, format, and directions; they do not establish universal comparative efficacy.

The supplied high-end row is intentionally excluded from V1 orientation. The larger Drogerie list is used to choose a future-proof minimal schema and application formats, not to authorize product publication or catalog activation in this checkpoint.

## Answer-first findings

### Dry Shampoo is a temporary refresh, not cleansing with water

Dermatology guidance describes Dry Shampoo as absorbing oil rather than cleaning the scalp and hair with Shampoo and water. Repeated use should be interrupted by regular wet washing.

Product implication: the category owns optional root refresh between wet washes. It never replaces the resolved wet-wash cadence or claims scalp treatment.

### Two uses before wet washing is a practical operational guard

The American Academy of Dermatology advises washing with regular Shampoo and water after one or two Dry Shampoo uses. This is a sequence rule rather than a precise universal weekly frequency.

Product implication: count logged occurrences since the last wet wash. After two, suggest the wet wash next. Keep reported weekly average as a separate behavior-adjustment signal.

### Active scalp symptoms justify a pause, not a hidden fit rewrite

Accumulated Dry Shampoo can contribute to scalp irritation, while application over an already irritated or flaky scalp can obscure the need for appropriate cleansing or care. Sensitive positioning alone does not mean an otherwise standard Dry Shampoo cannot refresh the roots.

Product implication: preserve product fit, cadence advice, and temporary execution pause as separate outputs. Pause active irritation, dry flakes, active dandruff, or visible buildup; do not make sensitivity positioning a hard blocker without a known reaction.

### The verified V1 Drogerie cohort supports three useful application formats

The reviewed products show materially different application behavior:

- conventional pressurized aerosol sprays;
- pressurized aerosol foams;
- non-aerosol liquid sprays/pumps that dry after application.

These differences mainly change application. They do not provide a reliable global hierarchy of product quality or fit.

Product implication: store one constrained three-value V1 format, derive aerosol status from it, and compile one standardized fallback per format. Do not add a separate aerosol boolean. The unverified powder candidate remains outside V1 rather than creating a speculative enum and protocol.

### Refresh and volume/texture are the useful product directions

The reviewed Drogerie products share root refresh/oil absorption as their category job. Some explicitly add volume, grip, texture, or a mattifying root effect. Sensitive variants are positioning/tolerance directions, not a second functional job.

Product implication: keep core refresh implicit and store `standard_refresh` versus `volume_texture`. Use it as a soft goal direction, not a hard eligibility gate.

### Hair-colour variants are appearance compatibility, not category efficacy

Tinted Dry Shampoos are designed to reduce visible residue on corresponding hair colours. A wrong tint can still absorb oil, but the cosmetic result may be visibly poor. Universal products avoid the need to know hair colour.

Product implication: universal products can be recommended immediately. Resolve a tinted variant inline in Stage 2 only when it is otherwise preferred. Treat a wrong tint as `passt mit Einschränkung`, not an efficacy failure.

### “No visible residue” remains evidence-only in V1

Several reviewed products advertise no visible residue after correct application or brushing. This is a finished-product marketing claim and may depend on dosage, distribution, hair colour, and application.

Product implication: do not add this claim to the V1 Dry Shampoo schema or ranking model. Tint compatibility already covers the material appearance mismatch, while this weaker marketing claim would add enrichment without changing fit. Retain it only as source background for possible later product copy.

### Fragrance-free claims are deferred from the V1 schema

Several Drogerie products are marketed as fragrance-free or sensitive. The current onboarding does not collect fragrance or aerosol exclusions.

Product implication: do not add a Dry Shampoo-local `fragranceFree` field while no user-side preference or matching behavior exists. Retain these claims only as source orientation. If the product later supports fragrance avoidance, introduce it through one shared cross-category attribute. Sensitive-scalp positioning remains separately represented by `scalpSensitivityFit`, and a known user reaction remains an explicit mismatch reason.

### Cleansing strength is not a useful Dry Shampoo axis

Dry Shampoos use different powders, starches, delivery systems, and supporting ingredients, but public product pages do not provide a calibrated common “cleansing strength” scale. Oil absorption cannot be inferred reliably from one ingredient or marketing adjective.

Product implication: no cleansing-strength score and no ingredient-based strength matching in V1.

## Drogerie product-orientation matrix

This matrix records only the properties relevant to the proposed schema. Exact rows must be reverified during catalog intake before activation.

| Product | Observed direction | Observed format | Relevant verified positioning | Intake status for this checkpoint |
|---|---|---|---|---|
| Langhaarmädchen Trockenshampoo sensitiv | standard refresh | aerosol spray | fragrance-free/sensitive; volume/mattifying claims also present | orientation only |
| ISANA Trockenshampoo Sensitiv, parfumfrei | standard refresh | aerosol spray | sensitive/fragrance-free positioning | orientation only |
| Balea Trockenshampoo Kopfhaut Sensitive | standard refresh | aerosol spray | fragrance-free/sensitive; no visible residue after brushing | orientation only |
| Guhl 30sek Trockenshampoo Volumen & Frische | volume/texture | aerosol spray | volume, grip, root refresh | orientation only |
| Jean&Len Trockenshampoo 7in1 | volume/texture | aerosol spray | refresh, volume, texture/grip, no-white-residue claim | orientation only |
| Balea Trockenshampoo Schaum Kopfhaut Sensitive | volume/texture | aerosol foam | exact current dm SKU/GTIN verified; pressurized aerosol foam; sensitive/fragrance-free; refresh plus Styling/volume through drying | exact format verified 2026-08-06 |
| ISANA Trockenshampoo Schaum Sensitiv | volume/texture | aerosol foam | sensitive positioning; volume through drying | orientation only |
| got2b Liquid-to-Dry | standard refresh | non-aerosol liquid | exact current dm SKU/GTIN and manufacturer product verified; pump liquid without propellant; no-visible-residue claim | exact format verified 2026-08-06; dm temporarily unavailable |
| Alterra Trockenshampoo Sensitiv | unverified | possible non-aerosol powder | exact current product/source not sufficiently verified | outside V1; reconsider only through exact product intake |

No product in this matrix is added to or activated in the database by this category decision.

## Application evidence

### Aerosol spray

Reviewed spray directions commonly instruct use on dry hair/roots, shaking, spraying from a distance, allowing a short dwell, massaging, and brushing. Exact distances and times vary.

Product implication: retain the common ordered phases without inventing universal centimetres or seconds.

### Aerosol foam

Reviewed foam directions apply an amount to the roots and require complete drying, often with blow-drying or air-drying, before finishing the style.

Product implication: the format fallback must include complete drying and may mention cool blow-drying; do not copy a product-specific “tennis ball” dose to every foam.

### Non-aerosol liquid

The reviewed liquid-to-dry product uses a pump/spray application, a short drying phase, and mechanical or cool-air finishing.

Product implication: use a generic sparse-application/dry/work-in protocol unless an exact product override supplies verified numbers.

### Excluded powder orientation

Powder Dry Shampoos generally require sparse root distribution, a short dwell, massage, and removal of excess. The exact Drogerie product from the supplied list was not verified from a sufficiently authoritative current source.

Product implication: do not support the format in the V1 schema or compiler. Add it later only if exact product intake verifies a current candidate and its materially distinct instructions.

## Evidence limitations

- There is no universal evidence-based number of Dry Shampoo applications per calendar week that fits every wash cadence; the stronger evidence supports limiting consecutive uses before wet washing.
- Product marketing does not establish comparative oil-absorption efficacy.
- Sensitive, fragrance-free, residue, volume, and duration claims are finished-product positioning rather than independent clinical proof.
- Hair colour is not currently collected, so tinted selection requires late-bound resolution or a universal product.
- The reviewed catalog does not yet provide verified fragrance/aerosol user exclusions.
- Workout, travel, and emergency-refresh contexts exist in some broader recommendation/runtime contexts but are not canonical Personal Plan inputs.
- The high-end row from the supplied list is excluded from this V1 category checkpoint.

## Source register

| Source | Type | Supports | Limitations |
|---|---|---|---|
| [AAD — Dry Shampoo tips](https://www.aad.org/public/everyday-care/hair-scalp-care/hair/dry-shampoo-best-results) | Dermatology guidance | Oil absorption rather than water cleansing; wash after one or two uses; accumulation/irritation boundary | Does not define a universal weekly cadence or exact product fit |
| [Balea Trockenshampoo Kopfhaut Sensitive](https://www.dm.de/p/d/1711758/balea-trockenshampoo-kopfhaut-sensitive) | Retailer/manufacturer data | Aerosol spray, sensitive/fragrance-free positioning, residue claim, application | Product-specific marketing evidence |
| [Balea Trockenshampoo Schaum Kopfhaut Sensitive](https://www.dm.de/p/d/2974661/balea-trockenshampoo-schaum-kopfhaut-sensitive) | Retailer/manufacturer data | Aerosol foam, sensitive positioning, drying and volume/Styling directions | Product-specific marketing evidence |
| [got2b Liquid-to-Dry](https://www.dm.de/p/d/2476987/got2b-trockenshampoo-liquid-to-dry) and [official got2b product page](https://www.got2b.de/haarstyling/produkt/trockenshampoo/trockenshampoo-liquid-to-dry-spray.html) | Retailer/manufacturer data | Exact non-aerosol pump-liquid format, drying/application phases, residue claim, current product identity | Product-specific marketing evidence; dm was temporarily unavailable on 2026-08-06 |
| [Langhaarmädchen Trockenshampoo sensitive](https://www.dm.de/p/d/2972775/langhaarmaedchen-trockenshampoo-sensitive) | Retailer/manufacturer data | Aerosol, fragrance-free/sensitive positioning, volume/matte-root direction | Product-specific marketing evidence |
| [Guhl 30sek Trockenshampoo Volumen & Frische](https://www.guhl.com/produkt/30sek-trockenshampoos/30sek-trockenshampoo-volumen-frische/) | Manufacturer data | Volume/grip direction and aerosol application | Product-specific marketing evidence |
| [Jean&Len Trockenshampoo 7in1](https://www.jeanlen.de/en/Trockenshampoo-7in1-200-ml/2900100243) | Manufacturer data | Refresh, volume/texture, and no-white-residue positioning | Product-specific marketing evidence |
| [Rossmann Dry Shampoo category](https://www.rossmann.de/de/pflege-und-duft/haarpflege/trockenshampoo/c/olcat3_6076269?pageIndex=0) | Retail catalog | Current ISANA category/orientation context | Dynamic catalog, not a stable efficacy source |
| [ISANA Trockenshampoo Schaum Sensitiv](https://www.rossmann.de/de/pflege-und-duft-isana-isana-h-trockenshampoo-schaum-sensitiv/p/4068134196057) | Retailer/manufacturer data | Aerosol foam and sensitive/volume-through-drying positioning | Product-specific marketing evidence |
