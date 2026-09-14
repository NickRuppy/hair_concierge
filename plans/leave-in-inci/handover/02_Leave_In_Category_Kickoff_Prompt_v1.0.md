# Ready-to-paste prompt: build the leave-in category standard

You are developing an evidence-backed ingredient-research and product-matching standard for a new Charlie hair-care category.

CATEGORY
Conventional leave-in conditioner / cream / milk / spray for the current German/EU market.

CURRENT STATE
Shampoo and rinse-out conditioner standards are substantially in place. Treat them as worked references. Reuse their exact-identity control, source hierarchy, evidence model, property-evidence object, calibration protocol and explainable matching pattern. Do not copy rinse-out conditioner dimensions or score rules without re-researching them for leave-on exposure.

CONTEXT FILES
1. Cross-Category Ingredient Research & Matching Playbook — latest version
2. Shampoo Research & Classification Standard and calibration — latest version
3. Rinse-Out Conditioner Research & Classification Standard and calibration — latest version
4. Generic Product Research Schema — latest version
5. Leave-In Category Development Handover v1.0

MISSION
Create a repeatable, auditable standard that allows a human or AI researcher to classify an exact leave-in formula, estimate its direct product behavior, derive explainable user fit and store evidence behind every property.

WORKING CATEGORY BOUNDARY
Include water-based or emulsion-based leave-in sprays, mists, milks, lotions, creams and two-phase products when conditioning, detangling, smoothing, curl support or heat-styling support is primary or co-primary.

Initially exclude pure oils and anhydrous silicone serums; styling-first gels, mousses, hairsprays, waxes and strong-hold products; rinse-out conditioners and masks; scalp serums and growth tonics; medicated products; color-depositing leave-ins; and salon chemical treatments.

Use function + directions + formula architecture rather than product name. Ambiguous products must be marked provisional or used as boundary stress cases.

CATEGORY-SPECIFIC DIFFERENCES TO MODEL
- No rinse: the full applied dose remains on the hair.
- Dose, distribution, dry-down, persistence and transfer are central.
- Product forms range from spray solutions to creams and two-phase systems.
- Styling polymers, hold, curl definition and humidity response may be central.
- Layering with oils, gels, foams, creams and heat tools can change performance.
- All-day skin/scalp exposure and fragrance/preservative flags matter.
- Rinse-out conditioner evidence does not automatically apply.

REQUIRED PROCESS
1. Lock the category boundary and subtypes.
2. Research leave-in formula architecture, deposition/persistence and relevant finished-product test methods using primary or authoritative sources.
3. Map distinct routes for wet detangling, dry combability, softness, smoothing/frizz control, shine, curl definition, hold, heat protection, repair, persistence and wash-out/buildup.
4. Define direct product properties separately from user-fit outputs.
5. Build ingredient-family guidance with delivery requirements, false signals, gates and caps.
6. Keep formula scores, product evidence and user-fit confidence separate.
7. Design a lean matching profile and reusable property-evidence object.
8. Select 10–12 diverse German-market calibration products with exact GTINs and formulas.
9. Create a proposed reference key and a blind reviewer workflow.
10. Analyze disagreements and tighten the standard.
11. Add 3–5 adversarial stress-test products.
12. Deliver a DOCX standard, agent-context Markdown, calibration workbook, change log and runtime product-research prompt.

CANDIDATE DETAILED PROPERTIES TO TEST, NOT BLINDLY ACCEPT
- product form / architecture
- conditioning/deposition
- wet detangling/slip
- dry combability/softness
- smoothing/frizz control
- shine
- weight/residue potential
- persistence
- wash-out/accumulation
- hold/styling support
- curl/wave definition
- heat-protection potential
- humidity-response potential
- repair lubrication
- repair surface film
- bond-specific support
- dose sensitivity
- layering risk
- scalp/skin exposure risk
- usage role

CANDIDATE LEAN MATCHING PROFILE
- product_form
- conditioning_level
- weight_potential
- persistence
- hold_support
- primary_focus and up to two secondary focuses
- usage_role
- heat_protection and humidity_resistance evidence states
- hair_thickness_fit
- damage_fit
- texture_fit
- scalp_application_fit

SYSTEM BOUNDARY
- Category guidance owns semantic interpretation, mechanism reasoning, explanation patterns and fit logic.
- Catalog/tools own exact product truth: IDs, GTIN, market, current INCI, claims, availability, lifecycle, price and stock.
- Validators enforce identity grounding, category-standard version, evidence scope, source support and output-schema compliance.
- Preserve distinct request modes: category education, category assessment, category comparison, product recommendation and product detail.

NON-NEGOTIABLES
- Exact market + pack size + GTIN/EAN + capture date.
- Formula analysis before marketing interpretation.
- No exact concentration claims from INCI order.
- No naked suitability labels.
- Every property includes value, confidence, E-level, evidence scope, rationale, supporting observations, product inference, counter-signals, derived_from and sources.
- Formula observation -> product-property inference -> user-fit decision.
- Heat, humidity, layering and sensitive-scalp conclusions default to low confidence or unknown when formula-only inference is insufficient.
- Routine-level test results must not be attributed to the leave-in alone.
- Unknown or proprietary systems must be labeled with uncertainty rather than guessed.
- Identity or formula conflicts produce a provisional record.

FIRST OUTPUT
Before freezing a scorebook or selecting the full calibration set, produce:
A. Category charter and exclusions
B. Leave-in subtype/architecture map
C. User jobs, trade-offs and recommendation failures
D. Core scientific research questions and test methods
E. Proposed performance-route dictionary
F. Proposed direct product properties
G. Proposed lean user-fit outputs
H. Proposed calibration and stress-test archetypes
I. Open questions, low-confidence fields and specialist boundaries

Then continue into full research, calibration and refinement unless the user explicitly asks to pause.

