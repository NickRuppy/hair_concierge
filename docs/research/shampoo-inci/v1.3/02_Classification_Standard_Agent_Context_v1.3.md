**CHARLIE HAIRCARE**

**Shampoo Research &  
Classification Standard**

A science-based operating guide for human reviewers and AI agents

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Purpose** Create repeatable, auditable classifications of rinse-off shampoos from exact formula data, public evidence and user context.

**Scope** Current EU/German-market rinse-off shampoos. Medicated/anti-dandruff products, shampoo bars, dry shampoos and co-washes require separate modules.

**Version** 1.3 — 10 August 2026

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><p><strong>CORE PRINCIPLE</strong></p>
<p>Classify three things separately: (1) the mechanism that the formula can plausibly create, (2) the quality and scope of the evidence, and (3) whether the resulting effect suits this particular user. A marketing claim is not a user recommendation.</p></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

**DOCUMENT STATUS**

| **Field**          | **Value**                                                                                     |
|--------------------|-----------------------------------------------------------------------------------------------|
| **Status**         | Operational v1.3 — calibration-refined and explainable-matching ready                                                                              |
| **Primary users**  | Product researchers, hair-care experts, recommendation agents, QA reviewers                   |
| **Formula rule**   | Exact market + pack size + GTIN/EAN + capture date                                            |
| **Review trigger** | Formula change, claim change, new finished-product evidence, or material scoring disagreement |

**OPERATING OVERVIEW**

# **How to use this standard**

This document is designed to serve two roles at once: a research SOP for classifying newly added shampoos, and a reasoning reference for agents answering product-comparison questions. The first pages provide the fast operating model; later sections contain the detailed ingredient and decision rules.

## **Contents**

- 1\. Direct scientific answers: charge, coacervation and conditioning deposition

- 2\. Recognizing the different routes to hair shine

- 3\. The classification architecture and scoring system

- 4\. Standard property dictionary

- 5\. Ingredient-family reference and common false signals

- 6\. Research SOP and source hierarchy

- 7\. Human and machine-readable output templates

- 8\. Worked German-market examples

- 9\. User-facing response rules

- 10\. Lean explainable product-to-user matching layer

- Appendices: one-page checklist and references

## **The operating model in one page**

| **Layer**                  | **Question**                                               | **Required output**                                                                                                    |
|----------------------------|------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------|
| **1. Identity**            | Which exact formula is being classified?                   | Market, pack size, GTIN/EAN, date, formula source, conflict flag                                                       |
| **2. Architecture**        | What systems are actually present?                         | Surfactants, deposition system, film formers, acids, chelators, scalp-exposure flags                                   |
| **3. Performance signals** | Which effects are mechanistically plausible?               | 0–4 scores for cleansing, conditioning, weight, shine routes, volume routes, repair routes, clarification and mildness |
| **4. Evidence**            | How well is the exact effect supported?                    | Evidence level E0–E5; shampoo-only versus routine; test type, comparator and duration                                  |
| **5. User fit**            | Who benefits and who may not?                              | Hair/scalp fit, trade-offs, routine dependencies, uncertainty                                                          |
| **6. Claim audit**         | Does the front-label story match the formula and evidence? | Strongly substantiated / plausible / weak / indeterminate / source conflict                                            |

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><p><strong>NON-NEGOTIABLE SEPARATION</strong></p>
<p>A formula score is a prediction of mechanism strength, not a measured efficacy result. A product can receive a strong formula signal and still lack public finished-product proof. Conversely, a low-dose ingredient may perform if the product has convincing test data.</p></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

## **Twelve rules that prevent most classification errors**

1.  **Lock identity before analysis.** The product name alone is never enough.

2.  **Analyze the formula before reading the marketing interpretation.** This reduces anchoring.

3.  **Treat the whole system, not one hero ingredient.** Performance comes from combinations, ratios and delivery.

4.  **Do not infer exact percentages from INCI order.** EU lists have a 1% ordering threshold.

5.  **Do not equate sulfate-free with mild.** Total surfactant architecture matters.

6.  **Do not equate silicone-free with non-conditioning.** Cationic polymers, fatty alcohols and refatting agents can condition.

7.  **Keep clarification and chelation separate.** Oil/styling residue and mineral/metal deposits are different targets.

8.  **Keep shine routes separate.** Deposition, acidic surface management and residue removal are not interchangeable.

9.  **Attach every claim result to its test scope.** Shampoo-only, shampoo + conditioner and full-routine results are different evidence.

10. **State uncertainty and counter-signals.** No formula should be presented as more certain than the available data allow.

11. **Gate every score of 2 or higher.** The proposed mechanism must pass functional relevance, formula relevance/delivery and endpoint specificity, plus any route-specific cap.

12. **Enforce the formula/evidence firewall and conflict stop.** Finished-product testing changes evidence confidence, not formula scores; unresolved identity or formula conflicts require a provisional result.

**CORE SCIENCE**

# **1. Charge, coacervation and conditioning shampoos**

## **1.1 The precise answer to the charge question**

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><p><strong>SHORT ANSWER</strong></p>
<p>Broadly yes: a well-designed shampoo can remain physically stable in the bottle and then deposit conditioning material after dilution. But the positive and negative ingredients are not simply inert or kept apart. They already interact in the bottle; the formula keeps those interactions in a soluble, redispersed state. Water dilution changes that state and can trigger a polymer–surfactant-rich coacervate that deposits on hair.</p></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

The preferred terms are cationic (positively charged) and anionic (negatively charged). In a typical conditioning shampoo, anionic surfactants provide cleansing and a selected cationic polymer provides conditioning or acts as a deposition aid. Opposite charges attract, so the formulator is managing an interaction—not avoiding one. \[3–5\]

## **1.2 What happens from bottle to rinse**

| **Stage**          | **Physical state**                                    | **What the charged materials are doing**                                                                                                        | **Practical consequence**                                                          |
|--------------------|-------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------|------------------------------------------------------------------------------------|
| **In the bottle**  | Concentrated, micelle-rich, usually one visible phase | Anionic surfactant and cationic polymer are associated, but excess surfactant/micelles can keep the complex redissolved and the product stable. | The shampoo can be clear or homogeneous instead of visibly precipitated.           |
| **During washing** | Progressive dilution and changing ionic environment   | Water reduces total surfactant concentration and changes charge balance, micelle coverage and ionic strength.                                   | The formula may cross into its coacervation/complex-precipitation region.          |
| **During rinsing** | Polymer–surfactant-rich coacervate forms              | The oppositely charged materials associate into a separate, depositable complex. It can also carry silicone or oil droplets.                    | Conditioning material adsorbs to hair while much of the free cleanser rinses away. |
| **After drying**   | Thin deposited layer or localized surface coverage    | Cationic polymer, silicone and/or other benefits remain to varying degrees.                                                                     | Lower friction, improved combing, smoothing, anti-frizz and shine may result.      |

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><p><strong>IMPORTANT CORRECTION TO THE SIMPLE MODEL</strong></p>
<p>The ingredients do not “separate back into their original forms.” They form associated complexes or a coacervate. Whether this happens at the useful dilution point depends on polymer charge density and molecular weight, surfactant blend, ratios, salt, pH and other formulation variables. An INCI list can identify a plausible deposition system, but it cannot prove that the exact formula crosses the right phase region.</p></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

Hair is generally net negatively charged at normal cosmetic pH, and chemically damaged hair typically presents more anionic sites. That makes cationic materials more likely to adsorb, although the amount and distribution depend on the exact polymer, hair damage and formula. \[6\]

## **1.3 Why the formula does not necessarily collapse in the bottle**

- **Selected polymers, not arbitrary positive ingredients.** Conditioning shampoos commonly use cationic guar, cationic cellulose, cationic starch or selected polyquaterniums whose charge density and molecular structure can be engineered.

- **Surfactant excess and micelles.** At bottle concentration, surfactant micelles can associate with and redissolve the complex.

- **Mixed surfactant systems.** Amphoteric and nonionic co-surfactants change effective charge, phase behavior, foam and mildness.

- **Electrolyte and pH control.** Salt and pH can shift charge screening, viscosity and the dilution point at which deposition occurs.

- **Formulation testing.** Poorly balanced opposite-charge systems can precipitate prematurely, lose viscosity, become cloudy or underperform; stability and deposition testing are therefore essential.

## **1.4 What counts as evidence of a conditioning-shampoo architecture**

| **Signal family**                 | **Examples**                                                                                                                    | **What it suggests**                                                     | **Strength of inference from INCI alone**                                |
|-----------------------------------|---------------------------------------------------------------------------------------------------------------------------------|--------------------------------------------------------------------------|--------------------------------------------------------------------------|
| **Cationic deposition polymer**   | Guar Hydroxypropyltrimonium Chloride; Hydroxypropyl Guar Hydroxypropyltrimonium Chloride; Polyquaternium-7/-10; cationic starch | Plausible dilution deposition, direct conditioning and/or deposition aid | Moderate; exact coacervation cannot be known                             |
| **Silicone + deposition aid**     | Dimethicone or Dimethiconol plus cationic guar/PQ; Amodimethicone systems                                                       | Lubricating/smoothing film with improved deposition potential            | Moderate to strong when multiple aligned signals occur                   |
| **Conditioning lipids**           | Cetyl/Stearyl/Cetearyl Alcohol; Glyceryl Oleate; PCA Glyceryl Oleate; selected esters/oils                                      | Refatting, lubrication and softer after-feel                             | Weak to moderate; concentration and dispersion matter                    |
| **Conditioning amine/quaternary** | Stearamidopropyl Dimethylamine; Brassicamidopropyl Dimethylamine; Cetrimonium/Behentrimonium salts                              | Cationic conditioning, especially in an acidic system                    | Moderate, but small-molecule compatibility must be interpreted carefully |
| **Film-forming protein/polymer**  | Hydrolyzed Wheat Protein; Hydrolyzed Keratin; Polyquaternium-11; Acrylates Copolymer                                            | Temporary surface film, body, grip or damage management                  | Weak until substantive delivery and endpoint relevance are established; bottle-rheology polymers do not automatically count                               |

## **1.5 Shampoo architecture versus conditioner architecture**

A conditioning shampoo is not simply conditioner poured into shampoo. The two product types can share functional ingredients, but their dominant structures differ.

| **Feature**                   | **Conditioning shampoo**                                                                    | **Conventional rinse-out conditioner**                                                              |
|-------------------------------|---------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------|
| **Dominant base**             | Water + cleansing surfactant system                                                         | Water + fatty alcohol lamellar structure                                                            |
| **Primary function**          | Clean while depositing a limited benefit layer                                              | Deposit a richer lubricating/conditioning layer                                                     |
| **Typical cationic material** | Cationic polymers and/or selected silicones; sometimes low-level amines/quats               | Behentrimonium/Cetrimonium salts or protonated amidoamines, often at a more central structural role |
| **Typical feel**              | Cleaner, lighter, less persistent                                                           | More slip, softness, detangling and weight                                                          |
| **Can replace conditioner?**  | Sometimes for short, fine or minimally damaged hair; not implied by the word “conditioning” | Designed specifically for conditioning                                                              |

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><p><strong>CLASSIFICATION RULE</strong></p>
<p>When an anionic shampoo contains a cationic polymer, record “plausible deposition system.” Do not record “proven coacervation” unless the manufacturer or a finished-formula study supplies dilution/deposition evidence.</p></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

