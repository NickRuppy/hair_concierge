# Shampoo classification standard v1.6 (candidate)

## Version

| Field | Value |
| --- | --- |
| Candidate policy ID | `shampoo-classification-v1.6-candidate` |
| Policy ID after lock | `shampoo-classification-v1.6` (assigned only by the lock receipt) |
| Analysis model version | `shampoo-inci-v1.6-candidate` |
| Status | **Candidate. Not locked. Not production-active.** |
| Base method | `shampoo-classification-v1.4`, `docs/research/shampoo-inci/v1.4/classification-standard.md`, SHA-256 `0f9f6a6d4ae789be0febaf66ed178c4247776553a1ed9839255fcc6971928f24` (frozen, unchanged) |
| Merged overlay | Focus v1.5, approved by Nick 2026-09-03 (`plans/scan-db-expansion/research/shampoo-v14/focus-v15-amendment-plan.md`, contract `src/lib/shampoo/focus-v15.ts`) |
| Settled clarifications | holdout-v3 adjudication (`data/research/shampoo-inci/holdout-v3/adjudication.json`) where it decided a rule question |
| New in this version | Section 13, *Production projection assessment* |
| Rulings applied | Nick's phase-1 rulings R2–R6 of 2026-10-07 (`plans/shampoo-v16/rulings.md`): three-tier thickness fit and projected live `weight` (R2/R3), scalp-concern floor (R4), no-gap invariant and the Monday exception (R5), deep-cleanser dual listing (R6) |

This document is self-contained. A classifier needs only this standard plus one product's frozen identity, INCI and claims packet. It does not need to read v1.4, v1.5 or any earlier version.

What "candidate" means:

- It will be calibrated by two sealed lanes on a gold set (program decision D2), adjudicated by Nick, re-run on unseen products and only then locked as v1.6 with a hash-pinned receipt.
- Until lock, no artifact produced under it may feed Product Intake, the Production Light adapter, the catalog or recommendations.
- The shipped Production Light adapter (`src/lib/shampoo/production-light-adapter.ts`) is pinned to the v1.4 policy hash and the v1.4 focus vocabulary. It cannot consume a v1.6 envelope (for example, it rejects `moisture`). Using this standard in production requires a separate, reviewed adapter re-pin after lock.
- Rules that v1.4 explicitly rejected (route-count weight logic, "a polymer means moderate weight") are not part of this standard. Proposals to revisit them belong in `open-questions.md` and may enter only by passing calibration.

Rule IDs (for example `T2`, `S-OILY`) are stable references for lanes, adjudication logs and fixtures.

Scope: current German-market regular shampoos for healthy users with cosmetic hair/scalp needs. Medical treatment, diagnosed disease and hair-loss efficacy are outside scope. Explicit deep-cleansing products stay in the regular-shampoo cohort with cleansing intensity `clarifying`; Section 13.6 (D2, ruling R6) additionally flags them for a separate deep-cleanser catalog entry. This standard classifies only the regular-shampoo entry; the deep-cleanser entry is classified under the deep-cleanser category's own rules.

## 1. Output contract

Every classifiable product produces exactly eight direct properties and one production projection block.

### 1.1 Direct properties (product truth)

| Property | Values | What it describes |
| --- | --- | --- |
| `cleansingStrength` | `low`, `moderate`, `strong` | Net cleansing/reset strength of the complete surfactant system. |
| `conditioningLevel` | `low`, `moderate`, `high` | Rinse-off softness, slip and manageability support. |
| `weightPotential` | `low`, `moderate`, `high` | Potential for noticeable/cumulative residue that can reduce movement or root lift. |
| `focusPrimary` | `volume`, `shine`, `repair`, `moisture`, `clarifying`, `scalp_active`, `general` | Dominant intended product role after claims and formula are reconciled. |
| `focusSecondary` | zero to two distinct values from `volume`, `shine`, `repair`, `moisture`, `clarifying`, `scalp_active` | Optional additional role with its own claim and formula route. |
| `usageRole` | `frequent`, `regular`, `alternating`, `occasional_reset`, `treatment` | Product-level use context, not a personalized calendar. |
| `scalpComfortTarget` | `targeted`, `not_targeted`, `unknown` | Whether the product is intentionally formulated/positioned to support sensitive or uncomfortable scalp. |
| `dandruffSupport` | `supported`, `not_supported`, `unknown` | Whether the complete formula contains a recognized anti-dandruff active under this cosmetic research rule. |

`gentle` is **not** a focus value (retired by Focus v1.5). It remains valid language for cleansing and formula interpretation. Appendix A maps legacy `gentle` focus values.

Each property record includes:

- the selected value;
- `low | moderate | high` classification confidence;
- a concise conclusion-first rationale;
- exact supporting formula facts and one-based INCI positions where relevant;
- counter-signals and the neighboring alternative (the adjacent value that was most plausible after the selected one, or `none`);
- source identifiers.

The `focusPrimary`/`focusSecondary` record additionally carries the care-direction verdict, claim role and decision trace defined in Section 7.4.

No direct property is a quality score. Marketing claims, price and brand prestige do not raise a property value or confidence.

### 1.2 Production projection block (derived)

| Field | Values | Rule section |
| --- | --- | --- |
| `thicknesses[].fit`, one each for `fine`, `normal`, `coarse` | `ideal`, `acceptable`, `not_suited` | 13.4 |
| `weight` | `light`, `moderate`, `heavy` (one value per product) | 13.4 (W-LIVE) |
| `scalpTargets.primary.target` | `ordinary`, `oily`, `dry`, `sensitive`, `dandruff` | 13.5 |
| `scalpTargets.secondary.target` | optional; same values except `ordinary` | 13.5 |
| `observedCleansingIntensity` | `gentle`, `regular`, `clarifying` | 13.6 |
| `positioning.explicitResetPositioning` | `true`, `false` | 13.6 |
| `deepCleanserListing` | `flagged`, `not_flagged` | 13.6 (D2) |
| `reviewFlags` | zero or more codes from 13.9 | 13.9 |
| `informationalNotes` | zero or more non-blocking codes from 13.9 | 13.9 |

Each projected field carries confidence, a conclusion-first rationale that names the rule IDs applied, and evidence references. The projection block is derived from finalized direct properties and exact-product positioning; it never changes a direct property.

Research confidence and review flags are internal research fields. They must never be designed into user-facing copy or fields.

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

Never combine ingredient lists across GTINs, sizes, markets or reformulations. Preserve conflicting evidence in provenance. If the conflict could change a property or a projected field and cannot be resolved, block the identity or keep the affected property low-confidence/unknown as permitted below.

## 3. Formula-first, claims-second sequence

### 3.1 Blind formula pass

Before product claims are visible, freeze a packet containing:

