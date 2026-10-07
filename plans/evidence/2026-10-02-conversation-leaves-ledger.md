# Conversation leaves audit — 2026-10-02

Read-only semantic review. Evidence was checked at the pruning worktree HEAD and at
deployed baseline `3abfe00a`; the latter has the same reachability for every symbol.
No test runner was started.

## Delete-ready legacy Tool Loop state model

### `applyConversationStateToClassification`

- Source unlocked: `src/lib/chat-runtime/conversation-state.ts:169-192`.
- Runtime status: no caller. The retained predicate
  `shouldApplyPendingRoutineAnswerOverride` is still used by the shadow tool-loop
  runner (`src/lib/agent/orchestrator/run-shadow-agent-turn.ts:17`), but this
  classifier-rewrite wrapper is not. `/api/chat` uses the AgentV2 production
  pipeline, introduced in `fc8b7e20`, and its own structured state instead.
- Delete 3 whole AST tests and remove dead-wrapper assertions from 3 mixed tests
  (7 identifier references, including the import):
  - `tests/conversation-state.spec.ts:230` — `short answer to pending routine basics keeps route in routine context`
  - `:394` — `unrelated short general messages do not override pending routine context`
  - `:695` — `explicit product request inside routine switches to product category`
- In the retained declarations `:291`, `:329`, and `:362`, remove only the
  `applyConversationStateToClassification` setup/assertions. Keep each
  `shouldApplyPendingRoutineAnswerOverride` assertion: it is a real
  shadow-runner predicate contract.
- Keeper/transfer: retain the predicate tests embedded in `:264`, `:291`, `:329`,
  `:362`, `:426`; they protect the shadow-runner gate itself. The six wrapper tests
  only assert the disconnected V1 classifier mutation.
- Loss risk: none on the production AgentV2 state path. Do not remove the predicate.

### `computeConversationStateTransition`

- Source unlocked: `src/lib/chat-runtime/conversation-state.ts:207-352`.
- Runtime status: no caller. The current legacy tool-loop implementation uses
  `resolveAgenticConversationStateTransition` (`run-agentic-tool-turn.ts:47-50`),
  while production AgentV2 computes/persists `AgentV2ConversationStateV2` in
  `agent-v2/production/session-state.ts:158-212`.
- Delete 9 whole AST tests and remove the dead-transition setup/assertions from
  one mixed test (11 identifier references, including the import):
  - `tests/conversation-state.spec.ts:181` — `routine request opens routine basics state`
  - `:205` — `complete first routine answer stays on routine basics and offers next layers`
  - `:471` — `standalone support-category recommendation switches conversation topic`
  - `:509` — `goal follow-up after routine basics advances to goal layer`
  - `:546` — `problem follow-up after routine basics advances to problem layer`
  - `:583` — `combined goal and problem follow-up after routine basics offers deep dive next`
  - `:620` — `explicit category mention inside routine becomes routine deep dive`
  - `:657` — `vague category mention after routine basics becomes routine deep dive`
  - `:695` — `explicit product request inside routine switches to product category`
- Keeper/transfer: retain current state normalization/store tests (`:132-179`, `:740`)
  and the distinct `resolveAgenticConversationStateTransition` tests (`:767`, `:809`,
  `:841`) until the old compare/shadow tool loop is separately retired.
  In the retained declaration `:426`, remove only the
  `computeConversationStateTransition` result/assertions and retain the live
  `shouldApplyPendingRoutineAnswerOverride` assertion using an equivalent
  explicit state fixture. The predicate remains called by the shadow runner.
- Loss risk: only the disconnected V1 classifier/router state reducer. The historic
  tool-loop plans are references, not deployed/operator contracts.

## Delete-ready legacy Tool Loop trace projection

### `projectAgenticToolLoopTraceForApp`

- Source unlocked: `src/lib/chat-runtime/debug-trace.ts:344-379` plus only the
  imports/helpers made dead by TypeScript after its removal.
- Runtime status: no caller. Current `/api/chat` receives the AgentV2 trace directly
  from `agent-v2/production/chat-pipeline.ts:1623-1668`, through the live generic
  `buildPipelineTraceDraft` / `finalizeChatTurnTrace` path. The obsolete function
  projects an old `agentic_tool_loop` runtime model.