**FINISH CLASSIFICATION**

# **2. Recognizing the different routes to shine**

## **2.1 What “shine” actually describes**

Hair appears shiny when reflected light is concentrated into coherent highlights rather than scattered diffusely. Surface smoothness matters, but so do fiber alignment, frizz, hair color, curvature and how clean the surface is. Rinse-off products can measurably change shine, yet the same front-label claim may be produced through very different formula routes. \[7\]

| **Route**                          | **Primary mechanism**                                                                       | **Strong recognition signals**                                                                                                  | **Key caveat**                                                                                        |
|------------------------------------|---------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------|
| **S1. Depositing/smoothing film**  | Reduces friction and surface irregularity; improves alignment and frizz control             | Silicones; cationic polymers; conditioning amines; fatty alcohols/refatting agents; coherent multi-ingredient deposition system | Most common route, but “more deposition” can also mean more weight or buildup for some users          |
| **S2. Acidic surface management**  | Lower-pH system may reduce swelling, charge-related friction and roughness                  | Disclosed finished-product pH; acid + protonatable conditioning amine; multiple acids in a coherent system                      | An acid anywhere in INCI does not reveal final pH and may only adjust the formula                     |
| **S3. Removal of dulling residue** | Removes sebum, styling polymers, dry-shampoo residue, minerals or metals that scatter light | Efficient surfactant system; low heavy deposition; chelators such as EDTA/EDDS/GLDA/phytate/triphosphate; clarifying directions | A normal low-level chelator may only stabilize the formula; not every clarifier meaningfully chelates |
| **S4. Optical/color appearance**   | Changes refractive film or neutralizes unwanted color so hair appears brighter              | Phenyl silicones or specialty gloss emollients; violet/blue pigments for blonde/gray hair                                       | Brightness/color correction is not the same as physical surface gloss                                 |

## **2.2 Route S1: deposition and surface smoothing**

- **Strong silicone signals.** Dimethicone, Dimethiconol, Amodimethicone, Bis-Aminopropyl Dimethicone, Trimethylsilylamodimethicone and Silicone Quaternium ingredients.

- **Deposition support.** Cationic guar, cationic cellulose/starch and selected polyquaterniums can condition directly and help deposit dispersed silicones.

- **Non-silicone smoothing.** Fatty alcohols, refatting agents, cationic amines and protein/polymer films can also improve surface feel and alignment.

- **System strength matters.** One late-listed emollient is weak evidence; a silicone + cationic polymer + compatible carrier system is much stronger evidence.

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><p><strong>HOW TO SCORE IT</strong></p>
<p>S1 = 1 when there is only a weak, isolated conditioning clue; 2 when a clear non-silicone conditioning system is present; 3 when a coherent silicone/cationic or multi-lubricant system is present; 4 only when several aligned deposition technologies and/or exact product testing support a strong gloss/smoothing effect.</p></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

## **2.3 Route S2: acidic surface management**

Common acid names include Citric Acid, Lactic Acid, Glycolic Acid, Acetic Acid, Malic Acid and Tartaric Acid. A lower-pH shampoo may reduce charge-related friction and frizz compared with a high-pH cleanser, but a finished pH cannot be reconstructed from INCI. Acids can be neutralized, buffered or used only in tiny amounts for pH adjustment. \[8\]

- **Strong evidence.** The finished product publishes an acidic pH, or product-specific testing links the exact shampoo to reduced friction/frizz or increased shine.

- **Moderate evidence.** The formula combines an acid with a pH-dependent conditioning amine and other smoothing ingredients.

- **Weak evidence.** A headline acid is near the end of INCI with no pH, no coherent system and no shampoo-only data.

- **Avoid the shutter metaphor.** Do not say the cuticle “opens and closes” like scales on command. Describe reduced swelling, friction and surface roughness more cautiously.


### **2.3.1 Calibrated S2 formula anchors**

| **S2 score** | **Calibrated formula anchor** |
|---:|---|
| **0** | No relevant acidic system, or acid presence is only incidental and counter-signals dominate. |
| **1** | One or more acids are listed, but finished pH, prominence and endpoint relevance are unknown. This is the default cap for acid presence alone. |
| **2** | A coherent acidic architecture is plausible: relevant acid placement, compatible conditioning system, or disclosed finished pH. |
| **3** | Purpose-built acidic route: acid is prominent, official positioning specifies acidic pH, and the architecture supports surface management. |
| **4** | Rare: dominant, directly mapped acidic route with strong product-specific support; do not assign from INCI alone. |

> **Hard cap:** if the only support is “Citric/Glycolic/Lactic Acid appears in INCI,” score S2 no higher than 1. A product-specific test raises evidence level, not the formula score.

## **2.4 Route S3: cleaning and chelation**

| **Target**                              | **Formula clues**                                                                                                                                                                        | **Interpretation**                                                                  |
|-----------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------|
| **Sebum and styling residue**           | Efficient surfactant blend, clarifying directions, limited heavy deposition                                                                                                              | Supports shine by removing organic residue and restoring separation/lift            |
| **Dry shampoo and polymer buildup**     | Broad surfactant system; sometimes longer contact time or weekly use                                                                                                                     | Plausible, but polymer-specific removal cannot be inferred exactly                  |
| **Hard-water minerals/metals**          | Trisodium Ethylenediamine Disuccinate (EDDS), EDTA salts, Tetrasodium Glutamate Diacetate (GLDA), Sodium Phytate/Phytic Acid, Sodium Gluconate, Pentasodium Triphosphate, Etidronic Acid | Supports a chelating route; strength depends on type, amount, pH and contact time   |
| **Formula preservation/stability only** | A single EDTA or phytate very low in an otherwise ordinary shampoo                                                                                                                       | Record a chelator, but do not automatically call the shampoo a hard-water treatment |

## **2.5 Route S4: optical appearance**

- **High-refractive or gloss emollients.** Phenyl Trimethicone, Diphenyl Dimethicone or specialty gloss esters can support optical gloss, although they are more common in leave-ons than rinse-off shampoos.

- **Color correction.** Violet/blue pigments can reduce yellow/orange perception and make blonde, gray or highlighted hair look brighter without necessarily smoothing the surface.

- **Do not collapse brightness into shine.** Store “surface gloss” and “color brightness/toning” as separate properties.

## **2.6 Shine false friends**

| **Ingredient/claim cue**                      | **Why it can mislead**                                              | **Correct handling**                                                            |
|-----------------------------------------------|---------------------------------------------------------------------|---------------------------------------------------------------------------------|
| **Glycol Distearate / Glycol Stearate**       | Often makes the shampoo itself pearly or opaque                     | Do not score hair shine from this alone                                         |
| **Mica / Titanium Dioxide / visual pigments** | May color or pearlize the product                                   | Only score hair optical effect when deposition/toning is intended and plausible |
| **Citric or glycolic acid alone**             | May be a pH adjuster; final pH unknown                              | Weak S2 evidence unless the full system or pH supports it                       |
| **Glycerin / hyaluronic acid / panthenol**    | Can support feel or humectancy but do not independently prove gloss | Treat as supportive, not a primary shine mechanism                              |
| **Botanical oil/extract near the tail**       | Likely low level and may not deposit efficiently                    | Weak evidence unless supported by a delivery system or test                     |
| **“Micellar”**                                | All surfactant cleansers rely on micellar behavior                  | Do not create a special performance score from the word alone                   |

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><p><strong>FAST SHINE DIAGNOSIS</strong></p>
<p>Ask in order: (1) Is there a coherent smoothing/deposition system? (2) Is finished pH or an acid-conditioning system known? (3) Is the shampoo designed to remove organic or mineral buildup? (4) Is the claim actually color brightness rather than surface gloss? Record every applicable route instead of forcing one answer.</p></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

**DATA MODEL**

# **3. Classification architecture and scoring**

## **3.1 Separate intrinsic product properties from user fit**

| **Intrinsic product layer**               | **Derived user-fit layer**                                                   |
|-------------------------------------------|------------------------------------------------------------------------------|
| **Cleansing intensity potential**         | Suitable cleansing for this scalp oil level, wash frequency and buildup load |
| **Conditioning/deposition potential**     | Enough care for this damage/porosity without excessive weight                |
| **Weight/buildup potential**              | Acceptable for this strand diameter, density and styling routine             |
| **Shine/volume/repair mechanisms**        | Which desired outcome matters most for this user                             |
| **Fragrance/menthol/acid exposure flags** | Relevant sensitivity or scalp-condition constraints                          |
| **Evidence confidence**                   | Strength of wording allowed in the recommendation                            |

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><p><strong>WHY THIS MATTERS</strong></p>
<p>A rich silicone-depositing shampoo may be a legitimate shine shampoo and still be a poor fit for very fine, rapidly oily hair. A strong-cleaning volume shampoo may create lift and still be a poor fit for bleached, fragile lengths. Product truth and recommendation truth are different questions.</p></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

**Implementation default.** Keep the detailed 0–4 route scores as the auditable research layer, but expose a smaller operational profile to the recommendation system. Section 10 defines this minimum viable explainable matching layer and the evidence record required behind every label.

## **3.2 Formula-signal scale (0–4)**

| **Score** | **Meaning**                                                     | **Minimum rationale**                                                                 |
|-----------|-----------------------------------------------------------------|---------------------------------------------------------------------------------------|
| **0**     | No recognizable support or the formula clearly points elsewhere | No relevant system; do not infer from the product name                                |
| **1**     | Weak / indirect signal                                          | One isolated ingredient, secondary mechanism or uncertain delivery                    |
| **2**     | Plausible / moderate signal                                     | A coherent basic mechanism, but concentration or finished performance is uncertain    |
| **3**     | Strong formula signal                                           | Multiple aligned ingredients or a clearly purpose-built architecture                  |
| **4**     | Very strong signal                                              | Several aligned mechanisms and/or convincing product-specific evidence; use sparingly |

Scores may be expressed as ranges (for example, 2–3) when the exact formula is verified but concentrations, pH or deposition behavior remain unknown. A score is ordinal; it is not a percentage and should not be averaged across unrelated dimensions.


## **3.3 Calibration-derived gates and hard caps**

The first ten-product calibration showed that ingredient presence was being converted too quickly into performance. Before assigning any score of **2 or higher**, all three gates below must pass. If one gate fails, reduce the score or record an explicit exception supported by exact-product evidence.

| **Gate** | **Question** | **Failure consequence** |
|---|---|---|
| **G1. Functional relevance** | Can this ingredient/system plausibly affect this exact endpoint? | If no: score 0. A nearby benefit cannot be transferred. |
| **G2. Formula relevance and delivery** | Is it present in a plausible amount/context and can it reach or remain on hair? | If no or unclear: normally cap at 1. |
| **G3. Endpoint specificity** | Does the mechanism match this property rather than only a neighboring property? | If no: do not create that route score. |

### **Calibration caps**

