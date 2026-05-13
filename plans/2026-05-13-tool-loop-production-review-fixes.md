# Tool-Loop Production Review Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Address the merge-blocking and high-value review findings after wiring the agentic tool loop into production chat.

**Architecture:** Keep `/api/chat` as the stable front door and keep the tool loop as the only production recommendation engine. Fix correctness at the source layer first (`runProductionAgentPipeline` / `runAgenticToolTurn`), then strengthen admin/debug traces around the new tool-loop shape. Remove the deprecated `ConversationContextPacketV1` active code path and old context-packet trace fields so future debugging centers on the new consultation brief, advisor guidance, answer capsules, tool outputs, and sanitized tool-loop trace.

**Tech Stack:** Next.js App Router, TypeScript, OpenAI chat/tool loop, Supabase persistence, Langfuse tracing, Node test runner, Playwright component/contract specs.

---

## Decisions Locked

- Full production replacement remains: no Classic fallback and no product-behavior engine flag.
- Compare Lab can keep Classic comparison code.
- Old `ConversationContextPacketV1` is deprecated and should be removed from active code/tests.
- Remove `context_packet_*` trace fields in this follow-up because new production debugging should use native tool-loop trace fields.
- Do not persist raw full model prompts/messages in app DB traces. Raw prompt inspection remains Langfuse-first; admin should label the DB prompt snapshot as a sanitized summary.

## Files And Responsibilities

- `src/lib/agent/production/chat-pipeline.ts`: production adapter from tool-loop result to route `PipelineResult`; owns pipeline-level visible-failure normalization and latency mapping.
- `src/app/api/chat/route.ts`: stable SSE/persistence shell; should remain a second safety boundary for visible-failure artifact scrubbing and add compact Langfuse tool-loop summary.
- `src/lib/agent/orchestrator/run-agentic-tool-turn.ts`: tool-loop protocol behavior, advisor-guidance gating, prior-recommendation reroute, canonical visible failure.
- `src/lib/agent/orchestrator/current-turn-context.ts`: current-turn extracted profile/scalp signals.
- `src/lib/agent/orchestrator/route-packet.ts`: active profile signal vocabulary.
- `src/lib/agent/orchestrator/model-client.ts`: schema parsing/validation for active profile signals.
- `src/lib/agent/orchestrator/tool-definitions.ts`: strict tool schemas that expose active profile signals.
- `src/lib/agent/tools/select-products.ts`: product selection semantics for active signals.
- `src/lib/agent/guidance/load-guidance.ts`: static guidance markdown loading and cache.
- `src/lib/rag/debug-trace.ts`: sanitized app trace projection and retrieval-debug event payload.
- `src/lib/types.ts`: trace types; remove old context-packet fields and add/confirm new tool-loop trace fields.
- `src/app/admin/conversations/[id]/page.tsx`: admin trace card; should render native tool-loop trace fields and label sanitized prompt snapshot honestly.
- `src/lib/rag/synthesizer.ts`: legacy synthesizer trace shape; remove old context-packet fields from response composition.
- `package.json`: add tool-loop spec to `test:agent`.
- `tests/agent-production-chat-pipeline.spec.ts`: pipeline-level visible-failure and latency regressions.
- `tests/agentic-tool-loop.spec.ts`: tool-loop behavior regressions.
- `tests/agent-guidance.spec.ts`: guidance cache should not change behavior.
- `tests/chat-debug-trace.spec.ts`: trace field removal/projection/admin-debug regressions.
- `tests/agent-final-render-prompt.spec.ts`: update expectations if context-packet fields disappear from response composition fixtures.
- Delete: `src/lib/agent/orchestrator/conversation-context-packet.ts`.
- Delete: `tests/agent-context-packet.spec.ts`.

---

## Task 1: Pipeline-Level Visible Failure And Latency Cleanup

**Files:**
- Modify: `src/lib/agent/production/chat-pipeline.ts`
- Test: `tests/agent-production-chat-pipeline.spec.ts`

- [ ] **Step 1: Add a failing pipeline-level visible-failure regression**

Add a test that creates a fake tool loop sequence where `select_products` succeeds and the terminal protocol later visible-fails. Assert the pipeline result itself is clean, not only `/api/chat`.

