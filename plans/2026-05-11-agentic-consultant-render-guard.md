# Agentic Consultant Rendering And Conceptual Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve the Compare Lab `tool_loop` `Beratungsbrief` variant so it keeps strong multi-turn tool choice, renders broad routine/product answers like a knowledgeable advisor, and blocks premature product calls for conceptual category curiosity.

**Architecture:** Keep deterministic `build_or_fix_routine` and `select_products` authoritative. Add small routine metadata for the selected priority lever and adjacent contextual levers, strengthen answer-context capsules, and add a narrow pre-execution guard that rejects `select_products` only when the latest user turn is conceptual category curiosity without product-ask wording. Keep the changes scoped to the Compare Lab tool loop and its tests.

**Tech Stack:** Next.js App Router, TypeScript, OpenAI Chat Completions function calling, existing agentic tool loop, existing deterministic routine/product tools, Compare Lab.

---

## Spec Link

- `docs/superpowers/specs/2026-05-11-agentic-consultant-render-guard-design.md`

## User Situation

The user is testing `Classic` vs `Tool Loop / Beratungsbrief` in `/labs/agent-compare`. Feedback shows the tool loop understands multi-turn product intent better, but broad routine and product answers need richer consultant framing. One example should not force a hard scoring overwrite: daily coconut oil can legitimately surface a reset lever, but the answer should explain reset as cleanup and leave-in as the adjacent everyday replacement.

## Promised End-State

After this pass:

- Broad routine answers keep the deterministic selected lever but explain why it appears and what adjacent everyday lever may matter next.
- Product recommendations read like advisor comparisons rather than internal data summaries.
- Conceptual category curiosity answers educationally first.
- Explicit product asks still call `select_products`.
- Compare Lab testing has a concrete prompt verification run.

## Decisions Locked In

- Do not change routine priority scoring in this plan.
- Do not suppress valid routine outputs such as `Haar-Reset / Tiefenreinigung`.
- Do contextualize selected routine levers with adjacent alternatives when useful.
- Do add a narrow conceptual-curiosity guard.
- Do not wire production chat.
- Do not introduce Composer-specific behavior.
- Do not depend on `ConversationContextPacketV1`.

## File Map

- Modify: `src/lib/agent/tools/build-or-fix-routine.ts`
  - Add routine priority and adjacent lever metadata to `BuildOrFixRoutineProjection`.
- Modify: `src/lib/agent/orchestrator/agentic-answer-context.ts`
  - Add routine priority-context and stronger category recommendation capsules.
- Modify: `src/lib/agent/orchestrator/run-agentic-tool-turn.ts`
  - Add a narrow conceptual-curiosity guard before executing `select_products`.
- Modify: `src/lib/agent/orchestrator/agentic-tool-loop-types.ts`
  - Add one blocked-tool reason for conceptual category curiosity.
- Modify: `src/lib/agent/orchestrator/prompt.ts`
  - Clarify conceptual curiosity vs explicit product ask in the tool-loop prompt.
- Modify: `data/agent-guidance/topics/{shampoo,conditioner,leave-in,mask}/response-playbook.md`
  - Tighten category-specific render guidance only where it improves product answer shape.
- Modify: `tests/agentic-tool-loop.spec.ts`
  - Add conceptual guard and explicit product-ask regression tests.
- Modify: `tests/agent-final-render-prompt.spec.ts`
  - Add answer-context prompt/capsule tests for advisor rendering.
- Modify: `tests/agent-routine-tool.spec.ts`
  - Add routine metadata projection tests.
- Modify: `plans/2026-05-05-agentic-tool-loop-eval-seed.md`
  - Add the manual verification prompt run for this iteration.

## Task 1: Add Routine Priority Metadata Without Changing Scoring

**Files:**
- Modify: `src/lib/agent/tools/build-or-fix-routine.ts`
- Test: `tests/agent-routine-tool.spec.ts`

- [ ] **Step 1: Confirm the routine projection test file**

Run:

```bash
rg -n "projectRoutinePlan" tests/agent-routine-tool.spec.ts
```

Expected: output includes existing `projectRoutinePlan` tests in `tests/agent-routine-tool.spec.ts`.

