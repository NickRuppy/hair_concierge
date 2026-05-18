import assert from "node:assert/strict"
import test from "node:test"

import { validateAgentV2FinalAnswer } from "../src/lib/agent-v2/validation/final-answer-validator"

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
  overrides: Partial<{
    primary_intent:
      | "product_recommendation"
      | "category_education"
      | "routine_build"
      | "routine_mutation"
      | "routine_explanation"
      | "routine_exit"
      | "general_advice"
      | "clarification"
      | "safety_boundary"
      | "smalltalk"
      | "unknown"
    product_request_kind:
      | "none"
      | "specific_products"
      | "category_education"
      | "compare_products"
      | "product_detail"
      | "routine_product_deep_dive"
    routine_intent:
      | "none"
      | "create"
      | "modify"
      | "remove_step"
      | "replace_product"
      | "explain"
      | "summarize"
      | "exit"
    category:
      | "none"
      | "unknown"
      | "shampoo"
      | "conditioner"
      | "mask"
      | "leave_in"
      | "oil"
      | "bondbuilder"
      | "deep_cleansing_shampoo"
      | "dry_shampoo"
      | "peeling"
      | "styling"
      | "treatment"
    requested_product_count: number | null
    count_policy: "none" | "exact" | "default" | "cap"
    evidence_quote: string
    confidence: number
  }> = {},
) {
  return {
    primary_intent: "product_recommendation",
    product_request_kind: "specific_products",
    routine_intent: "none",
    category: "shampoo",
    requested_product_count: null,
    count_policy: "default",
    evidence_quote: "Welches Shampoo passt zu mir?",
    confidence: 0.9,
    ...overrides,
  }
}

const baseAnswer = {
  answer_mode: "product_recommendation",
  interpreted_intent: "User wants a concrete product.",
  request_interpretation: requestInterpretation(),
  confidence: 0.9,
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
    user_facing_answer_de: "**Test Shampoo** passt gut zu deinem Profil.",
    recommendations: [
      {
        product_id: "prod_1",
        reason_de: "Passt zu deinem Profil.",
        usage_de: null,
        caveat_de: null,
      },
    ],
    comparison_notes_de: [],
    usage_notes_de: [],
    next_step_offer_de: null,
  },
} as const

function selectProductsToolCall(
  overrides: Partial<{
    category: string
    reason: string
    user_request: string | null
    constraints: string[]
    product_request_kind: string
    requested_product_count: number | null
    count_policy: string
    evidence_quote: string
  }> = {},
) {
  return {
    name: "select_products",
    call_id: "call_1",
    arguments: {
      category: "shampoo",
      reason: "Concrete product recommendation requested.",
      user_request: "Welches Shampoo passt zu mir?",
      constraints: [],
      product_request_kind: "specific_products",
      requested_product_count: null,
      count_policy: "default",
      evidence_quote: "Welches Shampoo passt zu mir?",
      ...overrides,
    },
  }
}

function routineToolCall(
  overrides: Partial<{
    objective: string | null
    requested_layer: string
    requested_category: string | null
    reason: string
    routine_intent: string
    mutation_kind: string | null
    evidence_quote: string
  }> = {},
) {
  return {
    name: "build_or_fix_routine",
    call_id: "call_routine",
    arguments: {
      objective: "build_routine",
      requested_layer: "basics",
      requested_category: null,
      reason: "Routine requested.",
      routine_intent: "create",
      mutation_kind: "none",
      evidence_quote: "Routine aufbauen",
      ...overrides,
    },
  }
}

const baseValidationContext = {
  selectedProductProjections: [
    {
      tool_name: "select_products",
      category: "shampoo",
      decision: "recommended",
      product_response_policy: "recommend",
      policy_reason: "Passend.",
      valid_product_ids: ["prod_1"],
      products: [
        {
          product_id: "prod_1",
          rank: 1,
          name: "Test Shampoo",
          brand: "Brand",
          price_eur: 12,
          currency: "EUR",
          fit_reason: "Passt.",
          caveat: null,
          unsupported_requested_signals: [],
          supported_claims: [
            {
              field: "shampoo_bucket",
              value: "light",
              evidence: "product_spec",
              label: "leichte Reinigung",
            },
          ],
        },
      ],
      missing_required_data: [],
      constraint_blockers: [],
      allowed_claim_sources: ["selected_products.supported_claims"],
      trace: { profile_basis: [], category_guidance: "" },
    },
  ],
  routineProjections: [],
  latestUserMessage: "Welches Shampoo passt zu mir?",
  recentEvidenceText: "Welches Shampoo passt zu mir?",
  toolCallHistory: [selectProductsToolCall()],
  safetyMode: "normal",
  requiredGuidancePackageIds: ["base.product_recommendation.v1"],
  currentRoutineLayer: null,
  knownHardRuleIds: ["product.no_uncatalogued_products"],
} as const

test("validator accepts known product ids", () => {
  const result = validateAgentV2FinalAnswer(baseAnswer, baseValidationContext)

  assert.equal(result.ok, true)
})

test("validator blocks hallucinated product ids", () => {
  const result = validateAgentV2FinalAnswer(baseAnswer, {
    ...baseValidationContext,
    selectedProductProjections: [],
    toolCallHistory: [],
  })

  assert.equal(result.ok, false)
  assert.ok(result.errors.some((error) => error.validator_id === "known_product_ids"))
})

test("validator blocks payload product ids that bypass tool grounding", () => {
  const result = validateAgentV2FinalAnswer(
    {
      ...baseAnswer,
      tool_grounding: {
        ...baseAnswer.tool_grounding,
        product_ids: [],
      },
      payload: {
        ...baseAnswer.payload,
        recommendations: [
          {
            product_id: "made_up",
            reason_de: "Passt angeblich.",
            usage_de: null,
            caveat_de: null,
          },
        ],
      },
    },
    {
      ...baseValidationContext,
      selectedProductProjections: [],
      toolCallHistory: [],
    },
  )

  assert.equal(result.ok, false)
  assert.ok(result.errors.some((error) => error.validator_id === "known_product_ids"))
  assert.ok(result.errors.some((error) => error.validator_id === "product_tool_required"))
})

test("validator blocks memory leakage in user prose", () => {
  const result = validateAgentV2FinalAnswer(
    {
      ...baseAnswer,
      payload: {
        ...baseAnswer.payload,
        user_facing_answer_de: "Ich speichere diese Erinnerung und empfehle dir dieses Produkt.",
      },
    },
    baseValidationContext,
  )

  assert.equal(result.ok, false)
  assert.ok(result.errors.some((error) => error.validator_id === "no_internal_leakage"))
})

test("validator allows cosmetic treatment wording for frizz", () => {
  const result = validateAgentV2FinalAnswer(
    {
      ...baseAnswer,
      payload: {
        ...baseAnswer.payload,
        user_facing_answer_de:
          "**Test Shampoo** behandelt Frizz kosmetisch und macht die Laengen glaetter.",
      },
    },
    baseValidationContext,
  )

  assert.equal(result.ok, true)
})

test("validator allows public styling tool wording", () => {
  const result = validateAgentV2FinalAnswer(
    {
      ...baseAnswer,
      payload: {
        ...baseAnswer.payload,
        user_facing_answer_de:
          "**Test Shampoo** passt; wenn du ein Styling-Tool nutzt, ist Hitzeschutz fuer die Laengen sinnvoll.",
      },
    },
    baseValidationContext,
  )

  assert.equal(result.ok, true)
})

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

test("validator requires product answers to surface available recommendation options", () => {
  const result = validateAgentV2FinalAnswer(
    {
      ...baseAnswer,
      payload: {
        ...baseAnswer.payload,
        user_facing_answer_de: "**Test Shampoo** passt gut zu deinem Profil.",
        recommendations: [
          {
            product_id: "prod_1",
            reason_de: "Passt als leichte Option.",
            usage_de: null,
            caveat_de: null,
          },
        ],
      },
    },
    {
      ...baseValidationContext,
      toolCallHistory: [
        selectProductsToolCall({
          requested_product_count: 2,
          count_policy: "exact",
        }),
      ],
      selectedProductProjections: [
        {
          valid_product_ids: ["prod_1", "prod_2", "prod_3"],
          products: [
            { product_id: "prod_1", name: "Test Shampoo" },
            { product_id: "prod_2", name: "Second Shampoo" },
            { product_id: "prod_3", name: "Third Shampoo" },
          ],
        },
      ],
    },
  )

  assert.equal(result.ok, false)
  assert.ok(result.errors.some((error) => error.validator_id === "product_answer_shape"))
})

test("validator blocks empty product recommendations when selected products are available", () => {
  const result = validateAgentV2FinalAnswer(
    {
      ...baseAnswer,
      tool_grounding: {
        ...baseAnswer.tool_grounding,
        product_ids: [],
      },
      payload: {
        ...baseAnswer.payload,
        user_facing_answer_de: "Ich habe passende Optionen gefunden.",
        recommendations: [],
      },
    },
    {
      ...baseValidationContext,
      toolCallHistory: [
        selectProductsToolCall({
          requested_product_count: 2,
          count_policy: "exact",
        }),
      ],
      selectedProductProjections: [
        {
          valid_product_ids: ["prod_1", "prod_2", "prod_3"],
          products: [
            { product_id: "prod_1", name: "Test Shampoo" },
            { product_id: "prod_2", name: "Second Shampoo" },
            { product_id: "prod_3", name: "Third Shampoo" },
          ],
        },
      ],
    },
  )

  assert.equal(result.ok, false)
  assert.ok(result.errors.some((error) => error.validator_id === "product_answer_shape"))
})

