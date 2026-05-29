# AgentV2 Production Switch State Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Production `/api/chat` must run AgentV2 GPT-5.4-mini + CareBalance as the only active chat engine, preserving the high-quality response behavior that was manually tested and iterated in Compare Lab across real stateless HTTP turns.

**Architecture:** Treat Compare Lab as the behavioral reference, not a permanent dependency. Production should use an AgentV2-specific version-2 conversation-state envelope for runtime working memory, recompute CareBalance every turn, ignore legacy version-1 behavioral fields, promote already-persisted flat AgentV2 fields into the new V2 envelope, and keep legacy route artifacts only as output/debug projections from AgentV2.

**Tech Stack:** Next.js API route, TypeScript, Supabase `conversation_states`, AgentV2 Responses runtime, existing product/routine tools, node `tsx --test`.

**Context:** Follow-up from session `019e4496-98c7-7e01-812b-77dbedc2ddfb` after reviewing the AgentV2 + CareBalance production switch in `/Users/nick/AI_work/hair_conscierge/.worktrees/gpt-54-responses-migration-plan`. This fixes the adapter/state mismatch between manually tested Compare Lab behavior and production `/api/chat`.

---

## Settled Decisions

- Production `/api/chat` uses AgentV2 GPT-5.4-mini + CareBalance as the only active chat engine.
- The old production tool-loop pipeline must not be reachable from `/api/chat`.
- Compare Lab is a behavioral reference only; do not make production depend on Compare Lab internals.
- Existing `conversation_states` table remains the storage container.
- Active persisted state becomes a version-2 AgentV2 envelope:

```ts
{
  version: 2,
  engine: "agent_v2_care_balance",
  agent_v2: {
    routine_thread_context,
    prior_selected_product_projections,
    session_memory
  }
}
```

- Legacy version-1 behavioral fields (`active_topic`, `routine_layer`, `pending_offer`, `answered_slots`, `last_assistant_action`, `last_product_category`) are ignored for AgentV2 behavior.
- Already-persisted flat AgentV2 fields on version-1 rows (`agent_v2_routine_thread_context`, `agent_v2_prior_selected_product_projections`, `agent_v2_session_memory`) are promoted into the V2 envelope once at the persistence boundary. This preserves the AgentV2 continuity that was already being written during the Compare Lab parity pass without letting old V1 routing behavior steer production.
- If flat AgentV2 fields are missing or malformed, normalize to empty AgentV2 state.
- First successful AgentV2 turn writes the nested V2 envelope with `state_version = 2`.
- Visible failures do not mutate state.
- AgentV2 session memory is conversation-scoped working memory, not durable user memory.
- Durable user memory extraction stays as-is and still comes from saved transcript.
- CareBalance is recomputed every turn from current profile/routine/product usage.
- Product/routine tools remain source of truth for product claims and routine projections.
- `build_or_fix_routine` remains projection/advice only; no saved routine mutation in this work.
- No new validator for "I saved your routine" wording; handle with guidance/model behavior.
- Product memory stores minimal surfaced grounded facts only, not a hidden catalog.
- Runtime prompt wording should say Chaarlie, not Hair Concierge or Compare Lab.
- Production tests should cover AgentV2 production only. Old production orchestration tests should be deleted or moved out of active production assurance.
- App/client debug trace gets compact state summaries. Langfuse may receive full bounded AgentV2 state for observability.
- No runtime feature flag or fallback to the old production engine. Rollback is a code revert/redeploy. The old path may be archived for reference, but must not be callable from `/api/chat`.

## Non-Goals

- Do not build real saved routine mutation/artifact behavior.
- Do not redesign the frontend route contract to be fully AgentV2-native.
- Do not rename the broad `src/lib/rag` folder in this pass.
- Do not add transcript summarization or increase recent-message loading beyond the current last 10 messages.
- Do not add broad deterministic topic-reset heuristics.
- Do not rework Compare Lab except where tests/imports require it after active production code moves.

---

## File Map

### Create

- `src/lib/agent-v2/production/persisted-session-state.ts`
  - Version-2 AgentV2 envelope, default state, normalization, flat-AgentV2 promotion, compact debug summaries, changed-field detection.

- `src/lib/agent-v2/production/session-state.ts`
  - AgentV2 turn-to-turn state transitions inspired by the tested Compare Lab behavior: routine thread update, accepted session memory merge, surfaced product fact collection.

