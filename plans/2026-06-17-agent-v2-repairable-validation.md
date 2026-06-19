# AgentV2 Repairable Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent safe hidden metadata validation failures from replacing good AgentV2 answers with generic clarification fallbacks, while giving model repair calls actionable validator feedback.

**Architecture:** Keep validators strict, but make their repair feedback structured. The first implementation generalizes the validation error shape and repair payload, then applies rich metadata and safe sanitization only to `request_interpretation.evidence_quote`; visible-answer, product, routine, safety, and pending-action failures remain strict.

**Tech Stack:** TypeScript, Zod, Node test runner, AgentV2 Responses runtime, Supabase-backed production traces.

---

## Spec Link And User Situation

**Spec source:** aligned in chat after the failed local turn for `Was hilft gegen Frizz bei meinem Haarprofil?`.

**User situation being solved:** The model produced a good German answer, but `request_interpretation.evidence_quote: "Frizz"` was rejected because the hidden evidence validator considered the exact quote too short. The repair call received only a generic error, repeated `"Frizz"`, and the runtime replaced the good answer with `Ich bin mir gerade nicht sicher...`.

**Promised end-state:** For safe evidence metadata failures, AgentV2 repair calls receive actionable structured details. If repair still fails only on evidence metadata, the runtime sanitizes that hidden metadata and preserves the good visible answer. Dangerous or user-visible validation failures still repair/fallback strictly.

**Aligned safety boundary:** The sanitizer must only run when the model answer is otherwise valid. If visible prose, products, routine actions, tool grounding, safety/medical constraints, pending follow-up metadata, or schema parsing fail, the sanitizer must not rescue the answer.

## Claude Review Adjustments

Claude review found the direction sound but caught plan-level blockers that must be fixed before subagent execution:

- The current worktree already contains the narrow `Frizz` evidence relaxation and regression test. This plan must build on that patch rather than adding a competing `>= 4` branch.
- Runtime sanitizer wiring must never re-parse raw `terminal.value` in the failed-validation branch. Use `validation.sanitized_answer` as the guard/input so schema-invalid repair attempts still fall back gracefully instead of throwing a `ZodError`.
- Runtime tests must first extend or add a terminal-answer helper that can override full `request_interpretation`, `payload`, and `tool_grounding`; the current helper only supports interpretation overrides.
- The contract test must import `AgentV2ValidationErrorSchema`; otherwise the intended schema failure becomes a `ReferenceError`.

## Scope Boundaries

In scope:
- Add optional structured repair fields to AgentV2 validation errors.
- Relax exact short evidence quote validation for meaningful user/context terms, including `Frizz`.
- Populate rich repair metadata for `request_interpretation_evidence`.
- Pass structured repair details into the model repair loop.
- Add a bounded sanitizer for `request_interpretation.evidence_quote` only, used after one failed repair attempt.
- Require the answer to be otherwise valid before sanitizing hidden evidence metadata.
- Trace the sanitization as a warning.

Out of scope:
- Rich repair metadata for every validator.
- Sanitizing user-visible prose, product ids, routine tool grounding, medical/safety claims, pending follow-up actions, or routine mutation permissions.
- Replacing the existing validator architecture with a full `auto_sanitize` / `model_repair` / `hard_block` taxonomy.
- Changing product/routine recommendation behavior.
- Fixing unrelated Clawpatch findings.

## Target File Map

- Modify `src/lib/agent-v2/contracts.ts`
  - Extend `AgentV2ValidationErrorSchema` with optional repair fields.
  - Keep fields optional so existing validators remain compatible.

- Modify `src/lib/agent-v2/validation/final-answer-validator.ts`
  - Relax meaningful exact short evidence quote handling.
  - Add evidence-specific `reason_code`, `rejected_value`, `suggested_value`, and `repair_hint`.
  - Export a small sanitizer helper for evidence metadata after failed repair.

- Modify `src/lib/agent-v2/runtime/responses-agent.ts`
  - Pass full structured validation error details into repair tool output.
  - Add explicit repair instruction language for `suggested_value`.
  - After one failed repair, sanitize only evidence metadata errors when safe, revalidate, then accept with warning.

- Modify `tests/agent-v2-contracts.spec.ts`
  - Cover optional repair metadata in validation error schema.

