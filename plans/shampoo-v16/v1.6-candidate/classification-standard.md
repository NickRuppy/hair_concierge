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

This document is self-contained. A classifier needs only this standard plus one product's frozen identity, INCI and claims packet. It does not need to read v1.4, v1.5 or any earlier version.

What "candidate" means:

- It will be calibrated by two sealed lanes on a gold set (program decision D2), adjudicated by Nick, re-run on unseen products and only then locked as v1.6 with a hash-pinned receipt.
- Until lock, no artifact produced under it may feed Product Intake, the Production Light adapter, the catalog or recommendations.
- The shipped Production Light adapter (`src/lib/shampoo/production-light-adapter.ts`) is pinned to the v1.4 policy hash and the v1.4 focus vocabulary. It cannot consume a v1.6 envelope (for example, it rejects `moisture`). Using this standard in production requires a separate, reviewed adapter re-pin after lock.
- Rules that v1.4 explicitly rejected (route-count weight logic, "a polymer means moderate weight") are not part of this standard. Proposals to revisit them belong in `open-questions.md` and may enter only by passing calibration.

Rule IDs (for example `T2`, `S-OILY`) are stable references for lanes, adjudication logs and fixtures.

Scope: current German-market regular shampoos for healthy users with cosmetic hair/scalp needs. Medical treatment, diagnosed disease and hair-loss efficacy are outside scope. Explicit deep-cleansing products are outside the regular-shampoo cohort; Section 13.6 identifies them so they can be routed out.

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
| `thicknesses[].fit`, one each for `fine`, `normal`, `coarse` | `ideal`, `conditional`, `not_suited` | 13.4 |
| `scalpTargets.primary.target` | `ordinary`, `oily`, `dry`, `sensitive`, `dandruff` | 13.5 |
| `scalpTargets.secondary.target` | optional; same values except `ordinary` | 13.5 |
| `observedCleansingIntensity` | `gentle`, `regular`, `clarifying` (or route `routed_deep_cleansing`) | 13.6 |
| `positioning.explicitResetPositioning` | `true`, `false` | 13.6 |
| `reviewFlags` | zero or more codes from 13.9 | 13.9 |

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
- assign a thickness fit (Section 13.4) or pass a scalp-target formula gate (Section 13.5);
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
| `occasional_reset` | Explicit deep-cleansing/reset product (Section 13.6 lexicon), usually outside this cohort. |
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
- The `schuppen` bucket also permits route `dry_flakes`. This standard never emits `dry_flakes`: dry flakes are not dandruff (Section 11), and the live matcher expects `dandruff` as the `schuppen` route.

Why conservatism matters (informational, current matcher behavior): a product is eligible for a user only through an exact `(thickness, shampoo_bucket)` row. A row whose `cleansing_intensity` differs from the bucket's expected intensity is ranked as `supportive` instead of `ideal`; for the dandruff role only `ideal` rows are ranked. Every ideal thickness and every scalp target therefore directly creates or removes live recommendations.

### 13.2 Hard rule P0: fail conservative, never toward recommending

**P0.** Every projection rule that cannot be applied with certainty fails toward the conservative value or toward review. It never fails toward recommending a product.

- Recommending outcomes: a thickness `ideal`; any emitted scalp target or row; a secondary scalp target.
- Conservative outcomes: `conditional` or `not_suited`; no target; no secondary target; a blocking review flag (13.9).
- `observedCleansingIntensity` is formula truth. It is never chosen, softened or sharpened to match a bucket's expected intensity.
- Legacy catalog rows, coverage of a thickness × scalp cell, product popularity and "is recommended" status are never inputs. Coverage gaps (program decision D9) are resolved by Nick's ruling, never by bending a rule.
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

**T1 Fit table.** W = `weightPotential`, C = `conditioningLevel`.

| | `fine` | `normal` | `coarse` |
| --- | --- | --- | --- |
| W `low` | `ideal` | `ideal` | `ideal` if C `high`, else `conditional` |
| W `moderate` | `conditional` | `ideal` | `ideal` if C `high`, else `conditional` |
| W `high` | `not_suited` | `conditional` | `ideal` |

Rationale: fine strands lose lift first, so any formula where noticeable residue is plausible (W `moderate`) is not a default fine-hair fit. Normal strands tolerate bounded residue but not a formula where loss of movement is likely (W `high`). Coarse strands are the default fit only where the formula delivers substantial care (C `high`) or a rich deposit (W `high`); a lighter shampoo remains usable with a separate conditioner, which `conditional` records.

**T2 Inputs that never change fit.** Exact-product claims about thickness ("für feines Haar", "für kräftiges Haar"), texture or curl pattern ("Locken", "Curls" — pattern is `hair_texture`, not thickness), volume positioning, focus values, usage role and scalp target do not raise or lower a fit. They may appear in the rationale as corroboration or counter-signal only.

**T3 At least one ideal.** T1 always yields at least one `ideal` (normal for W `low`/`moderate`, coarse for W `high`). A product with no ideal thickness is an input error and returns `needs_research`.

