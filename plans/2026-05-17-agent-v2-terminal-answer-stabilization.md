# AgentV2 Terminal Answer Stabilization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` for implementation. Use TDD for contract, validator, runtime, and Compare Lab mapping changes. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make AgentV2's terminal answer contract honest and user-ready: `payload.user_facing_answer_de` is the complete German chat answer, structured fields mirror the visible answer, product cards reflect final surfaced products, safety fallbacks are useful, and routine follow-ups preserve enough state to work across turns.

**Architecture:** Keep AgentV2 as one Responses-based agent loop with no separate final renderer. The model owns semantic interpretation, tool choice, tool-result synthesis, and final prose. Code owns strict schemas, product/routine authority, safety/tool gates, consistency validators, bounded repair, Compare Lab traces, and friendly fallback selection.

**Tech Stack:** Next.js, TypeScript, OpenAI Responses API, strict function tools, Zod, Node test runner, Compare Lab.

---

**Spec lineage:**
- `docs/superpowers/specs/2026-05-14-agent-v2-context-and-contracts-design.md`
- `plans/2026-05-17-agent-v2-request-interpretation-rewrite.md`

**User situation:** Manual AgentV2 testing exposed that basic product/category interpretation is improving, but several wrapper and contract gaps make the agent look worse than it is:
- routine answers can contain good structured `visible_steps` while the visible answer only shows an intro sentence
- `matched_products` can show every `select_products` candidate instead of the final surfaced product IDs
- restricted scalp/symptom turns can call product tools first and then fail validation
- routine follow-ups like "erster Zusatz" do not receive enough structured prior routine state
- evidence quotes fail on harmless German quote marks
- repair failures collapse into one generic clarification

**Promised end-state:** Compare Lab displays the same complete German answer production would show. The final terminal answer is both readable and inspectable: user-visible products/steps/constraints appear in `user_facing_answer_de`, while structured fields support validation, cards, traces, routine state, and memory. Failures remain debuggable internally but produce plain, useful German fallbacks externally.

## Settled Decisions

- No separate final renderer for V0.
- AgentV2 is responsible for final synthesis after tool outputs.
- `submit_final_answer.payload.user_facing_answer_de` is the complete screen-ready German reply.
- Structured fields (`recommendations`, `visible_steps`, `blocking_constraints`, etc.) are support data and must mirror user-visible content.
- Add narrow presence-only consistency validation:
  - product recommendation prose must mention surfaced product names
  - routine prose must mention visible routine step labels
  - routine product deep-dive prose must mention surfaced product names when products are recommended
  - constraint-blocked prose must mention blocking constraints
- Incomplete prose triggers one terminal-only repair turn.
- Repairs should become rare through stronger terminal guidance.
- `select_products` is a candidate/grounding tool.
- final terminal product IDs and recommendation payload decide what was actually surfaced.
- Compare Lab `matched_products` derives from final surfaced product IDs, not every product returned by `select_products`.
- Safety split:
  - cosmetic scalp concern: product tools allowed with conservative caveats
  - restricted foreground symptoms: agent can answer, but no product-first recommendation/tool call
  - hard short-circuit: bypass model loop and return deterministic safety boundary
- Restricted foreground symptom replies should be safety-first and useful, not a generic clarification.
- Routine thread context should preserve structured visible steps for follow-up turns.
- Routine follow-up state is model-visible and validator-checked; no German phrase resolver for now.
- Evidence quotes are provenance-strict but formatting-chill.
- Internal validator/failure codes stay in trace/debug only.
- User-facing fallbacks are typed by failure family and written in plain German.

## Non-Goals

- Do not change production V1 chat behavior.
- Do not add a standalone renderer model call.
- Do not add a deterministic German intent router.
- Do not change recommendation ranking, product catalog data, or routine planner internals.
- Do not build durable routine memory beyond Compare Lab session state.
- Do not expose validator IDs to end users.
- Do not make prose quality a hard regex validator.
- Do not expand the model/tool family beyond the existing AgentV2 V0 surface.

