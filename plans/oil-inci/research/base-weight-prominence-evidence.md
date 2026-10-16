# Oil INCI: base, formula weight and named-oil prominence

Research date: **2026-10-01**. Status: **evidence and proposed mechanics; not a signed classification standard**. Scope: the approved direct properties in [`01_property-set-v0.md`](../../../docs/research/oil-inci/v1.0/01_property-set-v0.md). No selected-product classification, fit mapping, production change or calibration performed.

## Recommendation

Use an ordered, auditable formulation judgment with exact ingredient matches, competing interpretations and an explicit abstention path. Base describes the carrier architecture; weight describes expected load after application. Neither family counts nor position numbers establish mass fractions. **Do not currently emit `trace` from rank alone.** The approved rank/context meaning needs an operational wording decision before that value can be distinguished reproducibly from `supporting`.

Evidence supports ingredient-family distinctions and counterexamples to simplistic rules. It does **not** validate numerical INCI-only cutoffs for light/medium/rich or materially mixed backbones. The proposed anchors below are engineering/research conventions, to be tested with independent blinded lanes; they are not established scientific thresholds.

## Evidence boundary

1. **Label order has limited quantitative meaning.** Article 19(1)(g) orders ingredients by weight when added, but permits ingredients below 1% to appear in any order after those above 1%. The rule also exempts non-hair-colouring colorants from ordinary order. The ingredient list does not mark where the sub-1% region starts. Therefore neither a late position nor placement after fragrance proves trace quantity. Impurities are excluded from the Article's ingredient definition. [S1]
2. **Silicone identity and grade matter.** Dow distinguishes volatile cyclic silicones, silicone fluids of different viscosities, gums, resins and emulsifiers. In one table, a 2 cSt dimethicone carrier is described as volatile and a 5 cSt carrier as nonvolatile. The shared name `Dimethicone` therefore cannot identify the grade, viscosity or volatility in a finished product. [S2, S3]
3. **Fast spreading does not establish evaporation.** BASF describes `Coco-Caprylate` and `Dicaprylyl Carbonate` as fast-spreading emollients; its `Undecane (and) Tridecane` blend is explicitly volatile. Treat those as different evidentiary claims. A silicone alternative need not share silicone volatility. [S4, S5, S6]
4. **Water first is compatible with substantial oil/structurant content.** BASF publishes a hair-butter formulation containing 61.35% water together with 6% shea butter, 8.5% vegetable oil, 4% hydrogenated vegetable oil and other emollients/structurants. This is a direct formulation counterexample to water implying light weight, not a reference label for a marketed candidate. [S7]
5. **Whole-formula interactions matter; hair extrapolation is limited.** A primary 2026 study evaluated 32 skin creams with 50 participants, varying emollient mixtures, their load and emulsifier level. It found differences in appearance and afterfeel; a material's relative sensory role depended on its companions. Inter-rater agreement was only fair to moderate. This supports considering combinations and uncertainty, but it does not validate our hair-weight classes. [S8]
6. **Botanical identity is distinct from chemical family.** Jojoba seed oil is predominantly liquid wax esters, yet is an intact botanical oil ingredient. Plant-derived squalane is a processed hydrocarbon, not intact olive/sunflower oil. Proposed family precedence must preserve that distinction; botanical feedstock is not the advertised oil itself. [S9, S10]

## Inherited requirements versus proposals

**Inherited from the approved repository contract:** one base value; whole-INCI weight; per-advertised-oil assessment only after unblinding; empty named-oil list only after reviewed positioning finds no hero; exact market/formula identity; explicit unknown with reason; high/moderate/low confidence; frozen INCI and evidence/version provenance. Marketing lightness cannot set weight. Missing identity or incomplete INCI blocks the record rather than proving absence.

**Proposed here:** the family-role annotation, ordered judgments, conservative anchor descriptions, competing-label check, abstention conditions, and withholding rank-only `trace`. These need integration into the later standard. They do not add consumer properties.

## 1. Ingredient evidence ledger before classification

