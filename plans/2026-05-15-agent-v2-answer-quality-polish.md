# AgentV2 Answer Quality Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make AgentV2 Compare Lab answers feel like a warm routine advisor, with product recommendations inside routine flows using the same three-option product recommendation contract.

**Architecture:** Keep AgentV2 Compare Lab-only. Do not change product ranking, routine planning, or production V1 chat. Tighten the guidance packages, terminal validation, Compare Lab trace snapshot, and regression tests so AgentV2 keeps routine context while using `select_products` for concrete product asks.

**Tech Stack:** Next.js, TypeScript, OpenAI Responses API, AgentV2 terminal contract, Zod, Node test runner, Compare Lab.

---

**Spec:** `docs/superpowers/specs/2026-05-14-agent-v2-context-and-contracts-design.md`

**User situation:** Manual Compare Lab runs now show AgentV2 is structurally stable, but still too clipped and sometimes too database-shaped. Product deep dives inside a routine should be full product recommendations, not loose category advice. Compare Lab also underreports AgentV2 tool/guidance traces in saved analysis snapshots.

**Promised end-state:** When a user asks for a concrete product inside a routine thread, AgentV2 treats it as a product recommendation within the routine builder: it calls `select_products`, returns up to three products in the chosen routine lane, explains each product in one natural fit sentence, and then offers a return path to the routine. General category questions still answer the category logic first and avoid product lists unless the user explicitly asks. Compare Lab saved snapshots show AgentV2 tools and guidance correctly.

## Settled Decisions

- Product asks inside routine context use `routine_product_deep_dive` but reuse the normal product recommendation shape.
- A precise ask like "welches Produkt genau?" or "zeig mir ein passendes Produkt" must call `select_products` unless required inputs are missing.
- Category advice remains separate: "Maske oder Conditioner?" answers the category decision first, with no product list by default.
- Product recommendation prose should not expose raw database-property bullets. Each product gets a coherent German fit sentence.
- The product category/lane should come from the active routine context when available; do not jump categories unless the user asks.
- We keep the current AgentV2 architecture and improve quality through guidance, validators, tests, and trace visibility.

## Target File Map

- Modify: `data/agent-v2/guidance/base/product-recommendation.md`
  - Define the natural three-option product answer shape.
  - Define routine-product deep dive as product recommendation plus return-to-routine bridge.
- Modify: `data/agent-v2/guidance/base/product-recommendation.json`
  - Add/update soft rubrics for natural fit sentences and no raw property dumps.
- Modify: `data/agent-v2/guidance/base/tone-and-format.md`
  - Make answers warmer, lightly structured, and explanatory without becoming long.
- Modify: `data/agent-v2/guidance/base/tone-and-format.json`
  - Add/update soft rubrics for warm explanatory structure.
- Modify: `data/agent-v2/guidance/base/routine-building.md`
  - Clarify that concrete product asks inside routine continue through `routine_product_deep_dive`.
- Modify: `data/agent-v2/guidance/base/general-advice.md`
  - Preserve category advice behavior: answer category first, recommend products only on explicit ask.
- Modify: `src/lib/agent-v2/validation/final-answer-validator.ts`
  - Add lightweight quality validators for product answer shape and raw property dump avoidance.
- Modify: `src/components/labs/agent-compare-lab.tsx`
  - Make analysis snapshot extraction read AgentV2 trace data as well as Tool Loop trace data.
- Test: `tests/agent-v2-guidance-compiler.spec.ts`
  - Assert the guidance contains the new behavior rules.
- Test: `tests/agent-v2-final-answer-validator.spec.ts`
  - Assert product recommendations reject raw property dump patterns and accept natural fit sentences.
- Test: `tests/agent-compare-api.spec.ts` or a new focused test if component helpers are extracted
  - Assert saved/snapshot AgentV2 traces expose tool calls and guidance IDs.
- Optional Test: `tests/agent-v2-compare-runner.spec.ts`
  - Add regression fixtures around routine-context product deep dives if feasible without live model calls.

## Scope Boundaries

In scope:

