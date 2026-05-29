# AgentV2 Category-Level Routine Mutations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make explicit AgentV2 routine add requests produce a grounded category-level routine step, not an invented product-named step, without adding product-level routine storage.

**Architecture:** The model owns semantic interpretation, the routine planner owns routine slot creation, and the validator continues to reject invented routine state. `build_or_fix_routine` should translate `mutation_kind: add_step` plus `requested_category` into a planner option that forces that category to exist in the plan when it is safe and supported. Product references such as "das von Pantene" may be mentioned in prose when grounded by recent conversation context, but the routine payload remains category-level.

**Tech Stack:** TypeScript, Playwright contract tests, Node test runner via `tsx --test`, AgentV2 Responses runtime, existing routine planner/projection code.

---

## Feedback Triage

The review surfaced three blockers that are valid and must be fixed before implementation:

- Planner slot creation, not projection only: the failing profile does not emit a `leave_in` slot at all, so a projection-only override cannot include `maintenance-leave-in`.
- Fallback gating: known-intent fallback only fires when general advice and category guidance were loaded earlier in the turn, so fallback tests must preload guidance.
- Safety test shape: the previous safety test was true by fake-client construction. This plan removes that no-op from the core implementation instead of pretending it verifies enforcement.

The review also called out two points this plan intentionally keeps narrow:

- Product-name grounding in prose remains model-trusted for this step. We will not add a deterministic product-reference resolver or prose brand guard here.
- Basics stays capped at three visible steps. If the user explicitly asks to add a category and that category differs from the planner priority lever, the requested category wins the third visible slot. That tradeoff is intentional because this path is a mutation request, not a neutral best-routine recommendation.

## Settled Decisions

- Product-level routine tracking is out of scope.
- Product references in routine follow-ups resolve to category-level routine mutation for now.
- The routine step should stay category-first, for example `Leave-in / Finish`, not `Pantene Pro-V Miracles 7in1 Haaroel Spray`.
- Product names may appear in user-facing prose only as conversational reference, not as routine state.
- Explicit requested categories should be included, but not praised as optimal when they are optional or profile-sensitive.
- The validator should remain strict about state boundaries: no invented routine step IDs and no ungrounded product IDs.

## Non-Goals

- Do not add product IDs to saved routine state.
- Do not build durable product anchors or a routine product tracker.
- Do not build a broad product-reference resolver or regex maze.
- Do not relax `known_routine_step_ids` validation.
- Do not add broad safety-tool gating in this plan. Existing safety behavior remains unchanged unless the category-add change directly regresses it.
- Do not commit unless the user explicitly asks.

## Current Failure

Latest Compare Lab run:

1. User asked `Welches Leave-in passt zu mir?`
2. User asked `Bau das Produkt bitte in meine Routine ein.`
3. User clarified `das von pantene`
4. The model called `build_or_fix_routine` with `requested_category: leave_in` and `mutation_kind: add_step`
5. The planner returned `base-shampoo`, `base-conditioner`, `occasional-hair-reset`
6. The model invented `leave-in-pantene`
7. Validator correctly rejected the invented routine step ID
8. Repair fell back to generic routine advice

Root cause: the routine planner is blind to explicit category-add intent. `requested_category` reaches the tool, but the planner does not force a category slot when profile heuristics would normally suppress it.

## File Map

- Modify `src/lib/routines/planner.ts`
  - Add a planner option for explicit requested categories.
  - Force a category-level slot into the plan when `build_or_fix_routine` has authorized an explicit add-step request.
  - Keep forced slot copy neutral and caveated when the category is not profile-driven.

- Modify `src/lib/agent/tools/build-or-fix-routine.ts`
  - Add `mutationKind` to the underlying routine tool input.
  - Pass `forceRequestedCategory` to the planner only when `mutationKind === "add_step"` and `requestedCategory` exists.

- Modify `src/lib/agent-v2/compare/run-agent-v2.ts`
  - Pass AgentV2 `mutation_kind` from `build_or_fix_routine` tool arguments into the underlying routine tool.

