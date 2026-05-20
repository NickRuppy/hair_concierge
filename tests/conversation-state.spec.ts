import { expect, test } from "@playwright/test"
import {
  applyConversationStateToClassification,
  computeConversationStateTransition,
  createDefaultConversationState,
  normalizeConversationState,
  resolveAgenticConversationStateTransition,
  shouldApplyPendingRoutineAnswerOverride,
} from "../src/lib/rag/conversation-state"
import { buildConversationStateUpsertPayload } from "../src/lib/rag/conversation-state-store"
import type { BuildOrFixRoutineProjection } from "../src/lib/agent/tools/build-or-fix-routine"
import type { SelectedProductsProjection } from "../src/lib/agent/tools/select-products"
import type {
  AgenticTerminalStatePatch,
  ClassificationResult,
  ConversationState,
  HairProfile,
} from "../src/lib/types"

function createClassification(overrides: Partial<ClassificationResult> = {}): ClassificationResult {
  return {
    intent: "routine_help",
    product_category: "routine",
    complexity: "multi_constraint",
    needs_clarification: false,
    retrieval_mode: "hybrid",
    normalized_filters: {
      problem: null,
      duration: null,
      products_tried: null,
      routine: null,
      special_circumstances: null,
    },
    router_confidence: 0.92,
    ...overrides,
  }
}

function createProfile(overrides: Partial<HairProfile> = {}): HairProfile {
  return {
    id: "profile-1",
    user_id: "user-1",
    hair_texture: "wavy",
    thickness: "fine",
    density: "medium",
    concerns: [],
    products_used: null,
    wash_frequency: null,
    heat_styling: "never",
    styling_tools: [],
    goals: [],
    cuticle_condition: "smooth",
    protein_moisture_balance: "stretches_bounces",
    scalp_type: "balanced",
    scalp_condition: null,
    chemical_treatment: ["natural"],
    desired_volume: "balanced",
    routine_preference: "balanced",
    current_routine_products: [],
    towel_material: null,
    towel_technique: null,
    drying_method: "air_dry",
    brush_type: null,
    night_protection: [],
    uses_heat_protection: false,
    additional_notes: null,
    conversation_memory: null,
    created_at: "2026-05-03T00:00:00.000Z",
    updated_at: "2026-05-03T00:00:00.000Z",
    ...overrides,
  }
}

function createAgenticPatch(
  overrides: Partial<AgenticTerminalStatePatch> = {},
): AgenticTerminalStatePatch {
  return {
    active_topic: null,
    routine_layer: null,
    last_product_category: null,
    last_assistant_action: "answered_general_followup",
    topic_relation: "unclear",
    reason: "terminal_patch",
    ...overrides,
  }
}

function createSelectedProductsProjection(
  overrides: Partial<SelectedProductsProjection> = {},
): SelectedProductsProjection {
  return {
    category: "shampoo",
    decision: "recommended",
    product_response_policy: "recommend",
    policy_reason: "Enough profile data for a shampoo recommendation.",
    profile_basis: ["Feines Haar", "ausgeglichene Kopfhaut"],
    category_guidance: "Mild reinigen.",
    products: [
      {
        rank: 1,
        product_id: "shampoo-1",
        name: "Eval Shampoo",
        brand: "Chaarlie",
        price_eur: null,
        currency: "EUR",
        fit_reason: "passt zur Kopfhaut",
        caveat: null,
        supported_claims: [],
        unsupported_requested_signals: [],
      },
    ],
    comparison_facts: null,
    missing_info: [],
    unsupported_requested_signals: [],
    ...overrides,
  }
}

function createRoutineProjection(
  overrides: Partial<BuildOrFixRoutineProjection> = {},
): BuildOrFixRoutineProjection {
  return {
    objective: "build_routine",
    steps: [],
    missing_info: [],
    confidence: 0.82,
    ...overrides,
  }
}

test("default conversation state is empty and versioned", () => {
  expect(createDefaultConversationState()).toEqual({
    version: 1,
    active_topic: null,
    routine_layer: null,
    pending_offer: null,
    answered_slots: [],
    last_assistant_action: null,
    last_product_category: null,
  })
})

test("default conversation state returns fresh answered slots arrays", () => {
  const first = createDefaultConversationState()
  const second = createDefaultConversationState()

  first.answered_slots.push("routine")

  expect(second.answered_slots).toEqual([])
})