- normalized complete INCI and fingerprint;
- formula source tier, completeness and identity confidence;
- surfactant architecture;
- conditioning/deposition routes;
- humectant/refatting/protein/film clues;
- recognized scalp actives and exposure flags;
- unresolved material ingredients;
- provisional eight properties, rationales and confidence.

Hide brand, product name, prior labels, catalog fit, live catalog rows, profile results, marketing claims and another research lane's answers.

### 3.2 Post-unblind reconciliation

After the blind hash is frozen, reveal exact identity, claims and usage instructions. Claims may:

- identify intended primary/secondary focus (claim role `candidate`);
- break a genuinely `dual_supported` repair/moisture tie (claim role `tie_breaker`);
- corroborate a formula-led conclusion (claim role `corroborating`);
- support a frequent, alternating, reset or treatment usage context;
- corroborate sensitive-scalp intent;
- supply the exact-product positioning that Section 13 requires for a scalp target;
- expose a conflict that requires lower confidence or re-research.

Claims may not:

- override an incompatible formula;
- assign cleansing, conditioning or weight by themselves;
- turn `nonspecific` formula evidence into a confident specialist focus;
- assign a thickness fit or the projected `weight` (Section 13.4), or pass a scalp-target formula gate (Section 13.5);
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

SLES is evidence for strong cleansing but not an automatic `strong` label. Sulfate-free does not automatically mean low.

**C1 (settled by holdout-v3).** An early alkyl ether sulfate (for example Sodium Laureth Sulfate or Sodium Myreth Sulfate) that is buffered by an amphoteric/betaine co-surfactant (for example Cocamidopropyl Betaine, Coco-Betaine, Sodium Cocoamphoacetate), with no second reinforcing anionic or reset route and no reset/deep-cleansing intent, is `moderate`, not `strong`. SLES plus additional anionic/reset routes often supports `strong`. Source: holdout-v3 decisions `eucerin-dermocapillaire-ph5/cleansingStrength` and `loreal-elvital-hydra-hyaluronic/cleansingStrength` (category `researcher_process_ambiguity`, effective `moderate`).

## 5. Conditioning level

Judge expected rinse-off slip, softness and manageability.

Consider cationic polymers/conditioners, silicones, amodimethicone systems, fatty alcohols, meaningful lipids/refatters, protein/film routes, 2-in-1 architecture and their positions/interactions.

| Value | Whole-formula conclusion |
| --- | --- |
| `low` | Cleansing-led architecture with little substantive slip or manageability support. |
| `moderate` | One meaningful conditioning system or several light routes provide noticeable but bounded rinse-off care. |
| `high` | Multiple complementary conditioning systems or a clearly rich 2-in-1 architecture make substantial softness/slip likely. |

Conditioning and weight are related but not equivalent. A formula can improve shine or slip without being highly conditioning or heavy.

**C2 (settled by holdout-v3).** Cleansing strength does not lower `conditioningLevel`; it is captured separately. An early silicone plus a cationic polymer plus a pearlizing/fatty route plus humectants (for example early Dimethicone, Glycol Distearate, Panthenol/Glycerin and Guar Hydroxypropyltrimonium Chloride) are multiple complementary systems and support `high` even in a strong-cleansing chassis. Source: holdout-v3 decision `wella-invigo-nutri-enrich/conditioningLevel` (category `product_correction`, effective `high`).

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

`weightPotential` also projects 1:1 into the live `weight` field (Section 13.4, W-LIVE). It is not re-judged for that projection.

**W1 (settled by holdout-v3).** Silicone plus a cationic guar plus a late amodimethicone, in a formula with an effective sulfate/betaine cleansing base and without a rich 2-in-1 architecture, is `moderate`, not `high`. Source: holdout-v3 decision `loreal-elvital-hydra-hyaluronic/weightPotential` (category `product_correction`, effective `moderate`).

### Reviewed ingredient-function rows

- `Quaternium-80`: cationic conditioning signal.
- `Starch Hydroxypropyltrimonium Chloride`: cationic conditioning polymer.
- `Juniperus Virginiana Oil`: essential fragrance oil; exclude from nonvolatile payload evidence without separate formula-specific support.
- `Glycine Soja Oil / Soybean Oil`: alias-normalized nonvolatile payload lipid.
- `Hydrogenated Vegetable Oil`: emollient/waxy payload lipid.
- `PEG-40 Hydrogenated Castor Oil` and `PEG-60 Hydrogenated Castor Oil`: solubilizer/emulsifier evidence; exclude from persistent payload evidence.

These rows resolve function recognition only. Position, surrounding routes, persistence and reset still decide the band.

## 7. Primary focus

Primary focus is the dominant intended role. Claims identify the candidate job; the complete formula must support or at least remain compatible with it; a meaningful counter-signal is always recorded. No single hero ingredient proves a focus.

### 7.1 Focus values

| Value | Meaning |
| --- | --- |
| `volume` | Lift/body/fullness is the dominant job and the formula is compatible with it. |
| `shine` | Gloss/smoothness is the dominant job, plausibly supported through smoothing, acidic alignment or a light film. A shine shampoo may be low-conditioning and low-weight. |
| `repair` | Damage care for broken, brittle, chemically or mechanically stressed lengths, with a `repair_supported` or tie-broken `dual_supported` care-direction verdict (7.3). |
| `moisture` | Hydration, dryness relief or nourishment of dry lengths, with a `moisture_supported` or tie-broken `dual_supported` verdict (7.3). |
| `clarifying` | Explicit deep-cleaning/reset or oily-root/buildup role with compatible architecture. |
| `scalp_active` | A formula-compatible, explicitly targeted cosmetic scalp need, including sensitive-scalp or anti-dandruff positioning. It does not by itself assert a recognized anti-dandruff active; `dandruffSupport` says that. |
| `general` | Honest fallback: no specialist focus has a coherent claim-plus-formula case, the formula evidence is nonspecific, or competing directions cannot be resolved conservatively. |

### 7.2 Decision table

| Situation | Decision |
| --- | --- |
| One dominant exact-product claim plus compatible formula route | Use that focus. |
| Multiple claims but one dominates name/range/instructions | Use the dominant compatible focus. |
| Strong formula route without matching product positioning | Usually keep the positioned focus and record the route as a trade-off. |
| Unsupported, contradictory or generic claims | `general`. |
| Problem-led product with recognized dandruff active and anti-dandruff positioning | `scalp_active`. |
| Explicit sensitive/itchy/dry-feeling scalp positioning with `scalpComfortTarget: targeted` | `scalp_active`. |
| Explicit deep-cleaning/reset product with compatible architecture | `clarifying`. |
| Only mild/gentle cleansing positioning, no scalp target | Not a focus. Use the next dominant compatible job or `general`; mildness is captured by `cleansingStrength` and `usageRole`. |

