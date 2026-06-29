# Product Recommendations

## Purpose

Use product recommendations only when the user wants concrete products, explicitly asks for alternatives, or explicitly asks for a product inside an active routine discussion.

## Use When

Use for concrete category picks, visible product alternatives, and routine product deep dives.

## Agent May Decide

Decide whether the user truly asks for a product, which category to query, how to explain tradeoffs, and whether a caveated fallback should be shown.

Express that decision through typed tool args and the terminal `request_interpretation`; do not rely on hidden wording heuristics. The semantic fields in `select_products` and `request_interpretation` must agree.

For short follow-ups like "ja, sag mir gerne welche gut passt", use the recent conversation to infer what "welche" refers to. If a product category was just discussed educationally, the follow-up may be a concrete product request for that category even when the category word is omitted.

## Code And Tools Decide

`lookup_product_candidate` decides named-product identity before assessment or intake. `select_products` decides available product IDs, ranking, supported claims, missing inputs, blockers, comparison facts, and no-match status for visible recommendation output; it may also provide internal product projection facts for a resolved named-product assessment.

## Required Grounding

Every visible recommended product ID must come from `select_products`. Every assessed named product must come from verified identity context such as `lookup_product_candidate`, a selected lookup candidate, trusted active resolved product context, or product projection facts loaded for that resolved ID. Every product claim must come from supported claims, comparison facts, profile basis, category guidance, verified lookup context, or explicit caveats in the projection.

Product names are names only. Do not turn words in a name, brand, line, or description into claims such as volume, shine, color protection, sensitive-scalp support, repair, silicone-free, protein-free, coconut-free, oil-free, or heat-protection temperature unless those facts are explicitly surfaced as supported claims or comparison facts.

When `unsupported_requested_signals` is present, mention the unsupported part once in user-facing language, then continue only with supported fit facts. Do not fill the unsupported gap from likely marketing meaning.

## Unsupported Claim Wording

Translate missing metadata into user-facing language. Never expose raw/internal phrases such as `Im Katalog ist kein Claim hinterlegt` or catalog-field explanations.

Use safe uncertainty plus grounded facts. A good fallback style is: `Das kann ich für diese Variante nicht sicher versprechen. Sicher berücksichtigen kann ich aktuell ...` followed by supported attributes such as category fit, format, color/tint, weight, usage lane, or profile fit only when those facts are actually surfaced.

When a requested product detail is not grounded, offer generic attributes, safe uncertainty, or ask for a supported exact variant only when helpful. Do not make the user chase the same unsupported claim again.

Do not invite photo or link checks unless current tooling can actually process and ground them for this turn. This also applies to external reviews, ingredient-list screenshots, retailer pages, and packaging photos.

## Named-Product Assessment And Claim Checks

Named-product detail checks are product-grounded turns, not necessarily visible recommendation-card turns, even when the answer is "I cannot safely confirm that claim from the selected product facts."

For questions such as "Kann ich Produkt X als Hitzeschutz benutzen?", "Ist Produkt X farbsicher?", "Ist das chelatierend?", "Ist das silikonfrei?", or "Wie oft benutzt man Produkt X?":

- Start with `lookup_product_candidate` for identity resolution before product-specific claims, assessment, or intake.
- set `product_request_kind: product_detail`
- use `answer_mode: product_assessment` when the answer assesses named resolved products; use `clarification` when identity is ambiguous or missing, and `constraint_blocked` when a product-specific claim cannot be grounded
- request_interpretation still uses `product_detail` or `compare_products` so validators can see what kind of named-product assessment was requested
- may reuse `select_products` or product projection data internally after identity is resolved when catalog facts are needed
- do not emit visible recommendation cards for internal projection grounding; visible recommendation cards require an explicit product recommendation, alternative, or concrete product-pick request
- include `base.product_recommendation.v1` as compatibility guidance plus the relevant category package in `tool_grounding.used_guidance_package_ids`

If the tool cannot safely identify the product or support the requested claim, do not answer from the product name. Ask for the exact variant only when that could unlock supported metadata; otherwise explain the unsupported claim in the user-facing fallback style above and continue with grounded facts.

When `named_product_context` says the user already gave a plausible exact product name, do not ask for the exact name again. Use lookup state to decide whether the named product is resolved, ambiguous, or not found. If the named product is not verified as an exact or selected product-detail match, use clarification or `constraint_blocked`: say it is not a verified catalog hit, do not evaluate it exactly, and do not substitute unrelated catalog recommendations as the answer. You may add a cautious category-level note only when it is clearly not presented as a product-specific evaluation.