- [ ] **Step 2: Write a failing test for priority metadata**

Add a test for the coconut-oil routine case to `tests/agent-routine-tool.spec.ts`. Use the existing `projectRoutinePlan` import in that file. The expected shape is:

```ts
test("projectRoutinePlan exposes priority context without changing basics scoring", () => {
  const result = projectRoutinePlan({
    objective: "fix_routine",
    message: "ich nutze kokosöl jeden tag und hab gehört, das sei nicht so gut. wie kann ich routine anpassen",
    layer: "basics",
    requestedCategory: "oil",
    hairProfile: {
      hair_texture: "curly",
      thickness: "normal",
      density: null,
      scalp_type: "balanced",
      scalp_condition: null,
      wash_frequency: "daily",
      products_used: "Shampoo: Old Spice, Öl: Kokosöl, Conditioner: Keine Ahnung",
      current_routine_products: ["shampoo", "oil", "conditioner"],
      goals: ["less_volume", "curl_definition", "healthier_hair"],
      concerns: [],
      drying_method: "air_dry",
    } as HairProfile,
  })

  assert.deepEqual(
    result.steps.map((step) => step.id),
    ["base-shampoo", "base-conditioner", "occasional-hair-reset"],
  )
  assert.equal(result.priority_context?.selected_step_id, "occasional-hair-reset")
  assert.match(result.priority_context?.selected_reason ?? "", /Rueckstaende|Reset|Build-up|Oel/i)
  assert.ok(
    result.priority_context?.adjacent_levers.some((lever) => lever.category === "leave_in"),
  )
})
```

Expected before implementation: fails because `priority_context` does not exist.

- [ ] **Step 3: Add projection types**

In `src/lib/agent/tools/build-or-fix-routine.ts`, add these interfaces near `BuildOrFixRoutineStep`:

```ts
export interface BuildOrFixRoutineAdjacentLever {
  step_id: string
  label: string
  category: string | null
  role: "everyday_maintenance" | "cleanup_reset" | "optional_extra" | "supporting_step"
  reason: string
}

export interface BuildOrFixRoutinePriorityContext {
  selected_step_id: string | null
  selected_label: string | null
  selected_category: string | null
  selected_role: BuildOrFixRoutineAdjacentLever["role"] | null
  selected_reason: string | null
  adjacent_levers: BuildOrFixRoutineAdjacentLever[]
}
```

Extend `BuildOrFixRoutineProjection`:

```ts
priority_context?: BuildOrFixRoutinePriorityContext | null
```

- [ ] **Step 4: Implement routine metadata projection**

Add helper functions in `src/lib/agent/tools/build-or-fix-routine.ts`:

```ts
function classifyRoutineStepRole(slot: RoutineSlotAdvice): BuildOrFixRoutineAdjacentLever["role"] {
  if (slot.id.includes("hair-reset") || slot.topic_ids.includes("tiefenreinigung")) {
    return "cleanup_reset"
  }
  if (slot.category === "leave_in") {
    return "everyday_maintenance"
  }
  if (slot.phase === "occasional") {
    return "optional_extra"
  }
  return "supporting_step"
}

function projectAdjacentLever(slot: RoutineSlotAdvice): BuildOrFixRoutineAdjacentLever {
  return {
    step_id: slot.id,
    label: slot.label,
    category: slot.category,
    role: classifyRoutineStepRole(slot),
    reason: slot.rationale[0] ?? "",
  }
}

function projectPriorityContext(plan: RoutinePlan): BuildOrFixRoutinePriorityContext | null {
  const selectedSlot = plan.priority_lever
    ? findRoutineSlot(plan, plan.priority_lever.slot_id)
    : null
  if (!selectedSlot) return null

  const adjacentLevers = plan.sections
    .flatMap((section) => section.slots)
    .filter((slot) => slot.id !== selectedSlot.id)
    .filter((slot) => slot.category === "leave_in" || slot.category === "mask" || slot.category === "oil")
    .slice(0, 3)
    .map(projectAdjacentLever)

  return {
    selected_step_id: selectedSlot.id,
    selected_label: selectedSlot.label,
    selected_category: selectedSlot.category,
    selected_role: classifyRoutineStepRole(selectedSlot),
    selected_reason: plan.priority_lever?.reason ?? selectedSlot.rationale[0] ?? null,
    adjacent_levers: adjacentLevers,
  }
}
```

