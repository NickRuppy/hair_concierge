# Tool Loop Production Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the production recommendation/chat engine behind `/api/chat` with the completed agentic tool-loop engine while preserving the existing production shell: persistence, SSE envelope, pseudo-streaming UX, feedback/download hooks, Langfuse tracing, title generation, memory extraction, and tester-debug workflows.

**Architecture:** `/api/chat` remains the stable front door. `runProductionAgentPipeline` becomes a thin production adapter around `runAgenticToolTurn`, with `select_products`, `build_or_fix_routine`, and `load_advisor_guidance` as the engine tools. Classic routing/render/state logic is removed from the production path; any useful shared behavior is ported into tool-loop/shared helpers instead of kept as a hidden fallback.

**Tech Stack:** Next.js App Router, TypeScript, OpenAI Chat Completions tool calling, Supabase persistence, Langfuse tracing, Node test runner via `npx tsx --test`, existing Hair Concierge deterministic product/routine engines.

---

## Spec And Decision Context

**Primary spec:** `docs/superpowers/specs/2026-05-05-agentic-tool-loop-design.md`

**Related completed plans and docs:**
- `plans/2026-05-05-agentic-tool-loop.md`
- `plans/2026-05-12-agentic-tool-loop-parity.md`
- `docs/agentic-tool-loop-parity-matrix.md`
- `docs/langfuse-quality-loop.md`
- `docs/chat-quality-review-rubric.md`

**Current worktree:** `/Users/nick/AI_work/hair_conscierge/.worktrees/context-packet-final-composer`

**Current branch:** `codex/context-packet-final-composer`

**Current review note:** This branch is already dirty and behind `origin/main`; implementation should start only after the current Compare Lab/tool-loop work is committed or intentionally carried forward in a fresh production-integration worktree.

## Settled Product / Architecture Decisions

- Full replacement: no staged rollout, no Classic fallback, no env flag as a product behavior switch.
- Keep `/api/chat` outer contract and current pseudo-streaming/loading UX.
- Preserve production plumbing unless it directly depends on Classic internals.
- Re-plug Classic-dependent plumbing to the new tool-loop result shape.
- Tool loop owns the short-term conversation state via `result.state_transition`.
- Failed tool-loop turns get one protocol repair attempt, then persist a visible assistant message.
- Failure copy:
  - `Sorry, ich konnte deine Frage gerade nicht eindeutig genug einordnen. Formulier sie bitte noch einmal etwas konkreter, dann helfe ich dir direkt weiter.`
- App DB stores structured/sanitized new-engine trace data.
- Raw prompt/message detail should primarily live in Langfuse when configured, not redundantly in app DB.
- Debug/download/admin views should expose real new-engine fields, not old route fields kept for nostalgia.
- Classic code should be archived through Git recovery point, not copied into a local archive folder.

## Scope Boundaries

**In scope:**
- Replace production orchestration core with `runAgenticToolTurn`.
- Wire all three production tools: `load_advisor_guidance`, `select_products`, `build_or_fix_routine`.
- Preserve message persistence, assistant metadata, product cards, feedback, download/debug trace, title generation, memory extraction, and Langfuse trace URL behavior.
- Add one generic tool-loop protocol repair path before visible failure.
- Persist `agentic_tool_loop` trace fields needed for tester debugging.
- Update production/admin/debug consumers to read real tool-loop trace fields where needed.
- Add tests proving `/api/chat` cannot silently call Classic engine code.

**Out of scope:**
- No memory-quality redesign.
- No new LLM classification step.
- No token streaming rewrite.
- No Classic quality comparison work.
- No deterministic recommendation/routine rewrite unless needed to satisfy the production adapter contract.
- No production fallback path to Classic.
- No pairwise category-comparison matrix.

## Target File Map

- Modify `src/lib/agent/production/chat-pipeline.ts`
  - Replace `runShadowAgentTurn`/Classic render/state orchestration with a production adapter around `runAgenticToolTurn`.
  - Build the production tool set for `load_advisor_guidance`, `select_products`, and `build_or_fix_routine`.
  - Return existing `PipelineResult` shape so `/api/chat` stays stable.

