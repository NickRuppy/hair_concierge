# Oil

## Role In Hair Concierge
Hair oil is an optional finish, friction-support, or pre-wash length-protection category. It can help tips look smoother, add shine, reduce rough-feel friction, or protect dry lengths before shampoo.

Scalp oiling is a cautious niche case for a dry/tight but calm scalp. It is not the default oil answer, not medical scalp care, not hair-loss treatment, not water-like moisture, not structural repair, not permanent split-end repair, and not color protection unless product metadata supports a narrow claim.

Assume finishing oil by default for broad oil use unless the user says scalp, pre-wash, massage, einwirken, growth, or hair-loss language.

## Use When
- The user asks for oil, Haaröl, dry ends, tips, shine, finish, smoother surface feel, or frizz smoothing.
- The user says `vor dem Waschen`, `einwirken`, `Massage`, carrier oil, scalp oiling, or pre-wash oiling language.
- Dry, porous, bleached, colored, heat-stressed, rough, or friction-prone lengths may need pre-wash length protection or end-focused finish.
- Fine, flat, oily-root, low-density, or buildup-prone profiles need weight caution rather than automatic oil avoidance.
- The user asks about scalp oiling and the scalp is dry/tight without burning, pain, wounds, persistent flakes, pustules, patchy loss, or unusual shedding.

## Best Fit
- finish/tips use when the user wants dry ends to feel smoother, calmer, shinier, or less rough
- pre-wash length protection for dry, porous, bleached, colored, or heat-stressed lengths when before-wash use is named
- cautious scalp comfort for dry/tight but otherwise calm scalp
- users who can tolerate an optional ritual step and shampoo oil out properly
- comparison turns where oil needs to be weighed against leave-in, mask, conditioner, bondbuilder, or deep cleansing

## Weak Fit / Not The Best Lever
- true moisture replacement, structural shaft repair, permanent split-end repair, color protection, or fast visible regrowth
- medically diagnosed or strongly suspected scalp disease such as seborrheic dermatitis, psoriasis, folliculitis, tinea, persistent flakes, pustules, wounds, burning, or painful scalp
- sudden, patchy, persistent, painful, inflamed, or severe shedding/thinning
- fine, oily, flat, low-density, coated, or buildup-prone hair when another layer would likely weigh hair down
- users who cannot or will not emulsify shampoo into pre-wash oil before adding much water
- heat protection unless product metadata explicitly supports heat use
- plain oil is not a heat protectant without product-specific support

## Realistic Benefit
Oil can make tips look smoother, add shine, reduce friction feel, or make dry/porous lengths feel less rough during washing. Pre-wash oiling is mechanism-plausible and partly evidence-supported as length protection; scalp comfort and massage benefits are more practitioner-validated than strongly proven.

Oil does not hydrate like water-based conditioning, rebuild internal bonds, reverse split ends, treat scalp disease, prevent hair loss, or make hair grow thicker/faster in a routine-advice sense. For growth-oriented questions, oil is at most an adjunct and should not replace professional evaluation when hair-loss signals are concerning.

## Category Boundaries
Belongs here:
- tiny finish/tips shine, smoothing, and friction support
- pre-wash length protection before shampoo
- cautious non-medical scalp comfort only when the scalp is calm
- wash-out oiling technique
- weight, flatness, and buildup caution

Does not belong here:
- leave-in heat protection unless product data supports it
- masks as conditioning treatments
- medicated dandruff or scalp-treatment products
- bondbuilder repair
- deep cleansing/reset
- hair-loss or regrowth treatment

Common confusions:
- Silicone finishing serums marketed as `hair oil` are leave-in smoothing products, not pre-wash oiling products.
- Pre-wash plant/carrier oils sit on scalp or lengths before shampooing and must be washed out; they are not masks or leave-in rescue treatments.
- Masks are conditioning treatments with a different routine place.
- Medicated dandruff or scalp-treatment products address scalp disease; they are not interchangeable with cosmetic oiling.
- Rosemary, peppermint, massage, castor, coconut, or carrier oils must not be framed as proven regrowth treatment or as substitutes for medical evaluation.
- Coconut oil is not universally best for every hair type.

