# Conditioner Pilot: Side-By-Side Migration Review

This is the shared review artifact before rewriting `category.conditioner.v1`.

Goal: preserve behavioral value from old context while compressing duplicate prose. The proposed destination uses the narrowest stable owner:

- conditioner-specific behavior goes into `category.conditioner.v1`
- rules shared by only a few concrete categories are duplicated into those categories
- broad cross-category guidance goes into `base.general_advice.v1`
- safety hard boundaries go into `base.safety_boundaries.v1`
- product facts, cadence, exact claims, and compatibility stay in tools/catalog metadata

## Current Conditioner Package Snapshot

Current `data/agent-v2/guidance/categories/conditioner.md` already preserves:

- conditioner as the rinse-out baseline after shampoo
- lengths-and-ends placement, not scalp
- slip, softness, surface feel, and friction reduction
- weak fit for root oil, scalp treatment, structural repair, and permanent split-end repair
- baseline-before-mask/leave-in/oil framing
- product grounding for concrete recommendations

Likely missing or under-compressed:

- sectioning and enough saturation for textured/coily hair
- fine and low-density amount/placement nuance
- conditioner as primary detangling lever, including timing and process
- stronger “dry lengths are not dry scalp” route
- mechanical stress handling before extra products
- protein/moisture as directional care signal, not hard diagnosis
- explicit adjacent-category boundaries for shampoo, leave-in, mask, and oil
- eval cases that catch these losses

## Conditioner-Owned Topic Files

| Source | Extracted Value | Proposed Destination | Decision | Rationale |
|---|---|---|---|---|
| `topics/conditioner/core-fit.md` | Conditioner is the default rinse-out baseline and length-care anchor after washing; supports slip, softness, surface feel, reduced friction, and care balance in lengths/ends. | `category.conditioner.v1` | Keep, compressed | This is the category identity and should remain central. Current doc mostly has it. |
| `topics/conditioner/core-fit.md` | Runtime variables: `profile.thickness`, `profile.hair_texture`, `profile.concerns`, `profile.protein_moisture_balance`, `current_routine_products`. | `category.conditioner.v1` as interpretation/fit inputs; exact profile values from runtime context | Keep, compressed | These are not product facts, but they tell the agent what evidence matters. |
| `topics/conditioner/core-fit.md` | Decision axes: `weight_tolerance`, `care_balance`, `placement`, `baseline_gap`. | `category.conditioner.v1` | Keep, stronger | Current doc mentions weight and care intensity, but the four axes are a useful internal checklist. |
| `topics/conditioner/core-fit.md` | Fine hair needs lighter weight and careful placement; wavy/curly/coarse/treated/rough hair may need more slip and conditioning intensity. | `category.conditioner.v1` | Keep, enriched | This preserves personalization without requiring product facts. Exact products still require tools. |
| `topics/conditioner/core-fit.md` | Protein-sensitive or overloaded-feeling hair needs conservative protein wording. | `category.conditioner.v1`; product-specific protein claims in catalog/tools | Keep, bounded | Useful as answer framing, but should not become product claim invention. |
| `topics/conditioner/core-fit.md` | Compare conditioner against shampoo, leave-in, mask, and oil by user goal. | `category.conditioner.v1` plus adjacent category docs | Keep, enriched | This prevents wrong-category recommendations. Should be explicit in `Category Boundaries`. |
| `topics/conditioner/response-playbook.md` | Conceptual answers explain role/usage before products and avoid product names unless requested. | `category.conditioner.v1` and `base.product_recommendation.v1` | Keep, compressed | Fits the standard answer-shape and grounding model. |
| `topics/conditioner/response-playbook.md` | Product asks must call `select_products`; compare products as practical alternatives; use supported claims only. | `category.conditioner.v1` and existing product grounding rules | Keep, harden | This should be explicit in `Required Grounding` and evals. |
| `topics/conditioner/response-playbook.md` | Do not infer claims from product names. | `base.product_recommendation.v1`; short reminder in conditioner | Keep | Global product-truth rule, with local reminder because conditioner weight/protein claims are tempting. |

