# Agentic Tool Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** `docs/superpowers/specs/2026-05-05-agentic-tool-loop-design.md`

**Goal:** Build a Compare Lab-first Hair Concierge tool loop where the model chooses existing deterministic recommendation/routine tools directly, then judge it against the current classic engine before production rollout.

**Architecture:** Keep `select_products` and `build_or_fix_routine` authoritative. The new loop removes semantic override authority from code inside a flagged runtime, lets the model choose strict tools, uses native tool history plus a strict terminal answer schema for final composition, and persists validated short-term state after the terminal answer.

**Tech Stack:** Next.js 16, TypeScript, OpenAI Chat Completions function/tool calling with strict schemas, Supabase-backed profile/product data, existing Agent v1 tools, `/labs/agent-compare`, Node test runner, Playwright where needed.

---

## Status

This plan is ready for a Compare Lab prototype. It is not approval to make `tool_loop` the production chat engine. Production wiring comes after the lab version works and the rollout gate is met.

## User Situation Being Solved

The chat should understand messy multi-turn product/routine conversations without deterministic state code swallowing the current user intent. The target feeling is: "It understood what I meant, even with typos and follow-ups, and used the right product/routine logic without restarting or getting stuck."

## Promised End-State

- Classic remains the production engine during the prototype.
- `tool_loop` exists first as a Compare Lab candidate.
- The loop exposes only strict model-selected tools: `select_products`, `build_or_fix_routine`, and terminal `submit_final_answer`.
- `load_guidance` and `get_user_context` are preloaded, not model-selected.
- Final composition does not depend on `ConversationContextPacketV1`; it uses recent messages, native tool outputs, hard rules, and the terminal `submit_final_answer` schema.
- The compare lab can run blinded, multi-turn `classic` vs `tool_loop` comparisons.
- Rollout requires measured improvement, not architectural preference.

## Scope Boundaries

- Do not delete or rename the current classic engine during V1.
- Do not change product scoring/ranking rules.
- Do not add another deterministic intent router.
- Do not add a separate LLM state-update call.
- Do not expose internal labels to users.
- Keep all UI text in German.

## Target File Map

- Create: `src/lib/agent/orchestrator/agentic-tool-loop-types.ts`
  - Tool-loop step/result types, terminal answer schema, trace types, engine identifiers.
- Create: `src/lib/agent/orchestrator/run-agentic-tool-turn.ts`
  - New flagged runtime loop.
- Modify: `src/lib/agent/orchestrator/model-client.ts`
  - Add a tool-loop model client alongside the existing classic model client.
- Modify: `src/lib/agent/orchestrator/tool-definitions.ts`
  - Add strict V1 tool schemas for the tool loop.
- Modify: `src/lib/agent/orchestrator/prompt.ts`
  - Add `AGENTIC_TOOL_LOOP_PROMPT`.
- Modify: `src/lib/rag/conversation-state.ts`
  - Add validation/merge helper for terminal state patches.
- Modify: `src/lib/rag/debug-trace.ts`
  - Persist optional tool-loop trace fields.
- Modify: `src/lib/types.ts`
  - Add trace/state metadata types.
- Modify: `src/lib/agent/compare/types.ts`
  - Add `classic` and `tool_loop` compare systems.
- Modify: `src/lib/agent/compare/run-shadow-agent.ts`
  - Keep classic comparison path available; optionally add a wrapper named `runClassicAgentComparisonForUser`.
- Create: `src/lib/agent/compare/run-agentic-tool-loop.ts`
  - Compare-lab adapter for the new runtime.
- Modify: `src/app/api/labs/agent-compare/route.ts`
  - Return classic and tool-loop results.
- Modify: `src/components/labs/agent-compare-lab.tsx`
  - Show blinded mode, multi-turn results, and tool-loop traces.
- Later modify: `src/lib/agent/production/chat-pipeline.ts`
  - Add production engine selection only after Compare Lab readiness.