- `src/lib/agent-v2/production/product-output.ts`
  - Route compatibility mapping from AgentV2 outputs/tool results to product cards, category decisions, engine traces, and product category projection.

### Modify

- `src/app/api/chat/route.ts`
  - Keep importing the active production module directly through `@/lib/agent-v2/production/chat-pipeline`.
  - Rename the destructured runtime dependency from `runProductionAgentPipeline` to `runAgentV2ProductionPipeline`.
  - Ensure no old production pipeline import remains.

- `src/lib/agent-v2/production/chat-pipeline.ts`
  - Rename exported function to `runAgentV2ProductionPipeline`.
  - Use version-2 persisted state.
  - Stop reading legacy conversation-state behavior.
  - Extract session-state and product-output helpers.
  - Keep legacy route artifacts as projections only.

- `src/lib/rag/conversation-state-store.ts`
  - Add or expose a production-safe raw/AgentV2 persistence path if needed.
  - Do not break existing legacy callers that still use V1 `ConversationState`.

- `src/lib/rag/conversation-state.ts`
  - Keep legacy V1 behavior intact for legacy callers.
  - Reuse existing AgentV2 flat-field normalization/bounding logic where practical; do not route AgentV2 production through V1 behavior transition helpers.

- `src/lib/types.ts`
  - Keep existing `ConversationState` as the legacy V1 type for old compare/orchestrator/tests.
  - Do not alias `ConversationState` to the new AgentV2 V2 type in this pass.
  - Add only narrow exported AgentV2 state/transition types if a shared route/debug type is genuinely needed.

- `src/lib/agent-v2/runtime/responses-agent.ts`
  - Replace Compare Lab / Hair Concierge prompt wording with Chaarlie/current conversation wording.
  - Clarify session memory authority.

- `src/lib/agent/production/chat-pipeline.ts`
  - Move to explicit legacy/archive path or rename as legacy so it cannot be mistaken for active production.

- `src/lib/rag/debug-trace.ts`
  - Project compact AgentV2 state summary in route debug trace.

- `tests/agent-v2-production-chat-pipeline.spec.ts`
  - Expand production adapter tests around V2 state, old state ignored, failure preservation, surfaced product facts, and session memory.

- `tests/agent-v2-responses-runtime.spec.ts`
  - Update prompt wording assertions from Compare Lab/Hair Concierge to Chaarlie/current conversation.

- `tests/agent-production-chat-pipeline.spec.ts`
  - Delete, rename, or convert away from active production assurance if it tests old production orchestration.

- `tests/conversation-state.spec.ts`
  - Keep old V1 helper tests if legacy helper code remains in active suites.
  - Add AgentV2 persistence-boundary tests in the AgentV2 production test file instead of changing the V1 helper contract.

- `tests/agent-route-packet.spec.ts` or relevant route tests
  - Add static/import guard that `/api/chat` does not import old production pipeline.

---

## Task 1: Add The AgentV2 V2 State Envelope

**Files:**
- Create: `src/lib/agent-v2/production/persisted-session-state.ts`
- Modify: `src/lib/types.ts`
- Test: `tests/agent-v2-production-chat-pipeline.spec.ts` or a focused new test file if cleaner

- [ ] **Step 1: Write failing tests for V2 defaults and legacy ignore**

Add tests covering:

