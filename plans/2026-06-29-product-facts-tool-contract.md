# Product Facts Tool Contract Plan

## Goal

Make AgentV2 reliably answer follow-up questions about one resolved product, such as "passt das zu mir?", "wie oft?", or "soll ich es behalten?", by loading product facts for that exact product before composing the final answer.

## Chosen Direction

Add a separate agent-facing tool, tentatively `load_product_facts`, while reusing the existing backend product projection path that currently powers `select_products`.

Plain language:

- `lookup_product_candidate` identifies which product the user means.
- `load_product_facts` loads facts for one already-resolved product.
- `select_products` recommends or compares products.

This follows the OpenAI tool-design guidance to make tools obvious, intuitive, and named for the task the model should perform. The current `select_products` tool can technically serve one-product detail turns, but its name pulls the model toward recommendations and makes "load details for this exact product" less obvious.

## Non-Goals

- Do not build a second recommendation engine.
- Do not duplicate product ranking or product projection logic.
- Do not introduce new user-visible cards for product assessment answers.
- Do not loosen safety or product-intake unknown-product behavior.
- Do not make the app silently invent product facts when product projection data is unavailable.

## Current Problem

The selected product identity is persisted in conversation state, but the next turn only gives the model the identity. In the failing Syoss example, the model understood the active product and tried to answer as `product_assessment`, but it did not call `select_products`. The validator blocked the answer because no product projection facts were loaded, then the runtime fell back to hardcoded copy.

The product itself was present in the database and had `product_shampoo_specs`, so this is a tool-contract issue, not a data-missing issue.

## Target Behavior

### One Resolved Product

User: "Passt das zu mir?" after selecting a product.

Expected flow:

1. Active resolved product context provides `product_id`, name, and category.
2. Agent calls `load_product_facts` for a one-product assessment.
3. Backend injects the known `product_id` from trusted/active context when possible.
4. Tool internally reuses product projection logic with `targetProductIds`.
5. Agent composes a natural `product_assessment` answer using the returned facts.
6. Validator confirms the assessed product ID is grounded by product facts.

### Newly Named Product

User: "Was hältst du von meinem Jean & Len Conditioner?"

Expected flow:

1. Agent calls `lookup_product_candidate`.
2. If exact/resolved: agent calls `load_product_facts`.
3. If ambiguous: clarification card.
4. If not found: intake offer/card.

### Multiple Products Or Alternatives

User: "Welche Shampoos empfiehlst du?" or "Gibt es bessere Alternativen?"

Expected flow:

1. Agent calls `select_products`.
2. Final answer may include recommendation cards if the user asked for recommendations.

## Proposed Tool Contract

### `load_product_facts`

Purpose:

Load grounded catalog facts and profile-fit context for one resolved product so the assistant can answer product-specific questions.

Use when:

- The user asks whether a concrete product suits them.
- The user asks how often or how to use a resolved product.
- The user asks whether to keep, stop, or replace a resolved product.
- The user asks a product-specific property question and product identity is already known.

Do not use when:

- Product identity is ambiguous or missing. Use `lookup_product_candidate` first.
- User asks for broad recommendations or alternatives. Use `select_products`.
- User asks to compare multiple products. Use comparison/recommendation flow.

Parameters:

- `category`
- `reason`
- `user_request`
- `evidence_quote`

Backend behavior:

- Prefer a same-turn exact lookup result for the requested category.
- Else prefer `trustedSelectedProductContext.selected_product.id`.
- Else prefer `activeResolvedProductContext.product_id`.
- If exactly one resolved product target is unavailable, fail closed with no product facts instead of broad-searching the category.
- Reuse the existing `select_products` implementation with `targetProductIds` and `targetProductHints`.
- Return the same projection/fact shape used by `product_assessment` validation.

The agent-facing schema omits `product_id`; backend chooses the trusted/resolved product target. If multiple active resolved products are relevant and no current-turn exact lookup disambiguates them, the model should ask a clarification instead of guessing.

### `select_products`

Keep for recommendations, alternatives, and product comparisons. Its description should stop carrying one-product assessment responsibility except to say: for one resolved product detail, use `load_product_facts`.

## Runtime Changes

1. Add `load_product_facts` to `AgentV2RuntimeTools`.
2. Add a tool definition in `src/lib/agent-v2/tools/tool-definitions.ts`.
3. In `src/lib/agent-v2/production/chat-pipeline.ts`, implement `load_product_facts` as a wrapper around the existing selected-product projection path.
4. Record its result in the same `selectedProductResults` / `selectedProductProjections` arrays or a renamed shared facts array if the change stays small.
5. Include `load_product_facts` in tool-call trace summaries and observability.