**T4 Boundary review.** For each `ideal` fit, if the `neighboringAlternative` of an input that T1 used (W for all thicknesses; C for coarse) would turn that fit into `conditional` or `not_suited`, add `review_thickness_boundary` naming the thickness. A non-ideal fit whose neighbor would make it ideal raises no flag; it is already conservative.

**T5 Only `ideal` is emitted.** `conditional` and `not_suited` are recorded with rationale for reviewers and never become rows.

### 13.5 Scalp targets

Each target has a positioning gate (E1, E2) and a formula gate. Both must pass. The dandruff and sensitive targets are medically adjacent; their formula gates require formula evidence and can never be passed by marketing alone.

**S-DANDRUFF.** Positioning: E2 dandruff claim. Formula: `dandruffSupport: supported`. Both required. If `dandruffSupport: supported` without a dandruff claim, emit no dandruff target and record the informational warning `active_without_dandruff_positioning` (not a review flag; already conservative).

**S-SENSITIVE.** Positioning: E2 sensitive claim. Formula: `scalpComfortTarget: targeted` **and** at least one prominent comfort route (E4). If `cleansingStrength: strong`, emit the target with `review_strong_cleansing_comfort_route`.

**S-DRY.** Positioning: E2 dry-scalp claim. Formula: `scalpComfortTarget: targeted` **and** at least one prominent humectant/refatting route (E4). If `cleansingStrength: strong`, emit the target with `review_strong_cleansing_comfort_route`. Dry hair or dry lengths never create this target.

**S-OILY.** Positioning: E2 oily claim. Formula: `cleansingStrength` is `moderate` or `strong` **and** `weightPotential` is not `high` **and** `conditioningLevel` is not `high`.

**S-ORDINARY.** Applies when the product makes no E2 scalp claim at all. A regular shampoo with no scalp positioning projects `ordinary`.

**S-FAIL (specialist gate failure).** When the product makes an E2 scalp claim but that target's formula gate fails and no other specialist target qualifies, propose `ordinary` as primary and add `review_specialist_gate_failed` naming the failed target and gate. The proposal is not applied until Nick rules.

**S-PRIMARY (precedence).** If several specialist targets pass, the primary is the one named in the exact product name; otherwise the first in this order: `dandruff`, `sensitive`, `dry`, `oily`.

**S-SECONDARY.** At most one secondary target. It requires its own distinct E2 claim and its own formula gate pass. Never permitted:

- `ordinary` as secondary (a scalp-specialist product is not also projected to balanced scalp);
- the pair `oily` + `dry` (contradictory scalp states);
- a third qualifying target; keep primary plus the highest-precedence secondary and add `review_extra_scalp_target`.

**S-HAIRLOSS.** Hair-loss/growth positioning (E2 exclusion) is ignored for targets. A product whose only scalp-adjacent positioning is hair loss projects `ordinary`, and the rationale states that the hair-loss claim was not evaluated.

**S-FOCUS consistency.** If a specialist target (`dandruff`, `sensitive`, `dry`) is projected while neither `focusPrimary` nor `focusSecondary` is `scalp_active`, add `review_focus_target_mismatch`.

### 13.6 Cleansing intensity and deep-cleansing routing

**I1 Observed intensity** (mechanical, no judgment):

- `cleansingStrength: low` -> `gentle`;
- `cleansingStrength: moderate` -> `regular`;
- `cleansingStrength: strong` with `usageRole: alternating` and `clarifying` as primary or secondary focus -> `clarifying`;
- any other `cleansingStrength: strong` -> `regular`.

**I2 Never adjusted.** The observed intensity is written to every row of the product unchanged, even when it differs from the bucket's expected intensity (13.1). A resulting `supportive` match is a truthful trade-off, not an error.

**I3 Boundary review.** If `cleansingStrength` has a `neighboringAlternative` that would produce a different observed intensity, and that different intensity would equal the expected intensity of a projected bucket where the current one does not, add `review_intensity_boundary`.

**D1 Explicit reset positioning** (`positioning.explicitResetPositioning: true`) when the product name or a primary pack claim contains "Tiefenreinigung", "Tiefenreinigend", "Deep Clean"/"Deep Cleansing", "Clarifying Shampoo", "Detox-Reinigung", or the usage directions limit use to occasional resets (for example "1× pro Woche", "alle 1–2 Wochen", "nicht zur täglichen Anwendung").

**D2 Deep-cleansing route.** `cleansingStrength: strong` **and** `focusPrimary: clarifying` **and** `usageRole: occasional_reset` **and** D1 true -> `routed_deep_cleansing`; no regular-shampoo rows are emitted.

**D3 Mismatch.** D1 true but D2 not satisfied -> add `review_reset_positioning_mismatch`; do not silently project as a regular shampoo.

### 13.7 Row assembly

1. Ideal thicknesses = all T1 fits equal to `ideal`, ordered `fine`, `normal`, `coarse`.
2. Targets = primary plus optional secondary.
3. Rows = every ideal thickness × every target, each with the target's bucket and route and the product's single observed intensity.
4. Deduplicate on `(thickness, shampoo_bucket)`.
5. `required_protocol_roles`: `shampoo_dandruff` when any row is `schuppen`; `shampoo_everyday` when any row is not `schuppen`.

