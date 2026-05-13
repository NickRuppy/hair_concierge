# Agentic Tool Loop Design Spec

**Status:** Approved for a Compare Lab prototype. Not approved as the production chat engine until the compare-lab rollout gate is met.

**Reader:** Engineers working on Hair Concierge chat, recommendation orchestration, conversation state, traces, and compare-lab evaluation.

**User situation:** Test users ask messy multi-turn questions with typos, topic switches, pronouns, frustration, comparisons, and follow-ups. The current bounded Agent v1 plus the context-packet final composer improves many turns, but semantic ownership is still split: the LLM classifies, then deterministic state/override code can second-guess it. That split can make the app miss obvious product asks such as "welcges Shampoo sollte ich verwenden".

**Promised end-state:** Hair Concierge can run an agentic tool loop inside `/labs/agent-compare`, where the model sees curated conversation/profile context, chooses existing deterministic tools, receives tool results, and submits a structured final answer. The deterministic recommendation/routine engines remain authoritative; the model owns language understanding and tool choice, not product scoring or product claims. Production chat remains `classic` until compare-lab testing proves the loop is better.

## Strategic Decision

We are not building `tool_loop` because one bug proves the classic engine is broken. We are building it because deterministic semantic patching does not scale well once 100+ testers produce unseen phrasings, typos, topic switches, and follow-up styles.

The strategic direction is:

```text
Stop making deterministic code the semantic interpreter.
Let the model choose tools.
Keep deterministic code for validation, product/routine logic, safety, traces, and rollout control.
```

No pre-implementation audit is required. Real failures should be collected as eval and compare-lab material, not as permission to build the prototype.

## Considered Alternatives

| Approach | Complexity | Effort | Tradeoffs | Best when... |
| --- | --- | --- | --- | --- |
| A: Tighten Classic Overrides | Low | 0.5-1 day | Cheapest, lowest latency, but keeps two semantic authorities and can continue creating edge-case patches. | A specific production bug needs a hotfix while `tool_loop` is still being evaluated. |
| B: Turn Interpreter Contract | Medium | 1-2 days | Keeps two model calls but makes classifier richer and state-aware; less runtime change than tool loop. | Classifier output is the weak point, but current tool planner/final renderer are otherwise strong. |
| C: Agentic Tool Loop | High | 3-5 days | Cleaner ownership: model chooses tools, code validates/executes. Higher runtime and eval cost. | The product needs a more scalable conversation architecture before broad tester rollout. |

This spec chooses C for a compare-lab prototype. It does not choose C as the default production engine until the rollout gate is met.

## Current Research Basis

The architecture follows the May 2026 `llm-architecture-review` posture and the official docs reviewed in-thread:

- OpenAI agent guidance: start with a capable single agent, clear tools, structured instructions, guardrails, traces, and evals before adding multi-agent or router complexity.
- OpenAI structured outputs and function calling: use function/tool schemas for private data or actions; validate schemas at system boundaries.
- Anthropic agent guidance: successful systems are usually simple composable patterns; routing is useful only when categories are distinct and reliable.
- Anthropic context-engineering guidance: reliability comes from curating the right context, not hardcoding fragile branches.
- LangChain/LangGraph context guidance: separate transient model context, short-term state, long-term memory, tool/runtime context, and lifecycle logging.

## Current Shape

```text
LLM classifies route
  -> deterministic route packet normalizes and derives tool plan
  -> conversation-state overrides can rewrite the route
  -> deterministic tools run
  -> context packet guides final render
  -> final LLM renders answer
```

The bad boundary is that deterministic override code can become the hidden semantic brain.

## Chosen Shape

```text
load user context + recent conversation + conversation_state
  -> model reads context + strict tool contracts
  -> model calls select_products or build_or_fix_routine when needed
  -> code validates and executes deterministic tools
  -> model calls submit_final_answer with answer + short-term state patch
  -> code validates state patch, persists state, and traces the run
```