```ts
test("AgentV2 persisted state defaults to an empty version-2 envelope", () => {
  const state = createDefaultAgentV2ConversationState()
  assert.equal(state.version, 2)
  assert.equal(state.engine, "agent_v2_care_balance")
  assert.equal(state.agent_v2.routine_thread_context, null)
  assert.deepEqual(state.agent_v2.prior_selected_product_projections, [])
  assert.deepEqual(state.agent_v2.session_memory, [])
})

test("AgentV2 persisted state ignores legacy version-1 conversation state", () => {
  const state = normalizeAgentV2ConversationState({
    version: 1,
    active_topic: "routine",
    routine_layer: "basics",
    pending_offer: "routine_goals_or_problems",
    answered_slots: ["routine"],
    last_assistant_action: "asked_routine_basics",
    last_product_category: "leave_in",
  })

  assert.equal(state.version, 2)
  assert.equal(state.engine, "agent_v2_care_balance")
  assert.equal(state.agent_v2.routine_thread_context, null)
  assert.deepEqual(state.agent_v2.prior_selected_product_projections, [])
  assert.deepEqual(state.agent_v2.session_memory, [])
})

test("AgentV2 persisted state promotes flat AgentV2 fields from current version-1 rows", () => {
  const routineThread = {
    active: true,
    current_layer: "basics",
    last_answer_mode: "routine",
    last_routine_categories: ["leave_in"],
    last_user_goal: "Ich will meine Routine einfacher machen.",
    summary_de: "Leave-in ist der erste Zusatz.",
    pending_routine_action: null,
    visible_steps: [],
  }

  const state = normalizeAgentV2ConversationState({
    version: 1,
    active_topic: "routine",
    routine_layer: "basics",
    agent_v2_routine_thread_context: routineThread,
    agent_v2_prior_selected_product_projections: [
      {
        tool_name: "select_products",
        category: "leave_in",
        valid_product_ids: ["leave-in-1"],
        products: [{ product_id: "leave-in-1", name: "Leave-in Beispiel", rank: 1 }],
      },
    ],
    agent_v2_session_memory: [
      { type: "user_preference", summary_de: "Mag leichte Produkte.", evidence: "User said lightweight." },
    ],
  })

  assert.equal(state.version, 2)
  assert.deepEqual(state.agent_v2.routine_thread_context, routineThread)
  assert.equal(state.agent_v2.prior_selected_product_projections.length, 1)
  assert.equal(state.agent_v2.session_memory.length, 1)
})

test("AgentV2 persisted state recovers from malformed persisted state", () => {
  const state = normalizeAgentV2ConversationState({
    version: 2,
    engine: "agent_v2_care_balance",
    agent_v2: {
      routine_thread_context: { active: "not-a-boolean" },
      prior_selected_product_projections: "bad",
      session_memory: [{ type: "bad" }],
    },
  })

  assert.equal(state.version, 2)
  assert.deepEqual(state.agent_v2.prior_selected_product_projections, [])
  assert.deepEqual(state.agent_v2.session_memory, [])
  assert.equal(state.agent_v2.routine_thread_context, null)
})
```

- [ ] **Step 2: Run the failing tests**

Run:

```bash
npx tsx --test tests/agent-v2-production-chat-pipeline.spec.ts
```

Expected: fails because the V2 helpers do not exist yet.

- [ ] **Step 3: Implement `persisted-session-state.ts`**

Implement exported helpers:

```ts
export const AGENT_V2_PRODUCTION_ENGINE = "agent_v2_care_balance" as const

export interface AgentV2ConversationStateV2 {
  version: 2
  engine: typeof AGENT_V2_PRODUCTION_ENGINE
  agent_v2: {
    routine_thread_context: AgentV2RoutineThreadContext | null
    prior_selected_product_projections: AgentV2StoredProductProjection[]
    session_memory: AgentV2SessionMemoryWrite[]
  }
}

export interface LegacyConversationStateV1 {
  version: 1
  active_topic?: unknown
  routine_layer?: unknown
  pending_offer?: unknown
  answered_slots?: unknown
  last_assistant_action?: unknown
  last_product_category?: unknown
}

export type PersistedConversationState =
  | LegacyConversationStateV1
  | AgentV2ConversationStateV2

export function createDefaultAgentV2ConversationState(): AgentV2ConversationStateV2

export function normalizeAgentV2ConversationState(value: unknown): AgentV2ConversationStateV2

export function summarizeAgentV2ConversationState(state: AgentV2ConversationStateV2): {
  version: 2
  engine: "agent_v2_care_balance"
  routine_thread: {
    active: boolean
    current_layer: string | null
    visible_step_count: number
  }
  prior_product_projection_count: number
  session_memory_count: number
}
```

Normalization rules:
- Missing state returns default V2.
- Legacy `version: 1` ignores old behavioral fields.
- Legacy `version: 1` promotes valid flat AgentV2 fields into the nested V2 envelope.
- Unknown/malformed V2 fields are dropped to defaults.
- Prior product projections reuse the existing bounding behavior: last 3 projections and max 3 products each.
- Session memory is bounded to last 8 accepted entries.

- [ ] **Step 4: Update types**

In `src/lib/types.ts`, do **not** redefine the existing `ConversationState` alias. It is still used by legacy compare/orchestrator code and tests that read V1 fields.

