# First exploratory oil cohort — candidate set

Prepared 2026-10-01 following Nick's property sign-off and requested engineering review. Status: candidate selection and source preflight, **not frozen packets or completed classifications**. This is a development round, not a gold set or unseen holdout. No catalog membership/live counts are asserted.

## Eight candidate products

Selection is designed to expose distinct formula/input problems. The descriptions below are selection reasons drawn from source observations, never preassigned reference labels. Classification researchers receive blind INCI packets first; brand/claims/old catalog labels do not determine formula labels.

| Slot | Candidate identity | Reason to include | Candidate source / remaining capture work |
| --- | --- | --- | --- |
| E01 | dmBio Kokosöl nativ, Naturland, 300 ml, GTIN 4058172504969 | Single-oil contrast for a coconut-named silicone formula; penetration evidence stress; unusual dispenser/physical form | [dm exact listing](https://www.dm.de/dmbio-kokosoel-nativ-naturland-p4058172504969.html). Search source gives 100% coconut ingredient declaration and hair use, but direct fetch failed. Exact label capture and accepted canonical-INCI/input treatment are unresolved; this slot is not run-ready. Existing comparison includes pure native coconut oil. Do not manufacture a cosmetic INCI or silently infer hair directions from food use. |
| E02 | NEQI Smooth Strength Rosemary Oil | Plant-oil blend, scalp botanicals, pre-wash scalp directions and site/rinse distinctions | [German manufacturer](https://neqi-hair.com/products/smooth-strength-rosemary-oil). Formula and directions visible. Bind exact package/GTIN/size, capture dated excerpts, and disregard generic range-copy peptide claims conflicting with displayed oil INCI. |
| E03 | OLAPLEX No.7 Bonding Oil, 30 ml | Silicone/emollient architecture, claim-led heat protection, controlled-drop dispenser | [Manufacturer](https://olaplex.com/products/olaplex-n-7-bonding-oil-30ml). Verify exact German/EU identity/pack and admissible claim source; do not infer absent or present UV from historic catalog labels. |
| E04 | OGX Coconut Miracle Oil, 100 ml | Coconut positioning with a silicone/emollient-leading ingredient list; contrasts with E01 without accepting "penetrating" as a formula label | [German retailer identity](https://www.dm.de/p/d/2322377/ogx-haaroel-coconut-miracle-oil); [manufacturer INCI/directions](https://www.ogxbeauty.com/products/coconut-miracle-penetrating-oil). Manufacturer page is US 3.3 fl oz; resolve market/formula equivalence against current DE pack before a canonical packet. |
| E05 | Living Proof No Frizz Vanishing Oil | Silicone-free alkane/ester/polymer mixture; explicit manufacturer denial of heat/UV; mixed persistent/volatile interpretation | [Manufacturer](https://www.livingproof.com/products/no-frizz-vanishing-oil). Full list/directions visible. Verify exact DE/EU package/identity; current page stock state is not a reason to infer catalog state. |
| E06 | K18 Molecular Repair Hair Oil, 30 ml | Ester/squalane/oil mixture; hybrid/base boundary; active ingredient present without creating a repair property | [Manufacturer](https://www.k18hair.com/products/molecular-repair-hair-oil). Full list and directions visible; verify DE/EU exact identity/package and source claim authority. |
| E07 | NEQI Opulent Oil Hair Serum, 75 ml | Water-based oil-labelled product, pump/damp leave-on directions, UV-filter ingredient without a UV claim found on the reviewed product page | [German manufacturer](https://neqi-hair.com/products/opulent-oil-hair-serum). Full INCI includes Ethylhexyl Methoxycinnamate; reviewed product text includes heat claim. Bind exact GTIN/package and freeze full claim review before treating missing UV claim as assessed false. This is a selection signal, not an independent expected-label key. |
| E08 | Kérastase Soleil Huile Sirène, 150 ml | Water-based/mixed formula, explicit hair sun-protection claim plus filter ingredient; styling/category boundary and shake instruction stress | [German manufacturer](https://www.kerastase.de/alle-produkte/huile-sirene/KER_00054.html). GTIN candidate 3474636695324 from the exact manufacturer URL. Recheck package, full INCI and directions; do not silently force inclusion if the category charter excludes styling-first products. |

Evidence refreshed 2026-10-01 for the candidate purpose: OGX current manufacturer list, NEQI Opulent German page, dmBio search listing and K18 source. Other linked manufacturer observations were read on 2026-09-30 in the market audit. These are candidates for capture, not reusable frozen input evidence.

**Subsequent source-preflight update:** see `source-preflight-2026-10-01.md`. Exact dm DE now provides E04's full formula/directions/GTIN, so US equivalence is no longer needed for that slot. E07's current German manufacturer identity/size/formula/directions are sufficient for local capture; a different Polish listing is retained as cross-market evidence rather than automatically blocking DE capture. E04/E07/E08 are capture-ready, not frozen. A Biopark Cosmetics 100 ml pure coconut product is proposed as an explicit reserve for E01; no substitution has been made.

**Further same-date corrections:** E02's exact German package is **75 ml, EAN 4063528086280**, verified by main from German retailer plus manufacturer image identifier; the earlier foreign 150 ml assumption is discarded. E05 has an exact DE ingredient source; E03 has local/manufacturer convergence but a contradictory pharmacy list remains in the version-conflict queue; E06 still needs tail-version resolution. See the appended acquisition receipt rather than treating the original remaining-work cells as the current freeze status.

## What this first set can and cannot test

It covers pure versus blended oils, silicone versus silicone-free systems, two water-based boundaries, named-oil prominence, scalp exposure and directions, dose/dispenser differences, heat claims, and both UV-ingredient-only and ingredient-plus-claim cases if exact capture confirms them.

It does not cover every flag/value combination. Positive mineral-oil and drying-alcohol cases, absent advertised hero oils and further dispenser forms must be added in later stress products/fixtures, not claimed covered by this small selection. Every product retains all agreed property/fit rows; fits stay unknown where a policy is unresolved rather than receiving invented eligibility.

## Before the first classification run

1. Draft the category/input contract and scientifically checked lexicon/anchors for weight, base, penetration, persistence, UV filters and botanicals. Supported-use inference policy still needs resolution.
2. Resolve each exact market/variant/package identity, canonical INCI, dispenser and directions/claims source. Freeze dated excerpts and immutable hashes; incomplete identity/formula packets block completion. E01 and any foreign-market equivalence are explicit source blockers.
3. Keep blind formula packets separate from unblinded product/claim packets. Do not expose these selection explanations or old catalog weights to blind classification lanes.
4. Give both independent classification lanes the same versioned method and packets. Report unknowns, property-by-property agreement, provenance gaps and adjacent-value rationale; do not equate agreement with real-world performance.
5. Record rule fixes as a new revision, preserve earlier outputs, and exclude these development identities/formulas from a genuinely unseen holdout later.

The supplied property sign-off and request authorize cohort preparation. This document does not imply science/packet readiness, production activation, a migration or an approved reference key. Resolve the source blockers before claiming a successful eight-product run; do not silently substitute or reduce the intended set.