test("malformed partial conversation state normalizes to safe defaults", () => {
  expect(
    normalizeConversationState({
      version: 999,
      active_topic: "bondbuilder",
      routine_layer: "advanced",
      pending_offer: "upsell",
      answered_slots: ["routine", 123, "problem", "routine"],
      last_assistant_action: false,
      last_product_category: "leave_in",
    }),
  ).toEqual({
    version: 1,
    active_topic: "bondbuilder",
    routine_layer: null,
    pending_offer: null,
    answered_slots: ["routine", "problem"],
    last_assistant_action: null,
    last_product_category: "leave_in",
  })
})

test("routine request opens routine basics state", () => {
  const transition = computeConversationStateTransition({
    previousState: createDefaultConversationState(),
    classification: createClassification(),
    routerDecision: {
      retrieval_mode: "hybrid",
      response_mode: "clarify_only",
      clarification_reason: "missing_routine_frame",
      slot_completeness: 0,
      confidence: 0.92,
      policy_overrides: ["missing_routine_frame"],
    },
    userMessage: "Kannst du mir eine Routine bauen?",
    assistantAction: "asked_routine_basics",
    hairProfile: createProfile(),
    matchedProductCategory: null,
  })

  expect(transition.next_state.active_topic).toBe("routine")
  expect(transition.next_state.routine_layer).toBe("basics")
  expect(transition.next_state.pending_offer).toBe("routine_goals_or_problems")
  expect(transition.reason).toBe("routine_started")
})

test("complete first routine answer stays on routine basics and offers next layers", () => {
  const transition = computeConversationStateTransition({
    previousState: createDefaultConversationState(),
    classification: createClassification(),
    routerDecision: {
      retrieval_mode: "hybrid",
      response_mode: "answer_direct",
      slot_completeness: 1,
      confidence: 0.92,
      policy_overrides: [],
    },
    userMessage:
      "Ich wasche alle 3 Tage mit Shampoo und Conditioner, aber meine Spitzen sind trocken.",
    assistantAction: "answered_routine_basics",
    hairProfile: createProfile(),
    matchedProductCategory: null,
  })

  expect(transition.next_state.active_topic).toBe("routine")
  expect(transition.next_state.routine_layer).toBe("basics")
  expect(transition.next_state.pending_offer).toBe("routine_goals_or_problems")
  expect(transition.next_state.answered_slots).toEqual(["routine", "products_tried", "problem"])
  expect(transition.reason).toBe("routine_basics_answered")
})

test("short answer to pending routine basics keeps route in routine context", () => {
  const previousState: ConversationState = {
    version: 1,
    active_topic: "routine",
    routine_layer: "basics",
    pending_offer: "routine_goals_or_problems",
    answered_slots: [],
    last_assistant_action: "asked_routine_basics",
    last_product_category: null,
  }

  const corrected = applyConversationStateToClassification({
    state: previousState,
    classification: createClassification({
      intent: "general_chat",
      product_category: null,
      router_confidence: 0.52,
    }),
    userMessage: "Alle 3 Tage, Shampoo und Conditioner. Meine Spitzen sind trocken.",
  })

  expect(corrected.classification.intent).toBe("routine_help")
  expect(corrected.classification.product_category).toBe("routine")
  expect(corrected.classification.router_confidence).toBeGreaterThanOrEqual(0.75)
  expect(corrected.classification.normalized_filters).toEqual({
    problem: null,
    duration: null,
    products_tried: null,
    routine: null,
    special_circumstances: null,
  })
  expect(corrected.override).toBe("conversation_state_pending_routine_answer")
})

test("support-category products can answer pending routine basics", () => {
  const previousState: ConversationState = {
    version: 1,
    active_topic: "routine",
    routine_layer: "basics",
    pending_offer: "routine_goals_or_problems",
    answered_slots: [],
    last_assistant_action: "asked_routine_basics",
    last_product_category: null,
  }

  for (const userMessage of [
    "K18 und Olaplex",
    "Kolaplex gegen Haarbruch",
    "Kopfhautpeeling",
    "Deep Cleansing",
    "Dry Shampoo",
  ]) {
    expect(
      shouldApplyPendingRoutineAnswerOverride({
        state: previousState,
        userMessage,
      }),
    ).toBe(true)
  }
})