- Modify `src/lib/agent-v2/runtime/responses-agent.ts`
  - Improve known routine mutation fallback copy so failed add-step turns are honest and category-specific.
  - Strengthen prompt guidance that routine payload `visible_steps` must use only routine tool output step IDs.

- Modify `src/lib/agent-v2/tools/tool-definitions.ts`
  - Update `build_or_fix_routine` description to state category-level add behavior and no invented step IDs.

- Modify `tests/routine-planner.spec.ts`
  - Add planner tests proving explicit requested categories create slots even when profile heuristics would suppress them.

- Modify `tests/agent-routine-tool.spec.ts`
  - Add routine tool projection tests for explicit requested category inclusion.

- Modify `tests/agent-v2-responses-runtime.spec.ts`
  - Add runtime regression for the Pantene/Leave-in category-level routine mutation path.
  - Add fallback regression with required guidance preload.

## Task 1: Prove The Planner Does Not Emit Explicitly Requested Leave-In

**Files:**
- Modify: `tests/routine-planner.spec.ts`

- [ ] **Step 1: Add a failing planner test**

Add this test near the existing `projectRoutinePlanForLayer` basics tests:

```ts
test("explicit requested category forces a leave-in slot even when profile heuristics suppress it", () => {
  const plan = buildRoutinePlan(
    createProfile({
      hair_texture: "straight",
      thickness: "fine",
      concerns: ["buildup"],
      goals: ["shine"],
      current_routine_products: ["shampoo", "conditioner"],
    }),
    "Bau ein Leave-in in meine Routine ein.",
    { forceRequestedCategory: "leave_in" },
  )

  const slots = plan.sections.flatMap((section) => section.slots)
  const leaveInSlot = slots.find((slot) => slot.category === "leave_in")

  expect(leaveInSlot?.id).toBe("maintenance-leave-in")
  expect(leaveInSlot?.action).toBe("add")
  expect(leaveInSlot?.rationale.join(" ")).toMatch(/ausdruecklich|aufnehmen/i)
  expect(leaveInSlot?.rationale.join(" ")).not.toMatch(/Routine nach dem Waschen runder/i)
})
```

- [ ] **Step 2: Run the targeted test and confirm RED**

Run:

```bash
npx playwright test tests/routine-planner.spec.ts --project=chromium --grep "explicit requested category"
```

Expected: FAIL because `buildRoutinePlan` does not accept or honor `forceRequestedCategory` yet.

## Task 2: Add Explicit Requested Category Support To The Planner

**Files:**
- Modify: `src/lib/routines/planner.ts`

- [ ] **Step 1: Extend routine plan options**

Replace the inline `buildRoutinePlan` options type with a named type:

```ts
type BuildRoutinePlanOptions = {
  usesBondBuilder?: boolean
  forceRequestedCategory?: RoutineProductCategory | null
}
```

Update `buildRoutinePlan`:

```ts
export function buildRoutinePlan(
  profile: HairProfile | null,
  message: string,
  options: BuildRoutinePlanOptions = {},
): RoutinePlan {
```

Update `buildRoutineSlots` options:

```ts
options: {
  usesBondBuilder: boolean
  forceRequestedCategory: RoutineProductCategory | null
},
```

Pass the option through:

```ts
const sectionSlots = buildRoutineSlots(profile, context, message, activeTopics, decisionContext, {
  usesBondBuilder: options.usesBondBuilder ?? false,
  forceRequestedCategory: options.forceRequestedCategory ?? null,
})
```

- [ ] **Step 2: Add a forced requested slot registry**

Add a small helper near the existing slot builders:

