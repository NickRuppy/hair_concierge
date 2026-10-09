import { expect, test } from "@playwright/test"
import {
  createDefaultConversationState,
  normalizeConversationState,
  resolveAgenticConversationStateTransition,
  shouldApplyPendingRoutineAnswerOverride,
} from "../src/lib/chat-runtime/conversation-state"
import { buildConversationStateUpsertPayload } from "../src/lib/chat-runtime/conversation-state-store"
import type { BuildOrFixRoutineProjection } from "../src/lib/agent/tools/build-or-fix-routine"
import type { SelectedProductsProjection } from "../src/lib/agent/tools/select-products"
import type { AgenticTerminalStatePatch, ConversationState } from "../src/lib/types"

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
    agent_v2_routine_thread_context: null,
    agent_v2_prior_selected_product_projections: [],
    agent_v2_session_memory: [],
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
    agent_v2_routine_thread_context: null,
    agent_v2_prior_selected_product_projections: [],
    agent_v2_session_memory: [],
  })
})

test("cadence and support-category products can answer pending routine basics", () => {
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
    "Alle 3 Tage, Shampoo und Conditioner. Meine Spitzen sind trocken.",
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

  expect(
    shouldApplyPendingRoutineAnswerOverride({
      state: staleState,
      userMessage: "Ja",
    }),
  ).toBe(false)
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
  expect(
    shouldApplyPendingRoutineAnswerOverride({
      state: answeredBasicsState,
      userMessage: "Und Leave-in?",
    }),
  ).toBe(false)
})

test("unrelated short general messages are not pending routine answers", () => {
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
    expect(shouldApplyPendingRoutineAnswerOverride({ state: previousState, userMessage })).toBe(
      false,
    )
  }
})

test("a dismissed stale routine offer does not consume a new acknowledgement", () => {
  const previousState: ConversationState = {
    version: 1,
    active_topic: "routine",
    routine_layer: "basics",
    pending_offer: "routine_goals_or_problems",
    answered_slots: [],
    last_assistant_action: "asked_routine_basics",
    last_product_category: null,
  }

  expect(
    shouldApplyPendingRoutineAnswerOverride({
      state: {
        ...previousState,
        pending_offer: null,
        last_assistant_action: "answered_direct",
      },
      userMessage: "ja",
    }),
  ).toBe(false)
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