- Modify `src/lib/agent/orchestrator/run-agentic-tool-turn.ts`
  - Add explicit one-shot protocol repair behavior for terminal/protocol failures that currently fall through to fallback.
  - Add trace fields for repair attempts and failure stage.
  - Keep deterministic product/routine tool authority unchanged.

- Modify `src/lib/agent/orchestrator/agentic-tool-loop-types.ts`
  - Add trace fields: `repair_attempts`, `failure_stage`, optional `visible_failure`.
  - Keep model/tool step trace structured and app-DB safe.

- Modify `src/lib/agent/orchestrator/model-client.ts`
  - Ensure production tool-loop model client uses the rewritten `AGENTIC_TOOL_LOOP_PROMPT`.
  - Confirm OpenAI SDK transient retries remain bounded; do not add an app-level blind whole-turn rerun.

- Modify `src/lib/rag/debug-trace.ts`
  - Accept richer `agentic_tool_loop` trace data.
  - Summarize tool-loop trace for Langfuse and SSE debug events without requiring old Classic route fields.

- Modify `src/lib/rag/contracts.ts`
  - Keep `PipelineResult` stable unless a minimal field is needed for visible failure state.

- Modify `src/app/api/chat/route.ts`
  - Preserve SSE event order and persistence behavior.
  - Persist visible failure turns as assistant messages after pipeline-visible failure, not as uncaught HTTP errors.
  - Skip memory extraction on visible engine failure.

- Modify `src/app/admin/conversations/[id]/page.tsx`
  - Prefer `trace.agentic_tool_loop` fields in the admin trace card.
  - Keep old fields only if still present for historical traces.

- Modify or add tests:
  - `tests/agentic-tool-loop.spec.ts`
  - `tests/agent-production-chat-pipeline.spec.ts`
  - `tests/chat-debug-trace.spec.ts`
  - `tests/agent-compare-runner.spec.ts` only if Compare Lab types need to stay aligned

## Archive / Recovery Preparation

- [ ] **Step 1: Create a Git recovery point before deleting production Classic wiring**

  After the current Compare Lab/tool-loop work is committed, create a branch or tag pointing to the last pre-production-replacement state:

  ```bash
  git branch archive/classic-agent-before-tool-loop-production
  ```

  Expected: `archive/classic-agent-before-tool-loop-production` points to the commit before production Classic wiring is removed.

- [ ] **Step 2: Confirm the implementation worktree**

  Use a fresh repo-local worktree if this plan is handed to another agent:

  ```bash
  npm run worktree:new -- tool-loop-production-integration
  ```

  Expected: a worktree under `.worktrees/tool-loop-production-integration` on branch `codex/tool-loop-production-integration`.

---

## Task 1: Add Production Adapter Tests Before Rewiring

**Files:**
- Modify: `tests/agent-production-chat-pipeline.spec.ts`

- [ ] **Step 1: Add a success-path test for the tool-loop production adapter**

  Add a test that stubs a tool-loop model client returning:

  1. a `select_products` tool call,
  2. then a `submit_final_answer` call.

  Assert:
  - `runProductionAgentPipeline` returns `stream` containing the terminal answer.
  - `matchedProducts` are derived from `select_products`.
  - `debugTrace.engine_variant === "tool_loop"`.
  - `debugTrace.agentic_tool_loop.tool_calls` includes `select_products`.
  - `conversationStateTransition.updated_by_engine === "tool_loop"`.

- [ ] **Step 2: Add a conceptual guidance test**

  Stub the model client returning:

  1. `load_advisor_guidance`,
  2. `submit_final_answer`.

  Assert:
  - no products are returned,
  - `debugTrace.agentic_tool_loop.advisor_guidance.loaded_guidance_ids` is present,
  - response mode stays `answer_direct`,
  - no Classic render prompt fields are required to build the trace.

- [ ] **Step 3: Add a routine test**

  Stub the model client returning:

  1. `build_or_fix_routine`,
  2. `submit_final_answer`.

  Assert:
  - `debugTrace.decision_context.routine_plan` or equivalent routine projection is present,
  - `conversationStateTransition.next_state.active_topic === "routine"`,
  - `updated_by_engine === "tool_loop"`.