```ts
function buildForcedRequestedCategorySlot(
  category: RoutineProductCategory,
  profile: HairProfile | null,
): RoutineSlotAdvice | null {
  switch (category) {
    case "leave_in":
      return {
        id: "maintenance-leave-in",
        kind: "product_slot",
        phase: "maintenance",
        label: "Leave-in / Finish",
        action: "add",
        category: "leave_in",
        cadence: "nach dem Waschen, sparsam dosiert",
        rationale: [
          "Leave-in wird aufgenommen, weil du diesen Schritt ausdruecklich in der Routine haben moechtest.",
          "Das ist nicht automatisch der wichtigste Hebel, kann aber als leichter Zusatz fuer Laengen und Spitzen sinnvoll sein.",
        ],
        caveats:
          profile?.thickness === "fine"
            ? ["Bei feinem Haar sparsam dosieren und nicht an den Ansatz geben."]
            : ["Sparsam in Laengen und Spitzen verwenden, damit die Routine nicht unnoetig schwer wird."],
        topic_ids: [],
        product_linkable: true,
        product_query: "Ich suche ein Leave-in fuer meine Routine nach dem Waschen.",
        attachment_priority: 10,
      }
    case "mask":
      return {
        id: "occasional-mask",
        kind: "product_slot",
        phase: "occasional",
        label: "Maske / Kur",
        action: "add",
        category: "mask",
        cadence: "gelegentlich nach Bedarf",
        rationale: [
          "Maske wird aufgenommen, weil du diesen Schritt ausdruecklich in der Routine haben moechtest.",
          "Sie bleibt ein Zusatz und ersetzt Conditioner nicht automatisch.",
        ],
        caveats: ["Nicht als Pflichtschritt verstehen; bei feinem oder schnell beschwertem Haar selten und leicht halten."],
        topic_ids: [],
        product_linkable: true,
        product_query: "Ich suche eine Maske fuer meine Routine.",
        attachment_priority: 30,
      }
    case "oil":
      return {
        id: "occasional-oil",
        kind: "product_slot",
        phase: "occasional",
        label: "Hair Oiling",
        action: "add",
        category: "oil",
        cadence: "vor einzelnen Waeschen oder sehr sparsam in Spitzen",
        rationale: [
          "Oel wird aufgenommen, weil du diesen Schritt ausdruecklich in der Routine haben moechtest.",
          "Es ist eher Finish oder Pre-Wash-Schutz, nicht die Hauptpflege fuer trockene Laengen.",
        ],
        caveats: ["Sehr sparsam einsetzen; bei beschwertem oder wachsigem Haar nicht weiter schichten."],
        topic_ids: ["hair_oiling"],
        product_linkable: true,
        product_query: "Ich moechte Hair Oiling vor dem Waschen machen.",
        attachment_priority: 40,
      }
    case "bondbuilder":
      return {
        id: "occasional-bond-builder",
        kind: "product_slot",
        phase: "occasional",
        label: "Bond Builder / Repair-Support",
        action: "add",
        category: "bondbuilder",
        cadence: "nach Produktprotokoll",
        rationale: [
          "Bondbuilder wird aufgenommen, weil du diesen Schritt ausdruecklich in der Routine haben moechtest.",
          "Er ist nur dann fachlich stark, wenn echte Strukturstress-Signale vorliegen.",
        ],
        caveats: ["Nicht als Feuchtigkeitsmaske oder Basis-Conditioner behandeln; genaue Anwendung braucht Produktdaten."],
        topic_ids: ["bond_builder"],
        product_linkable: true,
        product_query: "Ich suche einen Bondbuilder fuer meine Routine.",
        attachment_priority: 50,
      }
    case "deep_cleansing_shampoo":
      return {
        id: "occasional-deep-cleansing-shampoo",
        kind: "product_slot",
        phase: "occasional",
        label: "Tiefenreinigungsshampoo / Haar-Reset",
        action: "add",
        category: "deep_cleansing_shampoo",
        cadence: "bei deutlichem Build-up nach Bedarf",
        rationale: [
          "Tiefenreinigung wird aufgenommen, weil du diesen Schritt ausdruecklich in der Routine haben moechtest.",
          "Sie ist ein gelegentlicher Reset fuer Rueckstaende, kein normales Shampoo fuer jede Waesche.",
        ],
        caveats: ["Danach Conditioner oder passende Laengenpflege einplanen; nicht bei brennender oder gereizter Kopfhaut eskalieren."],
        topic_ids: ["tiefenreinigung"],
        product_linkable: true,
        product_query: "Ich suche ein Tiefenreinigungsshampoo fuer meine Routine.",
        attachment_priority: 96,
      }
    case "peeling":
      return {
        id: "occasional-peeling",
        kind: "product_slot",
        phase: "occasional",
        label: "Kopfhautpeeling",
        action: "add",
        category: "peeling",
        cadence: "punktuell bei belegtem Ansatz",
        rationale: [
          "Kopfhautpeeling wird aufgenommen, weil du diesen Schritt ausdruecklich in der Routine haben moechtest.",
          "Es ist ein gelegentlicher Kopfhaut-Schritt fuer kosmetische Rueckstaende, keine Behandlung fuer Schmerzen, Entzuendung oder Haarausfall.",
        ],
        caveats: ["Nicht bei Brennen, Wunden, starken Schuppen, Entzuendung oder ungewoehnlichem Haarverlust eskalieren."],
        topic_ids: ["tiefenreinigung"],
        product_linkable: true,
        product_query: "Ich suche ein Kopfhautpeeling fuer meine Routine.",
        attachment_priority: 95,
      }
    case "dry_shampoo":
      return {
        id: "maintenance-dry-shampoo",
        kind: "product_slot",
        phase: "maintenance",
        label: "Trockenshampoo",
        action: "add",
        category: "dry_shampoo",
        cadence: "als kurze Frische-Hilfe zwischen Waeschen",
        rationale: [
          "Trockenshampoo wird aufgenommen, weil du diesen Schritt ausdruecklich in der Routine haben moechtest.",
          "Es ist eine optische Ueberbrueckung am Ansatz und kein Ersatz fuer Waschen.",
        ],
        caveats: ["Bei Juckreiz, Brennen, Schuppen oder viel Schichtung nicht weiter eskalieren."],
        topic_ids: [],
        product_linkable: true,
        product_query: "Ich suche ein Trockenshampoo fuer meine Routine.",
        attachment_priority: 45,
      }
    default:
      return null
  }
}
```

