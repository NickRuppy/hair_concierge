# Natural base-oil weight evidence — 2026-10-02

Status: external research plus advisory estimates; not the versioned operational reference. The main session chooses policy. No product cohort labels, fitted thresholds or finished-product classifications were used.

## Chosen direction

Use a small three-class reference only as an approximate ingredient prior, with a plausible alternative and evidence strength attached. Keep scientific observations separate from policy: viscosity describes flow, spreading describes coverage, skin sensory describes skin feel, and hair penetration/protein-loss experiments measure different outcomes. No standardized scientific light/medium/rich hair class was established for any of these 24 materials.

The machine-readable [source ledger](natural-oil-weight-source-ledger-2026-10-02.json) contains keyed sources, exact URLs, access limitations, per-oil observations, exact-form exclusions and advisory estimates. The `sources` object is keyed by stable IDs. Each `oils[]` row carries `evidence[]` and a separate `advisory_policy`; the latter must not be presented as a measured source result.

## Strongest retrieved external evidence

The [EarthOil/EBInnov 2018 comparative supplier study](https://discover.univarsolutions.com/assets/files/EMEA/earthoil-Sensory-profile-guide.pdf), page 2, provides useful relative **skin** observations. Its [2022 update](https://discover.univarsolutions.com/assets/files/bpc/earthoil-Sensory-Fatty-Acid-Profile.pdf) retains grade-sensitive comparisons but omits many explicit weight words. Treat these as one evidence family, not two independent replications. Panel size, dosing, blinding and variability are not disclosed in these brochures. Readable PDF text was inspected; requested screenshots were not delivered as image pixels by the current web wrapper, so no exact graph scores were reconstructed.

[IOI's technical comparison](https://www.ioioleo.de/wp-content/uploads/2022/09/IOI_Pharma_Injectables_2022.pdf) supports relatively fluid C8/C10 MCT, but explicitly describes intermediate spreading. This supports a bounded lower-weight inference rather than equating CCT with a volatile dry-touch ester. [Merck's castor specification](https://www.sigmaaldrich.com/TW/en/product/aldrich/18722) supports high viscosity. Neither proves a hair-sensory class, and the visible Merck viscosity field does not state temperature.

The [O&3 2026 playbook](https://www.oand3.com/wp-content/uploads/2025/12/O3-Beauty-Personal-Care-Trend-Report-2026.pdf), pages 19–22, supplies practical sensory descriptions for additional oils, but discloses no comparative method. It is weaker than the EarthOil study. General O&3 product pages contain repeated template language and some conflicting descriptions; they should not inflate confidence through apparent repetition.

The [2003 coconut/sunflower experiment](https://pubmed.ncbi.nlm.nih.gov/12715094/) measures protein loss. The [2005 coconut/olive/sunflower experiment](https://pubmed.ncbi.nlm.nih.gov/16258695/) measures adhesion and surface-film changes over time and with heat. These findings are hair-specific but do not rank perceived weight. Abstracts were accessed, not full protocols.

## Advisory estimates for integration

These choices are estimates from this review, not settled policy. Alternatives are uncertainty bounds, not errors. **Very low** means unsuitable for a confident ranking; it does not mean the central class is a scientifically neutral fallback.

| Intact material / exact carrier | Proposed default | Plausible alternative | Estimate support |
|---|---|---|---|
| Jojoba | light | medium | low |
| Grapeseed | light | medium | moderate, indirect |
| C8/C10 MCT, Caprylic/Capric Triglyceride | light | medium | moderate, indirect |
| Sweet almond | light | medium | moderate, indirect |
| Apricot kernel | medium | light | moderate, indirect |
| Safflower | light | medium | low |
| Castor | rich | medium | moderate, indirect |
| Whole coconut | rich | medium | moderate, indirect |
| Argan | light | medium | low |
| Olive | medium | rich | very low |
| Avocado | medium | rich | moderate, indirect |
| Sunflower | medium | light | very low |
| Macadamia integrifolia | medium | rich | moderate, indirect |
| Hemp seed | light | medium | low |
| Marula | medium | light or rich | low, conflicting |
| Baobab | medium | light | moderate, indirect |
| Camellia japonica seed | light | medium | low |
| Black seed, Nigella sativa fixed seed oil | light | medium | very low |
| Wheat germ | rich | medium or light | low, conflicting |
| Sea buckthorn fruit/pulp | rich | medium | low |
| Watermelon seed | light | medium | low |
| Moringa seed | medium | light | moderate, indirect |
| Babassu, Orbignya oleifera | light | medium or rich | low |
| Pomegranate seed | rich | medium | moderate, indirect |

The evidence and rationale for every row are in the JSON. Argan's lighter proposal follows a refined-grade skin claim, so medium remains credible for unspecified grades. Black seed's lighter proposal rests on descriptive material observations, not a measured comparative skin or hair panel. Olive and sunflower lack a recovered strong comparative weight study; their central estimates are explicitly weak formulation hypotheses. Main policy may conservatively leave those entries unresolved.

## Material conflicts and limits

- Apricot: prioritize the comparative EarthOil panel over the weaker playbook when choosing between intermediate and light.
- Avocado: crude and refined material can differ without changing the INCI. A single generic prior must retain a richer alternative.
- Marula: [Kupanda's refined-grade description](https://www.gfn-selco.de/1/Bilder/Aktuelles%20Galerie/24.%20Kupanda%20Ltd./Kupanda%20ltd.%20-%20african%20natural%20Oils%20-%2009.12.21.pdf), page 5, and O&3's richer positioning do not form a stable universal rank.
- Wheat germ: [O&3's unrefined-grade information](https://www.oand3.com/product/wheatgerm-oil-unrefined/?pdf=1) specifically cautions about weighing down fine hair, while other grade pages use lighter skin language. Retain the conflict instead of averaging away identity.
- The [2024 body-oil study](https://www.mdpi.com/2076-3417/14/7/2783) reports castor viscosity very different from Merck's specification. Do not pool these values into a numeric threshold. The paper's macadamia material is declared *ternifolia*, whereas EarthOil's is *integrifolia*.

Exact identities matter: whole coconut is not C8/C10 MCT, and CCT is not Triheptanoin. Camellia japonica, oleifera and sinensis are not automatic aliases. Macadamia species should remain separate declared identities. Sea buckthorn fruit/pulp is not seed oil. Do not propagate intact-oil classes into extracts, hydrogenated forms, PEG surfactants, esters, waxes, unsaponifiables or blends. [AAK's material guidance](https://aakpersonalcare.com/technology-performance-without-compromise/) also warns that processing and origin can change material chemistry under an unchanged INCI.

## Main implications

1. A usable reference can distinguish meaningful extremes while retaining uncertainty around neighboring classes. Do not make missing evidence synonymous with medium.
2. A botanical oil's default should never override exact material form, whole formula, dose or grade. Solid storage state does not by itself prove rich hair feel; nutrient richness and color are irrelevant weight signals.
3. The next contrast round can challenge these priors, but agreement with eight selected products would be a plausibility check, not sensory validation or a reason to fit thresholds to that cohort.

Rejected: linoleic→light / oleic→rich shortcuts; penetration→light; protein-loss protection→weight; marketing nutrient richness→sensory richness; viscosity-only numeric bins; treating commercial skin language as a hair trial.

## Verification

This pass read external source pages, public PDF text and primary-study abstracts/results as individually recorded in the ledger. Some publisher/source opens failed or required login; indexed content was labeled as such. No accounts, supplier contacts or document forms were submitted. JSON validation checks the 24-entry scope, source-key integrity, class vocabulary, alternatives and explicit unvalidated-hair flags. No repository implementation or production changes are part of this evidence slice.

