# Conditioner

## Role In Hair Concierge
Conditioner is the rinse-out baseline and length-care anchor after shampoo. It supports slip, surface feel, softness, reduced friction, detangling support, and care balance in lengths and ends.

It is not scalp cleansing, scalp treatment, root-oil control, structural repair, or a permanent split-end fix.

## Use When
Use for dryness, rough feel, tangling, friction, everyday softness, after-wash length care, routine-basics answers, conditioner product asks, or users comparing conditioner against masks, leave-ins, shampoos, or oils.

## Best Fit
- routine basics after shampoo
- dry-feeling, rough, tangled, or friction-prone lengths and ends
- frizz or surface-feel concerns where everyday length care is missing or too weak
- users comparing conditioner against a mask and needing the baseline step first
- users whose shampoo cleans the scalp well but leaves lengths feeling dry
- users who need the right conditioner type, weight, and care direction before choosing products

## Weak Fit / Not The Best Lever
- scalp cleansing, scalp treatment, or root oil management
- structural repair or permanent split-end repair promises
- users who already have an effective conditioner and need a specific booster, styling prep, reset, or finish instead
- strong buildup, residue, coated feel, or root oil issues where cleansing/reset guidance is more central
- balanced category comparisons where conditioner is one equal side rather than the central category

## Realistic Benefit
Conditioner can make lengths feel softer, smoother, easier to detangle, and less friction-prone. It can temporarily make split ends feel smoother, but it cannot permanently repair split ends or reverse structural damage.

Dry lengths are not automatically dry scalp. Keep the route separate: shampoo usually addresses scalp and roots, while conditioner addresses mid-lengths and ends.

## Category Boundaries
- Conditioner is for lengths and ends, not scalp.
- Shampoo cleanses the scalp and roots. Conditioner is usually the stronger lever for softness, slip, dry lengths, and less friction after washing.
- Mask is periodic extra care. Conditioner is the everyday baseline when after-wash length care is missing.
- Leave-in is a booster or simplification candidate, specifically a leave-on booster. It replaces conditioner only when selected product data and the user's context support that role.
- Oil is optional finish, sealing, or pre-wash protection. It is not the everyday rinse-out conditioning baseline.
- Co-washing, cleansing conditioners, CWC, and OWC are technique or cleanser-lane topics, not the same as normal conditioner after shampoo.

Balanced category comparisons should not force one central category in `request_interpretation`. For "Maske oder Conditioner?" or "Conditioner oder Leave-in?", compare both fairly, load both relevant category packages, and use `care_category: none` unless the user clearly made conditioner the main subject or asks for concrete conditioner products.

## Fit And Placement Logic
Conditioner fit is shaped mainly by hair thickness, weight sensitivity, length dryness, texture needs, and protein/moisture balance.

For fine hair or low density, use light-to-medium support, smaller amounts, and cautious placement away from the roots. Do not skip conditioner automatically: fine or low-density hair can still need length care; the adjustment is amount, weight, and placement.

For curly, coily, coarse, chemically treated, rough, or hard-to-detangle hair, the category can lean toward more slip and conditioning intensity when the profile and tool facts support it. Keep scalp and buildup risk in view.

Use protein/moisture balance as category-fit logic, not diagnosis. It helps explain the care direction for a conditioner: moisture-leaning support, protein/strength-supportive framing, or balanced support. Do not infer product-specific protein, moisture, or repair claims from product names.

## CWC/OWC Conditioner Logic
CWC/OWC belongs partly in conditioner guidance because it changes how conditioner can be used around shampoo.

If shampoo works for scalp cleansing but dries the lengths, conditioner before shampoo can protect lengths, and conditioner after shampoo remains the normal rinse-out care step. When mentioning CWC, explain it briefly in customer-facing German: `CWC heißt Conditioner-Shampoo-Conditioner: etwas Conditioner schützt die Längen vor dem Shampoo, danach pflegt Conditioner noch einmal gezielt.`

Keep this optional and response-based, not mandatory for every routine. OWC is the heavier oil-wash-conditioner route; keep it less default for fine, flat-prone, oily-root, low-density, or weight-sensitive hair unless dryness, porosity, curls/coils, coarser texture, damage, and buildup tolerance clearly support it.

The broader CWC/OWC technique logic stays in `base.general_advice.v1`; conditioner owns the local reason it matters for product and routine advice.

## Detangling Link
Conditioner can provide slip for detangling on lengths and ends. Deeper detangling and texture-handling instructions live in `base.general_advice.v1`.

## Agent May Decide
Explain whether conditioner is missing, underpowered, already enough, or the right baseline before recommending masks, leave-ins, oils, or CWC/OWC technique. Say the current routine already covers conditioner only when current routine context or routine tooling provides that state.

The agent may explain why hair thickness and protein/moisture balance matter for conditioner type. It may not turn that explanation into product-specific claims without tool data.

## Code And Tools Decide
Concrete conditioner products, product IDs, recommendation order, product weight, protein/moisture claims, supported claims, availability, lifecycle status, and exact protocol come from tools and catalog metadata.

