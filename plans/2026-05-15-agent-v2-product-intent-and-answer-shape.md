# AgentV2 Product Intent And Answer Shape Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make AgentV2 more reliably fulfill concrete product asks while improving the warmth and structure of user-facing German answers.

**Architecture:** Keep AgentV2 Compare Lab-only. Use guidance/examples for answer style, and validators only for clear contract contradictions: product intent recognized but not fulfilled, explicit product count ignored, or product output hidden after `select_products`. Do not turn stylistic preferences into brittle hard validators.

**Tech Stack:** Next.js, TypeScript, OpenAI Responses API, AgentV2 terminal contract, Zod, Node test runner, Compare Lab.

---

**Spec:** `docs/superpowers/specs/2026-05-14-agent-v2-context-and-contracts-design.md`

**User situation:** Manual Compare Lab runs show AgentV2 is improving, but simple one-off messages still expose three gaps: “Welche Spülung passt …?” can call product tools but answer as generic advice, explicit requested product counts can be ignored, and some answers feel clipped or too bullet-heavy.

**Promised end-state:** AgentV2 treats “Welche Spülung/Conditioner/Maske/etc. passt …?” as a concrete product recommendation, defaults to three products unless the user explicitly asks for another reasonable count, and answers with a warmer direct-answer-first shape. Positive reference cases guide quality without freezing exact wording.

## Settled Decisions

- “Welche Spülung passt …?”, “Welcher Conditioner passt …?”, “Welche Maske passt …?”, and equivalent concrete category-fit wording should trigger product recommendation behavior.
- Intent recognition should do this naturally, but the validator should enforce consistency when the run already proves product intent, especially if `select_products` was called and the final answer hides the products.
- Default product recommendation count is three.
- If the user explicitly asks for two products, return two.
- If the user asks for one product, return one clear pick.
- If the user asks for more than three products, cap at three for AgentV2 V0.
- If the product tool returns fewer valid products than requested, show only valid products and do not invent extras.
- Style improvements belong mostly in guidance and positive-reference tests, not hard validators.
- Advisor answer shape should borrow the useful ChatGPT/Claude pattern: direct answer first, profile-linked why, light structure, natural prose, and one practical caveat or next step.
- Bullets should be used for sibling options or short scannable steps. Avoid a subheader followed by a long stack of small bullets when a short paragraph would feel more human.

## Non-Goals

- Do not change product ranking.
- Do not change production V1 chat.
- Do not add new product categories.
- Do not add a new standalone intent-classifier service.
- Do not make validators enforce subjective style such as exact bold usage, exact section count, or exact wording.
- Do not create UI prompt packs for these examples yet.

## Target File Map

- Modify: `src/lib/agent-v2/runtime/responses-agent.ts`
  - Improve explicit product-ask detection.
  - Add requested product count detection.
  - Pass requested count into final-answer validation context.
  - Inject concise terminal guidance for count behavior and product ask wording.
- Modify: `src/lib/agent-v2/validation/final-answer-validator.ts`
  - Enforce product mode when product intent is explicit and `select_products` was used.
  - Enforce requested recommendation count when the product projection has enough valid products.
- Modify: `src/lib/agent-v2/contracts.ts`
  - Only if validation context types or trace fields need a named exported type; otherwise avoid churn.
- Modify: `data/agent-v2/guidance/base/product-recommendation.md`
  - Clarify “which category fits” wording as product recommendation.
  - Clarify default three, respect explicit count, cap above three.
- Modify: `data/agent-v2/guidance/base/product-recommendation.json`
  - Add soft rubrics for product count and concrete category-fit asks.
- Modify: `data/agent-v2/guidance/base/tone-and-format.md`
  - Add direct-answer-first advisor frame and bullet/subheader guidance.
- Modify: `data/agent-v2/guidance/base/tone-and-format.json`
  - Add soft rubric for natural answer frame.
- Modify: `data/agent-v2/evals/positive-reference-cases.json`
  - Add positive reference quality cases from recent manual runs.
- Test: `tests/agent-v2-final-answer-validator.spec.ts`
  - Add product-intent fulfillment and requested-count tests.
- Test: `tests/agent-v2-responses-runtime.spec.ts`
  - Add runtime tests for product ask detection and requested-count propagation.