## Oil Role Logic
Clarify the purpose before recommending action:

- `Finish/tips`: default for "oil for dry ends" or goals like shine, smoother surface frizz, softer-looking tips, or less rough finish; tiny amount, ends only, cosmetic smoothness and shine.
- `Pre-wash length protection`: before shampoo, for concerns like dry, porous, bleached, colored, heat-stressed, rough, or friction-prone lengths; must be washed out properly and is not scalp oiling by default.
- `Scalp comfort`: cautious niche for dry/tight but calm scalp; pause during active irritation.

For finish versus pre-wash education, anchor the distinction to the user's stated concern or goal: finishing oil for shine, surface frizz, smoother tips, and after-styling polish; pre-wash length protection for dry, porous, bleached, colored, or heat-stressed lengths before shampoo. Do not route to scalp oiling by default.

For broad oil use, assume finishing oil by default unless the user says scalp, pre-wash, massage, einwirken, growth, hair-loss language, or clearly asks about protecting lengths before shampoo. For heat styling, plain oil is not a heat protectant without product-specific support: recommend a real heat protectant before heat, meaning a product with explicit heat-protectant claim before heat. Oil can be used sparingly after styling as a finish, or as pre-wash length protection where appropriate.

For fine, oily, flat, low-density, coated, or buildup-prone hair, keep dose tiny, end-focused, or skip oil if another layer is likely to weigh hair down. If oil use is contributing to coated/heavy residue, compare deep cleansing instead of adding more oil.

## Wash-Out Technique
For pre-wash oiling, give practical technique before product shopping:

1. Apply a small amount before washing, mainly where the hair feels rough or dry.
2. Leave it on briefly; do not turn timing into a universal protocol.
3. Emulsify shampoo into the oily areas before adding much water.
4. Rinse well, then condition or use leave-in as usual when length care is still needed.

Exact timing, cadence, scalp placement, and compatibility require product metadata. Frame cadence as wash-count-based and response-based, not a hard universal schedule.

## Agent Interpretation Hooks
If the user asks what oil does:
- primary_intent: category_education
- product_request_kind: category_education
- care_category: oil
- requires_tool: false
- do_not_show_unasked_product_cards: true

If the user asks whether oil is useful, whether they need it, or whether oil fits their situation:
- primary_intent: general_advice
- product_request_kind: none
- care_category: oil
- requires_tool: false unless product-specific
- interpret this as a category-fit assessment: answer whether oil is the right lever, optional, too heavy, or weaker than another category without inventing a separate intent
- do_not_show_unasked_product_cards: true

If the user asks for a type/kind of oil use, not concrete products:
- examples:
  - `Soll ich Öl vor dem Waschen oder nach dem Stylen nehmen?`
  - `Welche Art von Öl-Anwendung passt zu trockenen Spitzen?`
  - `Ist Öl eher Finish oder Pre-Wash?`
- primary_intent: category_education
- product_request_kind: category_education
- care_category: oil
- requires_tool: false
- do_not_show_unasked_product_cards: true

If the user asks which oil fits, asks for options, or asks for a count:
- examples:
  - `Welches Öl passt, ohne dass es schwer wird?`
  - `Nenn mir zwei Haaröle.`
  - `Empfiehl mir ein leichtes Öl für Spitzen.`
- primary_intent: product_recommendation
- product_request_kind: specific_products
- care_category: oil
- requested_product_count: parse if stated, otherwise use default
- count_policy: exact when explicit, default when not stated
- exact means exactly the requested count when enough grounded, suitable, available products exist; if fewer products fit, return fewer and explain the fit or availability constraint
- requires_tool: select_products

