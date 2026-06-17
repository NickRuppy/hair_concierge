# AgentV2 Pending Follow-Up Actions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Make short confirmations like `Ja`, `Ja bitte`, `gerne`, and `mach das` resolve against a structured pending follow-up action instead of relying on prose or falling into generic fallback.

**Architecture:** Replace the narrow `pending_routine_action` concept with one generalized `pending_followup_action` owned by the AgentV2 terminal answer and persisted conversation state. The model decides which user-confirmable follow-up action it is offering; deterministic runtime code enforces which tools that action may authorize and clears the action once a short confirmation consumes it. If `next_step_offer_de` is non-null, the final answer must provide a matching `pending_followup_action`; if it is null, `pending_followup_action` must also be null.

**Tech Stack:** TypeScript, Zod contracts, AgentV2 Responses runtime, Supabase-backed conversation state, Node test runner via `tsx --test`.

---

## Decisions Already Aligned

- Use one generalized `pending_followup_action`, not separate pending concepts per category or subsystem.
- Treat routine mutation as one follow-up action kind, not a special architectural lane.
- Do not parse prior assistant prose as the main source of truth.
- Short confirmations resolve only against structured pending state.
- `next_step_offer_de !== null` implies a matching structured `pending_followup_action`.
- `next_step_offer_de === null` implies `pending_followup_action === null`.
- Only `pending_followup_action.kind === "routine_mutation"` can authorize `build_or_fix_routine`.
- Runtime clears consumed pending follow-up actions for all user-confirmable kinds after a successful short-confirmation resolution; the final answer may create a new pending action if it offers another next step.
- Pending follow-up actions represent only visible user-confirmable offers, not internal tools such as guidance loading, turn gates, terminal answer submission, or context retrieval.

## Non-Goals

- Do not add styling/mousse product category support.
- Do not implement arbitrary user-product evaluation.
- Do not build a deterministic German prose parser for previous assistant messages.
- Do not change the user-facing chat UI in this task.
- Do not add Supabase migrations unless local inspection proves `conversation_states.state` has a schema-level DB constraint that rejects the new JSON field.

## File Structure

- Modify `src/lib/agent-v2/contracts.ts`
  - Add `AgentV2PendingFollowupActionSchema`.
  - Replace terminal-answer `pending_routine_action` with `pending_followup_action`.
  - Replace routine-thread-context `pending_routine_action` with `pending_followup_action`.
- Add `src/lib/agent-v2/pending-followup-action.ts`
  - Own legacy pending-routine-action conversion so persistence, session state, and Compare Lab do not drift.
- Modify `src/lib/agent-v2/tools/tool-definitions.ts`
  - Expose `pending_followup_action` in `submit_final_answer` strict tool schema.
- Modify `src/lib/agent-v2/runtime/responses-agent.ts`
  - Update prompt contract.
  - Rename all terminal answer builder outputs from `pending_routine_action: null` to `pending_followup_action: null`.
  - Resolve short-confirmation permissions from `pending_followup_action`.
  - Mark successfully resolved short-confirmation actions as consumed so persisted state clears or replaces them.
  - Keep routine mutation guarded by action/category/layer match.
- Modify `src/lib/agent-v2/production/session-state.ts`
  - Persist and normalize `pending_followup_action`.
  - Read legacy `pending_routine_action` only as migration compatibility and convert it into `pending_followup_action`.
- Modify `src/lib/agent-v2/production/persisted-session-state.ts`
  - Pre-convert old persisted routine-thread context before strict Zod parsing so legacy active routine threads are not dropped.
  - Summarize new pending state.
- Modify `src/lib/agent-v2/compare/run-agent-v2.ts`
  - Use the same generalized pending follow-up action in Compare Lab conversation continuity.
  - Read legacy `pending_routine_action` only as compatibility input.
- Modify `src/lib/agent-v2/validation/final-answer-validator.ts`
  - Validate `next_step_offer_de` and `pending_followup_action` consistency.
  - Validate routine-tool permission against `pending_followup_action`.
  - Rename existing side-effect guards that still read `pending_routine_action`.
- Modify tests:
  - `tests/agent-v2-contracts.spec.ts`
  - `tests/agent-v2-final-answer-validator.spec.ts`
  - `tests/agent-v2-responses-runtime.spec.ts`
  - `tests/agent-v2-production-chat-pipeline.spec.ts`
  - `tests/agent-v2-current-care-context.spec.ts`
  - `tests/agent-v2-compare-runner.spec.ts` if compare-runner still reads/writes pending routine action.

---

### Task 1: Add General Pending Follow-Up Contract

**Files:**
- Modify: `src/lib/agent-v2/contracts.ts`
- Test: `tests/agent-v2-contracts.spec.ts`

- [x] **Step 1: Write the failing contract test**

Add a test that proves terminal answers accept `pending_followup_action` and no longer require the old `pending_routine_action` field as the canonical shape.