- Modify `tests/agent-v2-final-answer-validator.spec.ts`
  - Cover exact short meaningful quote acceptance.
  - Cover generic short single-token rejection.
  - Cover rich evidence repair metadata.
  - Cover evidence metadata sanitization helper.

- Modify `tests/agent-v2-responses-runtime.spec.ts`
  - Cover repair payload containing structured details.
  - Cover repair-once-then-sanitize preserving a good answer after repeated evidence metadata failure.
  - Cover non-evidence validation failures still falling back strictly.

## Implementation Tasks

### Task 1: Extend Validation Error Contract

**Files:**
- Modify: `src/lib/agent-v2/contracts.ts`
- Modify: `tests/agent-v2-contracts.spec.ts`

- [ ] **Step 1: Add a failing schema test for repair metadata**

Add `AgentV2ValidationErrorSchema` to the existing import in `tests/agent-v2-contracts.spec.ts`, then add a test near existing AgentV2 contract tests:

```ts
test("AgentV2ValidationErrorSchema accepts optional repair metadata", () => {
  const parsed = AgentV2ValidationErrorSchema.parse({
    validator_id: "request_interpretation_evidence",
    message: "Evidence quote is not grounded.",
    severity: "block",
    path: ["request_interpretation", "evidence_quote"],
    reason_code: "evidence_quote_not_in_context",
    rejected_value: "Frizz repair",
    expected: "Exact phrase from latest user message or active context.",
    suggested_value: "Was hilft gegen Frizz bei meinem Haarprofil?",
    repair_hint: "Use suggested_value exactly for request_interpretation.evidence_quote.",
  })

  assert.equal(parsed.reason_code, "evidence_quote_not_in_context")
  assert.equal(parsed.rejected_value, "Frizz repair")
  assert.equal(parsed.suggested_value, "Was hilft gegen Frizz bei meinem Haarprofil?")
})
```

Run:

```bash
node --import tsx --test tests/agent-v2-contracts.spec.ts
```

Expected: fail because the schema strips or rejects the new fields.

- [ ] **Step 2: Extend `AgentV2ValidationErrorSchema`**

In `src/lib/agent-v2/contracts.ts`, extend the schema to:

```ts
export const AgentV2ValidationErrorSchema = z.object({
  validator_id: z.string(),
  message: z.string(),
  severity: z.enum(["block", "warn"]).default("block"),
  path: z.array(z.union([z.string(), z.number()])).optional(),
  reason_code: z.string().optional(),
  rejected_value: z.unknown().optional(),
  expected: z.unknown().optional(),
  suggested_value: z.unknown().optional(),
  repair_hint: z.string().optional(),
})
```

- [ ] **Step 3: Verify contract test passes**

Run:

```bash
node --import tsx --test tests/agent-v2-contracts.spec.ts
```

Expected: pass.

### Task 2: Make Evidence Validation Repair-Aware

**Files:**
- Modify: `src/lib/agent-v2/validation/final-answer-validator.ts`
- Modify: `tests/agent-v2-final-answer-validator.spec.ts`

- [ ] **Step 1: Reconcile existing exact short concern evidence regression**

The current worktree already includes the `Frizz` regression test and narrow validator patch from the incident investigation. Keep this test, or replace it with this equivalent test near the existing evidence quote tests:

```ts
test("validator allows exact short concern terms as evidence quotes", () => {
  const result = validateAgentV2FinalAnswer(
    {
      ...baseAnswer,
      answer_mode: "general_advice",
      request_interpretation: requestInterpretation({
        primary_intent: "general_advice",
        product_request_kind: "category_education",
        routine_intent: "none",
        care_category: "none",
        requested_product_count: null,
        count_policy: "none",
        evidence_quote: "Frizz",
      }),
      tool_grounding: {
        ...baseAnswer.tool_grounding,
        used_guidance_package_ids: requiredGuidanceForAnswer("general_advice", "none"),
        used_product_tool: false,
        product_ids: [],
      },
      payload: {
        user_facing_answer_de:
          "Gegen Frizz hilft bei deinem Profil vor allem leichte Pflege in den Längen.",
        category_or_topic: "frizz",
        key_points_de: ["Leichte Pflege in den Längen reduziert Reibung."],
        next_step_offer_de: null,
      },
    },
    {
      ...baseValidationContext,
      selectedProductProjections: [],
      latestUserMessage: "Was hilft gegen Frizz bei meinem Haarprofil?",
      recentEvidenceText: "Was hilft gegen Frizz bei meinem Haarprofil?",
      toolCallHistory: [{ name: "load_advisor_guidance", call_id: "call_guidance" }],
      requiredGuidancePackageIds: [],
    },
  )

  assert.equal(result.ok, true, JSON.stringify(result.errors, null, 2))
  assert.equal(result.warnings.length, 0, JSON.stringify(result.warnings, null, 2))
})
```

