# Bondbuilder

## Role In Hair Concierge
Bondbuilders are targeted structural-repair treatments for chemically stressed, breaking, or structurally compromised hair. They are not baseline care, not generic moisture care, and not the right answer for every damaged-hair complaint.

Treat the category narrowly: the name `bond`, `bond repair`, or `plex` is not enough proof that a product belongs here.

## Use When
Use when structural damage is plausible, especially after bleach, highlights, oxidative color, perms, relaxers, keratin treatments, or repeated high heat.

Strong user signals include hair that feels mushy, gummiartig, or overly elastic when wet; strong breakage or brittle lengths; hair that feels worse after a chemical service; or hair being prepared for an upcoming chemical service where in-service bond repair may be higher leverage than at-home rescue afterwards.

## Best Fit
- chemically treated or bleached hair with clear structural stress
- heat-stressed hair with breakage, brittle lengths, or elasticity complaints
- mushy or overly elastic wet feel, recent damage event, or visible length fragility
- users recovering from chemical damage and trying to stabilize the hair
- users about to undergo bleach, color, relaxing, perming, or another chemical service

## Weak Fit / Not The Best Lever
- healthy untreated hair with no structural-damage history
- scalp concerns like dandruff, itch, irritation, oiliness, scalp pain, or shedding
- softness, hydration, frizz, shine, or slip complaints without structural-damage signals
- dryness alone, split ends alone, protein/moisture imbalance alone, hair loss, patchy shedding, or regrowth concerns
- user goals better solved by conditioner, leave-in, mask, oil, reset, or technique first

## Realistic Benefit
Bondbuilders can improve strength, elasticity, and resilience of damaged strands. They can reduce breakage during washing, detangling, or styling and can support hair around chemical services.

The realistic ceiling is partial and incremental: `better` and `more stable` are realistic; `like new`, permanent split-end repair, regrowth, or full restoration to virgin hair are not.

Hair length alone is not a Bondbuilder signal. Long or very long hair may need better distribution and protection guidance because the ends are older, but do not recommend bondbuilder, increase repair severity, or infer structural damage from length unless chemical, heat, breakage, or wet-feel signals support it.

## Category Boundaries
Belongs here:
- targeted structural repair for chemically or heat-stressed lengths
- bleach, highlights, oxidative color, relaxers, perms, keratin, or high-heat damage contexts
- breakage, brittle lengths, mushy wet feel, gummiartig or over-elastic wet feel, or post-service fragility
- product-specific bondbuilder recommendations when grounded

Does not belong here:
- normal shampoo, conditioner, mask, serum, oil, detox, or acidic bonding products unless curated as true bondbuilders
- scalp concerns, hair loss, dandruff, itch, oiliness, irritation, or scalp pain
- ordinary dryness, frizz, shine, softness, or slip without structural-damage signals
- generic brand-line or marketing-label assumptions

Common look-alikes:
- Shampoo, conditioner, mask, serum, detox, chelating, acidic bonding, or low-PH products are not automatically true Bondbuilders.
- Chelating/detox products can help with metals/minerals or future oxidative stress; that is prevention/reset support, not the same claim as bond repair.
- Acidic or low-PH systems can improve surface feel or strength impression, but that is not the same as curated internal bond-repair treatment.
- Brand families do not transfer automatically: only specific curated products belong in this category.

## Technology Examples, Not Recommendations
Use these examples to explain technology lanes or category boundaries, not as automatic recommendations. These names may be used only to explain category boundaries or technology lanes.

Do not recommend, rank, compare, show cards for, or make product-specific claims about these products unless `select_products` or curated product metadata returned the product, category membership, lifecycle status, technology lane, and usage protocol.

- OLAPLEX No.3PLUS Complete Repair Treatment
- OLAPLEX No.0 Intensive Bond Building Treatment, when catalog metadata marks it as an optional booster before No.3PLUS and not a standalone default card
- OLAPLEX No.3 Hair Perfector and No.3PLUS, when catalog metadata marks lifecycle or successor status for shopping or comparison
- K18 Molecular Repair leave-in
- Epres Bond Repair Treatment