A strong-cleansing repair shampoo remains `repair` when that is its dominant compatible role; cleansing strength captures the chassis.

### 7.3 Repair/moisture care direction

For every product whose candidate job is repair, moisture, nourishment or dryness of the lengths, record one formula verdict before the claim is applied:

| Verdict | Formula evidence |
| --- | --- |
| `repair_supported` | A coherent substantive/deposition or damage-care cluster supports repair; one protein token is not enough. |
| `moisture_supported` | A coherent humectant cluster plus conditioning/emollient or deposition support supports moisturized feel and manageability in the rinse-off context. |
| `dual_supported` | The formula genuinely supports both directions. Exact-product positioning may break the tie. |
| `nonspecific` | Generic conditioning is compatible with both but distinguishes neither. Use `general` unless another specialist focus qualifies. |
| `not_applicable` | The chosen focus is not a repair/moisture decision. |

Ingredient order is used qualitatively, not as a concentration claim. Rinse-off limitations, shared conditioning routes and counter-signals stay visible.

**F1 (supersedes the holdout-v3 operator clarification).** v1.4 had no `moisture` value, so the holdout-v3 operator clarification placed restorative moisture/nourishment for dry or damaged lengths under `repair`. In this standard, dryness/hydration/nourishment positioning maps to `moisture` when the verdict is `moisture_supported` or `dual_supported`; damage/breakage/bond positioning maps to `repair` when the verdict is `repair_supported` or `dual_supported`; generic "care" or "moisture" language over a `nonspecific` formula stays `general`.

### 7.4 Focus record fields

In addition to Section 1.1, the focus record carries:

- `careDirection.verdict` and the moisture, repair and shared conditioning routes it relied on, plus its limitation;
- `claimRole`: `candidate`, `tie_breaker`, `corroborating` or `not_applicable`;
- formula facts as ingredient plus exact one-based INCI position;
- `counterSignal` (required, nonempty);
- `neighboringAlternative` (a different focus value or `null`);
- `decisionTrace`: plain-language account of how formula, counter-signal and claim resolved the focus.

## 8. Secondary focus

Secondary focus is optional. Empty is a complete and expected value.

Include one secondary focus only when all are true:

1. distinct secondary exact-product positioning exists;
2. an independent compatible formula route exists;
3. it is not a synonym for the primary focus or a restatement of cleansing/conditioning/weight.

**F2 (holdout-v3 operator clarification, now normative).** A benefit that is only an outcome of the same smoothing, deposition or restorative route used by the primary focus is not a secondary focus. Example: a `shine` claim delivered by the same silicone/smoothing route as the primary care focus does not add `shine`. Source: holdout-v3 decision `loreal-elvital-hydra-hyaluronic/focusSecondary` (effective `[]`).

Two values require explicit multi-benefit positioning, two independent routes and a written `explicit_multi_benefit_two_routes` exception. Never use `general` as secondary, never repeat the primary focus, never use more than two values.

## 9. Usage role

Usage role defaults to `regular`.

| Value | Required product-level trigger |
| --- | --- |
| `regular` | No non-default trigger. This includes many ordinary strong-cleansing shampoos. |
| `frequent` | Explicit daily/frequent/mild-use positioning **and** `cleansingStrength` is not `strong`. |
| `alternating` | `cleansingStrength: strong` **and** clarifying/reset/buildup/oily-root intent or architecture. Strong cleansing alone is insufficient; a `moderate` formula is never `alternating`. |
| `occasional_reset` | Explicit deep-cleansing/reset product (Section 13.6 D1 lexicon). It stays in this cohort as a `clarifying` regular shampoo and is flagged for a deep-cleanser entry (13.6 D2). |
| `treatment` | Problem-led recognized active route, especially supported anti-dandruff formulas. |

These triggers are conjunctive and checked mechanically after `cleansingStrength` is final. Example: once holdout-v3 settled Eucerin DermoCapillaire pH5 at `moderate` cleansing, its explicit frequent-use positioning made `frequent` correct (decision `eucerin-dermocapillaire-ph5/usageRole`).

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

Tea tree oil, rosemary, mint, salicylic acid alone, "anti-flake" wording or sensitive/dry-scalp positioning does not upgrade the property. Dry flakes caused by a dry-feeling or sensitive scalp remain a scalp-comfort fit problem, not automatically dandruff.

`supported` describes the formula only. A recognized active can be present without anti-dandruff positioning (for example as part of a sensitive-scalp or general formula); Section 13.5 decides whether a dandruff target is projected.

## 12. Confidence

Confidence describes how robust the classification is under the available evidence.

| Value | Use when |
| --- | --- |
| `high` | Exact complete formula, no material recognition/identity gap, converging evidence, and reasonable unknown formula details would not plausibly move the label. |
| `moderate` | One value is best supported, but realistic INCI-only unknowns could move it one adjacent value. This is the normal ceiling for many formula interpretations. |
| `low` | Material source conflict, incomplete formula, unresolved function or closely balanced alternatives prevent a dependable call. |

Do not attach invented accuracy percentages. Independent agreement measures process repeatability, not finished-product or consumer accuracy.

A low-confidence property stays visible and makes a consolidated candidate `not_finalizable`. Never omit the product or promote confidence to satisfy a release gate. Projection confidence is derived mechanically (Section 13.8) and may never be higher than the inputs it depends on.

## 13. Production projection assessment

### 13.1 Purpose and live vocabulary

The projection turns finalized direct properties plus exact-product positioning into the live `product_shampoo_specs` vocabulary. It runs only after all eight direct properties are final with moderate-or-high confidence, `scalpComfortTarget` and `dandruffSupport` are not `unknown`, and identity/formula are canonical. Otherwise the result is `needs_research`.

Live vocabulary (from `src/lib/shampoo/constants.ts`, `src/lib/product-intake/category-validators.ts`, `supabase/migrations/20260316113000_realign_shampoo_buckets.sql` and `20260416103000_add_leave_in_fit_table_and_shampoo_oil_fields.sql`):

| Projected scalp target | `shampoo_bucket` | `scalp_route` emitted | Bucket's expected `cleansing_intensity` |
| --- | --- | --- | --- |
| `ordinary` | `normal` | `balanced` | `regular` |
| `oily` | `dehydriert-fettig` | `oily` | `regular` |
| `dry` | `trocken` | `dry` | `gentle` |
| `sensitive` | `irritationen` | `irritated` | `gentle` |
| `dandruff` | `schuppen` | `dandruff` | `regular` |

