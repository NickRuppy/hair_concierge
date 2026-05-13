# Tool Loop Production Integration V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the production recommendation/chat engine behind `/api/chat` with the completed agentic tool-loop engine while preserving the existing production shell: persistence, SSE envelope, pseudo-streaming UX, feedback/download hooks, Langfuse tracing, title generation, memory extraction, and tester-debug workflows.

**Architecture:** `/api/chat` remains the stable front door. `runProductionAgentPipeline` becomes a production adapter around `runAgenticToolTurn`, with `load_advisor_guidance`, `select_products`, and `build_or_fix_routine` as the engine tools. Runtime tool-loop traces stay rich in-process; app/DB traces receive a sanitized projection. Classic routing/render/state logic is removed from the production path, with useful shared behavior ported into tool-loop/shared helpers instead of kept as a hidden fallback.

**Tech Stack:** Next.js App Router, TypeScript, OpenAI Chat Completions tool calling, Supabase persistence, Langfuse tracing, Node test runner via `npx tsx --test`, existing Hair Concierge deterministic product/routine engines.

---

## Spec And Decision Context

**Primary spec:** `docs/superpowers/specs/2026-05-05-agentic-tool-loop-design.md`

**Related completed plans and docs:**
- `plans/2026-05-05-agentic-tool-loop.md`
- `plans/2026-05-12-agentic-tool-loop-parity.md`
- `plans/2026-05-12-tool-loop-production-integration.md` (v1, superseded by this plan)
- `docs/agentic-tool-loop-parity-matrix.md`
- `docs/langfuse-quality-loop.md`
- `docs/chat-quality-review-rubric.md`

**Current worktree:** `/Users/nick/AI_work/hair_conscierge/.worktrees/context-packet-final-composer`

**Current branch:** `codex/context-packet-final-composer`

**Current review note:** This branch is already dirty and behind `origin/main`; implementation should start only after the current Compare Lab/tool-loop work is committed or intentionally carried forward in a fresh production-integration worktree.

## Settled Decisions

- Full replacement: no staged rollout, no Classic fallback, no product-behavior engine flag.
- Keep `/api/chat` outer contract and current pseudo-streaming/loading UX.
- Preserve production plumbing unless it directly depends on Classic internals.
- Re-plug Classic-dependent plumbing to the new tool-loop result shape.
- Tool loop owns short-term conversation state via `result.state_transition`.
- Failed tool-loop turns get one terminal/protocol repair attempt, then persist a visible assistant message.
- Stable visible failure copy:
  - `Entschuldige, ich konnte deine Frage gerade nicht eindeutig genug einordnen. Formulier sie bitte noch einmal etwas konkreter, dann helfe ich dir direkt weiter.`
- App DB stores structured/sanitized new-engine trace data.
- Raw prompt/message detail should primarily live in Langfuse when configured, not redundantly in app DB.
- Debug/download/admin views expose real new-engine fields, not old route fields kept for nostalgia.
- Classic code is archived through Git recovery point, not copied into a local archive folder.
- Consultation brief is intentionally always-on for production tool-loop turns unless a test proves it is too slow or noisy.

## Explicit Non-Goals

- No memory-quality redesign.
- No new LLM classification step.
- No token streaming rewrite.
- No Classic fallback path.
- No staged rollout.
- No pairwise category-comparison matrix.
- No deterministic recommendation/routine rewrite unless required by adapter contract tests.
- No answer-text parsing for product names.
- No operational kill-switch in this plan. If desired later, it should be an ops-only graceful-disable path, not a Classic fallback.

## New Production Flow

```text
Old:
/api/chat
  -> runProductionAgentPipeline
    -> load profile/history/memory/state
    -> runShadowAgentTurn
      -> classify route
      -> execute Classic tools
      -> render final answer with AGENT_FINAL_RENDER_PROMPT
    -> computeConversationStateTransition
    -> build Classic-shaped trace
  -> SSE + persistence + feedback/download + Langfuse + memory/title

New:
/api/chat
  -> runProductionAgentPipeline
    -> load profile/history/memory/state
    -> runAgenticToolTurn
      -> model chooses load_advisor_guidance/select_products/build_or_fix_routine
      -> deterministic tools execute
      -> model submits final answer + state_patch
      -> code validates state transition
      -> one terminal/protocol repair if needed
    -> project runtime tool-loop trace into app/DB trace
    -> derive PipelineResult compatibility fields from real tool-loop facts
  -> same SSE + persistence + feedback/download + Langfuse + memory/title shell
```

## PipelineResult Field Migration Table

