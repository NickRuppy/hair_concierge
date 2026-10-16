# Oil weight reference and whole-formula overlay v0.3

2026-10-02. Current for new **local research estimates** under OE14/OE16/OE17. This extends material coverage; the whole-formula method is unchanged from v0.2. Other direct properties retain v0.1. The earlier reference and sealed rounds remain historical replay inputs.

The approved product field remains `weight: light | medium | rich | unknown`. It estimates relative sensory/coating burden under comparable modest leave-on conditions. It does not measure density, viscosity, hair feel, repeated accumulation, eligibility or efficacy. `light` can include an intact nonvolatile oil without promising zero residue. Pre-wash use does not redefine material class or establish directions.

## Owning reference and coverage

Use [natural-oil-weight-v0.3.json](../../../../data/research/oil-inci/v1.0/reference/natural-oil-weight-v0.3.json): **64 exact material entries**, comprising **63 fixed botanical oils and one processed C8/C10 MCT emollient**. There are 103 reviewed canonical names/aliases and 89 source records, including identity and exclusion evidence. All 25 v0.2 entries are preserved. The reference supplies 56 rough substantive priors and eight explicit unknowns; none is validated as a hair-weight class.

The [coverage receipt](../../../../plans/oil-inci/research/natural-oil-coverage-completion-2026-10-02.md) accounts for all identified missing identities/variants in the finite local/captured-catalog evidence. Nine missing identities and five distinct variants were found: 13 are admitted as separate reference entries, while `COCOS NUCIFERA FRUIT OIL` remains an identity-review case. Four literal label displays require [source-scoped reconciliation receipts](../../../../plans/oil-inci/research/natural-oil-coverage-display-resolution-2026-10-02.json), rather than generic alias creation. This is an audited reference, not a claim that every natural oil or every catalog formula has been checked.

The audit read 568 research/capture JSON files with 535 raw-formula fields (including copies/calibration records), plus 94 stored fact-evidence rows for 85 products. Some stored source text is partial. Only 19 of 54 catalog oils exposed matching stored ingredient evidence; the 371-product catalog total is not formula coverage. Additional common-material entries are disclosed separately from observed omissions.

Evidence ledgers [A](../../../../plans/oil-inci/research/natural-oil-coverage-evidence-a-2026-10-02.json), [B](../../../../plans/oil-inci/research/natural-oil-coverage-evidence-b-2026-10-02.json) and [main](../../../../plans/oil-inci/research/natural-oil-coverage-evidence-main-2026-10-02.json) retain supplier observations and exclusions. The JSON reference owns main's final rough estimates. Corn Oil's weak light prior uses a documented same-grade declaration bridge without merging it into Germ Oil. Oat's weak light prior extrapolates from a specialty exact-INCI grade. Buriti uses a rich material-specific descriptor with light/unknown alternatives, rather than averaging conflicting classes into medium. Those main departures from advisory defaults are logged explicitly.

