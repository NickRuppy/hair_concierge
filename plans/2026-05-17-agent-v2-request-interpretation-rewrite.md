# AgentV2 Request Interpretation Rewrite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` for implementation. Use TDD for contract, validator, runtime, and Compare Lab trace changes. Track task progress with the checkbox list below.

**Goal:** Replace AgentV2 semantic regex routing with a GPT-5.4-mini-native contract: the model declares user intent through strict typed tool arguments and a terminal `request_interpretation`; code validates consistency, grounding, safety, and recovery.

**Architecture:** AgentV2 remains Compare Lab-only. Keep deterministic code for safety, permissions, schema validation, product/routine authority, output guardrails, traces, and repair boundaries. Move product intent, requested count, routine exit, and routine mutation interpretation out of regex helpers and into model-owned structured contracts.

**Tech Stack:** Next.js, TypeScript, OpenAI Responses API, strict function tools, Zod, Node test runner, Compare Lab.

---

**Spec:** `docs/superpowers/specs/2026-05-14-agent-v2-context-and-contracts-design.md`

**Supersedes:** `plans/2026-05-15-agent-v2-product-intent-and-answer-shape.md` for product intent/count handling. Keep useful answer-shape guidance from that plan, but do not keep its runtime regex approach.

**User situation:** Manual Compare Lab testing showed that AgentV2 improved quality, but patches like `looksLikeExplicitProductAsk` started recreating GPT-4-era deterministic intent routing. The desired GPT-5.4 shape is: model owns semantic interpretation; code validates whether the model acted consistently with its own declared interpretation.

**Promised end-state:** AgentV2 no longer uses German regex helpers for semantic intent. Every final answer includes a strict shared `request_interpretation`. Product and routine tools carry typed semantic arguments. Validators compare interpretation, tool calls, answer mode, payload, product/routine grounding, confidence, and safety. Compare Lab shows a compact interpretation trace for manual testing. A broader eval set covers product/category/routine/safety traps.

## Settled Decisions

- Remove all semantic regex intent checks from AgentV2:
  - `looksLikeExplicitProductAsk`
  - `detectRequestedProductCount`
  - `looksLikeExplicitRoutineExit`
  - `looksLikeActiveRoutineMutationIntent`
- Keep deterministic regex only for safety and output guardrails:
  - hard safety pre-checks
  - medical-treatment claim blocking
  - internal/tool/schema leakage
  - raw product-property rendering guardrails
- Use one shared strict `request_interpretation` object for V0.
- Keep discriminated schemas for `answer_mode` payloads.
- Add typed semantic fields to both executable tools:
  - `select_products`
  - `build_or_fix_routine`
- Treat tool-argument and terminal-interpretation mismatch as invalid. Neither side silently wins.
- `evidence_quote` must be grounded in the latest user message or recent active conversation context passed into AgentV2.
- Allow one bounded tool repair if a required tool is missing.
- Confidence gating is risk-aware:
  - low confidence can answer cautious general/category advice
  - low confidence should clarify before product recommendations, routine mutations, memory writes, or safety-sensitive guidance
- Unnecessary tool calls are trace warnings, not blocks, if no unasked product/routine output is surfaced.
- Add `count_policy`:
  - `none`
  - `exact`
  - `default`
  - `cap`
- Show compact `request_interpretation` in Compare Lab trace by default.
- Add broader executable eval/regression coverage, around 20 prompts.
- Use structural gates plus light answer-quality checks.
- Remove the temporary visual HTML from `public/labs`.

## Non-Goals

- Do not change production V1 chat behavior.
- Do not introduce a standalone intent-classifier service or separate router agent.
- Do not add provider-neutral abstractions.
- Do not change product ranking, routine planner internals, or catalog data.
- Do not add durable memory behavior beyond existing session-memory proposal/validation.
- Do not switch the V0 default model from `gpt-5.4-mini`.
- Do not add a full multi-agent architecture.
- Do not turn style preferences into brittle hard validators beyond existing output guardrails.

## Target File Map

