# Shampoo classification standard v1.6

## Version

| Field | Value |
| --- | --- |
| Policy ID | `shampoo-classification-v1.6` |
| Analysis model version | `shampoo-inci-v1.6` |
| Status | **LOCKED v1.6 (2026-10-10, ruling R14). Normative research method. Not production-active.** |
| Lock receipt | `data/research/shampoo-inci/v1.6/v1.6-logic-lock-receipt.json`; `data/research/shampoo-inci/v1.6/artifact-manifest.json` pins this file by bytes and SHA-256 |
| Calibration evidence | Two sealed lanes per round: round 1 97.4% (19 products), round 2 97.1% (13 gold products), unseen check v2 95.8% (6 fresh products), all in `data/research/shampoo-inci/v1.6/calibration/` |
| Base method | `shampoo-classification-v1.4`, `docs/research/shampoo-inci/v1.4/classification-standard.md`, SHA-256 `0f9f6a6d4ae789be0febaf66ed178c4247776553a1ed9839255fcc6971928f24` (frozen, unchanged), together with the two other sources the v1.4 README lists as consolidated into v1.4: the final weight method `docs/research/shampoo-inci/v1.4-draft/weight-potential-final-method.md` (`shampoo-weight-final-v1`, now merged into Section 6) and the operational amendment `docs/research/shampoo-inci/v1.4-draft/operational-amendment.md` (its focus, secondary and usage operating rules and decision trace, merged into Sections 7–9; its superseded route-count weight section is not carried) |
| Round-2 revision | Rules added or sharpened to close the round-1 lane ambiguities (`data/research/shampoo-inci/v1.6/calibration/round-1/lane-a-ambiguities.md`, `lane-b-ambiguities.md`). Each change is a row in `rule-changes.md`. |
| Post-round-2 revision | Rulings R11 (C2 humectant element) and R12 (dandruff + irritated scalp as a research-only combination) applied, and the clarifications listed in `data/research/shampoo-inci/v1.6/calibration/round-2/round-2-report.md` closed with general rules (rule-changes rows 87–101). |
| Pre-lock revision | Rulings R14–R16 applied (rule-changes rows 102–108) after the unseen check v2, without a further calibration round (R13). |
| Merged overlay | Focus v1.5, approved by Nick 2026-09-03 (`plans/scan-db-expansion/research/shampoo-v14/focus-v15-amendment-plan.md`, contract `src/lib/shampoo/focus-v15.ts`) |
| Settled clarifications | holdout-v3 adjudication (`data/research/shampoo-inci/holdout-v3/adjudication.json`) where it decided a rule question |
| New in this version | Section 13, *Production projection assessment* |
| Rulings applied | Nick's phase-1 rulings R2–R6 of 2026-10-07 (`data/research/shampoo-inci/v1.6/rulings-ledger.md`, snapshot of `data/research/shampoo-inci/v1.6/rulings-ledger.md` at R16): three-tier thickness fit and projected live `weight` (R2/R3), scalp-concern floor (R4), no-gap invariant and the Monday exception (R5), deep-cleanser dual listing (R6). Rulings of 2026-10-09: C2 humectant element (R11), dandruff + irritated scalp recorded as a research-only combination (R12). Rulings of 2026-10-10: lock and the Kokosmilch weight adjudication (R14), anti-dandruff as the path with sensitive as a sub-attribute (R15), pre-lock rulings R16.1–R16.4 (dry scalp follows the same path; only D1 deep cleansers record `clarifying`; no deep-cleanser entry on an ordinary-strength formula; closed lists stay closed) |

This document is self-contained. A classifier needs only this standard plus one product's frozen identity, INCI and claims packet. It does not need to read v1.4, v1.5 or any earlier version.

What "locked" means:

- This text is byte-frozen. It is pinned by the lock receipt and the artifact manifest, and CI (`tests/shampoo-research-v1-6-lock.test.ts`) fails when a pinned byte changes. A rule change is a new version with its own calibration and lock receipt; it is never an in-place edit.
- Locking approves the research method only. It does not authorize Product Intake reconciliation, catalog or Supabase writes, recommendation changes or user-facing copy; each keeps its own approval (Section 16).
- The shipped Production Light adapter (`src/lib/shampoo/production-light-adapter.ts`) is still pinned to the v1.4 policy hash and the v1.4 focus vocabulary. It cannot consume a v1.6 envelope (for example, it rejects `moisture`). Using this standard in production requires a separate, reviewed adapter re-pin.
- Two live-display questions stay open after the lock (README, *Open after lock*): how the live rule turns `weight` into green or amber (T7) and how Monday Volume shows under X1. They belong to the later app PR and do not change any classification or projection rule here.
- Rules that v1.4 explicitly rejected (route-count weight logic, "a polymer means moderate weight") are not part of this standard. Proposals to revisit them need a new version and must pass calibration.

Rule IDs (for example `T2`, `S-OILY`) are stable references for lanes, adjudication logs and fixtures.

Scope: current German-market regular shampoos for healthy users with cosmetic hair/scalp needs. Medical treatment, diagnosed disease and hair-loss efficacy are outside scope. Explicit deep-cleansing products (D1 true) stay in the regular-shampoo cohort; with a strong formula they record cleansing intensity `clarifying` (I1, ruling R16.2) and Section 13.6 (D2, rulings R6, R16.3) additionally flags them for a separate deep-cleanser catalog entry. A deep-cleansing name on an ordinary-strength formula keeps only its regular-shampoo entry at its formula intensity (R16.3). This standard classifies only the regular-shampoo entry; the deep-cleanser entry is classified under the deep-cleanser category's own rules.

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
- counter-signals and the neighboring alternative (`neighboringAlternative`, rule N-ALT below);
- source identifiers.

**N-ALT Neighboring alternative (round 2).** `neighboringAlternative` follows mechanically from the property's confidence (Section 12); it is not a lane convention:

- confidence `high` → `none` (by definition, reasonable unknowns would not move the value);
- confidence `moderate` or `low` → exactly one other value, never `none` (by definition, realistic unknowns could move the value).
- For an ordered property (`cleansingStrength`, `conditioningLevel`, `weightPotential`) the neighbor is always one step away. If both adjacent values are possible, record the one the record's counter-signals and `whyNotNeighborBand` treat as more realistic. If the record finds both equally realistic, record the one that T4 or I3 (Section 13) would read as the less recommending outcome (for `weightPotential` the heavier value; for `conditioningLevel` the lower value; for `cleansingStrength` the value whose observed intensity would not match a projected bucket's expected intensity). If neither or both would, record the higher value.
- For a categorical property, the neighbor is the single most plausible other value.
- For the set-valued `focusSecondary` (post-round 2), the value and the neighbor are both whole sets. The neighbor is the single most plausible other set, written as a set: `[]` is a valid neighbor of a non-empty selection, and a one-value set (for example `["shine"]`) is a valid neighbor of `[]`. Never record per-member neighbors. No projection rule reads this neighbor.

Projection review flags (T4, I3) read only this field, so two lanes that agree on the value and its confidence produce the same flags.

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
| `researchCombinationTargets` | `[]`, `["sensitive"]`, `["dry"]` or `["sensitive", "dry"]`; **research-only, never projected** | 13.5 (E2b; rulings R12, R15, R16.1) |

`researchCombinationTargets` is a research fact for a future profile feature. It is recorded only on a product whose primary target is `dandruff`: within anti-dandruff, a product can additionally suit a sensitive or a dry scalp, never outside it (R15, R16.1). It never becomes a row, a scalp target, a live column or a ranking input, and no apply reads it.

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

### Completeness, normalization and conflicts (round 2)

**ID-1 Completeness.** A formula is complete only when its source is an approved, canonical full-INCI capture for the exact product without a material conflict. A non-empty ingredient string alone is not evidence of completeness. A formula that is not known to be complete returns `unknown` or low confidence wherever completeness matters (Sections 6, 10, 11).

**ID-2 Normalization.** Multilingual synonyms or slash/parenthesis variants of one ingredient (for example `Aqua (Water, Eau)`, `Aqua/Water/Eau`, `Glycine Soja Oil / Soybean Oil`) are one INCI entry. One-based positions are counted after this normalization. Marker characters (`*`, `**`) are stripped from the name and kept as provenance.

- *Split entries (post-round 2).* When a packet or source splits the synonyms of one ingredient into separate list entries (for example `Aqua` and `Water`, or `Aqua` and `(Water, Eau)`), merge them into one entry before numbering. Every record cites **normalized** positions only, never the raw packet position, and states the normalization once in its identity or formula block (for example "Aqua/Water merged; normalized positions").

**ID-3 Material conflict.** A conflict is *material* only if resolving it either way could change a direct property or a projected field. Then the affected property is `low` confidence (or `unknown` where the property allows it) and the product returns `needs_research`. Otherwise record it as a note with no confidence effect. Specifically:

- A generic disclaimer on a source ("Inhaltsstoffe können abweichen", "maßgeblich ist die Angabe auf der Verpackung") is not a conflict. Record it; no confidence effect.
- A claim naming an ingredient that does not appear in the frozen INCI: first map the claim name to INCI (for example "Hyaluron" → `Sodium Hyaluronate`, "Keratin" → `Hydrolyzed Keratin`, "Koffein" → `Caffeine`). If no INCI entry matches, the claim is a conflict. It is material only when that ingredient, if present, could change a property or a gate (for example a recognized dandruff active, a silicone, a comfort route at a gate). A missing botanical or marketing extract with no such role is a note only.

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

**CL-SRC Claim source grading (round 2).** Every claim used anywhere in this standard (focus, usage role, scalp comfort, D1, scalp targets) is graded with the E1 positioning confidence (Section 13.3), not only scalp-target claims:

- a word in the exact product name: `high`;
- a manufacturer or pack source: `moderate` (when the frozen packet does not distinguish pack front from back, every manufacturer-source claim is `moderate`); a foreign-language or foreign-market manufacturer page is graded `low` unless a German source carries the same claim (E1, post-round 2);
- retailer copy only: `low`.

A `low`-graded claim may act as a focus `candidate` only when the formula verdict independently supports that focus (for example `repair_supported`); it then caps the focus confidence at `moderate` and it can never act as `tie_breaker`. A `low`-graded claim never triggers a non-default usage role, `scalpComfortTarget: targeted`, D1 or a scalp target. Usage directions are graded the same way.

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

`cleansingStrength` is formula-only. Claims, product names, usage directions and deep-cleansing positioning never set or move it (3.2). Reset or deep-cleansing *intent* belongs to `usageRole` (Section 9) and D1 (13.6), never to cleansing strength.

### Surfactant conventions (round 2)

C1 and C3–C6 are repeatability conventions of this standard. They make two classifiers read the same surfactant system the same way; they are not potency measurements. Record the counter-signals (refatting, conditioning, polymers) that argue for the neighboring value; they may lower confidence to `moderate` (which then names the neighbor, N-ALT), but they never move the value away from the convention.

**C3 Surfactant classes.**

