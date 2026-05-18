import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import {
  AgentV2RequestInterpretationSchema,
  AgentV2RoutineThreadContextSchema,
  AgentV2TerminalAnswerSchema,
  type AgentV2RequestInterpretation,
  type AgentV2TerminalAnswer,
} from "../src/lib/agent-v2/contracts"
import { DEFAULT_AGENT_V2_MODEL, getAgentV2ModelPolicy } from "../src/lib/agent-v2/model-policy"

function emptyExtractedConstraints() {
  return {
    hair_concerns: [],
    goals: [],
    product_categories: [],
    budget_eur: null,
    avoid_ingredients: [],
    allergies: [],
    preferences: [],
    routine_layer: null,
    raw_constraints: [],
  }
}

function requestInterpretation(
  overrides: Partial<AgentV2RequestInterpretation> = {},
): AgentV2RequestInterpretation {
  return {
    primary_intent: "general_advice",
    product_request_kind: "none",
    routine_intent: "none",
    category: "none",
    requested_product_count: null,
    count_policy: "none",
    evidence_quote: "Brauche ich wirklich eine Maske?",
    confidence: 0.9,
    ...overrides,
  }
}

test("AgentV2RequestInterpretationSchema accepts strict semantic examples", () => {
  const examples = [
    requestInterpretation({
      primary_intent: "product_recommendation",
      product_request_kind: "specific_products",
      category: "shampoo",
      requested_product_count: 2,
      count_policy: "exact",
      evidence_quote: "Empfiehl mir zwei Shampoos.",
    }),
    requestInterpretation({
      primary_intent: "category_education",
      product_request_kind: "category_education",
      category: "mask",
      count_policy: "none",
      evidence_quote: "Brauche ich wirklich eine Maske?",
    }),
    requestInterpretation({
      primary_intent: "routine_mutation",
      routine_intent: "replace_product",
      category: "conditioner",
      evidence_quote: "Tausch den Conditioner aus.",
    }),
    requestInterpretation({
      primary_intent: "routine_exit",
      routine_intent: "exit",
      evidence_quote: "Zurueck zur normalen Beratung.",
    }),
    requestInterpretation({
      primary_intent: "general_advice",
      category: "oil",
      evidence_quote: "Wie verwende ich Haaroel?",
    }),
    requestInterpretation({
      primary_intent: "clarification",
      category: "unknown",
      confidence: 0.42,
      evidence_quote: "Was soll ich nehmen?",
    }),
    requestInterpretation({
      primary_intent: "safety_boundary",
      category: "none",
      confidence: 0.98,
      evidence_quote: "Meine Kopfhaut blutet.",
    }),
  ]

  for (const example of examples) {
    assert.deepEqual(AgentV2RequestInterpretationSchema.parse(example), example)
  }
})

test("AgentV2RequestInterpretationSchema requires every semantic field", () => {
  const complete = requestInterpretation()

  for (const key of Object.keys(complete)) {
    const candidate = { ...complete } as Record<string, unknown>
    delete candidate[key]

    assert.equal(
      AgentV2RequestInterpretationSchema.safeParse(candidate).success,
      false,
      `expected missing ${key} to fail`,
    )
  }
})

test("AgentV2RequestInterpretationSchema rejects unknown enum values", () => {
  const result = AgentV2RequestInterpretationSchema.safeParse({
    ...requestInterpretation(),
    primary_intent: "buy_products",
  })

  assert.equal(result.success, false)
})