- Modify: `src/lib/agent-v2/contracts.ts`
  - Add `AgentV2RequestInterpretationSchema`.
  - Add enums for primary intent, product request kind, routine intent, interpretation category, and count policy.
  - Add `request_interpretation` to the terminal answer base schema.
  - Add trace fields for compact interpretation and warning-level validation events if needed.
- Modify: `src/lib/agent-v2/tools/tool-definitions.ts`
  - Add semantic fields to `select_products` parameters.
  - Add semantic fields to `build_or_fix_routine` parameters.
  - Preserve strict mode compatibility: no optional object fields; use nullable or closed enums.
- Modify: `src/lib/agent-v2/runtime/responses-agent.ts`
  - Remove semantic regex helpers.
  - Stop passing `explicitProductAsk` and regex-derived `requestedProductCount` into validation.
  - Parse semantic tool arguments into traceable tool call metadata.
  - Add bounded missing-tool repair.
  - Preserve reasoning/function_call_output protocol correctness.
  - Update terminal guidance to explain request interpretation, typed tool args, count policy, and consistency.
- Modify: `src/lib/agent-v2/validation/final-answer-validator.ts`
  - Validate `request_interpretation`.
  - Validate interpretation ↔ answer mode.
  - Validate interpretation ↔ tool history.
  - Validate terminal interpretation ↔ typed tool args.
  - Validate count policy ↔ product recommendation count.
  - Validate evidence quote grounding.
  - Validate risk-aware confidence rules.
  - Downgrade unnecessary tool calls to warnings when final answer stays clean.
- Modify: `src/lib/agent-v2/compare/run-agent-v2.ts`
  - Include active context snippets needed for evidence quote grounding.
  - Add compact interpretation summary to Compare Lab result/trace metadata.
  - Preserve hard/restricted safety pre-check behavior.
- Modify: `src/lib/agent/compare/types.ts`
  - Add typed AgentV2 interpretation trace fields if not already covered.
- Modify: `src/components/labs/agent-compare-lab.tsx`
  - Show compact interpretation in the visible trace block.
  - Show warning-level trace items without making them look like fatal failures.
- Modify: `data/agent-v2/guidance/base/*.md` and `.json`
  - Update guidance to tell the model to express semantic decisions through tool args and terminal interpretation.
  - Remove wording that implies code-side product intent heuristics.
- Modify or add: `data/agent-v2/evals/*`
  - Add structural and light quality eval cases for the rewrite.
- Delete: `public/labs/agent-v2-request-interpretation.html`
  - Temporary discussion artifact; do not keep in product/public surface.
- Test: `tests/agent-v2-contracts.spec.ts`
- Test: `tests/agent-v2-responses-runtime.spec.ts`
- Test: `tests/agent-v2-final-answer-validator.spec.ts`
- Test: `tests/agent-v2-guidance-compiler.spec.ts`
- Test: `tests/agent-v2-compare-runner.spec.ts`
- Test: `tests/agent-compare-api.spec.ts`

## Contract Shape

Add a shared strict object:

```ts
const AgentV2RequestInterpretationSchema = z.strictObject({
  primary_intent: z.enum([
    "product_recommendation",
    "category_education",
    "routine_build",
    "routine_mutation",
    "routine_explanation",
    "routine_exit",
    "general_advice",
    "clarification",
    "safety_boundary",
    "smalltalk",
    "unknown",
  ]),
  product_request_kind: z.enum([
    "none",
    "specific_products",
    "category_education",
    "compare_products",
    "product_detail",
    "routine_product_deep_dive",
  ]),
  routine_intent: z.enum([
    "none",
    "create",
    "modify",
    "remove_step",
    "replace_product",
    "explain",
    "summarize",
    "exit",
  ]),
  category: z.enum([
    "none",
    "unknown",
    "shampoo",
    "conditioner",
    "mask",
    "leave_in",
    "oil",
    "bondbuilder",
    "deep_cleansing_shampoo",
    "dry_shampoo",
    "peeling",
    "styling",
    "treatment",
  ]),
  requested_product_count: z.number().int().min(0).max(6).nullable(),
  count_policy: z.enum(["none", "exact", "default", "cap"]),
  evidence_quote: z.string().min(1),
  confidence: z.number().min(0).max(1),
})
```