Then return it from `projectRoutinePlan`:

```ts
priority_context: projectPriorityContext(plan),
```

Keep `steps` unchanged.

- [ ] **Step 5: Run the routine metadata test**

Run:

```bash
npx tsx --test tests/agent-routine-tool.spec.ts
```

Expected: the new test passes, and existing routine projection assertions still pass.

## Task 2: Strengthen Advisor Answer Context

**Files:**
- Modify: `src/lib/agent/orchestrator/agentic-answer-context.ts`
- Test: `tests/agent-final-render-prompt.spec.ts`

- [ ] **Step 1: Write failing tests for new answer-context instructions**

Add tests that call `buildAgenticAnswerContext`.

Routine test:

```ts
test("agentic answer context explains selected routine lever with adjacent everyday lever", () => {
  const context = buildAgenticAnswerContext({
    latestUserMessage:
      "ich nutze kokosöl jeden tag und hab gehört, das sei nicht so gut. wie kann ich routine anpassen",
    selectedProducts: null,
    routinePlan: {
      objective: "fix_routine",
      steps: [],
      missing_info: [],
      confidence: 1,
      priority_context: {
        selected_step_id: "occasional-hair-reset",
        selected_label: "Haar-Reset / Tiefenreinigung",
        selected_category: null,
        selected_role: "cleanup_reset",
        selected_reason: "Daily oil can leave residue or buildup.",
        adjacent_levers: [
          {
            step_id: "maintenance-leave-in",
            label: "Leave-in / Finish",
            category: "leave_in",
            role: "everyday_maintenance",
            reason: "A leave-in can replace daily oil as the everyday finish.",
          },
        ],
      },
    },
    toolCalls: [{ name: "build_or_fix_routine", input: { layer: "basics" } }],
    conversationState: null,
  })

  assert.ok(context.capsule_ids.includes("routine.priority_context"))
  assert.match(context.instructions.join("\\n"), /selected.*lever|gewaehlten.*Hebel|Reset/i)
  assert.match(context.instructions.join("\\n"), /Leave-in|everyday|Alltag/i)
})
```

Product render test:

```ts
test("agentic answer context asks product recommendations to compare like an advisor", () => {
  const context = buildAgenticAnswerContext({
    latestUserMessage: "welcher leave-in passt?",
    selectedProducts: createLeaveInProjectionForTest(),
    routinePlan: null,
    toolCalls: [{ name: "select_products", input: { category: "leave_in", userJob: "product_pick" } }],
    conversationState: null,
  })

  assert.ok(context.capsule_ids.includes("category.leave_in.recommend"))
  assert.match(context.instructions.join("\\n"), /Unterschied|Option|ich wuerde|ich würde|praktisch/i)
})
```

Use an existing `createLeaveInProjectionForTest` helper if available. If not available, inline a minimal `SelectedProductsProjection` object with one to three products and supported claims matching existing tests in `tests/agent-final-render-prompt.spec.ts`.

Expected before implementation: routine capsule id is missing and product guidance is too thin.

- [ ] **Step 2: Add capsule id**

In `AgenticAnswerCapsuleId`, add:

```ts
| "routine.priority_context"
```

- [ ] **Step 3: Add routine priority-context capsule**

Add a capsule entry:

```ts
"routine.priority_context": {
  instruction:
    "Bei breiten Routineantworten den gewaehlten dritten Hebel als autoritativ behandeln, aber seine Rolle erklaeren: Cleanup/Reset, Alltagshebel oder optionales Extra. Wenn priority_context.adjacent_levers einen Alltagshebel wie Leave-in nennt, kurz einordnen: Der gewaehlte Reset kann fuer Rueckstaende sinnvoll sein, waehrend der Alltagshebel die laufende Routine ersetzt oder ergaenzt.",
  example:
    "Reset ist hier plausibel, wenn taegliches Oel die Haare belegt. Fuer den Alltag waere danach eher ein leichter Leave-in/Finish-Schritt der Ersatz fuer das Oel.",
},
```