```ts
test("AgentV2 terminal answer supports generalized pending follow-up action", () => {
  const parsed = AgentV2TerminalAnswerSchema.parse({
    answer_mode: "general_advice",
    interpreted_intent: "User asks whether they want product suggestions next.",
    request_interpretation: {
      primary_intent: "category_education",
      product_request_kind: "category_education",
      routine_intent: "none",
      care_category: "mask",
      requested_product_count: null,
      count_policy: "none",
      evidence_quote: "Maske",
      confidence: 0.9,
    },
    confidence: 0.9,
    extracted_constraints: {
      hair_concerns: [],
      goals: [],
      product_categories: ["mask"],
      budget_eur: null,
      avoid_ingredients: [],
      allergies: [],
      preferences: [],
      routine_layer: null,
      raw_constraints: ["Maske"],
    },
    missing_information: [],
    safety_flags: [],
    tool_grounding: {
      used_guidance_package_ids: [
        "base.advisor_rules.v1",
        "base.answer_contract.v1",
        "base.tone_and_format.v1",
        "base.general_advice.v1",
        "category.mask.v1",
      ],
      used_product_tool: false,
      used_routine_tool: false,
      product_ids: [],
      routine_step_ids: [],
      hard_rule_ids: [],
    },
    routine_context: {
      active: true,
      routine_layer: "basics",
      step_id: null,
      category: "mask",
      return_path: ["routine"],
    },
    pending_followup_action: {
      kind: "product_recommendation",
      category: "mask",
      routine_layer: "basics",
      routine_action: null,
      source: "assistant_offer",
    },
    session_memory_writes: [],
    payload: {
      user_facing_answer_de: "Eine Maske kann als Zusatz sinnvoll sein.",
      category_or_topic: "mask",
      key_points_de: ["Maske ist ein optionaler Zusatz."],
      next_step_offer_de: "Ich kann dir danach konkrete Masken empfehlen.",
    },
  })

  assert.equal(parsed.pending_followup_action?.kind, "product_recommendation")
})
```

- [x] **Step 2: Run the contract test and verify it fails**

Run:

```bash
npx tsx --test tests/agent-v2-contracts.spec.ts
```

Expected: FAIL because `pending_followup_action` is not yet part of `AgentV2TerminalAnswerSchema`.

- [x] **Step 3: Add `AgentV2PendingFollowupActionSchema`**

In `src/lib/agent-v2/contracts.ts`, add:

```ts
export const AgentV2PendingFollowupKindSchema = z.enum([
  "product_recommendation",
  "advisor_response",
  "routine_mutation",
])

export type AgentV2PendingFollowupKind = z.infer<typeof AgentV2PendingFollowupKindSchema>

export const AgentV2PendingFollowupActionSchema = z.strictObject({
  kind: AgentV2PendingFollowupKindSchema,
  category: AgentV2CareCategorySchema.nullable(),
  routine_layer: AgentV2RoutineLayerSchema.nullable(),
  routine_action: z
    .enum(["create", "modify", "add_step", "remove_step", "replace_product", "simplify"])
    .nullable(),
  source: z.literal("assistant_offer"),
})

export type AgentV2PendingFollowupAction = z.infer<
  typeof AgentV2PendingFollowupActionSchema
>
```

Then replace `pending_routine_action` in `AgentV2TerminalAnswerBaseSchema` with:

```ts
pending_followup_action: AgentV2PendingFollowupActionSchema.nullable(),
```

Replace `pending_routine_action` in `AgentV2RoutineThreadContextSchema` with:

```ts
pending_followup_action: AgentV2PendingFollowupActionSchema.nullable().optional(),
```

Use these kinds deliberately:

- `product_recommendation`: a short confirmation should continue with `select_products`.
- `advisor_response`: a short confirmation should continue with a non-mutating answer, possibly after guidance.
- `routine_mutation`: a short confirmation may authorize `build_or_fix_routine` if category/layer/action match.

- [x] **Step 4: Add the shared legacy conversion helper**

Add `src/lib/agent-v2/pending-followup-action.ts`.

The helper should accept `unknown`, read only the legacy object shape defensively, and return `AgentV2PendingFollowupAction | null`:

```ts
import { AgentV2PendingFollowupActionSchema, type AgentV2PendingFollowupAction } from "./contracts"

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export function legacyRoutineActionToFollowup(
  value: unknown,
): AgentV2PendingFollowupAction | null {
  if (!isRecord(value)) return null

  const parsed = AgentV2PendingFollowupActionSchema.safeParse({
    kind: "routine_mutation",
    category: value.category ?? null,
    routine_layer: value.routine_layer ?? null,
    routine_action: value.action ?? null,
    source: "assistant_offer",
  })

  return parsed.success ? parsed.data : null
}
```

Use this helper everywhere legacy `pending_routine_action` is read. Do not duplicate conversion logic in session state, persisted state, or Compare Lab.

- [x] **Step 5: Rename required writer sites before broad compile gates**

Immediately after changing the schema, rename all canonical writers that currently emit the old field.

Checklist:

- `src/lib/agent-v2/runtime/responses-agent.ts`: terminal answer builders that hard-code `pending_routine_action: null`.
- `src/lib/agent-v2/production/session-state.ts`: conversation-state writer for routine thread context.
- `src/lib/agent-v2/compare/run-agent-v2.ts`: Compare Lab routine thread context writer.

Change old null writers from:

```ts
pending_routine_action: null,
```

to:

```ts
pending_followup_action: null,
```

Note: `npx tsx --test` does not typecheck. Intermediate test runs are useful for behavior, but `npm run typecheck` or `npm run ci:verify` is the real gate for catching missed writer/reader references.

- [x] **Step 6: Run the contract test and verify it passes**

Run:

```bash
npx tsx --test tests/agent-v2-contracts.spec.ts
```

Expected: PASS for the new contract test. Existing tests may now fail where fixtures still use `pending_routine_action`; those are handled in later tasks.

---

### Task 2: Update Runtime Tool Schema and Prompt Contract

**Files:**
- Modify: `src/lib/agent-v2/tools/tool-definitions.ts`
- Modify: `src/lib/agent-v2/runtime/responses-agent.ts`
- Test: `tests/agent-v2-responses-runtime.spec.ts`

- [x] **Step 1: Write failing prompt/tool-schema tests**

In `tests/agent-v2-responses-runtime.spec.ts`, update the strict tool schema test so `submit_final_answer` requires `pending_followup_action`, not `pending_routine_action`.

Add a prompt guidance assertion:

```ts
test("AgentV2 runtime instructs actionable next-step offers to set pending follow-up action", async () => {
  const client = fakeResponsesClientWithOutputs([terminalGeneralAdvice("call_1")])

  await runAgentV2ResponsesTurn({
    client,
    message: "Soll ich eine Maske nutzen?",
    recentMessages: [],
    userContext: { hairProfile: null, routineInventory: [], sessionMemory: [] },
    tools: fakeAgentV2Tools(),
  })

  const firstInput = getInputItems(client.requests[0])
  const guidance = firstInput.map(asRecord).map((item) => String(item?.content ?? "")).join("\n")

  assert.match(guidance, /pending_followup_action/)
  assert.match(guidance, /next_step_offer_de/)
  assert.match(guidance, /routine_mutation/)
})
```

- [x] **Step 2: Run runtime tests and verify they fail**

Run:

```bash
npx tsx --test tests/agent-v2-responses-runtime.spec.ts
```

Expected: FAIL because prompt/tool schema still references `pending_routine_action`.

- [x] **Step 3: Update `submit_final_answer` schema**

In `src/lib/agent-v2/tools/tool-definitions.ts`, import `AgentV2PendingFollowupActionSchema` and change the terminal answer tool parameters from:

```ts
pending_routine_action: AgentV2PendingRoutineActionSchema.nullable(),
```

to:

```ts
pending_followup_action: AgentV2PendingFollowupActionSchema.nullable(),
```

Remove the `AgentV2PendingRoutineActionSchema` import if it becomes unused.

- [x] **Step 4: Update runtime prompt guidance**

In `src/lib/agent-v2/runtime/responses-agent.ts`, replace prompt lines about `pending_routine_action` with:

```ts
"Set pending_followup_action to null unless you explicitly offer a future action the user can confirm.",
"If next_step_offer_de is non-null and asks the user to continue, choose a matching pending_followup_action. Use product_recommendation for concrete product offers, advisor_response for non-mutating continuations, and routine_mutation only for explicit routine create/change offers.",
"Only pending_followup_action.kind routine_mutation can authorize build_or_fix_routine on a short next-turn confirmation.",
```

Update any references from `pending_routine_action` to `pending_followup_action`.

Explicitly include both model-facing prompt text and runtime helper guidance text, including boundary-answer guidance strings and routine-tool permission guidance.

- [x] **Step 5: Run runtime tests and verify the new tests pass**

Run:

```bash
npx tsx --test tests/agent-v2-responses-runtime.spec.ts
```

Expected: The new prompt/tool-schema tests pass. Fixture failures from old `pending_routine_action` names are expected until Task 6.

---

### Task 3: Validate Offer/Action Consistency

**Files:**
- Modify: `src/lib/agent-v2/validation/final-answer-validator.ts`
- Test: `tests/agent-v2-final-answer-validator.spec.ts`

- [x] **Step 1: Write failing validator tests**

Add tests for the structural invariant. Do not test German phrase parsing; the architecture relies on structured action state, not prose interpretation.