test("pending routine override does not swallow explicit product requests", () => {
  const previousState: ConversationState = {
    version: 1,
    active_topic: "routine",
    routine_layer: "basics",
    pending_offer: "routine_goals_or_problems",
    answered_slots: [],
    last_assistant_action: "asked_routine_basics",
    last_product_category: null,
  }
  const classification = createClassification({
    intent: "product_recommendation",
    product_category: "shampoo",
    router_confidence: 0.83,
  })

  const corrected = applyConversationStateToClassification({
    state: previousState,
    classification,
    userMessage: "Welches Shampoo empfiehlst du?",
  })

  expect(corrected.classification).toBe(classification)
  expect(corrected.override).toBeNull()
  expect(
    shouldApplyPendingRoutineAnswerOverride({
      state: previousState,
      userMessage: "Welches Shampoo empfiehlst du?",
    }),
  ).toBe(false)
  expect(
    shouldApplyPendingRoutineAnswerOverride({
      state: previousState,
      userMessage: "welcges Shampoo sollte ich verwenden?",
    }),
  ).toBe(false)
})

test("pending routine override requires the assistant to have asked routine basics", () => {
  const staleState: ConversationState = {
    version: 1,
    active_topic: "routine",
    routine_layer: "basics",
    pending_offer: "routine_goals_or_problems",
    answered_slots: [],
    last_assistant_action: "answered_direct",
    last_product_category: null,
  }
  const classification = createClassification({
    intent: "general_chat",
    product_category: null,
    router_confidence: 0.52,
  })

  expect(
    shouldApplyPendingRoutineAnswerOverride({
      state: staleState,
      userMessage: "Ja",
    }),
  ).toBe(false)

  const corrected = applyConversationStateToClassification({
    state: staleState,
    classification,
    userMessage: "Ja",
  })

  expect(corrected.classification).toBe(classification)
  expect(corrected.override).toBeNull()
})

test("pending routine override does not apply after routine basics were answered", () => {
  const answeredBasicsState: ConversationState = {
    version: 1,
    active_topic: "routine",
    routine_layer: "basics",
    pending_offer: "routine_goals_or_problems",
    answered_slots: ["routine", "products_tried"],
    last_assistant_action: "answered_routine_basics",
    last_product_category: null,
  }
  const classification = createClassification({
    intent: "followup",
    product_category: "leave_in",
    router_confidence: 0.72,
  })

  const corrected = applyConversationStateToClassification({
    state: answeredBasicsState,
    classification,
    userMessage: "Und Leave-in?",
  })

  expect(corrected.classification).toBe(classification)
  expect(corrected.override).toBeNull()
  expect(
    shouldApplyPendingRoutineAnswerOverride({
      state: answeredBasicsState,
      userMessage: "Und Leave-in?",
    }),
  ).toBe(false)
})

test("unrelated short general messages do not override pending routine context", () => {
  const previousState: ConversationState = {
    version: 1,
    active_topic: "routine",
    routine_layer: "basics",
    pending_offer: "routine_goals_or_problems",
    answered_slots: [],
    last_assistant_action: "asked_routine_basics",
    last_product_category: null,
  }

  for (const userMessage of [
    "Was ist Silikon?",
    "Danke, andere Frage: Was ist Silikon?",
    "Was heißt kurz?",
  ]) {
    const classification = createClassification({
      intent: "general_chat",
      product_category: null,
      router_confidence: 0.52,
    })
    const corrected = applyConversationStateToClassification({
      state: previousState,
      classification,
      userMessage,
    })

    expect(corrected.classification).toBe(classification)
    expect(corrected.override).toBeNull()
  }
})

test("unrelated non-routine answer clears stale pending routine basics", () => {
  const previousState: ConversationState = {
    version: 1,
    active_topic: "routine",
    routine_layer: "basics",
    pending_offer: "routine_goals_or_problems",
    answered_slots: [],
    last_assistant_action: "asked_routine_basics",
    last_product_category: null,
  }

  const transition = computeConversationStateTransition({
    previousState,
    classification: createClassification({
      intent: "general_chat",
      product_category: null,
      router_confidence: 0.6,
    }),
    routerDecision: {
      retrieval_mode: "hybrid",
      response_mode: "answer_direct",
      slot_completeness: 1,
      confidence: 0.6,
      policy_overrides: [],
    },
    userMessage: "Was ist Silikon?",
    assistantAction: "answered_direct",
    hairProfile: createProfile(),
    matchedProductCategory: null,
  })

  expect(transition.next_state.active_topic).toBe("routine")
  expect(transition.next_state.routine_layer).toBe("basics")
  expect(transition.next_state.pending_offer).toBeNull()
  expect(transition.next_state.last_assistant_action).toBe("answered_direct")
  expect(transition.reason).toBe("routine_pending_offer_dismissed")

  expect(
    shouldApplyPendingRoutineAnswerOverride({
      state: transition.next_state,
      userMessage: "ja",
    }),
  ).toBe(false)
})

