# Oil remaining-properties round 6 — working revision v0.1.1

Completed locally 2026-10-05 under OE39. Six previously encountered, exact-source cases; two independent formula-first assessments sealed before unblind. Weight carried separately; fit policy unchanged. All substantive formula judgments are estimates, not measured performance.

| Product / scope | Base | Penetration | Build-up | Dispenser | Heat | UV | Supported uses |
| --- | --- | --- | --- | --- | --- | --- | --- |
| [Evolve Organic Beauty Nourishing Hair Elixir – Dry Hair Serum](https://www.evolvebeauty.com/products/weightless-hair-serum) — 30 ml, UK | Ester led | Surface led | unknown | dropper | No | No | leave-on hair, dry finish |
| [Biopark Cosmetics Organic Coconut Oil](https://biopark-cosmetics.com/products/organic-coconut-oil-100ml) — 100 ml, DE | Pure plant oil | Unknown | unknown | other | No | No | pre-wash hair, leave-on hair, scalp |
| [Kérastase Elixir Ultime L’Huile Originale Nachfüllbar](https://www.kerastase.de/produktlinien/produktart/ole-seren/nach-haartyp-filtern/widerspenstiges-haar/l-huile-originale-nachfullbar/KER_00303.html) — 75 ml, DE | Silicone led | Surface led | elevated | pump | Yes | No | pre-wash hair, leave-on hair, dry finish |
| [NEQI Smooth Strength Rosemary Oil](https://neqi-hair.com/products/smooth-strength-rosemary-oil) — 75 ml, DE | Plant-oil blend | Penetration potential | unknown | unknown | No | No | scalp |
| [Kérastase Soleil Huile Sirène](https://www.kerastase.de/alle-produkte/huile-sirene/KER_00054.html) — 150 ml, DE | Water based | Surface led | elevated | spray | No | Yes | leave-on hair, dry finish |
| [Aroma-Zone Haircare Oil With 7 Precious Oils](https://www.aroma-zone.com/en/product/haircare-oil-with-7-precious-oil) — 250 ml, FR | Plant-oil blend | Penetration potential | unknown | unknown | No | No | pre-wash hair, dry finish, scalp |

Heat means an accepted exact-product producer claim. UV requires both a recognized exact filter and an explicit hair-UV claim. False is absence of that accepted evidence, not tested zero protection. Elixir’s temperature stays source text, not a new property.

## Ingredient flags

| Product | Silicones | Mineral oil | Drying alcohol | Fragrance | Scalp-active botanicals |
| --- | --- | --- | --- | --- | --- |
| Evolve Organic Beauty Nourishing Hair Elixir – Dry Hair Serum | No | No | No | Yes | Yes |
| Biopark Cosmetics Organic Coconut Oil | No | No | No | No | No |
| Kérastase Elixir Ultime L’Huile Originale Nachfüllbar | Yes | No | No | Yes | No |
| NEQI Smooth Strength Rosemary Oil | No | No | No | Yes | Yes |
| Kérastase Soleil Huile Sirène | Yes | No | No | Yes | No |
| Aroma-Zone Haircare Oil With 7 Precious Oils | No | No | No | No | No |

The botanical flag does not establish scalp-use permission: Evolve has the exposure flag but no scalp direction; Aroma-Zone and Biopark have scalp directions without the closed-set flag. No growth or tolerance claim follows.

## Named oils and confidence

Base: four moderate and two low-confidence estimates. Penetration: two moderate and three low-confidence estimates, one unknown; build-up: one moderate and one low-confidence elevated estimate, four unknown. Claim/flag observations are factual source classifications. The JSON records retain exact rank evidence, rival interpretations and every gap.

| Product | Named-oil prominence |
| --- | --- |
| Evolve Organic Beauty Nourishing Hair Elixir – Dry Hair Serum | Organic Argan Oil: supporting; Organic Baobab Oil: supporting; Gardenia Monoi: unknown |
| Biopark Cosmetics Organic Coconut Oil | Organic Coconut Oil: leading |
| Kérastase Elixir Ultime L’Huile Originale Nachfüllbar | French camellia oil: unknown; Marula oil: supporting; Wild camellia oil: unknown |
| NEQI Smooth Strength Rosemary Oil | Rosemary oil: unknown; Castor oil: leading; Sweet almond oil: leading |
| Kérastase Soleil Huile Sirène | Babassu oil: supporting |
| Aroma-Zone Haircare Oil With 7 Precious Oils | Castor oil: leading; Coconut oil: leading; Mustard oil: supporting; Broccoli oil: supporting; Avocado oil: supporting; Jojoba oil: supporting; Olive oil: leading; Amla macerated oil: unknown |

Prominence reflects frozen functional roles, never percentages. Gardenia Monoi and Amla macerate remain qualified preparation mappings; geographic French/wild camellia wording does not identify a unique INCI form. Rosemary’s exposure is established, but no qualifying suffix/secondary role establishes prominence.

## Separate weight carry-in

| Product | Existing weight | Authority | Alternative |
| --- | --- | --- | --- |
| Evolve Organic Beauty Nourishing Hair Elixir – Dry Hair Serum | light / low | human_accepted_OE38 | medium |
| Biopark Cosmetics Organic Coconut Oil | rich / low | prior_trial_working_estimate_not_human_acceptance | medium |
| Kérastase Elixir Ultime L’Huile Originale Nachfüllbar | medium / low | prior_trial_working_estimate_not_human_acceptance | light |
| NEQI Smooth Strength Rosemary Oil | medium / low | human_accepted_OE26 | rich |
| Kérastase Soleil Huile Sirène | medium / low | prior_trial_working_estimate_not_human_acceptance | rich |
| Aroma-Zone Haircare Oil With 7 Precious Oils | rich / low | prior_trial_working_estimate_not_human_acceptance | medium |

These are existing estimates, not new round-6 classifications. Human accepted decisions and prior trial working estimates retain different authority. No weight appears in lane inputs or comparison. All ten fit cells per product per lane remain unknown/policy_not_defined (120 excluded cells).

## Repeatability and what remains

Current exact lane equality: **78/78** product-field comparisons. Both-known equality: **67/67**; 11 paired fields are not fully known. Named-oil maps count as one product-field comparison each; any unknown hero makes that whole field unknown for known-coverage purposes. Individual heroes: 19 per lane, 14 known and five unknown. Agreement is repeatability, not accuracy.

Boolean gates/flags have 42/42 equality. Each lane has silicone positives2, fragrance4, scalp-botanical2, heat1 and UV1. Mineral oil and drying alcohol have no positive product example here; their zero-positive conditioned denominator is explicitly zero, not evidence of full positive-case calibration. Boolean positive/negative-conditioned counts are in [comparison-v0.1.1.json](comparison-v0.1.1.json).

Next recommended: settle the rough build-up interpretation for retained botanical/ester systems before defining thickness fit. This small round cannot validate sensory accumulation; compare the four unknowns and decide one consistent low-confidence rule or retain the gaps. Separately, exact Coconut Fruit Oil-to-studied-material penetration mapping and dispenser evidence remain source/evidence gaps.

## Source correction and provenance

The original source projection omitted Elixir’s explicit heat claim and prewash use, and over-assigned its French camellia wording to a species. Both original lanes therefore agreed on incomplete source facts. Those inputs, initial results and initial comparison are preserved; current v0.1.1 uses a separate corrected source packet and re-derived stage2 files. Every blind judgment remains byte-for-value unchanged. This is why agreement alone does not validate capture.

Root also inadvertently refreshed the administrative seal timestamp during a recheck. Its original exact bytes were restored using the first-read timestamp and digest independently reported by both lanes. The initial final receipts retain the temporary reread hash; the transient seal bytes were not retained, so original full provenance verification is not claimed. Current v0.1.1 independently rereads/verifies the canonical restored seal. No formula values changed. Details: [source amendment](post-seal-source-amendment-v0.1.1.json), [seal bookkeeping](seal-bookkeeping-correction.json), [initial-stage preservation](initial-stage2-preservation.json).

Current full structural/gate verification and 19 real-corpus corruption controls plus four UV combinations pass. The 219 pre-existing reference/trial/receipt files are byte-identical. The old round4/5 guards are additional regressions. Published declarations/claims are not physical-batch evidence; no sensory accuracy, clean holdout, full category coverage or intake readiness is claimed. No runtime, database, catalog, fit, commit, publication or production change.

Files: [current CSV sheet](working-property-sheet-v0.1.1.csv), [working records](working-records-v0.1.1.json), [current sources](source-packet-v0.1.1.json), [method](method.md), [current derivation scope](derivation-method-note.md), [completion receipt](completion-receipt.json).