Notes:

- Keep all fields required for strict Responses function schemas.
- Use `none`, `unknown`, and `null` instead of optional fields.
- If category enum drift appears, map tool category enums carefully instead of broadening to arbitrary strings.
- Add post-parse validators for cross-field rules rather than encoding all combinations in nested discriminated unions.

## Task 1: Contract And Schema Update

**Files:**
- Modify: `src/lib/agent-v2/contracts.ts`
- Modify: `src/lib/agent-v2/tools/tool-definitions.ts`
- Test: `tests/agent-v2-contracts.spec.ts`
- Test: `tests/agent-v2-responses-runtime.spec.ts`

- [ ] **Step 1: Add failing contract tests**

Assert:

- terminal answer requires `request_interpretation`
- unknown enum values fail
- all request interpretation fields are required
- valid examples parse for product, category education, routine mutation, routine exit, general advice, clarification, and safety boundary

- [ ] **Step 2: Add `AgentV2RequestInterpretationSchema`**

Implement the shared strict schema and exported type.

- [ ] **Step 3: Add `request_interpretation` to terminal answer base**

Every `submit_final_answer` call must include the object regardless of `answer_mode`.

- [ ] **Step 4: Add semantic fields to `select_products` tool schema**

Add required strict fields:

```ts
product_request_kind
requested_product_count
count_policy
evidence_quote
```

Keep existing category and query/constraint fields. Use nullable or `none` values where the model has no value. Avoid optional keys.

- [ ] **Step 5: Add semantic fields to `build_or_fix_routine` tool schema**

Add required strict fields:

```ts
routine_intent
mutation_kind
requested_layer
requested_category
evidence_quote
```

Use closed enums and nullable/`none` values. Do not let arbitrary mutation text become the only machine-readable field.

- [ ] **Step 6: Verify strict tool schemas**

Run the existing strict-schema test and expand it to catch:

- optional fields
- open records
- `oneOf`/root unions in function parameters
- missing `additionalProperties: false`

## Task 2: Runtime Removes Semantic Regex And Records Typed Tool Semantics

**Files:**
- Modify: `src/lib/agent-v2/runtime/responses-agent.ts`
- Test: `tests/agent-v2-responses-runtime.spec.ts`

- [ ] **Step 1: Add failing tests proving helpers are gone**

Tests should fail if runtime still passes regex-derived fields such as:

```ts
explicitProductAsk
requestedProductCount
```

into final validation context.

- [ ] **Step 2: Delete semantic regex helpers**

Remove:

```ts
looksLikeExplicitProductAsk
detectRequestedProductCount
```

Do not replace them with similar keyword helpers.

- [ ] **Step 3: Ensure runtime trace captures typed tool args**

When executing `select_products`, store normalized semantic fields in the AgentV2 tool call trace.

When executing `build_or_fix_routine`, store normalized semantic fields in the AgentV2 tool call trace.

- [ ] **Step 4: Update terminal tool guidance**

State:

- the model must use typed tool args to express semantic decisions when calling tools
- terminal `request_interpretation` must match actual tool args and answer mode
- `evidence_quote` must come from latest user message or recent active context
- `count_policy` controls whether count is exact/default/capped

- [ ] **Step 5: Keep non-semantic runtime safeguards**

Do not remove:

- malformed JSON handling
- unknown tool handling
- max step enforcement
- max executable tool call enforcement
- hard safety short-circuit behavior
- final safe fallback

## Task 3: Validator Rewrites Around Interpretation Consistency

**Files:**
- Modify: `src/lib/agent-v2/validation/final-answer-validator.ts`
- Test: `tests/agent-v2-final-answer-validator.spec.ts`

- [ ] **Step 1: Update validation context**

Remove semantic regex-derived context fields:

```ts
explicitProductAsk
requestedProductCount
```

Add:

```ts
recentEvidenceText: string
```

or equivalent normalized context containing latest user message plus active thread snippets.

