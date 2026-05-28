# AgentV2 Routine-First Regression Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make AgentV2 routine-first for larger change requests while keeping placement/education answers non-mutating and graceful under repair failure.

**Architecture:** Tighten the invariant in three layers: guidance/tool descriptions steer the model, validator/runtime enforce the routine contract, and regression tests pin the six open cases. Existing AgentV2 tools stay intact; this is a routing/contract/fallback patch, not a new router.

**Tech Stack:** TypeScript, Node test runner with `tsx`, AgentV2 Responses runtime, Zod terminal contracts, guidance markdown/JSON packages, guidance regression fixture.

---

## Spec Link

- Approved design spec: `docs/superpowers/specs/2026-05-21-agent-v2-routine-first-regression-fixes-design.md`
- Failure ledger: `docs/agent-v2-guidance-migration/open-regression-failures.md`
- Latest raw report: `tmp/agent-v2-guidance-regression-2026-05-21T14-07-51-761Z.md`

## User Situation

Users ask Chaarlie to simplify, change, or lightly adjust their hair routine. Today AgentV2 sometimes answers those requests as loose category advice, sometimes over-calls routine tooling for placement-only questions, and sometimes returns internal repair fallback copy after a correct tool call fails validation.

## Promised End-State

- Larger change requests start from the user's routine.
- Placement/order questions stay explanatory unless the user asks to change routine state.
- Direct category mutations can target a category-specific layer when a routine inventory exists, while still preserving the baseline routine spine in the answer.
- Known-intent validation failures degrade to useful German advice instead of internal composition fallback.
- Fresh full guidance regression has zero fails for the six open ledger cases.

## Scope Boundaries

In scope:

- AgentV2 guidance and tool descriptions for routine-first change prompts.
- Validator rules for routine tool requirements, routine layer progression, and placement-only answers.
- Runtime fallback behavior for known-intent repair failures.
- Manual regression fixture expectations and targeted unit tests.
- Updating the open-failure ledger after verification.

Out of scope:

- Product catalog seeding.
- Conditioner protein/moisture product gating.
- Scalp safety classifier changes.
- New AgentV2 tools or a new route/router.
- UI changes.

## Target File Map

Guidance and tool steering:

- Modify: `data/agent-v2/guidance/base/routine-building.md`
- Modify: `data/agent-v2/guidance/base/routine-building.json`
- Modify: `data/agent-v2/guidance/base/general-advice.md`
- Modify: `data/agent-v2/guidance/base/general-advice.json`
- Modify: `data/agent-v2/guidance/categories/deep-cleansing-shampoo.md`
- Modify: `data/agent-v2/guidance/categories/deep-cleansing-shampoo.json`
- Modify: `data/agent-v2/guidance/categories/dry-shampoo.md`
- Modify: `data/agent-v2/guidance/categories/dry-shampoo.json`
- Modify: `data/agent-v2/guidance/categories/oil.md`
- Modify: `data/agent-v2/guidance/categories/oil.json`
- Modify: `data/agent-v2/guidance/categories/mask.md`
- Modify: `data/agent-v2/guidance/categories/mask.json`
- Modify: `src/lib/agent-v2/tools/tool-definitions.ts`

Runtime and validation:

- Modify: `src/lib/agent-v2/validation/final-answer-validator.ts`
- Modify: `src/lib/agent-v2/runtime/responses-agent.ts`
- Modify: `src/lib/agent-v2/compare/run-agent-v2.ts` only if current routine inventory/layer context needs to be passed into validation traces.

Tests and eval docs:

- Modify: `tests/agent-v2-final-answer-validator.spec.ts`
- Modify: `tests/agent-v2-responses-runtime.spec.ts`
- Modify: `tests/agent-v2-manual-regression.spec.ts` only if fixture assertions need helper changes.
- Modify: `data/agent-v2/evals/guidance-migration-regression.json`
- Modify: `docs/agent-v2-guidance-migration/open-regression-failures.md`

## Task 1: Pin The Routine-First Regression Cases

**Files:**
- Modify: `data/agent-v2/evals/guidance-migration-regression.json`
- Modify: `tests/agent-v2-manual-regression.spec.ts` only if the current helper cannot assert the needed case shape

- [ ] **Step 1: Confirm the six ledger cases are present and named exactly**