- Test: `tests/agentic-tool-loop.spec.ts`
- Test: `tests/agent-compare-api.spec.ts`
- Test: `tests/agent-compare-product-trace.spec.ts`
- Test: `tests/agent-compare-runner.spec.ts`
- Test: `tests/conversation-state.spec.ts`
- Test: `tests/chat-debug-trace.spec.ts`

## Task 0: Compare Lab Prototype Seed Set

**Files:**
- Create: `plans/2026-05-05-agentic-tool-loop-eval-seed.md`

- [ ] Create a lean seed set for compare-lab development, not an audit gate.
- [ ] Include 10-15 prompts/chains that cover:
  - routine -> product category switch
  - typoed product ask
  - pronoun follow-up
  - usage follow-up after product recommendation
  - comparison after product recommendation
  - summary/recap
  - tool-less topic pivot
- [ ] Pull from current prompt docs, local examples, and the known shampoo failure.
- [ ] Do not spend time producing a statistical failure audit before building the prototype.

Run:

```bash
git diff --check -- plans/2026-05-05-agentic-tool-loop-eval-seed.md
```

Expected: seed doc exists and can drive Compare Lab smoke testing.

## Task 1: Add Failing Tool-Loop Unit Tests

**Files:**
- Create: `tests/agentic-tool-loop.spec.ts`

- [ ] Add a fake model with scripted steps:

```ts
type FakeStep =
  | { type: "tool_calls"; calls: Array<{ id?: string; name: string; input: Record<string, unknown> }> }
  | { type: "final"; answer: string; statePatch?: Record<string, unknown> }
```

- [ ] Test active routine plus typoed shampoo ask calls `select_products`.

Message:

```text
ok und welcges shampoo insbesondere sollte ich verwenden
```

Assert:

- `select_products` called once with `category: "shampoo"`
- final answer is returned through `submit_final_answer`
- selected product projection is present
- derived state sets `active_topic = "shampoo"`
- no classifier override exists

- [ ] Test pure usage question does not call `select_products`.

Message:

```text
wie oft soll ich das Shampoo benutzen?
```

With prior state `active_topic = "shampoo"`, assert no product tool call and state remains shampoo.

- [ ] Test tool-less topic pivot updates state from terminal patch.

Message:

```text
vergiss das, ich will jetzt was ueber Foehnen wissen
```

Assert no product/routine tool call, final answer exists, and validated state patch no longer preserves shampoo as the active topic.

- [ ] Test unknown tool is blocked and traced.

- [ ] Test model cannot exceed max tool calls.

Run:

```bash
npx tsx --test tests/agentic-tool-loop.spec.ts
```

Expected first run: fails on missing module/imports. This is scaffolding-first, not a completed red/green TDD loop.

## Task 2: Add Tool-Loop Types

**Files:**
- Create: `src/lib/agent/orchestrator/agentic-tool-loop-types.ts`
- Modify: `src/lib/types.ts`

- [ ] Define canonical engine identifiers:

```ts
export type ChatAgentEngine = "classic" | "tool_loop"
```

- [ ] Define model step, executed call, terminal answer, and trace types:

```ts
export type AgenticToolName =
  | "select_products"
  | "build_or_fix_routine"
  | "submit_final_answer"

export interface AgenticTerminalAnswer {
  answer: string
  state_patch: {
    active_topic: "routine" | "shampoo" | "conditioner" | "leave_in" | "mask" | "oil" | null
    routine_layer: "basics" | "goals" | "problems" | "deep_dive" | null
    last_product_category: "shampoo" | "conditioner" | "leave_in" | "mask" | "oil" | null
    last_assistant_action: string
    topic_relation: "same_topic" | "category_switch" | "refinement" | "recap" | "unclear"
    reason: string
  }
}
```

- [ ] Add optional trace fields so legacy traces continue compiling:
  - `engine_variant`
  - `agentic_tool_loop.model_steps`
  - `agentic_tool_loop.tool_calls`
  - `agentic_tool_loop.blocked_tool_calls`
  - `agentic_tool_loop.guardrails`

