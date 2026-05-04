# Conversation Frame V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:test-driven-development` for the tests-first loop. Use `superpowers:subagent-driven-development` only if splitting implementation across independent files.

**Spec:** `/Users/nick/AI_work/hair_conscierge/.worktrees/conversation-state-observability/docs/superpowers/specs/2026-05-03-conversation-frame-v2-design.md`

**User Situation:** 100+ testers will use the chat in messy, multi-turn ways. The assistant must continue naturally across routine, product, troubleshooting, ingredient, usage-order, and comparison conversations without predefining every possible issue path.

**Promised End-State:** The chat passes an explicit conversation frame through classification, tools, final render, persistence, and traces. Users feel the assistant remembers what they just discussed. Engineers can inspect whether a bad turn came from interpretation, merge, routing, or final rendering.

**Implementation Shape:** Upgrade v1 `ConversationState` into versioned v2 `ConversationFrame` storage. The existing classifier LLM emits route + frame in one structured output. Deterministic code validates/merges/persists/traces the frame. The final synthesizer receives raw messages plus the frame and obeys `answer_style`.

## Scope Boundaries

- Do not add a third LLM call.
- Do not build deterministic issue/product mappings from frame summaries.
- Do not enumerate all hair issues, follow-up types, or category paths.
- Do not remove v1 routine state behavior until v2 tests prove parity.
- Do not store durable user memory from frames in this iteration.

## Target File Map

- Modify: `src/lib/types.ts`
  - Add v2 frame types while preserving v1 types during migration.
- Modify: `src/lib/rag/conversation-state.ts`
  - Add frame defaults, validation, v1-to-v2 normalization, merge logic, and trace metadata.
- Modify: `src/lib/rag/conversation-state-store.ts`
  - Persist versioned v2 frame JSON in the existing `conversation_states` table.
- Modify: `src/lib/rag/intent-classifier.ts`
  - Extend structured classifier output to include `conversation_frame`.
- Modify: `src/lib/rag/orchestrator/conversation-orchestrator.ts`
  - Load previous frame, pass it into classification, merge frame, pass frame to route/tool/final render, return transition.
- Modify: `src/lib/rag/contracts.ts`
  - Add frame fields to pipeline params/results.
- Modify: `src/lib/rag/synthesizer.ts`
  - Replace the narrow v1 state prompt block with the v2 frame behavior contract.
- Modify: `src/lib/rag/debug-trace.ts`
  - Store previous/current/merged frame, merge reason, validation errors, and answer style.
- Modify: `src/app/admin/conversations/[id]/page.tsx`
  - Show readable frame summary plus expandable JSON.
- Test: `tests/conversation-frame.spec.ts`
  - Pure frame validation/merge/migration tests.
- Test: `tests/agent-final-render-prompt.spec.ts`
  - Prompt contract tests for answer-style behavior.
- Test: `tests/chat-debug-trace.spec.ts`
  - Trace visibility tests.
- Test: `tests/agent-production-chat-pipeline.spec.ts`
  - End-to-end pipeline propagation tests.
- Optional test data: add a small multi-turn fixture derived from the available chat prompt corpus.

## Task 1: Add V2 Frame Types And Failing Tests

- [ ] Create `tests/conversation-frame.spec.ts`.
- [ ] Add tests for `createDefaultConversationFrame()`.
- [ ] Add tests for schema normalization:
  - invalid relation falls back to `new_topic`
  - invalid answer style falls back to `focused_answer`
  - confidence clamps to `0..1`
  - open `active_thread.label` and `summary` are preserved
- [ ] Add tests for merge rules:
  - high-confidence topic shift replaces previous thread
  - high-confidence continuation preserves previous thread
  - low-confidence frame marks `needs_trace_review`
  - invalid frame creates `frame_validation_failed`
- [ ] Add tests for v1 migration:
  - routine state maps into a useful routine frame
  - empty/non-routine v1 maps to no prior frame unless reliable context exists

Run:

```bash
npx playwright test tests/conversation-frame.spec.ts
```

Expected first run: fails because the v2 frame helpers do not exist.

## Task 2: Implement Frame Core

- [ ] Add v2 types in `src/lib/types.ts`:
  - `ConversationRelation`
  - `AnswerStyle`
  - `ConversationThread`
  - `ReferencedContext`
  - `ConversationFrame`
  - `ConversationFrameTransition`