`/api/chat` currently consumes all fields in `PipelineResult`. The production adapter must map every field explicitly.

| `PipelineResult` field | Current Classic source | New tool-loop source | Notes |
|---|---|---|---|
| `stream` | Classic rendered final answer | `createTextStream(toolLoopResult.final_answer)` | Preserve pseudo-streaming wrapper. |
| `conversationId` | input conversation id | input conversation id | Required before orchestration. |
| `intent` | `mapAgentIntent(route)` | `deriveToolLoopIntent(toolLoopResult)` | Derive from executed tools and state: `select_products` -> `product_recommendation`; `build_or_fix_routine` -> `routine_help`; only `load_advisor_guidance` -> `hair_care_advice`; visible failure -> `general_chat`. |
| `matchedProducts` | intersection of selected products and Classic render packet | validated `submit_final_answer.product_ids` intersected with selected products; fallback selected order | Add optional terminal `product_ids`. Route still slices to 3. |
| `sources` | RAG/retrieval sources | `[]` | Tool-loop uses product/guidance tools, not citation retrieval. |
| `routerDecision` | Classic route packet + selected product policy | `buildToolLoopRouterDecision(toolLoopResult)` | Synthetic compatibility object for existing SSE/persistence shell, not a router source of truth. |
| `routerDecision.confidence` | route confidence | `1` for valid success, `0.5` if repair attempted, `0` for visible failure | This is operational confidence, not model route confidence. |
| `routerDecision.retrieval_mode` | `"agent_engine"` or hybrid | `"agentic_tool_loop"` | Update downstream debug labels. |
| `routerDecision.response_mode` | selected product/routine missing info | `clarify_only` if selected products or routine plan has blocking missing info, or if visible failure; otherwise `answer_direct` | Keeps product-card gate stable. |
| `conversationStateTransition` | `computeConversationStateTransition(...)` | `toolLoopResult.state_transition` | Must have `updated_by_engine: "tool_loop"`. On visible failure, previous and next state remain equal. |
| `categoryDecision` | selected-products runtime/category engine | from captured `SelectProductsToolResult.runtime` when `select_products` executes | Keep `onResult` holder in production tool wrapper. |
| `engineTrace` | selected-products runtime or rebuilt engine runtime | from captured `SelectProductsToolResult.runtime`; rebuild only if no selection and existing shell requires a neutral trace | Prefer null/neutral over fake Classic trace. |
| `retrievalSummary` | retrieval debug count | `{ final_context_count: 0 }` | Tool-loop does not use old RAG retrieval. |
| `debugTrace` | `buildPipelineTraceDraft(...)` with Classic fields | `buildPipelineTraceDraft(...)` with `engine_variant: "tool_loop"` and projected `agentic_tool_loop` | App trace must be sanitized. |
| optional `visibleFailure` | absent | `toolLoopResult.trace.visible_failure` | Add to `PipelineResult` only if route needs it for persistence/memory behavior. |

## Runtime Trace To App/DB Trace Projection

There are two different trace shapes and they must stay intentionally separate:

- Runtime trace: `src/lib/agent/orchestrator/agentic-tool-loop-types.ts`
  - rich, in-process, may contain raw tool inputs/outputs and model steps
- App/DB trace: `src/lib/types.ts`
  - sanitized, compact, safe for `conversation_turn_traces` and admin/debug UI

Add a projection helper:

```ts
export function projectAgenticToolLoopTraceForApp(params: {
  runtimeTrace: RuntimeAgenticToolLoopTrace
  selectedProducts: SelectedProductsProjection | null
  routinePlan: BuildOrFixRoutineProjection | null
  latencyMs: number
}): AppAgenticToolLoopTrace
```

Projection rules:

| Runtime field | App/DB field | Rule |
|---|---|---|
| `engine_variant` | `ChatTurnTrace.engine_variant` and app trace summary | Required as `"tool_loop"`, never default to Classic. |
| `answer_composition_mode` | `agentic_tool_loop.answer_composition_mode` | Store enum string. |
| `model_steps` | `model_steps[]` | Store `step_index`, `type`, `tool_call_names`, and optional finish/status only. Drop raw messages and raw tool arguments. |
| `tool_calls[]` | `tool_calls[]` | Store `id`, `name`, `status: "executed"`, `input_summary`, `output_summary`, optional `latency_ms`. Summaries are capped at ~240 chars. |
| `blocked_tool_calls[]` | `blocked_tool_calls[]` | Store `id`, `name`, `reason`. |
| `guardrails[]` | `guardrails[]` | Store as-is. |
| `repair_attempts[]` | `repair_attempts[]` | Store closed-enum reason and short instruction label, not full raw prompt if avoidable. |
| `failure_stage` | `failure_stage` | Closed enum. |
| `visible_failure` | `visible_failure` | Boolean. |
| `advisor_guidance.loaded_guidance_ids` | `loaded_guidance_ids[]` | Store IDs only. Do not store full guidance body in DB trace. |
| `answer_context` | `answer_context_summary` | Store capsule IDs / section labels only. Do not store full context blob. |
| `consultation_brief` | `consultation_brief_summary` | Store topic/category IDs and brief counts only. |
| `token_usage` | `token_usage` | Store totals if available. |
| raw tool `output` | `output_summary` | Summarize product counts/category/policy; routine step labels/count; guidance IDs. Drop full profile/tool output. |

