# Leave-In

## Role In Hair Concierge
Leave-in is a leave-on booster for lengths and ends after washing. It can support smoother feel, frizz control, light conditioning, detangling, styling prep, and sometimes routine simplification when product data supports the combined role.

It is not the default baseline care step for everyone, not a mandatory third step, not scalp care, and not an automatic conditioner replacement.

## Use When
- The user asks for leave-in, post-wash care, frizz smoothing, detangling, styling prep, or length support after washing.
- Lengths feel dry, rough, frizzy, tangled, puffy, or hard to style after conditioner.
- Heat styling is present and the user asks whether a leave-in can simplify post-wash care plus protection.
- The user wants a simpler routine and a grounded product could combine care plus protection.
- Conditioner exists but is not enough for leave-on support.

## Best Fit
- post-wash frizz, rough feel, dryness, tangling, or styling-prep needs
- heat-styling routines only when leave-on conditioning is also accountable, or when selected product metadata supports a combined care plus heat-protection role
- wavy, curly, coarse, dry, rough-feeling, color-treated, bleached, or heat-stressed lengths needing leave-on support
- fine or low-density hair only when dose, weight, and placement are kept small and targeted
- routines that may be simplified by one selected product only when product data and user context support that combined role

## Weak Fit / Not The Best Lever
- scalp cleansing, scalp treatment, root oil management, or flakes/itch as the main issue
- replacing conditioner by default
- exact heat-protection claims without selected product data
- buildup, coated feel, or greasy roots where another leave-on layer would likely worsen the problem
- users who already have a suitable leave-in and need reset, stronger periodic care, finish, or routine simplification instead

## Realistic Benefit
A good leave-in can make lengths easier to detangle, smoother, less frizzy-looking, and more manageable between washes. It can also support styling prep or, if product metadata supports it, combine light care with heat protection.

It does not cleanse the scalp, repair split ends, replace every conditioner, or make heat harmless. For fine or flat-prone hair, the benefit often depends more on dose and placement than on using a richer product.

## Category Boundaries
Belongs here:
- leave-on length and end care
- detangling/slip after washing
- frizz smoothing and styling prep
- heat-protection consolidation when product metadata supports it
- simple routine booster logic

Does not belong here:
- scalp cleansing or scalp treatment
- normal rinse-out conditioner baseline logic
- masks as periodic extra care
- oils as finish/tips or pre-wash protection
- deep cleansing/reset logic

Common look-alikes:
- Conditioner is the rinse-out baseline; leave-in is usually the booster or simplification candidate.
- A mask is periodic extra care, not the same as daily leave-on support.
- Heat-protection consolidation requires product data, even if the product name sounds protective. If the main goal is heat protection rather than leave-on conditioning, compare or route to heat-protection guidance when available instead of forcing `care_category: leave_in`.

## Fit And Usage Logic
Match leave-in weight, dose, and placement to thickness, density, texture, frizz, dryness, tangling, styling prep, heat use, and buildup risk.

Hair length changes leave-in relevance and dose. Very short hair usually should not get a leave-in only for lengths-and-ends care unless heat use, curl styling, dryness, chemical stress, or a direct user request creates a clear reason. Short hair needs very small amounts. Long and very long hair can justify stronger sectioning and coverage guidance, but length alone should not become a repair or damage signal.

Fine, low-density, oily-root, flat-prone, or buildup-prone profiles need small amounts, careful distribution, and placement away from roots. Wavy, curly, coarse, chemically treated, dry, or rough-feeling lengths may benefit from more leave-on support.

Replacing conditioner only when selected product data and routine context support it can be discussed as a possible simplification candidate. It is a special case, not the default.

## Heat Protection Boundary
Leave-in guidance may discuss heat-protection consolidation when the user asks about leave-in, post-wash simplification, or a selected leave-in product has grounded heat-protection metadata.

If the user's main goal is heat protection rather than leave-on conditioning, compare or route toward heat-protection guidance when available. Do not force `care_category: leave_in` unless leave-in is the primary answer accountability.

## Agent Interpretation Hooks
If the user asks what a leave-in does:
- primary_intent: category_education
- product_request_kind: category_education
- care_category: leave_in
- requires_tool: false
- do_not_show_unasked_product_cards: true

If the user asks "Welche Art von Leave-in..." or asks only about leave-in types, weight classes, formats, or care direction:
- primary_intent: category_education
- product_request_kind: category_education
- care_category: leave_in
- requires_tool: false
- do_not_show_unasked_product_cards: true

If the user asks whether they need a leave-in:
- primary_intent: general_advice
- product_request_kind: none
- care_category: leave_in
- requires_tool: false unless product-specific

If the user asks "Welches Leave-in passt...", asks for options, asks how many products to choose, or requests a light leave-in recommendation:
- primary_intent: product_recommendation
- product_request_kind: specific_products
- care_category: leave_in
- requires_tool: select_products
- parse requested count from the user; if no count is requested, use the product recommendation default

If the user asks for concrete leave-ins:
- primary_intent: product_recommendation
- product_request_kind: specific_products
- care_category: leave_in
- requires_tool: select_products

If the user asks about a named leave-in, whether a leave-in is light or heavy, what role it has, which format it is, whether it is fragranced or fragrance-free, whether it defines curls, whether it can replace conditioner, whether it gives heat protection or an exact temperature, or whether a product claim is true:
- primary_intent: product_recommendation when the user asks for alternatives; otherwise keep the terminal answer in named-product assessment
- answer_mode: product_assessment after identity is resolved
- product_request_kind: product_detail
- care_category: leave_in
- requires_tool: lookup_product_candidate first, then product catalog data or internal select_products projection facts when product claims need grounding
- do not infer from product name, brand line, marketing family, or category guidance alone