```ts
test("AgentV2 validator blocks actionable next step without pending follow-up action", () => {
  const answer = createValidGeneralAdviceAnswer({
    payload: {
      user_facing_answer_de: "Eine Maske kann sinnvoll sein.",
      category_or_topic: "mask",
      key_points_de: ["Optionaler Zusatz."],
      next_step_offer_de: "Ich kann dir danach konkrete Masken empfehlen.",
    },
    pending_followup_action: null,
  })

  const result = validateAgentV2FinalAnswer(answer, defaultValidationContext())

  assert.equal(result.ok, false)
  assert.ok(
    result.errors.some(
      (error) => error.validator_id === "pending_followup_action_missing",
    ),
  )
})

test("AgentV2 validator blocks hidden pending follow-up actions without visible offer", () => {
  const answer = createValidGeneralAdviceAnswer({
    payload: {
      user_facing_answer_de: "Eine Maske kann sinnvoll sein.",
      category_or_topic: "mask",
      key_points_de: ["Optionaler Zusatz."],
      next_step_offer_de: null,
    },
    pending_followup_action: {
      kind: "routine_mutation",
      category: "mask",
      routine_layer: "basics",
      routine_action: "add_step",
      source: "assistant_offer",
    },
  })

  const result = validateAgentV2FinalAnswer(answer, defaultValidationContext())

  assert.equal(result.ok, false)
  assert.ok(
    result.errors.some(
      (error) => error.validator_id === "pending_followup_action_hidden",
    ),
  )
})

test("AgentV2 validator blocks routine action fields on non-mutating follow-up actions", () => {
  const answer = createValidGeneralAdviceAnswer({
    payload: {
      user_facing_answer_de: "Eine Maske kann sinnvoll sein.",
      category_or_topic: "mask",
      key_points_de: ["Optionaler Zusatz."],
      next_step_offer_de: "Ich kann dir danach konkrete Masken empfehlen.",
    },
    pending_followup_action: {
      kind: "product_recommendation",
      category: "mask",
      routine_layer: "basics",
      routine_action: "add_step",
      source: "assistant_offer",
    },
  })

  const result = validateAgentV2FinalAnswer(answer, defaultValidationContext())

  assert.equal(result.ok, false)
  assert.ok(
    result.errors.some(
      (error) => error.validator_id === "pending_followup_action_invalid_fields",
    ),
  )
})
```

Use existing helper names in `tests/agent-v2-final-answer-validator.spec.ts`; if helpers differ, adapt the test body to the local fixture builder while keeping the same assertions.

- [x] **Step 2: Run validator tests and verify they fail**

Run:

```bash
npx tsx --test tests/agent-v2-final-answer-validator.spec.ts
```

Expected: FAIL because the validator does not know `pending_followup_action`.

- [x] **Step 3: Add validator logic**

In `src/lib/agent-v2/validation/final-answer-validator.ts`, add a sub-validator that matches the file's existing `findings: AgentV2ValidationError[]` architecture. Register it in the same validation pass that calls the other answer validators.

Also update existing side-effect validation that still checks `answer.pending_routine_action !== null`; it must check `answer.pending_followup_action !== null` after the contract rename.

Add helper reader:

```ts
function readNextStepOffer(answer: AgentV2TerminalAnswer): string | null {
  if (!("next_step_offer_de" in answer.payload)) return null
  const offer = answer.payload.next_step_offer_de
  return typeof offer === "string" && offer.trim().length > 0 ? offer.trim() : null
}

```

Add validation:

```ts
function validatePendingFollowupAction(
  answer: AgentV2TerminalAnswer,
  findings: AgentV2ValidationError[],
) {
  const nextStepOffer = readNextStepOffer(answer)
  if (nextStepOffer && !answer.pending_followup_action) {
    findings.push({
      validator_id: "pending_followup_action_missing",
      message: "Actionable next_step_offer_de should provide pending_followup_action.",
      severity: "block",
    })
  }

  if (!nextStepOffer && answer.pending_followup_action) {
    findings.push({
      validator_id: "pending_followup_action_hidden",
      message: "pending_followup_action must not be set without a visible next_step_offer_de.",
      severity: "block",
    })
  }

  const action = answer.pending_followup_action
  if (action && action.kind !== "routine_mutation" && action.routine_action !== null) {
    findings.push({
      validator_id: "pending_followup_action_invalid_fields",
      message: "Only routine_mutation pending follow-up actions may set routine_action.",
      severity: "block",
    })
  }

  if (action?.kind === "routine_mutation" && action.routine_action === null) {
    findings.push({
      validator_id: "pending_followup_action_invalid_fields",
      message: "routine_mutation pending follow-up actions require routine_action.",
      severity: "block",
    })
  }
}
```

Block any mismatch between visible offer state and structured pending state: non-null `next_step_offer_de` requires non-null `pending_followup_action`, and non-null `pending_followup_action` requires non-null `next_step_offer_de`. Do not add a deterministic German prose parser for offer wording.

- [x] **Step 4: Run validator tests and verify they pass**

Run:

```bash
npx tsx --test tests/agent-v2-final-answer-validator.spec.ts
```

Expected: PASS for new validator tests and no unexpected failures.

---

### Task 4: Persist and Normalize Pending Follow-Up State

**Files:**
- Modify: `src/lib/agent-v2/production/session-state.ts`
- Modify: `src/lib/agent-v2/production/persisted-session-state.ts`
- Modify: `src/lib/agent-v2/compare/run-agent-v2.ts`
- Test: `tests/agent-v2-production-chat-pipeline.spec.ts`
- Test: `tests/agent-v2-compare-runner.spec.ts`