| Class | Members (examples, not exhaustive by chemistry) |
| --- | --- |
| Strong anionic, ether/sulfonate type | Alkyl ether sulfates (`Sodium Laureth Sulfate`, `Ammonium Laureth Sulfate`, `Sodium Myreth Sulfate`, `Sodium Pareth Sulfate`), alpha-olefin sulfonates (`Sodium C14-16 Olefin Sulfonate`), alkylbenzene sulfonates (`TEA-Dodecylbenzenesulfonate`) |
| Strong anionic, alkyl sulfate type | `Sodium Lauryl Sulfate`, `Ammonium Lauryl Sulfate`, `Sodium Coco-Sulfate`, `TEA-Lauryl Sulfate`, `Magnesium Lauryl Sulfate` |
| Mild anionic | Amino-acid acylates (glutamates, sarcosinates, glycinates, alaninates), taurates, isethionates, sulfosuccinates, sulfoacetates, ether carboxylates, lactylates |
| Amphoteric | Betaines, sultaines/hydroxysultaines, amphoacetates/amphodiacetates, amphopropionates |
| Nonionic cleansing | Alkyl glucosides (`Decyl Glucoside`, `Coco-Glucoside`, `Lauryl Glucoside`) |
| Not a cleansing route and not a buffer | Hydrotropes (`Sodium Xylenesulfonate`, `Sodium Cumenesulfonate`), alkanolamide foam boosters/thickeners (`Cocamide MEA`, `Cocamide DEA`, `Cocamide DIPA`), low-ethoxylate thickeners (`Laureth-2`, `Laureth-3`), PEG/PPG esters and ethers used as thickeners or solubilizers (`PEG-120 Methyl Glucose Dioleate`, `PEG-55 Propylene Glycol Oleate`, `PEG-150 Distearate`, `PPG-5-Ceteth-20`), polyglyceryl esters, salt, acids, charcoal, clay, chelators |

An unlisted surfactant is assigned to the class its chemistry names (sulfate, ether sulfate, sulfonate, acylate, betaine, glucoside); the record states the assignment.

**C3a Emulsifier-grade fatty sulfates (post-round 2).** A C16–C18 alkyl sulfate (`Sodium Cetearyl Sulfate`, `Sodium Cetyl Sulfate`, `Sodium Stearyl Sulfate`) that appears in the same formula as a C16–C18 fatty alcohol (`Cetearyl Alcohol`, `Cetyl Alcohol`, `Stearyl Alcohol`) is the anionic part of an emulsifying-wax system. It belongs to the "not a cleansing route and not a buffer" class: it is never the defining anionic, never a reinforcing route (C1, C5) and never a buffer. The fatty alcohol keeps its own role (`payload_lipid` in 6.3; pearlizing/fatty route in C2). Without such a fatty alcohol in the formula, the fatty sulfate is classed by its chemistry as an alkyl sulfate (strong anionic), which is the conservative reading. The record names the pairing it relied on. Shorter-chain alkyl sulfates (`Sodium Lauryl Sulfate`, `Sodium Coco-Sulfate` and the other members of the alkyl sulfate row) are never covered by C3a.

**C4 Position and roles.** Only prominent surfactants count (E3: listed before `Parfum`/`Fragrance`, else before the first listed preservative; for C rules only, when the formula declares neither, every listed surfactant counts as prominent). A surfactant listed after that point is recorded but is neither a primary route, a reinforcing route nor a buffer.

- The *defining anionic* is the earliest prominent strong anionic (either strong type). If there is none, C6 applies.
- A *reinforcing route* is any further prominent strong anionic (either type).
- A *buffer* is a prominent amphoteric, nonionic glucoside or mild anionic.

**C1 Ether/sulfonate-type chassis (settled by holdout-v3; scope sharpened in round 2).** Defining anionic of the ether/sulfonate type:

- at least one buffer and no reinforcing route → `moderate`;
- no buffer → `strong`;
- a reinforcing route → `strong`.

Source of the settled core (alkyl ether sulfate buffered by a betaine, no second anionic): holdout-v3 decisions `eucerin-dermocapillaire-ph5/cleansingStrength` and `loreal-elvital-hydra-hyaluronic/cleansingStrength` (category `researcher_process_ambiguity`, effective `moderate`). The holdout-v3 wording "and no reset/deep-cleansing intent" is removed: intent is a claim and cannot move cleansing strength (3.2). Formula reset architecture is exactly what this rule reads: an unbuffered or reinforced strong anionic.

**C5 Alkyl sulfate chassis.** Defining anionic of the alkyl sulfate type (a harsher class than ether sulfates):

- at least two buffers and no reinforcing route → `moderate`;
- otherwise → `strong`.

**C6 Chassis without a prominent strong anionic.**

- The earliest prominent cleansing surfactant is an amphoteric or nonionic glucoside, or a mild anionic with at least one prominent amphoteric or glucoside co-surfactant → `low`.
- Mild anionic(s) without a prominent amphoteric or glucoside co-surfactant → `moderate`.
- No prominent cleansing surfactant at all → the formula is not interpretable under this convention; `cleansingStrength` confidence `low`.

## 5. Conditioning level

Judge expected rinse-off slip, softness and manageability.

Consider cationic polymers/conditioners, silicones, amodimethicone systems, fatty alcohols, meaningful lipids/refatters, protein/film routes, 2-in-1 architecture and their positions/interactions.

| Value | Whole-formula conclusion |
| --- | --- |
| `low` | Cleansing-led architecture with little substantive slip or manageability support. |
| `moderate` | One meaningful conditioning system or several light routes provide noticeable but bounded rinse-off care. |
| `high` | Multiple complementary conditioning systems or a rich architecture (W-RICH, Section 6) make substantial softness/slip likely. |

Conditioning and weight are related but not equivalent. A formula can improve shine or slip without being highly conditioning or heavy.

**C2 (settled by holdout-v3; "early" defined in round 2).** Cleansing strength does not lower `conditioningLevel`; it is captured separately. An early silicone plus a cationic polymer plus a pearlizing/fatty route plus humectants (for example early Dimethicone, Glycol Distearate, Panthenol/Glycerin and Guar Hydroxypropyltrimonium Chloride) are multiple complementary systems and support `high` even in a strong-cleansing chassis. Source: holdout-v3 decision `wella-invigo-nutri-enrich/conditioningLevel` (category `product_correction`, effective `high`).

- *Early* means prominent (E3). A silicone listed after the E3 point is a supporting route only and does not satisfy C2.
- A prominent nonvolatile payload lipid, butter or fatty alcohol (Section 6.3 family `payload_lipid`) may take the place of the early silicone. The other C2 elements (a cationic polymer, a pearlizing/fatty route and humectants) are still required. Weak refatters (`weak_refatter`) never take that place.
- *Humectant element (ruling R11).* The humectant element requires a deliberate humectant route: at least one of `Glycerin`, `Panthenol`, `Sodium Hyaluronate`, `Sodium PCA`, `Urea`, `Sorbitol` or `Betaine` (the INCI `Betaine` itself, never an alkyl betaine surfactant such as `Cocamidopropyl Betaine`) listed as its own INCI entry. The list is closed, like the E4 lists, and additions are Nick's rulings, deferred to one batch decision after the Track A/B research (ruling R16.4). Not a deliberate humectant route, alone or together: glycols and other solvents or extract carriers (`Butylene Glycol`, `Propylene Glycol`, `Triethylene Glycol`, `Dipropylene Glycol`, `Pentylene Glycol`, `Hexylene Glycol`, `Caprylyl Glycol`), aloe juice or other plant juices, waters and extracts (`Aloe Barbadensis Leaf Juice`, `Aloe Barbadensis Leaf Extract`), and `Sodium Lactate` (a pH buffer, F4). When the only candidates are such ingredients, C2 is not met; the formula is judged by the anchors (usually `moderate` for one meaningful system). When the other three C2 elements are present, the missing humectant route is recorded as the counter-signal and, at `moderate` or `low` confidence, `high` is the neighbor (N-ALT).
- When C2 is not met, `high` still requires the `high` anchor's multiple complementary systems; one meaningful system plus light routes is `moderate`.

**C7 2-in-1 claims (round 2).** A "2-in-1", "Shampoo & Spülung" or "mit Conditioner" claim never establishes richness or raises `conditioningLevel` (3.2). The value comes from the formula alone; a 2-in-1 product whose formula shows one conditioning system is `moderate` at most.

## 6. Weight potential

This section is the complete weight method. It merges the final v1.4 weight method `shampoo-weight-final-v1` (`docs/research/shampoo-inci/v1.4-draft/weight-potential-final-method.md`), which the v1.4 README lists as one of the three consolidated v1.4 sources, into this standard. A classifier needs nothing else to judge weight. The earlier route-count calibration `shampoo-weight-v1` and the rule "a polymer means moderate" are superseded and are not part of this standard.

### 6.1 What the property means

`weightPotential` is the formula-derived potential for a shampoo to leave noticeable or cumulative residue that can reduce movement, strand separation or root lift after rinsing. It is a trade-off dimension, not a quality score.

`weightPotential` is a structured whole-formula judgment. It cannot be calculated from ingredient count, route count or a position window.

### 6.2 Evidence boundary

Supported by external formulation evidence:

- Cationic polymers and silicone systems can support conditioning and deposition. Deposition depends on polymer chemistry, the silicone system, surfactant composition, dilution behavior and the hair substrate (Jordan et al. 2009, Lepilleur et al. 2011, Kwak et al. 2021, as cited by the v1.4 weight finalization work).
- INCI order supports formula architecture and rough prominence. It does not reveal exact concentrations, particle size, charge density, pH, active content, finished-product deposition or consumer-perceived heaviness.

Internal methodology choices (Chaarlie research anchors, not measurements):

- The `low`/`moderate`/`high` anchors in 6.6.
- `depositionLoad`, `persistence` and `resetCapacity` are structured expert judgments from the complete formula.
- Ingredient recognition, family assignment and INCI positions are evidence-gathering steps only. No recognized ingredient, family count, marketing claim or INCI position assigns the final band by itself.

### 6.3 Evidence extraction

Record every deposition-relevant and reset-relevant ingredient with its exact normalized one-based position (ID-2), in these families:

| Group | Family | What belongs here (examples) |
| --- | --- | --- |
| Deposition | `silicone` | `Dimethicone`, `Dimethiconol`, `Amodimethicone`, other silicones and amino-silicones |
| Deposition | `cationic_polymer` | `Guar Hydroxypropyltrimonium Chloride`, `Hydroxypropyl Guar Hydroxypropyltrimonium Chloride`, `Polyquaternium-n`, `Starch Hydroxypropyltrimonium Chloride`, `Hydroxypropyl Oxidized Starch PG-Trimonium Chloride` |
| Deposition | `cationic_conditioner` | Quaternary conditioning agents that are not polymers, e.g. `Quaternium-80`, behentrimonium/cetrimonium salts |
| Deposition | `payload_lipid` | Nonvolatile plant oils and butters, waxy/hydrogenated lipids, fatty alcohols, emollient esters/ethers (e.g. `Argania Spinosa Kernel Oil`, `Butyrospermum Parkii Butter`, `Hydrogenated Castor Oil`, `Hydrogenated Vegetable Oil`, `Cetearyl Alcohol`, `Dicaprylyl Ether`) |
| Deposition | `weak_refatter` | Light refatting esters and lipid-like additives (e.g. `Glyceryl Oleate`, `PEG-7 Glyceryl Cocoate`, `Hydrogenated Palm Glycerides Citrate`, `Lecithin`, `Ascorbyl Palmitate`) |
| Deposition | `protein_film` | Hydrolyzed proteins and amino-acid film routes |
| Deposition | `film_former` | Film-forming hair polymers (e.g. `PVP`, `VP/VA Copolymer`, `Polyester-37`); not the anionic acrylate thickeners resolved in 6.4 |
| Reset | `anionic_surfactant`, `amphoteric_surfactant`, `nonionic_surfactant` | Classified as in C3 |
| Excluded | — | Listed with the reason; never counted as deposition (see 6.4) |
| Unresolved | — | Any ingredient whose weight-relevant function is unknown; listed with the reason (see 6.6, unknowns) |