Run:

```bash
npx tsx --test tests/agentic-tool-loop.spec.ts
npm run typecheck
```

Expected: only missing implementation errors remain until later tasks.

## Task 3: Add Strict V1 Tool Schemas

**Files:**
- Modify: `src/lib/agent/orchestrator/tool-definitions.ts`
- Test: `tests/agentic-tool-loop.spec.ts`

- [ ] Add a dedicated builder:

```ts
export function buildAgenticToolDefinitions(): OpenAI.Chat.Completions.ChatCompletionTool[]
```

- [ ] Include exactly:
  - `select_products`
  - `build_or_fix_routine`
  - `submit_final_answer`

- [ ] Do not include `load_guidance` or `get_user_context` in V1 tool loop definitions.

- [ ] Use `strict: true`. The installed SDK supports `strict?: boolean`; do not leave this conditional.

- [ ] Make schemas strict-compatible:
  - every object has `additionalProperties: false`
  - every property is listed in `required`
  - optional values use nullable types or empty arrays

- [ ] Add tests asserting:
  - every function tool has `strict: true`
  - every object schema has `additionalProperties: false`
  - `load_guidance` is absent
  - `submit_final_answer` includes `answer` and `state_patch`

Run:

```bash
npx tsx --test tests/agentic-tool-loop.spec.ts
npm run typecheck
```

## Task 4: Add Agentic Tool-Loop Prompt

**Files:**
- Modify: `src/lib/agent/orchestrator/prompt.ts`
- Test: `tests/agent-final-render-prompt.spec.ts`

- [ ] Add `AGENTIC_TOOL_LOOP_PROMPT`.

Required content:

```text
Du bist Hair Concierge.
Du verstehst die aktuelle Nutzerfrage semantisch und entscheidest, ob ein Tool noetig ist.
Der aktuelle Nutzerwunsch hat Vorrang vor altem conversation_state.
conversation_state hilft nur, wenn die aktuelle Nachricht mehrdeutig ist.
Nutze select_products fuer konkrete Produktfragen, Produktvergleiche oder Produktentscheidungen.
Nutze build_or_fix_routine fuer Routine-Aufbau, Vereinfachung oder Reparatur.
Nutze beide Produkt- und Routine-Tools nur, wenn die Nutzerin ausdruecklich beides verlangt.
Nutze submit_final_answer fuer jede finale Antwort oder Rueckfrage.
Erfinde keine Produkte und keine Produktclaims.
Antworte natuerlich auf Deutsch und fuehre den Thread fort.
```

- [ ] Prompt tests assert:
  - current intent wins over prior state
  - products/claims must come from tool output
  - `submit_final_answer` is required for final answers
  - no internal labels are exposed

Run:

```bash
npx tsx --test tests/agent-final-render-prompt.spec.ts
```

## Task 5: Implement Model Client Step API

**Files:**
- Modify: `src/lib/agent/orchestrator/model-client.ts`
- Test: `tests/agentic-tool-loop.spec.ts`

- [ ] Add:

```ts
export interface AgenticToolLoopModelClient {
  runStep(params: {
    systemPrompt: string
    messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[]
    tools: OpenAI.Chat.Completions.ChatCompletionTool[]
  }): Promise<AgenticToolLoopModelStep>
}
```

- [ ] Implement `createOpenAIAgenticToolLoopModelClient`.

Rules:

- generation name: `agentic-tool-loop-step`
- model defaults to `DEFAULT_CHAT_COMPLETION_MODEL`
- temperature follows current production client
- parse tool calls into `type: "tool_calls"`
- terminal `submit_final_answer` is returned as a tool call, not parsed from free text
- if the model returns text without terminal tool call, runtime asks one more step to submit final answer if budget remains; otherwise fallback

Run:

```bash
npx tsx --test tests/agentic-tool-loop.spec.ts
npm run typecheck
```

## Task 6: Implement `runAgenticToolTurn`

**Files:**
- Create: `src/lib/agent/orchestrator/run-agentic-tool-turn.ts`
- Test: `tests/agentic-tool-loop.spec.ts`

- [ ] Implement:

```ts
export async function runAgenticToolTurn(params: {
  message: string
  recentMessages: Array<{ role: "user" | "assistant"; content: string }>
  modelClient: AgenticToolLoopModelClient
  tools: Record<"select_products" | "build_or_fix_routine", (input: Record<string, unknown>) => Promise<unknown>>
  userContext: UserContextProjection
  conversationState?: ConversationState | null
  maxModelSteps?: number
  maxExecutableToolCalls?: number
}): Promise<AgenticToolTurnResult>
```

- [ ] Defaults:
  - `maxModelSteps = 4`
  - `maxExecutableToolCalls = 4`
  - exactly one terminal `submit_final_answer` allowed

- [ ] Preload compact guidance/rules and user context before the first model step.

- [ ] Validate tool names against the V1 allowlist.

- [ ] Validate `select_products.category` before execution.

- [ ] Track selected products and routine plan from executed tools.

- [ ] Append native tool outputs and hard answer rules to the model message history before requesting `submit_final_answer`.

- [ ] On max-step exhaustion, return:

```text
Ich konnte das gerade nicht sauber genug einordnen. Sag mir bitte kurz, ob du eine konkrete Produktempfehlung oder eher die Routine-Logik meinst.
```

Run:

```bash
npx tsx --test tests/agentic-tool-loop.spec.ts
```

## Task 7: Keep Final Composition Native To The Tool Loop

**Files:**
- Test: `tests/agentic-tool-loop.spec.ts`

- [ ] Do not build or require `ConversationContextPacketV1` in `runAgenticToolTurn`.

- [ ] Ensure the terminal `submit_final_answer` step sees:
  - latest user message
  - budgeted recent messages
  - conversation state
  - compact profile summary
  - relevant memory summary
  - native executed tool outputs
  - hard answer/product rules

- [ ] Keep useful context-packet principles in prompt/rules:
  - answer current delta first
  - avoid full restart
  - preserve selected product order
  - ask at most one blocking clarification
  - do not expose internal labels

- [ ] Add assertions that no route-shaped fields such as `move_hint` or `structured_outputs.route` are required by the tool-loop final step.

- [ ] If tests or compare-lab output show the terminal step needs extra context help, add a fact-only `final_answer_brief` in `run-agentic-tool-turn.ts`. Do not add it preemptively.

Run:

```bash
npx tsx --test tests/agentic-tool-loop.spec.ts
```

## Task 8: Wire Deterministic Tools Into Compare-Lab Adapter

**Files:**
- Create: `src/lib/agent/compare/run-agentic-tool-loop.ts`
- Modify: `src/lib/agent/compare/run-shadow-agent.ts`
- Test: `tests/agentic-tool-loop.spec.ts`

- [ ] Build `runToolLoopComparisonForUser` around `runAgenticToolTurn`.

- [ ] Keep `run-shadow-agent.ts` as the classic baseline for Compare Lab. Add a wrapper named `runClassicAgentComparisonForUser` if that makes the lab code clearer, but do not rename the file in this prototype.

- [ ] Reuse existing adapters:
  - `createSelectProductsTool`
  - `createBuildOrFixRoutineTool`
  - `getUserContext`
  - `loadUserMemoryContext`

- [ ] Return compare-lab fields:
  - answer
  - matched products
  - product trace
  - tool-loop trace
  - latency
  - state patch / state transition summary

- [ ] State/data policy:
  - read real user profile, memory, routine inventory, and product catalog data
  - simulate `tool_loop` messages and conversation state in memory for each lab run
  - do not write experimental `tool_loop` messages to production conversation tables
  - do not write experimental `tool_loop` state to `conversation_states`