- [ ] **Step 4: Add a no-Classic-call regression**

  Make the old Classic model-client dependency impossible to call in the test. The test should fail if production still calls:
  - `runShadowAgentTurn`,
  - `renderFinalAnswer`,
  - `computeConversationStateTransition` as the state owner.

  Prefer dependency injection or module-boundary assertions over brittle text search.

- [ ] **Step 5: Run the focused test and observe failure**

  ```bash
  npx tsx --test tests/agent-production-chat-pipeline.spec.ts
  ```

  Expected before implementation: new tests fail because production still uses the Classic bounded-agent path.

## Task 2: Build The Production Tool-Loop Adapter

**Files:**
- Modify: `src/lib/agent/production/chat-pipeline.ts`

- [ ] **Step 1: Replace Classic imports**

  Remove production dependence on:
  - `AGENT_FINAL_RENDER_PROMPT`
  - `runShadowAgentTurn`
  - Classic route packet as the orchestration source
  - `computeConversationStateTransition` as the state owner

  Add production dependence on:
  - `runAgenticToolTurn`
  - `createOpenAIAgenticToolLoopModelClient`
  - `loadAdvisorGuidance`
  - `type AgenticToolTurnResult`

- [ ] **Step 2: Project recent messages for the tool loop**

  Reuse the existing conversation-history load, then pass recent user/assistant messages to `runAgenticToolTurn` as:

  ```ts
  const recentMessages = conversationHistory
    .filter((item) => item.role === "user" || item.role === "assistant")
    .map((item) => ({
      role: item.role,
      content: item.content ?? "",
    }))
  ```

- [ ] **Step 3: Build production tools**

  Replace `makeAgentTools` with a tool-loop-specific helper returning:

  ```ts
  {
    load_advisor_guidance: (input) =>
      loadAdvisorGuidance({
        intent: normalizeAdvisorGuidanceIntent(input.intent),
        category: normalizeAdvisorGuidanceCategory(input.category),
        categories: normalizeAdvisorGuidanceCategories(input.categories),
        profileFocus: normalizeAdvisorProfileFocus(input.profileFocus),
        message,
        userContext,
        conversationState,
      }),
    select_products: (input) =>
      selectProducts({
        category: normalizeAgenticProductCategory(input.category),
        message,
        hairProfile: userContext.profile,
        memoryContext,
        routineItems: userContext.routine_inventory,
        userJob: normalizeAgentUserJob(input.userJob),
        concerns: normalizeAgentConcerns(input.concerns),
        requestedGoal: normalizeRequestedGoal(input.requestedGoal, message),
        activeProfileSignals: normalizeActiveProfileSignals(input.activeProfileSignals),
        requestedIngredientSignals: normalizeRequestedIngredientSignals(input.requestedIngredientSignals),
        requestedHeatTemperatureSignals: normalizeRequestedHeatTemperatureSignals(input.requestedHeatTemperatureSignals),
      }),
    build_or_fix_routine: (input) =>
      buildOrFixRoutine({
        objective: normalizeRoutineObjective(input.objective),
        message,
        hairProfile: userContext.profile,
        layer: normalizeRoutineLayer(input.layer),
        requestedCategory: normalizeRoutineProductCategory(input.requestedCategory),
      }),
  }
  ```

  If helper names differ in the current branch, use the existing normalizers already present in `chat-pipeline.ts` or move generic normalizers into a neutral shared helper.

- [ ] **Step 4: Run `runAgenticToolTurn`**

  Call:

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

  Use `inline_context` as production default because Compare Lab testing concluded Composer is not worth the extra latency/cost for now.

- [ ] **Step 5: Map tool-loop result into `PipelineResult`**

  Preserve the current `PipelineResult` outward shape:
  - `stream`: `createTextStream(toolLoopResult.final_answer)`
  - `conversationId`
  - `matchedProducts`: products selected by `select_products`, in selected order
  - `sources`: `[]`
  - `conversationStateTransition`: `toolLoopResult.state_transition`
  - `debugTrace`: built with `agentic_tool_loop`

  Use product/routine projections from tool-loop result and selected-products tool output. Do not call Classic render or route logic to infer them.