```ts
export type AgentV2ConversationStateV2 =
  import("@/lib/agent-v2/production/persisted-session-state").AgentV2ConversationStateV2

export type AgentV2PersistedConversationState =
  import("@/lib/agent-v2/production/persisted-session-state").PersistedConversationState
```

If a shared transition type is needed, add a new AgentV2-specific type rather than changing `ConversationStateTransition` globally:

```ts
export interface AgentV2ConversationStateTransition {
  previous_state: AgentV2ConversationStateV2
  next_state: AgentV2ConversationStateV2
  reason: string
  changed_fields: string[]
  updated_by_engine: "agent_v2"
}
```

Active AgentV2 production code must receive only V2.

- [ ] **Step 5: Verify tests pass**

Run:

```bash
npx tsx --test tests/agent-v2-production-chat-pipeline.spec.ts
```

Expected: V2 state tests pass.

---

## Task 2: Extract AgentV2 Session-State Logic

**Files:**
- Create: `src/lib/agent-v2/production/session-state.ts`
- Modify: `src/lib/agent-v2/production/chat-pipeline.ts`
- Test: `tests/agent-v2-production-chat-pipeline.spec.ts`

- [ ] **Step 1: Write failing tests for trusted state updates**

Add tests for:
- routine thread context persists across production turns
- visible failure preserves previous state
- accepted session memory merges without duplicate bloat
- surfaced product facts are persisted only when grounded in final answer

Example test shape:

```ts
test("AgentV2 production state preserves previous state on visible failure", async () => {
  const previousState = createDefaultAgentV2ConversationState()
  previousState.agent_v2.routine_thread_context = {
    active: true,
    current_layer: "basics",
    last_answer_mode: "routine",
    last_routine_categories: ["leave_in"],
    last_user_goal: "Ich will meine Routine einfacher machen.",
    summary_de: "Leave-in ist der erste Zusatz.",
    pending_routine_action: null,
    visible_steps: [
      {
        step_id: "maintenance-leave-in",
        label_de: "Leave-in",
        category: "leave_in",
        order: 1,
        routine_layer: "basics",
      },
    ],
  }

  const next = buildNextAgentV2SessionState({
    previousState,
    message: "probier nochmal",
    result: failedVisibleResult,
    routineProjection: null,
    selectedProductProjections: [],
    visibleFailure: true,
  })

  assert.deepEqual(next.agent_v2.routine_thread_context, previousState.agent_v2.routine_thread_context)
})
```

- [ ] **Step 2: Run tests to confirm RED**

Run:

```bash
npx tsx --test tests/agent-v2-production-chat-pipeline.spec.ts
```

Expected: fails until extracted helpers exist.

- [ ] **Step 3: Implement `session-state.ts`**

Export pure helpers:

```ts
export type AgentV2StoredProductProjection = Pick<
  Partial<AgentV2SelectProductsProjection>,
  "tool_name" | "category" | "valid_product_ids" | "products"
>

export function collectSurfacedProductIds(answer: AgentV2TerminalAnswer): string[]

export function collectTrustedSurfacedProductProjections(params: {
  projections: readonly AgentV2SelectProductsProjection[]
  answer: AgentV2TerminalAnswer
}): AgentV2StoredProductProjection[]

export function mergePriorSelectedProductProjections(params: {
  previous: readonly AgentV2StoredProductProjection[]
  next: readonly AgentV2StoredProductProjection[]
}): AgentV2StoredProductProjection[]

export function mergeAgentV2SessionMemory(params: {
  previous: readonly AgentV2SessionMemoryWrite[]
  accepted: readonly AgentV2SessionMemoryWrite[]
}): AgentV2SessionMemoryWrite[]

export function updateAgentV2ProductionRoutineThreadContext(params: {
  previous: AgentV2RoutineThreadContext | null
  answer: AgentV2TerminalAnswer
  message: string
  routineProjection: AgentV2RoutineProjection | null
  trusted: boolean
}): AgentV2RoutineThreadContext

export function buildNextAgentV2SessionState(params: {
  previousState: AgentV2ConversationStateV2
  message: string
  result: AgentV2ResponsesTurnResult
  routineProjection: AgentV2RoutineProjection | null
  selectedProductProjections: readonly AgentV2SelectProductsProjection[]
  visibleFailure: boolean
}): AgentV2ConversationStateV2
```