## Target File Map

- Modify: `src/lib/agent-v2/contracts.ts`
  - Extend `AgentV2RoutineThreadContextSchema` with structured routine steps.
  - Reuse existing terminal answer payload schemas; do not add a renderer packet.
- Modify: `src/lib/agent-v2/runtime/responses-agent.ts`
  - Strengthen terminal guidance for complete `user_facing_answer_de`.
  - Disable or block product tools in restricted foreground symptom mode.
  - Add typed fallback builders and route repair failures to the right fallback family.
  - Keep hard short-circuit deterministic.
- Modify: `src/lib/agent-v2/validation/final-answer-validator.ts`
  - Add presence-only visible-content validators.
  - Relax evidence quote normalization for decorative punctuation while preserving provenance.
  - Check routine step IDs against active routine thread context as well as current routine tool projections.
  - Add validator IDs that repair can classify as terminal-only.
- Modify: `src/lib/agent-v2/compare/run-agent-v2.ts`
  - Derive `matched_products` from final surfaced product IDs.
  - Preserve structured routine thread state across turns.
  - Pass routine thread state into AgentV2 input.
  - Use rendered final `user_facing_answer_de` as the Compare Lab answer.
- Modify: `src/lib/agent-v2/tools/tool-definitions.ts`
  - Conditionally omit `select_products` from restricted foreground symptom turns, or enforce `tool_choice.allowed_tools` if keeping the same tool list for caching.
  - Update tool descriptions if needed to state safety/tool constraints.
- Modify: `data/agent-v2/guidance/base/answer-contract.*`
  - State that `user_facing_answer_de` is complete final prose.
  - State that structured fields are not separately rendered.
- Modify: `data/agent-v2/guidance/base/safety-boundaries.*`
  - Clarify cosmetic scalp vs restricted foreground symptoms vs hard short-circuit.
- Test: `tests/agent-v2-final-answer-validator.spec.ts`
- Test: `tests/agent-v2-responses-runtime.spec.ts`
- Test: `tests/agent-v2-compare-runner.spec.ts`
- Test: `tests/agent-v2-contracts.spec.ts`
- Optional Test: `tests/agent-v2-guidance-compiler.spec.ts`

## Task 1: Make Complete Prose A Contract

**Files:**
- Modify: `src/lib/agent-v2/validation/final-answer-validator.ts`
- Modify: `src/lib/agent-v2/runtime/responses-agent.ts`
- Modify: `data/agent-v2/guidance/base/answer-contract.*`
- Test: `tests/agent-v2-final-answer-validator.spec.ts`
- Test: `tests/agent-v2-responses-runtime.spec.ts`

- [ ] **Step 1: Add failing validator tests for incomplete routine prose**

Add tests that build a valid `routine` terminal answer whose `payload.visible_steps` include `Shampoo` and `Conditioner`, but whose `payload.user_facing_answer_de` only says:

```ts
"Klar — ich würde die Routine auf das Minimum reduzieren:"
```

Expected:

```ts
assert.equal(result.ok, false)
assert.ok(
  result.errors.some((error) => error.validator_id === "visible_payload_not_rendered"),
)
```

- [ ] **Step 2: Add failing validator tests for incomplete product prose**

Create a `product_recommendation` answer with two recommendations and valid product projections, but prose that mentions only the first product.

Expected:

```ts
assert.equal(result.ok, false)
assert.ok(
  result.errors.some((error) => error.validator_id === "visible_payload_not_rendered"),
)
```

- [ ] **Step 3: Add failing validator tests for incomplete routine deep-dive prose**

Create a `routine_product_deep_dive` answer with one recommendation in `payload.recommendations`, but prose that never mentions the product name.

Expected:

```ts
assert.equal(result.ok, false)
assert.ok(
  result.errors.some((error) => error.validator_id === "visible_payload_not_rendered"),
)
```

- [ ] **Step 4: Implement presence-only content checks**

