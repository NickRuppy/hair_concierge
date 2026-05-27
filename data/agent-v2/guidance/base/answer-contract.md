# Answer Contract

## Purpose
The terminal answer is the only user-renderable output from AgentV2.

## Use When
Always, at the end of the turn.

## Agent May Decide
Choose the answer mode, write the German prose inside the mode-specific payload, and declare the semantic request interpretation.

## Code And Tools Decide
Whether product IDs, routine IDs, claims, safety boundaries, memory writes, tool args, request interpretation, and payload shape are valid.

## Request Interpretation
Every terminal answer must include `request_interpretation`. It is a terminal contract for validators and trace review, not user-facing prose.

The `request_interpretation` must match tool args and answer mode. Do not describe one intent in `request_interpretation` while using another in `select_products`, `build_or_fix_routine`, or the final payload.

Fill `evidence_quote` with a short raw phrase from the latest user message or active recent context that justifies the semantic decision. Prefer exact wording. For short referential follow-ups, use the closest active phrase that makes the decision reviewable. Do not invent evidence or quote hidden reasoning.

Use `confidence` conservatively. Low confidence may support cautious general or category advice, but low confidence should use clarification before product recommendations, routine mutations, memory writes, or safety-sensitive guidance.

`request_interpretation.care_category` is singular terminal accountability, not the retrieval list. Use `care_category: none` when there is no single primary category: broad concerns, broad goals, technique questions, or balanced comparisons can still load multiple category guidance packages without declaring a category winner.

## Required Grounding
Fill tool_grounding with the guidance package IDs and tool outputs actually used. Hard rule IDs must come from loaded guidance packages.

## Missing Required Data
Put material missing data into missing_information and use clarification mode when a useful answer is not possible.

## Bounded Repair
If validation reports that a required tool call is missing, expect at most one bounded repair turn. In repair, call only the missing required tool and then `submit_final_answer`; do not restart the conversation or add unrelated tools.

## Constraint Conflicts
Use constraint_blocked when user constraints make the requested recommendation impossible.

## German Answer Shape
Put the final German answer in payload.user_facing_answer_de. Do not put memory notes or trace details into user-facing prose.

payload.user_facing_answer_de is the complete final German answer shown to the user. Do not treat recommendations, visible_steps, usage_notes_de, or blocking_constraints as hidden content that the app will render later.

If a product, routine step, usage note, or blocking constraint is user-visible in payload fields, include it in user_facing_answer_de.

## Do Not
Do not call submit_final_answer twice. Do not mix terminal and non-terminal tool calls in the same model step.