- Test: `tests/agent-v2-guidance-compiler.spec.ts`
  - Assert new guidance/rubrics are loaded.
- Test: `tests/agent-v2-contracts.spec.ts` or a new eval fixture test
  - Assert positive-reference cases are well-formed and quality-based, not golden-text based.

## Task 1: Product Ask And Count Detection

**Files:**
- Modify: `src/lib/agent-v2/runtime/responses-agent.ts`
- Test: `tests/agent-v2-responses-runtime.spec.ts`

- [ ] **Step 1: Add failing tests for concrete category-fit product asks**

Add tests around helper-visible runtime behavior. If helpers remain private, test through a fake client that submits a `general_advice` answer after `select_products` for this prompt:

```ts
const message = "Welche Spülung passt zu coloriertem, strapaziertem Haar?"
```

Expected behavior:

```ts
assert.equal(result.final_answer.answer_mode, "product_recommendation")
assert.deepEqual(result.trace.validation_errors, [])
assert.equal(result.trace.repair_attempts.length, 1)
```

The first fake response should call `select_products` and then wrongly submit `general_advice`. The repair response should submit `product_recommendation`.

- [ ] **Step 2: Add failing tests for requested product count propagation**

Use prompts:

```ts
"Vergleich mir bitte zwei passende Conditioner für feines Haar."
"Welches eine Produkt passt am besten?"
"Nenn mir fünf passende Conditioner."
```

Expected requested counts:

```ts
// two -> 2
// one/bestes/eine -> 1
// five -> 3 cap
```

Assert the repair guidance or validator context causes the final payload to use the expected count when enough selected products exist.

- [ ] **Step 3: Implement product ask detection**

Update the private runtime helper near `looksLikeExplicitProductAsk` so it catches category-fit wording and German category synonyms:

```ts
function looksLikeExplicitProductAsk(message: string): boolean {
  const normalized = message.toLocaleLowerCase("de-DE")
  const hasProductVerb =
    /\b(produkt|produkte|empfehl|kaufen|nehmen|verwenden|passt|passen|geeignet)\b/i.test(normalized)
  const hasConcreteWhich = /\b(welche|welcher|welches|welchen|was für(?: ein| eine| einen)?)\b/i.test(normalized)
  const hasCategory =
    /\b(spülung|conditioner|shampoo|maske|kur|leave[- ]?in|öl|oel|bondbuilder|tiefenreinigungsshampoo|dry shampoo|trockenshampoo|peeling)\b/i.test(
      normalized,
    )

  return (
    /\b(produkt|produkte|empfehl|kaufen)\b/i.test(normalized) ||
    (hasConcreteWhich && hasCategory) ||
    (hasProductVerb && hasCategory && /\bpasst|passen|geeignet|nehmen|verwenden\b/i.test(normalized))
  )
}
```

- [ ] **Step 4: Implement requested count detection**

Add a private helper:

```ts
function detectRequestedProductCount(message: string): number | null {
  const normalized = message.toLocaleLowerCase("de-DE")
  if (/\b(ein|eine|einen|1|bestes|beste|top\s*1)\b/.test(normalized)) return 1
  if (/\b(zwei|2|beide|vergleich mir bitte zwei)\b/.test(normalized)) return 2
  if (/\b(drei|3)\b/.test(normalized)) return 3
  if (/\b(vier|4|fünf|fuenf|5|sechs|6|mehrere|liste)\b/.test(normalized)) return 3
  return null
}
```

Keep this intentionally simple for V0. If it creates false positives later, move to a structured intent extraction field.

- [ ] **Step 5: Pass count into validation context**

Extend the context object passed into `validateAgentV2FinalAnswer`:

```ts
requestedProductCount: detectRequestedProductCount(params.message),
```

If `AgentV2FinalAnswerValidationContext` needs this field, add it there in Task 2.

## Task 2: Validator Enforcement For Fulfillment, Not Taste

**Files:**
- Modify: `src/lib/agent-v2/validation/final-answer-validator.ts`
- Test: `tests/agent-v2-final-answer-validator.spec.ts`

- [ ] **Step 1: Add failing validator test for hidden products**

Create a test where:

