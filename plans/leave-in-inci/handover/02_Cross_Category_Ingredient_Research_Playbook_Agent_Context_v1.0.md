**CHARLIE HAIRCARE**

# Cross-Category Ingredient Research & Matching Playbook

*A repeatable recipe for building evidence-backed product classification standards for conditioners, masks, leave-ins and other hair-care categories*

**Version:** 1.0 — 10 August 2026  
**Status:** Operational category-development playbook  
**Reference implementation:** Shampoo Research & Classification Standard v1.3  
**Primary users:** Research agents, formulation researchers, recommendation-system designers, QA reviewers

---

> **CORE PRINCIPLE**
>
> The reusable asset is not a list of ingredients. It is a method for moving from exact product identity, through formula architecture and plausible product behavior, to an explainable user-fit decision—while keeping mechanism, evidence, uncertainty and user context separate.

# Executive recommendation

Use this playbook as the permanent cross-category framework, then run **one dedicated work session per product category**.

For Charlie, the recommended sequence is:

1. **Rinse-out conditioner**
2. **Hair mask / intensive treatment**
3. **Leave-in conditioner / cream / spray**
4. **Hair oil / smoothing serum**
5. **Scalp serum / tonic / exfoliating treatment**

Conditioner is the best next category. It is close enough to shampoo that the identity, evidence, calibration and matching infrastructure can be reused, but different enough that the formula architecture and performance routes must be rebuilt rather than copied.

A new session is preferable because it:

- reduces anchoring on shampoo-specific mechanisms;
- keeps the category corpus and calibration set focused;
- makes it easier to hand the work to a separate research or review agent;
- allows the shampoo standard to serve as an example rather than an implicit template;
- creates a clean versioned output for each category.

The same model or agent can be used in the new session. What matters is that it receives a clean handoff package and is instructed to rebuild category-specific science before proposing scores.

---

# 1. What it took to build the shampoo standard

The shampoo work progressed through eight distinct layers. These layers are the template for every future category.

| Stage | Question answered | Shampoo output | Reusable across categories? |
|---|---|---|---|
| **1. Category boundary** | What counts as the product and what is excluded? | EU/German rinse-off shampoos; separate modules for dry shampoo, bars, co-wash and medicated products | Yes—the boundary step is universal; the answer changes by category |
| **2. Exact identity** | Which exact formula is being classified? | Market, size, GTIN/EAN, capture date, source hierarchy, formula fingerprint, conflict stop | Yes—reuse almost unchanged |
| **3. Formula architecture** | What are the dominant systems? | Surfactants, cationic deposition, silicones, lipids, proteins, acids and chelators | Method is reusable; architecture is category-specific |
| **4. Performance routes** | Through which mechanisms can the product create its effects? | Separate shine, volume, repair and clarification routes | Method is reusable; routes must be rebuilt |
| **5. Evidence model** | What is formula plausibility versus tested efficacy? | 0–4 formula signals, E0–E5 evidence, shampoo-only versus routine scope | Reuse almost unchanged |
| **6. Calibration** | Can different reviewers apply the rules consistently? | Ten German-market calibration products across 17 dimensions | Reuse protocol; rebuild category set and dimensions |
| **7. Rule tightening** | Where does ingredient presence over-trigger conclusions? | G1–G3 gates, hard caps, five adversarial stress products | Reuse method; category-specific failure modes |
| **8. Lean matching layer** | What does the app actually need? | Cleansing, conditioning, weight, focus, use role and explainable user-fit records | Reuse data pattern; replace category properties as needed |

The final shampoo system therefore contains two layers:

- a **detailed research layer**, which preserves the science, route scores, claims, evidence and uncertainty;
- a **lean application layer**, which exposes only the properties needed for matching and user explanations.

This distinction should be preserved in every category.

## 1.1 Internal calibration result

The first shampoo standard used ten calibration products and five later stress-test products. The tightened five-product pass produced 85 score comparisons, 95.3% exact agreement with the proposed key, 100% agreement within one point and no disagreement larger than one point.

That result is evidence of **internal rule consistency**, not independent scientific validation. The lesson is methodological: calibration exposed where the rules were too permissive and converted those weaknesses into explicit gates and caps.

---

# 2. What can be reused and what must be rebuilt

## 2.1 Reuse without major change

