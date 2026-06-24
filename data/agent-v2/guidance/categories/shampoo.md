# Shampoo

## Role In Hair Concierge
Shampoo is the scalp and root cleansing step. It supports freshness, oil management, residue control, and scalp comfort; lengths usually get rinse-down rather than direct shampoo work.

It is not the main lever for length repair, softness, split ends, shine, or frizz unless the user also has a scalp/root or buildup signal.

## Use When
- The user asks for shampoo, cleanser strength, wash feel, or wash rhythm.
- Roots feel oily, greasy, flat, sweaty, coated, or not fresh.
- The user mentions visible residue, buildup-adjacent feel, dry shampoo residue, heavy styling products, or scalp/root cleansing.
- A routine needs a baseline wash step or a proportional reset from normal shampoo.
- Flakes, irritation, or scalp-condition words appear, but the answer can stay conservative and non-diagnostic.

## Best Fit
- oily roots, freshness needs, visible residue, or buildup signals
- scalp/root cleansing questions, including cleanser strength and wash feel
- wash cadence questions where lifestyle, scalp type, activity, product use, and texture matter
- explicit shampoo product asks where the answer can add a practical caveat if shampoo is not the strongest lever
- scalp mentions that can be handled as cosmetic comfort without medical treatment promises

## Weak Fit / Not The Best Lever
- dry lengths, frizz, shine, softness, roughness, or split-end repair when shampoo is the only proposed lever
- length softness, slip, or damage-repair goals better served by conditioner, leave-in, mask, oil, bondbuilder, or handling technique
- severe, persistent, painful, inflamed, wounded, unusual, or medically adjacent scalp symptoms
- color protection, sensitive-scalp support, dandruff treatment, repair, or growth claims without product/catalog grounding

## Realistic Benefit
A suitable shampoo can make the scalp and roots feel cleaner, lighter, fresher, and less coated. It can reduce residue as part of the wash step and can make the rest of the routine work better.

It cannot permanently repair split ends, reverse damage, regrow hair, or make dry lengths soft by itself. If shampoo feels drying while the scalp needs cleansing, solve that with placement, strength, wash rhythm, CWC/OWC length protection, conditioner, leave-in, or mask logic rather than pretending shampoo is length care.

## Category Boundaries
Belongs here:
- normal scalp/root shampoo
- cleanser strength and wash rhythm
- oily roots and freshness
- scalp/root residue and routine wash placement
- shampoo product asks when products are grounded through `select_products`

Does not belong here:
- deep cleansing, clarifying, chelating, or scalp exfoliation as a reset lane
- dry shampoo as a between-wash bridge
- conditioner, leave-in, mask, oil, or bondbuilder length-care logic
- scalp medical treatment or hair-loss diagnosis

Common look-alikes:
- Deep-cleansing shampoo is an occasional reset, not the everyday wash baseline.
- Dry shampoo absorbs visible oil temporarily but does not cleanse with water.
- Anti-dandruff or treatment language must stay scalp-focused and grounded; do not turn product names into medical claims.

## Scalp/Length Split Logic
Keep shampoo mainly on the scalp and roots. Rinse-down is normally enough for lengths unless there is heavy product residue.

Hair length should only weakly affect normal shampoo advice. Even for long or very long hair, do not scale shampoo like a length-care product; scale placement, rinse-down, and length-protection caveats instead. Very short hair usually needs no lengths-and-ends shampoo caveat because there is no real lengths zone.

When the user says a shampoo works for the scalp but dries out the lengths, do not discard the scalp logic automatically. Explain that the scalp may still need the shampoo while the lengths need protection: lighter application, less direct shampoo on lengths, conditioner after washing, and sometimes conditioner before shampoo as CWC/OWC length protection.

"Wash less" is not a universal goal. Wash rhythm should fit scalp oiliness, activity, styling-product use, dry-shampoo use, texture, and comfort.

## Shampoo Cadence Context
When `care_balance_context.shampoo_cadence` is present and the answer is routine- or shampoo-relevant, use it as a profile delta: current rhythm versus target orientation. Do not present the target as a universal rule.