test("validator requires semantic select_products tool arguments for concrete product interpretations", () => {
  const result = validateAgentV2FinalAnswer(baseAnswer, {
    ...baseValidationContext,
    toolCallHistory: [
      { name: "select_products", call_id: "call_1", arguments: { category: "shampoo" } },
    ],
  })

  assert.equal(result.ok, false)
  assert.ok(
    result.errors.some((error) => error.validator_id === "request_interpretation_tool_args_match"),
  )
})

test("validator blocks non-diagnostic request interpretation evidence quotes", () => {
  const result = validateAgentV2FinalAnswer(
    {
      ...baseAnswer,
      request_interpretation: requestInterpretation({
        evidence_quote: "e",
      }),
    },
    baseValidationContext,
  )

  assert.equal(result.ok, false)
  assert.ok(result.errors.some((error) => error.validator_id === "request_interpretation_evidence"))
})

test("validator allows full short user messages as evidence quotes", () => {
  const result = validateAgentV2FinalAnswer(
    {
      ...baseAnswer,
      request_interpretation: requestInterpretation({
        evidence_quote: "Öl?",
      }),
    },
    {
      ...baseValidationContext,
      latestUserMessage: "Öl?",
      recentEvidenceText: "Öl?",
      toolCallHistory: [
        selectProductsToolCall({
          user_request: "Öl?",
          evidence_quote: "Öl?",
        }),
      ],
    },
  )

  assert.equal(result.ok, true)
})

test("validator allows decorative quote marks and punctuation differences in evidence quotes", () => {
  for (const evidence_quote of [
    "Meine Kopfhaut juckt und ist gerötet",
    "„Meine Kopfhaut juckt und ist gerötet“",
    "juckt und ist gerötet",
  ]) {
    const result = validateAgentV2FinalAnswer(
      {
        ...baseAnswer,
        answer_mode: "safety_boundary",
        request_interpretation: requestInterpretation({
          primary_intent: "safety_boundary",
          product_request_kind: "none",
          routine_intent: "none",
          category: "none",
          requested_product_count: null,
          count_policy: "none",
          evidence_quote,
        }),
        tool_grounding: {
          ...baseAnswer.tool_grounding,
          used_product_tool: false,
          product_ids: [],
        },
        payload: {
          user_facing_answer_de: "Bei juckender und geroeteter Kopfhaut wuerde ich mild bleiben.",
          boundary_reason_de: "Moeglich medizinischer Kopfhautkontext.",
          next_step_de: null,
        },
      },
      {
        ...baseValidationContext,
        latestUserMessage: "Meine Kopfhaut juckt und ist gerötet, welches Shampoo soll ich nehmen?",
        recentEvidenceText:
          "Meine Kopfhaut juckt und ist gerötet, welches Shampoo soll ich nehmen?",
        toolCallHistory: [],
      },
    )

    assert.equal(result.ok, true, evidence_quote)
  }
})

test("validator allows evidence quotes from active routine visible step labels", () => {
  const result = validateAgentV2FinalAnswer(
    {
      ...baseAnswer,
      answer_mode: "routine_product_deep_dive",
      interpreted_intent: "User wants a product for a visible routine step.",
      request_interpretation: requestInterpretation({
        primary_intent: "product_recommendation",
        product_request_kind: "routine_product_deep_dive",
        category: "leave_in",
        evidence_quote: "Erster Zusatz",
      }),
      tool_grounding: {
        ...baseAnswer.tool_grounding,
        used_guidance_package_ids: ["base.product_recommendation.v1"],
        product_ids: ["prod_1"],
        routine_step_ids: ["goal-leave-in"],
      },
      routine_context: {
        active: true,
        routine_layer: "deep_dive",
        step_id: "goal-leave-in",
        category: "leave_in",
        return_path: ["routine"],
      },
      payload: {
        user_facing_answer_de:
          "**Test Shampoo** passt als leichter erster Zusatz in deine Routine.",
        step_id: "goal-leave-in",
        category: "leave_in",
        recommendations: [
          {
            product_id: "prod_1",
            reason_de: "Passt als leichter Zusatz.",
            usage_de: null,
            caveat_de: null,
          },
        ],
        return_to_routine_offer_de: "Danach kannst du zur Routine zurueckgehen.",
      },
    },
    {
      ...baseValidationContext,
      latestUserMessage: "Welches Produkt passt dafuer?",
      recentEvidenceText: "",
      toolCallHistory: [
        selectProductsToolCall({
          category: "leave_in",
          product_request_kind: "routine_product_deep_dive",
          user_request: "Welches Produkt passt dafuer?",
          evidence_quote: "Erster Zusatz",
        }),
      ],
      currentRoutineLayer: "basics",
      routineThreadContext: {
        active: true,
        current_layer: "basics",
        last_answer_mode: "routine",
        last_routine_categories: ["leave_in"],
        last_user_goal: "Routine vereinfachen",
        summary_de: "Die Basis steht.",
        visible_steps: [
          {
            step_id: "goal-leave-in",
            label_de: "Erster Zusatz",
            category: "leave_in",
            order: 1,
            routine_layer: "goals",
          },
        ],
      },
    },
  )

  assert.equal(result.ok, true, JSON.stringify(result.errors, null, 2))
})

test("validator rejects vague or invented evidence quotes", () => {
  for (const evidence_quote of ["User wants medical treatment", "shampoo", "Routine"]) {
    const result = validateAgentV2FinalAnswer(
      {
        ...baseAnswer,
        request_interpretation: requestInterpretation({
          evidence_quote,
        }),
      },
      {
        ...baseValidationContext,
        latestUserMessage: "Meine Kopfhaut juckt und ist gerötet, welches Shampoo soll ich nehmen?",
        recentEvidenceText:
          "Meine Kopfhaut juckt und ist gerötet, welches Shampoo soll ich nehmen?",
        toolCallHistory: [
          selectProductsToolCall({
            user_request: "Meine Kopfhaut juckt und ist gerötet, welches Shampoo soll ich nehmen?",
            evidence_quote,
          }),
        ],
      },
    )

    assert.equal(result.ok, false, evidence_quote)
    assert.ok(
      result.errors.some(
        (error) =>
          error.validator_id === "request_interpretation_evidence" ||
          error.validator_id === "request_interpretation_tool_args_match",
      ),
      evidence_quote,
    )
  }
})

test("validator requires user-facing prose to mention each recommended product", () => {
  const result = validateAgentV2FinalAnswer(
    {
      ...baseAnswer,
      tool_grounding: {
        ...baseAnswer.tool_grounding,
        product_ids: ["prod_1", "prod_2", "prod_3"],
      },
      payload: {
        ...baseAnswer.payload,
        user_facing_answer_de: "**Test Shampoo** passt gut zu deinem Profil.",
        recommendations: [
          {
            product_id: "prod_1",
            reason_de: "Passt als leichte Option.",
            usage_de: null,
            caveat_de: null,
          },
          {
            product_id: "prod_2",
            reason_de: "Passt als Alternative.",
            usage_de: null,
            caveat_de: null,
          },
          {
            product_id: "prod_3",
            reason_de: "Passt als dritte Option.",
            usage_de: null,
            caveat_de: null,
          },
        ],
      },
    },
    {
      ...baseValidationContext,
      toolCallHistory: [
        selectProductsToolCall({
          requested_product_count: 2,
          count_policy: "exact",
        }),
      ],
      selectedProductProjections: [
        {
          valid_product_ids: ["prod_1", "prod_2", "prod_3"],
          products: [
            { product_id: "prod_1", name: "Test Shampoo" },
            { product_id: "prod_2", name: "Second Shampoo" },
            { product_id: "prod_3", name: "Third Shampoo" },
          ],
        },
      ],
    },
  )

  assert.equal(result.ok, false)
  assert.ok(result.errors.some((error) => error.validator_id === "visible_payload_not_rendered"))
})

test("validator blocks incomplete routine prose that omits visible steps", () => {
  const result = validateAgentV2FinalAnswer(
    {
      ...baseAnswer,
      answer_mode: "routine",
      request_interpretation: requestInterpretation({
        primary_intent: "routine_build",
        product_request_kind: "none",
        routine_intent: "create",
        category: "none",
        requested_product_count: null,
        count_policy: "none",
        evidence_quote: "Routine bitte",
      }),
      tool_grounding: {
        ...baseAnswer.tool_grounding,
        used_product_tool: false,
        used_routine_tool: true,
        product_ids: [],
        routine_step_ids: ["step_shampoo", "step_conditioner"],
      },
      routine_context: {
        active: true,
        routine_layer: "basics",
        step_id: null,
        category: null,
        return_path: [],
      },
      payload: {
        user_facing_answer_de: "Klar — ich würde die Routine auf das Minimum reduzieren:",
        routine_layer: "basics",
        visible_steps: [
          {
            step_id: "step_shampoo",
            label_de: "Shampoo",
            action_de: "Am Ansatz reinigen.",
            frequency_de: "Nach Bedarf",
            reason_de: "Basis der Routine.",
          },
          {
            step_id: "step_conditioner",
            label_de: "Conditioner",
            action_de: "In Laengen und Spitzen geben.",
            frequency_de: "Nach jeder Waesche",
            reason_de: "Basis der Pflege.",
          },
        ],
        next_layer_options: ["goals"],
        next_step_offer_de: null,
      },
    },
    {
      ...baseValidationContext,
      latestUserMessage: "Routine bitte auf Minimum reduzieren.",
      recentEvidenceText: "Routine bitte auf Minimum reduzieren.",
      toolCallHistory: [
        routineToolCall({
          evidence_quote: "Routine",
        }),
      ],
      routineProjections: [
        {
          routine_layer: "basics",
          visible_steps: [{ step_id: "step_shampoo" }, { step_id: "step_conditioner" }],
        },
      ],
    },
  )

  assert.equal(result.ok, false)
  assert.ok(result.errors.some((error) => error.validator_id === "visible_payload_not_rendered"))
})

