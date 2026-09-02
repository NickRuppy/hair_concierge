# Shampoo weight potential final method

Policy: `shampoo-weight-final-v1`. Status: normative research method for final Shampoo `weightPotential` conclusions. It is research-only and does not authorize Lab approval mutation, catalog projection, Supabase writes, recommendation changes, production activation or user-facing claims.

This method supersedes [`shampoo-weight-v1`](./weight-potential-calibration.md) for future final weight conclusions. `shampoo-weight-v1` remains reproducible as the earlier calibration policy, but its route-count thresholds are not authoritative for final labels. The base scientific framing remains the v1.3 weight/deposition guidance in sections 4.4 and 5.2 of the [classification standard](../v1.3/02_Classification_Standard_Agent_Context_v1.3.md).

## What the property means

`weightPotential` is the formula-derived potential for a shampoo to leave noticeable or cumulative residue that can reduce movement, strand separation or root lift after rinsing. It is a trade-off dimension, not a quality score.

The existing canonical formula is the input. Do not refresh, blend or replace an already approved formula unless the current run has an explicit identity blocker. Claims, product names and positioning are reviewed only after the blind formula judgment.

## Evidence boundary

Supported by external formulation evidence already cited by this workstream:

- Cationic polymers and silicone systems can support conditioning/deposition, and deposition depends on polymer chemistry, silicone system, surfactant composition, dilution behavior and hair substrate. See Jordan et al. 2009, Lepilleur et al. 2011 and Kwak et al. 2021 as cited in the finalization plan.
- INCI order supports formula architecture and rough prominence, but it does not reveal exact concentrations, particle size, charge density, pH, active content, finished-product deposition or consumer-perceived heaviness.

Internal methodology choices:

- The low/moderate/high anchors below are Hair Concierge research anchors.
- `depositionLoad`, `persistence` and `resetCapacity` are structured expert judgments from the complete formula.
- Ingredient recognition, route extraction and INCI positions are evidence-gathering steps only. No recognized ingredient, route count, marketing claim or INCI position can assign the final band by itself.

### Reviewed ingredient-role resolutions

The final evidence lexicon applies these reviewed functional roles consistently in future runs:

- `Quaternium-80` is a cationic hair-conditioning signal. Its presence is recorded as a conditioning route, while its position, the surrounding formula and reset capacity still determine whether that route is materially weight-relevant.
- `Starch Hydroxypropyltrimonium Chloride` is a cationic hair-conditioning polymer. Recognition removes an avoidable evidence gap; it does not automatically assign `moderate` or `high`.
- `Juniperus Virginiana Oil` is treated as an essential fragrance oil rather than a nonvolatile lipid payload. It remains visible in excluded evidence and does not increase deposition load without separate formula-specific evidence.

Sources: the European Commission cosmetic ingredient inventory identifies `Quaternium-80` as antistatic/hair conditioning; the Cosmetic Ingredient Review final polysaccharide-gum assessment identifies `Starch Hydroxypropyltrimonium Chloride` as a cationic polysaccharide and hair-conditioning agent; EU fragrance-allergen regulation treats `Juniperus Virginiana Oil` as a separately declared fragrance material in rinse-off products.

## Required sequence

1. **Blind formula packet first.** Give the researcher only the normalized INCI, formula fingerprint, source/completeness facts, formula architecture and this method. Hide approved labels, claims, brand, product name, previous evaluator output and other lane judgments.
2. **Extract objective observations.** Record conditioning polymers, silicones, oils/butters, fatty alcohols, refatters, proteins, film formers, unresolved weight-relevant ingredients, surfactant/reset clues and exact INCI positions.
3. **Make the three subjudgments.** Assess deposition load, persistence/accumulation and reset capacity from the whole formula.
4. **Assign the final band.** Choose `low`, `moderate` or `high` only after recording support, counterevidence and why the neighboring band is less likely.
5. **Unblind claims last.** Claims may corroborate intended use or expose a conflict, but they cannot decide the formula band.
6. **Compare after freeze.** Approved-versus-candidate comparison belongs after all blind judgments are hash-frozen.

## Three subjudgments

| Subjudgment | Values | Question | Evidence to consider |
| --- | --- | --- | --- |
| `depositionLoad` | `light`, `moderate`, `high` | How much hair-substantive conditioning material is plausibly delivered? | Cationic polymers, silicone/amino-silicone systems, lipid/fatty-alcohol/refatter architecture, protein or film-forming systems, formula prominence and reinforcing combinations. |
| `persistence` | `low`, `moderate`, `high` | How likely is the residue to remain through ordinary rinsing/repeated use or accumulate? | Persistent silicone/polymer/lipid systems, multiple depositing technologies, wash frequency implications, ordinary rinse-off limitations and whether routes look light or weakly retained. |
| `resetCapacity` | `weak`, `moderate`, `strong` | How strongly does the same shampoo architecture remove residue or offset weight? | Surfactant system breadth/strength, clarifying or chelating architecture, low-deposition architecture, intended reset use and counter-signals from refatting/deposition. |

