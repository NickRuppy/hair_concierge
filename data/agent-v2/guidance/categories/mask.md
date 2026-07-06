# Mask

## Role In Hair Concierge
Masks are periodic extra care for lengths and ends. They can add more intensive conditioning, slip, manageability, or conservative protein/moisture balance support when conditioner alone is not enough.

They are not the required foundation of every routine, not a scalp treatment, and not a permanent repair step for split ends or structural damage.

## Use When
- The user asks for a mask, hair treatment, Kur, or occasional extra care.
- Lengths feel dry, rough, frizzy, hard to detangle, porous, bleached, colored, heat-stressed, or chemically stressed.
- Conditioner is already present but not enough for softness, slip, or manageability.
- The user asks about protein/moisture balance in a way that can stay conservative and profile-linked.
- A routine needs an occasional add-on rather than another daily layer.

## Best Fit
- dry, rough, frizzy, damaged, chemically treated, or hard-to-detangle lengths that need occasional extra conditioning
- users who already have basic conditioner support but still need more softness, slip, or care in lengths and ends
- protein/moisture balance questions where the answer can stay conservative and profile-linked
- coarse, curly, porous, bleached, colored, or heat-stressed hair when extra care is useful and not too heavy
- reset-aftercare situations where a clarifying/deep-cleansing wash leaves lengths needing conditioning support

## Weak Fit / Not The Best Lever
- scalp symptoms, root cleansing, oiliness, flakes, itch, or scalp-treatment asks
- replacing conditioner by default or making every routine maximal
- split ends, structural repair, color protection, or future-damage prevention unless product/tool data explicitly supports a narrower claim
- minimalist, fine, low-density, flat, coated, or buildup-prone routines where extra weight is likely not needed now
- hair that feels soft, flat, coated, heavy, or slow to dry, where overcare or buildup may be more plausible than lack of mask

## Realistic Benefit
A mask can make lengths feel softer, smoother, more conditioned, easier to detangle, and less rough after washing. It can be a useful occasional boost for higher-need lengths.

It cannot permanently repair split ends, rebuild hair to virgin condition, treat the scalp, or replace all baseline conditioner logic. For many users, conditioner is usually the everyday length-care foundation and the mask is the occasional extra.

## Category Boundaries
Belongs here:
- periodic length and end care
- extra slip, softness, and manageability
- conservative protein/moisture support
- occasional after-reset or after-chemical-service support
- mask product recommendations when grounded

Does not belong here:
- scalp cleansing or scalp treatment
- normal conditioner baseline by default
- leave-in or oil finish logic
- bondbuilder structural repair unless the product/category is grounded separately
- deep cleansing or buildup reset

Common look-alikes:
- A mask is richer/extra care; conditioner is the normal rinse-out baseline.
- Bondbuilder is targeted structural repair; a normal mask should not inherit bondbuilder claims.
- Scalp masks or scalp treatments need explicit product metadata; do not assume a normal mask belongs on the scalp.

## Protein/Moisture And Weight Logic
Protein/moisture balance matters for mask fit because masks can shift the feel of the lengths more strongly than everyday conditioner. Treat this as a profile-informed care direction, not a diagnosis.

Fine or low-density hair usually needs lighter, shorter, or less frequent mask use. Curly, coarse, chemically treated, bleached, colored, porous, rough, or high-friction lengths may justify more intensive periodic care.

Hair length changes mask coverage and relevance. Very short hair usually should not receive a mask as an automatic extra unless dryness, chemical stress, roughness, curls/coils, or a direct user request makes it useful. Short hair needs less product and lower frequency. Long and very long hair can need sectioning and enough coverage for older ends, but do not infer structural damage from length alone.

If hair feels heavy, too soft, flat, coated, or slow to dry, stretch cadence, use less, or reset/simplify before adding richer care.

Do not ask about protein/moisture direction by default. Ask only when the user raises protein/moisture, the profile already signals it, or rough, limp, brittle, coated, or recently chemically stressed hair makes that distinction materially useful.

## Usage And Cadence
For general mask advice, keep cadence flexible: gelegentlich, alle paar Wäschen, or bei Bedarf. If you mention every few washes or a couple of times per month, frame it as a flexible starting point only, not a protocol.

Usually place a rinse-out mask after shampoo, mainly in lengths and ends, then rinse well. Conditioner after a mask is optional and should be mentioned only when the routine convention or product protocol supports it.

Exact timing and cadence require product metadata. Exact placement, scalp use, follow-up conditioner, and order for concrete products must also come from product metadata.

For dry/frizzy lengths inside a lightweight-routine decision, a light occasional mask is usually the main add-on. Oil may be mentioned only as a tiny finish for tips/gloss, not as the primary care step for dryness.

## Structural Repair And Bondbuilder Boundary
If the user asks about gummy or elastic wet hair, snapping, bleach damage, bond repair, repair from inside, or whether a mask can structurally repair damage, compare mask guidance with Bondbuilder guidance.

Explain that masks mainly support feel, slip, softness, and manageability, while true bondbuilders sit in the structural-repair lane when grounded. Do not make structural repair claims from a normal mask.

## Agent Interpretation Hooks
If the user asks what a mask is for:
- primary_intent: category_education
- product_request_kind: category_education
- care_category: mask
- requires_tool: false
- do_not_show_unasked_product_cards: true

If the user asks whether they need a mask:
- primary_intent: general_advice
- product_request_kind: none
- care_category: mask
- requires_tool: false unless product-specific

If the user asks what type/kind of mask exists or what mask type means without asking which one to buy:
- primary_intent: category_education
- product_request_kind: category_education
- care_category: mask
- requires_tool: false
- do_not_show_unasked_product_cards: true