Preserve each original declaration and its one-based rank. Normalize spelling and botanical synonyms through a versioned, exact-match lexicon; do not stem away `Extract`, `Hydrogenated`, `PEG-`, `Esters` or plant-part identifiers. Ingredient roles can overlap; retain the overlap rather than forcing a misleading single role. Annotate every ingredient that could change the base or weight decision.

| Evidence family / role | Seed examples | Interpretation and exclusions |
| --- | --- | --- |
| Intact botanical fixed oil | `Argania Spinosa Kernel Oil`, `Helianthus Annuus Seed Oil`, `Ricinus Communis Seed Oil`, `Simmondsia Chinensis Seed Oil` | Candidate plant carrier/emollient. Jojoba stays here by botanical-identity precedence despite wax-ester chemistry. Plant species, part and form require exact matching. Presence alone does not set weight. |
| Silicone carrier | `Cyclopentasiloxane`, `Cyclohexasiloxane`, `Dimethicone`, `Phenyl Trimethicone` | Resolve volatility/viscosity only as far as exact species/grade evidence supports. Do not promote a silicone emulsifier to bulk carrier merely because it contains “dimethicone”. [S2, S3] |
| Silicone deposition/structure signal | `Dimethiconol`, `Trimethylsiloxysilicate`, silicone crosspolymers; amino-functional silicones when matched | Potential residual film/structure counter-signal, dependent on formulation. No automatic rich floor, and no concentration inferred from rank. [S3] |
| Defined ester/carbonate emollient | `Coco-Caprylate`, `Dicaprylyl Carbonate`; other esters only after source-backed inclusion | Fast-spreading examples do not license all esters as light or volatile. Intact botanical oils take the botanical row first. [S4, S5] |
| Alkane/hydrocarbon emollient | `Undecane`, `Tridecane`, `Squalane`; broad mixtures such as `C13-15 Alkane` require their own evidence | `Undecane`/`Tridecane` supplier evidence supports volatility. Squalane is a separate identity; do not copy properties from “hemisqualane” or infer plant oil from feedstock. Do not assume all suppliers' broad-chain mixtures share one measured grade. [S6, S10] |
| Aqueous vehicle / humectant | `Aqua`; `Glycerin` is a humectant, not water | A water vehicle can coexist with meaningful lipid and conditioning structure. Water-containing does not necessarily mean water-led, and neither establishes emulsion continuity. [S7, S8] |
| Structural lipid / wax | fatty alcohols, butters, hydrogenated oils and waxes, subject to exact identity | Relevant to structure/residual load. Do not classify fatty alcohols as volatile alcohol solvents. A late single wax does not force rich. [S7] |
| Auxiliary or context-dependent | fragrance, antioxidants, preservation, chelation, pH adjustment, emulsification | Role annotation is not a claim that the ingredient is below 1%. Fragrance and tocopherol are not universal concentration-boundary markers. |
| Unmapped / outside current base vocabulary | carrier ethers such as `Dicaprylyl Ether`, unusual solvent-led or mineral-oil-led systems | Preserve the identity. Do not silently rename an ether an ester or stretch `hybrid` to cover a single unsupported family. Escalate a mapping decision if encountered; otherwise base `unknown`. |

This is a seed ledger, not a complete production matcher. Entries without an ingredient-specific technical citation require source completion before acting as weight anchors. For modified triglycerides and mineral-oil mixtures, later lexicon work must state the intended family explicitly rather than relying on their marketing origin.

## 2. Base: ordered subjudgments and precedence

**B0 — Completeness.** Is the frozen list complete, ordered and tied to the exact identity? If not, block completion. An unfamiliar potentially leading carrier gives `unknown`, with the identity requiring research.

**B1 — Inventory architecture.** Identify all plausible vehicles/carriers, then secondary emollients/film-formers, then auxiliaries. Describe their actual rank sequence. Do not truncate at top five, discard everything after fragrance, count ingredients as mass shares, or treat a later listed raw-material blend as an intact contiguous phase.

**B2 — Aqueous precedence.** Assign `water_based` when water is the leading declared vehicle and the remaining system is credibly an aqueous/emulsified product. “Water first” is a strong ordinal anchor, not proof of >50% water or oil-in-water continuity. If a biphasic/multiple-vehicle architecture leaves water leadership unresolved, record that alternative and abstain. Water appearing only later in a silicone ingredient delivery system is insufficient.

