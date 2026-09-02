# Shampoo classification standard v1.4

Policy ID: `shampoo-classification-v1.4`

Analysis model version: `shampoo-inci-v1.4`

Scope: current German-market regular shampoos for healthy users with cosmetic hair/scalp needs. Explicit deep-cleansing products, medical treatment, diagnosed disease and hair-loss efficacy are outside this cohort.

## 1. Output contract

Every classifiable product produces exactly eight direct properties:

| Property | Values | What it describes |
| --- | --- | --- |
| `cleansingStrength` | `low`, `moderate`, `strong` | Net cleansing/reset strength of the complete surfactant system. |
| `conditioningLevel` | `low`, `moderate`, `high` | Rinse-off softness, slip and manageability support. |
| `weightPotential` | `low`, `moderate`, `high` | Potential for noticeable/cumulative residue that can reduce movement or root lift. |
| `focusPrimary` | `volume`, `shine`, `repair`, `clarifying`, `scalp_active`, `gentle`, `general` | Dominant intended product role after claims and formula are reconciled. |
| `focusSecondary` | zero to two distinct focus values | Optional additional role with its own claim and formula route. |
| `usageRole` | `frequent`, `regular`, `alternating`, `occasional_reset`, `treatment` | Product-level use context, not a personalized calendar. |
| `scalpComfortTarget` | `targeted`, `not_targeted`, `unknown` | Whether the product is intentionally formulated/positioned to support sensitive or uncomfortable scalp. |
| `dandruffSupport` | `supported`, `not_supported`, `unknown` | Whether the complete formula contains a recognized anti-dandruff active under this cosmetic research rule. |

Each property record includes:

- the selected value;
- `low | moderate | high` classification confidence;
- a concise conclusion-first rationale;
- exact supporting formula facts and INCI positions where relevant;
- counter-signals and the neighboring alternative;
- source identifiers.

No direct property is a quality score. Marketing claims, price and brand prestige do not raise a property value or confidence.

## 2. Identity and canonical formula

Classification starts only after the exact German product identity is resolved.

Record:

- exact brand and product name;
- market `DE`;
- exact pack size;
- all known GTIN/EAN aliases that identify the same formula-bearing product;
- capture date;
- source URLs and source tier;
- normalized INCI and its SHA-256 fingerprint;
- visible conflicts, market variants and reformulation evidence.

### Source hierarchy

Use the first exact, current source available:

1. exact German pack evidence for that GTIN;
2. current exact German manufacturer/brand page;
3. preferred German retailer page for the exact variant/GTIN;
4. another reputable German retailer only as corroboration or documented fallback.

The manufacturer hierarchy applies to the exact German product, not to a differently sized US or UK formula. A current exact German retailer formula is preferable to a foreign manufacturer formula for another market.

Never combine ingredient lists across GTINs, sizes, markets or reformulations. Preserve conflicting evidence in provenance. If the conflict could change a property and cannot be resolved, block the identity or keep the affected property low-confidence/unknown as permitted below.

## 3. Formula-first, claims-second sequence

### Blind formula pass

Before product claims are visible, freeze a packet containing:

- normalized complete INCI and fingerprint;
- formula source tier, completeness and identity confidence;
- surfactant architecture;
- conditioning/deposition routes;
- humectant/refatting/protein/film clues;
- recognized scalp actives and exposure flags;
- unresolved material ingredients;
- provisional eight properties, rationales and confidence.

Hide brand, product name, prior labels, catalog fit, profile results, marketing claims and another research lane's answers.

### Post-unblind reconciliation

After the blind hash is frozen, reveal exact identity, claims and usage instructions. Claims may:

- identify intended primary/secondary focus;
- support a frequent, alternating, reset or treatment usage context;
- corroborate sensitive-scalp intent;
- expose a conflict that requires lower confidence or re-research.

Claims may not:

- override an incompatible formula;
- assign cleansing, conditioning or weight by themselves;
- prove an ingredient concentration or finished-product effect;
- convert dry flakes into true dandruff support;
- convert a foreign/old formula into the current German formula.

Record every blind-to-final change with the revealed evidence and reason.

## 4. Cleansing strength

Judge the complete surfactant architecture, not the reputation of one ingredient.

### Required evidence

- primary and secondary surfactant families and positions;
- number and breadth of cleansing routes;
- amphoteric/nonionic buffering;
- refatting/conditioning counter-signals;
- clarifying, chelating or reset architecture;
- likely formula prominence from order, without treating order as exact concentration.

### Anchors

