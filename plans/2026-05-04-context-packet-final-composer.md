# Context Packet Final Composer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:test-driven-development` for the tests-first loop. Use `superpowers:subagent-driven-development` only if splitting the packet builder, prompt work, and trace/admin work across independent files.

**Spec:** This plan is the implementation spec for the approved May 4, 2026 architecture decision in this thread. It supersedes the final-answer-composition parts of `plans/2026-05-03-conversation-frame-v2.md`; do not implement a v2 frame classifier for this work.

**User Situation:** 100+ testers will use the chat in messy, multi-turn ways. The v1 conversation state now helps routing remember the active topic, but production testing showed final answers can still sound generic, restart prior explanations, over-expand optional routine modules, or fail to compare directly.

**Promised End-State:** The production chat keeps its current route/tool/final-render flow with no extra LLM call, but the final render receives a compact `conversation_context_packet` that turns structured outputs into a clean advisor briefing. Users feel the assistant remembers the thread, answers the latest delta first, keeps simple asks simple, compares directly, and summarizes prior decisions without generic restarts. Engineers can inspect the packet and response-composition trace when a turn feels off.

**Chosen Architecture:** Context-engineered final-answer composition. The system owns state, structured outputs, product constraints, safety, schemas, traces, and evals. The final LLM owns natural German wording, empathy, answer order, recap amount, and conversational synthesis.

## Scope Boundaries

- Do not add a separate LLM call for a response frame.
- Do not replace the existing production route classifier in this iteration.
- Do not build a full dialogue-state machine or large conversation-move taxonomy.
- Do not create category-specific product/recommendation rewrites.
- Do not persist new durable user memory from the context packet.
- Do not expose internal labels such as `narrow_followup` or `conversation_context_packet` to users.
- Keep current product constraints authoritative: no invented products, no unsupported product claims, preserve selected product order.
- Keep all UI copy in German if any admin/debug UI text changes.

## Target File Map

- Create: `src/lib/agent/orchestrator/conversation-context-packet.ts`
  - Owns V1 packet types, move hints, budgeted packet building, and formatting helpers.
- Modify: `src/lib/agent/orchestrator/route-packet.ts`
  - Add `conversation_context` to `AgentRuntimePacket`.
  - Pass the current message into `buildAgentRuntimePacket`.
- Modify: `src/lib/agent/orchestrator/run-shadow-agent-turn.ts`
  - Build the packet after route/tool outputs and before `renderFinalAnswer`.
- Modify: `src/lib/agent/orchestrator/prompt.ts`
  - Add the final-composer behavior contract for using `packet.conversation_context`.
- Modify: `src/lib/agent/orchestrator/model-client.ts`
  - Keep one final render call; no new model call.
- Modify: `src/lib/agent/production/chat-pipeline.ts`
  - Include packet summary in response-composition trace.
- Modify: `src/lib/types.ts`
  - Extend `ResponseCompositionTrace` with compact context-packet metadata.
- Modify: `src/lib/rag/debug-trace.ts`
  - Carry the new trace fields into finalized turn traces and debug events.
- Modify: `src/app/admin/conversations/[id]/page.tsx`
  - If needed, show readable packet metadata without dumping excessive JSON.
- Test: `tests/agent-context-packet.spec.ts`
  - Pure packet builder coverage.
- Test: `tests/agent-route-packet.spec.ts`
  - Runtime packet includes the new context packet.
- Test: `tests/agent-final-render-prompt.spec.ts`
  - Prompt contract coverage.
- Test: `tests/agent-production-chat-pipeline.spec.ts`
  - End-to-end propagation through production chat pipeline.
- Test: `tests/chat-debug-trace.spec.ts`
  - Trace metadata coverage.

## V1 Packet Shape

Keep this compact and final-render-ready. The packet is not a replacement for all raw internals.

```ts
type ConversationMoveHint =
  | "continue"
  | "narrow_followup"
  | "compare"
  | "summarize"
  | "new_topic"

interface ConversationContextPacketV1 {
  version: 1
  conversation: {
    move_hint: ConversationMoveHint
    active_topic: ConversationState["active_topic"]
    routine_layer: ConversationState["routine_layer"]
    latest_user_delta: string
    prior_context_summary: string | null
  }
  user_context: {
    profile_summary: string[]
    relevant_memory_summary: string | null
    relevant_constraints: string[]
  }
  structured_outputs: {
    route: {
      user_job: AgentUserJob
      product_category: SelectableProductCategory | null
      routine_layer: RoutineLayer | null
      confidence: number
    }
    selected_products: SelectedProductsProjection | null
    routine_plan: BuildOrFixRoutineProjection | null
    guidance_ids: string[]
    validation_warnings: string[]
  }
  composition_guidance: {
    answer_style:
      | "compact_steps"
      | "short_explanation"
      | "direct_comparison"
      | "thread_recap"
      | "focused_answer"
    must_do: string[]
    avoid: string[]
    detail_level: "short" | "medium" | "full"
  }
  budget: {
    estimated_chars: number
    truncated_fields: string[]
  }
}
```

