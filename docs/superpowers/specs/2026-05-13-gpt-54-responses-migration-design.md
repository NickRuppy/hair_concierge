# GPT-5.4 Responses Migration Design

## Reader

This spec is for the engineer who will migrate Hair Concierge's recommendation chat from a GPT-4o-optimized Chat Completions stack to a GPT-5.4-native Responses stack.

## User Situation

The current recommendation engine was recently optimized around GPT-4o and Chat Completions. That was useful tactically, but the product should now be built around the GPT-5.4 model family as the stable baseline for the coming weeks or months, with clean room for later model upgrades.

## Promised End-State

Production recommendation chat uses GPT-5.4-class reasoning models through the Responses API for the agentic tool loop, while preserving deterministic product/routine authority, German answer quality, safety gates, grounding rules, traces, and eval coverage. Model choice, reasoning effort, verbosity, snapshots, and fallbacks are explicit configuration, not scattered literals.

## Chosen Direction

Use a Responses-first architecture. Do not merely replace `gpt-4o` strings.

The new baseline should be:

- `gpt-5.4-mini` as the default production advisor/tool-loop model.
- `gpt-5.4` as escalation and offline audit model.
- `gpt-5.4-nano` only after evals prove it is good enough for narrow extraction/classification tasks.
- Snapshot IDs for production stability, with aliases reserved for candidate eval runs.

This direction intentionally keeps deterministic recommendation tools as the source of truth. The model should get more freedom in sequencing, explanation, ambiguity handling, and synthesis, but not in product facts, prices, product availability, medical claims, or irreversible actions.

## Source Notes

Official OpenAI docs current on 2026-05-13:

- Models page: `gpt-5.5` is the latest flagship, but `gpt-5.4`, `gpt-5.4-mini`, and `gpt-5.4-nano` are official GPT-5.4 family targets. Use the user's requested target, not an automatic jump to 5.5.
- GPT-5.4 model page: `gpt-5.4` supports Responses, Chat Completions, function calling, structured outputs, streaming, reasoning tokens, tool search, and a 1,050,000 token context window. It lists snapshots including `gpt-5.4-2026-03-05`.
- GPT-5.4 mini model page: `gpt-5.4-mini` supports a 400,000 token context window, 128,000 max output tokens, function calling, structured outputs, and Responses tools. It lists snapshots including `gpt-5.4-mini-2026-03-17`.
- Responses migration guide: OpenAI recommends Responses for new projects and says reasoning models have richer behavior and improved tool usage there. Starting with GPT-5.4, tool calling is not supported in Chat Completions with `reasoning: none`.
- Latest model guide: for GPT-5-family migrations, start with the smallest prompt that preserves the product contract, use Responses for reasoning/tool/multi-turn use cases, tune reasoning effort, use Structured Outputs instead of prompt-only schema descriptions, and handle preambles/phase/state correctly.
- Reasoning docs: `reasoning.effort` controls how much the model thinks; values are model-dependent and include `none`, `low`, `medium`, `high`, and `xhigh` for GPT-5.4. Lower effort favors latency and cost; higher effort should be justified by evals.

Links:

- https://developers.openai.com/api/docs/models
- https://developers.openai.com/api/docs/models/gpt-5.4
- https://developers.openai.com/api/docs/models/gpt-5.4-mini
- https://developers.openai.com/api/docs/guides/migrate-to-responses
- https://developers.openai.com/api/docs/guides/latest-model
- https://developers.openai.com/api/docs/guides/reasoning
- https://developers.openai.com/api/docs/guides/structured-outputs

## Current Repo Findings

Primary production/default model literal:

- `src/lib/openai/chat.ts` exports `DEFAULT_CHAT_COMPLETION_MODEL = "gpt-4o"` and `DEFAULT_CHAT_COMPLETION_TEMPERATURE = 0.7`.

Current active agentic model calls:

- `src/lib/agent/orchestrator/model-client.ts`
  - route classification via Chat Completions with strict JSON schema
  - bounded final render via Chat Completions
  - agentic tool-loop steps via Chat Completions `tools`
  - contextual composer via Chat Completions

Current production chat path:

- `src/lib/agent/production/chat-pipeline.ts`
  - constructs production agent tools
  - uses `createOpenAIAgenticToolLoopModelClient()`
  - trace prompt snapshot still reports `DEFAULT_CHAT_COMPLETION_MODEL`