Humectants (glycerin, panthenol, sodium hyaluronate and similar) are recorded as context, not as a deposition family.

### 6.4 Reviewed ingredient-role resolutions

These resolve function recognition only. Position, surrounding routes, persistence and reset still decide the band.

- `Quaternium-80`: cationic hair-conditioning signal (EU cosmetic ingredient inventory: antistatic/hair conditioning). Record it as a conditioning route; its position, the surrounding formula and reset capacity decide whether it is materially weight-relevant.
- `Starch Hydroxypropyltrimonium Chloride`: cationic hair-conditioning polymer (CIR polysaccharide-gum assessment). Recognition removes an evidence gap; it does not assign `moderate` or `high`.
- `Juniperus Virginiana Oil` and other essential/fragrance oils (citrus peel oils, mint, rosemary, tea tree, lavender and similar): fragrance materials, not nonvolatile payload lipids. Keep them visible as excluded evidence; they do not increase deposition load without separate formula-specific support.
- `Glycine Soja Oil / Soybean Oil`: alias-normalized nonvolatile payload lipid.
- `Hydrogenated Vegetable Oil`: emollient/waxy payload lipid. Waxy or hydrogenated lipids are more substantive than liquid oils at a similar position; reflect that in `persistence`, not in a fixed grade.
- `PEG-40 Hydrogenated Castor Oil`, `PEG-60 Hydrogenated Castor Oil`: solubilizer/emulsifier; excluded from persistent payload evidence.
- `Glycol Distearate` and similar pearlizing waxes, and PEG thickeners (e.g. `PEG-120 Methyl Glucose Dioleate`, `PEG-150 Distearate`): excluded from persistent deposition evidence for weight. Glycol distearate still counts as the pearlizing/fatty route for `conditioningLevel` (C2); the two properties are judged separately.
- Anionic acrylate rheology polymers in a rinse-off shampoo (`Acrylates Copolymer`, `Acrylates/C10-30 Alkyl Acrylate Crosspolymer`, `Acrylates/Steareth-20 Methacrylate Copolymer`, `Carbomer`) (post-round 2): suspending and thickening agents that hold pearlizers, particles or actives in suspension. They carry no cationic charge and are recorded as excluded, not as `film_former`, like the PEG thickeners above. They therefore never count as a converging family for W1 (c) or W2. This resolves function recognition only; a cationic acrylate or acrylamide polymer (for example a `Polyquaternium-n` or an `…trimonium…` acrylamide copolymer) stays `cationic_polymer`. Any other acrylate whose role the record cannot name is unresolved (6.6, unknowns), never silently excluded.

### 6.5 Required sequence

1. **Blind formula packet first.** Judge from the normalized INCI, formula fingerprint, source/completeness facts, formula architecture and this standard only. Brand, product name, claims, previous labels, other lane judgments and catalog values are hidden (3.1).
2. **Extract objective observations** (6.3): conditioning polymers, silicones, oils/butters, fatty alcohols, refatters, proteins, film formers, unresolved weight-relevant ingredients, surfactant/reset clues and exact positions.
3. **Make the three subjudgments** (6.6) from the whole formula.
4. **Assign the final band** only after recording support, counterevidence and why the neighboring band is less likely.
5. **Unblind claims last.** Claims may corroborate intended use or expose a conflict; they cannot decide the band (3.2). "Ohne zu beschweren", "leicht" or "für feines Haar" never lowers it; "reichhaltig" or "2-in-1" never raises it (C7).
6. **Compare after freeze.** Any comparison with an earlier or approved value is made by the orchestrator after every blind result is hash-frozen, never inside a lane.

### 6.6 Subjudgments, anchors and unknowns

| Subjudgment | Values | Question | Evidence to consider |
| --- | --- | --- | --- |
| `depositionLoad` | `light`, `moderate`, `high` | How much hair-substantive conditioning material is plausibly delivered? | Cationic polymers, silicone/amino-silicone systems, lipid/fatty-alcohol/refatter architecture, protein or film-forming systems, formula prominence and reinforcing combinations. |
| `persistence` | `low`, `moderate`, `high` | How likely is the residue to remain through ordinary rinsing/repeated use or accumulate? | Persistent silicone/polymer/lipid systems, multiple depositing technologies, wash-frequency implications, ordinary rinse-off limitations, and whether routes look light or weakly retained. |
| `resetCapacity` | `weak`, `moderate`, `strong` | How strongly does the same shampoo architecture remove residue or offset weight? | Surfactant system breadth/strength (C3–C6), clarifying architecture, low-deposition architecture and counter-signals from refatting/deposition. Claimed reset intent is not evidence here. |

Strong cleansing can raise reset capacity, but it never automatically cancels deposition. Rich conditioning can raise deposition and persistence, but it never automatically makes the product `high` if reset and formula context argue otherwise. A polymer or silicone is a clue, not an automatic moderate floor.

**Band anchors**

| Value | Whole-formula conclusion |
| --- | --- |
| `low` | Deposition is absent, light or low-persistence, and the complete architecture does not support a noticeable reduction in movement or root lift after rinsing. A single light conditioning polymer, weak refatter, late protein or late oil can still be `low` when counterevidence and reset capacity support that interpretation. |
| `moderate` | The formula plausibly leaves noticeable but bounded conditioning residue. This can come from one meaningfully persistent system or interacting light/moderate routes, while rinse/reset capacity, limited richness or the ordinary rinse-off context argues against a strongly coating result. |
| `high` | Multiple converging and plausibly persistent depositing systems, or a clearly rich conditioning architecture (W-RICH) with limited reset, make noticeable loss of movement/root lift likely. One ingredient or one route kind alone is insufficient. |

**Unknowns.** If the formula is absent, materially conflicted (ID-3), not known to be complete (ID-1), or contains an unresolved weight-relevant ingredient that could plausibly move the band, return `null` or a `low`-confidence provisional band with the exact blocker. Never default an unknown to `low`.

### 6.7 Settled and round-2 clarifications

**W1 (settled by holdout-v3; scope sharpened in round 2).** Silicone plus a cationic guar plus a late amodimethicone, in a formula with an effective sulfate/betaine cleansing base and without a rich architecture (W-RICH), is `moderate`, not `high`. Source: holdout-v3 decision `loreal-elvital-hydra-hyaluronic/weightPotential` (category `product_correction`, effective `moderate`).

W1 applies only when all of its conditions hold: (a) the cleansing base is a C1/C5 sulfate chassis with a prominent buffer and `cleansingStrength` `moderate` or `strong`; (b) the deposition evidence is that silicone/guar/late-amodimethicone set; (c) no further persistent family converges (a prominent `payload_lipid`, a second cationic polymer, a `film_former`, or a protein film reinforcing the set). If any condition fails — extra converging families, a mild/sulfate-free chassis (C6), or an early oil/waxy lipid — W1 does not apply and the full method in 6.6 decides. W1 is never an argument for a lighter band outside its conditions.

*Set without amodimethicone (post-round 2).* Condition (b) names the complete set. A silicone plus a cationic guar **without** a late amodimethicone (or with an amino-silicone other than amodimethicone) is not the W1 set: W1 does not apply, and the full method in 6.6 decides. Missing an element creates no presumption in either direction: the record may not cite W1 as support for `moderate`, and the absence of amodimethicone is not by itself evidence for a lighter or heavier band.

**W-RICH Rich architecture.** "Rich" (in the `high` anchors of Sections 5 and 6 and in W1) is established only by formula evidence: prominent `payload_lipid` material converging with a silicone or cationic deposition system. A "2-in-1", "reichhaltig" or "intensive Pflege" claim never establishes it (3.2, C7).

*Limited reset (post-round 2).* W-RICH establishes richness only; it does not by itself reach the `high` weight anchor. The anchor's rich route needs W-RICH **and** limited reset, and "limited reset" means `resetCapacity: weak`. An effective ordinary chassis (`resetCapacity: moderate`, for example a C1 or C5 sulfate chassis with its buffers) or a `strong` reset is not limited. With W-RICH and `resetCapacity` `moderate` or `strong`, the band comes from the rest of the method: `high` only if the anchor's other route holds (multiple converging, plausibly persistent depositing systems that reset does not sufficiently offset), otherwise `moderate` with W-RICH recorded as the counter-signal and `high` as the neighbor (N-ALT). W3 still applies when the two bands remain closely balanced. For `conditioningLevel` (Section 5), W-RICH alone still counts as a rich architecture; reset capacity is a weight subjudgment only.

**W2 Interacting systems (boundary reasoning).** Judge deposition evidence as one system, not ingredient by ingredient. When two or more distinct deposition families (6.3) are present, a `low` band requires `whyNotNeighborBand` to name the specific formula evidence that keeps their combined residue below noticeable — for example that each family is late/trace in the list, that the only families are `weak_refatter` plus humectants, or that a strong reset faces only light routes. "No persistent system" or "one light polymer" is not a sufficient reason when a second family is present. A single deposition family without a reinforcing route, facing moderate or strong reset, can remain `low` (no polymer floor). W2 is a reasoning requirement; it never assigns a band from a family count.

**W3 Balanced boundary.** If, after the three subjudgments, two adjacent bands remain closely balanced, confidence is `low` (the product returns `needs_research`). A balanced boundary is never resolved toward the lighter band at `moderate` or `high` confidence (P0: a lighter band is the recommending direction). W3 is unchanged by the post-round-2 clarifications above.

### 6.8 Mandatory reasoning fields

Every `weightPotential` record includes:

- canonical formula identifiers, source tier, capture date and formula fingerprint;
- extracted evidence by family with exact normalized INCI positions, plus excluded and unresolved ingredients with reasons (6.3, 6.4);
- `depositionLoad`, `persistence` and `resetCapacity`, each with a concise rationale;
- formula counterevidence and unresolved facts;
- the proposed `weightPotential`;
- `whyThisBand`;
- `whyNotNeighborBand`;
- confidence with its limiting factor (6.9), and `neighboringAlternative` (N-ALT).

`whyNotNeighborBand` names the real boundary. Examples:

- `low` rather than `moderate`: the only depositing clue is light/late/weak, and reset capacity or sparse architecture makes noticeable residue unlikely.
- `moderate` rather than `low`: at least one depositing system is plausible enough that calling the product lightweight would understate the residue risk.
- `moderate` rather than `high`: deposition is plausible, but richness, persistence or limited-reset evidence is not strong enough for a heavy/coating conclusion.
- `high` rather than `moderate`: multiple persistent systems or a rich architecture converge, and reset capacity does not sufficiently offset them.