Closed failure-stage enum:

```ts
export type AgenticToolLoopFailureStage =
  | "missing_terminal_answer"
  | "multiple_terminal_answers"
  | "terminal_with_other_tool_calls"
  | "max_executable_tool_calls"
  | "max_model_steps"
  | "repair_failed"
  | null
```

## Product Card Semantics

Today Classic product cards are filtered by what the render packet surfaced. Tool-loop answers do not have a render packet, so the new contract should be explicit.

Chosen approach:

- Extend `submit_final_answer` schema with optional `product_ids: string[]`.
- When `select_products` has run:
  - validate `product_ids` against selected product IDs,
  - preserve the submitted order,
  - fallback to selected-products order if `product_ids` is missing or invalid,
  - route still applies the existing `slice(0, 3)`.
- When `select_products` has not run:
  - ignore `product_ids`.

This keeps product cards aligned with the answer without brittle answer-text parsing.

## Repair Semantics

The loop already has in-loop nudges:

- free-text step before final step -> asks model to use `submit_final_answer`
- no executable tool accepted -> asks model to answer with `submit_final_answer`
- mixed terminal + executable tool -> blocks terminal and continues with executable tool path

The new repair is only a final terminal/protocol repair after normal loop opportunities are exhausted.

Repair applies to:

- `multiple_terminal_answers`
- `max_executable_tool_calls`
- `max_model_steps_or_missing_terminal_answer`
- unresolved `terminal_with_other_tool_calls` only if the loop cannot reach a clean terminal answer

Repair does not apply to:

- `no_catalog_match`
- valid clarification answers
- product/routine quality dissatisfaction
- deterministic tool policy decisions
- normal conceptual guidance answers

Repair instruction:

```text
Schliesse diesen Turn jetzt ausschliesslich mit submit_final_answer ab. Nutze die bereits geladenen Tool-Ergebnisse und erfinde keine neuen Produkt- oder Routinefakten. Rufe kein weiteres Tool auf.
```

If repair fails, return the stable visible failure copy and keep the previous conversation state unchanged.

## Target File Map

- Modify `src/lib/agent/production/chat-pipeline.ts`
  - Replace Classic orchestration with tool-loop production adapter.
  - Add `deriveToolLoopIntent`, `buildToolLoopRouterDecision`, product-card projection, and captured `SelectProductsToolResult` handling.
  - Remove production-only Classic helpers once tests are migrated.

- Modify `src/lib/agent/orchestrator/run-agentic-tool-turn.ts`
  - Add optional terminal `product_ids`.
  - Add final protocol repair.
  - Add runtime trace metadata for repair/failure.
  - Keep internal normalization/enrichment in the loop.

- Modify `src/lib/agent/orchestrator/tool-definitions.ts`
  - Extend `submit_final_answer` schema with `product_ids`.
  - Keep strict schema valid: every property must be required if strict mode requires it, using nullable/empty defaults where needed.

- Modify `src/lib/agent/orchestrator/agentic-tool-loop-types.ts`
  - Extend runtime terminal answer and runtime trace types.
  - Define closed failure-stage type.

- Modify `src/lib/types.ts`
  - Extend app/DB `AgenticToolLoopTrace` with sanitized fields only.
  - Do not collapse it into the runtime trace type.

- Modify `src/lib/rag/debug-trace.ts`
  - Add `projectAgenticToolLoopTraceForApp`.
  - Make `engine_variant` required for new trace drafts or remove the default-to-Classic footgun.
  - Update SSE/Langfuse debug summary for tool-loop native fields.

- Modify `src/lib/rag/contracts.ts`
  - Keep `PipelineResult` stable.
  - Add `visibleFailure?: boolean` only if `/api/chat` needs it to skip memory/state persistence.