- [ ] **Step 6: Re-run focused pipeline tests**

  ```bash
  npx tsx --test tests/agent-production-chat-pipeline.spec.ts
  ```

  Expected: new adapter tests pass.

## Task 3: Add One Generic Protocol Repair Attempt

**Files:**
- Modify: `src/lib/agent/orchestrator/agentic-tool-loop-types.ts`
- Modify: `src/lib/agent/orchestrator/run-agentic-tool-turn.ts`
- Test: `tests/agentic-tool-loop.spec.ts`

- [ ] **Step 1: Extend trace types**

  Add fields to the tool-loop trace:

  ```ts
  repair_attempts: Array<{
    reason:
      | "missing_terminal_answer"
      | "multiple_terminal_answers"
      | "terminal_with_other_tool_calls"
      | "max_model_steps_or_missing_terminal_answer"
    instruction: string
  }>
  failure_stage: string | null
  visible_failure: boolean
  ```

- [ ] **Step 2: Implement one repair continuation**

  When the loop would currently return fallback for a protocol failure, append one corrective user message to the existing `modelMessages` and call `runStep` once more:

  ```ts
  const repairInstruction =
    "Schliesse diesen Turn jetzt ausschliesslich mit submit_final_answer ab. " +
    "Nutze die bereits geladenen Tool-Ergebnisse und erfinde keine neuen Produkt- oder Routinefakten. " +
    "Rufe kein weiteres Tool auf."
  ```

  Accept exactly one `submit_final_answer` call. If the model returns anything else, return the visible failure answer and mark `visible_failure: true`.

- [ ] **Step 3: Do not retry deterministic no-result cases**

  Do not repair/retry when:
  - `select_products` returns `no_catalog_match`,
  - the model properly asks a clarification,
  - the answer is valid but imperfect.

  This is a protocol repair, not quality reranking.

- [ ] **Step 4: Add regression tests**

  Add tests for:
  - free-text first response, then repair succeeds,
  - terminal mixed with another tool, repair succeeds,
  - repair fails and returns the stable visible failure copy,
  - repair metadata appears in `trace.repair_attempts`.

- [ ] **Step 5: Run tool-loop tests**

  ```bash
  npx tsx --test tests/agentic-tool-loop.spec.ts
  ```

  Expected: repair tests pass.

## Task 4: Trace Tool-Loop Native Fields

**Files:**
- Modify: `src/lib/rag/debug-trace.ts`
- Modify: `src/lib/types.ts`
- Test: `tests/chat-debug-trace.spec.ts`

- [ ] **Step 1: Align app trace type with runtime trace**

  Ensure `ChatTurnTrace.agentic_tool_loop` can store:
  - `engine_variant`
  - `answer_composition_mode`
  - `model_steps`
  - `tool_calls`
  - `blocked_tool_calls`
  - `guardrails`
  - `repair_attempts`
  - `failure_stage`
  - `visible_failure`
  - `consultation_brief`
  - `advisor_guidance.loaded_guidance_ids`
  - `answer_context`
  - latency/token summary if available

- [ ] **Step 2: Keep DB trace sanitized**

  Do not store full raw system prompt/messages redundantly in new tool-loop trace fields. Existing historical prompt fields may remain for old traces, but new tool-loop debugging should rely on structured data plus Langfuse raw generation detail.

- [ ] **Step 3: Update Langfuse/SSE retrieval debug summary**

  `buildRetrievalDebugEventData` should summarize:
  - engine variant
  - model step count
  - tool call names
  - blocked tool-call reasons
  - loaded guidance IDs
  - repair count
  - failure stage
  - selected product count

- [ ] **Step 4: Add trace regression tests**

  Assert a completed tool-loop trace exposes enough data to answer:
  - Which tools were called?
  - Which guidance loaded?
  - Was a repair attempted?
  - Which state transition was persisted?
  - Did the answer come from the tool loop?

- [ ] **Step 5: Run trace tests**

  ```bash
  npx tsx --test tests/chat-debug-trace.spec.ts
  ```

  Expected: trace summary tests pass for new tool-loop traces and remain compatible with historical Classic traces.

## Task 5: Persist Visible Failures As Chat Turns