**B3 — Plant-only carrier architecture.** With no competing carrier family, one intact botanical oil supports `pure_plant_oil`; two or more support `plant_oil_blend`. Proposed convention: stabilizing auxiliaries can coexist with a pure-plant-*base* classification; the name never asserts analytical purity. Added fragrance or a functional non-plant emollient requires explicit reconsideration, not automatic admission. If “pure” must mean literally a one-ingredient formula, Nick must settle that narrower meaning before these cases are labelled.

**B4 — Led versus mixed architecture.** For other nonaqueous formulas, consider `silicone_led` and `ester_alkane_led` before `hybrid`. The respective family must explain the vehicle/backbone and the other ingredients must be credibly secondary. Several consecutive early ingredients from that family strengthen the interpretation; one first ingredient by itself does not prove it outweighs every other family combined. Record which competing ingredients could overturn leadership.

**B5 — Positive mixed-backbone finding.** `hybrid` requires affirmative evidence that at least two carrier families jointly define the architecture and that either led label would omit a substantive part of it. Early co-carriers and interleaving support this judgment; their mere coexistence does not establish materiality. A declared exact-formula composition, if available as technical evidence, can resolve ambiguity but is not mandatory for every moderate-confidence judgment. Do not emit hybrid as a synonym for “I cannot tell which leads”; that state is `unknown`.

**B6 — Challenge the nearest rival.** Record one sentence each for the chosen label, the strongest competing label and why the latter loses. If the same observed list equally supports both, output `unknown` rather than inventing a mass threshold. No weight conclusion follows from base.

These rules deliberately leave some mixed formulas unclassified from public INCI alone. Eliminating that abstention by fixed rank/count cutoffs would be a discretionary approximation, requiring validation and approval rather than scientific justification.

## 3. Weight: ordered subjudgments and anchors

Freeze base before judging weight, but use the underlying full ledger rather than a base-to-weight lookup. Interpret weight as the expected residual/sensory load at comparable application, not bottle viscosity, eventual accumulation, user-specific dose or proven hair performance.

1. **Carrier phase:** identify supported volatile carriers, fast-spreading but not established-volatile emollients, and unknown-grade carriers. State the uncertainty for `Dimethicone` without grade. Fast slip is not evidence of negligible residue.
2. **Remaining film:** identify nonvolatile oils/emollients, gums/resins, structural lipids and conditioning components plausibly remaining after the carriers evaporate. Consider where they sit in the overall architecture, not just whether they occur.
3. **Matrix:** assess combinations and likely structure. A water-rich emulsion with substantial fatty alcohol/butter/conditioning components can yield more load than a simple fluid. Conversely, a very small structurant addition need not change the class.
4. **Counter-signals:** explicitly test a lighter and richer explanation. List the decisive grade, loading or phase uncertainty; never suppress it with an average score.
5. **Choose only a supported anchor:** `light` = coherent low-load vehicle/finish architecture with weak competing residual/structural signals; `medium` = affirmative intermediate, mobile-emollient/residual-film architecture without strong support for either extreme; `rich` = coherent substantial nonvolatile/structured-film architecture whose richer interpretation survives lighter-carrier counter-signals. None is triggered by a lone ingredient. `medium` is not the default when confused.
6. **Abstain:** output `unknown` when unknown carrier grade, unresolved balance of volatile vehicle versus residual film, or an unfamiliar matrix could plausibly move the judgment to a different class. Record what would distinguish the alternatives.

No primary hair study found in this focused pass validates these three label boundaries. Prefer `moderate` at most for untested finished-formula weight inferred from ingredient architecture; simple robust cases may justify greater confidence only with an explicit reason. Raw-material viscosity and skin-panel observations are supporting evidence, not finished-hair validation.

## 4. Named-oil prominence after unblinding

First freeze the blind base/weight ledger. Then record each exact advertised oil identity and the source wording. A botanical extract, fragrance oil, hydrolysed derivative, ester derived from the plant or its feedstock does not automatically match an advertised fixed oil. If the advertised claim itself refers to that different form, assess that exact form explicitly; ambiguity yields `unknown`.

