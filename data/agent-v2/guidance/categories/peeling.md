# Peeling

## Role In Hair Concierge
Scalp peeling is occasional cosmetic scalp-feel, scalp-exfoliation, or buildup support for a tolerant scalp. It is a scalp-only reset support, not a default wash step and not treatment for inflamed, painful, persistent, or diagnosed scalp conditions.

It is not length cleansing, not fibre mineral removal, not dandruff treatment, not hair-loss care, and not a stronger-is-better maintenance step.

## Use When
- The user asks for scalp peeling, Kopfhautpeeling, scrub, exfoliation, or scalp reset.
- The scalp is oily, buildup-prone, or has visible cosmetic residue.
- There is scalp-local residue or oily-root buildup on tolerant skin and the goal is gentle occasional scalp peeling rather than fibre cleansing.
- There is dry-shampoo, heavy styler, oil, co-wash, mask, or product residue at the scalp.
- Mild non-painful flakes are framed as cosmetic buildup rather than medical symptoms.
- The scalp tolerates products well and the answer can stay occasional, gentle, and conservative.

## Best Fit
- oily roots or scalp with visible residue, product film, dry-shampoo residue, heavy stylers, co-washing, oils, or mild cosmetic buildup
- mild non-painful flakes when the user asks about a cosmetic reset rather than dandruff or medical treatment
- tolerant scalps where an occasional add-on is acceptable
- users who need a scalp-only reset before returning to normal shampoo and length conditioning

## Weak Fit / Not The Best Lever
- irritated, burning, painful, wounded, inflamed, pustular, very sensitive, or recently treated scalp
- persistent flakes, intense itch, redness, inflammation, soreness, recurring symptoms, suspected dermatitis, psoriasis, infection, shedding, patchy loss, or hair-loss contexts
- persistent itch, redness, burning, pain, repeated flakes, or shedding; this is a safety boundary, not stronger peeling
- dry or fragile hair when the proposed method is harsh mechanical scrubbing
- daily peeling, aggressive exfoliation, or "more is better" routine logic
- fibre coating, hard-water feel, dull/stiff/brassy length feel, or product film through lengths that needs cleanser-based reset instead

## Realistic Benefit
Peeling can help a tolerant scalp feel cleaner or less residue-heavy when mild cosmetic buildup is the issue.

It does not diagnose or treat dandruff, dermatitis, infection, hair loss, inflammation, or persistent itch. It also does not cleanse mineral or product film from the hair fibre like a deep-cleansing or chelating shampoo can.

## Category Boundaries
Belongs here:
- occasional scalp-only cosmetic residue support
- oily scalp or mild buildup on tolerant skin
- gentle exfoliation framing
- scalp-feel reset before or during a wash

Does not belong here:
- deep-cleansing shampoo or chelating for fibre deposits
- dry shampoo oil absorption
- normal shampoo baseline cleansing
- medical scalp treatment, dandruff treatment, or anti-hair-loss advice
- length conditioning, mask, leave-in, oil finish, or bondbuilder logic

Common confusions:
- Peeling is scalp-only support for buildup or scalp feel; it does not cleanse mineral or product film from the hair fibre.
- Deep-cleansing shampoo may be the better reset when the issue is product film, hard-water feel, or residue through the lengths.
- Deep-cleansing shampoo may be a better reset than peeling when the problem sits in the hair fibre rather than on scalp skin.
- Product/mineral film through lengths or hard-water feel points toward reset/clarifying/chelating shampoo; scalp-local residue or oily-root buildup on tolerant skin may point toward gentle occasional scalp peeling.
- Dry shampoo absorbs visible oil temporarily; it does not remove residue like washing.
- Dandruff, persistent itch, pain, inflammation, and hair loss are not cosmetic peeling problems.
- Aggressive salt/sugar scrubbing is not the default answer for scalp buildup.

## Buildup Versus Symptom Logic
Separate cosmetic residue from symptom patterns before recommending peeling.

Cosmetic fit:
- oily roots
- visible residue
- dry-shampoo or styler buildup
- mild non-painful flakes framed as residue
- tolerant scalp