- `thickness` is `fine | normal | coarse`; `cleansing_intensity` is `gentle | regular | clarifying`; primary key is `(product_id, thickness, shampoo_bucket)`.
- `weight` is `light | moderate | heavy`. It is the one new live spec column ruled in R2/R3. It does not exist in live `product_shampoo_specs` yet (verified 2026-10-07); it ships in its own small PR before any catalog apply. Until that column and the matching shampoo authority rule are live, no projection under this standard may be applied.
- The `schuppen` bucket also permits route `dry_flakes`. This standard never emits `dry_flakes`: dry flakes are not dandruff (Section 11), and the live matcher expects `dandruff` as the `schuppen` route.

Three display tiers (rulings R2–R4; informational for the classifier, binding for the live authority rule):

| Thickness fit | Live verdict | Display | Row emitted? |
| --- | --- | --- | --- |
| `ideal` | `ideal` | green | yes |
| `acceptable` | `supportive` | amber: shown, ranked below every `ideal` product of the same role | yes |
| `not_suited` | none (no row) | red: never shown as a recommendation | no |

Why conservatism matters (informational, matcher behavior after the R2 PR): a product is eligible for a user only through an exact `(thickness, shampoo_bucket)` row, so every `ideal` or `acceptable` thickness and every scalp target directly creates a visible recommendation. A row is `supportive` (amber) when its thickness fit is `acceptable` or when its `cleansing_intensity` differs from the bucket's expected intensity. For the dandruff role, a row that is amber **only** because of thickness is ranked (R4); a row whose cleansing intensity differs is still not ranked, because intensity and scalp route must be exact for dandruff.

### 13.2 Hard rule P0: fail conservative, never toward recommending

**P0.** Every projection rule that cannot be applied with certainty fails toward the conservative value or toward review. It never fails toward recommending a product.

- Thickness tiers are ordered `ideal` > `acceptable` > `not_suited`. Both `ideal` and `acceptable` create a visible row, so `acceptable` is a recommending outcome, only a weaker one. Moving a fit one tier up is always the recommending direction.
- Recommending outcomes: a thickness `ideal` or `acceptable`; any emitted scalp target or row; a secondary scalp target; a lighter projected `weight` than `weightPotential` supports.
- Conservative outcomes: a lower thickness tier; no target; no secondary target; a blocking review flag (13.9).
- Where uncertainty falls, by scalp target class:
  - **Balanced scalp** (`ordinary` target): an uncertain thickness fit falls toward `not_suited` or to review (T4). It never rises to `acceptable` or `ideal` on doubt.
  - **Scalp-concern targets** (`dandruff`, `sensitive`, `dry`, `oily`): the floor is `acceptable` (T6, ruling R4), so an uncertain thickness fit falls toward `acceptable` or to review. It never rises to `ideal` on doubt. Doubt about the scalp target itself still falls toward no target or review (13.5); R4 relaxes thickness only, never the scalp match.
- `observedCleansingIntensity` and the projected `weight` are formula truth. They are never chosen, softened or sharpened to match a bucket's expected intensity or a thickness.
- Legacy catalog rows, coverage of a thickness × scalp cell, product popularity and "is recommended" status are never inputs to a classification or projection rule. Coverage is enforced separately as an apply gate (13.11, N1, ruling R5): a gap blocks the apply and goes to Nick, who may add a named exception to the register (13.12). A gap is never closed by bending a rule for one product.
- A review flag is blocking: the projection is a proposal and cannot be applied until Nick rules on that product.
- If two rules in this section appear to conflict, apply the one with the more conservative outcome and raise `review_rule_conflict`.

### 13.3 Evidence definitions

**E1 Exact-product positioning.** Text that belongs to the exact German product: product name, pack front/back claims, the current exact manufacturer DE page's product claims and usage directions. Retailer copy counts only where it reproduces the manufacturer claim for the exact GTIN. Range-level or brand-level claims do not count. Positioning evidence confidence: `high` when the claim is in the product name or pack front; `moderate` when only on the pack back or exact manufacturer page; `low` when only in retailer copy or ambiguous. Low positioning confidence cannot support a target.

**E2 Scalp-claim lexicon.** A scalp claim must name the scalp (or roots/ansatz for oily). Hair-length claims never count as scalp claims.

| Target | Qualifying claim (German examples) | Does not qualify |
| --- | --- | --- |
| `dandruff` | "Anti-Schuppen", "gegen Schuppen", "Schuppen" as the product's problem | "Schüppchen durch trockene Kopfhaut", "anti-flake" wording without "Schuppen" as the treated problem |
| `sensitive` | "sensible/empfindliche Kopfhaut", "Juckreiz", "gereizte Kopfhaut", "beruhigt die Kopfhaut", "Kopfhaut Sensitive" | "mild", "sanft", "für jeden Tag" without a scalp condition |
| `dry` | "trockene Kopfhaut", "Spannungsgefühl der Kopfhaut", "trockene Kopfhautschüppchen" | "trockenes Haar", "trockene Längen", "Feuchtigkeit für das Haar" |
| `oily` | "fettige Kopfhaut", "schnell fettendes Haar", "fettiger Ansatz", "Anti-Fett", "überschüssiger Talg" | "Frische", "Leichtigkeit", "Volumen", "Fülle" without an oil/sebum claim |

Hair-loss, hair-growth or hair-density claims ("Haarausfall", "Wachstum", "Grow", "Coffein gegen Haarausfall") are medically adjacent and out of scope. They never create a scalp target and never count toward any gate.

**E3 Prominent ingredient (INCI-order proxy).** An ingredient is *prominent* when it is listed before `Parfum`/`Fragrance`; if the formula declares no fragrance, before the first of `Sodium Benzoate`, `Potassium Sorbate`, `Phenoxyethanol`, `Benzyl Alcohol`, `Methylisothiazolinone`, `Methylchloroisothiazolinone`, `Sodium Salicylate`; if none of these is present, it is not prominent. This is a repeatability convention for projection gates only, not a concentration claim and not a weight rule.

**E4 Route lists for scalp gates.** A route counts only if at least one listed ingredient is prominent (E3). Lists are closed for the candidate; an unlisted ingredient may count only with a written function rationale and caps the target's confidence at `moderate`.

- Comfort routes: `Panthenol`, `Allantoin`, `Bisabolol`, `Urea`, `Polidocanol`, `Dipotassium Glycyrrhizate`, `Avena Sativa Kernel Extract`/`Avena Sativa Kernel Flour`, `Niacinamide`.
- Humectant/refatting routes: `Glycerin`, `Urea`, `Sorbitol`, `Panthenol`, `Sodium PCA`, `Sodium Lactate`, `Betaine`, `Sodium Hyaluronate`, `Glyceryl Oleate`, `PEG-7 Glyceryl Cocoate`, `Glyceryl Cocoate`, and nonvolatile payload lipids recognized in Section 6.

