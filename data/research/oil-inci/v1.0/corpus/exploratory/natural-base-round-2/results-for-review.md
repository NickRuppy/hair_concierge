# Natural-material weight comparison — results for review

Completed 2026-10-02, local research only. The requested reusable natural-oil weight reference is available: **25 exact material entries**, 38 reviewed names/aliases, 26 source records, alternatives/confidence and form exclusions. It covers all 15 fixed oils encountered in round 1, all six pictured oils, castor/whole-coconut anchors and bounded common additions.

The current local operating rule is [weight reference/overlay v0.2](../../../../../../../docs/research/oil-inci/v1.0/03_weight-reference-v0.2.md); the machine-readable source is [natural-oil-weight-v0.2.json](../../../reference/natural-oil-weight-v0.2.json). It informs a new INCI assessment while preserving whole-formula judgment. No customer/runtime/database behavior changed.

## Eight cosmetic-material benchmarks

Both independent lanes selected the same eight values and confidences, with 8/8 substantive coverage. **This is shared-reference application consistency, not validation of hair feel.** These cosmetic carrier/body-care benchmarks do not assert hair-product intake eligibility. Inputs are selected complete published declarations; no physical-batch inspection is claimed.

| Material | Estimate | Robustness | Nearest alternative | Exact captured cosmetic material |
| --- | --- | --- | --- | --- |
| Jojoba | `light` | low | medium | PRIMAVERA Jojobaöl bio* |
| Grapeseed | `light` | moderate | medium | Aromat'easy Huile de Pépins de Raisin |
| C8/C10 MCT (Caprylic/Capric Triglyceride) | `light` | moderate | medium | Aroma-Zone Caprylis - Emollient |
| Sweet almond | `light` | moderate | medium | PRIMAVERA Mandelöl bio* |
| Apricot kernel | `medium` | moderate | light | PRIMAVERA Aprikosenkernöl bio* |
| Safflower | `light` | low | medium | Karandja Huile végétale Bio CARTHAME |
| Castor | `rich` | moderate | medium | Alepia Huile de Ricin Bio - 100 ml |
| Whole coconut | `rich` | low | medium | Biopark Cosmetics Organic Coconut Oil |

CCT is processed MCT, separate from intact coconut oil. The incomplete initial Naissance castor declaration was excluded and replaced by an exact full Alepia declaration. CCT plural-display and Biopark Fruit Oil wording use limited product-specific reconciliation receipts; neither becomes an unsafe generic alias. Biopark's earlier DE corroboration is explicitly reused; its manufacturer page was revisited today. Size-unspecified seller captures remain visible in the source packet; no dose/dispenser was assessed.

## What the mixed-formula probes revealed

Six hypothetical sketches exercise the whole-formula overlay independently of the eight material benchmarks. Raw agreement was 6/6; **five of those are mutual unknowns**. Substantive coverage was only 1/6, with agreement on that single known case (1/1). Do not pool these with the eight benchmarks or interpret raw agreement as product accuracy.

| Probe | Main working result | Decisive interpretation/gap |
| --- | --- | --- |
| P01 mobile-emollient candidates + late castor | unknown; light alternative | Leading exact ester has identity/function evidence but insufficient weight evidence in the frozen role dictionary. Late castor cannot force rich or be presumed trace. |
| P02 castor + whole coconut + olive | rich / low; medium alternative | Coherent medium-to-rich entire carrier supports a qualified estimate; no ratio, count vote or first-two majority inferred. |
| P03 jojoba + castor | unknown | Opposing priors without blend ratio/finish evidence; medium cannot be a mathematical compromise. |
| P04 unresearched coffee-seed carrier | unknown | New exact oil requires its own material evidence; no all-plant-medium default. |
| P05 aqueous formula with modified castor solubilizer | unknown | Derivative cannot inherit castor richness; water rank cannot determine lightness. |
| P06 volatile silicone + gum/film + grapeseed | unknown; rich alternative | Light botanical/volatile carrier cannot erase a film signal; film load and silicone grade remain unresolved. |

Both independent outputs remain sealed. Main reviewed all 28 records and retained the values separately in `main-working-weights-v0.2.json`; no agreement-driven changes to priors, outputs or confidence. These are weight-only assessments, not full oil profiles.

## Evidence limits and next action

Most comparative descriptors are supplier skin sensory or material data. No standardized scientific hair-weight class was established for any reference entry. Oil density, viscosity, fatty-acid ratios and penetration do not directly equal hair heaviness. Moderate robustness is about a stable *estimated classification under these priors*, not efficacy or experimentally proven hair feel. Low-confidence olive/sunflower/black-seed priors are particularly weak; marula/wheat-germ and avocado grades have meaningful conflicting descriptions. The material table must not suppress these alternatives.

The reference now answers the natural-material question for this session. Next, strengthen exact nonbotanical carrier/film weight evidence surfaced by P01/P06 and use the reference on actual mixed hair-oil formulas in a separately frozen derivation. Measured hair feel would need comparable-dose tress/sensory evidence. Thickness eligibility and the fit/production adapter remain separate later decisions; no decision from Nick is needed to complete this reference/material round.

## Verification and preservation

`python3 plans/oil-inci/verify-natural-weight-artifacts.py` checks reference shapes, exact aliases/form exclusions, source ID integrity, all 15 prior fixed-oil identities, input/output hashes, 14-ID lane coverage, estimate metadata and no confidence inflation for material benchmarks. All 28 round-1 files remain byte-identical to the pre-session baseline. Independent source captures, method/reference packets and two lanes are retained in this new run; no historical run is rewritten. See `verification-receipt.json` and `completion-receipt.json` for actual checks and hashes.