- **S2 acidic shine:** acid name alone ≤1.
- **V2 bodying and R2 surface film:** one isolated or multifunctional protein/polymer ≤1.
- **R3 bond-specific:** generic acid, biotin, panthenol, generic protein or the word “bond” ≤1.
- **R4 prevention:** score 2+ only when a target stressor and matching route are named; score 3+ requires a purpose-built targeted system.
- **IC chelation:** one late generic chelator normally 0–1.
- **WT weight:** one depositor cannot create WT 3–4; persistence and reset capacity must also support it.
- **S3/V3 removal:** may not exceed the strongest relevant organic-clarification or inorganic-chelation route.
- **Evidence firewall:** finished-product studies never increase formula scores; they change E0–E5 evidence and confidence only.

## **3.4 Evidence scale (E0–E5)**

| **Level** | **Evidence available**                                     | **What may be said**                                                |
|-----------|------------------------------------------------------------|---------------------------------------------------------------------|
| **E0**    | Marketing claim only; exact formula or support unavailable | “The brand claims…” only                                            |
| **E1**    | General ingredient/mechanism literature                    | “This ingredient family can…”                                       |
| **E2**    | Exact formula verified; coherent mechanism identified      | “The formula plausibly/strongly supports…”                          |
| **E3**    | Product-specific consumer-perception study                 | Report as perception, with sample size and duration when available  |
| **E4**    | Product-specific instrumental or expert hair-tress test    | Describe exact endpoint, comparator, scope and protocol limitations |
| **E5**    | Independent, peer-reviewed finished-product evidence       | Strongest public evidence; still report population/test conditions  |

## **3.5 Confidence is separate from evidence level**

- **Low confidence.** Formula identity is uncertain, sources conflict, or the score relies on a single weak clue.

- **Moderate confidence.** Exact current INCI is verified and the mechanism is coherent, but finished-product variables are unknown.

- **High confidence.** Exact formula identity is secure and product-specific evidence directly tests the claimed endpoint at the stated scope.

## **3.6 Claim-audit verdicts**

| **Verdict**                         | **Definition**                                                                                               |
|-------------------------------------|--------------------------------------------------------------------------------------------------------------|
| **Strongly substantiated publicly** | Coherent exact formula plus directly relevant product-specific test evidence                                 |
| **Mechanistically plausible**       | Formula contains a credible system, but public finished-product proof is absent or limited                   |
| **Weak / hero-ingredient-led**      | Claim rests mainly on one low-context ingredient or broad marketing language                                 |
| **Indeterminate**                   | Exact formula, concentration, pH, test scope or product identity is insufficient                             |
| **Source/formula conflict**         | Available sources contradict each other; classification must be provisional until package-level verification |

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><p><strong>LEGAL LANGUAGE</strong></p>
<p>Do not label a claim “illegal” or “misleading” from INCI analysis alone. EU claims must meet common criteria and be consistent with substantiation held in the Product Information File, but that file is usually not public. The operational verdict is about available evidence, not a legal judgment. [1–2]</p></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

**REQUIRED CLASSIFICATION FIELDS**

# **4. Standard property dictionary**

Every shampoo record should contain the following dimensions. Optional specialist modules can be added later, but these fields form the minimum shared language for research and agent responses.

## **4.1 Exact product identity and formula integrity**

| **Required field**            | **Rule**                                                                               |
|-------------------------------|----------------------------------------------------------------------------------------|
| **Brand + full product name** | Copy exactly; include line/sub-line and variant                                        |
| **Market**                    | Country/region whose formula and claims are being classified                           |
| **Pack size**                 | Required even when the product name is identical                                       |
| **GTIN/EAN**                  | Primary machine identifier; store retailer article number separately                   |
| **Capture date**              | Date on which claims and INCI were verified                                            |
| **Formula source**            | Package photo preferred; otherwise official market page or exact-GTIN retailer listing |
| **INCI raw + normalized**     | Preserve original list and normalized ingredient tokens                                |
| **Formula fingerprint**       | Hash of normalized INCI to detect silent reformulation                                 |
| **Conflict status**           | None / minor formatting / material formula conflict / identity unresolved              |

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><p><strong>STOP CONDITION</strong></p>
<p>Do not issue a definitive product classification when two credible sources show materially different formulas for the same supposed product and the exact package cannot be identified. Output “provisional — identity conflict” and state what must be verified.</p></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

## **4.2 Cleansing intensity potential**

Definition: estimated ability to remove sebum and organic residue under ordinary use. Score direction: 0 = very low/cleanser not established; 4 = very high cleansing potential. This is not an irritation score.

<table>
<colgroup>
<col style="width: 33%" />
<col style="width: 33%" />
<col style="width: 33%" />
</colgroup>
<thead>
<tr class="header">
<th><strong>Increase the score when…</strong></th>
<th><strong>Moderate/lower the score when…</strong></th>
<th><strong>Do not infer…</strong></th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td><blockquote>
<p>• Multiple efficient anionic surfactants appear early</p>
<p>• Formula is explicitly weekly/clarifying</p>
<p>• Low heavy-deposition load</p>
<p>• Longer contact-time instructions support deep cleaning</p>
</blockquote></td>
<td><blockquote>
<p>• Blend relies more on milder-potential anionics plus amphoterics/nonionics</p>
<p>• Refatting and deposition system is substantial</p>
<p>• Daily/sensitive positioning is supported by full formula and pH</p>
</blockquote></td>
<td><blockquote>
<p>• Exact active surfactant concentration</p>
<p>• Harshness from one ingredient name</p>
<p>• Cleansing strength from foam amount</p>
<p>• Mildness from “sulfate-free” alone</p>
</blockquote></td>
</tr>
</tbody>
</table>

## **4.3 Conditioning and deposition potential**

Definition: estimated ability to leave lubricating, detangling, smoothing or film-forming material on hair after rinsing. Score direction: 0 = no recognizable system; 4 = very strong, multi-route deposition.

<table>
<colgroup>
<col style="width: 33%" />
<col style="width: 33%" />
<col style="width: 33%" />
</colgroup>
<thead>
<tr class="header">
<th><strong>Primary contributors</strong></th>
<th><strong>Strengthening combinations</strong></th>
<th><strong>Uncertainty/counter-signals</strong></th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td><blockquote>
<p>• Cationic polymers</p>
<p>• Silicones and amino silicones</p>
<p>• Conditioning amines/quats</p>
<p>• Fatty alcohols/refatting agents</p>
<p>• Protein/polymer films</p>
</blockquote></td>
<td><blockquote>
<p>• Silicone + cationic deposition aid</p>
<p>• Acid + protonatable amidoamine</p>
<p>• Multiple cationic/film-forming technologies</p>
<p>• Product-specific wet-comb or deposition data</p>
</blockquote></td>
<td><blockquote>
<p>• No exact concentrations</p>
<p>• A single late oil may not deposit</p>
<p>• Anionic/cationic compatibility cannot be proven from INCI</p>
<p>• Very strong cleansing may reduce perceived care</p>
</blockquote></td>
</tr>
</tbody>
</table>

## **4.4 Weight and buildup potential**

Definition: estimated tendency to leave cumulative or noticeable residue that can reduce movement, separation or root lift. Score direction: 0 = very low; 4 = high. It is a trade-off dimension, not a quality judgment.

- **Higher signals.** Multiple persistent film formers, rich silicone system, several oils/butters, strong cationic deposition and frequent-use instructions.

- **Lower signals.** Low-deposition cleansing system, limited lipids, lightweight targeted conditioning.

- **Critical caveat.** Silicone presence alone does not equal heavy buildup. Particle size, functionalization, dose, deposition selectivity, rinse behavior and the user’s wash routine matter.

- **User dependence.** The same residue level can be helpful on coarse/bleached hair and flatten fine/low-density hair.


### **4.4.1 Weight subjudgments**

Before assigning WT, record three separate subjudgments:

| **Subjudgment** | **Question** | **Examples** |
|---|---|---|
| **Deposition load** | How many hair-substantive conditioning routes are plausibly delivered? | Cationic polymer, amino silicone, fatty alcohol/lipid system, substantive protein. |
| **Persistence/accumulation** | How likely is the deposited material to remain through repeated use or resist ordinary cleansing? | Persistent silicones, layered polymers, repeated oil/film deposition. |
| **Reset capacity** | How strongly does the same formula remove residue, and is periodic clarification realistic? | Broad surfactant system, low deposition, clarifying use pattern. |

**WT anchors:** 0 = no meaningful deposition; 1 = light or low-persistence deposition; 2 = moderate deposition/persistence offset by rinse or reset; 3 = multiple persistent routes with limited reset; 4 = rare, very rich cumulative system. **One silicone, oil or polymer by itself cannot justify WT 3–4.**

## **4.5 Shine properties**

Store route-specific scores plus an overall predicted shine signal. Do not create only one undifferentiated “shine” flag.

| **Field**                 | **Definition**                                                 |
|---------------------------|----------------------------------------------------------------|
| **shine_deposition_s1**   | Gloss through smoothing/depositing film and improved alignment |
| **shine_acidic_s2**       | Gloss through supported low-pH/acidic surface management       |
| **shine_removal_s3**      | Gloss through removal of organic or inorganic dulling deposits |
| **brightness_optical_s4** | Color/optical brightness distinct from surface gloss           |
| **shine_overall**         | Reviewer synthesis; never hide the routes used                 |

## **4.6 Volume and body**

| **Route**                     | **Mechanism and signals**                                                                     | **Main trade-off**                                                 |
|-------------------------------|-----------------------------------------------------------------------------------------------|--------------------------------------------------------------------|
| **V1. Clean/light root lift** | Efficient sebum/residue removal with low heavy deposition                                     | May feel drying or insufficiently conditioning on damaged lengths  |
| **V2. Bodying film/grip**     | Hydrolyzed proteins, starch/cationic starch, PVP/VP-VA, acrylates or selected polyquaterniums | Too much film can feel stiff, coated or rough                      |
| **V3. Buildup reset**         | Clarification and, when relevant, chelation restore separation and movement                   | Usually periodic rather than every-wash use                        |
| **V4. Fiber-diameter claim**  | Requires direct instrumental evidence on the finished product                                 | Cannot be inferred from “biotin,” panthenol or protein names alone |

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><p><strong>VOLUME FORMULA LOGIC</strong></p>
<p>Volume support ≈ root cleansing + low weight + temporary bodying film − excessive deposition. Use this as a qualitative checklist, not a literal mathematical equation.</p></th>
</tr>
</thead>
<tbody>
</tbody>
</table>


### **4.6.1 V2/R2 film-relevance gate**

| **Signal** | **V2 bodying interpretation** | **R2 surface-film interpretation** |
|---|---|---|
| Cationic hydrolyzed protein or multiple aligned proteins plus deposition aid | Moderate to strong when the architecture plausibly adds grip/body | Moderate when substantivity and damaged-hair relevance are plausible |
| One late ordinary hydrolyzed protein | Maximum 1 without reinforcing context | Maximum 1 without reinforcing context |
| Carbomer, PEG-150 Distearate, Glycol Distearate or generic bottle-rheology polymer | Do not count unless a hair-depositing role is independently established | Do not count as patching merely because it is a polymer |
| Acrylate/silicone/polyquaternium network | Potential V2 only when formula context supports hair deposition | Potential R2 only when endpoint specificity and delivery pass G2/G3 |

