# AgentV2 Category Guidance Standard

Use this standard when rewriting `data/agent-v2/guidance/categories/*.md` and `*.json` for the GPT-5.4 Responses migration.

## Core Principle

The category markdown teaches the agent how to interpret, explain, and stay inside boundaries. It is not a hidden product database.

- Model: semantic interpretation, relevance judgment, one useful follow-up, and German explanation.
- Tools/catalog: product IDs, availability, category membership, lifecycle, usage protocol, cadence, product-specific claims, and profile facts.
- Code/validators: required tools, grounding, safety, product count, terminal-contract consistency, and side-effect permission.

## Request Interpretation Boundary

`request_interpretation` is terminal accountability, not the retrieval taxonomy and not a pre-router. It tells validators what the agent understood and lets them check whether tool calls, loaded guidance, product counts, answer mode, routine intent, evidence, and final payload are consistent.

Treat `request_interpretation.care_category` as the primary product category involved in product, routine, or category-guidance accountability. It is not the general topic of the conversation.

Use `care_category: none` when there is no single primary accountability category. This includes broad concerns, broad goals, technique or usage questions, and balanced category comparisons such as "Maske oder Conditioner?".

`care_category: none` does not mean no category guidance was loaded. It means the terminal answer should not pretend one category won before the comparison or broad reasoning happened. Use `care_category: unknown` only when a product/category focus seems present but cannot be resolved confidently.

The agent may load multiple category guidance packages for reasoning through `load_advisor_guidance.categories`, for example conditioner plus mask or shampoo plus deep-cleansing shampoo. The final `request_interpretation.care_category` stays singular because it represents the primary product-category accountability for the terminal answer, not every package that influenced reasoning.

When a concrete product tool is used, `request_interpretation.care_category` must match the product category used in `select_products`. When routine tooling uses a requested category, it must match unless the interpretation is `none` or `unknown`.

## Migration Ownership Rules

Migrate legacy context category-first.

1. If a legacy source changes one category's behavior, place the distilled rule in that category.
2. If it changes several concrete categories, duplicate the distilled category-relevant rule into each category.
3. Do not duplicate the whole legacy source. Duplicate only the operational value.
4. Only after category ownership is exhausted, place true leftovers into broader base guidance.
5. Safety hard boundaries go into `base.safety_boundaries.v1`, with short category-local reminders where the risk commonly appears.
6. Product facts, exact claims, lifecycle, availability, compatibility, cadence, and protocol stay in tools/catalog metadata.

Purposeful duplication is expected. For example, "length moisture/support matters for conditioner, leave-in, and mask" should appear in all three category packages because it changes each category's behavior. Duplicate only the distilled operational rule, not the full prose, examples, or old file structure.

## Source Anchor Rule

Every new operational rule added during the migration must trace to either:

- a legacy source path captured in `docs/agent-v2-guidance-migration/source-map.md`, or
- this guidance standard.

If a rule has no source anchor, do not add it to category/base guidance during the migration. Capture it as an open review item instead.

## Base General Advice Scope

Keep goals and concerns inside `base.general_advice.v1` for now, but keep them as separate sections.

- `Concern Logic`: problem interpretation such as dryness, frizz, tangling, breakage, oily roots, buildup clues, sensitivity, and flat/coated feel.
- `Goal Logic`: desired outcomes such as shine, softness, definition, volume, lower maintenance, smoother feel, and less weight.
- `Category Comparison`: balanced category education without forcing a single `care_category`.
- `Usage And Application`: dosage, placement, order, cadence, and technique.
- `Technique Logic`: CWC/OWC, detangling, sectioning, low-friction handling, and similar broad care methods.

`base.general_advice.v1` should be broadly loaded for `general_advice`, `product_recommendation`, and `routine` turns so product and routine answers stay connected to the user's goals and concerns. Keep the content concise enough that it does not dilute category-specific guidance.

## Legacy Archive Rule