### 6.9 Weight confidence

Confidence describes robustness under INCI-only uncertainty, not measured accuracy. It follows Section 12, applied to weight:

| Confidence | Use when |
| --- | --- |
| `high` | Formula identity is exact and complete, recognition gaps are immaterial, the subjudgments converge, and reasonable unknown formulation details would not plausibly move the band. |
| `moderate` | One band is best supported, but realistic unknowns could move it one adjacent band. This is the normal ceiling for many INCI-only calls. |
| `low` | Material source conflict, recognition gaps, incomplete formula, closely balanced neighboring bands (W3) or missing context prevent a dependable band. |

No percentages. Two agreeing classifiers improve repeatability evidence; they do not prove finished-product accuracy.

### 6.10 Direct property versus derived fit

`weightPotential` is a direct product property. Thickness fit and the live `weight` are derived from it (13.4); `weightPotential` projects 1:1 into `weight` (W-LIVE) and is not re-judged for that projection. When `weightPotential` changes, refresh only outputs demonstrably derived from it; do not reopen other properties unless the changed weight interpretation exposes a direct dependency.

A broad one-directional shift of weight labels against an earlier baseline is a review trigger for the orchestrator, not proof that either set is correct, and never a reason to tune labels toward a distribution.

### 6.11 Operator self-check

Before accepting a weight record, confirm:

- the formula fingerprint matches the frozen packet;
- claims and previous labels were hidden during the formula judgment;
- no ingredient, family count or position window directly assigned the band;
- all three subjudgments are present with rationales;
- counterevidence and `whyNotNeighborBand` are specific (W2 where it applies);
- confidence names the limiting uncertainty without invented accuracy;
- any comparison with an earlier value happens only after the blind result is frozen, outside the lane.

## 7. Primary focus

Primary focus is the dominant intended role. Claims identify the candidate job; the complete formula must support or at least remain compatible with it; a meaningful counter-signal is always recorded. No single hero ingredient proves a focus.

### 7.1 Focus values

| Value | Meaning |
| --- | --- |
| `volume` | Lift/body/fullness is the dominant job and the formula is compatible with it. |
| `shine` | Gloss/smoothness is the dominant job, plausibly supported through smoothing, acidic alignment or a light film. A shine shampoo may be low-conditioning and low-weight. |
| `repair` | Damage care for broken, brittle, chemically or mechanically stressed lengths, with a `repair_supported` or tie-broken `dual_supported` care-direction verdict (7.3). |
| `moisture` | Hydration, dryness relief or nourishment of dry lengths, with a `moisture_supported` or tie-broken `dual_supported` verdict (7.3). |
| `clarifying` | Explicit deep-cleaning/reset or oily-scalp/oily-root/buildup role with compatible architecture (F6). |
| `scalp_active` | A formula-compatible, explicitly targeted cosmetic scalp need: sensitive, itchy or dry-feeling scalp, or anti-dandruff positioning. Oily-scalp positioning is `clarifying`, not `scalp_active` (F6). It does not by itself assert a recognized anti-dandruff active; `dandruffSupport` says that. |
| `general` | Honest fallback: no specialist focus has a coherent claim-plus-formula case, the formula evidence is nonspecific, or competing directions cannot be resolved conservatively. |

### 7.2 Decision table

| Situation | Decision |
| --- | --- |
| One dominant exact-product claim plus compatible formula route | Use that focus. |
| Multiple claims but one dominates name/range/instructions | Use the dominant compatible focus. |
| Strong formula route without matching product positioning | Usually keep the positioned focus and record the route as a trade-off. |
| Unsupported, contradictory or generic claims | `general`. |
| Problem-led product with recognized dandruff active and anti-dandruff positioning | `scalp_active`. |
| Explicit sensitive/itchy/dry-feeling scalp positioning (SC1) with `scalpComfortTarget: targeted` | `scalp_active`. |
| Explicit deep-cleaning/reset product with compatible architecture | `clarifying`. |
| Oily-scalp/oily-root positioning (E2 oily lexicon) with compatible architecture | `clarifying` (F6). |
| Only mild/gentle cleansing positioning, no scalp target | Not a focus. Use the next dominant compatible job or `general`; mildness is captured by `cleansingStrength` and `usageRole`. |
| Dominant claim is hair loss, hair growth or hair density | Ignore it for focus (F5); use the next dominant in-scope compatible job, else `general`. |
| Scalp-specialist claim and a lengths-care claim compete | F7. |

A strong-cleansing repair shampoo remains `repair` when that is its dominant compatible role; cleansing strength captures the chassis. A strong-cleaning everyday repair shampoo is not automatically `clarifying`. A shine shampoo can be `shine` with light conditioning and low weight when it is positioned for gloss and has a plausible smoothing, acidic, film or cuticle-alignment route.

### 7.2a Focus clarifications (round 2)

**F5 Hair-loss claims.** Hair-loss, hair-growth and hair-density claims are medically adjacent and out of scope (E2, S-HAIRLOSS). They never select, support or break a tie for any focus. Determine focus from the remaining in-scope claims (a remaining lengths-care claim is a candidate checked against the formula as usual); if none remains, `general`. A caffeine or other "anti-hair-loss" ingredient is not a focus route.

**F6 Oily scalp and `clarifying` compatibility.** Oily-scalp and oily-root positioning is part of `clarifying` (7.1), never `scalp_active`. `clarifying` is formula-compatible when `cleansingStrength` is `moderate` or `strong`, `conditioningLevel` is not `high` and `weightPotential` is not `high`; this applies to deep-cleaning/reset positioning and to oily-scalp positioning alike. An incompatible formula falls to the next dominant compatible job or `general`, and the record names the failed condition. The focus value never changes cleansing intensity (I1): only an explicit deep cleanser (D1 true) with a `strong` formula records `clarifying`; a strong-cleansing oily-scalp shampoo without D1 records `regular` (ruling R16.2).

**F7 Scalp-specialist versus lengths-care claims.** When the product carries both a qualifying scalp claim for `scalp_active` (an E2 sensitive, dry or dandruff claim unit; a name word without the scalp, such as "sensitiv" alone, is not one, see E1) and a lengths-care claim (repair, moisture, volume, shine):

1. the role named in the exact product name is primary; a range or line word inside the product name counts as the name (E1);
2. if both or neither appear in the product name, `scalp_active` is primary (the problem-led, narrower role), provided it is formula-compatible under 7.2 (dandruff active for dandruff positioning, `scalpComfortTarget: targeted` for sensitive or dry positioning); otherwise the lengths-care role is primary if compatible, else `general`;
3. the other role is secondary only if it also passes Section 8 (distinct positioning and an independent route).

*Name words that do not name the scalp (post-round 2).* A product-name word such as "Sensitiv", "Sensitive", "Mild", "Sanft", "Basis" or "Beruhigend" that does not name the scalp names no role for F7 step 1: it is neither a scalp role nor a lengths-care role, and it is ignored when steps 1 and 2 ask which role the product name names. F7 applies only when the product also has a qualifying scalp claim unit (above); a non-scalp name word alone never brings F7, `scalp_active`, `targeted` (SC1) or a scalp target into play, and focus is decided by 7.2 as usual.

**F-TRACE Decision trace (from the v1.4 operational amendment).** The `decisionTrace` (7.4) records, for primary focus: the claim direction or `null`, whether the formula is compatible, one compatible route, and the decision reason. For secondary focus: that the empty default was considered, the selected values, the matching distinct claims, the independent routes, why each is distinct from the primary, and the exception code when two values are used. For usage role (Section 9): the default `regular`, the exact non-default trigger code if any, the trigger evidence (at least one concise evidence string for every non-default trigger) and the rationale.

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
- `neighboringAlternative` (a different focus value, or `none` when focus confidence is `high`; N-ALT);
- `decisionTrace`: plain-language account of how formula, counter-signal and claim resolved the focus.

## 8. Secondary focus

Secondary focus is optional. Empty is a complete and expected value.

Include one secondary focus only when all are true:

1. distinct secondary exact-product positioning exists;
2. an independent compatible formula route exists;
3. it is not a synonym for the primary focus or a restatement of cleansing/conditioning/weight.

**F2 (holdout-v3 operator clarification, now normative).** A benefit that is only an outcome of the same smoothing, deposition or restorative route used by the primary focus is not a secondary focus. Example: a `shine` claim delivered by the same silicone/smoothing route as the primary care focus does not add `shine`. Source: holdout-v3 decision `loreal-elvital-hydra-hyaluronic/focusSecondary` (effective `[]`).

**F3 Route independence (round 2).** A secondary route is independent only if it rests on at least one ingredient or system that the primary focus's recorded route does not cite. One ingredient never carries two focus routes; if the only formula support for the secondary claim is an ingredient already cited for the primary, the secondary is empty.

**F4 pH adjusters (round 2).** Acids and their salts used as pH adjusters or buffers (`Citric Acid`, `Lactic Acid`, `Sodium Citrate`, `Sodium Lactate`, `Sodium Hydroxide`) are never an independent focus route on their own. They may support compatibility of a primary `shine` focus (acidic alignment, 7.1) but cannot create a secondary `shine`.

Two values require explicit multi-benefit positioning, two independent routes, both distinct from the primary and from each other, and a written `explicit_multi_benefit_two_routes` exception that says why one secondary value would hide a material product role. Never use `general` as secondary, never repeat the primary focus, never use more than two values.

Invalid secondary patterns (from the v1.4 operational amendment):

| Invalid pattern | Use instead |
| --- | --- |
| `general` as a secondary value | Leave secondary empty. |
| `shine` because a repair or moisture formula may smooth hair | Only if shine is separately positioned and has an independent route (F2, F3). |
| `repair` for any protein or panthenol trace | Only when claim and route are both meaningful. |
| `clarifying` only because cleansing is strong | `cleansingStrength: strong`; usage needs its own trigger (Section 9). |
| A mildness or "gentle" benefit | Record cleansing strength and scalp exposure facts; not a focus. |

## 9. Usage role

Usage role defaults to `regular`.

| Value | Trigger code | Required product-level trigger |
| --- | --- | --- |
| `regular` | `none` | No non-default trigger. This includes many ordinary strong-cleansing shampoos. |
| `frequent` | `explicit_frequent_non_strong` | Explicit frequency wording (U2) **and** `cleansingStrength` is not `strong`. |
| `alternating` | `strong_plus_reset_intent` | `cleansingStrength: strong` **and** reset intent (U4). Strong cleansing alone is insufficient; a `moderate` formula is never `alternating`. |
| `occasional_reset` | `explicit_deep_cleansing` | D1 true (Section 13.6). It stays in this cohort as a regular shampoo; I1 decides its intensity and D2 the deep-cleanser flag, both only with a `strong` formula (R16.2, R16.3). |
| `treatment` | `recognized_active_problem_led` | `dandruffSupport: supported` **and** a qualifying E2 dandruff claim (U3). |

These triggers are conjunctive and checked mechanically after `cleansingStrength` is final. Every non-default value records its trigger code and at least one evidence string (F-TRACE). Only claims graded `moderate` or `high` (CL-SRC) can fire a trigger. Example: once holdout-v3 settled Eucerin DermoCapillaire pH5 at `moderate` cleansing, its explicit frequent-use positioning made `frequent` correct (decision `eucerin-dermocapillaire-ph5/usageRole`).