- Modify `src/app/api/chat/route.ts`
  - Preserve SSE event order.
  - Persist visible engine failures as assistant messages with failed trace status.
  - Skip memory extraction on visible engine failure.
  - Title generation may still run from the user message on first-turn visible failures.

- Modify `src/app/admin/conversations/[id]/page.tsx`
  - Render first-class tool-loop trace details.
  - Keep old sections for historical traces only.

- Modify tests:
  - `tests/agentic-tool-loop.spec.ts`
  - `tests/agent-production-chat-pipeline.spec.ts`
  - `tests/chat-debug-trace.spec.ts`
  - `tests/agent-compare-runner.spec.ts` if Compare Lab trace types need alignment

## Archive / Recovery Preparation

- [ ] **Step 1: Create a Git recovery point before removing production Classic wiring**

  After the current Compare Lab/tool-loop work is committed, create:

  ```bash
  git branch archive/classic-agent-before-tool-loop-production
  ```

  Expected: recovery branch points to the last commit before production Classic wiring is removed.

- [ ] **Step 2: Start implementation in a fresh worktree**

  ```bash
  npm run worktree:new -- tool-loop-production-integration
  ```

  Expected: a worktree under `.worktrees/tool-loop-production-integration` on branch `codex/tool-loop-production-integration`.

---

## Task 1: Add Production Adapter Contract Tests First

**Files:**
- Modify: `tests/agent-production-chat-pipeline.spec.ts`

- [ ] **Step 1: Add a success-path tool-loop pipeline test**

  Stub a tool-loop model client returning:

  1. `select_products`
  2. `submit_final_answer` with `product_ids`

  Assert:
  - stream contains the terminal answer,
  - `matchedProducts` is ordered by valid terminal `product_ids`,
  - `debugTrace.engine_variant === "tool_loop"`,
  - `debugTrace.agentic_tool_loop.tool_calls` includes `select_products`,
  - `conversationStateTransition.updated_by_engine === "tool_loop"`,
  - `categoryDecision` and `engineTrace` are populated from captured `SelectProductsToolResult.runtime`.

- [ ] **Step 2: Add product-card fallback test**

  Stub a product recommendation where `submit_final_answer.product_ids` is missing or invalid.

  Assert:
  - `matchedProducts` falls back to deterministic selected-products order,
  - trace records the fallback reason in guardrails or output summary,
  - no answer-text parsing is used.

- [ ] **Step 3: Add conceptual guidance test**

  Stub:

  1. `load_advisor_guidance`
  2. `submit_final_answer`

  Assert:
  - no products are returned,
  - `debugTrace.agentic_tool_loop.loaded_guidance_ids` includes the expected IDs,
  - `intent === "hair_care_advice"`,
  - `routerDecision.response_mode === "answer_direct"`.

- [ ] **Step 4: Add routine test**

  Stub:

  1. `build_or_fix_routine`
  2. `submit_final_answer`

  Assert:
  - routine projection appears in trace,
  - `intent === "routine_help"`,
  - `conversationStateTransition.next_state.active_topic === "routine"`,
  - `updated_by_engine === "tool_loop"`.

- [ ] **Step 5: Add no-Classic-call regression**

  Inject a model client with Classic methods that throw if called:

  ```ts
  {
    classifyRoute: async () => {
      throw new Error("Classic classifyRoute must not be called from production")
    },
    renderFinalAnswer: async () => {
      throw new Error("Classic renderFinalAnswer must not be called from production")
    },
    runStep: async (...) => ...
  }
  ```

  Assert the tool-loop path succeeds without invoking Classic methods.

- [ ] **Step 6: Run the focused test and confirm failure before implementation**

  ```bash
  npx tsx --test tests/agent-production-chat-pipeline.spec.ts
  ```

  Expected before implementation: new tests fail because production still uses the Classic bounded-agent path.

## Task 2: Extend Tool-Loop Terminal Contract

**Files:**
- Modify: `src/lib/agent/orchestrator/tool-definitions.ts`
- Modify: `src/lib/agent/orchestrator/agentic-tool-loop-types.ts`
- Modify: `src/lib/agent/orchestrator/run-agentic-tool-turn.ts`
- Test: `tests/agentic-tool-loop.spec.ts`

- [ ] **Step 1: Add `product_ids` to terminal answer**

  Extend `AgenticTerminalAnswer` with:

  ```ts
  product_ids: string[]
  ```

  If strict tool schema requires all properties in `required`, make `product_ids` required with default `[]` semantics.