test("validator blocks incomplete product prose that omits a final recommendation", () => {
  const result = validateAgentV2FinalAnswer(
    {
      ...baseAnswer,
      request_interpretation: requestInterpretation({
        requested_product_count: 2,
        count_policy: "exact",
      }),
      tool_grounding: {
        ...baseAnswer.tool_grounding,
        product_ids: ["prod_1", "prod_2"],
      },
      payload: {
        ...baseAnswer.payload,
        user_facing_answer_de: "**Test Shampoo** passt gut zu deinem Profil.",
        recommendations: [
          {
            product_id: "prod_1",
            reason_de: "Passt als leichte Option.",
            usage_de: null,
            caveat_de: null,
          },
          {
            product_id: "prod_2",
            reason_de: "Passt als zweite Option.",
            usage_de: null,
            caveat_de: null,
          },
        ],
      },
    },
    {
      ...baseValidationContext,
      toolCallHistory: [
        selectProductsToolCall({
          requested_product_count: 2,
          count_policy: "exact",
        }),
      ],
      selectedProductProjections: [
        {
          valid_product_ids: ["prod_1", "prod_2"],
          products: [
            { product_id: "prod_1", name: "Test Shampoo" },
            { product_id: "prod_2", name: "Second Shampoo" },
          ],
        },
      ],
    },
  )

  assert.equal(result.ok, false)
  assert.ok(result.errors.some((error) => error.validator_id === "visible_payload_not_rendered"))
})

test("validator blocks final product rendering when product names are unavailable", () => {
  const result = validateAgentV2FinalAnswer(
    {
      ...baseAnswer,
      request_interpretation: requestInterpretation({
        requested_product_count: 1,
        count_policy: "exact",
      }),
      tool_grounding: {
        ...baseAnswer.tool_grounding,
        product_ids: ["prod_without_name"],
      },
      payload: {
        ...baseAnswer.payload,
        user_facing_answer_de: "**Test Shampoo** passt gut zu deinem Profil.",
        recommendations: [
          {
            product_id: "prod_without_name",
            reason_de: "Passt als leichte Option.",
            usage_de: null,
            caveat_de: null,
          },
        ],
      },
    },
    {
      ...baseValidationContext,
      selectedProductProjections: [
        {
          valid_product_ids: ["prod_without_name"],
          products: [],
        },
      ],
    },
  )

  assert.equal(result.ok, false)
  assert.ok(result.errors.some((error) => error.validator_id === "visible_payload_not_rendered"))
})

test("validator blocks incomplete routine product deep dive prose that omits the product", () => {
  const result = validateAgentV2FinalAnswer(
    {
      ...baseAnswer,
      answer_mode: "routine_product_deep_dive",
      request_interpretation: requestInterpretation({
        product_request_kind: "routine_product_deep_dive",
        category: "leave_in",
        evidence_quote: "Produkt",
      }),
      tool_grounding: {
        ...baseAnswer.tool_grounding,
        product_ids: ["prod_1"],
        routine_step_ids: ["step_1"],
      },
      routine_context: {
        active: true,
        routine_layer: "deep_dive",
        step_id: "step_1",
        category: "leave_in",
        return_path: ["routine"],
      },
      payload: {
        user_facing_answer_de:
          "Für diesen Routine-Schritt würde ich eine leichte Leave-in-Pflege nehmen.",
        step_id: "step_1",
        category: "leave_in",
        recommendations: [
          {
            product_id: "prod_1",
            reason_de: "Passt als leichter erster Zusatzhebel.",
            usage_de: "Sparsam in Laengen und Spitzen.",
            caveat_de: null,
          },
        ],
        return_to_routine_offer_de: "Danach gehen wir zur Routine zurueck.",
      },
    },
    {
      ...baseValidationContext,
      latestUserMessage: "Welches Produkt fuer den ersten Zusatz?",
      recentEvidenceText: "Welches Produkt fuer den ersten Zusatz?",
      selectedProductProjections: [
        {
          valid_product_ids: ["prod_1"],
          products: [{ product_id: "prod_1", name: "Test Leave-in" }],
        },
      ],
      routineProjections: [{ routine_layer: "basics", visible_steps: [{ step_id: "step_1" }] }],
      toolCallHistory: [
        selectProductsToolCall({
          category: "leave_in",
          product_request_kind: "routine_product_deep_dive",
          evidence_quote: "Produkt",
        }),
      ],
      routineThreadContext: {
        active: true,
        current_layer: "basics",
        last_answer_mode: "routine",
        last_routine_categories: ["leave_in"],
        last_user_goal: "Routine verbessern",
        summary_de: "Leave-in ist der erste Zusatz.",
        visible_steps: [],
      },
      currentRoutineLayer: "basics",
    },
  )

  assert.equal(result.ok, false)
  assert.ok(result.errors.some((error) => error.validator_id === "visible_payload_not_rendered"))
})

test("validator requires blocked answers to render the actual blocker, not only a generic phrase", () => {
  const result = validateAgentV2FinalAnswer(
    {
      ...baseAnswer,
      answer_mode: "constraint_blocked",
      tool_grounding: {
        ...baseAnswer.tool_grounding,
        used_product_tool: false,
        product_ids: [],
      },
      payload: {
        user_facing_answer_de:
          "Mit dieser Einschraenkung kann ich kein konkretes Produkt empfehlen.",
        blocking_constraints: ["keine geeigneten Produkte wegen deiner Ausschluesse"],
        safe_alternative_de: null,
      },
    },
    baseValidationContext,
  )

  assert.equal(result.ok, false)
  assert.ok(result.errors.some((error) => error.validator_id === "visible_payload_not_rendered"))
})

test("validator rejects unasked product cards in general advice", () => {
  const result = validateAgentV2FinalAnswer(
    {
      ...baseAnswer,
      answer_mode: "general_advice",
      request_interpretation: requestInterpretation({
        primary_intent: "category_education",
        product_request_kind: "category_education",
        category: "mask",
        requested_product_count: null,
        count_policy: "none",
      }),
      tool_grounding: {
        ...baseAnswer.tool_grounding,
        used_product_tool: false,
        product_ids: ["prod_1"],
      },
      payload: {
        user_facing_answer_de: "Eine Maske ist optional.",
        category_or_topic: "mask",
        key_points_de: ["Eine Maske hilft bei zusaetzlichem Pflegebedarf."],
        next_step_offer_de: "Ich kann dir danach eine passende Maske empfehlen.",
      },
    },
    {
      ...baseValidationContext,
      toolCallHistory: [{ name: "load_advisor_guidance", call_id: "call_1" }],
    },
  )

  assert.equal(result.ok, false)
  assert.ok(
    result.errors.some((error) => error.validator_id === "category_advice_no_unasked_products"),
  )
})

test("validator rejects product recommendation mode when the user did not ask for products", () => {
  const result = validateAgentV2FinalAnswer(
    {
      ...baseAnswer,
      request_interpretation: requestInterpretation({
        primary_intent: "category_education",
        product_request_kind: "category_education",
        category: "conditioner",
        requested_product_count: null,
        count_policy: "none",
      }),
    },
    {
      ...baseValidationContext,
      latestUserMessage: "Brauche ich eher Maske oder Conditioner?",
    },
  )

  assert.equal(result.ok, false)
  assert.ok(
    result.errors.some((error) => error.validator_id === "category_advice_no_unasked_products"),
  )
})

test("validator requires selected products to be surfaced for concrete category-fit asks", () => {
  const result = validateAgentV2FinalAnswer(
    {
      ...baseAnswer,
      answer_mode: "general_advice",
      request_interpretation: requestInterpretation({
        primary_intent: "product_recommendation",
        product_request_kind: "specific_products",
        category: "conditioner",
        requested_product_count: null,
        count_policy: "default",
        evidence_quote: "Welche Spülung passt",
      }),
      tool_grounding: {
        ...baseAnswer.tool_grounding,
        used_product_tool: true,
        product_ids: [],
      },
      payload: {
        user_facing_answer_de: "Eine feuchtigkeitsspendende Spuelung passt hier am besten.",
        category_or_topic: "conditioner",
        key_points_de: ["Achte auf Feuchtigkeit und mittlere Pflegeintensitaet."],
        next_step_offer_de: null,
      },
    },
    {
      ...baseValidationContext,
      latestUserMessage: "Welche Spülung passt zu coloriertem, strapaziertem Haar?",
      toolCallHistory: [{ name: "select_products", call_id: "call_1" }],
      selectedProductProjections: [
        {
          valid_product_ids: ["prod_1", "prod_2", "prod_3"],
          products: [
            { product_id: "prod_1", name: "Test Conditioner" },
            { product_id: "prod_2", name: "Second Conditioner" },
            { product_id: "prod_3", name: "Third Conditioner" },
          ],
        },
      ],
    },
  )

  assert.equal(result.ok, false)
  assert.ok(
    result.errors.some((error) => error.validator_id === "request_interpretation_answer_mode"),
  )
})

