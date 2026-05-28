# AgentV2 Routine Tool Entitlement Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `build_or_fix_routine` a protected routine-artifact tool that only runs when the latest user turn authorizes routine creation/change or confirms a structured pending routine action.

**Architecture:** Keep `request_interpretation` as the model's terminal semantic contract. Add a tiny runtime permission gate for `build_or_fix_routine`: allow by positive authorization, deny by default, and keep active routine context as context only. The gate is deterministic, model-visible as a short instruction, and enforced before tool execution.

**Tech Stack:** TypeScript, Node test runner, AgentV2 Responses runtime, Zod contracts.

---

### Task 1: Add Routine Tool Permission Tests

**Files:**
- Modify: `/Users/nick/AI_work/hair_conscierge/.worktrees/gpt-54-responses-migration-plan/tests/agent-v2-responses-runtime.spec.ts`

- [x] **Step 1: Write a failing test for non-mutating category comparison**

Add a test where an active routine thread exists, the latest user asks `Was ist als Zusatz sinnvoller, Maske oder Oel?`, and the model incorrectly calls `build_or_fix_routine`. Expected: the routine tool is not executed, the call is blocked with `routine_action_not_authorized`, and the final answer can continue as `general_advice` with `routine_intent: none`.

- [x] **Step 2: Write a failing test for pending action confirmation**

Add a test where `routineThreadContext.pending_routine_action` exists and the user says `Ja, nimm das rein.` Expected: `build_or_fix_routine` is allowed and executed.

- [x] **Step 3: Run the targeted tests and verify RED**

Run:

```bash
npx tsx --test tests/agent-v2-responses-runtime.spec.ts --test-name-pattern "routine tool permission|pending routine action"
```

Expected: at least one new test fails because the current blocker allows non-mutating active-routine comparisons through.

### Task 2: Add Tiny Structured Pending Routine Action State

**Files:**
- Modify: `/Users/nick/AI_work/hair_conscierge/.worktrees/gpt-54-responses-migration-plan/src/lib/agent-v2/contracts.ts`
- Modify: `/Users/nick/AI_work/hair_conscierge/.worktrees/gpt-54-responses-migration-plan/src/lib/agent-v2/tools/tool-definitions.ts`
- Modify: `/Users/nick/AI_work/hair_conscierge/.worktrees/gpt-54-responses-migration-plan/src/lib/agent-v2/compare/run-agent-v2.ts`

- [x] **Step 1: Add `AgentV2PendingRoutineActionSchema`**

Create a small schema with:
- `action`: `create`, `modify`, `add_step`, `remove_step`, `replace_product`, or `simplify`
- `routine_layer`: routine layer or `null`
- `category`: care category or `null`
- `source`: `assistant_offer`

- [x] **Step 2: Add optional `pending_routine_action` fields**

Add `pending_routine_action` to terminal answers as a required nullable field and to `AgentV2RoutineThreadContext` as an optional nullable field. This keeps the action out of user-facing payloads while allowing structured continuity between turns.

- [x] **Step 3: Carry the pending action into routine thread context**

Update `updateAgentV2RoutineThreadContext` to copy `answer.pending_routine_action ?? null` into the next `routineThreadContext`, clearing it when the current answer does not set one.

### Task 3: Replace Denylist-First Routine Blocking With Positive Permission

**Files:**
- Modify: `/Users/nick/AI_work/hair_conscierge/.worktrees/gpt-54-responses-migration-plan/src/lib/agent-v2/runtime/responses-agent.ts`

- [x] **Step 1: Add `resolveRoutineToolPermission`**

Return:
- `{ allowed: true, reason: "explicit_routine_action" }` when the latest message explicitly asks to create/change routine state.
- `{ allowed: true, reason: "pending_action_confirmation" }` when the latest message is a short confirmation and active routine context has `pending_routine_action`.
- `{ allowed: false, reason: "routine_summary_rebuild_not_requested" }` for summaries.
- `{ allowed: false, reason: "routine_rebuild_not_requested" }` for product-only follow-ups.
- `{ allowed: false, reason: "routine_action_not_authorized" }` for all other `build_or_fix_routine` attempts.

- [x] **Step 2: Use positive permission in the tool execution loop**

Call `resolveRoutineToolPermission` before executing `build_or_fix_routine`. If denied, record the blocked tool call and return a tool-output error that tells the model to answer with active routine context as non-mutating advice or ask whether the user wants a routine change.

- [x] **Step 3: Add a model-visible permission note**

Add one system instruction per turn: routine context is not routine-tool permission; the routine tool is allowed only for explicit creation/change or structured pending-action confirmation.

### Task 4: Verify and Remove Reliance on the Case-Specific Safety Net

**Files:**
- Modify only if needed: `/Users/nick/AI_work/hair_conscierge/.worktrees/gpt-54-responses-migration-plan/src/lib/agent-v2/runtime/responses-agent.ts`

- [x] **Step 1: Keep existing mask/oil fallback as last-resort safety**

Do not delete it in this change. It should become less reachable because unauthorized routine calls are blocked earlier.

- [x] **Step 2: Run focused deterministic tests**

Run:

```bash
npx tsx --test tests/agent-v2-responses-runtime.spec.ts --test-name-pattern "routine tool permission|pending routine action|routine rebuild|lightweight mask oil"
```

Expected: targeted tests pass.

- [x] **Step 3: Run the hard-fail regression case**

Run:

```bash
npx tsx scripts/agent-v2/run-guidance-regression.ts --allow-failures --case routine-then-mask-oil-choice
```

Expected: no hard fail; the result may still be `review` because model-backed quality criteria require human review.

Result: `0 pass, 1 review, 0 fail` in `tmp/agent-v2-guidance-regression-2026-05-27T10-57-08-256Z.md`.

- [x] **Step 4: Run the deterministic AgentV2 suite**

Run:

```bash
npx tsx --test tests/agent-v2-contracts.spec.ts tests/agent-v2-final-answer-validator.spec.ts tests/agent-v2-responses-runtime.spec.ts tests/agent-v2-compare-runner.spec.ts tests/agent-v2-manual-regression.spec.ts tests/agent-v2-guidance-compiler.spec.ts
```

Expected: all pass.

Result: deterministic AgentV2 contract, validator, runtime, compare-runner, manual-regression, and guidance-compiler checks passed locally.