Behavior:
- Match Compare Lab active routine lifecycle.
- If the turn is not trusted, return previous state.
- If routine is no longer active, clear routine thread like Compare Lab.
- Product facts are stored only for surfaced/grounded product IDs.
- Do not store full catalog facts, long descriptions, or hidden tool-only products.

- [ ] **Step 4: Replace inline state helpers in adapter**

In `chat-pipeline.ts`, remove inline copies of:
- `collectSurfacedProductIds`
- `collectTrustedSurfacedProductProjections`
- `mergePriorSelectedProductProjections`
- `mergeAgentV2SessionMemory`
- routine-thread update helpers

Import them from `session-state.ts`.

- [ ] **Step 5: Verify focused tests**

Run:

```bash
npx tsx --test tests/agent-v2-production-chat-pipeline.spec.ts
```

Expected: production state tests pass.

---

## Task 3: Extract Product Output Projection

**Files:**
- Create: `src/lib/agent-v2/production/product-output.ts`
- Modify: `src/lib/agent-v2/production/chat-pipeline.ts`
- Test: `tests/agent-v2-production-chat-pipeline.spec.ts`

- [ ] **Step 1: Write focused tests for route-compatible product output**

Add tests proving:
- product cards are created only for surfaced product IDs
- non-product answers do not attach product cards
- category/engine trace projections come from the latest selected product result

- [ ] **Step 2: Extract helpers**

Move these responsibilities to `product-output.ts`:

```ts
export function deriveMatchedProducts(params: {
  answer: AgentV2TerminalAnswer
  selectedProductResults: SelectProductsToolResult[]
}): Product[]

export function deriveEngineArtifacts(selectedProductsResult: SelectProductsToolResult | null): {
  categoryDecision: ChatCategoryDecision | undefined
  engineTrace: RecommendationEngineTrace | undefined
}

export function deriveProductCategory(answer: AgentV2TerminalAnswer): ProductCategory

export function deriveIntent(answer: AgentV2TerminalAnswer): IntentType

export function buildAgentV2RouterDecision(params: {
  answer: AgentV2TerminalAnswer
  visibleFailure: boolean
}): RouterDecision

export function buildAgentV2Classification(params: {
  answer: AgentV2TerminalAnswer
  intent: IntentType
  productCategory: ProductCategory
  routerDecision: RouterDecision
}): ClassificationResult
```

Rule: these helpers only project AgentV2 output into legacy route/debug shape. They must not perform independent routing decisions.

- [ ] **Step 3: Verify no behavior change**

Run:

```bash
npx tsx --test tests/agent-v2-production-chat-pipeline.spec.ts
```

Expected: pass.

---

## Task 4: Hard-Switch The Production Adapter To V2 State

**Files:**
- Modify: `src/lib/agent-v2/production/chat-pipeline.ts`
- Modify: `src/lib/rag/conversation-state-store.ts`
- Modify: `src/app/api/chat/route.ts`
- Test: `tests/agent-v2-production-chat-pipeline.spec.ts`
- Test: route/import tests

- [ ] **Step 1: Rename active function**

In `chat-pipeline.ts`:

```ts
export async function runAgentV2ProductionPipeline(
  params: PipelineParams,
  deps: ProductionAgentV2PipelineDeps = {},
): Promise<PipelineResult> {
  ...
}
```

- [ ] **Step 2: Update `/api/chat` runtime deps**

`src/app/api/chat/route.ts` already dynamically imports the AgentV2 production module. Keep that direct import path:

```ts
import("@/lib/agent-v2/production/chat-pipeline")
```

Change the destructured name from `runProductionAgentPipeline` to `runAgentV2ProductionPipeline` in the runtime dependency loader and every call site in this route. Do not add a barrel file for one consumer.

- [ ] **Step 3: Use V2 state in the adapter**

Adapter behavior:
- load persisted state through the store
- normalize to V2
- pass:
  - `state.agent_v2.routine_thread_context`
  - `state.agent_v2.prior_selected_product_projections`
  - `state.agent_v2.session_memory`
- pass `currentRoutineLayer` from active AgentV2 routine thread if present, not legacy `routine_layer`:

```ts
currentRoutineLayer: state.agent_v2.routine_thread_context?.active
  ? state.agent_v2.routine_thread_context.current_layer
  : null
```