Keep this registry small and category-level. Do not add product IDs, product labels, or product-specific protocol.

- [ ] **Step 3: Ensure the forced slot is added once**

Add this helper:

```ts
function hasRoutineCategorySlot(
  sections: Map<RoutinePlanSection["phase"], RoutineSlotAdvice[]>,
  category: RoutineProductCategory,
): boolean {
  return [...sections.values()].some((slots) => slots.some((slot) => slot.category === category))
}
```

At the end of `buildRoutineSlots`, before `return sections`, add:

```ts
const forcedCategory = options.forceRequestedCategory
if (forcedCategory && !hasRoutineCategorySlot(sections, forcedCategory)) {
  const forcedSlot = buildForcedRequestedCategorySlot(forcedCategory, profile)
  if (forcedSlot) {
    pushSlot(sections, forcedSlot)
  }
}
```

- [ ] **Step 4: Keep basics projection capped at three and requested-category-first**

Extend `projectRoutinePlanForLayer` options:

```ts
options: {
  requestedCategory?: RoutineProductCategory | null
  requestedTopicId?: RoutineTopicId | null
  preferRequestedCategory?: boolean
} = {},
```

In the basics branch, use requested category as the third slot when `preferRequestedCategory` is true:

```ts
const requestedCategorySlot =
  options.requestedCategory === null || options.requestedCategory === undefined
    ? undefined
    : slots.find((slot) => slot.category === options.requestedCategory)

if (layer === "basics") {
  visibleSlots = [
    findRoutineSlot(plan, "base-shampoo"),
    findRoutineSlot(plan, "base-conditioner"),
    options.preferRequestedCategory && requestedCategorySlot
      ? requestedCategorySlot
      : plan.priority_lever
        ? findRoutineSlot(plan, plan.priority_lever.slot_id)
        : undefined,
  ].filter((slot, index, selected): slot is RoutineSlotAdvice => {
    return Boolean(slot) && selected.findIndex((candidate) => candidate?.id === slot?.id) === index
  })
}
```