During migration, keep `data/agent-guidance/**` as source material. After all category/base guidance is transformed and verified, archive legacy guidance and migration review docs in a follow-up cleanup. Do not delete the audit trail as part of the main transformation.

## Product Fact Rule

Examples may appear only to explain category boundaries, common confusions, or technology lanes.

Do not recommend, rank, compare, show cards for, or make product-specific claims about example products unless `select_products` or curated product metadata returned the product, category membership, lifecycle status, supported claims, and usage protocol.

## Permission Matrix

| Action | Model can decide? | Required grounding |
|---|---:|---|
| Explain category | yes | none |
| Assess relevance | yes | profile if available |
| Ask one follow-up | yes | none |
| Recommend category type | yes | profile/category guidance |
| Recommend concrete products | semantically yes | `select_products` |
| Compare concrete products | semantically yes | `select_products` or catalog/product metadata |
| Give exact cadence/protocol | no from guidance alone | product protocol metadata |
| Build unsaved routine | semantically yes | `build_or_fix_routine` |
| Mutate saved routine | only with explicit user intent | routine mutation tooling |
| Safety redirect | yes, must do when triggered | safety guidance and validator |
| Medical/scalp diagnosis | no | never diagnose |

## Feedback-Round Carry-Forward Rules

The shampoo/conditioner/leave-in/mask review added these rules for every remaining category.

Use only schema-supported terminal values in examples. Do not invent hook labels such as `category_assessment`, `category_comparison`, `product_comparison`, `routine_guidance`, `add_step`, `replace_step`, `change_step`, or `suspected_trigger_category` unless the contract later adds them. Use the current terminal contract:

- `primary_intent`: `category_education`, `product_recommendation`, `routine_explanation`, `routine_mutation`, `general_advice`, `safety_boundary`, etc.
- `product_request_kind`: `none`, `category_education`, `specific_products`, `compare_products`, or `product_detail`.
- `routine_intent`: `none`, `modify`, `remove_step`, `replace_product`, `explain`, `summarize`, etc.
- `care_category`: one primary category, `none`, or `unknown`.

Disambiguate type/kind questions from concrete product asks:

- "Welche Art von [category]..." means category education and no unasked product cards.
- "Welches/welche [category] passt...", "Nenn mir zwei...", and "Empfiehl mir..." mean concrete product recommendation and require `select_products`.

Add product-detail hooks to every category:

- named product or specific claim checks use `product_request_kind: product_detail`
- product metadata or `select_products` is required before product-specific claims
- do not infer claims from product names, brand lines, marketing families, or category prose

Split routine placement from routine mutation:

- "Where/how/when does this fit in a routine?" uses `primary_intent: routine_explanation`, `routine_intent: none`, and no routine tool unless current routine state is needed.
- "Add/remove/replace/change this in my saved/current routine" uses `primary_intent: routine_mutation` and requires `build_or_fix_routine`.

Use `care_category: none` for safety-boundary answers. If the user links symptoms to a product/category, preserve that trigger in the evidence quote or safety wording; do not add unsupported fields.

Keep exact cadence, timing, temperature, compatibility, scalp use, protocol, and product-specific role claims grounded in product metadata. Category prose may give flexible general language only.

## Markdown Template