| Value | Proposed emission rule |
| --- | --- |
| `absent` | Exact advertised identity is established, complete formula has been reviewed, and no accepted identity/alias matches. Record no matched rank. An ambiguous claim or formula is not absence. |
| `leading` | The exact oil is affirmatively part of the frozen principal carrier/backbone assessment. Record its rank, role and the backbone rationale. This does not mean a majority percentage or “largest plant oil” alone. |
| `supporting` | The oil is present and affirmatively assigned a secondary emollient role in the frozen architecture, with a documented basis for excluding a leading role. Presence alone is insufficient. |
| `trace` | **Do not emit from INCI rank in the current proposal.** No defensible universal rank, fragrance/preservative boundary or fixed percentage proxy was established. Keep the approved enum but leave this operational anchor pending. |
| `unknown` | Oil is present, but leading/supporting/trace cannot be resolved from admissible evidence; or exact advertised identity is unresolved. Preserve matched rank and the competing interpretations when identity is known. |

**Required Nick decision:** retain `trace` as a nonquantitative “listed but no established structural role” category with explicit explanation, or require real quantitative evidence before using that word. Recommendation: preserve the already approved rank/context intention, but change the human wording to **“im hinteren INCI-Kontext; Menge nicht ableitbar”** only when an independently reviewable contextual anchor has been agreed. Do not show **“nur in Spuren”** from rank evidence. Until the contextual anchor exists, emit `unknown` for supporting-versus-trace ambiguity. This does not invent a new property or silently delete the approved value.

Using `trace` merely for all non-backbone oils would be reproducible but collapse plausible supporting emollients into an unjustified category. Using rank >5, rank >10, last third of list, or position after parfum is rejected. All are discretionary heuristics; none establishes trace concentration, and no validation has been done here.

With reviewed positioning and no advertised oil, output `named_oils: []`. An unreviewed page is not no-hero evidence. A hero claim must not alter the previously frozen base/weight labels.

## 5. Hypothetical boundary checks for the later standard

These are logic probes, not calibrated product labels.

| Hypothetical evidence | Expected boundary behavior |
| --- | --- |
| One declared ingredient, an identified intact botanical oil | Plant-only base is clear; do not infer its weight merely from that base. |
| One plant carrier plus tocopherol | Tests the stabilizer-versus-literal-purity convention; record the convention rather than claiming 100% chemical purity. |
| `Dimethicone` leads and its grade is unknown | Silicone family can be clear while weight remains unknown. A grade-specific supplier example is not proof of this product's grade. |
| Volatile silicone followed by an appreciable-looking gum/oil system | Review residual load; do not automatically emit light because the first carrier evaporates. “Appreciable-looking” must be explained by architecture, not converted to %. |
| Silicone and ester carriers interleave before secondary ingredients | Consider hybrid, then challenge a led explanation; unresolved materiality gives unknown. |
| Water-led formula with fatty alcohols/butters/conditioning matrix | Water-based may be clear; light is not established. |
| Advertised oil is the last ingredient after fragrance allergens | Identity may be present, but no concentration/trace conclusion follows. Unknown if the contextual role cannot be established. |
| Advertised olive oil; only plant-derived `Squalane` is declared | Squalane is not automatically an olive-oil identity match. Assess exact claim wording; an unambiguous olive-oil claim can be absent. |
| A lone leading ether carrier | Do not force ester/alkane or hybrid; unknown until an explicit vocabulary-mapping decision. |

## 6. Minimal reproducibility and next work

For each output retain: frozen source/INCI identity, lexicon revision, ingredient rank-role ledger, positive evidence, counter-signals, nearest rival, chosen value, confidence, missing evidence and reviewer. Confidence describes robustness of the assigned class, not efficacy or estimated concentration. A high-confidence recognition of a missing grade does not create high-confidence weight.

Before exploratory product labels: resolve the `trace` operational meaning; settle one-oil-plus-auxiliaries purity wording if relevant; complete source-backed lexicon entries actually encountered. Let two independent blind passes use the same frozen ledger specification and report exact agreement/disagreement, including abstentions. Review discordant boundaries instead of changing rules to force coverage. The first exploratory cohort cannot establish accuracy or become an unseen holdout. No runnable code tests were appropriate to this document-only evidence pass; the table above specifies later acceptance probes.