Run:

```bash
node --import tsx --test tests/agent-v2-final-answer-validator.spec.ts
```

Expected before the existing local patch: fail with `request_interpretation_evidence`.

Expected in the current worktree: pass. Do not add a second conflicting short-quote branch.

- [ ] **Step 2: Add failing test for rich evidence repair metadata**

Add this test near `validator blocks non-diagnostic request interpretation evidence quotes`:

```ts
test("validator returns repair metadata for ungrounded evidence quotes", () => {
  const result = validateAgentV2FinalAnswer(
    {
      ...baseAnswer,
      request_interpretation: requestInterpretation({
        evidence_quote: "anti frizz protocol",
      }),
    },
    {
      ...baseValidationContext,
      latestUserMessage: "Was hilft gegen Frizz bei meinem Haarprofil?",
      recentEvidenceText: "Was hilft gegen Frizz bei meinem Haarprofil?",
      toolCallHistory: [{ name: "load_advisor_guidance", call_id: "call_guidance" }],
    },
  )

  const error = result.errors.find(
    (candidate) => candidate.validator_id === "request_interpretation_evidence",
  )
  assert.ok(error)
  assert.equal(error.path?.join("."), "request_interpretation.evidence_quote")
  assert.equal(error.rejected_value, "anti frizz protocol")
  assert.equal(error.suggested_value, "Was hilft gegen Frizz bei meinem Haarprofil?")
  assert.equal(error.reason_code, "evidence_quote_not_in_context")
  assert.match(String(error.repair_hint), /suggested_value/)
})
```

Run:

```bash
node --import tsx --test tests/agent-v2-final-answer-validator.spec.ts
```

Expected: fail because rich metadata is not populated.

- [ ] **Step 3: Implement focused evidence grounding details**

In `src/lib/agent-v2/validation/final-answer-validator.ts`:

1. Keep or refine the existing local short-term branch. Exact contextual short terms are valid when:
   - normalized quote appears in `buildEvidenceText(context)`;
   - `compactEvidence.length >= MIN_EVIDENCE_QUOTE_LENGTH - 1` (currently 5, so `"Frizz"` passes);
   - `meaningfulEvidenceTokens(normalizedEvidence).length > 0`;
   - existing generic singleton handling still blocks non-diagnostic values such as single `shampoo` / `routine` before the broad length acceptance branch.

Do not add the earlier proposed explicit denylist after the `compactEvidence.length >= MIN_EVIDENCE_QUOTE_LENGTH` branch; it would be dead code for terms of length 6+.

2. Add helper:

```ts
function buildEvidenceRepairMetadata(params: {
  normalizedEvidence: string
  originalEvidence: string
  normalizedEvidenceText: string
  context: AgentV2FinalAnswerValidationContext
}): Pick<
  AgentV2ValidationError,
  "reason_code" | "rejected_value" | "expected" | "suggested_value" | "repair_hint"
> {
  const suggestedValue = chooseEvidenceQuoteSuggestion(params.context)
  const reasonCode = params.normalizedEvidenceText.includes(params.normalizedEvidence)
    ? "evidence_quote_too_short_or_generic"
    : "evidence_quote_not_in_context"

  return {
    reason_code: reasonCode,
    rejected_value: params.originalEvidence,
    expected: "Exact phrase from latest user message or active session context.",
    suggested_value: suggestedValue,
    repair_hint:
      "Set request_interpretation.evidence_quote to suggested_value exactly, or to another exact phrase from the latest user message / active context.",
  }
}
```

3. Add helper:

```ts
function chooseEvidenceQuoteSuggestion(context: AgentV2FinalAnswerValidationContext): string {
  const latest = context.latestUserMessage.trim()
  if (latest.length > 0) return latest.slice(0, 240)
  const recent = (context.recentEvidenceText ?? "").trim()
  if (recent.length > 0) return recent.slice(0, 240)
  return "unclear"
}
```

4. Preserve existing `plausible` warning behavior, but include repair metadata only on blocking errors for now.