test("standalone support-category recommendation switches conversation topic", () => {
  const previousState: ConversationState = {
    version: 1,
    active_topic: "routine",
    routine_layer: "goals",
    pending_offer: "routine_deep_dive",
    answered_slots: ["routine", "problem"],
    last_assistant_action: "offered_routine_deep_dive",
    last_product_category: null,
  }

  const transition = computeConversationStateTransition({
    previousState,
    classification: createClassification({
      intent: "product_recommendation",
      product_category: "bondbuilder",
      router_confidence: 0.83,
    }),
    routerDecision: {
      retrieval_mode: "product_sql_plus_hybrid",
      response_mode: "answer_direct",
      slot_completeness: 1,
      confidence: 0.83,
      policy_overrides: ["category_product_mode"],
    },
    userMessage: "Empfiehl mir bitte einen Bondbuilder.",
    assistantAction: "answered_product_recommendation",
    hairProfile: createProfile(),
    matchedProductCategory: "bondbuilder",
  })

  expect(transition.next_state.active_topic).toBe("bondbuilder")
  expect(transition.next_state.routine_layer).toBeNull()
  expect(transition.next_state.pending_offer).toBeNull()
  expect(transition.next_state.last_product_category).toBe("bondbuilder")
  expect(transition.reason).toBe("category_switch")
})

test("goal follow-up after routine basics advances to goal layer", () => {
  const previousState: ConversationState = {
    version: 1,
    active_topic: "routine",
    routine_layer: "basics",
    pending_offer: "routine_goals_or_problems",
    answered_slots: ["routine", "products_tried"],
    last_assistant_action: "answered_routine_basics",
    last_product_category: null,
  }

  const transition = computeConversationStateTransition({
    previousState,
    classification: createClassification({
      intent: "followup",
      product_category: null,
      router_confidence: 0.74,
    }),
    routerDecision: {
      retrieval_mode: "hybrid",
      response_mode: "answer_direct",
      slot_completeness: 1,
      confidence: 0.74,
      policy_overrides: [],
    },
    userMessage: "Ja, zeig mir bitte, was für meine Ziele und mehr Definition hilft.",
    assistantAction: "answered_routine_goals",
    hairProfile: createProfile(),
    matchedProductCategory: null,
  })

  expect(transition.next_state.active_topic).toBe("routine")
  expect(transition.next_state.routine_layer).toBe("goals")
  expect(transition.next_state.pending_offer).toBe("routine_other_layer")
  expect(transition.reason).toBe("routine_goal_layer_selected")
})

test("problem follow-up after routine basics advances to problem layer", () => {
  const previousState: ConversationState = {
    version: 1,
    active_topic: "routine",
    routine_layer: "basics",
    pending_offer: "routine_goals_or_problems",
    answered_slots: ["routine", "products_tried"],
    last_assistant_action: "answered_routine_basics",
    last_product_category: null,
  }

  const transition = computeConversationStateTransition({
    previousState,
    classification: createClassification({
      intent: "followup",
      product_category: null,
      router_confidence: 0.74,
    }),
    routerDecision: {
      retrieval_mode: "hybrid",
      response_mode: "answer_direct",
      slot_completeness: 1,
      confidence: 0.74,
      policy_overrides: [],
    },
    userMessage: "Lieber die Probleme: wie kann ich Frizz und trockene Spitzen fixen?",
    assistantAction: "answered_routine_problems",
    hairProfile: createProfile(),
    matchedProductCategory: null,
  })

  expect(transition.next_state.active_topic).toBe("routine")
  expect(transition.next_state.routine_layer).toBe("problems")
  expect(transition.next_state.pending_offer).toBe("routine_other_layer")
  expect(transition.reason).toBe("routine_problem_layer_selected")
})