- AgentV2 Compare Lab quality improvements.
- Product recommendation wording and terminal payload validation.
- Routine-context product deep dive behavior.
- Tone and format guidance.
- Compare Lab trace snapshot correctness.
- Regression prompts from the latest manual tests.

Out of scope:

- Production V1 chat path changes.
- Product ranking changes.
- New product categories or product metadata.
- New routine planner behavior.
- Durable memory or profile writes.
- Langfuse integration.
- Provider-neutral abstraction.

## Task 1: Fix AgentV2 Trace Snapshot Extraction

**Files:**
- Modify: `src/components/labs/agent-compare-lab.tsx`
- Test: `tests/agent-compare-api.spec.ts` or extract helpers for direct unit testing

- [ ] **Step 1: Write a failing test for AgentV2 snapshot trace fields**

Add or adapt a test that builds a Compare Lab saved analysis snapshot from a result containing `agent_v2_trace` only:

```ts
const agentV2Result = {
  system: "agent_v2",
  answer: "Antwort",
  latency_ms: 123,
  debug_lines: [],
  matched_products: [],
  agent_v2_trace: {
    tool_calls: [
      { name: "load_advisor_guidance", output_summary: "guidance_ids=base.product_recommendation.v1" },
      { name: "select_products", output_summary: "products=3" },
    ],
    loaded_guidance_ids: ["base.product_recommendation.v1", "category.leave_in.v1"],
    model_steps: [{ response_id: "resp_1" }],
  },
  error: null,
}
```

Expected snapshot fields:

```ts
assert.deepEqual(snapshot.results[0].tool_calls, ["load_advisor_guidance", "select_products"])
assert.deepEqual(snapshot.results[0].guidance_ids, [
  "base.product_recommendation.v1",
  "category.leave_in.v1",
])
```

- [ ] **Step 2: Run the failing test**

Run the focused test command chosen in Step 1.

Expected: FAIL because snapshot extraction currently reads `tool_loop_trace` for tool calls.

- [ ] **Step 3: Implement trace extraction for both systems**

Update `extractToolCallNames` usage in `buildResultAnalysisSnapshot`:

```ts
function extractResultToolCallNames(result: CompareRunResult | AgentCompareTurnResult): string[] {
  return uniqueStrings([
    ...extractToolCallNames(result.tool_loop_trace),
    ...extractToolCallNames(result.agent_v2_trace),
  ])
}
```

Update guidance extraction to include AgentV2 trace fields:

```ts
function extractGuidanceIds(result: CompareRunResult | AgentCompareTurnResult): string[] {
  const toolLoopTrace = asRecord(result.tool_loop_trace)
  const agentV2Trace = asRecord(result.agent_v2_trace)
  const advisorGuidance = asRecord(toolLoopTrace?.advisor_guidance)
  const consultationBrief = asRecord(toolLoopTrace?.consultation_brief)
  const candidateGuidance = consultationBrief?.candidate_guidance
  const candidateIds = Array.isArray(candidateGuidance)
    ? candidateGuidance.flatMap((entry) => {
        const id = asRecord(entry)?.id
        return typeof id === "string" ? [id] : []
      })
    : []

  const agentV2LoadedIds = extractStringArray(agentV2Trace?.loaded_guidance_ids)
  const agentV2ToolOutputIds = Array.isArray(agentV2Trace?.tool_calls)
    ? agentV2Trace.tool_calls.flatMap((call) => {
        const summary = asRecord(call)?.output_summary
        if (typeof summary !== "string") return []
        const [, rawIds] = summary.split("guidance_ids=")
        return rawIds ? rawIds.split(",").map((id) => id.trim()) : []
      })
    : []

  const debugIds =
    result.debug_lines?.flatMap((line: string) => {
      const [, rawIds] = line.split("advisor_guidance:")
      return rawIds ? rawIds.split(",").map((id: string) => id.trim()) : []
    }) ?? []

  return uniqueStrings([
    ...extractStringArray(result.route_trace?.guidance_ids),
    ...extractStringArray(advisorGuidance?.loaded_guidance_ids),
    ...candidateIds,
    ...agentV2LoadedIds,
    ...agentV2ToolOutputIds,
    ...debugIds,
  ])
}
```