This is one logical agent run, not a new router. The terminal `submit_final_answer` call is a structured final-output contract, not an external side-effect tool.

## Context Packet Decision

The agentic loop should not depend on `ConversationContextPacketV1`.

First-principles reason:

- The packet was built for the classic architecture, where a route packet and final renderer are separate stages.
- Its core fields (`move_hint`, `structured_outputs.route`, deterministic `composition_guidance`) are route/final-render bridge artifacts.
- In the tool loop, the model already sees recent conversation context, tool contracts, executed tool results, and hard answer rules in the same run.
- Rebuilding a fake route packet just to fill `ConversationContextPacketV1` would reintroduce deterministic semantic hints such as `move_hint`.
- Tool outputs and the terminal `submit_final_answer` schema are a cleaner final-answer contract than an extra packet layer.

Keep the useful ideas, not the artifact:

- Keep compact recent-message budgeting.
- Keep explicit hard answer rules in the system prompt.
- Keep tool outputs authoritative.
- Keep traceability for answer style, state patch, tool calls, and guardrails.
- Do not keep route-shaped fields or deterministic move hints as runtime authority in `tool_loop`.

If evals later show the final step needs extra help, add a small `final_answer_brief` that is fact-only:

```ts
{
  latest_user_message: string,
  recent_context_summary: string | null,
  authoritative_tool_outputs: {
    selected_products: SelectedProductsProjection | null,
    routine_plan: BuildOrFixRoutineProjection | null
  },
  hard_rules: string[],
  response_preferences: {
    answer_current_delta_first: true,
    avoid_full_restart: true
  }
}
```

This brief must not contain deterministic semantic route labels such as `move_hint`, and it must not duplicate full tool outputs unless the context budget requires compaction.

## V1 Tool Surface

Model-selected tools in V1:

- `select_products`
  - Use for concrete product recommendations, product comparisons, or product decisions in one supported category.
  - The tool remains authoritative for ranking, product claims, response policy, and cards.
- `build_or_fix_routine`
  - Use for routine building, simplification, repair, or restructuring.
  - The tool remains authoritative for routine steps.
- `submit_final_answer`
  - Terminal structured output with `answer`, `state_patch`, and short trace metadata.
  - Ends the run. It is not shown to the user as a tool.

Not model-selected in V1:

- `get_user_context`: always preloaded.
- `load_guidance`: not exposed in V1. It is too easy for the model to guess guidance IDs. Preload compact always-on guidance/rules instead, and reconsider model-selected guidance only after evals prove it is needed.

## Strict Tool Schema Decision

The installed OpenAI SDK exposes `strict?: boolean` for function tools. V1 must use strict function tools where accepted by the API.

Strict-mode schema requirements:

- `additionalProperties: false` on every object.
- All object properties listed as `required`.
- Optional values represented by nullable fields or empty arrays.
- Runtime validation still exists even with strict mode.

## Conversation Context Budget

V1 context input is:

- latest user message in full
- last 8 non-empty recent messages
- max 600 chars per recent message
- max 2,400 chars total recent-message content
- compact conversation state
- compact profile summary
- relevant memory capped to 3 entries, 120 chars each
- executed tool results in their native shape
- optional fact-only `final_answer_brief` only if tests show native tool history is insufficient

Do not pass the full raw transcript by default.

## Runtime Guardrails

Code must enforce:

- max 4 model steps per run
- max 4 non-terminal executable tool calls
- max 1 terminal `submit_final_answer` call
- max 5 total tool calls including terminal final answer
- allowed tool names only
- valid JSON tool args only
- valid product categories only
- at most one `select_products` call per category per turn
- no product cards unless `select_products` returned products and policy allows cards
- safe fallback if the model does not submit a final answer

If the model calls both `select_products` and `build_or_fix_routine`, execute both only because both are read-only. Trace `multi_tool_turn=true`. The prompt must say this should happen only for explicit combined asks such as "build my routine and pick the shampoo".