- [ ] **Step 4: Add generic short-token regression**

Add or confirm a test proving generic short or non-diagnostic evidence is still rejected when it is not a meaningful contextual term. The point is to avoid turning the `Frizz` fix into "any short token is okay."

- [ ] **Step 5: Verify validator tests**

Run:

```bash
node --import tsx --test tests/agent-v2-final-answer-validator.spec.ts
```

Expected: pass.

### Task 3: Pass Structured Validation Errors Into Repair

**Files:**
- Modify: `src/lib/agent-v2/runtime/responses-agent.ts`
- Modify: `tests/agent-v2-responses-runtime.spec.ts`

- [ ] **Step 1: Fix runtime terminal-answer test helper**

Before adding new runtime tests, inspect the terminal-answer helpers in `tests/agent-v2-responses-runtime.spec.ts`.

If the existing helper only accepts request-interpretation overrides, extend it or add a new helper that can override:

- `request_interpretation`
- `payload`
- `tool_grounding`
- `pending_followup_action`

This is required for the sanitize-after-repair and mixed-failure tests. Do not rely on silently ignored overrides.

- [ ] **Step 2: Add failing test for repair payload details**

In `tests/agent-v2-responses-runtime.spec.ts`, add a test near existing repair-loop tests:

```ts
test("AgentV2 runtime passes structured validation repair details back to the model", async () => {
  const seenInputs: unknown[] = []
  const client = fakeResponsesClientWithOutputs([
    terminalGeneralAdviceCall("call_1", {
      request_interpretation: requestInterpretation({
        primary_intent: "general_advice",
        product_request_kind: "category_education",
        routine_intent: "none",
        care_category: "none",
        requested_product_count: null,
        count_policy: "none",
        evidence_quote: "invented evidence",
      }),
    }),
    terminalGeneralAdviceCall("call_2", {
      request_interpretation: requestInterpretation({
        primary_intent: "general_advice",
        product_request_kind: "category_education",
        routine_intent: "none",
        care_category: "none",
        requested_product_count: null,
        count_policy: "none",
        evidence_quote: "Was hilft gegen Frizz bei meinem Haarprofil?",
      }),
    }),
  ])
  const originalCreate = client.responses.create
  client.responses.create = async (input: unknown) => {
    seenInputs.push(input)
    return originalCreate(input)
  }

  await runAgentV2ResponsesTurn({
    client,
    message: "Was hilft gegen Frizz bei meinem Haarprofil?",
    recentMessages: [],
    userContext: { hairProfile: null, routineInventory: [], sessionMemory: [] },
    tools: fakeAgentV2Tools(),
  })

  const repairInput = JSON.stringify(seenInputs[1])
  assert.match(repairInput, /request_interpretation_evidence/)
  assert.match(repairInput, /rejected_value/)
  assert.match(repairInput, /suggested_value/)
  assert.match(repairInput, /Was hilft gegen Frizz bei meinem Haarprofil/)
})
```

If helper names differ in this file, use the new/extended full-answer helper from Step 1.

Run:

```bash
node --import tsx --test tests/agent-v2-responses-runtime.spec.ts
```

Expected: fail because repair output strips the new fields.

- [ ] **Step 3: Preserve structured error fields in `buildTerminalValidationOutput`**

In `src/lib/agent-v2/runtime/responses-agent.ts`, replace the stripped error mapping with:

```ts
validation_errors: errors.map((error) => compactValidationErrorForRepair(error)),
```

Add helper:

```ts
function compactValidationErrorForRepair(error: AgentV2ValidationError): Record<string, unknown> {
  const output: Record<string, unknown> = {
    validator_id: error.validator_id,
    message: error.message,
    severity: error.severity,
  }
  if (error.path) output.path = error.path
  if (error.reason_code) output.reason_code = error.reason_code
  if (error.repair_hint) output.repair_hint = error.repair_hint
  if ("rejected_value" in error) output.rejected_value = compactRepairValue(error.rejected_value)
  if ("expected" in error) output.expected = compactRepairValue(error.expected)
  if ("suggested_value" in error) output.suggested_value = compactRepairValue(error.suggested_value)
  return output
}

function compactRepairValue(value: unknown): unknown {
  if (typeof value === "string") return value.length > 500 ? `${value.slice(0, 497)}...` : value
  if (typeof value === "number" || typeof value === "boolean" || value === null) return value
  if (Array.isArray(value)) {
    const scalars = value.filter(
      (item) =>
        typeof item === "string" ||
        typeof item === "number" ||
        typeof item === "boolean" ||
        item === null,
    )
    return scalars.slice(0, 12)
  }
  return undefined
}
```