Add a validator function after `validateModePayload` and before tool/product grounding checks:

```ts
function validateVisiblePayloadRendered(
  answer: AgentV2TerminalAnswer,
  context: AgentV2FinalAnswerValidationContext,
  errors: AgentV2ValidationError[],
): void
```

Rules:
- normalize prose with lowercase, diacritic removal, punctuation collapse
- for `routine`, require each `visible_steps[].label_de` to appear in `user_facing_answer_de`
- for `product_recommendation`, require each final recommended product name to appear in `user_facing_answer_de`
- for `routine_product_deep_dive`, require recommended product names when `recommendations.length > 0`
- for `constraint_blocked`, require each `blocking_constraints[]` string or a normalized meaningful substring to appear in prose
- do not judge prose quality, ordering, or exact wording

Use product names from selected product projections by resolving `payload.recommendations[].product_id`.

- [ ] **Step 5: Add repair classification**

Update `classifyRepairKind` in `src/lib/agent-v2/runtime/responses-agent.ts`:

```ts
if (validatorIds.has("visible_payload_not_rendered")) return "terminal_only"
```

Update repair guidance so the model sees the exact omitted labels/names from validator messages.

- [ ] **Step 6: Strengthen terminal guidance**

Update `buildTerminalPayloadFieldGuidance()` to include:

```txt
payload.user_facing_answer_de is the complete final German answer shown to the user.
Do not treat recommendations, visible_steps, usage_notes_de, or blocking_constraints as hidden content that the app will render later.
If a product, routine step, usage note, or blocking constraint is user-visible in payload fields, include it in user_facing_answer_de.
```

Update `data/agent-v2/guidance/base/answer-contract.*` with the same principle.

- [ ] **Step 7: Verify focused tests**

Run:

```bash
npm run test:agent -- tests/agent-v2-final-answer-validator.spec.ts tests/agent-v2-responses-runtime.spec.ts
```

Expected:
- all AgentV2 validator/runtime tests pass
- the new incomplete-prose fixtures fail before implementation and pass after implementation

## Task 2: Make Compare Lab Products Reflect Final Surfaced IDs

**Files:**
- Modify: `src/lib/agent-v2/compare/run-agent-v2.ts`
- Test: `tests/agent-v2-compare-runner.spec.ts`

- [ ] **Step 1: Add failing Compare runner test for exact two-product ask**

Create a fake AgentV2 final answer where:
- `select_products` projection contains 3 products
- final terminal `payload.recommendations` contains 2 product IDs
- final terminal `tool_grounding.product_ids` contains those same 2 IDs

Expected:

```ts
assert.equal(result.matched_products.length, 2)
assert.deepEqual(
  result.matched_products.map((product) => product.name),
  ["Pantene Miracles Bond Repair", "Syoss Intense Keratin"],
)
```

- [ ] **Step 2: Replace broad projection flattening with final-ID mapping**

Replace AgentV2's Compare Lab `normalizeMatchedProducts(selectedProductProjections)` usage with a function like:

```ts
function normalizeMatchedProductsForFinalAnswer(
  projections: ReturnType<typeof projectSelectProductsForAgentV2>[],
  answer: AgentV2TerminalAnswer,
): CompareRunResult["matched_products"]
```

Rules:
- collect surfaced IDs from `answer.payload.recommendations[].product_id` when present
- also include `answer.tool_grounding.product_ids`
- keep final answer order
- intersect surfaced IDs with products returned by `select_products`
- return no products for non-product modes unless final answer explicitly surfaced product IDs
- never show products that were only candidates but not surfaced

- [ ] **Step 3: Update turn-level and final result mapping**

Use `normalizeMatchedProductsForFinalAnswer(selectedProductProjections, result.final_answer)` for each turn and final result.

- [ ] **Step 4: Verify Compare tests**

Run:

```bash
npm run test:agent -- tests/agent-v2-compare-runner.spec.ts
```

Expected:
- two-product final answer returns two `matched_products`
- existing Compare runner tests still pass