test("validator allows general category comparison without product fulfillment", () => {
  const result = validateAgentV2FinalAnswer(
    {
      ...baseAnswer,
      answer_mode: "general_advice",
      request_interpretation: requestInterpretation({
        primary_intent: "category_education",
        product_request_kind: "category_education",
        category: "conditioner",
        requested_product_count: null,
        count_policy: "none",
      }),
      tool_grounding: {
        ...baseAnswer.tool_grounding,
        used_product_tool: false,
        product_ids: [],
      },
      payload: {
        user_facing_answer_de: "Conditioner ist die Basis, eine Maske ist eher Zusatzpflege.",
        category_or_topic: "conditioner_vs_mask",
        key_points_de: ["Conditioner regelmaessig, Maske nur bei Extra-Bedarf."],
        next_step_offer_de: null,
      },
    },
    {
      ...baseValidationContext,
      latestUserMessage: "Brauche ich eher Maske oder Conditioner?",
      toolCallHistory: [],
    },
  )

  assert.equal(result.ok, true)
})

test("validator respects an explicit request for two product recommendations", () => {
  const result = validateAgentV2FinalAnswer(
    {
      ...baseAnswer,
      request_interpretation: requestInterpretation({
        product_request_kind: "compare_products",
        category: "conditioner",
        requested_product_count: 2,
        count_policy: "exact",
        evidence_quote: "zwei passende Conditioner",
      }),
      tool_grounding: {
        ...baseAnswer.tool_grounding,
        product_ids: ["prod_1", "prod_2", "prod_3"],
      },
      payload: {
        ...baseAnswer.payload,
        user_facing_answer_de:
          "**Test Shampoo**, **Second Shampoo** und **Third Shampoo** passen unterschiedlich gut.",
        recommendations: [
          {
            product_id: "prod_1",
            reason_de: "Passt als erste Option.",
            usage_de: null,
            caveat_de: null,
          },
          {
            product_id: "prod_2",
            reason_de: "Passt als zweite Option.",
            usage_de: null,
            caveat_de: null,
          },
          {
            product_id: "prod_3",
            reason_de: "Passt als dritte Option.",
            usage_de: null,
            caveat_de: null,
          },
        ],
      },
    },
    {
      ...baseValidationContext,
      latestUserMessage: "Vergleich mir bitte zwei passende Conditioner fuer feines Haar.",
      selectedProductProjections: [
        {
          valid_product_ids: ["prod_1", "prod_2", "prod_3"],
          products: [
            { product_id: "prod_1", name: "Test Shampoo" },
            { product_id: "prod_2", name: "Second Shampoo" },
            { product_id: "prod_3", name: "Third Shampoo" },
          ],
        },
      ],
    },
  )

  assert.equal(result.ok, false)
  assert.ok(result.errors.some((error) => error.validator_id === "requested_product_count"))
})

test("validator accepts explicit one and two product recommendation counts", () => {
  const one = validateAgentV2FinalAnswer(baseAnswer, {
    ...baseValidationContext,
  })

  assert.equal(one.ok, true)

  const two = validateAgentV2FinalAnswer(
    {
      ...baseAnswer,
      request_interpretation: requestInterpretation({
        category: "shampoo",
        requested_product_count: 2,
        count_policy: "exact",
      }),
      tool_grounding: {
        ...baseAnswer.tool_grounding,
        product_ids: ["prod_1", "prod_2"],
      },
      payload: {
        ...baseAnswer.payload,
        user_facing_answer_de: "**Test Shampoo** und **Second Shampoo** passen gut.",
        recommendations: [
          {
            product_id: "prod_1",
            reason_de: "Passt als erste Option.",
            usage_de: null,
            caveat_de: null,
          },
          {
            product_id: "prod_2",
            reason_de: "Passt als zweite Option.",
            usage_de: null,
            caveat_de: null,
          },
        ],
      },
    },
    {
      ...baseValidationContext,
      toolCallHistory: [
        selectProductsToolCall({
          requested_product_count: 2,
          count_policy: "exact",
        }),
      ],
      selectedProductProjections: [
        {
          valid_product_ids: ["prod_1", "prod_2", "prod_3"],
          products: [
            { product_id: "prod_1", name: "Test Shampoo" },
            { product_id: "prod_2", name: "Second Shampoo" },
            { product_id: "prod_3", name: "Third Shampoo" },
          ],
        },
      ],
    },
  )

  assert.equal(two.ok, true)
})

test("validator requires routine product deep dive mode for product asks inside routine threads", () => {
  const result = validateAgentV2FinalAnswer(
    {
      ...baseAnswer,
      request_interpretation: requestInterpretation({
        product_request_kind: "routine_product_deep_dive",
        category: "leave_in",
        requested_product_count: null,
        count_policy: "default",
        evidence_quote: "Produkt",
      }),
      routine_context: {
        active: true,
        routine_layer: "deep_dive",
        step_id: null,
        category: "leave_in",
        return_path: ["routine"],
      },
    },
    {
      ...baseValidationContext,
      latestUserMessage: "Welches Produkt genau?",
      routineThreadContext: {
        active: true,
        current_layer: "basics",
        last_answer_mode: "routine",
        last_routine_categories: ["leave_in"],
        last_user_goal: "Routine verbessern",
        summary_de: "Leave-in ist der erste Zusatz.",
        visible_steps: [],
      },
      currentRoutineLayer: "basics",
    },
  )

  assert.equal(result.ok, false)
  assert.ok(
    result.errors.some((error) => error.validator_id === "routine_product_deep_dive_required"),
  )
})

test("validator bases option count on projections relevant to the recommended products", () => {
  const result = validateAgentV2FinalAnswer(
    {
      ...baseAnswer,
      tool_grounding: {
        ...baseAnswer.tool_grounding,
        product_ids: ["prod_current"],
      },
      payload: {
        ...baseAnswer.payload,
        user_facing_answer_de:
          "**Current Leave-In** passt als gezielte Anwendung zu diesem Schritt.",
        recommendations: [
          {
            product_id: "prod_current",
            reason_de: "Passt fuer die aktuelle Anwendung.",
            usage_de: null,
            caveat_de: null,
          },
        ],
      },
    },
    {
      ...baseValidationContext,
      selectedProductProjections: [
        {
          valid_product_ids: ["prod_prior_1", "prod_prior_2", "prod_prior_3"],
          products: [
            { product_id: "prod_prior_1", name: "Prior One" },
            { product_id: "prod_prior_2", name: "Prior Two" },
            { product_id: "prod_prior_3", name: "Prior Three" },
          ],
        },
        {
          valid_product_ids: ["prod_current"],
          products: [{ product_id: "prod_current", name: "Current Leave-In" }],
        },
      ],
    },
  )

  assert.equal(result.ok, true)
})