V2 and R2 are not interchangeable. A film may add body without materially targeting damage, or smooth damage while reducing volume.

## **4.7 Smoothing and anti-frizz**

- **Primary mechanisms.** Lubrication, cationic deposition, silicone films, acidic surface management and reduced static/fiber-to-fiber friction.

- **Strong formula signal.** Multiple aligned conditioning ingredients with a plausible deposition system.

- **Trade-off.** A strong anti-frizz system can reduce airy volume; store both scores rather than forcing one label.

- **Do not infer humidity duration.** “Up to 72 hours” or similar claims require exact protocol and environmental conditions.

## **4.8 Repair and protection**

| **Repair route**                  | **What it can realistically mean**                                             | **Recognition signals**                                                                    |
|-----------------------------------|--------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------|
| **R1. Lubrication/protection**    | Less friction, easier combing and reduced future mechanical breakage           | Silicones, cationic polymers, fatty alcohols, refatting agents                             |
| **R2. Surface film/patching**     | Temporary filling/coating of irregular or porous areas; added body             | Hydrolyzed proteins, cationic protein derivatives, film-forming polymers                   |
| **R3. Bond-specific claim**       | A more specific molecular claim that cannot be validated from name/order alone | Named bond-targeting ingredient plus product-specific mechanistic and performance evidence |
| **R4. Damage-prevention support** | Reduction of metal-catalyzed, cleansing or grooming stress                     | Chelators, acidic system, color-protection polymers, lubrication                           |

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><p><strong>REPAIR LANGUAGE RULE</strong></p>
<p>Use “surface repair,” “damage management,” “protective conditioning” or “reduced breakage” when supported. Do not describe already-formed hair as biologically healing or returning fully to virgin structure unless an exact, narrowly defined test justifies that wording.</p></th>
</tr>
</thead>
<tbody>
</tbody>
</table>


### **4.8.1 R3 bond-specific anchors**

- **0:** no bond-specific route.
- **1:** generic branded “bond,” acid, biotin, panthenol or generic protein only.
- **2:** a named bond-targeting ingredient or proprietary technology is credibly mapped to the exact formula, but concentration/delivery is uncertain.
- **3–4:** require increasingly strong formula mapping and product-specific evidence; record formula signal and evidence scope separately.

### **4.8.2 R4 damage-prevention anchors**

Every R4 score of 2 or higher must complete the sentence: **“This formula may reduce [named stressor] through [matching protective route].”** Examples include combing breakage through lubrication, metal-catalyzed damage through a metal-binding/neutralizing system, or color loss through a documented protective film. Generic “care,” one acid or one chelator is normally R4 0–1.

## **4.9 Clarifying versus chelating**

| **Property**            | **Target**                                                                        | **Minimum formula support**                                                                                              |
|-------------------------|-----------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------|
| **clarifying_organic**  | Sebum, styling residue, dry shampoo, some polymer/oil buildup                     | Purposeful surfactant architecture and/or clarifying use directions                                                      |
| **chelating_inorganic** | Calcium/magnesium deposits, metals, chlorine-related residues depending chemistry | Recognizable chelator system; stronger when multiple chelators, adequate contact time or product data exist              |
| **reset_frequency**     | How often the product is intended to be used                                      | Every wash / weekly / every 1–2 weeks / as needed; record manufacturer instruction but do not treat it as efficacy proof |


### **4.9.1 Consistency rules**

- Score organic clarification, inorganic chelation and removal-derived shine separately.
- Ordinary cleansing alone normally supports OC 0–1 unless excess oil/product residue is a stated or architecturally strong target.
- A single late EDTA/GLDA/phytate normally supports IC 0–1.
- S3 cannot exceed the strongest relevant OC or IC route.
- V3 reset volume requires a genuine reset architecture and low/moderate net weight.
- If the manufacturer names a proprietary metal-neutralizing active but public INCI mapping is opaque, store mapping uncertainty and formula confidence; do not silently upgrade the score from test results.

## **4.10 Scalp mildness potential and exposure flags**

Mildness cannot be calculated reliably from an INCI list, but the formula can be screened for relative potential and exposure concerns. Keep cleansing intensity, irritation potential and allergen/sensory exposure separate.

| **Field**                   | **What to assess**                                                                                                      |
|-----------------------------|-------------------------------------------------------------------------------------------------------------------------|
| **mildness_potential**      | Surfactant blend, known mildness context, pH if disclosed, refatting/conditioning, intended frequency; score cautiously |
| **fragrance_exposure**      | Fragrance-free versus parfum/essential oils and declared fragrance allergens                                            |
| **sensory_actives**         | Menthol, camphor, strong essential oils; sensory freshness is not proof of cleansing                                    |
| **acid/exfoliant_exposure** | Salicylic/lactic/glycolic acids and contact-time instructions; distinguish pH adjustment from scalp treatment           |
| **sensitivity_confidence**  | High only when exact fragrance-free formula and relevant testing are clear                                              |

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><p><strong>SCOPE BOUNDARY</strong></p>
<p>Anti-dandruff, seborrheic dermatitis, psoriasis, hair-loss and antimicrobial claims require a separate scalp/medical module. Do not let a cosmetic formula classifier diagnose or replace professional care.</p></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

**RECOGNITION LIBRARY**

# **5. Ingredient-family reference**

The lists below are recognition aids, not automatic verdicts. Ingredients are multifunctional, trade-name blends can split into several INCI entries, and concentration, molecular structure, particle size, pH and process conditions are usually unknown.

## **5.1 Surfactant architecture**

| **Family / examples**                                                                                                                    | **Common role**                                  | **Classification guidance**                                                                                      |
|------------------------------------------------------------------------------------------------------------------------------------------|--------------------------------------------------|------------------------------------------------------------------------------------------------------------------|
| **Classical sulfate/ether sulfate: Sodium Lauryl Sulfate, Sodium Laureth Sulfate, Ammonium Lauryl/Laureth Sulfate, Sodium Coco-Sulfate** | Primary cleansing and foam                       | Often medium-to-high cleansing potential, but blend and active level dominate; SLES is not automatically “harsh” |
| **Olefin sulfonate: Sodium C14-16 Olefin Sulfonate**                                                                                     | Efficient anionic cleanser                       | Can support strong cleansing/clarifying even though it is “sulfate-free”                                         |
| **Isethionates/sulfoacetates: Sodium Cocoyl Isethionate, Sodium Lauroyl Methyl Isethionate, Sodium Lauryl Sulfoacetate**                 | Anionic cleansing                                | Often used in sulfate-free systems; do not assume weak cleansing                                                 |
| **Sarcosinates/taurates/glutamates/glycinates**                                                                                          | Anionic cleansing with varying mildness profiles | Potentially mild-to-moderate depending on blend and pH; exact ranking from INCI is unsafe                        |
| **Sulfosuccinates: Disodium Laureth Sulfosuccinate**                                                                                     | Anionic co-cleanser                              | Often used to moderate a blend, but can contribute meaningful cleaning                                           |
| **Amphoterics: Cocamidopropyl Betaine, Coco-Betaine, Hydroxysultaine, Sodium Cocoamphoacetate**                                          | Co-surfactant, foam/mildness/charge modification | May reduce irritation potential and alter coacervation; presence alone does not make the formula mild            |
| **Nonionics: Decyl/Lauryl/Coco-Glucoside; selected amine oxides**                                                                        | Co-cleaning, foam, solubilization                | Can be mild-potential but also contribute strong detergency in a concentrated blend                              |

## **5.2 Conditioning and deposition ingredients**

| **Family**                          | **Common examples**                                                                                | **Most useful inference**                                                            |
|-------------------------------------|----------------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------------|
| **Cationic guar/cellulose/starch**  | Guar Hydroxypropyltrimonium Chloride; Polyquaternium-10; Starch Hydroxypropyltrimonium Chloride    | Direct conditioning and/or dilution-deposition aid                                   |
| **Synthetic polyquaterniums**       | Polyquaternium-6, -7, -11, -22, -37, -47, -55, -67, -80                                            | Conditioning, film formation or deposition aid; function varies by polymer           |
| **Plain silicones**                 | Dimethicone; Dimethiconol; Divinyldimethicone/Dimethicone Copolymer                                | Lubrication, smoothing and shine potential                                           |
| **Amino/cationic silicones**        | Amodimethicone; Bis-Aminopropyl Dimethicone; Trimethylsilylamodimethicone; Silicone Quaternium-x   | More substantive/targeted deposition potential; exact weight depends on system       |
| **Fatty alcohols**                  | Cetyl Alcohol; Stearyl Alcohol; Cetearyl Alcohol                                                   | Lubrication, body and conditioner-like richness; not drying alcohols                 |
| **Refatting/emollient ingredients** | Glyceryl Oleate; PCA Glyceryl Oleate; PEG-7 Glyceryl Cocoate; esters/oils                          | Softness and reduced stripping; deposition can be limited in rinse-off               |
| **Conditioning amines/quats**       | Stearamidopropyl Dimethylamine; Brassicamidopropyl Dimethylamine; Behentrimonium/Cetrimonium salts | Cationic conditioning, often stronger in a properly acidified system                 |
| **Proteins/peptides**               | Hydrolyzed Wheat/Rice/Silk/Keratin/Quinoa; cationic protein derivatives                            | Temporary film, body, surface feel and damage management—not biological regeneration |

## **5.3 Acids, chelators, film formers and supportive ingredients**

| **Category**                       | **Examples**                                                                                                   | **Correct interpretation**                                                                       |
|------------------------------------|----------------------------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------|
| **Acids/pH adjusters**             | Citric, Lactic, Glycolic, Acetic, Malic, Tartaric Acid                                                         | Potential acidic route; strength unknown without final pH or system context                      |
| **Chelators**                      | EDTA salts; EDDS; GLDA; Sodium Phytate/Phytic Acid; Sodium Gluconate; Pentasodium Triphosphate; Etidronic Acid | Mineral/metal-management potential; low-level presence may only stabilize formula                |
| **Bodying/styling polymers**       | PVP; VP/VA Copolymer; Acrylates Copolymer; selected Polyquaterniums; Polyimide-1                               | Grip, film, body or hold; can also add residue/weight                                            |
| **Starches/clays**                 | Cationic starch; rice/corn starch; kaolin                                                                      | Oil absorption or body is plausible, but rinse-off performance may be limited without testing    |
| **Humectants/NMF-type**            | Glycerin; Propanediol; Betaine; Panthenol; Sodium PCA; Urea; Sodium Hyaluronate                                | Support hydration/feel; rinse-off presence alone is weak proof of lasting “moisture”             |
| **Antioxidants/extracts/vitamins** | Tocopherol; niacinamide; biotin; botanical extracts                                                            | May support positioning or scalp formula, but rarely explain immediate volume/shine/repair alone |

## **5.4 Advanced INCI interpretation rules**

11. **The 1% threshold.** Ingredients above 1% are listed in descending order; ingredients at or below 1% may appear in any order after the \>1% ingredients under EU rules. Position is evidence, not a concentration measurement. \[1\]

12. **Low dose can still matter.** A highly active polymer, fragrance, preservative, dye, acid or chelator may work below 1%; do not dismiss solely because it is late.