- [ ] **Step 2: Parse and cap terminal product IDs**

  In `parseTerminalAnswer`, normalize:

  ```ts
  product_ids: Array.isArray(input.product_ids)
    ? input.product_ids.filter((item): item is string => typeof item === "string").slice(0, 3)
    : []
  ```

- [ ] **Step 3: Preserve terminal product IDs in result**

  Add a result field if needed:

  ```ts
  surfaced_product_ids: string[]
  ```

  Or keep it on `terminalAnswer` inside trace if the production adapter can access it safely.

- [ ] **Step 4: Add tests**

  Test:
  - valid `product_ids` are preserved,
  - invalid IDs are ignored later by projection,
  - no-products turns use `[]`.

## Task 3: Add Final Protocol Repair Only Where Needed

**Files:**
- Modify: `src/lib/agent/orchestrator/agentic-tool-loop-types.ts`
- Modify: `src/lib/agent/orchestrator/run-agentic-tool-turn.ts`
- Test: `tests/agentic-tool-loop.spec.ts`

- [ ] **Step 1: Add closed repair/failure trace fields**

  Runtime trace:

  ```ts
  repair_attempts: Array<{
    reason: Exclude<AgenticToolLoopFailureStage, null>
    instruction_label: "terminal_protocol_repair"
  }>
  failure_stage: AgenticToolLoopFailureStage
  visible_failure: boolean
  ```

- [ ] **Step 2: Keep existing in-loop nudges unchanged**

  Do not add a repair before the existing free-text/no-tool nudges have had their normal loop chance.

- [ ] **Step 3: Add one final repair call**

  Trigger only for:
  - `multiple_terminal_answers`
  - `max_executable_tool_calls`
  - `max_model_steps_or_missing_terminal_answer`
  - unresolved terminal/tool-call protocol failure

  The repair call may accept only a single clean `submit_final_answer`. It must not execute more tools.

- [ ] **Step 4: Return visible failure after failed repair**

  Use:

  ```text
  Entschuldige, ich konnte deine Frage gerade nicht eindeutig genug einordnen. Formulier sie bitte noch einmal etwas konkreter, dann helfe ich dir direkt weiter.
  ```

  Mark:
  - `visible_failure: true`
  - `failure_stage: "repair_failed"`
  - previous and next conversation state equal

- [ ] **Step 5: Replace old `FALLBACK_ANSWER` copy**

  Ensure old wording with `sauber genug einordnen` no longer appears in user-visible output.

- [ ] **Step 6: Add tests**

  Cover:
  - free-text first response still uses existing in-loop nudge and succeeds,
  - multiple terminal answers triggers final repair,
  - max steps triggers final repair,
  - failed repair returns visible failure copy,
  - deterministic `no_catalog_match` does not trigger protocol repair.

## Task 4: Build The Production Tool-Loop Adapter

**Files:**
- Modify: `src/lib/agent/production/chat-pipeline.ts`

- [ ] **Step 1: Replace Classic orchestration imports**

  Remove production orchestration dependence on:
  - `AGENT_FINAL_RENDER_PROMPT`
  - `runShadowAgentTurn`
  - Classic route packet as source of truth
  - `computeConversationStateTransition`

  Add:
  - `runAgenticToolTurn`
  - `createOpenAIAgenticToolLoopModelClient`
  - `loadAdvisorGuidance`
  - tool-loop trace projection helper

- [ ] **Step 2: Project recent messages**

  ```ts
  const recentMessages = conversationHistory
    .filter((item) => item.role === "user" || item.role === "assistant")
    .map((item) => ({
      role: item.role,
      content: item.content ?? "",
    }))
  ```

- [ ] **Step 3: Keep normalization inside `runAgenticToolTurn`**

  The adapter should pass raw tool-call inputs to the loop-owned input builders. Do not duplicate `buildSelectProductsInput`, `buildRoutineInput`, or `buildAdvisorGuidanceInput` normalization in the adapter.

  The adapter tools should validate only the final executable boundary:
  - product category is supported,
  - routine objective/layer/category is valid,
  - guidance input follows `loadAdvisorGuidance` input contract.

- [ ] **Step 4: Capture full selected-products tool result**

  Keep a holder:

  ```ts
  const selectedProductsHolder: { current: SelectProductsToolResult | null } = { current: null }
  ```

  In the production `select_products` tool wrapper, store the full result so the adapter can derive:
  - `matchedProducts`,
  - `categoryDecision`,
  - `engineTrace`.

