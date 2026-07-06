# Dry Shampoo

## Role In Hair Concierge
Dry shampoo is a temporary cosmetic freshness bridge between wet washes. It can absorb visible oil at the roots and make the Ansatz look fresher for a short gap, but it does not clean the scalp like shampoo and water.

It is not a scalp treatment, not dandruff or irritation care, not length care, not hair-loss support, and not a replacement for regular washing.

In plain terms: dry shampoo absorbs oil between washes, but it does not replace cleansing.

## Use When
- The user asks for dry shampoo, Trockenshampoo, second-day freshness, or root refresh.
- Roots look oily or greasy between wet wash days.
- The user wants post-workout freshness or schedule-constrained freshness without water.
- Fine, flat, low-volume, or oily-root hair needs a light visual oil buffer.
- The scalp is otherwise comfortable and the goal is a brief bridge until the next wet wash.

## Best Fit
- oily roots or greasy-looking scalp area between wet washes
- fine, flat, or low-density hair needing root-side freshness without adding water
- post-workout, travel, or time-pressure situations with no irritation or medical scalp signals
- users stretching a wash by a short, practical amount rather than replacing cleansing

## Weak Fit / Not The Best Lever
- replacing regular washing indefinitely
- itchy, burning, inflamed, painful, wounded, sore, pustular, or persistently flaky scalp contexts
- heavy buildup, residue, scalp congestion, or repeated dry-shampoo layering that needs actual cleansing
- coated lengths, dry lengths, frizz, split ends, repair, shine, moisture, or hair-loss goals
- users asking for scalp treatment, dandruff treatment, or medical symptom control

## Realistic Benefit
Dry shampoo can make roots look fresher and less oily for a brief bridge when washing is inconvenient.

It does not remove sweat, sebum, product film, dry-shampoo residue, or scalp buildup like wet cleansing. Repeated layering can become part of the buildup problem, especially for fine, dark, low-density, sensitive, flaky, or buildup-prone scalps.

## Category Boundaries
Belongs here:
- between-wash root freshness
- temporary visual oil absorption at roots
- post-workout or time-pressure refresh
- light root volume or less greasy-looking Ansatz when product data supports concrete product claims

Does not belong here:
- normal shampoo cleansing
- deep cleansing/reset for residue
- scalp peeling or scalp treatment
- length softness, frizz, repair, shine, or split-end care
- dandruff, irritation, hair loss, or scalp disease handling

Common confusions:
- Dry shampoo can make roots look fresher, but it does not clean the scalp.
- Normal shampoo with water is the cleanse step.
- Deep-cleansing shampoo may fit when residue, buildup, or repeated layering is already central.
- Peeling may fit a tolerant scalp with cosmetic scalp buildup, but not irritation or persistent flakes.
- Product-specific promises such as no white cast, tint match, volume, fragrance tolerance, invisible finish, or sensitive-scalp positioning need selected product facts. Even with supporting metadata, do not guarantee irritation-free use.

## Root Bridge Logic
Internal Frische-Bridge logic can remain, but customer-facing German should use softer wording such as `Frische-Überbrückung`, `kurze Frische-Hilfe`, or `Ansatz auffrischen`.

Keep the category narrow: dry shampoo is for visible root oil and short-term freshness. It belongs mainly at the roots, should be distributed or brushed/comb-through only as product directions support, and should be washed out later with normal shampoo and water.

Hair length is not a major dry-shampoo signal. Use it only for application practicality, such as sectioning at the roots on long or very long hair. Do not recommend dry shampoo because hair is long, and do not use dry shampoo for length dryness, frizz, split ends, or protection.

For oily roots, dry shampoo can be an occasional bridge, but wash frequency should still match scalp oiliness, activity, styling-product use, comfort, and lifestyle. If the user needs it frequently, frame that as a bridge or sign to adjust wash rhythm/root routine, not as proof they should simply wash normally. Do not tell every oily-root user to wash less. If the user reports heaviness, itch, flakes, burning, soreness, or congestion after dry shampoo, stop escalating dry shampoo and move toward actual cleansing, simplification, or safety wording.

If `care_balance_context.shampoo_cadence` shows frequent dry-shampoo use while the target wet-shampoo cadence is above current real shampoo use, say dry shampoo can bridge visible freshness, but it does not replace wet scalp cleansing with shampoo and water.