- after trusted successful result, build next V2 state
- persist V2 `state` and V2 `last_transition`
- do not read legacy `active_topic`, `pending_offer`, `answered_slots`, or `last_assistant_action` for behavior

- [ ] **Step 4: Update store helper**

Keep the existing V1 `loadConversationState` behavior for legacy callers. Add narrowly scoped AgentV2 persistence helpers if needed:

```ts
loadAgentV2ConversationState(...)
persistAgentV2ConversationStateTransition(...)
```

These helpers should:
- load raw persisted `state`
- normalize to AgentV2 V2 with flat-field promotion
- persist V2 state and transition with `state_version = 2`

Do not call `computeConversationStateTransition`, `resolveAgenticConversationStateTransition`, or `applyConversationStateToClassification` in AgentV2 production.

- [ ] **Step 5: Add tests proving old V1 fields do not steer production**

Test:
- given persisted legacy V1 routine state
- when production runs a neutral/product turn
- `runAgentV2ResponsesTurn` receives `routineThreadContext: null` when no flat AgentV2 context is present
- `priorSelectedProductProjections: []`
- `sessionMemory: []`
- output state after successful turn is V2

Also test:
- given persisted V1 row with valid flat `agent_v2_routine_thread_context`
- `runAgentV2ResponsesTurn` receives that routine thread context
- `currentRoutineLayer` is taken from that AgentV2 routine thread, not from V1 `routine_layer`
- output state after successful turn is nested V2

- [ ] **Step 6: Verify focused tests**

Run:

```bash
npx tsx --test tests/agent-v2-production-chat-pipeline.spec.ts
```

Expected: pass.

---

## Task 5: Archive Old Production Pipeline And Remove Production Tests For It

**Files:**
- Move: `src/lib/agent/production/chat-pipeline.ts`
- Modify/delete: `tests/agent-production-chat-pipeline.spec.ts`
- Modify: any imports still referencing the old production path
- Test: route/import guard

- [ ] **Step 1: Move old pipeline to archive path**

Move old file to:

```txt
src/lib/agent/legacy-production/chat-pipeline.ts
```

Add header comment:

```ts
// Legacy archived production pipeline. Not reachable from /api/chat.
// Kept temporarily for historical reference until the post-ship cleanup pass.
```

- [ ] **Step 2: Remove old production orchestration tests from active assurance**

If `tests/agent-production-chat-pipeline.spec.ts` only tests old production orchestration, delete it or rename it outside the active test command.

Do not keep old production behavior green for its own sake.

- [ ] **Step 3: Add static import guard**

Add a test that reads `src/app/api/chat/route.ts` and asserts it does not contain:

```txt
@/lib/agent/production
@/lib/agent/legacy-production
```

and does contain:

```txt
@/lib/agent-v2/production
```

- [ ] **Step 4: Verify no active imports**

Run:

```bash
rg -n "@/lib/agent/production|@/lib/agent/legacy-production|runProductionAgentPipeline" src tests -g '!tests/agent-production-chat-pipeline.spec.ts'
```

Expected:
- no active `/api/chat` import
- no active production test references old pipeline
- archived path appears only in explicitly legacy context if any
- if `tests/agent-production-chat-pipeline.spec.ts` is deleted, run the same grep without the exclusion

---

## Task 6: Update Runtime Prompt Wording To Chaarlie Production

**Files:**
- Modify: `src/lib/agent-v2/runtime/responses-agent.ts`
- Test: `tests/agent-v2-responses-runtime.spec.ts`
- Test: `tests/agent-v2-guidance-compiler.spec.ts` if wording assertions are affected

- [ ] **Step 1: Write/update prompt wording assertions**

Assert first model input:
- does not contain `Compare Lab`
- does not contain `Hair Concierge` in the first/highest-priority system message or AgentV2 runtime context labels
- contains `Chaarlie`
- describes session memory as conversation-scoped working memory

- [ ] **Step 2: Update runtime prompt strings**

Change the first system message from:

```txt
You are AgentV2 for Hair Concierge.
```

to:

```txt
You are AgentV2 for Chaarlie.
```

Change:

```txt
Loaded Compare Lab user context.
```

to:

```txt
Loaded Chaarlie user context.
```

Change:

```txt
Surfaced product facts from earlier turns in this Compare Lab run.
```

to:

```txt
Surfaced product facts from earlier turns in this conversation.
```