| Value | Whole-formula conclusion |
| --- | --- |
| `low` | A genuinely mild cleansing architecture dominated by mild amphoteric/nonionic/amino-acid routes with limited anionic reset and meaningful buffering. |
| `moderate` | Effective ordinary cleansing with a balanced surfactant system or one stronger route substantially buffered by secondary surfactants/refatting. |
| `strong` | A strong primary anionic/reset chassis, multiple reinforcing cleansing routes, or a clarifying/oily-root architecture whose net effect remains strong after counter-signals. |

SLES is evidence for strong cleansing but not an automatic `strong` label. SLES plus CAPB can still be moderate when the broader architecture is genuinely buffered; SLES plus additional anionic/reset routes often supports strong. Conversely, sulfate-free does not automatically mean low.

## 5. Conditioning level

Judge expected rinse-off slip, softness and manageability.

Consider cationic polymers/conditioners, silicones, amodimethicone systems, fatty alcohols, meaningful lipids/refatters, protein/film routes, 2-in-1 architecture and their positions/interactions.

| Value | Whole-formula conclusion |
| --- | --- |
| `low` | Cleansing-led architecture with little substantive slip or manageability support. |
| `moderate` | One meaningful conditioning system or several light routes provide noticeable but bounded rinse-off care. |
| `high` | Multiple complementary conditioning systems or a clearly rich 2-in-1 architecture make substantial softness/slip likely. |

Conditioning and weight are related but not equivalent. A formula can improve shine or slip without being highly conditioning or heavy.

## 6. Weight potential

`weightPotential` is a structured whole-formula judgment. It cannot be calculated from ingredient count or route count.

### Mandatory subjudgments

| Field | Values | Question |
| --- | --- | --- |
| `depositionLoad` | `light`, `moderate`, `high` | How much hair-substantive conditioning material is plausibly delivered? |
| `persistence` | `low`, `moderate`, `high` | How likely is residue to survive ordinary rinsing/repeated use or accumulate? |
| `resetCapacity` | `weak`, `moderate`, `strong` | How strongly does the same formula remove residue or offset weight? |

Record exact evidence positions, counterevidence, unresolved facts, `whyThisBand` and `whyNotNeighborBand`.

### Anchors

| Value | Whole-formula conclusion |
| --- | --- |
| `low` | Deposition is absent, light or low-persistence and the complete architecture does not make a noticeable reduction in movement/root lift likely. One light polymer, weak refatter, late protein or late oil can remain low. |
| `moderate` | Noticeable but bounded residue is plausible from one meaningfully persistent system or interacting lighter routes, while reset, limited richness or rinse-off context argues against a strongly coating result. |
| `high` | Multiple converging persistent systems or a clearly rich architecture with limited reset make noticeable loss of movement/root lift likely. One ingredient or one route kind is insufficient. |

Strong cleansing raises reset capacity but never automatically cancels deposition. A polymer or silicone is a clue, not an automatic moderate floor.

### Reviewed ingredient-function rows

- `Quaternium-80`: cationic conditioning signal.
- `Starch Hydroxypropyltrimonium Chloride`: cationic conditioning polymer.
- `Juniperus Virginiana Oil`: essential fragrance oil; exclude from nonvolatile payload evidence without separate formula-specific support.
- `Glycine Soja Oil / Soybean Oil`: alias-normalized nonvolatile payload lipid.
- `Hydrogenated Vegetable Oil`: emollient/waxy payload lipid.
- `PEG-40 Hydrogenated Castor Oil` and `PEG-60 Hydrogenated Castor Oil`: solubilizer/emulsifier evidence; exclude from persistent payload evidence.

These rows resolve function recognition only. Position, surrounding routes, persistence and reset still decide the band.

## 7. Primary focus

Primary focus is the dominant intended role. Claims select direction; formula gates credibility.

| Situation | Decision |
| --- | --- |
| One dominant exact-product claim plus compatible formula route | Use that focus. |
| Multiple claims but one dominates name/range/instructions | Use the dominant compatible focus. |
| Strong formula route without matching product positioning | Usually keep the positioned focus and record the route as a trade-off. |
| Unsupported, contradictory or generic claims | `general`. |
| Problem-led product with recognized dandruff active | `scalp_active`. |
| Explicit deep-cleaning/reset product with compatible architecture | `clarifying`. |

A shine shampoo may be low-conditioning and low-weight if gloss is plausibly supported through smoothing, acidic alignment or a light film. A strong-cleansing repair shampoo remains `repair` when that is its dominant compatible role; cleansing strength captures the chassis.

## 8. Secondary focus

Secondary focus is optional. Empty is a complete and expected value.

Include one secondary focus only when all are true:

1. distinct secondary exact-product positioning exists;
2. an independent compatible formula route exists;
3. it is not a synonym for the primary focus or a restatement of cleansing/conditioning/weight.

Two values require explicit multi-benefit positioning, two independent routes and a written `explicit_multi_benefit_two_routes` exception. Never use `general` as secondary or repeat the primary focus.

