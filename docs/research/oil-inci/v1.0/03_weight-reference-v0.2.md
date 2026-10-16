# Oil weight reference and whole-formula overlay v0.2

Historical revision: for new local estimates use [v0.3](03_weight-reference-v0.3.md). The sealed round-2 method/reference copies remain unchanged.

2026-10-02. Operative for new **local research estimates** under OE14/OE16. Supersedes only the weight guidance in v0.1 for new derivations; other v0.1 properties retain their rules. Round-1 frozen method/results remain authoritative for historical replay. This is the second weight-method revision and the first natural-material reference.

The approved product field remains `weight: light | medium | rich | unknown`. It estimates relative sensory/coating burden from a formula under comparable modest leave-on conditions. It does not measure bottle density, viscosity, hair feel, repeated accumulation, thickness eligibility or treatment efficacy. `light` can include an intact nonvolatile oil and does not promise a weightless or residue-free finish. Pre-wash dose/time does not redefine the material class or establish directions.

## Owning reference and evidence

Use [natural-oil-weight-v0.2.json](../../../../data/research/oil-inci/v1.0/reference/natural-oil-weight-v0.2.json). It owns exact identities, aliases, working priors, alternatives, confidence, source IDs and form exclusions for 25 materials. It covers every intact fixed-oil identity in the first-round dictionary plus the pictured/new common materials; it is not exhaustive.

The [external evidence note](../../../../plans/oil-inci/research/natural-oil-weight-evidence-2026-10-02.md) and source ledger distinguish observations from proposed policy. Main's operative choices are in the reference. They include separate **Camellia japonica / oleifera** entries and a grade-unspecified medium wheat-germ estimate with rich/light alternatives; these choices must not be silently replaced by the advisory ledger's defaults.

The strongest comparative source is [EarthOil/EBInnov's supplier skin-sensory study](https://discover.univarsolutions.com/assets/files/EMEA/earthoil-Sensory-profile-guide.pdf): it supports lighter almond/grapeseed and intermediate apricot/baobab/macadamia/moringa interpretations. Commercial grades can differ. [O&3's playbook](https://www.oand3.com/wp-content/uploads/2025/12/O3-Beauty-Personal-Care-Trend-Report-2026.pdf) offers weaker descriptive guidance and sometimes conflicting labels. [Inolex's CCT grade](https://www.inolex.com/products/lexol-mb-gt-865) has affirmative lightweight/low-viscosity descriptors. None supplies a validated general hair-weight scale.

Skin descriptors and physical specifications are **proxies**, not hair performance. Numerical viscosity reports differ in sample, temperature and method; do not pool them into thresholds. Penetration experiments measure a different endpoint. Oil density, linoleic/oleic ratio, “natural,” nourishing language and solid storage state cannot independently decide weight. Temperature sensitivity and refining remain explicit uncertainties. Supplier statements about a generic exact ingredient may inform a prior; a finished-product “weightless” claim may not set its formula weight.

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

Round 2 has eight exact cosmetic-material inputs and six hypothetical mixed-formula probes. Single-material agreement checks consistent reference application and identity handling; it is largely determined by the shared priors. Mixed-probe agreement measures interpretation repeatability on sketches. Neither establishes sensory truth, unseen holdout validity, general hair-product intake or user fit. Face/body carrier benchmarks do not become eligible hair products merely by appearing here.

Weight-only outputs must identify their limited scope; they are not complete oil profiles. Broader ingredient coverage, measured hair comparison, full-formula calibration/holdout and the separate fit/projection contract remain later work. No runtime matcher/database/production behavior is activated by this reference.

## Working material estimates

Every row is provisional and unvalidated on hair. Exact matching, full evidence and exclusions remain in the JSON reference.

| Material | Working prior | Robustness | Alternatives |
| --- | --- | --- | --- |
| Jojoba | `light` | low | medium |
| Grapeseed | `light` | moderate | medium |
| C8/C10 MCT | `light` | moderate | medium |
| Sweet almond | `light` | moderate | medium |
| Apricot kernel | `medium` | moderate | light |
| Safflower | `light` | low | medium |
| Castor | `rich` | moderate | medium |
| Whole coconut | `rich` | low | medium |
| Argan | `light` | low | medium |
| Olive | `medium` | low | rich |
| Avocado | `medium` | low | rich |
| Sunflower | `medium` | low | light |
| Macadamia | `medium` | moderate | rich |
| Hemp seed | `light` | low | medium |
| Marula | `medium` | low | light, rich |
| Baobab | `medium` | moderate | light |
| Camellia | `light` | low | medium |
| Black seed / black cumin | `light` | low | medium |
| Wheat germ | `medium` | low | rich, light |
| Sea buckthorn fruit/pulp | `rich` | low | medium |
| Watermelon seed | `light` | low | medium |
| Moringa | `medium` | moderate | light |
| Babassu | `light` | low | medium, rich |
| Pomegranate seed | `rich` | moderate | medium |
| Camellia oleifera seed oil | `light` | low | medium |