**U1 Precedence (round 2).** When more than one trigger fires, the first in this order wins: `occasional_reset`, `treatment`, `alternating`, `frequent`, `regular`. The losing triggers are recorded in the trace. (From the v1.4 operational amendment: a product that is both active-led and positioned for regular use is `treatment` when the recognized active is the reason to choose it.)

**U2 Frequency wording.** The `frequent` trigger requires explicit frequency wording: "täglich", "tägliche Anwendung", "für jeden Tag", "Every-Day"/"Everyday", "für häufiges Waschen", "häufige Haarwäsche", "daily", "frequent use". "Mild", "sanft" or "sensitiv" without frequency wording does not fire it.

**U3 `treatment` scope.** `treatment` needs both the recognized anti-dandruff active and a qualifying E2 dandruff claim unit graded `moderate` or `high`. An active without dandruff positioning (S-DANDRUFF note `active_without_dandruff_positioning`) is not `treatment`; check the other triggers. Hair-loss, hair-growth or caffeine positioning is out of scope and never fires `treatment` (F5).

**U4 Reset intent for `alternating`.** Reset intent is a claim graded `moderate` or `high` containing any D1 lexicon term, the E2 oily lexicon (oily scalp or roots), or buildup/residue wording ("klärend", "Klärung", "entfernt Rückstände", "Ablagerungen", "Build-up", "Detox"). Reset intent can only fire `alternating`; it never moves `cleansingStrength` (Section 4) and never makes the observed intensity `clarifying` (I1, ruling R16.2: `alternating` alone records `regular`).

**U5 Deep-cleansing name with daily-use directions.** D1 is decided by its own sources (13.6). When D1 is true and the usage directions explicitly allow daily or frequent use, `usageRole` stays `occasional_reset` (U1) and the conflict is recorded. With `cleansingStrength: strong` the product receives `review_reset_positioning_mismatch` (D3); otherwise the conflict is part of the informational note `deep_cleansing_name_ordinary_formula` (D3, ruling R16.3).

This is not personalized cadence. Later fit logic may recommend a different schedule for a specific profile.

## 10. Scalp comfort target

`scalpComfortTarget` asks whether the product intentionally supports sensitive, dry-feeling, itchy or uncomfortable scalp. It does not diagnose disease or guarantee tolerability.

Use `targeted` when the post-unblind product is explicitly positioned for sensitive/itchy/dry-feeling scalp and the complete formula has a credible supportive architecture. Evaluate the whole formula:

- supportive signals: mild/balanced cleansing, humectant/refatting support, fragrance-free positioning, allantoin/panthenol or comparable comfort routes, explicit sensitive/anti-itch intent;
- counter-signals: strong reset, high fragrance/essential-oil exposure, cooling agents or other plausible irritation signals.

Menthol, mint or fragrance is a counter-signal, not an automatic veto. In an explicitly sensitive or anti-itch product it can remain `targeted` when the overall architecture supports the role. Cleansing strength separately captures when the formula may be less suitable for dry-sensitive profiles.

**CSA Credible supportive architecture (post-round 2).** The formula has a credible supportive architecture only when at least one route from the E4 comfort list or the E4 humectant/refatting list (13.3) is prominent (E3). The lists are closed here as in E4 (ruling R16.4): a prominent unlisted ingredient does not count, and the record names it (`unlisted_route_candidate:<INCI name>`, carried into S-FAIL where a gate fails).

- Not sufficient on their own, alone or together: a mild cleansing chassis (C6 `low`), the absence of fragrance or of a declared `Parfum`, an acidic pH, and positioning wording. They are supportive signals that may raise confidence once a listed route is present.
- Counter-signals: `cleansingStrength: strong`; a prominent cooling agent (`Menthol`, `Menthyl Lactate`, `Menthoxypropanediol`, mint oils); prominent essential oils. With a listed prominent route present they do not veto `targeted`; they are recorded, `targeted` confidence is at most `moderate`, and the neighbor is `not_targeted` (N-ALT).
- Without a listed prominent route, an explicitly positioned product is `not_targeted`; the record names the missing route. Its S-SENSITIVE or S-DRY gate therefore fails (S-FAIL), which sends the product to review instead of quietly passing.

CSA is the formula half of `targeted`. The positioning half is SC1. R12 (with R15 and R16.1) reuses CSA on its own for the research-only combination (E2b).

Use `not_targeted` for complete ordinary formulas without this intent/support. Use `unknown` only when formula identity/completeness or conflicting evidence prevents the decision.

**SC1 What counts as explicit positioning (round 2).** "Explicitly positioned" means at least one E2 sensitive or E2 dry claim unit (13.3) graded `moderate` or `high` (CL-SRC). In addition:

- itch, dryness, tightness or redness words that occur only inside a dandruff claim unit (E2a), or in a unit bundled with a dandruff claim (E2b, ruling R12), are dandruff symptoms, not sensitive or dry-scalp positioning, and do not by themselves make the product `targeted`. A separate sensitive- or dry-scalp unit on a product whose primary target is `dandruff` is still SC1 positioning for `scalpComfortTarget`, but it never creates a projected target (E2b, rulings R15, R16.1);
- a product-name word that does not name the scalp ("sensitiv", "beruhigend", "sanft") is not explicit positioning on its own; it counts only together with a scalp-naming claim unit from a manufacturer or pack source, and is then graded by that source;
- protective or "does no harm" wording ("trocknet die Kopfhaut nicht aus", "ohne zu reizen", "hautverträglich", "dermatologisch getestet", "pH-hautneutral", "schont empfindliche Kopfhaut", "auch für empfindliche Kopfhaut geeignet") is mildness, not targeting (E2a);
- ingredient-reputation sentences ("Aloe Vera ist bekannt dafür, die Kopfhaut zu beruhigen", "X gilt als …", "X wird traditionell … verwendet") describe an ingredient, not the product, and are not positioning (E2a).

`targeted` additionally requires the credible supportive architecture (CSA) above. A `targeted` product still has to pass the S-SENSITIVE or S-DRY formula gate separately; `targeted` alone never creates a target.

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

Confidence also fixes `neighboringAlternative` (N-ALT): `high` means `none`, `moderate` or `low` means one named neighbor.

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
- `observedCleansingIntensity` (formula strength plus D1 only, I1) and the projected `weight` are product truth. They are never chosen, softened or sharpened to match a bucket's expected intensity or a thickness.
- Legacy catalog rows, coverage of a thickness × scalp cell, product popularity and "is recommended" status are never inputs to a classification or projection rule. Coverage is enforced separately as an apply gate (13.11, N1, ruling R5): a gap blocks the apply and goes to Nick, who may add a named exception to the register (13.12). A gap is never closed by bending a rule for one product.
- A review flag is blocking: the projection is a proposal and cannot be applied until Nick rules on that product.
- If two rules in this section appear to conflict, apply the one with the more conservative outcome and raise `review_rule_conflict`.

### 13.3 Evidence definitions

**E1 Exact-product positioning.** Text that belongs to the exact German product: product name, pack front/back claims, the current exact manufacturer DE page's product claims and usage directions. Retailer copy counts only where it reproduces the manufacturer claim for the exact GTIN. Range-level or brand-level claims do not count. Positioning evidence confidence: `high` when the claim is in the product name or pack front; `moderate` when only on the pack back or exact manufacturer page; `low` when only in retailer copy or ambiguous. Low positioning confidence cannot support a target.

- *Product name* is the full exact product name as frozen, including range or line words that are printed as part of it. A name word still has to meet E2 (name the scalp) to count as a scalp claim.
- When the frozen packet labels sources only as `manufacturer` or `retailer` and does not separate pack front from back, a manufacturer-source claim is `moderate` and only the product name is `high`.
- *Foreign-language manufacturer page (post-round 2).* A manufacturer page in another language or for another market (for example an English or UK page) is not the exact German manufacturer page, even when it shows the same product. Its claims are graded `low`, like retailer copy, unless a German source for the exact product (pack, exact German manufacturer page, or German retailer copy for the exact GTIN) carries the same claim in German; the claim is then graded by that German source, and the foreign page is only corroboration. A foreign page never counts as a formula source for the German product unless Section 2 allows it.
- The same grading applies to every other claim use in this standard (CL-SRC, Section 3.2).

**E2 Scalp-claim lexicon.** A scalp claim must name the scalp (or roots/ansatz for oily). Hair-length claims never count as scalp claims. Lexicon terms match case-insensitively on their stems, including inflections and compounds ("juckende Kopfhaut", "Kopfhautjucken", "fettigen Ansatz", "Anti-Schuppen-Shampoo"). Terms outside the lexicon do not qualify; the record notes them.

| Target | Qualifying claim (German examples) | Does not qualify |
| --- | --- | --- |
| `dandruff` | "Anti-Schuppen", "gegen Schuppen", "Schuppen" as the product's problem | "Schüppchen durch trockene Kopfhaut", "anti-flake" wording without "Schuppen" as the treated problem |
| `sensitive` | "sensible/empfindliche Kopfhaut", "Juckreiz", "gereizte Kopfhaut", "beruhigt die Kopfhaut", "Kopfhaut Sensitive" | "mild", "sanft", "für jeden Tag" without a scalp condition |
| `dry` | "trockene Kopfhaut", "Spannungsgefühl der Kopfhaut", "trockene Kopfhautschüppchen" | "trockenes Haar", "trockene Längen", "Feuchtigkeit für das Haar" |
| `oily` | "fettige Kopfhaut", "schnell fettendes Haar", "fettiger Ansatz", "Anti-Fett", "überschüssiger Talg" | "Frische", "Leichtigkeit", "Volumen", "Fülle" without an oil/sebum claim |

Hair-loss, hair-growth or hair-density claims ("Haarausfall", "Wachstum", "Grow", "Coffein gegen Haarausfall") are medically adjacent and out of scope. They never create a scalp target and never count toward any gate.

**E2a Claim units (round 2).** A *claim unit* is one product-name phrase, one headline, one bullet or one sentence. Rules:

- A claim unit qualifies when it states that the product is for, against or acts on the scalp state: "für/bei …", "gegen …", "beruhigt/lindert/reduziert/reguliert …", "beugt … vor", or the state as the product's named problem ("Anti-Schuppen", "Kopfhaut Sensitive").
- Protective or "does no harm" wording never qualifies: "trocknet die Kopfhaut nicht aus", "ohne auszutrocknen", "ohne zu reizen", "hautverträglich", "dermatologisch getestet", "pH-hautneutral".
- *Sparing and tolerance wording (post-round 2).* A unit that says the product spares or tolerates a scalp state, rather than acting for or on it, is protective wording even when it names the state: "schont (empfindliche) Kopfhaut", "schonend zur Kopfhaut", "auch für empfindliche Kopfhaut geeignet". This holds wherever the unit stands; under a heading about mildness or gentle cleansing ("Mild", "Sanfte Reinigung") it is never read as positioning.
- *Ingredient-reputation sentences (post-round 2).* A unit whose subject is an ingredient and which reports its reputation, traditional use or general property ("Bio-Aloe Vera ist bekannt dafür, die Kopfhaut zu beruhigen", "Hafer gilt als beruhigend", "Kamille wird traditionell … verwendet", "X ist reich an …") describes the ingredient, not the product. It never qualifies. A unit qualifies only when the product itself, named or implied, is the one acting on the scalp state ("beruhigt die Kopfhaut", "Deine juckende Kopfhaut wird beruhigt").
- **Dandruff units absorb their symptoms.** A claim unit that names dandruff ("Schuppen") is a dandruff claim only. Itch, dryness, tightness, redness or oiliness words in the same unit ("gegen Schuppen und Juckreiz", "bei Schuppen, trockener und juckender Kopfhaut") never create a sensitive, dry or oily claim and never add a target. A second target needs its own claim unit that does not name dandruff and is not bundled with a dandruff claim (E2b).
- A unit that names two non-dandruff states (for example oily and sensitive) counts for both, subject to S-SECONDARY.