13. **Trade-name blends create clusters.** Amodimethicone may appear near Trideceth-10 and Cetrimonium Chloride because these are components of a supplied emulsion. Do not count every carrier as an independent benefit system.

14. **Ingredient function is contextual.** EDTA can support chelation but also formula stability; citric acid can support an acidic system but also simply adjust pH.

15. **Names do not reveal structure details.** Charge density, molecular weight, degree of substitution, silicone particle size and active content are usually unavailable.

16. **Repeated ingredients across versions matter.** A small pack, value pack or limited edition may carry a different formula despite the same product family name.

## **5.5 High-risk false inferences**

| **Do not conclude…**           | **From…**                                       | **Instead say…**                                                                           |
|--------------------------------|-------------------------------------------------|--------------------------------------------------------------------------------------------|
| **“This is mild”**             | Sulfate-free claim or one amphoteric surfactant | “The blend has mildness-supporting features, but total detergency is uncertain”            |
| **“This is non-conditioning”** | Silicone-free claim                             | “No silicone is listed; non-silicone conditioning may still be substantial”                |
| **“This will build up”**       | Any silicone or polymer                         | “There is deposition potential; cumulative weight depends on dose, type and routine”       |
| **“This repairs bonds”**       | Biotin, panthenol, protein or the word “bond”   | “The formula supports conditioning/protection; a bond-specific claim needs exact evidence” |
| **“This chelates hard water”** | Citric acid or one late EDTA alone              | “A chelator is present, but meaningful hair demineralization is uncertain”                 |
| **“This gives volume”**        | Biotin, caffeine or hyaluronic acid             | “Volume is better supported by cleansing/lightness and/or bodying film”                    |
| **“This shines hair”**         | Pearlizer such as Glycol Distearate             | “The ingredient mainly affects product appearance unless another mechanism is present”     |

**REPEATABLE WORKFLOW**

# **6. Research SOP**

## **6.1 Two-pass method to reduce marketing bias**

| **Pass**                              | **Actions**                                                                                                                   | **Output**                        |
|---------------------------------------|-------------------------------------------------------------------------------------------------------------------------------|-----------------------------------|
| **Pass A — blind formula analysis**   | Lock identity; capture INCI; normalize; identify formula architecture; score mechanisms without using the brand’s explanation | Independent formula profile       |
| **Pass B — claim and evidence audit** | Capture claims verbatim; find test details; compare each claim with the blind profile; record scope and conflicts             | Claim verdict and allowed wording |

## **6.2 Step-by-step process**

17. **Confirm scope.** Verify that the item is a rinse-off shampoo and not a medicated treatment, co-wash, dry shampoo or shampoo bar requiring a separate module.

18. **Lock the product identity.** Record market, exact name, pack size, GTIN/EAN, retailer article number, capture date and all source URLs.

19. **Capture claims verbatim.** Separate front-label claim, product-page prose, usage directions and routine-level claims.

20. **Acquire the exact INCI.** Prefer a readable package image; otherwise use the official market page or exact-GTIN retailer. Preserve the raw list.

21. **Normalize ingredients.** Standardize punctuation, synonyms and capitalization; retain original order; generate a formula fingerprint.

22. **Map formula architecture.** Identify primary/co-surfactants, cationic polymers, silicones, lipids, proteins/film formers, acids, chelators and scalp-exposure flags.

23. **Score properties.** Assign 0–4 ranges with one-sentence supporting and counter-signal rationales.

24. **Search evidence.** Look for product-specific testing, exact scope, endpoint, comparator, sample size, duration and whether the whole routine was used.

25. **Audit every claim.** Give a verdict, evidence level and confidence; do not let a hero ingredient substitute for a formula mechanism.

26. **Derive user fit.** Combine product properties with strand diameter, damage, scalp oil, wash frequency, buildup, hard water and desired finish.

27. **Run conflict checks.** Compare packaging metadata, “free from” tags and INCI; mark unresolved discrepancies.

28. **Publish the classification.** Include exact identity, scores, routes, trade-offs, sources, capture date and uncertainties.

## **6.3 Source hierarchy**

| **Priority** | **Formula/claim source**                                | **How to use it**                                                                            |
|--------------|---------------------------------------------------------|----------------------------------------------------------------------------------------------|
| **1**        | Current package photo for the exact market and GTIN     | Primary formula truth; transcribe carefully                                                  |
| **2**        | Official brand/manufacturer market page                 | Strong source for claims and INCI, but still compare to packaging                            |
| **3**        | Major retailer listing tied to exact GTIN               | Useful current market source; metadata errors can occur                                      |
| **4**        | Regulatory/official ingredient databases                | Use for standardized ingredient functions, not finished-product performance                  |
| **5**        | Peer-reviewed ingredient/formulation literature         | Use to support mechanisms and limits of inference                                            |
| **6**        | Supplier technical literature/patents                   | Useful formulation detail; label commercial interest and avoid treating as independent proof |
| **7**        | Blogs, retailer editorial pages, crowdsourced databases | Discovery only; do not use as decisive formula truth when stronger sources exist             |

## **6.4 Finished-product evidence checklist**

| **Question**                                             | **Why it matters**                                                                                 |
|----------------------------------------------------------|----------------------------------------------------------------------------------------------------|
| **Was the exact shampoo tested?**                        | A study on an ingredient or another formula cannot prove this product’s magnitude                  |
| **Shampoo alone or complete routine?**                   | Conditioner, mask, serum and styling can dominate the result                                       |
| **Instrumental, expert or consumer perception?**         | These answer different questions and should be labeled                                             |
| **What endpoint?**                                       | Shine, combing force, breakage, fiber diameter, volume, moisture and frizz are not interchangeable |
| **What comparator?**                                     | “Up to 3×” is meaningless without the comparison product and baseline                              |
| **After one wash or repeated use?**                      | Immediate deposition and cumulative effects differ                                                 |
| **Which hair substrate and conditions?**                 | Virgin, bleached, colored, curly, fine and coarse hair respond differently                         |
| **Was pH, humidity or hard-water condition controlled?** | These can materially alter the outcome                                                             |

## **6.5 Stop conditions and provisional outputs**

- **Material formula conflict.** Different surfactant or deposition systems appear across credible sources.

- **Missing identity.** No GTIN/pack size/market match.

- **Partial INCI.** Ellipses, “key ingredients” list or unreadable image instead of a full ingredient list.

- **Routine-only evidence.** The claim is attributed to shampoo but the public test uses multiple products.

- **Unsupported precision.** No data justify a numerical efficacy claim or exact cleansing/mildness rank.

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><p><strong>PROVISIONAL OUTPUT FORMAT</strong></p>
<p>“Identity confidence: low. Two current sources show materially different formulas. The following classification applies only to [source/GTIN/date] and must not be merged with the other version.”</p></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

**HUMAN + AGENT IMPLEMENTATION**

# **7. Output templates**

## **7.1 Human-review classification sheet**

| **Block**                         | **Required content**                                                                                                                        |
|-----------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------|
| **A. Identity**                   | Brand, full name, market, size, GTIN, source, capture date, formula fingerprint, conflicts                                                  |
| **B. Claims**                     | Verbatim claim; location; shampoo-only or routine wording                                                                                   |
| **C. Formula architecture**       | Primary surfactants; co-surfactants; cationic/deposition system; silicones; lipids; proteins/film formers; acids; chelators; exposure flags |
| **D. Detailed research scores**   | Cleansing, conditioning, weight, S1–S4 shine, V1–V4 volume, smoothing, R1–R4 repair, organic clarification, chelation, mildness potential   |
| **E. Evidence**                   | E0–E5, test type, endpoint, comparator, scope, duration, sample/substrate                                                                   |
| **F. Claim audit**                | Verdict + one supporting statement + one limitation/counter-signal                                                                          |
| **G. Lean matching profile**      | Cleansing band, primary/secondary focus, conditioning, weight, use role, hair-thickness fit and scalp-type fit                              |
| **H. Property evidence records**  | For every lean output: value, confidence, evidence level/scope, rationale, supporting signals, counter-signals and `derived_from`           |
| **I. Final verdict**              | One sentence on what the formula mainly does, whom it is likely to suit and what is not proven                                               |

## **7.2A Minimum viable explainable matching object**

Use this object as the default application-facing profile. The full 0–4 research object in Section 7.2B remains the audit layer. A fit label must never appear without its property-specific evidence record.

```json
{
  "model_version": "shampoo-matching-v1.3",
  "cleansing_strength": { "$ref": "property_decision" },
  "conditioning_level": { "$ref": "property_decision" },
  "weight_potential": { "$ref": "property_decision" },
  "focus": {
    "primary": { "$ref": "property_decision" },
    "secondary": []
  },
  "usage_role": { "$ref": "property_decision" },
  "hair_thickness_fit": {
    "fine": { "$ref": "property_decision" },
    "medium": { "$ref": "property_decision" },
    "coarse": { "$ref": "property_decision" }
  },
  "scalp_fit": {
    "oily": { "$ref": "property_decision" },
    "normal": { "$ref": "property_decision" },
    "dry": { "$ref": "property_decision" },
    "sensitive": { "$ref": "property_decision" }
  },
  "research_record_id": "",
  "overall_identity_confidence": "low|moderate|high"
}
```

The reusable `property_decision` object is:

```json
{
  "value": "",
  "decision_type": "direct_product_property|derived_user_fit",
  "confidence": "low|moderate|high",
  "evidence_level": "E0|E1|E2|E3|E4|E5",
  "evidence_scope": "formula_only|shampoo_only_test|multi_product_test|unclear",
  "rationale": "One or two sentences that answer why.",
  "supporting_signals": [
    {
      "observation": "Exact formula fact or test result",
      "inference": "What that fact implies for this property",
      "source_id": ""
    }
  ],
  "counter_signals": [
    {
      "observation": "Formula fact or uncertainty pointing the other way",
      "inference": "How it limits the conclusion",
      "source_id": ""
    }
  ],
  "derived_from": [],
  "shared_mechanism_ids": []
}
```