Current internal tool-loop representation:

- `src/lib/agent/orchestrator/run-agentic-tool-turn.ts`
  - builds `OpenAI.Chat.Completions.ChatCompletionMessageParam[]`
  - appends assistant tool calls and `role: "tool"` messages after tool execution

Other OpenAI call sites:

- `src/lib/rag/intent-classifier.ts`: GPT-4o JSON mode, legacy RAG classifier
- `src/lib/rag/synthesizer.ts`: default Chat Completions model, legacy/classic synthesis
- `src/lib/rag/title-generator.ts`: GPT-4o-mini
- `src/lib/rag/memory-extractor.ts`: GPT-4o-mini JSON mode
- `src/lib/rag/subquery-decomposer.ts`: GPT-4o-mini
- `src/app/api/quiz/analyze/route.ts`: GPT-4o JSON mode
- `scripts/eval-chat/judge.ts`: GPT-4o-mini JSON mode
- ingestion/cleanup scripts: mostly GPT-4o-mini or GPT-4o for offline data preparation
- embeddings scripts use `text-embedding-3-*` and should stay out of scope unless retrieval changes.

## Architecture Principles

1. Model-native where judgment matters.
   Let GPT-5.4-mini handle nuanced conversation movement, tool sequencing, synthesis, and concise German response shaping.

2. Deterministic where product trust matters.
   Code remains authoritative for product eligibility, product order, product claims, routine steps, profile completeness, policy gates, product cards, and persistence.

3. Responses-first, Chat-compatible only as a fallback.
   Add a Responses client and keep the Chat client only for compare/eval fallback during migration. Do not let Chat message types remain the central internal representation.

4. Snapshots for production stability.
   Production defaults should use snapshot IDs, with alias IDs tested in evals before promotion.

5. Evals decide model routing.
   Do not assume `gpt-5.4-nano` is safe for production classification until route accuracy, tool correctness, safety behavior, latency, and cost are measured.

6. Grounded UX over hidden autonomy.
   The user should get a fast visible preamble/status for longer tool-heavy turns, but final answers should not expose internal tool names, traces, capsules, or policies.

## Required Product Behavior

- UI/user-facing answers remain German.
- `hair_texture` still means pattern; `thickness` still means diameter.
- No invented product names, prices, availability, ingredient lists, or claims.
- Product facts and product cards only come from `select_products`.
- Routine structure only comes from `build_or_fix_routine`.
- Category/concept guidance may come from `load_advisor_guidance` and answer context.
- Cosmetic hair care must stay separate from medically adjacent scalp/hair-loss guidance.
- Active scalp symptoms, sudden hair loss, wounds, allergic reactions, pregnancy/medical medication contexts, or prescription-treatment questions must trigger conservative safety behavior.

## Model Policy

Production defaults:

- Agentic tool loop: `gpt-5.4-mini-2026-03-17`, reasoning `low`, text verbosity `low` or `medium`.
- Complex escalation: `gpt-5.4-2026-03-05`, reasoning `medium` or `high`.
- Offline eval judge: `gpt-5.4-2026-03-05`, reasoning `medium`.
- Narrow extraction candidates: test `gpt-5.4-nano` separately before use.

Escalate from mini to full GPT-5.4 when any of these are true:

- safety overlay or medically adjacent wording is detected
- the user is dissatisfied after a recommendation
- multiple product constraints conflict
- image input is added later
- tool results conflict or contain no match
- eval traces show mini under-calls tools or overclaims

## Non-Goals

- Do not migrate embeddings.
- Do not rewrite deterministic recommendation category logic.
- Do not introduce the Agents SDK in the first migration unless the Responses adapter proves insufficient.
- Do not replace Langfuse with a new observability product.
- Do not update every offline ingestion script before production chat is stable.
- Do not move to GPT-5.5 in this plan; document it as a future candidate.

## Rollout Standard

The migration is not done when tests pass. It is done when:

- production chat can run on Responses with GPT-5.4-mini snapshots
- traces include model, endpoint, reasoning effort, verbosity, response id, token usage, reasoning tokens when returned, cached tokens when returned, tool calls, blocked tool calls, answer context, and state transition
- a comparison eval shows GPT-5.4-mini is at least as safe and grounded as GPT-4o on current scenarios
- cost/latency reports cover full conversation latency, model usage, tool calls, and response token distribution
- a rollback flag can return production to the existing Chat Completions client without reverting code