test("AgentV2RoutineThreadContextSchema accepts visible routine steps", () => {
  const context = {
    active: true,
    current_layer: "basics",
    last_answer_mode: "routine",
    last_routine_categories: ["shampoo", "conditioner", "leave_in"],
    last_user_goal: "Ich will meine Routine einfacher machen.",
    summary_de: "Klar - wir halten sie schlank.",
    visible_steps: [
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
  }

  assert.deepEqual(AgentV2RoutineThreadContextSchema.parse(context), context)
})

test("AgentV2TerminalAnswerSchema accepts a product recommendation payload", () => {
  const value: AgentV2TerminalAnswer = {
    answer_mode: "product_recommendation",
    interpreted_intent: "User wants a concrete shampoo recommendation.",
    request_interpretation: requestInterpretation({
      primary_intent: "product_recommendation",
      product_request_kind: "specific_products",
      category: "shampoo",
      requested_product_count: 1,
      count_policy: "default",
      evidence_quote: "Ich brauche ein Shampoo.",
    }),
    confidence: 0.93,
    extracted_constraints: emptyExtractedConstraints(),
    missing_information: [],
    safety_flags: [],
    tool_grounding: {
      used_guidance_package_ids: ["base.product_recommendation.v1"],
      used_product_tool: true,
      used_routine_tool: false,
      product_ids: ["prod_1"],
      routine_step_ids: [],
      hard_rule_ids: ["product.no_uncatalogued_products"],
    },
    routine_context: {
      active: false,
      routine_layer: null,
      step_id: null,
      category: null,
      return_path: [],
    },
    session_memory_writes: [],
    payload: {
      user_facing_answer_de: "Ich wuerde dir dieses Shampoo empfehlen.",
      recommendations: [
        {
          product_id: "prod_1",
          reason_de: "Passt zu deinem feinen Haar und deiner schnell fettenden Kopfhaut.",
          usage_de: null,
          caveat_de: null,
        },
      ],
      comparison_notes_de: [],
      usage_notes_de: ["Shampoo vor allem am Ansatz verwenden und gruendlich ausspuelen."],
      next_step_offer_de: null,
    },
  }

  assert.equal(AgentV2TerminalAnswerSchema.parse(value).answer_mode, "product_recommendation")
})

test("AgentV2TerminalAnswerSchema requires request interpretation", () => {
  const result = AgentV2TerminalAnswerSchema.safeParse({
    answer_mode: "general_advice",
    interpreted_intent: "User asks for category advice.",
    confidence: 0.9,
    extracted_constraints: emptyExtractedConstraints(),
    missing_information: [],
    safety_flags: [],
    tool_grounding: {
      used_guidance_package_ids: [],
      used_product_tool: false,
      used_routine_tool: false,
      product_ids: [],
      routine_step_ids: [],
      hard_rule_ids: [],
    },
    routine_context: {
      active: false,
      routine_layer: null,
      step_id: null,
      category: null,
      return_path: [],
    },
    session_memory_writes: [],
    payload: {
      user_facing_answer_de: "Eine Maske ist optional.",
      category_or_topic: "mask",
      key_points_de: ["Sie hilft bei zusaetzlichem Pflegebedarf."],
      next_step_offer_de: null,
    },
  })

  assert.equal(result.success, false)
})

test("AgentV2TerminalAnswerSchema rejects unsupported answer modes", () => {
  const result = AgentV2TerminalAnswerSchema.safeParse({
    answer_mode: "random",
    interpreted_intent: "x",
    request_interpretation: requestInterpretation(),
    confidence: 0.5,
    extracted_constraints: emptyExtractedConstraints(),
    missing_information: [],
    safety_flags: [],
    tool_grounding: {
      used_guidance_package_ids: [],
      used_product_tool: false,
      used_routine_tool: false,
      product_ids: [],
      routine_step_ids: [],
      hard_rule_ids: [],
    },
    routine_context: {
      active: false,
      routine_layer: null,
      step_id: null,
      category: null,
      return_path: [],
    },
    session_memory_writes: [],
    payload: {},
  })

  assert.equal(result.success, false)
})

test("AgentV2 model policy defaults to GPT-5.4-mini Responses", () => {
  const policy = getAgentV2ModelPolicy({})
  assert.equal(policy.endpoint, "responses")
  assert.equal(DEFAULT_AGENT_V2_MODEL, "gpt-5.4-mini-2026-03-17")
  assert.equal(policy.model, DEFAULT_AGENT_V2_MODEL)
  assert.equal(policy.reasoning_effort, "low")
  assert.equal(policy.text_verbosity, "low")
  assert.equal(policy.store, false)
})

test("AgentV2 model policy accepts scoped env overrides", () => {
  const policy = getAgentV2ModelPolicy({
    AGENT_V2_MODEL: "gpt-5.4-mini",
    AGENT_V2_REASONING_EFFORT: "medium",
    AGENT_V2_TEXT_VERBOSITY: "medium",
  })

  assert.equal(policy.model, "gpt-5.4-mini")
  assert.equal(policy.reasoning_effort, "medium")
  assert.equal(policy.text_verbosity, "medium")
})

test("AgentV2 positive reference cases preserve quality shape rather than exact wording", () => {
  const cases = JSON.parse(
    readFileSync("data/agent-v2/evals/positive-reference-cases.json", "utf8"),
  ) as Array<Record<string, unknown>>

  assert.ok(cases.length >= 4)
  for (const entry of cases) {
    assert.equal(typeof entry.id, "string")
    assert.equal(entry.source, "manual_review")
    assert.ok(typeof entry.prompt === "string" || Array.isArray(entry.turns))
    assert.equal(typeof entry.positive_feedback_note, "string")
    assert.ok(Array.isArray(entry.qualities_to_preserve))
    assert.equal(entry.requires_textual_match, false)
  }

  const qualities = new Set(
    cases.flatMap((entry) =>
      Array.isArray(entry.qualities_to_preserve)
        ? entry.qualities_to_preserve.filter(
            (quality): quality is string => typeof quality === "string",
          )
        : [],
    ),
  )

  for (const expectedQuality of [
    "product recommendation fulfilled",
    "explicit count respected",
    "direct answer first",
    "profile-linked why",
    "category education first",
    "no forced product recommendation",
  ]) {
    assert.ok(
      qualities.has(expectedQuality),
      `missing positive reference quality: ${expectedQuality}`,
    )
  }
})

test("AgentV2 request interpretation regression fixture is structurally valid", () => {
  const cases = JSON.parse(
    readFileSync("data/agent-v2/evals/request-interpretation-regression.json", "utf8"),
  ) as Array<Record<string, unknown>>

  const primaryIntents = new Set([
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
  ])
  const productRequestKinds = new Set([
    "none",
    "specific_products",
    "category_education",
    "compare_products",
    "product_detail",
    "routine_product_deep_dive",
  ])
  const routineIntents = new Set([
    "none",
    "create",
    "modify",
    "remove_step",
    "replace_product",
    "explain",
    "summarize",
    "exit",
  ])
  const categories = new Set([
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
  ])
  const countPolicies = new Set(["none", "exact", "default", "cap"])
  const toolRequirements = new Set(["none", "select_products", "build_or_fix_routine"])
  const answerQualityCriteria = new Set([
    "direct_german_answer_first",
    "no_raw_internal_or_tool_language",
    "no_bullet_wall",
    "use_profile_or_context_when_available",
    "practical_next_step_or_caveat",
  ])

  assert.ok(cases.length >= 20)

  for (const entry of cases) {
    assert.equal(typeof entry.id, "string")
    assert.ok(
      typeof entry.prompt === "string" || Array.isArray(entry.turns),
      `${entry.id}: missing prompt or turns`,
    )
    assert.equal(typeof entry.description, "string")

    const expected = entry.expected as Record<string, unknown>
    assert.equal(typeof expected, "object", `${entry.id}: missing expected object`)
    assert.ok(
      primaryIntents.has(String(expected.primary_intent)),
      `${entry.id}: unsupported primary_intent`,
    )
    assert.ok(
      productRequestKinds.has(String(expected.product_request_kind)),
      `${entry.id}: unsupported product_request_kind`,
    )
    assert.ok(
      routineIntents.has(String(expected.routine_intent)),
      `${entry.id}: unsupported routine_intent`,
    )
    assert.ok(categories.has(String(expected.category)), `${entry.id}: unsupported category`)
    assert.ok(
      countPolicies.has(String(expected.count_policy)),
      `${entry.id}: unsupported count_policy`,
    )
    assert.ok(
      typeof expected.requested_product_count === "number" ||
        expected.requested_product_count === null,
      `${entry.id}: requested_product_count must be number or null`,
    )
    assert.ok(
      toolRequirements.has(String(expected.required_tool)),
      `${entry.id}: unsupported required_tool`,
    )
    assert.equal(typeof expected.must_not_surface_products, "boolean")
    assert.equal(typeof expected.must_not_mutate_routine, "boolean")
    assert.ok(
      expected.safety_mode === null ||
        ["normal", "restricted", "hard_short_circuit"].includes(String(expected.safety_mode)),
      `${entry.id}: unsupported safety_mode`,
    )
    assert.equal(typeof expected.requires_evidence_quote, "boolean")

    const criteria = entry.answer_quality_criteria
    assert.ok(Array.isArray(criteria), `${entry.id}: answer_quality_criteria must be an array`)
    assert.ok(
      criteria.length >= 2,
      `${entry.id}: answer_quality_criteria should be light but meaningful`,
    )
    for (const criterion of criteria) {
      assert.ok(
        answerQualityCriteria.has(String(criterion)),
        `${entry.id}: unsupported quality criterion`,
      )
    }
  }

  const dimensions = new Set(cases.map((entry) => entry.dimension))
  for (const expectedDimension of [
    "concrete_product_ask",
    "category_education",
    "explicit_count",
    "vague_count",
    "capped_count",
    "product_comparison",
    "routine_build",
    "routine_mutation",
    "routine_product_deep_dive",
    "routine_summary",
    "routine_exit",
    "multi_turn_reference",
    "safety_hard_short_circuit",
    "safety_restricted",
    "general_advice",
    "smalltalk",
    "unknown",
  ]) {
    assert.ok(
      dimensions.has(expectedDimension),
      `missing regression dimension: ${expectedDimension}`,
    )
  }
})