## Agent Interpretation Hooks
If the user asks what dry shampoo does:
- primary_intent: category_education
- product_request_kind: category_education
- care_category: dry_shampoo
- requires_tool: false
- do_not_show_unasked_product_cards: true

If the user asks whether dry shampoo is useful:
- primary_intent: general_advice
- product_request_kind: none
- care_category: dry_shampoo
- requires_tool: false unless product-specific
- category assessment wording: answer whether dry shampoo is a useful `kurze Frische-Hilfe` or weak fit, not as a product-card flow

If the user asks for a type/kind of dry shampoo, not concrete products:
- primary_intent: category_education
- product_request_kind: category_education
- care_category: dry_shampoo
- requires_tool: false
- do_not_show_unasked_product_cards: true

If the user asks for concrete dry shampoos:
- primary_intent: product_recommendation
- product_request_kind: specific_products
- care_category: dry_shampoo
- requires_tool: select_products

If the user asks for a requested number of dry shampoos:
- primary_intent: product_recommendation
- product_request_kind: specific_products
- care_category: dry_shampoo
- requested_product_count: parsed number
- count_policy: exact
- requires_tool: select_products
- availability caveat: exact means the requested count when enough grounded, suitable, available products exist; if fewer fit, return fewer and explain the fit or availability limit

If the user asks about a named dry shampoo, no-white-cast, tint, volume, fragrance, format, invisible finish, sensitive-scalp positioning, exact usage, or whether a product claim is true:
- primary_intent: product_recommendation when the user asks for alternatives; otherwise keep the terminal answer in named-product assessment
- answer_mode: product_assessment after identity is resolved
- product_request_kind: product_detail
- care_category: dry_shampoo
- requires_tool: lookup_product_candidate first, then product catalog data or internal select_products projection facts when product claims need grounding
- product detail behavior: treat this as a product fact/claim check, not necessarily a recommendation or product-card flow
- do not infer from product name, brand line, marketing family, or category guidance alone
- do not guarantee irritation-free use even if product metadata supports fragrance-free or sensitive-scalp positioning
- no-white-cast or residue claims need explicit selected product metadata; without it, answer with safe uncertainty and only confirmed color, format, or product facts

If the user asks dry shampoo versus shampoo, deep cleansing, peeling, leave-in, oil, or another category:
- primary_intent: category_education
- product_request_kind: category_education
- care_category: none unless the final answer recommends one primary category
- load_relevant_category_packages: true
- requires_tool: false unless concrete products are requested

If the user asks where or how dry shampoo belongs in a routine, without asking to change a saved/current routine:
- primary_intent: routine_explanation
- product_request_kind: category_education
- routine_intent: none
- care_category: dry_shampoo
- requires_tool: false unless current routine state is needed

Placement/order questions such as `Wo kommt Trockenshampoo in der Routine hin?` are routine_explanation, not routine_mutation, unless the user asks to add, remove, replace, or change saved/current routine state.

If the user asks to add, remove, replace, or change dry shampoo in a saved/current routine:
- primary_intent: routine_mutation
- product_request_kind: none
- routine_intent: modify, remove_step, or replace_product based on the request
- care_category: dry_shampoo
- requires_tool: build_or_fix_routine

If safety symptoms appear:
- primary_intent: safety_boundary
- product_request_kind: none
- care_category: none
- requires_tool: false
- preserve the suspected dry-shampoo trigger in evidence/safety wording when the user links symptoms to this category

If the user asks a broad concern or technique question without a product-category focus:
- primary_intent: general_advice
- product_request_kind: none
- care_category: none
- requires_tool: false unless routine or product-specific

German example distinctions:
- "Welche Art Trockenshampoo passt zu feinem Haar?" or "Spray oder Puder: was ist der Unterschied?" means type/kind education: `primary_intent: category_education`, `product_request_kind: category_education`, no unasked product cards.
- "Ist Trockenshampoo bei schnell fettendem Ansatz sinnvoll?" means category assessment: `primary_intent: general_advice`, `product_request_kind: none`, `care_category: dry_shampoo`.
- "Nenn mir zwei Trockenshampoos für dunkles Haar" or "Welches Trockenshampoo kannst du empfehlen?" means concrete products: `primary_intent: product_recommendation`, `product_request_kind: specific_products`, `requires_tool: select_products`.
- "Stimmt es, dass Produkt X keinen weißen Schleier macht?" means named-product assessment/fact check: use `lookup_product_candidate`, `product_request_kind: product_detail`, and verified product metadata or internal `select_products` projection facts before the claim is answered.