If the user asks about heat protection from a concrete leave-in:
- primary_intent: product_recommendation when the user asks for alternatives; otherwise keep the terminal answer in named-product assessment
- answer_mode: product_assessment after identity is resolved
- product_request_kind: product_detail, specific_products, or compare_products
- care_category: leave_in
- requires_tool: lookup_product_candidate first, then product catalog data or internal select_products projection facts when heat-protection claims need grounding

If the user asks mainly for heat protection rather than leave-on conditioning:
- primary_intent: category_education or product_recommendation depending on wording
- product_request_kind: category_education, specific_products, or product_detail based on the ask
- care_category: none unless a leave-in is the accountable requested category
- requires_tool: false for category routing; select_products or product catalog data for concrete product claims

If the user asks conditioner versus leave-in, mask versus leave-in, or oil versus leave-in:
- primary_intent: category_education
- product_request_kind: category_education
- care_category: none unless the final answer recommends one primary category
- requires_tool: false unless concrete products are requested

If the user asks where leave-in belongs in a routine, whether it comes after conditioner or before oil, how much to use, or how to apply it without asking to change a saved or current routine:
- primary_intent: routine_explanation
- routine_intent: none
- product_request_kind: category_education
- care_category: leave_in
- requires_tool: false unless current routine state is needed

If the user asks to add, remove, replace, or change leave-in in a saved or current routine:
- primary_intent: routine_mutation
- routine_intent: modify, remove_step, or replace_product based on the request
- care_category: leave_in
- requires_tool: build_or_fix_routine

If the user reports significant or persistent burning, itching, swelling, irritation, unusual shedding, patchy loss, wounds, or infection-like symptoms:
- primary_intent: safety_boundary
- product_request_kind: none
- care_category: none
- requires_tool: false

## Agent May Decide
- Whether leave-in is the next biggest lever, optional, unnecessary, or a simplification candidate.
- Whether the user needs leave-on support, heat-protection discussion, detangling help, styling prep, or category comparison.
- Whether conditioner, mask, oil, reset, or technique is a better first move.
- Whether one follow-up about heat use, weight sensitivity, fragrance/sensitivity history, current conditioner, or buildup would materially change the advice.
- How to explain amount and placement in customer-facing German.

## Code And Tools Decide
- Concrete leave-in product IDs and recommendation order.
- Heat protection, exact temperature, format, weight, role, fragrance/fragrance-free status, curl definition, conditioner-replacement support, and supported claims.
- Whether a product can consolidate care and heat protection.
- Whether a product can reasonably replace conditioner in the user's routine.
- Availability, lifecycle, price, stock, and category membership.
- Saved routine state and mutations.

## Required Grounding
Use `select_products` before naming concrete leave-ins as recommendations.

Use product metadata before claiming heat protection, heat-protection temperature, weight, role, format, fragrance or fragrance-free status, curl definition, or conditioner-replacement support.

Use routine tooling before creating or changing a saved routine.

## Product Grounding
Use selected product data for heat protection, exact temperature, weight, moisture/care role, format, fragrance or fragrance-free status, curl definition, and whether a product can consolidate care and protection or replace conditioner. Do not infer these claims from names, brands, or marketing labels.

## Missing Required Data
Ask at most one follow-up if missing information would materially change:
- whether the user uses heat
- whether hair gets flat, greasy, or coated quickly
- whether fragrance or sensitivity concerns are important
- whether current conditioner is already enough
- whether frizz/tangling is dryness, damage, buildup, or technique
- whether the user wants simplification or an extra step

Do not ask a follow-up if a safe general leave-in explanation is possible.

## Safety Boundary
Escalate away from leave-in optimization when the user reports scalp pain, significant or persistent burning, itching, swelling, irritation, wounds, unusual shedding, patchy hair loss, or infection-like symptoms.

Leave-in guidance should stay length-focused. Keep it away from irritated scalp unless product metadata explicitly supports scalp use, and do not diagnose. When the user links symptoms to a leave-in, preserve leave-in as the suspected trigger in the evidence and safety wording without assigning a separate trigger category field.

## German Answer Shape
Start with the practical judgment: leave-in is a booster after washing, not automatically a must-have.

Then explain:
1. whether it helps this user's length problem or styling goal
2. how it differs from conditioner, mask, or oil
3. the usage note: after washing, sparingly, lengths and ends, away from roots for fine/oily hair
4. whether heat protection, conditioner replacement, fragrance/fragrance-free status, or product recommendations require grounded product selection

Use simple German terms like `Leave-in`, `Booster`, `Längen und Spitzen`, `sparsam`, `Hitzeschutz`, and `nicht an den Ansatz`.

For drying-method wording, prefer `Routine beim Lufttrocknen` or `beim Lufttrocknen` instead of mixed-language phrases like `Air-Dry-Routine`.

## Do Not
- Do not say leave-in always replaces conditioner.
- Do not force leave-in as a mandatory third step.
- Do not claim heat protection or exact heat-protection temperatures without product data.
- Do not infer product weight, role, format, fragrance/fragrance-free status, curl definition, conditioner replacement, or claim truth from names or marketing.
- Do not present leave-in as scalp care, root-oil control, or cleansing.
- Do not recommend rich layering for fine, low-density, flat, oily-root, or buildup-prone hair without a clear caveat.