test("validator validates every answer mode payload", () => {
  const validByMode = {
    product_recommendation: {
      ...baseAnswer,
    },
    routine: {
      ...baseAnswer,
      answer_mode: "routine",
      request_interpretation: requestInterpretation({
        primary_intent: "routine_build",
        product_request_kind: "none",
        routine_intent: "create",
        category: "none",
        requested_product_count: null,
        count_policy: "none",
        evidence_quote: "Routine bitte",
      }),
      tool_grounding: {
        ...baseAnswer.tool_grounding,
        used_product_tool: false,
        used_routine_tool: true,
        product_ids: [],
        routine_step_ids: ["step_1"],
      },
      routine_context: {
        active: true,
        routine_layer: "basics",
        step_id: null,
        category: null,
        return_path: [],
      },
      payload: {
        user_facing_answer_de: "Starte mit Shampoo, Conditioner und einem wichtigsten Zusatzhebel.",
        routine_layer: "basics",
        visible_steps: [
          {
            step_id: "step_1",
            label_de: "Shampoo",
            action_de: "Am Ansatz reinigen.",
            frequency_de: "Nach Bedarf",
            reason_de: "Basis der Routine.",
          },
        ],
        next_layer_options: ["goals", "problems"],
        next_step_offer_de: null,
      },
    },
    routine_product_deep_dive: {
      ...baseAnswer,
      answer_mode: "routine_product_deep_dive",
      tool_grounding: {
        ...baseAnswer.tool_grounding,
        routine_step_ids: ["step_1"],
      },
      routine_context: {
        active: true,
        routine_layer: "deep_dive",
        step_id: "step_1",
        category: "shampoo",
        return_path: ["goals"],
      },
      payload: {
        user_facing_answer_de: "Fuer diesen Schritt passt **Test Shampoo**.",
        step_id: "step_1",
        category: "shampoo",
        recommendations: [
          { product_id: "prod_1", reason_de: "Passt.", usage_de: null, caveat_de: null },
        ],
        return_to_routine_offer_de: "Danach koennen wir zur Routine zurueckgehen.",
      },
    },
    general_advice: {
      ...baseAnswer,
      answer_mode: "general_advice",
      request_interpretation: requestInterpretation({
        primary_intent: "category_education",
        product_request_kind: "category_education",
        routine_intent: "explain",
        category: "conditioner",
        requested_product_count: null,
        count_policy: "none",
        evidence_quote: "Maske oder Conditioner",
      }),
      tool_grounding: {
        ...baseAnswer.tool_grounding,
        used_product_tool: false,
        product_ids: [],
      },
      payload: {
        user_facing_answer_de: "Eine Maske ist optional.",
        category_or_topic: "mask",
        key_points_de: ["Conditioner reicht oft aus."],
        next_step_offer_de: null,
      },
    },
    clarification: {
      ...baseAnswer,
      answer_mode: "clarification",
      tool_grounding: {
        ...baseAnswer.tool_grounding,
        used_product_tool: false,
        product_ids: [],
      },
      payload: {
        user_facing_answer_de: "Welche Produktkategorie meinst du?",
        question_de: "Welche Produktkategorie meinst du?",
        missing_keys: ["category"],
      },
    },
    constraint_blocked: {
      ...baseAnswer,
      answer_mode: "constraint_blocked",
      tool_grounding: {
        ...baseAnswer.tool_grounding,
        used_product_tool: false,
        product_ids: [],
      },
      payload: {
        user_facing_answer_de:
          "Mit deiner Einschraenkung gibt es aktuell keine geeigneten Produkte wegen deiner Ausschluesse.",
        blocking_constraints: ["keine geeigneten Produkte wegen deiner Ausschluesse"],
        safe_alternative_de: null,
      },
    },
    safety_boundary: {
      ...baseAnswer,
      answer_mode: "safety_boundary",
      request_interpretation: requestInterpretation({
        primary_intent: "safety_boundary",
        product_request_kind: "none",
        routine_intent: "none",
        category: "none",
        requested_product_count: null,
        count_policy: "none",
        evidence_quote: "Welches Shampoo passt zu mir?",
      }),
      tool_grounding: {
        ...baseAnswer.tool_grounding,
        used_product_tool: false,
        product_ids: [],
      },
      payload: {
        user_facing_answer_de: "Das sollte aerztlich abgeklart werden.",
        boundary_reason_de: "Moeglich medizinischer Kontext.",
        next_step_de: "Bitte aerztlich abklaeren lassen.",
      },
    },
  } as const

  for (const [answer_mode, answer] of Object.entries(validByMode)) {
    const result = validateAgentV2FinalAnswer(answer, {
      ...baseValidationContext,
      routineProjections:
        answer_mode === "routine" || answer_mode === "routine_product_deep_dive"
          ? [{ routine_layer: "basics", visible_steps: [{ step_id: "step_1" }] }]
          : [],
      latestUserMessage:
        answer_mode === "routine" ? "Routine bitte." : baseValidationContext.latestUserMessage,
      recentEvidenceText:
        answer_mode === "routine"
          ? "Routine bitte."
          : answer_mode === "general_advice"
            ? "Maske oder Conditioner"
            : baseValidationContext.recentEvidenceText,
      toolCallHistory:
        answer_mode === "routine"
          ? [routineToolCall({ evidence_quote: "Routine bitte" })]
          : answer_mode === "general_advice"
            ? []
            : answer_mode === "safety_boundary"
              ? []
              : baseValidationContext.toolCallHistory,
      currentRoutineLayer: null,
    })

    assert.equal(result.checked_payload_mode, answer_mode)
    assert.equal(result.ok, true, `${answer_mode}: ${JSON.stringify(result.errors)}`)
  }
})

test("validator rejects malformed mode payloads", () => {
  const result = validateAgentV2FinalAnswer(
    {
      ...baseAnswer,
      payload: { user_facing_answer_de: "Ich wuerde dir dieses Produkt empfehlen." },
    },
    baseValidationContext,
  )

  assert.equal(result.ok, false)
  assert.ok(result.errors.some((error) => error.validator_id === "terminal_schema"))
})

test("validator explains mismatched payload fields for repair", () => {
  const result = validateAgentV2FinalAnswer(
    {
      ...baseAnswer,
      answer_mode: "general_advice",
      request_interpretation: requestInterpretation({
        primary_intent: "category_education",
        product_request_kind: "category_education",
        routine_intent: "explain",
        category: "conditioner",
        requested_product_count: null,
        count_policy: "none",
        evidence_quote: "Maske oder Conditioner",
      }),
      tool_grounding: {
        ...baseAnswer.tool_grounding,
        used_product_tool: false,
        product_ids: [],
      },
      payload: {
        user_facing_answer_de: "Eher Conditioner.",
        recommendations: [],
        comparison_notes_de: ["Conditioner ist die Basis."],
        usage_notes_de: ["Maske nur optional."],
        next_step_offer_de: "Ich kann dir das einordnen.",
      },
    },
    {
      ...baseValidationContext,
      toolCallHistory: [{ name: "load_advisor_guidance", call_id: "call_1" }],
    },
  )

  assert.equal(result.ok, false)
  const schemaError = result.errors.find((error) => error.validator_id === "terminal_schema")
  assert.ok(schemaError)
  assert.match(schemaError.message, /answer_mode "general_advice"/)
  assert.match(schemaError.message, /category_or_topic/)
  assert.match(schemaError.message, /key_points_de/)
  assert.match(schemaError.message, /remove fields from another answer mode/)
  assert.match(schemaError.message, /recommendations/)
})

test("validator blocks hallucinated routine step ids", () => {
  const result = validateAgentV2FinalAnswer(
    {
      ...baseAnswer,
      answer_mode: "routine",
      request_interpretation: requestInterpretation({
        primary_intent: "routine_mutation",
        product_request_kind: "none",
        routine_intent: "replace_product",
        category: "mask",
        requested_product_count: null,
        count_policy: "none",
        evidence_quote: "Maske statt Conditioner",
      }),
      tool_grounding: {
        ...baseAnswer.tool_grounding,
        used_product_tool: false,
        used_routine_tool: true,
        product_ids: [],
        routine_step_ids: ["missing_step"],
      },
      routine_context: {
        active: true,
        routine_layer: "basics",
        step_id: null,
        category: null,
        return_path: [],
      },
      payload: {
        user_facing_answer_de: "Starte mit den Basics.",
        routine_layer: "basics",
        visible_steps: [
          {
            step_id: "missing_step",
            label_de: "Shampoo",
            action_de: "Am Ansatz reinigen.",
            frequency_de: null,
            reason_de: "Basis.",
          },
        ],
        next_layer_options: ["goals"],
        next_step_offer_de: null,
      },
    },
    {
      ...baseValidationContext,
      routineProjections: [{ routine_layer: "basics", visible_steps: [{ step_id: "step_1" }] }],
      toolCallHistory: [{ name: "build_or_fix_routine", call_id: "call_routine" }],
    },
  )

  assert.equal(result.ok, false)
  assert.ok(result.errors.some((error) => error.validator_id === "known_routine_step_ids"))
})

test("validator blocks payload routine step ids that bypass tool grounding", () => {
  const result = validateAgentV2FinalAnswer(
    {
      ...baseAnswer,
      answer_mode: "routine",
      tool_grounding: {
        ...baseAnswer.tool_grounding,
        used_product_tool: false,
        used_routine_tool: true,
        product_ids: [],
        routine_step_ids: [],
      },
      routine_context: {
        active: true,
        routine_layer: "basics",
        step_id: null,
        category: null,
        return_path: [],
      },
      payload: {
        user_facing_answer_de: "Starte mit den Basics.",
        routine_layer: "basics",
        visible_steps: [
          {
            step_id: "made_up_step",
            label_de: "Shampoo",
            action_de: "Am Ansatz reinigen.",
            frequency_de: null,
            reason_de: "Basis.",
          },
        ],
        next_layer_options: ["goals"],
        next_step_offer_de: null,
      },
    },
    {
      ...baseValidationContext,
      routineProjections: [{ routine_layer: "basics", visible_steps: [{ step_id: "step_1" }] }],
      toolCallHistory: [{ name: "build_or_fix_routine", call_id: "call_routine" }],
    },
  )

  assert.equal(result.ok, false)
  assert.ok(result.errors.some((error) => error.validator_id === "known_routine_step_ids"))
})

test("validator blocks routine payload layer that disagrees with routine context", () => {
  const result = validateAgentV2FinalAnswer(
    {
      ...baseAnswer,
      answer_mode: "routine",
      request_interpretation: requestInterpretation({
        primary_intent: "routine_build",
        product_request_kind: "none",
        routine_intent: "create",
        category: "none",
        requested_product_count: null,
        count_policy: "none",
        evidence_quote: "Routine aufbauen",
      }),
      tool_grounding: {
        ...baseAnswer.tool_grounding,
        used_product_tool: false,
        used_routine_tool: true,
        product_ids: [],
        routine_step_ids: ["step_1"],
      },
      routine_context: {
        active: true,
        routine_layer: "basics",
        step_id: null,
        category: null,
        return_path: [],
      },
      payload: {
        user_facing_answer_de: "Starte mit Shampoo als Basic.",
        routine_layer: "deep_dive",
        visible_steps: [
          {
            step_id: "step_1",
            label_de: "Shampoo",
            action_de: "Am Ansatz reinigen.",
            frequency_de: null,
            reason_de: "Basis.",
          },
        ],
        next_layer_options: ["goals"],
        next_step_offer_de: null,
      },
    },
    {
      ...baseValidationContext,
      latestUserMessage: "Routine aufbauen",
      recentEvidenceText: "Routine aufbauen",
      toolCallHistory: [routineToolCall()],
      routineProjections: [{ routine_layer: "basics", visible_steps: [{ step_id: "step_1" }] }],
    },
  )

  assert.equal(result.ok, false)
  assert.ok(result.errors.some((error) => error.validator_id === "routine_metadata_consistency"))
})

