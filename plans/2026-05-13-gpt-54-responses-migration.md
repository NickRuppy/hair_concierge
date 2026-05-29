# GPT-5.4 Responses Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebase Hair Concierge's production recommendation chat on GPT-5.4-class Responses API architecture while preserving deterministic recommendation contracts, German answer quality, safety, traces, evals, and rollback.

**Architecture:** Introduce explicit model policy and a provider-neutral agentic loop item model, then implement a GPT-5.4 Responses model client behind the existing production pipeline. Keep deterministic tools authoritative and keep the existing Chat Completions client as a fallback/compare path until evals prove the Responses path is ready.

**Tech Stack:** Next.js, TypeScript, OpenAI SDK `openai@^6.35.0`, Responses API, Chat Completions fallback, Langfuse/OpenTelemetry, Node test runner, existing agentic tool loop and Supabase-backed chat pipeline.

---

**Spec:** `docs/superpowers/specs/2026-05-13-gpt-54-responses-migration-design.md`

**User situation:** The current recommendation engine was optimized tactically for GPT-4o. The product should now be forward-looking and stable around GPT-5.4/5.4-mini for the next weeks or months.

**Promised end-state:** Production recommendation chat runs through a GPT-5.4-native Responses path with explicit model routing, reasoning effort, structured output contracts, traces, evals, and rollback.

## Target File Map

- Modify: `src/lib/openai/chat.ts`
  - Keep Chat Completions fallback constants, but stop treating them as the universal model defaults.
- Create: `src/lib/openai/model-policy.ts`
  - Centralize GPT-5.4 snapshot IDs, aliases, reasoning effort, verbosity, endpoint selection, env overrides, and fallback model names.
- Create: `src/lib/openai/responses.ts`
  - Thin Responses helper functions and usage extraction helpers.
- Modify: `src/lib/langfuse/client.ts`
  - Confirm/extend observed OpenAI client usage for `responses.create`; add a safe fallback if Langfuse wrapper does not capture Responses metadata.
- Modify: `src/lib/agent/orchestrator/agentic-tool-loop-types.ts`
  - Add provider-neutral model item/tool types so the loop is not Chat-message-shaped forever.
- Modify: `src/lib/agent/orchestrator/tool-definitions.ts`
  - Add conversion helpers or parallel Responses tool definitions using `OpenAI.Responses.FunctionTool`.
- Modify: `src/lib/agent/orchestrator/model-client.ts`
  - Keep existing Chat client, add GPT-5.4 Responses client, route by model policy.
- Modify: `src/lib/agent/orchestrator/run-agentic-tool-turn.ts`
  - Move from Chat-message appends to provider-neutral items, then let model clients adapt to Chat or Responses.
- Modify: `src/lib/agent/production/chat-pipeline.ts`
  - Wire production to the Responses client behind an env-controlled rollout flag and update trace prompt snapshots.
- Modify: `src/lib/rag/debug-trace.ts`, `src/lib/types.ts`
  - Add endpoint/model policy/reasoning usage fields to traces.
- Modify: `scripts/eval-chat/judge.ts`, `scripts/eval-chat/types.ts`, `scripts/eval-chat/report.ts`
  - Add model-policy-aware judge configuration and cost/latency fields.
- Modify: `tests/agentic-tool-loop.spec.ts`, `tests/agent-production-chat-pipeline.spec.ts`, `tests/chat-debug-trace.spec.ts`
  - Cover Responses client conversion, production wiring, trace metadata, and fallback.
- Add: `tests/openai-model-policy.spec.ts`
  - Unit tests for model policy/env behavior.
- Add: `tests/agent-responses-model-client.spec.ts`
  - Unit tests for Responses tool conversion and output parsing.

## Scope Boundaries

In scope:

- Production recommendation chat and Compare Lab model-client plumbing.
- GPT-5.4 model policy, Responses tool loop, traces, evals, fallback.
- Prompt tightening only where needed for GPT-5.4 outcome-first behavior.

Out of scope:

- Embedding model changes.
- Offline ingestion/cleanup script migration, except eval judge configuration.
- Recommendation category ranking rewrites.
- Agents SDK adoption.
- GPT-5.5 migration.

## Task 1: Centralize GPT-5.4 Model Policy

**Goal:** Remove scattered production model assumptions and make GPT-5.4 snapshots the explicit long-run baseline.