If the user asks about a named oil, serum, ingredient, heat claim, scalp suitability, fragrance, color protection, silicone-free/oil-free status, exact cadence, or product-specific oil claim:
- primary_intent: product_recommendation
- product_request_kind: product_detail
- care_category: oil
- requested_product_count: 1 for a single named product or claim check
- count_policy: exact for a single named product or claim check
- load_advisor_guidance answer_mode_hint: product_recommendation
- requires_tool: product catalog data or select_products
- do_not_infer_from_name_or_brand_line: true
- heat-protection claims require explicit selected product metadata; plain oil is not heat protection

If the user asks oil versus leave-in, mask, conditioner, bondbuilder, heat protectant, or deep cleansing:
- primary_intent: category_education
- product_request_kind: category_education
- care_category: none unless the user or final answer makes one category primary
- requires_tool: false unless concrete products are requested
- load_relevant_category_packages: true
- answer as a balanced category comparison, not as a product comparison, unless concrete products are named or requested
- load multiple guidance packages when the compared category boundaries matter

If the user asks where or how oil belongs in a routine, without asking to change a saved/current routine:
- answer_mode: general_advice
- primary_intent: routine_explanation
- product_request_kind: category_education
- routine_intent: none
- care_category: oil
- requires_tool: false unless current routine state is needed
- do not call build_or_fix_routine for ordering-only questions like `Kommt Öl vor oder nach Leave-in?`
- do not return routine payloads or routine_step_ids for ordering-only questions

Placement/order questions such as `Kommt Öl vor oder nach Leave-in?` are routine_explanation, not routine_mutation, unless the user asks to add, remove, replace, or change saved/current routine state.

If the user asks to add, remove, replace, or change oil in a saved/current routine:
- primary_intent: routine_mutation
- product_request_kind: none
- routine_intent: modify, remove_step, or replace_product based on the request
- care_category: oil
- requires_tool: build_or_fix_routine
- map add or change wording to modify, remove wording to remove_step, and replacing one product with another to replace_product until the contract exposes narrower mutation values
- do not claim the saved routine was changed unless routine tooling confirms it

If the user asks generally whether rosemary oil, castor oil, scalp massage, or oil helps growth, without reporting active hair-loss or scalp symptoms:
- primary_intent: general_advice
- product_request_kind: none
- care_category: oil
- requires_tool: false
- treat this as a category-fit and growth-claim-boundary answer using supported general_advice
- do_not_show_unasked_product_cards: true
- explain that evidence is limited/mixed and do not frame oil as a hair-growth treatment

When the user asks `Maske oder Öl?` after saying the lengths are dry/frizzy and the routine should stay light, do not make oil the main care add-on. Prefer a light occasional mask; oil is only a tiny finish if needed.

If the user reports sudden shedding, patchy loss, severe or persistent thinning, scalp pain, burning, pustules, wounds, persistent flakes, inflamed scalp, or medically adjacent scalp symptoms:
- primary_intent: safety_boundary
- product_request_kind: none
- care_category: none
- requires_tool: false
- preserve oil as the suspected trigger in evidence/safety wording when the user links symptoms to oil

## Agent May Decide
- Whether oil should be finish/tips, pre-wash length protection, cautious scalp comfort, optional, or not the right lever.
- Whether one purpose-first follow-up is needed.
- Whether weight, buildup, fine hair, low density, oily roots, or flatness should make oil tiny, end-only, pre-wash-only, or skipped.
- Whether leave-in, mask, conditioner, deep cleansing, bondbuilder, technique, or safety guidance is stronger.
- How to explain wash-out technique in plain German.

## Code And Tools Decide
- Concrete oil product IDs, category membership, recommendation order, lifecycle, availability, price, stock, and retailer.
- Whether a product is a finish serum, pre-wash oil, scalp-suitable oil, lightweight, fragrance-free, color-protective, silicone-free, oil-free, or heat-use supported.
- Product-specific claims, ingredient effects, exact cadence, exact timing, exact amount, exact placement, and exact usage protocol.
- Saved routine state and routine mutations.