## Lane Decision
Make the lane decision legible before recommending products, but do not infer a product's lane from brand name alone.

When catalog metadata supports it, explain the practical lane difference: rinse-out or pre-shampoo bond-repair treatments versus leave-in structural care. Booster, add-on, or in-service support products are system-specific exceptions only; do not present `Booster / Service-Pflege` as a normal third consumer-facing Bondbuilder type.

If the profile shows no clear lane driver, say that instead of inventing a hard winner. For severe mixed structural damage, the agent may mention that some routines use a temporary two-lane phase, but it must not recommend layering multiple bondbuilders by default. Recommend a two-lane phase only when product grounding exists, the user's damage signals are strong, and cadence/protocol metadata prevents over-layering. Reduce repair/protein layering once the hair feels more stable.

Older source language may call one lane a peptide-chain leave-in lane or describe OLAPLEX/Epres lineage and Epres as the easier spray route. Treat those as examples of what catalog metadata may support, not as standalone product facts from this guidance.

## Routine Placement
Present bondbuilding as a targeted repair step, not a daily staple. Exact timing, cadence, cleanse-after requirements, and booster pairings must come from product-specific usage protocol metadata.

For named-product protocol questions, prefer the selected product's projected `supported_claims` entry with `field: usage_hint`. Use that user-facing hint directly for application order, waiting time, rinse-out/leave-in status, cleanse-after instructions, cadence, and booster pairing. Do not replace it with an internal protocol label.

If a named product is selected but no `usage_hint` claim is projected, give only category-level placement such as targeted repair step before or after washing according to the broad product type already grounded. Say that the exact product protocol, cadence, wash-out status, cleanse-after requirement, or booster pairing is not grounded in the available product data.

Pair bondbuilding with moisture support when the hair is also dry, and do not replace conditioner or baseline length care with bondbuilder logic.

## Agent Interpretation Hooks
If the user asks whether bond repair is relevant:
- primary_intent: general_advice
- product_request_kind: none
- care_category: bondbuilder
- requires_tool: false unless product-specific
- treat the answer as a category-fit assessment: decide whether bondbuilding is relevant, optional, a weak fit, or not the best lever before offering next steps
- do not show product cards unless the user also asks for concrete products

If the user asks what a bondbuilder does:
- primary_intent: category_education
- product_request_kind: category_education
- care_category: bondbuilder
- requires_tool: false
- do_not_show_unasked_product_cards: true

If the user asks for a type/kind of bondbuilder, not concrete products:
- examples:
  - `Welche Arten von Bondbuildern gibt es?`
  - `Welche Art Bondbuilder ist für blondiertes Haar sinnvoll?`
  - `Was ist der Unterschied zwischen auswaschbarer Reparaturpflege und Leave-in-Strukturpflege?`
  - `Welche Bondbuilder-Lanes gibt es?`
- primary_intent: category_education
- product_request_kind: category_education
- care_category: bondbuilder
- requires_tool: false
- do_not_show_unasked_product_cards: true

If the user asks for concrete bond-repair products:
- examples:
  - `Welcher Bondbuilder passt zu blondiertem Haar?`
  - `Nenn mir zwei Bondbuilder für Haarbruch.`
  - `Welche K18-Alternative kannst du empfehlen?`
- primary_intent: product_recommendation
- product_request_kind: specific_products
- care_category: bondbuilder
- requires_tool: select_products

If the user asks which bondbuilder fits, asks for options, or asks for a count:
- primary_intent: product_recommendation
- product_request_kind: specific_products
- care_category: bondbuilder
- requested_product_count: parse if stated, otherwise use default
- count_policy: exact when explicit, default when not stated
- exact means exactly the requested count only when enough grounded, suitable, available Bondbuilder products exist; if fewer fit, return fewer and explain the fit or availability constraint instead of padding
- requires_tool: select_products