The following infrastructure should become shared across all product categories:

- exact identity and version control;
- source hierarchy and evidence capture;
- formula fingerprinting;
- claim scope and routine-scope tracking;
- property-specific confidence;
- E0–E5 evidence levels;
- the formula/evidence firewall;
- the three-step evidence chain;
- property-level counter-signals;
- shared mechanism IDs to avoid double counting;
- calibration metrics and disagreement review;
- human-review triggers;
- versioning and reclassification rules;
- the distinction between direct product properties and derived user fit.

## 2.2 Rebuild for each category

The following must be researched afresh:

- dominant base architecture;
- exposure and rinse behavior;
- performance routes;
- ingredient-family relevance;
- route-specific false signals;
- category-specific score anchors;
- category-specific trade-offs;
- suitable user dimensions;
- intended use frequency and layering context;
- safety, scalp and medical boundaries;
- calibration products and stress cases.

> **DO NOT COPY SHAMPOO DIMENSIONS BLINDLY.**
>
> Conditioner has no meaningful cleansing-strength axis in the same sense as shampoo. A leave-in has much greater persistence than a rinse-out conditioner. A mask has different contact time and use-frequency assumptions. The cross-category process is reusable; the category ontology is not.

---

# 3. The category-development recipe

Each category should pass through the following fourteen phases. A category is not production-ready merely because ingredient families have been listed.

## Phase 0 — Write the category charter

### Goal

Define exactly what will be classified before collecting products.

### Questions

- What product forms are included?
- What is excluded or deferred to a separate module?
- Is the product rinse-off, leave-on, scalp-applied or fiber-only?
- What is the relevant market and regulatory environment?
- What user decisions should the output support?
- Which claims may cross into medical or regulated territory?

### Required output

A one-page charter containing:

- category definition;
- included and excluded product forms;
- market and date scope;
- intended application decisions;
- known boundary cases;
- initial research questions.

### Gate

No formula research begins until the boundary is explicit.

## Phase 1 — Map user jobs, trade-offs and failure modes

### Goal

Understand the decisions the system must make, not merely the claims brands use.

### Questions

- What problem is the user trying to solve?
- Which effects can conflict with one another?
- Which user characteristics change the desired formula behavior?
- Which products are excellent in one routine role but poor in another?
- What are the common recommendation failures?

### Examples

For conditioners, stronger deposition can improve detangling and damage care but increase weight. For leave-ins, persistence can improve frizz control but create layering buildup. For masks, a rich formula may be appropriate weekly but excessive after every wash.

### Required output

A list of:

- user jobs;
- desired outcomes;
- trade-offs;
- routine roles;
- failure scenarios;
- user variables required for matching.

## Phase 2 — Build the research corpus

### Goal

Collect enough category science and exact-market products to distinguish mechanism from marketing.

### Source hierarchy

1. Peer-reviewed research and formulation literature
2. Official regulatory or claim guidance
3. Official manufacturer formula and test pages
4. Major retailers with exact GTIN and current INCI
5. Professional education and reputable formulation references
6. Secondary databases only as supporting leads
7. Forums and reviews only for real-world hypotheses, never as formula proof

### Research corpus

Include:

- category formulation architecture;
- deposition, rinse and persistence science;
- relevant instrumental test methods;
- ingredient-family mechanisms;
- claim substantiation conventions;
- exact German/EU formulas spanning major archetypes;
- known reformulation and identity problems.

### Gate

Every scientific rule must be traceable to a source or clearly labeled as an expert inference.

## Phase 3 — Map the dominant base architecture

### Goal

Identify the structural systems that define the category.

### Generic questions

- What creates the continuous phase and texture?
- Which ingredients are structural versus performance-oriented?
- Which systems deliver or deposit benefits?
- What is the expected contact time?
- What is rinsed away and what remains?
- What changes with dilution, heat, pH or drying?
- Which ingredients mainly stabilize the product in the bottle?

### Required output

A category architecture map containing:

- dominant structural systems;
- carrier/emulsion/lamellar systems;
- active and benefit-deposition systems;
- exposure and rinse behavior;
- likely persistence;
- structural ingredients that should not be mistaken for hair actives.

## Phase 4 — Enumerate performance routes

### Goal

Break broad marketing properties into distinct mechanisms.

For each claimed outcome, ask:

