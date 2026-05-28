# AgentV2 Category Guidance Standardization Design

## Reader

This spec is for the engineer reworking the AgentV2 category guidance packages after the Bondbuilder pilot in the GPT-5.4 Responses migration worktree.

## User Situation

The Bondbuilder guidance pair now models the desired GPT-5.4 architecture: the model interprets the user request and explains the category, tools provide product and routine facts, and validators enforce grounding, safety, and terminal-contract consistency. The other category packages still use a thinner shape and need to be brought up to the same standard without changing deterministic product ranking or inventing a new runtime overlay system.

## Promised End-State

Every active AgentV2 product category guidance package follows one predictable contract-aware structure. The markdown teaches stable category reasoning, boundaries, interpretation hooks, safety, and German answer shape. The JSON encodes only enforceable hard rules, soft rubrics, required grounding, and one-follow-up policies. Concrete product truth, category membership, lifecycle, exact usage, cadence, and routine mutation remain owned by tools/catalog/code.

## Chosen Direction

Standardize the existing category packages in place:

- `data/agent-v2/guidance/categories/shampoo.md/.json`
- `data/agent-v2/guidance/categories/conditioner.md/.json`
- `data/agent-v2/guidance/categories/leave-in.md/.json`
- `data/agent-v2/guidance/categories/mask.md/.json`
- `data/agent-v2/guidance/categories/oil.md/.json`
- `data/agent-v2/guidance/categories/deep-cleansing-shampoo.md/.json`
- `data/agent-v2/guidance/categories/dry-shampoo.md/.json`
- `data/agent-v2/guidance/categories/peeling.md/.json`
- `data/agent-v2/guidance/categories/bondbuilder.md/.json`

Bondbuilder is the pilot reference, but the standardized shape should be slightly more explicit than the current Bondbuilder doc by adding a consistent permission block and eval cases to every category.

## Architecture Rule

Context docs are stable guidance, boundaries, interpretation hooks, and language shape.

Tools/catalog are product facts, profile facts, routine state, exact protocols, lifecycle, and availability.

Validators are consistency, grounding, product count, safety, and side-effect permission.

The model is semantic interpretation and user-facing explanation.

`request_interpretation` is terminal accountability, not the guidance retrieval taxonomy. It should stay compact and validator-readable. In the current schema, `request_interpretation.care_category` means the primary product category involved in product, routine, or category-guidance accountability; it does not mean every concern, technique, routine pattern, or safety topic in the conversation.

The model may load multiple category packages through `load_advisor_guidance.categories` when it needs them for reasoning. The terminal `request_interpretation.care_category` remains singular because validators use it to check the main product-category contract against tool calls, loaded guidance, and final payload.

## Permission Model

Each category doc should make semantic permissions explicit:

- explain category: model may do this without tools.
- assess relevance: model may say likely relevant, optional, or weak fit.
- ask one follow-up: model may ask only when the missing answer materially changes fit, safety, product selection, or routine mutation.
- recommend category type: model may suggest a care lane without naming products.
- recommend products: requires `select_products`.
- compare products: requires `select_products` or product/catalog grounding.
- give exact usage cadence: requires product protocol metadata.
- build or mutate routine: requires routine tooling and explicit user intent for mutation.
- safety redirect: model must stop product escalation when medically adjacent symptoms appear.

## Category Document Contract

Every product category markdown should include these sections in this order unless a category-specific reason is documented:

1. `# [Category Name]`
2. `## Role In Hair Concierge`
3. `## Use When`
4. `## Best Fit`
5. `## Weak Fit / Not The Best Lever`
6. `## Realistic Benefit`
7. `## Category Boundaries`
8. `## Agent Interpretation Hooks`
9. `## Agent May Decide`
10. `## Code And Tools Decide`
11. `## Required Grounding`
12. `## Missing Required Data`
13. `## Safety Boundary`
14. `## German Answer Shape`
15. `## Do Not`
16. `## Eval Cases`

Optional category-specific sections may appear before `Agent Interpretation Hooks` when they carry stable guidance that does not belong in product metadata, for example `## Variants`, `## Routine Placement`, `## Common Confusions`, or `## Evidence Framing`.

## Metadata Contract

Every category JSON package should keep the existing schema:

- `package_id`
- `version`
- `scope`
- `hard_rules`
- `soft_rubrics`
- `required_grounding`
- `ask_when`
- `markdown_path`

Use JSON for enforceable or trace-reviewable behavior, not prose duplication. Prefer three to six hard rules and three to six soft rubrics per category. Add `required_grounding` when product naming, ranking, product-specific claims, exact protocol, or comparison can appear in the category.

## Global Scope Boundaries

In scope:

- Rewriting category markdown and JSON guidance packages.
- Adding a reusable template/standard doc.
- Adding static compiler tests for the standardized shape.
- Adding eval prompts that check interpretation, tools, product-card permission, safety, and German answer behavior.

Out of scope:

- Changing product ranking.
- Changing product catalog or metadata schema.
- Adding new runtime category kinds such as concerns, routines, or safety packages.
- Implementing purchase, profile mutation, or account side effects.
- Re-researching external hair-care evidence unless a category contains medically adjacent or evidence-sensitive claims that are unresolved.

## Acceptance Criteria

- All active category docs follow the standard section contract or document a category-specific exception.
- No category markdown recommends, ranks, compares, shows cards for, or makes product-specific claims from examples alone.
- Category education prompts do not surface unasked product cards.
- Concrete product prompts require `select_products`.
- Routine change prompts require routine tooling.
- Broad concern or technique prompts use `request_interpretation.care_category: none` unless a product category is central to the answer.
- Product-tool answers keep `request_interpretation.care_category` aligned with the `select_products` category.
- Multi-category reasoning is represented by loaded guidance package IDs, not by stuffing multiple topics into `request_interpretation.care_category`.
- Scalp pain, burning, significant irritation, unusual shedding, patchy loss, chemical-burn-like symptoms, and medical language route away from product escalation.
- Static tests prove every category package has interpretation hooks, grounding boundaries, safety boundaries, Do Not rules, and eval cases.
- Existing AgentV2 guidance compiler tests still pass.