## Sources and reliability

All sources below were read **2026-10-01**. Short evidence descriptions are paraphrases unless quotation marks are used. Supplier documents establish their own ingredient/formulation examples; commercial sensory claims are not independent finished-product efficacy evidence.

- **S1 — European Commission, Regulation (EC) 1223/2009, Article 19(1)(g), PDF p.15 / OJ L342/73.** [Official full text](https://health.ec.europa.eu/system/files/2016-11/cosmetic_1223_2009_regulation_en_0.pdf). Primary legal text; high reliability for the stated order/exemption wording. Read the published text hosted by the Commission; this pass did not audit all later amendments. EUR-Lex retrieval failed for the attempted consolidated page, so do not describe this as a consolidated-version legal review.
- **S2 — Dow, Personal Care Selection Guide, PDF p.2.** [Supplier technical table](https://www.dow.com/documents/27/27-1/27-1369-01-dow-home-personal-care.pdf?iframe=true). ES-5226/5227 rows explicitly contrast 2 cSt volatile and 5 cSt nonvolatile dimethicone carriers. Strong grade-specific counterexample; no identification of a finished formula's grade.
- **S3 — Dow, Hair and Skin Care Selection Guide.** [Supplier technical guide](https://www.dow.com/documents/27/27-1/27-1304-01-dow-hair-and-skin-care.pdf?iframe=true). Tables distinguish cyclics, low/high viscosity fluids, gums, resins and emulsifiers. Useful family/grade evidence; application benefit dots are commercial claims.
- **S4 — BASF, Cetiol C5 Technical Information, rev.5, 2018-05-17.** [Technical PDF](https://promo.basf.com/campaign/Projetos/CaringForYou/Documentos/Geral/Cetiol%C2%AE%20C%205.pdf). Identifies Coco-Caprylate and fast spreading; not a finished-hair weight study.
- **S5 — BASF, Cetiol CC Technical Information, rev.9.3, 2015-06-19.** [Technical PDF](https://promo.basf.com/campaign/Projetos/CaringForYou/Documentos/Cuidados%20de%20la%20Piel/Cetiol%C2%AE%20CC.pdf). Identifies Dicaprylyl Carbonate and describes dry spreading. Technical supplier evidence; dry skin feel does not prove evaporation or hair lightness.
- **S6 — BASF, Cetiol Ultimate.** [Exact ingredient page](https://care360.basf.com/global/en/Product-Finder/30597825). Undecane/Tridecane blend explicitly described as volatile. Supplier primary evidence for this blend; no basis for generalizing to all alkanes.
- **S7 — BASF, Exclusively HerCare, formulation HB-US-20-35887-70, PDF p.13.** [Hair-formulation PDF](https://care360.basf.com/dam/jcr%3Aa761da40-29b7-45dd-8fed-ce5b1c3c3f61/care360/www/northamerica/personal-care/downloads/BASF-ExclusivelyHerCare-booklet-final-web.pdf). Primary illustrative formulation with declared amounts. Strong counterexample to water=low oil load; no blinded weight validation.
- **S8 — Gerken et al., 2026, Sensory contribution of emollient cascades in skin creams evaluated by CATA analysis.** [Primary full-text paper](https://onlinelibrary.wiley.com/doi/10.1111/ics.70123). Published 2026-08-05; controlled formulation experiment, consumer panel, industry participation/material donations. Skin study with limited inter-rater agreement, not direct hair-oil classification evidence.
- **S9 — Hallstar, Biochemica Jojoba Oil entries.** [Manufacturer ingredient directory](https://www.hallstarbeauty.com/products/). Direct supplier descriptions identify intact jojoba oil as liquid wax esters. Used only for identity/chemistry, not efficacy claims.
- **S10 — Sophim, Squalane.** [Manufacturer technical explanation](https://www.sophim.com/en/squalane/). Describes squalane as hydrogenated squalene and a saturated hydrocarbon. Used only for identity distinction from intact feedstock oil; skin-benefit marketing is not adopted.