- Can several different mechanisms create the same visible result?
- Does the route add something, remove something or alter surface behavior?
- Is the effect immediate, cumulative or treatment-dependent?
- Is it fiber, scalp or styling behavior?
- Does it require another product in the routine?

### Required output

A route dictionary such as:

```text
PROPERTY
  Route 1: mechanism
  Route 2: mechanism
  Route 3: mechanism
  False signals
  Relevant trade-offs
  Evidence methods
```

The route level is important because two products with the same front-label claim may suit different users.

## Phase 5 — Define direct product properties

### Goal

Create properties that describe what the product itself is likely to do.

Direct properties should be:

- mechanistically interpretable;
- useful for matching;
- reasonably inferable from formula and product evidence;
- separated from user suitability;
- broad enough to classify reliably.

### Examples

Depending on category:

- conditioning/deposition level;
- weight potential;
- slip and detangling;
- smoothing/frizz control;
- softness;
- shine route;
- repair route;
- hold or styling support;
- heat-protection potential;
- rinseability;
- use role and frequency;
- scalp exposure and sensitivity flags.

### Gate

A direct property must describe product behavior, not a user profile.

## Phase 6 — Define derived user-fit outputs

### Goal

Translate product behavior into explainable suitability.

Possible user axes include:

- fine, medium and coarse strands;
- healthy versus damaged/porous hair;
- low versus high styling buildup;
- straight, wavy, curly and coily routine needs;
- oily, normal, dry and sensitive scalp;
- frequent use versus occasional treatment;
- heat-styled, color-treated or chemically processed hair.

Not every category needs every axis.

### Gate

Every fit conclusion must name the direct properties from which it was derived.

## Phase 7 — Build the ingredient-family dictionary and false-signal list

### Goal

Teach researchers and agents what an ingredient family can support—and what it cannot prove.

For every family, document:

- representative INCI names;
- structural versus performance roles;
- plausible mechanisms;
- delivery requirements;
- category-specific significance;
- relevant score caps;
- common marketing overinterpretations;
- counter-signals.

### Example structure

| Ingredient family | Plausible role | Delivery/context requirement | Does not prove |
|---|---|---|---|
| Cationic conditioning agents | Deposition, detangling, antistatic effect | Charge, pH, lamellar/emulsion context, rinse exposure | Exact weight or universal fine-hair incompatibility |
| Hydrolyzed proteins | Film, feel, possible body or damage management | Molecular size, charge, position and substantive delivery | Biological repair or guaranteed strengthening |
| Oils and butters | Lubrication, occlusion, softness | Dispersion, concentration, rinse behavior and deposition | Deep repair or necessarily high buildup |

## Phase 8 — Create scoring gates and the evidence firewall

### Goal

Prevent ingredient presence from becoming an exaggerated conclusion.

Use the universal G1–G3 gates:

1. **Functional relevance:** Can the system affect this exact endpoint?
2. **Formula relevance and delivery:** Is the system plausibly present and delivered in this product form?
3. **Endpoint specificity:** Does the mechanism support this property rather than only a neighboring benefit?

Then create category-specific caps.

### Evidence firewall

Keep separate:

- formula-mechanism score;
- product evidence level;
- evidence scope;
- user-fit confidence.

A multi-product study may increase evidence confidence but must not increase the formula score for one product.

## Phase 9 — Define the explainable data model

### Goal

Ensure every stored label can answer “why?”

Use two layers:

### Detailed research record

Contains identity, sources, formula architecture, mechanisms, route scores, claims, evidence, uncertainty, conflicts and reviewer notes.

### Lean matching profile

Contains only application-facing properties and derived fits.

Every property uses the reusable evidence object:

```json
{
  "value": "conditional",
  "decision_type": "derived_user_fit",
  "confidence": "moderate",
  "evidence_level": "E2",
  "evidence_scope": "formula_only",
  "rationale": "Why the conclusion follows",
  "supporting_signals": [],
  "counter_signals": [],
  "derived_from": [],
  "source_ids": [],
  "shared_mechanism_ids": []
}
```

### Required reasoning chain

```text
formula observation
→ direct product-property inference
→ user-fit decision
```

A single ingredient may not jump directly to a user recommendation.

## Phase 10 — Select the calibration set

### Goal

Choose products that expose the full decision space.

A useful first set normally includes 10–15 products:

- clear low-end and high-end anchors;
- mass-market and professional products;
- lightweight and rich products;
- one or more hybrids;
- silicone and silicone-free formulas;
- protein-focused and oil-focused formulas;
- products whose hero ingredient is not the main mechanism;
- purpose-built specialist products;
- a source conflict or reformulation case;
- one product likely to trigger a common false inference.

Do not select only well-behaved examples.

## Phase 11 — Run independent classification

### Goal

Determine whether the written rules produce consistent decisions.

Protocol:

1. Lock exact identity and formula.
2. Reviewer A and Reviewer B classify independently.
3. Neither sees the proposed key or the other review.
4. Compare per-property outputs and route scores.
5. Discuss every material disagreement.
6. Diagnose whether disagreement came from source quality, missing science, an ambiguous rule or legitimate uncertainty.

Useful metrics:

- completion rate;
- exact agreement;
- within-one-point agreement;
- mean absolute difference;
- maximum difference;
- systematic drift by dimension;
- disagreement reason codes.

## Phase 12 — Tighten through adversarial stress tests

### Goal

Attack the rules where they are most likely to fail.

Select 3–5 additional products designed to trigger:

- hero-ingredient over-scoring;
- ingredient-family double counting;
- ambiguous product form;
- proprietary technology mapping;
- evidence-scope leakage;
- source/version conflicts;
- weight or buildup overestimation;
- scalp or medical overclaiming.

Convert every systematic failure into:

- a hard cap;
- a minimum gate;
- an anti-double-count rule;
- a required uncertainty field;
- or a specialist-review trigger.

## Phase 13 — Build the production workflow

### Goal

Turn research into a reliable product-ingestion pipeline.

Define:

- required user-upload inputs;
- identity-resolution procedure;
- source retrieval and formula capture;
- automated classification steps;
- human-review triggers;
- confidence thresholds;
- publication status;
- reclassification conditions;
- audit logging;
- versioning.

## Phase 14 — Monitor and update

### Goal

Keep the standard trustworthy as formulas and evidence change.

Re-review when:

- GTIN or formula changes;
- market or pack size changes;
- claims change materially;
- new finished-product evidence appears;
- agents repeatedly disagree;
- user feedback reveals a systematic fit problem;
- a new mechanism or ingredient family becomes common.

Store the category-standard version on every product record.

---

# 4. Runtime pipeline when a user uploads a product

The product-ingestion pipeline should be identical in shape across categories, even when the category science differs.

## Step 1 — Capture the product

Preferred input order:

1. Barcode/GTIN or exact retailer URL
2. Front and back label photos
3. Product name, size and market
4. Full ingredient photo or official INCI
5. Directions and claims

A product name alone is insufficient.

## Step 2 — Resolve identity

Confirm:

- category;
- brand and exact product name;
- country/market;
- pack size;
- GTIN/EAN;
- capture date;
- whether multiple formulas or sizes exist;
- confidence and conflict status.

Possible identity statuses:

```text
verified
verified_with_minor_source_difference
provisional_formula_conflict
provisional_identity_conflict
insufficient_information
```

## Step 3 — Acquire and normalize formula data

Store:

- raw INCI exactly as captured;
- normalized ingredient names;
- source URL/photo reference;
- source date;
- formula fingerprint;
- source hierarchy tier;
- conflicts.

Do not silently combine formula lists from different versions.

## Step 4 — Apply the category standard

The research agent identifies:

- base architecture;
- structural ingredients;
- benefit systems;
- relevant performance routes;
- direct product properties;
- counter-signals;
- evidence level and scope.

## Step 5 — Generate the lean matching profile

Derive only the fields required by the product and category.

For each property, store:

- value;
- confidence;
- evidence level;
- evidence scope;
- rationale;
- supporting signals;
- counter-signals;
- source IDs;
- derived-from properties.

## Step 6 — Match to the user

The recommendation engine compares:

```text
product direct properties
+
user hair/scalp/routine profile
+
category-specific matching rules
=
fit decision with explanation
```

The product database should not permanently encode every possible user recommendation. It should store stable product behavior and only a limited set of broad fit priors. The final recommendation should incorporate the current user context.

## Step 7 — Apply review gates

Require human or specialist review when:

- identity or formula is unresolved;
- the category is uncertain;
- a proprietary active cannot be mapped;
- a medical or scalp-condition claim is involved;
- sensitive-scalp suitability is asserted without product-level evidence;
- evidence scope is unclear;
- a direct property has low confidence but materially changes the recommendation;
- the product sits near a decision boundary;
- the formula contains unfamiliar ingredient systems.

## Step 8 — Publish with versioning

Store:

```text
category_standard_version
formula_capture_date
classification_date
review_status
reviewer_or_agent_version
next_review_trigger
```

Recommended publication states:

```text
draft
approved
approved_with_cautions
provisional
specialist_review_required
rejected_insufficient_identity
```

---

# 5. Generic cross-category data model

## 5.1 Product identity

```json
{
  "product_id": "",
  "category": "conditioner",
  "brand": "",
  "name": "",
  "market": "DE",
  "size": "",
  "gtin": "",
  "formula_capture_date": "",
  "formula_fingerprint": "",
  "identity_status": "verified",
  "source_ids": []
}
```

## 5.2 Detailed research record

```json
{
  "category_standard_version": "conditioner-v1.0",
  "category_boundary": "rinse_out_conditioner",
  "formula_architecture": {},
  "mechanisms": [],
  "route_scores": {},
  "claim_audit": [],
  "evidence_records": [],
  "counter_signals": [],
  "source_conflicts": [],
  "review_notes": []
}
```

## 5.3 Lean matching profile

```json
{
  "primary_focus": {},
  "secondary_focus": [],
  "conditioning_level": {},
  "weight_potential": {},
  "use_role": {},
  "category_specific_properties": {},
  "hair_fit": {},
  "scalp_fit": {},
  "research_record_id": ""
}
```

## 5.4 Reusable property-evidence object

```json
{
  "value": "recommended",
  "decision_type": "derived_user_fit",
  "confidence": "moderate",
  "evidence_level": "E2",
  "evidence_scope": "formula_only",
  "rationale": "",
  "supporting_signals": [
    {
      "observation": "",
      "product_inference": "",
      "source_id": ""
    }
  ],
  "counter_signals": [],
  "derived_from": [],
  "shared_mechanism_ids": [],
  "review_status": "approved"
}
```

---

# 6. Calibration protocol

## 6.1 Product-selection matrix

The first calibration set should cover the category rather than approximate market share.

| Calibration role | Why it is needed |
|---|---|
| Clear lightweight anchor | Establishes the low deposition/weight end |
| Clear rich anchor | Establishes high care/weight potential |
| Mainstream general product | Tests normal middle-of-market classification |
| Professional product | Tests complex systems and stronger claims |
| Silicone-free product | Prevents silicone-only conditioning logic |
| Protein-focused product | Tests film and repair caps |
| Oil/butter-focused product | Tests weight and marketing overinterpretation |
| Volume/lightness product | Tests low-weight and bodying routes |
| Specialist claim | Tests color, bond, heat, curl or scalp modules |
| Source-conflict case | Tests identity and version-control discipline |
| Hero-ingredient mismatch | Tests whether the formula or the label drives classification |
| Product-form boundary | Tests whether a mask, leave-in or co-wash has been miscategorized |

## 6.2 Review protocol

Use:

- one proposed key created from detailed research;
- one independent blind reviewer;
- preferably a second independently prompted agent or human expert;
- a disagreement log;
- rule-change documentation.

## 6.3 Acceptance criteria

A category may move from research to operational status when:

- exact identity rules are defined;
- all direct properties have operational definitions;
- derived fit outputs list their upstream properties;
- ingredient families include false-signal guidance;
- score gates and caps exist;
- evidence scope is mandatory;
- the calibration set spans the category;
- no material disagreement remains unexplained;
- stress tests create no systematic error larger than the accepted threshold;
- every output can generate a user-readable explanation;
- unresolved claims or medical boundaries trigger review instead of confident automation.

---

# 7. Category adaptation matrix