- Delete 1 AST test (2 identifier references including import):
  `tests/chat-debug-trace.spec.ts:723` — `projects runtime tool-loop traces into sanitized app trace summaries`.
- Keeper/transfer: retain the surrounding trace serialization tests; they cover the
  actual trace type used by `/api/chat`.
- Loss risk: no current UI/operator trace. Historical plan docs that name the helper
  describe the retired tool-loop rollout and are not a live contract.

## Delete-ready AgentV2 compatibility adapters

### `summarizeAgentV2ConversationState`

- Source unlocked: `src/lib/agent-v2/production/persisted-session-state.ts:109-146`.
- Runtime status: no caller, route, debug projection, registry, or public package
  export. The production state reader/writer instead uses
  `normalizeAgentV2ConversationState` and `buildNextAgentV2SessionState`.
- Do not delete the mixed AST test at
  `tests/agent-v2-production-chat-pipeline.spec.ts:777` — remove only its summary
  construction/assertions at `:801-803`. The remaining assertions at `:797-800`
  protect live normalization's three-context cap and primary-context derivation.
- Loss risk: an unconsumed compact diagnostic shape only; no persistence compatibility
  is lost because normalize/default/build functions remain intact.

### `buildActiveResolvedProductContextFromLookup`

- Source unlocked: `src/lib/agent-v2/resolved-product-selection-adapter.ts:172-197`.
- Runtime status: no caller. The active runtime uses its richer replacement,
  `buildActiveProductContextFromLookup` (`:199-233`), from
  `agent-v2/production/product-lookup-turn-outcome.ts:256-281`, then derives the
  current resolved context through `mergeActiveProductContexts` and
  `buildPrimaryResolvedProductContext`.
- Delete 1 AST test (3 identifier references including import):
  `tests/agent-v2-resolved-product-selection-adapter.spec.ts:161` —
  `builds active context from found-exact lookup result without trusting unknown results`.
- Keeper/transfer: retain tests of primary-context selection (`:138`, `:259`) and
  merge/replacement (`:296`, `:334`), plus production-pipeline follow-up tests.
- Loss risk: none; the deleted adapter drops the active context's state/status,
  provenance, and timestamp and is not the runtime representation.

### `buildNextActiveResolvedProductContext`

- Source unlocked: `src/lib/agent-v2/resolved-product-selection-adapter.ts:356-367`.
- Runtime status: no caller. Its old scalar precedence model has been superseded by
  the active context stack merge at `:305-331`; that stack is used by the production
  lookup outcome and session-state persistence paths.
- Delete 1 AST test (5 identifier references including import):
  `tests/agent-v2-resolved-product-selection-adapter.spec.ts:196` —
  `chooses the next active resolved product context by explicit precedence`.
- Keeper/transfer: retain `mergeActiveProductContexts` replacement tests (`:296`,
  `:334`) and end-to-end pipeline tests for approved/routine product follow-ups.
- Loss risk: no current multi-product continuity behavior; keeping this test would
  preserve a scalar model the runtime no longer uses.

## Net declaration reconciliation

Across the two overlapping wrappers, delete **11 distinct whole AST test
declarations**: `:181`, `:205`, `:230`, `:394`, `:471`, `:509`, `:546`, `:583`,
`:620`, `:657`, and `:695`. Declaration `:695` belongs to both identifier lists
but is counted once. Modify, rather than delete, **four** declarations: `:291`,
`:329`, `:362`, and `:426`, preserving their live
`shouldApplyPendingRoutineAnswerOverride` assertions. `:264` is already
predicate-only and remains unchanged.

## Validation after the implementation batch

Do not run during the frozen full proof. After edits, run:

```sh
node scripts/run-vitest.mjs tests/conversation-state.spec.ts tests/chat-debug-trace.spec.ts tests/agent-v2-production-chat-pipeline.spec.ts tests/agent-v2-resolved-product-selection-adapter.spec.ts
node scripts/check-changed.mjs --dry-run -- src/lib/chat-runtime/conversation-state.ts src/lib/chat-runtime/debug-trace.ts src/lib/agent-v2/production/persisted-session-state.ts src/lib/agent-v2/resolved-product-selection-adapter.ts tests/conversation-state.spec.ts tests/chat-debug-trace.spec.ts tests/agent-v2-production-chat-pipeline.spec.ts tests/agent-v2-resolved-product-selection-adapter.spec.ts
git diff --check
```