If the user asks about a named bondbuilder, exact product protocol, lifecycle, successor status, technology lane, booster pairing, cleanse-after use, cadence, or a product-specific bond-repair claim:
- primary_intent: product_recommendation when the user asks for alternatives; otherwise keep the terminal answer in named-product assessment
- answer_mode: product_assessment after identity is resolved
- product_request_kind: product_detail
- care_category: bondbuilder
- requested_product_count: 1 for a single named product or claim check
- count_policy: exact for a single named product or claim check
- load_advisor_guidance answer_mode_hint: product_recommendation
- requires_tool: lookup_product_candidate first, then product catalog data or internal select_products projection facts when product claims need grounding
- do_not_infer_from_name_or_brand_line: true
- answer exact application, timing, cadence, wash-out, cleanse-after, and booster-pairing details only from selected product `supported_claims` with `field: usage_hint` or another explicit product metadata claim
- if the selected product lacks a projected usage hint, say the exact protocol is not grounded instead of guessing from the internal protocol id, product name, or brand line

If the user asks "K18 oder OLAPLEX?":
- primary_intent: product_recommendation when the user asks for alternatives; otherwise keep the terminal answer in named-product assessment
- answer_mode: product_assessment after both identities are resolved
- product_request_kind: compare_products
- care_category: bondbuilder
- requires_tool: lookup_product_candidate for each named product, then product catalog data or internal select_products projection facts when comparison facts need grounding
- compare the grounded products/protocols first and do not force product cards unless the user asks for concrete options, cards, or shopping-ready recommendations

If the user asks bondbuilder versus mask, conditioner, protein, or deep cleansing:
- primary_intent: category_education
- product_request_kind: category_education
- care_category: none unless the final answer recommends one primary category
- requires_tool: false unless concrete products are requested
- load_relevant_category_packages: true
- make this a balanced role comparison; load multiple category guidance packages when needed, and set care_category to the primary category only when one category clearly becomes the answer

If the user asks where or how bondbuilder belongs in a routine, without asking to change a saved/current routine:
- answer_mode: general_advice
- primary_intent: routine_explanation
- product_request_kind: category_education
- routine_intent: none
- care_category: bondbuilder
- requires_tool: false unless current routine state is needed
- do not call build_or_fix_routine for ordering-only or placement-only questions unless the user asks to change saved/current routine state
- do not return routine payloads or routine_step_ids for ordering-only or placement-only questions

If the user asks to add, remove, replace, or change bondbuilder in a saved/current routine:
- primary_intent: routine_mutation
- product_request_kind: none
- routine_intent: modify, remove_step, or replace_product based on the request
- care_category: bondbuilder
- requires_tool: build_or_fix_routine
- add, change, and replace wording must map to the supported mutation values available today; describe the intended change, but wait for routine tooling before claiming the saved/current routine changed
- do not claim the saved routine was changed unless routine tooling confirms it

If the user has scalp pain, significant irritation, unusual shedding, or patchy hair loss:
- primary_intent: safety_boundary
- product_request_kind: none
- care_category: none
- requires_tool: false
- preserve bondbuilder as the suspected trigger in evidence and safety wording when the user links symptoms to bondbuilder, without assigning a separate trigger category field

## Agent May Decide
- Whether bondbuilding is relevant, optional, weak fit, or not the best lever.
- Whether the user is asking for category education, relevance assessment, concrete products, product comparison, routine help, or safety handling.
- Whether true Bondbuilder treatments should be distinguished from look-alikes.
- Whether one follow-up about chemical service, heat, strong breakage, brittle lengths, gummiartig or mushy/elastic wet feel, or upcoming salon service would materially improve the answer.
- How to explain structural repair in German without overclaiming.

## Code And Tools Decide
Concrete product IDs, category membership, availability, recommendation order, lifecycle, technology lane claims, exact usage protocols, timing, cadence, cleanse-after requirements, booster pairings, and product-specific claims come from `select_products` or curated catalog/product data.