- [ ] Implement helpers in `src/lib/rag/conversation-state.ts`:
  - `createDefaultConversationFrame`
  - `normalizeConversationFrame`
  - `normalizePreviousConversationFrame`
  - `mergeConversationFrame`
  - `formatConversationFrameForPrompt`
- [ ] Keep existing v1 routine state helpers green during migration.
- [ ] Re-run focused frame tests.

## Task 3: Extend Classifier To Emit Route Plus Frame

- [ ] Update the classifier prompt contract so the model returns existing route fields plus `conversation_frame`.
- [ ] Pass previous frame and recent messages into the classifier context.
- [ ] Validate route and frame independently:
  - bad route falls back to current route defaults
  - bad frame falls back to safe frame and trace note
- [ ] Add/adjust tests in `tests/agent-production-chat-pipeline.spec.ts` proving:
  - classifier user context includes previous frame
  - classifier result carries current frame
  - no new model call is introduced for frame interpretation

## Task 4: Pass Frame Through Orchestrator And Tools

- [ ] Load previous frame from `conversation_states`.
- [ ] Merge current frame before final render.
- [ ] Add merged frame to pipeline result.
- [ ] Keep route/tool decisions product-contract driven, not frame-summary driven.
- [ ] Ensure routine v1 continuity tests still pass.

Run:

```bash
npx playwright test tests/conversation-state.spec.ts tests/routine-planner.spec.ts
```

## Task 5: Make Final Render Actually Continue

- [ ] Replace the old `<conversation_state>` prompt block in `src/lib/rag/synthesizer.ts` with a compact v2 frame block.
- [ ] Add explicit final render behavior:
  - `direct_continuation`: answer the delta, no full recap
  - `focused_answer`: compact answer grounded in prior context
  - `one_next_step`: one practical test/action plus observation signal
  - `clarifying_question`: one necessary question
  - `full_answer`: complete answer only for new topics or explicit recap requests
- [ ] Add tests in `tests/agent-final-render-prompt.spec.ts` proving those instructions are present.
- [ ] Add one failing narrow-follow-up fixture where the prior answer must not be restarted.

## Task 6: Persist And Trace The Frame

- [ ] Update store payloads to persist v2 frame JSON in the existing table.
- [ ] Update `src/lib/rag/debug-trace.ts` and trace types with:
  - `previous_conversation_frame`
  - `current_conversation_frame`
  - `merged_conversation_frame`
  - `merge_reason`
  - `needs_trace_review`
  - `answer_style`
- [ ] Update admin conversation detail:
  - German compact summary for quick scanning
  - expandable JSON for exact debugging
- [ ] Extend `tests/chat-debug-trace.spec.ts`.

## Task 7: Add General Multi-Turn Eval Fixtures

- [ ] Add a small fixture builder from the available chat prompt corpus.
- [ ] Start with the five known chains as seed regressions.
- [ ] Add at least 10 varied first prompts and two natural follow-ups each.
- [ ] Assertions must be generic:
  - follow-up continuation preserves relevant thread
  - topic shifts are accepted
  - the answer does not ask for already-provided info
  - narrow follow-ups do not restart a full overview
  - traces identify interpretation/merge/render state
- [ ] Keep this fixture easy to extend after user-testing failures.

## Verification

Run focused tests first:

```bash
npx playwright test tests/conversation-frame.spec.ts
npx playwright test tests/agent-final-render-prompt.spec.ts
npx playwright test tests/chat-debug-trace.spec.ts
npx tsx --test tests/agent-production-chat-pipeline.spec.ts
```

Then run the relevant broader suite:

```bash
npm run test:agent
npm run typecheck
npm run lint
npm run build
```

Manual smoke test in local chat:

1. Start with a broad routine/product/troubleshooting question.
2. Ask a constraint follow-up.
3. Ask a next-step follow-up.
4. Switch topic clearly.
5. Inspect admin trace for previous/current/merged frame and answer style.

## Definition Of Done

- Users get continuation-style answers for narrow follow-ups outside routine.
- The model still sees exact wording and recent messages, not only structured state.
- Product recommendations remain governed by existing tools/product contracts.
- New user-testing failures can be added as eval fixtures without adding enum values.
- Admin traces make bad turns diagnosable within minutes.