Check that these fixture IDs exist:

```json
[
  "routine-basics-build",
  "deep-cleansing-routine-mutation",
  "dry-shampoo-routine-placement",
  "oil-routine-placement",
  "frizz-color-damage-routine",
  "routine-then-mask-oil-choice"
]
```

Run:

```bash
node - <<'NODE'
const fixture = require('./data/agent-v2/evals/guidance-migration-regression.json')
const ids = new Set(fixture.map((entry) => entry.id))
for (const id of [
  'routine-basics-build',
  'deep-cleansing-routine-mutation',
  'dry-shampoo-routine-placement',
  'oil-routine-placement',
  'frizz-color-damage-routine',
  'routine-then-mask-oil-choice',
]) console.log(id, ids.has(id) ? 'present' : 'MISSING')
NODE
```

Expected: all six lines end with `present`.

- [ ] **Step 2: Tighten fixture expectations to match the approved behavior**

Ensure these case expectations are present:

```json
{
  "id": "frizz-color-damage-routine",
  "expected_tools": ["load_advisor_guidance", "build_or_fix_routine"],
  "expected_guidance": ["base.routine_building.v1"],
  "quality_criteria": [
    "builds or fixes routine from basics before extras",
    "surfaces profile effect from color treatment, dryness, and frizz",
    "does not overload the user with too many steps"
  ]
}
```

```json
{
  "id": "routine-then-mask-oil-choice",
  "expected_tools": ["load_advisor_guidance", "build_or_fix_routine"],
  "expected_guidance": ["base.routine_building.v1", "base.general_advice.v1"],
  "quality_criteria": [
    "understands the second turn in context of the routine/lightness goal",
    "compares mask and oil without forcing product cards",
    "keeps profile effect visible",
    "chooses mask as the main add-on and frames oil only as a tiny finish"
  ]
}
```

For placement cases, keep expected tools guidance-only:

```json
{
  "id": "oil-routine-placement",
  "expected_tools": ["load_advisor_guidance"],
  "expected_guidance": ["base.general_advice.v1", "category.oil.v1"]
}
```

- [ ] **Step 3: Run fixture shape tests**

Run:

```bash
npx tsx --test tests/agent-v2-manual-regression.spec.ts
```

Expected: PASS. If it fails, fix only fixture-shape issues in the edited cases.

## Task 2: Guidance And Tool Description Steering

**Files:**
- Modify: `data/agent-v2/guidance/base/routine-building.md`
- Modify: `data/agent-v2/guidance/base/routine-building.json`
- Modify: `data/agent-v2/guidance/base/general-advice.md`
- Modify: `data/agent-v2/guidance/base/general-advice.json`
- Modify: `data/agent-v2/guidance/categories/deep-cleansing-shampoo.md/.json`
- Modify: `data/agent-v2/guidance/categories/dry-shampoo.md/.json`
- Modify: `data/agent-v2/guidance/categories/oil.md/.json`
- Modify: `data/agent-v2/guidance/categories/mask.md/.json`
- Modify: `src/lib/agent-v2/tools/tool-definitions.ts`
- Test: `tests/agent-v2-guidance-compiler.spec.ts`
- Test: `tests/agent-v2-responses-runtime.spec.ts`

- [ ] **Step 1: Add the routine-first change rule to base routine guidance**

In `data/agent-v2/guidance/base/routine-building.md`, add a section under required grounding:

```markdown
## Routine-First Change Requests

Use `build_or_fix_routine` when the user asks to change, simplify, lighten, extend, add to, remove from, or rebalance their routine. This includes broad German phrasing such as `was soll ich aendern`, `Routine einfacher machen`, `keine schwere Routine`, `was soll ich ergaenzen`, `was soll ich weglassen`, and `fuege ... ein`.

For these requests, do not hand-roll a multi-step routine in general advice. Let the routine tool decide visible steps, step IDs, routine layer, next layer options, and blockers.

Broad education remains general advice when the user asks what something is, why it helps, or how a category works without asking to change routine state.
```

- [ ] **Step 2: Add matching JSON rule and grounding metadata**

In `data/agent-v2/guidance/base/routine-building.json`, add or update one hard rule and one required grounding entry:

```json
{
  "rule_id": "routine.change_requests_require_tool",
  "message": "Use build_or_fix_routine before answering requests to change, simplify, lighten, extend, add to, remove from, or rebalance the user's routine."
}
```

```json
{
  "grounding_id": "routine.change_requests_build_or_fix",
  "tool": "build_or_fix_routine",
  "when": "User asks to change, simplify, lighten, extend, add to, remove from, or rebalance routine state."
}
```

Keep the JSON shape consistent with the existing `hard_rules` and `required_grounding` arrays.

- [ ] **Step 3: Add the advice boundary to general advice**

In `data/agent-v2/guidance/base/general-advice.md`, add:

```markdown
## Routine Boundary

General advice may explain a category, compare categories, or answer placement/order questions. It must not present a changed multi-step user routine when the user asked to change, simplify, lighten, extend, add to, remove from, or rebalance their routine. Use `build_or_fix_routine` for that.
```

In `data/agent-v2/guidance/base/general-advice.json`, add a matching soft rubric:

```json
{
  "rubric_id": "general_advice.routine_boundary",
  "message": "Category education and placement can stay general advice, but changed multi-step routines belong to build_or_fix_routine."
}
```

- [ ] **Step 4: Preserve placement-only rules for dry shampoo and oil**

Confirm or tighten existing guidance:

```markdown
Placement/order questions such as `Wo kommt Trockenshampoo in der Routine hin?` or `Kommt Oel vor oder nach Leave-in?` are routine_explanation, not routine_mutation, unless the user asks to add, remove, replace, or change saved/current routine state.
```

Keep matching JSON rules in `category.dry_shampoo.routine_explanation_vs_mutation` and `category.oil.routine_explanation_vs_mutation`.

- [ ] **Step 5: Add category mutation baseline guidance for deep cleansing**

In `data/agent-v2/guidance/categories/deep-cleansing-shampoo.md`, update the routine mutation hook:

```markdown
If the user asks to add a reset step to an existing/current routine, use `build_or_fix_routine`. The final answer may target the reset/problem layer, but it must keep the baseline visible: Shampoo and Conditioner remain the routine spine; Reset is occasional and not a daily replacement.
```

In JSON, add or update:

```json
{
  "rule_id": "category.deep_cleansing.mutation_preserve_baseline",
  "message": "When adding a reset step to an existing/current routine, preserve the Shampoo + Conditioner baseline in the answer and frame reset as occasional."
}
```

- [ ] **Step 6: Add mask-over-oil guidance for lightweight routine follow-ups**

In `data/agent-v2/guidance/categories/mask.md`, add:

```markdown
For dry/frizzy lengths inside a lightweight-routine decision, a light occasional mask is usually the main add-on. Oil may be mentioned only as a tiny finish for tips/gloss, not as the primary care step for dryness.
```

In `data/agent-v2/guidance/categories/oil.md`, add the mirror boundary:

```markdown
When the user asks `Maske oder Oel?` after saying the lengths are dry/frizzy and the routine should stay light, do not make oil the main care add-on. Prefer a light occasional mask; oil is only a tiny finish if needed.
```

- [ ] **Step 7: Tighten the build_or_fix_routine tool description**

In `src/lib/agent-v2/tools/tool-definitions.ts`, update the `build_or_fix_routine` description to include routine-first change wording while preserving placement-only exclusions:

```ts
description:
  "Build or adjust a saved/current staged routine using the existing deterministic routine planner. Call this for requests to change, simplify, lighten, extend, add to, remove from, or rebalance routine state, including 'was soll ich aendern', 'Routine einfacher machen', 'keine schwere Routine', and 'fuege ... ein'. Do not call this for general placement, order, or usage questions such as 'where does this fit in my routine?' unless the user asks to add, remove, replace, or change routine state; answer those as routine_explanation with routine_intent none.",
```

- [ ] **Step 8: Run guidance/compiler tests**

Run:

```bash
npx tsx --test tests/agent-v2-guidance-compiler.spec.ts tests/agent-v2-contracts.spec.ts tests/agent-v2-responses-runtime.spec.ts
```

Expected: PASS. Fix schema or snapshot-style failures in the edited guidance only.

## Task 3: Validator Routine Contract

**Files:**
- Modify: `src/lib/agent-v2/validation/final-answer-validator.ts`
- Test: `tests/agent-v2-final-answer-validator.spec.ts`

