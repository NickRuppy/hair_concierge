---
category: deep_cleansing_shampoo
document_type: evidence
status: reviewed
evidence_version: 1
last_reviewed_at: 2026-08-06
decision_file: docs/personal-plan/categories/deep-cleansing/decision.md
---

# Personal Plan Deep Cleansing evidence

## Status

This file preserves the evidence-sensitive conclusions reviewed during the Deep Cleansing category pass. It separates external evidence and verified product positioning from the deterministic Personal Plan policy in `decision.md`. Manufacturer pages establish product positioning and directions, not universal comparative efficacy.

## Answer-first findings

### Deep Cleansing is an occasional Reset, not another wash

Clarifying or deep-cleansing shampoos are used to remove accumulated sebum, dry-shampoo residue, Styling residue, and other deposits that ordinary cleansing may leave behind. Representative manufacturer instructions commonly position the product in place of the regular Shampoo. The Reset therefore belongs inside the existing Shampoo wash budget rather than creating an extra wash.

Product implication: a Deep Cleansing occurrence substitutes for the regular Shampoo occurrence on that wash day.

### Product load and recurring Dry Shampoo use are the strongest observable triggers

Dry Shampoo absorbs oil but does not remove it with water. Dermatology guidance recommends returning to Shampoo and water after limited Dry Shampoo use and warns that repeated accumulation may irritate the scalp or contribute to breakage. Regular Leave-in and finishing Oil use are plausible product-load signals, especially when combined with few wet washes or an explicit weighed-down concern.

Product implication: use current product frequency, product role, normal Shampoo frequency, oily scalp, and the existing `low_volume_or_weighed_down` concern as deterministic inputs. Do not infer buildup merely because a person owns a product.

### Oily scalp alone does not establish a Basis Reset

Oily-scalp guidance primarily supports choosing and using an appropriate normal Shampoo cadence. Deep Cleansing may be a useful occasional option, but oily scalp alone does not prove persistent residue that requires a scheduled Reset.

Product implication: oily scalp alone creates an optional signal. It reaches Basis only with another accumulation signal.

### A weighed-down outcome is useful corroboration but not a diagnosis

Low volume or a weighed-down feeling can result from residue, but also from the selected Conditioner, formula weight, hair structure, Styling, or technique. It becomes meaningful for Reset need when paired with an observable accumulation driver.

Product implication: `low_volume_or_weighed_down` contributes only alongside another Reset-load signal. When both exist, the explanation should pair the experienced outcome with the likely driver.

### Generic residue Reset and mineral Reset are distinct verified roles

General Deep Cleansing products commonly claim removal of product, Styling, oil, and environmental residue. Chelating or mineral-oriented products address metal, hard-water, or chlorine-related deposits. Marketing language alone does not prove a chelating mechanism, and ingredients should not be used to infer one.

Product implication: store explicit verified `residue_reset` and `mineral_reset` roles. Manufacturer positioning may establish the claimed role, but the explanation must not upgrade an “Anti-Kalk” claim into independently proven chelation.

### Cleansing strength cannot be calibrated reliably from the current evidence

Current products use overlapping “deep,” “intensive,” “gentle,” daily-use, and weekly-use language. Public ingredient lists and marketing do not provide a stable common scale for `gentle | medium | strong`; finished-formula behavior also cannot be inferred from one surfactant or active ingredient.

Product implication: remove `resetIntensity` from Personal Plan fit. Use verified role, target positioning, cadence, and exact application protocol instead.

### Deep Cleansing is normally one Shampoo pass

Manufacturer guidance supports one Deep Cleansing pass as the default. Some exact products permit repeating or position the product before another Shampoo, while dermatology guidance discusses a second Shampoo more generally when heavy sebum suppresses lather. There is no category-wide basis for double-cleansing with an already intensive cleanser.

Product implication: V1 uses one pass only. Double Shampooing remains outside the Deep Cleansing category and may be reconsidered separately for normal Shampoo.

### Application has a safe category fallback

General Shampoo guidance supports thoroughly wetting the hair, applying primarily to scalp and roots, massaging gently, and rinsing thoroughly. Product pages vary on contact time; some give a short or exact dwell, while others do not.

Product implication: do not invent minutes, dosage, or a second pass. Exact verified directions may override placement or contact time, while the user's already-planned after-wash care follows the final rinse.

### Colour-treated suitability is deferred from V1

Deep-cleansing products may accelerate colour loss, while some exact products are marketed as colour-compatible. The five currently active orientation-product pages do not provide a sufficiently explicit, unambiguous colour-treated compatibility statement.

Product implication: the evidence does not support an optimistic compatibility default. Because the broader cross-category colour-care topic is not yet designed, V1 omits this axis from the Deep Cleansing schema, matching, enrichment, and launch gate rather than creating an all-null local field. This evidence can be reconsidered when shared colour-care policy is specified.