| Category | Dominant architecture to research | Main performance routes | Important matching axes | Common false inferences |
|---|---|---|---|---|
| **Shampoo** | Surfactant system; dilution deposition; chelation | Cleansing, conditioning, shine, volume, repair, clarification | Scalp oiliness, buildup, damage, thickness, use frequency | Sulfate-free = mild; silicone-free = non-conditioning; acid = gloss |
| **Rinse-out conditioner** | Cationic surfactant/amidoamine + fatty-alcohol lamellar system; silicone/oil/protein deposition | Detangling, slip, softness, smoothing, shine, weight, repair film, lightness | Strand thickness, damage/porosity, texture, desired weight, rinse feel | Fatty alcohol = heavy; silicone-free = light; protein = repair; oil = deep nourishment |
| **Mask/intensive treatment** | Richer emulsion/lamellar systems; longer contact; higher deposition load | Intensive conditioning, occlusion, film repair, bond claims, softness | Damage level, frequency, thickness, buildup risk, routine role | “Deep” = penetration; longer contact guarantees repair; richness = better |
| **Leave-in conditioner/cream/spray** | Leave-on emulsion or polymer solution; no rinse; layering interactions | Frizz control, detangling, heat protection, hold, definition, humidity response | Thickness, texture, styling routine, climate, layering, wash frequency | Ingredient amount can be inferred from shampoo rules; rinse-off evidence applies to leave-on |
| **Hair oil/smoothing serum** | Anhydrous oil/silicone blend or light emulsion; high persistence | Lubrication, gloss, frizz, sealing, heat feel, sensory finish | Thickness, porosity, dose, styling goal, buildup tolerance | Botanical oil means repair; volatile silicone means no residue; serum = treatment |
| **Scalp serum/tonic** | Water/alcohol/glycol vehicle; leave-on scalp exposure; active delivery | Hydration, exfoliation, anti-dandruff, soothing, sebum or density claims | Scalp condition, sensitivity, active evidence, frequency, contraindications | Botanical = active; tingling = efficacy; hair-growth claim from ingredient presence |

---

# 8. Conditioner pilot blueprint

Conditioner should be the next dedicated category project.

## 8.1 Initial scope

Include:

- conventional rinse-out conditioners;
- Germany/EU market;
- products intended primarily for lengths and ends;
- formulas rinsed after short contact.

Initially exclude:

- masks and deep treatments;
- leave-in conditioners;
- cleansing conditioners/co-washes;
- two-phase spray conditioners;
- color-depositing conditioners;
- medicated or scalp-treatment conditioners;
- salon back-bar chemistry treatments.

These can become later modules.

## 8.2 Core scientific questions

The conditioner project should answer:

1. Which base architectures distinguish a lightweight from a rich conditioner?
2. How do cationic surfactants, protonated amidoamines and fatty alcohols form the conditioning structure?
3. How should silicone type, dispersion and deposition context affect smoothing and weight?
4. Which oils, esters and butters materially influence rinse feel and persistence?
5. When do proteins and polymers create detangling, body or repair-film effects?
6. How does pH affect amine protonation, fiber charge, swelling and feel?
7. Which ingredients are mainly structural thickeners rather than hair-performance signals?
8. What predicts rinseability and cumulative buildup?
9. How should “volume conditioner,” “repair conditioner,” “shine conditioner” and “color conditioner” be separated by route?
10. Which scalp-contact and sensitivity flags matter if users apply conditioner near the roots?
11. Which finished-product tests meaningfully support wet combing, dry combing, friction, breakage, shine or frizz claims?
12. Which fit conclusions can be made reliably from formula alone, and which require product testing?

## 8.3 Candidate direct product properties

The first conditioner ontology should consider:

```text
conditioning_deposition
wet_slip_detangling
dry_slip_combability
softness
smoothing_frizz_control
shine_deposition
weight_potential
rinseability
bodying_or_lightness
repair_lubrication
repair_surface_film
bond_specific_support
color_or_chemical_damage_protection
scalp_exposure_risk
usage_role
```

Not all properties need to be exposed in the lean application profile.

## 8.4 Candidate lean matching profile

```text
conditioning_level: low | moderate | high
weight_potential: low | moderate | high
primary_focus: lightness | detangling | smoothing | repair | shine | curl_support | color_care | general
secondary_focus: up to two
rinseability: easy | moderate | rich
usage_role: frequent | regular | alternating | intensive

hair_thickness_fit:
  fine | medium | coarse

damage_fit:
  healthy | moderately_damaged | highly_damaged

texture_fit:
  straight | wavy | curly | coily

scalp_application_fit:
  avoid_roots | conditional | suitable_if_evidenced
```