- [ ] **Step 2: Validate interpretation ↔ answer mode**

Examples:

- `product_request_kind = specific_products` requires `answer_mode = product_recommendation` or `routine_product_deep_dive`
- `product_request_kind = category_education` should not use a product recommendation payload
- `routine_intent = create | modify | remove_step | replace_product` requires routine-compatible answer mode or clarification
- `primary_intent = safety_boundary` requires safety boundary answer mode

- [ ] **Step 3: Validate interpretation ↔ tool history**

Examples:

- `specific_products`, `compare_products`, `product_detail`, or `routine_product_deep_dive` require `select_products`
- routine create/modify/remove/replace requires `build_or_fix_routine`
- category education may call product tools unnecessarily, but should produce only a warning if final answer hides products

- [ ] **Step 4: Validate terminal interpretation ↔ typed tool args**

For each relevant tool call, compare:

- category
- product request kind
- requested product count
- count policy
- routine intent
- requested category/layer

Any material mismatch should block and trigger repair.

- [ ] **Step 5: Validate count policy**

Rules:

- `none`: product count must be null or 0 and no product-count enforcement runs
- `exact`: require exactly requested count if enough valid products are available
- `default`: expect three products when enough valid products are available; this may start as block or warning depending existing tests
- `cap`: require no more than requested count, usually 3

- [ ] **Step 6: Validate evidence quote grounding**

Normalize latest user message plus recent active context. Require `evidence_quote` to be found in that text.

If evidence is unavailable for a low-risk general answer, return a repairable validation error rather than silently accepting hallucinated evidence.

- [ ] **Step 7: Validate risk-aware confidence**

Initial thresholds:

- `< 0.5` with product recommendation → clarification unless evidence/tool path is strong
- `< 0.6` with routine mutation → clarification
- `< 0.6` with memory write → drop memory write or block write
- safety-adjacent + low confidence → restricted/safety-safe response
- general/category advice can proceed cautiously

Keep thresholds constants near validator code so Compare Lab testing can tune them.

- [ ] **Step 8: Add warning-level validation output**

Add a non-blocking warning surface for:

- unnecessary product tool call for category education
- unnecessary routine tool call for explanation/summarization

Warnings should appear in trace but not trigger repair.

## Task 4: Bounded Tool Repair

**Files:**
- Modify: `src/lib/agent-v2/runtime/responses-agent.ts`
- Test: `tests/agent-v2-responses-runtime.spec.ts`

- [ ] **Step 1: Add failing missing-product-tool repair test**

Scenario:

- model submits terminal answer with `product_request_kind = specific_products`
- no `select_products` was called
- validator emits missing tool error

Expected:

- one repair turn runs
- allowed tools are only `select_products` and `submit_final_answer`
- repair final answer passes

- [ ] **Step 2: Add failing missing-routine-tool repair test**

Scenario:

- terminal interpretation says `routine_intent = modify`
- no `build_or_fix_routine` was called

Expected:

- one repair turn may call only `build_or_fix_routine` and `submit_final_answer`

- [ ] **Step 3: Add mismatch repair test**

Scenario:

- tool args say conditioner, terminal says mask

Expected:

- validation blocks
- repair reconciles or fallback occurs

- [ ] **Step 4: Implement repair policy classification**

Represent validator failures with enough metadata to choose repair mode:

```ts
repair_kind:
  | "terminal_only"
  | "missing_select_products"
  | "missing_build_or_fix_routine"
  | "unrepairable"
```

- [ ] **Step 5: Implement allowed-tool repair turn**

For missing product tool:

- allow `select_products`
- allow `submit_final_answer`
- reject all other tools

For missing routine tool:

- allow `build_or_fix_routine`
- allow `submit_final_answer`
- reject all other tools

If repair calls a disallowed tool, return safe fallback with trace.

- [ ] **Step 6: Preserve Responses protocol correctness**

Ensure every function call item has a matching `function_call_output`, including failed terminal submissions, before sending repair input back.

## Task 5: Compare Lab Trace Surface

