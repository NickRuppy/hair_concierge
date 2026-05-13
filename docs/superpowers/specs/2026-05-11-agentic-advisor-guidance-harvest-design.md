# Agentic Advisor Guidance Harvest Design

## Reader

This spec is for the engineer improving the Compare Lab `tool_loop` prototype after the May 11 feedback runs.

## User Situation

The current agentic tool loop is clearly better than the classic system at multi-turn continuity, concrete product follow-ups, and not jumping to product recommendations for conceptual category questions. It is still weaker than classic in some final-answer moments because classic benefits from older deterministic render guidance:

- leave-in product answers sometimes miss the stronger profile-aware framing, especially the "ein Produkt weniger in der Routine" point when a leave-in can bundle care plus heat protection
- conceptual category answers can be correct but too abrupt or unstructured
- broad "what else besides shampoo?" questions do not reliably reuse the routine basics logic: shampoo, conditioner, plus one highest-impact extra lever
- broad routine answers can leave conversation state less useful than the classic layered routine flow

## Promised End-State

Compare Lab can test a one-call `tool_loop` that keeps the current agentic strengths but receives compact, relevant, deterministic advisory context at runtime:

- deterministic tools remain authoritative for products, ranking, claims, routine steps, and routine priority
- the LLM gets richer category/routine advisory context only when relevant
- no production chat wiring changes
- no dependency on `ConversationContextPacketV1`
- no second composer call is required for this iteration

## First-Principles Direction

The old deterministic recommendation logic should not become a giant always-on prompt. It should be harvested into small advisory facts and answer-shape capsules, derived from the same authoritative tool outputs and guidance files the system already owns.

The model may choose language and connect dots, but it may not choose product facts, product order, routine steps, or hard claims. Those stay with `select_products` and `build_or_fix_routine`.

## Architecture

Add an "advisor guidance pack" projection inside the Compare Lab tool-loop path.

The pack has three sources:

1. static editorial guidance from `data/agent-guidance/topics/*`
2. deterministic tool projections from `select_products` and `build_or_fix_routine`
3. current profile/context projections already available through `get_user_context`

The pack has two delivery moments:

1. pre-tool consultation brief: helps the model choose whether to answer educationally, call `select_products`, or call `build_or_fix_routine`
2. post-tool answer context: helps the model render the final answer with the right topology and profile-aware framing

## Boundaries

In scope:

- Compare Lab `tool_loop` only
- one-call `inline_context` path as the primary variant
- richer guidance for leave-in, conditioner, mask, shampoo/routine extension, and light oil preservation
- tests that verify prompt/context packets and deterministic tool behavior
- manual Compare Lab verification prompts based on the latest feedback runs

Out of scope:

- production chat wiring
- new catalog/product ranking logic
- changing product selection authority
- changing the oil clarification behavior beyond preserving the current product-stage follow-up
- rebuilding the full classic final renderer
- adding an LLM-loaded guidance tool
- Eva/backlog infrastructure

## Key Decisions

- Use one LLM call per Compare Lab message for the primary test path.
- Keep Composer available only as an experiment; do not improve it in this plan.
- Harvest deterministic logic into compact advisory context, not a large preloaded deterministic script.
- For "other products besides shampoo" / broad "what else should I add?" questions, prefer `build_or_fix_routine` at `layer: "basics"` rather than `select_products`, but render it as a natural consultation transition rather than as a full routine restart.
- Preserve the user-wish principle: answer the asked question and steer softly toward stronger levers when needed.
- Treat oil as acceptable for now: conceptual oil questions can stay educational; concrete oil recommendations should still ask purpose when missing.

## Success Criteria

- Leave-in product answers explicitly surface the best profile-aware framing already present in deterministic outputs, including heat-protection consolidation when supported.
- Conceptual category answers follow a stable advisor topology: direct answer, role, profile reason, practical use/limits, next step.
- Broad product-category overview questions reuse the deterministic routine basics: shampoo, conditioner, and the current highest-impact extra lever. They end by asking whether the user wants the next layer by goals or by problems.
- Routine basics state is stable after a broad routine answer.
- Prompt verification includes the exact feedback scenarios that motivated this work.
- Existing focused agent/recommendation tests continue to pass.

## Open Risks

- If capsules become too broad, the LLM may sound generic again. Keep each capsule small and condition-specific.
- If pre-tool guidance becomes too directive, tool choice may become stiff. Tests should verify both conceptual no-tool answers and explicit product tool calls.
- Some classic guidance lives only inside `AGENT_FINAL_RENDER_PROMPT`; harvesting should move the useful concept into typed answer context without copy-pasting the whole renderer.