- [ ] **Step 5: Run planner tests and confirm GREEN**

Run:

```bash
npx playwright test tests/routine-planner.spec.ts --project=chromium --grep "explicit requested category"
```

Expected: PASS.

## Task 3: Thread Mutation Kind Through The Routine Tool And Compare Lab

**Files:**
- Modify: `src/lib/agent/tools/build-or-fix-routine.ts`
- Modify: `src/lib/agent-v2/compare/run-agent-v2.ts`
- Modify: `tests/agent-routine-tool.spec.ts`

- [ ] **Step 1: Add a routine tool regression**

Add this test to `tests/agent-routine-tool.spec.ts`:

```ts
test("projectRoutinePlan includes explicit add-step category in basics", () => {
  const result = projectRoutinePlan({
    hairProfile: createProfile({
      hair_texture: "straight",
      thickness: "fine",
      concerns: ["buildup"],
      goals: ["shine"],
      current_routine_products: ["shampoo", "conditioner"],
    }),
    message: "Bau ein Leave-in in meine Routine ein.",
    layer: "basics",
    requestedCategory: "leave_in",
    mutationKind: "add_step",
  })

  assert.deepEqual(
    result.steps.map((step) => step.id),
    ["base-shampoo", "base-conditioner", "maintenance-leave-in"],
  )

  const leaveInStep = result.steps.find((step) => step.id === "maintenance-leave-in")
  assert.equal(leaveInStep?.category, "leave_in")
  assert.match(leaveInStep?.reasons.join(" ") ?? "", /ausdruecklich|aufnehmen/i)
})
```

- [ ] **Step 2: Run and confirm RED**

Run:

```bash
npx tsx --test --test-concurrency=1 --test-name-pattern "explicit add-step category" tests/agent-routine-tool.spec.ts
```

Expected: FAIL until `mutationKind` is accepted and threaded.

- [ ] **Step 3: Add a local routine-tool mutation-kind type without duplicating schema enums**

In `src/lib/agent/tools/build-or-fix-routine.ts`, derive from the AgentV2 tool schema type instead of redeclaring enum literals:

```ts
import type { BuildOrFixRoutineToolInput as AgentV2BuildOrFixRoutineToolInput } from "@/lib/agent-v2/tools/tool-definitions"

type BuildOrFixRoutineMutationKind = AgentV2BuildOrFixRoutineToolInput["mutation_kind"]
```

Extend `BuildOrFixRoutineToolInput`:

```ts
mutationKind?: BuildOrFixRoutineMutationKind
```

- [ ] **Step 4: Pass forced category only for explicit add-step**

In `projectRoutinePlan`, compute:

```ts
const forceRequestedCategory =
  params.mutationKind === "add_step" ? (params.requestedCategory ?? null) : null
```

Call the planner:

```ts
const plan = buildRoutinePlan(hairProfile, message, {
  usesBondBuilder: context.usesBondBuilder,
  forceRequestedCategory,
})
```

When calling `projectRoutinePlanForLayer`, pass:

```ts
preferRequestedCategory: params.mutationKind === "add_step",
```

- [ ] **Step 5: Pass `mutation_kind` into the underlying routine tool in Compare Lab**

In `src/lib/agent-v2/compare/run-agent-v2.ts`, update the `build_or_fix_routine` adapter:

```ts
const mutationKind =
  typeof input.mutation_kind === "string" ? input.mutation_kind : null

const projection = await buildRoutine({
  objective:
    input.objective === "build_routine" || input.objective === "fix_routine"
      ? input.objective
      : "build_routine",
  message,
  hairProfile: context.profile,
  layer: input.requested_layer as Parameters<typeof buildRoutine>[0]["layer"],
  requestedCategory: input.requested_category as Parameters<typeof buildRoutine>[0]["requestedCategory"],
  mutationKind: mutationKind as Parameters<typeof buildRoutine>[0]["mutationKind"],
})
```