**E2b Comfort wording bundled with a dandruff claim, and the dandruff path (rulings R12, R15, R16.1).** Bundling (layer 1 below) applies to every product with a qualifying E2 dandruff claim unit, whether or not its dandruff target passes S-DANDRUFF. The research-only combination (layer 2) additionally requires the `dandruff` target to be projected as the primary target. Anti-dandruff is the path: within it a product can additionally be for a sensitive or a dry scalp, never outside it (R15, R16.1).

- *Comfort wording* is itch, soothing, irritation, redness or tension wording about the scalp: "Juckreiz", "juckende Kopfhaut", "beruhigt", "beruhigende Pflege für die Kopfhaut", "lindert", "gereizte Kopfhaut", "Rötungen", "Irritationen", "Spannungsgefühl", and their inflections (E2). *Dryness wording* is E2 dry-scalp wording other than tension ("trockene Kopfhaut"). Oily wording is not covered by E2b.
- *Bundled* means the comfort or dryness wording (a) sits in a dandruff claim unit (E2a), or (b) stands in its own unit next to a dandruff unit of the same source: the same paragraph, the sentence directly before or after, a headline and its subline or body, or the same bullet list. When a packet gives a source's claims as a plain list without layout, consecutive entries count as next to each other. The product name is its own unit and is next to no source text. When it is unclear whether a unit is bundled or separate, it is bundled (P0: bundled wording never creates a projected target).
- *Separate* means a unit with sensitive- or dry-scalp wording that does not name dandruff and is not bundled, for example "Für empfindliche Kopfhaut" as its own headline or in its own bullet list or paragraph with no dandruff unit. A separate unit keeps the normal S-SECONDARY path, except on a product whose primary target is `dandruff`: there a separate sensitive-scalp unit (ruling R15) or a separate dry-scalp unit (ruling R16.1) never projects a secondary `sensitive` or `dry` target and is handled in layer 2 below (research-only combination).

Bundled comfort wording, and the separate sensitive- or dry-scalp units of a `dandruff`-primary product, are handled in two layers:

1. **Projection (live rows).** `dandruff` stays the only target projected from the dandruff claim, its bundled wording and, on a `dandruff`-primary product, any separate sensitive- or dry-scalp unit. Such wording never creates a projected `sensitive` or `dry` target and never adds a row (E2a, S-SECONDARY); bundled wording also never counts as SC1 positioning. On a `dandruff`-primary product these units are not projection candidates, so S-FAIL and the note `claimed_target_not_projected:<target>` never apply to them. Only a separate unit on a product whose primary target is not `dandruff` can add a projected secondary `sensitive` or `dry` target.
2. **Research-only combination.** Each value of `researchCombinationTargets` is decided on its own, in the order `sensitive`, `dry`:
   - `sensitive` (R12, R15): bundled comfort wording, or a separate sensitive-scalp unit, from a source graded `moderate` or `high` (CL-SRC) **and** a passed S-SENSITIVE formula gate → `"sensitive"` and the informational note `suits_dandruff_with_irritated_scalp`. If the gate fails, or the wording is graded `low`, `"sensitive"` is not recorded and only the note `dandruff_bundled_comfort_wording` is recorded.
   - `dry` (R16.1): a separate dry-scalp unit from a source graded `moderate` or `high` **and** a passed S-DRY formula gate → `"dry"` and the informational note `suits_dandruff_with_dry_scalp`. If the gate fails, or the unit is graded `low`, `"dry"` is not recorded and only the note `dandruff_dry_scalp_wording` is recorded. Bundled dryness wording never feeds `dry` (it is a dandruff symptom, layer 1).
   - *Formula gates.* Because bundled wording is by definition not SC1 positioning, the gates' `scalpComfortTarget: targeted` clause is read as its formula half, CSA (Section 10); for a separate unit graded `moderate` or `high` SC1 holds anyway, so the reading is the same. The S-SENSITIVE gate is therefore CSA **and** at least one prominent comfort route (E4); the S-DRY gate is CSA **and** at least one prominent humectant/refatting route (E4).
   - With `cleansingStrength: strong` a value is still recorded and its note names `strong_cleansing` (no review flag, because nothing is projected). A note for a value that is not recorded quotes the wording and names the failed clause (and any `unlisted_route_candidate:<INCI name>`).

R12 ruled the dandruff + irritated (`sensitive`) combination for bundled wording; R15 extended it to a separate sensitive-scalp unit, and R16.1 added the dandruff + dry-scalp (`dry`) combination for a separate dry-scalp unit. Bundled tension wording ("Spannungsgefühl") is comfort wording and feeds the `sensitive` combination. Bundled dryness wording is absorbed (no target, layer 1) and records no combination. `researchCombinationTargets` never feeds T6, S-FOCUS, row assembly, `required_protocol_roles`, N1 or `review_live_value_differs`. It exists so that a later profile feature that can express dandruff plus an irritated or dry scalp together (R12 follow-up, a separate project) can prefer such products.

**E3 Prominent ingredient (INCI-order proxy).** An ingredient is *prominent* when it is listed before `Parfum`/`Fragrance`; if the formula declares no fragrance, before the first of `Sodium Benzoate`, `Potassium Sorbate`, `Phenoxyethanol`, `Benzyl Alcohol`, `Methylisothiazolinone`, `Methylchloroisothiazolinone`, `Sodium Salicylate`; if none of these is present, it is not prominent. This is a repeatability convention for projection gates and for the cleansing (C4) and conditioning (C2) position conventions only. It is not a concentration claim and never a weight rule (Section 6 forbids position windows).

Only a declared `Parfum`, `Fragrance` or `Parfum (Fragrance)` entry is the fragrance marker. Essential oils and fragrance allergens (`Limonene`, `Linalool`, citrus peel oils and similar) are not; when they are declared without `Parfum`, use the preservative fallback.

**E4 Route lists for scalp gates.** A route counts only if at least one listed ingredient is prominent (E3). Lists are closed in this standard (revised in round 2; kept closed by ruling R16.4): an unlisted ingredient never passes a gate inside a classification lane. When a gate fails only because a prominent unlisted ingredient might be a comfort or humectant route, the lane applies S-FAIL and names the ingredient in the flag detail (`unlisted_route_candidate:<INCI name>`). Adding an ingredient to a list is a ruling by Nick that applies to all products from then on. Ruling R16.4 keeps the E4 lists, the C2 humectant list and the CSA lists closed and unchanged for v1.6: the `unlisted_route_candidate` names raised during the Track A/B research are collected, and additions are decided in one batch afterwards.

- Comfort routes: `Panthenol`, `Allantoin`, `Bisabolol`, `Urea`, `Polidocanol`, `Dipotassium Glycyrrhizate`, `Avena Sativa Kernel Extract`/`Avena Sativa Kernel Flour`, `Niacinamide`.
- Humectant/refatting routes: `Glycerin`, `Urea`, `Sorbitol`, `Panthenol`, `Sodium PCA`, `Sodium Lactate`, `Betaine`, `Sodium Hyaluronate`, `Glyceryl Oleate`, `PEG-7 Glyceryl Cocoate`, `Glyceryl Cocoate`, and nonvolatile plant oils, butters and hydrogenated/waxy lipids from the Section 6.3 `payload_lipid` family (not fatty alcohols or emollient ethers/esters, and never essential oils, 6.4).

**E5 Neighboring alternative.** The `neighboringAlternative` recorded on a direct property, fixed by N-ALT (Section 1.1). Projection rules use it only to raise review flags, never to change a value.

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

The neighbor is the one fixed by N-ALT, so a `high`-confidence input never raises T4. "After T6" is intentional: for a scalp-concern target, a fit that the neighbor would push from `acceptable` to `not_suited` is lifted back to `acceptable` by T6, so the final tier does not change and no flag is raised (R4: thickness never hides a scalp-concern product). An `ideal` fit that the neighbor would make `acceptable` is still flagged for every target.

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

This reproduces every T1/T6 cell except one: coarse × C `high` × W `low`/`moderate` is `ideal` in T1 but would show amber live, because conditioning is not a live field. That divergence is in the conservative direction and is permitted by P0. A conditioner-identical ordered axis (fine=light, normal=moderate, coarse=heavy, one step = amber, two steps = red, or any per-user shift) does **not** reproduce T1: it would turn normal × light amber and hide coarse × light rows, contradicting T1 and, for scalp-concern products, R4. The final live rule is open question 1 (README, *Open after lock*).

### 13.5 Scalp targets

Each target has a positioning gate (E1, E2) and a formula gate. Both must pass. The dandruff and sensitive targets are medically adjacent; their formula gates require formula evidence and can never be passed by marketing alone.

The scalp match is exact (ruling R4): the thickness relaxation in T6 never relaxes a gate in this section, and a target whose gate cannot be decided with certainty is not emitted (P0).

**S-DANDRUFF.** Positioning: E2 dandruff claim. Formula: `dandruffSupport: supported`. Both required. If `dandruffSupport: supported` without a dandruff claim, emit no dandruff target and record the informational warning `active_without_dandruff_positioning` (not a review flag; already conservative). Itch, soothing, tension or dryness wording in or next to the dandruff claim is handled by E2a/E2b (ruling R12): it never adds a projected target and may only add the research-only `researchCombinationTargets`.

**S-SENSITIVE.** Positioning: E2 sensitive claim. Formula: `scalpComfortTarget: targeted` **and** at least one prominent comfort route (E4). If `cleansingStrength: strong`, emit the target with `review_strong_cleansing_comfort_route`.

**S-DRY.** Positioning: E2 dry-scalp claim. Formula: `scalpComfortTarget: targeted` **and** at least one prominent humectant/refatting route (E4). If `cleansingStrength: strong`, emit the target with `review_strong_cleansing_comfort_route`. Dry hair or dry lengths never create this target.

S-SENSITIVE and S-DRY project a target only on a product whose primary target is not `dandruff`. On a `dandruff`-primary product their formula gates are evaluated only for the research-only combination (E2b layer 2; rulings R15, R16.1).

**S-OILY.** Positioning: E2 oily claim. Formula: `cleansingStrength` is `moderate` or `strong` **and** `weightPotential` is not `high` **and** `conditioningLevel` is not `high`. The weight clause is confirmed by ruling R4 and holds at every thickness; T6 never overrides it. The only permitted deviation is a named entry in the exception register (13.12); currently X1.

