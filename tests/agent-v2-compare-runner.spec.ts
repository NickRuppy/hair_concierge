import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import { normalizeCompareSystem } from "../src/lib/agent/compare/run-compare"
import {
  classifyAgentV2SafetyMode,
  formatAgentV2RequestInterpretationSummary,
  normalizeAgentV2MatchedProductsForFinalAnswer,
  updateAgentV2RoutineThreadContext,
} from "../src/lib/agent-v2/compare/run-agent-v2"

test("Compare Lab accepts agent_v2 system", () => {
  assert.equal(normalizeCompareSystem("agent_v2"), "agent_v2")
})

test("AgentV2 Compare runner hard short-circuits severe safety wording", () => {
  assert.equal(
    classifyAgentV2SafetyMode(
      "Meine Kopfhaut blutet und meine Haare fallen in Buescheln aus. Welches Produkt soll ich nehmen?",
    ),
    "hard_short_circuit",
  )
})

test("AgentV2 Compare runner classifies scalp safety into three modes", () => {
  assert.equal(
    classifyAgentV2SafetyMode("Ich habe empfindliche Kopfhaut und suche ein mildes Shampoo."),
    "normal",
  )
  assert.equal(
    classifyAgentV2SafetyMode(
      "Meine Kopfhaut juckt und ist gerötet, welches Shampoo soll ich nehmen?",
    ),
    "restricted",
  )
  assert.equal(
    classifyAgentV2SafetyMode("Meine Kopfhaut juckt und ich habe Schuppen."),
    "restricted",
  )
  assert.equal(
    classifyAgentV2SafetyMode("Meine Kopfhaut blutet und brennt stark."),
    "hard_short_circuit",
  )
})

test("AgentV2 Compare runner keeps cosmetic scalp profile wording normal", () => {
  assert.equal(
    classifyAgentV2SafetyMode("Meine Kopfhaut ist manchmal juckend, ich suche etwas Mildes."),
    "normal",
  )
  assert.equal(
    classifyAgentV2SafetyMode(
      "Im Profil steht gereizte Kopfhaut, welches Shampoo passt langfristig?",
    ),
    "normal",
  )
})

const scenarios = JSON.parse(
  readFileSync("data/agent-v2/evals/agent-v2-scenarios.json", "utf-8"),
) as Array<{ dimension: string }>
const positiveReferences = JSON.parse(
  readFileSync("data/agent-v2/evals/positive-reference-cases.json", "utf-8"),
) as Array<{
  prompt: string
  positive_feedback_note: string
  qualities_to_preserve: string[]
  requires_textual_match: boolean
}>

test("AgentV2 scenarios cover required evaluation dimensions", () => {
  const dimensions = new Set(scenarios.map((scenario) => scenario.dimension))

  for (const dimension of [
    "product_grounding",
    "routine_basics",
    "routine_product_deep_dive",
    "general_category_advice",
    "constraint_blocked",
    "safety_boundary",
    "tone",
  ]) {
    assert.ok(dimensions.has(dimension), `missing dimension ${dimension}`)
  }
})

test("positive references record qualities, not golden wording", () => {
  assert.ok(Array.isArray(positiveReferences))
  assert.ok(positiveReferences.length >= 3)
  for (const item of positiveReferences) {
    assert.ok(item.prompt.length > 0)
    assert.ok(item.positive_feedback_note.length > 0)
    assert.ok(item.qualities_to_preserve.length > 0)
    assert.equal(item.requires_textual_match, false)
  }
})