```ts
latestUserMessage = "Welche Spülung passt zu coloriertem, strapaziertem Haar?"
explicitProductAsk = true
toolCallHistory = [{ name: "select_products", ... }]
selectedProductProjections = [{ category: "conditioner", products: [/* 3 valid products */] }]
answer.answer_mode = "general_advice"
```

Expected:

```ts
assert.equal(result.ok, false)
assert.equal(result.errors[0].validator_id, "product_intent_must_surface_products")
```

- [ ] **Step 2: Add passing validator test for category education**

Use:

```ts
latestUserMessage = "Brauche ich eher Maske oder Conditioner?"
explicitProductAsk = false
toolCallHistory = []
answer.answer_mode = "general_advice"
```

Expected: `ok === true`.

- [ ] **Step 3: Add failing validator test for requested count**

Use:

```ts
latestUserMessage = "Vergleich mir bitte zwei passende Conditioner für feines Haar."
explicitProductAsk = true
requestedProductCount = 2
selectedProductProjections = [{ products: [productA, productB, productC] }]
answer.answer_mode = "product_recommendation"
answer.payload.recommendations = [productA, productB, productC]
```

Expected:

```ts
assert.equal(result.ok, false)
assert.equal(result.errors[0].validator_id, "requested_product_count")
```

- [ ] **Step 4: Add passing validator tests for one, two, default three, and capped above-three**

Cover:

```ts
requestedProductCount: 1 // accepts one recommendation
requestedProductCount: 2 // accepts two recommendations
requestedProductCount: null // accepts three when three are available
requestedProductCount: 3 // cap for above-three requests is already normalized before validation
```

- [ ] **Step 5: Extend validation context**

Add:

```ts
requestedProductCount?: number | null
```

to `AgentV2FinalAnswerValidationContext`.

- [ ] **Step 6: Enforce product intent fulfillment**

Add a validator function:

```ts
function validateProductIntentFulfilled(
  answer: AgentV2TerminalAnswer,
  context: AgentV2FinalAnswerValidationContext,
  errors: AgentV2ValidationError[],
): void {
  const usedProductTool = context.toolCallHistory.some((call) => call.name === "select_products")
  if (!context.explicitProductAsk || !usedProductTool) return
  if (answer.answer_mode === "product_recommendation") return
  if (answer.answer_mode === "routine_product_deep_dive") return

  errors.push({
    validator_id: "product_intent_must_surface_products",
    message: "Concrete product asks that used select_products must answer with product recommendations, not generic advice.",
    severity: "block",
  })
}
```

Call it from `validateAgentV2FinalAnswer`.

- [ ] **Step 7: Enforce requested product count**

Update the existing product answer shape validator so expected count is:

```ts
const requested = context.requestedProductCount
const expectedCount = requested ?? Math.min(3, availableRelevantProductCount)
```

Then:

```ts
if (availableRelevantProductCount >= expectedCount && recommendationCount !== expectedCount) {
  errors.push({
    validator_id: "requested_product_count",
    message: `The user asked for ${expectedCount} product recommendation(s); return exactly that many when enough valid products are available.`,
    severity: "block",
  })
}
```

Keep the existing behavior that fewer valid products are allowed when the tool returned fewer valid options.

## Task 3: Guidance For Product Count And Concrete Category-Fit Asks

**Files:**
- Modify: `data/agent-v2/guidance/base/product-recommendation.md`
- Modify: `data/agent-v2/guidance/base/product-recommendation.json`
- Test: `tests/agent-v2-guidance-compiler.spec.ts`

- [ ] **Step 1: Add failing guidance assertions**

Extend the product guidance test with:

```ts
assert.match(brief, /default to three products/i)
assert.match(brief, /respect the explicit count/i)
assert.match(brief, /Welche Spülung passt/i)
assert.match(brief, /concrete category-fit ask/i)
```

- [ ] **Step 2: Update product markdown guidance**

Add to `## Product Recommendation Shape`:

```md
Default to three products when the user asks for a product recommendation without naming a count. Respect the explicit count when the user asks for one or two products. If the user asks for more than three, cap the answer at three. If the tool returns fewer valid products, show only the valid products.
```

Add a new section:

