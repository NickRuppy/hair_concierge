# AgentV2 CareBalance Production Switch And Review Fix Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. This plan was created from the 2026-05-28 full worktree review findings.

**Goal:** Make AgentV2 GPT-5.4-mini + CareBalance the production recommendation/chat path, archive the old production tool-loop path from active runtime, and fix the branch-local review findings that block merge readiness.

**Architecture:** Production chat should use one recommendation engine: AgentV2 Responses + GPT-5.4-mini + CareBalance. CareBalance is the authoritative current-turn category decision context, but not product truth and not persistent routine storage. Product claims still require product/catalog tools; saved routine changes still require routine tooling and user permission. Keep validators minimal and contract-focused. Do not add product-level routine storage, a feature flag, or a long-lived AgentV2-without-CareBalance runtime.

**Tech Stack:** Next.js 16, TypeScript, AgentV2 Responses runtime, Node test runner, Compare Lab, AgentV2 guidance fixtures.

---

## Implementation Status

Status as of this pass:

- Tasks 1-4 are implemented: `/api/chat` imports the new AgentV2+CareBalance production pipeline, CareBalance now exposes scoped authority, and Compare Lab defaults to the production AgentV2+CareBalance path while preserving explicit legacy/debug comparisons.
- Tasks 5-8 are implemented from the earlier review pass: routine short-confirmation authorization is guarded by pending actions, repair state no longer treats blocked routine calls as completed, and Compare Lab saves/coerces AgentV2+CareBalance judgment metrics safely.
- Tasks 9-10 are implemented: balanced-comparison evals/guidance metadata are aligned and Compare Lab copy names the production path clearly.
- Task 11 remains optional/deferred: the Compare Lab route still has top-level lab-runner imports, so the Turbopack NFT tracing warning is understood but not treated as a merge blocker in this pass.
- Task 12 is implemented: the old production tool-loop is disconnected from `/api/chat` and marked legacy in code comments; no feature flag was added.
- Verification run after implementation: `npm run typecheck`, `npm run lint`, `npm run test:node`, `npm run test:agent`, `npm run build`, and `git diff --check`. Lint/build finish with warnings only; details are in the session notes.

---

## Settled Decisions

- AgentV2 GPT-5.4-mini + CareBalance is the new production/main recommendation path.
- No feature flag for switching between old and new chat engines.
- The old production tool-loop should be disconnected from `/api/chat` and treated as legacy/archive/debug code only. It can be deleted in a later cleanup once the new path is stable.
- CareBalance owns category-level recommendation decisions and soft product-ranking hints for the current turn.
- CareBalance does not own product truth, exact product claims, inventory, lifecycle, or saved routine storage.
- Compare Lab should focus on the new production path and targeted legacy/debug comparisons only when explicitly useful. Do not keep AgentV2-without-CareBalance as a main reviewer mode.
- Production chat should preserve the existing streaming/persistence shell where possible, but the pipeline behind it should be AgentV2+CareBalance.

## Source Review

Review plan:

- `plans/2026-05-28-agent-v2-worktree-code-review.md`

Confirmed branch-local findings to fix:

- Routine confirmation bypass for natural short confirmations such as `ja bitte`.
- Blocked required repair tool counted as completed.
- Compare Lab saved metrics drop `agent_v2_care_balance` details.
- AgentV2-only judgment can save impossible stale `winner: "current"`.
- Balanced comparison fixture expects `care_category: "conditioner"` despite guidance saying `none`.
- Next-add-on rationale guidance is not protected by a durable regression criterion.
- `base.general_advice.v1` metadata scope disagrees with loader/docs.
- Compare Lab header copy is stale for the new default mode.
- Production chat still imports `src/lib/agent/production/chat-pipeline.ts`, which runs the old agentic tool-loop and returns `engine_variant: "tool_loop"`.

## Target File Map

Production AgentV2 switch:

- Modify: `src/app/api/chat/route.ts`
- Add: `src/lib/agent-v2/production/chat-pipeline.ts`
- Possibly add: `src/lib/agent-v2/production/legacy-adapter.ts` or equivalent compatibility helpers if needed.
- Modify or archive from active imports: `src/lib/agent/production/chat-pipeline.ts`
- Test: `tests/agent-production-chat-pipeline.spec.ts`
- Add or extend: `tests/agent-v2-production-chat-pipeline.spec.ts`

CareBalance authority contract:

- Modify: `src/lib/agent/tools/care-balance-context.ts`
- Modify: `src/lib/agent-v2/runtime/responses-agent.ts`
- Modify tests mentioning `authoritative: false`, `mode: "side_by_side"`, or `side_by_side_non_authoritative`.