- [x] **Step 1: Write failing persistence tests**

Add a test that verifies AgentV2 production carries a pending follow-up action from persisted state into runtime:

```ts
test("AgentV2 production pipeline carries persisted pending follow-up action into runtime", async () => {
  let receivedRoutineContext: AgentV2RoutineThreadContext | null = null

  await runAgentV2ProductionPipeline(
    {
      message: "ja bitte",
      conversationId: "conversation-1",
      userId: "user-1",
      requestId: "request-1",
    },
    {
      loadConversationHistory: async () => [],
      getUserContext: async () => ({
        profile: createCompleteHairProfile(),
        routine_inventory: [],
        relevant_memory: [],
        derived_signals: [],
        suggested_overlays: [],
        missing_profile: [],
      }),
      loadUserMemoryContext: async () => ({
        enabled: true,
        entries: [],
        promptContext: null,
        dislikedProductNames: [],
      }),
      loadConversationState: async (): Promise<ConversationState> =>
        ({
          ...createDefaultConversationState(),
          agent_v2_routine_thread_context: {
            active: true,
            current_layer: "basics",
            last_answer_mode: "general_advice",
            last_routine_categories: ["mask"],
            last_user_goal: "Zusatzpflege prüfen.",
            summary_de: "Assistant offered concrete mask recommendations.",
            pending_followup_action: {
              kind: "product_recommendation",
              category: "mask",
              routine_layer: "basics",
              routine_action: null,
              source: "assistant_offer",
            },
            visible_steps: [],
          },
        }) as ConversationState,
      client: {
        responses: {
          create: async () => ({ output: [] }),
        },
      },
      runAgentV2ResponsesTurn: async (params) => {
        receivedRoutineContext = params.routineThreadContext as AgentV2RoutineThreadContext
        return createAgentV2Result()
      },
    },
  )

  assert.equal(receivedRoutineContext?.pending_followup_action?.kind, "product_recommendation")
})
```

Add one compatibility test that legacy persisted `pending_routine_action` normalizes into:

```ts
pending_followup_action: {
  kind: "routine_mutation",
  category: "leave_in",
  routine_layer: "basics",
  routine_action: "add_step",
  source: "assistant_offer",
}
```

Host this compatibility test in `tests/agent-v2-production-chat-pipeline.spec.ts` by exercising the exported conversation-state normalization path. Do not test the private `normalizeRoutineThreadContext` helper directly unless the module already exports it.

- [x] **Step 2: Run production pipeline tests and verify they fail**

Run:

```bash
npx tsx --test tests/agent-v2-production-chat-pipeline.spec.ts
```

Expected: FAIL because state normalization does not expose `pending_followup_action`.

- [x] **Step 3: Update session-state persistence**

In `src/lib/agent-v2/production/session-state.ts`:

- Replace `readPendingRoutineAction` with `readPendingFollowupAction`.
- Persist `answer.pending_followup_action`.
- When building inactive routine thread context, set `pending_followup_action: null`.
- Import `legacyRoutineActionToFollowup` from `src/lib/agent-v2/pending-followup-action.ts` for reading old state or old fixture-like objects.

Use the shared compatibility helper; do not define this conversion inline in multiple files:

```ts
import { legacyRoutineActionToFollowup } from "../pending-followup-action"
```

- [x] **Step 4: Update persisted-state normalization**

In `src/lib/agent-v2/production/persisted-session-state.ts`, pre-convert raw legacy objects before `AgentV2RoutineThreadContextSchema.safeParse`. This matters because the schema is a `z.strictObject`; once `pending_routine_action` is removed from the schema, parsing an old object with that key would otherwise fail and drop the whole active routine thread context.

```ts
function normalizeRoutineThreadContext(value: unknown): AgentV2RoutineThreadContext | null {
  const candidate = isRecord(value) ? { ...value } : value
  if (isRecord(candidate) && !("pending_followup_action" in candidate)) {
    candidate.pending_followup_action = legacyRoutineActionToFollowup(
      candidate.pending_routine_action,
    )
    delete candidate.pending_routine_action
  }

  const parsed = AgentV2RoutineThreadContextSchema.safeParse(candidate)
  return parsed.success ? parsed.data : null
}
```

Do not write new `pending_routine_action` fields.

- [x] **Step 5: Update Compare Lab continuity**

In `src/lib/agent-v2/compare/run-agent-v2.ts`:

- Replace `AgentV2PendingRoutineActionSchema` usage with `AgentV2PendingFollowupActionSchema`.
- Store `pending_followup_action` in the compare-runner routine thread context.
- Convert legacy `pending_routine_action` from older objects with the shared `legacyRoutineActionToFollowup`.

Update `tests/agent-v2-compare-runner.spec.ts` so assertions read:

```ts
assert.deepEqual(followUpContext.pending_followup_action, {
  kind: "routine_mutation",
  category: "leave_in",
  routine_layer: "basics",
  routine_action: "add_step",
  source: "assistant_offer",
})
```

- [x] **Step 6: Run production and compare tests and verify they pass**

Run:

```bash
npx tsx --test tests/agent-v2-production-chat-pipeline.spec.ts tests/agent-v2-compare-runner.spec.ts
```

Expected: PASS for persistence, legacy conversion, and Compare Lab continuity tests.

---

### Task 5: Resolve Short Confirmations by Pending Follow-Up Action

**Files:**
- Modify: `src/lib/agent-v2/runtime/responses-agent.ts`
- Test: `tests/agent-v2-responses-runtime.spec.ts`

- [x] **Step 1: Migrate and extend short-confirmation runtime tests**

Prefer migrating the existing pending-routine-action confirmation tests in `tests/agent-v2-responses-runtime.spec.ts` in place instead of adding duplicate parallel coverage. Rename their fixtures and assertions to `pending_followup_action`, then add only the missing coverage for product recommendation and non-mutating advisor follow-ups.

Target coverage should include these four behaviors.

Also add an assertion to the successful product/advisor/routine confirmation cases that the consumed prior `pending_followup_action` is not carried forward unless the new terminal answer explicitly creates a new one. This proves the runtime clears consumed pending actions for all user-confirmable kinds.

Product offer:

```ts
test("AgentV2 short confirmation continues pending product recommendation offer", async () => {
  const client = fakeResponsesClientWithOutputs([
    guidanceCall("call_1", {
      answer_mode_hint: "product_recommendation",
      categories: ["mask"],
      routine_layer: "basics",
    }),
    functionCall("call_2", "select_products", {
      category: "mask",
      reason: "User confirms the pending mask product recommendation offer.",
      user_request: "Ja bitte",
      constraints: [],
      product_request_kind: "specific_products",
      requested_product_count: null,
      count_policy: "default",
      evidence_quote: "Ja bitte",
    }),
    terminalProductRecommendation("call_3", ["mask-1"]),
  ])
  const selectInputs: Record<string, unknown>[] = []

  const result = await runAgentV2ResponsesTurn({
    client,
    message: "Ja bitte.",
    recentMessages: [
      { role: "assistant", content: "Soll ich dir konkrete Masken empfehlen?" },
    ],
    userContext: { hairProfile: null, routineInventory: [], sessionMemory: [] },
    routineThreadContext: {
      active: true,
      current_layer: "basics",
      last_answer_mode: "general_advice",
      last_routine_categories: ["mask"],
      last_user_goal: "Zusatzpflege prüfen.",
      summary_de: "Assistant offered concrete mask product recommendations.",
      pending_followup_action: {
        kind: "product_recommendation",
        category: "mask",
        routine_layer: "basics",
        routine_action: null,
        source: "assistant_offer",
      },
      visible_steps: [],
    },
    currentRoutineLayer: "basics",
    tools: {
      ...fakeAgentV2Tools(),
      select_products: async (input) => {
        selectInputs.push(input)
        return productProjection("mask", [{ product_id: "mask-1", name: "Test Maske" }])
      },
    },
  })

  assert.equal(selectInputs[0]?.category, "mask")
  assert.equal(result.trace.failure_stage, null)
  assert.equal(result.final_answer.answer_mode, "product_recommendation")
})
```

General explanation:

```ts
test("AgentV2 short confirmation continues pending explanation offer without routine mutation", async () => {
  const result = await runAgentV2ResponsesTurn({
    client: fakeResponsesClientWithOutputs([
      guidanceCall("call_1", {
        answer_mode_hint: "general_advice",
        categories: ["mask", "oil"],
        routine_layer: "basics",
      }),
      terminalMaskOilComparisonInRoutine("call_2", "Ja bitte"),
    ]),
    message: "Ja bitte.",
    recentMessages: [
      { role: "assistant", content: "Soll ich dir erklären, ob Maske oder Öl sinnvoller ist?" },
    ],
    userContext: { hairProfile: null, routineInventory: [], sessionMemory: [] },
    routineThreadContext: {
      active: true,
      current_layer: "basics",
      last_answer_mode: "general_advice",
      last_routine_categories: ["mask", "oil"],
      last_user_goal: "Maske oder Öl vergleichen.",
      summary_de: "Assistant offered a non-mutating comparison.",
      pending_followup_action: {
        kind: "advisor_response",
        category: null,
        routine_layer: "basics",
        routine_action: null,
        source: "assistant_offer",
      },
      visible_steps: [],
    },
    currentRoutineLayer: "basics",
    tools: fakeAgentV2Tools(),
  })

  assert.equal(
    result.trace.tool_calls.some((call) => call.name === "build_or_fix_routine"),
    false,
  )
  assert.equal(result.trace.failure_stage, null)
  assert.equal(result.final_answer.answer_mode, "general_advice")
})
```

Routine mutation:

```ts
test("AgentV2 short confirmation authorizes matching pending routine mutation", async () => {
  const client = fakeResponsesClientWithOutputs([
    guidanceCall("call_1", {
      answer_mode_hint: "routine",
      categories: ["leave_in"],
      routine_layer: "basics",
    }),
    functionCall("call_2", "build_or_fix_routine", {
      objective: "fix_routine",
      requested_layer: "basics",
      requested_category: "leave_in",
      reason: "User confirms the pending leave-in routine mutation offer.",
      routine_intent: "modify",
      mutation_kind: "add_step",
      evidence_quote: "Ja",
    }),
    terminalLeaveInRoutineMutationWithEvidence("call_3", "Ja"),
  ])
  let buildRoutineCalled = false

  const result = await runAgentV2ResponsesTurn({
    client,
    message: "Ja.",
    recentMessages: [
      {
        role: "assistant",
        content: "Soll ich den Leave-in als leichten Zusatz in deine Routine einbauen?",
      },
    ],
    userContext: { hairProfile: null, routineInventory: [], sessionMemory: [] },
    routineThreadContext: {
      active: true,
      current_layer: "basics",
      last_answer_mode: "general_advice",
      last_routine_categories: ["shampoo", "conditioner", "leave_in"],
      last_user_goal: "Trockene Längen mit leichter Routine.",
      summary_de: "Assistant offered to add a leave-in step.",
      pending_followup_action: {
        kind: "routine_mutation",
        category: "leave_in",
        routine_layer: "basics",
        routine_action: "add_step",
        source: "assistant_offer",
      },
      visible_steps: [],
    },
    currentRoutineLayer: "basics",
    tools: {
      ...fakeAgentV2Tools(),
      build_or_fix_routine: async () => {
        buildRoutineCalled = true
        return {
          routine_layer: "basics",
          visible_steps: [
            { step_id: "step_shampoo" },
            { step_id: "step_conditioner" },
            { step_id: "step_leave_in" },
          ],
        }
      },
    },
  })

  assert.equal(buildRoutineCalled, true)
  assert.equal(result.trace.failure_stage, null)
  assert.equal(result.final_answer.answer_mode, "routine")
})
```

No pending action:

```ts
test("AgentV2 short confirmation without pending follow-up asks concise clarification", async () => {
  const result = await runAgentV2ResponsesTurn({
    client: fakeResponsesClientWithOutputs([terminalClarification("call_1")]),
    message: "Ja.",
    recentMessages: [{ role: "assistant", content: "Okay." }],
    userContext: { hairProfile: null, routineInventory: [], sessionMemory: [] },
    tools: fakeAgentV2Tools(),
  })

  assert.equal(result.final_answer.answer_mode, "clarification")
  assert.equal(result.trace.failure_stage, null)
})
```

If a helper name in the local test file differs, create a small local helper in the test file that returns the same shaped projection/terminal answer shown above. Do not weaken the assertions about tool choice, failure stage, and answer mode.

- [x] **Step 2: Run runtime tests and verify they fail**

Run:

```bash
npx tsx --test tests/agent-v2-responses-runtime.spec.ts
```

Expected: FAIL because runtime policy still only understands `pending_routine_action`.

- [x] **Step 3: Update routine tool policy**

Replace `RoutineToolPolicy.pendingRoutineAction` with `pendingFollowupAction`.

Rule:

```ts
if (hasShortRoutineActionConfirmation(message)) {
  const action = routineThreadContext?.pending_followup_action ?? null
  return {
    hardDenyReason:
      action?.kind === "routine_mutation" ? null : "routine_action_not_authorized",
    pendingConfirmationAllowed: action?.kind === "routine_mutation",
    pendingFollowupAction: action,
  }
}
```

Update the match function:

```ts
function doesRoutineCallMatchPendingFollowup(
  args: Record<string, unknown>,
  pending: AgentV2PendingFollowupAction | null,
): boolean {
  if (!pending || pending.kind !== "routine_mutation") return false
  const requestedCategory =
    typeof args.requested_category === "string" ? args.requested_category : null
  const requestedLayer = typeof args.requested_layer === "string" ? args.requested_layer : null
  const routineIntent = typeof args.routine_intent === "string" ? args.routine_intent : "none"
  const mutationKind = typeof args.mutation_kind === "string" ? args.mutation_kind : "none"

  const categoryMatches = pending.category === null || pending.category === requestedCategory
  const layerMatches = pending.routine_layer === null || pending.routine_layer === requestedLayer
  const actionMatches =
    pending.routine_action === routineIntent || pending.routine_action === mutationKind

  return categoryMatches && layerMatches && actionMatches
}
```

- [x] **Step 4: Inject pending follow-up context for the model**

In `buildInputItems`, if the routine thread context has `pending_followup_action`, inject:

```ts
Pending follow-up action from previous assistant offer. Short confirmations such as "Ja", "Ja bitte", "gerne", and "mach das" should resolve to this action. Product recommendation actions should call select_products. Advisor response actions should answer without build_or_fix_routine. Only routine_mutation can authorize build_or_fix_routine. ${JSON.stringify(pendingFollowupAction)}
```