```markdown
# [Category Name]

## Role In Hair Concierge
[What this category helps with.]
[What this category is not for.]

## Use When
- [Signal 1]
- [Signal 2]
- [Signal 3]

## Best Fit
- [Strong case 1]
- [Strong case 2]

## Weak Fit / Not The Best Lever
- [Weak case 1]
- [Weak case 2]
- [Cases that should route to another topic or safety boundary]

## Realistic Benefit
[Plain explanation of what this can and cannot do.]

## Category Boundaries
[What belongs.]
[What does not belong.]
[Common misleading labels, formats, or look-alikes.]

## Agent Interpretation Hooks
If the user asks for general explanation:
- primary_intent: category_education
- product_request_kind: category_education
- care_category: [category]
- requires_tool: false
- do_not_show_unasked_product_cards: true

If the user asks whether this category is relevant:
- primary_intent: general_advice
- product_request_kind: none
- care_category: [category]
- requires_tool: false unless product-specific

If the user asks for a type/kind of this category, not concrete products:
- primary_intent: category_education
- product_request_kind: category_education
- care_category: [category]
- requires_tool: false
- do_not_show_unasked_product_cards: true

If the user asks for concrete products:
- primary_intent: product_recommendation
- product_request_kind: specific_products
- care_category: [category]
- requires_tool: select_products

If the user asks for a requested number of products:
- primary_intent: product_recommendation
- product_request_kind: specific_products
- care_category: [category]
- requested_product_count: parsed number
- count_policy: exact
- requires_tool: select_products

If the user asks about a named product or product-specific claim:
- primary_intent: product_recommendation
- product_request_kind: product_detail
- care_category: [category]
- requires_tool: product catalog data or select_products
- do_not_infer_from_name_or_brand_line: true

If the user asks to compare concrete products:
- primary_intent: product_recommendation
- product_request_kind: compare_products
- care_category: [category]
- requires_tool: select_products or product catalog data

If the user asks where or how this category belongs in a routine, without asking to change a saved/current routine:
- primary_intent: routine_explanation
- product_request_kind: category_education
- routine_intent: none
- care_category: [category]
- requires_tool: false unless current routine state is needed

If the user asks to add, remove, replace, or change a saved/current routine step:
- primary_intent: routine_mutation
- product_request_kind: none
- routine_intent: modify, remove_step, or replace_product based on the request
- care_category: [category]
- requires_tool: build_or_fix_routine

If safety symptoms appear:
- primary_intent: safety_boundary
- product_request_kind: none
- care_category: none
- requires_tool: false
- preserve suspected trigger in evidence/safety wording when the user links symptoms to this category

If the user asks a broad concern or technique question without a product-category focus:
- primary_intent: general_advice
- product_request_kind: none
- care_category: none
- requires_tool: false unless routine or product-specific

## Agent May Decide
- Whether this category sounds relevant, optional, or weak fit.
- Whether the user asks for education, relevance assessment, concrete products, comparison, routine help, or safety handling.
- Whether one clarifying question would materially improve the answer.
- Which non-product care direction is more appropriate when this category is not the best lever.
- How to phrase the explanation in customer-facing German.

## Code And Tools Decide
- Concrete product IDs.
- Product category membership.
- Availability.
- Recommendation order.
- Product lifecycle.
- Exact usage protocol.
- Exact cadence.
- Product-specific claims.
- Profile fields.
- Saved routine state and routine mutations.

## Required Grounding
Use `select_products` before naming concrete products as recommendations.
Use product metadata before giving exact timing, cadence, compatibility, lifecycle, or product-specific claims.
Use routine tooling before creating or changing a routine.

## Missing Required Data
Ask at most one follow-up if missing information would materially change:
- whether this category is relevant
- whether product recommendation is safe
- which care lever is best
- whether routine mutation is appropriate
- whether safety redirect is needed

Do not ask a follow-up if a safe, useful general answer is possible.

## Safety Boundary
Escalate away from cosmetic advice when the user reports:
- scalp pain
- burning
- significant irritation
- unusual shedding
- patchy hair loss
- chemical-burn-like symptoms
- medically adjacent symptoms

In those cases, suggest stopping the suspected trigger and getting professional evaluation. Do not diagnose.

## German Answer Shape
Start with the practical judgment.
Explain the reason simply.
State realistic benefit.
Mention product recommendations only when concrete product selection is requested and grounded.
Use customer-facing terms, not internal labels.

## Do Not
- Do not [forbidden claim or action].
- Do not [wrong category mapping].
- Do not [ungrounded product behavior].
- Do not [safety mistake].
- Do not [overgeneralization].

## Eval Cases
User: "[category education prompt in German]"
Expected:
- primary_intent: category_education
- product_request_kind: category_education
- care_category: [category]
- required_tool: none
- must_not_show_unasked_product_cards: true

User: "[concrete product prompt in German]"
Expected:
- primary_intent: product_recommendation
- product_request_kind: specific_products
- care_category: [category]
- required_tool: select_products

User: "[safety prompt in German]"
Expected:
- primary_intent: safety_boundary
- product_request_kind: none
- care_category: none
- must_not_recommend_more_products: true
```