## Overlays Mapped To Conditioner

| Source | Extracted Value | Proposed Destination | Decision | Rationale |
|---|---|---|---|---|
| `overlays/coily-hair.md` | For coily hair, moisture retention, slip, sectioning, low-tension handling, and enough product distribution are baseline context. Short excerpt: "Technique usually matters as much as product choice." | `category.conditioner.v1`; broader handling in `base.general_advice.v1` | Keep, category-specific compression | Conditioner behavior changes: prioritize slip, saturation, sectioning, and distribution. |
| `overlays/coily-hair.md` | Be more open to richer conditioning for coily hair while still checking scalp and buildup risk. | `category.conditioner.v1` | Keep, bounded | Prevents over-light recommendations for coily hair, but avoids richness as automatic for everyone. |
| `overlays/coily-hair.md` | Avoid dry brushing/dry combing as default; reduce painful tension. | `base.general_advice.v1` plus conditioner detangling note | Partial transfer | Handling rule is general, but conditioner can mention detangling with slip. |
| `overlays/curly-hair.md` | Conditioner supports slip, detangling, clumping support, and friction reduction; placement and rinse-out amount matter. | `category.conditioner.v1` | Keep | This is directly conditioner-specific and currently underrepresented. |
| `overlays/curly-hair.md` | Technique-first for curl definition; do not assume curly hair automatically needs heavy masks or oils. | `base.general_advice.v1`; conditioner boundary against mask/oil escalation | Partial transfer | Mostly broad curl advice, but useful to keep conditioner from over-escalating. |
| `overlays/dry-lengths.md` | Dryness is a length/fibre signal, not automatically a scalp signal. Support mid-lengths and ends first. | `category.conditioner.v1` and `base.general_advice.v1` | Keep | Critical routing rule for conditioner vs shampoo/scalp. |
| `overlays/dry-lengths.md` | Conditioner is the primary everyday lever for slip, softness, and friction reduction on lengths and ends. | `category.conditioner.v1` | Keep, stronger | This is exactly the category value. |
| `overlays/dry-lengths.md` | Do not make oil, masks, or leave-in mandatory for every dry-length case; separate dryness from damage and buildup. | `category.conditioner.v1` and `base.general_advice.v1` | Keep | Prevents product-stack inflation and wrong escalation. |
| `overlays/fine-hair.md` | Fine hair is strand diameter, not automatically low density, damage, or low strength. | `base.general_advice.v1`; short conditioner note | Partial transfer | General profile vocabulary belongs in base, but conditioner needs the practical effect. |
| `overlays/fine-hair.md` | For conditioner: lightweight to medium support, mainly lengths and ends, cautious dosage near roots. | `category.conditioner.v1` | Keep | Directly changes conditioner selection and usage framing. |
| `overlays/fine-hair.md` | Fine hair can still be dry, curly, damaged, or color-treated; keep support targeted rather than absent. | `category.conditioner.v1` | Keep | Avoids the common error of under-conditioning fine hair. |
| `overlays/low-density-weight-sensitive.md` | Low density lowers total product capacity; adjust placement, amount, and layer count before assuming less care overall. | `category.conditioner.v1`; broad density distinction in `base.general_advice.v1` | Keep | Strong conditioner relevance: small amounts, end placement, avoid skipping conditioner automatically. |
| `overlays/low-density-weight-sensitive.md` | If user describes new shedding, widening part, bald spots, or sudden change, use hair-loss guardrail. | `base.safety_boundaries.v1`; local reminder only if density appears in conditioner context | Move to safety | Safety boundary should be centralized. |
| `overlays/mechanical-stress.md` | For tangles and breakage linked to handling, prioritize technique before product complexity. | `base.general_advice.v1`; conditioner note for slip and saturation | Keep | Prevents over-recommending more products when timing/tool/handling is the blocker. |
| `overlays/mechanical-stress.md` | Conditioner is important for slip and detangling; placement and enough saturation can matter more than product count. | `category.conditioner.v1` | Keep, stronger | This is a high-value behavior rule missing from the current compressed doc. |
| `overlays/mechanical-stress.md` | If conditioner or leave-in is already present, consider amount, timing, and tool choice before recommending another product. | `category.conditioner.v1`; adjacent leave-in too | Keep | Good example of duplicating a rule into two relevant categories instead of generalizing too much. |
| `overlays/tangling-detangling.md` | Treat tangling as friction, slip, surface-condition, and process signal. | `category.conditioner.v1` and `base.general_advice.v1` | Keep | Directly informs conditioner education and recommendation reasoning. |
| `overlays/tangling-detangling.md` | Conditioner is the primary detangling lever; emphasize saturation, slip, and mid-length/end placement. | `category.conditioner.v1` | Keep, hard | This should be a first-class conditioner rule. |
| `overlays/tangling-detangling.md` | Detangle with conditioner or leave-in slip, in sections, from ends upward; textured hair often safer damp/wet with slip than dry brushing. | `category.conditioner.v1`, `category.leave_in.v1`, and `base.general_advice.v1` | Keep, split | Conditioner owns rinse-out detangling; leave-in owns between-wash/leave-on slip; base owns general technique. |
| `overlays/protein-moisture-balance.md` | Stored balance is directional care signal, not a clinical diagnosis. | `base.general_advice.v1`; local conditioner note | Keep | Important anti-overclaim rule. |
| `overlays/protein-moisture-balance.md` | Conditioner can be relevant when balance direction is part of the category target; explain as length care, not diagnosis. | `category.conditioner.v1` | Keep | Keeps protein/moisture useful but bounded. |
| `overlays/protein-moisture-balance.md` | Do not overrule stored balance from frizz/generic dryness alone; do not infer protein/moisture claims from product names. | `category.conditioner.v1` and product grounding | Keep | Important for product recommendation integrity. |

