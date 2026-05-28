# AgentV2 Structured Routine Tool Authorization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace brittle text-first routine-tool permission with deterministic per-call authorization based on the model's structured `build_or_fix_routine` arguments and grounded latest-turn evidence.

**Architecture:** The model may propose `build_or_fix_routine`; deterministic code authorizes or blocks that specific call. Raw-text checks remain only as hard deny guards, summary/product-follow-up guards, and short-confirmation support. The validator remains the final reconciliation layer that checks the terminal answer truthfully reflects loaded tools and routine state.

**Tech Stack:** TypeScript, Zod schemas, Node test runner via `npx tsx --test`, AgentV2 Responses runtime.

---

## Alignment Decisions

- Direct user authorization does not require another permission question.
  - `Füg bitte eine Maske in meine Routine ein.`
  - `Nimm das Trockenshampoo aus meiner Routine raus.`
  - `Baue mir eine neue Routine für feines, trockenes Haar.`
- Assistant-proposed routine changes require a stored `pending_routine_action` plus a short user confirmation before the tool can run.
- Explicit non-mutation wording overrides the model's tool call.
  - `nur verstehen`
  - `nicht ändern`
  - `nicht umstellen`
  - `nur erklären`
- Raw German morphology should not be the primary source of authorization.
- Keep deny checks conservative and small; do not build a large positive regex classifier.

## Files

- Modify: `src/lib/agent-v2/runtime/responses-agent.ts`
  - Replace precomputed message-only `RoutineToolPermission` with per-call authorization.
  - Add structured call authorization helpers.
  - Remove or narrow old positive phrase matchers that are replaced by structured authorization.
- Modify: `tests/agent-v2-responses-runtime.spec.ts`
  - Add failing tests for the three compare-lab failures.
  - Add guard tests that non-mutating explanation/comparison still blocks model overreach.
  - Add confirmation tests for `pending_routine_action`.
- Optional modify only if trace type needs a new reason string: `src/lib/agent-v2/contracts.ts`
  - Avoid schema churn unless blocked reason enums are typed there.

## Task 1: Add Failing Tests For Compare-Lab Failures

- [ ] **Step 1: Add explicit routine authorization tests**

Add tests to `tests/agent-v2-responses-runtime.spec.ts` near the existing routine tool permission tests.

Required scenarios:

```ts
test("AgentV2 runtime allows explicit shortened add-step routine request", async () => {
  const client = fakeResponsesClientWithOutputs([
    guidanceCall("call_1", {
      answer_mode_hint: "routine",
      categories: ["mask"],
      routine_layer: "goals",
    }),
    functionCall("call_2", "build_or_fix_routine", {
      objective: "fix_routine",
      requested_layer: "goals",
      requested_category: "mask",
      reason: "User explicitly asks to add a mask to the routine.",
      routine_intent: "modify",
      mutation_kind: "add_step",
      evidence_quote: "Füg bitte eine Maske in meine Routine ein",
    }),
    validRoutineMaskAddTerminal("call_3"),
  ])

  const result = await runAgentV2ResponsesTurn({
    client,
    message: "Füg bitte eine Maske in meine Routine ein.",
    recentMessages: [],
    userContext: {
      hairProfile: null,
      routineInventory: [{ product_id: "routine_shampoo", category: "shampoo", name: "Shampoo" }],
      sessionMemory: [],
    },
    tools: fakeAgentV2ToolsWithRoutineSteps(["step_shampoo", "step_mask"]),
  })

  assert.equal(result.trace.failure_stage, null)
  assert.deepEqual(
    result.trace.tool_calls.map((call) => call.name),
    ["load_advisor_guidance", "build_or_fix_routine"],
  )
  assert.equal(result.trace.blocked_tool_calls.length, 0)
})
```