## JSON Template

```json
{
  "package_id": "category.[category_id].v1",
  "version": 1,
  "scope": {
    "answer_modes": ["product_recommendation", "routine", "general_advice", "constraint_blocked"],
    "categories": ["[category_id]"],
    "routine_layers": ["[layer]"],
    "safety_modes": ["normal", "restricted"]
  },
  "hard_rules": [
    {
      "rule_id": "category.[category_id].[rule_slug]",
      "severity": "block",
      "source": "categories/[file].md",
      "message": "[One enforceable prohibition or requirement.]"
    }
  ],
  "soft_rubrics": [
    {
      "rubric_id": "category.[category_id].[rubric_slug]",
      "priority": "high",
      "source": "categories/[file].md",
      "message": "[One trace-reviewable quality expectation.]"
    }
  ],
  "required_grounding": [
    {
      "grounding_id": "category.[category_id].product_and_protocol_claims",
      "tool": "select_products",
      "when": "Before naming, recommending, ranking, comparing, showing cards for, or making product-specific claims."
    }
  ],
  "ask_when": [
    {
      "condition": "[Missing information that materially changes the answer.]",
      "question_policy": "Ask one concise follow-up only if the answer would change category fit, safety, product recommendation, or routine mutation."
    }
  ],
  "markdown_path": "categories/[file].md"
}
```

## Category Migration Checklist

For each category:

1. Read the current AgentV2 markdown/JSON pair.
2. Read the legacy source folder named in `AGENT_V2_CATEGORY_SOURCE_DIRS`.
3. Transfer stable category reasoning into markdown.
4. Transfer only enforceable or reviewable behavior into JSON.
5. Add interpretation hooks for education, relevance assessment, concrete products, product count, comparison, routine mutation, and safety.
6. Add `Code And Tools Decide` and `Required Grounding` blocks.
7. Add one-follow-up policy.
8. Add safety boundary close to the topic.
9. Add Do Not rules.
10. Add 5 to 8 eval cases per category.
11. Update static tests so the package cannot regress to the thin shape.

## Per-Category Notes

- Shampoo: separate scalp/root cleansing from length goals; do not make shampoo solve dry lengths, frizz, shine, hair loss, or medical scalp symptoms.
- Conditioner: preserve baseline rinse-out length care; avoid scalp/root-oil treatment claims; distinguish concrete "Welche Spuelung passt..." from category education.
- Leave-in: keep it a leave-on booster/simplifier; heat protection needs product metadata; replacement of conditioner requires product and context support.
- Mask: position as periodic extra care, not daily baseline or structural repair; exact cadence and protein/moisture claims need product metadata.
- Oil: separate finishing serum, pre-wash length protection, and scalp oiling; do not promise growth, repair, or scalp treatment.
- Deep-cleansing shampoo: keep clarifying, chelating, and scalp-exfoliation lanes separate; reset support is not baseline shampoo, structural repair, or medical treatment.
- Dry shampoo: temporary freshness bridge only; does not clean scalp and should not be layered indefinitely.
- Peeling: tolerant-scalp buildup/oily-root support only; irritation, pain, persistent flakes, or inflammation should trigger safety boundaries.
- Bondbuilder: use the pilot as reference; add any missing permission/eval sections during final standardization.