test("validator requires routine tool call even when routine projections are present", () => {
  const result = validateAgentV2FinalAnswer(
    {
      ...baseAnswer,
      answer_mode: "routine",
      tool_grounding: {
        ...baseAnswer.tool_grounding,
        used_product_tool: false,
        used_routine_tool: true,
        product_ids: [],
        routine_step_ids: ["step_1"],
      },
      routine_context: {
        active: true,
        routine_layer: "basics",
        step_id: null,
        category: null,
        return_path: [],
      },
      payload: {
        user_facing_answer_de: "Starte mit den Basics.",
        routine_layer: "basics",
        visible_steps: [
          {
            step_id: "step_1",
            label_de: "Shampoo",
            action_de: "Am Ansatz reinigen.",
            frequency_de: null,
            reason_de: "Basis.",
          },
        ],
        next_layer_options: ["goals"],
        next_step_offer_de: null,
      },
    },
    {
      ...baseValidationContext,
      routineProjections: [{ routine_layer: "basics", visible_steps: [{ step_id: "step_1" }] }],
      toolCallHistory: [{ name: "load_advisor_guidance", call_id: "call_guidance" }],
    },
  )

  assert.equal(result.ok, false)
  assert.ok(result.errors.some((error) => error.validator_id === "routine_tool_required"))
})

test("validator allows guidance-only general advice inside active routine thread", () => {
  const result = validateAgentV2FinalAnswer(
    {
      ...baseAnswer,
      answer_mode: "general_advice",
      request_interpretation: requestInterpretation({
        primary_intent: "category_education",
        product_request_kind: "category_education",
        routine_intent: "explain",
        category: "conditioner",
        requested_product_count: null,
        count_policy: "none",
        evidence_quote: "Maske oder Conditioner",
      }),
      tool_grounding: {
        ...baseAnswer.tool_grounding,
        used_product_tool: false,
        product_ids: [],
        hard_rule_ids: [],
      },
      routine_context: {
        active: true,
        routine_layer: "basics",
        step_id: null,
        category: "conditioner",
        return_path: ["routine"],
      },
      payload: {
        user_facing_answer_de:
          "In deiner vereinfachten Routine waere Conditioner der Basis-Schritt; eine Maske ist eher optional.",
        category_or_topic: "conditioner_vs_mask",
        key_points_de: [
          "Conditioner ist der regelmaessige Pflegeabschluss.",
          "Maske ist ein Zusatz.",
        ],
        next_step_offer_de: "Wenn du magst, passe ich danach die Routine an.",
      },
    },
    {
      ...baseValidationContext,
      selectedProductProjections: [],
      latestUserMessage: "Brauche ich dann eher Maske oder Conditioner?",
      toolCallHistory: [{ name: "load_advisor_guidance", call_id: "call_guidance" }],
      routineThreadContext: {
        active: true,
        current_layer: "basics",
        last_answer_mode: "routine",
        last_routine_categories: ["shampoo", "conditioner"],
        last_user_goal: "Routine vereinfachen",
        summary_de: "Vereinfachte Basisroutine mit Shampoo und Conditioner.",
        visible_steps: [],
      },
      currentRoutineLayer: "basics",
      requiredGuidancePackageIds: [],
      knownHardRuleIds: [],
    },
  )

  assert.equal(result.ok, true)
})

test("validator keeps routine context active for routine follow-up questions", () => {
  const result = validateAgentV2FinalAnswer(
    {
      ...baseAnswer,
      answer_mode: "general_advice",
      request_interpretation: requestInterpretation({
        primary_intent: "category_education",
        product_request_kind: "category_education",
        routine_intent: "explain",
        category: "conditioner",
        requested_product_count: null,
        count_policy: "none",
        evidence_quote: "Maske oder Conditioner",
      }),
      tool_grounding: {
        ...baseAnswer.tool_grounding,
        used_product_tool: false,
        product_ids: [],
        hard_rule_ids: [],
      },
      routine_context: {
        active: false,
        routine_layer: null,
        step_id: null,
        category: null,
        return_path: [],
      },
      payload: {
        user_facing_answer_de: "Conditioner reicht meistens.",
        category_or_topic: "conditioner_vs_mask",
        key_points_de: ["Conditioner ist Basis."],
        next_step_offer_de: null,
      },
    },
    {
      ...baseValidationContext,
      selectedProductProjections: [],
      latestUserMessage: "Brauche ich dann eher Maske oder Conditioner?",
      toolCallHistory: [{ name: "load_advisor_guidance", call_id: "call_guidance" }],
      routineThreadContext: {
        active: true,
        current_layer: "basics",
        last_answer_mode: "routine",
        last_routine_categories: ["shampoo", "conditioner"],
        last_user_goal: "Routine vereinfachen",
        summary_de: "Vereinfachte Basisroutine mit Shampoo und Conditioner.",
        visible_steps: [],
      },
      currentRoutineLayer: "basics",
      requiredGuidancePackageIds: [],
      knownHardRuleIds: [],
    },
  )

  assert.equal(result.ok, false)
  assert.ok(result.errors.some((error) => error.validator_id === "routine_context_continuity"))
})

test("validator requires routine tool for routine mutation inside active thread", () => {
  const result = validateAgentV2FinalAnswer(
    {
      ...baseAnswer,
      answer_mode: "routine",
      request_interpretation: requestInterpretation({
        primary_intent: "routine_mutation",
        product_request_kind: "none",
        routine_intent: "replace_product",
        category: "mask",
        requested_product_count: null,
        count_policy: "none",
        evidence_quote: "Maske statt Conditioner",
      }),
      tool_grounding: {
        ...baseAnswer.tool_grounding,
        used_product_tool: false,
        used_routine_tool: false,
        product_ids: [],
        routine_step_ids: [],
        hard_rule_ids: [],
      },
      routine_context: {
        active: true,
        routine_layer: "basics",
        step_id: null,
        category: "mask",
        return_path: ["routine"],
      },
      payload: {
        user_facing_answer_de: "Ich ersetze den Conditioner durch eine Maske.",
        routine_layer: "basics",
        visible_steps: [],
        next_layer_options: ["goals"],
        next_step_offer_de: null,
      },
    },
    {
      ...baseValidationContext,
      selectedProductProjections: [],
      latestUserMessage: "Mach die Routine mit Maske statt Conditioner.",
      toolCallHistory: [{ name: "load_advisor_guidance", call_id: "call_guidance" }],
      routineThreadContext: {
        active: true,
        current_layer: "basics",
        last_answer_mode: "routine",
        last_routine_categories: ["shampoo", "conditioner"],
        last_user_goal: "Routine vereinfachen",
        summary_de: "Vereinfachte Basisroutine mit Shampoo und Conditioner.",
        visible_steps: [],
      },
      currentRoutineLayer: "basics",
      requiredGuidancePackageIds: [],
      knownHardRuleIds: [],
    },
  )

  assert.equal(result.ok, false)
  assert.ok(result.errors.some((error) => error.validator_id === "routine_tool_required"))
})

test("validator blocks routine mutation intent even when mislabeled as general advice", () => {
  const result = validateAgentV2FinalAnswer(
    {
      ...baseAnswer,
      answer_mode: "general_advice",
      request_interpretation: requestInterpretation({
        primary_intent: "routine_mutation",
        product_request_kind: "none",
        routine_intent: "replace_product",
        category: "mask",
        requested_product_count: null,
        count_policy: "none",
        evidence_quote: "Maske statt Conditioner",
      }),
      tool_grounding: {
        ...baseAnswer.tool_grounding,
        used_product_tool: false,
        used_routine_tool: false,
        product_ids: [],
        routine_step_ids: [],
        hard_rule_ids: [],
      },
      routine_context: {
        active: true,
        routine_layer: "basics",
        step_id: null,
        category: "mask",
        return_path: ["routine"],
      },
      payload: {
        user_facing_answer_de: "Dann nehmen wir statt Conditioner eine Maske in deiner Routine.",
        category_or_topic: "routine_change",
        key_points_de: ["Maske ersetzt Conditioner in der Routine."],
        next_step_offer_de: null,
      },
    },
    {
      ...baseValidationContext,
      selectedProductProjections: [],
      latestUserMessage: "Mach die Routine mit Maske statt Conditioner",
      toolCallHistory: [{ name: "load_advisor_guidance", call_id: "call_guidance" }],
      routineThreadContext: {
        active: true,
        current_layer: "basics",
        last_answer_mode: "routine",
        last_routine_categories: ["shampoo", "conditioner"],
        last_user_goal: "Routine vereinfachen",
        summary_de: "Vereinfachte Basisroutine mit Shampoo und Conditioner.",
        visible_steps: [],
      },
      currentRoutineLayer: "basics",
      requiredGuidancePackageIds: [],
      knownHardRuleIds: [],
    },
  )

  assert.equal(result.ok, false)
  assert.ok(result.errors.some((error) => error.validator_id === "routine_tool_required"))
})