- [ ] **Step 4: Make repair instruction actionable**

In `buildRepairInstruction`, append:

```ts
"When a validation error includes suggested_value, use it exactly unless it conflicts with the latest user message or returned tool outputs. When repair_hint is present, follow it before changing unrelated fields."
```

If `buildRepairInstruction` serializes the validation errors separately from `buildTerminalValidationOutput`, use the same `compactValidationErrorForRepair` shape there too. The repair model should see the same structured fields in the tool-output payload and the human-readable repair instruction.

- [ ] **Step 5: Verify runtime repair payload test**

Run:

```bash
node --import tsx --test tests/agent-v2-responses-runtime.spec.ts
```

Expected: pass.

### Task 4: Add Repair-Once-Then-Sanitize For Evidence Metadata

**Files:**
- Modify: `src/lib/agent-v2/validation/final-answer-validator.ts`
- Modify: `src/lib/agent-v2/runtime/responses-agent.ts`
- Modify: `tests/agent-v2-final-answer-validator.spec.ts`
- Modify: `tests/agent-v2-responses-runtime.spec.ts`

- [ ] **Step 1: Add failing sanitizer helper tests**

In `tests/agent-v2-final-answer-validator.spec.ts`, add:

```ts
test("validator sanitizer can repair evidence quote metadata only", () => {
  const answer = {
    ...baseAnswer,
    request_interpretation: requestInterpretation({
      evidence_quote: "invented evidence",
    }),
  }
  const result = validateAgentV2FinalAnswer(answer, {
    ...baseValidationContext,
    latestUserMessage: "Was hilft gegen Frizz bei meinem Haarprofil?",
    recentEvidenceText: "Was hilft gegen Frizz bei meinem Haarprofil?",
  })

  const sanitized = sanitizeRepairableEvidenceQuote(answer, result.errors)

  assert.ok(sanitized)
  assert.equal(
    sanitized.answer.request_interpretation.evidence_quote,
    "Was hilft gegen Frizz bei meinem Haarprofil?",
  )
  assert.equal(sanitized.warning.validator_id, "request_interpretation_evidence_sanitized")
})

test("validator sanitizer refuses mixed or non-evidence failures", () => {
  const answer = {
    ...baseAnswer,
    request_interpretation: requestInterpretation({
      evidence_quote: "invented evidence",
    }),
    tool_grounding: {
      ...baseAnswer.tool_grounding,
      product_ids: ["unknown_product"],
    },
  }
  const result = validateAgentV2FinalAnswer(answer, {
    ...baseValidationContext,
    latestUserMessage: "Was hilft gegen Frizz bei meinem Haarprofil?",
    recentEvidenceText: "Was hilft gegen Frizz bei meinem Haarprofil?",
  })

  assert.equal(sanitizeRepairableEvidenceQuote(answer, result.errors), null)
})
```

Run:

```bash
node --import tsx --test tests/agent-v2-final-answer-validator.spec.ts
```

Expected: fail until the helper is exported and implemented.

- [ ] **Step 2: Implement sanitizer helper**

In `src/lib/agent-v2/validation/final-answer-validator.ts`, export:

```ts
export function sanitizeRepairableEvidenceQuote(
  answer: AgentV2TerminalAnswer,
  errors: readonly AgentV2ValidationError[],
): { answer: AgentV2TerminalAnswer; warning: AgentV2ValidationError } | null {
  const blockingErrors = errors.filter((error) => error.severity !== "warn")
  if (blockingErrors.length === 0) return null
  if (
    !blockingErrors.every(
      (error) =>
        error.validator_id === "request_interpretation_evidence" &&
        error.path?.join(".") === "request_interpretation.evidence_quote" &&
        typeof error.suggested_value === "string" &&
        error.suggested_value.trim().length > 0,
    )
  ) {
    return null
  }

  const suggested = String(blockingErrors[0].suggested_value).trim()
  const sanitizedAnswer: AgentV2TerminalAnswer = AgentV2TerminalAnswerSchema.parse({
    ...answer,
    request_interpretation: {
      ...answer.request_interpretation,
      evidence_quote: suggested,
    },
  })

  return {
    answer: sanitizedAnswer,
    warning: {
      validator_id: "request_interpretation_evidence_sanitized",
      message:
        "request_interpretation.evidence_quote was sanitized after model repair failed for evidence metadata only.",
      severity: "warn",
      path: ["request_interpretation", "evidence_quote"],
      rejected_value: answer.request_interpretation.evidence_quote,
      suggested_value: suggested,
    },
  }
}
```