## Task 3: Implement Three-Level Scalp Safety Tool Gating

**Files:**
- Modify: `src/lib/agent-v2/compare/run-agent-v2.ts`
- Modify: `src/lib/agent-v2/runtime/responses-agent.ts`
- Modify: `src/lib/agent-v2/tools/tool-definitions.ts`
- Modify: `data/agent-v2/guidance/base/safety-boundaries.*`
- Test: `tests/agent-v2-responses-runtime.spec.ts`
- Test: `tests/agent-v2-compare-runner.spec.ts`

- [ ] **Step 1: Add safety classification tests**

Test expected modes:

```ts
assert.equal(classifyAgentV2SafetyMode("Ich habe empfindliche Kopfhaut und suche ein mildes Shampoo."), "normal")
assert.equal(classifyAgentV2SafetyMode("Meine Kopfhaut juckt und ist gerötet, welches Shampoo soll ich nehmen?"), "restricted")
assert.equal(classifyAgentV2SafetyMode("Meine Kopfhaut blutet und brennt stark."), "hard_short_circuit")
```

- [ ] **Step 2: Refine safety classification**

Keep current hard red flags. Refine restricted mode to require foreground symptom wording such as:
- `juckt` plus `gerötet` / `rot` / `brennt` / `wund`
- `schmerzt`, `nässen`, `Ausschlag`, `offene Stelle`
- hair-loss red flags not severe enough for hard short-circuit

Keep cosmetic/profile wording normal:
- `empfindliche Kopfhaut`
- `manchmal juckend`
- `gereizte Kopfhaut` without acute/severe foreground symptoms
- signup/profile-derived sensitive scalp signals

- [ ] **Step 3: Add failing runtime test that restricted mode cannot call select_products**

Use a fake model output that tries to call `select_products` in restricted mode.

Expected:

```ts
assert.equal(result.trace.safety_mode, "restricted")
assert.equal(result.trace.tool_calls.some((call) => call.name === "select_products"), false)
assert.equal(result.final_answer.answer_mode, "safety_boundary" /* or clarification with safety-first payload, depending on implementation */)
```

- [ ] **Step 4: Gate the restricted tool surface**

For V0, prefer the simpler behavior:
- `hard_short_circuit`: bypass model loop
- `restricted`: build tool definitions without `select_products`
- `normal`: full V0 toolset

If omitting tools causes prompt caching concerns later, switch to `tool_choice.allowed_tools` in a follow-up. Do not implement both now.

- [ ] **Step 5: Add restricted safety guidance**

Guidance should tell the model:
- do not lead with product recommendations
- explain mild-care direction
- mention escalation signs
- ask one clarifying question only when materially useful

Example user-facing shape:

```txt
Bei juckender und geröteter Kopfhaut würde ich nicht direkt mit einem konkreten Shampoo starten. Bis es ruhiger ist: mild reinigen, keine Kopfhaut-Peelings und nichts stark Duftendes direkt auf die Kopfhaut. Wenn es anhält, brennt, nässt, schmerzt oder stärker wird, bitte abklären lassen. Ist das akut neu oder kommt es gelegentlich wieder?
```

- [ ] **Step 6: Verify safety tests**

Run:

```bash
npm run test:agent -- tests/agent-v2-responses-runtime.spec.ts tests/agent-v2-compare-runner.spec.ts
```

Expected:
- cosmetic scalp product asks still allow product tools
- restricted foreground symptom asks do not call `select_products`
- hard short-circuit still bypasses the model loop

## Task 4: Preserve Structured Routine Thread State

**Files:**
- Modify: `src/lib/agent-v2/contracts.ts`
- Modify: `src/lib/agent-v2/compare/run-agent-v2.ts`
- Modify: `src/lib/agent-v2/runtime/responses-agent.ts`
- Modify: `src/lib/agent-v2/validation/final-answer-validator.ts`
- Test: `tests/agent-v2-contracts.spec.ts`
- Test: `tests/agent-v2-compare-runner.spec.ts`
- Test: `tests/agent-v2-final-answer-validator.spec.ts`