## State Update

Do not add a separate LLM state-update call.

The terminal `submit_final_answer` includes a constrained short-term state patch:

```ts
{
  active_topic: "routine" | "shampoo" | "conditioner" | "leave_in" | "mask" | "oil" | null,
  routine_layer: "basics" | "goals" | "problems" | "deep_dive" | null,
  last_product_category: "shampoo" | "conditioner" | "leave_in" | "mask" | "oil" | null,
  last_assistant_action: string,
  topic_relation: "same_topic" | "category_switch" | "refinement" | "recap" | "unclear",
  reason: string
}
```

Tool outcomes override conflicting state patches:

- `select_products(shampoo)` forces `active_topic = "shampoo"` and `last_product_category = "shampoo"` unless the final answer explicitly declined to recommend due to policy.
- `build_or_fix_routine` forces `active_topic = "routine"`.
- Tool-less final answers may update state from the patch, which prevents stale state on pivots such as "vergiss das, ich will jetzt was ueber Foehnen wissen".

Persist or trace `updated_by_engine = "tool_loop"` with each state transition. Rollback to `classic` must be possible by env flip; classic readers must ignore unknown state metadata.

## Latency And Cost Budget

Compare on the same prompt set against classic:

- best-case model steps: 2 (`select_products` -> `submit_final_answer`)
- worst-case model steps: 4
- rollout requires p50 latency within +25% of classic and p95 within +35% of classic on the compare set
- log model step count, tool count, prompt/completion tokens if available, and total latency
- no automatic model retry in V1 except one safe fallback on timeout/error
- per model step timeout should use the same production request timeout pattern as current chat, or document the mismatch before implementation

## Compare Lab Requirement

Before production rollout, `/labs/agent-compare` must compare:

```text
classic
vs.
tool_loop
```

It must support:

- single-turn prompt comparison
- multi-turn chain comparison where both systems carry state through the same sequence
- blinded review mode where engine names are hidden until after judgment
- a mixed pack: crafted failure cases plus held-out real historical turns

Compare Lab state policy:

- Read real user profile, relevant memory, routine inventory, and product catalog data.
- Simulate conversation messages and short-term conversation state in memory per lab run.
- Do not persist `tool_loop` experimental messages to production conversation tables.
- Do not persist `tool_loop` experimental conversation state to `conversation_states`.
- Persist only explicit lab judgment records/debug artifacts that are already part of the lab workflow.

The lab should show answer text, matched products, tool calls, product trace, tool-loop trace, state transition summary, latency, and manual judgment.

## Success Criteria

The tool loop is ready to become default only when:

- At least 50 judged comparisons are reviewed in blinded mode.
- At least two reviewers judge the default rollout set, or the PR explicitly states that the rollout decision is a single-reviewer judgment call.
- The set includes at least 25 held-out real historical turns, not only prompts crafted for this PR.
- Tool loop reduces `semantic_state_conflict` + `tool_not_called` failures by at least 50% versus classic on the held-out set.
- Tool loop wins more pairwise judgments than it loses by at least 15 percentage points, excluding ties.
- It has zero critical invented-product or unsupported-claim failures.
- Latency stays within the budget above.

Ties alone are not a success criterion.

## Explicit Non-Goals

- Do not rewrite product ranking, product tables, or routine engines.
- Do not add a new deterministic intent router.
- Do not replace the app with a multi-agent framework.
- Do not migrate the whole app to Responses API in this work.
- Do not remove classic until compare-lab results justify it.
- Do not persist new long-term memories from the model in V1.

## Open Risks

- Tool-loop latency may be too high for default rollout.
- The model may over-call tools for conceptual questions unless tool contracts and evals are strong.
- The terminal state patch can still be wrong; code validation and traces must make it harmless.
- Some current route-packet normalization behavior protects product claims; moving that protection into strict tools/guardrails must be deliberate.