- [ ] **Step 1: Add failing validator test for direct category mutation with existing routine inventory**

Add a test showing that a first routine answer can target `problems` when the context has a current routine baseline.

Use the existing helper shapes in `tests/agent-v2-final-answer-validator.spec.ts`. The new test should look like:

```ts
test("validator allows category mutation beyond basics when current routine inventory exists", () => {
  const result = validateAgentV2FinalAnswer(
    {
      ...baseAnswer,
      answer_mode: "routine",
      request_interpretation: requestInterpretation({
        primary_intent: "routine_mutation",
        routine_intent: "modify",
        product_request_kind: "none",
        care_category: "deep_cleansing_shampoo",
        evidence_quote: "Reset-Schritt",
      }),
      tool_grounding: {
        ...baseAnswer.tool_grounding,
        used_guidance_package_ids: requiredGuidanceForAnswer("routine", "deep_cleansing_shampoo"),
        used_product_tool: false,
        used_routine_tool: true,
        product_ids: [],
        routine_step_ids: ["base-shampoo", "base-conditioner", "occasional-reset"],
        hard_rule_ids: [],
      },
      routine_context: {
        active: true,
        routine_layer: "problems",
        step_id: null,
        category: "deep_cleansing_shampoo",
        return_path: ["routine"],
      },
      payload: {
        user_facing_answer_de:
          "Deine Basis bleibt Shampoo + Conditioner. Den Reset wuerde ich nur gelegentlich einbauen.",
        routine_layer: "problems",
        visible_steps: [
          { step_id: "base-shampoo", label_de: "Shampoo", action_de: "Ansatz reinigen.", frequency_de: null, reason_de: "Basis." },
          { step_id: "base-conditioner", label_de: "Conditioner", action_de: "Laengen pflegen.", frequency_de: null, reason_de: "Basis." },
          { step_id: "occasional-reset", label_de: "Reset", action_de: "Nur bei Build-up.", frequency_de: "gelegentlich", reason_de: "Rueckstaende." },
        ],
        next_layer_options: [],
        next_step_offer_de: null,
      },
    },
    {
      ...baseValidationContext,
      latestUserMessage: "Fuege einen Reset-Schritt in meine aktuelle Routine ein.",
      recentEvidenceText: "Fuege einen Reset-Schritt in meine aktuelle Routine ein.",
      toolCallHistory: [
        routineToolCall({
          requested_layer: "problems",
          requested_category: "deep_cleansing_shampoo",
          routine_intent: "modify",
          mutation_kind: "add_step",
          evidence_quote: "Reset-Schritt",
        }),
      ],
      routineProjections: [
        {
          routine_layer: "problems",
          visible_steps: [
            { step_id: "base-shampoo" },
            { step_id: "base-conditioner" },
            { step_id: "occasional-reset" },
          ],
        },
      ],
      currentRoutineLayer: null,
      hasCurrentRoutineInventory: true,
    },
  )

  assert.equal(result.ok, true)
})
```

If `hasCurrentRoutineInventory` does not exist yet, add it to the validation context type in the implementation step.

- [ ] **Step 2: Add failing validator test for hand-rolled routine change advice**

Add a test where `general_advice` uses routine-change wording without routine grounding:

```ts
test("validator blocks general advice that hand-rolls routine changes for change requests", () => {
  const result = validateAgentV2FinalAnswer(generalAdviceAnswerForRoutineChange(), {
    ...baseValidationContext,
    latestUserMessage: "Ich habe coloriertes, trockenes Haar und Frizz. Was soll ich aendern?",
    recentEvidenceText: "Was soll ich aendern?",
    toolCallHistory: [guidanceToolCall()],
    routineProjections: [],
  })

  assert.equal(result.ok, false)
  assert.ok(result.errors.some((error) => error.validator_id === "routine_tool_required"))
})
```

Implement `generalAdviceAnswerForRoutineChange()` in the test file with visible prose that recommends changing Conditioner, adding Leave-in, adding Mask, and using Oil. The point is to block multi-step routine changes without `build_or_fix_routine`.

- [ ] **Step 3: Extend the validation context**

In `src/lib/agent-v2/validation/final-answer-validator.ts`, extend `AgentV2FinalAnswerValidationContext`:

```ts
hasCurrentRoutineInventory?: boolean
```

Default absent values to `false`.

- [ ] **Step 4: Adjust routine layer progression**

Change `validateRoutineLayerProgression` so first category-specific mutations are allowed when either `currentRoutineLayer` exists, active routine thread context exists, or `hasCurrentRoutineInventory` is true.

Implementation shape:

```ts
const hasRoutineBaseline =
  Boolean(context.currentRoutineLayer) ||
  context.routineThreadContext?.active === true ||
  context.hasCurrentRoutineInventory === true

if (!hasRoutineBaseline && requestedLayer !== "basics") {
  // existing routine_layer_progression error
}
```

Keep the existing allowed-next-layer logic for active/current layers.

- [ ] **Step 5: Add routine-change detection for general advice**

Add a small helper in the validator:

```ts
function isRoutineChangeRequest(text: string): boolean {
  const normalized = text.toLocaleLowerCase("de-DE")
  return (
    /\b(routine|ablauf)\b.*\b(einfacher|leichter|aendern|ändern|umstellen|ergaenzen|ergänzen|weglassen|reduzieren)\b/.test(normalized) ||
    /\b(keine schwere routine|nicht so schwere routine|leichte routine)\b/.test(normalized) ||
    /\b(was soll ich|was sollte ich).*\b(aendern|ändern|ergaenzen|ergänzen|weglassen)\b/.test(normalized) ||
    /\b(fuege|füge|nimm|baue).*\b(routine|schritt)\b/.test(normalized)
  )
}
```

Use it only to require routine tooling when the answer itself recommends changed routine steps or when `request_interpretation.routine_intent` is create/modify/remove/replace. Do not block pure education like "Was hilft gegen Frizz?".

- [ ] **Step 6: Preserve placement-only answers**

Add or keep validator coverage that `general_advice` with `primary_intent: routine_explanation`, `routine_intent: none`, and no routine step IDs passes for:

```ts
"Wo kommt Trockenshampoo in der Routine hin?"
"Kommt Oel vor oder nach Leave-in?"
```

- [ ] **Step 7: Run validator tests**

Run:

```bash
npx tsx --test tests/agent-v2-final-answer-validator.spec.ts
```

Expected: PASS.

## Task 4: Runtime Known-Intent Fallback

**Files:**
- Modify: `src/lib/agent-v2/runtime/responses-agent.ts`
- Test: `tests/agent-v2-responses-runtime.spec.ts`

- [ ] **Step 1: Add failing runtime test for known routine mutation repair failure**

Add a test where the model calls `load_advisor_guidance`, calls `build_or_fix_routine`, then repeatedly submits an invalid routine terminal. Expected final answer must not contain composition fallback copy.

Test skeleton:

```ts
test("AgentV2 runtime degrades known routine mutation repair failure into useful advice", async () => {
  const result = await runAgentV2ResponsesTurn({
    client: fakeResponsesClientWithOutputs([
      functionCall("call_1", "load_advisor_guidance", {
        answer_mode_hint: "routine",
        categories: ["deep_cleansing_shampoo"],
        routine_layer: "problems",
        safety_mode: "normal",
      }),
      functionCall("call_2", "build_or_fix_routine", {
        objective: "fix_routine",
        requested_layer: "problems",
        requested_category: "deep_cleansing_shampoo",
        reason: "User asks to add a reset step.",
        routine_intent: "modify",
        mutation_kind: "add_step",
        evidence_quote: "Reset-Schritt",
      }),
      invalidRoutineTerminal("call_3"),
      invalidRoutineTerminal("call_4"),
    ]),
    message: "Fuege einen Reset-Schritt in meine aktuelle Routine ein.",
    recentMessages: [],
    userContext: {
      hairProfile: null,
      routineInventory: [
        { category: "shampoo", product_name: "Mildes Shampoo" },
        { category: "conditioner", product_name: "Leichte Spuelung" },
      ],
      sessionMemory: [],
    },
    tools: fakeAgentV2Tools(),
  })

  assert.equal(result.trace.failure_stage, "repair_failed")
  assert.doesNotMatch(result.final_answer.payload.user_facing_answer_de, /nicht sauber zusammensetzen|Formulier es bitte/)
  assert.match(result.final_answer.payload.user_facing_answer_de, /Reset|Shampoo|Conditioner/)
})
```