Rows are always this full cross-product. A product cannot hold a target for one thickness only; a live non-Cartesian pairing is a review difference, never a rule exception.

### 13.8 Projection confidence

- Thickness fit confidence = the lowest confidence among the direct properties T1 used for that thickness.
- Scalp target confidence = the lowest of: the positioning evidence confidence (E1), and the confidence of every direct property its formula gate used; capped at `moderate` when an unlisted route was used (E4).
- Observed intensity confidence = `cleansingStrength` confidence (plus `usageRole` and focus confidence for `clarifying`).
- Any projected field with `low` confidence returns `needs_research`.

### 13.9 Review flags

All flags are blocking until Nick rules on the product (13.2). Flags are internal research fields.

| Code | Raised by |
| --- | --- |
| `review_thickness_boundary` | T4 |
| `review_strong_cleansing_comfort_route` | S-SENSITIVE, S-DRY |
| `review_specialist_gate_failed` | S-FAIL |
| `review_extra_scalp_target` | S-SECONDARY |
| `review_focus_target_mismatch` | S-FOCUS |
| `review_intensity_boundary` | I3 |
| `review_reset_positioning_mismatch` | D3 |
| `review_rule_conflict` | 13.2 |
| `review_live_value_differs` | Every projected row set that differs from the current live rows (program decision D4). Comparison happens after projection; live values are never an input. |

### 13.10 Worked examples (non-normative)

These apply the rules to adjudicated v1.4 candidate values and calibration-v1 positioning notes. They illustrate mechanics; they are not calibration outcomes.

| Product | Inputs | Thickness (T1) | Scalp (13.5) | Intensity (I1) | Rows |
| --- | --- | --- | --- | --- | --- |
| Salthouse Anti Schuppen | M/L/L (cleansing/conditioning/weight); `dandruffSupport: supported`; "Anti Schuppen" in name | fine ideal, normal ideal, coarse conditional | `dandruff` (S-DANDRUFF) | `regular` | fine and normal × `schuppen`/`dandruff`/`regular` |
| Hask Repair Argan Oil | S/H/H; dry-hair positioning only | fine not_suited, normal conditional, coarse ideal | `ordinary` (dry hair is not dry scalp) | `regular` | coarse × `normal`/`balanced`/`regular` |
| Monday Volume Kraft & Fülle | M/M/H; if the pack makes an oily-roots claim | fine not_suited, normal conditional, coarse ideal | oily formula gate fails (W `high`) -> proposed `ordinary` + `review_specialist_gate_failed` | `regular` | proposal: coarse × `normal`/`balanced`/`regular`, blocked for review |
| Guhl Hyaluron+ | M/M/M; `dandruffSupport: supported`; no scalp claim | fine conditional, normal ideal, coarse conditional | `ordinary`; warning `active_without_dandruff_positioning` | `regular` | normal × `normal`/`balanced`/`regular` |

## 14. Independent repeatability, calibration and lock gate

For new batches, freeze selection and formulas before labels. Use two independent lanes:

- lane A performs blind formula analysis and post-unblind reconciliation;
- lane B receives the same final evidence and policy but not lane A's answers;
- compare seven judgment properties; recompute `dandruffSupport` mechanically;
- compare the projection judgments: the three thickness fits, the primary scalp target and the secondary scalp target (or its absence); recompute observed intensity and rows mechanically from each lane's own properties;
- preserve every disagreement before adjudication, with the rule ID each lane applied.

Required pass bars for a routine research batch:

- at least 75% raw exact agreement across all judgment decisions;
- at least 60% raw exact agreement for every judged property;
- 100% formula-derived dandruff agreement;
- zero unresolved identity/audit failure;
- all final properties moderate-or-better confidence.

Also report label prevalence, conditional non-default agreement and Cohen's kappa as diagnostics. With ten products, kappa has no hard pass threshold.

Adjudicate a disagreement as product correction, source/identity failure, researcher-process ambiguity or systematic rule gap. A systematic gap changes the standard and reruns the complete batch; it is not patched for one convenient product. For each disagreement, also record whether either lane's value would have emitted an additional ideal thickness or row relative to the adjudicated value (direction `toward_recommending`).

**Lock gate for this candidate** (program decision D2, owned by `plans/shampoo-v16/plan.md`): two sealed lanes on the approved gold set; at least 90% raw agreement over all judged direct and projection decisions; zero disagreements whose cause is an ambiguity in this standard and whose direction is `toward_recommending`; Nick adjudicates; then a re-run on unseen products. Only then is the policy ID `shampoo-classification-v1.6` assigned by a hash-pinned lock receipt.

## 15. Product truth versus user fit

The eight properties are product truth. The projection block and any profile replay are derived results.

When a direct property changes, refresh only demonstrably derived projection, fit and ranking outputs. Do not change a direct classification or a projection rule to make profile or cell coverage proportional, match historical expert opinion, match a live catalog row or preserve a recommendation.

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