test("validator blocks pronoun-based routine mutation intent in active routine thread", () => {
  const result = validateAgentV2FinalAnswer(
    {
      ...baseAnswer,
      answer_mode: "general_advice",
      request_interpretation: requestInterpretation({
        primary_intent: "routine_mutation",
        product_request_kind: "none",
        routine_intent: "replace_product",
        category: "mask",
        requested_product_count: null,
        count_policy: "none",
        evidence_quote: "Maske statt Conditioner",
      }),
      tool_grounding: {
        ...baseAnswer.tool_grounding,
        used_product_tool: false,
        used_routine_tool: false,
        product_ids: [],
        routine_step_ids: [],
        hard_rule_ids: [],
      },
      routine_context: {
        active: true,
        routine_layer: "basics",
        step_id: null,
        category: "mask",
        return_path: ["routine"],
      },
      payload: {
        user_facing_answer_de: "Dann machen wir sie mit Maske statt Conditioner.",
        category_or_topic: "routine_change",
        key_points_de: ["Maske ersetzt Conditioner."],
        next_step_offer_de: null,
      },
    },
    {
      ...baseValidationContext,
      selectedProductProjections: [],
      latestUserMessage: "Mach sie mit Maske statt Conditioner",
      toolCallHistory: [{ name: "load_advisor_guidance", call_id: "call_guidance" }],
      routineThreadContext: {
        active: true,
        current_layer: "basics",
        last_answer_mode: "routine",
        last_routine_categories: ["shampoo", "conditioner"],
        last_user_goal: "Routine vereinfachen",
        summary_de: "Vereinfachte Basisroutine mit Shampoo und Conditioner.",
        visible_steps: [],
      },
      currentRoutineLayer: "basics",
      requiredGuidancePackageIds: [],
      knownHardRuleIds: [],
    },
  )

  assert.equal(result.ok, false)
  assert.ok(result.errors.some((error) => error.validator_id === "routine_tool_required"))
})

test("validator allows concise summaries inside active routine threads without routine tool", () => {
  const result = validateAgentV2FinalAnswer(
    {
      ...baseAnswer,
      answer_mode: "general_advice",
      request_interpretation: requestInterpretation({
        primary_intent: "routine_explanation",
        product_request_kind: "none",
        routine_intent: "summarize",
        category: "none",
        requested_product_count: null,
        count_policy: "none",
        evidence_quote: "fass mir das",
      }),
      tool_grounding: {
        ...baseAnswer.tool_grounding,
        used_product_tool: false,
        used_routine_tool: false,
        product_ids: [],
        routine_step_ids: [],
        hard_rule_ids: [],
      },
      routine_context: {
        active: true,
        routine_layer: "basics",
        step_id: null,
        category: "conditioner",
        return_path: ["routine"],
      },
      payload: {
        user_facing_answer_de: "Kurz: Conditioner ist Basis, Maske nur bei Bedarf.",
        category_or_topic: "routine_summary",
        key_points_de: ["Conditioner bleibt Standard.", "Maske ist optional."],
        next_step_offer_de: null,
      },
    },
    {
      ...baseValidationContext,
      selectedProductProjections: [],
      latestUserMessage: "fass mir das bitte kurz zusammen",
      toolCallHistory: [],
      routineThreadContext: {
        active: true,
        current_layer: "basics",
        last_answer_mode: "general_advice",
        last_routine_categories: ["conditioner", "mask"],
        last_user_goal: "Routine vereinfachen",
        summary_de: "Conditioner ist Basis, Maske optional.",
        visible_steps: [],
      },
      currentRoutineLayer: "basics",
      requiredGuidancePackageIds: [],
      knownHardRuleIds: [],
    },
  )

  assert.equal(result.ok, true)
})

test("validator requires product tool and routine return path for routine product deep dives", () => {
  const result = validateAgentV2FinalAnswer(
    {
      ...baseAnswer,
      answer_mode: "routine_product_deep_dive",
      request_interpretation: requestInterpretation({
        product_request_kind: "routine_product_deep_dive",
        category: "leave_in",
        requested_product_count: null,
        count_policy: "default",
        evidence_quote: "Und wie nutze ich das?",
      }),
      tool_grounding: {
        ...baseAnswer.tool_grounding,
        used_product_tool: false,
        product_ids: [],
        hard_rule_ids: [],
      },
      routine_context: {
        active: true,
        routine_layer: "deep_dive",
        step_id: "step_1",
        category: "conditioner",
        return_path: [],
      },
      payload: {
        user_facing_answer_de: "Dafuer passt ein leichter Conditioner.",
        step_id: "step_1",
        category: "conditioner",
        recommendations: [],
        return_to_routine_offer_de: null,
      },
    },
    {
      ...baseValidationContext,
      selectedProductProjections: [],
      latestUserMessage: "Welchen Conditioner konkret?",
      toolCallHistory: [{ name: "load_advisor_guidance", call_id: "call_guidance" }],
      routineThreadContext: {
        active: true,
        current_layer: "basics",
        last_answer_mode: "routine",
        last_routine_categories: ["shampoo", "conditioner"],
        last_user_goal: "Routine vereinfachen",
        summary_de: "Vereinfachte Basisroutine mit Shampoo und Conditioner.",
        visible_steps: [],
      },
      currentRoutineLayer: "basics",
      routineProjections: [{ routine_layer: "basics", visible_steps: [{ step_id: "step_1" }] }],
      requiredGuidancePackageIds: [],
      knownHardRuleIds: [],
    },
  )

  assert.equal(result.ok, false)
  assert.ok(result.errors.some((error) => error.validator_id === "product_tool_required"))
  assert.ok(result.errors.some((error) => error.validator_id === "routine_return_path_required"))
})

test("validator blocks carried routine step ids when active routine thread has no visible steps", () => {
  const result = validateAgentV2FinalAnswer(
    {
      ...baseAnswer,
      answer_mode: "routine_product_deep_dive",
      request_interpretation: requestInterpretation({
        product_request_kind: "routine_product_deep_dive",
        category: "leave_in",
        requested_product_count: null,
        count_policy: "default",
        evidence_quote: "Und wie nutze ich das?",
      }),
      tool_grounding: {
        ...baseAnswer.tool_grounding,
        used_product_tool: true,
        used_routine_tool: false,
        product_ids: ["prod_1"],
        routine_step_ids: ["carried_step"],
        hard_rule_ids: [],
      },
      routine_context: {
        active: true,
        routine_layer: "deep_dive",
        step_id: "carried_step",
        category: "leave_in",
        return_path: ["routine"],
      },
      payload: {
        user_facing_answer_de:
          "**Test Shampoo** passt hier als leichter Zusatz, weil es dein feines Haar nicht unnoetig beschwert.",
        step_id: "carried_step",
        category: "leave_in",
        recommendations: [
          {
            product_id: "prod_1",
            reason_de: "Passt als leichter Zusatz.",
            usage_de: "Sparsam in die Laengen.",
            caveat_de: null,
          },
        ],
        return_to_routine_offer_de: "Danach gehen wir zur Routine zurueck.",
      },
    },
    {
      ...baseValidationContext,
      latestUserMessage: "Und wie nutze ich das?",
      toolCallHistory: [
        selectProductsToolCall({
          category: "leave_in",
          user_request: "Und wie nutze ich das?",
          product_request_kind: "routine_product_deep_dive",
          evidence_quote: "Und wie nutze ich das?",
        }),
      ],
      routineProjections: [],
      routineThreadContext: {
        active: true,
        current_layer: "basics",
        last_answer_mode: "routine_product_deep_dive",
        last_routine_categories: ["leave_in"],
        last_user_goal: "Mehr Glanz",
        summary_de: "Leave-in als erster Zusatz.",
        visible_steps: [],
      },
      currentRoutineLayer: "basics",
      knownHardRuleIds: [],
    },
  )

  assert.equal(result.ok, false)
  assert.ok(result.errors.some((error) => error.validator_id === "known_routine_step_ids"))
})

test("validator accepts routine product deep dive step ids from active routine thread visible steps", () => {
  const result = validateAgentV2FinalAnswer(
    {
      ...baseAnswer,
      answer_mode: "routine_product_deep_dive",
      request_interpretation: requestInterpretation({
        product_request_kind: "routine_product_deep_dive",
        category: "leave_in",
        requested_product_count: null,
        count_policy: "default",
        evidence_quote: "Produkt dafuer",
      }),
      tool_grounding: {
        ...baseAnswer.tool_grounding,
        used_product_tool: true,
        used_routine_tool: false,
        product_ids: ["prod_1"],
        routine_step_ids: ["thread_step"],
        hard_rule_ids: [],
      },
      routine_context: {
        active: true,
        routine_layer: "deep_dive",
        step_id: "thread_step",
        category: "leave_in",
        return_path: ["routine"],
      },
      payload: {
        user_facing_answer_de: "**Test Shampoo** passt fuer den ersten Zusatz.",
        step_id: "thread_step",
        category: "leave_in",
        recommendations: [
          {
            product_id: "prod_1",
            reason_de: "Passt als leichter Zusatz.",
            usage_de: "Sparsam in die Laengen.",
            caveat_de: null,
          },
        ],
        return_to_routine_offer_de: "Danach gehen wir zur Routine zurueck.",
      },
    },
    {
      ...baseValidationContext,
      latestUserMessage: "Und welches Produkt dafuer?",
      toolCallHistory: [
        selectProductsToolCall({
          category: "leave_in",
          user_request: "Und welches Produkt dafuer?",
          product_request_kind: "routine_product_deep_dive",
          evidence_quote: "Produkt dafuer",
        }),
      ],
      routineProjections: [{ routine_layer: "basics", visible_steps: [{ step_id: "real_step" }] }],
      routineThreadContext: {
        active: true,
        current_layer: "goals",
        last_answer_mode: "routine",
        last_routine_categories: ["leave_in"],
        last_user_goal: "Routine vereinfachen",
        summary_de: "Erster Zusatz ist ein Leave-in.",
        visible_steps: [
          {
            step_id: "thread_step",
            label_de: "Erster Zusatz",
            category: "leave_in",
            order: 1,
            routine_layer: "goals",
          },
        ],
      },
      currentRoutineLayer: "goals",
      knownHardRuleIds: [],
    },
  )

  assert.equal(result.ok, true)
})