Use existing helper patterns in the file for fake responses and terminal answers.

- [ ] **Step 2: Add a known-intent fallback builder**

In `responses-agent.ts`, add a helper near the existing fallback builders:

```ts
function buildKnownIntentFallbackAnswer(params: {
  reason: AgentV2FallbackReason
  message: string
  safetyMode: AgentV2SafetyMode
  routineThreadContext: AgentV2RoutineThreadContext | null
  trace: AgentV2Trace
}): AgentV2TerminalAnswer | null {
  const latestRoutineCall = [...params.trace.tool_calls]
    .reverse()
    .find((call) => call.name === "build_or_fix_routine")

  if (latestRoutineCall) {
    return buildRoutineKnownIntentFallback({
      message: params.message,
      routineThreadContext: params.routineThreadContext,
      routineArgs: latestRoutineCall.arguments ?? {},
    })
  }

  return null
}
```

Keep the helper narrow: routine known-intent fallback first. Do not redesign product/safety fallbacks in this task unless tests already require it.

- [ ] **Step 3: Add routine degraded fallback copy**

Implement `buildRoutineKnownIntentFallback` as a `general_advice` answer that uses the known routine tool args. For `requested_category: "deep_cleansing_shampoo"`, use German copy like:

```ts
const resetCopy =
  "Ich wuerde den Reset nicht als taeglichen Schritt einbauen. Deine Basis bleibt Shampoo fuer Kopfhaut/Ansatz und Conditioner fuer Laengen und Spitzen. Ein Tiefenreinigungsshampoo passt nur gelegentlich, wenn sich Build-up oder Rueckstaende zeigen; danach die Laengen wieder mit Conditioner pflegen."
```

For non-reset routine calls, use a generic routine-safe fallback:

```ts
const genericRoutineCopy =
  "Ich wuerde die Routine nicht groesser machen als noetig: erst Shampoo fuer die Kopfhaut, Conditioner fuer Laengen und Spitzen, und nur einen passenden Zusatz, wenn dein Ziel damit klar besser abgedeckt wird."
```

Do not claim a saved routine changed when the final terminal failed. Phrase as recommendation, not "erledigt".

- [ ] **Step 4: Use the known-intent fallback before generic fallback**

In both repair-failed fallback paths, before `buildFallbackAnswer(...)`, call:

```ts
const knownIntentFallback = buildKnownIntentFallbackAnswer({
  reason: selectFallbackReason(validation.errors, safetyMode, routineThreadContext),
  message: params.message,
  safetyMode,
  routineThreadContext,
  trace,
})
if (knownIntentFallback) return completeWithAnswer(knownIntentFallback, trace)
```

Preserve trace validation errors and `failure_stage` so debugging still sees the root problem.

- [ ] **Step 5: Run runtime tests**

Run:

```bash
npx tsx --test tests/agent-v2-responses-runtime.spec.ts
```

Expected: PASS.

## Task 5: Compare Runner Passes Routine Inventory Baseline

**Files:**
- Modify: `src/lib/agent-v2/compare/run-agent-v2.ts`
- Modify: `src/lib/agent-v2/runtime/responses-agent.ts` if runtime validation context also needs the flag
- Test: `tests/agent-v2-compare-runner.spec.ts` or `tests/agent-v2-responses-runtime.spec.ts`

- [ ] **Step 1: Trace where validation context is built**

Find the validation call:

```bash
rg -n "validateAgentV2FinalAnswer\\(" src/lib/agent-v2
```

Expected: runtime validation is in `src/lib/agent-v2/runtime/responses-agent.ts`.

- [ ] **Step 2: Pass `hasCurrentRoutineInventory` into validation**

When calling `validateAgentV2FinalAnswer`, set:

```ts
hasCurrentRoutineInventory: (params.userContext.routineInventory?.length ?? 0) > 0,
```

Use the actual runtime parameter path if it differs. The value should be true for compare scenarios seeded with Shampoo + Conditioner.

- [ ] **Step 3: Add a test or extend the Task 3 validator test**

If no compare-runner unit test can cheaply exercise this, keep this covered through runtime tests and targeted regression. Do not add a brittle OpenAI-dependent unit test.