**E5 Neighboring alternative.** The `neighboringAlternative` recorded on a direct property (Section 1.1). Projection rules use it only to raise review flags, never to change a value.

### 13.4 Thickness fit

Thickness means hair-strand diameter (`fine`, `normal`, `coarse`). It is a whole-formula call from finalized direct properties only.

**T1 Fit table (three tiers, rulings R2/R3).** W = `weightPotential`, C = `conditioningLevel`. The cell values are unchanged from the earlier draft; the former `conditional` tier is now `acceptable` and is shown (amber) instead of dropped.

| | `fine` | `normal` | `coarse` |
| --- | --- | --- | --- |
| W `low` | `ideal` | `ideal` | `ideal` if C `high`, else `acceptable` |
| W `moderate` | `acceptable` | `ideal` | `ideal` if C `high`, else `acceptable` |
| W `high` | `not_suited` | `acceptable` | `ideal` |

Rationale: fine strands lose lift first. A light formula is the right fit; a formula where noticeable residue is plausible (W `moderate`) is usable but not the best choice (Nick, R2: "ok, not great"); one where loss of movement is likely (W `high`) is not suited. Normal strands tolerate bounded residue; a heavy formula is usable but ranks below lighter ones (R3, e.g. OGX Renewing stays visible for normal hair). Coarse strands are the best fit only where the formula delivers substantial care (C `high`) or a rich deposit (W `high`); a lighter shampoo remains usable with a separate conditioner, which `acceptable` records.

T1 is the fit for the balanced scalp (`ordinary` target). T6 adjusts it for scalp-concern targets.

**T2 Inputs that never change fit.** Exact-product claims about thickness ("für feines Haar", "für kräftiges Haar"), texture or curl pattern ("Locken", "Curls" — pattern is `hair_texture`, not thickness), volume positioning, focus values and usage role do not raise or lower a fit. They may appear in the rationale as corroboration or counter-signal only. The scalp target affects the fit only through T6.

**T3 At least one ideal.** T1 always yields at least one `ideal` (normal for W `low`/`moderate`, coarse for W `high`). A product with no ideal thickness is an input error and returns `needs_research`.

**T4 Boundary review (extended for three tiers).** For each thickness, check the `neighboringAlternative` of every input T1 used for it (W for all thicknesses; C for coarse). Add `review_thickness_boundary` naming the thickness when the neighbor would produce a **lower** final tier than the selected value, after T6 is applied:

- an `ideal` fit whose neighbor would make it `acceptable` or `not_suited` (all targets);
- an `acceptable` fit whose neighbor would make it `not_suited` (only possible for the `ordinary` target, since T6 sets an `acceptable` floor for scalp-concern targets).

A fit whose neighbor would make it **higher** raises no flag; it is already conservative.

**T5 Emission (revised, R2).** `ideal` and `acceptable` fits become rows (13.7). `not_suited` is recorded with rationale for reviewers and never becomes a row. Every fit, including `not_suited`, is recorded in the projection block.

**T6 Scalp-concern floor (ruling R4).** When the product's projected targets are scalp-concern targets (`dandruff`, `sensitive`, `dry` or `oily`; never `ordinary`, see S-SECONDARY), a T1 `not_suited` becomes `acceptable` for those targets. `ideal` and `acceptable` are unchanged. Thickness and weight can therefore only make a scalp-concern product amber and rank it lower; they never hide it. T6 never raises a fit to `ideal`.

- T6 relaxes thickness only. The scalp target must still pass its own positioning and formula gates exactly (13.5); a doubtful scalp target is never rescued by T6.
- For the dandruff role this means thickness-only `acceptable` products are ranked (cleansing intensity and scalp route still exact). Expected effect from the 2026-10-05 snapshot: coarse × dandruff about 0 → about 5 (R4).
- Oily scalp keeps its own formula check: S-OILY requires `weightPotential` not `high`. Because T1 can only yield `not_suited` at W `high`, T6 never actually applies to an `oily` target, and heavy shampoos never reach oily-scalp users at any thickness. The only exception is the named, temporary register entry X1 (13.12).
- Consequence of S-OILY (informational): an `oily` target also requires C not `high`, so its coarse fit is always `acceptable` (T1 coarse is `ideal` only at C `high` or W `high`). A coarse × oily product can be amber at best unless a register exception applies.

**W-LIVE Projected live weight (rulings R2/R3).** Every classifiable product projects exactly one `weight` value, mechanically and 1:1 from the final `weightPotential`:

| `weightPotential` | `weight` |
| --- | --- |
| `low` | `light` |
| `moderate` | `moderate` |
| `high` | `heavy` |

- `weight` is written unchanged to every row of the product (like I2 for intensity). It is never chosen per thickness or per bucket.
- It is not a new research property and is not judged separately; a change to `weightPotential` changes `weight` and nothing else.
- Its confidence is the `weightPotential` confidence (13.8).

**T7 Live parity requirement (for the R2 authority PR; informational for the classifier).** The live shampoo authority receives only the rows (which already encode which thicknesses are `ideal` or `acceptable`) and `weight`. To reproduce T1/T6 without new columns, the live rule must treat row existence as eligibility (no row = `not_suited`) and decide ideal versus acceptable from `weight` with these per-thickness ideal sets, fixed by thickness only:

| Thickness | Ideal `weight` values | Any other `weight` on an existing row |
| --- | --- | --- |
| `fine` | `light` | `acceptable` (amber) |
| `normal` | `light`, `moderate` | `acceptable` (amber) |
| `coarse` | `heavy` | `acceptable` (amber) |

This reproduces every T1/T6 cell except one: coarse × C `high` × W `low`/`moderate` is `ideal` in T1 but would show amber live, because conditioning is not a live field. That divergence is in the conservative direction and is permitted by P0. A conditioner-identical ordered axis (fine=light, normal=moderate, coarse=heavy, one step = amber, two steps = red, or any per-user shift) does **not** reproduce T1: it would turn normal × light amber and hide coarse × light rows, contradicting T1 and, for scalp-concern products, R4. The final live rule is open question 1 in `open-questions.md`.

### 13.5 Scalp targets

Each target has a positioning gate (E1, E2) and a formula gate. Both must pass. The dandruff and sensitive targets are medically adjacent; their formula gates require formula evidence and can never be passed by marketing alone.

The scalp match is exact (ruling R4): the thickness relaxation in T6 never relaxes a gate in this section, and a target whose gate cannot be decided with certainty is not emitted (P0).

**S-DANDRUFF.** Positioning: E2 dandruff claim. Formula: `dandruffSupport: supported`. Both required. If `dandruffSupport: supported` without a dandruff claim, emit no dandruff target and record the informational warning `active_without_dandruff_positioning` (not a review flag; already conservative).