```ts
test("AgentV2 runtime allows explicit raus remove-step routine request", async () => {
  const client = fakeResponsesClientWithOutputs([
    guidanceCall("call_1", {
      answer_mode_hint: "routine",
      categories: ["dry_shampoo"],
      routine_layer: "basics",
    }),
    functionCall("call_2", "build_or_fix_routine", {
      objective: "fix_routine",
      requested_layer: "basics",
      requested_category: "dry_shampoo",
      reason: "User explicitly asks to remove dry shampoo from the routine.",
      routine_intent: "remove_step",
      mutation_kind: "remove_step",
      evidence_quote: "Nimm das Trockenshampoo aus meiner Routine raus",
    }),
    validRoutineDryShampooRemoveTerminal("call_3"),
  ])

  const result = await runAgentV2ResponsesTurn({
    client,
    message: "Nimm das Trockenshampoo aus meiner Routine raus.",
    recentMessages: [],
    userContext: {
      hairProfile: null,
      routineInventory: [
        { product_id: "routine_shampoo", category: "shampoo", name: "Shampoo" },
        { product_id: "routine_dry_shampoo", category: "dry_shampoo", name: "Trockenshampoo" },
      ],
      sessionMemory: [],
    },
    tools: fakeAgentV2ToolsWithRoutineSteps(["step_shampoo"]),
  })

  assert.equal(result.trace.failure_stage, null)
  assert.deepEqual(
    result.trace.tool_calls.map((call) => call.name),
    ["load_advisor_guidance", "build_or_fix_routine"],
  )
  assert.equal(result.trace.blocked_tool_calls.length, 0)
})
```

```ts
test("AgentV2 runtime allows explicit new routine build request", async () => {
  const client = fakeResponsesClientWithOutputs([
    guidanceCall("call_1", {
      answer_mode_hint: "routine",
      categories: ["shampoo", "conditioner", "leave_in"],
      routine_layer: "basics",
    }),
    functionCall("call_2", "build_or_fix_routine", {
      objective: "build_routine",
      requested_layer: "basics",
      requested_category: "conditioner",
      reason: "User explicitly asks for a new routine for fine, dry hair.",
      routine_intent: "create",
      mutation_kind: "add_step",
      evidence_quote: "Baue mir eine neue Routine für feines, trockenes Haar",
    }),
    validRoutineBuildTerminal("call_3"),
  ])

  const result = await runAgentV2ResponsesTurn({
    client,
    message: "Baue mir eine neue Routine für feines, trockenes Haar",
    recentMessages: [],
    userContext: {
      hairProfile: null,
      routineInventory: [],
      sessionMemory: [],
    },
    tools: fakeAgentV2ToolsWithRoutineSteps(["step_shampoo", "step_conditioner", "step_leave_in"]),
  })

  assert.equal(result.trace.failure_stage, null)
  assert.deepEqual(
    result.trace.tool_calls.map((call) => call.name),
    ["load_advisor_guidance", "build_or_fix_routine"],
  )
  assert.equal(result.trace.blocked_tool_calls.length, 0)
})
```

If helper terminals do not exist yet, create small local helpers in the test file that mirror existing valid routine terminal helpers and include:

```ts
request_interpretation: {
  primary_intent: "routine_mutation",
  product_request_kind: "none",
  routine_intent: "<matching intent>",
  care_category: "<matching category>",
  requested_product_count: null,
  count_policy: "none",
  evidence_quote: "<same latest-turn quote>",
  confidence: 0.95,
}
```

- [ ] **Step 2: Verify tests fail on current implementation**

Run:

```bash
npx tsx --test --test-concurrency=1 --test-name-pattern "shortened add-step|raus remove-step|new routine build" tests/agent-v2-responses-runtime.spec.ts
```

Expected before implementation: the new tests fail because `build_or_fix_routine` is blocked with `routine_action_not_authorized`.

## Task 2: Replace Message-Only Permission With Per-Call Authorization

- [ ] **Step 1: Replace the old permission data shape**

In `src/lib/agent-v2/runtime/responses-agent.ts`, replace:

```ts
const routineToolPermission = resolveRoutineToolPermission({
  message: params.message,
  routineThreadContext,
})
```

with:

```ts
const routineToolPolicy = resolveRoutineToolPolicy({
  message: params.message,
  routineThreadContext,
})
```

The policy should not decide final allow/deny for all routine calls. It should only carry:

```ts
type RoutineToolPolicy = {
  hardDenyReason: RoutineRebuildBlockReason | null
  pendingConfirmationAllowed: boolean
}
```

- [ ] **Step 2: Replace `shouldBlockUnrequestedRoutineRebuild`**

Replace the old function with:

```ts
function authorizeBuildOrFixRoutineCall(params: {
  name: AgentV2ToolName
  args: Record<string, unknown>
  message: string
  policy: RoutineToolPolicy
  routineThreadContext: AgentV2RoutineThreadContext | null
}): RoutineRebuildBlockResult {
  if (params.name !== "build_or_fix_routine") return { blocked: false, reason: null }
  if (params.policy.hardDenyReason) {
    return { blocked: true, reason: params.policy.hardDenyReason }
  }
  if (params.policy.pendingConfirmationAllowed) {
    return { blocked: false, reason: null }
  }
  if (isStructuredRoutineActionAuthorized(params.args, params.message)) {
    return { blocked: false, reason: null }
  }
  return { blocked: true, reason: "routine_action_not_authorized" }
}
```

- [ ] **Step 3: Authorize using parsed tool arguments**

After `validatedArguments.ok`, call:

```ts
const routineRebuildBlock = authorizeBuildOrFixRoutineCall({
  name: call.name,
  args: validatedArguments.value,
  message: params.message,
  policy: routineToolPolicy,
  routineThreadContext,
})
```

Do not authorize from raw text alone here.

- [ ] **Step 4: Implement structured authorization helper**

Add:

```ts
const ROUTINE_ACTION_INTENTS = new Set(["create", "modify", "remove_step", "replace_product"])
const ROUTINE_ACTION_MUTATION_KINDS = new Set([
  "add_step",
  "remove_step",
  "replace_product",
  "change_frequency",
  "simplify",
])

function isStructuredRoutineActionAuthorized(
  args: Record<string, unknown>,
  message: string,
): boolean {
  const routineIntent = typeof args.routine_intent === "string" ? args.routine_intent : "none"
  const mutationKind = typeof args.mutation_kind === "string" ? args.mutation_kind : "none"
  const objective = typeof args.objective === "string" ? args.objective : null
  const evidenceQuote = typeof args.evidence_quote === "string" ? args.evidence_quote : ""

  const hasActionIntent =
    ROUTINE_ACTION_INTENTS.has(routineIntent) ||
    ROUTINE_ACTION_MUTATION_KINDS.has(mutationKind) ||
    objective === "build_routine" ||
    objective === "fix_routine"

  return hasActionIntent && isEvidenceQuoteGroundedInLatestMessage(evidenceQuote, message)
}
```

- [ ] **Step 5: Implement evidence grounding**

Add:

```ts
function normalizeEvidenceText(value: string): string {
  return value
    .toLocaleLowerCase("de-DE")
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function isEvidenceQuoteGroundedInLatestMessage(evidenceQuote: string, message: string): boolean {
  const normalizedQuote = normalizeEvidenceText(evidenceQuote)
  const normalizedMessage = normalizeEvidenceText(message)
  return normalizedQuote.length >= 4 && normalizedMessage.includes(normalizedQuote)
}
```

Keep this strict. If the model cannot quote the latest user turn, the tool should not be authorized.

## Task 3: Rip Out Old Positive Regex Authorization

- [ ] **Step 1: Remove old positive allow helpers**

Remove these helpers if no longer used:

```ts
hasExplicitRoutineActionSignal
hasFirstTurnRoutineBuildSignal
```

The new structured path replaces them.

- [ ] **Step 2: Keep small deny/follow-up helpers**

Keep or rename these as policy helpers:

```ts
hasShortRoutineActionConfirmation
hasRoutineSummaryFollowupSignal
hasProductFollowupSignal
```

Add a narrow explicit non-mutation denial helper:

```ts
function hasExplicitRoutineNonMutationSignal(message: string): boolean {
  const normalized = message.toLocaleLowerCase("de-DE")
  return (
    /\b(nur|erstmal|erst\s*mal)\b.{0,60}\b(verstehen|wissen|erklaer|erklär|einordnen)\b/.test(normalized) ||
    /\b(nicht|nichts|keine|kein)\b.{0,40}\b(aendern|ändern|umstellen|umbauen|anpassen)\b/.test(normalized) ||
    /\bohne\b.{0,40}\b(aendern|ändern|umstellen|umbauen|anpassen)\b/.test(normalized)
  )
}
```

- [ ] **Step 3: Implement policy resolution**

Use:

```ts
function resolveRoutineToolPolicy(params: {
  message: string
  routineThreadContext: AgentV2RoutineThreadContext | null
}): RoutineToolPolicy {
  if (hasExplicitRoutineNonMutationSignal(params.message)) {
    return { hardDenyReason: "routine_action_not_authorized", pendingConfirmationAllowed: false }
  }
  if (hasRoutineSummaryFollowupSignal(params.message)) {
    return {
      hardDenyReason: "routine_summary_rebuild_not_requested",
      pendingConfirmationAllowed: false,
    }
  }
  return {
    hardDenyReason: null,
    pendingConfirmationAllowed:
      hasShortRoutineActionConfirmation(params.message) &&
      Boolean(params.routineThreadContext?.pending_routine_action),
  }
}
```

Do not put broad positive routine-action recognition in this function.

- [ ] **Step 4: Update model guidance wording**

Replace the permission guidance with wording that matches the new architecture:

```ts
function buildRoutineToolPermissionGuidance(policy: RoutineToolPolicy): string {
  if (policy.hardDenyReason) {
    return `Routine tool policy for this turn: denied (${policy.hardDenyReason}). Do not call build_or_fix_routine; answer without changing routine state.`
  }
  if (policy.pendingConfirmationAllowed) {
    return "Routine tool policy for this turn: a short user confirmation can authorize build_or_fix_routine if the call matches the pending_routine_action and terminal request_interpretation."
  }
  return "Routine tool policy for this turn: build_or_fix_routine is allowed only when the latest user message explicitly asks to build, change, add, remove, replace, simplify, or rebalance routine state, and the tool evidence_quote is a raw phrase from that latest message. For comparison, placement, usage, summary, or product follow-up questions, do not call build_or_fix_routine."
}
```

## Task 4: Preserve The Non-Mutating Protection

- [ ] **Step 1: Add overreach block tests**

Add tests for model overreach where the model incorrectly calls `build_or_fix_routine` but the latest message is not a routine mutation:

```ts
test("AgentV2 runtime blocks routine tool for explicit non-mutation wording", async () => {
  const result = await runAgentV2ResponsesTurn({
    client: fakeResponsesClientWithOutputs([
      guidanceCall("call_1", {
        answer_mode_hint: "general_advice",
        categories: ["mask", "oil"],
        routine_layer: "goals",
      }),
      functionCall("call_2", "build_or_fix_routine", {
        objective: "fix_routine",
        requested_layer: "goals",
        requested_category: "mask",
        reason: "Model overreaches despite user asking only to understand.",
        routine_intent: "modify",
        mutation_kind: "add_step",
        evidence_quote: "Maske oder Öl",
      }),
      validGeneralAdviceTerminal("call_3"),
    ]),
    message: "Maske oder Öl? Ich will nur verstehen, nicht ändern.",
    recentMessages: [],
    userContext: {
      hairProfile: null,
      routineInventory: [{ product_id: "routine_shampoo", category: "shampoo", name: "Shampoo" }],
      sessionMemory: [],
    },
    tools: fakeAgentV2Tools(),
  })

  assert.equal(result.trace.blocked_tool_calls[0]?.name, "build_or_fix_routine")
  assert.equal(result.trace.blocked_tool_calls[0]?.reason, "routine_action_not_authorized")
})
```

Add a comparison-only test:

```ts
test("AgentV2 runtime blocks routine tool for category comparison without mutation request", async () => {
  const result = await runAgentV2ResponsesTurn({
    client: fakeResponsesClientWithOutputs([
      guidanceCall("call_1", {
        answer_mode_hint: "general_advice",
        categories: ["mask", "oil"],
        routine_layer: "goals",
      }),
      functionCall("call_2", "build_or_fix_routine", {
        objective: "fix_routine",
        requested_layer: "goals",
        requested_category: "mask",
        reason: "Model overreaches on category comparison.",
        routine_intent: "modify",
        mutation_kind: "add_step",
        evidence_quote: "Maske oder Öl",
      }),
      validGeneralAdviceTerminal("call_3"),
    ]),
    message: "Maske oder Öl für trockene Spitzen?",
    recentMessages: [],
    userContext: {
      hairProfile: null,
      routineInventory: [{ product_id: "routine_shampoo", category: "shampoo", name: "Shampoo" }],
      sessionMemory: [],
    },
    tools: fakeAgentV2Tools(),
  })

  assert.equal(result.trace.blocked_tool_calls[0]?.name, "build_or_fix_routine")
  assert.equal(result.trace.blocked_tool_calls[0]?.reason, "routine_action_not_authorized")
})
```

If this comparison-only test passes incorrectly after Task 2 because the evidence quote is grounded, tighten `isStructuredRoutineActionAuthorized` so `routine_intent=modify` plus `mutation_kind=add_step` requires the evidence quote or latest message to contain an actual routine-action verb, while `create/remove_step/replace_product` can authorize from intent/objective. Keep this as a targeted semantic check, not a large regex list.

- [ ] **Step 2: Keep pending confirmation behavior**

Ensure existing tests still cover:

- Bare `Ja.` without `pending_routine_action` blocks routine tool.
- `Ja.` with compatible `pending_routine_action` allows routine tool.

Add compatibility assertions if missing:

```ts
assert.equal(result.trace.blocked_tool_calls.length, 0)
assert.equal(result.trace.tool_calls.some((call) => call.name === "build_or_fix_routine"), true)
```

## Task 5: Run Targeted And Full Verification

- [ ] **Step 1: Run focused routine permission tests**

```bash
npx tsx --test --test-concurrency=1 --test-name-pattern "routine tool permission|shortened add-step|raus remove-step|new routine build|non-mutation wording|category comparison" tests/agent-v2-responses-runtime.spec.ts
```

Expected: all focused tests pass.

- [ ] **Step 2: Run full AgentV2 runtime tests**

```bash
npx tsx --test --test-concurrency=1 tests/agent-v2-responses-runtime.spec.ts
```

Expected: pass.

- [ ] **Step 3: Run validator and compare-runner tests**

```bash
npx tsx --test --test-concurrency=1 tests/agent-v2-final-answer-validator.spec.ts tests/agent-v2-compare-runner.spec.ts
```

Expected: pass.

- [ ] **Step 4: Run typecheck**

```bash
npm run typecheck
```

Expected: pass.

- [ ] **Step 5: Re-run the 6 compare-lab prompts manually**

Use [http://localhost:3283/labs/agent-compare](http://localhost:3283/labs/agent-compare).

Must not call `build_or_fix_routine`:

- `Maske oder Öl für trockene Spitzen?`
- `Wo würde ein Leave-in grundsätzlich in der Routine stehen?`
- `Maske oder Öl? Ich will nur verstehen, nicht ändern.`

Must call `build_or_fix_routine`:

- `Füg bitte eine Maske in meine Routine ein.`
- `Nimm das Trockenshampoo aus meiner Routine raus.`
- `Baue mir eine neue Routine für feines, trockenes Haar.`

## Open Alignment Check

Confirm this before implementation if possible:

Should explicit non-mutation wording always override a structured routine tool call?

Recommended answer: yes. If the user says `nur verstehen`, `nicht ändern`, or similar, the model should not run `build_or_fix_routine`, even if it can produce a grounded routine mutation call.