```ts
test("production tool-loop visible failure normalizes product artifacts at pipeline boundary", async () => {
  const product = createProduct("primary")
  const selection = createSelectedProductsResult({
    projection: createSelectedProductsProjection([product]),
    products: [product],
    message: "Welches Shampoo passt?",
  })

  const result = await runProductionAgentPipeline(
    {
      message: "Welches Shampoo passt?",
      conversationId: "conversation-1",
      userId: "user-1",
      requestId: "request-1",
    },
    {
      modelClient: createFakeToolLoopModel([
        {
          type: "tool_calls",
          calls: [
            {
              id: "select-1",
              name: "select_products",
              input: { category: "shampoo", userJob: "product_pick" },
            },
          ],
        },
        { type: "message", content: "not terminal" },
        { type: "message", content: "still not terminal" },
        { type: "message", content: "repair failed" },
      ]),
      loadConversationHistory: async () => [],
      getUserContext: async () => createUserContext(),
      loadUserMemoryContext: async () => createMemoryContext(),
      loadConversationState: async () => createDefaultConversationState(),
      createSelectProductsTool:
        () =>
        async () =>
          selection,
    },
  )

  assert.equal(result.visibleFailure, true)
  assert.deepEqual(result.matchedProducts, [])
  assert.equal(result.categoryDecision, undefined)
  assert.equal(result.engineTrace, undefined)
  assert.equal(result.debugTrace.decision_context.category_decision, null)
  assert.equal(result.debugTrace.decision_context.engine_trace, null)
  assert.deepEqual(result.debugTrace.decision_context.matched_products, [])
  assert.equal(result.debugTrace.response_composition.attachment_mode, "text_only")
})
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
npx tsx --test tests/agent-production-chat-pipeline.spec.ts
```

Expected before implementation: the new test fails because `matchedProducts`, `categoryDecision`, `engineTrace`, or `attachment_mode` still reflect the prior selected products.

- [ ] **Step 3: Normalize visible failures before building the pipeline trace**

In `runProductionAgentPipeline`, compute sanitized values immediately after deriving `visibleFailure`.

```ts
const visibleFailure = toolLoopResult.visible_failure === true
const exposedMatchedProducts = visibleFailure ? [] : matchedProducts
const exposedCategoryDecision = visibleFailure ? undefined : categoryDecision
const exposedEngineTrace = visibleFailure ? undefined : engineTrace
const exposedProductCategory = visibleFailure ? null : productCategory
const attachmentMode = exposedMatchedProducts.length > 0 ? "cards" : "text_only"
```

Use those values consistently in `buildPipelineTraceDraft` and the returned `PipelineResult`:

```ts
product_category: exposedProductCategory,
category_decision: exposedCategoryDecision,
engine_trace: exposedEngineTrace,
matched_products: exposedMatchedProducts,
attachment_mode: attachmentMode,
```

Return:

```ts
matchedProducts: exposedMatchedProducts,
categoryDecision: exposedCategoryDecision,
engineTrace: exposedEngineTrace,
visibleFailure,
```

- [ ] **Step 4: Clean up latency labels**

Replace full-loop substage timings with neutral values unless directly measured.

```ts
latencies_ms: {
  classification_ms: 0,
  hair_profile_load_ms: contextLoadMs,
  routine_inventory_load_ms: 0,
  memory_load_ms: memoryLoadMs,
  routine_planning_ms: 0,
  history_load_ms: historyLoadMs,
  router_ms: 0,
  conversation_create_ms: 0,
  retrieval_ms: 0,
  product_matching_ms: 0,
  prompt_build_ms: 0,
  stream_setup_ms: 0,
},
```

Keep total tool-loop latency in `agentic_tool_loop.latency_ms` via `projectAgenticToolLoopTraceForApp({ latencyMs: agentMs })`.

- [ ] **Step 5: Verify Task 1**

Run:

```bash
npx tsx --test tests/agent-production-chat-pipeline.spec.ts
npm run typecheck
```

Expected: all pass.

---

## Task 2: Tool-Loop Semantic Fixes

