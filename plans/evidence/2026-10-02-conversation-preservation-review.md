# Preservation review — conversation batch (129 to 144), 2026-10-02

Read-only review of the applied worktree against `HEAD`. No test, provider, or
repository mutation was performed by this review. I inspected the supplied c8
artifacts in `/tmp/test-audit-conversation-{node,playwright}-{before,after}`.

## Verdict

**No restoration required; no surviving contract gap found.** The 15 removed
test declarations are exactly 10 retired classifier/reducer cases, one retired
tool-loop trace projector case, two retired scalar resolved-context adapters,
and two isolated utility cases. The retained/retargeted assertions cover the
live contracts named below.

## Conversation state: 10 declarations removed, live predicate retained

`src/lib/chat-runtime/conversation-state.ts` removes only
`applyConversationStateToClassification` (`HEAD :169-192`) and
`computeConversationStateTransition` (`HEAD :207-352`) plus helpers exclusive
to that reducer. The live `shouldApplyPendingRoutineAnswerOverride` remains at
actual `:165-175` and is imported by the compare/shadow executor at
`src/lib/agent/orchestrator/run-shadow-agent-turn.ts:17`.

The current `tests/conversation-state.spec.ts` retains the six positive
predicate inputs in `:119-143` (the former `:230` composite positive input is
carried into that table), four direct negative predicates at `:147-226`, and
the three unrelated-message negatives at `:208-226` (retargeted former `:394`).
It also keeps the stale-offer negative at `:230-249` (retargeted former `:426`)
and the live `resolveAgenticConversationStateTransition` contract tests at
`:280-380`. The old `:695` declaration is absent once, not counted under both
removed wrappers.

The current file has 13 test declarations versus 23 at `HEAD`: **10 removed**.
No live predicate assertion was deleted.

## Trace projector: one declaration removed, trace lifecycle retained

`projectAgenticToolLoopTraceForApp` and its exclusive private projection helpers are
removed from `src/lib/chat-runtime/debug-trace.ts` (HEAD `:73-379`). Search finds
no remaining source caller. This did not remove the trace carrier: actual
`buildPipelineTraceDraft` accepts and stores `agentic_tool_loop` at `:143-232`,
and `finalizeChatTurnTrace` persists it at `:235-295`. `/api/chat` still
finalizes the trace at `src/app/api/chat/route.ts:571` and `:646`; the AgentV2
pipeline builds its trace at `src/lib/agent-v2/production/chat-pipeline.ts:1623`.

The five retained debug-trace tests retain draft/finalization, response
composition, compact tool-loop metadata, and AgentV2 Langfuse summary. The one
deleted test was only the disconnected projector test (`HEAD
tests/chat-debug-trace.spec.ts:723`).

## Resolved-product state: two scalar cases removed, stack/persistence retained

Removed adapter bodies are `buildActiveResolvedProductContextFromLookup` (HEAD
`:172-197`) and `buildNextActiveResolvedProductContext` (HEAD `:356-367`). The
live replacement is `buildActiveProductContextFromLookup` at actual
`src/lib/agent-v2/resolved-product-selection-adapter.ts:172-206`, followed by
`mergeActiveProductContexts` (`:278`) and `buildPrimaryResolvedProductContext`
(`:267`). The product lookup outcome executes precisely that sequence at
`src/lib/agent-v2/production/product-lookup-turn-outcome.ts:256-283`; the
pipeline repeats the stack/primary derivation at `:1299-1310`.

The retained adapter test file has 8 declarations versus 10 at HEAD: the two
removed titles are exactly the obsolete found-exact scalar projection and scalar
precedence cases. It retains primary resolved selection (`:136-194`) and pending
replacement merge cases (`:196-266`).

The mixed pipeline test is preserved and strengthened, not deleted:
`tests/agent-v2-production-chat-pipeline.spec.ts:776-802` asserts both the
three-context cap and `state.agent_v2.active_resolved_product_context?.product_id
=== "product-four"`. This field is part of the actual interface at
`persisted-session-state.ts:29`, and `buildAgentV2State` derives it at `:109-130`.

## Two isolated utility declarations and mixed helper assertions

- The removed loading-progress test was the sole test of the deleted pure helper
  `getPersonalPlanLoadingProgress` (HEAD
  `src/lib/personal-plan-quiz/loading-timeline.ts:17-28`). The live stage data
  remains at actual `:1-15`; no source caller remains.
- The removed direct alias-conflict test exercised only
  `detectBrandAliasConflicts` (HEAD
  `src/lib/product-identity/brand-resolution.ts:202-230`). The real catalog
  builder still computes conflicts and excludes aliases at actual `:344-374`,
  with keeper tests at `tests/product-identity-resolution.test.ts:112-143` and
  `:181-214`.
- `verifyPersonalPlanFieldTestToken`, `cockpitVoiceOrNull`, and the two waitlist
  token issue/verify helpers lost only mixed assertions or retired leaves. Their
  current owners retain real paths: field-test server hashes received tokens at
  `src/lib/personal-plan-field-test/server.ts:123-126`, cockpit rendering uses
  `cockpitVoice`, and waitlist persistence hashes opaque tokens at
  `src/lib/waitlist/persistence.ts:15-20` with its remaining persistence test.

## Supplied execution and coverage evidence

- Node artifact: **127/127 passing before; 123/123 passing after**. Its four
  removed subtests are the two scalar adapter tests plus loading progress and
  direct alias-conflict utility tests. Surviving adapter execution remains
  covered: `buildActiveProductContextFromLookup` 5->5,
  `mergeActiveProductContexts` 49->49, and
  `buildPrimaryResolvedProductContext` 83->81. The latter two-hit reduction is
  attributable to deleted scalar-adapter test calls, while the remaining live
  implementations are still executed.
- Playwright artifact: **29/29 passing before; 18/18 passing after**. The 11
  removed declarations are the 10 conversation cases and one trace projector
  case. The retained predicate table and trace lifecycle tests are present in
  the after run log. `buildPipelineTraceDraft` stays at 24 executions before and
  after in c8; `buildMatchedProductTrace` also stays at 24.
- c8 reports the conversation predicate/reducer functions as source-map entries
  with zero direct counts in both Node artifacts, so those counters cannot prove
  test execution. The before/after Playwright test list and direct retained
  assertions above are the relevant evidence there. There is no newly zeroed
  surviving function or branch attributable to this batch; the denominator
  reductions are deleted code and transformed export mappings.