Safety or weak-fit signals:
- burning, pain, redness, inflammation, soreness, wounds, pustules, unusual itch, persistent or recurring flakes, shedding, patchy loss, or diagnosed scalp condition
- persistent itch, redness, burning, pain, repeated flakes, or shedding

When symptom signals dominate, fewer variables and professional evaluation language are safer than stronger exfoliation: use the safety boundary, not stronger peeling. When residue is on the hair fibre or lengths rather than scalp skin, compare deep cleansing instead of pushing peeling.

Anti-dandruff or treatment positioning may be mentioned only when grounded product metadata supports that a specific product is positioned that way. Do not diagnose dandruff, do not treat peeling as the default dandruff answer, and do not answer persistent flakes, itch, redness, inflammation, soreness, or recurrence with stronger peeling.

## Agent Interpretation Hooks
If the user asks what scalp peeling does:
- primary_intent: category_education
- product_request_kind: category_education
- care_category: peeling
- requires_tool: false
- do_not_show_unasked_product_cards: true

If the user asks whether peeling is right for them, for example "Ist Kopfhautpeeling bei mir sinnvoll?":
- primary_intent: general_advice
- product_request_kind: none
- care_category: peeling
- requires_tool: false unless product-specific

If the user asks for a type/kind of peeling, not concrete products, for example "Welche Art von Kopfhautpeeling ist bei öligem Ansatz sinnvoll?" or "Was ist besser: mechanisches oder chemisches Kopfhautpeeling?":
- primary_intent: category_education
- product_request_kind: category_education
- care_category: peeling
- requires_tool: false
- do_not_show_unasked_product_cards: true

If the user asks for concrete peeling products, for example "Welches Kopfhautpeeling passt zu mir?", "Nenn mir zwei Kopfhautpeelings", or "Empfiehl mir ein sanftes Peeling":
- primary_intent: product_recommendation
- product_request_kind: specific_products
- care_category: peeling
- requires_tool: select_products

If the user asks for a requested number of peeling products:
- primary_intent: product_recommendation
- product_request_kind: specific_products
- care_category: peeling
- requested_product_count: parsed number
- count_policy: exact
- requires_tool: select_products
- exact applies when enough grounded suitable products are available; if fewer are grounded and suitable, return fewer and explain fit or availability instead of padding

If the user asks about a named peeling, whether it is mechanical, chemical, scalp-suitable, sensitive-scalp suitable, anti-dandruff, treatment-like, compatible, or has an exact scalp-use protocol/frequency:
- primary_intent: product_recommendation when the user asks for alternatives; otherwise keep the terminal answer in named-product assessment
- answer_mode: product_assessment after identity is resolved
- product_request_kind: product_detail
- care_category: peeling
- requires_tool: lookup_product_candidate first, then product catalog data or internal select_products projection facts when product claims need grounding
- do not infer from product name, brand line, marketing family, or category guidance alone
- treat this as a product fact or claim check, not automatically as a recommendation or card flow

If the user asks peeling versus deep cleansing, shampoo, dry shampoo, dandruff care, or another category:
- primary_intent: category_education
- product_request_kind: category_education
- care_category: none unless the final answer recommends one primary category
- load_relevant_category_packages: true
- requires_tool: false unless concrete products are requested

If the user asks where or how peeling belongs in a routine, without asking to change a saved/current routine:
- primary_intent: routine_explanation
- product_request_kind: category_education
- routine_intent: none
- care_category: peeling
- requires_tool: false unless current routine state is needed

If the user asks to add, remove, replace, or change peeling in a saved/current routine:
- primary_intent: routine_mutation
- product_request_kind: none
- routine_intent: modify, remove_step, or replace_product based on the request
- care_category: peeling
- requires_tool: build_or_fix_routine

If safety symptoms appear, including persistent flakes, itch, redness, inflammation, soreness, recurrence, wounds, shedding, patchy loss, or pain:
- primary_intent: safety_boundary
- product_request_kind: none
- care_category: none
- requires_tool: false
- preserve the suspected peeling trigger in evidence/safety wording when the user links symptoms to this category

If the user asks a broad concern or technique question without a product-category focus:
- primary_intent: general_advice
- product_request_kind: none
- care_category: none
- requires_tool: false unless routine or product-specific