**Files:**
- Modify: `src/lib/agent/orchestrator/route-packet.ts`
- Modify: `src/lib/agent/orchestrator/model-client.ts`
- Modify: `src/lib/agent/orchestrator/tool-definitions.ts`
- Modify: `src/lib/agent/orchestrator/current-turn-context.ts`
- Modify: `src/lib/agent/orchestrator/run-agentic-tool-turn.ts`
- Modify: `src/lib/agent/tools/select-products.ts`
- Test: `tests/agentic-tool-loop.spec.ts`
- Test: `tests/agent-select-products-tool.spec.ts`

- [ ] **Step 1: Add `augment` to active-signal vocabulary**

In `ACTIVE_SIGNAL_SELECTION_EFFECTS`, add `augment`.

```ts
export const ACTIVE_SIGNAL_SELECTION_EFFECTS = [
  "override",
  "qualifier",
  "redirect",
  "augment",
  "caution",
] as const
```

Update selection-effect priority so caution/override still win, and `augment` does not outrank a true redirect.

```ts
const priority: Record<ActiveSignalSelectionEffect, number> = {
  qualifier: 1,
  augment: 2,
  redirect: 3,
  override: 4,
  caution: 5,
}
```

- [ ] **Step 2: Stop collapsing current-turn `augment` signals to `redirect`**

In `buildCurrentTurnActiveProfileSignals`, preserve `augment`.

```ts
export function buildCurrentTurnActiveProfileSignals(
  overlay: CurrentTurnContextOverlay,
): AgentActiveProfileSignal[] {
  return overlay.active_concerns.map((signal) => ({
    field: signal.field,
    value: signal.value,
    source: "message",
    selection_effect: signal.selection_effect,
    evidence: signal.evidence,
  }))
}
```

- [ ] **Step 3: Keep product selection semantics explicit**

Do not let `augment` apply physical profile overrides. Keep `shouldApplyProfileOverride` unchanged:

```ts
function shouldApplyProfileOverride(signal: AgentActiveProfileSignal): boolean {
  return signal.selection_effect === "override" || signal.selection_effect === "caution"
}
```

The route context `concerns` path already carries frizz/dryness/tangling into category decision logic; `augment` is for positive current-turn context and supported-claim/prose grounding, not for profile override.

- [ ] **Step 4: Fix advisor-guidance over-block after weak product results**

Replace `shouldBlockAdvisorGuidanceAfterProducts` with:

```ts
function shouldBlockAdvisorGuidanceAfterProducts(params: {
  selectedProducts: SelectedProductsProjection | null
}): boolean {
  if (!params.selectedProducts) return false

  return ![
    "needs_more_info",
    "not_recommended",
    "no_catalog_match",
  ].includes(params.selectedProducts.decision)
}
```

- [ ] **Step 5: Tighten prior-recommendation explanation reroute**

Change the reroute to require evidence that the user refers to the prior recommendation, not just a conceptual category question.

```ts
function hasPriorRecommendationExplanationIntent(params: {
  message: string
  conversationState: ConversationState | null | undefined
}): boolean {
  const normalized = normalizeIntentText(params.message)
  const priorAction = params.conversationState?.last_assistant_action ?? ""
  const followsProductAnswer =
    /product|produkt|recommend|empfehl/i.test(priorAction) ||
    params.conversationState?.last_product_category !== null

  if (!followsProductAnswer || !/\bwarum\b/.test(normalized)) return false

  return /\b(?:diese|dieses|diesen|die\s+produkte?|deine\s+empfehlung|empfohlen|schlaegst|schlagst|empfiehlst)\b/.test(
    normalized,
  )
}
```

Update callers from `hasPriorRecommendationExplanationIntent(message)` to `hasPriorRecommendationExplanationIntent({ message, conversationState })`.

- [ ] **Step 6: Preserve dandruff plus irritation current-turn signals**

In `extractActiveConcerns`, remove the guard that prevents dandruff from being added when irritation already exists.

```ts
if (/\bschuppen\b|\bschuppchen\b|\bschueppchen\b|\bflakes\b/.test(normalized)) {
  add("scalp_condition", "dandruff", "caution", "Schuppen")
  add("concerns", "dandruff", "caution", "Schuppen")
}
```

In `allowsMultipleActiveSignalValues`, allow multiple scalp conditions for current-turn safety signals:

```ts
function allowsMultipleActiveSignalValues(field: AgentActiveProfileSignal["field"]): boolean {
  return (
    field === "concerns" ||
    field === "goals" ||
    field === "chemical_treatment" ||
    field === "styling_tools" ||
    field === "scalp_condition"
  )
}
```

- [ ] **Step 7: Canonicalize empty terminal answers as visible failures**

Change terminal parsing/handling so empty terminal answers use `VISIBLE_FAILURE_ANSWER`, set `visible_failure: true`, set `failure_stage: "missing_terminal_answer"`, and leave state unchanged.

Implementation shape:

```ts
function parseTerminalAnswer(input: Record<string, unknown>): AgenticTerminalAnswer | null {
  if (typeof input.answer !== "string" || !input.answer.trim()) {
    return null
  }

  return {
    answer: input.answer,
    product_ids: parseTerminalProductIds(input.product_ids),
    state_patch: { ... },
  }
}
```

At the call site, if parsing returns `null`, return the same visible-failure result used after failed protocol repair:

```ts
return buildVisibleFailureResult({
  params,
  trace,
  modelSteps,
  toolCalls,
  blockedToolCalls,
  guardrails,
  repairAttempts,
  failureStage: "missing_terminal_answer",
})
```

If there is no helper yet, create a small local helper to avoid duplicating the visible-failure object construction.

- [ ] **Step 8: Add regressions for Task 2**

Add focused tests in `tests/agentic-tool-loop.spec.ts`:

```ts
test("current-turn concerns keep augment semantics for product tools", async () => {
  const toolInputs: Array<Record<string, unknown>> = []
  const model = new FakeModelClient([
    { type: "tool_calls", calls: [{ name: "select_products", input: { category: "leave_in" } }] },
    {
      type: "final",
      answer: "Ein Leave-in kann bei Frizz helfen.",
      statePatch: { active_topic: "leave_in", last_product_category: "leave_in" },
    },
  ])

  await runAgenticToolTurn({
    message: "Meine Haare haben Frizz, welches Leave-in passt?",
    recentMessages: [],
    userContext: createUserContext(),
    conversationState: createDefaultConversationState(),
    modelClient: model,
    tools: {
      select_products: async (input) => {
        toolInputs.push(input as Record<string, unknown>)
        return createLeaveInProjection()
      },
    },
  })

  const activeSignals = toolInputs[0]?.activeProfileSignals as Array<{ value: string; selection_effect: string }>
  assert.ok(activeSignals.some((signal) => signal.value === "frizz" && signal.selection_effect === "augment"))
})
```

```ts
test("advisor guidance can follow weak product results", async () => {
  const weakProjection = {
    ...createShampooProjection(),
    decision: "not_recommended" as const,
    products: [],
  }
  let guidanceCalls = 0
  const model = new FakeModelClient([
    { type: "tool_calls", calls: [{ name: "select_products", input: { category: "shampoo" } }] },
    { type: "tool_calls", calls: [{ name: "load_advisor_guidance", input: { intent: "compare_or_decide", categories: ["shampoo"] } }] },
    {
      type: "final",
      answer: "Shampoo ist hier nicht der groesste Hebel.",
      statePatch: { active_topic: "shampoo", last_product_category: "shampoo" },
    },
  ])

  await runAgenticToolTurn({
    message: "Hilft Shampoo gegen trockene Laengen?",
    recentMessages: [],
    userContext: createUserContext(),
    conversationState: createDefaultConversationState(),
    modelClient: model,
    tools: {
      select_products: async () => weakProjection,
      load_advisor_guidance: async () => {
        guidanceCalls += 1
        return createAdvisorGuidanceProjection()
      },
    },
  })

  assert.equal(guidanceCalls, 1)
})
```