## Required Grounding
Use `select_products` before naming concrete oils as recommendations.

Use product metadata before claiming finish/pre-wash role, weight, scalp suitability, heat protection, color protection, silicone-free or oil-free status, fragrance, ingredient effects, exact cadence, or usage protocol.

For heat-tool questions, plain oil is not a heat protectant without product-specific support. Unless selected product metadata has an explicit supported heat-protection claim, use safe uncertainty, recommend a real heat protectant before heat, meaning a product with explicit heat-protectant claim before heat, and position oil only as a tiny finish after styling or as pre-wash length protection where appropriate.

Use routine tooling before creating or changing a saved routine.

## Missing Required Data
Ask at most one follow-up if missing information would materially change:
- whether the user wants finish, pre-wash length protection, scalp comfort, or growth support
- whether scalp symptoms make oil unsafe or unhelpful
- whether fine/low-density/oily/flat/coated hair makes oil a poor fit
- whether the oil must be washed out or used as a finish

Default "oil for dry ends" to a tiny end-focused finish unless before-wash, length-protection, scalp, or growth language changes the lane.

Default broad oil use to finishing oil unless the user says scalp, pre-wash, massage, einwirken, growth, or hair-loss language.

## Safety Boundary
Do not suggest oil as medical scalp care. Pause scalp oils during active irritation and route persistent, painful, inflamed, pustular, patchy-loss, severe shedding, or post-procedure healing contexts away from routine-style oiling.

Do not recommend neat essential-oil application. Do not give dilution recipes, drop counts, DIY scalp-treatment protocols, or essential-oil routines for scalp symptoms. Do not present rosemary, peppermint, massage, castor, coconut, or carrier oils as substitutes for clinical hair-loss evaluation or treatment.

## German Answer Shape
Separate oil purposes first and tie them to the user's goal: `Finish für Spitzen` for Glanz, Oberflächen-Frizz, glattere Spitzen, or Polish; `Pre-Wash-Schutz für Längen` for trockene, poröse, blondierte, colorierte, hitzegestresste Längen vor dem Shampoo; or cautious scalp comfort only when the scalp is calm and the user actually asked about scalp use.

Then explain:
1. whether oil belongs in the routine
2. where it goes and how tiny the dose should be
3. how weight/buildup changes the advice
4. for pre-wash oiling: apply before washing, leave on briefly, emulsify shampoo into the oil before adding much water, rinse, then condition as usual

Use grounded product recommendations only after product selection. For growth or scalp symptom questions, start with the boundary before discussing cosmetic comfort.

## Do Not
- Do not say oil moisturizes like water-based conditioning. Instead: frame it as shine, slip, friction, surface feel, or pre-wash protection.
- Do not promise regrowth, thicker hair, structural repair, split-end repair, color protection, or medical scalp treatment from oil. Instead: route repair to bondbuilder/conditioning/trimming and hair-loss symptoms to safety guidance.
- Do not recommend neat essential-oil application. Instead: avoid dilution recipes, drop counts, and DIY scalp-treatment protocols as app-level rules and keep essential-oil claims conservative.
- Do not collapse pre-wash oils, silicone finishing serums, masks, medicated dandruff products, and scalp treatments into the same bucket. Instead: name the role first.
- Do not recommend scalp/root oiling by default for oily, flaky, irritated, painful, or buildup-prone scalps. Instead: pause, simplify, cleanse/reset, or safety-route depending on symptoms.
- Do not treat ordinary oil as heat protection unless product metadata explicitly supports heat use.
- Do not use oil as the before-heat safety step when metadata does not support heat protection; instead recommend a product with explicit heat-protectant claim before heat and keep oil as finish/after styling or pre-wash length protection.