Prefer `target_preferred` in customer-facing copy. Mention the min/max range only when it helps explain flexibility. If current frequency is unknown, state the target orientation and invite observation of when oil returns and whether the scalp stays calm.

Use the delta softly:
- `below`: suggest testing toward the preferred target for 2-3 weeks, especially when the target is driven by oily roots or dandruff-like scalp signals. Do not say oily scalps must wash daily.
- `near` + `lower_edge`: say the rhythm is within range, but at the low edge.
- `near` + `preferred`: say it fits well.
- `near` + `upper_edge`: say it can work now, but watch longer-term tolerance for scalp and lengths.
- `above`: say it is above target, but not automatically wrong if the scalp is calm. For dry lengths or fibre fragility caveats, emphasize milder, scalp-focused washing and length protection rather than washing even more.

If `caveat_codes`, `reason_codes` such as `modifier_down_stacked_fiber_fragility`, or visible profile facts point to dry lengths or fibre fragility, keep the practical copy scalp-first: shampoo mainly on Kopfhaut/Ansatz, let foam rinse through the Längen, then protect lengths with conditioner, leave-in, mask, or CWC/OWC when useful.

## Everyday Residue vs Reset Boundary
Normal shampoo handles everyday scalp/root cleansing: oil, sweat, light residue, freshness, and normal wash-day feel.

Do not make normal shampoo the reset lane when the user reports stubborn buildup, waxy or coated feel after washing, repeated dry-shampoo buildup, heavy styling residue, hard-water or mineral suspicion, or "nothing gets clean" signals. Compare or route to deep-cleansing, clarifying, or chelating guidance instead.

If the signal is only ordinary oiliness, sweat, or light product residue, stay in normal shampoo unless the user explicitly asks for a reset.

## Agent Interpretation Hooks
If the user asks what shampoo does:
- primary_intent: category_education
- product_request_kind: category_education
- care_category: shampoo
- requires_tool: false
- do_not_show_unasked_product_cards: true

If the user asks whether shampoo is the right lever:
- primary_intent: general_advice
- product_request_kind: none
- care_category: shampoo
- requires_tool: false unless product-specific

If the user asks for concrete shampoos:
- primary_intent: product_recommendation
- product_request_kind: specific_products
- care_category: shampoo
- requires_tool: select_products

If the user asks about a named shampoo, ingredient/claim fit, or whether a specific shampoo is color-safe, sulfate-free, fragrance-free, anti-dandruff, sensitive-scalp, repair, growth, shine, or has an exact cadence/protocol:
- primary_intent: product_recommendation
- product_request_kind: product_detail
- care_category: shampoo
- requires_tool: select_products or product catalog data

If the user asks shampoo versus deep cleansing, dry shampoo, conditioner, leave-in, or mask:
- primary_intent: category_education
- product_request_kind: category_education
- care_category: none unless the final answer recommends one primary category
- requires_tool: false unless concrete products are requested

If the user asks how to use shampoo, where it sits in the routine, or whether shampoo goes before/after another step without asking to change a saved/current routine:
- primary_intent: routine_explanation
- product_request_kind: none
- routine_intent: none
- care_category: shampoo
- requires_tool: false unless current routine state is needed

If the user asks to add shampoo to a saved/current routine:
- primary_intent: routine_mutation
- product_request_kind: none
- routine_intent: modify
- routine tool mutation_kind: add_step
- care_category: shampoo
- requires_tool: build_or_fix_routine

If the user asks to remove shampoo from a saved/current routine:
- primary_intent: routine_mutation
- product_request_kind: none
- routine_intent: remove_step
- routine tool mutation_kind: remove_step
- care_category: shampoo
- requires_tool: build_or_fix_routine

If the user asks to replace a shampoo product in a saved/current routine:
- primary_intent: routine_mutation
- product_request_kind: none
- routine_intent: replace_product
- routine tool mutation_kind: replace_product
- care_category: shampoo
- requires_tool: build_or_fix_routine

If the user asks to change shampoo frequency, placement, strength, or role in a saved/current routine:
- primary_intent: routine_mutation
- product_request_kind: none
- routine_intent: modify
- routine tool mutation_kind: change_frequency or simplify when applicable
- care_category: shampoo
- requires_tool: build_or_fix_routine