**Files:**
- Modify: `src/app/api/chat/route.ts`
- Modify: `src/lib/agent/production/chat-pipeline.ts` if `PipelineResult` needs a `visibleFailure` flag
- Test: `tests/agent-production-chat-pipeline.spec.ts`

- [ ] **Step 1: Represent visible engine failure in pipeline result**

  Prefer a minimal flag:

  ```ts
  visibleFailure?: boolean
  ```

  The pipeline should still return a text stream containing:

  ```text
  Sorry, ich konnte deine Frage gerade nicht eindeutig genug einordnen. Formulier sie bitte noch einmal etwas konkreter, dann helfe ich dir direkt weiter.
  ```

- [ ] **Step 2: Persist failed engine turns like normal assistant messages**

  `/api/chat` should:
  - save the user message,
  - save the assistant visible failure message,
  - persist `conversation_turn_traces.status = "failed"` or `"completed"` with `trace.agentic_tool_loop.visible_failure = true`.

  Use `status = "failed"` for the trace row if the engine failed after repair. The assistant message still exists because this is a user-visible handled failure.

- [ ] **Step 3: Keep previous conversation state on visible failure**

  On visible failure:
  - do not persist a new state transition that changes state,
  - keep previous state unchanged,
  - include failure stage in trace.

- [ ] **Step 4: Skip memory extraction on visible failure**

  Do not call `extractConversationMemory` when `visibleFailure === true`.

- [ ] **Step 5: Add route-level tests**

  In `tests/agent-production-chat-pipeline.spec.ts`, add a `/api/chat` test that:
  - receives content delta with the stable visible failure copy,
  - saves an assistant message,
  - persists a trace with `visible_failure: true`,
  - skips memory extraction,
  - does not persist a changed conversation state.

## Task 6: Update Admin / Debug Views For Native Tool-Loop Trace

**Files:**
- Modify: `src/app/admin/conversations/[id]/page.tsx`
- Test: add or update a focused component/helper test if one exists; otherwise rely on browser/manual smoke in verification.

- [ ] **Step 1: Inspect current trace card usage**

  Current admin trace card still reads many old fields:
  - `router_decision`
  - `retrieval`
  - `decision_context.engine_trace`
  - `prompt`
  - `response_composition`

  Keep these for historical traces but do not invent old values for new tool-loop traces.

- [ ] **Step 2: Add first-class tool-loop section**

  Show:
  - engine variant
  - answer composition mode
  - loaded guidance IDs
  - tool calls and blocked tool calls
  - guardrails
  - repair attempts
  - failure stage
  - state transition changed fields
  - selected products/routine plan summaries when present

- [ ] **Step 3: Keep historical trace fallback**

  If `trace.agentic_tool_loop` is absent, render the existing Classic trace sections as before.

- [ ] **Step 4: Manual admin check**

  After local smoke tests, open an admin conversation and verify a tool-loop turn can be debugged without needing old route packet fields.

## Task 7: Remove Production Classic Wiring

**Files:**
- Modify: `src/lib/agent/production/chat-pipeline.ts`
- Modify: any tests importing production Classic helpers only because production used them
- Do not delete Compare Lab Classic comparison code unless it is unused by active lab controls.

- [ ] **Step 1: Delete production-only Classic mapping helpers**

  Remove helpers from `chat-pipeline.ts` that only exist to translate Classic route packets into production trace fields:
  - `mapAgentIntent`
  - `mapAgentProductCategory`
  - Classic `buildClassification`
  - Classic `buildRouterDecision`
  - Classic `buildPromptSnapshot`

  If a concept still exists in the new engine, derive it from actual tool-loop fields instead.

- [ ] **Step 2: Keep only active shared utilities**

  Keep generic helpers only if still used by the tool-loop adapter:
  - conversation history loading
  - user context loading
  - memory loading
  - product projection from selected-products output
  - stream wrapper

- [ ] **Step 3: Search production path for Classic engine calls**

  ```bash
  rg -n "runShadowAgentTurn|AGENT_FINAL_RENDER_PROMPT|computeConversationStateTransition|CHAT_AGENT_ENGINE|classic" src/app/api/chat src/lib/agent/production src/lib/rag/debug-trace.ts
  ```

  Expected:
  - no production orchestration call to Classic,
  - no Classic fallback flag,
  - historical trace/admin labels may remain outside production orchestration only where needed for old data.