- [ ] **Step 6: Run routine tool tests and confirm GREEN**

Run:

```bash
npx tsx --test --test-concurrency=1 tests/agent-routine-tool.spec.ts
```

Expected: PASS.

## Task 4: Add Runtime Regression For Product Follow-Up To Category Routine Step

**Files:**
- Modify: `tests/agent-v2-responses-runtime.spec.ts`

- [ ] **Step 1: Add runtime regression**

Add this test near existing routine mutation follow-up tests:

```ts
test("AgentV2 runtime accepts category-level routine mutation for referenced product follow-up", async () => {
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
      reason: "User wants the referenced Pantene product represented as a Leave-in step.",
      routine_intent: "modify",
      mutation_kind: "add_step",
      evidence_quote: "das von pantene",
    }),
    validRoutineMutationTerminal("call_3", {
      careCategory: "leave_in",
      routineIntent: "modify",
      evidenceQuote: "das von pantene",
      stepIds: ["base-shampoo", "base-conditioner", "maintenance-leave-in"],
      categoryLabel: "Leave-in",
    }),
  ])
  let routineInput: Record<string, unknown> | null = null

  const result = await runAgentV2ResponsesTurn({
    client,
    message: "das von pantene",
    recentMessages: [
      { role: "user", content: "Welches Leave-in passt zu mir?" },
      {
        role: "assistant",
        content: "**Pantene Pro-V Miracles 7in1 Haaroel Spray** ist eine passende leichte Option.",
      },
      { role: "user", content: "Bau das Produkt bitte in meine Routine ein." },
      { role: "assistant", content: "Gern - welches Leave-in soll ich einbauen?" },
    ],
    currentRoutineLayer: "basics",
    routineThreadContext: {
      active: true,
      current_layer: "basics",
      last_answer_mode: "clarification",
      last_routine_categories: ["leave_in"],
      last_user_goal: "Bau das Produkt bitte in meine Routine ein.",
      summary_de: "Gern - welches Leave-in soll ich einbauen?",
      pending_routine_action: null,
      visible_steps: [],
    },
    userContext: { hairProfile: null, routineInventory: [{ category: "shampoo" }], sessionMemory: [] },
    tools: {
      ...fakeAgentV2ToolsWithRoutineSteps([
        "base-shampoo",
        "base-conditioner",
        "maintenance-leave-in",
      ]),
      build_or_fix_routine: async (input) => {
        routineInput = input
        return {
          routine_layer: "basics",
          visible_steps: [
            { step_id: "base-shampoo" },
            { step_id: "base-conditioner" },
            { step_id: "maintenance-leave-in" },
          ],
        }
      },
    },
  })

  assert.equal(routineInput?.requested_category, "leave_in")
  assert.equal(routineInput?.mutation_kind, "add_step")
  assert.equal(result.trace.failure_stage, null)
  assert.equal(result.trace.validation_errors.length, 0)
  assert.equal(result.final_answer.answer_mode, "routine")
})
```

- [ ] **Step 2: Run and confirm GREEN**

Run:

```bash
npx tsx --test --test-concurrency=1 --test-name-pattern "category-level routine mutation" tests/agent-v2-responses-runtime.spec.ts
```

Expected: PASS once Task 3 is complete.

## Task 5: Improve Fallback Language For Failed Routine Mutations

**Files:**
- Modify: `src/lib/agent-v2/runtime/responses-agent.ts`
- Modify: `tests/agent-v2-responses-runtime.spec.ts`

- [ ] **Step 1: Add a guidance-gated fallback regression**

Add a test near existing fallback tests. The guidance call is required because `buildRoutineKnownIntentFallback` is intentionally gated by loaded base/category guidance.