- [ ] **Step 1: Extend routine thread schema**

Add a strict routine-thread step schema:

```ts
export const AgentV2RoutineThreadStepSchema = z.strictObject({
  step_id: z.string(),
  label_de: z.string(),
  category: z.string().nullable(),
  order: z.number().int().positive(),
  routine_layer: AgentV2RoutineLayerSchema.nullable(),
})
```

Add to `AgentV2RoutineThreadContextSchema`:

```ts
visible_steps: z.array(AgentV2RoutineThreadStepSchema)
```

- [ ] **Step 2: Add contract tests**

Assert that routine thread context can parse:

```ts
{
  active: true,
  current_layer: "basics",
  last_answer_mode: "routine",
  last_routine_categories: ["shampoo", "conditioner", "leave_in"],
  last_user_goal: "Ich will meine Routine einfacher machen.",
  summary_de: "Klar — ...",
  visible_steps: [
    { step_id: "base-shampoo", label_de: "Shampoo", category: "shampoo", order: 1, routine_layer: "basics" },
    { step_id: "base-conditioner", label_de: "Conditioner", category: "conditioner", order: 2, routine_layer: "basics" },
  ],
}
```

- [ ] **Step 3: Persist visible routine steps after routine answers**

Update `updateAgentV2RoutineThreadContext()` to populate `visible_steps` from:
- `answer.payload.visible_steps` for `answer_mode === "routine"`
- `answer.payload.step_id` / `answer.payload.category` for `routine_product_deep_dive`
- previous context when a follow-up stays inside the routine track but does not replace steps

- [ ] **Step 4: Inject routine steps into model context**

Update `buildInputItems()` routine-context system message to include `visible_steps`.

Add language:

```txt
Use visible_steps to resolve follow-ups like "dieser Schritt", "der erste Zusatz", or "das Produkt dafür". Do not invent a step ID; if unclear, ask a clarification.
```

- [ ] **Step 5: Validate claimed routine steps against active context**

Extend `validateKnownRoutineStepIds()` so valid step IDs include:
- latest routine tool projection steps
- active `routineThreadContext.visible_steps`

- [ ] **Step 6: Add multi-turn Compare runner test**

Simulate:

```ts
turns: [
  "Ich will meine Routine einfacher machen.",
  "Welches Produkt passt für den ersten Zusatz?"
]
```

Use fake runtime outputs to assert the second turn receives active routine context with `visible_steps`.

Expected:

```ts
assert.equal(secondTurn.agent_v2_trace.routine_thread_context_active, true)
assert.ok(secondTurn.agent_v2_trace.routine_thread_context.visible_steps.length > 0)
```

- [ ] **Step 7: Verify routine state tests**

Run:

```bash
npm run test:agent -- tests/agent-v2-contracts.spec.ts tests/agent-v2-compare-runner.spec.ts tests/agent-v2-final-answer-validator.spec.ts
```

Expected:
- routine thread context includes structured steps
- validator accepts step IDs from active thread state

## Task 5: Make Evidence Quote Validation Formatting-Chill

**Files:**
- Modify: `src/lib/agent-v2/validation/final-answer-validator.ts`
- Modify: `src/lib/agent-v2/runtime/responses-agent.ts`
- Test: `tests/agent-v2-final-answer-validator.spec.ts`

- [ ] **Step 1: Add failing quote-mark tests**

For latest user message:

```txt
Meine Kopfhaut juckt und ist gerötet, welches Shampoo soll ich nehmen?
```

These should pass evidence validation:

```txt
Meine Kopfhaut juckt und ist gerötet
„Meine Kopfhaut juckt und ist gerötet“
juckt und ist gerötet
```

These should fail:

```txt
User wants medical treatment
shampoo
Routine
```

- [ ] **Step 2: Normalize decorative punctuation**