```ts
test("conceptual why questions after product turns are not forced into product selection", async () => {
  let selectCalls = 0
  const model = new FakeModelClient([
    { type: "tool_calls", calls: [{ name: "load_advisor_guidance", input: { intent: "compare_or_decide", categories: ["mask"] } }] },
    {
      type: "final",
      answer: "Maske kann bei feinem Haar schwer wirken, wenn sie sehr reichhaltig ist.",
      statePatch: { active_topic: "mask", last_product_category: null },
    },
  ])

  await runAgenticToolTurn({
    message: "Warum ist die Maske bei feinem Haar oft zu schwer?",
    recentMessages: [],
    userContext: createUserContext(),
    conversationState: {
      ...createDefaultConversationState(),
      last_product_category: "conditioner",
      last_assistant_action: "answered_products",
    },
    modelClient: model,
    tools: {
      select_products: async () => {
        selectCalls += 1
        return createMaskProjection()
      },
      load_advisor_guidance: async () => createAdvisorGuidanceProjection(),
    },
  })

  assert.equal(selectCalls, 0)
})
```

```ts
test("current-turn scalp context preserves dandruff and irritation together", () => {
  const overlay = extractCurrentTurnContextOverlay({
    message: "Meine Kopfhaut juckt und ich habe Schuppen.",
    recentMessages: [],
    savedProfile: null,
  })

  assert.ok(
    overlay.active_concerns.some(
      (signal) => signal.field === "scalp_condition" && signal.value === "irritated",
    ),
  )
  assert.ok(
    overlay.active_concerns.some(
      (signal) => signal.field === "scalp_condition" && signal.value === "dandruff",
    ),
  )
})
```

```ts
test("empty terminal answer becomes visible failure with canonical copy", async () => {
  const result = await runAgenticToolTurn({
    message: "???",
    recentMessages: [],
    userContext: createUserContext(),
    conversationState: createDefaultConversationState(),
    modelClient: new FakeModelClient([
      {
        type: "final",
        answer: "",
        statePatch: { active_topic: null, last_product_category: null },
      },
    ]),
    tools: {},
  })

  assert.equal(result.visible_failure, true)
  assert.match(result.final_answer, /Entschuldige, ich konnte deine Frage/)
  assert.equal(result.trace.failure_stage, "missing_terminal_answer")
})
```

- [ ] **Step 9: Verify Task 2**

Run:

```bash
npx tsx --test tests/agentic-tool-loop.spec.ts tests/agent-select-products-tool.spec.ts
npm run typecheck
```

Expected: all pass.

---

## Task 3: Guidance Markdown Cache

**Files:**
- Modify: `src/lib/agent/guidance/load-guidance.ts`
- Test: `tests/agent-guidance.spec.ts`

- [ ] **Step 1: Add lazy cache in `load-guidance.ts`**

Use a module-level map keyed by guidance id.

```ts
const guidanceContentCache = new Map<GuidanceId, Promise<GuidanceLoadResult["items"][number]>>()

async function loadGuidanceItem(id: string): Promise<GuidanceLoadResult["items"][number]> {
  const guidanceId = id as GuidanceId
  const cached = guidanceContentCache.get(guidanceId)
  if (cached) return cached

  const entry = guidanceCatalog[guidanceId]
  if (!entry) {
    throw new Error(`Unknown guidance id: ${id}`)
  }

  const promise = Promise.all(
    resolveEntryPaths(entry).map((entryPath) => readFile(resolve(repoRoot, entryPath), "utf8")),
  ).then((contentParts) => ({
    id: guidanceId,
    kind: entry.kind,
    title: entry.title,
    content: contentParts.join("\n\n"),
  }))

  guidanceContentCache.set(guidanceId, promise)
  return promise
}
```

Then simplify `loadGuidance`:

```ts
export async function loadGuidance(ids: readonly string[]): Promise<GuidanceLoadResult> {
  const items = await Promise.all(ids.map((id) => loadGuidanceItem(id)))
  return { items }
}
```

- [ ] **Step 2: Verify guidance behavior stays stable**

Run:

```bash
npx tsx --test tests/agent-guidance.spec.ts
```

Expected: all pass.

---

## Task 4: Native Tool-Loop Admin And Observability

**Files:**
- Modify: `src/app/admin/conversations/[id]/page.tsx`
- Modify: `src/app/api/chat/route.ts`
- Test: `tests/chat-debug-trace.spec.ts`
- Test: `tests/agent-production-chat-pipeline.spec.ts`

- [ ] **Step 1: Render native tool-loop trace fields in admin**

In the existing `Tool-Loop-Spur` card, render:

```tsx
{toolLoopTrace ? (
  <div className="grid gap-2 md:grid-cols-2">
    <p>Antwortmodus: {toolLoopTrace.answer_composition_mode}</p>
    <p>Visible Failure: {toolLoopTrace.visible_failure ? "ja" : "nein"}</p>
    <p>Failure Stage: {toolLoopTrace.failure_stage ?? "none"}</p>
    <p>Repair Attempts: {toolLoopTrace.repair_attempts.length}</p>
    <p>Guidance IDs: {toolLoopTrace.loaded_guidance_ids.join(", ") || "none"}</p>
    <p>Capsules: {toolLoopTrace.answer_context_capsule_ids.join(", ") || "none"}</p>
  </div>
) : null}
```

Also render compact lists for:

```tsx
toolLoopTrace.model_steps
toolLoopTrace.tool_calls
toolLoopTrace.blocked_tool_calls
```

- [ ] **Step 2: Rename prompt snapshot section for tool-loop traces**

If `trace.agentic_tool_loop` exists, show copy that makes the DB snapshot honest:

```tsx
const promptSnapshotTitle = trace.agentic_tool_loop
  ? "Sanitized Prompt Summary"
  : "Prompt Snapshot"
```

Use that title in place of the current unconditional `Prompt Snapshot`. Keep displaying the sanitized message summary; do not add raw model messages to DB traces.

- [ ] **Step 3: Add compact Langfuse tool-loop summary in route output**

In `/api/chat/route.ts`, add a compact object derived from `completedTrace.agentic_tool_loop`.

```ts
const toolLoopSummary = completedTrace.agentic_tool_loop
  ? {
      model_step_count: completedTrace.agentic_tool_loop.model_steps.length,
      tool_call_count: completedTrace.agentic_tool_loop.tool_calls.length,
      repair_count: completedTrace.agentic_tool_loop.repair_attempts.length,
      visible_failure: completedTrace.agentic_tool_loop.visible_failure,
      failure_stage: completedTrace.agentic_tool_loop.failure_stage,
      loaded_guidance_ids: completedTrace.agentic_tool_loop.loaded_guidance_ids,
    }
  : null
```

Include it under `activeChatObservation.update({ output: { agentic_tool_loop_summary: toolLoopSummary } })`.

- [ ] **Step 4: Verify admin/types compile**

Run:

```bash
npm run typecheck
npx playwright test tests/chat-debug-trace.spec.ts --project=chromium
```

Expected: all pass.

---

## Task 5: Remove Deprecated Context Packet Surface

**Files:**
- Delete: `src/lib/agent/orchestrator/conversation-context-packet.ts`
- Delete: `tests/agent-context-packet.spec.ts`
- Modify: `src/lib/types.ts`
- Modify: `src/lib/rag/debug-trace.ts`
- Modify: `src/lib/rag/synthesizer.ts`
- Modify: `src/lib/agent/production/chat-pipeline.ts`
- Modify: `tests/chat-debug-trace.spec.ts`
- Modify: `tests/agent-production-chat-pipeline.spec.ts`
- Modify: `tests/agent-final-render-prompt.spec.ts`
- Modify: `package.json`

- [ ] **Step 1: Delete dead implementation and test**

Remove:

```bash
rm src/lib/agent/orchestrator/conversation-context-packet.ts
rm tests/agent-context-packet.spec.ts
```

Use `apply_patch` delete hunks if executing manually in Codex.

- [ ] **Step 2: Remove context-packet fields from response composition type**

In `ResponseCompositionTrace`, remove:

```ts
context_packet_version: 1 | null
conversation_move_hint: ConversationMoveHint | null
answer_style_hint: ConversationAnswerStyle | null
detail_level_hint: ConversationDetailLevel | null
context_packet_estimated_chars: number | null
context_packet_truncated_fields: string[]
```

Then remove unused exported types if no longer referenced:

```ts
export type ConversationMoveHint = ...
export type ConversationAnswerStyle = ...
export type ConversationDetailLevel = ...
```

- [ ] **Step 3: Remove field writes and debug event fields**

In `buildRetrievalDebugEventData`, remove:

```ts
context_packet_version
conversation_move_hint
answer_style_hint
detail_level_hint
context_packet_estimated_chars
context_packet_truncated_fields
```