## Current active-product orientation

| Product | Verified positioning | Protocol evidence | Current colour fact |
|---|---|---|---|
| NEQI x The Beautiful People Deep Cleansing Shampoo | Removes buildup and excess sebum; explicitly positioned for all hair types and dry/itchy scalp | Wet hair, massage/lather, rinse; manufacturer also markets Double Cleansing, which V1 deliberately does not adopt | unverified |
| Swiss-O-Par Tiefenreinigung Shampoo | Removes Styling residue, fats, silicones, environmental deposits, and claims an Anti-Kalk effect | Lather, wash through, rinse | unverified |
| Balea Professional Tiefenreinigung Shampoo | Removes Styling residue and excess oil from hair and scalp | Massage into wet hair, short non-numeric dwell, rinse | unverified |
| ISANA Professional Tiefenreinigung Shampoo | Removes Styling residue and deposits; general all-hair positioning | Massage into damp hair/scalp, short non-numeric dwell, rinse | unverified |
| Gliss Scalp Balance Tiefenreinigungs-Shampoo | Explicit oily-scalp target; removes excess oil and Styling/care residue | Brand positions it one to two times weekly; no stronger category-wide protocol inferred | unverified |

## Evidence limitations

- There is no universal clinical every-N-washes cadence for cosmetic Deep Cleansing.
- Manufacturer frequency language establishes exact-product positioning, not a shared calibrated strength scale.
- The current profile does not yet provide a verified hard-water, swimming, or mineral-exposure input, so V1 can store mineral-product capability without automatically creating that role.
- The current product inventory does not yet cover Styling products as a structured accumulation input.
- Ingredient lists do not establish finished-product intensity, tolerance, colour safety, or chelation by themselves.

## Source register

| Source | Type | Supports | Limitations |
|---|---|---|---|
| [DermNet — Shampoo](https://dermnetnz.org/topics/shampoo) | Dermatology reference | Shampoo placement, scalp focus, lather/sebum context, clarifying purpose | General Shampoo guidance, not an exact Deep Cleansing cadence trial |
| [AAD — Dry Shampoo tips](https://www.aad.org/public/everyday-care/hair-scalp-care/hair/dry-shampoo-best-results) | Dermatology guidance | Dry Shampoo is not water cleansing; limit repeated accumulation | Does not define a Deep Cleansing score |
| [AAD — Healthy hair tips](https://www.aad.org/public/everyday-care/hair-scalp-care/hair/healthy-hair-tips) | Dermatology guidance | Scalp-focused Shampoo and follow-up conditioning | General guidance |
| [Living Proof Clarifying Detox Shampoo](https://www.livingproof.com/products/clarifying-detox-shampoo) | Manufacturer positioning/protocol | Replacement Shampoo use and exact product timing | Product-specific marketing evidence |
| [K18 Peptide Prep Detox Shampoo](https://www.k18hair.com/en-ca/products/mini-peptide-prep-detox-shampoo-1-8oz) | Manufacturer positioning/protocol | Replacement use and product-specific repeat permission | Product-specific; repeat rule rejected as category default |
| [OUAI Detox Shampoo](https://theouai.com/products/detox-shampoo) | Manufacturer positioning/protocol | Product-specific permission to use in place of or before regular Shampoo | Exception, not category-wide evidence |
| [NEQI Deep Cleansing Shampoo](https://neqi-hair.com/products/neqi-x-the-beautiful-people-deep-cleansing-shampoo) | Manufacturer positioning/protocol | Residue/sebum role, scalp targets, application | Marketing evidence; Double Cleansing not adopted |
| [Swiss-O-Par Tiefenreinigung Shampoo](https://swissopar.de/produkt/tiefenreinigung-shampoo/) | Manufacturer positioning/protocol | Residue role, Anti-Kalk claim, application | Anti-Kalk claim is not independent proof of chelation |
| [Balea Professional Tiefenreinigung](https://www.dm.de/p/d/1536339/balea-professional-shampoo-tiefenreinigung) | Retailer/manufacturer product data | Residue/sebum positioning and application | Marketing evidence |
| [ISANA Professional Tiefenreinigung](https://www.rossmann.de/de/pflege-und-duft-isana-professional-shampoo-tiefenreinigung/p/4068134135490) | Retailer/manufacturer product data | Residue positioning and application | Marketing evidence |
| [Gliss Scalp Balance Tiefenreinigung](https://www.schwarzkopf.de/marken/haarpflege/gliss/scalp-balance/tiefenreinigungs-shampoo.html) | Manufacturer positioning | Oily-scalp and residue positioning | Marketing evidence |