**S-ORDINARY (revised in round 2).** `ordinary` is the primary target whenever no specialist target is emitted. It is reached in exactly four ways, and the rationale names which:

1. the product makes no qualifying E2 claim unit (after E2a);
2. its only scalp-adjacent positioning is hair loss/growth (S-HAIRLOSS);
3. it has a recognized dandruff active but no dandruff claim (S-DANDRUFF, note `active_without_dandruff_positioning`);
4. a claimed target failed and nothing else passed (S-FAIL, with review flag).

**S-FAIL (specialist gate failure, revised in round 2).** A specialist target *fails* when the product has an E2 claim unit for it but either its positioning gate fails (the only qualifying claim units are graded `low`, E1) or its formula gate fails.

- If no other specialist target passes: propose `ordinary` as primary and add `review_specialist_gate_failed` naming the failed target and gate (and `unlisted_route_candidate:<INCI name>` where E4 applies). The proposal is not applied until Nick rules.
- If another specialist target passes: project the passing target(s) as usual and record the failed one as the informational note `claimed_target_not_projected:<target>` (not emitting a target is already conservative).
- S-FAIL does not apply where a named register exception (13.12) lets that target pass for a thickness.
- S-FAIL does not apply to a sensitive- or dry-scalp unit on a `dandruff`-primary product: that unit is not a projection candidate (E2b layer 1; rulings R15, R16.1), and a failed combination gate is recorded only as its E2b note.

**S-PRIMARY (precedence).** If several specialist targets pass, the primary is the one named in the exact product name; otherwise the first in this order: `dandruff`, `sensitive`, `dry`, `oily`.

**S-SECONDARY.** At most one secondary target. It requires its own distinct E2 claim unit (never a symptom inside a dandruff unit, E2a, and never comfort or dryness wording bundled with a dandruff claim, E2b) and its own formula gate pass. For a dandruff product (ruling R12): bundled comfort wording is handled by E2b only (research-only `researchCombinationTargets`, never a projected secondary); a separate, explicit sensitive-scalp unit also never projects a secondary `sensitive` target (ruling R15: anti-dandruff is the path, sensitive is a sub-attribute within it) — it feeds the research-only combination exactly like bundled wording (E2b layer 2), so an irritated-only user is never sent to an anti-dandruff active. A separate dry-scalp unit is handled the same way (ruling R16.1): it never projects a secondary `dry` target on a `dandruff`-primary product and feeds only the research-only `dry` combination (E2b layer 2), so a dry-scalp-only user is never sent to an anti-dandruff active either. A `dandruff`-primary product can therefore carry only an `oily` secondary target, when its own separate oily unit passes S-OILY. When more than one candidate qualifies for secondary, the precedence of S-PRIMARY decides (product name first, then `dandruff`, `sensitive`, `dry`, `oily`). Never permitted:

- `ordinary` as secondary (a scalp-specialist product is not also projected to balanced scalp);
- the pair `oily` + `dry` (contradictory scalp states);
- a third qualifying target; keep primary plus the highest-precedence secondary and add `review_extra_scalp_target`.

**S-HAIRLOSS.** Hair-loss/growth positioning (E2 exclusion) is ignored for targets. A product whose only scalp-adjacent positioning is hair loss projects `ordinary`, the rationale states that the hair-loss claim was not evaluated, and the informational note `hair_loss_claim_not_evaluated` is recorded. The note is also recorded when hair-loss positioning sits next to other positioning.

**S-FOCUS consistency (extended in round 2).** Add `review_focus_target_mismatch` when any of these holds:

- a `dandruff`, `sensitive` or `dry` target is projected while neither `focusPrimary` nor `focusSecondary` is `scalp_active`;
- an `oily` target is projected while neither `focusPrimary` nor `focusSecondary` is `clarifying` (F6);
- `focusPrimary` or `focusSecondary` is `scalp_active` but the primary target is `ordinary` and no S-FAIL flag is already raised (a scalp role without a projected scalp target that nothing else explains).

### 13.6 Cleansing intensity and deep-cleanser listing

**I1 Observed intensity** (mechanical, no judgment; revised per R6 to cover reset products that now stay in the cohort, and per ruling R16.2):

- `cleansingStrength: low` -> `gentle`;
- `cleansingStrength: moderate` -> `regular`;
- `cleansingStrength: strong` with D1 true (an explicit deep cleanser, below) -> `clarifying`;
- any other `cleansingStrength: strong` -> `regular`.

Only explicit deep cleansers record `clarifying` (ruling R16.2). A strong-cleansing shampoo without D1 records `regular`, including an oily-scalp shampoo with `clarifying` focus and an `alternating` product fired by reset intent (U4); for oily scalp it is therefore green. Focus and `usageRole` are not inputs to I1.

**I2 Never adjusted.** The observed intensity is written to every row of the product unchanged, even when it differs from the bucket's expected intensity (13.1). A resulting `supportive` match is a truthful trade-off, not an error.

**I3 Boundary review (direction-aware, revised in round 2).** Recompute I1 with `cleansingStrength` replaced by its `neighboringAlternative` (N-ALT) and every other property and D1 unchanged. For each projected bucket, add `review_intensity_boundary` naming the bucket only when the current observed intensity **equals** the bucket's expected intensity (13.1) and the neighbor's intensity would **not**. That is the case where doubt sits on the recommending side: the row is green, or ranked in the dandruff role, only because of the current call.

When the current intensity already differs from the bucket's expectation (an amber row), no flag is raised even if the neighbor would match: the mismatch is already the conservative outcome (I2). A `high`-confidence `cleansingStrength` (neighbor `none`) never raises I3.

**D1 Explicit reset positioning** (`positioning.explicitResetPositioning: true`) when the product name or a primary pack claim contains "Tiefenreinigung", "Tiefenreinigend", "Deep Clean"/"Deep Cleansing", "Clarifying Shampoo", "Detox-Reinigung", or the usage directions limit use to occasional resets (for example "1× pro Woche", "alle 1–2 Wochen", "nicht zur täglichen Anwendung").

D1 details (round 2):

- *Sources.* The product name (graded `high`) or a claim or usage direction from a manufacturer or pack source (graded `moderate`) counts; "primary pack claim" means any such manufacturer/pack claim when the packet does not separate front from back (E1). Retailer-only wording never makes D1 true (CL-SRC).
- *Matching.* Case-insensitive on the stems `tiefenrein` (Tiefenreinigung, tiefenreinigend, tiefenreinigende, Tiefenreinigungs-), `deep clean` (Deep Clean, Deep Cleansing, Deep-Cleansing), `clarifying shampoo` and `detox-reinigung`.
- *Not D1.* Care terms that share a prefix ("Tiefenpflege", "tiefenpflegend", "Tiefenspülung"), "porentief", "reinigt tief", "klärend" or "Detox" without "Reinigung". These are recorded; "klärend" and similar still count as reset intent for `alternating` (U4).
- *Daily-use directions.* Daily-use directions do not make a true D1 false. They are recorded; with a `strong` formula D3 adds `review_reset_positioning_mismatch`, otherwise they go into the note `deep_cleansing_name_ordinary_formula` (U5, R16.3).

**D2 Deep-cleanser dual listing (revised per rulings R6, R16.3).** A deep-cleanser entry needs a strong formula: `cleansingStrength: strong` **and** `focusPrimary: clarifying` **and** `usageRole: occasional_reset` **and** D1 true -> `deepCleanserListing: flagged`. The product:

- keeps its regular-shampoo entry. Rows are assembled exactly as for any other product (13.7), with `observedCleansingIntensity: clarifying` (I1);
- is flagged for a separate deep-cleanser catalog entry. A product record has exactly one `category_key` and `product_shampoo_specs.category_key` is only `shampoo`, so the deep-cleanser entry is a second product record (pattern: Balea, regular-shampoo record `0f71ff9d…` plus deep-cleanser record `375ee7a0…`, which owns the barcode). Creating it is a separate catalog action under the deep-cleanser category's own rules, not part of this projection.
- **Lane visibility (round 2).** A sealed classification lane cannot see catalog ids and always records the flag with `deepCleanserRecord: needs_record`. After the lanes are frozen, the orchestrator resolves it against the catalog to the existing deep-cleanser product id or confirms that the record still has to be created. Lanes are never compared on this field; they are compared on `deepCleanserListing` only.

D2 never removes, suppresses or blocks the regular-shampoo entry. In every other case `deepCleanserListing: not_flagged`.

Informational (matcher behavior): no bucket expects `clarifying`, so every row of a `clarifying` product (a strong D1 deep cleanser) is amber (`supportive`) in the everyday role and is not ranked in the dandruff role. That is a truthful trade-off, not an error (I2).

**D3 Mismatch (revised per ruling R16.3).**

- *Strong formula.* D1 true with `cleansingStrength: strong` but D2 not satisfied (focus or usage role fails), or D1 true with `cleansingStrength: strong` and usage directions that allow daily or frequent use (U5) -> add `review_reset_positioning_mismatch`. The regular-shampoo rows are still assembled by the normal rules but stay blocked until Nick rules; D3 never routes the product out.
- *Ordinary-strength formula.* D1 true with `cleansingStrength` `low` or `moderate` (a "Tiefenreinigung"-type name over an ordinary formula, typically the C1 ether-sulfate-plus-betaine base) -> no deep-cleanser entry (`deepCleanserListing: not_flagged`) and no review flag. The product keeps only its regular-shampoo entry at its formula intensity (I1: `regular` or `gentle`), and the informational note `deep_cleansing_name_ordinary_formula` records the D1 wording, the formula strength and any daily-use directions (U5). A name never earns a deep-cleanser entry on its own.

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
- Scalp target confidence = the lowest of: the positioning evidence confidence (E1), and the confidence of every direct property its formula gate used.
- `ordinary` target confidence (round 2): reached by S-ORDINARY way 1 (no qualifying claim) → `high` when the packet contains at least one manufacturer or pack source, `moderate` when it has retailer copy only; reached by ways 2–4 → `moderate`.
- When several S-ORDINARY ways apply at once (post-round 2), the rationale names every way that applies and the confidence is the lowest of their confidences. Example: way 1 with a manufacturer source (`high`) together with way 3 (`moderate`) → `moderate`.
- `researchCombinationTargets` confidence (R12, R15, R16.1), per value = the lowest of the projected `dandruff` target confidence and the E1 grade of the wording that feeds the value (bundled comfort wording or a separate unit). It is not a projected field: a `low` value never returns `needs_research`; the value is then not recorded and only its note (`dandruff_bundled_comfort_wording` or `dandruff_dry_scalp_wording`) is recorded (E2b).
- Observed intensity confidence = `cleansingStrength` confidence (plus the D1 positioning evidence confidence (E1) for `clarifying`; R16.2).
- `deepCleanserListing` confidence = the lowest of `cleansingStrength`, `focusPrimary` and `usageRole` confidence and the D1 positioning evidence confidence (E1).
- Any projected field with `low` confidence returns `needs_research`.

### 13.9 Review flags and informational notes

All review flags are blocking until Nick rules on the product (13.2). Flags and notes are internal research fields.