The strongest inherited comparative evidence is [EarthOil's skin-sensory study](https://discover.univarsolutions.com/assets/files/EMEA/earthoil-Sensory-profile-guide.pdf). New additions mostly rely on supplier material/skin descriptors, with occasional unmeasured hair-use claims. [Meadowfoam's conditioning study](https://meadowfoam.com/wp-content/uploads/MSO_assessment_hair_effect_LTR_ENG_03282022.pdf) does not measure heaviness. No supplier claim about a finished product determines its formula weight.

Skin sensory and physical specifications are proxies. Do not pool numerical viscosity reports across methods/temperatures or infer weight from density, fatty-acid ratios, penetration, nutrient-rich language or storage solidity. Grade/dose/conditions remain unresolved. New ordinary/high-oleic sunflower evidence supports the existing light alternative; the inherited medium/low prior remains visible. It does not establish the separate Hybrid Oil's class.

## Read a new formula

1. **Resolve identity.** Preserve complete raw INCI/ranks; match the exact canonical names or reviewed aliases. Only trim/collapse whitespace and case for lookup. Do not erase parentheses/form/plant-part terms, guess botanical synonyms or convert an extract/derivative into an oil. A source-backed label-display correction is a separate exact-product receipt. An unresolved decision-relevant material needs review.
2. **Record material priors.** For every admitted fixed oil/MCT, record rank, reference entry, prior, confidence and alternatives. This is ingredient evidence, not yet the product answer. MCT means exact `CAPRYLIC/CAPRIC TRIGLYCERIDE`; “fractionated coconut” or “MCT” alone cannot establish that identity. This processed emollient is not an intact plant oil for base inventory.
3. **Read carrier roles.** Use the v0.1 whole-formula ledger: principal, secondary, auxiliary or unresolved. Rank helps interpret the carrier backbone but is not concentration. No fixed first-two rule, count vote, percentage, 1% boundary or presumed trace tail.
4. **Single material plus auxiliaries.** If one identified oil/emollient is the entire carrier and everything else is a recognized auxiliary, use its admitted prior as the working product estimate, retaining its evidence ceiling, confidence and strongest alternative. Unknown grade alone need not force unknown. An unresolved ingredient that could change the backbone prevents this shortcut. This permits a pure castor estimate from the entire carrier; it does not create a rich floor for any castor-containing product.
5. **Blend or competing carrier.** Judge the principal oil mixture together with volatile/mobile emollients, residual films/gums/resins and structural lipids. Consistent principal priors can support a class. Opposing priors require an affirmative explanation of the overall carrier/film architecture; rank alone cannot establish majority or decide a balanced case. Do not average classes or assign medium because light and rich oils coexist. A secondary/auxiliary rich oil contributes a counter-signal without forcing rich. A light oil does not cancel a substantial film system.
6. **Challenge and return.** State why the best-supported class wins over both lighter and richer interpretations; retain any decisive uncertainty. `medium` requires positive intermediate evidence, never missing evidence. If interpretations remain balanced or decisive material identity/film behavior is missing, return `unknown` with a specific gap.

Every substantive weight remains `{value, estimate:true, confidence:moderate|low, evidence, counter_signal, nearest_alternative, reason, unresolved}`. Product confidence cannot exceed the decisive material/architecture evidence; two-lane agreement never upgrades it. New evidence or an exact verified grade can support a separately logged derivation. No hidden fit or efficacy conclusion follows.

## Boundaries to check

- A mobile carrier with a late rich botanical oil must still be judged from its full residual system; presence cannot decide the product.
- A substantial gum/resin system can dominate light botanical priors; volatile carrier does not erase the film.
- An all-oil blend with opposing priors does not reveal ratios and may remain unknown.
- A recognized modified oil uses its own exact material evidence; `PEG-40 HYDROGENATED CASTOR OIL` and `COCO-CAPRYLATE/CAPRATE` do not inherit castor/coconut priors.
- An unfamiliar fixed oil stays outside the reference until researched. `unknown` is available; “all plant oils medium” is not a fallback.
- Refined and crude avocado can share INCI but differ in sensory descriptions. Grade-specific evidence can alter an estimate; ordinary INCI cannot identify the grade.

## Run and integration contract

For new oil research: load the v0.1 standard for all other properties **and this overlay/reference for weight**; freeze exact versions with inputs. Add material-prior evidence to the weight rationale without changing the approved record vocabulary. Preserve blind-stage values on unblinding. Any old product reclassification creates a new derivation rather than modifying round 1.

Historical round 2 has eight exact cosmetic-material inputs and six hypothetical mixed-formula probes. Single-material agreement checks consistent reference application and identity handling; it is largely determined by the shared priors. Mixed-probe agreement measures interpretation repeatability on sketches. Neither establishes sensory truth, unseen holdout validity, general hair-product intake or user fit. Face/body carrier benchmarks do not become eligible hair products merely by appearing here.

Weight-only outputs must identify their limited scope; they are not complete oil profiles. Missing catalog formulas, unresolved exact-material evidence, measured hair comparison, full-formula calibration/holdout and the separate fit/projection contract remain later work. No runtime matcher/database/production behavior is activated by this reference.

## Working material estimates

Every substantive class is a provisional estimate. Exact matching, grade scope, evidence, exclusions and alternatives live in the JSON. An unknown entry is a covered identity with an unresolved weight, never a medium fallback.

| Material | Exact INCI | Prior | Confidence | Alternatives |
| --- | --- | --- | --- | --- |
| Jojoba | `SIMMONDSIA CHINENSIS SEED OIL` | `light` | low | medium |
| Grapeseed | `VITIS VINIFERA SEED OIL` | `light` | moderate | medium |
| C8/C10 MCT | `CAPRYLIC/CAPRIC TRIGLYCERIDE` | `light` | moderate | medium |
| Sweet almond | `PRUNUS AMYGDALUS DULCIS OIL` | `light` | moderate | medium |
| Apricot kernel | `PRUNUS ARMENIACA KERNEL OIL` | `medium` | moderate | light |
| Safflower | `CARTHAMUS TINCTORIUS SEED OIL` | `light` | low | medium |
| Castor | `RICINUS COMMUNIS SEED OIL` | `rich` | moderate | medium |
| Whole coconut | `COCOS NUCIFERA OIL` | `rich` | low | medium |
| Argan | `ARGANIA SPINOSA KERNEL OIL` | `light` | low | medium |
| Olive | `OLEA EUROPAEA FRUIT OIL` | `medium` | low | rich |
| Avocado | `PERSEA GRATISSIMA OIL` | `medium` | low | rich |
| Sunflower | `HELIANTHUS ANNUUS SEED OIL` | `medium` | low | light |
| Macadamia | `MACADAMIA INTEGRIFOLIA SEED OIL` | `medium` | moderate | rich |
| Hemp seed | `CANNABIS SATIVA SEED OIL` | `light` | low | medium |
| Marula | `SCLEROCARYA BIRREA SEED OIL` | `medium` | low | light, rich |
| Baobab | `ADANSONIA DIGITATA SEED OIL` | `medium` | moderate | light |
| Camellia | `CAMELLIA JAPONICA SEED OIL` | `light` | low | medium |
| Black seed / black cumin | `NIGELLA SATIVA SEED OIL` | `light` | low | medium |
| Wheat germ | `TRITICUM VULGARE GERM OIL` | `medium` | low | rich, light |
| Sea buckthorn fruit/pulp | `HIPPOPHAE RHAMNOIDES FRUIT OIL` | `rich` | low | medium |
| Watermelon seed | `CITRULLUS LANATUS SEED OIL` | `light` | low | medium |
| Moringa | `MORINGA OLEIFERA SEED OIL` | `medium` | moderate | light |
| Babassu | `ORBIGNYA OLEIFERA SEED OIL` | `light` | low | medium, rich |
| Pomegranate seed | `PUNICA GRANATUM SEED OIL` | `rich` | moderate | medium |
| Camellia oleifera seed oil | `CAMELLIA OLEIFERA SEED OIL` | `light` | low | medium |
| Corn germ | `ZEA MAYS GERM OIL` | `light` | low | unknown |
| Corn (Oil declaration) | `ZEA MAYS OIL` | `light` | low | unknown, medium |
| Soybean | `GLYCINE SOJA OIL` | `light` | low | unknown |
| Sesame | `SESAMUM INDICUM SEED OIL` | `medium` | low | light, unknown |
| Rice bran | `ORYZA SATIVA BRAN OIL` | `light` | low | unknown |
| Oat kernel | `AVENA SATIVA KERNEL OIL` | `light` | low | unknown, medium |
| Rapeseed (Campestris) | `BRASSICA CAMPESTRIS SEED OIL` | `light` | low | medium, unknown |
| Rapeseed (Napus) | `BRASSICA NAPUS SEED OIL` | `light` | low | unknown |
| Canola (declared INCI) | `CANOLA OIL` | `unknown` | low | light |
| Flax / linseed | `LINUM USITATISSIMUM SEED OIL` | `light` | low | unknown |
| Evening primrose | `OENOTHERA BIENNIS OIL` | `unknown` | low | medium, rich, light |
| Borage | `BORAGO OFFICINALIS SEED OIL` | `unknown` | low | rich, light |
| Camelina | `CAMELINA SATIVA SEED OIL` | `light` | low | unknown |
| Chia seed | `SALVIA HISPANICA SEED OIL` | `light` | low | unknown |
| Blackcurrant seed | `RIBES NIGRUM SEED OIL` | `unknown` | low | light |
| Sunflower Hybrid Oil | `HELIANTHUS ANNUUS HYBRID OIL` | `unknown` | low | light |
| Macadamia Ternifolia | `MACADAMIA TERNIFOLIA SEED OIL` | `light` | low | unknown |
| Macadamia Integrifolia/Tetraphylla | `MACADAMIA INTEGRIFOLIA/TETRAPHYLLA SEED OIL` | `unknown` | low | light |
| Cottonseed Hirsutum | `GOSSYPIUM HIRSUTUM SEED OIL` | `light` | low | unknown |
| Buriti fruit | `MAURITIA FLEXUOSA FRUIT OIL` | `rich` | low | light, unknown |
| Meadowfoam seed | `LIMNANTHES ALBA SEED OIL` | `light` | low | medium, unknown |
| Rosehip Canina fruit | `ROSA CANINA FRUIT OIL` | `light` | low | medium, unknown |
| Rosehip Rubiginosa seed | `ROSA RUBIGINOSA SEED OIL` | `light` | low | medium, unknown |
| Rosehip Moschata seed | `ROSA MOSCHATA SEED OIL` | `light` | low | medium, unknown |
| Passionfruit Edulis seed | `PASSIFLORA EDULIS SEED OIL` | `light` | low | medium, unknown |
| Prickly pear seed | `OPUNTIA FICUS INDICA SEED OIL` | `light` | low | medium, unknown |
| Tamanu Inophyllum | `CALOPHYLLUM INOPHYLLUM SEED OIL` | `rich` | low | medium, unknown |
| Brazil nut | `BERTHOLLETIA EXCELSA SEED OIL` | `light` | low | medium, unknown |
| Kukui Moluccanus | `ALEURITES MOLUCCANUS SEED OIL` | `light` | low | medium, unknown |
| Sacha inchi | `PLUKENETIA VOLUBILIS SEED OIL` | `light` | low | medium, unknown |
| Plum seed | `PRUNUS DOMESTICA SEED OIL` | `light` | low | medium, unknown |
| Raspberry seed | `RUBUS IDAEUS SEED OIL` | `light` | low | medium, unknown |
| Coffee Arabica seed | `COFFEA ARABICA SEED OIL` | `medium` | low | light, unknown |
| Cranberry seed | `VACCINIUM MACROCARPON SEED OIL` | `light` | low | medium, unknown |
| Camellia Sinensis seed | `CAMELLIA SINENSIS SEED OIL` | `light` | low | medium, unknown |
| Broccoli seed | `BRASSICA OLERACEA ITALICA SEED OIL` | `light` | low | medium, unknown |
| Peanut | `ARACHIS HYPOGAEA OIL` | `light` | low | medium, unknown |
| Sea buckthorn combined fruit/seed | `HIPPOPHAE RHAMNOIDES FRUIT/SEED OIL` | `unknown` | low | light, medium, rich |
| Sea buckthorn seed | `HIPPOPHAE RHAMNOIDES SEED OIL` | `unknown` | low | light, medium, rich |