```md
## Concrete Category-Fit Asks
Treat phrasing like "Welche Spülung passt zu ...?", "Welcher Conditioner passt ...?", "Welche Maske passt ...?", or "Welches Shampoo soll ich nehmen?" as a concrete product recommendation ask.

Do not answer these as generic category education after `select_products` has returned products. Category education is still correct for questions like "Was macht Conditioner?", "Brauche ich Maske oder Conditioner?", or "Welche Art von Conditioner passt?".
```

- [ ] **Step 3: Update product rubrics**

Add:

```json
{
  "rubric_id": "product.respect_requested_count",
  "priority": "high",
  "source": "base/product-recommendation.md",
  "message": "Default to three product recommendations, but respect an explicit user request for one or two products and cap requests above three at three."
},
{
  "rubric_id": "product.category_fit_asks_are_recommendations",
  "priority": "high",
  "source": "base/product-recommendation.md",
  "message": "Concrete category-fit wording such as 'Welche Spülung passt?' should be fulfilled as a product recommendation."
}
```

## Task 4: Advisor Answer Shape Guidance

**Files:**
- Modify: `data/agent-v2/guidance/base/tone-and-format.md`
- Modify: `data/agent-v2/guidance/base/tone-and-format.json`
- Test: `tests/agent-v2-guidance-compiler.spec.ts`

- [ ] **Step 1: Add failing tone guidance assertions**

Extend `tone guidance asks for warm light structure`:

```ts
assert.match(brief, /direct answer first/i)
assert.match(brief, /profile-linked why/i)
assert.match(brief, /Bullets are for sibling options/i)
assert.match(brief, /Do not put a subheader above a long stack of bullets/i)
assert.match(brief, /one practical next step or caveat/i)
```

- [ ] **Step 2: Update tone markdown**

Replace or extend `## Warm Helpful Structure`:

```md
## Advisor Answer Frame
Use this frame as a preference, not a rigid template:

1. Give the direct answer first.
2. Add a profile-linked why: one or two natural sentences connecting the advice to the user's profile, concern, routine, or constraints.
3. Use light structure only when it helps scanning.
4. End with one practical next step or caveat.

The answer should feel warm, specific, and complete, not clipped.
```

Add:

```md
## Bullet And Section Discipline
Bullets are for sibling options, short comparisons, or compact step lists. Do not put a subheader above a long stack of bullets when one short paragraph would feel more human.

Prefer:
**Warum das passt:** one short paragraph.
**So nutzt du es:** one short paragraph or two compact steps.

Avoid:
**Warum das passt:**
- tiny fact
- tiny fact
- tiny fact
- tiny fact
```

- [ ] **Step 3: Update tone rubrics**

Add:

```json
{
  "rubric_id": "tone.advisor_answer_frame",
  "priority": "high",
  "source": "base/tone-and-format.md",
  "message": "Prefer direct answer first, profile-linked why, light structure, and one practical next step or caveat."
},
{
  "rubric_id": "tone.no_bullet_wall_after_subheader",
  "priority": "medium",
  "source": "base/tone-and-format.md",
  "message": "Use bullets for sibling options or compact steps; avoid subheaders followed by long stacks of small bullets."
}
```

## Task 5: Positive Reference Quality Cases

**Files:**
- Modify: `data/agent-v2/evals/positive-reference-cases.json`
- Test: `tests/agent-v2-contracts.spec.ts` or a new `tests/agent-v2-positive-references.spec.ts`

- [ ] **Step 1: Add failing fixture test**

Add a test that loads `positive-reference-cases.json` and asserts each entry has:

```ts
id: string
source: "manual_review"
prompt or turns
positive_feedback_note: string
qualities_to_preserve: string[]
requires_textual_match: false
```

Also assert at least these quality labels appear somewhere:

```ts
"product recommendation fulfilled"
"explicit count respected"
"direct answer first"
"profile-linked why"
"category education first"
"no forced product recommendation"
```

- [ ] **Step 2: Add positive reference entries from recent manual runs**

Add entries for:

```json
{
  "id": "manual-positive-conditioner-product-ask-2026-05-15",
  "source": "manual_review",
  "prompt": "Mein Haar ist nach dem Waschen trocken und strohig, welchen Conditioner soll ich nehmen?",
  "positive_feedback_note": "Good because it gives a warm intro, three grounded conditioner options, one natural fit sentence per product, and a short practical caveat.",
  "qualities_to_preserve": ["product recommendation fulfilled", "three product default", "one natural fit sentence per product", "profile-linked why", "practical caveat"],
  "requires_textual_match": false
}
```