test("validator blocks routine product deep dive context step ids that disagree with payload", () => {
  const result = validateAgentV2FinalAnswer(
    {
      ...baseAnswer,
      answer_mode: "routine_product_deep_dive",
      request_interpretation: requestInterpretation({
        product_request_kind: "routine_product_deep_dive",
        category: "leave_in",
        requested_product_count: null,
        count_policy: "default",
        evidence_quote: "Produkt dafuer",
      }),
      tool_grounding: {
        ...baseAnswer.tool_grounding,
        used_product_tool: true,
        used_routine_tool: false,
        product_ids: ["prod_1"],
        routine_step_ids: ["thread_step"],
        hard_rule_ids: [],
      },
      routine_context: {
        active: true,
        routine_layer: "deep_dive",
        step_id: "invented_step",
        category: "leave_in",
        return_path: ["routine"],
      },
      payload: {
        user_facing_answer_de: "**Test Shampoo** passt fuer den ersten Zusatz.",
        step_id: "thread_step",
        category: "leave_in",
        recommendations: [
          {
            product_id: "prod_1",
            reason_de: "Passt als leichter Zusatz.",
            usage_de: "Sparsam in die Laengen.",
            caveat_de: null,
          },
        ],
        return_to_routine_offer_de: "Danach gehen wir zur Routine zurueck.",
      },
    },
    {
      ...baseValidationContext,
      latestUserMessage: "Und welches Produkt dafuer?",
      toolCallHistory: [
        selectProductsToolCall({
          category: "leave_in",
          user_request: "Und welches Produkt dafuer?",
          product_request_kind: "routine_product_deep_dive",
          evidence_quote: "Produkt dafuer",
        }),
      ],
      routineProjections: [{ routine_layer: "basics", visible_steps: [{ step_id: "real_step" }] }],
      routineThreadContext: {
        active: true,
        current_layer: "goals",
        last_answer_mode: "routine",
        last_routine_categories: ["leave_in"],
        last_user_goal: "Routine vereinfachen",
        summary_de: "Erster Zusatz ist ein Leave-in.",
        visible_steps: [
          {
            step_id: "thread_step",
            label_de: "Erster Zusatz",
            category: "leave_in",
            order: 1,
            routine_layer: "goals",
          },
        ],
      },
      currentRoutineLayer: "goals",
      knownHardRuleIds: [],
    },
  )

  assert.equal(result.ok, false)
  assert.ok(result.errors.some((error) => error.validator_id === "routine_metadata_consistency"))
  assert.ok(result.errors.some((error) => error.validator_id === "known_routine_step_ids"))
})

test("validator blocks ungrounded routine product deep dive step ids", () => {
  const result = validateAgentV2FinalAnswer(
    {
      ...baseAnswer,
      answer_mode: "routine_product_deep_dive",
      request_interpretation: requestInterpretation({
        product_request_kind: "routine_product_deep_dive",
        category: "leave_in",
        requested_product_count: null,
        count_policy: "default",
        evidence_quote: "Und wie nutze ich das?",
      }),
      tool_grounding: {
        ...baseAnswer.tool_grounding,
        used_product_tool: true,
        used_routine_tool: false,
        product_ids: ["prod_1"],
        routine_step_ids: [],
        hard_rule_ids: [],
      },
      routine_context: {
        active: true,
        routine_layer: "deep_dive",
        step_id: "invented_step",
        category: "leave_in",
        return_path: ["routine"],
      },
      payload: {
        user_facing_answer_de: "**Test Shampoo** passt hier.",
        step_id: "invented_step",
        category: "leave_in",
        recommendations: [
          { product_id: "prod_1", reason_de: "Passt.", usage_de: null, caveat_de: null },
        ],
        return_to_routine_offer_de: "Danach gehen wir zur Routine zurueck.",
      },
    },
    {
      ...baseValidationContext,
      latestUserMessage: "Und wie nutze ich das?",
      toolCallHistory: [
        selectProductsToolCall({
          category: "leave_in",
          user_request: "Und wie nutze ich das?",
          product_request_kind: "routine_product_deep_dive",
          evidence_quote: "Und wie nutze ich das?",
        }),
      ],
      routineProjections: [{ routine_layer: "basics", visible_steps: [{ step_id: "real_step" }] }],
      knownHardRuleIds: [],
    },
  )

  assert.equal(result.ok, false)
  assert.ok(result.errors.some((error) => error.validator_id === "known_routine_step_ids"))
})

test("validator blocks product-first answers in restricted safety mode", () => {
  const result = validateAgentV2FinalAnswer(baseAnswer, {
    ...baseValidationContext,
    safetyMode: "restricted",
  })

  assert.equal(result.ok, false)
  assert.ok(result.errors.some((error) => error.validator_id === "safety_no_product_first"))
})

test("validator blocks common German medical diagnosis and treatment claims", () => {
  for (const user_facing_answer_de of [
    "Das ist ein Ekzem; dieses Shampoo sollte es behandeln.",
    "Das klingt nach Psoriasis und sollte medizinisch behandelt werden.",
    "Dieses Produkt behandelt Entzuendung der Kopfhaut.",
  ]) {
    const result = validateAgentV2FinalAnswer(
      {
        ...baseAnswer,
        payload: {
          ...baseAnswer.payload,
          user_facing_answer_de,
        },
      },
      baseValidationContext,
    )

    assert.equal(result.ok, false, user_facing_answer_de)
    assert.ok(
      result.errors.some((error) => error.validator_id === "safety_no_treatment_claims"),
      user_facing_answer_de,
    )
  }
})

test("validator caps product recommendations at three when count policy is cap", () => {
  const result = validateAgentV2FinalAnswer(
    {
      ...baseAnswer,
      request_interpretation: requestInterpretation({
        requested_product_count: 5,
        count_policy: "cap",
      }),
      tool_grounding: {
        ...baseAnswer.tool_grounding,
        product_ids: ["prod_1", "prod_2", "prod_3", "prod_4"],
      },
      payload: {
        ...baseAnswer.payload,
        user_facing_answer_de:
          "**Test Shampoo**, **Second Shampoo**, **Third Shampoo** und **Fourth Shampoo** passen.",
        recommendations: [
          { product_id: "prod_1", reason_de: "Passt.", usage_de: null, caveat_de: null },
          { product_id: "prod_2", reason_de: "Passt.", usage_de: null, caveat_de: null },
          { product_id: "prod_3", reason_de: "Passt.", usage_de: null, caveat_de: null },
          { product_id: "prod_4", reason_de: "Passt.", usage_de: null, caveat_de: null },
        ],
      },
    },
    {
      ...baseValidationContext,
      selectedProductProjections: [
        {
          valid_product_ids: ["prod_1", "prod_2", "prod_3", "prod_4", "prod_5"],
          products: [
            { product_id: "prod_1", name: "Test Shampoo" },
            { product_id: "prod_2", name: "Second Shampoo" },
            { product_id: "prod_3", name: "Third Shampoo" },
            { product_id: "prod_4", name: "Fourth Shampoo" },
            { product_id: "prod_5", name: "Fifth Shampoo" },
          ],
        },
      ],
    },
  )

  assert.equal(result.ok, false)
  assert.ok(result.errors.some((error) => error.validator_id === "requested_product_count"))
})

test("validator drops invalid session memory without blocking valid final answer", () => {
  const result = validateAgentV2FinalAnswer(
    {
      ...baseAnswer,
      session_memory_writes: [
        {
          type: "preference",
          text: "User prefers lightweight products in this session.",
          evidence_quote: "Bitte leicht.",
          confidence: 0.9,
          ttl: "session",
          affects_recommendations: true,
          expires_at_turn: null,
        },
        {
          type: "preference",
          text: "User has a new hair texture.",
          evidence_quote: "nicht gesagt",
          confidence: 0.8,
          ttl: "session",
          affects_recommendations: true,
          expires_at_turn: null,
        },
      ],
    },
    {
      ...baseValidationContext,
      latestUserMessage: "Bitte leicht.",
    },
  )

  assert.equal(result.ok, true)
  assert.equal(result.accepted_session_memory_writes.length, 1)
  assert.equal(result.sanitized_answer?.session_memory_writes.length, 1)
  assert.equal(result.dropped_session_memory_writes.length, 1)
  assert.equal(result.dropped_session_memory_writes[0].validator_id, "session_memory_scope")
})
