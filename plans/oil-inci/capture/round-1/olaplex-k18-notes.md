# E03 / E06 exact-source capture — 2026-10-01

Both records in `olaplex-k18.json` are **capture_ready for the explicitly scoped German online declarations**, subject to the main session's input freeze. This is source acquisition, not classification, fit, calibration or production authority. No physical batch label was inspected. Access date is not a publication date or proof of the newest production formula.

## E03 — OLAPLEX No.7 Bonding Oil, 30 ml

Canonical: the 21-entry [Zalando DE declaration](https://www.zalando.de/olaplex-no7-bonding-oil-haarpflege-olh34h00q-s11.html), matching the [current global manufacturer's exact 30 ml declaration](https://olaplex.com/products/olaplex-n-7-bonding-oil-30ml). The [German branded storefront](https://olaplex.de/collections/glanz-shine/products/olaplex-no-7-bonding-oil) corroborates the sequence, directions and heat positioning. Its operator is [New Flag GmbH](https://olaplex.de/pages/impressum), so the record does not misidentify it as the corporate manufacturer. The German page translates two declaration tokens; its original text is retained separately. Zalando keeps the unaltered declaration forms used for the canonical input.

The [Shop Apotheke 30 ml listing](https://www.shop-apotheke.com/beauty/upmKWKK44/olaplex-no-7-bonding-oel.htm), EAN 0850045076085, contains a 25-entry translated alternative. Differences include additional botanicals and a UV filter, changed declaration forms, and tail order. This exceeds a fragrance-disclosure-only difference. Three-source convergence supports choosing the shorter declaration; no source establishes whether the alternative is older stock, an obsolete listing, a regional variant or another error. Barcode agreement is not formulation-version proof. Lists were not merged.

Manufacturer heat authority is retained separately from retailer INCI authority. Current matched product pages do not provide a hair-UV claim. An [older OLAPLEX manufacturer article](https://olaplex.com/blogs/news/healthy-hair-beach-day-tips-for-every-hair-type) does expressly claim UV protection, and the conflicting retailer packet has UV imagery. These positives are preserved, but neither binds that claim to the selected declaration. The current packet's accepted-claim field must not be paraphrased as “OLAPLEX never claims UV protection.” No UV classification was performed.

Dispensing instructions support an inverted bottle releasing drops when tapped, not a pipette or pump. Local directions supply 2–3 drops, damp/dry application and before/after styling; no invented contact time. Sunflower oil is advertised; a coconut-derived emollient is retained as a separate mention rather than renamed coconut oil.

Zalando retrieval limit: initial indexed page retrieval succeeded; some reopens redirected to its English-language DE storefront and failed. The exact declaration was also returned by the indexed `?size=75C` page. This is online listing evidence, not a photographed pack label.

## E06 — K18 Molecular Repair Hair Oil, 30 ml

Canonical: the 17-entry [Notino DE declaration](https://www.notino.de/k18/molecular-repair-hair-oil-pflegendes-trockenoel-fuer-beschaedigtes-und-bruechiges-haar/p-16220382/). The exact [Flaconi DE 30 ml listing](https://www.flaconi.de/haare/k18/molecular-repair/k18-molecular-repair-hair-oil-haaroel.html?variant=90007597-0011676) corroborates its sequence and EAN 858511001500. Crucially, the [current UK manufacturer 30 ml page](https://k18hair.co.uk/products/molecular-repair-hair-oil) also publishes the same sequence, together with the heat claim. This supports the local declaration packet without requiring US and DE declarations to match.

The [global/US manufacturer page](https://www.k18hair.com/products/molecular-repair-hair-oil) publishes 22 entries: the same prefix, followed by five extra fragrance-tail names. The alternate list remains complete and separate. The [European Commission's disclosure guidance](https://single-market-economy.ec.europa.eu/sectors/cosmetics/cosmetic-products-specific-topics/fragrance-allergens-labelling_en?prefLang=uk) explains why expanded individual fragrance disclosure can lengthen labels. That makes disclosure change plausible here; it does not prove this product's cause, establish unchanged chemistry, or rule out reformulation. No product-specific explanation or dated physical label resolved the cause.

The [K18-branded German shop](https://k18-hair.de/k18-hair/k18-oil/K18MolecularRepairHairOil30ml.aspx) corroborates 30 ml/EAN and directions; it identifies Kevin Murphy GmbH and leaves its ingredient section empty. It is not used as formula authority or silently promoted to an independent manufacturer attestation.

Notino supplies pipette evidence and local 1–3-drop damp/dry directions. Its absent timing stays absent; the UK manufacturer's four-minute instruction is a separate supplemental capture. Avocado and sunflower oils are advertised. Product pages, hero sections and FAQs were checked for protection claims: heat is explicitly claimed; no accepted hair-UV-protection claim was found. These are provenance observations, not ingredient-derived outputs.

Flaconi retrieval limit: initial direct retrieval and indexed result exposed the full declaration and EAN; a later reopen failed. The chosen canonical source remains Notino.

## Boundaries and verification

- Both packets preserve exact declaration spelling/order; neither appends, translates or invents aliases in the canonical string.
- `capture_ready` covers the named local online declaration, not all stock or the newest worldwide formula. Broader market/batch assertions require label or product-specific manufacturer evidence.
- Raw INCI SHA-256 values are stored. JSON parsing, 21/17 ingredient counts, canonical-source references and hash recomputation were checked locally.
- Source prose is paraphrased, with short quotations. Full ingredient declarations are factual records. No copied long marketing text, classification labels or fit assignments were added.
- Only the two assigned capture files were written. No runtime, database, catalog, commit or publication action occurred.
