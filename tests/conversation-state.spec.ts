import { expect, test } from "@playwright/test"
import {
  applyConversationStateToClassification,
  computeConversationStateTransition,
  createDefaultConversationState,
  normalizeConversationState,
} from "../src/lib/rag/conversation-state"
import { buildConversationStateUpsertPayload } from "../src/lib/rag/conversation-state-store"
import type { ClassificationResult, ConversationState, HairProfile } from "../src/lib/types"

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
    active_topic: null,
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

test("complete first routine request does not leave pending routine basics", () => {
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
    assistantAction: "answered_routine",
    hairProfile: createProfile(),
    matchedProductCategory: null,
  })

  expect(transition.next_state.active_topic).toBe("routine")
  expect(transition.next_state.routine_layer).not.toBe("basics")
  expect(transition.next_state.pending_offer).not.toBe("routine_goals_or_problems")
  expect(transition.next_state.answered_slots).toEqual(["routine", "products_tried", "problem"])
  expect(transition.reason).toBe("routine_started_with_frame")
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

test("unsupported standalone category recommendation clears routine context", () => {
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

  expect(transition.next_state.active_topic).toBeNull()
  expect(transition.next_state.routine_layer).toBeNull()
  expect(transition.next_state.pending_offer).toBeNull()
  expect(transition.next_state.last_product_category).toBeNull()
  expect(transition.reason).toBe("category_switch_out_of_scope")
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