## Required Grounding
Use `select_products` before naming concrete conditioner products as recommendations, comparing products, ranking options, or making product-specific claims.

Use product metadata before stating exact weight, balance, care intensity, protein/moisture role, compatibility, silicone-free or fragrance-free status, color-safe status, repair claims, cadence, or product-specific usage protocol.

## Product Grounding
Use selected product data for weight, balance, care intensity, protein/moisture framing, and fit. Do not infer claims from product names.

## Agent Interpretation Hooks
If the user asks what conditioner does:
  primary_intent: category_education
  product_request_kind: category_education
  care_category: conditioner
  requires_tool: false

If the user asks what type of conditioner fits them:
  primary_intent: category_education
  product_request_kind: category_education
  care_category: conditioner
  requires_tool: false unless concrete products are requested

If the user asks "Welche Art von Spülung..." or asks only about conditioner types, kinds, weight classes, or care direction:
  primary_intent: category_education
  product_request_kind: category_education
  care_category: conditioner
  requires_tool: false

If the user asks "Welche Spülung passt...", asks for options, asks how many products to choose, or requests a light conditioner recommendation:
  primary_intent: product_recommendation
  product_request_kind: specific_products
  care_category: conditioner
  requires_tool: select_products
  parse requested count from the user; if no count is requested, use the product recommendation default

If the user asks for concrete conditioner products:
  primary_intent: product_recommendation
  product_request_kind: specific_products
  care_category: conditioner
  requires_tool: select_products

If the user asks about a named conditioner, whether a conditioner is light or heavy, what protein/moisture role it has, whether it is color-safe, compatible with their needs, silicone-free, fragrance-free, repairing, or whether a product claim is true:
  primary_intent: product_recommendation
  product_request_kind: product_detail
  care_category: conditioner
  requires_tool: product catalog data or select_products
  do not infer from product name, brand line, marketing family, or category guidance alone

If the user asks where conditioner belongs in a routine or how to use it without asking to change a saved or current routine:
  primary_intent: routine_explanation
  routine_intent: none
  product_request_kind: category_education
  care_category: conditioner
  requires_tool: false unless current routine state is needed

If the user asks to add, remove, replace, or change conditioner in a saved or current routine:
  primary_intent: routine_mutation
  routine_intent: modify, remove_step, or replace_product based on the request
  care_category: conditioner
  requires_tool: build_or_fix_routine

If the user compares conditioner equally with another category:
  primary_intent: category_education
  product_request_kind: category_education
  care_category: none
  requires_tool: false unless concrete products are requested

If the user asks whether conditioner before shampoo helps dry lengths:
  primary_intent: category_education
  product_request_kind: category_education
  care_category: conditioner
  requires_tool: false unless concrete products are requested

If safety symptoms appear:
  primary_intent: safety_boundary
  product_request_kind: none
  care_category: none

## Missing Required Data
Ask at most one follow-up if hair thickness, weight sensitivity, active routine, wash frequency, protein/moisture direction, or the difference between dryness, damage, buildup, and scalp irritation would materially change the route. Do not ask if a safe general answer is possible.

For product recommendations, do not ask just for minor optimization when profile and catalog facts are enough.

## Constraint Conflicts
Do not make conditioner a scalp treatment or root-oil control step.

## Safety Boundary
If the user reports scalp burning, pain, significant irritation, swelling, unusual shedding, patchy hair loss, chemical-burn-like symptoms, or infection-like symptoms after conditioner, do not intensify product advice. Suggest stopping the suspected trigger and professional evaluation when symptoms are severe, unusual, or persistent. Do not diagnose. When the user links symptoms to conditioner, preserve conditioner as the suspected trigger in the evidence and safety wording without assigning a separate trigger category field.

## German Answer Shape
Start with the practical judgment: whether conditioner is the baseline, optional, already enough, or not the strongest lever.

Then explain simply:
1. what conditioner can realistically change
2. why placement is lengths and ends
3. how hair thickness and the balance between Feuchtigkeit und stärkender Pflege shape conditioner type
4. whether conditioner before shampoo for length protection, conditioner before and after shampoo, mask, leave-in, shampoo, or oil is the better adjacent lever
5. whether concrete product recommendations require product selection

Use customer-facing German. Do not expose internal profile labels like `thickness` or `protein_moisture_balance`. Do not expose raw CWC/OWC acronyms unless the user used them; explain the technique as Spülung vor dem Shampoo zum Schutz der Längen or Spülung vor und nach dem Shampoo. If CWC is named, include the short meaning and why it protects lengths.

## Do Not
- Do not promise permanent split-end repair, structural damage reversal, scalp treatment, or root-oil control.
- Do not skip conditioner automatically for fine or low-density hair.
- Do not make masks, oils, or leave-ins mandatory for every dry-length case.
- Do not treat CWC/OWC as mandatory or as co-washing.
- Do not infer product weight, protein/moisture role, repair claims, or usage protocol from product names.
- Do not recommend more products first when symptoms indicate a safety boundary.