If medically adjacent scalp symptoms appear:
- primary_intent: safety_boundary
- product_request_kind: none
- care_category: none
- requires_tool: false

## Agent May Decide
- Whether shampoo is the main lever, a hygiene baseline, or reset-adjacent support.
- Whether shampoo is already covered by the current routine only when current routine context or routine tooling provides that state.
- Whether the user really needs scalp/root cleansing, residue reset, length care, or safety handling.
- Whether to explain usage/placement before products.
- Whether one follow-up about oiliness, wash frequency, residue, flakes, irritation, or dry lengths would materially change the answer.
- How to explain shampoo in customer-facing German without turning it into length repair.

## Code And Tools Decide
- Concrete shampoo product IDs.
- Category membership and recommendation order.
- Availability, lifecycle, size, price, stock, retailer, and supported claims.
- Color protection, sensitive-scalp support, dandruff-related claims, shine, repair, or other product-specific claims.
- Exact usage protocol and cadence when tied to a concrete product.
- Saved routine state and mutations.

## Required Grounding
Use `select_products` before naming concrete shampoos as recommendations.

Use product metadata before making color-safe, color-protection, dandruff, sensitive-scalp, fragrance, sulfate-free, repair, shine, or exact cadence claims.

Use routine tooling before creating or changing a saved routine.

## Product Grounding
Do not infer shine, color protection, sensitive-scalp support, dandruff treatment, repair, or growth from product names, brand lines, or marketing words. Product claims must come from selected product data.

Do not infer color-safe, sulfate-free, fragrance-free, anti-dandruff, sensitive-scalp, repair, growth, shine, or exact cadence/protocol claims from a name, brand line, or category label. Named shampoo and claim-check answers need product detail grounding before making those claims.

## Missing Required Data
Ask at most one follow-up if missing information would materially change:
- whether the issue is oily roots, coated lengths, flakes, irritation, or dry lengths
- whether shampoo strength should be gentle, normal, or reset-adjacent
- whether current wash frequency or heavy product use changes the recommendation
- whether safety routing is needed

Do not ask a follow-up when a safe general scalp-first answer is possible.

## Scalp Symptom Threshold
Mild cosmetic discomfort, occasional flakes, or a freshness concern can stay conservative and non-diagnostic when there are no escalation signals.

Escalate away from cosmetic shampoo optimization when the user reports scalp pain, burning, significant irritation, wounds, swelling, unusual shedding, patchy hair loss, infection-like symptoms, or persistent inflammatory symptoms.

Also route to base safety instead of shampoo optimization for persistent, painful, inflamed, wounded, spreading, unusual, severe, infection-like, shedding, or hair-loss-adjacent scalp/hair symptoms.

In those cases, suggest stopping the suspected trigger and getting professional evaluation. Do not diagnose, and do not intensify cleansing or active products as the first move.

## Safety Boundary
Use the threshold above to decide when the answer must leave cosmetic shampoo optimization and follow base safety guidance.

## German Answer Shape
Start with the practical judgment: shampoo is mainly for Kopfhaut/Ansatz, not for repairing lengths.

Then explain:
1. what shampoo can do for scalp, oil, freshness, or residue
2. why dry lengths, frizz, shine, or split ends may need conditioner, leave-in, mask, oil, bondbuilder, or technique instead
3. the practical use note: mainly scalp/roots, rinse thoroughly, conditioner for lengths afterward
4. whether product recommendations require grounded product selection

Use everyday German terms like `Kopfhaut`, `Ansatz`, `Längen`, `sauberes Gefühl`, `Rückstände`, and `Ausspülen`.

## Do Not
- Do not frame shampoo as length repair, split-end repair, structural repair, growth support, or scalp medical treatment.
- Do not tell every oily-root user to wash less.
- Do not collapse normal shampoo, deep cleansing, chelating, dry shampoo, co-washing, and cleansing conditioner logic.
- Do not claim color protection, dandruff treatment, sensitive-scalp support, shine, or repair from product names.
- Do not apply rich length-care logic to the scalp unless product data explicitly supports that use.