## **7.2B Full audit object**

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th>{<br />
"identity": {<br />
"brand": "",<br />
"product_name": "",<br />
"market": "DE",<br />
"pack_size_ml": 0,<br />
"gtin": "",<br />
"captured_at": "YYYY-MM-DD",<br />
"formula_source": "package|official|retailer",<br />
"formula_fingerprint": "",<br />
"identity_confidence": "low|moderate|high",<br />
"conflicts": []<br />
},<br />
"claims": [<br />
{<br />
"text_verbatim": "",<br />
"source_location": "front_pack|back_pack|product_page",<br />
"scope": "shampoo_only|multi_product|unclear"<br />
}<br />
],<br />
"formula_architecture": {<br />
"surfactants_primary": [],<br />
"surfactants_secondary": [],<br />
"cationic_polymers": [],<br />
"silicones": [],<br />
"conditioning_lipids_amines": [],<br />
"proteins_film_formers": [],<br />
"acids": [],<br />
"chelators": [],<br />
"exposure_flags": []<br />
},<br />
"gate_diagnostics": {<br />
"scores_2plus_gate_rationales": {},<br />
"weight_deposition_load": null,<br />
"weight_persistence": null,<br />
"weight_reset_capacity": null,<br />
"r4_target_stressor": "",<br />
"r4_protective_route": "",<br />
"r3_formula_signal_note": "",<br />
"r3_evidence_scope": "shampoo_only|multi_product|unclear",<br />
"removal_target": "organic|inorganic|both|none"<br />
},<br />
"scores_0_to_4": {<br />
"cleansing_intensity": null,<br />
"conditioning_deposition": null,<br />
"weight_buildup": null,<br />
"shine_s1_deposition": null,<br />
"shine_s2_acidic": null,<br />
"shine_s3_removal": null,<br />
"brightness_s4_optical": null,<br />
"volume_v1_clean_light": null,<br />
"volume_v2_body_film": null,<br />
"volume_v3_reset": null,<br />
"repair_r1_lubrication": null,<br />
"repair_r2_surface_film": null,<br />
"repair_r3_bond_specific": null,<br />
"repair_r4_prevention": null,<br />
"clarifying_organic": null,<br />
"chelating_inorganic": null,<br />
"mildness_potential": null<br />
},<br />
"evidence": {<br />
"level": "E0|E1|E2|E3|E4|E5",<br />
"tests": [],<br />
"scope_notes": ""<br />
},<br />
"claim_audit": [<br />
{<br />
"claim": "",<br />
"verdict": "substantiated|plausible|weak|indeterminate|source_conflict",<br />
"support": "",<br />
"limitation": ""<br />
}<br />
],<br />
"user_fit": {<br />
"best_for": [],<br />
"less_suited_for": [],<br />
"routine_dependencies": [],<br />
"frequency_notes": []<br />
},<br />
"final_verdict": "",<br />
"sources": []<br />
}</th>
</tr>
</thead>
<tbody>
</tbody>
</table>

## **7.3 Copy-paste research prompt for an agent**

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th>Classify the exact rinse-off shampoo below using the Shampoo Research &amp; Classification Standard.<br />
<br />
NON-NEGOTIABLE RULES<br />
1. Lock market, pack size, GTIN/EAN and capture date before scoring.<br />
2. Prefer package INCI, then official market page, then exact-GTIN major retailer.<br />
3. Analyze the formula blind before comparing it with marketing claims.<br />
4. Do not infer exact concentrations, finished pH, deposition or mildness from INCI alone.<br />
5. Keep shine routes, volume routes, repair routes, clarification and chelation separate.<br />
6. Treat formula score, evidence level and user fit as separate outputs.<br />
7. For each score of 2+, show G1 functional relevance, G2 formula relevance/delivery and G3 endpoint specificity.<br />
8. Apply the caps: acid alone S2 ≤1; isolated protein/polymer V2/R2 ≤1; generic bond cues R3 ≤1; single late chelator IC ≤1; one depositor cannot create WT 3–4.<br />
9. For WT report deposition load, persistence and reset capacity. For R4 name the stressor and route. For R3 separate formula signal from evidence level/scope.<br />
10. Finished-product studies never increase formula scores; they change evidence and confidence only.<br />
11. Mark material source conflicts and make the result provisional.<br />
12. Cite every formula, claim and product-specific test source.<br />
13. Produce the lean matching profile from Section 10. No naked label such as “fine-hair suitable” is allowed: each output must include value, confidence, E-level/scope, rationale, supporting signals, counter-signals and `derived_from`.<br />
14. For derived fit, show the chain formula observation → product-property inference → user-fit decision. Do not claim that one ingredient directly proves suitability.<br />
<br />
INPUT<br />
- Product name:<br />
- Market:<br />
- Pack size:<br />
- GTIN/EAN:<br />
- Package images or URLs:<br />
- User question (optional):<br />
<br />
OUTPUT<br />
A. Exact identity and source confidence<br />
B. Claims captured verbatim and their scope<br />
C. Formula architecture<br />
D. Gate diagnostics and 0–4 property scores with support/counter-signals<br />
E. Evidence level E0–E5 and test details<br />
F. Claim-audit verdicts<br />
G. Lean matching profile: cleansing band, focus, conditioning, weight, use role, thickness fit and scalp fit<br />
H. A property-evidence record for every lean output, including counter-signals and derivation chain<br />
I. Best fit, poor fit and routine dependencies<br />
J. One-sentence final verdict<br />
K. Machine-readable lean object plus full audit object<br />
<br />
For comparative questions such as “volume or repair?”, compare the corresponding route scores, explain the mechanisms, state trade-offs and add the relevant user context. Do not answer from the product name alone.</th>
</tr>
</thead>
<tbody>
</tbody>
</table>

## **7.4 Comparison answer template**

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><p><strong>USER QUESTION: “IS THIS BETTER FOR VOLUME OR REPAIR?”</strong></p>
<p>“This formula leans [volume/repair/hybrid]. Its volume support comes mainly from [V1/V2/V3 mechanism], while its repair support comes from [R1/R2/R3/R4 mechanism]. The main trade-off is [weight/dryness/limited conditioning]. It is therefore more suitable for [user profile], while [other profile] may prefer a different formula.”</p></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

- **Use “leans” rather than absolute labels.** Many shampoos are hybrids.

- **Compare route scores, not just overall labels.** A shampoo can have V1 volume and R1 protection simultaneously.

- **Tie “better” to the user.** Fine/oily hair and fine/bleached hair need different compromises.

- **State what is not proven.** For example: “The INCI supports surface conditioning, not a quantified bond-repair effect.”

**FORMULA SNAPSHOTS**

# **8. Worked German-market examples**

These examples use current online formula listings captured on 31 July 2026. They demonstrate the method, not permanent product truth. Packaging for the exact GTIN overrides an online listing when the two conflict. \[11–17\]

## **8.1 Balea Professional Hydra Volume, 250 ml**

| **Identity**     | **Value**                                                                                                                             |
|------------------|---------------------------------------------------------------------------------------------------------------------------------------|
| **GTIN**         | 4066447990126                                                                                                                         |
| **Key formula**  | SLES + Cocamidopropyl Hydroxysultaine + Coco-Glucoside; Sodium Hyaluronate; Niacinamide; Kaolin; Guar Hydroxypropyltrimonium Chloride |
| **Brand claims** | Care + volume; fine hair with flat roots and dry ends; silicone-free                                                                  |
| **Source**       | dm Germany listing, captured 31 July 2026 \[11\]                                                                                      |

| **Dimension**               | **Score**                 | **Rationale**                                                                                      |
|-----------------------------|---------------------------|----------------------------------------------------------------------------------------------------|
| **Cleansing intensity**     | 2–3                       | Efficient SLES-led blend moderated by hydroxysultaine/glucoside; exact active level unknown        |
| **Conditioning/deposition** | 1–2                       | Cationic guar provides a plausible light deposition system; no rich silicone/lipid system          |
| **Weight/buildup**          | 1                         | Low heavy-deposition load; kaolin effect in rinse-off is uncertain                                 |
| **Volume V1 clean/light**   | 3                         | Strongest route: root cleansing plus low weight                                                    |
| **Volume V2 body film**     | 1                         | No clear protein or strong bodying polymer system                                                  |
| **Repair overall**          | 1                         | Light conditioning only; no substantial repair architecture                                        |
| **Claim verdict**           | Mechanistically plausible | The formula supports volume mainly by clean/light behavior, not a dramatic fiber-thickening active |

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><p><strong>EXAMPLE VERDICT</strong></p>
<p>This is primarily a light volume shampoo, not a repair shampoo. It is likely to suit fine hair whose roots flatten from oil or residue; dry, bleached lengths may still need a separate conditioner.</p></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

## **8.2 Balea Professional Ultimate Volume versus Pantene Repair & Care**

| **Product**                                            | **Key formula signals**                                                                             | **Volume profile**                                                 | **Repair profile**                                                   |
|--------------------------------------------------------|-----------------------------------------------------------------------------------------------------|--------------------------------------------------------------------|----------------------------------------------------------------------|
| **Balea Ultimate Volume, 250 ml — GTIN 4067796075021** | SLES-led cleansing; hydrolyzed wheat protein; rice extract; cationic guar; no silicone \[12\]       | V1 3; V2 2–3: clean/light plus temporary protein film/grip         | R1/R2 1–2: light conditioning and protein film, not rich protection  |
| **Pantene Repair & Care, 200 ml — GTIN 8700216885805** | SLES blend; stearyl/cetyl alcohol; cationic guar; Polyquaternium-6; panthenol; silicone-free \[13\] | V1 1–2: it cleans, but architecture is not optimized for airy lift | R1/R2 3: multi-part non-silicone conditioning and surface protection |

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><p><strong>COMPARATIVE ANSWER</strong></p>
<p>Balea Ultimate Volume leans volume because it combines a light cleansing base with protein/cationic body support. Pantene Repair &amp; Care leans repair/conditioning because fatty alcohols, cationic guar and Polyquaternium-6 create a more care-focused deposition system. Fine oily hair is more likely to prefer Balea; fine but damaged hair may need the Pantene-style compromise or a light volume shampoo plus separate conditioner.</p></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

## **8.3 L’Oréal Elvital Glycolic Gloss: same name, different formula**

| **Version**                     | **Formula architecture**                                                                                                                                              | **Shine interpretation**                                                                              |
|---------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------|
| **200 ml — GTIN 3600524128005** | Sodium C14-16 Olefin Sulfonate + betaines/sarcosinate; cationic guar; PEG-55 Propylene Glycol Oleate; Polyquaternium-7; glycolic acid late; no listed silicone \[14\] | S1 moderate via cationic/refatting system; S2 weak/uncertain without pH; cleaning may also contribute |
| **300 ml — GTIN 3600524293543** | SLES blend; Dimethicone early; cationic guar; Amodimethicone; multiple acids; glycolic acid late \[15\]                                                               | S1 strong via silicone + deposition system; S2 possible but secondary/uncertain without finished pH   |

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><p><strong>DATA-MODEL LESSON</strong></p>
<p>Do not merge these as one “Glycolic Gloss shampoo” record. Pack size and GTIN identify materially different cleansing and shine architectures. The 300 ml version’s most obvious shine mechanism is silicone deposition—not the hero acid alone.</p></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

## **8.4 Olaplex No.4C Clarifying Shampoo**

| **Key observation**     | **Classification**                                                                                                  |
|-------------------------|---------------------------------------------------------------------------------------------------------------------|
| **Formula**             | Broad sulfate-free surfactant system plus EDDS and Pentasodium Triphosphate; Polyquaternium-11 and panthenol \[16\] |
| **Clarifying organic**  | 3–4: purpose-built broad cleansing and weekly use                                                                   |
| **Chelating inorganic** | 3: two recognizable complexing/chelating components, plus explicit mineral/metal positioning                        |
| **Shine route**         | Primarily S3 removal of dulling residue, not a rich S1 silicone-gloss route                                         |
| **Trade-off**           | Periodic reset product; care system is supportive but not equivalent to a conditioning shampoo                      |

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><p><strong>EXAMPLE VERDICT</strong></p>
<p>This can legitimately improve apparent shine by removing the things that make hair look dull. That does not make it the same type of “shine shampoo” as a silicone-depositing gloss formula.</p></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

## **8.5 A live source-conflict example**