Strong cleansing can raise reset capacity, but it never automatically cancels deposition. Rich conditioning can raise deposition/persistence, but it never automatically makes the product high if reset and formula context argue otherwise.

## Final band anchors

| Label | Whole-formula conclusion |
| --- | --- |
| `low` | Deposition is absent, light or low-persistence, and the complete architecture does not support a noticeable reduction in movement or root lift after rinsing. A single light conditioning polymer, weak refatter, late protein or late oil can still be `low` when counterevidence and reset capacity support that interpretation. |
| `moderate` | The formula plausibly leaves noticeable but bounded conditioning residue. This can come from one meaningfully persistent system or interacting light/moderate routes, while rinse/reset capacity, limited richness or ordinary rinse-off context argues against a strongly coating result. |
| `high` | Multiple converging and plausibly persistent depositing systems, or a clearly rich conditioning architecture with limited reset, make noticeable loss of movement/root lift likely. One ingredient or one route kind alone is insufficient. |

If the formula is absent, materially conflicted or contains an unresolved weight-relevant ingredient that could plausibly move the band, return `null` or a low-confidence provisional result with the exact blocker. Do not default unknowns to `low`.

## Mandatory reasoning fields

Every candidate record must include:

- canonical product/formula identifiers, source tier, capture date and formula fingerprint;
- extracted evidence with exact normalized INCI positions;
- `depositionLoad`, `persistence` and `resetCapacity`, each with a concise rationale;
- formula counterevidence and unresolved facts;
- proposed `weightPotential`;
- `whyThisBand`;
- `whyNotNeighborBand`;
- `classificationConfidence`;
- post-freeze comparison with the approved value, kept outside the blind judgment.

`whyNotNeighborBand` should name the real boundary. Examples:

- `low` rather than `moderate`: the only depositing clue is light/late/weak and reset capacity or sparse architecture makes noticeable residue unlikely.
- `moderate` rather than `low`: at least one depositing system is plausible enough that calling it lightweight would understate the residue risk.
- `moderate` rather than `high`: deposition is plausible, but richness, persistence or limited-reset evidence is not strong enough for a heavy/coating conclusion.
- `high` rather than `moderate`: multiple persistent systems or a rich architecture converge, and reset capacity does not sufficiently offset them.

## Confidence

Confidence describes robustness of the classification under INCI-only uncertainty. It is not measured accuracy.

| Confidence | Use when |
| --- | --- |
| `high` | Formula identity is exact and complete, recognition gaps are immaterial, subjudgments converge and reasonable unknown formulation details would not plausibly move the band. |
| `moderate` | One band is best supported, but realistic unknowns could move it one adjacent band. This is the normal ceiling for many INCI-only calls. |
| `low` | Material source conflict, recognition gaps, incomplete formula, closely balanced neighboring bands or missing context prevent a dependable band. |

Do not attach percentages. Two agreeing researchers improve repeatability evidence but do not prove finished-product accuracy.

## Direct property versus derived fit

`weightPotential` is a direct product property. It can inform later user-fit conclusions such as suitability for fine, low-density, oily-root or buildup-prone profiles, but those fit statements are derived outputs and must remain separate.

When this method changes `weightPotential`, update only fields or reports that are demonstrably derived from that property. Do not reopen cleansing strength, conditioning level, focus, usage role, scalp comfort or dandruff support unless the changed weight interpretation exposes a direct dependency that must be made consistent.

## Supersession and historical reproducibility

- Use `shampoo-weight-final-v1` for the final full-cohort rerun and later final weight interpretations.
- Keep `shampoo-weight-v1` available for reproducing the earlier route-rule calibration and distribution warning.
- Preserve old reports, approved analyses and release artifacts unless a separate approval workflow authorizes a new candidate release.
- A broad one-directional distribution shift is a review trigger, not proof that either the old or new labels are correct.

## Operator self-check

Before accepting a weight record, confirm:

- The canonical formula fingerprint matches the frozen product member.
- Claims and previous labels were hidden during the formula judgment.
- No ingredient, route count or position window directly assigned the band.
- All three subjudgments are present.
- Counterevidence and neighboring-band rationale are specific.
- Confidence names the limiting uncertainty without invented accuracy.
- Approved-versus-candidate comparison happens only after the blind result is frozen.