- [ ] **Step 5: Call `runAgenticToolTurn`**

  ```ts
  const toolLoopResult = await runAgenticToolTurn({
    message,
    recentMessages,
    modelClient: deps.modelClient ?? createOpenAIAgenticToolLoopModelClient(),
    userContext,
    conversationState,
    tools,
    answerCompositionMode: "inline_context",
  })
  ```

  Production default is `inline_context`; Composer remains out of production unless a later quality/cost review reopens it.

- [ ] **Step 6: Derive all `PipelineResult` fields using the migration table**

  Do not leave any field implicitly Classic-shaped. Add focused helpers:

  ```ts
  deriveToolLoopIntent(...)
  buildToolLoopRouterDecision(...)
  projectToolLoopMatchedProducts(...)
  deriveToolLoopCategoryDecision(...)
  deriveToolLoopEngineTrace(...)
  ```

- [ ] **Step 7: Re-run focused production pipeline tests**

  ```bash
  npx tsx --test tests/agent-production-chat-pipeline.spec.ts
  ```

## Task 5: Project Runtime Trace Into Sanitized App Trace

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/lib/rag/debug-trace.ts`
- Test: `tests/chat-debug-trace.spec.ts`

- [ ] **Step 1: Extend app/DB trace shape**

  Extend the existing app `AgenticToolLoopTrace` in `src/lib/types.ts` with sanitized fields:

  ```ts
  engine_variant: "tool_loop"
  answer_composition_mode: "inline_context" | "composer_context" | "baseline"
  loaded_guidance_ids: string[]
  answer_context_capsule_ids: string[]
  consultation_brief_summary: Record<string, unknown> | null
  repair_attempts: Array<{ reason: string; instruction_label: string }>
  failure_stage: AgenticToolLoopFailureStage
  visible_failure: boolean
  ```

- [ ] **Step 2: Add projection helper**

  Implement `projectAgenticToolLoopTraceForApp(...)` in `src/lib/rag/debug-trace.ts`.

- [ ] **Step 3: Make engine variant explicit**

  Remove or neutralize `draft.engine_variant ?? "classic"` for new traces. Prefer making `engine_variant` required in `PipelineTraceDraft`. Historical traces can still render without this field.

- [ ] **Step 4: Update debug event summary**

  `buildRetrievalDebugEventData` should include:
  - `engine_variant`,
  - `tool_loop_model_step_count`,
  - `tool_loop_total_llm_calls`,
  - `tool_loop_tool_calls`,
  - `tool_loop_blocked_reasons`,
  - `loaded_guidance_ids`,
  - `repair_count`,
  - `failure_stage`,
  - `visible_failure`.

- [ ] **Step 5: Add trace projection tests**

  Assert:
  - raw tool output is not stored,
  - summaries are capped,
  - guidance IDs are visible,
  - repair/failure fields are visible,
  - historical Classic trace rendering still works.

## Task 6: Persist Visible Failures As Chat Turns

**Files:**
- Modify: `src/lib/rag/contracts.ts`
- Modify: `src/app/api/chat/route.ts`
- Modify: `tests/agent-production-chat-pipeline.spec.ts`

- [ ] **Step 1: Add `visibleFailure` to `PipelineResult` if needed**

  ```ts
  visibleFailure?: boolean
  ```

- [ ] **Step 2: Persist handled engine failures**

  If `visibleFailure === true`:
  - stream the stable failure copy,
  - save an assistant message,
  - persist turn trace with `status: "failed"`,
  - keep `assistant_message_id`,
  - do not emit product cards,
  - keep `rag_context` render-safe with null category/engine data.

- [ ] **Step 3: Keep state unchanged on visible failure**

  Do not persist a changed conversation state. If state persistence is called, the transition must have equal previous/next state and `changed_fields: []`.

- [ ] **Step 4: Skip memory extraction only on visible failure**

  Implement the route guard as:

  ```ts
  if (!visibleFailure) {
    extractConversationMemory(activeConversationId, user.id, { requestId }).catch(() => {})
  }
  ```

  Note: memory extraction reads the full transcript and runs after at least three user messages. We intentionally skip visible-failure turns to avoid learning from assistant failure text, even though the user message itself may contain signal.

- [ ] **Step 5: Document title generation behavior**

  Title generation may still fire before the pipeline on first-turn visible failures. This is acceptable because it uses the user message, not the failed assistant answer.

- [ ] **Step 6: Add route-level test**

  Assert visible failure:
  - appears as `content_delta`,
  - persists assistant message,
  - persists failed trace with `visible_failure: true`,
  - skips memory extraction,
  - does not persist product cards,
  - does not mutate conversation state.

## Task 7: Update Latency And Observability Fields

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/lib/rag/debug-trace.ts`
- Modify: `src/lib/agent/production/chat-pipeline.ts`
- Test: `tests/chat-debug-trace.spec.ts`