Runtime routine permission and repair:

- Modify: `src/lib/agent-v2/runtime/responses-agent.ts`
- Test: `tests/agent-v2-responses-runtime.spec.ts`

Compare Lab judgment integrity:

- Modify: `src/lib/agent/compare/types.ts`
- Modify: `src/app/api/labs/agent-compare/judgments/route.ts`
- Modify: `src/components/labs/agent-compare-lab.tsx`
- Modify: `src/app/labs/agent-compare/page.tsx`
- Modify: `src/app/api/labs/agent-compare/route.ts`
- Modify: `src/lib/agent/compare/run-compare.ts`
- Test: `tests/agent-compare-api.spec.ts`
- Test: add or extend a component/pure-helper test if save-state behavior is not already covered.

Guidance/eval contract:

- Modify: `data/agent-v2/evals/request-interpretation-regression.json`
- Modify: `data/agent-v2/evals/guidance-migration-regression.json`
- Modify: `data/agent-v2/guidance/base/general-advice.json`
- Test: `tests/agent-v2-manual-regression.spec.ts`
- Test: `tests/agent-v2-guidance-compiler.spec.ts`

## Non-Goals

- Do not redesign the whole AgentV2 policy layer.
- Do not add a product-level routine tracker.
- Do not reintroduce heavy deterministic answer-style validation.
- Do not fix Clawpatch backlog findings in unchanged auth/RAG/onboarding/profile/shampoo/worktree files in this pass.
- Do not keep old AgentV2-without-CareBalance as a first-class production or Compare Lab mode.
- Do not delete all legacy planner files in this pass unless removing active imports makes a file trivially dead. Archive/disconnect first; full deletion can follow after production smoke tests.

## Task 1: Build AgentV2+CareBalance Production Pipeline

**Files:**

- Add: `src/lib/agent-v2/production/chat-pipeline.ts`
- Test: add or extend `tests/agent-v2-production-chat-pipeline.spec.ts`

- [ ] Add a focused production-pipeline test that proves the new pipeline calls `runAgentV2ResponsesTurn` with CareBalance context enabled.

Use fakes/mocks rather than real model calls. Expected:

```ts
assert.equal(result.debugTrace?.engine_variant, "agent_v2_care_balance")
assert.equal(result.debugTrace?.care_balance?.authority?.current_turn_category_decision, true)
```

- [ ] Implement a production AgentV2 pipeline that returns the existing `/api/chat` pipeline result shape.

It should preserve the route shell contract:

```ts
{
  stream,
  intent,
  matchedProducts,
  sources,
  retrievalSummary,
  routerDecision,
  conversationStateTransition,
  categoryDecision,
  engineTrace,
  debugTrace,
  visibleFailure,
}
```

The implementation should use the AgentV2 runtime and mandatory CareBalance context:

- load profile, routine, and memory context as the old production pipeline does
- build recommendation-engine runtime from persisted profile/routine facts
- build CareBalance tool context for every turn
- run `runAgentV2ResponsesTurn`
- stream the AgentV2 final answer through the existing SSE helper
- map selected product facts into `matchedProducts`/sources/debug trace without inventing product truth
- preserve routine-thread context updates when the AgentV2 routine tool executes

- [ ] Keep adapter code thin and boring.

If the AgentV2 result does not map perfectly onto the old pipeline fields, prefer compatibility `null`/empty values over resurrecting old planner logic. Do not call the old production tool-loop as a fallback.

- [ ] Mark the old production pipeline as legacy/archive in code comments only where useful.

Do not route production chat through it. Avoid broad deletion until the new production path has completed smoke tests.

## Task 2: Switch `/api/chat` To AgentV2+CareBalance

**Files:**

- Modify: `src/app/api/chat/route.ts`
- Test: `tests/agent-production-chat-pipeline.spec.ts`
- Test: `tests/agent-v2-production-chat-pipeline.spec.ts`

- [ ] Change `loadChatRuntimeDeps()` to import the new AgentV2 production pipeline.

The route should still handle auth, conversation ownership, user message persistence, streaming, and assistant persistence as before.

- [ ] Update the route/pipeline tests that currently assert `engine_variant: "tool_loop"`.

Expected production engine:

```ts
engine_variant: "agent_v2_care_balance"
```

- [ ] Assert no production route import points at `src/lib/agent/production/chat-pipeline.ts`.

Use an import-level test or a simple code-search assertion in the production-pipeline test.