**S-SENSITIVE.** Positioning: E2 sensitive claim. Formula: `scalpComfortTarget: targeted` **and** at least one prominent comfort route (E4). If `cleansingStrength: strong`, emit the target with `review_strong_cleansing_comfort_route`.

**S-DRY.** Positioning: E2 dry-scalp claim. Formula: `scalpComfortTarget: targeted` **and** at least one prominent humectant/refatting route (E4). If `cleansingStrength: strong`, emit the target with `review_strong_cleansing_comfort_route`. Dry hair or dry lengths never create this target.

**S-OILY.** Positioning: E2 oily claim. Formula: `cleansingStrength` is `moderate` or `strong` **and** `weightPotential` is not `high` **and** `conditioningLevel` is not `high`. The weight clause is confirmed by ruling R4 and holds at every thickness; T6 never overrides it. The only permitted deviation is a named entry in the exception register (13.12); currently X1.

**S-ORDINARY.** Applies when the product makes no E2 scalp claim at all. A regular shampoo with no scalp positioning projects `ordinary`.

**S-FAIL (specialist gate failure).** When the product makes an E2 scalp claim but that target's formula gate fails and no other specialist target qualifies, propose `ordinary` as primary and add `review_specialist_gate_failed` naming the failed target and gate. The proposal is not applied until Nick rules. S-FAIL does not apply where a named register exception (13.12) lets that target pass for a thickness.

**S-PRIMARY (precedence).** If several specialist targets pass, the primary is the one named in the exact product name; otherwise the first in this order: `dandruff`, `sensitive`, `dry`, `oily`.

**S-SECONDARY.** At most one secondary target. It requires its own distinct E2 claim and its own formula gate pass. Never permitted:

- `ordinary` as secondary (a scalp-specialist product is not also projected to balanced scalp);
- the pair `oily` + `dry` (contradictory scalp states);
- a third qualifying target; keep primary plus the highest-precedence secondary and add `review_extra_scalp_target`.

**S-HAIRLOSS.** Hair-loss/growth positioning (E2 exclusion) is ignored for targets. A product whose only scalp-adjacent positioning is hair loss projects `ordinary`, and the rationale states that the hair-loss claim was not evaluated.

**S-FOCUS consistency.** If a specialist target (`dandruff`, `sensitive`, `dry`) is projected while neither `focusPrimary` nor `focusSecondary` is `scalp_active`, add `review_focus_target_mismatch`.

### 13.6 Cleansing intensity and deep-cleanser listing

**I1 Observed intensity** (mechanical, no judgment; revised per R6 to cover reset products that now stay in the cohort):

- `cleansingStrength: low` -> `gentle`;
- `cleansingStrength: moderate` -> `regular`;
- `cleansingStrength: strong` with `usageRole` `alternating` or `occasional_reset` and `clarifying` as primary or secondary focus -> `clarifying`;
- any other `cleansingStrength: strong` -> `regular`.

**I2 Never adjusted.** The observed intensity is written to every row of the product unchanged, even when it differs from the bucket's expected intensity (13.1). A resulting `supportive` match is a truthful trade-off, not an error.

**I3 Boundary review.** If `cleansingStrength` has a `neighboringAlternative` that would produce a different observed intensity, and that different intensity would equal the expected intensity of a projected bucket where the current one does not, add `review_intensity_boundary`.

**D1 Explicit reset positioning** (`positioning.explicitResetPositioning: true`) when the product name or a primary pack claim contains "Tiefenreinigung", "Tiefenreinigend", "Deep Clean"/"Deep Cleansing", "Clarifying Shampoo", "Detox-Reinigung", or the usage directions limit use to occasional resets (for example "1× pro Woche", "alle 1–2 Wochen", "nicht zur täglichen Anwendung").

**D2 Deep-cleanser dual listing (revised per ruling R6).** `cleansingStrength: strong` **and** `focusPrimary: clarifying` **and** `usageRole: occasional_reset` **and** D1 true -> `deepCleanserListing: flagged`. The product:

- keeps its regular-shampoo entry. Rows are assembled exactly as for any other product (13.7), with `observedCleansingIntensity: clarifying` (I1);
- is flagged for a separate deep-cleanser catalog entry. A product record has exactly one `category_key` and `product_shampoo_specs.category_key` is only `shampoo`, so the deep-cleanser entry is a second product record (pattern: Balea, regular-shampoo record `0f71ff9d…` plus deep-cleanser record `375ee7a0…`, which owns the barcode). The flag records whether that record already exists (its product ID) or still needs to be created. Creating it is a separate catalog action under the deep-cleanser category's own rules, not part of this projection.

D2 never removes, suppresses or blocks the regular-shampoo entry. In every other case `deepCleanserListing: not_flagged`.

Informational (matcher behavior): no bucket expects `clarifying`, so every row of a `clarifying` product is amber (`supportive`) in the everyday role and is not ranked in the dandruff role. That is a truthful trade-off, not an error (I2).

**D3 Mismatch.** D1 true but D2 not satisfied -> add `review_reset_positioning_mismatch`. The regular-shampoo rows are still assembled by the normal rules but stay blocked until Nick rules; D3 never routes the product out.

### 13.7 Row assembly

1. Final fits = the T1 fit for each thickness, then T6 when the targets are scalp-concern targets.
2. Row thicknesses = all thicknesses whose final fit is `ideal` or `acceptable`, ordered `fine`, `normal`, `coarse` (T5).
3. Targets = primary plus optional secondary. Targets are either `ordinary` alone or scalp-concern targets only (S-SECONDARY), so one set of final fits applies to every target.
4. Rows = every row thickness × every target, each with the target's bucket and route, the product's single observed intensity (I1) and the product's single `weight` (W-LIVE).
5. Deduplicate on `(thickness, shampoo_bucket)`.
6. `required_protocol_roles`: `shampoo_dandruff` when any row is `schuppen`; `shampoo_everyday` when any row is not `schuppen`.

Each row's tier is the final fit of its thickness. The tier is recorded in the projection block for reviewers and calibration; it is not a live column (the live rule derives it from row existence and `weight`, T7).

Rows are always this full cross-product. A product cannot hold a target for one thickness only; a live non-Cartesian pairing is a review difference, never a rule exception. The only permitted non-Cartesian rows are named entries in the exception register (13.12).

### 13.8 Projection confidence

- Thickness fit confidence = the lowest confidence among the direct properties T1 used for that thickness. T6 does not change it.
- `weight` confidence = `weightPotential` confidence.
- Scalp target confidence = the lowest of: the positioning evidence confidence (E1), and the confidence of every direct property its formula gate used; capped at `moderate` when an unlisted route was used (E4).
- Observed intensity confidence = `cleansingStrength` confidence (plus `usageRole` and focus confidence for `clarifying`).
- `deepCleanserListing` confidence = the lowest of `cleansingStrength`, `focusPrimary` and `usageRole` confidence and the D1 positioning evidence confidence (E1).
- Any projected field with `low` confidence returns `needs_research`.