- [ ] **Step 4: Add routine capsule when metadata exists**

In `buildAgenticAnswerContext`, after adding `routine.layered_answer`, add:

```ts
if (params.routinePlan.priority_context) {
  addCapsule(capsuleIds, "routine.priority_context")
}
```

- [ ] **Step 5: Strengthen category capsules**

Update existing category instructions:

`category.leave_in.recommend` should say:

```ts
"Bei Leave-in zuerst den gesuchten Typ erklaeren: Booster nach dem Waschen, Gewicht passend zu Haardicke/Haardichte, Rolle fuer Locken/Frizz/Finish oder Hitzeschutz nur wenn belegt. Danach die Produkte als echte Optionen vergleichen: was ist leichter, was ist pflegender, was ist praktischer, und welche Option waere die naheliegende erste Wahl. Nicht nur Gewicht/Balance/Preis aufzaehlen.",
```

`category.conditioner.recommend` should say:

```ts
"Bei Conditioner zuerst sagen, welcher Typ passt: Gewicht, Balance/Pflegeintensitaet und Rolle nach jeder Waesche. Danach die Produkte als praktische Alternativen vergleichen und eine Tendenz geben, wenn die Tool-Fakten das erlauben. Nicht jede interne Claim-Zeile abschreiben.",
```

`product.recommendation_shape` should say:

```ts
"Bei Produktantworten zuerst in 1-2 Saetzen erklaeren, welcher Produkttyp fuer dieses Profil sinnvoll ist. Danach die Tool-Produkte als unterschiedliche Optionen darstellen: staerkste erste Wahl, guenstige/leichtere Alternative, intensivere Option, soweit die Tool-Fakten das hergeben.",
```

- [ ] **Step 6: Run answer-context tests**

Run:

```bash
npx tsx --test tests/agent-final-render-prompt.spec.ts
```

Expected: all tests pass.

## Task 3: Add A Narrow Conceptual-Curiosity Guard

**Files:**
- Modify: `src/lib/agent/orchestrator/agentic-tool-loop-types.ts`
- Modify: `src/lib/agent/orchestrator/run-agentic-tool-turn.ts`
- Modify: `src/lib/agent/orchestrator/prompt.ts`
- Test: `tests/agentic-tool-loop.spec.ts`

- [ ] **Step 1: Write failing tests for conceptual curiosity and explicit product asks**

Add two tests to `tests/agentic-tool-loop.spec.ts`.

Conceptual guard test:

```ts
test("tool-loop blocks premature product tools for conceptual category curiosity", async () => {
  let selectProductsCalled = false
  const modelClient = new FakeModelClient([
    {
      type: "tool_calls",
      calls: [
        {
          id: "call_1",
          name: "select_products",
          input: { category: "leave_in", userJob: "product_pick" },
        },
      ],
    },
    {
      type: "final",
      answer:
        "Leave-in kann fuer dich sinnvoll sein, aber erstmal als Booster nach dem Waschen: sparsam in Laengen und Spitzen. Wenn du konkrete Optionen willst, kann ich dir danach passende Leave-ins zeigen.",
      statePatch: {
        active_topic: "leave_in",
        routine_layer: "deep_dive",
        last_product_category: "leave_in",
        last_assistant_action: "answered_conceptual_category",
        topic_relation: "same_topic",
        reason: "Conceptual leave-in curiosity answered without products.",
      },
    },
  ])

  const result = await runAgenticToolTurn({
    message: "ja ich habe gehoert leave in soll gut sein",
    recentMessages: [{ role: "assistant", content: "Wir passen deine Routine an." }],
    modelClient,
    answerCompositionMode: "inline_context",
    userContext: createUserContext(),
    conversationState: createRoutineState({ active_topic: "routine", routine_layer: "basics" }),
    tools: {
      select_products: async () => {
        selectProductsCalled = true
        return createLeaveInProjection()
      },
      build_or_fix_routine: async () => ({ objective: null, steps: [], missing_info: [], confidence: 0, priority_context: null }),
    },
  })

  assert.equal(selectProductsCalled, false)
  assert.equal(result.selected_products, null)
  assert.ok(result.trace.blocked_tool_calls.some((call) => call.reason === "conceptual_category_curiosity"))
  assert.match(result.final_answer, /Booster|Optionen|zeigen/i)
})
```