Update `normalizeEvidenceText()` or add a helper to:
- lowercase
- strip diacritics
- strip surrounding German/English quote marks
- normalize commas, colons, semicolons, dashes, and whitespace
- keep enough text to reject tiny vague evidence

Do not accept evidence outside:
- latest user message
- recent evidence text
- active routine thread context
- injected session memory context if passed later

- [ ] **Step 3: Update terminal guidance**

Add:

```txt
evidence_quote should be the raw user/context substring only. Do not wrap it in decorative quotation marks.
```

- [ ] **Step 4: Verify quote tests**

Run:

```bash
npm run test:agent -- tests/agent-v2-final-answer-validator.spec.ts
```

Expected:
- decorative quotes pass
- invented evidence fails

## Task 6: Add Typed Friendly Fallbacks

**Files:**
- Modify: `src/lib/agent-v2/runtime/responses-agent.ts`
- Test: `tests/agent-v2-responses-runtime.spec.ts`

- [ ] **Step 1: Add failing runtime tests for fallback families**

Add tests that simulate:
- `visible_payload_not_rendered` repair fails
- restricted safety validation fails
- product tool returns no products and final answer cannot safely recommend
- active routine context exists but referenced step/category is unclear

Expected user-facing text:
- no internal validator IDs
- no "terminal_schema", "repair_failed", or "tool" wording
- one useful next step

- [ ] **Step 2: Replace one generic fallback with a family selector**

Add:

```ts
function buildFallbackAnswer(params: {
  reason: "generic" | "composition_failed" | "restricted_safety" | "empty_product_result" | "routine_ambiguity"
  message: string
  safetyMode: AgentV2SafetyMode
  routineThreadContext: AgentV2RoutineThreadContext | null
  validationErrors?: AgentV2ValidationError[]
}): AgentV2TerminalAnswer
```

Map internal failures:
- restricted safety -> `restricted_safety`
- empty product result / known no final products for product ask -> `empty_product_result`
- active routine thread plus routine/product deep-dive ambiguity -> `routine_ambiguity`
- repair failure after incomplete prose -> `composition_failed`
- otherwise -> `generic`

- [ ] **Step 3: Use friendly German fallback text**

Use concise German text:

```txt
generic:
Ich bin mir gerade nicht sicher, was du genau möchtest. Formulier es bitte einmal konkreter.

composition_failed:
Ich konnte die Antwort gerade nicht sauber zusammensetzen. Versuch es bitte noch einmal mit derselben Frage.

restricted_safety:
Bei juckender und geröteter Kopfhaut würde ich nicht direkt mit einem konkreten Produkt starten. Bis es ruhiger ist: mild reinigen, keine Kopfhaut-Peelings und nichts stark Duftendes direkt auf die Kopfhaut. Wenn es anhält, brennt, nässt, schmerzt oder stärker wird, bitte abklären lassen.

empty_product_result:
Ich finde gerade keinen sicheren Produkttreffer in dieser Kategorie. Ich kann dir aber erklären, welche Produktart hier passen würde.

routine_ambiguity:
Meinst du mit dem Zusatz den Leave-in-Schritt oder den Reset-Schritt?
```

Adjust wording to existing tone guidance if tests already assert a specific German style.

- [ ] **Step 4: Keep internal codes in trace only**

Ensure:
- `trace.validation_errors` keeps exact validator IDs
- `trace.failure_stage` remains precise
- `payload.user_facing_answer_de` never contains validator IDs or implementation terms

- [ ] **Step 5: Verify fallback tests**

Run:

```bash
npm run test:agent -- tests/agent-v2-responses-runtime.spec.ts
```

Expected:
- each failure family produces a useful fallback
- traces still expose exact failure reasons

## Task 7: Regression Harness For The Manual 10-Case Batch

**Files:**
- Add or Modify: `tests/agent-v2-manual-regression.spec.ts` if a focused file is cleaner
- Or Modify: existing `tests/agent-v2-responses-runtime.spec.ts` / `tests/agent-v2-compare-runner.spec.ts`