| Code | Raised by |
| --- | --- |
| `review_thickness_boundary` | T4 (now also for an `acceptable` fit that a neighbor would make `not_suited`, `ordinary` target only) |
| `review_strong_cleansing_comfort_route` | S-SENSITIVE, S-DRY |
| `review_specialist_gate_failed` | S-FAIL (only when no other specialist target passes; detail names the failed target, the gate, and any `unlisted_route_candidate:<INCI name>`) |
| `review_extra_scalp_target` | S-SECONDARY |
| `review_focus_target_mismatch` | S-FOCUS (specialist target without matching focus, oily target without `clarifying`, or `scalp_active` focus with an unexplained `ordinary` target) |
| `review_intensity_boundary` | I3 (direction-aware: only when the current intensity matches a bucket's expectation and the neighbor's would not) |
| `review_reset_positioning_mismatch` | D3, strong formula only (D1 true and `cleansingStrength: strong`, but D2 not met, or daily-use directions, U5). An ordinary-strength D1 product gets the note `deep_cleansing_name_ordinary_formula` instead (R16.3) |
| `review_rule_conflict` | 13.2 |
| `review_live_value_differs` | Every projected row set (including `weight`) that differs from the current live rows (program decision D4). Comparison happens after projection; live values are never an input. |

Informational notes are recorded in `informationalNotes`. They do not block, because they are already conservative or already ruled:

| Code | Raised by |
| --- | --- |
| `active_without_dandruff_positioning` | S-DANDRUFF |
| `suits_dandruff_with_irritated_scalp` | E2b (R12, R15): bundled comfort wording or a separate sensitive-scalp unit on a `dandruff`-primary product, plus a passed S-SENSITIVE formula gate; accompanies `"sensitive"` in `researchCombinationTargets`; detail names `strong_cleansing` when `cleansingStrength` is `strong`. Research-only, never projected |
| `dandruff_bundled_comfort_wording` | E2b (R12, R15): such wording whose S-SENSITIVE formula gate failed or whose source is graded `low`; quotes the wording and names the failed clause (and any `unlisted_route_candidate:<INCI name>`) |
| `suits_dandruff_with_dry_scalp` | E2b (R16.1): a separate dry-scalp unit on a `dandruff`-primary product plus a passed S-DRY formula gate; accompanies `"dry"` in `researchCombinationTargets`; detail names `strong_cleansing` when `cleansingStrength` is `strong`. Research-only, never projected |
| `dandruff_dry_scalp_wording` | E2b (R16.1): such a dry-scalp unit whose S-DRY formula gate failed or whose source is graded `low`; quotes the wording and names the failed clause (and any `unlisted_route_candidate:<INCI name>`) |
| `deep_cleansing_name_ordinary_formula` | D3 (R16.3): D1 true with `cleansingStrength` `low` or `moderate`; no deep-cleanser entry; records the D1 wording, the formula strength and any daily-use directions (U5) |
| `scalp_concern_floor_applied` | T6, naming each thickness lifted from `not_suited` to `acceptable` |
| `deep_cleanser_listing` | D2. Lanes always record `needs_record`; the orchestrator resolves the existing deep-cleanser product ID after freeze |
| `claimed_target_not_projected:<target>` | S-FAIL, when a claimed target fails but another specialist target passes |
| `hair_loss_claim_not_evaluated` | S-HAIRLOSS |
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
| Hypothetical "Tiefenreinigung" shampoo on an ordinary formula (R16.3) | M/L/L; C1 ether sulfate buffered by a betaine; `usageRole: occasional_reset`; D1 true; no scalp claim | fine ideal, normal ideal, coarse acceptable | `light` | `ordinary` | `regular` | fine, normal (ideal), coarse (acceptable) × `normal`/`balanced`/`regular`; `deepCleanserListing: not_flagged`; note `deep_cleansing_name_ordinary_formula`, no review flag |
| Hypothetical "Anti-Fett" shampoo (R16.2) | S/L/L; focus `clarifying`; "für schnell fettendes Haar"; D1 false; `usageRole: alternating` | fine ideal, normal ideal, coarse acceptable | `light` | `oily` | `regular` | fine, normal (ideal), coarse (acceptable) × `dehydriert-fettig`/`oily`/`regular`: green for oily scalp where the thickness fit is `ideal` |
| Hypothetical anti-dandruff shampoo with a soothing sentence (R12) | M/M/L; `dandruffSupport: supported`; manufacturer copy "Gegen Schuppen." followed directly by "Die juckende Kopfhaut wird beruhigt."; prominent Panthenol; CSA met | fine ideal, normal ideal, coarse acceptable | `light` | `dandruff` only (the itch sentence is bundled, E2b) | `regular` | fine, normal (ideal), coarse (acceptable) × `schuppen`/`dandruff`/`regular`; research-only `researchCombinationTargets: ["sensitive"]`, note `suits_dandruff_with_irritated_scalp`. Without a prominent comfort route: `[]` and note `dandruff_bundled_comfort_wording` |

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
- compare `researchCombinationTargets` (R12) as a research judgment. A disagreement on it is reported and counts toward raw agreement, but its direction is never `toward_recommending`, because it creates no row, target or live value;
- recompute each lane's review flags mechanically from its own properties, confidences and neighbors (N-ALT) and compare the flag sets as a diagnostic; a flag difference that traces back to a confidence difference is reported with that property;
- resolve catalog-dependent fields (the deep-cleanser record id, `review_live_value_differs`) only after both lanes are frozen; lanes never see catalog ids;
- preserve every disagreement before adjudication, with the rule ID each lane applied.

Required pass bars for a routine research batch:

- at least 75% raw exact agreement across all judgment decisions;
- at least 60% raw exact agreement for every judged property;
- 100% formula-derived dandruff agreement;
- zero unresolved identity/audit failure;
- all final properties moderate-or-better confidence.

Also report label prevalence, conditional non-default agreement and Cohen's kappa as diagnostics. With ten products, kappa has no hard pass threshold.

Adjudicate a disagreement as product correction, source/identity failure, researcher-process ambiguity or systematic rule gap. A systematic gap changes the standard and reruns the complete batch; it is not patched for one convenient product. For each disagreement, also record whether either lane's value would have produced a higher thickness tier (`not_suited` → `acceptable` or `acceptable` → `ideal`), an additional row, an additional scalp target or a lighter `weight` relative to the adjudicated value (direction `toward_recommending`).

**Lock gate** (program decision D2, owned by `plans/shampoo-v16/plan.md`): two sealed lanes on the approved gold set; at least 90% raw agreement over all judged direct and projection decisions; zero disagreements whose cause is an ambiguity in this standard and whose direction is `toward_recommending`; Nick adjudicates; then a re-run on unseen products. Only then is the policy ID `shampoo-classification-v1.6` assigned by a hash-pinned lock receipt. The gate was met on 2026-10-10 (round 1 97.4%, round 2 97.1%, unseen check v2 95.8%; ruling R14), with R15 and R16 applied as pre-lock rulings without a further calibration round (R13).

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
| `docs/research/shampoo-inci/v1.4/holdout-v3-operator-clarifications.md` | Non-normative explanation. F2 was adopted as a rule; the repair/moisture clarification is superseded by F1. Nothing else in it is operational. |
| `docs/research/shampoo-inci/v1.4-draft/weight-potential-final-method.md` (`shampoo-weight-final-v1`) | Section 6 in full: meaning, evidence boundary, reviewed role resolutions, required sequence, subjudgments, anchors, unknowns, reasoning fields, confidence, derived-fit boundary, self-check. One of the three sources the v1.4 README lists as consolidated into v1.4. |
| `docs/research/shampoo-inci/v1.4-draft/operational-amendment.md` | Secondary-focus invalid patterns and two-value requirement (Section 8), usage trigger codes and active-led precedence (Section 9, U1), decision trace (F-TRACE), shine and strong-repair examples (7.2), completeness note (ID-1). Its route-count weight section 4 is superseded and not carried. |
| `docs/research/shampoo-inci/v1.4/new-product-research-runbook.md` | Decision-trace field list (F-TRACE) |
| `data/research/shampoo-inci/v1.6/calibration/round-1/lane-a-ambiguities.md`, `lane-b-ambiguities.md` | Round-2 clarifications (N-ALT, ID-1–ID-3, CL-SRC, C1 scope, C3–C7, W1 scope, W-RICH, W2, W3, F3–F7, U1–U5, SC1, E1–E4 details, E2a, S-ORDINARY, S-FAIL, S-SECONDARY, S-HAIRLOSS note, S-FOCUS, I3, D1–D3, 13.8, 13.9). Each is a row in `rule-changes.md`. |
| `data/research/shampoo-inci/holdout-v3/adjudication.json` | C1, C2, W1, F2, usage example, Appendix A Vichy row |
| `plans/scan-db-expansion/research/shampoo-v14/focus-v15-amendment-plan.md`, `src/lib/shampoo/focus-v15.ts` | Section 7, 8 vocabulary, Appendix A |
| `docs/product-intake-shampoo-production-light.md`, `src/lib/shampoo/production-light-adapter.ts` | 13.1 vocabulary, I1, D2, S-DANDRUFF positioning requirement, dry/sensitive `targeted` requirement, row assembly |
| `src/lib/shampoo/constants.ts`, `src/lib/product-intake/category-validators.ts`, shampoo migrations | 13.1 bucket/route/intensity table |
| `data/research/shampoo-production-light-v1/calibration-v1/`, pilot `adapter-input.json` files | Evidence that thickness/scalp judgments were previously unwritten and inconsistent; T1 follows the conservative side where they split |
| `data/research/shampoo-inci/v1.6/rulings-ledger.md` (R2–R6, 2026-10-07; R11–R12, 2026-10-09) | Three-tier T1/T5, W-LIVE, T7 (R2/R3); T6 and P0 by target class (R4); N1 and register entry X1 (R5); I1 revision, D2 dual listing, D3 (R6); C2 humectant element (R11); E2b and `researchCombinationTargets` (R12) |
| `data/research/shampoo-inci/v1.6/rulings-ledger.md` (R14–R16, 2026-10-10) | Lock and Kokosmilch weight adjudication (R14); dandruff path for a separate sensitive unit, E2b/S-SECONDARY (R15); dandruff path for a separate dry unit and the `dry` combination value, E2b/S-SECONDARY/S-FAIL/13.8/13.9 (R16.1); I1 `clarifying` only with D1, F6/U4/13.8 (R16.2); D2/D3 strong-formula requirement and note `deep_cleansing_name_ordinary_formula` (R16.3); closed lists, C2/CSA/E4 (R16.4) |
| `data/research/shampoo-inci/v1.6/calibration/round-2/round-2-report.md` and the round-2 lane `uncertainties` | Post-round-2 clarifications: C3a, C2 humectant element, CSA, SC1/E2a sparing and reputation wording, W1 set without amodimethicone, W-RICH limited reset, 6.4 acrylate thickeners, N-ALT for `focusSecondary`, ID-2 split entries, E1 foreign-language pages, 13.8 mixed S-ORDINARY ways, F7 non-scalp name words |
| `src/lib/personal-plan/products/authority/categories/conditioner.ts`, `axis-fit.ts`, `shampoo.ts`, `src/lib/mobile/result-presentation.ts` | Live green/amber/red pattern and dandruff-role ranking that 13.1 and T7 describe (read-only reference) |
