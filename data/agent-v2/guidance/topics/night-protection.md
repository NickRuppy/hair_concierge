# Night Protection

## Role In Hair Concierge
Night protection is a low-friction behavior lever for sleep. It can reduce overnight rubbing and tangling, help waves/curls keep their shape, and make morning hair less disrupted. It is not repair, not split-end reversal, not hair-growth support, and not medical scalp care.

Use this topic for sleep-friction advice, satin or silk pillowcases, bonnets, loose night hairstyles, pineapple, HairHOMIE, or similar length/tip accessories.

## Use When
- The user asks about sleeping with hair, Nachtschutz, Schlaffrisur, satin/silk pillowcases, bonnets, pineapple, HairHOMIE, or hair accessories for the night.
- The profile has `night_protection: []` and the user describes morning tangles, frizz, rough ends, flattened curls, or friction-like breakage.
- The user asks which night-protection option fits their hair, whether the current option is enough, or whether to combine options.
- The user has long or very long hair and specifically struggles with tangled lengths or ends after sleeping.

## Realistic Benefit
Frame the benefit as friction reduction, containment, easier morning detangling, and style preservation. Keep claims observational and conservative.

Do not say night protection repairs damage, prevents all breakage, fixes split ends, stops shedding, prevents hair loss, or makes hair grow. If the user reports sudden shedding, patchy loss, scalp pain, inflammation, wounds, pustules, or persistent flakes, route to safety guidance rather than night-accessory advice.

## Option Fit Logic
Satin or silk pillowcase:
- Good passive baseline for most users, especially if they dislike headwear.
- Combines well with bonnet, pineapple, loose tie, or a length/tip accessory.
- Useful when the main issue is friction against the pillow surface.

Bonnet or silk/satin cap:
- Best when the user wants broader containment, curl preservation, or less pillow friction across more of the hair.
- Often relevant for curly/coily hair or defined styles.
- Fit must be comfortable, non-tight, and not pulling at the hairline.

Loose tied hair:
- Best for medium to very long hair that tangles when left fully loose.
- Use a soft scrunchie or gentle tie and low tension.
- Avoid tight roots, tight elastics, and styles that pull at the hairline.

Pineapple:
- Best for wavy/curly medium-long to long hair when the goal is curl or volume preservation.
- Keep it loose and high, with a soft tie.
- Not ideal if it pulls at the hairline, distorts the curl pattern, or flattens roots for that user.

Length/tip accessory, including HairHOMIE-like options:
- Best for long to very long hair when the problem is tangled lengths or stressed ends rather than the scalp/crown.
- Treat HairHOMIE as a named example of a length/tip accessory unless the user asks about the exact product.
- Can combine with a satin/silk pillowcase or loose tie when comfortable.
- Do not claim product-specific material, fit, durability, exact usage, or outcomes unless grounded in product/vendor context.

## Recommendation Logic
If `night_protection: []` combines with morning tangles, frizz, rough ends, flattened curls, friction-like breakage, long hair, or a matching full-routine context, recommend adding one low-friction night option. Choose the lowest-friction, lowest-burden fit from the user's hair length, texture, comfort preferences, and current routine.

If `night_protection: null`, treat it as legacy or missing state, not as a user saying they use no protection. Ask one concise follow-up when the answer depends on it, or answer conditionally: "Falls du nachts noch nichts nutzt..."

If the user already has one or more options selected, do not automatically stack more. First optimize what they already do: tension, fit, material, placement, and whether the option matches their length/texture problem.

Night-protection options can be combined. Pillowcase plus bonnet, pillowcase plus pineapple, or pillowcase plus length/tip accessory may be reasonable when each step solves a distinct comfort or friction issue. Do not make combination routines sound mandatory.

## Proactive Routine Triggers
Treat `night_protection: []` as the meaningful "no night protection" signal. In completed onboarding, `night_protection: null` is legacy/missing state, not a normal user choice.

Mention night protection proactively when `night_protection: []` combines with at least one of:
- breakage, split ends, hair damage, tangling, frizz, rough ends, or morning tangles
- goals such as less_frizz, curl_definition, healthier_hair, anti_breakage, strengthen, or less_split_ends
- long or very long hair where lengths or ends tangle overnight
- a full routine request where behavior guardrails are appropriate

Do not derail unrelated product-detail answers with night protection unless the user's problem framing is about mechanical friction, sleep, morning frizz, curl collapse, tangling, or breakage.

## Agent Interpretation Hooks
If the user asks why night protection matters:
- primary_intent: general_advice
- product_request_kind: none
- care_category: none
- requires_tool: false
- answer with low-friction and style-preservation framing, not repair or growth claims

If the user asks which night protection option fits:
- primary_intent: general_advice
- product_request_kind: none
- care_category: none
- requires_tool: false unless concrete products are requested
- load_advisor_guidance topics: night_protection
- decide between pillowcase, bonnet, loose tie, pineapple, or length/tip accessory using length, texture, tangling/frizz pattern, and comfort

If the user asks about HairHOMIE as a concept:
- primary_intent: general_advice
- product_request_kind: none
- care_category: none
- requires_tool: false unless exact product claims are requested
- frame it as a length/tip accessory for long hair, not a universal replacement for bonnet or pillowcase

If the user asks whether HairHOMIE itself works, what it is made of, how to use it exactly, or whether it delivers a specific claim:
- primary_intent: product_recommendation or general_advice depending on the product-specific ask
- product_request_kind: product_detail when exact named-product claims matter
- requires_tool: product/vendor context if available
- do_not_infer_from_name_or_brand_line: true

If the user asks to add or change saved routine/profile night protection:
- primary_intent: routine_mutation or profile_update depending on available tool surface
- requires_tool: the relevant routine/profile mutation tool
- do not claim saved state changed unless tooling confirms it

## Agent May Decide
- Whether night protection is relevant enough to mention.
- Which option is the lowest-burden fit.
- Whether the user's existing option should be optimized instead of adding another.
- Whether one follow-up is needed for length, texture, comfort, or current night habit.
- How to phrase the final German advice in plain, low-pressure language.

## Code And Tools Decide
- Saved `night_protection` enum values and profile persistence.
- Whether multi-select state is present, missing, or changed.
- Concrete product IDs, catalog claims, availability, price, material, and exact product usage.
- Routine mutation or profile update side effects.

## Required Grounding
Use product/vendor context before making exact claims about HairHOMIE or another named product's material, fit, dimensions, availability, price, or promised outcomes.

Use routine/profile tooling before claiming that a selected night-protection option was saved, removed, or changed.

## Missing Required Data
Ask at most one follow-up if the best option depends on unknown hair length, texture, the current night habit, or comfort with headwear.

If the user has long hair and names tangled ends after sleeping, a length/tip accessory can be suggested without a follow-up, with a soft caveat that a satin/silk pillowcase remains a passive baseline.

## Safety Boundary
Do not route shedding, patchy loss, painful scalp, inflamed scalp, wounds, pustules, or persistent flakes into night-protection optimization. Keep night protection cosmetic and behavioral.