Change:

```txt
Session memory for this Compare Lab run:
```

to:

```txt
Conversation-scoped AgentV2 working memory. Use only when relevant to the latest user message; do not override current user intent:
```

- [ ] **Step 3: Verify runtime tests**

Run:

```bash
npx tsx --test tests/agent-v2-responses-runtime.spec.ts
```

Expected: pass.

---

## Task 7: Compact Debug Trace, Full Langfuse Context

**Files:**
- Modify: `src/lib/rag/debug-trace.ts`
- Modify: `src/lib/agent-v2/production/chat-pipeline.ts`
- Test: relevant debug trace tests

- [ ] **Step 1: Add compact app debug state summary**

Route debug trace should include summary only:

```ts
agent_v2_state: {
  version: 2,
  engine: "agent_v2_care_balance",
  routine_thread: {
    active,
    current_layer,
    visible_step_count,
  },
  prior_product_projection_count,
  session_memory_count,
  changed_fields,
  ignored_legacy_state?: boolean,
  recovered_malformed_state?: boolean,
}
```

- [ ] **Step 2: Keep full bounded state available to Langfuse**

Production adapter can attach full bounded AgentV2 state to internal Langfuse/debug metadata, but not to user-facing client response.

The SSE `retrieval_debug` event and app debug panel must receive only the compact summary. Full bounded AgentV2 state is allowed only in Langfuse/internal traces.

- [ ] **Step 3: Verify debug tests**

Run:

```bash
npx tsx --test tests/agent-compare-product-trace.spec.ts tests/agent-v2-production-chat-pipeline.spec.ts
```

Expected: pass.

---

## Task 8: Full Verification

**Files:**
- No new files unless fixing test failures.

- [ ] **Step 1: Focused production tests**

Run:

```bash
npx tsx --test tests/agent-v2-production-chat-pipeline.spec.ts
```

Expected: pass.

- [ ] **Step 2: Runtime tests**

Run:

```bash
npx tsx --test tests/agent-v2-responses-runtime.spec.ts
```

Expected: pass.

- [ ] **Step 3: Agent suite**

Run:

```bash
npm run test:agent
```

Expected: pass.

- [ ] **Step 4: Node suite**

Run:

```bash
npm run test:node
```

Expected: pass.

- [ ] **Step 5: Typecheck**

Run:

```bash
npm run typecheck
```

Expected: pass.

- [ ] **Step 6: Lint**

Run:

```bash
npm run lint
```

Expected: no errors. Existing warnings are acceptable if unrelated and documented.

- [ ] **Step 7: Build**

Run:

```bash
npm run build
```

Expected: pass.

- [ ] **Step 8: Diff hygiene**

Run:

```bash
git diff --check
git status --short
```

Expected:
- no whitespace errors
- changed files match this plan and already-approved production switch work

- [ ] **Step 9: State-version and rollback check**

Before committing, inspect any analytics/admin assumptions around `conversation_states.state_version`.

Rollback story for this ship:
- no runtime fallback flag
- no old engine import from `/api/chat`
- rollback is revert/redeploy of this production switch commit
- archived legacy code is reference only and must not be wired into route deps

- [ ] **Step 10: Post-deploy observability note**

After deploy, inspect Langfuse latency summaries for AgentV2 production turns. Record p50/p95 and any large regression in the post-ship cleanup backlog. This is an operational check, not a reason to keep a legacy runtime fallback in code.

---

## Review Checklist

Before commit/push:

- [ ] `/api/chat` imports AgentV2 production only.
- [ ] No active production path imports old tool-loop production pipeline.
- [ ] Legacy version-1 conversation state cannot influence AgentV2 behavior.
- [ ] V2 state is written only after successful assistant message persistence.
- [ ] Visible failures preserve previous state.
- [ ] CareBalance is recomputed each turn.
- [ ] Product memory is surfaced/minimal, not a hidden catalog.
- [ ] Runtime prompt says Chaarlie/current conversation, not Compare Lab/Hair Concierge.
- [ ] Durable memory extraction still runs after successful turns.
- [ ] Product/routine route compatibility artifacts are projections from AgentV2 output only.
- [ ] Old production orchestration tests are not part of active production assurance.
- [ ] Backlog contains broader cleanup: delete archived pipeline, rename historical `rag` modules, make route contract AgentV2-native later.