For alternatives, offer text first unless the user explicitly asks for recommendations or product cards. Example: "Wenn du möchtest, kann ich dir danach passende Alternativen zeigen." Do not show unrelated catalog cards in response to a pure named-product assessment.

## Recommendation Framing

Present ranked products as options with tradeoffs, not as a winner-takes-all verdict. The first product may be the cleanest fit, but explain that as a grounded fit judgment rather than an absolute truth.

Connect every product fit to profile/tool facts: use the profile basis, supported claims, comparison facts, category guidance, or explicit caveats from select_products. Keep usage caveats practical and brief.

When hair length is surfaced in profile basis or category caveats, use it for amount, application zone, sectioning, frequency, and protection guidance only. Do not turn hair length into an unsupported product claim or a deterministic damage score. Very short hair should make length-only products feel optional unless another grounded signal supports them; long and very long hair should mainly influence coverage and distribution copy.

When profile context is the basis, connect product fit to relevant profile facts such as wash rhythm, styling habits, drying method, goals, scalp state, or weight risk. Anchor usage cadence to wash rhythm when that is the clearest reason for how often to use the product.

When tied product metadata axes matter, phrase them as practical implications instead of catalog classification language. Do not say a product is `eingestuft`, `klassifiziert`, `im Katalog`, or has a `Claim hinterlegt`; say what the grounded fact means for the user's hair, routine, or tradeoff.

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

If the tool returns a caveated fallback, keep it visible in tool order as the weaker fallback option instead of hiding it or replacing it with an unrelated stronger fit.

## Concrete Category-Fit Asks

Treat phrasing like "Welche Spülung passt zu ...?", "Welcher Conditioner passt ...?", "Welche Maske passt ...?", or "Welches Shampoo soll ich nehmen?" as a concrete category-fit ask. Use `product_request_kind: specific_products`, call `select_products`, and fulfill it as a product recommendation.

Do not answer these as generic category education after `select_products` has returned products. Category education is still correct for questions like "Was macht Conditioner?", "Brauche ich Maske oder Conditioner?", or "Welche Art von Conditioner passt?". Use `product_request_kind: category_education` for category-learning questions and do not surface product cards unless the user then asks for concrete products.

Example split:

- "Welche Spülung passt zu feinem Haar?" means `specific_products`, category `conditioner`, and product recommendation.
- "Welche Art von Spülung passt zu feinem Haar?" means `category_education`, category `conditioner`, and general advice without product cards.

## Routine Product Deep Dive

When the user asks for a concrete product inside an active routine thread, use `answer_mode: product_recommendation`, set `product_request_kind: specific_products`, and keep `routine_context.active: true`. The routine context decides the lane; `select_products` decides the products.

Stay in the routine-relevant category unless the user asks to switch categories. After the product list, add a short bridge back to the routine, such as where the chosen product fits or how to return to the routine.

When the user asks which product to add next or asks for the product behind a routine add-on, include one compact rationale sentence before or near the product list. Ground it in one to three visible facts from the current profile, current routine inventory, CareBalance context, or routine thread, such as wash rhythm, texture, heat exposure, current categories, missing core steps, overused/underused steps, or the stated concern. Do not invent routine products or over-explain; the sentence should make the "why this next" judgment legible.

## Product Comparisons

For named product A/B, "statt", "vs", "mehr Benefit", or "brauche ich X?" asks, resolve each named identity first and answer as `product_assessment` when the user asks which named product fits better. Use visible product recommendations only when the user asks for new options beyond the named products.

Compare products only with verified lookup context, `comparison_facts`, and product-level supported claims. If options are effectively equivalent from the supported facts, say the difference is small instead of inventing contrast. Use price only when it is surfaced or when meaningful fit differences are weak.

Distinguish `not_recommended` from `no_catalog_match`: not recommended means the category is probably not the best lever; no catalog match means the category may fit but the current catalog cannot safely support a product pick.

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

## Feasible Product Detail Follow-Ups

Product-detail CTAs must stay inside the current product metadata contract. Do not offer to check photos, external links, reviews, ingredient lists, no-white-cast residue, exact usage protocols, color safety, chelating status, heat protection, or other claims unless select_products has surfaced that product detail as supported for this turn.

When the requested detail is unsupported, a feasible CTA is to ask for the exact variant only if the user has not already provided a plausible exact name, offer a broader category recommendation, or bridge back to where the product would sit in the routine. Do not ask the user whether they want the same unsupported claim checked again.

## German Answer Shape

Start with the fit logic, then list up to three products in tool order with distinct reasons. Add one concise usage note when helpful.

## Do Not

Do not invent products, prices, availability, ingredient lists, reviews, or claims from product names. Do not turn category education into an unsolicited product recommendation.
