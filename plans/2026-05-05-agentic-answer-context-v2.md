# Agentic Answer Context V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the agentic tool loop lightweight, relevant answer-rendering context so it keeps its stronger multi-turn intent carry while reusing classic's category/routine answer wisdom.

**Architecture:** Add a model-visible render context broker that selects compact guidance capsules from tool outputs, conversation state, and the current turn. Try both consumption strategies in Compare Lab: inline context injected into the post-tool agent step, and a separate contextual composer call after tool/state resolution. Product/routine tools stay deterministic and authoritative.

**Tech Stack:** Next.js App Router, TypeScript, OpenAI chat completions, existing deterministic recommendation/routine tools, Compare Lab.

---

## Non-Goals

- Do not wire production chat.
- Do not build the broader eval infrastructure now.
- Do not replace deterministic `select_products` or `build_or_fix_routine`.
- Do not depend on `ConversationContextPacketV1`.
- Do not turn category guidance into rigid user-facing templates.

## File Map

- Create `src/lib/agent/orchestrator/agentic-answer-context.ts`: owns render capsules and builds compact answer context from tool outputs.
- Modify `src/lib/agent/orchestrator/agentic-tool-loop-types.ts`: adds answer composition mode, answer context trace, and optional composer method.
- Modify `src/lib/agent/orchestrator/model-client.ts`: adds the separate composer implementation while preserving existing `runStep`.
- Modify `src/lib/agent/orchestrator/run-agentic-tool-turn.ts`: injects inline answer context and optionally runs composer mode.
- Modify `src/lib/agent/orchestrator/prompt.ts`: replaces scattered prompt-specific additions with concise rules for using render context.
- Modify `src/lib/agent/compare/run-agentic-tool-loop.ts`: allows Compare Lab to run `tool_loop`, `tool_loop_inline_context`, and `tool_loop_composer_context`.
- Modify `src/lib/agent/compare/types.ts`: adds compare-system labels and trace shape for answer context.
- Modify `src/app/api/labs/agent-compare/route.ts`: accepts an agent variant selector.
- Modify `src/components/labs/agent-compare-lab.tsx`: adds a German selector for agent variant.
- Modify `tests/agent-final-render-prompt.spec.ts`: verifies prompt contract and capsule presence.
- Modify `tests/agentic-tool-loop.spec.ts`: verifies inline and composer modes.
- Modify `tests/agent-compare-api.spec.ts` and `tests/agent-compare-runner.spec.ts`: verifies Compare Lab variant plumbing.

## Task 1: Add Answer Context Capsules

**Files:**
- Create: `src/lib/agent/orchestrator/agentic-answer-context.ts`
- Test: `tests/agent-final-render-prompt.spec.ts`

- [ ] **Step 1: Write failing tests for capsule selection**

Add tests that assert conditioner recommendations get product-comparison guidance, leave-in usage gets usage guidance, shampoo redirects get better-lever guidance, and routine goals get broad-goal guidance:

```ts
import {
  buildAgenticAnswerContext,
} from "../src/lib/agent/orchestrator/agentic-answer-context"

test("agentic answer context selects product capsules for conditioner recommendations", () => {
  const context = buildAgenticAnswerContext({
    latestUserMessage: "welchen conditioner brauche ich",
    selectedProducts: {
      category: "conditioner",
      decision: "recommended",
      product_response_policy: "recommend",
      policy_reason: "Conditioner folgt Gewicht und Balance.",
      profile_basis: ["Haardicke: Mittel", "Protein-/Feuchtigkeitsbalance: Proteinmangel"],
      category_guidance: "Conditioner ist der Pflegeanker.",
      products: [],
      comparison_facts: null,
      missing_info: [],
      unsupported_requested_signals: [],
    },
    routinePlan: null,
    toolCalls: [{ name: "select_products", input: { userJob: "product_pick", category: "conditioner" } }],
    conversationState: null,
  })

  assert.deepEqual(context.capsule_ids, [
    "global.natural_consultant",
    "product.recommendation_shape",
    "category.conditioner.recommend",
  ])
  assert.match(context.instructions.join("\n"), /erst kurz.*welcher Typ Conditioner/i)
})
```

- [ ] **Step 2: Implement capsule module**

Create `agentic-answer-context.ts` with:

```ts
export type AgenticAnswerCapsuleId =
  | "global.natural_consultant"
  | "product.recommendation_shape"
  | "product.usage_shape"
  | "product.redirect_to_better_lever"
  | "category.conditioner.recommend"
  | "category.leave_in.recommend"
  | "category.leave_in.usage"
  | "category.mask.optional_decision"
  | "category.shampoo.redirect"
  | "routine.broad_goal"
  | "routine.layered_answer"
  | "followup.proactive_next_step"

export interface AgenticAnswerContext {
  capsule_ids: AgenticAnswerCapsuleId[]
  instructions: string[]
  examples: string[]
}
```