```json
{
  "id": "manual-positive-mask-spliss-education-2026-05-15",
  "source": "manual_review",
  "prompt": "Kann eine Maske Spliss reparieren oder nur kaschieren?",
  "positive_feedback_note": "Good because it answers directly, separates what a mask can and cannot do, and gives practical advice without forcing products.",
  "qualities_to_preserve": ["direct answer first", "category education first", "no forced product recommendation", "light structure", "practical caveat"],
  "requires_textual_match": false
}
```

```json
{
  "id": "manual-positive-shampoo-dry-lengths-2026-05-15",
  "source": "manual_review",
  "prompt": "Meine Laengen sind trocken, brauche ich ein anderes Shampoo?",
  "positive_feedback_note": "Good because it does not force a shampoo recommendation and explains that dry lengths are usually influenced more by conditioner, leave-in, and ends care.",
  "qualities_to_preserve": ["direct answer first", "profile-linked why", "no forced product recommendation", "better lever explanation"],
  "requires_textual_match": false
}
```

```json
{
  "id": "manual-positive-two-product-count-2026-05-15",
  "source": "manual_review",
  "prompt": "Vergleich mir bitte zwei passende Conditioner für feines Haar.",
  "positive_feedback_note": "The desired behavior is to respect the explicit request for two products, not default to three.",
  "qualities_to_preserve": ["explicit count respected", "product recommendation fulfilled", "profile-linked why"],
  "requires_textual_match": false
}
```

## Task 6: Verification

**Automated checks:**

- [ ] Run guidance tests:

```bash
npx tsx --test tests/agent-v2-guidance-compiler.spec.ts
```

Expected: all tests pass.

- [ ] Run validator/runtime tests:

```bash
npx tsx --test tests/agent-v2-final-answer-validator.spec.ts tests/agent-v2-responses-runtime.spec.ts
```

Expected: all tests pass.

- [ ] Run focused AgentV2/Compare suite:

```bash
npx tsx --test tests/agent-v2-contracts.spec.ts tests/agent-v2-guidance-compiler.spec.ts tests/agent-v2-tool-projections.spec.ts tests/agent-v2-final-answer-validator.spec.ts tests/agent-v2-responses-runtime.spec.ts tests/agent-v2-compare-runner.spec.ts tests/agent-compare-api.spec.ts tests/agent-compare-product-trace.spec.ts tests/agent-compare-runner.spec.ts
```

Expected: all tests pass.

- [ ] Run repo checks:

```bash
npm run typecheck
npm run lint
git diff --check
```

Expected: typecheck passes, lint has no new errors, whitespace check passes.

**Manual Compare Lab checks:**

- [ ] Run single-turn:

```txt
Welche Spülung passt zu coloriertem, strapaziertem Haar?
```

Expected AgentV2:
- calls `load_advisor_guidance -> select_products`
- final answer mode is `product_recommendation`
- shows products, not generic advice
- no validation errors after final answer

- [ ] Run single-turn:

```txt
Vergleich mir bitte zwei passende Conditioner für feines Haar.
```

Expected AgentV2:
- returns exactly two products if the tool returns at least two valid products
- no third product in the user-facing answer
- no validation errors after final answer

- [ ] Run single-turn:

```txt
Kann eine Maske Spliss reparieren oder nur kaschieren?
```

Expected AgentV2:
- final answer mode `general_advice`
- no product recommendation by default
- direct answer first, then what it can/cannot do, then practical caveat

**Ready-check:** Because this changes recommendations, copy, and trust-facing answer behavior, use `ready-check` before claiming the branch is ready.

## Execution Handoff

Recommended execution mode: `superpowers:subagent-driven-development`, with workers split by file ownership:

- Worker A: runtime detection and validator tests/implementation.
- Worker B: guidance markdown/json and guidance compiler tests.
- Worker C: positive reference fixtures and fixture tests.

After workers finish, the main agent should review diffs, run the focused suite, run manual Compare Lab checks, then request code review.