```ts
test("AgentV2 runtime uses honest fallback for failed category add routine mutation", async () => {
  const result = await runAgentV2ResponsesTurn({
    client: fakeResponsesClientWithOutputs([
      guidanceCall("call_0", {
        answer_mode_hint: "routine",
        categories: ["leave_in"],
        routine_layer: "basics",
      }),
      functionCall("call_1", "build_or_fix_routine", {
        objective: "fix_routine",
        requested_layer: "basics",
        requested_category: "leave_in",
        reason: "User wants the referenced product represented as a Leave-in step.",
        routine_intent: "modify",
        mutation_kind: "add_step",
        evidence_quote: "das von pantene",
      }),
      terminalCall("call_2", {
        ...terminalGeneralAdviceArguments(),
        answer_mode: "routine",
        request_interpretation: requestInterpretation({
          primary_intent: "routine_mutation",
          product_request_kind: "none",
          routine_intent: "modify",
          care_category: "leave_in",
          requested_product_count: null,
          count_policy: "none",
          evidence_quote: "das von pantene",
          confidence: 0.9,
        }),
        tool_grounding: {
          used_guidance_package_ids: requiredGuidanceForAnswer("routine", "leave_in"),
          used_product_tool: false,
          used_routine_tool: true,
          product_ids: [],
          routine_step_ids: ["invented-leave-in"],
          hard_rule_ids: [],
        },
        routine_context: {
          active: true,
          routine_layer: "basics",
          step_id: null,
          category: "leave_in",
          return_path: [],
        },
        payload: {
          user_facing_answer_de: "Ich habe Leave-in eingebaut.",
          routine_layer: "basics",
          visible_steps: [
            {
              step_id: "invented-leave-in",
              label_de: "Leave-in",
              action_de: "Nach dem Conditioner nutzen.",
              frequency_de: "Nach Bedarf",
              reason_de: "Vom Nutzer gewuenscht.",
            },
          ],
          next_layer_options: ["goals"],
          next_step_offer_de: null,
        },
      }),
    ]),
    message: "das von pantene",
    recentMessages: [],
    userContext: { hairProfile: null, routineInventory: [{ category: "shampoo" }], sessionMemory: [] },
    tools: fakeAgentV2ToolsWithRoutineSteps(["base-shampoo", "base-conditioner"]),
  })

  assert.match(result.final_answer.payload.user_facing_answer_de, /Leave-in/i)
  assert.match(result.final_answer.payload.user_facing_answer_de, /nicht sauber/i)
  assert.doesNotMatch(result.final_answer.payload.user_facing_answer_de, /Routine nicht groesser/i)
})
```

- [ ] **Step 2: Run and confirm RED**

Run:

```bash
npx tsx --test --test-concurrency=1 --test-name-pattern "honest fallback" tests/agent-v2-responses-runtime.spec.ts
```

Expected: FAIL because current fallback says "Routine nicht groesser machen als noetig" or falls back too generically.

- [ ] **Step 3: Replace generic known-intent fallback copy**

In `buildRoutineKnownIntentFallback`, branch for `mutation_kind === "add_step"` and a known `requested_category`.

Use category labels:

```ts
const CATEGORY_LABELS: Record<string, string> = {
  leave_in: "Leave-in",
  conditioner: "Conditioner",
  mask: "Maske",
  oil: "Oel",
  deep_cleansing_shampoo: "Tiefenreinigung",
  dry_shampoo: "Trockenshampoo",
  peeling: "Kopfhautpeeling",
  bondbuilder: "Bondbuilder",
  shampoo: "Shampoo",
}
```

For failed add-step mutation:

```ts
const requestedLabel = CATEGORY_LABELS[requestedCategory] ?? "diesen Schritt"
const addStepFailureCopy =
  `Ich habe verstanden, dass du ${requestedLabel} in die Routine aufnehmen moechtest. Gerade konnte ich den Schritt aber nicht sauber in der Routine verankern. Ich wuerde ihn deshalb nicht als gespeicherten Routine-Schritt ausgeben, sondern die Routine-Anpassung noch einmal sauber pruefen.`
```