test("combined goal and problem follow-up after routine basics offers deep dive next", () => {
  const previousState: ConversationState = {
    version: 1,
    active_topic: "routine",
    routine_layer: "basics",
    pending_offer: "routine_goals_or_problems",
    answered_slots: ["routine", "products_tried"],
    last_assistant_action: "answered_routine_basics",
    last_product_category: null,
  }

  const transition = computeConversationStateTransition({
    previousState,
    classification: createClassification({
      intent: "followup",
      product_category: null,
      router_confidence: 0.74,
    }),
    routerDecision: {
      retrieval_mode: "hybrid",
      response_mode: "answer_direct",
      slot_completeness: 1,
      confidence: 0.74,
      policy_overrides: [],
    },
    userMessage: "Gerne beides: Ziele und auch die Probleme angehen.",
    assistantAction: "answered_routine_goals_and_problems",
    hairProfile: createProfile(),
    matchedProductCategory: null,
  })

  expect(transition.next_state.active_topic).toBe("routine")
  expect(transition.next_state.routine_layer).toBe("goals")
  expect(transition.next_state.pending_offer).toBe("routine_deep_dive")
  expect(transition.reason).toBe("routine_goal_and_problem_layers_selected")
})

test("explicit category mention inside routine becomes routine deep dive", () => {
  const previousState: ConversationState = {
    version: 1,
    active_topic: "routine",
    routine_layer: "goals",
    pending_offer: "routine_deep_dive",
    answered_slots: ["routine", "problem"],
    last_assistant_action: "offered_routine_deep_dive",
    last_product_category: null,
  }

  const transition = computeConversationStateTransition({
    previousState,
    classification: createClassification({
      intent: "followup",
      product_category: "leave_in",
      router_confidence: 0.8,
    }),
    routerDecision: {
      retrieval_mode: "product_sql_plus_hybrid",
      response_mode: "answer_direct",
      slot_completeness: 1,
      confidence: 0.8,
      policy_overrides: ["category_product_mode"],
    },
    userMessage: "Und was ist mit Leave-in?",
    assistantAction: "answered_routine_deep_dive",
    hairProfile: createProfile(),
    matchedProductCategory: "leave_in",
  })

  expect(transition.next_state.active_topic).toBe("routine")
  expect(transition.next_state.routine_layer).toBe("deep_dive")
  expect(transition.next_state.last_product_category).toBe("leave_in")
  expect(transition.reason).toBe("routine_category_deep_dive")
})

test("vague category mention after routine basics becomes routine deep dive", () => {
  const previousState: ConversationState = {
    version: 1,
    active_topic: "routine",
    routine_layer: "basics",
    pending_offer: "routine_goals_or_problems",
    answered_slots: ["routine", "products_tried"],
    last_assistant_action: "answered_routine_basics",
    last_product_category: null,
  }

  const transition = computeConversationStateTransition({
    previousState,
    classification: createClassification({
      intent: "followup",
      product_category: "leave_in",
      router_confidence: 0.8,
    }),
    routerDecision: {
      retrieval_mode: "hybrid",
      response_mode: "answer_direct",
      slot_completeness: 1,
      confidence: 0.8,
      policy_overrides: [],
    },
    userMessage: "Und Leave-in?",
    assistantAction: "answered_routine_deep_dive",
    hairProfile: createProfile(),
    matchedProductCategory: "leave_in",
  })

  expect(transition.next_state.active_topic).toBe("routine")
  expect(transition.next_state.routine_layer).toBe("deep_dive")
  expect(transition.next_state.pending_offer).toBeNull()
  expect(transition.next_state.last_product_category).toBe("leave_in")
  expect(transition.reason).toBe("routine_category_deep_dive")
})

test("explicit product request inside routine switches to product category", () => {
  const previousState: ConversationState = {
    version: 1,
    active_topic: "routine",
    routine_layer: "basics",
    pending_offer: "routine_goals_or_problems",
    answered_slots: ["routine", "products_tried"],
    last_assistant_action: "answered_routine_basics",
    last_product_category: null,
  }

  const classification = createClassification({
    intent: "product_recommendation",
    product_category: "leave_in",
    router_confidence: 0.86,
  })
  const corrected = applyConversationStateToClassification({
    state: previousState,
    classification,
    userMessage: "Welches Leave-in empfiehlst du mir konkret?",
  })
  const transition = computeConversationStateTransition({
    previousState,
    classification: corrected.classification,
    routerDecision: {
      retrieval_mode: "product_sql_plus_hybrid",
      response_mode: "answer_direct",
      slot_completeness: 1,
      confidence: 0.86,
      policy_overrides: ["category_product_mode"],
    },
    userMessage: "Welches Leave-in empfiehlst du mir konkret?",
    assistantAction: "answered_product_recommendation",
    hairProfile: createProfile(),
    matchedProductCategory: "leave_in",
  })

  expect(corrected.override).toBeNull()
  expect(transition.next_state.active_topic).toBe("leave_in")
  expect(transition.next_state.routine_layer).toBeNull()
  expect(transition.next_state.pending_offer).toBeNull()
  expect(transition.next_state.last_product_category).toBe("leave_in")
  expect(transition.reason).toBe("category_switch")
})