**Files:**
- Create: `src/lib/openai/model-policy.ts`
- Modify: `src/lib/openai/chat.ts`
- Test: `tests/openai-model-policy.spec.ts`

- [ ] Create `tests/openai-model-policy.spec.ts` with cases for default production snapshots, env overrides, invalid env fallback, and escalation policy.

Expected assertions:

```ts
assert.equal(getOpenAIModelPolicy().agent.model, "gpt-5.4-mini-2026-03-17")
assert.equal(getOpenAIModelPolicy().agent.reasoningEffort, "low")
assert.equal(getOpenAIModelPolicy().escalation.model, "gpt-5.4-2026-03-05")
assert.equal(getOpenAIModelPolicy().endpoint, "responses")
```

- [ ] Run the focused test and confirm it fails because `src/lib/openai/model-policy.ts` does not exist.

Run:

```bash
npx tsx --test tests/openai-model-policy.spec.ts
```

Expected: FAIL with a module-not-found error.

- [ ] Implement `src/lib/openai/model-policy.ts`.

Required behavior:

```ts
export type OpenAIReasoningEffort = "none" | "low" | "medium" | "high" | "xhigh"
export type OpenAITextVerbosity = "low" | "medium" | "high"
export type OpenAIEndpointMode = "responses" | "chat_completions"

export interface OpenAIModelProfile {
  model: string
  reasoningEffort: OpenAIReasoningEffort
  textVerbosity: OpenAITextVerbosity
}

export interface OpenAIModelPolicy {
  endpoint: OpenAIEndpointMode
  agent: OpenAIModelProfile
  classifier: OpenAIModelProfile
  renderer: OpenAIModelProfile
  escalation: OpenAIModelProfile
  judge: OpenAIModelProfile
  chatFallbackModel: string
}
```

Defaults:

```ts
agent.model = "gpt-5.4-mini-2026-03-17"
classifier.model = "gpt-5.4-mini-2026-03-17"
renderer.model = "gpt-5.4-mini-2026-03-17"
escalation.model = "gpt-5.4-2026-03-05"
judge.model = "gpt-5.4-2026-03-05"
chatFallbackModel = "gpt-4o"
endpoint = "responses"
```

Environment overrides:

```txt
OPENAI_AGENT_MODEL
OPENAI_CLASSIFIER_MODEL
OPENAI_RENDERER_MODEL
OPENAI_ESCALATION_MODEL
OPENAI_JUDGE_MODEL
OPENAI_AGENT_REASONING_EFFORT
OPENAI_AGENT_TEXT_VERBOSITY
OPENAI_CHAT_FALLBACK_MODEL
OPENAI_RECOMMENDATION_ENDPOINT=responses|chat_completions
```

- [ ] Keep `DEFAULT_CHAT_COMPLETION_MODEL = "gpt-4o"` in `src/lib/openai/chat.ts`, but add a comment that it is the Chat fallback default, not the GPT-5.4 production policy.

- [ ] Run:

```bash
npx tsx --test tests/openai-model-policy.spec.ts
npm run typecheck
```

Expected: PASS.

## Task 2: Add Provider-Neutral Tool-Loop Items

**Goal:** Stop encoding the core agentic loop as Chat Completions messages so Responses can become the primary transport.

**Files:**
- Modify: `src/lib/agent/orchestrator/agentic-tool-loop-types.ts`
- Modify: `src/lib/agent/orchestrator/run-agentic-tool-turn.ts`
- Test: `tests/agentic-tool-loop.spec.ts`

- [ ] Add provider-neutral item types:

```ts
export type AgenticModelInputItem =
  | { type: "message"; role: "user" | "assistant"; content: string }
  | { type: "function_call"; id: string; callId: string; name: string; arguments: Record<string, unknown> }
  | { type: "function_call_output"; callId: string; output: unknown }
```

- [ ] Extend `AgenticToolLoopModelClient.runStep` to accept `items: AgenticModelInputItem[]` while temporarily keeping `messages` optional for the existing Chat client during the transition.

- [ ] Add a test that `runAgenticToolTurn` passes neutral items to a fake model client after one executed tool call. The test should assert a `function_call` item and a matching `function_call_output` item share the same `callId`.

- [ ] Update `buildInitialMessages` or replace it with `buildInitialModelItems` in `run-agentic-tool-turn.ts`.

The initial items must preserve:

- JSON context packet with `latest_user_message`, `recent_messages`, `conversation_state`, `user_context`, `current_turn_context`, `consultation_brief`, and `hard_rules`
- budgeted recent messages
- final raw user message

- [ ] Replace `appendToolResultMessages` with `appendToolResultItems`.

The appended item pair must preserve:

- model tool call id
- function name
- JSON-normalized tool input
- JSON output envelope with `tool_name`, `output_key`, `hard_rules`, `answer_context`, and `output`

- [ ] Run:

```bash
npx tsx --test tests/agentic-tool-loop.spec.ts
npm run typecheck
```

Expected: PASS.

## Task 3: Convert Tool Definitions For Responses

**Goal:** Use strict Responses function tools while keeping the existing Chat tool definitions available for fallback.

**Files:**
- Modify: `src/lib/agent/orchestrator/tool-definitions.ts`
- Test: `tests/agent-responses-model-client.spec.ts`

- [ ] Add tests for `buildAgenticResponsesToolDefinitions({ includeAdvisorGuidance: true })`.

Assertions:

- each tool has `type: "function"`
- each tool has top-level `name`
- each tool has top-level `parameters`
- each tool has `strict: true`
- no tool has a nested `function` object
- `submit_final_answer` remains available

- [ ] Implement `buildAgenticResponsesToolDefinitions`.

Conversion rule:

```ts
{
  type: "function",
  name: chatTool.function.name,
  description: chatTool.function.description,
  parameters: chatTool.function.parameters,
  strict: chatTool.function.strict ?? true,
}
```

- [ ] Run:

```bash
npx tsx --test tests/agent-responses-model-client.spec.ts
npm run typecheck
```

Expected: PASS.

## Task 4: Implement The GPT-5.4 Responses Model Client

**Goal:** Add the production-ready Responses client behind the existing `AgenticToolLoopModelClient` interface.

**Files:**
- Create: `src/lib/openai/responses.ts`
- Modify: `src/lib/agent/orchestrator/model-client.ts`
- Test: `tests/agent-responses-model-client.spec.ts`

- [ ] Add tests for parsing Responses output:

Cases:

- one `function_call` item becomes `type: "tool_calls"`
- multiple `function_call` items become multiple tool calls
- a message output becomes `type: "message"`
- a malformed function `arguments` string becomes `{}` rather than throwing
- usage metadata is available for tracing when returned

- [ ] Implement `src/lib/openai/responses.ts` helpers:

```ts
export function extractResponsesText(response: OpenAI.Responses.Response): string
export function extractResponsesFunctionCalls(response: OpenAI.Responses.Response): AgenticModelToolCall[]
export function extractResponsesUsage(response: OpenAI.Responses.Response): OpenAIUsageSnapshot
```

Usage snapshot fields:

```ts
model
endpoint
response_id
input_tokens
output_tokens
reasoning_tokens
cached_input_tokens
```

- [ ] Implement `createOpenAIResponsesAgenticToolLoopModelClient` in `model-client.ts`.

Request shape:

```ts
client.responses.create({
  model: policy.agent.model,
  instructions: systemPrompt,
  input: convertAgenticItemsToResponsesInput(items),
  tools: buildAgenticResponsesToolDefinitions({ includeAdvisorGuidance: true }),
  reasoning: { effort: policy.agent.reasoningEffort },
  text: { verbosity: policy.agent.textVerbosity },
  store: false,
})
```

- [ ] Implement `convertAgenticItemsToResponsesInput`.

Mapping:

- message item -> `{ role, content }`
- function call item -> `{ type: "function_call", call_id, name, arguments: JSON.stringify(arguments) }`
- function output item -> `{ type: "function_call_output", call_id, output: JSON.stringify(output) }`

- [ ] Keep `createOpenAIAgenticToolLoopModelClient` as the Chat fallback client and make the new Responses client separately exported.

- [ ] Run:

```bash
npx tsx --test tests/agent-responses-model-client.spec.ts
npm run typecheck
```

Expected: PASS.

## Task 5: Wire Production To Responses With Rollback

**Goal:** Make production recommendation chat use Responses by default, with an env flag to return to Chat Completions.

**Files:**
- Modify: `src/lib/agent/production/chat-pipeline.ts`
- Modify: `src/lib/agent/compare/run-agentic-tool-loop.ts`
- Test: `tests/agent-production-chat-pipeline.spec.ts`
- Test: `tests/agent-compare-api.spec.ts`