Use compact German guidance, not templates. Example instructions:

```ts
"Bei Produktantworten zuerst in 1-2 Saetzen erklaeren, welcher Produkttyp fuer dieses Profil sinnvoll ist; danach die Tool-Produkte als unterschiedliche Optionen darstellen."
"Produktclaims nur aus supported_claims verwenden. Nicht jede Claim-Zeile ausgeben; waehle die 1-2 nutzerrelevantesten Unterschiede."
"Bei Leave-in-Anwendung die konkrete Routine des Nutzers einbinden, z.B. Wasch-/Foehnrhythmus, Dosierung und Laengen/Spitzen."
```

- [ ] **Step 3: Run tests**

Run:

```bash
npx tsx --test tests/agent-final-render-prompt.spec.ts
```

Expected: new capsule tests pass.

## Task 2: Inline Context Mode

**Files:**
- Modify: `src/lib/agent/orchestrator/run-agentic-tool-turn.ts`
- Modify: `src/lib/agent/orchestrator/prompt.ts`
- Modify: `src/lib/agent/orchestrator/agentic-tool-loop-types.ts`
- Test: `tests/agentic-tool-loop.spec.ts`

- [ ] **Step 1: Write failing inline-mode test**

Add a test that runs a fake `select_products` call and asserts the next model request contains `answer_context` with capsule IDs before `submit_final_answer`.

```ts
test("tool-loop injects answer context after product tools in inline mode", async () => {
  const modelClient = new FakeModelClient([
    { type: "tool_calls", calls: [{ name: "select_products", input: { category: "conditioner", userJob: "product_pick" } }] },
    { type: "final", answer: "Das ist die natuerliche Conditioner-Antwort.", statePatch: { active_topic: "conditioner", last_product_category: "conditioner" } },
  ])

  await runAgenticToolTurn({
    message: "was fuer einen conditioner brauche ich",
    recentMessages: [],
    modelClient,
    tools: {
      select_products: async () => createConditionerProjection(),
      build_or_fix_routine: async () => ({ objective: null, steps: [], missing_info: [], confidence: 0 }),
    },
    userContext: createUserContext(),
    conversationState: null,
    answerCompositionMode: "inline_context",
  })

  const serialized = JSON.stringify(modelClient.requests.at(-1)?.messages)
  assert.match(serialized, /answer_context/)
  assert.match(serialized, /category.conditioner.recommend/)
})
```

- [ ] **Step 2: Add mode and trace types**

In `agentic-tool-loop-types.ts`, add:

```ts
export type AgenticAnswerCompositionMode = "inline_context" | "composer_context"
```

Add `answer_context?: AgenticAnswerContext | null` to the trace and `answerCompositionMode?: AgenticAnswerCompositionMode` to params.

- [ ] **Step 3: Inject context in tool results**

In `run-agentic-tool-turn.ts`, build answer context after each accepted executable tool call and include it in the `tool` role JSON:

```ts
content: JSON.stringify({
  tool_name: call.name,
  output_key: call.name === "select_products" ? "selected_products" : "routine_plan",
  hard_rules: HARD_ANSWER_RULES,
  answer_context,
  output,
})
```

Also add one concise prompt line in `AGENTIC_TOOL_LOOP_PROMPT`:

```text
- Wenn answer_context vorhanden ist, nutze es als Stil-/Kompositionsbriefing. Es ist keine Vorlage und ersetzt nicht die Tool-Fakten.
```

- [ ] **Step 4: Run focused tests**

Run:

```bash
npx tsx --test tests/agentic-tool-loop.spec.ts tests/agent-final-render-prompt.spec.ts
```

Expected: all focused tests pass.

## Task 3: Separate Composer Mode

**Files:**
- Modify: `src/lib/agent/orchestrator/model-client.ts`
- Modify: `src/lib/agent/orchestrator/run-agentic-tool-turn.ts`
- Modify: `src/lib/agent/orchestrator/agentic-tool-loop-types.ts`
- Test: `tests/agentic-tool-loop.spec.ts`

- [ ] **Step 1: Add optional composer method**

Add to `AgenticToolLoopModelClient`:

```ts
composeFinalAnswer?(params: {
  systemPrompt: string
  message: string
  recentMessages: Array<{ role: "user" | "assistant"; content: string }>
  userContext: UserContextProjection
  conversationState: ConversationState | null | undefined
  selectedProducts: SelectedProductsProjection | null
  routinePlan: BuildOrFixRoutineProjection | null
  answerContext: AgenticAnswerContext
  draftAnswer: string
}): Promise<string>
```

- [ ] **Step 2: Implement OpenAI composer**