In `src/lib/rag/synthesizer.ts` and `src/lib/agent/production/chat-pipeline.ts`, remove the corresponding `null` assignments in `response_composition`.

- [ ] **Step 4: Update fixtures/tests**

Remove `context_packet_*`, `conversation_move_hint`, `answer_style_hint`, and `detail_level_hint` assertions/fixtures from:

```bash
tests/chat-debug-trace.spec.ts
tests/agent-production-chat-pipeline.spec.ts
tests/agent-final-render-prompt.spec.ts
```

- [ ] **Step 5: Update `test:agent` script**

Remove the deleted context-packet test and add the tool-loop spec.

```json
"test:agent": "tsx --test tests/agent-guidance.spec.ts tests/agent-guidance-tracing.spec.ts tests/agent-route-packet.spec.ts tests/agent-get-user-context.spec.ts tests/agent-select-products-tool.spec.ts tests/agent-routine-tool.spec.ts tests/agent-shadow.spec.ts tests/agent-production-chat-pipeline.spec.ts tests/agent-final-render-prompt.spec.ts tests/agentic-tool-loop.spec.ts"
```

- [ ] **Step 6: Verify deprecated packet removal**

Run:

```bash
rg -n "ConversationContextPacket|conversation-context-packet|context_packet|conversation_move_hint|answer_style_hint|detail_level_hint" src tests
npm run test:agent
npm run typecheck
```

Expected:
- `rg` returns no active `src`/`tests` hits except historical docs/plans if the command is expanded beyond `src tests`.
- `npm run test:agent` passes.
- `npm run typecheck` passes.

---

## Task 6: Final Verification And Review

**Files:**
- All files touched above.

- [ ] **Step 1: Run focused production/tool-loop verification**

```bash
npx tsx --test tests/agent-production-chat-pipeline.spec.ts
npx tsx --test tests/agentic-tool-loop.spec.ts tests/agent-guidance.spec.ts tests/agent-select-products-tool.spec.ts tests/agent-routine-tool.spec.ts
npx tsx --test tests/agent-compare-runner.spec.ts tests/agent-compare-api.spec.ts tests/agent-get-user-context.spec.ts tests/agent-final-render-prompt.spec.ts
npx playwright test tests/chat-debug-trace.spec.ts --project=chromium
npx playwright test tests/conversation-state.spec.ts --project=chromium
npm run typecheck
npm run lint
```

Expected: all pass. `npm run lint` may still show pre-existing warnings, but must show 0 errors.

- [ ] **Step 2: Run production-path Classic search**

```bash
rg -n "runShadowAgentTurn|AGENT_FINAL_RENDER_PROMPT|computeConversationStateTransition|CHAT_AGENT_ENGINE|classic|renderFinalAnswer|AGENT_ORCHESTRATOR_PROMPT|mapAgentIntent|mapAgentProductCategory|buildClassification|buildRouterDecision|productsForRenderedPacket|agent_v1_front_door|agent_final_render|bounded-agent-route-classification|bounded-agent-final-render" src/app/api/chat src/lib/agent/production src/lib/rag/debug-trace.ts tests/agent-production-chat-pipeline.spec.ts src/lib/types.ts
```

Expected:
- no production Classic orchestration calls;
- only historical enum support or test sentinels may remain.

- [ ] **Step 3: Request code review**

Use `superpowers:requesting-code-review` with:

```text
Description: Fixed production tool-loop review findings: pipeline visible-failure normalization, latency labels, advisor guidance gating, prior recommendation false-positive reroute, current-turn scalp signal preservation, canonical visible failure copy, guidance cache, admin trace rendering, test script coverage, and deprecated context-packet removal.

Plan: plans/2026-05-13-tool-loop-production-review-fixes.md
```

Expected: reviewer returns no Critical/Important findings before merge.

---

## Self-Review

- Spec coverage: every Important/Major review item is mapped to a task. Lower-priority regex polish refactor and category-map consolidation are intentionally not in scope.
- Placeholder scan: no TBD/TODO placeholders. Each task has concrete files, code shape, commands, and expected output.
- Type consistency: new `augment` value flows through shared `ACTIVE_SIGNAL_SELECTION_EFFECTS`, model parsing, tool definitions, and product tool inputs. Deprecated context-packet fields are removed from type, writers, and tests together.