test("AgentV2 Compare runner preserves routine thread context across follow-up turns", () => {
  const initialContext = updateAgentV2RoutineThreadContext(null, {
    answer_mode: "routine",
    user_message: "Meine Routine ist zu viel, mach sie einfacher.",
    answer: {
      answer_mode: "routine",
      payload: {
        routine_layer: "basics",
        visible_steps: [
          {
            step_id: "base-shampoo",
            label_de: "Shampoo",
            action_de: "Am Ansatz reinigen.",
            frequency_de: "Nach Bedarf",
            reason_de: "Basis der Routine.",
          },
          {
            step_id: "base-conditioner",
            label_de: "Conditioner",
            action_de: "In die Laengen geben.",
            frequency_de: "Nach jeder Waesche",
            reason_de: "Pflegt die Laengen.",
          },
        ],
      },
    },
    routine_context: {
      active: true,
      routine_layer: "basics",
      category: null,
    },
    categories: ["shampoo", "conditioner"],
    summary_de: "Vereinfachte Basisroutine mit Shampoo und Conditioner.",
  })

  const followUpContext = updateAgentV2RoutineThreadContext(initialContext, {
    answer_mode: "general_advice",
    user_message: "Brauche ich dann eher Maske oder Conditioner?",
    routine_context: {
      active: true,
      routine_layer: "basics",
      category: "conditioner",
    },
    categories: [],
    summary_de: "Conditioner bleibt der Basis-Schritt; Maske ist optional.",
  })

  assert.equal(followUpContext.active, true)
  assert.equal(followUpContext.current_layer, "basics")
  assert.equal(followUpContext.last_answer_mode, "general_advice")
  assert.deepEqual(followUpContext.last_routine_categories, ["shampoo", "conditioner"])
  assert.equal(followUpContext.last_user_goal, "Meine Routine ist zu viel, mach sie einfacher.")
  assert.ok(followUpContext.summary_de)
  assert.match(followUpContext.summary_de, /Conditioner/)
  assert.deepEqual(
    followUpContext.visible_steps.map((step) => ({
      step_id: step.step_id,
      label_de: step.label_de,
      category: step.category,
      order: step.order,
      routine_layer: step.routine_layer,
    })),
    [
      {
        step_id: "base-shampoo",
        label_de: "Shampoo",
        category: "shampoo",
        order: 1,
        routine_layer: "basics",
      },
      {
        step_id: "base-conditioner",
        label_de: "Conditioner",
        category: "conditioner",
        order: 2,
        routine_layer: "basics",
      },
    ],
  )
})

test("AgentV2 Compare runner preserves previous routine layer when active follow-up omits layer", () => {
  const initialContext = updateAgentV2RoutineThreadContext(null, {
    answer_mode: "routine",
    user_message: "Meine Routine ist zu viel, mach sie einfacher.",
    routine_context: {
      active: true,
      routine_layer: "basics",
      category: null,
    },
    categories: ["shampoo", "conditioner"],
    summary_de: "Vereinfachte Basisroutine mit Shampoo und Conditioner.",
  })

  const followUpContext = updateAgentV2RoutineThreadContext(initialContext, {
    answer_mode: "general_advice",
    user_message: "Brauche ich dann eher Maske oder Conditioner?",
    routine_context: {
      active: true,
      routine_layer: null,
      category: "conditioner",
    },
    categories: [],
    summary_de: "Conditioner bleibt der Basis-Schritt.",
  })

  assert.equal(followUpContext.active, true)
  assert.equal(followUpContext.current_layer, "basics")
})

test("AgentV2 Compare runner updates visible routine step category from routine product deep dives", () => {
  const initialContext = updateAgentV2RoutineThreadContext(null, {
    answer_mode: "routine",
    user_message: "Ich will meine Routine einfacher machen.",
    answer: {
      answer_mode: "routine",
      payload: {
        routine_layer: "goals",
        visible_steps: [
          {
            step_id: "goal-leave-in",
            label_de: "Erster Zusatz",
            action_de: "Leave-in in die Laengen geben.",
            frequency_de: "Nach der Waesche",
            reason_de: "Mehr Pflege ohne viel Aufwand.",
          },
        ],
      },
    },
    routine_context: {
      active: true,
      routine_layer: "goals",
      category: null,
    },
    categories: ["leave_in"],
    summary_de: "Ein erster Zusatz ist sinnvoll.",
  })

  assert.equal(initialContext.visible_steps[0]?.category, "leave_in")

  const deepDiveContext = updateAgentV2RoutineThreadContext(initialContext, {
    answer_mode: "routine_product_deep_dive",
    user_message: "Welches Produkt passt fuer den ersten Zusatz?",
    answer: {
      answer_mode: "routine_product_deep_dive",
      payload: {
        step_id: "goal-leave-in",
        category: "leave_in",
      },
    },
    routine_context: {
      active: true,
      routine_layer: "deep_dive",
      category: "leave_in",
    },
    categories: ["leave_in"],
    summary_de: "Dafuer passt ein leichtes Leave-in.",
  })

  assert.deepEqual(deepDiveContext.visible_steps, [
    {
      step_id: "goal-leave-in",
      label_de: "Erster Zusatz",
      category: "leave_in",
      order: 1,
      routine_layer: "goals",
    },
  ])
})