Texture fit should not be inferred from curl pattern alone. It should reference desired slip, weight, definition, frizz control and styling routine.

## 8.5 Ingredient systems to research

- cationic surfactants and quaternary ammonium compounds;
- protonatable conditioning amines;
- fatty alcohol lamellar systems;
- silicone families and deposition context;
- oils, butters, esters and hydrocarbons;
- cationic and nonionic polymers;
- hydrolyzed proteins and protein derivatives;
- humectants and osmolytes;
- acids, buffers and pH;
- chelators;
- film formers and heat-protection systems;
- preservatives, fragrance and scalp-exposure flags.

## 8.6 Proposed conditioner calibration archetypes

A first 10–12 product set should include:

1. Lightweight fine-hair conditioner
2. Conventional mass-market general conditioner
3. Rich silicone repair conditioner
4. Silicone-free but strongly cationic conditioner
5. Protein-focused conditioner
6. Oil/butter-focused conditioner
7. Volume/lightness conditioner
8. Acidic/color-care conditioner
9. Curl/coily-oriented rich conditioner
10. Bond-repair claim conditioner
11. Sensitive/fragrance-free conditioner
12. Source-conflict or product-form boundary case

## 8.7 Conditioner stress tests

Add 3–5 adversarial products that test:

- “lightweight” marketing despite a rich lamellar/deposition system;
- hero oil or protein at low apparent formula relevance;
- bond branding without a distinct bond-specific route;
- silicone-free formula with high conditioning and weight potential;
- a product sold as conditioner in one source and mask/leave-in in another;
- a routine-level breakage claim presented as conditioner-only evidence.

## 8.8 Conditioner deliverables

The conditioner project should produce:

- Conditioner Research & Classification Standard v1.0 — DOCX
- Agent-context Markdown version
- Exact-product calibration workbook
- Proposed reference key
- Independent reviewer sheet
- Agreement dashboard
- Tightened rule change log
- Lean conditioner matching model
- Product-evidence template
- Ready-to-use runtime prompt or tool specification

---

# 9. Recommended work-session design

## 9.1 Use a new dedicated session per category

Create the master recipe in this project, then start a new session for conditioner.

The new session should receive:

1. This cross-category playbook
2. Shampoo Standard v1.3 as a worked example
3. Shampoo calibration workbook v1.3 as an example of outputs and metrics
4. The conditioner pilot brief
5. The current generic product-evidence schema
6. Any existing Charlie user-profile fields that the conditioner fit must support

## 9.2 Shampoo is an example, not the conditioner ontology

Tell the new agent:

- reuse identity, source, evidence, calibration and explanation infrastructure;
- do not copy shampoo performance dimensions before researching conditioner science;
- document every category-specific replacement;
- flag which shampoo fields remain shared and which disappear;
- create a fresh calibration set.

## 9.3 Recommended agent roles

For robust development, use two passes:

### Research/standard agent

Builds the science map, property dictionary, ingredient rules, evidence model and proposed key.

### Blind calibration reviewer

Receives the standard and exact product inputs but not the proposed key. It independently classifies the calibration set.

A human reviewer can replace or supplement the second agent.

## 9.4 When to keep work in the same session

Continue in the same session only when:

- making small revisions to the master playbook;
- updating shared identity/evidence schemas;
- comparing category data models;
- documenting lessons that apply to all categories.

Start a new session when:

- beginning category-specific scientific research;
- selecting a new calibration set;
- building route definitions;
- performing blind review;
- developing category-specific user-fit rules.

---

# 10. Ready-to-paste new-category prompt