test("state store builds stable upsert payload", () => {
  const state = createDefaultConversationState()
  const transition = {
    previous_state: state,
    next_state: { ...state, active_topic: "routine" as const },
    reason: "routine_started",
    changed_fields: ["active_topic"],
    classifier_override: null,
  }

  const payload = buildConversationStateUpsertPayload({
    conversationId: "conversation-1",
    userId: "user-1",
    transition,
  })

  expect(payload).toMatchObject({
    conversation_id: "conversation-1",
    user_id: "user-1",
    state_version: 1,
    state: transition.next_state,
    last_transition: transition,
  })
  expect(typeof payload.updated_at).toBe("string")
  expect(Number.isNaN(Date.parse(payload.updated_at))).toBe(false)
})

test("agentic state transition lets selected product outcomes override conflicting patches", () => {
  const previousState: ConversationState = {
    version: 1,
    active_topic: "routine",
    routine_layer: "basics",
    pending_offer: "routine_goals_or_problems",
    answered_slots: ["routine"],
    last_assistant_action: "answered_routine_basics",
    last_product_category: null,
  }

  const transition = resolveAgenticConversationStateTransition({
    previousState,
    terminalStatePatch: createAgenticPatch({
      active_topic: "oil",
      last_product_category: "oil",
      last_assistant_action: "answered_product_recommendation",
      topic_relation: "category_switch",
      reason: "model_patch_chose_oil",
    }),
    selectedProducts: createSelectedProductsProjection({ category: "shampoo" }),
    routinePlan: null,
  })

  expect(transition.next_state.active_topic).toBe("shampoo")
  expect(transition.next_state.routine_layer).toBeNull()
  expect(transition.next_state.pending_offer).toBeNull()
  expect(transition.next_state.last_product_category).toBe("shampoo")
  expect(transition.reason).toBe("tool_loop_select_products")
  expect(transition.classifier_override).toBeNull()
  expect(transition.updated_by_engine).toBe("tool_loop")
  expect(transition.changed_fields).toEqual(
    expect.arrayContaining([
      "active_topic",
      "routine_layer",
      "pending_offer",
      "last_assistant_action",
      "last_product_category",
    ]),
  )
})

test("agentic state transition allows tool-less pivots to clear stale product topic", () => {
  const previousState: ConversationState = {
    version: 1,
    active_topic: "shampoo",
    routine_layer: null,
    pending_offer: null,
    answered_slots: [],
    last_assistant_action: "answered_product_recommendation",
    last_product_category: "shampoo",
  }

  const transition = resolveAgenticConversationStateTransition({
    previousState,
    terminalStatePatch: createAgenticPatch({
      active_topic: null,
      routine_layer: null,
      last_product_category: null,
      last_assistant_action: "answered_toolless_topic_pivot",
      topic_relation: "category_switch",
      reason: "topic_pivot_to_blow_drying",
    }),
    selectedProducts: null,
    routinePlan: null,
  })

  expect(transition.next_state.active_topic).toBeNull()
  expect(transition.next_state.last_product_category).toBeNull()
  expect(transition.next_state.last_assistant_action).toBe("answered_toolless_topic_pivot")
  expect(transition.reason).toBe("topic_pivot_to_blow_drying")
  expect(transition.updated_by_engine).toBe("tool_loop")
})

test("agentic state transition lets routine tool outcomes override product-shaped patches", () => {
  const transition = resolveAgenticConversationStateTransition({
    previousState: createDefaultConversationState(),
    terminalStatePatch: createAgenticPatch({
      active_topic: "mask",
      routine_layer: null,
      last_product_category: "mask",
      last_assistant_action: "answered_routine",
      topic_relation: "category_switch",
      reason: "model_patch_chose_mask",
    }),
    selectedProducts: null,
    routinePlan: createRoutineProjection(),
  })

  expect(transition.next_state.active_topic).toBe("routine")
  expect(transition.next_state.routine_layer).toBe("basics")
  expect(transition.next_state.pending_offer).toBeNull()
  expect(transition.next_state.last_product_category).toBe("mask")
  expect(transition.reason).toBe("tool_loop_build_or_fix_routine")
  expect(transition.updated_by_engine).toBe("tool_loop")
})