For user-facing product protocol answers, the strongest grounded field is `selected_products.supported_claims[].field = usage_hint`. Treat its value as the exact application guidance. Internal protocol IDs such as `k18_leave_in` or `olaplex_3plus` are routing/spec labels, not sufficient user-facing instructions on their own.

## Required Grounding
Use `select_products` before naming concrete Bondbuilder products or making product-specific claims.

Use product-specific usage protocol metadata for exact timing, cadence, lifecycle/successor status, wash-out/leave-in status, cleanse-after requirements, booster pairings, and technology-lane claims. If a selected named product has a projected `usage_hint`, use that hint directly. If it does not, do not infer the protocol; state that the exact protocol is not grounded in the available product data. Product examples in this guidance may be used to explain category boundaries, but not to bypass product tooling.

Use routine tooling before creating or changing a saved routine.

## Missing Required Data
Ask at most one follow-up if it would materially change whether or how bond repair should be recommended:
- structural damage is unclear
- bleach, color, relaxing, perming, keratin, or heavy heat history is unclear
- an in-salon chemical service is coming up soon
- breakage severity or mushy/elastic wet feel is unclear

## Evidence Framing
Frame bond repair as mechanism-plausible, practitioner-validated, and useful in the right damage context, while acknowledging limited independent peer-reviewed efficacy evidence. Do not present limited independent evidence as strong clinical proof.

## Safety Boundary
Escalate away from bondbuilder advice when the user reports scalp pain, significant irritation after use, unusual shedding, patchy hair loss, or other medically adjacent symptoms.

In those cases, suggest stopping the triggering product and getting professional evaluation instead of intensifying repair advice. Do not diagnose.

If the user links burning, irritation, shedding, patchy loss, or similar symptoms to a Bondbuilder, mention that suspected Bondbuilder trigger in the safety wording, but keep care_category none and do not add unsupported trigger-category fields.

## German Answer Shape
Start with whether Bondbuilder sounds relevant at all.

Explain the expected benefit in plain German: stärkere, widerstandsfähigere Längen and weniger Bruch, not instant softness, regrowth, or complete repair.

For "Welche Arten gibt es?" say that the useful distinction is not shampoo/spülung/maske/serum, but true Bondbuilder treatments versus look-alike repair marketing and, only when product metadata supports it, auswaschbare or Pre-Shampoo-Reparatur-Treatments versus Leave-in-Strukturpflege. Mention booster/add-on or Service products only as product-system-specific exceptions, not as a standard third consumer type.

Use customer-facing terms like `Reparaturpflege`, `Strukturpflege`, `stärkende Pflege`, or `aufbauende Pflege`; do not expose internal lane labels as raw system language.

## Do Not
- Do not call bondbuilders normal moisture masks. Instead: describe them as targeted structural-repair treatments.
- Do not recommend bondbuilders for general shine, smoothness, softness, frizz, or hydration complaints without structural-damage signals. Instead: route those cases toward moisture, conditioning, frizz control, or routine-balancing guidance.
- Do not promise regrowth, permanent split-end repair, full restoration, or virgin-hair reversal. Instead: frame the realistic benefit as stronger, more resilient lengths and reduced breakage.
- Do not treat an entire brand line as uniformly bond-repairing. Instead: require curated product/category metadata for each specific product.
- Do not put acidic bonding shampoos/conditioners, detox/chelating products, generic bond masks/serums, or ordinary shampoo/conditioner/mask/serum products into the strict Bondbuilder bucket without curation.
- Do not present `Booster / Service-Pflege` as a normal consumer-facing third Bondbuilder type. Instead: treat booster, add-on, and in-service products as system-specific exceptions only when metadata supports them.
- Do not turn brand-default timings or cadences into app-level rules. Instead: use product-specific usage protocol metadata.
- Do not treat an at-home stretch test as a standalone diagnosis. Instead: treat it as one weak signal among chemical history, breakage, wet feel, and recent damage events.
- Do not tell every user to deep-cleanse before every bondbuilder use. Instead: reserve reset or deep-cleansing logic for cases where the routine, buildup, mineral, or product protocol metadata supports it.