In `createOpenAIAgenticToolLoopModelClient`, implement `composeFinalAnswer` with generation name `agentic-tool-loop-contextual-composer`, `temperature: 0`, and a system prompt that says:

```text
Du bist Hair Concierge. Du renderst nur die finale natuerliche Antwort.
Tool-Fakten und Produktreihenfolge sind autoritativ.
answer_context ist ein Kompositionsbriefing, keine starre Vorlage.
Erfinde keine Produkte, Produktclaims oder Pflichtregeln.
```

- [ ] **Step 3: Run composer mode after terminal answer**

In `runAgenticToolTurn`, if `answerCompositionMode === "composer_context"` and `modelClient.composeFinalAnswer` exists, call it after the terminal answer is parsed. Use the terminal answer as `draftAnswer`, then return the composed answer with the same state transition and trace.

- [ ] **Step 4: Add composer test**

Extend `FakeModelClient` with `composeFinalAnswer` support and assert the returned `final_answer` is the composer answer while the state patch remains from `submit_final_answer`.

- [ ] **Step 5: Run focused tests**

Run:

```bash
npx tsx --test tests/agentic-tool-loop.spec.ts
```

Expected: all tests pass.

## Task 4: Compare Lab Variant Selector

**Files:**
- Modify: `src/lib/agent/compare/types.ts`
- Modify: `src/lib/agent/compare/run-agentic-tool-loop.ts`
- Modify: `src/app/api/labs/agent-compare/route.ts`
- Modify: `src/components/labs/agent-compare-lab.tsx`
- Test: `tests/agent-compare-api.spec.ts`
- Test: `tests/agent-compare-runner.spec.ts`

- [ ] **Step 1: Add request type**

Add:

```ts
export type AgentCompareToolLoopVariant =
  | "baseline"
  | "inline_context"
  | "composer_context"
```

Add `toolLoopVariant?: AgentCompareToolLoopVariant` to user compare request/response types.

- [ ] **Step 2: Wire API schema**

Accept `toolLoopVariant` in the route schema with default `"inline_context"` for new manual testing.

- [ ] **Step 3: Pass mode into runtime**

In `runToolLoopComparisonForUser`, map:

```ts
const answerCompositionMode =
  params.toolLoopVariant === "composer_context" ? "composer_context" :
  params.toolLoopVariant === "baseline" ? undefined :
  "inline_context"
```

Pass that into `runAgenticToolTurn`.

- [ ] **Step 4: Add UI selector**

Add a German select next to the blinded checkbox:

```tsx
<option value="inline_context">Tool Loop + Kontext inline</option>
<option value="composer_context">Tool Loop + Composer</option>
<option value="baseline">Tool Loop ohne Kontext</option>
```

Keep the default `inline_context`.

- [ ] **Step 5: Update trace/debug labels**

Add debug lines:

```ts
tool_loop_variant: inline_context
answer_context: category.conditioner.recommend, product.recommendation_shape
```

- [ ] **Step 6: Run focused tests**

Run:

```bash
npx tsx --test tests/agent-compare-api.spec.ts tests/agent-compare-runner.spec.ts tests/agentic-tool-loop.spec.ts
```

Expected: all focused tests pass.

## Task 5: Manual Compare Lab Smoke

**Files:**
- No code files.

- [ ] **Step 1: Restart or verify dev server**

Run:

```bash
npm run dev:worktree
```

Expected: local app is available at the worktree port.

- [ ] **Step 2: Run three manual flows**

In `/labs/agent-compare`, test both `inline_context` and `composer_context`:

```text
ich möchte meine routine anpassen
eine maske brauche ich also nicht?
verstanden, sorry was für einen conditioner brauche ich denn
```

```text
wie kann ich meine haare glatter und glänzender machen
okay aber maske ist pflicht oder?
okay und ein sanftes shampoo hilft auch?
```

```text
ich habe noch nie leave-in benutzt, was für einer wäre geeignet?
mittel dicht ist mein haar
und wie benutze ich so einen, der hask keratin klingt gut
```

Expected: intent carry remains strong, product prose is less robotic, usage answers reuse the product/thread context naturally, and no product claims are invented.

## Verification

Run before handoff:

```bash
npm run typecheck
npx tsx --test tests/agentic-tool-loop.spec.ts tests/agent-final-render-prompt.spec.ts tests/agent-compare-api.spec.ts tests/agent-compare-runner.spec.ts
git diff --check
```

Optional if UI changed materially:

```bash
npm run lint
```

## Open Risks

- Composer mode may improve quality but add latency; Compare Lab should expose both modes before we pick one.
- Inline mode may be enough if capsules are concise and well selected.
- The capsule text must stay rubric-like. If it becomes a template library, the agent will get stiff again.
- Usage turns need product/thread memory; if the model keeps re-calling `select_products` for usage, add a stricter tool rule after this plan.