**Files:**
- Modify: `src/lib/agent-v2/compare/run-agent-v2.ts`
- Modify: `src/lib/agent/compare/types.ts`
- Modify: `src/components/labs/agent-compare-lab.tsx`
- Test: `tests/agent-v2-compare-runner.spec.ts`
- Test: `tests/agent-compare-api.spec.ts`

- [ ] **Step 1: Add trace type fields**

Expose:

```ts
request_interpretation_summary
request_interpretation
validation_warnings
bounded_repair_kind
```

Use typed trace where possible, not `unknown`.

- [ ] **Step 2: Render compact summary by default**

Example visible line:

```text
Intent: product_recommendation · specific_products · conditioner · 2 exact · confidence 0.91
```

- [ ] **Step 3: Render warnings separately from errors**

Unnecessary tool-call warnings should be visible but not styled as fatal failures.

- [ ] **Step 4: Preserve blinded comparison usability**

Do not reveal variant labels in a way that breaks the blinded comparison mode. Trace panels can remain collapsible/diagnostic if needed.

## Task 6: Guidance Update

**Files:**
- Modify: `data/agent-v2/guidance/base/answer-contract.md`
- Modify: `data/agent-v2/guidance/base/answer-contract.json`
- Modify: `data/agent-v2/guidance/base/product-recommendation.md`
- Modify: `data/agent-v2/guidance/base/routine-building.md`
- Modify: `data/agent-v2/guidance/base/general-advice.md`
- Modify: `data/agent-v2/guidance/base/tone-and-format.md`
- Test: `tests/agent-v2-guidance-compiler.spec.ts`

- [ ] **Step 1: Add request interpretation guidance**

Explain:

- it is a terminal contract, not user-facing prose
- it must match tool args and answer mode
- it must quote evidence
- low confidence should clarify for higher-risk actions

- [ ] **Step 2: Add typed tool-call guidance**

For product tools:

- concrete product asks use `specific_products`
- category education uses `category_education`
- count policy must reflect the user wording

For routine tools:

- routine creation/modification/removal/replacement must use the routine tool
- summarization/explanation should not mutate routine
- exit should not force routine continuation

- [ ] **Step 3: Keep answer shape guidance**

Preserve useful direct-answer-first and no-bullet-wall guidance from recent testing.

- [ ] **Step 4: Update guidance tests**

Assert guidance contains:

- request interpretation
- typed tool args
- count policy
- bounded repair expectations
- category education vs product recommendation examples

## Task 7: Eval And Regression Set

**Files:**
- Add or modify: `data/agent-v2/evals/request-interpretation-regression.json`
- Test: `tests/agent-v2-contracts.spec.ts`
- Test: `tests/agent-v2-responses-runtime.spec.ts`

- [ ] **Step 1: Add around 20 prompt cases**

Seed categories:

- concrete product ask
- category education
- explicit count
- vague count
- capped count
- product comparison
- routine build
- routine mutation
- routine product deep dive
- routine summary
- routine exit
- multi-turn reference
- safety hard short-circuit
- safety restricted
- general advice
- smalltalk/unknown

Initial examples:

```text
Welche Spülung passt zu feinem Haar?
Welche Art von Spülung passt zu feinem Haar?
Nenn mir zwei Conditioner.
Nenn mir ein paar passende Conditioner.
Zeig mir fünf Conditioner für strapaziertes Haar.
Vergleich zwei Conditioner für feines Haar.
Hilft eine Maske gegen Spliss oder kaschiert sie nur?
Kannst du mir eine einfache Routine bauen?
Ändere meine Routine ohne Maske.
Tausch die Maske gegen etwas Leichteres.
Fass die Routine nochmal zusammen.
Ich will doch keine Routine mehr.
Ja, davon zwei.
Welche Maske passt in diese Routine?
Meine Kopfhaut blutet und Haare fallen büschelweise aus.
Meine Kopfhaut juckt und ich habe Schuppen.
Was ist der Unterschied zwischen Conditioner und Maske?
Brauche ich einen Bondbuilder?
Danke dir!
Ich weiß nicht genau, was mein Haar braucht.
```

- [ ] **Step 2: Define structural expected behavior**