- [ ] Do not touch production chat in this task.

Run:

```bash
npx tsx --test tests/agentic-tool-loop.spec.ts
```

## Task 9: Validate And Persist State Patch

**Files:**
- Modify: `src/lib/rag/conversation-state.ts`
- Test: `tests/conversation-state.spec.ts`

- [ ] Add helper to validate terminal state patches and merge tool outcomes:

```ts
export function resolveAgenticConversationStateTransition(params: {
  previousState: ConversationState | null
  terminalStatePatch: AgenticTerminalAnswer["state_patch"]
  selectedProducts: SelectedProductsProjection | null
  routinePlan: BuildOrFixRoutineProjection | null
}): ConversationStateTransition
```

- [ ] Tool outcomes override conflicting patches.

- [ ] Tool-less topic pivots may update active topic from validated patch.

- [ ] Return `updated_by_engine = "tool_loop"` in the transition metadata so Compare Lab and later production traces can distinguish it.

- [ ] Run:

```bash
npx playwright test tests/conversation-state.spec.ts --reporter=line
```

## Task 10: Add Tool-Loop Trace Fields

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/lib/rag/debug-trace.ts`
- Modify: `src/app/admin/conversations/[id]/page.tsx`
- Test: `tests/chat-debug-trace.spec.ts`

- [ ] Add optional fields:
  - `engine_variant`
  - `agentic_tool_loop.model_steps`
  - `agentic_tool_loop.tool_calls`
  - `agentic_tool_loop.blocked_tool_calls`
  - `agentic_tool_loop.guardrails`
  - `agentic_tool_loop.latency_ms`
  - `agentic_tool_loop.token_usage`

- [ ] Admin UI shows a compact German section:
  - "Engine"
  - "Tool-Aufrufe"
  - "Blockierte Tools"
  - "Guardrails"
  - "Latenz"

- [ ] Do not dump raw private memory or full prompt context.

Run:

```bash
npx playwright test tests/chat-debug-trace.spec.ts --reporter=line
```

## Task 11: Turn Compare Lab Into Classic vs Tool Loop

**Files:**
- Modify: `src/lib/agent/compare/types.ts`
- Modify: `src/lib/agent/compare/run-shadow-agent.ts`
- Modify: `src/lib/agent/compare/run-agentic-tool-loop.ts`
- Modify: `src/app/api/labs/agent-compare/route.ts`
- Modify: `src/components/labs/agent-compare-lab.tsx`
- Test: `tests/agent-compare-api.spec.ts`
- Test: `tests/agent-compare-product-trace.spec.ts`

- [ ] Use canonical systems:

```ts
export type CompareSystem = "classic" | "tool_loop"
```

- [ ] Add compatibility mapping for old judgment records if needed:
  - old `current` -> `classic`
  - old `agent` -> `tool_loop`

- [ ] Add multi-turn request support:

```ts
type AgentCompareRequest =
  | { prompt: string; userId?: string; scenarioId?: string; blinded?: boolean }
  | { turns: string[]; userId?: string; scenarioId?: string; blinded?: boolean }