## Task 6: Full Regression And Ledger Update

**Files:**
- Modify: `docs/agent-v2-guidance-migration/open-regression-failures.md`
- Generated evidence: `tmp/agent-v2-guidance-regression-*.md`
- Generated evidence: `tmp/agent-v2-guidance-regression-*.json`

- [ ] **Step 1: Run focused unit tests**

Run:

```bash
npx tsx --test \
  tests/agent-v2-final-answer-validator.spec.ts \
  tests/agent-v2-responses-runtime.spec.ts \
  tests/agent-v2-guidance-compiler.spec.ts \
  tests/agent-v2-contracts.spec.ts \
  tests/agent-v2-manual-regression.spec.ts
```

Expected: PASS.

- [ ] **Step 2: Run full guidance regression**

Run:

```bash
npx tsx scripts/agent-v2/run-guidance-regression.ts
```

Expected: fresh report in `tmp/agent-v2-guidance-regression-*.md` with zero failures for:

```text
routine-basics-build
deep-cleansing-routine-mutation
dry-shampoo-routine-placement
oil-routine-placement
frizz-color-damage-routine
routine-then-mask-oil-choice
```

- [ ] **Step 3: Manually inspect the six answers**

Acceptance checklist:

```text
routine-basics-build: routine tool used; lean Shampoo + Conditioner spine visible.
deep-cleansing-routine-mutation: no internal fallback; baseline plus occasional Reset visible.
dry-shampoo-routine-placement: no routine tool; answer says between wash days, not a cleanse replacement.
oil-routine-placement: no routine tool; Leave-in first, oil after; tiny amount warning.
frizz-color-damage-routine: routine tool used; not overloaded; change starts from routine.
routine-then-mask-oil-choice: routine context active; Maske is main add-on; oil only tiny finish.
```

- [ ] **Step 4: Update the open-failure ledger**

In `docs/agent-v2-guidance-migration/open-regression-failures.md`, add a new section:

```markdown
## Routine-First Patch Verification - 2026-05-21

Source: the fresh `tmp/agent-v2-guidance-regression-YYYY-MM-DDTHH-MM-SS-sssZ.md` report generated in Step 2.

Result:

- `routine-basics-build`: record pass/review/fail plus whether `build_or_fix_routine` was called.
- `deep-cleansing-routine-mutation`: record pass/review/fail plus whether the answer preserved baseline + occasional Reset without fallback copy.
- `dry-shampoo-routine-placement`: record pass/review/fail plus whether no routine tool was called.
- `oil-routine-placement`: record pass/review/fail plus whether no routine tool was called.
- `frizz-color-damage-routine`: record pass/review/fail plus whether `build_or_fix_routine` was called.
- `routine-then-mask-oil-choice`: record pass/review/fail plus whether the follow-up chose Maske as main add-on.

Remaining open failures:

- List the exact remaining failure IDs from the fresh report, or write `none`.
```

Use the actual fresh report path and actual case evidence before committing.

- [ ] **Step 5: Run final hygiene checks**

Run:

```bash
git diff --check
npx tsc --noEmit
```

Expected: both pass. If `tsc --noEmit` is not the repo's normal typecheck command, use the nearest package script from `package.json`.

## Task 7: Ready Check Before Shipping

**Files:**
- No planned code files

- [ ] **Step 1: Run `ready-check`**

Because this touches recommendations, routine behavior, answer copy, and trust-facing fallback behavior, run the repo `ready-check` skill before any PR/ship handoff.

- [ ] **Step 2: Summarize risk**

In the final implementation handoff, include:

```text
Verified:
- unit tests:
- full guidance regression:
- manual six-case inspection:

Residual risk:
- model nondeterminism remains possible, but validator/runtime now enforce the routine-first invariant.
- known-intent fallback is intentionally conservative and does not claim saved routine mutation.
```

## Execution Handoff

After this plan is approved:

1. Run `branch-gate`.
2. Continue in a repo-local worktree based on the current migration branch or create a fresh worktree if the user wants isolation.
3. Use `superpowers:subagent-driven-development` by default because Tasks 2, 3/4, and 6 can be reviewed as separate work packets.
4. Use `superpowers:executing-plans` only if the user wants one tightly controlled inline implementation session.