### 13.9 Review flags and informational notes

All review flags are blocking until Nick rules on the product (13.2). Flags and notes are internal research fields.

| Code | Raised by |
| --- | --- |
| `review_thickness_boundary` | T4 (now also for an `acceptable` fit that a neighbor would make `not_suited`, `ordinary` target only) |
| `review_strong_cleansing_comfort_route` | S-SENSITIVE, S-DRY |
| `review_specialist_gate_failed` | S-FAIL |
| `review_extra_scalp_target` | S-SECONDARY |
| `review_focus_target_mismatch` | S-FOCUS |
| `review_intensity_boundary` | I3 |
| `review_reset_positioning_mismatch` | D3 |
| `review_rule_conflict` | 13.2 |
| `review_live_value_differs` | Every projected row set (including `weight`) that differs from the current live rows (program decision D4). Comparison happens after projection; live values are never an input. |

Informational notes are recorded in `informationalNotes`. They do not block, because they are already conservative or already ruled:

| Code | Raised by |
| --- | --- |
| `active_without_dandruff_positioning` | S-DANDRUFF |
| `scalp_concern_floor_applied` | T6, naming each thickness lifted from `not_suited` to `acceptable` |
| `deep_cleanser_listing` | D2, with the existing deep-cleanser product ID or `needs_record` |
| `exception_applied:<ID>` | 13.12, naming the register entry |

### 13.10 Worked examples (non-normative)

These apply the rules to adjudicated v1.4 candidate values and calibration-v1 positioning notes. They illustrate mechanics; they are not calibration outcomes. Inputs are cleansing/conditioning/weight; tiers are shown after T6.