If the user asks which mask fits, asks for options, asks how many masks to choose, or requests a mask recommendation:
- primary_intent: product_recommendation
- product_request_kind: specific_products
- care_category: mask
- requires_tool: select_products
- parse requested count from the user; if no count is requested, use the product recommendation default

If the user asks for concrete masks:
- primary_intent: product_recommendation
- product_request_kind: specific_products
- care_category: mask
- requires_tool: select_products

If the user asks about a named mask, whether a mask is protein-rich, protein-free, moisture-focused, lightweight, rich, color-protective, repair-supported, scalp-directed, silicone-free, coconut-free, oil-free, or fits their profile:
- primary_intent: product_recommendation when the user asks for alternatives; otherwise keep the terminal answer in named-product assessment
- answer_mode: product_assessment after identity is resolved
- product_request_kind: product_detail
- care_category: mask
- requires_tool: lookup_product_candidate first, then product catalog data or internal select_products projection facts when product claims need grounding
- do not infer from product name, brand line, marketing family, or category guidance alone

If the user asks mask versus conditioner, leave-in, oil, or bondbuilder:
- primary_intent: category_education
- product_request_kind: category_education
- care_category: none unless the final answer recommends one primary category
- requires_tool: false unless concrete products are requested

If the user asks where a mask belongs, how often to use it, or use order without asking to change a saved or current routine:
- primary_intent: routine_explanation
- routine_intent: none
- product_request_kind: category_education
- care_category: mask
- requires_tool: false unless current routine state is needed

If the user asks to add, remove, replace, or change a mask in a saved or current routine:
- primary_intent: routine_mutation
- routine_intent: modify, remove_step, or replace_product based on the request
- care_category: mask
- requires_tool: build_or_fix_routine

If the user asks about gummy or elastic wet hair, snapping, bleach damage, bond repair, repair from inside, or whether a mask can structurally repair damage:
- primary_intent: category_education or general_advice
- product_request_kind: category_education
- care_category: none unless the final answer recommends one primary category
- requires_tool: false unless concrete products are requested
- load mask and bondbuilder guidance
- explain that masks mainly support feel, slip, softness, and manageability, while bondbuilders sit in the structural-repair lane when grounded

If scalp pain, burning, significant irritation, unusual shedding, or patchy loss dominates:
- primary_intent: safety_boundary
- product_request_kind: none
- care_category: none
- requires_tool: false

## Agent May Decide
- Whether a mask is useful now, optional, too much, or weaker than conditioner, leave-in, reset, or technique.
- Whether the user needs occasional extra care or better baseline length care first.
- Whether protein/moisture, chemical stress, weight sensitivity, or buildup changes the mask advice.
- Whether one follow-up would materially change relevance, safety, or weight/cadence.
- How to explain mask use in simple German without making it mandatory.

## Code And Tools Decide
- Concrete mask product IDs and recommendation order.
- Product category membership, weight, intensity, protein/moisture role, unsupported requested-signal caveats, and supported claims.
- Exact product protocol, timing, cadence, compatibility, lifecycle, availability, price, stock, and retailer.
- Whether a product is scalp-directed, color-protective, repair-claim-supported, silicone-free, coconut-free, protein-free, oil-free, or similar.
- Whether a named mask is protein-rich, moisture-focused, lightweight, rich, coconut-free, or profile-compatible.
- Saved routine state and mutations.

## Required Grounding
Use `select_products` before naming concrete masks as recommendations.

Use product metadata before giving exact product balance, intensity, weight, supported claims, scalp use, color protection, repair claims, or exact cadence.

Use routine tooling before creating or changing a saved routine.

## Missing Required Data
Ask at most one follow-up if missing information would materially change:
- damage level or chemical history
- weight sensitivity, fine hair, low density, flatness, or coating
- whether conditioner is already present and enough
- whether the problem is dryness, damage, buildup, or scalp symptoms
- protein/moisture direction, only when user-raised or materially signaled by the profile or hair feel

Do not ask if a safe optional-mask answer is possible.

## Safety Boundary
Do not recommend masks for scalp pain, burning, significant irritation, wounds, unusual shedding, patchy hair loss, or persistent inflammatory symptoms.

If scalp symptoms dominate, stop cosmetic mask escalation, suggest stopping the suspected trigger when relevant, and route to professional evaluation language without diagnosing.

If the user links burning, itching, shedding, irritation, or similar symptoms to a mask, mention the suspected trigger in the safety wording, but keep care_category none and do not add unsupported trigger-category fields.

## German Answer Shape
Start with whether the mask is optional, useful now, or not the best next lever.

Then explain:
1. when conditioner is enough
2. why a mask could help lengths and ends
3. how to use it: usually after shampoo, mainly in lengths and ends, rinse well
4. cadence as gelegentlich, alle paar Wäschen, or bei Bedarf

If conditioner after mask, exact timing, or exact cadence matters for a concrete product, ground it in product metadata. For washing every two to three days, every four to five washes or two to three times per month can be a flexible starting point, then stretch or increase based on heaviness and dryness.

## Do Not
- Do not make masks mandatory for every routine.
- Do not call masks scalp treatments unless product metadata explicitly supports scalp use.
- Do not claim permanent split-end repair, structural rebuilding, future-damage prevention, or reversal of chemical damage from a normal mask.
- Do not replace conditioner logic with masks by default.
- Do not recommend daily mask use unless product metadata supports it.
- Do not name products without `select_products`.
- Do not present every-few-washes guidance as a fixed protocol unless product metadata supports it.
- Do not ask protein/moisture follow-ups when a safe general mask answer is enough.