- [ ] Add tests proving default production dependencies use the Responses model client when `OPENAI_RECOMMENDATION_ENDPOINT` is unset.

- [ ] Add tests proving `OPENAI_RECOMMENDATION_ENDPOINT=chat_completions` uses the existing Chat client.

- [ ] Update `runProductionAgentPipeline` dependency construction:

```ts
const policy = getOpenAIModelPolicy()
const defaultModelClient =
  policy.endpoint === "responses"
    ? createOpenAIResponsesAgenticToolLoopModelClient({ policy })
    : createOpenAIAgenticToolLoopModelClient({ model: policy.chatFallbackModel })
```

- [ ] Update prompt snapshot model fields to report the active policy model and endpoint.

- [ ] Run:

```bash
npx tsx --test tests/agent-production-chat-pipeline.spec.ts tests/agent-compare-api.spec.ts
npm run typecheck
```

Expected: PASS.

## Task 6: Update Tracing For Reasoning And Responses

**Goal:** Make GPT-5.4 behavior inspectable before rollout.

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/lib/rag/debug-trace.ts`
- Modify: `src/lib/agent/orchestrator/agentic-tool-loop-types.ts`
- Modify: `src/lib/agent/production/chat-pipeline.ts`
- Test: `tests/chat-debug-trace.spec.ts`
- Test: `tests/agent-production-chat-pipeline.spec.ts`

- [ ] Add trace fields:

```ts
endpoint: "responses" | "chat_completions"
model_policy: {
  agent_model: string
  reasoning_effort: string | null
  text_verbosity: string | null
}
usage: {
  input_tokens: number | null
  output_tokens: number | null
  reasoning_tokens: number | null
  cached_input_tokens: number | null
}
openai_response_id: string | null
```

- [ ] Add tests that fake Responses usage appears in the projected app trace.

- [ ] If `@langfuse/openai` does not automatically observe `responses.create`, add an explicit Langfuse span around model steps with generation name `agentic-tool-loop-responses-step`.

- [ ] Run:

```bash
npx tsx --test tests/chat-debug-trace.spec.ts tests/agent-production-chat-pipeline.spec.ts
npm run typecheck
```

Expected: PASS.

## Task 7: Tighten Prompts For GPT-5.4 Without Re-Bloating Them

**Goal:** Keep the GPT-5.4 prompt outcome-first and contract-heavy, not step-by-step GPT-4o scaffolding.

**Files:**
- Modify: `src/lib/agent/orchestrator/prompt.ts`
- Test: `tests/agentic-tool-loop.spec.ts`
- Test: `tests/agent-final-render-prompt.spec.ts`

- [ ] Review `AGENTIC_TOOL_LOOP_PROMPT` for instructions that micromanage order rather than defining success criteria.

- [ ] Preserve hard invariants:

- product facts only from `select_products`
- routine structure only from `build_or_fix_routine`
- no medical diagnosis or treatment claims
- one final `submit_final_answer`
- German user-facing answer
- no internal labels in output

- [ ] Add a compact GPT-5.4-oriented success criteria block:

```txt
Erfolg fuer diesen Turn:
- Die aktuelle Nutzerbewegung ist beantwortet.
- Noetige Produkt-, Routine- oder Guidance-Fakten wurden ueber Tools geholt.
- Fehlende Informationen werden nur gefragt, wenn sie die Empfehlung materiell aendern.
- Produktaussagen sind geerdet.
- Medizinisch angrenzende Kopfhaut-/Haarausfallthemen bleiben vorsichtig und ohne Diagnose.
- Der Turn endet mit einer kurzen, hilfreichen deutschen Antwort.
```

- [ ] Do not paste model-family docs into the prompt.

- [ ] Run:

```bash
npx tsx --test tests/agentic-tool-loop.spec.ts tests/agent-final-render-prompt.spec.ts
npm run typecheck
```

Expected: PASS.

## Task 8: Upgrade Eval Judge And Cost/Latency Reporting

**Goal:** Decide rollout from measured behavior, not taste.

**Files:**
- Modify: `scripts/eval-chat/judge.ts`
- Modify: `scripts/eval-chat/types.ts`
- Modify: `scripts/eval-chat/report.ts`
- Modify: `scripts/eval-chat/run.ts`
- Test: `tests/eval-chat` if present, otherwise add focused Node tests near `tests/eval-chat-report.spec.ts`

- [ ] Add judge model configuration from `getOpenAIModelPolicy().judge`.

- [ ] Move judge JSON responses to Structured Outputs or Responses parse when feasible. If this is too large for this task, keep Chat JSON mode but change the model to the configured GPT-5.4 judge and document the follow-up in the report.

- [ ] Extend eval report with:

- endpoint
- model
- reasoning effort
- latency per turn
- input tokens
- output tokens
- reasoning tokens
- cached input tokens
- tool call count
- blocked tool call count

- [ ] Add CLI switches:

```txt
--endpoint responses|chat_completions
--agent-model <model>
--reasoning-effort none|low|medium|high|xhigh
```

- [ ] Run:

```bash
npx tsx scripts/eval-chat/run.ts --ci-smoke --skip-judge
```

Expected: eval harness runs without requiring judge calls.

## Task 9: Run A GPT-4o vs GPT-5.4-mini Migration Eval

**Goal:** Prove the new baseline is safer and more useful before production rollout.

**Files:**
- Modify if needed: `scripts/eval-chat/fixtures.ts`
- Output: `tests/reports/`

- [ ] Run baseline Chat fallback:

```bash
OPENAI_RECOMMENDATION_ENDPOINT=chat_completions \
OPENAI_CHAT_FALLBACK_MODEL=gpt-4o \
npm run dev:worktree
```

In another shell:

```bash
npx tsx scripts/eval-chat/run.ts --ci-smoke --langfuse-run-name gpt-4o-chat-baseline
```

- [ ] Run GPT-5.4-mini Responses candidate:

```bash
OPENAI_RECOMMENDATION_ENDPOINT=responses \
OPENAI_AGENT_MODEL=gpt-5.4-mini-2026-03-17 \
OPENAI_AGENT_REASONING_EFFORT=low \
npm run dev:worktree
```

In another shell:

```bash
npx tsx scripts/eval-chat/run.ts --ci-smoke --langfuse-run-name gpt-54-mini-responses-low
```

- [ ] If low effort fails on multi-step, rerun only failing scenarios with `OPENAI_AGENT_REASONING_EFFORT=medium`.

- [ ] Add a short report in `tests/reports/` comparing:

- pass/fail count
- LLM judge/rubric scores
- safety failures
- product grounding failures
- tool-call correctness
- median and p95 latency
- estimated token cost
- notable regressions

## Task 10: Rollout Guardrails And Readiness Check

**Goal:** Ship the migration only when rollback and trust-sensitive verification are real.

**Files:**
- Modify: deployment env documentation or `README.md` only if there is already a suitable operational section
- Use: `ready-check`

- [ ] Confirm production env variables:

```txt
OPENAI_RECOMMENDATION_ENDPOINT=responses
OPENAI_AGENT_MODEL=gpt-5.4-mini-2026-03-17
OPENAI_AGENT_REASONING_EFFORT=low
OPENAI_AGENT_TEXT_VERBOSITY=low
OPENAI_ESCALATION_MODEL=gpt-5.4-2026-03-05
OPENAI_JUDGE_MODEL=gpt-5.4-2026-03-05
```

- [ ] Confirm rollback env variables:

```txt
OPENAI_RECOMMENDATION_ENDPOINT=chat_completions
OPENAI_CHAT_FALLBACK_MODEL=gpt-4o
```

- [ ] Run full automated verification:

```bash
npx tsx --test tests/openai-model-policy.spec.ts tests/agent-responses-model-client.spec.ts
npx tsx --test tests/agentic-tool-loop.spec.ts tests/agent-production-chat-pipeline.spec.ts
npx tsx --test tests/agent-final-render-prompt.spec.ts tests/chat-debug-trace.spec.ts
npm run test:agent
npm run typecheck
git diff --check
```

- [ ] Run `ready-check` because this touches recommendations, copy, trust, and safety-adjacent behavior.

Manual readiness criteria:

- a product recommendation never invents product data
- a routine answer does not invent routine steps
- dry shampoo and peeling caveats remain conservative
- hair loss/scalp symptom prompts avoid diagnosis and treatment claims
- German answer tone remains user-ready
- traces are sufficient to explain every tool call and final product card

## Execution Handoff

Plan complete. Recommended next skill: `superpowers:subagent-driven-development`, starting with Task 1 and Task 2 as separate workers because their write sets are mostly disjoint.