```

- [ ] In blinded mode, hide engine names until after judgment.

- [ ] UI labels in German:
  - "Variante A"
  - "Variante B"
  - "Aufloesen"
  - "Mehrturn-Test"
  - "Tool-Spur"

Run:

```bash
npx tsx --test tests/agent-compare-api.spec.ts tests/agent-compare-product-trace.spec.ts
```

## Task 12: Add Golden And Held-Out Compare Sets

**Files:**
- Modify: `src/lib/agent/compare/prompt-packs.ts`
- Modify: `tests/agent-compare-runner.spec.ts`
- Create: `src/lib/agent/compare/held-out-turns.ts` or a local dev-only fixture path if real turns must stay private

- [ ] Add crafted multi-turn chains:
  - routine -> typoed shampoo product ask -> why not deep cleansing
  - leave-in product ask -> "which is lighter?" -> usage follow-up
  - routine simplification -> mask/conditioner decision -> summary

- [ ] Add a starter crafted set from `plans/2026-05-05-agentic-tool-loop-eval-seed.md`.

- [ ] Add held-out real historical turns only when they are available from user testing. The prototype does not need to block on 25 real turns, but production rollout does.

- [ ] Mark each case with expected failure-class coverage.

Run:

```bash
npx tsx --test tests/agent-compare-runner.spec.ts
```

## Task 13: Rollout Metrics And Safety

**Files:**
- Modify: `docs/langfuse-quality-loop.md` or add rollout notes to the PR
- Test: no dedicated unit test unless helper code is added

- [ ] Compare lab must record:
  - blinded winner
  - failure bucket
  - critical product-claim failure yes/no
  - latency
  - model steps
  - tool calls

- [ ] Rollout gate:
  - at least 50 blinded judgments
  - at least 25 held-out real historical turns
  - two reviewers or explicit single-reviewer caveat
  - `semantic_state_conflict` + `tool_not_called` failures reduced by at least 50%
  - wins exceed losses by at least 15 percentage points, excluding ties
  - zero critical product-claim failures
  - p50 latency within +25% of classic and p95 within +35%

- [ ] Rollback:
  - flip `CHAT_AGENT_ENGINE=classic`
  - traces and state transitions preserve `updated_by_engine`
  - classic ignores unknown tool-loop state metadata

## Task 14: Production Wiring After Compare-Lab Readiness

**Files:**
- Modify: `src/lib/agent/production/chat-pipeline.ts`
- Test: `tests/agent-production-chat-pipeline.spec.ts`

- [ ] Do this task only after Compare Lab quality is good enough for a controlled rollout.

- [ ] Add engine resolver:

```ts
CHAT_AGENT_ENGINE=classic
```

Allowed values:

- `classic`
- `tool_loop`

- [ ] Default to `classic`.

- [ ] Production chat uses only the env/default unless an explicit internal dev/test hook exists.

- [ ] Keep current selected-product card behavior.

- [ ] Add tests for:
  - default engine is classic
  - flagged engine uses tool loop
  - tool-loop product results still attach cards
  - fallback returns a safe answer and does not break streaming

Run:

```bash
npx tsx --test tests/agent-production-chat-pipeline.spec.ts tests/agentic-tool-loop.spec.ts
```

## Task 15: Verification Suite

**Automated checks:**

- [ ] Focused Compare Lab prototype tests:

```bash
npx tsx --test tests/agentic-tool-loop.spec.ts tests/agent-compare-api.spec.ts tests/agent-compare-product-trace.spec.ts tests/agent-compare-runner.spec.ts tests/conversation-state.spec.ts tests/chat-debug-trace.spec.ts
```

- [ ] After Task 14 production wiring, also run:

```bash
npx tsx --test tests/agent-production-chat-pipeline.spec.ts
```

- [ ] Agent suite:

```bash
npm run test:agent
```

- [ ] Typecheck:

```bash
npm run typecheck
```

- [ ] Lint:

```bash
npm run lint
```

- [ ] Build:

```bash
npm run build
```

**Manual/browser checks:**

- [ ] Start worktree server:

```bash
npm run dev:worktree
```

- [ ] Open:

```text
http://localhost:<worktree-port>/labs/agent-compare
```

- [ ] Run blinded comparisons on crafted and held-out sets.

- [ ] Ready-check is required before shipping because this touches recommendations, chat trust, and user-facing answer quality.

## Execution Handoff

Use `superpowers:subagent-driven-development`.

Suggested worker split:

1. Worker A: tool-loop types, strict tool schemas, model client, runtime tests.
2. Worker B: state validation, trace shape, compare-lab adapter.
3. Worker C: compare lab UI/API, blinded/multi-turn support, prompt sets, rollout metrics.
4. Worker D, later only after lab readiness: production chat engine flag.