## Agent May Decide
- Whether dry shampoo is a useful bridge, optional, weak fit, or inappropriate because actual cleansing or safety handling is needed.
- Whether frequent dry shampoo use is a bridge or sign to adjust wash rhythm/root routine rather than a cleansing replacement.
- Whether the user means oily roots, coated lengths, scalp symptoms, or buildup.
- Whether normal shampoo, deep cleansing, peeling, leave-in, oil, troubleshooting, or safety guidance is more appropriate.
- Whether one follow-up about frequency, scalp comfort, flakes, residue, dark hair, flatness, or buildup would materially change the answer.
- How to explain the bridge role in customer-facing German without making it a replacement wash.

## Code And Tools Decide
- Concrete dry shampoo product IDs, category membership, recommendation order, lifecycle, availability, price, stock, and retailer.
- Tint, no-white-cast, volume, fragrance or fragrance-free status, format, invisible finish, sensitive-scalp positioning, and product-specific claims.
- Exact usage protocol, exact cadence, compatibility, and product-specific directions.
- Saved routine state and routine mutations.

## Required Grounding
Use `select_products` before naming concrete dry shampoos as recommendations.

Use product metadata before promising no white cast, tint match, volume, fragrance or fragrance-free status, invisible finish, sensitive-scalp positioning, exact cadence, or exact usage protocol. Never promise irritation-free use.

For no-white-cast, white-residue, or invisible-finish questions, do not say the claim is true unless selected product metadata explicitly supports it. If not grounded, use the base unsupported-claim fallback: say it cannot be safely promised for this variant, then mention only confirmed facts such as the product name, tint/color family, format, root-use role, or broader dry-shampoo fit when those are available.

Use routine tooling before creating or changing a saved routine.

## Missing Required Data
Ask at most one follow-up if missing information would materially change:
- whether the user means oily roots versus coated lengths
- how often dry shampoo is being layered
- whether itch, flakes, burning, soreness, irritation, or scalp congestion is present
- whether actual cleansing or reset is needed instead
- whether a named-product detail question lacks the exact product
- whether a saved/current routine mutation needs current routine context

Do not ask a follow-up if the user clearly needs short-term root freshness and safety risk is low.

## Safety Boundary
Escalate away from dry-shampoo optimization when the user reports scalp pain, burning, significant irritation, wounds, swelling, pustules, unusual shedding, patchy hair loss, infection-like symptoms, or persistent inflammatory symptoms.

Do not recommend dry shampoo as scalp treatment or cleansing replacement. If the user links itch, burning, soreness, flakes, residue, or congestion to dry shampoo, suggest pausing the suspected trigger and moving toward actual cleansing, simpler scalp care, or professional evaluation when symptoms are significant or persistent. Do not diagnose dandruff, dermatitis, allergy, infection, or hair loss.

## German Answer Shape
Call it `Frische-Überbrückung`, `kurze Frische-Hilfe`, or `Ansatz auffrischen`, not a real wash.

Then explain:
1. it can visually buffer oily roots for a short time
2. it does not remove sweat, sebum, and residue like shampoo with water
3. it belongs mainly at the Ansatz/root area and should be distributed as product directions support
4. repeated layering means the next useful move is usually a wet wash or reset, not more dry shampoo
5. product claims like tint, no white cast, volume, fragrance, or exact protocol need product data

Keep the tone practical and non-shaming.

## Do Not
- Do not normalize replacing washes with dry shampoo.
- Do not say it cleans the scalp.
- Do not treat flakes, itch, soreness, irritation, dandruff, hair loss, scalp congestion, or buildup with dry shampoo; instead suggest pausing the suspected trigger, cleansing/reset, simplification, or safety wording depending on severity.
- Do not promise volume, invisible finish, tint match, fragrance tolerance, fragrance-free status, or sensitive-scalp positioning without product facts, and never promise irritation-free use.
- Do not route dry lengths, frizz, shine, split ends, or repair goals into dry shampoo unless root oil is also the user-facing problem; instead route to length-care or general advice.
- Do not name products, rank products, or make product-specific claims unless tool/catalog data grounded them.