| Product | Inputs | Thickness (T1, T6) | `weight` | Scalp (13.5) | Intensity (I1) | Rows |
| --- | --- | --- | --- | --- | --- | --- |
| Salthouse Anti Schuppen | M/L/L; `dandruffSupport: supported`; "Anti Schuppen" in name | fine ideal, normal ideal, coarse acceptable | `light` | `dandruff` (S-DANDRUFF) | `regular` | fine (ideal), normal (ideal), coarse (acceptable) × `schuppen`/`dandruff`/`regular`; the coarse row is ranked in the dandruff role (R4) |
| Hask Repair Argan Oil | S/H/H; dry-hair positioning only | fine not_suited, normal acceptable, coarse ideal | `heavy` | `ordinary` (dry hair is not dry scalp) | `regular` | normal (acceptable), coarse (ideal) × `normal`/`balanced`/`regular` |
| Monday Volume Kraft & Fülle | M/M/H; oily-roots claim assumed (live row from PR #449) | fine not_suited, normal acceptable, coarse ideal | `heavy` | S-OILY weight clause fails; register entry X1 bypasses it for coarse only | `regular` | coarse (ideal) × `dehydriert-fettig`/`oily`/`regular` only; note `exception_applied:X1`. Without X1: S-FAIL, proposed `ordinary` + `review_specialist_gate_failed` |
| Guhl Hyaluron+ | M/M/M; `dandruffSupport: supported`; no scalp claim | fine acceptable, normal ideal, coarse acceptable | `moderate` | `ordinary`; note `active_without_dandruff_positioning` | `regular` | fine (acceptable), normal (ideal), coarse (acceptable) × `normal`/`balanced`/`regular` |
| Hypothetical sensitive-scalp shampoo | M/M/H; "sensible Kopfhaut", `targeted`, prominent Panthenol | fine not_suited → acceptable (T6), normal acceptable, coarse ideal | `heavy` | `sensitive` | `regular` | fine (acceptable), normal (acceptable), coarse (ideal) × `irritationen`/`irritated`/`regular`; note `scalp_concern_floor_applied: fine` |
| Hypothetical "Tiefenreinigung" shampoo | S/L/L; focus `clarifying`; `usageRole: occasional_reset`; D1 true; no scalp claim | fine ideal, normal ideal, coarse acceptable | `light` | `ordinary` | `clarifying` | fine, normal (ideal), coarse (acceptable) × `normal`/`balanced`/`clarifying` (amber in the everyday role through intensity); `deepCleanserListing: flagged` |

### 13.11 No-gap invariant (ruling R5)

**N1 No empty profile.** Every hair-thickness × scalp profile keeps at least one recommendable shampoo. The profiles are the 15 cells `fine | normal | coarse` × balanced, oily, dry, irritated, dandruff.

- A product is *recommendable* for a cell when, in the complete catalog state that would exist after the apply, it is active, carries "is recommended" status, has a verified protocol for the cell's role, holds a row for that thickness and the cell's bucket, and the live authority (T7) would rank it: tier `ideal` or `acceptable`, and for the dandruff cell a cleansing intensity equal to the bucket's expected intensity.
- Every catalog apply that touches shampoo specs runs an N1 preflight over all 15 cells. If any cell has zero recommendable products, the preflight **fails closed**: nothing is applied, and the report names each empty cell and the products whose change emptied it.
- N1 is an apply gate, not a classification input (P0). A failing cell is resolved by Nick: by accepting a product change that fills it, or by adding a named, temporary exception to the register (13.12). Exceptions are a bridge to a reviewed replacement, never a permanent state.
- N1 tightens program decision D9 from "no cell loses its last product without a ruling" to a hard invariant.
- Every preflight report lists all active register exceptions and the cells they keep filled.

Baseline 2026-10-05 (live recommended products per cell, balanced/oily/dry/irritated/dandruff): fine 7/5/3/5/4, normal 4/5/2/3/3, coarse 4/1/2/2/2. Thinnest cell: coarse × oily (1, Monday Volume, kept by X1).

### 13.12 Exception register

An exception lets one named product deviate from one named rule for one named cell. It exists only when Nick has ruled it. Each entry records: ID, product, cell, rule deviated, ruling, reason, removal condition. A product under an exception still passes every other rule. The exception is applied mechanically, recorded as `exception_applied:<ID>` and is not a review flag (it is already ruled). No lane may create, extend or infer an exception.

| ID | Product | Cell | Rule deviated | Ruling | Removal condition |
| --- | --- | --- | --- | --- | --- |
| X1 | Monday Haircare Volume Kraft & Fülle (`6dc65df2-2466-43e4-bdc2-3a05803f305c`) | coarse × oily | S-OILY clause "`weightPotential` not `high`" (and R4's "heavy shampoos never reach oily-scalp users"), for coarse only | R5, 2026-10-07 (temporary; Nick: "that doesn't sound good") | Removed, together with Monday's oily row, as soon as one lighter oily-scalp shampoo is recommendable for coarse × oily under N1 (Track B, starting with cell C2). Under S-OILY such a replacement is coarse `acceptable` (amber), and that is sufficient. The removal apply must itself pass N1. |

X1 scope, applied mechanically:

- It bypasses only the weight clause of S-OILY. The positioning gate (E2 oily claim) and the other formula clauses (`cleansingStrength` at least `moderate`, `conditioningLevel` not `high`) must still pass on Monday's v1.6 research. If any of them fails, X1 does not apply; the product is projected by the normal rules, and N1 will report coarse × oily as empty for Nick to rule.
- It yields exactly one oily row: coarse × `dehydriert-fettig`/`oily`, with the product's observed intensity and `weight`, tier from T1 (coarse × W `high` = `ideal`). No fine or normal oily rows, no `ordinary` rows (S-SECONDARY), and no S-FAIL flag.
- If v1.6 research no longer rates Monday's `weightPotential` as `high`, X1 is not needed. The product then passes S-OILY by the normal rules and X1 is retired as obsolete.

## 14. Independent repeatability, calibration and lock gate

For new batches, freeze selection and formulas before labels. Use two independent lanes:

- lane A performs blind formula analysis and post-unblind reconciliation;
- lane B receives the same final evidence and policy but not lane A's answers;
- compare seven judgment properties; recompute `dandruffSupport` mechanically;
- compare the projection judgments: the three thickness fits (three tiers, after T6), the primary scalp target and the secondary scalp target (or its absence); recompute `weight`, observed intensity, `deepCleanserListing` and rows mechanically from each lane's own properties;
- preserve every disagreement before adjudication, with the rule ID each lane applied.

Required pass bars for a routine research batch:

- at least 75% raw exact agreement across all judgment decisions;
- at least 60% raw exact agreement for every judged property;
- 100% formula-derived dandruff agreement;
- zero unresolved identity/audit failure;
- all final properties moderate-or-better confidence.

Also report label prevalence, conditional non-default agreement and Cohen's kappa as diagnostics. With ten products, kappa has no hard pass threshold.

Adjudicate a disagreement as product correction, source/identity failure, researcher-process ambiguity or systematic rule gap. A systematic gap changes the standard and reruns the complete batch; it is not patched for one convenient product. For each disagreement, also record whether either lane's value would have produced a higher thickness tier (`not_suited` → `acceptable` or `acceptable` → `ideal`), an additional row, an additional scalp target or a lighter `weight` relative to the adjudicated value (direction `toward_recommending`).

**Lock gate for this candidate** (program decision D2, owned by `plans/shampoo-v16/plan.md`): two sealed lanes on the approved gold set; at least 90% raw agreement over all judged direct and projection decisions; zero disagreements whose cause is an ambiguity in this standard and whose direction is `toward_recommending`; Nick adjudicates; then a re-run on unseen products. Only then is the policy ID `shampoo-classification-v1.6` assigned by a hash-pinned lock receipt.

## 15. Product truth versus user fit

The eight properties are product truth. The projection block and any profile replay are derived results.

When a direct property changes, refresh only demonstrably derived projection, fit and ranking outputs. Do not change a direct classification or a projection rule to make profile or cell coverage proportional, match historical expert opinion, match a live catalog row or preserve a recommendation.

Coverage is protected only by the N1 apply gate and Nick's named exceptions (13.11, 13.12), never by changing a direct classification or a projection rule.

## 16. Stop boundary

A v1.6 research run may write versioned local artifacts, validation reports, projection proposals and de-identified profile replays. It may not:

- approve or import a catalog product;
- mutate Lab decisions;
- write to Supabase;
- change production recommendation behavior;
- publish user-facing ingredient or efficacy claims;
- imply medical diagnosis or treatment.

Those actions require their own approval and release workflow.

## Appendix A. Legacy `gentle` focus mapping

Applies when re-reading a v1.4 record whose `focusPrimary` or `focusSecondary` is `gentle`. Re-derive; do not rename mechanically.

| v1.4 record | v1.6 focus |
| --- | --- |
| Primary `gentle`, explicit sensitive/itchy/dry-feeling scalp claim, `scalpComfortTarget: targeted` | `scalp_active` |
| Primary `gentle`, mildness/everyday-use positioning only | The next dominant compatible job (7.2), else `general` |
| Secondary `gentle` alongside primary `scalp_active` that already covers the sensitive-scalp role | Drop it (secondary `[]` unless another secondary qualifies). Example: holdout-v3 `vichy-dercos-anti-schuppen-sensitiv` adjudicated secondary `gentle`; under v1.6 the sensitive role is part of `scalp_active`. |
| Secondary `gentle` alongside another primary, with explicit sensitive-scalp claim and `targeted` | `scalp_active` as secondary |
| Secondary `gentle`, mildness only | Drop it |

## Appendix B. Source register

| Source | Use in this standard |
| --- | --- |
| `docs/research/shampoo-inci/v1.4/classification-standard.md` | Base text of Sections 1–12, 14–16 |
| `docs/research/shampoo-inci/v1.4/holdout-v3-operator-clarifications.md` | F2 adopted; repair/moisture clarification superseded by F1 |
| `data/research/shampoo-inci/holdout-v3/adjudication.json` | C1, C2, W1, F2, usage example, Appendix A Vichy row |
| `plans/scan-db-expansion/research/shampoo-v14/focus-v15-amendment-plan.md`, `src/lib/shampoo/focus-v15.ts` | Section 7, 8 vocabulary, Appendix A |
| `docs/product-intake-shampoo-production-light.md`, `src/lib/shampoo/production-light-adapter.ts` | 13.1 vocabulary, I1, D2, S-DANDRUFF positioning requirement, dry/sensitive `targeted` requirement, row assembly |
| `src/lib/shampoo/constants.ts`, `src/lib/product-intake/category-validators.ts`, shampoo migrations | 13.1 bucket/route/intensity table |
| `data/research/shampoo-production-light-v1/calibration-v1/`, pilot `adapter-input.json` files | Evidence that thickness/scalp judgments were previously unwritten and inconsistent; T1 follows the conservative side where they split |
| `plans/shampoo-v16/rulings.md` (R2–R6, 2026-10-07) | Three-tier T1/T5, W-LIVE, T7 (R2/R3); T6 and P0 by target class (R4); N1 and register entry X1 (R5); I1 revision, D2 dual listing, D3 (R6) |
| `src/lib/personal-plan/products/authority/categories/conditioner.ts`, `axis-fit.ts`, `shampoo.ts`, `src/lib/mobile/result-presentation.ts` | Live green/amber/red pattern and dandruff-role ranking that 13.1 and T7 describe (read-only reference) |