## Task 3: CareBalance Authority Contract

**Files:**

- Modify: `src/lib/agent/tools/care-balance-context.ts`
- Modify: `src/lib/agent-v2/runtime/responses-agent.ts`
- Test: relevant CareBalance/context/runtime tests.

- [ ] Replace the misleading blanket `authoritative: false` semantics with a scoped authority object.

Target shape:

```ts
authority: {
  product_truth: false,
  persistent_routine_storage: false,
  current_turn_category_decision: true,
  soft_product_ranking_hints: true,
}
```

Keep any existing fields needed for compatibility only if tests or UI still read them, but do not present CareBalance as non-authoritative for category decisions.

- [ ] Update AgentV2 prompt/context wording.

The model-facing instruction should say:

- CareBalance is the derived current-turn category decision context.
- It can decide what exists, what is missing, what is overused/underused, and the first category-level lever.
- Product-specific claims still require product metadata.
- Saved routine mutations still require routine tooling and user permission.

- [ ] Remove or update tests that assert `side_by_side_non_authoritative` as the main contract.

The new test should assert scoped authority, not blanket authority.

## Task 4: Compare Lab Production Path Cleanup

**Files:**

- Modify: `src/components/labs/agent-compare-lab.tsx`
- Modify: `src/app/labs/agent-compare/page.tsx`
- Modify: `src/app/api/labs/agent-compare/route.ts`
- Modify: `src/lib/agent/compare/run-compare.ts`
- Test: `tests/agent-compare-api.spec.ts`

- [ ] Remove AgentV2-without-CareBalance as a main Compare Lab mode.

The default/manual testing target should be the new production path:

```ts
agent_v2_care_balance
```

Do not keep a primary `agent_v2_only` / AgentV2-baseline mode. If a legacy/debug route remains for diagnosis, make it clearly secondary and not part of normal reviewer flow.

- [ ] Update labels and copy so the UI says what is actually being tested.

Use language like:

```tsx
AgentV2 GPT-5.4-mini + CareBalance
```

Avoid labels such as `Tool-Loop` or vague `Produkt-Evaluation` when the run is actually the production AgentV2+CareBalance path.

- [ ] Keep real test users in the dropdown.

Do not regress the saved production-like test user contexts.

- [ ] Ensure saved judgments cannot reference systems that were not run.

If only `agent_v2_care_balance` ran, no stale `current`, `agent_v2`, or old `tool_loop` winner should be savable.

## Task 5: Routine Confirmation Authorization

**Files:**

- Modify: `src/lib/agent-v2/runtime/responses-agent.ts`
- Test: `tests/agent-v2-responses-runtime.spec.ts`

- [ ] Add a failing test: `ja bitte` without a pending routine action must not authorize `build_or_fix_routine`.

Use the existing runtime fake client pattern. The model should attempt `build_or_fix_routine` with `evidence_quote: "ja bitte"` and `mutation_kind: "add_step"`. Expected:

```ts
assert.equal(buildRoutineCalled, false)
assert.equal(result.trace.blocked_tool_calls[0]?.name, "build_or_fix_routine")
assert.equal(result.trace.blocked_tool_calls[0]?.reason, "routine_action_not_authorized")
```

- [ ] Add a failing test: `ja bitte` with a pending action must authorize only a matching pending action.

Use `pending_routine_action: { action: "add_step", routine_layer: "basics", category: "leave_in", source: "assistant_offer" }`. First assert a matching `requested_category: "leave_in"` executes. Then add a mismatched case such as `requested_category: "mask"` and assert it is blocked.

- [ ] Implement minimal confirmation detection.

Update `hasShortRoutineActionConfirmation` to recognize natural short confirmations while keeping it narrow. Suggested accepted phrases:

```ts
/^(?:ja|ja bitte|bitte|gerne|genau|ok|okay|passt|klingt gut|mach das|mach es|nimm das rein|nehm das rein|baue das ein|bau das ein)$/
```

Do not use broad regexes that treat full semantic requests as confirmations.

- [ ] Preserve the current explicit-request lane.

`isStructuredRoutineActionAuthorized` should continue to allow explicit latest-turn mutation requests such as `Füg ein Leave-in hinzu`, because those do not depend on `pending_routine_action`.

- [ ] Run focused tests.

```bash
npx tsx --test tests/agent-v2-responses-runtime.spec.ts
```

Expected: pass.

## Task 6: Repair State Must Advance Only After Successful Tool Execution

**Files:**

- Modify: `src/lib/agent-v2/runtime/responses-agent.ts`
- Test: `tests/agent-v2-responses-runtime.spec.ts`