- [x] **Step 5: Clear consumed pending follow-up actions**

When the latest user message is a short confirmation and runtime successfully resolves it against `routineThreadContext.pending_followup_action`, clear that prior action before persisting conversation state.

Lifecycle rule:

```ts
const consumedPendingFollowupAction =
  isShortConfirmation && resolvedPendingFollowupAction !== null

const nextPendingFollowupAction = finalAnswer.pending_followup_action
```

The important behavior is:

- if the final answer has no new `next_step_offer_de`, persist `pending_followup_action: null`;
- if the final answer offers another next step, persist the new `finalAnswer.pending_followup_action`;
- never carry the consumed previous action forward as implicit state.

Apply this generally for `product_recommendation`, `advisor_response`, and `routine_mutation`. Do not make routine mutation a special lifecycle case.

- [x] **Step 6: Run runtime tests and verify they pass**

Run:

```bash
npx tsx --test tests/agent-v2-responses-runtime.spec.ts
```

Expected: PASS.

---

### Task 6: Update Existing Fixtures and Remove Canonical Old Field

**Files:**
- Modify all tests currently using `pending_routine_action`
- Modify production code still importing or writing `AgentV2PendingRoutineActionSchema`

- [x] **Step 1: Find old-field references**

Run:

```bash
rg -n "pending_routine_action|AgentV2PendingRoutineAction" src tests
```

Expected: list of old references to migrate or compatibility-read.

- [x] **Step 2: Migrate fixtures**

Replace terminal answer fixtures:

```ts
pending_routine_action: {
  action: "add_step",
  routine_layer: "basics",
  category: "leave_in",
  source: "assistant_offer",
}
```

with:

```ts
pending_followup_action: {
  kind: "routine_mutation",
  routine_action: "add_step",
  routine_layer: "basics",
  category: "leave_in",
  source: "assistant_offer",
}
```

Replace non-action fixtures with:

```ts
pending_followup_action: null
```

- [x] **Step 3: Keep legacy reads only in normalization**

After fixture migration, old-field references should remain only in compatibility helpers inside `persisted-session-state.ts` or `session-state.ts`.

Run:

```bash
rg -n "pending_routine_action|AgentV2PendingRoutineAction" src tests
```

Expected: no test references; only compatibility-read code in production.

- [x] **Step 4: Run AgentV2 test suite**

Run:

```bash
npm run test:agent
```

Expected: PASS.

---

### Task 7: Verification and Handoff

**Files:**
- No code files unless tests reveal missed references.

- [x] **Step 1: Run focused tests**

Run:

```bash
npx tsx --test tests/agent-v2-contracts.spec.ts tests/agent-v2-final-answer-validator.spec.ts tests/agent-v2-responses-runtime.spec.ts tests/agent-v2-production-chat-pipeline.spec.ts tests/agent-v2-compare-runner.spec.ts tests/agent-v2-current-care-context.spec.ts
```

Expected: PASS.

- [x] **Step 2: Run broader AgentV2 suite**

Run:

```bash
npm run test:agent
```

Expected: PASS.

- [x] **Step 3: Run chat eval smoke**

Run:

```bash
npm run test:chat
```

Expected: PASS.

- [x] **Step 4: Run full local verification**

Run:

```bash
npm run ci:verify
```

Expected: PASS.

- [x] **Step 5: Inspect diff**

Run:

```bash
git diff --stat
git diff -- src/lib/agent-v2 tests
```

Expected: diff only touches AgentV2 contracts/runtime/state/validator and AgentV2 tests.

- [x] **Step 6: Run final review gate before shipping**

Follow repo `AGENTS.md`: after implementation and checks, run the configured final code review gate for this repo/thread before `ship-it`. Ask the user for explicit approval before commit, push, PR, or merge.

---

## Open Risks

- **Repair churn:** Missing `pending_followup_action` for non-null `next_step_offer_de` is intentionally blocking because the visible offer would otherwise be unresolvable. Watch repair rates during evals and production rollout.
- **Legacy state:** Existing conversations may still contain `pending_routine_action`. Compatibility normalization must keep those confirmations working.
- **Offer/action mismatch:** The validator needs enough checks to prevent a non-mutating offer from accidentally authorizing `routine_mutation`, without becoming a brittle German prose parser.
- **Model adoption:** Prompt guidance and tests need to teach the model to emit pending actions consistently so strict pairing does not create repeated repair loops.

## Self-Review

- Spec coverage: The plan covers generalized pending state, `next_step_offer_de` consistency, short-confirmation resolution, routine mutation guardrails, legacy compatibility, and verification.
- Placeholder scan: No unresolved placeholders remain. The only adaptive note is to use existing fixture helper names where local helper names differ.
- Type consistency: The plan uses `pending_followup_action`, `AgentV2PendingFollowupActionSchema`, and `routine_action` consistently after Task 1.