test("AgentV2 Compare runner formats compact request interpretation summaries", () => {
  assert.equal(
    formatAgentV2RequestInterpretationSummary({
      primary_intent: "product_recommendation",
      product_request_kind: "specific_products",
      routine_intent: "none",
      category: "conditioner",
      requested_product_count: 2,
      count_policy: "exact",
      evidence_quote: "zwei Conditioner",
      confidence: 0.914,
    }),
    "Intent: product_recommendation · specific_products · conditioner · 2 exact · confidence 0.91",
  )
})

test("AgentV2 matched products reflect final surfaced product ids, not every selected candidate", () => {
  const projections = [
    {
      category: "conditioner",
      products: [
        { product_id: "pantene", name: "Pantene Miracles Bond Repair" },
        { product_id: "syoss", name: "Syoss Intense Keratin" },
        { product_id: "guhl", name: "Guhl Bond+" },
      ],
    },
  ] as unknown as Parameters<typeof normalizeAgentV2MatchedProductsForFinalAnswer>[0]
  const answer = {
    answer_mode: "product_recommendation",
    tool_grounding: {
      product_ids: ["pantene", "syoss"],
    },
    payload: {
      recommendations: [{ product_id: "pantene" }, { product_id: "syoss" }],
    },
  } as unknown as Parameters<typeof normalizeAgentV2MatchedProductsForFinalAnswer>[1]

  assert.deepEqual(normalizeAgentV2MatchedProductsForFinalAnswer(projections, answer), [
    { name: "Pantene Miracles Bond Repair", category: "conditioner" },
    { name: "Syoss Intense Keratin", category: "conditioner" },
  ])
})

test("AgentV2 matched products preserve final answer order and ignore duplicates or unknown ids", () => {
  const projections = [
    {
      category: "conditioner",
      products: [
        { product_id: "pantene", name: "Pantene Miracles Bond Repair" },
        { product_id: "syoss", name: "Syoss Intense Keratin" },
        { product_id: "guhl", name: "Guhl Bond+" },
      ],
    },
  ] as unknown as Parameters<typeof normalizeAgentV2MatchedProductsForFinalAnswer>[0]
  const answer = {
    answer_mode: "product_recommendation",
    tool_grounding: {
      product_ids: ["syoss", "missing", "pantene", "syoss"],
    },
    payload: {
      recommendations: [{ product_id: "syoss" }, { product_id: "pantene" }],
    },
  } as unknown as Parameters<typeof normalizeAgentV2MatchedProductsForFinalAnswer>[1]

  assert.deepEqual(normalizeAgentV2MatchedProductsForFinalAnswer(projections, answer), [
    { name: "Syoss Intense Keratin", category: "conditioner" },
    { name: "Pantene Miracles Bond Repair", category: "conditioner" },
  ])
})

test("AgentV2 matched products ignore extra grounding ids that are not visibly recommended", () => {
  const projections = [
    {
      category: "conditioner",
      products: [
        { product_id: "pantene", name: "Pantene Miracles Bond Repair" },
        { product_id: "syoss", name: "Syoss Intense Keratin" },
        { product_id: "guhl", name: "Guhl Bond+" },
      ],
    },
  ] as unknown as Parameters<typeof normalizeAgentV2MatchedProductsForFinalAnswer>[0]
  const answer = {
    answer_mode: "product_recommendation",
    tool_grounding: {
      product_ids: ["pantene", "syoss", "guhl"],
    },
    payload: {
      recommendations: [{ product_id: "pantene" }, { product_id: "syoss" }],
    },
  } as unknown as Parameters<typeof normalizeAgentV2MatchedProductsForFinalAnswer>[1]

  assert.deepEqual(normalizeAgentV2MatchedProductsForFinalAnswer(projections, answer), [
    { name: "Pantene Miracles Bond Repair", category: "conditioner" },
    { name: "Syoss Intense Keratin", category: "conditioner" },
  ])
})

test("AgentV2 matched products stay empty for non-product final answers", () => {
  const projections = [
    {
      category: "conditioner",
      products: [{ product_id: "pantene", name: "Pantene Miracles Bond Repair" }],
    },
  ] as unknown as Parameters<typeof normalizeAgentV2MatchedProductsForFinalAnswer>[0]
  const answer = {
    answer_mode: "general_advice",
    tool_grounding: {
      product_ids: [],
    },
    payload: {
      user_facing_answer_de: "Ein Conditioner reicht oft aus.",
    },
  } as unknown as Parameters<typeof normalizeAgentV2MatchedProductsForFinalAnswer>[1]

  assert.deepEqual(normalizeAgentV2MatchedProductsForFinalAnswer(projections, answer), [])
})