```text
You are developing an evidence-backed ingredient-research and product-matching standard for a new Charlie hair-care category.

CATEGORY
Rinse-out conditioner for the current German/EU market.

CONTEXT FILES
1. Cross-Category Ingredient Research & Matching Playbook v1.0
2. Shampoo Research & Classification Standard v1.3
3. Shampoo Calibration and Matching Workbook v1.3
4. Conditioner Pilot Brief v1.0
5. Generic Product Research Schema v1.0

IMPORTANT USE OF THE SHAMPOO MATERIAL
The shampoo standard is a worked methodological example, not a conditioner ontology. Reuse exact-identity control, source hierarchy, evidence levels, formula/evidence separation, property-evidence records, calibration metrics and versioning. Do not copy shampoo-specific dimensions or ingredient rules without re-researching them for rinse-out conditioners.

GOAL
Create a repeatable, auditable standard that allows a human or AI researcher to classify an exact conditioner formula, estimate its direct product behavior, derive explainable user fit and store evidence behind every property.

REQUIRED PROCESS
1. Lock the conditioner category boundary and exclusions.
2. Research conditioner formulation architecture and relevant finished-product test methods using primary or authoritative sources.
3. Map distinct performance routes for detangling, slip, softness, smoothing/frizz, shine, weight, rinseability, body/lightness and repair.
4. Define direct product properties separately from user-fit outputs.
5. Build ingredient-family guidance with delivery requirements, false signals, gates and caps.
6. Keep formula scores, product evidence and user-fit confidence separate.
7. Design a lean matching profile and reusable property-evidence object.
8. Select 10–12 diverse German-market calibration products with exact GTINs and formulas.
9. Create a proposed reference key and a blind reviewer workflow.
10. Analyze disagreements and tighten the standard.
11. Add 3–5 adversarial stress-test products.
12. Deliver a DOCX standard, agent-context Markdown, calibration workbook, change log and ready-to-use product-research prompt.

NON-NEGOTIABLES
- Exact market + pack size + GTIN/EAN + capture date.
- Formula analysis before marketing interpretation.
- No exact concentration claims from INCI order.
- No naked suitability labels.
- Every property includes value, confidence, E-level, evidence scope, rationale, supporting observations, product inference, counter-signals, derived_from and sources.
- Formula observation → product-property inference → user-fit decision.
- Routine-level test results must not be attributed to the conditioner alone.
- Unknown or proprietary systems must be labeled with uncertainty rather than guessed.
- Identity or formula conflicts produce a provisional record.

FIRST OUTPUT
Before doing the full market calibration, produce:
A. Category charter and exclusions
B. Research questions
C. Proposed formula architecture map
D. Proposed direct product properties
E. Proposed user-fit outputs
F. Proposed calibration archetypes
G. Open questions and risks

Then continue into research, calibration and refinement in the same session.
```

---

# 11. Final category-readiness checklist

A new category standard is ready for operational use only when all of the following are true.

## Category and science

- [ ] Category boundary and exclusions are explicit.
- [ ] Exposure, rinse and persistence assumptions are documented.
- [ ] Dominant base architectures are mapped.
- [ ] Performance claims are separated into routes.
- [ ] Structural ingredients are distinguished from performance ingredients.
- [ ] Common false inferences are documented.

## Properties and fit

- [ ] Direct product properties are defined operationally.
- [ ] Derived fit outputs list their upstream properties.
- [ ] Trade-offs are explicit.
- [ ] Use role and frequency are represented.
- [ ] Sensitive/scalp/medical boundaries have review rules.

## Evidence

- [ ] Formula scores and finished-product evidence are separate.
- [ ] Evidence scope is mandatory.
- [ ] Every lean property has its own confidence and rationale.
- [ ] Counter-signals are required.
- [ ] Shared mechanism IDs prevent double counting.
- [ ] Exact sources and formula versions are stored.

## Calibration

- [ ] Calibration set spans clear anchors, hybrids and edge cases.
- [ ] Independent review has been completed.
- [ ] Disagreements have been diagnosed.
- [ ] Systematic over-scoring has been converted into gates or caps.
- [ ] Stress tests include proprietary, source-conflict and hero-ingredient cases.
- [ ] Remaining judgment boundaries are explicit.

## Production

- [ ] Product-upload requirements are defined.
- [ ] Identity and formula conflicts stop publication or produce provisional status.
- [ ] Human-review triggers are implemented.
- [ ] Matching outputs can explain why.
- [ ] Category-standard version is stored on every product.
- [ ] Re-review triggers are defined.

---

# Final recommendation

Do not build conditioner, masks and leave-ins simultaneously in one long session. Develop **conditioner first as the base conditioning category**, then extract a shared conditioning-ingredient ontology. Use that shared ontology to accelerate masks and leave-ins, while still creating separate category standards for their different contact time, rinse behavior, persistence, layering and user-fit logic.

This approach preserves the depth of the shampoo work without forcing Charlie to adopt an unnecessarily large runtime model. The science can remain detailed in the research trace; the app can use a compact, explainable matching profile.