- [ ] **Step 4: Run and confirm GREEN**

Run:

```bash
npx tsx --test --test-concurrency=1 --test-name-pattern "honest fallback" tests/agent-v2-responses-runtime.spec.ts
```

Expected: PASS.

## Task 6: Update Model And Tool Guidance

**Files:**
- Modify: `src/lib/agent-v2/runtime/responses-agent.ts`
- Modify: `src/lib/agent-v2/tools/tool-definitions.ts`
- Modify: `tests/agent-v2-responses-runtime.spec.ts`

- [ ] **Step 1: Update terminal system guidance**

In the system prompt rules near the existing routine payload instructions, add:

```ts
"For routine answers, payload.visible_steps and tool_grounding.routine_step_ids must use only step IDs returned by build_or_fix_routine or active routineThreadContext. Never invent a routine step ID for a product or category.",
"For product-reference routine changes, mutate the category-level routine step for now. You may mention the grounded product name in user-facing prose, but do not create product-level routine state or product-named step IDs.",
```

- [ ] **Step 2: Update `build_or_fix_routine` tool description**

Append:

```ts
"For explicit add-step requests with requested_category, the tool returns the category-level routine step. Product names belong in prose only unless a future product-level routine tracker is available."
```

- [ ] **Step 3: Update description assertion**

In `tests/agent-v2-responses-runtime.spec.ts`, update the existing routine tool description test to assert the new behavior:

```ts
assert.match(tool.description, /category-level routine step/)
assert.match(tool.description, /Product names belong in prose/)
```

- [ ] **Step 4: Run description test**

Run:

```bash
npx tsx --test --test-concurrency=1 --test-name-pattern "routine tool description" tests/agent-v2-responses-runtime.spec.ts
```

Expected: PASS.

## Task 7: Full Verification And Compare Lab Check

**Files:**
- No planned source edits.

- [ ] **Step 1: Run focused tests**

Run:

```bash
npx playwright test tests/routine-planner.spec.ts --project=chromium --grep "explicit requested category"
npx tsx --test --test-concurrency=1 tests/agent-routine-tool.spec.ts tests/agent-v2-tool-projections.spec.ts tests/agent-v2-final-answer-validator.spec.ts tests/agent-v2-responses-runtime.spec.ts tests/agent-v2-compare-runner.spec.ts
```

Expected: all tests pass.

- [ ] **Step 2: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: exit code 0.

- [ ] **Step 3: Run live Compare Lab prompt**

In `http://localhost:3283/labs/agent-compare`, run:

```text
Welches Leave-in passt zu mir?
Bau das Produkt bitte in meine Routine ein.
das von pantene
```

Expected:

- No `repair_failed`
- No `known_routine_step_ids` validation error
- If product reference is understood, answer says Pantene belongs conversationally to the `Leave-in` step
- Routine payload step is category-level `Leave-in / Finish`
- No product-named invented step ID such as `leave-in-pantene`
- If product reference is not clear, answer asks one clarification instead of producing generic fallback

## Completion Criteria

- Explicit category `add_step` requests cause the planner to emit the requested category slot.
- Basics remains capped at three visible steps; requested category wins the third slot for explicit add-step mutations.
- The model can mention grounded product names in prose while keeping routine state category-level.
- The validator still rejects invented routine step IDs.
- Failed routine mutation repair produces honest category-specific fallback, not generic advice.
- Focused tests and typecheck pass.

## Rollback

Revert the planner `forceRequestedCategory` option, the routine-tool `mutationKind` plumbing, and the fallback copy changes. Because validators remain strict, rollback should restore prior routine projection behavior without changing product validation rules.

## Execution Choice

Plan complete. Recommended execution mode: **Subagent-Driven**, with one worker for planner/routine-tool plumbing and one worker for AgentV2 runtime/fallback/tests, then a final review before Compare Lab testing.
