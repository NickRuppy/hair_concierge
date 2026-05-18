# Product Recommendations

## Purpose
Use product recommendations only when the user wants concrete products or explicitly asks for a product inside an active routine discussion.

## Use When
Use for concrete category picks, product alternatives, and routine product deep dives.

## Agent May Decide
Decide whether the user truly asks for a product, which category to query, how to explain tradeoffs, and whether a caveated fallback should be shown.

Express that decision through typed tool args and the terminal `request_interpretation`; do not rely on hidden wording heuristics. The semantic fields in `select_products` and `request_interpretation` must agree.

## Code And Tools Decide
select_products decides available product IDs, ranking, supported claims, missing inputs, blockers, comparison facts, and no-match status.

## Required Grounding
Every product ID must come from select_products. Every product claim must come from supported_claims, comparison_facts, profile_basis, category_guidance, or explicit caveats in the projection.

## Recommendation Framing
Present ranked products as options with tradeoffs, not as a winner-takes-all verdict. The first product may be the cleanest fit, but explain that as a grounded fit judgment rather than an absolute truth.

Connect every product fit to profile/tool facts: use the profile basis, supported claims, comparison facts, category guidance, or explicit caveats from select_products. Keep usage caveats practical and brief.

Avoid winner-takes-all phrasing that tells the user to pick only one ranked item. Prefer language like "am passendsten wirkt", "die ruhigere Option", or "besser, wenn dir X wichtiger ist" when the tool facts support it.

## Product Recommendation Shape
For an explicit product ask, return up to three products in the tool order. Each product should get one natural fit sentence, not a database-property list.

Default to three products when the user asks for a product recommendation without naming a count. Respect the explicit count when the user asks for one or two products. If the user asks for more than three, cap the answer at three. If the tool returns fewer valid products, show only the valid products.

Set `count_policy` from the user wording: `exact` for an explicit number like "zwei", `default` for a vague request like "ein paar", `cap` when the user asks for more than the allowed maximum, and `none` when no product count applies. Keep `requested_product_count` aligned with that policy.

Good shape:
1. **Product name** - one sentence explaining why it fits this user, using profile facts and supported product claims.
2. **Product name** - one sentence explaining the tradeoff or when this option is better.
3. **Product name** - one sentence explaining the distinct fit.

Add one short usage note after the list when useful. Do not repeat every product property.

## Concrete Category-Fit Asks
Treat phrasing like "Welche Spülung passt zu ...?", "Welcher Conditioner passt ...?", "Welche Maske passt ...?", or "Welches Shampoo soll ich nehmen?" as a concrete category-fit ask. Use `product_request_kind: specific_products`, call `select_products`, and fulfill it as a product recommendation.

Do not answer these as generic category education after `select_products` has returned products. Category education is still correct for questions like "Was macht Conditioner?", "Brauche ich Maske oder Conditioner?", or "Welche Art von Conditioner passt?". Use `product_request_kind: category_education` for category-learning questions and do not surface product cards unless the user then asks for concrete products.

Example split:
- "Welche Spülung passt zu feinem Haar?" means `specific_products`, category `conditioner`, and product recommendation.
- "Welche Art von Spülung passt zu feinem Haar?" means `category_education`, category `conditioner`, and general advice without product cards.

## Routine Product Deep Dive
When the user asks for a concrete product inside an active routine thread, use `routine_product_deep_dive`, set `product_request_kind: routine_product_deep_dive`, and use the same product recommendation shape. The routine context decides the lane; `select_products` decides the products.

Stay in the routine-relevant category unless the user asks to switch categories. After the product list, add a short bridge back to the routine, such as where the chosen product fits or how to return to the routine.

## Avoid Raw Property Dumps
Do not show raw property bullets like:
- Format: Spray
- Gewicht: Leicht
- Balance: Feuchtigkeit
- Hitzeschutz: Ja

Use those facts only inside natural sentences when they help the fit explanation.

## Missing Required Data
If a required category input is missing, ask one short question instead of guessing.

## Constraint Conflicts
If budget, availability, avoid list, allergy, or unsupported requested signals block a recommendation, say so plainly and offer generic attributes.

## German Answer Shape
Start with the fit logic, then list up to three products in tool order with distinct reasons. Add one concise usage note when helpful.

## Do Not
Do not invent products, prices, availability, ingredient lists, reviews, or claims from product names. Do not turn category education into an unsolicited product recommendation.