## Prompt And Guidance Changes

1. Update AgentV2 terminal guidance:
   - `product_detail` and `product_assessment` require product facts.
   - If product identity is unresolved, call `lookup_product_candidate`.
   - If product identity is resolved and the user asks about fit, usage, frequency, or keeping it, call `load_product_facts`.
   - Use `select_products` only for recommendations, alternatives, or comparisons.
2. Update active resolved product context guidance so follow-up questions point to `load_product_facts`, not vague "product facts may be used" language.
3. Keep final wording model-owned. Do not use deterministic fixed German copy for normal resolved-product assessment.

## Validator And Repair Changes

1. Keep `product_assessment_grounding` as a fact-grounding guard.
2. Treat missing product facts for `product_assessment` as repairable.
3. Repair path should force `load_product_facts` when:
   - answer mode is `product_assessment`,
   - assessed product ID is resolved/trusted,
   - product facts are missing.
4. After tool output, the model must submit a new final answer.
5. Remove or demote the hardcoded active-resolved-product fit fallback. It should only be reachable if the facts tool fails in a technical way, and even then should not claim the database lacks properties.

## Pending Product Scope Patch

Patch existing pending-review logic so unrelated pending products in conversation state do not block a resolved product assessment.

Rule:

- Pending product blocks only when the latest user message or active selection context points to that pending product.
- A resolved product with loaded facts should not be blocked because another old pending product exists in the conversation state.

## Tests

Add or update tests in:

- `tests/agent-v2-responses-runtime.spec.ts`
- `tests/agent-v2-production-chat-pipeline.spec.ts`
- `tests/agent-v2-final-answer-validator.spec.ts`
- `tests/agent-v2-product-selection.spec.ts`

Required coverage:

- Tool list includes `load_product_facts` and descriptions distinguish it from `select_products`.
- Resolved product follow-up "passt das zu mir?" calls `load_product_facts`.
- Runtime repair turns a missing product-facts validation failure into a `load_product_facts` call.
- Product assessment passes after `load_product_facts` returns matching projection facts.
- `select_products` remains the tool for broad recommendations and alternatives.
- Unrelated pending products do not block resolved product assessment.
- The old hardcoded "ohne weitere Produkteigenschaften" fallback is not emitted for resolved products with facts.

## Verification

Run targeted checks:

```bash
npx tsx --test tests/agent-v2-responses-runtime.spec.ts
npx tsx --test tests/agent-v2-production-chat-pipeline.spec.ts
npx tsx --test tests/agent-v2-final-answer-validator.spec.ts
npx tsx --test tests/agent-v2-product-selection.spec.ts
```

Then run:

```bash
npm run typecheck
```

If targeted tests pass and the local server is running, smoke test:

1. Select a known product from clarification card.
2. Ask "passt das zu mir?"
3. Confirm the trace shows `load_product_facts`.
4. Confirm the answer uses the selected product and does not show intake/recommendation cards unless requested.

## Decisions To Confirm

1. Tool name:
   - Recommended: `load_product_facts`
   - Alternative: `load_product_assessment_facts`

2. Product ID argument:
   - Recommended: backend injects the active resolved product ID; schema does not require the model to pass it.
   - Alternative: allow optional `product_id` when the model has an explicit verified ID.

3. Multiple active resolved products:
   - Recommended: if latest message is referential and more than one active resolved product could fit, ask a clarification instead of guessing.
   - Alternative: choose the most recent active resolved product.

## Recommended Defaults

Use `load_product_facts`, let backend inject the known ID where possible, and ask a clarification only when multiple active resolved products are genuinely plausible.

## Implementation Status

- [x] Added `load_product_facts` as a distinct AgentV2 tool.
- [x] Kept `product_id` out of the public tool schema and inject product identity in the backend.
- [x] Routed product-assessment repair through `load_product_facts`.
- [x] Added production/runtime/validator coverage for resolved product follow-ups.
- [x] Patched review finding: `load_product_facts` is one-product-or-nothing and no longer falls back to broad category selection without a resolved target.
- [x] Patched trace clarity: product-facts projections now report `tool_name: "load_product_facts"`.
- [x] Demoted the emergency fallback copy so it no longer claims a technical outage as the only reason.
