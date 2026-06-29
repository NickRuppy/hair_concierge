import assert from "node:assert/strict"
import test from "node:test"

import {
  sanitizeRepairableEvidenceQuote,
  validateAgentV2FinalAnswer,
} from "../src/lib/agent-v2/validation/final-answer-validator"

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

function requiredGuidanceForAnswer(answerMode: string, category = "none"): string[] {
  const ids = ["base.advisor_rules.v1", "base.answer_contract.v1", "base.tone_and_format.v1"]
  if (answerMode === "product_recommendation" || answerMode === "product_assessment") {
    ids.push("base.product_recommendation.v1")
  }
  if (answerMode === "routine") ids.push("base.routine_building.v1")
  if (answerMode === "general_advice") ids.push("base.general_advice.v1")
  if (answerMode === "safety_boundary") ids.push("base.safety_boundaries.v1")

  const categoryMap: Record<string, string> = {
    shampoo: "category.shampoo.v1",
    conditioner: "category.conditioner.v1",
    mask: "category.mask.v1",
    leave_in: "category.leave_in.v1",
    oil: "category.oil.v1",
    bondbuilder: "category.bondbuilder.v1",
    deep_cleansing_shampoo: "category.deep_cleansing_shampoo.v1",
    dry_shampoo: "category.dry_shampoo.v1",
    peeling: "category.peeling.v1",
  }
  const categoryId = categoryMap[category]
  if (categoryId && answerMode !== "clarification" && answerMode !== "safety_boundary") {
    ids.push(categoryId)
  }
  return ids
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
    routine_intent:
      | "none"
      | "create"
      | "modify"
      | "remove_step"
      | "replace_product"
      | "explain"
      | "summarize"
      | "exit"
    care_category:
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
    specific_product_candidate: boolean
    confidence: number
  }> = {},
) {
  return {
    primary_intent: "product_recommendation",
    product_request_kind: "specific_products",
    routine_intent: "none",
    care_category: "shampoo",
    requested_product_count: null,
    count_policy: "default",
    evidence_quote: "Welches Shampoo passt zu mir?",
    specific_product_candidate: false,
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
    used_guidance_package_ids: requiredGuidanceForAnswer("product_recommendation", "shampoo"),
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
  pending_followup_action: null,
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

function selectedProjection(productId: string, name: string) {
  return {
    valid_product_ids: [productId],
    products: [{ product_id: productId, name }],
  }
}

function lookupProductCandidateToolCall() {
  return {
    name: "lookup_product_candidate",
    call_id: "call_lookup",
    arguments: {
      category: "shampoo",
      brand_text: "Brand",
      product_name_text: "Test Shampoo",
      reason: "User asks whether their own named product suits them.",
      evidence_quote: "Test Shampoo",
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

function placementOnlyAdviceAnswer(message: string, answerText: string) {
  return {
    ...baseAnswer,
    answer_mode: "general_advice",
    request_interpretation: requestInterpretation({
      primary_intent: "routine_explanation",
      product_request_kind: "none",
      routine_intent: "none",
      care_category: "none",
      requested_product_count: null,
      count_policy: "none",
      evidence_quote: message,
    }),
    tool_grounding: {
      ...baseAnswer.tool_grounding,
      used_guidance_package_ids: requiredGuidanceForAnswer("general_advice"),
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
    payload: {
      user_facing_answer_de: answerText,
      category_or_topic: "routine_placement",
      key_points_de: [answerText],
      next_step_offer_de: null,
    },
  }
}

function routineBasicsAnswer(
  visibleStepOverrides: Partial<{
    label_de: string
    action_de: string
    frequency_de: string | null
    reason_de: string
  }> = {},
) {
  return {
    ...baseAnswer,
    answer_mode: "routine",
    request_interpretation: requestInterpretation({
      primary_intent: "routine_build",
      product_request_kind: "none",
      routine_intent: "create",
      care_category: "none",
      requested_product_count: null,
      count_policy: "none",
      evidence_quote: "Routine bitte",
    }),
    tool_grounding: {
      ...baseAnswer.tool_grounding,
      used_guidance_package_ids: requiredGuidanceForAnswer("routine"),
      used_product_tool: false,
      used_routine_tool: true,
      product_ids: [],
      routine_step_ids: ["step_shampoo"],
      hard_rule_ids: [],
    },
    routine_context: {
      active: true,
      routine_layer: "basics",
      step_id: null,
      category: null,
      return_path: [],
    },
    payload: {
      user_facing_answer_de: "**Shampoo** ist dein erster Basis-Schritt.",
      routine_layer: "basics",
      visible_steps: [
        {
          step_id: "step_shampoo",
          label_de: "Shampoo",
          action_de: "Am Ansatz reinigen.",
          frequency_de: "Nach Bedarf",
          reason_de: "Basis der Routine.",
          ...visibleStepOverrides,
        },
      ],
      next_layer_options: ["goals"],
      next_step_offer_de: null,
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
  requiredGuidancePackageIds: [],
  currentRoutineLayer: null,
  knownHardRuleIds: ["product.no_uncatalogued_products"],
} as const

const routineBasicsValidationContext = {
  ...baseValidationContext,
  selectedProductProjections: [],
  latestUserMessage: "Routine bitte",
  recentEvidenceText: "Routine bitte",
  toolCallHistory: [routineToolCall({ evidence_quote: "Routine bitte" })],
  routineProjections: [
    {
      routine_layer: "basics",
      visible_steps: [{ step_id: "step_shampoo" }],
    },
  ],
  knownHardRuleIds: [],
} as const

function createValidGeneralAdviceAnswer(overrides: Record<string, unknown> = {}) {
  return {
    ...baseAnswer,
    answer_mode: "general_advice",
    interpreted_intent: "User asks for category advice.",
    request_interpretation: requestInterpretation({
      primary_intent: "category_education",
      product_request_kind: "category_education",
      routine_intent: "none",
      care_category: "mask",
      requested_product_count: null,
      count_policy: "none",
      evidence_quote: "Ist eine Maske sinnvoll?",
    }),
    extracted_constraints: {
      ...emptyExtractedConstraints(),
      product_categories: ["mask"],
      raw_constraints: ["Maske"],
    },
    tool_grounding: {
      used_guidance_package_ids: requiredGuidanceForAnswer("general_advice", "mask"),
      used_product_tool: false,
      used_routine_tool: false,
      product_ids: [],
      routine_step_ids: [],
      hard_rule_ids: [],
    },
    pending_followup_action: null,
    payload: {
      user_facing_answer_de: "Eine Maske kann sinnvoll sein.",
      category_or_topic: "mask",
      key_points_de: ["Optionaler Zusatz."],
      next_step_offer_de: null,
    },
    ...overrides,
  }
}

function socialAnswer(overrides: Record<string, unknown> = {}) {
  return {
    ...baseAnswer,
    answer_mode: "social",
    interpreted_intent: "User greets Chaarlie.",
    request_interpretation: requestInterpretation({
      primary_intent: "smalltalk",
      product_request_kind: "none",
      routine_intent: "none",
      care_category: "none",
      requested_product_count: null,
      count_policy: "none",
      evidence_quote: "hallo",
      confidence: 0.9,
    }),
    tool_grounding: {
      used_guidance_package_ids: [
        "base.advisor_rules.v1",
        "base.answer_contract.v1",
        "base.tone_and_format.v1",
      ],
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
    pending_followup_action: null,
    session_memory_writes: [],
    payload: {
      user_facing_answer_de: "Hallo! Ich bin da, wenn du eine Haarfrage hast.",
      pivot_de: "Haarfrage",
    },
    ...overrides,
  }
}

function domainBoundaryAnswer(overrides: Record<string, unknown> = {}) {
  return {
    ...socialAnswer(),
    answer_mode: "domain_boundary",
    interpreted_intent: "User request is outside supported hair care.",
    request_interpretation: requestInterpretation({
      primary_intent: "unknown",
      product_request_kind: "none",
      routine_intent: "none",
      care_category: "none",
      requested_product_count: null,
      count_policy: "none",
      evidence_quote: "welchen nagellack soll ich kaufen?",
      confidence: 0.9,
    }),
    payload: {
      user_facing_answer_de:
        "Bei Nagellack kann ich dir nicht sinnvoll helfen. Ich unterstütze dich gern bei Haarpflege, Kopfhaut, Styling oder passenden Produkten.",
      boundary_kind: "unsupported_domain",
      redirect_topic_de: "Haarpflege, Kopfhaut, Styling oder passende Produkte",
    },
    ...overrides,
  }
}

test("validator accepts known product ids", () => {
  const result = validateAgentV2FinalAnswer(baseAnswer, baseValidationContext)

  assert.equal(result.ok, true)
})

test("validator accepts grounded text-only product assessment without visible recommendations", () => {
  const answer = {
    ...baseAnswer,
    answer_mode: "product_assessment",
    interpreted_intent: "User asks whether a named shampoo suits them.",
    request_interpretation: requestInterpretation({
      primary_intent: "product_recommendation",
      product_request_kind: "product_detail",
      care_category: "shampoo",
      requested_product_count: 1,
      count_policy: "exact",
      evidence_quote: "Passt Test Shampoo zu mir?",
      specific_product_candidate: true,
    }),
    tool_grounding: {
      used_guidance_package_ids: requiredGuidanceForAnswer("product_assessment", "shampoo"),
      used_product_tool: true,
      used_routine_tool: false,
      product_ids: ["prod_1"],
      routine_step_ids: [],
      hard_rule_ids: [],
    },
    payload: {
      assessment_kind: "fit",
      assessed_product_ids: ["prod_1"],
      user_facing_answer_de:
        "Test Shampoo kann zu deinem Profil passen, wenn es am Ansatz gut reinigt und die Längen nicht beschwert.",
    },
  }

  const result = validateAgentV2FinalAnswer(answer, {
    ...baseValidationContext,
    latestUserMessage: "Passt Test Shampoo zu mir?",
    recentEvidenceText: "Passt Test Shampoo zu mir?",
    toolCallHistory: [
      {
        ...lookupProductCandidateToolCall(),
        arguments: {
          category: "shampoo",
          brand_text: "Brand",
          product_name_text: "Test Shampoo",
          reason: "User asks whether a named shampoo suits them.",
          evidence_quote: "Test Shampoo",
        },
      },
    ],
    productLookupResults: [
      {
        status: "found_exact",
        category: "shampoo",
        input_identity: {
          category: "shampoo",
          brand_text: "Brand",
          product_name_text: "Test Shampoo",
          evidence_quote: "Test Shampoo",
        },
        product: { id: "prod_1", name: "Test Shampoo" },
      },
    ],
  })

  assert.equal(result.ok, true, JSON.stringify(result.errors, null, 2))
})

test("validator accepts found-exact lookup grounding for product assessment with matching product facts", () => {
  const answer = {
    ...baseAnswer,
    answer_mode: "product_assessment",
    interpreted_intent: "User asks whether a named shampoo suits them.",
    request_interpretation: requestInterpretation({
      primary_intent: "product_recommendation",
      product_request_kind: "product_detail",
      care_category: "shampoo",
      requested_product_count: null,
      count_policy: "none",
      evidence_quote: "Passt das Syoss Volume Shampoo zu mir?",
      specific_product_candidate: true,
    }),
    tool_grounding: {
      used_guidance_package_ids: requiredGuidanceForAnswer("product_assessment", "shampoo"),
      used_product_tool: true,
      used_routine_tool: false,
      product_ids: ["prod_syoss_volume"],
      routine_step_ids: [],
      hard_rule_ids: [],
    },
    payload: {
      assessment_kind: "fit",
      assessed_product_ids: ["prod_syoss_volume"],
      user_facing_answer_de:
        "Syoss Volume Shampoo kann als leichtes Shampoo grundsätzlich zu deinem Profil passen; für Frizz bleiben Conditioner und Leave-in wichtiger.",
    },
  }

  const result = validateAgentV2FinalAnswer(answer, {
    ...baseValidationContext,
    latestUserMessage: "Passt das Syoss Volume Shampoo zu mir?",
    recentEvidenceText: "Passt das Syoss Volume Shampoo zu mir?",
    selectedProductProjections: [
      {
        ...baseValidationContext.selectedProductProjections[0],
        valid_product_ids: ["prod_syoss_volume"],
        products: [
          {
            product_id: "prod_syoss_volume",
            name: "Syoss Volume Shampoo",
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
      },
    ],
    toolCallHistory: [
      {
        ...lookupProductCandidateToolCall(),
        arguments: {
          category: "shampoo",
          brand_text: "Syoss",
          product_name_text: "Syoss Volume Shampoo",
          reason: "User asks whether a named shampoo suits them.",
          evidence_quote: "Syoss Volume Shampoo",
        },
      },
      selectProductsToolCall({
        product_request_kind: "product_detail",
        requested_product_count: 1,
        count_policy: "exact",
        evidence_quote: "Syoss Volume Shampoo",
      }),
    ],
    productLookupResults: [
      {
        status: "found_exact",
        category: "shampoo",
        input_identity: {
          category: "shampoo",
          brand_text: "Syoss",
          product_name_text: "Syoss Volume Shampoo",
          evidence_quote: "Syoss Volume Shampoo",
        },
        product: { id: "prod_syoss_volume", name: "Syoss Volume Shampoo" },
      },
    ],
  })

  assert.equal(result.ok, true, JSON.stringify(result.errors, null, 2))
})

test("validator blocks product assessment from found-exact identity without product facts", () => {
  const answer = {
    ...baseAnswer,
    answer_mode: "product_assessment",
    interpreted_intent: "User asks whether a named shampoo suits them.",
    request_interpretation: requestInterpretation({
      primary_intent: "product_recommendation",
      product_request_kind: "product_detail",
      care_category: "shampoo",
      requested_product_count: null,
      count_policy: "none",
      evidence_quote: "Passt das Syoss Volume Shampoo zu mir?",
      specific_product_candidate: true,
    }),
    tool_grounding: {
      used_guidance_package_ids: requiredGuidanceForAnswer("product_assessment", "shampoo"),
      used_product_tool: true,
      used_routine_tool: false,
      product_ids: ["prod_syoss_volume"],
      routine_step_ids: [],
      hard_rule_ids: [],
    },
    payload: {
      assessment_kind: "fit",
      assessed_product_ids: ["prod_syoss_volume"],
      user_facing_answer_de:
        "Syoss Volume Shampoo passt gut zu deinem Profil, weil es leicht reinigt und nicht beschwert.",
    },
  }

  const result = validateAgentV2FinalAnswer(answer, {
    ...baseValidationContext,
    latestUserMessage: "Passt das Syoss Volume Shampoo zu mir?",
    recentEvidenceText: "Passt das Syoss Volume Shampoo zu mir?",
    selectedProductProjections: [],
    toolCallHistory: [
      {
        ...lookupProductCandidateToolCall(),
        arguments: {
          category: "shampoo",
          brand_text: "Syoss",
          product_name_text: "Syoss Volume Shampoo",
          reason: "User asks whether a named shampoo suits them.",
          evidence_quote: "Syoss Volume Shampoo",
        },
      },
    ],
    productLookupResults: [
      {
        status: "found_exact",
        category: "shampoo",
        input_identity: {
          category: "shampoo",
          brand_text: "Syoss",
          product_name_text: "Syoss Volume Shampoo",
          evidence_quote: "Syoss Volume Shampoo",
        },
        product: { id: "prod_syoss_volume", name: "Syoss Volume Shampoo" },
      },
    ],
  })

  assert.equal(result.ok, false)
  assert.ok(result.errors.some((error) => error.validator_id === "product_assessment_grounding"))
})

test("validator blocks product assessment that omits the resolved product name", () => {
  const answer = {
    ...baseAnswer,
    answer_mode: "product_assessment",
    interpreted_intent: "User asks whether a named shampoo suits them.",
    request_interpretation: requestInterpretation({
      primary_intent: "product_recommendation",
      product_request_kind: "product_detail",
      care_category: "shampoo",
      requested_product_count: null,
      count_policy: "none",
      evidence_quote: "Passt das Syoss Volume Shampoo zu mir?",
      specific_product_candidate: true,
    }),
    tool_grounding: {
      used_guidance_package_ids: requiredGuidanceForAnswer("product_assessment", "shampoo"),
      used_product_tool: true,
      used_routine_tool: false,
      product_ids: ["prod_syoss_volume"],
      routine_step_ids: [],
      hard_rule_ids: [],
    },
    payload: {
      assessment_kind: "fit",
      assessed_product_ids: ["prod_syoss_volume"],
      user_facing_answer_de:
        "Das passt grundsätzlich gut zu dir, aber eher als normales Volumen-Shampoo als als Lösung für deine Längen.",
    },
  }

  const result = validateAgentV2FinalAnswer(answer, {
    ...baseValidationContext,
    latestUserMessage: "Passt das Syoss Volume Shampoo zu mir?",
    recentEvidenceText: "Passt das Syoss Volume Shampoo zu mir?",
    selectedProductProjections: [],
    toolCallHistory: [
      {
        ...lookupProductCandidateToolCall(),
        arguments: {
          category: "shampoo",
          brand_text: "Syoss",
          product_name_text: "Syoss Volume Shampoo",
          reason: "User asks whether a named shampoo suits them.",
          evidence_quote: "Syoss Volume Shampoo",
        },
      },
    ],
    productLookupResults: [
      {
        status: "found_exact",
        category: "shampoo",
        input_identity: {
          category: "shampoo",
          brand_text: "Syoss",
          product_name_text: "Syoss Volume Shampoo",
          evidence_quote: "Syoss Volume Shampoo",
        },
        product: { id: "prod_syoss_volume", name: "Syoss Volume Shampoo" },
      },
    ],
  })

  assert.equal(result.ok, false)
  assert.equal(
    result.errors.some((error) => error.validator_id === "product_assessment_visible_identity"),
    true,
    JSON.stringify(result.errors, null, 2),
  )
})

test("validator blocks mixed product assessment prose for an unresolved second product", () => {
  const answer = {
    ...baseAnswer,
    answer_mode: "product_assessment",
    interpreted_intent: "User compares one verified shampoo with one unresolved conditioner.",
    request_interpretation: requestInterpretation({
      primary_intent: "product_recommendation",
      product_request_kind: "compare_products",
      care_category: "unknown",
      requested_product_count: null,
      count_policy: "none",
      evidence_quote: "Vergleich Syoss Volume Shampoo und Urban Alchemy Moisture Mist Conditioner",
      specific_product_candidate: true,
    }),
    tool_grounding: {
      used_guidance_package_ids: requiredGuidanceForAnswer("product_assessment", "shampoo"),
      used_product_tool: true,
      used_routine_tool: false,
      product_ids: ["prod_syoss_volume"],
      routine_step_ids: [],
      hard_rule_ids: [],
    },
    payload: {
      assessment_kind: "comparison",
      assessed_product_ids: ["prod_syoss_volume"],
      user_facing_answer_de:
        "Syoss Volume Shampoo passt gut als leichte Reinigung. Urban Alchemy Moisture Mist Conditioner passt ebenfalls gut zu deinem feinen Haar, weil er leicht wirkt.",
    },
  }

  const result = validateAgentV2FinalAnswer(answer, {
    ...baseValidationContext,
    latestUserMessage:
      "Vergleich Syoss Volume Shampoo und Urban Alchemy Moisture Mist Conditioner.",
    recentEvidenceText:
      "Vergleich Syoss Volume Shampoo und Urban Alchemy Moisture Mist Conditioner.",
    selectedProductProjections: [],
    toolCallHistory: [
      {
        ...lookupProductCandidateToolCall(),
        arguments: {
          category: "shampoo",
          brand_text: "Syoss",
          product_name_text: "Volume Shampoo",
          reason: "User asks for a named-product comparison.",
          evidence_quote: "Syoss Volume Shampoo",
        },
      },
      {
        ...lookupProductCandidateToolCall(),
        arguments: {
          category: "conditioner",
          brand_text: "Urban Alchemy",
          product_name_text: "Moisture Mist Conditioner",
          reason: "User asks for a named-product comparison.",
          evidence_quote: "Urban Alchemy Moisture Mist Conditioner",
        },
      },
    ],
    productLookupResults: [
      {
        status: "found_exact",
        category: "shampoo",
        input_identity: {
          category: "shampoo",
          brand_text: "Syoss",
          product_name_text: "Volume Shampoo",
          evidence_quote: "Syoss Volume Shampoo",
        },
        product: { id: "prod_syoss_volume", name: "Syoss Volume Shampoo" },
      },
      {
        status: "not_found",
        category: "conditioner",
        input_identity: {
          category: "conditioner",
          brand_text: "Urban Alchemy",
          product_name_text: "Moisture Mist Conditioner",
          evidence_quote: "Urban Alchemy Moisture Mist Conditioner",
        },
        product: null,
      },
    ],
  })

  assert.equal(result.ok, false)
  assert.ok(
    result.errors.some((error) => error.validator_id === "product_lookup_unresolved"),
    JSON.stringify(result.errors, null, 2),
  )
})

test("validator blocks product assessment for unresolved lookup contexts", () => {
  const answer = {
    ...baseAnswer,
    answer_mode: "product_assessment",
    interpreted_intent: "User asks whether an unresolved named conditioner suits them.",
    request_interpretation: requestInterpretation({
      primary_intent: "product_recommendation",
      product_request_kind: "product_detail",
      care_category: "conditioner",
      requested_product_count: 1,
      count_policy: "exact",
      evidence_quote: "Jean & Lean Conditioner",
      specific_product_candidate: true,
    }),
    tool_grounding: {
      used_guidance_package_ids: requiredGuidanceForAnswer("product_assessment", "conditioner"),
      used_product_tool: true,
      used_routine_tool: false,
      product_ids: ["prod_1"],
      routine_step_ids: [],
      hard_rule_ids: [],
    },
    payload: {
      assessment_kind: "fit",
      assessed_product_ids: ["prod_1"],
      user_facing_answer_de: "Dieser Conditioner passt gut zu deinem Profil.",
    },
  }

  const result = validateAgentV2FinalAnswer(answer, {
    ...baseValidationContext,
    latestUserMessage: "Was hältst du von meinem Jean & Lean Conditioner?",
    recentEvidenceText: "Was hältst du von meinem Jean & Lean Conditioner?",
    toolCallHistory: [
      {
        ...lookupProductCandidateToolCall(),
        arguments: {
          category: "conditioner",
          brand_text: "Jean & Lean",
          product_name_text: "Conditioner",
          reason: "User asks about a named conditioner.",
          evidence_quote: "Jean & Lean Conditioner",
        },
      },
    ],
    productLookupResults: [
      {
        status: "needs_variant_selection",
        category: "conditioner",
        input_identity: {
          category: "conditioner",
          brand_text: "Jean & Lean",
          product_name_text: "Conditioner",
          evidence_quote: "Jean & Lean Conditioner",
        },
        product: null,
      },
    ],
  })

  assert.equal(result.ok, false)
  assert.ok(
    result.errors.some((error) => error.validator_id === "product_assessment_grounding"),
    JSON.stringify(result.errors, null, 2),
  )
})

test("validator blocks pronoun product advice while active product review is pending", () => {
  const result = validateAgentV2FinalAnswer(
    {
      ...placementOnlyAdviceAnswer(
        "Passt es zu mir?",
        "Das Produkt passt gut zu deinem feinen Haar, weil es wahrscheinlich eher leicht wirkt.",
      ),
      request_interpretation: requestInterpretation({
        primary_intent: "product_recommendation",
        product_request_kind: "product_detail",
        routine_intent: "none",
        care_category: "conditioner",
        requested_product_count: null,
        count_policy: "none",
        evidence_quote: "Passt es zu mir?",
        specific_product_candidate: true,
      }),
      tool_grounding: {
        ...baseAnswer.tool_grounding,
        used_guidance_package_ids: [
          ...requiredGuidanceForAnswer("general_advice", "conditioner"),
          "base.product_recommendation.v1",
        ],
        used_product_tool: false,
        product_ids: [],
      },
    },
    {
      ...baseValidationContext,
      latestUserMessage: "Passt es zu mir?",
      recentEvidenceText:
        "Jean & Len Granatapfel Rose Conditioner wurde gerade zur Prüfung eingereicht. Passt es zu mir?",
      selectedProductProjections: [],
      toolCallHistory: [],
      productLookupResults: [
        {
          status: "not_found",
          category: "conditioner",
          input_identity: {
            category: "conditioner",
            brand_text: "Jean & Len",
            product_name_text: "Granatapfel Rose Conditioner",
            evidence_quote: "Jean & Len Granatapfel Rose Conditioner",
          },
          product: null,
        },
      ],
    },
  )

  assert.equal(result.ok, false)
  assert.ok(
    result.errors.some((error) => error.validator_id === "product_lookup_unresolved"),
    JSON.stringify(result.errors, null, 2),
  )
})

test("validator rejects recommendation-card payload fields for product assessment", () => {
  const result = validateAgentV2FinalAnswer(
    {
      ...baseAnswer,
      answer_mode: "product_assessment",
      payload: {
        user_facing_answer_de: "Test Shampoo passt gut.",
        recommendations: [
          {
            product_id: "prod_1",
            reason_de: "Passt.",
            usage_de: null,
            caveat_de: null,
          },
        ],
        comparison_notes_de: [],
        usage_notes_de: [],
        next_step_offer_de: null,
      },
    },
    baseValidationContext,
  )

  assert.equal(result.ok, false)
  assert.ok(result.errors.some((error) => error.validator_id === "terminal_schema"))
})

test("AgentV2 validator blocks confirmable next step without pending follow-up action", () => {
  const answer = createValidGeneralAdviceAnswer({
    payload: {
      user_facing_answer_de: "Eine Maske kann sinnvoll sein.",
      category_or_topic: "mask",
      key_points_de: ["Optionaler Zusatz."],
      next_step_offer_de: "Ich kann dir danach konkrete Masken empfehlen.",
    },
    pending_followup_action: null,
  })

  const result = validateAgentV2FinalAnswer(answer, {
    ...baseValidationContext,
    selectedProductProjections: [],
    latestUserMessage: "Maske",
    recentEvidenceText: "Maske",
    toolCallHistory: [],
    knownHardRuleIds: [],
  })

  assert.equal(result.ok, false)
  const error = result.errors.find(
    (finding) => finding.validator_id === "pending_followup_action_missing",
  )
  assert.ok(error)
  assert.equal(error.reason_code, "pending_followup_action_missing")
  assert.equal(error.expected, "pending_followup_action.kind=product_recommendation")
  assert.match(error.repair_hint ?? "", /product_recommendation/)
})

test("validator does not require lookup from deterministic named-product context alone", () => {
  const result = validateAgentV2FinalAnswer(
    placementOnlyAdviceAnswer(
      "Passt Test Shampoo zu mir?",
      "Bei feinem Haar zählt vor allem, dass Pflege nicht zu schwer wird.",
    ),
    {
      ...baseValidationContext,
      latestUserMessage: "Passt Test Shampoo zu mir?",
      recentEvidenceText: "Passt Test Shampoo zu mir?",
      toolCallHistory: [],
      namedProductContext: {
        display_name: "Test Shampoo",
        category: "shampoo",
        plausible_exact_name: true,
      },
    },
  )

  assert.equal(
    result.errors.some((error) => error.validator_id === "product_lookup_required"),
    false,
  )
})

test("validator requires lookup when deterministic context identifies an evaluation even if model misses product candidate", () => {
  const result = validateAgentV2FinalAnswer(
    {
      ...baseAnswer,
      answer_mode: "clarification",
      request_interpretation: requestInterpretation({
        primary_intent: "unknown",
        product_request_kind: "none",
        care_category: "conditioner",
        evidence_quote: "jean & lean conditioner",
        specific_product_candidate: false,
      }),
      payload: {
        user_facing_answer_de:
          "Ich bin mir gerade nicht sicher, was du genau möchtest. Formulier es bitte einmal konkreter.",
        question_de: "Welches Produkt meinst du genau?",
        missing_keys: ["product_identity"],
      },
    },
    {
      ...baseValidationContext,
      selectedProductProjections: [],
      latestUserMessage: "kannst du mir sagen, was du von meinem jean & lean conditioner hältst",
      recentEvidenceText: "kannst du mir sagen, was du von meinem jean & lean conditioner hältst",
      toolCallHistory: [],
      namedProductContext: {
        display_name: "jean & lean Conditioner",
        category: "conditioner",
        plausible_exact_name: true,
        named_product_intent: "evaluation",
      },
    },
  )

  assert.equal(result.ok, false)
  assert.ok(
    result.errors.some((error) => error.validator_id === "product_lookup_required"),
    JSON.stringify(result.errors, null, 2),
  )
})

test("validator requires lookup when visible answer claims about deterministic own-product context", () => {
  const result = validateAgentV2FinalAnswer(
    placementOnlyAdviceAnswer(
      "Ich benutze Test Shampoo. Passt das zu mir?",
      "Test Shampoo ist als Kategorie wahrscheinlich okay, wenn deine Kopfhaut es toleriert.",
    ),
    {
      ...baseValidationContext,
      selectedProductProjections: [],
      latestUserMessage: "Ich benutze Test Shampoo. Passt das zu mir?",
      recentEvidenceText: "Ich benutze Test Shampoo. Passt das zu mir?",
      toolCallHistory: [],
      namedProductContext: {
        display_name: "Test Shampoo",
        category: "shampoo",
        plausible_exact_name: true,
        named_product_intent: "current_use_product_question",
      },
    },
  )

  assert.equal(
    result.errors.some((error) => error.validator_id === "product_lookup_required"),
    true,
  )
})

test("validator requires lookup from model-owned product candidate metadata without named-product context", () => {
  const result = validateAgentV2FinalAnswer(
    {
      ...baseAnswer,
      request_interpretation: requestInterpretation({
        primary_intent: "product_recommendation",
        product_request_kind: "product_detail",
        care_category: "conditioner",
        requested_product_count: 1,
        count_policy: "exact",
        evidence_quote: "jean & lean conditioner",
        specific_product_candidate: true,
      }),
    },
    {
      ...baseValidationContext,
      latestUserMessage: "kannst du mir sagen, was du von meinem jean & lean conditioner hältst",
      recentEvidenceText: "kannst du mir sagen, was du von meinem jean & lean conditioner hältst",
      selectedProductProjections: [],
      toolCallHistory: [],
      namedProductContext: null,
    },
  )

  assert.equal(result.ok, false)
  assert.ok(result.errors.some((error) => error.validator_id === "product_lookup_required"))
})

test("validator does not require duplicate lookup when model-owned product candidate already called lookup", () => {
  const result = validateAgentV2FinalAnswer(
    {
      ...baseAnswer,
      request_interpretation: requestInterpretation({
        primary_intent: "product_recommendation",
        product_request_kind: "product_detail",
        care_category: "conditioner",
        requested_product_count: 1,
        count_policy: "exact",
        evidence_quote: "jean & lean conditioner",
        specific_product_candidate: true,
      }),
    },
    {
      ...baseValidationContext,
      latestUserMessage: "kannst du mir sagen, was du von meinem jean & lean conditioner hältst",
      recentEvidenceText: "kannst du mir sagen, was du von meinem jean & lean conditioner hältst",
      toolCallHistory: [
        {
          ...lookupProductCandidateToolCall(),
          arguments: {
            category: "conditioner",
            brand_text: "Jean & Lean",
            product_name_text: "Conditioner",
            reason: "User asks whether their own named product suits them.",
            evidence_quote: "jean & lean conditioner",
          },
        },
      ],
      productLookupResults: [
        {
          status: "found_exact",
          category: "conditioner",
          input_identity: {
            category: "conditioner",
            brand_text: "Jean & Lean",
            product_name_text: "Conditioner",
            evidence_quote: "jean & lean conditioner",
          },
          product: { id: "prod_1", name: "Jean & Lean Conditioner" },
        },
      ],
      namedProductContext: null,
    },
  )

  assert.equal(
    result.errors.some((error) => error.validator_id === "product_lookup_required"),
    false,
  )
})

test("validator matches lookup to mentioned product identity even when answer target category differs", () => {
  const result = validateAgentV2FinalAnswer(
    {
      ...baseAnswer,
      request_interpretation: requestInterpretation({
        primary_intent: "product_recommendation",
        product_request_kind: "product_detail",
        care_category: "conditioner",
        requested_product_count: 1,
        count_policy: "exact",
        evidence_quote: "Olaplex No.4 Shampoo",
        specific_product_candidate: true,
      }),
    },
    {
      ...baseValidationContext,
      latestUserMessage: "Ich nutze Olaplex No.4 Shampoo, welchen Conditioner empfiehlst du dazu?",
      recentEvidenceText: "Ich nutze Olaplex No.4 Shampoo, welchen Conditioner empfiehlst du dazu?",
      selectedProductProjections: [],
      toolCallHistory: [
        {
          ...lookupProductCandidateToolCall(),
          arguments: {
            category: "shampoo",
            brand_text: "Olaplex",
            product_name_text: "No.4 Shampoo",
            reason: "User mentions a concrete shampoo while asking for conditioner advice.",
            evidence_quote: "Olaplex No.4 Shampoo",
          },
        },
      ],
      productLookupResults: [
        {
          status: "found_exact",
          category: "shampoo",
          input_identity: {
            category: "shampoo",
            brand_text: "Olaplex",
            product_name_text: "No.4 Shampoo",
            evidence_quote: "Olaplex No.4 Shampoo",
          },
          product: { id: "olaplex-no4", name: "Olaplex No.4 Shampoo" },
        },
      ],
      namedProductContext: null,
    },
  )

  assert.equal(
    result.errors.some((error) => error.validator_id === "product_lookup_required"),
    false,
  )
})

test("validator does not treat a different product lookup as satisfying model-owned candidate lookup", () => {
  const result = validateAgentV2FinalAnswer(
    {
      ...baseAnswer,
      request_interpretation: requestInterpretation({
        primary_intent: "product_recommendation",
        product_request_kind: "product_detail",
        care_category: "conditioner",
        requested_product_count: 1,
        count_policy: "exact",
        evidence_quote: "jean & lean conditioner",
        specific_product_candidate: true,
      }),
    },
    {
      ...baseValidationContext,
      latestUserMessage: "kannst du mir sagen, was du von meinem jean & lean conditioner hältst",
      recentEvidenceText: "kannst du mir sagen, was du von meinem jean & lean conditioner hältst",
      selectedProductProjections: [],
      toolCallHistory: [
        {
          ...lookupProductCandidateToolCall(),
          arguments: {
            category: "conditioner",
            brand_text: "Pantene",
            product_name_text: "Miracles Conditioner",
            reason: "Wrong candidate.",
            evidence_quote: "Pantene Miracles Conditioner",
          },
        },
      ],
      productLookupResults: [
        {
          status: "found_exact",
          category: "conditioner",
          input_identity: {
            brand_text: "Pantene",
            product_name_text: "Miracles Conditioner",
          },
          product: { id: "pantene-conditioner", name: "Pantene Miracles Conditioner" },
        },
      ],
      namedProductContext: null,
    },
  )

  assert.equal(result.ok, false)
  assert.ok(result.errors.some((error) => error.validator_id === "product_lookup_required"))
})

test("validator does not use lookup evidence quote alone as candidate identity", () => {
  const result = validateAgentV2FinalAnswer(
    {
      ...baseAnswer,
      request_interpretation: requestInterpretation({
        primary_intent: "product_recommendation",
        product_request_kind: "product_detail",
        care_category: "conditioner",
        requested_product_count: 1,
        count_policy: "exact",
        evidence_quote: "jean & lean conditioner",
        specific_product_candidate: true,
      }),
    },
    {
      ...baseValidationContext,
      latestUserMessage: "kannst du mir sagen, was du von meinem jean & lean conditioner hältst",
      recentEvidenceText: "kannst du mir sagen, was du von meinem jean & lean conditioner hältst",
      selectedProductProjections: [],
      toolCallHistory: [
        {
          ...lookupProductCandidateToolCall(),
          arguments: {
            category: "conditioner",
            brand_text: "Pantene",
            product_name_text: "Miracles Conditioner",
            reason: "Wrong candidate with copied evidence.",
            evidence_quote: "jean & lean conditioner",
          },
        },
      ],
      productLookupResults: [
        {
          status: "found_exact",
          category: "conditioner",
          input_identity: {
            category: "conditioner",
            brand_text: "Pantene",
            product_name_text: "Miracles Conditioner",
            evidence_quote: "jean & lean conditioner",
          },
          product: { id: "pantene-conditioner", name: "Pantene Miracles Conditioner" },
        },
      ],
      namedProductContext: null,
    },
  )

  assert.equal(result.ok, false)
  assert.ok(result.errors.some((error) => error.validator_id === "product_lookup_required"))
})

test("validator does not use generic product name fragment alone when lookup brand differs", () => {
  const result = validateAgentV2FinalAnswer(
    {
      ...baseAnswer,
      request_interpretation: requestInterpretation({
        primary_intent: "product_recommendation",
        product_request_kind: "product_detail",
        care_category: "conditioner",
        requested_product_count: 1,
        count_policy: "exact",
        evidence_quote: "jean & lean conditioner",
        specific_product_candidate: true,
      }),
    },
    {
      ...baseValidationContext,
      latestUserMessage: "kannst du mir sagen, was du von meinem jean & lean conditioner hältst",
      recentEvidenceText: "kannst du mir sagen, was du von meinem jean & lean conditioner hältst",
      selectedProductProjections: [],
      toolCallHistory: [
        {
          ...lookupProductCandidateToolCall(),
          arguments: {
            category: "conditioner",
            brand_text: "Pantene",
            product_name_text: "Conditioner",
            reason: "Wrong generic candidate with copied evidence.",
            evidence_quote: "jean & lean conditioner",
          },
        },
      ],
      productLookupResults: [
        {
          status: "found_exact",
          category: "conditioner",
          input_identity: {
            category: "conditioner",
            brand_text: "Pantene",
            product_name_text: "Conditioner",
            evidence_quote: "jean & lean conditioner",
          },
          product: { id: "pantene-conditioner", name: "Pantene Conditioner" },
        },
      ],
      namedProductContext: null,
    },
  )

  assert.equal(result.ok, false)
  assert.ok(result.errors.some((error) => error.validator_id === "product_lookup_required"))
})

test("validator does not use product-name-only evidence when lookup brand differs", () => {
  const result = validateAgentV2FinalAnswer(
    {
      ...baseAnswer,
      request_interpretation: requestInterpretation({
        primary_intent: "product_recommendation",
        product_request_kind: "product_detail",
        care_category: "conditioner",
        requested_product_count: 1,
        count_policy: "exact",
        evidence_quote: "miracles conditioner",
        specific_product_candidate: true,
      }),
    },
    {
      ...baseValidationContext,
      latestUserMessage:
        "kannst du mir sagen, was du von meinem jean & lean miracles conditioner hältst",
      recentEvidenceText:
        "kannst du mir sagen, was du von meinem jean & lean miracles conditioner hältst",
      selectedProductProjections: [],
      toolCallHistory: [
        {
          ...lookupProductCandidateToolCall(),
          arguments: {
            category: "conditioner",
            brand_text: "Pantene",
            product_name_text: "Miracles Conditioner",
            reason: "Wrong candidate with overlapping product name.",
            evidence_quote: "miracles conditioner",
          },
        },
      ],
      productLookupResults: [
        {
          status: "found_exact",
          category: "conditioner",
          input_identity: {
            category: "conditioner",
            brand_text: "Pantene",
            product_name_text: "Miracles Conditioner",
            evidence_quote: "miracles conditioner",
          },
          product: { id: "pantene-conditioner", name: "Pantene Miracles Conditioner" },
        },
      ],
      namedProductContext: null,
    },
  )

  assert.equal(result.ok, false)
  assert.ok(result.errors.some((error) => error.validator_id === "product_lookup_required"))
})

test("validator requires lookup when constraint-blocked answer makes named-product claim", () => {
  const result = validateAgentV2FinalAnswer(
    {
      ...baseAnswer,
      answer_mode: "constraint_blocked",
      request_interpretation: requestInterpretation({
        primary_intent: "product_recommendation",
        product_request_kind: "product_detail",
        care_category: "shampoo",
        requested_product_count: null,
        count_policy: "none",
        evidence_quote: "Test Shampoo",
      }),
      tool_grounding: {
        ...baseAnswer.tool_grounding,
        used_guidance_package_ids: requiredGuidanceForAnswer("general_advice", "shampoo"),
        used_product_tool: false,
        product_ids: [],
      },
      payload: {
        user_facing_answer_de:
          "Test Shampoo passt wahrscheinlich gut, wenn deine Kopfhaut es toleriert.",
        blocking_constraints: ["product_not_verified"],
        safe_alternative_de: "Du kannst es zur Produktprüfung hinzufügen.",
      },
    },
    {
      ...baseValidationContext,
      selectedProductProjections: [],
      latestUserMessage: "Ich benutze Test Shampoo. Passt das zu mir?",
      recentEvidenceText: "Ich benutze Test Shampoo. Passt das zu mir?",
      toolCallHistory: [],
      namedProductContext: {
        display_name: "Test Shampoo",
        category: "shampoo",
        plausible_exact_name: true,
        named_product_intent: "current_use_product_question",
      },
    },
  )

  assert.equal(result.ok, false)
  assert.ok(result.errors.some((error) => error.validator_id === "product_lookup_required"))
})

test("validator does not use stale recent evidence text to satisfy a different product lookup", () => {
  const result = validateAgentV2FinalAnswer(
    {
      ...baseAnswer,
      request_interpretation: requestInterpretation({
        primary_intent: "product_recommendation",
        product_request_kind: "product_detail",
        care_category: "conditioner",
        requested_product_count: 1,
        count_policy: "exact",
        evidence_quote: "jean & lean conditioner",
        specific_product_candidate: true,
      }),
    },
    {
      ...baseValidationContext,
      latestUserMessage: "kannst du mir sagen, was du von meinem jean & lean conditioner hältst",
      recentEvidenceText:
        "Vorher ging es um Pantene Miracles Conditioner. Jetzt: jean & lean conditioner.",
      selectedProductProjections: [],
      toolCallHistory: [
        {
          ...lookupProductCandidateToolCall(),
          arguments: {
            category: "conditioner",
            brand_text: "Pantene",
            product_name_text: "Miracles Conditioner",
            reason: "Stale previous candidate.",
            evidence_quote: "Pantene Miracles Conditioner",
          },
        },
      ],
      productLookupResults: [
        {
          status: "found_exact",
          category: "conditioner",
          input_identity: {
            category: "conditioner",
            brand_text: "Pantene",
            product_name_text: "Miracles Conditioner",
          },
          product: { id: "pantene-conditioner", name: "Pantene Miracles Conditioner" },
        },
      ],
      namedProductContext: null,
    },
  )

  assert.equal(result.ok, false)
  assert.ok(result.errors.some((error) => error.validator_id === "product_lookup_required"))
})

test("validator requires lookup before clarification for exact own-product suitability turns", () => {
  const result = validateAgentV2FinalAnswer(
    {
      ...baseAnswer,
      answer_mode: "clarification",
      request_interpretation: requestInterpretation({
        primary_intent: "clarification",
        product_request_kind: "product_detail",
        routine_intent: "none",
        care_category: "conditioner",
        requested_product_count: null,
        count_policy: "none",
        evidence_quote: "Ich benutze Test Conditioner",
        specific_product_candidate: true,
      }),
      tool_grounding: {
        ...baseAnswer.tool_grounding,
        used_guidance_package_ids: requiredGuidanceForAnswer("clarification"),
        used_product_tool: false,
        product_ids: [],
      },
      payload: {
        user_facing_answer_de: "Was möchtest du genau über das Produkt wissen?",
        question_de: "Was möchtest du genau über das Produkt wissen?",
        missing_keys: ["request_focus"],
      },
    },
    {
      ...baseValidationContext,
      selectedProductProjections: [],
      latestUserMessage: "Ich benutze Test Conditioner. Passt das zu mir?",
      recentEvidenceText: "Ich benutze Test Conditioner. Passt das zu mir?",
      toolCallHistory: [],
      namedProductContext: {
        display_name: "Test Conditioner",
        category: "conditioner",
        plausible_exact_name: true,
        named_product_intent: "current_use_product_question",
      },
    },
  )

  assert.equal(result.ok, false)
  assert.ok(result.errors.some((error) => error.validator_id === "product_lookup_required"))
})

test("validator does not require lookup for background current-use product mentions", () => {
  const result = validateAgentV2FinalAnswer(
    placementOnlyAdviceAnswer(
      "Ich benutze Test Shampoo. Wie oft sollte ich meine Haare waschen?",
      "Für die Waschfrequenz zählt vor allem deine Kopfhaut; starte nach Bedarf und beobachte, wie schnell der Ansatz nachfettet.",
    ),
    {
      ...baseValidationContext,
      selectedProductProjections: [],
      latestUserMessage: "Ich benutze Test Shampoo. Wie oft sollte ich meine Haare waschen?",
      recentEvidenceText: "Ich benutze Test Shampoo. Wie oft sollte ich meine Haare waschen?",
      toolCallHistory: [],
      namedProductContext: {
        display_name: "Test Shampoo",
        category: "shampoo",
        plausible_exact_name: true,
        named_product_intent: "background",
      },
    },
  )

  assert.equal(result.ok, true)
  assert.equal(
    result.errors.some((error) => error.validator_id === "product_lookup_required"),
    false,
  )
})

test("validator does not require lookup for background product clarification answers", () => {
  const result = validateAgentV2FinalAnswer(
    {
      ...baseAnswer,
      answer_mode: "clarification",
      request_interpretation: requestInterpretation({
        primary_intent: "clarification",
        product_request_kind: "none",
        routine_intent: "none",
        care_category: "shampoo",
        requested_product_count: null,
        count_policy: "none",
        evidence_quote: "Ich benutze Test Shampoo",
      }),
      tool_grounding: {
        ...baseAnswer.tool_grounding,
        used_guidance_package_ids: requiredGuidanceForAnswer("clarification"),
        used_product_tool: false,
        product_ids: [],
      },
      payload: {
        user_facing_answer_de: "Meinst du die Kopfhaut oder eher die Längen?",
        question_de: "Meinst du die Kopfhaut oder eher die Längen?",
        missing_keys: ["focus_area"],
      },
    },
    {
      ...baseValidationContext,
      selectedProductProjections: [],
      latestUserMessage: "Ich benutze Test Shampoo. Was ist besser?",
      recentEvidenceText: "Ich benutze Test Shampoo. Was ist besser?",
      toolCallHistory: [],
      namedProductContext: {
        display_name: "Test Shampoo",
        category: "shampoo",
        plausible_exact_name: true,
        named_product_intent: "background",
      },
    },
  )

  assert.equal(
    result.errors.some((error) => error.validator_id === "product_lookup_required"),
    false,
  )
})

test("validator does not require unavailable product lookup when intake is disabled", () => {
  const result = validateAgentV2FinalAnswer(
    {
      ...baseAnswer,
      request_interpretation: requestInterpretation({
        primary_intent: "product_recommendation",
        product_request_kind: "product_detail",
        requested_product_count: 1,
        count_policy: "exact",
        evidence_quote: "Test Shampoo",
      }),
    },
    {
      ...baseValidationContext,
      productIntakeEnabled: false,
      latestUserMessage: "Passt Test Shampoo zu mir?",
      recentEvidenceText: "Passt Test Shampoo zu mir?",
      toolCallHistory: [
        selectProductsToolCall({
          product_request_kind: "product_detail",
          requested_product_count: 1,
          count_policy: "exact",
          evidence_quote: "Test Shampoo",
        }),
      ],
      namedProductContext: {
        display_name: "Test Shampoo",
        category: "shampoo",
        plausible_exact_name: true,
        named_product_intent: "evaluation",
      },
    },
  )

  assert.equal(
    result.errors.some((error) => error.validator_id === "product_lookup_required"),
    false,
  )
})

test("validator does not require lookup for broad product recommendations without a concrete product", () => {
  const result = validateAgentV2FinalAnswer(baseAnswer, baseValidationContext)

  assert.equal(result.ok, true)
  assert.equal(
    result.errors.some((error) => error.validator_id === "product_lookup_required"),
    false,
  )
})

for (const status of [
  "ambiguous",
  "needs_variant_selection",
  "category_mismatch",
  "insufficient_identity",
  "not_found",
  "unsupported_category",
]) {
  test(`validator blocks product recommendations after ${status} product lookup`, () => {
    const result = validateAgentV2FinalAnswer(baseAnswer, {
      ...baseValidationContext,
      productLookupResults: [
        {
          status,
          category: "shampoo",
          product: null,
        },
      ],
    })

    assert.equal(result.ok, false)
    assert.ok(result.errors.some((error) => error.validator_id === "product_lookup_unresolved"))
  })
}

test("validator allows product recommendations after exact product lookup", () => {
  const result = validateAgentV2FinalAnswer(baseAnswer, {
    ...baseValidationContext,
    toolCallHistory: [...baseValidationContext.toolCallHistory, lookupProductCandidateToolCall()],
    productLookupResults: [
      {
        status: "found_exact",
        category: "shampoo",
        product: { id: "prod_1", name: "Test Shampoo" },
      },
    ],
  })

  assert.equal(result.ok, true)
})

test("validator blocks unverified-product caveat for trusted selected product", () => {
  const result = validateAgentV2FinalAnswer(
    {
      ...baseAnswer,
      answer_mode: "general_advice",
      request_interpretation: requestInterpretation({
        primary_intent: "general_advice",
        product_request_kind: "product_detail",
        requested_product_count: 1,
        count_policy: "exact",
        evidence_quote: "Syoss Intense Curls",
        specific_product_candidate: true,
      }),
      tool_grounding: {
        ...baseAnswer.tool_grounding,
        used_guidance_package_ids: requiredGuidanceForAnswer("general_advice", "shampoo"),
        used_product_tool: true,
        product_ids: ["prod_1"],
      },
      payload: {
        user_facing_answer_de:
          "Zu Syoss Intense Curls kann ich dir das nicht sicher bestätigen, weil ich diese Variante nicht als verifizierten Katalogtreffer prüfen kann.",
        category_or_topic: "shampoo",
        key_points_de: [],
        next_step_offer_de: null,
      },
    },
    {
      ...baseValidationContext,
      trustedSelectedProductIds: ["prod_1"],
      productLookupResults: [
        {
          status: "found_exact",
          category: "shampoo",
          product: { id: "prod_1", name: "Syoss Intense Curls" },
        },
      ],
    },
  )

  assert.equal(result.ok, false)
  assert.ok(
    result.errors.some((error) => error.validator_id === "trusted_product_unverified_caveat"),
  )
})

test("validator allows identity-only acknowledgement for trusted selected product without product tool", () => {
  const result = validateAgentV2FinalAnswer(
    {
      ...baseAnswer,
      answer_mode: "general_advice",
      request_interpretation: requestInterpretation({
        primary_intent: "general_advice",
        product_request_kind: "product_detail",
        requested_product_count: 1,
        count_policy: "exact",
        evidence_quote: "Syoss Intense Curls",
        specific_product_candidate: true,
      }),
      tool_grounding: {
        ...baseAnswer.tool_grounding,
        used_guidance_package_ids: requiredGuidanceForAnswer("general_advice", "shampoo"),
        used_product_tool: false,
        product_ids: [],
      },
      payload: {
        user_facing_answer_de:
          "Alles klar, ich beziehe mich ab jetzt auf **Syoss Intense Curls Shampoo**.",
        category_or_topic: "shampoo",
        key_points_de: ["Produktidentität geklärt."],
        next_step_offer_de: null,
      },
    },
    {
      ...baseValidationContext,
      selectedProductProjections: [],
      toolCallHistory: [lookupProductCandidateToolCall()],
      latestUserMessage: "Syoss Intense Curls",
      recentEvidenceText: "Syoss Intense Curls",
      trustedSelectedProductIds: ["prod_1"],
      productLookupResults: [
        {
          status: "found_exact",
          category: "shampoo",
          product: { id: "prod_1", name: "Syoss Intense Curls Shampoo" },
        },
      ],
    },
  )

  assert.equal(result.ok, true)
})

test("validator requires product tool for trusted selected product suitability claims", () => {
  const result = validateAgentV2FinalAnswer(
    {
      ...baseAnswer,
      answer_mode: "general_advice",
      request_interpretation: requestInterpretation({
        primary_intent: "general_advice",
        product_request_kind: "product_detail",
        requested_product_count: 1,
        count_policy: "exact",
        evidence_quote: "Passt das zu meinem Frizz?",
        specific_product_candidate: true,
      }),
      tool_grounding: {
        ...baseAnswer.tool_grounding,
        used_guidance_package_ids: requiredGuidanceForAnswer("general_advice", "shampoo"),
        used_product_tool: false,
        product_ids: [],
      },
      payload: {
        user_facing_answer_de:
          "**Syoss Intense Curls Shampoo** passt gut zu deinem Frizz, weil es mild reinigt und nicht beschwert.",
        category_or_topic: "shampoo",
        key_points_de: ["Passt gut zu Frizz."],
        next_step_offer_de: null,
      },
    },
    {
      ...baseValidationContext,
      toolCallHistory: [lookupProductCandidateToolCall()],
      trustedSelectedProductIds: ["prod_1"],
      productLookupResults: [
        {
          status: "found_exact",
          category: "shampoo",
          product: { id: "prod_1", name: "Syoss Intense Curls Shampoo" },
        },
      ],
    },
  )

  assert.equal(result.ok, false)
  assert.ok(result.errors.some((error) => error.validator_id === "product_tool_required"))
})

test("validator allows claim-level hedge for trusted selected product", () => {
  const result = validateAgentV2FinalAnswer(
    {
      ...baseAnswer,
      answer_mode: "general_advice",
      request_interpretation: requestInterpretation({
        primary_intent: "general_advice",
        product_request_kind: "product_detail",
        requested_product_count: 1,
        count_policy: "exact",
        evidence_quote: "Passt das zu meinem Frizz?",
        specific_product_candidate: true,
      }),
      tool_grounding: {
        ...baseAnswer.tool_grounding,
        used_guidance_package_ids: requiredGuidanceForAnswer("general_advice", "shampoo"),
        used_product_tool: true,
        product_ids: ["prod_1"],
      },
      payload: {
        user_facing_answer_de:
          "Die Produktidentität ist klar: **Syoss Intense Curls Shampoo**. Ob es zu deinem Frizz passt, kann ich ohne weitere Produkteigenschaften nicht abschließend bewerten.",
        category_or_topic: "shampoo",
        key_points_de: ["Produkt klar, Fit-Claim nicht ausreichend belegt."],
        next_step_offer_de: null,
      },
    },
    {
      ...baseValidationContext,
      trustedSelectedProductIds: ["prod_1"],
      productLookupResults: [
        {
          status: "found_exact",
          category: "shampoo",
          product: { id: "prod_1", name: "Syoss Intense Curls Shampoo" },
        },
      ],
    },
  )

  assert.equal(
    result.errors.some((error) => error.validator_id === "trusted_product_unverified_caveat"),
    false,
  )
})

test("validator allows claims for exact lookup products when another lookup is unresolved", () => {
  const result = validateAgentV2FinalAnswer(baseAnswer, {
    ...baseValidationContext,
    toolCallHistory: [...baseValidationContext.toolCallHistory, lookupProductCandidateToolCall()],
    productLookupResults: [
      {
        status: "found_exact",
        category: "shampoo",
        product: { id: "prod_1", name: "Test Shampoo" },
      },
      {
        status: "not_found",
        category: "conditioner",
        product: null,
      },
    ],
  })

  assert.equal(
    result.errors.some((error) => error.validator_id === "product_lookup_unresolved"),
    false,
  )
})

test("validator does not let an unresolved mentioned-product lookup block unrelated grounded recommendations", () => {
  const result = validateAgentV2FinalAnswer(
    {
      ...baseAnswer,
      request_interpretation: requestInterpretation({
        primary_intent: "product_recommendation",
        product_request_kind: "specific_products",
        care_category: "conditioner",
        requested_product_count: 1,
        count_policy: "exact",
        evidence_quote: "welchen Conditioner empfiehlst du dazu",
        specific_product_candidate: false,
      }),
      tool_grounding: {
        ...baseAnswer.tool_grounding,
        used_guidance_package_ids: requiredGuidanceForAnswer(
          "product_recommendation",
          "conditioner",
        ),
        product_ids: ["conditioner_1"],
      },
      payload: {
        ...baseAnswer.payload,
        user_facing_answer_de: "**Test Conditioner** ist eine passende Conditioner-Option dazu.",
        recommendations: [
          {
            product_id: "conditioner_1",
            reason_de: "Passt als Conditioner zu deiner Anfrage.",
            usage_de: null,
            caveat_de: null,
          },
        ],
      },
    },
    {
      ...baseValidationContext,
      latestUserMessage:
        "Ich nutze Acme Hydra Glow Shampoo, welchen Conditioner empfiehlst du dazu?",
      recentEvidenceText:
        "Ich nutze Acme Hydra Glow Shampoo, welchen Conditioner empfiehlst du dazu?",
      toolCallHistory: [
        {
          ...lookupProductCandidateToolCall(),
          arguments: {
            category: "shampoo",
            brand_text: "Acme",
            product_name_text: "Hydra Glow Shampoo",
            reason: "User mentioned a shampoo as context for a conditioner ask.",
            evidence_quote: "Acme Hydra Glow Shampoo",
          },
        },
        selectProductsToolCall({
          category: "conditioner",
          reason: "User asks for a conditioner recommendation.",
          user_request: "welchen Conditioner empfiehlst du dazu",
          product_request_kind: "specific_products",
          requested_product_count: 1,
          count_policy: "exact",
          evidence_quote: "welchen Conditioner empfiehlst du dazu",
        }),
      ],
      selectedProductProjections: [
        {
          valid_product_ids: ["conditioner_1"],
          products: [
            {
              product_id: "conditioner_1",
              name: "Test Conditioner",
            },
          ],
        },
      ],
      productLookupResults: [
        {
          status: "not_found",
          category: "shampoo",
          input_identity: {
            category: "shampoo",
            brand_text: "Acme",
            product_name_text: "Hydra Glow Shampoo",
            evidence_quote: "Acme Hydra Glow Shampoo",
          },
          product: null,
        },
      ],
    },
  )

  assert.equal(
    result.errors.some((error) => error.validator_id === "product_lookup_unresolved"),
    false,
  )
})

test("validator blocks named product detail prose after unresolved product lookup", () => {
  const result = validateAgentV2FinalAnswer(
    {
      ...baseAnswer,
      answer_mode: "general_advice",
      request_interpretation: requestInterpretation({
        primary_intent: "product_recommendation",
        product_request_kind: "product_detail",
        requested_product_count: 1,
        count_policy: "exact",
        evidence_quote: "Test Shampoo",
      }),
      tool_grounding: {
        ...baseAnswer.tool_grounding,
        used_guidance_package_ids: requiredGuidanceForAnswer("general_advice", "shampoo"),
        used_product_tool: false,
        product_ids: [],
      },
      payload: {
        user_facing_answer_de: "Test Shampoo passt eher gut zu deinem Profil.",
        category_or_topic: "shampoo",
        key_points_de: ["Es passt eher gut zu deinem Profil."],
        next_step_offer_de: null,
      },
    },
    {
      ...baseValidationContext,
      toolCallHistory: [...baseValidationContext.toolCallHistory, lookupProductCandidateToolCall()],
      productLookupResults: [
        {
          status: "not_found",
          category: "shampoo",
          product: null,
        },
      ],
      namedProductContext: {
        display_name: "Test Shampoo",
        category: "shampoo",
        plausible_exact_name: true,
        named_product_intent: "current_use_product_question",
      },
    },
  )

  assert.equal(result.ok, false)
  assert.ok(result.errors.some((error) => error.validator_id === "product_lookup_unresolved"))
})

test("validator blocks exact named-product property claims after unresolved lookup despite general-advice classification", () => {
  const result = validateAgentV2FinalAnswer(
    placementOnlyAdviceAnswer(
      "Ich benutze Test Shampoo. Passt das zu mir?",
      "Test Shampoo spendet Feuchtigkeit und passt deshalb gut zu deinem Profil.",
    ),
    {
      ...baseValidationContext,
      selectedProductProjections: [],
      latestUserMessage: "Ich benutze Test Shampoo. Passt das zu mir?",
      recentEvidenceText: "Ich benutze Test Shampoo. Passt das zu mir?",
      toolCallHistory: [lookupProductCandidateToolCall()],
      productLookupResults: [
        {
          status: "not_found",
          category: "shampoo",
          product: null,
        },
      ],
      namedProductContext: {
        display_name: "Test Shampoo",
        category: "shampoo",
        plausible_exact_name: true,
        named_product_intent: "current_use_product_question",
      },
    },
  )

  assert.equal(result.ok, false)
  assert.ok(result.errors.some((error) => error.validator_id === "product_lookup_unresolved"))
})

test("validator blocks pronoun product suitability claims after unresolved lookup", () => {
  const result = validateAgentV2FinalAnswer(
    placementOnlyAdviceAnswer(
      "Ich benutze Test Shampoo. Passt das zu mir?",
      "Das Produkt passt gut zu deinem Profil.",
    ),
    {
      ...baseValidationContext,
      selectedProductProjections: [],
      latestUserMessage: "Ich benutze Test Shampoo. Passt das zu mir?",
      recentEvidenceText: "Ich benutze Test Shampoo. Passt das zu mir?",
      toolCallHistory: [lookupProductCandidateToolCall()],
      productLookupResults: [
        {
          status: "not_found",
          category: "shampoo",
          product: null,
        },
      ],
      namedProductContext: {
        display_name: "Test Shampoo",
        category: "shampoo",
        plausible_exact_name: true,
        named_product_intent: "current_use_product_question",
      },
    },
  )

  assert.equal(result.ok, false)
  assert.ok(result.errors.some((error) => error.validator_id === "product_lookup_unresolved"))
})

test("validator blocks pronoun product claims after unresolved lookup with structured input identity", () => {
  const result = validateAgentV2FinalAnswer(
    {
      ...placementOnlyAdviceAnswer(
        "Ich benutze Acme Hydra Glow Shampoo. Passt das zu mir?",
        "Das Shampoo passt gut zu deinem Profil.",
      ),
      request_interpretation: requestInterpretation({
        primary_intent: "general_advice",
        product_request_kind: "none",
        routine_intent: "none",
        care_category: "none",
        requested_product_count: null,
        count_policy: "none",
        evidence_quote: "Passt das zu mir?",
        specific_product_candidate: false,
      }),
    },
    {
      ...baseValidationContext,
      selectedProductProjections: [],
      latestUserMessage: "Ich benutze Acme Hydra Glow Shampoo. Passt das zu mir?",
      recentEvidenceText: "Ich benutze Acme Hydra Glow Shampoo. Passt das zu mir?",
      toolCallHistory: [lookupProductCandidateToolCall()],
      productLookupResults: [
        {
          status: "not_found",
          category: "shampoo",
          input_identity: {
            category: "shampoo",
            brand_text: "Acme",
            product_name_text: "Hydra Glow Shampoo",
            evidence_quote: "Acme Hydra Glow Shampoo",
          },
          product: null,
        },
      ],
      namedProductContext: {
        display_name: "Acme Hydra Glow Shampoo",
        category: "shampoo",
        plausible_exact_name: true,
        named_product_intent: "current_use_product_question",
      },
    },
  )

  assert.equal(result.ok, false)
  assert.ok(result.errors.some((error) => error.validator_id === "product_lookup_unresolved"))
})

test("validator blocks category-term product property claims after unresolved lookup", () => {
  const result = validateAgentV2FinalAnswer(
    placementOnlyAdviceAnswer(
      "Ich benutze Test Conditioner. Passt das zu mir?",
      "Der Conditioner spendet Feuchtigkeit und beschwert nicht.",
    ),
    {
      ...baseValidationContext,
      selectedProductProjections: [],
      latestUserMessage: "Ich benutze Test Conditioner. Passt das zu mir?",
      recentEvidenceText: "Ich benutze Test Conditioner. Passt das zu mir?",
      toolCallHistory: [lookupProductCandidateToolCall()],
      productLookupResults: [
        {
          status: "not_found",
          category: "conditioner",
          product: null,
        },
      ],
      namedProductContext: {
        display_name: "Test Conditioner",
        category: "conditioner",
        plausible_exact_name: true,
        named_product_intent: "current_use_product_question",
      },
    },
  )

  assert.equal(result.ok, false)
  assert.ok(result.errors.some((error) => error.validator_id === "product_lookup_unresolved"))
})

test("validator blocks named-product use claims after unresolved lookup", () => {
  const result = validateAgentV2FinalAnswer(
    placementOnlyAdviceAnswer(
      "Ich benutze Test Shampoo. Passt das zu mir?",
      "Test Shampoo kannst du weiterverwenden.",
    ),
    {
      ...baseValidationContext,
      selectedProductProjections: [],
      latestUserMessage: "Ich benutze Test Shampoo. Passt das zu mir?",
      recentEvidenceText: "Ich benutze Test Shampoo. Passt das zu mir?",
      toolCallHistory: [lookupProductCandidateToolCall()],
      productLookupResults: [
        {
          status: "not_found",
          category: "shampoo",
          product: null,
        },
      ],
      namedProductContext: {
        display_name: "Test Shampoo",
        category: "shampoo",
        plausible_exact_name: true,
        named_product_intent: "current_use_product_question",
      },
    },
  )

  assert.equal(result.ok, false)
  assert.ok(result.errors.some((error) => error.validator_id === "product_lookup_unresolved"))
})

test("validator blocks product-phrase use claims after unresolved lookup", () => {
  const result = validateAgentV2FinalAnswer(
    placementOnlyAdviceAnswer(
      "Ich benutze Test Shampoo. Passt das zu mir?",
      "Das Produkt kannst du weiter nutzen.",
    ),
    {
      ...baseValidationContext,
      selectedProductProjections: [],
      latestUserMessage: "Ich benutze Test Shampoo. Passt das zu mir?",
      recentEvidenceText: "Ich benutze Test Shampoo. Passt das zu mir?",
      toolCallHistory: [lookupProductCandidateToolCall()],
      productLookupResults: [
        {
          status: "not_found",
          category: "shampoo",
          product: null,
        },
      ],
      namedProductContext: {
        display_name: "Test Shampoo",
        category: "shampoo",
        plausible_exact_name: true,
        named_product_intent: "current_use_product_question",
      },
    },
  )

  assert.equal(result.ok, false)
  assert.ok(result.errors.some((error) => error.validator_id === "product_lookup_unresolved"))
})

test("validator blocks pronoun keep claims after unresolved lookup", () => {
  const result = validateAgentV2FinalAnswer(
    placementOnlyAdviceAnswer(
      "Ich benutze Test Shampoo. Passt das zu mir?",
      "Du kannst ihn behalten.",
    ),
    {
      ...baseValidationContext,
      selectedProductProjections: [],
      latestUserMessage: "Ich benutze Test Shampoo. Passt das zu mir?",
      recentEvidenceText: "Ich benutze Test Shampoo. Passt das zu mir?",
      toolCallHistory: [lookupProductCandidateToolCall()],
      productLookupResults: [
        {
          status: "not_found",
          category: "shampoo",
          product: null,
        },
      ],
      namedProductContext: {
        display_name: "Test Shampoo",
        category: "shampoo",
        plausible_exact_name: true,
        named_product_intent: "current_use_product_question",
      },
    },
  )

  assert.equal(result.ok, false)
  assert.ok(result.errors.some((error) => error.validator_id === "product_lookup_unresolved"))
})

test("validator blocks category-term routine keep claims after unresolved lookup", () => {
  const result = validateAgentV2FinalAnswer(
    placementOnlyAdviceAnswer(
      "Ich benutze Test Conditioner. Passt das zu mir?",
      "Den Conditioner kannst du in der Routine lassen.",
    ),
    {
      ...baseValidationContext,
      selectedProductProjections: [],
      latestUserMessage: "Ich benutze Test Conditioner. Passt das zu mir?",
      recentEvidenceText: "Ich benutze Test Conditioner. Passt das zu mir?",
      toolCallHistory: [lookupProductCandidateToolCall()],
      productLookupResults: [
        {
          status: "not_found",
          category: "conditioner",
          product: null,
        },
      ],
      namedProductContext: {
        display_name: "Test Conditioner",
        category: "conditioner",
        plausible_exact_name: true,
        named_product_intent: "current_use_product_question",
      },
    },
  )

  assert.equal(result.ok, false)
  assert.ok(result.errors.some((error) => error.validator_id === "product_lookup_unresolved"))
})

test("validator allows generic category context after unresolved lookup", () => {
  const result = validateAgentV2FinalAnswer(
    placementOnlyAdviceAnswer(
      "Ich benutze Test Conditioner. Passt das zu mir?",
      "Allgemein gilt: Conditioner können Längen pflegen; das konkrete Produkt bewerte ich ohne Treffer nicht.",
    ),
    {
      ...baseValidationContext,
      selectedProductProjections: [],
      latestUserMessage: "Ich benutze Test Conditioner. Passt das zu mir?",
      recentEvidenceText: "Ich benutze Test Conditioner. Passt das zu mir?",
      toolCallHistory: [lookupProductCandidateToolCall()],
      productLookupResults: [
        {
          status: "not_found",
          category: "conditioner",
          product: null,
        },
      ],
      namedProductContext: {
        display_name: "Test Conditioner",
        category: "conditioner",
        plausible_exact_name: true,
        named_product_intent: "current_use_product_question",
      },
    },
  )

  assert.equal(result.ok, true, JSON.stringify(result.errors, null, 2))
})

test("validator blocks personalized category suitability after unresolved intake-card lookup", () => {
  const result = validateAgentV2FinalAnswer(
    placementOnlyAdviceAnswer(
      "Ich benutze Jean & Len Conditioner Granatapfel. Passt das zu mir?",
      "Jean & Len Conditioner Granatapfel kann ich nicht sicher beurteilen. Für dein feines, welliges Haar wäre grundsätzlich eher ein leichter bis mittelgewichtiger Conditioner passend.",
    ),
    {
      ...baseValidationContext,
      selectedProductProjections: [],
      latestUserMessage: "Ich benutze Jean & Len Conditioner Granatapfel. Passt das zu mir?",
      recentEvidenceText: "Ich benutze Jean & Len Conditioner Granatapfel. Passt das zu mir?",
      toolCallHistory: [lookupProductCandidateToolCall()],
      productLookupResults: [
        {
          status: "not_found",
          category: "conditioner",
          product: null,
        },
      ],
      namedProductContext: {
        display_name: "Jean & Len Conditioner Granatapfel",
        category: "conditioner",
        plausible_exact_name: true,
        named_product_intent: "current_use_product_question",
      },
    },
  )

  assert.equal(result.ok, false)
  assert.ok(result.errors.some((error) => error.validator_id === "product_lookup_unresolved"))
})

test("validator allows cautious product deferrals after unresolved lookup", () => {
  const result = validateAgentV2FinalAnswer(
    placementOnlyAdviceAnswer(
      "Ich benutze Test Shampoo. Passt das zu mir?",
      "Ich bewerte das Produkt ohne Treffer nicht.",
    ),
    {
      ...baseValidationContext,
      selectedProductProjections: [],
      latestUserMessage: "Ich benutze Test Shampoo. Passt das zu mir?",
      recentEvidenceText: "Ich benutze Test Shampoo. Passt das zu mir?",
      toolCallHistory: [lookupProductCandidateToolCall()],
      productLookupResults: [
        {
          status: "not_found",
          category: "shampoo",
          product: null,
        },
      ],
      namedProductContext: {
        display_name: "Test Shampoo",
        category: "shampoo",
        plausible_exact_name: true,
        named_product_intent: "current_use_product_question",
      },
    },
  )

  assert.equal(result.ok, true)
})

const categoryTermClaimCases = [
  { category: "shampoo", term: "Shampoo" },
  { category: "conditioner", term: "Conditioner" },
  { category: "mask", term: "Maske" },
  { category: "leave_in", term: "Leave-in" },
  { category: "oil", term: "Öl" },
  { category: "bondbuilder", term: "Bondbuilder" },
  { category: "deep_cleansing_shampoo", term: "Tiefenreinigungsshampoo" },
  { category: "dry_shampoo", term: "Trockenshampoo" },
  { category: "peeling", term: "Peeling" },
] as const

for (const testCase of categoryTermClaimCases) {
  test(`validator covers unresolved category-term use claims for ${testCase.category}`, () => {
    const result = validateAgentV2FinalAnswer(
      placementOnlyAdviceAnswer(
        `Ich benutze Test ${testCase.term}. Passt das zu mir?`,
        `Den ${testCase.term} kannst du weiterverwenden.`,
      ),
      {
        ...baseValidationContext,
        selectedProductProjections: [],
        latestUserMessage: `Ich benutze Test ${testCase.term}. Passt das zu mir?`,
        recentEvidenceText: `Ich benutze Test ${testCase.term}. Passt das zu mir?`,
        toolCallHistory: [lookupProductCandidateToolCall()],
        productLookupResults: [
          {
            status: "not_found",
            category: testCase.category,
            product: null,
          },
        ],
        namedProductContext: {
          display_name: `Test ${testCase.term}`,
          category: testCase.category,
          plausible_exact_name: true,
          named_product_intent: "current_use_product_question",
        },
      },
    )

    assert.equal(result.ok, false)
    assert.ok(result.errors.some((error) => error.validator_id === "product_lookup_unresolved"))
  })
}

test("validator allows constraint-blocked deferral after unresolved product lookup", () => {
  const result = validateAgentV2FinalAnswer(
    {
      ...baseAnswer,
      answer_mode: "constraint_blocked",
      request_interpretation: requestInterpretation({
        primary_intent: "product_recommendation",
        product_request_kind: "product_detail",
        requested_product_count: 1,
        count_policy: "exact",
        evidence_quote: "Test Shampoo",
      }),
      tool_grounding: {
        ...baseAnswer.tool_grounding,
        used_guidance_package_ids: requiredGuidanceForAnswer("general_advice", "shampoo"),
        used_product_tool: false,
        product_ids: [],
      },
      payload: {
        user_facing_answer_de: "Ich habe Test Shampoo noch nicht als verifizierten Katalogtreffer.",
        blocking_constraints: ["product_not_verified"],
        safe_alternative_de: "Du kannst es zur Produktprüfung hinzufügen.",
      },
    },
    {
      ...baseValidationContext,
      toolCallHistory: [...baseValidationContext.toolCallHistory, lookupProductCandidateToolCall()],
      productLookupResults: [
        {
          status: "not_found",
          category: "shampoo",
          product: null,
        },
      ],
      namedProductContext: {
        display_name: "Test Shampoo",
        category: "shampoo",
        plausible_exact_name: true,
        named_product_intent: "current_use_product_question",
      },
    },
  )

  assert.equal(
    result.errors.some((error) => error.validator_id === "product_lookup_unresolved"),
    false,
  )
})

test("AgentV2 validator blocks visible prose offers without structured pending follow-up action", () => {
  const answer = {
    ...baseAnswer,
    request_interpretation: requestInterpretation({
      care_category: "leave_in",
      evidence_quote: "leichtes Leave-in gegen Frizz",
    }),
    tool_grounding: {
      ...baseAnswer.tool_grounding,
      used_guidance_package_ids: requiredGuidanceForAnswer("product_recommendation", "leave_in"),
      product_ids: ["prod_1"],
      hard_rule_ids: [],
    },
    payload: {
      ...baseAnswer.payload,
      user_facing_answer_de:
        "**Test Leave-in** passt gut gegen Frizz. Soll ich dir die Anwendung jetzt kurz erklären?",
      next_step_offer_de: null,
    },
    pending_followup_action: null,
  }

  const result = validateAgentV2FinalAnswer(answer, {
    ...baseValidationContext,
    selectedProductProjections: [
      {
        valid_product_ids: ["prod_1"],
        products: [{ product_id: "prod_1", name: "Test Leave-in" }],
      },
    ],
    latestUserMessage: "Ich brauche ein leichtes Leave-in gegen Frizz.",
    recentEvidenceText: "leichtes Leave-in gegen Frizz",
    toolCallHistory: [selectProductsToolCall({ category: "leave_in" })],
    knownHardRuleIds: [],
  })

  assert.equal(result.ok, false)
  const error = result.errors.find(
    (finding) => finding.validator_id === "pending_followup_action_missing",
  )
  assert.ok(error)
  assert.equal(error.expected, "pending_followup_action.kind=advisor_response")
  assert.equal(error.rejected_value, "Soll ich dir die Anwendung jetzt kurz erklären?")
})

test("AgentV2 validator checks visible prose offers even when next_step_offer_de is non-confirmable", () => {
  const answer = createValidGeneralAdviceAnswer({
    request_interpretation: requestInterpretation({
      primary_intent: "category_education",
      product_request_kind: "category_education",
      routine_intent: "none",
      care_category: "mask",
      requested_product_count: null,
      count_policy: "none",
      evidence_quote: "Maske",
    }),
    payload: {
      user_facing_answer_de:
        "Eine Maske ist bei trockenem Haar eher Zusatzpflege. Soll ich dir danach passende Masken empfehlen?",
      category_or_topic: "mask",
      key_points_de: ["Masken sind Zusatzpflege."],
      next_step_offer_de: "Danach kannst du zur Routine zurückgehen.",
    },
    pending_followup_action: null,
  })

  const result = validateAgentV2FinalAnswer(answer, {
    ...baseValidationContext,
    selectedProductProjections: [],
    latestUserMessage: "Maske",
    recentEvidenceText: "Maske",
    toolCallHistory: [],
    knownHardRuleIds: [],
  })

  assert.equal(result.ok, false)
  const error = result.errors.find(
    (finding) => finding.validator_id === "pending_followup_action_missing",
  )
  assert.ok(error)
  assert.equal(error.expected, "pending_followup_action.kind=product_recommendation")
  assert.equal(error.rejected_value, "Soll ich dir danach passende Masken empfehlen?")
})

test("validator blocks social answers that claim a specific product candidate", () => {
  const result = validateAgentV2FinalAnswer(
    socialAnswer({
      request_interpretation: requestInterpretation({
        primary_intent: "smalltalk",
        product_request_kind: "none",
        routine_intent: "none",
        care_category: "none",
        requested_product_count: null,
        count_policy: "none",
        evidence_quote: "hallo",
        specific_product_candidate: true,
        confidence: 0.9,
      }),
    }),
    {
      ...baseValidationContext,
      latestUserMessage: "hallo",
      recentEvidenceText: "hallo",
      toolCallHistory: [{ name: "classify_turn_gate" }],
      turnGate: {
        gate_status: "social",
        evidence_quote: "hallo",
        confidence: 0.9,
        boundary_kind: null,
      },
    },
  )

  assert.equal(result.ok, false)
  assert.ok(
    result.errors.some((error) => error.validator_id === "request_interpretation_answer_mode"),
  )
})

test("AgentV2 validator does not treat plain Ich-kann answer openers as follow-up offers", () => {
  const answer = createValidGeneralAdviceAnswer({
    request_interpretation: requestInterpretation({
      primary_intent: "category_education",
      product_request_kind: "category_education",
      routine_intent: "none",
      care_category: "mask",
      requested_product_count: null,
      count_policy: "none",
      evidence_quote: "Brauche ich eine Maske?",
    }),
    payload: {
      user_facing_answer_de:
        "Ich kann dir das grob einordnen: Eine Maske ist ein Zusatz, kein Pflichtschritt.",
      category_or_topic: "mask",
      key_points_de: ["Masken sind Zusatzpflege."],
      next_step_offer_de: null,
    },
    pending_followup_action: null,
  })

  const result = validateAgentV2FinalAnswer(answer, {
    ...baseValidationContext,
    selectedProductProjections: [],
    latestUserMessage: "Brauche ich eine Maske?",
    recentEvidenceText: "Maske",
    toolCallHistory: [],
    knownHardRuleIds: [],
  })

  assert.equal(result.ok, true, JSON.stringify(result.errors, null, 2))
})

test("AgentV2 validator blocks visible prose offers with first-person action verbs", () => {
  const answer = createValidGeneralAdviceAnswer({
    request_interpretation: requestInterpretation({
      primary_intent: "category_education",
      product_request_kind: "category_education",
      routine_intent: "none",
      care_category: "leave_in",
      requested_product_count: null,
      count_policy: "none",
      evidence_quote: "Leave-in",
    }),
    payload: {
      user_facing_answer_de:
        "Ein Leave-in kann gegen Frizz sinnvoll sein. Ich erkläre dir die Anwendung gerne.",
      category_or_topic: "leave_in",
      key_points_de: ["Leave-in kann Frizz optisch beruhigen."],
      next_step_offer_de: null,
    },
    pending_followup_action: null,
  })

  const result = validateAgentV2FinalAnswer(answer, {
    ...baseValidationContext,
    selectedProductProjections: [],
    latestUserMessage: "Leave-in",
    recentEvidenceText: "Leave-in",
    toolCallHistory: [],
    knownHardRuleIds: [],
  })

  assert.equal(result.ok, false)
  const error = result.errors.find(
    (finding) => finding.validator_id === "pending_followup_action_missing",
  )
  assert.ok(error)
  assert.equal(error.rejected_value, "Ich erkläre dir die Anwendung gerne.")
})

test("AgentV2 validator does not treat direct recommendations as follow-up offers", () => {
  const answer = createValidGeneralAdviceAnswer({
    request_interpretation: requestInterpretation({
      primary_intent: "category_education",
      product_request_kind: "category_education",
      routine_intent: "none",
      care_category: "leave_in",
      requested_product_count: null,
      count_policy: "none",
      evidence_quote: "Leave-in",
    }),
    payload: {
      user_facing_answer_de:
        "Ich empfehle dir bei Frizz zuerst ein leichtes Leave-in als Kategorie, nicht sofort mehrere Styling-Produkte.",
      category_or_topic: "leave_in",
      key_points_de: ["Leichtes Leave-in passt oft besser als schwere Styling-Produkte."],
      next_step_offer_de: null,
    },
    tool_grounding: {
      ...createValidGeneralAdviceAnswer().tool_grounding,
      used_guidance_package_ids: requiredGuidanceForAnswer("general_advice", "leave_in"),
    },
    pending_followup_action: null,
  })

  const result = validateAgentV2FinalAnswer(answer, {
    ...baseValidationContext,
    selectedProductProjections: [],
    latestUserMessage: "Leave-in",
    recentEvidenceText: "Leave-in",
    toolCallHistory: [],
    knownHardRuleIds: [],
  })

  assert.equal(result.ok, true, JSON.stringify(result.errors, null, 2))
})

test("AgentV2 validator allows informational next step without pending follow-up action", () => {
  const answer = createValidGeneralAdviceAnswer({
    request_interpretation: requestInterpretation({
      primary_intent: "category_education",
      product_request_kind: "category_education",
      routine_intent: "none",
      care_category: "mask",
      requested_product_count: null,
      count_policy: "none",
      evidence_quote: "Maske",
    }),
    payload: {
      user_facing_answer_de:
        "Eine Maske kann sinnvoll sein. Danach kannst du zur Routine zurückgehen.",
      category_or_topic: "mask",
      key_points_de: ["Optionaler Zusatz."],
      next_step_offer_de: "Danach kannst du zur Routine zurückgehen.",
    },
    pending_followup_action: null,
  })

  const result = validateAgentV2FinalAnswer(answer, {
    ...baseValidationContext,
    selectedProductProjections: [],
    latestUserMessage: "Maske",
    recentEvidenceText: "Maske",
    toolCallHistory: [],
    knownHardRuleIds: [],
  })

  assert.equal(result.ok, true, JSON.stringify(result.errors, null, 2))
})

test("AgentV2 validator blocks hidden pending action behind informational next step", () => {
  const answer = createValidGeneralAdviceAnswer({
    payload: {
      user_facing_answer_de:
        "Eine Maske kann sinnvoll sein. Danach kannst du zur Routine zurückgehen.",
      category_or_topic: "mask",
      key_points_de: ["Optionaler Zusatz."],
      next_step_offer_de: "Danach kannst du zur Routine zurückgehen.",
    },
    pending_followup_action: {
      kind: "advisor_response",
      category: "mask",
      routine_layer: "basics",
      routine_action: null,
      source: "assistant_offer",
    },
  })

  const result = validateAgentV2FinalAnswer(answer, {
    ...baseValidationContext,
    selectedProductProjections: [],
    latestUserMessage: "Maske",
    recentEvidenceText: "Maske",
    toolCallHistory: [],
    knownHardRuleIds: [],
  })

  assert.equal(result.ok, false)
  assert.ok(
    result.errors.some((error) => error.validator_id === "pending_followup_action_hidden"),
    JSON.stringify(result.errors, null, 2),
  )
})

test("AgentV2 validator blocks hidden pending follow-up actions without visible offer", () => {
  const answer = createValidGeneralAdviceAnswer({
    payload: {
      user_facing_answer_de: "Eine Maske kann sinnvoll sein.",
      category_or_topic: "mask",
      key_points_de: ["Optionaler Zusatz."],
      next_step_offer_de: null,
    },
    pending_followup_action: {
      kind: "routine_mutation",
      category: "mask",
      routine_layer: "basics",
      routine_action: "add_step",
      source: "assistant_offer",
    },
  })

  const result = validateAgentV2FinalAnswer(answer, {
    ...baseValidationContext,
    selectedProductProjections: [],
    latestUserMessage: "Maske",
    recentEvidenceText: "Maske",
    toolCallHistory: [],
    knownHardRuleIds: [],
  })

  assert.equal(result.ok, false)
  assert.ok(result.errors.some((error) => error.validator_id === "pending_followup_action_hidden"))
})

test("AgentV2 validator blocks next-step offers that are not rendered in the visible answer", () => {
  const answer = createValidGeneralAdviceAnswer({
    payload: {
      user_facing_answer_de: "Eine Maske kann sinnvoll sein.",
      category_or_topic: "mask",
      key_points_de: ["Optionaler Zusatz."],
      next_step_offer_de: "Ich kann dir danach konkrete Masken empfehlen.",
    },
    pending_followup_action: {
      kind: "product_recommendation",
      category: "mask",
      routine_layer: null,
      routine_action: null,
      source: "assistant_offer",
    },
  })

  const result = validateAgentV2FinalAnswer(answer, {
    ...baseValidationContext,
    selectedProductProjections: [],
    latestUserMessage: "Maske",
    recentEvidenceText: "Maske",
    toolCallHistory: [],
    knownHardRuleIds: [],
  })

  assert.equal(result.ok, false)
  assert.ok(result.errors.some((error) => error.validator_id === "visible_payload_not_rendered"))
})

test("AgentV2 validator blocks visible product offers stored as advisor follow-up actions", () => {
  const answer = createValidGeneralAdviceAnswer({
    request_interpretation: requestInterpretation({
      primary_intent: "category_education",
      product_request_kind: "category_education",
      routine_intent: "none",
      care_category: "leave_in",
      requested_product_count: null,
      count_policy: "none",
      evidence_quote: "Leave-in",
    }),
    payload: {
      user_facing_answer_de:
        "Ein Leave-in kann bei dir gut passen. Soll ich dir passende Leave-ins empfehlen?",
      category_or_topic: "leave_in",
      key_points_de: ["Leave-in kann als Booster helfen."],
      next_step_offer_de: "Soll ich dir passende Leave-ins empfehlen?",
    },
    pending_followup_action: {
      kind: "advisor_response",
      category: "none",
      routine_layer: "basics",
      routine_action: null,
      source: "assistant_offer",
    },
  })

  const result = validateAgentV2FinalAnswer(answer, {
    ...baseValidationContext,
    selectedProductProjections: [],
    latestUserMessage: "Erklär mir, warum Leave-in passt.",
    recentEvidenceText: "Leave-in",
    toolCallHistory: [],
    knownHardRuleIds: [],
  })

  assert.equal(result.ok, false)
  const error = result.errors.find(
    (finding) => finding.validator_id === "pending_followup_action_kind_mismatch",
  )
  assert.ok(error)
  assert.equal(error.reason_code, "pending_followup_action_kind_mismatch")
  assert.equal(error.expected, "pending_followup_action.kind=product_recommendation")
  assert.match(error.repair_hint ?? "", /product_recommendation/)
})

test("AgentV2 validator accepts visible product offers with matching pending product action", () => {
  const answer = createValidGeneralAdviceAnswer({
    request_interpretation: requestInterpretation({
      primary_intent: "category_education",
      product_request_kind: "category_education",
      routine_intent: "none",
      care_category: "leave_in",
      requested_product_count: null,
      count_policy: "none",
      evidence_quote: "Leave-in",
    }),
    payload: {
      user_facing_answer_de:
        "Ein Leave-in kann bei dir gut passen. Wenn du möchtest, empfehle ich dir passende Leave-ins.",
      category_or_topic: "leave_in",
      key_points_de: ["Leave-in kann als Booster helfen."],
      next_step_offer_de: "Wenn du möchtest, empfehle ich dir passende Leave-ins.",
    },
    tool_grounding: {
      used_guidance_package_ids: requiredGuidanceForAnswer("general_advice", "leave_in"),
      used_product_tool: false,
      used_routine_tool: false,
      product_ids: [],
      routine_step_ids: [],
      hard_rule_ids: [],
    },
    pending_followup_action: {
      kind: "product_recommendation",
      category: "leave_in",
      routine_layer: null,
      routine_action: null,
      source: "assistant_offer",
    },
  })

  const result = validateAgentV2FinalAnswer(answer, {
    ...baseValidationContext,
    selectedProductProjections: [],
    latestUserMessage: "Erklär mir, warum Leave-in passt.",
    recentEvidenceText: "Leave-in",
    toolCallHistory: [],
    knownHardRuleIds: [],
  })

  assert.equal(result.ok, true, JSON.stringify(result.errors, null, 2))
})

test("AgentV2 validator blocks visible routine mutation offers stored as advisor follow-up actions", () => {
  const answer = createValidGeneralAdviceAnswer({
    request_interpretation: requestInterpretation({
      primary_intent: "category_education",
      product_request_kind: "category_education",
      routine_intent: "none",
      care_category: "mask",
      requested_product_count: null,
      count_policy: "none",
      evidence_quote: "Maske",
    }),
    payload: {
      user_facing_answer_de:
        "Eine Maske wäre eher ein optionaler Zusatz. Wenn du möchtest, kann ich sie in deine Routine einbauen.",
      category_or_topic: "mask",
      key_points_de: ["Maske ist ein optionaler Zusatz."],
      next_step_offer_de: "Wenn du möchtest, kann ich sie in deine Routine einbauen.",
    },
    pending_followup_action: {
      kind: "advisor_response",
      category: "mask",
      routine_layer: "basics",
      routine_action: null,
      source: "assistant_offer",
    },
  })

  const result = validateAgentV2FinalAnswer(answer, {
    ...baseValidationContext,
    selectedProductProjections: [],
    latestUserMessage: "Ist eine Maske sinnvoll?",
    recentEvidenceText: "Ist eine Maske sinnvoll?",
    toolCallHistory: [],
    knownHardRuleIds: [],
  })

  assert.equal(result.ok, false)
  assert.ok(
    result.errors.some((error) => error.validator_id === "pending_followup_action_kind_mismatch"),
  )
})

test("AgentV2 validator accepts product-worded routine mutation offers", () => {
  const answer = createValidGeneralAdviceAnswer({
    request_interpretation: requestInterpretation({
      primary_intent: "category_education",
      product_request_kind: "category_education",
      routine_intent: "none",
      care_category: "leave_in",
      requested_product_count: null,
      count_policy: "none",
      evidence_quote: "Leave-in",
    }),
    payload: {
      user_facing_answer_de:
        "Das Produkt passt eher als leichter Zusatz. Soll ich das Produkt in deine Routine einbauen?",
      category_or_topic: "leave_in",
      key_points_de: ["Der Zusatz sollte leicht bleiben."],
      next_step_offer_de: "Soll ich das Produkt in deine Routine einbauen?",
    },
    tool_grounding: {
      used_guidance_package_ids: requiredGuidanceForAnswer("general_advice", "leave_in"),
      used_product_tool: false,
      used_routine_tool: false,
      product_ids: [],
      routine_step_ids: [],
      hard_rule_ids: [],
    },
    pending_followup_action: {
      kind: "routine_mutation",
      category: "leave_in",
      routine_layer: "basics",
      routine_action: "add_step",
      source: "assistant_offer",
    },
  })

  const result = validateAgentV2FinalAnswer(answer, {
    ...baseValidationContext,
    selectedProductProjections: [],
    latestUserMessage: "Ist dieses Leave-in sinnvoll?",
    recentEvidenceText: "Leave-in",
    toolCallHistory: [],
    knownHardRuleIds: [],
  })

  assert.equal(result.ok, true, JSON.stringify(result.errors, null, 2))
})

test("AgentV2 validator blocks advice-style routine offers stored as routine mutations", () => {
  const answer = createValidGeneralAdviceAnswer({
    request_interpretation: requestInterpretation({
      primary_intent: "category_education",
      product_request_kind: "category_education",
      routine_intent: "none",
      care_category: "leave_in",
      requested_product_count: null,
      count_policy: "none",
      evidence_quote: "Leave-in",
    }),
    payload: {
      user_facing_answer_de:
        "Das Leave-in kann als leichter Zusatz sinnvoll sein. Ich kann dir zeigen, wie du es in deine Routine einbaust.",
      category_or_topic: "leave_in",
      key_points_de: ["Der Zusatz sollte leicht bleiben."],
      next_step_offer_de: "Ich kann dir zeigen, wie du es in deine Routine einbaust.",
    },
    tool_grounding: {
      used_guidance_package_ids: requiredGuidanceForAnswer("general_advice", "leave_in"),
      used_product_tool: false,
      used_routine_tool: false,
      product_ids: [],
      routine_step_ids: [],
      hard_rule_ids: [],
    },
    pending_followup_action: {
      kind: "routine_mutation",
      category: "leave_in",
      routine_layer: "basics",
      routine_action: "add_step",
      source: "assistant_offer",
    },
  })

  const result = validateAgentV2FinalAnswer(answer, {
    ...baseValidationContext,
    selectedProductProjections: [],
    latestUserMessage: "Ist dieses Leave-in sinnvoll?",
    recentEvidenceText: "Leave-in",
    toolCallHistory: [],
    knownHardRuleIds: [],
  })

  assert.equal(result.ok, false)
  const error = result.errors.find(
    (finding) => finding.validator_id === "pending_followup_action_kind_mismatch",
  )
  assert.ok(error, JSON.stringify(result.errors, null, 2))
  assert.equal(error.reason_code, "pending_followup_action_kind_mismatch")
  assert.equal(error.expected, "pending_followup_action.kind=advisor_response")
  assert.match(error.repair_hint ?? "", /advisor_response/)
})

test("AgentV2 validator blocks routine mutation category drift from visible offers", () => {
  const answer = createValidGeneralAdviceAnswer({
    request_interpretation: requestInterpretation({
      primary_intent: "category_education",
      product_request_kind: "category_education",
      routine_intent: "none",
      care_category: "mask",
      requested_product_count: null,
      count_policy: "none",
      evidence_quote: "Maske",
    }),
    payload: {
      user_facing_answer_de:
        "Eine Maske wäre eher ein optionaler Zusatz. Soll ich die Maske in deine Routine einbauen?",
      category_or_topic: "mask",
      key_points_de: ["Maske ist ein optionaler Zusatz."],
      next_step_offer_de: "Soll ich die Maske in deine Routine einbauen?",
    },
    pending_followup_action: {
      kind: "routine_mutation",
      category: "leave_in",
      routine_layer: "basics",
      routine_action: "add_step",
      source: "assistant_offer",
    },
  })

  const result = validateAgentV2FinalAnswer(answer, {
    ...baseValidationContext,
    selectedProductProjections: [],
    latestUserMessage: "Ist eine Maske sinnvoll?",
    recentEvidenceText: "Maske",
    toolCallHistory: [],
    knownHardRuleIds: [],
  })

  assert.equal(result.ok, false)
  assert.ok(
    result.errors.some(
      (error) => error.validator_id === "pending_followup_action_category_mismatch",
    ),
    JSON.stringify(result.errors, null, 2),
  )
})

test("AgentV2 validator does not count mirrored next-step offer as a second visible question", () => {
  const answer = createValidGeneralAdviceAnswer({
    request_interpretation: requestInterpretation({
      primary_intent: "category_education",
      product_request_kind: "category_education",
      routine_intent: "none",
      care_category: "mask",
      requested_product_count: null,
      count_policy: "none",
      evidence_quote: "ob eine Maske bei mir sinnvoll wäre",
    }),
    tool_grounding: {
      used_guidance_package_ids: requiredGuidanceForAnswer("general_advice", "mask"),
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
      category: null,
      return_path: ["basics"],
    },
    payload: {
      user_facing_answer_de:
        "Eine Maske kann bei dir sinnvoll sein, aber eher als gelegentliche Zusatzpflege.\n\nSoll ich sie in deine Routine einbauen?",
      category_or_topic: "Haarmaske",
      key_points_de: ["Maske ist Zusatzpflege, nicht Conditioner-Ersatz."],
      next_step_offer_de: "Soll ich sie in deine Routine einbauen?",
    },
    pending_followup_action: {
      kind: "routine_mutation",
      category: "mask",
      routine_layer: "basics",
      routine_action: "add_step",
      source: "assistant_offer",
    },
  })

  const result = validateAgentV2FinalAnswer(answer, {
    ...baseValidationContext,
    selectedProductProjections: [],
    latestUserMessage:
      "Ich überlege, ob eine Maske bei mir sinnvoll wäre. Frag mich, ob du sie in meine Routine einbauen sollst.",
    recentEvidenceText:
      "Ich überlege, ob eine Maske bei mir sinnvoll wäre. Frag mich, ob du sie in meine Routine einbauen sollst.",
    toolCallHistory: [],
    routineThreadContext: {
      active: true,
      current_layer: "basics",
      last_answer_mode: "routine",
      last_routine_categories: ["shampoo", "conditioner", "leave_in"],
      last_user_goal: "einfache Routine",
      summary_de: "Einfache Basisroutine mit Shampoo, Conditioner und Leave-in.",
      visible_steps: [
        {
          step_id: "base-shampoo",
          label_de: "Shampoo",
          category: "shampoo",
          order: 1,
          routine_layer: "basics",
        },
      ],
      pending_followup_action: null,
    },
    currentRoutineLayer: "basics",
    requiredGuidancePackageIds: [],
    knownHardRuleIds: [],
  })

  assert.equal(result.ok, true, JSON.stringify(result.errors, null, 2))
})

test("AgentV2 validator schema blocks routine action fields on product follow-up actions", () => {
  const answer = createValidGeneralAdviceAnswer({
    payload: {
      user_facing_answer_de: "Eine Maske kann sinnvoll sein.",
      category_or_topic: "mask",
      key_points_de: ["Optionaler Zusatz."],
      next_step_offer_de: "Ich kann dir danach konkrete Masken empfehlen.",
    },
    pending_followup_action: {
      kind: "product_recommendation",
      category: "mask",
      routine_layer: "basics",
      routine_action: "add_step",
      source: "assistant_offer",
    },
  })

  const result = validateAgentV2FinalAnswer(answer, {
    ...baseValidationContext,
    selectedProductProjections: [],
    latestUserMessage: "Maske",
    recentEvidenceText: "Maske",
    toolCallHistory: [],
    knownHardRuleIds: [],
  })

  assert.equal(result.ok, false)
  assert.ok(
    result.errors.some((error) => error.validator_id === "terminal_schema"),
    JSON.stringify(result.errors, null, 2),
  )
})

test("AgentV2 validator schema blocks routine action fields on advisor follow-up actions", () => {
  const answer = createValidGeneralAdviceAnswer({
    request_interpretation: requestInterpretation({
      primary_intent: "routine_explanation",
      product_request_kind: "none",
      routine_intent: "none",
      care_category: "none",
      requested_product_count: null,
      count_policy: "none",
      evidence_quote: "Routine und Feuchtigkeit",
    }),
    payload: {
      user_facing_answer_de:
        "Mehr Feuchtigkeit erreichst du vor allem über sanftere Reinigung und passende Pflegeabstände.\n\nAls Nächstes kann ich dir die Feuchtigkeitslogik deiner Routine erklären.",
      category_or_topic: "routine_hydration",
      key_points_de: ["Mehr Feuchtigkeit braucht nicht automatisch einen neuen Routine-Schritt."],
      next_step_offer_de:
        "Als Nächstes kann ich dir die Feuchtigkeitslogik deiner Routine erklären.",
    },
    pending_followup_action: {
      kind: "advisor_response",
      category: "none",
      routine_layer: "basics",
      routine_action: "create",
      source: "assistant_offer",
    },
  })

  const result = validateAgentV2FinalAnswer(answer, {
    ...baseValidationContext,
    selectedProductProjections: [],
    latestUserMessage: "Wie bekomme ich mehr Feuchtigkeit in meine Routine?",
    recentEvidenceText: "Routine und Feuchtigkeit",
    toolCallHistory: [],
    knownHardRuleIds: [],
  })

  assert.equal(result.ok, false)
  assert.ok(
    result.errors.some((error) => error.validator_id === "terminal_schema"),
    JSON.stringify(result.errors, null, 2),
  )
})

test("AgentV2 validator schema blocks routine mutation follow-up without routine action", () => {
  const answer = createValidGeneralAdviceAnswer({
    payload: {
      user_facing_answer_de: "Eine Maske kann sinnvoll sein.",
      category_or_topic: "mask",
      key_points_de: ["Optionaler Zusatz."],
      next_step_offer_de: "Ich kann danach deine Routine anpassen.",
    },
    pending_followup_action: {
      kind: "routine_mutation",
      category: "mask",
      routine_layer: "basics",
      routine_action: null,
      source: "assistant_offer",
    },
  })

  const result = validateAgentV2FinalAnswer(answer, {
    ...baseValidationContext,
    selectedProductProjections: [],
    latestUserMessage: "Maske",
    recentEvidenceText: "Maske",
    toolCallHistory: [],
    knownHardRuleIds: [],
  })

  assert.equal(result.ok, false)
  assert.ok(
    result.errors.some((error) => error.validator_id === "terminal_schema"),
    JSON.stringify(result.errors, null, 2),
  )
})

test("validator accepts social and domain-boundary answers when gate-consistent", () => {
  const social = validateAgentV2FinalAnswer(
    socialAnswer({
      tool_grounding: {
        ...socialAnswer().tool_grounding,
        used_guidance_package_ids: [],
      },
    }),
    {
      ...baseValidationContext,
      selectedProductProjections: [],
      latestUserMessage: "hallo",
      recentEvidenceText: "hallo",
      toolCallHistory: [{ name: "classify_turn_gate" }],
      knownHardRuleIds: [],
      turnGate: {
        gate_status: "social",
        evidence_quote: "hallo",
        confidence: 0.9,
        boundary_kind: null,
      },
    },
  )
  const boundary = validateAgentV2FinalAnswer(
    domainBoundaryAnswer({
      tool_grounding: {
        ...domainBoundaryAnswer().tool_grounding,
        used_guidance_package_ids: [],
      },
    }),
    {
      ...baseValidationContext,
      selectedProductProjections: [],
      latestUserMessage: "welchen nagellack soll ich kaufen?",
      recentEvidenceText: "welchen nagellack soll ich kaufen?",
      toolCallHistory: [{ name: "classify_turn_gate" }],
      knownHardRuleIds: [],
      turnGate: {
        gate_status: "domain_boundary",
        evidence_quote: "welchen nagellack soll ich kaufen?",
        confidence: 0.9,
        boundary_kind: "unsupported_domain",
      },
    },
  )

  assert.equal(social.ok, true)
  assert.equal(boundary.ok, true)
})

test("validator blocks social and domain-boundary answers without an authorized gate", () => {
  const social = validateAgentV2FinalAnswer(socialAnswer(), {
    ...baseValidationContext,
    selectedProductProjections: [],
    latestUserMessage: "hallo",
    recentEvidenceText: "hallo",
    toolCallHistory: [],
    knownHardRuleIds: [],
    turnGate: null,
  })
  const boundary = validateAgentV2FinalAnswer(domainBoundaryAnswer(), {
    ...baseValidationContext,
    selectedProductProjections: [],
    latestUserMessage: "welchen nagellack soll ich kaufen?",
    recentEvidenceText: "welchen nagellack soll ich kaufen?",
    toolCallHistory: [],
    knownHardRuleIds: [],
    turnGate: null,
  })

  assert.equal(social.ok, false)
  assert.ok(social.errors.some((error) => error.validator_id === "turn_gate_answer_mode"))
  assert.equal(boundary.ok, false)
  assert.ok(boundary.errors.some((error) => error.validator_id === "turn_gate_answer_mode"))
})

test("validator blocks social and domain-boundary side effects", () => {
  const withProductIds = validateAgentV2FinalAnswer(
    socialAnswer({
      tool_grounding: {
        ...socialAnswer().tool_grounding,
        product_ids: ["prod_1"],
      },
    }),
    {
      ...baseValidationContext,
      selectedProductProjections: [],
      latestUserMessage: "hallo",
      recentEvidenceText: "hallo",
      toolCallHistory: [{ name: "classify_turn_gate" }],
      knownHardRuleIds: [],
      turnGate: {
        gate_status: "social",
        evidence_quote: "hallo",
        confidence: 0.9,
        boundary_kind: null,
      },
    },
  )
  const withMemoryWrite = validateAgentV2FinalAnswer(
    domainBoundaryAnswer({
      session_memory_writes: [
        {
          type: "other",
          text: "User asked about nail polish.",
          evidence_quote: "welchen nagellack soll ich kaufen?",
          confidence: 0.9,
          ttl: "session",
          affects_recommendations: false,
          expires_at_turn: null,
        },
      ],
    }),
    {
      ...baseValidationContext,
      selectedProductProjections: [],
      latestUserMessage: "welchen nagellack soll ich kaufen?",
      recentEvidenceText: "welchen nagellack soll ich kaufen?",
      toolCallHistory: [{ name: "classify_turn_gate" }],
      knownHardRuleIds: [],
      turnGate: {
        gate_status: "domain_boundary",
        evidence_quote: "welchen nagellack soll ich kaufen?",
        confidence: 0.9,
        boundary_kind: "unsupported_domain",
      },
    },
  )

  assert.equal(withProductIds.ok, false)
  assert.ok(
    withProductIds.errors.some((error) => error.validator_id === "boundary_answer_no_side_effects"),
  )
  assert.equal(withMemoryWrite.ok, false)
  assert.ok(
    withMemoryWrite.errors.some(
      (error) => error.validator_id === "boundary_answer_no_side_effects",
    ),
  )
})

test("validator blocks domain-boundary code and gate mismatch", () => {
  const withHtml = validateAgentV2FinalAnswer(
    domainBoundaryAnswer({
      payload: {
        user_facing_answer_de: "<html>Hallo</html>",
        boundary_kind: "unsupported_domain",
        redirect_topic_de: "Haarpflege",
      },
    }),
    {
      ...baseValidationContext,
      selectedProductProjections: [],
      latestUserMessage: "mach html",
      recentEvidenceText: "mach html",
      toolCallHistory: [{ name: "classify_turn_gate" }],
      knownHardRuleIds: [],
      turnGate: {
        gate_status: "domain_boundary",
        evidence_quote: "mach html",
        confidence: 0.9,
        boundary_kind: "unsupported_domain",
      },
    },
  )
  const mismatch = validateAgentV2FinalAnswer(domainBoundaryAnswer(), {
    ...baseValidationContext,
    selectedProductProjections: [],
    latestUserMessage: "welchen nagellack soll ich kaufen?",
    recentEvidenceText: "welchen nagellack soll ich kaufen?",
    toolCallHistory: [{ name: "classify_turn_gate" }],
    knownHardRuleIds: [],
    turnGate: {
      gate_status: "social",
      evidence_quote: "welchen nagellack soll ich kaufen?",
      confidence: 0.9,
      boundary_kind: null,
    },
  })

  assert.equal(withHtml.ok, false)
  assert.ok(withHtml.errors.some((error) => error.validator_id === "no_internal_leakage"))
  assert.equal(mismatch.ok, false)
  assert.ok(mismatch.errors.some((error) => error.validator_id === "turn_gate_answer_mode"))
})

test("validator requires mode-specific and category guidance for category product answers", () => {
  const result = validateAgentV2FinalAnswer(
    {
      ...baseAnswer,
      request_interpretation: requestInterpretation({
        primary_intent: "product_recommendation",
        product_request_kind: "specific_products",
        care_category: "bondbuilder",
        evidence_quote: "Welchen Bondbuilder",
      }),
      tool_grounding: {
        ...baseAnswer.tool_grounding,
        used_guidance_package_ids: [
          "base.advisor_rules.v1",
          "base.answer_contract.v1",
          "base.tone_and_format.v1",
        ],
      },
    },
    {
      ...baseValidationContext,
      latestUserMessage: "Welchen Bondbuilder würdest du empfehlen?",
      recentEvidenceText: "Welchen Bondbuilder würdest du empfehlen?",
      toolCallHistory: [
        selectProductsToolCall({
          category: "bondbuilder",
          user_request: "Welchen Bondbuilder würdest du empfehlen?",
          evidence_quote: "Welchen Bondbuilder",
        }),
      ],
    },
  )

  assert.equal(result.ok, false)
  assert.ok(result.errors.some((error) => error.validator_id === "required_guidance_loaded"))
  assert.match(
    result.errors.map((error) => error.message).join("\n"),
    /base\.product_recommendation\.v1/,
  )
  assert.match(result.errors.map((error) => error.message).join("\n"), /category\.bondbuilder\.v1/)
})

test("validator requires product guidance for product-detail clarifications", () => {
  const result = validateAgentV2FinalAnswer(
    {
      ...baseAnswer,
      answer_mode: "clarification",
      request_interpretation: requestInterpretation({
        primary_intent: "clarification",
        product_request_kind: "product_detail",
        routine_intent: "none",
        care_category: "deep_cleansing_shampoo",
        requested_product_count: 1,
        count_policy: "none",
        evidence_quote: "Malibu C Hard Water Wellness Shampoo",
      }),
      tool_grounding: {
        ...baseAnswer.tool_grounding,
        used_product_tool: true,
        product_ids: [],
        used_guidance_package_ids: [
          "base.advisor_rules.v1",
          "base.answer_contract.v1",
          "base.tone_and_format.v1",
          "category.deep_cleansing_shampoo.v1",
        ],
      },
      payload: {
        user_facing_answer_de: "Schick mir bitte die genaue Produktseite.",
        question_de: "Schick mir bitte die genaue Produktseite.",
        missing_keys: ["product_detail"],
      },
    },
    {
      ...baseValidationContext,
      latestUserMessage: "Ist das Malibu C Hard Water Wellness Shampoo chelatierend?",
      recentEvidenceText: "Ist das Malibu C Hard Water Wellness Shampoo chelatierend?",
      toolCallHistory: [
        selectProductsToolCall({
          category: "deep_cleansing_shampoo",
          product_request_kind: "product_detail",
          requested_product_count: 1,
          count_policy: "none",
          evidence_quote: "Malibu C Hard Water Wellness Shampoo",
        }),
      ],
    },
  )

  assert.equal(result.ok, false)
  assert.ok(result.errors.some((error) => error.validator_id === "required_guidance_loaded"))
  assert.match(
    result.errors.map((error) => error.message).join("\n"),
    /base\.product_recommendation\.v1/,
  )
})

test("validator blocks repeated exact-name clarification for already named off-catalog products", () => {
  const result = validateAgentV2FinalAnswer(
    {
      ...baseAnswer,
      answer_mode: "clarification",
      request_interpretation: requestInterpretation({
        primary_intent: "clarification",
        product_request_kind: "product_detail",
        routine_intent: "none",
        care_category: "conditioner",
        requested_product_count: 1,
        count_policy: "none",
        evidence_quote: "Moisture Mist Conditioner von Urban Alchemy",
      }),
      tool_grounding: {
        ...baseAnswer.tool_grounding,
        used_product_tool: true,
        product_ids: [],
        used_guidance_package_ids: [
          ...requiredGuidanceForAnswer("clarification"),
          "base.product_recommendation.v1",
          "category.conditioner.v1",
        ],
      },
      payload: {
        user_facing_answer_de: "Wie heißt das Produkt genau?",
        question_de: "Schick mir bitte die genaue Produktbezeichnung.",
        missing_keys: ["product_detail"],
      },
    },
    {
      ...baseValidationContext,
      latestUserMessage: "Moisture Mist Conditioner von Urban Alchemy",
      recentEvidenceText: "Moisture Mist Conditioner von Urban Alchemy",
      toolCallHistory: [
        selectProductsToolCall({
          category: "conditioner",
          product_request_kind: "product_detail",
          requested_product_count: 1,
          count_policy: "none",
          evidence_quote: "Moisture Mist Conditioner von Urban Alchemy",
        }),
      ],
      namedProductContext: {
        display_name: "Urban Alchemy Moisture Mist Conditioner",
        category: "conditioner",
        plausible_exact_name: true,
      },
    },
  )

  assert.equal(result.ok, false)
  assert.ok(result.errors.some((error) => error.validator_id === "named_product_detail_unverified"))
})

test("validator blocks substitute catalog recommendations for already named off-catalog product detail turns", () => {
  const result = validateAgentV2FinalAnswer(
    {
      ...baseAnswer,
      request_interpretation: requestInterpretation({
        primary_intent: "product_recommendation",
        product_request_kind: "product_detail",
        routine_intent: "none",
        care_category: "conditioner",
        requested_product_count: 1,
        count_policy: "none",
        evidence_quote: "Moisture Mist Conditioner von Urban Alchemy",
      }),
      tool_grounding: {
        ...baseAnswer.tool_grounding,
        product_ids: ["balea_aqua_hyaluron"],
        used_guidance_package_ids: requiredGuidanceForAnswer(
          "product_recommendation",
          "conditioner",
        ),
      },
      payload: {
        user_facing_answer_de: "**Balea Aqua Hyaluron** passt besser zu deinem Haar.",
        recommendations: [
          {
            product_id: "balea_aqua_hyaluron",
            reason_de: "Leichte Feuchtigkeit.",
            usage_de: null,
            caveat_de: null,
          },
        ],
        comparison_notes_de: [],
        usage_notes_de: [],
        next_step_offer_de: null,
      },
    },
    {
      ...baseValidationContext,
      selectedProductProjections: [
        {
          valid_product_ids: ["balea_aqua_hyaluron"],
          products: [{ product_id: "balea_aqua_hyaluron", name: "Balea Aqua Hyaluron" }],
        },
      ],
      latestUserMessage: "Moisture Mist Conditioner von Urban Alchemy",
      recentEvidenceText: "Moisture Mist Conditioner von Urban Alchemy",
      toolCallHistory: [
        selectProductsToolCall({
          category: "conditioner",
          product_request_kind: "product_detail",
          requested_product_count: 1,
          count_policy: "none",
          evidence_quote: "Moisture Mist Conditioner von Urban Alchemy",
        }),
      ],
      namedProductContext: {
        display_name: "Urban Alchemy Moisture Mist Conditioner",
        category: "conditioner",
        plausible_exact_name: true,
      },
    },
  )

  assert.equal(result.ok, false)
  assert.ok(result.errors.some((error) => error.validator_id === "named_product_detail_unverified"))
})

test("validator requires category guidance for category education answers", () => {
  const answer = {
    ...baseAnswer,
    answer_mode: "general_advice",
    request_interpretation: requestInterpretation({
      primary_intent: "category_education",
      product_request_kind: "category_education",
      care_category: "bondbuilder",
      count_policy: "none",
      evidence_quote: "Was ist ein Bondbuilder?",
    }),
    tool_grounding: {
      ...baseAnswer.tool_grounding,
      used_product_tool: false,
      product_ids: [],
      hard_rule_ids: [],
      used_guidance_package_ids: [
        "base.advisor_rules.v1",
        "base.answer_contract.v1",
        "base.tone_and_format.v1",
        "base.general_advice.v1",
      ],
    },
    payload: {
      user_facing_answer_de: "Bondbuilder sind Aufbaupflege für strukturell strapaziertes Haar.",
      category_or_topic: "bondbuilder",
      key_points_de: ["Sie sind nicht dasselbe wie normale Pflege."],
      next_step_offer_de: null,
    },
  }

  const result = validateAgentV2FinalAnswer(answer, {
    ...baseValidationContext,
    selectedProductProjections: [],
    toolCallHistory: [],
    latestUserMessage: "Was ist ein Bondbuilder?",
    recentEvidenceText: "Was ist ein Bondbuilder?",
    knownHardRuleIds: [],
  })

  assert.equal(result.ok, false)
  assert.ok(result.errors.some((error) => error.validator_id === "required_guidance_loaded"))
  assert.match(result.errors.map((error) => error.message).join("\n"), /category\.bondbuilder\.v1/)
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

test("validator blocks raw internal routine labels in user-facing copy", () => {
  const result = validateAgentV2FinalAnswer(
    placementOnlyAdviceAnswer(
      "Wie baue ich meine Routine auf?",
      "Starte mit routine_layer: basics, danach kommen Goals und deep_dive.",
    ),
    {
      ...baseValidationContext,
      selectedProductProjections: [],
      latestUserMessage: "Wie baue ich meine Routine auf?",
      recentEvidenceText: "Wie baue ich meine Routine auf?",
      toolCallHistory: [],
      knownHardRuleIds: [],
    },
  )

  assert.equal(result.ok, false)
  assert.ok(result.errors.some((error) => error.validator_id === "user_facing_internal_labels"))
})

test("validator blocks raw internal labels in visible payload recommendation fields", () => {
  const result = validateAgentV2FinalAnswer(
    {
      ...baseAnswer,
      payload: {
        ...baseAnswer.payload,
        recommendations: [
          {
            product_id: "prod_1",
            reason_de: "Passt für Goals und deep_dive.",
            usage_de: null,
            caveat_de: null,
          },
        ],
      },
    },
    baseValidationContext,
  )

  assert.equal(result.ok, false)
  assert.ok(result.errors.some((error) => error.validator_id === "user_facing_internal_labels"))
  assert.ok(
    result.errors.some((error) =>
      error.path?.join(".").includes("payload.recommendations.0.reason_de"),
    ),
  )
})

test("validator catches raw internal labels in visible payload routine step reasons", () => {
  const result = validateAgentV2FinalAnswer(
    routineBasicsAnswer({
      reason_de: "Basis im routine_layer basics, danach next_layer_options.",
    }),
    routineBasicsValidationContext,
  )

  assert.equal(result.ok, false)
  assert.ok(result.errors.some((error) => error.validator_id === "user_facing_internal_labels"))
  assert.ok(
    result.errors.some((error) =>
      error.path?.join(".").includes("payload.visible_steps.0.reason_de"),
    ),
  )
})

test("validator blocks internal product-ranking language in user-facing copy", () => {
  const result = validateAgentV2FinalAnswer(
    {
      ...baseAnswer,
      payload: {
        ...baseAnswer.payload,
        user_facing_answer_de:
          "**Test Shampoo** passt, auch wenn es laut Auswahl eher ein etwas schwächerer Treffer ist.",
      },
    },
    baseValidationContext,
  )

  assert.equal(result.ok, false)
  assert.ok(
    result.errors.some((error) => error.validator_id === "user_facing_internal_ranking_language"),
  )
})

test("validator blocks internal instruction phrasing in user-facing copy", () => {
  const result = validateAgentV2FinalAnswer(
    {
      ...baseAnswer,
      payload: {
        ...baseAnswer.payload,
        user_facing_answer_de:
          "Ich soll keine ungeprüfte Produktbewertung aus dem Namen ableiten. Bitte wähle kurz die passende Variante aus.",
      },
    },
    baseValidationContext,
  )

  assert.equal(result.ok, false)
  assert.ok(result.errors.some((error) => error.validator_id === "user_facing_instruction_leakage"))
})

test("validator warns on catalog metadata phrasing in visible payload routine step actions", () => {
  const result = validateAgentV2FinalAnswer(
    routineBasicsAnswer({
      action_de: "Im Katalog als Basis-Schritt klassifiziert.",
    }),
    routineBasicsValidationContext,
  )

  assert.equal(result.ok, true, JSON.stringify(result.errors, null, 2))
  assert.ok(
    result.warnings.some(
      (warning) => warning.validator_id === "user_facing_catalog_metadata_phrasing",
    ),
  )
  assert.ok(
    result.warnings.some((warning) =>
      warning.path?.join(".").includes("payload.visible_steps.0.action_de"),
    ),
  )
})

test("validator ignores hidden non-user-facing fields when checking visible payload language", () => {
  const result = validateAgentV2FinalAnswer(
    {
      ...baseAnswer,
      interpreted_intent: "Goals deep_dive next_layer_options routine_layer",
      request_interpretation: requestInterpretation({
        evidence_quote: "Welches Shampoo passt zu mir?",
      }),
      extracted_constraints: {
        ...baseAnswer.extracted_constraints,
        raw_constraints: ["Goals deep_dive next_layer_options routine_layer"],
      },
    },
    baseValidationContext,
  )

  assert.equal(result.ok, true, JSON.stringify(result.errors, null, 2))
  assert.equal(
    result.errors.some((error) => error.validator_id === "user_facing_internal_labels"),
    false,
  )
  assert.equal(
    result.warnings.some(
      (warning) => warning.validator_id === "user_facing_catalog_metadata_phrasing",
    ),
    false,
  )
})

test("validator blocks bare Ja opening for non-confirmation user message", () => {
  const result = validateAgentV2FinalAnswer(
    placementOnlyAdviceAnswer(
      "Welche Spuelung passt zu feinem Haar?",
      "Ja - bei feinem Haar würde ich leichte Pflege nehmen.",
    ),
    {
      ...baseValidationContext,
      selectedProductProjections: [],
      latestUserMessage: "Welche Spuelung passt zu feinem Haar?",
      recentEvidenceText: "Welche Spuelung passt zu feinem Haar?",
      toolCallHistory: [],
      knownHardRuleIds: [],
    },
  )

  assert.equal(result.ok, false)
  assert.ok(result.errors.some((error) => error.validator_id === "user_facing_bare_ja_opening"))
})

test("validator allows Ja opening after explicit confirmation", () => {
  const result = validateAgentV2FinalAnswer(
    placementOnlyAdviceAnswer("Ja", "Ja - bei feinem Haar würde ich leichte Pflege nehmen."),
    {
      ...baseValidationContext,
      selectedProductProjections: [],
      latestUserMessage: "Ja",
      recentEvidenceText: "Ja",
      toolCallHistory: [],
      knownHardRuleIds: [],
    },
  )

  assert.equal(result.ok, true)
  assert.equal(
    result.errors.some((error) => error.validator_id === "user_facing_bare_ja_opening"),
    false,
  )
})

test("validator warns on catalog classification phrasing without failing validation", () => {
  const result = validateAgentV2FinalAnswer(
    {
      ...baseAnswer,
      payload: {
        ...baseAnswer.payload,
        user_facing_answer_de: "**Test Shampoo** ist im Katalog als leichte Reinigung eingestuft.",
      },
    },
    baseValidationContext,
  )

  assert.equal(result.ok, true)
  assert.ok(
    result.warnings.some(
      (warning) => warning.validator_id === "user_facing_catalog_metadata_phrasing",
    ),
  )
})

test("validator warns on representative ASCII German orthography tokens without failing validation", async (t) => {
  const cases = [
    { label: "ue", text: "Fuer die Pflege gilt: sanft verteilen." },
    { label: "ae", text: "Die Laengen brauchen nur eine kleine Menge." },
    { label: "oe", text: "Oel bitte nur sparsam in die Spitzen geben." },
    { label: "ss-heisst", text: "Das heisst: kurz einwirken lassen." },
    { label: "ss-gross", text: "Gross gedacht: weniger Produkt ist oft besser." },
    { label: "ss-grosse", text: "Eine grosse Menge ist meistens nicht nötig." },
    { label: "ss-grossen", text: "Bei grossen Mengen wird feines Haar schneller schwer." },
    { label: "ss-ausser", text: "Ausser am Ansatz darf die Pflege in die Längen." },
    { label: "ss-ausserdem", text: "Ausserdem hilft gründliches Ausspülen." },
    { label: "ss-weiss", text: "Ich weiss, dass weniger Produkt oft reicht." },
  ]

  for (const testCase of cases) {
    await t.test(testCase.label, () => {
      const answer = {
        ...baseAnswer,
        answer_mode: "general_advice",
        request_interpretation: requestInterpretation({
          primary_intent: "general_advice",
          product_request_kind: "none",
          routine_intent: "none",
          care_category: "none",
          requested_product_count: null,
          count_policy: "none",
          evidence_quote: "Wie pflege ich meine Laengen?",
        }),
        tool_grounding: {
          ...baseAnswer.tool_grounding,
          used_guidance_package_ids: requiredGuidanceForAnswer("general_advice"),
          used_product_tool: false,
          used_routine_tool: false,
          product_ids: [],
          routine_step_ids: [],
          hard_rule_ids: [],
        },
        payload: {
          user_facing_answer_de: testCase.text,
          category_or_topic: "general_advice",
          key_points_de: [testCase.text],
          next_step_offer_de: null,
        },
      }

      const result = validateAgentV2FinalAnswer(answer, {
        ...baseValidationContext,
        selectedProductProjections: [],
        toolCallHistory: [],
        latestUserMessage: "Wie pflege ich meine Laengen?",
        recentEvidenceText: "Wie pflege ich meine Laengen?",
        knownHardRuleIds: [],
      })

      assert.equal(result.ok, true, JSON.stringify(result.errors, null, 2))
      assert.equal(result.errors.length, 0)
      assert.ok(
        result.warnings.some(
          (warning) => warning.validator_id === "user_facing_ascii_german_orthography",
        ),
      )
    })
  }
})

test("validator does not warn on ordinary ue letter pairs or standard German orthography", () => {
  const answer = {
    ...baseAnswer,
    answer_mode: "general_advice",
    request_interpretation: requestInterpretation({
      primary_intent: "general_advice",
      product_request_kind: "category_education",
      routine_intent: "none",
      care_category: "conditioner",
      requested_product_count: null,
      count_policy: "none",
      evidence_quote: "Welche Feuchtigkeit fuer Conditioner?",
    }),
    tool_grounding: {
      ...baseAnswer.tool_grounding,
      used_guidance_package_ids: requiredGuidanceForAnswer("general_advice", "conditioner"),
      used_product_tool: false,
      used_routine_tool: false,
      product_ids: [],
      routine_step_ids: [],
      hard_rule_ids: [],
    },
    payload: {
      user_facing_answer_de:
        "Heute reicht eine neue, nicht zu teure Pflege mit Feuchtigkeit für die Längen.",
      category_or_topic: "conditioner",
      key_points_de: ["Feuchtigkeit und gründliches Ausspülen sind möglich."],
      next_step_offer_de: null,
    },
  }

  const result = validateAgentV2FinalAnswer(answer, {
    ...baseValidationContext,
    selectedProductProjections: [],
    toolCallHistory: [],
    latestUserMessage: "Welche Feuchtigkeit fuer Conditioner?",
    recentEvidenceText: "Welche Feuchtigkeit fuer Conditioner?",
    knownHardRuleIds: [],
  })

  assert.equal(result.ok, true, JSON.stringify(result.errors, null, 2))
  assert.equal(
    result.warnings.some(
      (warning) => warning.validator_id === "user_facing_ascii_german_orthography",
    ),
    false,
  )
})

test("validator allows cosmetic treatment wording for frizz", () => {
  const result = validateAgentV2FinalAnswer(
    {
      ...baseAnswer,
      payload: {
        ...baseAnswer.payload,
        user_facing_answer_de:
          "**Test Shampoo** behandelt Frizz kosmetisch und macht die Längen glätter.",
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
          "**Test Shampoo** passt; wenn du ein Styling-Tool nutzt, ist Hitzeschutz für die Längen sinnvoll.",
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
          "**Test Shampoo** passt gut, weil es leicht reinigt und dein feines Haar nicht unnötig beschwert.",
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

test("validator treats product selection as supporting grounding for routine mutations", () => {
  const answer = {
    ...routineBasicsAnswer({
      label_de: "Leave-in: Pantene Pro-V Miracles 7in1 Haaröl Spray",
      action_de: "Nach der Wäsche eine kleine Menge in Längen und Spitzen geben.",
      reason_de: "Das Pantene Leave-in ergänzt die Basisroutine ohne einen Extra-Reset-Schritt.",
    }),
    request_interpretation: requestInterpretation({
      primary_intent: "routine_mutation",
      product_request_kind: "none",
      routine_intent: "modify",
      care_category: "leave_in",
      requested_product_count: null,
      count_policy: "none",
      evidence_quote: "das von pantene",
    }),
    tool_grounding: {
      ...baseAnswer.tool_grounding,
      used_guidance_package_ids: requiredGuidanceForAnswer("routine", "leave_in"),
      used_product_tool: true,
      used_routine_tool: true,
      product_ids: ["prod_pantene"],
      routine_step_ids: ["step_leave_in"],
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
      user_facing_answer_de:
        "Ich baue dir **Leave-in: Pantene Pro-V Miracles 7in1 Haaröl Spray** in die Basis ein, direkt nach dem Waschen.",
      routine_layer: "basics",
      visible_steps: [
        {
          step_id: "step_leave_in",
          label_de: "Leave-in: Pantene Pro-V Miracles 7in1 Haaröl Spray",
          action_de: "Nach der Wäsche eine kleine Menge in Längen und Spitzen geben.",
          frequency_de: "Nach Bedarf",
          reason_de:
            "Das Pantene Leave-in ergänzt die Basisroutine ohne einen Extra-Reset-Schritt.",
        },
      ],
      next_layer_options: ["goals"],
      next_step_offer_de: null,
    },
  }

  const productBackedRoutineContext = {
    ...routineBasicsValidationContext,
    selectedProductProjections: [
      {
        valid_product_ids: ["prod_pantene"],
        products: [
          {
            product_id: "prod_pantene",
            name: "Pantene Pro-V Miracles 7in1 Haaröl Spray",
          },
        ],
      },
    ],
    latestUserMessage: "das von pantene",
    recentEvidenceText:
      "Welches Leave-in passt zu mir? Bau das Produkt bitte in meine Routine ein. das von pantene",
    toolCallHistory: [
      selectProductsToolCall({
        category: "leave_in",
        product_request_kind: "specific_products",
        requested_product_count: 1,
        count_policy: "exact",
        evidence_quote: "das von pantene",
      }),
      routineToolCall({
        objective: "fix_routine",
        requested_category: "leave_in",
        routine_intent: "modify",
        mutation_kind: "add_step",
        evidence_quote: "das von pantene",
      }),
    ],
    routineProjections: [
      {
        routine_layer: "basics" as const,
        visible_steps: [{ step_id: "step_leave_in" }],
      },
    ],
    requiredGuidancePackageIds: requiredGuidanceForAnswer("routine", "leave_in"),
  }

  const result = validateAgentV2FinalAnswer(answer, productBackedRoutineContext)

  assert.equal(result.ok, true, JSON.stringify(result.errors, null, 2))

  const explicitProductComponent = validateAgentV2FinalAnswer(
    {
      ...answer,
      request_interpretation: requestInterpretation({
        primary_intent: "routine_mutation",
        product_request_kind: "specific_products",
        routine_intent: "modify",
        care_category: "leave_in",
        requested_product_count: 1,
        count_policy: "exact",
        evidence_quote: "das von pantene",
      }),
      tool_grounding: {
        ...answer.tool_grounding,
        used_guidance_package_ids: [
          ...requiredGuidanceForAnswer("routine", "leave_in"),
          "base.product_recommendation.v1",
        ],
      },
    },
    {
      ...productBackedRoutineContext,
      requiredGuidancePackageIds: [
        ...requiredGuidanceForAnswer("routine", "leave_in"),
        "base.product_recommendation.v1",
      ],
    },
  )

  assert.equal(
    explicitProductComponent.ok,
    true,
    JSON.stringify(explicitProductComponent.errors, null, 2),
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

test("validator returns repair metadata for ungrounded evidence quotes", () => {
  const result = validateAgentV2FinalAnswer(
    {
      ...baseAnswer,
      request_interpretation: requestInterpretation({
        evidence_quote: "anti frizz protocol",
      }),
    },
    {
      ...baseValidationContext,
      latestUserMessage: "Was hilft gegen Frizz bei meinem Haarprofil?",
      recentEvidenceText: "Was hilft gegen Frizz bei meinem Haarprofil?",
      toolCallHistory: [
        selectProductsToolCall({
          user_request: "Was hilft gegen Frizz bei meinem Haarprofil?",
          evidence_quote: "anti frizz protocol",
        }),
      ],
    },
  )

  const error = result.errors.find(
    (candidate) => candidate.validator_id === "request_interpretation_evidence",
  )
  assert.ok(error)
  assert.equal(error.path?.join("."), "request_interpretation.evidence_quote")
  assert.equal(error.rejected_value, "anti frizz protocol")
  assert.equal(error.suggested_value, "Was hilft gegen Frizz bei meinem Haarprofil?")
  assert.equal(error.reason_code, "evidence_quote_not_in_context")
  assert.match(String(error.repair_hint), /suggested_value/)
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

test("validator allows exact short concern terms as evidence quotes", () => {
  const result = validateAgentV2FinalAnswer(
    {
      ...baseAnswer,
      answer_mode: "general_advice",
      request_interpretation: requestInterpretation({
        primary_intent: "general_advice",
        product_request_kind: "category_education",
        routine_intent: "none",
        care_category: "none",
        requested_product_count: null,
        count_policy: "none",
        evidence_quote: "Frizz",
      }),
      tool_grounding: {
        ...baseAnswer.tool_grounding,
        used_guidance_package_ids: requiredGuidanceForAnswer("general_advice", "none"),
        used_product_tool: false,
        product_ids: [],
      },
      payload: {
        user_facing_answer_de:
          "Gegen Frizz hilft bei deinem Profil vor allem leichte Pflege in den Längen.",
        category_or_topic: "frizz",
        key_points_de: ["Leichte Pflege in den Längen reduziert Reibung."],
        next_step_offer_de: null,
      },
    },
    {
      ...baseValidationContext,
      selectedProductProjections: [],
      latestUserMessage: "Was hilft gegen Frizz bei meinem Haarprofil?",
      recentEvidenceText: "Was hilft gegen Frizz bei meinem Haarprofil?",
      toolCallHistory: [{ name: "load_advisor_guidance", call_id: "call_guidance" }],
      requiredGuidancePackageIds: [],
    },
  )

  assert.equal(result.ok, true, JSON.stringify(result.errors, null, 2))
  assert.equal(result.warnings.length, 0, JSON.stringify(result.warnings, null, 2))
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
          care_category: "none",
          requested_product_count: null,
          count_policy: "none",
          evidence_quote,
        }),
        tool_grounding: {
          ...baseAnswer.tool_grounding,
          used_guidance_package_ids: requiredGuidanceForAnswer("safety_boundary"),
          used_product_tool: false,
          product_ids: [],
        },
        payload: {
          user_facing_answer_de: "Bei juckender und geröteter Kopfhaut würde ich mild bleiben.",
          boundary_reason_de: "Möglich medizinischer Kopfhautkontext.",
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

test("validator allows German umlaut transliterations in evidence quotes", () => {
  const result = validateAgentV2FinalAnswer(
    {
      ...baseAnswer,
      request_interpretation: requestInterpretation({
        evidence_quote: "Welches Shampoo passt fuer mich?",
      }),
    },
    {
      ...baseValidationContext,
      latestUserMessage: "Welches Shampoo passt für mich?",
      recentEvidenceText: "Welches Shampoo passt für mich?",
      toolCallHistory: [
        selectProductsToolCall({
          user_request: "Welches Shampoo passt für mich?",
          evidence_quote: "Welches Shampoo passt fuer mich?",
        }),
      ],
    },
  )

  assert.equal(result.ok, true, JSON.stringify(result.errors, null, 2))
  assert.equal(result.warnings.length, 0, JSON.stringify(result.warnings, null, 2))
})

test("validator allows evidence quotes from active routine visible step labels", () => {
  const result = validateAgentV2FinalAnswer(
    {
      ...baseAnswer,
      answer_mode: "product_recommendation",
      interpreted_intent: "User wants a product for a visible routine step.",
      request_interpretation: requestInterpretation({
        primary_intent: "product_recommendation",
        product_request_kind: "specific_products",
        care_category: "leave_in",
        evidence_quote: "Erster Zusatz",
      }),
      tool_grounding: {
        ...baseAnswer.tool_grounding,
        used_guidance_package_ids: requiredGuidanceForAnswer("product_recommendation", "leave_in"),
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
      pending_followup_action: null,
      payload: {
        user_facing_answer_de:
          "**Test Shampoo** passt als leichter erster Zusatz in deine Routine. Danach kannst du zur Routine zurückgehen.",
        recommendations: [
          {
            product_id: "prod_1",
            reason_de: "Passt als leichter Zusatz.",
            usage_de: null,
            caveat_de: null,
          },
        ],
        comparison_notes_de: [],
        usage_notes_de: [],
        next_step_offer_de: "Danach kannst du zur Routine zurückgehen.",
      },
    },
    {
      ...baseValidationContext,
      latestUserMessage: "Welches Produkt passt dafuer?",
      recentEvidenceText: "",
      toolCallHistory: [
        selectProductsToolCall({
          category: "leave_in",
          product_request_kind: "specific_products",
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

test("validator warns instead of blocking semantically close evidence paraphrases", () => {
  const result = validateAgentV2FinalAnswer(
    {
      ...baseAnswer,
      answer_mode: "routine",
      request_interpretation: requestInterpretation({
        primary_intent: "routine_build",
        product_request_kind: "none",
        routine_intent: "create",
        care_category: "none",
        requested_product_count: null,
        count_policy: "none",
        evidence_quote: "zeige mir meine angepasste routine",
      }),
      tool_grounding: {
        ...baseAnswer.tool_grounding,
        used_guidance_package_ids: requiredGuidanceForAnswer("routine"),
        used_product_tool: false,
        used_routine_tool: true,
        product_ids: [],
        routine_step_ids: ["step_shampoo"],
      },
      routine_context: {
        active: true,
        routine_layer: "basics",
        step_id: null,
        category: null,
        return_path: [],
      },
      payload: {
        user_facing_answer_de: "**Shampoo** ist dein erster Basis-Schritt.",
        routine_layer: "basics",
        visible_steps: [
          {
            step_id: "step_shampoo",
            label_de: "Shampoo",
            action_de: "Am Ansatz reinigen.",
            frequency_de: "Nach Bedarf",
            reason_de: "Basis der Routine.",
          },
        ],
        next_layer_options: ["goals"],
        next_step_offer_de: null,
      },
    },
    {
      ...baseValidationContext,
      latestUserMessage: "okay ja dann zeig mir mal meine angepasste routine",
      recentEvidenceText: "okay ja dann zeig mir mal meine angepasste routine",
      toolCallHistory: [
        routineToolCall({
          evidence_quote: "zeige mir meine angepasste routine",
        }),
      ],
      routineProjections: [
        {
          routine_layer: "basics",
          visible_steps: [{ step_id: "step_shampoo" }],
        },
      ],
    },
  )

  assert.equal(result.ok, true, JSON.stringify(result.errors, null, 2))
  assert.ok(
    result.warnings.some((warning) => warning.validator_id === "request_interpretation_evidence"),
  )
  assert.ok(
    result.warnings.some(
      (warning) => warning.validator_id === "request_interpretation_tool_args_match",
    ),
  )
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

test("validator sanitizer can repair evidence quote metadata only", () => {
  const answer = {
    ...baseAnswer,
    answer_mode: "general_advice",
    request_interpretation: requestInterpretation({
      primary_intent: "general_advice",
      product_request_kind: "category_education",
      routine_intent: "none",
      care_category: "none",
      requested_product_count: null,
      count_policy: "none",
      evidence_quote: "anti frizz protocol",
    }),
    tool_grounding: {
      ...baseAnswer.tool_grounding,
      used_guidance_package_ids: requiredGuidanceForAnswer("general_advice", "none"),
      used_product_tool: false,
      product_ids: [],
    },
    payload: {
      user_facing_answer_de:
        "Gegen Frizz hilft bei deinem Profil vor allem leichte Pflege in den Längen.",
      category_or_topic: "frizz",
      key_points_de: ["Leichte Pflege in den Längen reduziert Reibung."],
      next_step_offer_de: null,
    },
  }
  const result = validateAgentV2FinalAnswer(answer, {
    ...baseValidationContext,
    selectedProductProjections: [],
    latestUserMessage: "Was hilft gegen Frizz bei meinem Haarprofil?",
    recentEvidenceText: "Was hilft gegen Frizz bei meinem Haarprofil?",
    toolCallHistory: [{ name: "load_advisor_guidance", call_id: "call_guidance" }],
    requiredGuidancePackageIds: [],
  })

  assert.ok(result.sanitized_answer)
  const sanitized = sanitizeRepairableEvidenceQuote(result.sanitized_answer, result.errors)

  assert.ok(sanitized)
  assert.equal(
    sanitized.answer.request_interpretation.evidence_quote,
    "Was hilft gegen Frizz bei meinem Haarprofil?",
  )
  assert.equal(sanitized.warning.validator_id, "request_interpretation_evidence_sanitized")
  assert.equal(sanitized.warning.severity, "warn")
})

test("validator sanitizer refuses mixed or non-evidence failures", () => {
  const answer = {
    ...baseAnswer,
    answer_mode: "general_advice",
    request_interpretation: requestInterpretation({
      primary_intent: "general_advice",
      product_request_kind: "category_education",
      routine_intent: "none",
      care_category: "none",
      requested_product_count: null,
      count_policy: "none",
      evidence_quote: "anti frizz protocol",
    }),
    tool_grounding: {
      ...baseAnswer.tool_grounding,
      used_guidance_package_ids: requiredGuidanceForAnswer("general_advice", "none"),
      used_product_tool: false,
      product_ids: ["unknown_product"],
    },
    payload: {
      user_facing_answer_de:
        "Gegen Frizz hilft bei deinem Profil vor allem leichte Pflege in den Längen.",
      category_or_topic: "frizz",
      key_points_de: ["Leichte Pflege in den Längen reduziert Reibung."],
      next_step_offer_de: null,
    },
  }
  const result = validateAgentV2FinalAnswer(answer, {
    ...baseValidationContext,
    selectedProductProjections: [],
    latestUserMessage: "Was hilft gegen Frizz bei meinem Haarprofil?",
    recentEvidenceText: "Was hilft gegen Frizz bei meinem Haarprofil?",
    toolCallHistory: [{ name: "load_advisor_guidance", call_id: "call_guidance" }],
    requiredGuidancePackageIds: [],
  })

  assert.ok(result.sanitized_answer)
  assert.equal(sanitizeRepairableEvidenceQuote(result.sanitized_answer, result.errors), null)
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
        care_category: "none",
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
            action_de: "In Längen und Spitzen geben.",
            frequency_de: "Nach jeder Wäsche",
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
      answer_mode: "product_recommendation",
      request_interpretation: requestInterpretation({
        product_request_kind: "specific_products",
        care_category: "leave_in",
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
        recommendations: [
          {
            product_id: "prod_1",
            reason_de: "Passt als leichter erster Zusatzhebel.",
            usage_de: "Sparsam in Längen und Spitzen.",
            caveat_de: null,
          },
        ],
        comparison_notes_de: [],
        usage_notes_de: ["Sparsam in Längen und Spitzen."],
        next_step_offer_de: "Danach gehen wir zur Routine zurück.",
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
          product_request_kind: "specific_products",
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
        used_guidance_package_ids: requiredGuidanceForAnswer("general_advice", "conditioner"),
        used_product_tool: false,
        product_ids: [],
      },
      payload: {
        user_facing_answer_de:
          "Mit dieser Einschränkung kann ich kein konkretes Produkt empfehlen.",
        blocking_constraints: ["keine geeigneten Produkte wegen deiner Ausschlüsse"],
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
        care_category: "mask",
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
        key_points_de: ["Eine Maske hilft bei zusätzlichem Pflegebedarf."],
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
        care_category: "conditioner",
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
        care_category: "conditioner",
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
        user_facing_answer_de: "Eine feuchtigkeitsspendende Spülung passt hier am besten.",
        category_or_topic: "conditioner",
        key_points_de: ["Achte auf Feuchtigkeit und mittlere Pflegeintensität."],
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
        care_category: "conditioner",
        requested_product_count: null,
        count_policy: "none",
      }),
      tool_grounding: {
        ...baseAnswer.tool_grounding,
        used_guidance_package_ids: requiredGuidanceForAnswer("general_advice", "conditioner"),
        used_product_tool: false,
        product_ids: [],
      },
      payload: {
        user_facing_answer_de: "Conditioner ist die Basis, eine Maske ist eher Zusatzpflege.",
        category_or_topic: "conditioner_vs_mask",
        key_points_de: ["Conditioner regelmäßig, Maske nur bei Extra-Bedarf."],
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
        care_category: "conditioner",
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
        care_category: "shampoo",
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

test("validator accepts one visible recommendation per multi-category product slot", () => {
  const prompt =
    "Bitte empfiehl mir drei konkrete Produkte für feines welliges Haar mit Frizz: Alltagsshampoo, Leave-in und Tiefenreinigung."
  const result = validateAgentV2FinalAnswer(
    {
      ...baseAnswer,
      request_interpretation: requestInterpretation({
        care_category: "shampoo",
        requested_product_count: 3,
        count_policy: "exact",
        evidence_quote: prompt,
      }),
      tool_grounding: {
        ...baseAnswer.tool_grounding,
        product_ids: ["prod_shampoo", "prod_leave_in", "prod_deep_cleanse"],
      },
      payload: {
        ...baseAnswer.payload,
        user_facing_answer_de:
          "**Alltagsshampoo**, **Leave-in Creme** und **Tiefenreinigungsshampoo** decken die drei Slots ab.",
        recommendations: [
          {
            product_id: "prod_shampoo",
            reason_de: "Passt als Alltagsshampoo für feines, welliges Haar.",
            usage_de: null,
            caveat_de: null,
          },
          {
            product_id: "prod_leave_in",
            reason_de: "Passt als Leave-in gegen Frizz.",
            usage_de: null,
            caveat_de: null,
          },
          {
            product_id: "prod_deep_cleanse",
            reason_de: "Passt als Tiefenreinigung für gelegentliche Klärung.",
            usage_de: null,
            caveat_de: null,
          },
        ],
      },
    },
    {
      ...baseValidationContext,
      latestUserMessage: prompt,
      recentEvidenceText: prompt,
      toolCallHistory: [
        selectProductsToolCall({
          category: "shampoo",
          requested_product_count: 1,
          count_policy: "exact",
          evidence_quote: prompt,
        }),
        selectProductsToolCall({
          category: "leave_in",
          requested_product_count: 1,
          count_policy: "exact",
          evidence_quote: prompt,
        }),
        selectProductsToolCall({
          category: "deep_cleansing_shampoo",
          requested_product_count: 1,
          count_policy: "exact",
          evidence_quote: prompt,
        }),
      ],
      selectedProductProjections: [
        selectedProjection("prod_shampoo", "Alltagsshampoo"),
        selectedProjection("prod_leave_in", "Leave-in Creme"),
        selectedProjection("prod_deep_cleanse", "Tiefenreinigungsshampoo"),
      ],
    },
  )

  assert.equal(result.ok, true, JSON.stringify(result.errors))
})

test("validator still blocks single-category exact-count mismatches", () => {
  const result = validateAgentV2FinalAnswer(
    {
      ...baseAnswer,
      request_interpretation: requestInterpretation({
        care_category: "shampoo",
        requested_product_count: 2,
        count_policy: "exact",
      }),
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
  assert.ok(result.errors.some((error) => error.validator_id === "requested_product_count"))
})

test("validator does not relax single-category exact-count requests into invented slots", () => {
  const prompt = "Bitte empfiehl mir genau zwei Shampoos für feines welliges Haar."
  const result = validateAgentV2FinalAnswer(
    {
      ...baseAnswer,
      request_interpretation: requestInterpretation({
        care_category: "shampoo",
        requested_product_count: 2,
        count_policy: "exact",
        evidence_quote: prompt,
      }),
      tool_grounding: {
        ...baseAnswer.tool_grounding,
        product_ids: ["prod_shampoo", "prod_conditioner"],
      },
      payload: {
        ...baseAnswer.payload,
        user_facing_answer_de:
          "**Shampoo** und **Conditioner** sind sichtbar, obwohl nur Shampoos gefragt waren.",
        recommendations: [
          { product_id: "prod_shampoo", reason_de: "Passt.", usage_de: null, caveat_de: null },
          { product_id: "prod_conditioner", reason_de: "Passt.", usage_de: null, caveat_de: null },
        ],
      },
    },
    {
      ...baseValidationContext,
      latestUserMessage: prompt,
      recentEvidenceText: prompt,
      toolCallHistory: [
        selectProductsToolCall({
          category: "shampoo",
          requested_product_count: 1,
          count_policy: "exact",
          evidence_quote: prompt,
        }),
        selectProductsToolCall({
          category: "conditioner",
          requested_product_count: 1,
          count_policy: "exact",
          evidence_quote: prompt,
        }),
      ],
      selectedProductProjections: [
        selectedProjection("prod_shampoo", "Shampoo"),
        selectedProjection("prod_conditioner", "Conditioner"),
      ],
    },
  )

  assert.equal(result.ok, false)
  assert.ok(
    result.errors.some((error) => error.validator_id === "request_interpretation_tool_args_match"),
  )
})

test("validator does not let model-authored evidence unlock invented slots", () => {
  const prompt = "Bitte empfiehl mir genau zwei Shampoos für feines welliges Haar."
  const result = validateAgentV2FinalAnswer(
    {
      ...baseAnswer,
      request_interpretation: requestInterpretation({
        care_category: "shampoo",
        requested_product_count: 2,
        count_policy: "exact",
        evidence_quote: "zwei Shampoos und Conditioner",
      }),
      tool_grounding: {
        ...baseAnswer.tool_grounding,
        product_ids: ["prod_shampoo", "prod_conditioner"],
      },
      payload: {
        ...baseAnswer.payload,
        user_facing_answer_de: "**Shampoo** und **Conditioner** sind sichtbar.",
        recommendations: [
          { product_id: "prod_shampoo", reason_de: "Passt.", usage_de: null, caveat_de: null },
          { product_id: "prod_conditioner", reason_de: "Passt.", usage_de: null, caveat_de: null },
        ],
      },
    },
    {
      ...baseValidationContext,
      latestUserMessage: prompt,
      recentEvidenceText: "zwei Shampoos und Conditioner",
      toolCallHistory: [
        selectProductsToolCall({
          category: "shampoo",
          requested_product_count: 1,
          count_policy: "exact",
          evidence_quote: "zwei Shampoos und Conditioner",
        }),
        selectProductsToolCall({
          category: "conditioner",
          requested_product_count: 1,
          count_policy: "exact",
          evidence_quote: "zwei Shampoos und Conditioner",
        }),
      ],
      selectedProductProjections: [
        selectedProjection("prod_shampoo", "Shampoo"),
        selectedProjection("prod_conditioner", "Conditioner"),
      ],
    },
  )

  assert.equal(result.ok, false)
  assert.ok(
    result.errors.some((error) => error.validator_id === "request_interpretation_tool_args_match"),
  )
})

test("validator blocks multi-slot answers that surface products outside selected projections", () => {
  const prompt =
    "Bitte empfiehl mir drei konkrete Produkte für feines welliges Haar mit Frizz: Alltagsshampoo, Leave-in und Tiefenreinigung."
  const result = validateAgentV2FinalAnswer(
    {
      ...baseAnswer,
      request_interpretation: requestInterpretation({
        care_category: "shampoo",
        requested_product_count: 3,
        count_policy: "exact",
        evidence_quote: prompt,
      }),
      tool_grounding: {
        ...baseAnswer.tool_grounding,
        product_ids: ["prod_shampoo", "prod_leave_in", "prod_unknown"],
      },
      payload: {
        ...baseAnswer.payload,
        user_facing_answer_de:
          "**Alltagsshampoo**, **Leave-in Creme** und **Unbekanntes Produkt** decken die drei Slots ab.",
        recommendations: [
          { product_id: "prod_shampoo", reason_de: "Passt.", usage_de: null, caveat_de: null },
          { product_id: "prod_leave_in", reason_de: "Passt.", usage_de: null, caveat_de: null },
          { product_id: "prod_unknown", reason_de: "Passt.", usage_de: null, caveat_de: null },
        ],
      },
    },
    {
      ...baseValidationContext,
      latestUserMessage: prompt,
      recentEvidenceText: prompt,
      toolCallHistory: [
        selectProductsToolCall({
          category: "shampoo",
          requested_product_count: 1,
          count_policy: "exact",
          evidence_quote: prompt,
        }),
        selectProductsToolCall({
          category: "leave_in",
          requested_product_count: 1,
          count_policy: "exact",
          evidence_quote: prompt,
        }),
        selectProductsToolCall({
          category: "deep_cleansing_shampoo",
          requested_product_count: 1,
          count_policy: "exact",
          evidence_quote: prompt,
        }),
      ],
      selectedProductProjections: [
        selectedProjection("prod_shampoo", "Alltagsshampoo"),
        selectedProjection("prod_leave_in", "Leave-in Creme"),
        {
          valid_product_ids: [],
          products: [],
        },
      ],
    },
  )

  assert.equal(result.ok, false)
  assert.ok(result.errors.some((error) => error.validator_id === "known_product_ids"))
})

test("validator blocks multi-slot answers above the distinct category cap", () => {
  const prompt =
    "Bitte empfiehl mir drei konkrete Produkte für feines welliges Haar mit Frizz: Alltagsshampoo, Leave-in und Tiefenreinigung."
  const result = validateAgentV2FinalAnswer(
    {
      ...baseAnswer,
      request_interpretation: requestInterpretation({
        care_category: "shampoo",
        requested_product_count: 4,
        count_policy: "exact",
        evidence_quote: prompt,
      }),
      tool_grounding: {
        ...baseAnswer.tool_grounding,
        product_ids: ["prod_shampoo", "prod_leave_in", "prod_deep_cleanse", "prod_extra"],
      },
      payload: {
        ...baseAnswer.payload,
        user_facing_answer_de:
          "**Alltagsshampoo**, **Leave-in Creme**, **Tiefenreinigungsshampoo** und **Extra Shampoo** sind sichtbar.",
        recommendations: [
          { product_id: "prod_shampoo", reason_de: "Passt.", usage_de: null, caveat_de: null },
          { product_id: "prod_leave_in", reason_de: "Passt.", usage_de: null, caveat_de: null },
          { product_id: "prod_deep_cleanse", reason_de: "Passt.", usage_de: null, caveat_de: null },
          { product_id: "prod_extra", reason_de: "Passt.", usage_de: null, caveat_de: null },
        ],
      },
    },
    {
      ...baseValidationContext,
      latestUserMessage: prompt,
      recentEvidenceText: prompt,
      toolCallHistory: [
        selectProductsToolCall({
          category: "shampoo",
          requested_product_count: 1,
          count_policy: "exact",
          evidence_quote: prompt,
        }),
        selectProductsToolCall({
          category: "leave_in",
          requested_product_count: 1,
          count_policy: "exact",
          evidence_quote: prompt,
        }),
        selectProductsToolCall({
          category: "deep_cleansing_shampoo",
          requested_product_count: 1,
          count_policy: "exact",
          evidence_quote: prompt,
        }),
      ],
      selectedProductProjections: [
        selectedProjection("prod_shampoo", "Alltagsshampoo"),
        selectedProjection("prod_leave_in", "Leave-in Creme"),
        {
          valid_product_ids: ["prod_deep_cleanse", "prod_extra"],
          products: [
            { product_id: "prod_deep_cleanse", name: "Tiefenreinigungsshampoo" },
            { product_id: "prod_extra", name: "Extra Shampoo" },
          ],
        },
      ],
    },
  )

  assert.equal(result.ok, false)
  assert.ok(
    result.errors.some(
      (error) =>
        error.validator_id === "requested_product_count" &&
        error.message.includes("must not surface more visible recommendations"),
    ),
  )
})

test("validator does not relax multi-slot answers that double-fill one slot", () => {
  const prompt =
    "Bitte empfiehl mir drei konkrete Produkte für feines welliges Haar mit Frizz: Alltagsshampoo, Leave-in und Tiefenreinigung."
  const result = validateAgentV2FinalAnswer(
    {
      ...baseAnswer,
      request_interpretation: requestInterpretation({
        care_category: "shampoo",
        requested_product_count: 3,
        count_policy: "exact",
        evidence_quote: prompt,
      }),
      tool_grounding: {
        ...baseAnswer.tool_grounding,
        product_ids: ["prod_shampoo", "prod_deep_cleanse", "prod_deep_cleanse_extra"],
      },
      payload: {
        ...baseAnswer.payload,
        user_facing_answer_de:
          "**Alltagsshampoo**, **Tiefenreinigungsshampoo** und **Extra Tiefenreinigung** sind sichtbar; das Leave-in fehlt.",
        recommendations: [
          { product_id: "prod_shampoo", reason_de: "Passt.", usage_de: null, caveat_de: null },
          { product_id: "prod_deep_cleanse", reason_de: "Passt.", usage_de: null, caveat_de: null },
          {
            product_id: "prod_deep_cleanse_extra",
            reason_de: "Passt.",
            usage_de: null,
            caveat_de: null,
          },
        ],
      },
    },
    {
      ...baseValidationContext,
      latestUserMessage: prompt,
      recentEvidenceText: prompt,
      toolCallHistory: [
        selectProductsToolCall({
          category: "shampoo",
          requested_product_count: 1,
          count_policy: "exact",
          evidence_quote: prompt,
        }),
        selectProductsToolCall({
          category: "leave_in",
          requested_product_count: 1,
          count_policy: "exact",
          evidence_quote: prompt,
        }),
        selectProductsToolCall({
          category: "deep_cleansing_shampoo",
          requested_product_count: 1,
          count_policy: "exact",
          evidence_quote: prompt,
        }),
      ],
      selectedProductProjections: [
        selectedProjection("prod_shampoo", "Alltagsshampoo"),
        selectedProjection("prod_leave_in", "Leave-in Creme"),
        {
          valid_product_ids: ["prod_deep_cleanse", "prod_deep_cleanse_extra"],
          products: [
            { product_id: "prod_deep_cleanse", name: "Tiefenreinigungsshampoo" },
            { product_id: "prod_deep_cleanse_extra", name: "Extra Tiefenreinigung" },
          ],
        },
      ],
    },
  )

  assert.equal(result.ok, false)
  assert.ok(
    result.errors.some((error) => error.validator_id === "request_interpretation_tool_args_match"),
  )
})

test("validator does not relax multi-slot answers with duplicate recommendation rows", () => {
  const prompt =
    "Bitte empfiehl mir drei konkrete Produkte für feines welliges Haar mit Frizz: Alltagsshampoo, Leave-in und Tiefenreinigung."
  const result = validateAgentV2FinalAnswer(
    {
      ...baseAnswer,
      request_interpretation: requestInterpretation({
        care_category: "shampoo",
        requested_product_count: 3,
        count_policy: "exact",
        evidence_quote: prompt,
      }),
      tool_grounding: {
        ...baseAnswer.tool_grounding,
        product_ids: ["prod_shampoo", "prod_leave_in"],
      },
      payload: {
        ...baseAnswer.payload,
        user_facing_answer_de:
          "**Alltagsshampoo**, **Alltagsshampoo** und **Leave-in Creme** sind sichtbar; die Tiefenreinigung fehlt.",
        recommendations: [
          { product_id: "prod_shampoo", reason_de: "Passt.", usage_de: null, caveat_de: null },
          { product_id: "prod_shampoo", reason_de: "Doppelt.", usage_de: null, caveat_de: null },
          { product_id: "prod_leave_in", reason_de: "Passt.", usage_de: null, caveat_de: null },
        ],
      },
    },
    {
      ...baseValidationContext,
      latestUserMessage: prompt,
      recentEvidenceText: prompt,
      toolCallHistory: [
        selectProductsToolCall({
          category: "shampoo",
          requested_product_count: 1,
          count_policy: "exact",
          evidence_quote: prompt,
        }),
        selectProductsToolCall({
          category: "leave_in",
          requested_product_count: 1,
          count_policy: "exact",
          evidence_quote: prompt,
        }),
        selectProductsToolCall({
          category: "deep_cleansing_shampoo",
          requested_product_count: 1,
          count_policy: "exact",
          evidence_quote: prompt,
        }),
      ],
      selectedProductProjections: [
        selectedProjection("prod_shampoo", "Alltagsshampoo"),
        selectedProjection("prod_leave_in", "Leave-in Creme"),
        selectedProjection("prod_deep_cleanse", "Tiefenreinigungsshampoo"),
      ],
    },
  )

  assert.equal(result.ok, false)
  assert.ok(
    result.errors.some((error) => error.validator_id === "request_interpretation_tool_args_match"),
  )
})

test("validator does not apply the multi-slot cap to non-A2 multi-category traces", () => {
  const prompt = "Bitte empfiehl mir Shampoo und Leave-in."
  const result = validateAgentV2FinalAnswer(
    {
      ...baseAnswer,
      request_interpretation: requestInterpretation({
        care_category: "leave_in",
        requested_product_count: null,
        count_policy: "default",
        evidence_quote: prompt,
      }),
      tool_grounding: {
        ...baseAnswer.tool_grounding,
        used_guidance_package_ids: requiredGuidanceForAnswer("product_recommendation", "leave_in"),
        product_ids: ["prod_shampoo", "prod_leave_in", "prod_extra"],
      },
      payload: {
        ...baseAnswer.payload,
        user_facing_answer_de:
          "**Shampoo**, **Leave-in Creme** und **Extra Pflege** sind sichtbar.",
        recommendations: [
          { product_id: "prod_shampoo", reason_de: "Passt.", usage_de: null, caveat_de: null },
          { product_id: "prod_leave_in", reason_de: "Passt.", usage_de: null, caveat_de: null },
          { product_id: "prod_extra", reason_de: "Passt.", usage_de: null, caveat_de: null },
        ],
      },
    },
    {
      ...baseValidationContext,
      latestUserMessage: prompt,
      recentEvidenceText: prompt,
      toolCallHistory: [
        selectProductsToolCall({
          category: "shampoo",
          count_policy: "default",
          requested_product_count: null,
          evidence_quote: prompt,
        }),
        selectProductsToolCall({
          category: "leave_in",
          count_policy: "default",
          requested_product_count: null,
          evidence_quote: prompt,
        }),
      ],
      selectedProductProjections: [
        {
          valid_product_ids: ["prod_shampoo", "prod_leave_in", "prod_extra"],
          products: [
            { product_id: "prod_shampoo", name: "Shampoo" },
            { product_id: "prod_leave_in", name: "Leave-in Creme" },
            { product_id: "prod_extra", name: "Extra Pflege" },
          ],
        },
      ],
    },
  )

  assert.equal(result.ok, true, JSON.stringify(result.errors))
})

test("validator does not relax exact counts for terminal-only multi-category slot shape", () => {
  const prompt = "Bitte empfiehl mir zwei konkrete Produkte: Shampoo und Leave-in."
  const result = validateAgentV2FinalAnswer(
    {
      ...baseAnswer,
      request_interpretation: requestInterpretation({
        care_category: "leave_in",
        requested_product_count: 2,
        count_policy: "exact",
        evidence_quote: prompt,
      }),
      tool_grounding: {
        ...baseAnswer.tool_grounding,
        used_guidance_package_ids: requiredGuidanceForAnswer("product_recommendation", "leave_in"),
        product_ids: ["prod_shampoo"],
      },
      payload: {
        ...baseAnswer.payload,
        user_facing_answer_de: "**Shampoo** ist sichtbar; das Leave-in fehlt.",
        recommendations: [
          { product_id: "prod_shampoo", reason_de: "Passt.", usage_de: null, caveat_de: null },
        ],
      },
    },
    {
      ...baseValidationContext,
      latestUserMessage: prompt,
      recentEvidenceText: prompt,
      toolCallHistory: [
        selectProductsToolCall({
          category: "shampoo",
          count_policy: "default",
          requested_product_count: null,
          evidence_quote: prompt,
        }),
        selectProductsToolCall({
          category: "leave_in",
          count_policy: "default",
          requested_product_count: null,
          evidence_quote: prompt,
        }),
      ],
      selectedProductProjections: [selectedProjection("prod_shampoo", "Shampoo")],
    },
  )

  assert.equal(result.ok, false)
  assert.ok(
    result.errors.some((error) => error.validator_id === "request_interpretation_tool_args_match"),
  )
})

test("validator accepts natural catalog-verification wording for blocked product lookup answers", () => {
  const result = validateAgentV2FinalAnswer(
    {
      ...baseAnswer,
      answer_mode: "constraint_blocked",
      request_interpretation: requestInterpretation({
        primary_intent: "product_recommendation",
        product_request_kind: "product_detail",
        care_category: "conditioner",
        requested_product_count: 0,
        count_policy: "none",
        evidence_quote: "mein jean & lean conditioner",
        specific_product_candidate: true,
      }),
      tool_grounding: {
        ...baseAnswer.tool_grounding,
        used_guidance_package_ids: requiredGuidanceForAnswer(
          "product_recommendation",
          "conditioner",
        ),
        used_product_tool: true,
        product_ids: [],
        hard_rule_ids: [
          ...baseAnswer.tool_grounding.hard_rule_ids,
          "product.no_uncatalogued_products",
        ],
      },
      payload: {
        user_facing_answer_de:
          "Der Name ist für mich aktuell kein verifizierter Katalogtreffer, deshalb kann ich ihn nicht genau bewerten. Wichtig ist: keine genaue Produkteinschätzung ohne bestätigte Produktdaten.",
        blocking_constraints: [
          "nicht katalogverifiziert",
          "keine genaue Produkteinschätzung ohne bestätigte Produktdaten",
        ],
        safe_alternative_de:
          "Für dein Haarprofil wirkt ein leichter bis mittlerer Conditioner meist passender als etwas sehr Reichhaltiges.",
      },
    },
    {
      ...baseValidationContext,
      latestUserMessage: "kannst du mir sagen, was du von meinem jean & lean conditioner hältst",
      recentEvidenceText: "kannst du mir sagen, was du von meinem jean & lean conditioner hältst",
      selectedProductProjections: [],
      toolCallHistory: [
        selectProductsToolCall({
          category: "conditioner",
          product_request_kind: "product_detail",
          requested_product_count: 0,
          count_policy: "none",
          evidence_quote: "mein jean & lean conditioner",
        }),
        {
          name: "lookup_product_candidate",
          arguments: {
            category: "conditioner",
            brand_text: "jean & lean",
            product_name_text: "Conditioner",
          },
          output_summary: "product_lookup:not_found",
        },
      ],
      productLookupResults: [
        {
          status: "not_found",
          category: "conditioner",
          input_identity: {
            category: "conditioner",
            brand_text: "jean & lean",
            product_name_text: "Conditioner",
            evidence_quote: "mein jean & lean conditioner",
          },
          product: null,
        },
      ],
    },
  )

  assert.equal(result.ok, true, JSON.stringify(result.errors, null, 2))
})

test("validator ignores hidden product grounding for blocked not-found product deferrals", () => {
  const result = validateAgentV2FinalAnswer(
    {
      ...baseAnswer,
      answer_mode: "constraint_blocked",
      request_interpretation: requestInterpretation({
        primary_intent: "product_recommendation",
        product_request_kind: "product_detail",
        care_category: "conditioner",
        requested_product_count: 0,
        count_policy: "none",
        evidence_quote: "mein jean & lean conditioner",
        specific_product_candidate: true,
      }),
      tool_grounding: {
        ...baseAnswer.tool_grounding,
        used_guidance_package_ids: requiredGuidanceForAnswer(
          "product_recommendation",
          "conditioner",
        ),
        used_product_tool: true,
        product_ids: ["prod_1"],
      },
      payload: {
        user_facing_answer_de:
          "Ich kann deinen jean & lean Conditioner hier nicht als verifizierten Katalogtreffer prüfen; deshalb ist eine exakte Produktbewertung ohne verifizierte Identität nicht möglich. Für dein feines, welliges Haar mit Frizz ist Conditioner grundsätzlich die richtige Basispflege für Längen und Spitzen, aber die konkrete Eignung hängt bei einem einzelnen Produkt vor allem von Gewicht und Pflegeintensität ab.",
        blocking_constraints: [
          "keine exakte Produktbewertung ohne verifizierte Identität",
          "nicht als verifizierter Katalogtreffer prüfbar",
        ],
        safe_alternative_de:
          "Ich kann dir stattdessen sagen, woran du bei einem Conditioner für dein Haar am ehesten erkennst, ob er eher leicht oder zu schwer ist.",
      },
    },
    {
      ...baseValidationContext,
      latestUserMessage: "kannst du mir sagen, was du von meinem jean & lean conditioner hältst",
      recentEvidenceText: "kannst du mir sagen, was du von meinem jean & lean conditioner hältst",
      toolCallHistory: [
        selectProductsToolCall({
          category: "conditioner",
          product_request_kind: "product_detail",
          requested_product_count: 0,
          count_policy: "none",
          evidence_quote: "mein jean & lean conditioner",
        }),
        {
          name: "lookup_product_candidate",
          arguments: {
            category: "conditioner",
            brand_text: "jean & lean",
            product_name_text: "Conditioner",
          },
          output_summary: "product_lookup:not_found",
        },
      ],
      productLookupResults: [
        {
          status: "not_found",
          category: "conditioner",
          input_identity: {
            category: "conditioner",
            brand_text: "jean & lean",
            product_name_text: "Conditioner",
            evidence_quote: "mein jean & lean conditioner",
          },
          product: null,
        },
      ],
      namedProductContext: {
        display_name: "jean & lean Conditioner",
        category: "conditioner",
        plausible_exact_name: true,
        named_product_intent: "current_use_product_question",
      },
    },
  )

  assert.equal(
    result.errors.some((error) => error.validator_id === "product_lookup_unresolved"),
    false,
    JSON.stringify(result.errors, null, 2),
  )
})

test("validator does not relax multi-slot answers using prior-turn selected products", () => {
  const prompt =
    "Bitte empfiehl mir drei konkrete Produkte für feines welliges Haar mit Frizz: Alltagsshampoo, Leave-in und Tiefenreinigung."

  const result = validateAgentV2FinalAnswer(
    {
      ...baseAnswer,
      request_interpretation: requestInterpretation({
        care_category: "shampoo",
        requested_product_count: 3,
        count_policy: "exact",
        evidence_quote: prompt,
      }),
      tool_grounding: {
        ...baseAnswer.tool_grounding,
        product_ids: ["prod_prior_shampoo", "prod_leave_in", "prod_deep_cleanse"],
      },
      payload: {
        ...baseAnswer.payload,
        user_facing_answer_de:
          "**Altes Shampoo**, **Leave-in Creme** und **Tiefenreinigungsshampoo** sind sichtbar.",
        recommendations: [
          {
            product_id: "prod_prior_shampoo",
            reason_de: "Passt.",
            usage_de: null,
            caveat_de: null,
          },
          { product_id: "prod_leave_in", reason_de: "Passt.", usage_de: null, caveat_de: null },
          { product_id: "prod_deep_cleanse", reason_de: "Passt.", usage_de: null, caveat_de: null },
        ],
      },
    },
    {
      ...baseValidationContext,
      latestUserMessage: prompt,
      recentEvidenceText: prompt,
      toolCallHistory: [
        selectProductsToolCall({
          category: "shampoo",
          requested_product_count: 1,
          count_policy: "exact",
          evidence_quote: prompt,
        }),
        selectProductsToolCall({
          category: "leave_in",
          requested_product_count: 1,
          count_policy: "exact",
          evidence_quote: prompt,
        }),
        selectProductsToolCall({
          category: "deep_cleansing_shampoo",
          requested_product_count: 1,
          count_policy: "exact",
          evidence_quote: prompt,
        }),
      ],
      selectedProductProjections: [
        selectedProjection("prod_prior_shampoo", "Altes Shampoo"),
        selectedProjection("prod_current_shampoo", "Aktuelles Shampoo"),
        selectedProjection("prod_leave_in", "Leave-in Creme"),
        selectedProjection("prod_deep_cleanse", "Tiefenreinigungsshampoo"),
      ],
    },
  )

  assert.equal(result.ok, false)
  assert.ok(result.errors.some((error) => error.validator_id === "requested_product_count"))
})

test("validator does not relax multi-slot answers that omit a fillable slot", () => {
  const prompt =
    "Bitte empfiehl mir drei konkrete Produkte für feines welliges Haar mit Frizz: Alltagsshampoo, Leave-in und Tiefenreinigung."
  const result = validateAgentV2FinalAnswer(
    {
      ...baseAnswer,
      request_interpretation: requestInterpretation({
        care_category: "shampoo",
        requested_product_count: 3,
        count_policy: "exact",
        evidence_quote: prompt,
      }),
      tool_grounding: {
        ...baseAnswer.tool_grounding,
        product_ids: ["prod_shampoo", "prod_leave_in"],
      },
      payload: {
        ...baseAnswer.payload,
        user_facing_answer_de:
          "**Alltagsshampoo** und **Leave-in Creme** sind sichtbar; die Tiefenreinigung fehlt.",
        recommendations: [
          { product_id: "prod_shampoo", reason_de: "Passt.", usage_de: null, caveat_de: null },
          { product_id: "prod_leave_in", reason_de: "Passt.", usage_de: null, caveat_de: null },
        ],
      },
    },
    {
      ...baseValidationContext,
      latestUserMessage: prompt,
      recentEvidenceText: prompt,
      toolCallHistory: [
        selectProductsToolCall({
          category: "shampoo",
          requested_product_count: 1,
          count_policy: "exact",
          evidence_quote: prompt,
        }),
        selectProductsToolCall({
          category: "leave_in",
          requested_product_count: 1,
          count_policy: "exact",
          evidence_quote: prompt,
        }),
        selectProductsToolCall({
          category: "deep_cleansing_shampoo",
          requested_product_count: 1,
          count_policy: "exact",
          evidence_quote: prompt,
        }),
      ],
      selectedProductProjections: [
        selectedProjection("prod_shampoo", "Alltagsshampoo"),
        selectedProjection("prod_leave_in", "Leave-in Creme"),
        selectedProjection("prod_deep_cleanse", "Tiefenreinigungsshampoo"),
      ],
    },
  )

  assert.equal(result.ok, false)
  assert.ok(result.errors.some((error) => error.validator_id === "requested_product_count"))
})

test("validator accepts partial success for multi-category product slots", () => {
  const prompt =
    "Bitte empfiehl mir drei konkrete Produkte für feines welliges Haar mit Frizz: Alltagsshampoo, Leave-in und Tiefenreinigung."
  const result = validateAgentV2FinalAnswer(
    {
      ...baseAnswer,
      request_interpretation: requestInterpretation({
        care_category: "shampoo",
        requested_product_count: 3,
        count_policy: "exact",
        evidence_quote: prompt,
      }),
      tool_grounding: {
        ...baseAnswer.tool_grounding,
        product_ids: ["prod_shampoo", "prod_leave_in"],
      },
      payload: {
        ...baseAnswer.payload,
        user_facing_answer_de:
          "**Alltagsshampoo** und **Leave-in Creme** sind sicher genug; für Tiefenreinigung fehlt mir ein sicherer Treffer.",
        recommendations: [
          { product_id: "prod_shampoo", reason_de: "Passt.", usage_de: null, caveat_de: null },
          { product_id: "prod_leave_in", reason_de: "Passt.", usage_de: null, caveat_de: null },
        ],
      },
    },
    {
      ...baseValidationContext,
      latestUserMessage: prompt,
      recentEvidenceText: prompt,
      toolCallHistory: [
        selectProductsToolCall({
          category: "shampoo",
          requested_product_count: 1,
          count_policy: "exact",
          evidence_quote: prompt,
        }),
        selectProductsToolCall({
          category: "leave_in",
          requested_product_count: 1,
          count_policy: "exact",
          evidence_quote: prompt,
        }),
        selectProductsToolCall({
          category: "deep_cleansing_shampoo",
          requested_product_count: 1,
          count_policy: "exact",
          evidence_quote: prompt,
        }),
      ],
      selectedProductProjections: [
        selectedProjection("prod_shampoo", "Alltagsshampoo"),
        selectedProjection("prod_leave_in", "Leave-in Creme"),
        {
          valid_product_ids: [],
          products: [],
        },
      ],
    },
  )

  assert.equal(result.ok, true, JSON.stringify(result.errors))
})

test("validator does not relax partial success that hides an empty slot", () => {
  const prompt =
    "Bitte empfiehl mir drei konkrete Produkte für feines welliges Haar mit Frizz: Alltagsshampoo, Leave-in und Tiefenreinigung."
  const result = validateAgentV2FinalAnswer(
    {
      ...baseAnswer,
      request_interpretation: requestInterpretation({
        care_category: "shampoo",
        requested_product_count: 3,
        count_policy: "exact",
        evidence_quote: prompt,
      }),
      tool_grounding: {
        ...baseAnswer.tool_grounding,
        product_ids: ["prod_shampoo", "prod_leave_in"],
      },
      payload: {
        ...baseAnswer.payload,
        user_facing_answer_de: "**Alltagsshampoo** und **Leave-in Creme** decken deine Anfrage ab.",
        recommendations: [
          { product_id: "prod_shampoo", reason_de: "Passt.", usage_de: null, caveat_de: null },
          { product_id: "prod_leave_in", reason_de: "Passt.", usage_de: null, caveat_de: null },
        ],
      },
    },
    {
      ...baseValidationContext,
      latestUserMessage: prompt,
      recentEvidenceText: prompt,
      toolCallHistory: [
        selectProductsToolCall({
          category: "shampoo",
          requested_product_count: 1,
          count_policy: "exact",
          evidence_quote: prompt,
        }),
        selectProductsToolCall({
          category: "leave_in",
          requested_product_count: 1,
          count_policy: "exact",
          evidence_quote: prompt,
        }),
        selectProductsToolCall({
          category: "deep_cleansing_shampoo",
          requested_product_count: 1,
          count_policy: "exact",
          evidence_quote: prompt,
        }),
      ],
      selectedProductProjections: [
        selectedProjection("prod_shampoo", "Alltagsshampoo"),
        selectedProjection("prod_leave_in", "Leave-in Creme"),
        {
          valid_product_ids: [],
          products: [],
        },
      ],
    },
  )

  assert.equal(result.ok, false)
  assert.ok(result.errors.some((error) => error.validator_id === "requested_product_count"))
})

test("validator does not relax partial success that names an empty slot without no-match copy", () => {
  const prompt =
    "Bitte empfiehl mir drei konkrete Produkte für feines welliges Haar mit Frizz: Alltagsshampoo, Leave-in und Tiefenreinigung."
  const result = validateAgentV2FinalAnswer(
    {
      ...baseAnswer,
      request_interpretation: requestInterpretation({
        care_category: "shampoo",
        requested_product_count: 3,
        count_policy: "exact",
        evidence_quote: prompt,
      }),
      tool_grounding: {
        ...baseAnswer.tool_grounding,
        product_ids: ["prod_shampoo", "prod_leave_in"],
      },
      payload: {
        ...baseAnswer.payload,
        user_facing_answer_de:
          "**Alltagsshampoo** und **Leave-in Creme** passen; die Tiefenreinigung fehlt.",
        recommendations: [
          { product_id: "prod_shampoo", reason_de: "Passt.", usage_de: null, caveat_de: null },
          { product_id: "prod_leave_in", reason_de: "Passt.", usage_de: null, caveat_de: null },
        ],
      },
    },
    {
      ...baseValidationContext,
      latestUserMessage: prompt,
      recentEvidenceText: prompt,
      toolCallHistory: [
        selectProductsToolCall({
          category: "shampoo",
          requested_product_count: 1,
          count_policy: "exact",
          evidence_quote: prompt,
        }),
        selectProductsToolCall({
          category: "leave_in",
          requested_product_count: 1,
          count_policy: "exact",
          evidence_quote: prompt,
        }),
        selectProductsToolCall({
          category: "deep_cleansing_shampoo",
          requested_product_count: 1,
          count_policy: "exact",
          evidence_quote: prompt,
        }),
      ],
      selectedProductProjections: [
        selectedProjection("prod_shampoo", "Alltagsshampoo"),
        selectedProjection("prod_leave_in", "Leave-in Creme"),
        {
          valid_product_ids: [],
          products: [],
        },
      ],
    },
  )

  assert.equal(result.ok, false)
  assert.ok(result.errors.some((error) => error.validator_id === "requested_product_count"))
})

test("validator does not relax missing-slot copy when safe language refers elsewhere", () => {
  const prompt =
    "Bitte empfiehl mir drei konkrete Produkte für feines welliges Haar mit Frizz: Alltagsshampoo, Leave-in und Tiefenreinigung."
  const result = validateAgentV2FinalAnswer(
    {
      ...baseAnswer,
      request_interpretation: requestInterpretation({
        care_category: "shampoo",
        requested_product_count: 3,
        count_policy: "exact",
        evidence_quote: prompt,
      }),
      tool_grounding: {
        ...baseAnswer.tool_grounding,
        product_ids: ["prod_shampoo", "prod_leave_in"],
      },
      payload: {
        ...baseAnswer.payload,
        user_facing_answer_de:
          "**Alltagsshampoo** und **Leave-in Creme** passen; die Tiefenreinigung fehlt, die beiden sichtbaren Optionen sind sicher.",
        recommendations: [
          { product_id: "prod_shampoo", reason_de: "Passt.", usage_de: null, caveat_de: null },
          { product_id: "prod_leave_in", reason_de: "Passt.", usage_de: null, caveat_de: null },
        ],
      },
    },
    {
      ...baseValidationContext,
      latestUserMessage: prompt,
      recentEvidenceText: prompt,
      toolCallHistory: [
        selectProductsToolCall({
          category: "shampoo",
          requested_product_count: 1,
          count_policy: "exact",
          evidence_quote: prompt,
        }),
        selectProductsToolCall({
          category: "leave_in",
          requested_product_count: 1,
          count_policy: "exact",
          evidence_quote: prompt,
        }),
        selectProductsToolCall({
          category: "deep_cleansing_shampoo",
          requested_product_count: 1,
          count_policy: "exact",
          evidence_quote: prompt,
        }),
      ],
      selectedProductProjections: [
        selectedProjection("prod_shampoo", "Alltagsshampoo"),
        selectedProjection("prod_leave_in", "Leave-in Creme"),
        {
          valid_product_ids: [],
          products: [],
        },
      ],
    },
  )

  assert.equal(result.ok, false)
  assert.ok(result.errors.some((error) => error.validator_id === "requested_product_count"))
})

test("validator allows routine product asks as product recommendations with routine context", () => {
  const result = validateAgentV2FinalAnswer(
    {
      ...baseAnswer,
      request_interpretation: requestInterpretation({
        product_request_kind: "specific_products",
        care_category: "shampoo",
        requested_product_count: null,
        count_policy: "default",
        evidence_quote: "Welches Produkt genau?",
      }),
      routine_context: {
        active: true,
        routine_layer: "deep_dive",
        step_id: "base-shampoo",
        category: "shampoo",
        return_path: ["routine"],
      },
      tool_grounding: {
        ...baseAnswer.tool_grounding,
        routine_step_ids: ["base-shampoo"],
      },
      pending_followup_action: null,
      payload: {
        ...baseAnswer.payload,
        user_facing_answer_de: `${baseAnswer.payload.user_facing_answer_de} Danach gehen wir zur Routine zurück.`,
        next_step_offer_de: "Danach gehen wir zur Routine zurück.",
      },
    },
    {
      ...baseValidationContext,
      latestUserMessage: "Welches Produkt genau?",
      recentEvidenceText: "Welches Produkt genau? base-shampoo",
      toolCallHistory: [
        selectProductsToolCall({
          user_request: "Welches Produkt genau?",
          product_request_kind: "specific_products",
          evidence_quote: "Welches Produkt genau?",
        }),
      ],
      routineThreadContext: {
        active: true,
        current_layer: "basics",
        last_answer_mode: "routine",
        last_routine_categories: ["shampoo"],
        last_user_goal: "Routine verbessern",
        summary_de: "Shampoo ist der Basisschritt.",
        visible_steps: [
          {
            step_id: "base-shampoo",
            label_de: "Shampoo",
            category: "shampoo",
            order: 1,
            routine_layer: "basics",
          },
        ],
      },
      currentRoutineLayer: "basics",
    },
  )

  assert.equal(result.ok, true, JSON.stringify(result.errors))
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
            reason_de: "Passt für die aktuelle Anwendung.",
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
        care_category: "none",
        requested_product_count: null,
        count_policy: "none",
        evidence_quote: "Routine bitte",
      }),
      tool_grounding: {
        ...baseAnswer.tool_grounding,
        used_guidance_package_ids: requiredGuidanceForAnswer("routine"),
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
    general_advice: {
      ...baseAnswer,
      answer_mode: "general_advice",
      request_interpretation: requestInterpretation({
        primary_intent: "category_education",
        product_request_kind: "category_education",
        routine_intent: "explain",
        care_category: "conditioner",
        requested_product_count: null,
        count_policy: "none",
        evidence_quote: "Maske oder Conditioner",
      }),
      tool_grounding: {
        ...baseAnswer.tool_grounding,
        used_guidance_package_ids: requiredGuidanceForAnswer("general_advice", "conditioner"),
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
      request_interpretation: requestInterpretation({
        primary_intent: "clarification",
        product_request_kind: "none",
        routine_intent: "none",
        care_category: "unknown",
        requested_product_count: null,
        count_policy: "none",
        evidence_quote: "Welches Shampoo passt zu mir?",
      }),
      tool_grounding: {
        ...baseAnswer.tool_grounding,
        used_guidance_package_ids: requiredGuidanceForAnswer("clarification"),
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
      request_interpretation: requestInterpretation({
        primary_intent: "general_advice",
        product_request_kind: "none",
        routine_intent: "none",
        care_category: "shampoo",
        requested_product_count: null,
        count_policy: "none",
        evidence_quote: "Welches Shampoo passt zu mir?",
      }),
      tool_grounding: {
        ...baseAnswer.tool_grounding,
        used_guidance_package_ids: requiredGuidanceForAnswer("constraint_blocked", "shampoo"),
        used_product_tool: false,
        product_ids: [],
      },
      payload: {
        user_facing_answer_de:
          "Mit deiner Einschränkung gibt es aktuell keine geeigneten Produkte wegen deiner Ausschlüsse.",
        blocking_constraints: ["keine geeigneten Produkte wegen deiner Ausschlüsse"],
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
        care_category: "none",
        requested_product_count: null,
        count_policy: "none",
        evidence_quote: "Welches Shampoo passt zu mir?",
      }),
      tool_grounding: {
        ...baseAnswer.tool_grounding,
        used_guidance_package_ids: requiredGuidanceForAnswer("safety_boundary"),
        used_product_tool: false,
        product_ids: [],
      },
      payload: {
        user_facing_answer_de: "Das sollte ärztlich abgeklärt werden.",
        boundary_reason_de: "Möglich medizinischer Kontext.",
        next_step_de: "Bitte ärztlich abklären lassen.",
      },
    },
  } as const

  for (const [answer_mode, answer] of Object.entries(validByMode)) {
    const result = validateAgentV2FinalAnswer(answer, {
      ...baseValidationContext,
      routineProjections:
        answer_mode === "routine"
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
            : answer_mode === "clarification"
              ? []
              : answer_mode === "constraint_blocked"
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
      payload: { user_facing_answer_de: "Ich würde dir dieses Produkt empfehlen." },
    },
    baseValidationContext,
  )

  assert.equal(result.ok, false)
  assert.ok(result.errors.some((error) => error.validator_id === "terminal_schema"))
})

test("validator coerces constraint-shaped safety payloads", () => {
  const result = validateAgentV2FinalAnswer(
    {
      ...baseAnswer,
      answer_mode: "safety_boundary",
      request_interpretation: requestInterpretation({
        primary_intent: "safety_boundary",
        product_request_kind: "none",
        routine_intent: "none",
        care_category: "none",
        requested_product_count: null,
        count_policy: "none",
        evidence_quote: "Meine Kopfhaut brennt",
      }),
      tool_grounding: {
        ...baseAnswer.tool_grounding,
        used_guidance_package_ids: requiredGuidanceForAnswer("safety_boundary"),
        used_product_tool: false,
        product_ids: [],
        hard_rule_ids: ["safety.no_diagnosis"],
      },
      payload: {
        user_facing_answer_de: "Bitte pausiere das Produkt und lass es abklären.",
        blocking_constraints: ["Brennen der Kopfhaut"],
        safe_alternative_de: "Pausiere das Produkt und hole professionelle Einschätzung.",
      },
    },
    {
      ...baseValidationContext,
      latestUserMessage: "Meine Kopfhaut brennt",
      recentEvidenceText: "Meine Kopfhaut brennt",
      toolCallHistory: [{ name: "load_advisor_guidance", call_id: "call_1" }],
      knownHardRuleIds: ["safety.no_diagnosis"],
      safetyMode: "restricted",
    },
  )

  assert.equal(result.ok, true, JSON.stringify(result.errors))
  assert.equal(result.sanitized_answer?.answer_mode, "safety_boundary")
  assert.equal(result.sanitized_answer?.payload.boundary_reason_de, "Brennen der Kopfhaut")
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
        care_category: "conditioner",
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
        care_category: "mask",
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
        care_category: "none",
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

test("validator allows first category-specific routine mutation when current routine inventory exists", () => {
  const result = validateAgentV2FinalAnswer(
    {
      ...baseAnswer,
      answer_mode: "routine",
      request_interpretation: requestInterpretation({
        primary_intent: "routine_mutation",
        product_request_kind: "none",
        routine_intent: "modify",
        care_category: "deep_cleansing_shampoo",
        requested_product_count: null,
        count_policy: "none",
        evidence_quote: "Was soll ich aendern?",
      }),
      tool_grounding: {
        ...baseAnswer.tool_grounding,
        used_guidance_package_ids: requiredGuidanceForAnswer("routine", "deep_cleansing_shampoo"),
        used_product_tool: false,
        used_routine_tool: true,
        product_ids: [],
        routine_step_ids: ["step_baseline", "step_reset"],
        hard_rule_ids: [],
      },
      routine_context: {
        active: true,
        routine_layer: "problems",
        step_id: null,
        category: "deep_cleansing_shampoo",
        return_path: [],
      },
      payload: {
        user_facing_answer_de:
          "Deine Basis bleibt Shampoo + Conditioner. Den Reset würde ich nur gelegentlich einbauen.",
        routine_layer: "problems",
        visible_steps: [
          {
            step_id: "step_baseline",
            label_de: "Shampoo + Conditioner",
            action_de: "Als Basis beibehalten.",
            frequency_de: "regelmäßig",
            reason_de: "Die bestehende Routine bleibt der Ausgangspunkt.",
          },
          {
            step_id: "step_reset",
            label_de: "Reset",
            action_de: "Gelegentlich mit Tiefenreinigung einbauen.",
            frequency_de: "gelegentlich",
            reason_de: "Hilft bei Rückständen, ohne die Basis zu ersetzen.",
          },
        ],
        next_layer_options: ["goals", "problems"],
        next_step_offer_de: null,
      },
    },
    {
      ...baseValidationContext,
      selectedProductProjections: [],
      latestUserMessage: "Ich habe coloriertes, trockenes Haar und Frizz. Was soll ich aendern?",
      recentEvidenceText: "Was soll ich aendern?",
      toolCallHistory: [
        routineToolCall({
          requested_layer: "problems",
          requested_category: "deep_cleansing_shampoo",
          routine_intent: "modify",
          mutation_kind: "add_step",
          evidence_quote: "Was soll ich aendern?",
        }),
      ],
      routineProjections: [
        {
          routine_layer: "problems",
          visible_steps: [{ step_id: "step_baseline" }, { step_id: "step_reset" }],
        },
      ],
      currentRoutineLayer: null,
      hasCurrentRoutineInventory: true,
      requiredGuidancePackageIds: [],
      knownHardRuleIds: [],
    },
  )

  assert.equal(result.ok, true, JSON.stringify(result.errors, null, 2))
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
        care_category: "conditioner",
        requested_product_count: null,
        count_policy: "none",
        evidence_quote: "Maske oder Conditioner",
      }),
      tool_grounding: {
        ...baseAnswer.tool_grounding,
        used_guidance_package_ids: requiredGuidanceForAnswer("general_advice", "conditioner"),
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
      pending_followup_action: {
        kind: "routine_mutation",
        category: "conditioner",
        routine_layer: "basics",
        routine_action: "modify",
        source: "assistant_offer",
      },
      payload: {
        user_facing_answer_de:
          "In deiner vereinfachten Routine wäre Conditioner der Basis-Schritt; eine Maske ist eher optional. Wenn du magst, passe ich danach die Routine an.",
        category_or_topic: "conditioner_vs_mask",
        key_points_de: [
          "Conditioner ist der regelmäßige Pflegeabschluss.",
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
        care_category: "conditioner",
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
        care_category: "mask",
        requested_product_count: null,
        count_policy: "none",
        evidence_quote: "Maske statt Conditioner",
      }),
      tool_grounding: {
        ...baseAnswer.tool_grounding,
        used_guidance_package_ids: requiredGuidanceForAnswer("general_advice"),
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
        care_category: "mask",
        requested_product_count: null,
        count_policy: "none",
        evidence_quote: "Maske statt Conditioner",
      }),
      tool_grounding: {
        ...baseAnswer.tool_grounding,
        used_guidance_package_ids: requiredGuidanceForAnswer("general_advice"),
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
        primary_intent: "general_advice",
        product_request_kind: "none",
        routine_intent: "none",
        care_category: "none",
        requested_product_count: null,
        count_policy: "none",
        evidence_quote: "Mach sie mit Maske statt Conditioner",
      }),
      tool_grounding: {
        ...baseAnswer.tool_grounding,
        used_guidance_package_ids: requiredGuidanceForAnswer("general_advice"),
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
        key_points_de: ["Maske statt Conditioner verwenden."],
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

test("validator blocks routine layer regression using routine thread current layer fallback", () => {
  const result = validateAgentV2FinalAnswer(
    {
      ...baseAnswer,
      answer_mode: "routine",
      request_interpretation: requestInterpretation({
        primary_intent: "routine_mutation",
        product_request_kind: "none",
        routine_intent: "modify",
        care_category: "none",
        requested_product_count: null,
        count_policy: "none",
        evidence_quote: "Routine anpassen",
      }),
      tool_grounding: {
        ...baseAnswer.tool_grounding,
        used_guidance_package_ids: requiredGuidanceForAnswer("routine"),
        used_product_tool: false,
        used_routine_tool: true,
        product_ids: [],
        routine_step_ids: ["step_conditioner"],
        hard_rule_ids: [],
      },
      routine_context: {
        active: true,
        routine_layer: "basics",
        step_id: null,
        category: null,
        return_path: ["routine"],
      },
      payload: {
        user_facing_answer_de: "Conditioner bleibt der Basis-Schritt.",
        routine_layer: "basics",
        visible_steps: [
          {
            step_id: "step_conditioner",
            label_de: "Conditioner",
            action_de: "Nach dem Waschen in die Längen geben.",
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
      selectedProductProjections: [],
      latestUserMessage: "Routine anpassen",
      recentEvidenceText: "Routine anpassen",
      toolCallHistory: [
        routineToolCall({
          requested_layer: "basics",
          requested_category: null,
          routine_intent: "modify",
          mutation_kind: "add_step",
          evidence_quote: "Routine anpassen",
        }),
      ],
      routineProjections: [
        { routine_layer: "basics", visible_steps: [{ step_id: "step_conditioner" }] },
      ],
      routineThreadContext: {
        active: true,
        current_layer: "goals",
        last_answer_mode: "routine",
        last_routine_categories: ["conditioner"],
        last_user_goal: "Routine anpassen",
        summary_de: "Routine ist bereits bei den Zielen.",
        visible_steps: [],
      },
      currentRoutineLayer: null,
      requiredGuidancePackageIds: [],
      knownHardRuleIds: [],
    },
  )

  assert.equal(result.ok, false)
  assert.ok(result.errors.some((error) => error.validator_id === "routine_layer_progression"))
})

test("validator requires routine tool for hand-rolled routine change advice", () => {
  const result = validateAgentV2FinalAnswer(
    {
      ...baseAnswer,
      answer_mode: "general_advice",
      request_interpretation: requestInterpretation({
        primary_intent: "general_advice",
        product_request_kind: "none",
        routine_intent: "none",
        care_category: "none",
        requested_product_count: null,
        count_policy: "none",
        evidence_quote: "Was soll ich aendern?",
      }),
      tool_grounding: {
        ...baseAnswer.tool_grounding,
        used_guidance_package_ids: requiredGuidanceForAnswer("general_advice"),
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
      payload: {
        user_facing_answer_de:
          "Ändere den Conditioner auf mehr Feuchtigkeit, füge ein Leave-in hinzu, nimm einmal pro Woche eine Maske und nutze etwas Öl gegen Frizz.",
        category_or_topic: "routine_change",
        key_points_de: [
          "Conditioner wechseln.",
          "Leave-in ergänzen.",
          "Maske hinzufügen.",
          "Öl verwenden.",
        ],
        next_step_offer_de: null,
      },
    },
    {
      ...baseValidationContext,
      selectedProductProjections: [],
      latestUserMessage: "Ich habe coloriertes, trockenes Haar und Frizz. Was soll ich aendern?",
      recentEvidenceText: "Was soll ich aendern?",
      toolCallHistory: [{ name: "load_advisor_guidance", call_id: "call_guidance" }],
      requiredGuidancePackageIds: [],
      knownHardRuleIds: [],
    },
  )

  assert.equal(result.ok, false)
  assert.ok(result.errors.some((error) => error.validator_id === "routine_tool_required"))
})

test("validator allows placement-only dry shampoo advice without routine tooling", () => {
  const message = "Wo kommt Trockenshampoo in der Routine hin?"
  const result = validateAgentV2FinalAnswer(
    placementOnlyAdviceAnswer(
      message,
      "Trockenshampoo kommt normalerweise zwischen Wäschen an den Ansatz, nicht als pflegender Waschschritt.",
    ),
    {
      ...baseValidationContext,
      selectedProductProjections: [],
      latestUserMessage: message,
      recentEvidenceText: message,
      toolCallHistory: [{ name: "load_advisor_guidance", call_id: "call_guidance" }],
      requiredGuidancePackageIds: [],
      knownHardRuleIds: [],
    },
  )

  assert.equal(result.ok, true, JSON.stringify(result.errors, null, 2))
})

test("validator allows placement-only oil and leave-in advice without routine tooling", () => {
  const message = "Kommt Oel vor oder nach Leave-in?"
  const result = validateAgentV2FinalAnswer(
    placementOnlyAdviceAnswer(
      message,
      "Öl kommt meist nach Leave-in in die Längen und Spitzen, damit es das Finish abrundet.",
    ),
    {
      ...baseValidationContext,
      selectedProductProjections: [],
      latestUserMessage: message,
      recentEvidenceText: message,
      toolCallHistory: [{ name: "load_advisor_guidance", call_id: "call_guidance" }],
      requiredGuidancePackageIds: [],
      knownHardRuleIds: [],
    },
  )

  assert.equal(result.ok, true, JSON.stringify(result.errors, null, 2))
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
        care_category: "none",
        requested_product_count: null,
        count_policy: "none",
        evidence_quote: "fass mir das",
      }),
      tool_grounding: {
        ...baseAnswer.tool_grounding,
        used_guidance_package_ids: requiredGuidanceForAnswer("general_advice"),
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

  assert.equal(result.ok, true, JSON.stringify(result.errors, null, 2))
})

test("validator requires product tool and routine return path for routine product recommendations", () => {
  const result = validateAgentV2FinalAnswer(
    {
      ...baseAnswer,
      answer_mode: "product_recommendation",
      request_interpretation: requestInterpretation({
        product_request_kind: "specific_products",
        care_category: "leave_in",
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
        user_facing_answer_de: "Dafür passt ein leichter Conditioner.",
        recommendations: [],
        comparison_notes_de: [],
        usage_notes_de: [],
        next_step_offer_de: null,
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
  assert.ok(
    result.errors.some((error) => error.validator_id === "routine_context_return_path_required"),
  )
})

test("validator allows nullable next step offer for routine product recommendations with return path", () => {
  const result = validateAgentV2FinalAnswer(
    {
      ...baseAnswer,
      answer_mode: "product_recommendation",
      request_interpretation: requestInterpretation({
        product_request_kind: "specific_products",
        care_category: "leave_in",
        requested_product_count: 1,
        count_policy: "exact",
        evidence_quote: "das von Pantene",
      }),
      tool_grounding: {
        ...baseAnswer.tool_grounding,
        used_guidance_package_ids: requiredGuidanceForAnswer("product_recommendation", "leave_in"),
        used_product_tool: true,
        product_ids: ["prod_1"],
        routine_step_ids: ["maintenance-leave-in"],
        hard_rule_ids: [],
      },
      routine_context: {
        active: true,
        routine_layer: "goals",
        step_id: "maintenance-leave-in",
        category: "leave_in",
        return_path: ["routine", "leave_in"],
      },
      payload: {
        user_facing_answer_de:
          "Dann nimm **Test Shampoo** sparsam in Längen und Spitzen. Bei deinem Profil würde ich es erstmal klein dosieren.",
        recommendations: [
          {
            product_id: "prod_1",
            reason_de: "Passt als Leave-in-Booster.",
            usage_de: "Sparsam in Längen und Spitzen.",
            caveat_de: null,
          },
        ],
        comparison_notes_de: [],
        usage_notes_de: ["Sparsam in Längen und Spitzen."],
        next_step_offer_de: null,
      },
    },
    {
      ...baseValidationContext,
      latestUserMessage: "das von Pantene",
      recentEvidenceText: "Welches Leave-in passt zu mir? das von Pantene",
      toolCallHistory: [
        selectProductsToolCall({
          category: "leave_in",
          user_request: "das von Pantene",
          product_request_kind: "specific_products",
          requested_product_count: 1,
          count_policy: "exact",
          evidence_quote: "das von Pantene",
        }),
      ],
      routineThreadContext: {
        active: true,
        current_layer: "goals",
        last_answer_mode: "routine",
        last_routine_categories: ["leave_in"],
        last_user_goal: "Leave-in in Routine einbauen",
        summary_de: "Leave-in ist als Kategorie-Schritt in der Routine.",
        visible_steps: [
          {
            step_id: "maintenance-leave-in",
            label_de: "Leave-in / Finish",
            category: "leave_in",
            order: 1,
            routine_layer: "goals",
          },
        ],
      },
      currentRoutineLayer: "goals",
      requiredGuidancePackageIds: [],
      knownHardRuleIds: [],
    },
  )

  assert.equal(result.ok, true, JSON.stringify(result.errors, null, 2))
})

test("validator blocks objective bad conversation closers", () => {
  const cases = [
    {
      text: "Leave-in nutzt du in den Längen. Möchtest du, dass ich dir mehr dazu erkläre?",
      validatorId: "bad_conversation_close_generic",
    },
    {
      text: "Das ist eher ein Reset-Thema. Schick mir den Link, dann prüfe ich, ob es chelatiert.",
      validatorId: "bad_conversation_close_infeasible",
    },
    {
      text: "Die Routine passt so. Soll ich dir die Dosierung erklären? Oder soll ich dir Produkte zeigen?",
      validatorId: "bad_conversation_close_multi_question",
    },
    {
      text: "Das Produkt passt als Leave-in. Wenn du willst, kann ich dir danach passende Produkte empfehlen.",
      validatorId: "bad_conversation_close_redundant",
      answerMode: "product_recommendation",
    },
    {
      text: "Das kann ich so nicht sicher sagen. Kopier mir die INCI rein, dann prüfe ich die Inhaltsstoffe.",
      validatorId: "bad_conversation_close_unsupported_lane",
    },
    {
      text: "Das kann ich so nicht sicher sagen. Wenn du willst, prüfe ich dir die INCI.",
      validatorId: "bad_conversation_close_unsupported_lane",
    },
    {
      text:
        "Dann würde ich dir als erstes ein leichtes Leave-in geben. Eine Maske wäre eher der zweite Schritt, falls der Frizz stark mit Bruch zusammenhängt.\n\n" +
        "Wenn du magst, kann ich dir danach noch sagen, ob eher ein Leave-in oder eine Maske für dich der bessere nächste Schritt wäre.",
      validatorId: "bad_conversation_close_redundant_comparison",
    },
    {
      text:
        "Das klingt eher nach Rückständen am Ansatz oder zu schwerer Pflege als nach zu wenig Waschen. Am ehesten würde ich testen: Shampoo nur am Ansatz, Conditioner nur in Längen und Spitzen, keine schweren Produkte am Oberkopf.\n\n" +
        "Wenn du magst, kann ich dir als Nächstes sagen, ob das bei dir eher nach Rückständen, zu mildem Shampoo oder wirklich fettiger Kopfhaut klingt.",
      validatorId: "bad_conversation_close_redundant_source_triage",
    },
  ]

  for (const testCase of cases) {
    const answer =
      testCase.answerMode === "product_recommendation"
        ? {
            ...baseAnswer,
            payload: {
              ...baseAnswer.payload,
              user_facing_answer_de: testCase.text,
            },
          }
        : {
            ...baseAnswer,
            answer_mode: "general_advice",
            request_interpretation: requestInterpretation({
              primary_intent: "general_advice",
              product_request_kind: "none",
              routine_intent: "none",
              care_category: "none",
              requested_product_count: null,
              count_policy: "none",
              evidence_quote: "Was soll ich tun?",
            }),
            tool_grounding: {
              ...baseAnswer.tool_grounding,
              used_guidance_package_ids: requiredGuidanceForAnswer("general_advice"),
              used_product_tool: false,
              product_ids: [],
              hard_rule_ids: [],
            },
            payload: {
              user_facing_answer_de: testCase.text,
              category_or_topic: "conversation_close",
              key_points_de: ["Kurz erklärt."],
              next_step_offer_de: null,
            },
          }

    const result = validateAgentV2FinalAnswer(answer, {
      ...baseValidationContext,
      selectedProductProjections:
        testCase.answerMode === "product_recommendation"
          ? baseValidationContext.selectedProductProjections
          : [],
      toolCallHistory:
        testCase.answerMode === "product_recommendation" ? [selectProductsToolCall()] : [],
      latestUserMessage: "Was soll ich tun?",
      recentEvidenceText: "Was soll ich tun?",
      requiredGuidancePackageIds: [],
      knownHardRuleIds:
        testCase.answerMode === "product_recommendation"
          ? ["product.no_uncatalogued_products"]
          : [],
    })

    assert.ok(
      result.errors.some((error) => error.validator_id === testCase.validatorId),
      `${testCase.validatorId} missing in ${JSON.stringify(result.errors, null, 2)}`,
    )
  }
})

test("validator checks rendered clarification question close text", () => {
  const result = validateAgentV2FinalAnswer(
    {
      ...baseAnswer,
      answer_mode: "clarification",
      request_interpretation: requestInterpretation({
        primary_intent: "clarification",
        product_request_kind: "none",
        routine_intent: "none",
        care_category: "unknown",
        requested_product_count: null,
        count_policy: "none",
        evidence_quote: "Was soll ich tun?",
      }),
      tool_grounding: {
        ...baseAnswer.tool_grounding,
        used_guidance_package_ids: requiredGuidanceForAnswer("clarification"),
        used_product_tool: false,
        product_ids: [],
        hard_rule_ids: [],
      },
      payload: {
        user_facing_answer_de: "Ich brauche dafür noch eine konkrete Richtung.",
        question_de: "Möchtest du mehr Tipps?",
        missing_keys: ["category"],
      },
    },
    {
      ...baseValidationContext,
      selectedProductProjections: [],
      toolCallHistory: [],
      latestUserMessage: "Was soll ich tun?",
      recentEvidenceText: "Was soll ich tun?",
      requiredGuidancePackageIds: [],
      knownHardRuleIds: [],
    },
  )

  assert.equal(result.ok, false)
  assert.ok(
    result.errors.some(
      (error) =>
        error.validator_id === "bad_conversation_close_generic" &&
        error.path?.join(".") === "payload.question_de",
    ),
    JSON.stringify(result.errors, null, 2),
  )
})

test("validator warns but does not block weak conversation closers", () => {
  const result = validateAgentV2FinalAnswer(
    {
      ...baseAnswer,
      answer_mode: "general_advice",
      request_interpretation: requestInterpretation({
        primary_intent: "general_advice",
        product_request_kind: "none",
        routine_intent: "none",
        care_category: "none",
        requested_product_count: null,
        count_policy: "none",
        evidence_quote: "Mein Conditioner macht alles platt",
      }),
      tool_grounding: {
        ...baseAnswer.tool_grounding,
        used_guidance_package_ids: requiredGuidanceForAnswer("general_advice"),
        used_product_tool: false,
        product_ids: [],
        hard_rule_ids: [],
      },
      payload: {
        user_facing_answer_de:
          "Bei feinem Haar würde ich zuerst Menge und Ansatzabstand prüfen. Das ist meistens der größte Hebel, bevor du die ganze Kategorie wechselst. Dann schauen wir weiter.",
        category_or_topic: "platter conditioner",
        key_points_de: ["Menge und Ansatzabstand prüfen."],
        next_step_offer_de: null,
      },
    },
    {
      ...baseValidationContext,
      selectedProductProjections: [],
      toolCallHistory: [],
      latestUserMessage: "Mein Conditioner macht alles platt",
      recentEvidenceText: "Mein Conditioner macht alles platt",
      requiredGuidancePackageIds: [],
      knownHardRuleIds: [],
    },
  )

  assert.equal(result.ok, true, JSON.stringify(result.errors, null, 2))
  assert.ok(
    result.warnings.some((warning) => warning.validator_id === "conversation_close_weak"),
    JSON.stringify(result.warnings, null, 2),
  )
})

test("validator warns on duplicated medium-length visible answer paragraphs", () => {
  const duplicatedParagraph =
    "Ich habe das Produkt noch nicht eindeutig in unserer Datenbank gefunden. Bitte wähle gleich in der Karte aus, ob eine der Optionen dein Produkt ist, damit ich es nicht vorschnell bewerte."

  const result = validateAgentV2FinalAnswer(
    {
      ...baseAnswer,
      answer_mode: "general_advice",
      request_interpretation: requestInterpretation({
        primary_intent: "general_advice",
        product_request_kind: "none",
        routine_intent: "none",
        care_category: "none",
        requested_product_count: null,
        count_policy: "none",
        evidence_quote: "Ist dieses Produkt gut?",
      }),
      tool_grounding: {
        ...baseAnswer.tool_grounding,
        used_guidance_package_ids: requiredGuidanceForAnswer("general_advice"),
        used_product_tool: false,
        product_ids: [],
        hard_rule_ids: [],
      },
      payload: {
        user_facing_answer_de: `${duplicatedParagraph}\n\n${duplicatedParagraph}`,
        category_or_topic: "product lookup",
        key_points_de: ["Produkt erst nach Auswahl bewerten."],
        next_step_offer_de: null,
      },
    },
    {
      ...baseValidationContext,
      selectedProductProjections: [],
      toolCallHistory: [],
      latestUserMessage: "Ist dieses Produkt gut?",
      recentEvidenceText: "Ist dieses Produkt gut?",
      requiredGuidancePackageIds: [],
      knownHardRuleIds: [],
    },
  )

  assert.equal(result.ok, true, JSON.stringify(result.errors, null, 2))
  assert.ok(
    result.warnings.some(
      (warning) =>
        warning.validator_id === "user_facing_duplicate_visible_paragraph" &&
        warning.path?.join(".") === "payload.user_facing_answer_de",
    ),
    JSON.stringify(result.warnings, null, 2),
  )
})

test("validator warns on adjacent long visible answer paragraphs with high overlap", () => {
  const firstParagraph =
    "Ich habe das Produkt noch nicht eindeutig in unserer Datenbank gefunden. Bitte wähle gleich in der Karte aus, ob eine der Optionen dein Produkt ist, damit ich es nicht vorschnell bewerte."
  const secondParagraph =
    "Ich habe dieses Produkt noch nicht eindeutig in unserer Datenbank gefunden. Bitte wähle gleich in der Karte aus, ob eine der Optionen dein Produkt ist, damit ich es nicht vorschnell einschätze."

  const result = validateAgentV2FinalAnswer(
    {
      ...baseAnswer,
      answer_mode: "general_advice",
      request_interpretation: requestInterpretation({
        primary_intent: "general_advice",
        product_request_kind: "none",
        routine_intent: "none",
        care_category: "none",
        requested_product_count: null,
        count_policy: "none",
        evidence_quote: "Ist dieses Produkt gut?",
      }),
      tool_grounding: {
        ...baseAnswer.tool_grounding,
        used_guidance_package_ids: requiredGuidanceForAnswer("general_advice"),
        used_product_tool: false,
        product_ids: [],
        hard_rule_ids: [],
      },
      payload: {
        user_facing_answer_de: `${firstParagraph}\n\n${secondParagraph}`,
        category_or_topic: "product lookup",
        key_points_de: ["Produkt erst nach Auswahl bewerten."],
        next_step_offer_de: null,
      },
    },
    {
      ...baseValidationContext,
      selectedProductProjections: [],
      toolCallHistory: [],
      latestUserMessage: "Ist dieses Produkt gut?",
      recentEvidenceText: "Ist dieses Produkt gut?",
      requiredGuidancePackageIds: [],
      knownHardRuleIds: [],
    },
  )

  assert.equal(result.ok, true, JSON.stringify(result.errors, null, 2))
  assert.ok(
    result.warnings.some(
      (warning) => warning.validator_id === "user_facing_duplicate_visible_paragraph",
    ),
    JSON.stringify(result.warnings, null, 2),
  )
})

test("validator ignores repeated short visible answer labels", () => {
  const result = validateAgentV2FinalAnswer(
    {
      ...baseAnswer,
      answer_mode: "general_advice",
      request_interpretation: requestInterpretation({
        primary_intent: "general_advice",
        product_request_kind: "none",
        routine_intent: "none",
        care_category: "none",
        requested_product_count: null,
        count_policy: "none",
        evidence_quote: "Was ist die Reihenfolge?",
      }),
      tool_grounding: {
        ...baseAnswer.tool_grounding,
        used_guidance_package_ids: requiredGuidanceForAnswer("general_advice"),
        used_product_tool: false,
        product_ids: [],
        hard_rule_ids: [],
      },
      payload: {
        user_facing_answer_de: "Shampoo\n\nShampoo\n\nConditioner\n\nConditioner",
        category_or_topic: "routine order",
        key_points_de: ["Shampoo vor Conditioner."],
        next_step_offer_de: null,
      },
    },
    {
      ...baseValidationContext,
      selectedProductProjections: [],
      toolCallHistory: [],
      latestUserMessage: "Was ist die Reihenfolge?",
      recentEvidenceText: "Was ist die Reihenfolge?",
      requiredGuidancePackageIds: [],
      knownHardRuleIds: [],
    },
  )

  assert.equal(result.ok, true, JSON.stringify(result.errors, null, 2))
  assert.equal(
    result.warnings.some(
      (warning) => warning.validator_id === "user_facing_duplicate_visible_paragraph",
    ),
    false,
    JSON.stringify(result.warnings, null, 2),
  )
})

test("validator allows honest clean stop for unsupported INCI-list analysis", () => {
  const allowedRefusals = [
    "INCI-Listen kann ich hier nicht verlässlich prüfen oder bewerten. Wenn du eine konkrete Produkteigenschaft wissen willst, bleibe ich lieber bei den sicher hinterlegten Produktdaten.",
    "Ich kann INCI-Listen hier nicht verlässlich analysieren. Wenn du eine konkrete Produkteigenschaft wissen willst, bleibe ich lieber bei den sicher hinterlegten Produktdaten.",
    "Ich kann keine INCI-Listen analysieren. Wenn du eine konkrete Produkteigenschaft wissen willst, bleibe ich lieber bei den sicher hinterlegten Produktdaten.",
  ]

  for (const refusal of allowedRefusals) {
    const result = validateAgentV2FinalAnswer(
      {
        ...baseAnswer,
        answer_mode: "general_advice",
        request_interpretation: requestInterpretation({
          primary_intent: "general_advice",
          product_request_kind: "none",
          routine_intent: "none",
          care_category: "none",
          requested_product_count: null,
          count_policy: "none",
          evidence_quote: "Kannst du die INCI pruefen, wenn ich sie dir schicke?",
        }),
        tool_grounding: {
          ...baseAnswer.tool_grounding,
          used_guidance_package_ids: requiredGuidanceForAnswer("general_advice"),
          used_product_tool: false,
          product_ids: [],
          hard_rule_ids: [],
        },
        payload: {
          user_facing_answer_de: refusal,
          category_or_topic: "unsupported ingredient analysis",
          key_points_de: ["INCI-Analyse ist kein unterstützter Beratungspfad."],
          next_step_offer_de: null,
        },
      },
      {
        ...baseValidationContext,
        selectedProductProjections: [],
        toolCallHistory: [],
        latestUserMessage: "Kannst du die INCI pruefen, wenn ich sie dir schicke?",
        recentEvidenceText: "Kannst du die INCI pruefen, wenn ich sie dir schicke?",
        requiredGuidancePackageIds: [],
        knownHardRuleIds: [],
      },
    )

    assert.equal(result.ok, true, JSON.stringify(result.errors, null, 2))
    assert.equal(
      result.errors.some(
        (error) => error.validator_id === "bad_conversation_close_unsupported_lane",
      ),
      false,
      JSON.stringify(result.errors, null, 2),
    )
  }
})

test("validator blocks carried routine step ids when active routine thread has no visible steps", () => {
  const result = validateAgentV2FinalAnswer(
    {
      ...baseAnswer,
      answer_mode: "product_recommendation",
      request_interpretation: requestInterpretation({
        product_request_kind: "specific_products",
        care_category: "leave_in",
        requested_product_count: null,
        count_policy: "default",
        evidence_quote: "Und wie nutze ich das?",
      }),
      tool_grounding: {
        ...baseAnswer.tool_grounding,
        used_guidance_package_ids: requiredGuidanceForAnswer("product_recommendation", "leave_in"),
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
          "**Test Shampoo** passt hier als leichter Zusatz, weil es dein feines Haar nicht unnötig beschwert.",
        recommendations: [
          {
            product_id: "prod_1",
            reason_de: "Passt als leichter Zusatz.",
            usage_de: "Sparsam in die Längen.",
            caveat_de: null,
          },
        ],
        comparison_notes_de: [],
        usage_notes_de: ["Sparsam in die Längen."],
        next_step_offer_de: "Danach gehen wir zur Routine zurück.",
      },
    },
    {
      ...baseValidationContext,
      latestUserMessage: "Und wie nutze ich das?",
      toolCallHistory: [
        selectProductsToolCall({
          category: "leave_in",
          user_request: "Und wie nutze ich das?",
          product_request_kind: "specific_products",
          evidence_quote: "Und wie nutze ich das?",
        }),
      ],
      routineProjections: [],
      routineThreadContext: {
        active: true,
        current_layer: "basics",
        last_answer_mode: "product_recommendation",
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

test("validator accepts routine product recommendation step ids from active routine thread visible steps", () => {
  const result = validateAgentV2FinalAnswer(
    {
      ...baseAnswer,
      answer_mode: "product_recommendation",
      request_interpretation: requestInterpretation({
        product_request_kind: "specific_products",
        care_category: "leave_in",
        requested_product_count: null,
        count_policy: "default",
        evidence_quote: "Produkt dafuer",
      }),
      tool_grounding: {
        ...baseAnswer.tool_grounding,
        used_guidance_package_ids: requiredGuidanceForAnswer("product_recommendation", "leave_in"),
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
      pending_followup_action: null,
      payload: {
        user_facing_answer_de:
          "**Test Shampoo** passt für den ersten Zusatz. Danach gehen wir zur Routine zurück.",
        recommendations: [
          {
            product_id: "prod_1",
            reason_de: "Passt als leichter Zusatz.",
            usage_de: "Sparsam in die Längen.",
            caveat_de: null,
          },
        ],
        comparison_notes_de: [],
        usage_notes_de: ["Sparsam in die Längen."],
        next_step_offer_de: "Danach gehen wir zur Routine zurück.",
      },
    },
    {
      ...baseValidationContext,
      latestUserMessage: "Und welches Produkt dafuer?",
      toolCallHistory: [
        selectProductsToolCall({
          category: "leave_in",
          user_request: "Und welches Produkt dafuer?",
          product_request_kind: "specific_products",
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

  assert.equal(result.ok, true, JSON.stringify(result.errors, null, 2))
})

test("validator blocks routine product recommendation context categories that disagree with interpretation", () => {
  const result = validateAgentV2FinalAnswer(
    {
      ...baseAnswer,
      answer_mode: "product_recommendation",
      request_interpretation: requestInterpretation({
        product_request_kind: "specific_products",
        care_category: "leave_in",
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
        category: "conditioner",
        return_path: ["routine"],
      },
      payload: {
        user_facing_answer_de: "**Test Shampoo** passt für den ersten Zusatz.",
        recommendations: [
          {
            product_id: "prod_1",
            reason_de: "Passt als leichter Zusatz.",
            usage_de: "Sparsam in die Längen.",
            caveat_de: null,
          },
        ],
        comparison_notes_de: [],
        usage_notes_de: ["Sparsam in die Längen."],
        next_step_offer_de: "Danach gehen wir zur Routine zurück.",
      },
    },
    {
      ...baseValidationContext,
      latestUserMessage: "Und welches Produkt dafuer?",
      toolCallHistory: [
        selectProductsToolCall({
          category: "leave_in",
          user_request: "Und welches Produkt dafuer?",
          product_request_kind: "specific_products",
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
})

test("validator blocks routine product recommendation category that disagrees with referenced routine step", () => {
  const result = validateAgentV2FinalAnswer(
    {
      ...baseAnswer,
      answer_mode: "product_recommendation",
      request_interpretation: requestInterpretation({
        product_request_kind: "specific_products",
        care_category: "conditioner",
        requested_product_count: null,
        count_policy: "default",
        evidence_quote: "Produkt dafuer",
      }),
      tool_grounding: {
        ...baseAnswer.tool_grounding,
        used_guidance_package_ids: requiredGuidanceForAnswer(
          "product_recommendation",
          "conditioner",
        ),
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
        category: "conditioner",
        return_path: ["routine"],
      },
      payload: {
        user_facing_answer_de: "**Test Shampoo** passt für diesen Schritt.",
        recommendations: [
          {
            product_id: "prod_1",
            reason_de: "Passt als Pflege-Schritt.",
            usage_de: "Sparsam in die Längen.",
            caveat_de: null,
          },
        ],
        comparison_notes_de: [],
        usage_notes_de: ["Sparsam in die Längen."],
        next_step_offer_de: "Danach gehen wir zur Routine zurück.",
      },
    },
    {
      ...baseValidationContext,
      latestUserMessage: "Und welches Produkt dafuer?",
      toolCallHistory: [
        selectProductsToolCall({
          category: "conditioner",
          user_request: "Und welches Produkt dafuer?",
          product_request_kind: "specific_products",
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
})

test("validator blocks ungrounded routine product recommendation step ids", () => {
  const result = validateAgentV2FinalAnswer(
    {
      ...baseAnswer,
      answer_mode: "product_recommendation",
      request_interpretation: requestInterpretation({
        product_request_kind: "specific_products",
        care_category: "leave_in",
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
        recommendations: [
          { product_id: "prod_1", reason_de: "Passt.", usage_de: null, caveat_de: null },
        ],
        comparison_notes_de: [],
        usage_notes_de: [],
        next_step_offer_de: "Danach gehen wir zur Routine zurück.",
      },
    },
    {
      ...baseValidationContext,
      latestUserMessage: "Und wie nutze ich das?",
      toolCallHistory: [
        selectProductsToolCall({
          category: "leave_in",
          user_request: "Und wie nutze ich das?",
          product_request_kind: "specific_products",
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