## 9. Usage role

Usage role defaults to `regular`.

| Value | Required product-level trigger |
| --- | --- |
| `regular` | No non-default trigger. This includes many ordinary strong-cleansing shampoos. |
| `frequent` | Explicit daily/frequent/mild-use positioning and non-strong cleansing. |
| `alternating` | Strong cleansing plus clarifying/reset/buildup/oily-root intent or architecture. Strong cleansing alone is insufficient. |
| `occasional_reset` | Explicit deep-cleansing/reset product, usually outside this cohort. |
| `treatment` | Problem-led recognized active route, especially supported anti-dandruff formulas. |

This is not personalized cadence. Later fit logic may recommend a different schedule for a specific profile.

## 10. Scalp comfort target

`scalpComfortTarget` asks whether the product intentionally supports sensitive, dry-feeling, itchy or uncomfortable scalp. It does not diagnose disease or guarantee tolerability.

Use `targeted` when the post-unblind product is explicitly positioned for sensitive/itchy/dry-feeling scalp and the complete formula has a credible supportive architecture. Evaluate the whole formula:

- supportive signals: mild/balanced cleansing, humectant/refatting support, fragrance-free positioning, allantoin/panthenol or comparable comfort routes, explicit sensitive/anti-itch intent;
- counter-signals: strong reset, high fragrance/essential-oil exposure, cooling agents or other plausible irritation signals.

Menthol, mint or fragrance is a counter-signal, not an automatic veto. In an explicitly sensitive or anti-itch product it can remain `targeted` when the overall architecture supports the role. Cleansing strength separately captures when the formula may be less suitable for dry-sensitive profiles.

Use `not_targeted` for complete ordinary formulas without this intent/support. Use `unknown` only when formula identity/completeness or conflicting evidence prevents the decision.

## 11. Dandruff support

This property separates true cosmetic anti-dandruff support from dry-flake comfort.

| Formula evidence | Value |
| --- | --- |
| Complete INCI contains `Piroctone Olamine` or `Climbazole` | `supported` |
| Complete INCI contains neither | `not_supported` |
| Formula incomplete, opaque or materially conflicted | `unknown` |

Tea tree oil, rosemary, mint, salicylic acid alone, “anti-flake” wording or sensitive/dry-scalp positioning does not upgrade the property. Dry flakes caused by a dry-feeling or sensitive scalp remain a scalp-comfort fit problem, not automatically dandruff.

## 12. Confidence

Confidence describes how robust the classification is under the available evidence.

| Value | Use when |
| --- | --- |
| `high` | Exact complete formula, no material recognition/identity gap, converging evidence, and reasonable unknown formula details would not plausibly move the label. |
| `moderate` | One value is best supported, but realistic INCI-only unknowns could move it one adjacent value. This is the normal ceiling for many formula interpretations. |
| `low` | Material source conflict, incomplete formula, unresolved function or closely balanced alternatives prevent a dependable call. |

Do not attach invented accuracy percentages. Independent agreement measures process repeatability, not finished-product or consumer accuracy.

A low-confidence property stays visible and makes a consolidated candidate `not_finalizable`. Never omit the product or promote confidence to satisfy a release gate.

## 13. Independent repeatability and holdout gate

For new batches, freeze selection and formulas before labels. Use two independent lanes:

- lane A performs blind formula analysis and post-unblind reconciliation;
- lane B receives the same final evidence and policy but not lane A's answers;
- compare seven judgment properties; recompute `dandruffSupport` mechanically;
- preserve every disagreement before adjudication.

Required pass bars:

- at least 75% raw exact agreement across all judgment decisions;
- at least 60% raw exact agreement for every judged property;
- 100% formula-derived dandruff agreement;
- zero unresolved identity/audit failure;
- all final properties moderate-or-better confidence.

Also report label prevalence, conditional non-default agreement and Cohen's kappa as diagnostics. With ten products, kappa has no hard pass threshold.

Adjudicate a disagreement as product correction, source/identity failure, researcher-process ambiguity or systematic rule gap. A systematic gap changes the standard and reruns the complete holdout; it is not patched for one convenient product.

## 14. Product truth versus user fit

The eight properties are product truth. Profile replay is a separate deterministic result.

When a direct property changes, refresh only demonstrably derived fit/ranking outputs. Do not change the direct classification to make profile distribution proportional, match historical expert opinion or preserve a recommendation.

## 15. Stop boundary

A v1.4 research run may write versioned local artifacts, validation reports and de-identified profile replays. It may not:

- approve or import a catalog product;
- mutate Lab decisions;
- write to Supabase;
- change production recommendation behavior;
- publish user-facing ingredient or efficacy claims;
- imply medical diagnosis or treatment.

Those actions require their own approval and release workflow.