- [ ] **Step 1: Add deterministic fixture coverage for the discovered cases**

Cover at least:

```txt
Welche Spülung passt zu feinem Haar?
Welche Art von Spülung passt zu feinem Haar?
Nenn mir zwei Conditioner.
Brauche ich eher eine Maske oder Conditioner?
Ich will meine Routine einfacher machen.
Ich will meine Routine einfacher machen. -> Welches Produkt passt für den ersten Zusatz?
Meine Kopfhaut juckt und ist gerötet, welches Shampoo soll ich nehmen?
Welches Öl passt, ohne dass es schwer wird?
Vergleich mir Leave-in Spray und Creme für feines Haar.
Ich habe coloriertes, trockenes Haar und Frizz. Was soll ich ändern?
```

Use fake model/tool outputs where needed. Do not require live OpenAI for CI.

- [ ] **Step 2: Encode structural expectations**

Expected checks:
- no runtime crash
- no generic fallback for routine/safety cases when a typed fallback is expected
- exact two-product surfaced output for "Nenn mir zwei Conditioner"
- restricted safety does not execute `select_products`
- routine answer prose includes visible routine step labels
- evidence quotes with quote marks pass

- [ ] **Step 3: Add a manual live-test script note**

Do not add a permanent external dependency. Add a short comment or test helper note explaining how to rerun the live Compare Lab batch manually against localhost, based on `/api/labs/agent-compare`.

- [ ] **Step 4: Verify regression suite**

Run:

```bash
npm run test:agent -- tests/agent-v2-final-answer-validator.spec.ts tests/agent-v2-responses-runtime.spec.ts tests/agent-v2-compare-runner.spec.ts
```

Expected:
- focused regression suite passes without live OpenAI

## Task 8: Final Verification

**Files:** no new implementation files unless tests expose defects.

- [ ] **Step 1: Run focused AgentV2 tests**

```bash
npm run test:agent -- tests/agent-v2-contracts.spec.ts tests/agent-v2-final-answer-validator.spec.ts tests/agent-v2-responses-runtime.spec.ts tests/agent-v2-compare-runner.spec.ts tests/agent-v2-guidance-compiler.spec.ts
```

Expected: all pass.

- [ ] **Step 2: Run broader agent suite**

```bash
npm run test:agent
```

Expected: no AgentV2 or Compare Lab regressions.

- [ ] **Step 3: Run typecheck**

```bash
npm run typecheck
```

Expected: pass.

- [ ] **Step 4: Run lint on touched files**

Use the repo's existing lint command. If there is no narrow lint command, run:

```bash
npm run lint
```

Expected: no new lint errors in touched files.

- [ ] **Step 5: Run diff hygiene**

```bash
git diff --check
```

Expected: no whitespace errors.

- [ ] **Step 6: Manual Compare Lab smoke**

With the worktree dev server running, test:

```txt
Ich will meine Routine einfacher machen.
Nenn mir zwei Conditioner.
Meine Kopfhaut juckt und ist gerötet, welches Shampoo soll ich nehmen?
```

Expected:
- routine answer includes actual steps in final prose
- two-conditioner ask shows two products in answer and `matched_products`
- restricted scalp ask does not show product cards or product-first wording
- trace shows internal failure/warning codes only in debug surfaces

## Ready Check

This touches recommendations, safety copy, Compare Lab UI output, and trust-facing assistant behavior. Before claiming ready, use `ready-check` after automated verification.

## Execution Handoff

Recommended next skill: `superpowers:subagent-driven-development`.

Suggested task split:
- Worker 1: Task 1 + Task 5 validator/guidance work
- Worker 2: Task 2 Compare Lab product mapping
- Worker 3: Task 3 safety tool gating and restricted fallback
- Worker 4: Task 4 routine thread state
- Main agent: integrate Task 6 fallback family and Task 7/8 verification

Workers are not alone in the codebase. They must not revert edits made by other workers, and should adjust their implementation to accommodate nearby changes.