Then use `extractResultToolCallNames(...)` for result and turn snapshots.

- [ ] **Step 4: Run the test again**

Expected: PASS and AgentV2 snapshots show tools/guidance.

## Task 2: Strengthen Product Recommendation Guidance

**Files:**
- Modify: `data/agent-v2/guidance/base/product-recommendation.md`
- Modify: `data/agent-v2/guidance/base/product-recommendation.json`
- Test: `tests/agent-v2-guidance-compiler.spec.ts`

- [ ] **Step 1: Write guidance compiler assertions**

Extend `product guidance frames ranked products as tradeoff options` with these assertions:

```ts
assert.match(brief, /one natural fit sentence/i)
assert.match(brief, /Do not show raw property bullets/i)
assert.match(brief, /routine_product_deep_dive/i)
assert.match(brief, /return to the routine/i)
assert.match(brief, /up to three products/i)
```

- [ ] **Step 2: Run the failing guidance test**

Run:

```bash
npx tsx --test tests/agent-v2-guidance-compiler.spec.ts
```

Expected: FAIL until guidance text is updated.

- [ ] **Step 3: Update markdown guidance**

Add this section to `data/agent-v2/guidance/base/product-recommendation.md`:

```md
## Product Recommendation Shape
For an explicit product ask, return up to three products in the tool order. Each product should get one natural German fit sentence, not a database-property list.

Good shape:
1. **Product name** - one sentence explaining why it fits this user, using profile facts and supported product claims.
2. **Product name** - one sentence explaining the tradeoff or when this option is better.
3. **Product name** - one sentence explaining the distinct fit.

Add one short usage note after the list when useful. Do not repeat every product property.

## Routine Product Deep Dive
When the user asks for a concrete product inside an active routine thread, use `routine_product_deep_dive` and the same product recommendation shape. The routine context decides the lane; `select_products` decides the products.

Stay in the routine-relevant category unless the user asks to switch categories. After the product list, add a short bridge back to the routine, such as where the chosen product fits or what routine step comes next.

## Avoid Raw Property Dumps
Do not show raw property bullets like:
- Format: Spray
- Gewicht: Leicht
- Balance: Feuchtigkeit
- Hitzeschutz: Ja

Use those facts only inside natural sentences when they help the fit explanation.
```

- [ ] **Step 4: Update structured rubrics**

Add rubrics to `product-recommendation.json`:

```json
{
  "rubric_id": "product.one_natural_fit_sentence_per_product",
  "priority": "high",
  "source": "base/product-recommendation.md",
  "message": "For each recommended product, write one coherent German sentence explaining why it fits this user."
},
{
  "rubric_id": "product.no_raw_property_dump",
  "priority": "high",
  "source": "base/product-recommendation.md",
  "message": "Do not render product projection fields as raw property bullets; turn them into advisor prose."
},
{
  "rubric_id": "product.routine_deep_dive_uses_product_recommendation",
  "priority": "high",
  "source": "base/product-recommendation.md",
  "message": "A precise product ask inside a routine thread should use routine_product_deep_dive and the normal three-option product recommendation shape."
}
```

- [ ] **Step 5: Run guidance test again**

Expected: PASS.

## Task 3: Add Product Answer Quality Validation

**Files:**
- Modify: `src/lib/agent-v2/validation/final-answer-validator.ts`
- Test: `tests/agent-v2-final-answer-validator.spec.ts`

- [ ] **Step 1: Write failing tests for raw property dump rejection**

Add a test:

```ts
test("validator blocks raw product property dump bullets", () => {
  const result = validateAgentV2FinalAnswer(
    {
      ...baseAnswer,
      payload: {
        ...baseAnswer.payload,
        user_facing_answer_de: [
          "1. **Test Shampoo**",
          "- **Format:** Spray",
          "- **Gewicht:** Leicht",
          "- **Balance:** Feuchtigkeit",
        ].join("\n"),
      },
    },
    baseValidationContext,
  )

  assert.equal(result.ok, false)
  assert.ok(result.errors.some((error) => error.validator_id === "product_answer_shape"))
})
```

Add an accepting test:

```ts
test("validator accepts natural product fit sentences", () => {
  const result = validateAgentV2FinalAnswer(
    {
      ...baseAnswer,
      payload: {
        ...baseAnswer.payload,
        user_facing_answer_de:
          "**Test Shampoo** passt gut, weil es leicht reinigt und dein feines Haar nicht unnoetig beschwert.",
      },
    },
    baseValidationContext,
  )

  assert.equal(result.ok, true)
})
```

- [ ] **Step 2: Run failing validator tests**

Run:

```bash
npx tsx --test tests/agent-v2-final-answer-validator.spec.ts
```

Expected: FAIL because `product_answer_shape` does not exist.

- [ ] **Step 3: Implement product answer shape validator**

Add `validateProductAnswerShape(...)` after mode payload validation:

```ts
validateProductAnswerShape(terminalAnswer, errors)
```

Implement:

```ts
function validateProductAnswerShape(
  answer: AgentV2TerminalAnswer,
  errors: AgentV2ValidationError[],
): void {
  if (
    answer.answer_mode !== "product_recommendation" &&
    answer.answer_mode !== "routine_product_deep_dive"
  ) {
    return
  }

  const userFacing = readUserFacingAnswer(answer.payload)
  const rawPropertyPattern = /^\s*[-*]\s*(?:\*\*)?(?:Format|Gewicht|Balance|Hitzeschutz|Preis|Besonderheit)(?:\*\*)?\s*:/im
  if (rawPropertyPattern.test(userFacing)) {
    errors.push({
      validator_id: "product_answer_shape",
      message:
        "Product recommendations must not render raw product projection fields as property bullets; use natural fit sentences per product.",
      severity: "block",
    })
  }
}
```

- [ ] **Step 4: Run validator tests again**

Expected: PASS.

## Task 4: Strengthen Tone And Routine-Context Guidance

**Files:**
- Modify: `data/agent-v2/guidance/base/tone-and-format.md`
- Modify: `data/agent-v2/guidance/base/tone-and-format.json`
- Modify: `data/agent-v2/guidance/base/routine-building.md`
- Modify: `data/agent-v2/guidance/base/general-advice.md`
- Test: `tests/agent-v2-guidance-compiler.spec.ts`

- [ ] **Step 1: Add guidance assertions**

Add tests that assert tone guidance contains:

```ts
assert.match(brief, /light bold anchors/i)
assert.match(brief, /brief why/i)
assert.match(brief, /not clipped/i)
```

Add tests that assert routine guidance contains:

```ts
assert.match(brief, /concrete product ask inside an active routine/i)
assert.match(brief, /routine_product_deep_dive/i)
assert.match(brief, /select_products/i)
```

- [ ] **Step 2: Run failing guidance tests**

Run:

```bash
npx tsx --test tests/agent-v2-guidance-compiler.spec.ts
```

Expected: FAIL until markdown is updated.

- [ ] **Step 3: Update tone guidance**

Add to `tone-and-format.md`:

```md
## Warm Helpful Structure
Use light bold anchors for multi-part answers. Give the user a brief why, not only the instruction. The answer should feel friendly and complete, not clipped.

Prefer two to four short sections or bullets when the user asks about options, routines, or product use. Avoid one dense paragraph for multi-step advice.
```

Add rubric to `tone-and-format.json`:

```json
{
  "rubric_id": "tone.light_structure_with_brief_why",
  "priority": "high",
  "source": "base/tone-and-format.md",
  "message": "Use light structure and a short explanation of why the advice fits, so answers feel warm and complete rather than clipped."
}
```

- [ ] **Step 4: Update routine guidance**

Add to `routine-building.md`:

```md
## Product Deep Dives Inside A Routine
If the user asks for a concrete product inside an active routine, stay on the routine route but answer through `routine_product_deep_dive`. Call `select_products` and use the product recommendation shape from `base.product_recommendation.v1`.

The routine context chooses the relevant lane, such as leave-in after basics or conditioner as the base product. Do not turn a precise product ask into only category education.
```

- [ ] **Step 5: Update general advice guidance**

Add to `general-advice.md`:

```md
## Category First, Products On Ask
For category questions, explain the category decision first. If the user asks precisely for a product, switch to the product recommendation flow instead of continuing general advice.
```

- [ ] **Step 6: Run guidance tests again**

Expected: PASS.

## Task 5: Add Routine Product Deep Dive Regression Coverage

**Files:**
- Modify: `tests/agent-v2-responses-runtime.spec.ts` or `tests/agent-v2-compare-runner.spec.ts`

- [ ] **Step 1: Add a fake-client regression test**

Add a test where the active routine context exists and the user says:

```text
Okay, zeig mir dann ein passendes Produkt fuer den ersten Hebel.
```

The fake model should call:

```ts
load_advisor_guidance({ answer_mode_hint: "routine_product_deep_dive", categories: ["leave_in"] })
select_products({ category: "leave_in" })
submit_final_answer({ answer_mode: "routine_product_deep_dive", ... })
```

Assert:

```ts
assert.equal(result.final_answer?.answer_mode, "routine_product_deep_dive")
assert.ok(result.trace.tool_calls.some((call) => call.name === "select_products"))
assert.equal(result.trace.validation_errors.length, 0)
assert.equal(result.final_answer?.routine_context.active, true)
```

- [ ] **Step 2: Run the focused runtime test**

Run:

```bash
npx tsx --test tests/agent-v2-responses-runtime.spec.ts
```

Expected: PASS after existing runtime behavior and validator constraints are compatible.

## Task 6: Automated Verification

**Files:**
- No direct file edits.

- [ ] **Step 1: Run focused AgentV2 tests**

Run:

```bash
npx tsx --test tests/agent-v2-contracts.spec.ts tests/agent-v2-guidance-compiler.spec.ts tests/agent-v2-tool-projections.spec.ts tests/agent-v2-final-answer-validator.spec.ts tests/agent-v2-responses-runtime.spec.ts tests/agent-v2-compare-runner.spec.ts
```

Expected: all pass.

- [ ] **Step 2: Run Compare Lab tests**

Run:

```bash
npx tsx --test tests/agent-compare-api.spec.ts tests/agent-compare-product-trace.spec.ts tests/agent-compare-runner.spec.ts
```

Expected: all pass.

- [ ] **Step 3: Run repo checks**

Run:

```bash
npm run typecheck
npm run lint
git diff --check
```

Expected: typecheck passes; lint has no new warnings beyond existing known warnings; diff check passes.

## Task 7: Manual Compare Lab Verification

**Files:**
- No direct file edits.

- [ ] **Step 1: Restart worktree dev server**

Run:

```bash
npm run dev:worktree
```

Expected: app available at the worktree port shown by the dev script.

- [ ] **Step 2: Run latest feedback chains**

Run Tool Loop vs AgentV2 with AgentV2 enabled and these multi-turn prompts:

```text
Ich habe Shampoo und Conditioner. Was sollte ich als naechstes ergaenzen?
Warum nicht direkt Maske oder Oel?
Okay, zeig mir dann ein passendes Produkt fuer den ersten Hebel.
```

```text
Ich suche einfach eine Pflege, die mehr Glanz bringt.
ok und welches produkt genau sollte ich da nehmen?
Und wie und wann nutze ich das?
```

```text
Was ist bei mir sinnvoller: normales Shampoo oder Tiefenreinigungsshampoo?
Ich nutze oft Styling und meine Haare wirken schnell belegt.
Wie oft wuerdest du das in meine Routine einbauen?
```

- [ ] **Step 3: Return outputs for judgment**

Report AgentV2 answers and trace summary:

```text
Turn N
answer_mode: ...
tools: ...
guidance: ...
products: ...
answer: ...
```

Expected manual quality gates:

- Product deep dive calls `select_products`.
- Product deep dive shows up to three products.
- Each product has one natural fit sentence.
- No raw database-property bullet dump.
- Category questions do not default to product lists.
- Tone is warmer and more explanatory than the last run.
- Saved Compare Lab snapshot shows AgentV2 tools and guidance.

## Ready Check

Because this touches recommendation quality, copy, and trust-facing behavior, run `ready-check` before claiming implementation is ready for handoff.