## Adjacent Category Boundary Checks

| Adjacent Source | Boundary Value For Conditioner | Proposed Destination | Decision | Rationale |
|---|---|---|---|---|
| `topics/leave-in/core-fit.md` | Leave-in is a post-wash booster/simplification candidate; conditioner remains default rinse-out baseline. Replacement only when selected product data/context supports it. | `category.conditioner.v1` and `category.leave_in.v1` | Keep in both | This is a two-category confusion, not broad general advice. |
| `topics/leave-in/response-playbook.md` | For fine hair, leave-in should be light and sparing; it can be a third lever after shampoo and conditioner. | `category.leave_in.v1`; conditioner boundary only | Do not import full detail | Conditioner only needs to know leave-in is booster, not all leave-in usage logic. |
| `topics/mask/core-fit.md` | Mask is periodic extra care, not baseline; compare against conditioner when the user lacks after-wash length care. | `category.conditioner.v1` and `category.mask.v1` | Keep in both | Very important category boundary. |
| `topics/mask/response-playbook.md` | Mask cadence/application details: after shampoo, before conditioner, occasional, lengths/ends. | `category.mask.v1` | Do not import | Conditioner only needs the boundary, not mask protocol. |
| `topics/shampoo/core-fit.md` | Shampoo is scalp/root cleansing; dry lengths, frizz, shine, and split ends are often stronger conditioner/leave-in/mask territory. | `category.conditioner.v1` and `category.shampoo.v1` | Keep in both | Helps route dry-length requests away from shampoo-only answers. |
| `topics/shampoo/response-playbook.md` | If explicit shampoo ask has weak fit, answer the shampoo question but caveat that length-care categories may move the goal more. | `category.shampoo.v1`; maybe eval for conditioner | Do not import full detail | This is shampoo answer behavior. Conditioner can simply own the positive boundary. |
| `topics/hair-oiling/core-fit.md` | Oil is finish/tips, pre-wash protection, or cautious scalp comfort; not moisture replacement, structural repair, or split-end repair. | `category.conditioner.v1` boundary and `category.oil.v1` full logic | Keep boundary only | Conditioner should say oil is optional finish/seal, not the everyday conditioning baseline. |
| `topics/hair-oiling/response-playbook.md` | Pre-wash oiling protocol and wash-out technique. | `category.oil.v1` | Do not import | Not conditioner behavior. |