Explicit product ask test:

```ts
test("tool-loop still selects products for explicit category product asks", async () => {
  let selectProductsCalled = false
  const modelClient = new FakeModelClient([
    {
      type: "tool_calls",
      calls: [
        {
          id: "call_1",
          name: "select_products",
          input: { category: "leave_in", userJob: "product_pick" },
        },
      ],
    },
    {
      type: "final",
      answer: "Hier sind passende Leave-ins fuer dich.",
      statePatch: {
        active_topic: "leave_in",
        routine_layer: null,
        last_product_category: "leave_in",
        last_assistant_action: "select_products",
        topic_relation: "same_topic",
        reason: "Explicit product ask.",
      },
    },
  ])

  const result = await runAgenticToolTurn({
    message: "ok welcher leave-in passt?",
    recentMessages: [{ role: "assistant", content: "Leave-in kann sinnvoll sein." }],
    modelClient,
    answerCompositionMode: "inline_context",
    userContext: createUserContext(),
    conversationState: createRoutineState({ active_topic: "leave_in" }),
    tools: {
      select_products: async () => {
        selectProductsCalled = true
        return createLeaveInProjection()
      },
      build_or_fix_routine: async () => ({ objective: null, steps: [], missing_info: [], confidence: 0, priority_context: null }),
    },
  })

  assert.equal(selectProductsCalled, true)
  assert.equal(result.selected_products?.category, "leave_in")
})
```

Expected before implementation: first test calls `select_products`; second test should already pass.

- [ ] **Step 2: Add blocked-tool reason**

In `AgenticBlockedToolCall["reason"]`, add:

```ts
| "conceptual_category_curiosity"
```

- [ ] **Step 3: Add guard helpers**

In `run-agentic-tool-turn.ts`, add helpers near `buildSelectProductsInput`:

```ts
function normalizeIntentText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
}

function hasExplicitProductAsk(message: string): boolean {
  return /\b(welch(?:e|es|en|er|em)?|empfehl\w*|passt|produkt|produkte|kaufen|nehmen|nimm|option|optionen|a oder b|besser)\b/.test(
    normalizeIntentText(message),
  )
}

function isConceptualCategoryCuriosity(message: string, category: AgenticProductCategory): boolean {
  const normalized = normalizeIntentText(message)
  const mentionsCategory =
    category === "leave_in"
      ? /\bleave[-_ ]?in\b|\bleavein\b/.test(normalized)
      : category === "mask"
        ? /\bmaske\b|\bkur\b|\bhaarkur\b/.test(normalized)
        : category === "conditioner"
          ? /\bconditioner\b|\bspuelung\b|\bspulung\b/.test(normalized)
          : category === "shampoo"
            ? /\bshampoo\b/.test(normalized)
            : false
  if (!mentionsCategory) return false
  if (hasExplicitProductAsk(message)) return false

  return /\b(gehoert|gehort|soll gut sein|ist gut|bringt|brauche|brauch ich|hilft|sinnvoll|notwendig|pflicht)\b/.test(
    normalized,
  )
}
```

- [ ] **Step 4: Block only premature product tool calls**

In the `select_products` execution branch, after duplicate-category validation and before `selectedCategories.add(category)`, add:

```ts
if (isConceptualCategoryCuriosity(params.message, category)) {
  blockedToolCalls.push(blockToolCall(call, "conceptual_category_curiosity"))
  guardrails.push("conceptual_category_curiosity")
  continue
}
```

This rejects the tool call and lets the next model step answer educationally.

- [ ] **Step 5: Clarify prompt rule**

In `AGENTIC_TOOL_LOOP_PROMPT`, add a line under Tool-Regeln:

```ts
- Bei konzeptuellem Kategorie-Interesse ohne Produktfrage, z.B. "ich habe gehoert Leave-in soll gut sein" oder "brauche ich eine Maske?", erklaere zuerst ohne select_products und biete konkrete Produkte nur als naechsten Schritt an.
```

Keep the existing explicit product rule unchanged.

- [ ] **Step 6: Run conceptual guard tests**

Run:

```bash
npx tsx --test tests/agentic-tool-loop.spec.ts
```

Expected: all tests pass.

## Task 4: Tighten Category Response Playbooks

**Files:**
- Modify: `data/agent-guidance/topics/leave-in/response-playbook.md`
- Modify: `data/agent-guidance/topics/conditioner/response-playbook.md`
- Modify: `data/agent-guidance/topics/mask/response-playbook.md`
- Modify: `data/agent-guidance/topics/shampoo/response-playbook.md`
- Test: `tests/agent-guidance.spec.ts`

- [ ] **Step 1: Add guidance assertions**

In `tests/agent-guidance.spec.ts`, extend the category-topic test or add a new test:

```ts
test("category response playbooks carry advisor rendering guidance", async () => {
  const result = await loadGuidance([
    "topic:leave_in",
    "topic:conditioner",
    "topic:mask",
    "topic:shampoo",
  ])
  const content = result.items.map((item) => item.content).join("\\n")

  assert.match(content, /advisor|berater|Berater|praktische|Unterschied|Option/i)
  assert.match(content, /no product names unless|keine Produktnamen/i)
  assert.match(content, /explicit product ask|konkrete Produkt/i)
})
```

Expected before implementation: likely fails on advisor/comparison wording.

- [ ] **Step 2: Update leave-in response playbook**

Add to explicit product ask shape:

```md
- start with the type of leave-in the profile needs before naming products
- compare options by practical difference: lighter versus richer, heat-protection consolidation, moisture/care focus, format, and everyday role
- give a gentle first-choice tendency when tool facts support it
- end with one usage note: after washing, sparingly, lengths and ends
```

- [ ] **Step 3: Update conditioner response playbook**

Add to explicit product ask shape:

```md
- explain the needed conditioner type first: weight, balance, care intensity, and role after washing
- compare products as practical alternatives instead of listing internal facts
- give a soft first-choice tendency when the product facts are meaningfully different
```

- [ ] **Step 4: Update mask response playbook**

Add to explicit product ask shape:

```md
- frame mask as optional extra length care, especially after reset or when lengths need more slip/care
- compare products by weight, balance, intensity, and fit without claiming repair beyond supported data
- explain cadence briefly: occasional, not a required baseline step
```

- [ ] **Step 5: Update shampoo response playbook**

Add to explicit product ask shape:

```md
- if shampoo is a weaker lever for the goal, still answer explicit safe product asks with the tool products and one caveat
- make the caveat practical: shampoo handles scalp/clean base; conditioner, leave-in, mask, or technique may move shine/frizz/dry lengths more
- end with scalp-focused usage: mainly scalp, rinse well
```

- [ ] **Step 6: Run guidance tests**

Run:

```bash
npx tsx --test tests/agent-guidance.spec.ts
```

Expected: all tests pass.

## Task 5: Add Manual Compare Lab Verification Pack

**Files:**
- Modify: `plans/2026-05-05-agentic-tool-loop-eval-seed.md`

- [ ] **Step 1: Append the verification run**

Append:

```md
## Agentic Consultant Rendering And Conceptual Guard Verification

Run in `/labs/agent-compare`.

Settings:
- Tool-Loop: `Beratungsbrief`
- Mehrturn-Test: on for multi-turn cases
- Geblendet: optional for subjective judging; off is acceptable when inspecting traces

1. Broad routine improvement
   - User: `Nick Rupprechter · straight · fine`
   - Turns: `wie kann ich meine routine verbessern`
   - Expected: Tool Loop keeps the deterministic basics, explains why the selected third lever appears, and ends with a useful next step instead of generic "weitere Fragen".

2. Daily coconut oil routine adjustment
   - User: `Phil Dörrenhaus · curly · normal`
   - Turns: `ich nutze kokosöl jeden tag und hab gehört, das sei nicht so gut. wie kann ich routine anpassen`
   - Expected: Tool Loop may keep `Haar-Reset / Tiefenreinigung` if selected by the tool, but explains it as cleanup/reset and mentions lighter leave-in/finish as the likely everyday replacement for daily oil.

3. Conceptual leave-in curiosity
   - User: `Nick Rupprechter · straight · fine`
   - Turns:
     - `ich will meine routine anpassen`
     - `ja ich habe gehört leave in soll gut sein`
   - Expected: Tool Loop does not recommend product names; it explains the leave-in role and offers product picks as a next step.

4. Explicit leave-in product ask
   - User: `Nick Rupprechter · straight · fine`
   - Turns:
     - `ich will meine routine anpassen`
     - `ja ich habe gehört leave in soll gut sein`
     - `ok welcher leave-in passt?`
   - Expected: Tool Loop calls `select_products(leave_in)` or asks one blocking profile question if required.

5. Leave-in missing-info carry
   - User: `Phil Dörrenhaus · curly · normal`
   - Turns:
     - `ich nutze kokosöl jeden tag und hab gehört, das sei nicht so gut. wie kann ich routine anpassen`
     - `ok und wekcher leave-in passt?`
     - `mittlere dichte`
   - Expected: Tool Loop keeps the leave-in request in mind and recommends leave-in products after density is supplied.

6. Explicit shampoo ask with caveat
   - User: `Nick Rupprechter · straight · fine`
   - Turns:
     - `ich will meine routine anpassen`
     - `ja ich habe gehört leave in soll gut sein`
     - `ja oder ich änder erstmal mein shampoo, welches kannst du empfehlen`
   - Expected: Tool Loop recommends shampoo products when catalog data supports them and includes a soft caveat that shampoo is not the strongest lever for length goals.
```

- [ ] **Step 2: Run markdown diff check**

Run:

```bash
git diff --check -- plans/2026-05-05-agentic-tool-loop-eval-seed.md
```

Expected: no whitespace errors.

## Task 6: Full Verification

**Files:**
- No new implementation files.

- [ ] **Step 1: Run focused automated tests**

Run:

```bash
npx tsx --test tests/agent-guidance.spec.ts tests/agentic-tool-loop.spec.ts tests/agent-final-render-prompt.spec.ts tests/agent-select-products-tool.spec.ts tests/agent-compare-api.spec.ts tests/agent-compare-runner.spec.ts
```

Expected: all tests pass.

- [ ] **Step 2: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: exits 0.

- [ ] **Step 3: Run lint**

Run:

```bash
npm run lint
```

Expected: exits 0. Existing unrelated warnings are acceptable only if they match the current known warnings in unrelated files.

- [ ] **Step 4: Run whitespace check**

Run:

```bash
git diff --check
```

Expected: exits 0.

- [ ] **Step 5: Restart the Compare Lab server**

Run:

```bash
npm run dev:worktree
```

Expected: the server starts on `http://localhost:3274`.

- [ ] **Step 6: Verify Compare Lab route**

Run:

```bash
curl -s -o /tmp/agent-compare-render-guard-status.txt -w "%{http_code}\n" http://localhost:3274/labs/agent-compare
```

Expected: `200`.

- [ ] **Step 7: Run manual Compare Lab prompt verification**

Run the six prompts from `Agentic Consultant Rendering And Conceptual Guard Verification` in `plans/2026-05-05-agentic-tool-loop-eval-seed.md`.

Record for each:
- user
- `tool_loop` variant
- winner
- note
- whether the tool trace matched the expected tool use
- whether the answer passed the expected behavior

Expected:
- Broad/routine answers improve in explanation.
- Conceptual leave-in curiosity does not show product names.
- Explicit product asks still call `select_products`.
- Leave-in missing-info carry still works.
- Shampoo explicit ask includes products plus caveat when products are available.

## Ready Check

Because this touches recommendations, copy, and trust-facing answer quality, run `ready-check` before shipping or opening a rollout PR. This plan does not authorize production chat rollout.

## Execution Handoff

Use `superpowers:subagent-driven-development` to execute this plan. Dispatch one implementation subagent per task and run spec/code-quality review after each task.