- [ ] **Step 1: Stop labeling total tool-loop time as classification**

  Do not set `latencies_ms.classification_ms = agentMs` for tool-loop production turns.

  Prefer:
  - `classification_ms: 0`
  - `tool_loop_total_ms: agentMs` if the latency type can be extended cleanly
  - `product_matching_ms` only for deterministic product tool execution if measurable; otherwise keep it `0` and put total in tool-loop trace

- [ ] **Step 2: Add post-deploy latency targets to trace notes**

  Operational target for first tester phase:
  - p50 below 8s
  - p95 below 15s

  These are observation thresholds, not hard CI gates.

- [ ] **Step 3: Add model-step and repair counts to Langfuse metadata**

  Include:
  - model step count,
  - total LLM calls,
  - repair count,
  - tool call count,
  - visible failure boolean.

## Task 8: Update Admin / Debug Views For Native Tool-Loop Trace

**Files:**
- Modify: `src/app/admin/conversations/[id]/page.tsx`

- [ ] **Step 1: Keep historical trace support**

  If `trace.agentic_tool_loop` is absent, render existing Classic trace sections as before.

- [ ] **Step 2: Add first-class tool-loop trace section**

  Show:
  - engine variant,
  - answer composition mode,
  - loaded guidance IDs,
  - answer context capsule IDs,
  - tool calls,
  - blocked tool calls,
  - guardrails,
  - repair attempts,
  - failure stage,
  - visible failure,
  - state transition changed fields,
  - selected products/routine summaries.

- [ ] **Step 3: Verify visible-failure trace rendering**

  Ensure `rag_context` and admin trace UI can render:
  - `categoryDecision = null`,
  - `engineTrace = null`,
  - no product cards,
  - failed trace status with assistant message attached.

## Task 9: Remove Production Classic Wiring

**Files:**
- Modify: `src/lib/agent/production/chat-pipeline.ts`
- Modify: `tests/agent-production-chat-pipeline.spec.ts`

- [ ] **Step 1: Delete production-only Classic helpers**

  Remove or replace:
  - `mapAgentIntent`
  - `mapAgentProductCategory`
  - Classic `buildClassification`
  - Classic `buildRouterDecision`
  - Classic `buildPromptSnapshot`
  - `productsForRenderedPacket`

  Migrate tests that import these helpers to new tool-loop helpers or delete them if they only test removed Classic production behavior.

- [ ] **Step 2: Search production path for Classic remnants**

  ```bash
  rg -n "runShadowAgentTurn|AGENT_FINAL_RENDER_PROMPT|computeConversationStateTransition|CHAT_AGENT_ENGINE|classic|renderFinalAnswer|AGENT_ORCHESTRATOR_PROMPT|mapAgentIntent|mapAgentProductCategory|buildClassification|buildRouterDecision|buildPromptSnapshot|productsForRenderedPacket|agent_v1_front_door|agent_final_render|bounded-agent-route-classification|bounded-agent-final-render" src/app/api/chat src/lib/agent/production src/lib/rag/debug-trace.ts tests/agent-production-chat-pipeline.spec.ts
  ```

  Expected:
  - no production orchestration call to Classic,
  - no Classic fallback flag,
  - old strings may remain only in historical test fixtures or explicitly historical rendering paths.

- [ ] **Step 3: Confirm Compare Lab Classic path still works**

  Compare Lab may still use Classic for comparison through `src/lib/agent/compare/run-shadow-agent.ts`. Production must not import or call it.

## Task 10: Verification

**Files:**
- No required file changes unless failures reveal gaps.

- [ ] **Step 1: Run production and tool-loop automated tests**

  ```bash
  npx tsx --test \
    tests/agent-production-chat-pipeline.spec.ts \
    tests/agentic-tool-loop.spec.ts \
    tests/agent-guidance.spec.ts \
    tests/agent-select-products-tool.spec.ts \
    tests/chat-debug-trace.spec.ts
  ```

  Expected: all pass.

- [ ] **Step 2: Run broader existing agent suite**

  ```bash
  npx tsx --test \
    tests/agent-final-render-prompt.spec.ts \
    tests/agent-compare-runner.spec.ts \
    tests/agent-compare-api.spec.ts \
    tests/agent-get-user-context.spec.ts \
    tests/agent-routine-tool.spec.ts
  ```

  Expected: all pass or failures are explained as intentional removal of Classic production behavior with updated tests.