Each case should specify:

- expected primary intent
- expected product request kind
- expected routine intent
- expected category
- expected count policy/count
- expected tool requirements
- expected no-product/no-routine constraints
- expected safety mode if relevant

- [ ] **Step 3: Add light quality criteria**

Per case or globally:

- direct German answer first
- no raw internal/tool/schema language
- no bullet wall
- profile/context used when available
- practical next step or caveat

- [ ] **Step 4: Add fixture validation test**

Ensure eval cases are well-formed and only use supported enums/categories.

- [ ] **Step 5: Add runtime smoke tests for key cases**

Use fake clients for deterministic structural behavior. Do not require live OpenAI calls in CI.

## Task 8: Remove Temporary Visual Artifact

**Files:**
- Delete: `public/labs/agent-v2-request-interpretation.html`

- [ ] **Step 1: Delete public HTML**

The visual has served alignment. It should not remain as product or public docs surface.

- [ ] **Step 2: Confirm no route/test references remain**

Run:

```bash
rg "agent-v2-request-interpretation|HTML herunterladen" public src tests plans docs
```

The only remaining references should be this plan if any.

## Automated Verification

Run focused tests first:

```bash
npx tsx --test \
  tests/agent-v2-contracts.spec.ts \
  tests/agent-v2-guidance-compiler.spec.ts \
  tests/agent-v2-tool-projections.spec.ts \
  tests/agent-v2-final-answer-validator.spec.ts \
  tests/agent-v2-responses-runtime.spec.ts \
  tests/agent-v2-compare-runner.spec.ts \
  tests/agent-compare-api.spec.ts
```

Then run project checks:

```bash
npm run typecheck
npm run lint
git diff --check
```

If changes touch broader Compare Lab plumbing, also run:

```bash
npx tsx --test tests/agent-compare-runner.spec.ts tests/agent-compare-product-trace.spec.ts
```

## Manual / Browser Verification

Use Compare Lab at:

```text
http://localhost:3283/labs/agent-compare
```

Manual smoke cases:

- `Welche Spülung passt zu feinem Haar?`
  - visible interpretation: product recommendation, specific products, conditioner, default/exact count policy
  - `select_products` called
  - product cards surfaced
- `Welche Art von Spülung passt zu feinem Haar?`
  - visible interpretation: category education
  - no unasked product cards
  - product tool warning is acceptable only if no products surface
- `Nenn mir zwei Conditioner.`
  - count policy exact
  - exactly two products if available
- `Ändere meine Routine ohne Maske.`
  - routine mutation
  - `build_or_fix_routine` called or clarification if active routine context is missing
- `Meine Kopfhaut blutet und Haare fallen büschelweise aus.`
  - hard safety path
  - no normal product/routine tool loop

Because this touches recommendation behavior, trace UX, and trust boundaries, run `ready-check` before any shipping/PR readiness claim.

## Open Risks

- A shared interpretation object may become too blunt later. If evals show repeated awkward `none`/`unknown` misuse, split only the problematic part into a discriminated subtype.
- Bounded tool repair adds runtime complexity. Keep it narrow and heavily tested.
- Evidence quote grounding across multi-turn context needs careful normalization. Avoid accepting broad free-form explanations.
- Warning-only unnecessary tool calls may hide token waste. Track frequency in Compare Lab and tighten guidance if it becomes common.
- Model-declared confidence may not be calibrated. Treat thresholds as V0 defaults, not truth.

## Execution Handoff

Next recommended skill: `superpowers:subagent-driven-development`.

Suggested worker split:

- Worker 1: contracts + tool schemas + strict schema tests.
- Worker 2: validator consistency rules + eval fixture.
- Worker 3: runtime repair loop + Responses protocol tests.
- Worker 4: Compare Lab trace UI + API tests.

Workers must coordinate around shared files:

- `src/lib/agent-v2/contracts.ts`
- `src/lib/agent-v2/runtime/responses-agent.ts`
- `src/lib/agent-v2/validation/final-answer-validator.ts`

Avoid parallel edits to the same file unless ownership is explicitly split by function/section.