- [ ] Add a failing test where a terminal answer triggers `routine_tool_required`, the repair model calls `build_or_fix_routine`, authorization blocks it, and the next model step tries `submit_final_answer`.

Expected:

```ts
assert.equal(result.trace.failure_stage, "repair_failed")
assert.equal(result.trace.blocked_tool_calls.some((call) => call.name === "submit_final_answer"), true)
assert.equal(result.trace.tool_calls.some((call) => call.name === "build_or_fix_routine"), false)
```

- [ ] Remove repair advancement from the blocked routine-tool branch.

In `responses-agent.ts`, remove this behavior from the `routineRebuildBlock.blocked` branch:

```ts
if (repairState && call.name === repairState.requiredTools[repairState.nextToolIndex]) {
  repairState.nextToolIndex += 1
}
```

Keep advancement only after successful executable tool execution and projection capture.

- [ ] Re-check the existing pure-summary repair test.

If the test currently depends on blocked routine repair being treated as complete, update the expected behavior to represent the correct state: the blocked tool remains blocked, and the model must produce a valid non-mutating terminal answer only if the repair no longer requires that tool.

- [ ] Run focused tests.

```bash
npx tsx --test tests/agent-v2-responses-runtime.spec.ts
```

Expected: pass.

## Task 7: Compare Lab Saved Metrics Preserve CareBalance Variant

**Files:**

- Modify: `src/lib/agent/compare/types.ts`
- Modify: `src/app/api/labs/agent-compare/judgments/route.ts`
- Modify: `src/components/labs/agent-compare-lab.tsx`
- Test: `tests/agent-compare-api.spec.ts`

- [ ] Extend the rollout metrics type and schema so `latency_ms.agent_v2_care_balance` survives save/parse.

The schema should allow all `CanonicalCompareSystem` keys:

If legacy/debug systems still exist in persisted data, the parser may accept them. The active UI should preserve at least `agent_v2_care_balance` latency and tool/model counts.

- [ ] Preserve AgentV2+CareBalance model/tool counts, while keeping legacy fields parseable if older saved judgments contain them.

Prefer explicit optional fields rather than overloading:

```ts
agent_v2_care_balance_model_steps?: number | null
agent_v2_care_balance_tool_calls?: number | null
```

- [ ] Update `handleSaveJudgment` to fill the metric fields by canonical system.

For a result with `system === "agent_v2_care_balance"`, write the CareBalance-specific count fields. Do not require a baseline `agent_v2` result in the active reviewer flow.

- [ ] Add a judgment route test with `agent_v2_care_balance` latency and counts.

Expected saved payload includes:

```ts
latency_ms: {
  agent_v2_care_balance: 95,
},
agent_v2_care_balance_model_steps: 2,
agent_v2_care_balance_tool_calls: 2,
```

- [ ] Run focused tests.

```bash
npx tsx --test tests/agent-compare-api.spec.ts
```

Expected: pass.

## Task 8: Compare Lab Winner State Cannot Save Impossible Values

**Files:**

- Modify: `src/components/labs/agent-compare-lab.tsx`
- Test: existing pure helper tests if available, otherwise add a focused exported helper test.

- [ ] Add or extract a helper that normalizes judgment winner against available results.

Suggested helper:

```ts
export function normalizeWinnerForResults(
  winner: AgentCompareJudgmentDraft["winner"],
  currentResult: CompareRunResult | null,
): AgentCompareJudgmentDraft["winner"] {
  if (winner === "current" && !currentResult) return "tie"
  return winner
}
```

- [ ] Use the normalized winner in `canSaveAgentCompareJudgment` or `handleSaveJudgment`.

Do not save `winner: "current"` when `currentResult` is absent.

- [ ] Reset or coerce winner when result shape changes.

When a new production-only AgentV2+CareBalance result is loaded, ensure the UI no longer holds an impossible selected winner.

- [ ] Add a regression test.

Expected: production-only save either coerces stale impossible winners to `tie` or blocks save. Prefer coercion to `tie` because it preserves a neutral reviewer state without inventing a winner.

## Task 9: Guidance And Eval Contract Cleanup

**Files:**

- Modify: `data/agent-v2/evals/request-interpretation-regression.json`
- Modify: `data/agent-v2/evals/guidance-migration-regression.json`
- Modify: `data/agent-v2/guidance/base/general-advice.json`
- Test: `tests/agent-v2-manual-regression.spec.ts`
- Test: `tests/agent-v2-guidance-compiler.spec.ts`