- [ ] **Step 3: Add failing runtime sanitize-after-repair test**

In `tests/agent-v2-responses-runtime.spec.ts`, add:

```ts
test("AgentV2 runtime sanitizes evidence metadata after one failed repair", async () => {
  const badEvidenceAnswer = terminalGeneralAdviceCall("call_1", {
    request_interpretation: requestInterpretation({
      primary_intent: "general_advice",
      product_request_kind: "category_education",
      routine_intent: "none",
      care_category: "none",
      requested_product_count: null,
      count_policy: "none",
      evidence_quote: "invented evidence",
    }),
    payload: {
      user_facing_answer_de:
        "Gegen Frizz hilft bei deinem Profil vor allem leichte Pflege in den Längen.",
      category_or_topic: "frizz",
      key_points_de: ["Leichte Pflege in den Längen reduziert Reibung."],
      next_step_offer_de: null,
    },
  })
  const client = fakeResponsesClientWithOutputs([badEvidenceAnswer, badEvidenceAnswer])

  const result = await runAgentV2ResponsesTurn({
    client,
    message: "Was hilft gegen Frizz bei meinem Haarprofil?",
    recentMessages: [],
    userContext: { hairProfile: null, routineInventory: [], sessionMemory: [] },
    tools: fakeAgentV2Tools(),
  })

  assert.equal(result.final_answer.answer_mode, "general_advice")
  assert.match(result.final_answer.payload.user_facing_answer_de, /Gegen Frizz/)
  assert.equal(
    result.final_answer.request_interpretation.evidence_quote,
    "Was hilft gegen Frizz bei meinem Haarprofil?",
  )
  assert.equal(result.trace.failure_stage, null)
  assert.deepEqual(result.trace.validation_errors, [])
  assert.ok(
    result.trace.validation_warnings.some(
      (warning) => warning.validator_id === "request_interpretation_evidence_sanitized",
    ),
  )
})
```

Run:

```bash
node --import tsx --test tests/agent-v2-responses-runtime.spec.ts
```

Expected: fail until runtime uses the sanitizer.

- [ ] **Step 4: Wire sanitizer into runtime after one failed repair**

In `src/lib/agent-v2/runtime/responses-agent.ts`:

1. Import `sanitizeRepairableEvidenceQuote`.
2. In the `if (repairUsed || policy.max_repair_turns === 0)` branch after validation fails, before setting `trace.failure_stage = "repair_failed"`, attempt sanitization only when `repairUsed` and `validation.sanitized_answer` exists:

```ts
if (repairUsed && validation.sanitized_answer) {
  const evidenceSanitization = sanitizeRepairableEvidenceQuote(
    validation.sanitized_answer,
    validation.errors,
  )
}
```

Then, inside that guarded branch:

```ts
if (evidenceSanitization) {
  const sanitizedValidation = validateAgentV2FinalAnswer(
    evidenceSanitization.answer,
    buildCurrentValidationContext(),
  )
  if (sanitizedValidation.ok) {
    trace.validation_errors = []
    trace.validation_warnings = [
      ...sanitizedValidation.warnings,
      evidenceSanitization.warning,
    ]
    trace.dropped_session_memory_writes = sanitizedValidation.dropped_session_memory_writes
    return completeWithAnswer(
      sanitizedValidation.sanitized_answer ?? evidenceSanitization.answer,
      trace,
    )
  }
}
```

3. Keep all existing fallback behavior when `validation.sanitized_answer` is null, sanitizer returns null, or the sanitized answer still fails validation.

This guard is not optional: parsing raw `terminal.value` here can turn repeated schema-invalid repair attempts into a production 500.

The sanitizer must not be used as a general answer rescue. It may preserve the visible answer only when the current validation result proves the parsed/sanitized answer has no remaining blocking errors except `request_interpretation_evidence` on `request_interpretation.evidence_quote`.

- [ ] **Step 5: Add runtime strictness regression**