Notes:

- `move_hint` is a coarse, inspectable hint, not a hard route.
- Free-text fields do the nuance: `latest_user_delta`, `must_do`, `avoid`.
- The final LLM may use raw current message and recent history to refine the move, but must respect product/routine facts.
- V1 packet budget target: under about 3,000 chars for common turns, excluding existing selected product projection size.

## Task 1: Add Failing Packet Builder Tests

- [ ] Create `tests/agent-context-packet.spec.ts`.
- [ ] Add fixture helpers for:
  - active routine state with a narrow follow-up: "Bitte nicht so kompliziert."
  - comparison ask: "Warum dieses Shampoo und kein Tiefenreinigungsshampoo?"
  - explicit recap ask: "Kannst du mir das als Wochenroutine zusammenfassen?"
  - category switch from routine to product pick.
- [ ] Assert move hints:
  - simple/only/concrete first step -> `narrow_followup`
  - why A not B / oder / vergleichen -> `compare`
  - zusammenfassen / Wochenroutine / Plan -> `summarize`
  - clear new category while prior topic differs -> `new_topic`
  - same topic next-step asks -> `continue`
- [ ] Assert move-specific guidance:
  - narrow follow-up says answer latest delta first and avoid full restart
  - summarize says preserve prior decisions and reduce detail
  - compare says compare options directly and give a pick when enough context exists
- [ ] Assert structured outputs are present but compact:
  - route/category/confidence
  - selected product projection passthrough
  - routine plan passthrough
  - guidance IDs only, not entire source docs
- [ ] Assert packet does not include raw private/debug-only fields beyond the current conversation context.

Run:

```bash
npx tsx --test tests/agent-context-packet.spec.ts
```

Expected first run: fails because the packet builder does not exist.

## Task 2: Implement The Packet Builder

- [ ] Create `src/lib/agent/orchestrator/conversation-context-packet.ts`.
- [ ] Add exported V1 types.
- [ ] Implement `inferConversationMoveHint(params)` with a small, readable heuristic:
  - route `compare_or_decide` -> `compare`
  - explicit recap words -> `summarize`
  - active state plus "nur", "konkret", "einfach", "reicht", "brauche ich" -> `narrow_followup`
  - active state plus clear different category -> `new_topic`
  - otherwise active state -> `continue`
  - no active state -> `new_topic`
- [ ] Implement `buildConversationContextPacket(params)`.
- [ ] Keep heuristics deliberately shallow; do not encode hair-care issue taxonomy.
- [ ] Add a tiny `estimatePacketChars` helper and `truncated_fields` list for future debugging.
- [ ] Re-run `tests/agent-context-packet.spec.ts`.

## Task 3: Wire Packet Into Runtime Packet

- [ ] Extend `AgentRuntimePacket` in `src/lib/agent/orchestrator/route-packet.ts` with:

```ts
conversation_context: ConversationContextPacketV1
```

- [ ] Update `buildAgentRuntimePacket` params to accept:
  - `message`
  - effective user context
  - previous conversation state
  - route
  - selected products
  - routine plan
  - guidance
- [ ] Call `buildConversationContextPacket` inside `buildAgentRuntimePacket` or immediately before it. Prefer inside if the function already owns final packet assembly cleanly.
- [ ] Update `run-shadow-agent-turn.ts` to pass `message`.
- [ ] Update `tests/agent-route-packet.spec.ts`:
  - packet contains `conversation_context.version = 1`
  - existing route/product/routine fields are unchanged
  - selected product order stays untouched
- [ ] Update affected fake packets in tests with the new field or provide a test helper default.

Run:

```bash
npx tsx --test tests/agent-context-packet.spec.ts tests/agent-route-packet.spec.ts
```

## Task 4: Teach Final Render To Use The Packet

- [ ] Update `AGENT_FINAL_RENDER_PROMPT` near the top, before category-specific rules, with a "conversation composition" block:
  - `packet.conversation_context` is the briefing for how this turn should feel.
  - answer the latest user delta first.
  - preserve prior decisions and constraints.
  - do not restart the full topic unless the user asks.
  - compare directly when `move_hint=compare`.
  - summarize only when asked or when `move_hint=summarize`.
  - if `detail_level=short`, reduce optional modules.
  - use empathy when the user sounds overwhelmed, frustrated, or unsure.
  - structured outputs are authoritative facts; raw conversation text is for wording and continuity.
- [ ] Keep all existing product-claim and safety rules intact.
- [ ] Add tests in `tests/agent-final-render-prompt.spec.ts` asserting the new contract is present.
- [ ] Add one test proving the prompt says not to expose internal move labels.

Run:

```bash
npx tsx --test tests/agent-final-render-prompt.spec.ts
```

## Task 5: Trace The Packet Without Adding Latency

- [ ] Extend `ResponseCompositionTrace` in `src/lib/types.ts` with:

```ts
context_packet_version: 1 | null
conversation_move_hint: ConversationMoveHint | null
answer_style_hint: ConversationContextPacketV1["composition_guidance"]["answer_style"] | null
detail_level_hint: ConversationContextPacketV1["composition_guidance"]["detail_level"] | null
context_packet_estimated_chars: number | null
context_packet_truncated_fields: string[]
```

- [ ] Populate these fields in `src/lib/agent/production/chat-pipeline.ts` from `result.runtime_packet.conversation_context`.
- [ ] Keep legacy synthesizer traces valid by setting these fields to null/empty where needed.
- [ ] Update `src/lib/rag/debug-trace.ts` and tests so finalized traces preserve the new metadata.
- [ ] If admin trace UI needs a compact display, add:
  - move hint
  - answer style
  - detail level
  - packet chars/truncation
  Avoid dumping the full packet by default.

Run:

```bash
npx tsx --test tests/chat-debug-trace.spec.ts tests/agent-production-chat-pipeline.spec.ts
```

## Task 6: Add Conversation-Continuity Regression Fixtures

- [ ] Add focused production-pipeline tests with fake model clients that inspect the packet passed to `renderFinalAnswer`.
- [ ] Cover at least these flows:
  - Routine first answer -> "Was ist der erste Waschtag? Bitte simpel." -> packet says narrow and avoid full restart.
  - Shampoo recommendation -> "Warum das und kein Tiefenreinigungsshampoo?" -> packet says compare and includes selected product context plus route/category.
  - Several routine turns -> "Fass mir das als Wochenroutine zusammen." -> packet says summarize and preserve prior decisions.
  - Routine topic -> explicit "Welches Shampoo empfiehlst du?" -> packet says new topic or product pick, and does not trap the user in routine.
- [ ] Add an eval fixture file if useful:
  - `tests/fixtures/conversation-continuity-cases.json`
  - Keep cases generic enough that future categories can be added without schema changes.
- [ ] Do not assert exact model wording in deterministic unit tests. Assert packet/guidance and use judged/manual eval for answer quality.

Run:

```bash
npx tsx --test tests/agent-production-chat-pipeline.spec.ts
```

## Task 7: Update Debug/Quality Documentation

- [ ] Add a short note to `docs/langfuse-quality-loop.md` or a nearby quality doc:
  - context packet is the final-composer briefing
  - move hints are broad, not a complete taxonomy
  - evals decide whether to add an exception planner later
- [ ] Update any stale mention that Conversation Frame V2 is the next default runtime architecture. Phrase V2 frame work as deferred unless evals prove V1 packet composition insufficient.
- [ ] Keep docs concise; do not create a second architecture manifesto.

## Task 8: Verification

Automated:

```bash
npx tsx --test tests/agent-context-packet.spec.ts
npx tsx --test tests/agent-final-render-prompt.spec.ts
npx tsx --test tests/agent-route-packet.spec.ts
npx tsx --test tests/agent-production-chat-pipeline.spec.ts
npx tsx --test tests/chat-debug-trace.spec.ts
npm run test:playwright:contracts
npm run typecheck
```

Manual / product-quality:

- [ ] Run the Lea production-style journey locally or on preview:
  - lost routine
  - first simple wash day
  - leave-in vs conditioner
  - heat protection order
  - between-wash refresh
  - shampoo recommendation
  - why not deep cleansing
  - weekly recap
- [ ] Confirm the user-visible answer quality:
  - no full restart on narrow follow-up
  - simple asks stay simple
  - comparison answers compare directly
  - recap preserves prior decisions
  - category switch answers the new ask while preserving context
- [ ] Inspect one trace in admin:
  - conversation state transition present
  - response composition shows move hint and packet metadata
  - packet size/truncation is reasonable

Because this touches the core chat, recommendations, copy, and trust, run `ready-check` before shipping.

## Success Criteria

- No extra LLM call is introduced.
- Production final render receives `conversation_context.version = 1` on every agent chat turn.
- Prompt explicitly instructs the final LLM to answer the latest delta, preserve prior decisions, and avoid generic restarts.
- Existing product/routine safety tests remain green.
- Continuity fixtures prove the packet carries enough guidance for narrow follow-ups, comparisons, summaries, and topic shifts.
- A manual Lea-style run feels materially more natural than the May 4 production review.

## Follow-Up Decision Gate

Do not implement Option 2 now. Consider a separate LLM-generated response frame only if post-merge evals show repeated failures in specific flows that cannot be fixed by:

- packet curation,
- final prompt improvements,
- better structured tool outputs,
- or judged eval feedback.

If that happens, treat the planner/frame as an exception path for the failing slice, not the default chat architecture.