## Proposed Conditioner Doc Shape

The rewritten `category.conditioner.v1` should be richer than the current version, but still compact. Suggested sections:

1. Role In Hair Concierge
2. Use When
3. Best Fit
4. Weak Fit / Not The Best Lever
5. Realistic Benefit
6. Category Boundaries
7. Fit And Placement Logic
8. Detangling And Texture Logic
9. Agent Interpretation Hooks
10. Agent May Decide
11. Code And Tools Decide
12. Required Grounding
13. Missing Required Data
14. Safety Boundary
15. German Answer Shape
16. Do Not
17. Eval Cases

## Proposed High-Value Additions To Conditioner

These are the main additions that seem worth preserving from old sources:

- Treat conditioner as the primary everyday lever for dry lengths, slip, softness, friction, and detangling.
- State that dry lengths are not automatically dry scalp; conditioner belongs on mid-lengths and ends.
- Add fit logic for fine hair: light-to-medium support, smaller amounts, cautious root proximity, but do not skip conditioner automatically.
- Add fit logic for low density/weight sensitivity: reduce amount and layers before removing care.
- Add one local texture/detangling reminder: conditioner can provide slip for detangling, while the deeper detangling and texture-handling logic belongs in `base.general_advice.v1`.
- Add mechanical-stress logic only where it changes conditioner use: check amount, saturation, timing, and placement before adding more products.
- Add CWC/OWC conditioner technique logic: when shampoo feels good on the scalp but drying on lengths, conditioner can be used before washing to protect lengths and again after washing as the normal rinse-out care step.
- Add protein/moisture category-fit logic: conditioner selection is strongly shaped by hair thickness and protein/moisture balance, while exact product claims still require tooling.
- Add adjacent boundaries: conditioner vs leave-in, mask, shampoo, oil.

## Proposed Moves Out Of Conditioner

| Content | Destination | Reason |
|---|---|---|
| General distinction between fine hair and low density | `base.general_advice.v1` | Applies broadly across categories. Conditioner only needs practical implications. |
| Hair-loss/shedding red flags | `base.safety_boundaries.v1` | Safety hard boundary should be central and high-priority. |
| Full curl/coily routine and detangling technique | `base.general_advice.v1`; routine-specific sequences in `base.routine_building.v1` | Conditioner should keep only one sentence about conditioner providing slip for detangling. |
| Full mask cadence and protocol | `category.mask.v1` and product metadata | Conditioner only needs the boundary. |
| Full leave-in replacement/simplification logic | `category.leave_in.v1` and product metadata | Conditioner should mention replacement is not default and needs support. |
| Oil pre-wash/scalp protocol | `category.oil.v1` | Conditioner only needs oil-not-baseline boundary. |
| Product-specific weight/protein/moisture claims | product tooling/catalog metadata | Guidance can say what to look for, not assert claims. |

## Review Decisions From Pilot Discussion

1. Detangling and texture logic should mostly live in `base.general_advice.v1`.
   `category.conditioner.v1` should keep only the conditioner-specific implication: conditioner can provide slip for detangling, especially on lengths and ends.

2. Equal category comparisons do not need a single central `care_category`.
   If the user asks "Maske oder Conditioner?" or another balanced comparison, the agent should compare both categories fairly and then draw a practical conclusion. In those cases, `care_category` should be `none` unless the user clearly made one category the main subject or asks for concrete products in one category.

3. `category.conditioner.v1` should include CWC/OWC as a conditioner-relevant technique.
   The category doc should explain the core logic briefly: if shampoo works for scalp cleansing but dries lengths, applying a little conditioner before shampoo can protect lengths, and conditioner after shampoo remains the normal rinse-out care step. The broader CWC/OWC explanation can still live in `base.general_advice.v1`, but the conditioner-specific reason belongs locally because it affects conditioner recommendation logic.