- [ ] Change the balanced comparison fixture.

For `request-interpretation-mask-or-conditioner`, change:

```json
"care_category": "conditioner"
```

to:

```json
"care_category": "none"
```

- [ ] Add an assertion in `tests/agent-v2-manual-regression.spec.ts`.

For `Brauche ich eher eine Maske oder Conditioner?`, assert:

```ts
assertExpected(findPrompt("Brauche ich eher eine Maske oder Conditioner?"), {
  primary_intent: "category_education",
  product_request_kind: "category_education",
  care_category: "none",
  routine_intent: "none",
  required_tool: "none",
  must_not_surface_products: true,
})
```

- [ ] Protect the next-add-on rationale behavior.

In `guidance-migration-regression.json`, add a quality criterion to the two-turn first-add-on case:

```json
"explains why this category/product is the next add-on using a visible profile, routine, CareBalance, or routine-thread fact"
```

- [ ] Align `base.general_advice.v1` metadata scope with the loader.

Change `answer_modes` from:

```json
["general_advice", "clarification"]
```

to:

```json
["general_advice", "clarification", "product_recommendation", "routine"]
```

- [ ] Run focused tests.

```bash
npx tsx --test tests/agent-v2-manual-regression.spec.ts tests/agent-v2-guidance-compiler.spec.ts
```

Expected: pass.

## Task 10: Compare Lab Header Copy

**Files:**

- Modify: `src/app/labs/agent-compare/page.tsx`

- [ ] Replace stale copy that says the lab compares current local chat to the new agent.

Use mode-neutral copy:

```tsx
Testet die neue Produktionslogik AgentV2 GPT-5.4-mini + CareBalance fuer einen echten gespeicherten Testnutzer.
Geladen werden Profil, Routine und relevante Memory; der Prompt ist die eigentliche Frage.
```

- [ ] Run a focused typecheck or relevant compare tests.

```bash
npx tsx --test tests/agent-compare-api.spec.ts
```

Expected: pass.

## Task 11: Optional Before Deploy - Lazy-Load Compare Lab Route Runners

**Files:**

- Modify: `src/app/api/labs/agent-compare/route.ts`
- Possibly modify: `src/app/labs/agent-compare/page.tsx`
- Test: `tests/agent-compare-api.spec.ts`
- Verify: `npm run build`

- [ ] Defer heavy runner imports until after the development guard.

Keep route handler imports light. Import lab runners dynamically inside the default dependency construction after `process.env.NODE_ENV === "development"` is confirmed.

- [ ] Keep test injection simple.

Do not make tests depend on dynamic imports. Keep `handleAgentCompareRequest(body, deps)` accepting explicit deps.

- [ ] Run:

```bash
npx tsx --test tests/agent-compare-api.spec.ts
npm run build
```

Expected: tests pass; build warning should be reduced or unchanged but understood. This is not a merge blocker if the earlier tasks are fixed.

## Task 12: Legacy Cleanup Notes

**Files:**

- Modify docs or code comments only if useful.
- Do not touch unrelated old files.

- [ ] Confirm the old production tool-loop is no longer imported by `/api/chat`.

Code search should show no active production route import from:

```txt
src/lib/agent/production/chat-pipeline.ts
```

- [ ] Keep a short archive note for the old pipeline.

Use comments or a small doc note only if the file remains in place. The note should say it is legacy and no longer the production chat engine.

- [ ] Do not add a feature flag.

The project decision is a full switch, not a staged rollout.

## Verification Gate

After tasks are implemented, run:

```bash
npx tsx --test tests/agent-v2-production-chat-pipeline.spec.ts
npx tsx --test tests/agent-production-chat-pipeline.spec.ts
npx tsx --test tests/agent-v2-responses-runtime.spec.ts
npx tsx --test tests/agent-compare-api.spec.ts
npx tsx --test tests/agent-v2-manual-regression.spec.ts tests/agent-v2-guidance-compiler.spec.ts
npm run typecheck
npm run lint
npm run test:node
npm run test:agent
npm run build
```

Then run the two manual Compare Lab smoke checks from `plans/2026-05-28-agent-v2-worktree-code-review.md`.

## Execution Handoff

Recommended next skill: `superpowers:subagent-driven-development`.

Suggested worker split:

- Worker A: Tasks 1-3, production pipeline switch and CareBalance authority contract.
- Worker B: Tasks 4, 7, 8, 10, Compare Lab cleanup and saved metrics.
- Worker C: Tasks 5-6, routine authorization and repair-state hardening.
- Worker D: Task 9 plus final verification support.