- [ ] **Step 3: Run lint/typecheck**

  ```bash
  npm run lint
  npm run typecheck
  ```

  If `typecheck` is not available in `package.json`, run the repo's existing TypeScript verification command.

- [ ] **Step 4: Start local dev server**

  ```bash
  npm run dev:worktree
  ```

  Expected: app serves locally without port collision.

- [ ] **Step 5: Browser smoke real `/chat`**

  Test locally in real chat, not Compare Lab only:
  - `Ich habe nur Shampoo, was sollte ich als Nächstes ergänzen?`
  - `Welches Leave-in passt zu feinem, frizzigem Haar?`
  - `Maske oder Öl, was bringt mir mehr?`
  - after a recommendation: `Warum nicht eher Öl?`
  - visible failure via mocked model-client test, not by forcing real user failure.

- [ ] **Step 6: Browser smoke Compare Lab**

  Confirm `/labs/agent-compare` still runs:
  - Classic comparison variant if still shown,
  - `Produkt-Evaluation`,
  - multi-turn sequence.

- [ ] **Step 7: Inspect persistence and traces**

  For one successful product recommendation and one repair/failure test:
  - assistant message persisted,
  - product cards align with validated terminal `product_ids` or deterministic fallback,
  - `conversation_turn_traces.trace.agentic_tool_loop` populated with sanitized fields,
  - no raw full tool output/profile blob stored in app trace,
  - `conversation_state.updated_by_engine === "tool_loop"` on success,
  - visible failure skips memory extraction,
  - Langfuse trace URL still attached when configured.

- [ ] **Step 8: Run `ready-check` before shipping**

  This touches recommendations, trust, production chat UX, persistence, and debugging, so `ready-check` is required before merge/deploy.

## Handoff Notes For Reviewing Agent

- Review this plan in:
  - `/Users/nick/AI_work/hair_conscierge/.worktrees/context-packet-final-composer/plans/2026-05-12-tool-loop-production-integration-v2.md`
- Superseded plan:
  - `/Users/nick/AI_work/hair_conscierge/.worktrees/context-packet-final-composer/plans/2026-05-12-tool-loop-production-integration.md`
- Relevant source files:
  - `/Users/nick/AI_work/hair_conscierge/.worktrees/context-packet-final-composer/src/lib/agent/production/chat-pipeline.ts`
  - `/Users/nick/AI_work/hair_conscierge/.worktrees/context-packet-final-composer/src/lib/agent/orchestrator/run-agentic-tool-turn.ts`
  - `/Users/nick/AI_work/hair_conscierge/.worktrees/context-packet-final-composer/src/lib/agent/orchestrator/tool-definitions.ts`
  - `/Users/nick/AI_work/hair_conscierge/.worktrees/context-packet-final-composer/src/lib/agent/orchestrator/prompt.ts`
  - `/Users/nick/AI_work/hair_conscierge/.worktrees/context-packet-final-composer/src/lib/agent/orchestrator/agentic-tool-loop-types.ts`
  - `/Users/nick/AI_work/hair_conscierge/.worktrees/context-packet-final-composer/src/lib/rag/debug-trace.ts`
  - `/Users/nick/AI_work/hair_conscierge/.worktrees/context-packet-final-composer/src/lib/types.ts`
  - `/Users/nick/AI_work/hair_conscierge/.worktrees/context-packet-final-composer/src/app/api/chat/route.ts`
  - `/Users/nick/AI_work/hair_conscierge/.worktrees/context-packet-final-composer/tests/agent-production-chat-pipeline.spec.ts`
- Relevant context docs:
  - `/Users/nick/AI_work/hair_conscierge/.worktrees/context-packet-final-composer/docs/superpowers/specs/2026-05-05-agentic-tool-loop-design.md`
  - `/Users/nick/AI_work/hair_conscierge/.worktrees/context-packet-final-composer/docs/agentic-tool-loop-parity-matrix.md`
  - `/Users/nick/AI_work/hair_conscierge/.worktrees/context-packet-final-composer/docs/langfuse-quality-loop.md`
- Current Compare Lab URL for behavior reference:
  - `http://localhost:3274/labs/agent-compare`
- Current lab quality reference:
  - display name `Produkt-Evaluation`
  - implementation around `src/lib/agent/compare/tool-loop-variants.ts`

## Recommended Execution Skill

Next skill: `superpowers:subagent-driven-development`.

Recommended worker split:
- worker 1: terminal contract + repair tests
- worker 2: production adapter + PipelineResult mapping
- worker 3: app trace projection + admin/debug
- worker 4: route-level visible failure + final verification