## Agent May Decide
- Whether peeling is appropriate, optional, too much, or unsafe for the user's scalp context.
- Whether the issue sounds like cosmetic scalp buildup or a symptom pattern.
- Whether shampoo, deep cleansing, dry shampoo, gentler scalp care, troubleshooting, or safety guidance is the better route.
- Whether one follow-up about irritation, pain, persistent flakes, redness, sensitivity, wounds, shedding, or hair loss would change safety.
- Whether a product-detail answer can be grounded as a product fact or claim check without turning it into an unrequested recommendation.
- How to explain gentle, occasional use in customer-facing German.

## Code And Tools Decide
- Concrete peeling product IDs, category membership, recommendation order, lifecycle, availability, price, stock, and retailer.
- Product claims, scalp suitability, caveats, format, active role, sensitive-scalp suitability, anti-dandruff claims, and treatment-like claims.
- Whether a product is mechanical, chemical, scalp-directed, scalp-safe for a profile, or compatible with the user's routine.
- Exact scalp-use protocol, exact frequency, exact timing, and product-specific directions.
- Saved routine state and routine mutations.

## Required Grounding
Use `select_products` before naming concrete peeling products as recommendations.

Use product metadata before making scalp-suitability, anti-dandruff positioning, sensitive-scalp, active-ingredient, mechanical/chemical, treatment-like, exact frequency, or exact protocol claims.

Use routine tooling before creating or changing a saved routine.

When a requested product count cannot be met with enough grounded suitable products, return fewer products and explain the fit or availability limitation.

## Missing Required Data
Ask at most one follow-up if missing information would materially change:
- irritation, pain, burning, redness, wounds, sensitivity, shedding, or hair-loss context
- persistent flakes versus mild cosmetic buildup
- whether residue is on scalp only or through the lengths
- whether a named-product detail question lacks the exact product
- whether a saved/current routine mutation needs current routine context

Do not ask a follow-up if the user clearly has mild cosmetic buildup and a conservative answer is possible.

## Safety Boundary
Escalate away from peeling advice when the user reports scalp pain, burning, significant irritation, wounds, swelling, pustules, persistent flakes, recurring flakes, itch with redness, soreness, unusual shedding, patchy hair loss, infection-like symptoms, or persistent inflammatory symptoms.

If symptoms are active or significant, do not recommend stronger exfoliation. Suggest pausing suspected triggers, simplifying scalp products, and getting professional evaluation when appropriate. Do not diagnose.

If the user links burning, itching, shedding, irritation, or similar symptoms to peeling, mention the suspected trigger in the safety wording, but keep care_category none and do not add unsupported trigger-category fields.

## German Answer Shape
Start by separating `Rückstände/ölige Kopfhaut` from `gereizte Kopfhaut`.

If it fits, frame peeling as occasional scalp-only support before or during a wash, with gentle pressure, thorough rinsing, and normal conditioner or length care afterward.

Then explain:
1. why the signal sounds like cosmetic scalp buildup or not
2. why peeling is optional and tolerance-based
3. why persistent flakes, burning, pain, redness, wounds, or shedding should not be solved by stronger exfoliation
4. whether product choice, exact scalp-use protocol, or treatment-like claims need product data

Use practical German terms like `Kopfhautpeeling`, `Rückstände`, `öliger Ansatz`, `sanft`, `selten`, `nicht schrubben`, and `bei Brennen stoppen`.

## Do Not
- Do not diagnose or promise flake, itch, inflammation, dandruff, infection, or hair-loss treatment.
- Do not recommend harsh scrubbing for sensitive, irritated, inflamed, painful, wounded, or very dry scalps.
- Do not make peeling a required routine step or daily default.
- Do not treat persistent flakes, itch, redness, inflammation, soreness, recurrence, dandruff, hair loss, or scalp disease as cosmetic peeling problems; instead route to the safety/scalp boundary and avoid stronger exfoliation.
- Do not use peeling for fibre mineral buildup or product film through the lengths when deep cleansing is the better category comparison; instead explain the category difference.
- Do not name products, rank products, or make product-specific claims unless tool/catalog data grounded them.
- Do not infer mechanical, chemical, sensitive-scalp, anti-dandruff, treatment, or scalp-use claims from a product name, brand line, or marketing family; instead use product metadata or say the claim is not grounded.