- [ ] **Step 4: Keep Compare Lab labels clear**

  Compare Lab may still contain Classic comparison code if useful, but production code must not import or call it.

## Task 8: Verification

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

  Expected: all pass or any failures are explained as intentional production-Classic removal with tests updated accordingly.

- [ ] **Step 3: Run lint/typecheck if available**

  ```bash
  npm run lint
  npm run typecheck
  ```

  If `typecheck` is not available in `package.json`, run the repo's existing TypeScript verification command.

- [ ] **Step 4: Start local production-path dev server**

  ```bash
  npm run dev:worktree
  ```

  Expected: app serves locally without port collision.

- [ ] **Step 5: Browser smoke real `/chat`**

  Test locally in the real chat path, not Compare Lab only:
  - broad routine: `Ich habe nur Shampoo, was sollte ich als Nächstes ergänzen?`
  - product pick: `Welches Leave-in passt zu feinem, frizzigem Haar?`
  - comparison: `Maske oder Öl, was bringt mir mehr?`
  - multi-turn follow-up: after a recommendation, ask `Warum nicht eher Öl?`
  - visible failure: mock a model-client protocol failure in test; do not force a real user-facing failure manually unless a safe dev-only switch exists.

- [ ] **Step 6: Inspect persistence and traces**

  For one successful product recommendation and one repair/failure test:
  - assistant message persisted,
  - product cards persisted when applicable,
  - `conversation_turn_traces.trace.agentic_tool_loop` populated,
  - `conversation_state.updated_by_engine === "tool_loop"` on success,
  - visible failure skips memory extraction,
  - Langfuse trace URL still attached when configured.

- [ ] **Step 7: Run `ready-check` before shipping**

  Because this touches recommendations, trust, production chat UX, persistence, and debugging, run `ready-check` before merge/deploy.

## Handoff Notes For Reviewing Agent

- Review this plan in:
  - `/Users/nick/AI_work/hair_conscierge/.worktrees/context-packet-final-composer/plans/2026-05-12-tool-loop-production-integration.md`
- Relevant source files to inspect first:
  - `/Users/nick/AI_work/hair_conscierge/.worktrees/context-packet-final-composer/src/lib/agent/production/chat-pipeline.ts`
  - `/Users/nick/AI_work/hair_conscierge/.worktrees/context-packet-final-composer/src/lib/agent/orchestrator/run-agentic-tool-turn.ts`
  - `/Users/nick/AI_work/hair_conscierge/.worktrees/context-packet-final-composer/src/lib/agent/orchestrator/prompt.ts`
  - `/Users/nick/AI_work/hair_conscierge/.worktrees/context-packet-final-composer/src/lib/agent/orchestrator/agentic-tool-loop-types.ts`
  - `/Users/nick/AI_work/hair_conscierge/.worktrees/context-packet-final-composer/src/lib/rag/debug-trace.ts`
  - `/Users/nick/AI_work/hair_conscierge/.worktrees/context-packet-final-composer/src/app/api/chat/route.ts`
  - `/Users/nick/AI_work/hair_conscierge/.worktrees/context-packet-final-composer/tests/agent-production-chat-pipeline.spec.ts`
- Relevant context docs:
  - `/Users/nick/AI_work/hair_conscierge/.worktrees/context-packet-final-composer/docs/superpowers/specs/2026-05-05-agentic-tool-loop-design.md`
  - `/Users/nick/AI_work/hair_conscierge/.worktrees/context-packet-final-composer/docs/agentic-tool-loop-parity-matrix.md`
  - `/Users/nick/AI_work/hair_conscierge/.worktrees/context-packet-final-composer/docs/langfuse-quality-loop.md`
- Current Compare Lab URL for behavior reference:
  - `http://localhost:3274/labs/agent-compare`
- Best current lab variant for quality reference:
  - `Produkt-Evaluation`

## Recommended Execution Skill

Next skill: `superpowers:subagent-driven-development`.

Use fresh subagents for independent slices:
- production adapter/tests,
- protocol repair,
- trace/admin debug,
- final verification.
