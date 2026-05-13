# Agentic Consultant Rendering And Conceptual Guard Design

**Status:** Approved for a Compare Lab iteration. Not approved for production chat wiring.

**Reader:** Engineers improving the `tool_loop` Compare Lab prototype after Agentic Consultation Brief V1.

**Promised end-state:** `tool_loop` with `Beratungsbrief` keeps its better multi-turn/tool-choice behavior while sounding more like a knowledgeable advisor on broad routine and product answers, and it no longer jumps to product recommendations for conceptual category curiosity.

## Source Feedback

Recent Compare Lab feedback showed:

- `tool_loop` wins follow-up product-intent turns because it preserves conversation state and uses `select_products` correctly.
- `classic` can still win broad routine turns because it gives warmer context and explains why the routine steps matter.
- Product answers from `tool_loop` are often correct but too mechanical, repeating internal facts such as weight, balance, intensity, and price without enough advisory comparison.
- For broad routine answers, the selected third lever can be valid even when another adjacent lever would be useful. Example: daily coconut oil can make `Haar-Reset / Tiefenreinigung` valid, while a lighter leave-in may be the practical everyday replacement.
- Conceptual category curiosity such as `ich habe gehoert leave-in soll gut sein` should get education first, not immediate product picks.

## Decisions

- Keep deterministic routine priority authoritative.
- Do not hard-overwrite `Haar-Reset / Tiefenreinigung` with leave-in for oil-heavy routines.
- Broad routine answers should present the selected third lever plus adjacent context when useful.
- Product answers should render as consultant comparisons, not internal data dumps.
- Add a narrow conceptual-curiosity guard for premature `select_products` calls.
- Explicit product asks still call `select_products`.
- Compare Lab remains the only integration target.

## Non-Goals

- No production chat wiring.
- No changes to routine priority scoring in this pass.
- No new category engines.
- No Composer-specific optimization.
- No model-selected `load_guidance`.
- No changes to product ranking, product claims, or deterministic tool authority.

## Expected Behavior

### Broad Routine

For `ich nutze kokosöl jeden tag und hab gehört, das sei nicht so gut. wie kann ich routine anpassen`, if the deterministic routine tool selects `Haar-Reset / Tiefenreinigung`:

- Say why reset is valid: daily oil can leave buildup or a coated feel.
- Say what it is not: not the everyday replacement for oil.
- Name the adjacent everyday lever: lighter leave-in/finish is probably the practical ongoing replacement.
- Keep shampoo and conditioner basics concise.

### Product Recommendation

For `welcher leave-in passt?` after a routine thread:

- If required information is missing, ask one targeted question.
- After the user answers, recommend products in tool order.
- Explain the type of product the profile needs.
- Compare real differences between options.
- Add a practical usage note.

### Conceptual Curiosity

For `ja ich habe gehört leave in soll gut sein`:

- Do not execute `select_products`.
- Explain what leave-in can do for this profile and how it fits the routine.
- Offer product picks as a next step.

For `ok welcher leave-in passt?`:

- Execute `select_products`.

## Verification Signals

- Automated tests show conceptual curiosity blocks premature product tools while explicit product asks still execute them.
- Automated tests show routine answer context includes priority-plus-adjacent-lever guidance.
- Automated tests show product answer context includes richer category-specific advisor instructions.
- Manual Compare Lab runs show broad routine answers are more explanatory without losing deterministic routine steps.
- Manual Compare Lab runs show leave-in continuation still wins over `classic`.