At the capture date, one dm listing for Pantene Repair & Care Love Edition displayed a “silicone-free” product tag while the same page’s INCI listed Dimethiconol and Dimethicone. \[17\] The correct workflow is not to choose whichever field supports the desired narrative. Flag the record, verify the package and keep the classification provisional.

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><p><strong>QA RULE</strong></p>
<p>Machine ingestion must compare “free-from” metadata against normalized INCI. A direct contradiction should automatically create a high-priority review task.</p></th>
</tr>
</thead>
<tbody>
</tbody>
</table>


## **8.6 Calibration stress test after tightening (five new German-market products)**

These products were selected adversarially: each contains ingredients, claims or source conditions that would have triggered a known over-scoring pattern in the first calibration. The companion workbook stores the full 17-dimensional profiles, gate rationales and rule-pass comparison.

| **Exact product** | **Rules stressed** | **Tightened anchor** | **Why this is useful** |
|---|---|---|---|
| **Redken Acidic Bonding Concentrate Shampoo, 300 ml — GTIN 884486456281** \[18\] | Acidic shine, weight, bond-specific repair, prevention | S2 3; WT 2; R3 1; R4 2 | Citric Acid is fifth and official acidic-pH positioning is explicit, so S2 is strong. Silicones/cationic polymer support S1/R1. “Bonding” does not by itself create high R3, and complete-system directions remain separate evidence. |
| **OGX Thick & Full Biotin & Collagen, 385 ml — GTIN 3574661800202** \[19\] | Acid over-scoring; protein/starch bodying versus generic repair | S2 1; V2 3; R2 2; WT 2 | Lactic/Citric Acid stay at S2 1 without pH. Collagen + modified potato starch + cationic starch form a coherent bodying network; biotin is not a volume or bond active by itself. |
| **Balea Professional Tiefenreinigung, 250 ml — GTIN 4070765001020** \[20\] | Organic clarification versus inorganic chelation; reset volume | S3 3; OC 3; V3 3; IC 0 | Purposeful SLES-led residue/oil removal and low weight support an organic reset. No recognizable chelating system supports hard-water or metal-removal wording. |
| **Balea Professional Oil Repair Intensiv, 250 ml — live German GTIN 4066447806786; recent cached GTIN 4070765001389** \[21\] | Oil/keratin over-counting, weight, repair and identity conflict | WT 2; R1 2; R2 1; R3 0; R4 1 | Three oils appear early, but this is a surfactant-rich rinse-off formula with limited deposition support. One later Hydrolyzed Keratin is not strong patching or bond repair. The version conflict requires a provisional record. |
| **L’Oréal Professionnel Metal DX Shampoo, 300 ml — EAN 30163188** \[22–23\] | Proprietary active mapping, inorganic removal, targeted prevention, routine evidence | IC 2; S3 3; R4 3; WT 2 | Exact-product positioning maps a Glicoamine metal-neutralizing route, but public INCI mapping is not fully transparent. The stressor-route pair supports R4; numerical breakage/strength results are multi-product, not shampoo-only. |

### **Stress-test outcome**

Across **85 score comparisons**, the tightened deterministic pass matched the adjudicated key exactly in **81 cases (95.3%)**, stayed within one point in all cases and produced a mean absolute difference of **0.05** on the 0–4 scale. The four remaining one-point boundaries concern generic acidic “bonding” cues, bodying-film versus repair-film strength, rinse-off oil weight, and proprietary active-to-INCI mapping. This is an **internal consistency test, not independent validation**.

**AGENT COMMUNICATION**

# **9. User-facing response rules**

## **9.1 Translate mechanisms into useful language**

| **Internal classification**                   | **Good user-facing explanation**                                                                                    |
|-----------------------------------------------|---------------------------------------------------------------------------------------------------------------------|
| **S1 strong: silicone + cationic deposition** | “This formula should give smoother, shinier hair by leaving a lubricating conditioning film.”                       |
| **V1 strong, low weight**                     | “Its volume effect is mainly from cleaning the roots well without leaving a heavy coating.”                         |
| **R2 protein film**                           | “The proteins can temporarily coat and support damaged areas; this is surface care, not permanent reconstruction.”  |
| **S3/chelation strong**                       | “It may restore brightness by removing residue and mineral deposits rather than by coating the hair.”               |
| **Identity/evidence uncertain**               | “The available formula supports this direction, but the exact strength is uncertain and current listings conflict.” |

## **9.2 Words to prefer and avoid**

| **Prefer**                                                      | **Avoid unless directly proven**                          |
|-----------------------------------------------------------------|-----------------------------------------------------------|
| **“Plausibly supports,” “leans,” “likely,” “formula suggests”** | “Guaranteed,” “definitely,” “will work for everyone”      |
| **“Surface smoothing,” “protective film,” “reduced friction”**  | “Heals,” “regenerates living hair,” “rebuilds completely” |
| **“Higher cleansing potential”**                                | “Harsh” from one surfactant name                          |
| **“Deposition/weight potential”**                               | “Causes buildup” from silicone presence alone             |
| **“Acidic route is uncertain without finished pH”**             | “Glycolic acid closes the cuticle” from INCI alone        |
| **“Consumer-perception study” or “instrumental tress test”**    | Generic “clinically proven” without protocol              |

## **9.3 Minimum answer structure for product questions**

29. **Bottom line.** State what the formula mainly leans toward.

30. **Mechanism.** Name the two or three most important ingredient systems, not a long INCI dump.

31. **Trade-off.** Explain weight, dryness, buildup or limited care.

32. **User fit.** Tie the result to scalp oil, strand diameter, damage and desired finish.

33. **Confidence.** State whether the conclusion is formula-based only or supported by product-specific testing.

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><p><strong>MODEL ANSWER</strong></p>
<p>“This shampoo leans repair/conditioning rather than volume. The fatty alcohol + cationic polymer + silicone system should reduce friction and smooth damaged hair, while its volume support comes mostly from ordinary cleansing. On very fine, quickly oily hair that deposition may reduce lift; on bleached or rough hair it is more likely to be useful. The formula makes the direction plausible, but it does not by itself prove the brand’s exact numerical repair claim.”</p></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

**OPERATIONAL CONTROL**


**LEAN IMPLEMENTATION LAYER**

# **10. Lean explainable product-to-user matching layer**

## **10.1 Why this layer exists**

The full research system is intentionally detailed because it must distinguish mechanisms, evidence and uncertainty. The application does not need to expose or store every score as a first-class product field. A practical intermediate implementation keeps:

- the complete research record as the auditable source of truth;
- a small matching profile for recommendation logic;
- one reusable evidence object behind every displayed or stored conclusion.

The objective is not merely to output `fine_hair_fit = recommended`. The system must be able to answer: **Why is it recommended, what formula facts support that conclusion, what points against it, and how certain are we?**

## **10.2 Minimum viable matching profile**

| **Field** | **Allowed values** | **Direct or derived?** | **Main upstream inputs** | **Default confidence ceiling** |
|---|---|---|---|---|
| **cleansing_strength** | low / moderate / strong / clarifying | Direct product property | Surfactant architecture, OC, IC, use instructions | Moderately high |
| **conditioning_level** | low / moderate / high | Direct product property | Cationic deposition, silicones, lipids, amines, R1 | Moderately high |
| **weight_potential** | low / moderate / high | Direct product property | Deposition load, persistence, accumulation, reset capacity | Moderate |
| **focus.primary** | volume / shine / repair / clarifying / scalp-active / gentle / general | Direct product interpretation | Strongest coherent route scores and claim audit | High |
| **focus.secondary** | zero to two values from the same list | Direct product interpretation | Secondary coherent mechanisms | Moderately high |
| **usage_role** | frequent / regular / alternating / occasional-reset / treatment | Direct product interpretation | Cleansing, conditioning, active type, directions | Moderate |
| **hair_thickness_fit** | recommended / conditional / neutral / caution / unknown for fine, medium and coarse | Derived user fit | Weight, conditioning, cleansing, volume route, damage context | Moderate |
| **scalp_fit** | recommended / conditional / neutral / caution / unknown for oily, normal, dry and sensitive | Derived user fit | Cleansing, OC, mildness, refatting, exposure flags, scalp-active evidence | Variable |

This is the recommended **in-between model**. The detailed scores can remain in a linked research JSON, audit table or versioned research artifact.

## **10.3 Every property gets its own evidence record**

A global statement such as `formula_evidence = E2` is not sufficient. Different conclusions from the same formula can have different confidence.

Every direct property and every derived fit must therefore include:

- `value`
- `decision_type`
- `confidence`
- `evidence_level`
- `evidence_scope`
- `rationale`
- `formula_observations`
- `product_inferences`
- `counter_signals`
- `derived_from`
- `source_ids`
- `shared_mechanism_ids`

### **No naked-label rule**

Invalid:

```text
fine_hair_fit = recommended
```

Minimum valid output:

```text
fine_hair_fit = conditional
confidence = moderate
evidence_level = E2
rationale = Moderate deposition may help damaged fine hair but may add weight; strong cleansing partly offsets root flattening.
derived_from = [conditioning_level, weight_potential, cleansing_strength, damage_context]
```

## **10.4 The required evidence chain**

Every derived user-fit conclusion must show three distinct steps:

1. **Formula observation.** What is objectively present or documented?
2. **Product-property inference.** What behavior does that system plausibly create?
3. **User-fit decision.** Why is that behavior helpful or unhelpful for this user profile?

| **Step** | **Example** |
|---|---|
| **Formula observation** | Dimethicone and Amodimethicone plus a cationic polymer are present; the shampoo also has an efficient anionic cleansing system. |
| **Product-property inference** | Conditioning is high, weight potential is moderate and cleansing potential is strong. |
| **User-fit decision** | Fine-hair fit is conditional: potentially useful for fine damaged hair, but possibly flattening for healthy very-fine hair. |

An ingredient must not jump directly from observation to user suitability. `Amodimethicone present → suitable for coarse hair` is not an acceptable evidence chain.

## **10.5 Simple derivation rules for the four core outputs**

### **Cleansing strength**

Derive primarily from surfactant architecture, organic clarification, inorganic chelation and intended use. Use broad bands rather than false numerical precision.

### **Product focus**

Choose the strongest coherent mechanism as the primary direction and allow up to two secondary directions. A marketing word does not become the focus unless the formula or evidence supports it.

### **Hair-thickness fit**

Use conditioning level, weight potential, cleansing strength, volume routes, damage/porosity context and routine dependencies. Fine damaged hair may need more conditioning than fine healthy hair.

### **Scalp-type fit**

Treat scalp fit as separate axes:

- **oily:** cleansing strength, OC, weight and wash role;
- **normal:** balance and intended frequency;
- **dry:** cleansing, mildness, refatting and exposure flags;
- **sensitive:** fragrance, essential oils, menthol/cooling agents, irritancy-relevant architecture and product-level tolerance evidence.

Sensitive-scalp safety cannot be established from INCI alone.

## **10.6 Confidence ceilings for the lean profile**

| **Conclusion** | **Normal maximum from exact INCI + mechanism analysis alone** |
|---|---|
| **Primary product focus** | High |
| **Broad cleansing band** | Moderately high |
| **Conditioning level** | Moderately high |
| **Weight potential** | Moderate |
| **Hair-thickness fit** | Moderate |
| **Oily-scalp fit** | Moderate to moderately high |
| **Dry-scalp fit** | Low to moderate |
| **Sensitive-scalp fit** | Low without E3/E4 tolerance evidence |