Add a runtime test proving sanitization does not apply to mixed failures:

```ts
test("AgentV2 runtime does not sanitize mixed evidence and product grounding failures", async () => {
  const badAnswer = terminalGeneralAdviceCall("call_1", {
    request_interpretation: requestInterpretation({
      evidence_quote: "invented evidence",
    }),
    tool_grounding: {
      used_guidance_package_ids: requiredGuidanceForAnswer("general_advice", "none"),
      used_product_tool: false,
      used_routine_tool: false,
      product_ids: ["unknown_product"],
      routine_step_ids: [],
      hard_rule_ids: [],
    },
  })
  const client = fakeResponsesClientWithOutputs([badAnswer, badAnswer])

  const result = await runAgentV2ResponsesTurn({
    client,
    message: "Was hilft gegen Frizz bei meinem Haarprofil?",
    recentMessages: [],
    userContext: { hairProfile: null, routineInventory: [], sessionMemory: [] },
    tools: fakeAgentV2Tools(),
  })

  assert.equal(result.final_answer.answer_mode, "clarification")
  assert.equal(result.trace.failure_stage, "repair_failed")
})
```

Run:

```bash
node --import tsx --test tests/agent-v2-responses-runtime.spec.ts
```

Expected: pass.

### Task 5: Verification And Handoff

**Files:**
- No new production files unless earlier tasks show a helper extraction is required.

- [ ] **Step 1: Run focused validation and runtime suites**

Run:

```bash
node --import tsx --test tests/agent-v2-contracts.spec.ts
node --import tsx --test tests/agent-v2-final-answer-validator.spec.ts
node --import tsx --test tests/agent-v2-responses-runtime.spec.ts
```

Expected: all pass.

- [ ] **Step 2: Run broad AgentV2 suite**

Run:

```bash
npm run test:agent
```

Expected: all pass.

- [ ] **Step 3: Run type and lint checks**

Run:

```bash
npm run typecheck
npm run lint
git diff --check
```

Expected:
- `typecheck` passes.
- `lint` has no errors; known unrelated warnings may remain:
  - `src/components/layout/header.tsx` unused `Menu`
  - `src/components/ui/avatar.tsx` raw `<img>`
  - `src/lib/agent/orchestrator/model-client.ts` unused `AGENTIC_TOOL_LOOP_PROMPT`
  - `src/lib/routines/brush-tools.ts` unused `context`
- `git diff --check` passes.

- [ ] **Step 4: Run repo finish checks where available**

Run the project-standard finish checks if available in this worktree:

```bash
npm run ci:verify
npm run test:chat
```

If either script is unavailable or too environment-dependent, record the exact blocker and do not claim it passed.

- [ ] **Step 5: Run one local smoke check for the original failure**

Use an authenticated local chat user and send:

```text
Was hilft gegen Frizz bei meinem Haarprofil?
```

Expected:
- Assistant returns a substantive `general_advice` answer.
- No generic clarification fallback.
- Persisted trace has `agent_v2_trace.failure_stage: null`.
- Persisted trace has no blocking validation errors.

If local direct pipeline testing is used instead of browser testing, run a direct AgentV2 production-pipeline script with the same message and confirm:

```json
{
  "visibleFailure": false,
  "answerMode": "general_advice",
  "failureStage": null,
  "validationErrors": []
}
```

## Plan Self-Review

- Spec coverage: covered repair metadata shape, evidence validator relaxation, structured repair payload, repair-once-then-sanitize behavior, strict non-evidence boundaries, no-500 schema guard, runtime test helper prerequisite, and original Frizz verification.
- Placeholder scan: no `TBD`, no open implementation placeholders, no unspecified test steps.
- Scope check: plan intentionally does not audit/populate rich repair metadata for every validator; it creates the optional shape and implements the first high-value validator.
- Rollback story: revert this commit if sanitizer behavior is wrong. `AGENT_V2_MAX_REPAIR_TURNS=0` disables repair and should also prevent the sanitizer path because sanitization is guarded by `repairUsed`; this is a broad fallback, not a dedicated feature flag.

## Execution Handoff

Recommended next skill: `superpowers:subagent-driven-development`.

Because the branch already exists and this is a follow-up on PR #178, execution should stay in the current worktree unless the user explicitly asks for a separate worktree. Before execution, preserve or consciously replace the current uncommitted narrow Frizz patch so the final implementation does not accidentally duplicate it.