4. Protein/moisture balance should stay in `category.conditioner.v1`.
   Conditioner recommendations are shaped heavily by hair thickness and protein/moisture balance. The category doc should explain why this relationship matters for choosing the right conditioner, without diving into ungrounded product-specific claims. Exact protein/moisture product fit still comes from `select_products` and product metadata.

## Candidate Eval Cases

These should become regression cases after the pilot rewrite.

```yaml
- user: "Meine Haare sind fein, aber die Laengen sind trocken. Soll ich Conditioner weglassen?"
  expected:
    primary_intent: category_assessment
    product_request_kind: none
    care_category: conditioner
    must_say: light-to-medium conditioner can still be useful on lengths/ends
    must_not: skip all conditioning because hair is fine

- user: "Ich habe Locken und komme nach dem Waschen kaum durch die Haare."
  expected:
    primary_intent: category_assessment
    product_request_kind: none
    care_category: conditioner
    must_say: conditioner can provide slip for detangling on lengths and ends
    must_load: base.general_advice.v1
    must_not: recommend dry brushing as default

- user: "Meine Spitzen sind trocken. Brauche ich Shampoo fuer Feuchtigkeit?"
  expected:
    primary_intent: category_assessment
    product_request_kind: none
    care_category: conditioner
    must_say: dry lengths are usually length-care, not scalp-cleansing problem
    must_not: make shampoo the main moisture lever

- user: "Ist eine Maske besser als Conditioner?"
  expected:
    primary_intent: category_comparison
    product_request_kind: none
    care_category: none
    must_load: category.conditioner.v1 and category.mask.v1
    must_say: conditioner is baseline, mask is occasional extra
    must_not: replace baseline conditioner with mask by default

- user: "Kann Leave-in meinen Conditioner ersetzen?"
  expected:
    primary_intent: category_comparison
    product_request_kind: none
    care_category: none
    must_load: category.conditioner.v1 and category.leave_in.v1
    must_say: only sometimes, when product data and routine context support it
    must_not: treat replacement as default

- user: "Shampoo passt fuer meine Kopfhaut, aber meine Laengen werden trocken. Hilft Conditioner davor?"
  expected:
    primary_intent: category_assessment
    product_request_kind: none
    care_category: conditioner
    must_say: conditioner before shampoo can protect lengths, conditioner after shampoo remains normal rinse-out care
    must_not: treat CWC/OWC as mandatory for every routine

- user: "Nenn mir zwei Conditioner fuer feines Haar."
  expected:
    primary_intent: product_recommendation
    product_request_kind: specific_products
    care_category: conditioner
    requested_product_count: 2
    required_tool: select_products
    must_not: infer product weight or protein claims from names alone

- user: "Warum ist Protein oder Feuchtigkeit bei Conditioner ueberhaupt wichtig?"
  expected:
    primary_intent: category_education
    product_request_kind: none
    care_category: conditioner
    must_say: thickness and protein/moisture balance help choose conditioner weight and care direction
    must_not: diagnose hair or make product-specific claims without tool data

- user: "Meine Kopfhaut brennt nach der Spuelung."
  expected:
    primary_intent: safety_redirect
    product_request_kind: none
    care_category: conditioner
    must_say: stop suspected trigger and seek professional evaluation if severe/persistent
    must_not: recommend more products as first move
```

## Open Review Questions

No open conditioner pilot questions remain from this review pass.

## Finalized Implementation

The conditioner pilot decisions were applied to:

- `data/agent-v2/guidance/categories/conditioner.md`
- `data/agent-v2/guidance/categories/conditioner.json`
- `data/agent-v2/guidance/base/general-advice.md`
- `data/agent-v2/guidance/base/general-advice.json`
- `data/agent-v2/evals/guidance-migration-regression.json`
- `tests/agent-v2-guidance-compiler.spec.ts`

The category now preserves the richer conditioner-specific value while keeping broader detangling and texture handling in `base.general_advice.v1`.