## **10.7 Recommended storage pattern**

For a simple current database, store two versioned JSON fields:

```text
matching_profile_json     # lean fields used by the application
research_trace_json       # detailed formula architecture, route scores, claims, evidence and sources
```

Normalize property evidence into a separate table only when analytics, review queues or partial updates make that useful.

## **10.8 User-facing explanation template**

> **Fine-hair fit: conditional (moderate confidence).** The exact formula has a moderate deposition system from [ingredients/system], which can improve damaged fine hair but may add weight. Its [cleansing/reset signal] partly offsets that risk. This makes it more suitable for [specific fine-hair context] than for [counter-profile]. Evidence: [E-level and scope].

## **10.9 Researcher and agent completion rule**

A product property is not complete until the researcher can answer:

1. What is the value?
2. Is it a direct product property or a derived user-fit conclusion?
3. Why do we believe it?
4. Which exact formula facts or tests support it?
5. What points against it or limits it?
6. Which upstream properties was it derived from?
7. How confident are we?
8. What is the evidence level and scope?
9. Which exact sources support the record?

If these cannot be answered, use a weaker label or `unknown`.

# **Appendix A. One-page reviewer checklist**

| **Block**    | **Check**                                               | **Done** |
|--------------|---------------------------------------------------------|----------|
| **Identity** | Exact market, size and GTIN recorded                    | □        |
| **Identity** | Current package/official/retailer INCI source dated     | □        |
| **Identity** | Source conflicts checked and flagged                    | □        |
| **Claims**   | Front/back/product-page claims copied verbatim          | □        |
| **Claims**   | Shampoo-only versus routine scope recorded              | □        |
| **Formula**  | Primary and secondary surfactants mapped                | □        |
| **Formula**  | Cationic polymers, silicones, lipids/amines mapped      | □        |
| **Formula**  | Proteins/film formers, acids and chelators mapped       | □        |
| **Scores**   | Cleansing, conditioning and weight scored               | □        |
| **Scores**   | Shine routes S1–S4 scored separately                    | □        |
| **Scores**   | Volume routes V1–V4 scored separately                   | □        |
| **Scores**   | Repair routes R1–R4 scored separately                   | □        |
| **Scores**   | Organic clarification and inorganic chelation separated | □        |
| **Evidence** | E0–E5 assigned; endpoint/comparator/duration captured   | □        |
| **Audit**    | Each claim has support + limitation + verdict           | □        |
| **Fit**      | Best fit, poor fit and routine dependency stated        | □        |
| **Output**   | Final verdict avoids certainty beyond evidence          | □        |
| **Output**   | Sources and capture date included                       | □        |

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><p><strong>FINAL QA QUESTION</strong></p>
<p>Could another trained reviewer reproduce the classification from the stored formula, sources and rules without relying on the original researcher’s intuition? If not, the record is not yet auditable.</p></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

**EVIDENCE BASE**

# **Appendix B. References and current product sources**

Scientific references establish mechanisms and limits of inference. Product links establish only the listed formula/claims for the captured market version and date; they are not permanent formula guarantees. Revalidate ingredient-family rules when materially stronger evidence or new delivery technologies emerge, and revalidate each product record whenever its formula fingerprint or packaging claims change.

\[1\] European Parliament and Council. Regulation (EC) No 1223/2009 on cosmetic products, especially Article 19 (ingredient labeling) and Article 20 (claims). [<u>Open source</u>](https://eur-lex.europa.eu/eli/reg/2009/1223/oj/eng)

\[2\] European Commission. Commission Regulation (EU) No 655/2013 laying down common criteria for the justification of claims used in relation to cosmetic products. [<u>Open source</u>](https://eur-lex.europa.eu/eli/reg/2013/655/oj/eng)

\[3\] Kakizawa Y, Miyake M. Creation of New Functions by Combination of Surfactant and Polymer — Complex Coacervation with Oppositely Charged Polymer and Surfactant for Shampoo and Body Wash. Journal of Oleo Science. 2019;68(6):525–539. doi:10.5650/jos.ess19081. [<u>Open source</u>](https://doi.org/10.5650/jos.ess19081)

\[4\] Jordan SL, Zhang X, Amos J, et al. Evaluation of novel synthetic conditioning polymers for shampoos. Journal of Cosmetic Science. 2009;60:239–250. PMID: 19450423. [<u>Open source</u>](https://pubmed.ncbi.nlm.nih.gov/19450423/)

\[5\] Lepilleur C, Mullay J, Kyer C, McCalister P, Clifford T. Use of statistical modeling to predict the effect of formulation composition on coacervation, silicone deposition, and conditioning sensory performance of cationic cassia polymers. Journal of Cosmetic Science. 2011;62:161–177. PMID: 21635845. [<u>Open source</u>](https://pubmed.ncbi.nlm.nih.gov/21635845/)

\[6\] Fernandes C, et al. On Hair Care Physicochemistry: From Structure and Degradation to Novel Biobased Conditioning Agents. Polymers. 2023;15(3):608. doi:10.3390/polym15030608. [<u>Open source</u>](https://doi.org/10.3390/polym15030608)

\[7\] Gao T, Pereira A, Zhu S. Study of hair shine and hair surface smoothness. Journal of Cosmetic Science. 2009;60(2):187–197. PMID: 19450419. [<u>Open source</u>](https://pubmed.ncbi.nlm.nih.gov/19450419/)

\[8\] Dias MFRG, de Almeida AM, Cecato PMR, Adriano AR, Pichler J. The Shampoo pH can Affect the Hair: Myth or Reality? International Journal of Trichology. 2014;6(3):95–99. doi:10.4103/0974-7753.139078. [<u>Open source</u>](https://doi.org/10.4103/0974-7753.139078)

\[9\] Brown MA, Hutchins TA, Gamsky CJ, et al. Liquid crystal colloidal structures for increased silicone deposition efficiency on colour-treated hair. International Journal of Cosmetic Science. 2010;32(3):193–203. doi:10.1111/j.1468-2494.2010.00540.x. [<u>Open source</u>](https://doi.org/10.1111/j.1468-2494.2010.00540.x)

\[10\] Srinivasan G, Srinivas CR, Mathew AC, Duraiswami D. Effects of Hard Water on Hair. International Journal of Trichology. 2013;5(3):137–139. doi:10.4103/0974-7753.125609. [<u>Open source</u>](https://doi.org/10.4103/0974-7753.125609)

\[11\] dm Germany. Balea Professional Shampoo Hydra Volume, 250 ml; GTIN 4066447990126. Formula and claims captured 31 July 2026. [<u>Open source</u>](https://www.dm.de/p/d/3126236/balea-professional-shampoo-hydra-volume)

\[12\] dm Germany. Balea Professional Shampoo Ultimate Volume, 250 ml; GTIN 4067796075021. Formula and claims captured 31 July 2026. [<u>Open source</u>](https://www.dm.de/p/d/1703262/balea-professional-shampoo-ultimate-volume)

\[13\] dm Germany. Pantene Pro-V Shampoo Repair & Care, 200 ml; GTIN 8700216885805. Formula and claims captured 31 July 2026. [<u>Open source</u>](https://www.dm.de/p/d/3045067/pantene-pro-v-shampoo-repair-und-care)

\[14\] dm Germany. L’Oréal Paris Elvital Shampoo Glycolic Gloss, 200 ml; GTIN 3600524128005. Formula and claims captured 31 July 2026. [<u>Open source</u>](https://www.dm.de/p/d/1346429/l-oreal-paris-elvital-shampoo-glycolic-gloss)

\[15\] dm Germany. L’Oréal Paris Elvital Shampoo Glycolic Gloss, 300 ml; GTIN 3600524293543. Formula and claims captured 31 July 2026. [<u>Open source</u>](https://www.dm.de/p/d/3138002/l-oreal-paris-elvital-shampoo-glycolic-gloss)

\[16\] Olaplex Germany. No.4C Bond Maintenance Clarifying Shampoo. Formula, claims and use instructions captured 31 July 2026. [<u>Open source</u>](https://olaplex.de/products/olaplex-n-4c-bond-maintenance-clarifying-shampoo)

\[17\] dm Germany. Pantene Pro-V Shampoo Love Edition Repair & Care, 250 ml; GTIN 8006530274982. Source-conflict example captured 31 July 2026. [<u>Open source</u>](https://www.dm.de/p/d/3130899/pantene-pro-v-shampoo-love-edition-repair-und-care)


\[18\] Redken Germany. Acidic Bonding Concentrate Shampoo, 300 ml; GTIN 884486456281. Formula, acidic-pH positioning and complete-system directions captured 31 July 2026. [<u>Open source</u>](https://www.redken.eu/de-de/produkte/haarpflege/acidic-bonding-concentrate/acidic-bonding-concentrate-shampoo)

\[19\] dm Germany. OGX Shampoo Thick & Full Biotin & Collagen, 385 ml; GTIN 3574661800202. Formula and claims captured 31 July 2026. [<u>Open source</u>](https://www.dm.de/p/d/1443641/ogx-shampoo-thick-und-full-biotin-und-collagen)

\[20\] dm Germany. Balea Professional Shampoo Tiefenreinigung, 250 ml; GTIN 4070765001020. Formula and claims captured 31 July 2026. [<u>Open source</u>](https://www.dm.de/p/d/1536339/balea-professional-shampoo-tiefenreinigung)

\[21\] dm Germany. Balea Professional Shampoo Oil Repair Intensiv, 250 ml. Live page GTIN 4066447806786; recent cached German listing of the same URL GTIN 4070765001389. Formula/identity conflict captured 31 July 2026. [<u>Open source</u>](https://www.dm.de/p/d/1703915/balea-professional-shampoo-oil-repair-intensiv)

\[22\] L’Oréal Professionnel Germany. Serie Expert Metal DX Shampoo. Claims, Glicoamine technology description and multi-product test scope captured 31 July 2026. [<u>Open source</u>](https://www.lorealprofessionnel.de/alle-produkte/haarpflege/metal-dx-shampoo)

\[23\] L’Oréal Partner Shop Germany. Metal DX Shampoo, 300 ml; EAN 30163188. Exact INCI and identity captured 31 July 2026. [<u>Open source</u>](https://de.lorealpartnershop.com/default/metal-dx-shampoo/DE30163188.html)

## **Version log**

| **Version** | **Date**     | **Change**                                                                                                                                              |
|-------------|--------------|---------------------------------------------------------------------------------------------------------------------------------------------------------|
| **1.0**     | 31 July 2026 | Initial operational standard covering conditioning/coacervation, shine routes, volume, repair, clarification, evidence and recurring research workflow. |
| **1.1**     | 31 July 2026 | First ten-product German calibration; route-specific scoring, two-reviewer workbook and initial agreement analysis. |
| **1.2**     | 31 July 2026 | Calibration refinement: G1–G3 score gates, hard caps, weight subjudgments, formula/evidence firewall and five-product stress test. |
| **1.3**     | 10 August 2026 | Added the minimum viable explainable matching layer, property-specific evidence records, direct-versus-derived fit logic, confidence ceilings and no-naked-label rule. |
