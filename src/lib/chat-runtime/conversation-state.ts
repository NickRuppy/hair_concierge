import type {
  AgenticTerminalAnswer,
  AgenticTerminalProductCategory,
  AgenticTerminalStatePatch,
  ClassificationResult,
  ConversationProductTopic,
  ConversationPendingOffer,
  ConversationState,
  ConversationStateTopic,
  ConversationStateTransition,
  HairProfile,
  ProductCategory,
  RouterDecision,
  RoutineConversationLayer,
} from "@/lib/types"
import {
  AgentV2RoutineThreadContextSchema,
  AgentV2SessionMemoryWriteSchema,
} from "@/lib/agent-v2/contracts"
import type { AgentV2SelectProductsProjection } from "@/lib/agent-v2/tools/select-products-projection"
import type { BuildOrFixRoutineProjection } from "@/lib/agent/tools/build-or-fix-routine"
import type { SelectedProductsProjection } from "@/lib/agent/tools/select-products"
type AgentV2SelectableCategory = NonNullable<AgentV2SelectProductsProjection["category"]>

const SUPPORTED_PRODUCT_TOPICS = [
  "shampoo",
  "conditioner",
  "leave_in",
  "mask",
  "oil",
  "bondbuilder",
  "deep_cleansing_shampoo",
  "dry_shampoo",
  "peeling",
] as const satisfies readonly ConversationProductTopic[]

const AGENT_V2_SELECTABLE_CATEGORIES = new Set<string>([
  "shampoo",
  "conditioner",
  "leave_in",
  "oil",
  "mask",
  "bondbuilder",
  "deep_cleansing_shampoo",
  "dry_shampoo",
  "peeling",
] as const)

export function createDefaultConversationState(): ConversationState {
  return {
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
  }
}

export function normalizeConversationState(value: unknown): ConversationState {
  if (!isRecord(value)) {
    return createDefaultConversationState()
  }

  return {
    version: 1,
    active_topic: normalizeTopic(value.active_topic),
    routine_layer: normalizeRoutineLayer(value.routine_layer),
    pending_offer: normalizePendingOffer(value.pending_offer),
    answered_slots: normalizeAnsweredSlots(value.answered_slots),
    last_assistant_action:
      typeof value.last_assistant_action === "string" ? value.last_assistant_action : null,
    last_product_category: normalizeTopic(value.last_product_category),
    agent_v2_routine_thread_context: normalizeAgentV2RoutineThreadContext(
      value.agent_v2_routine_thread_context,
    ),
    agent_v2_prior_selected_product_projections: normalizeAgentV2PriorProductProjections(
      value.agent_v2_prior_selected_product_projections,
    ),
    agent_v2_session_memory: normalizeAgentV2SessionMemory(value.agent_v2_session_memory),
  }
}

function normalizeAgentV2RoutineThreadContext(
  value: unknown,
): ConversationState["agent_v2_routine_thread_context"] {
  const parsed = AgentV2RoutineThreadContextSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}

function normalizeAgentV2PriorProductProjections(
  value: unknown,
): NonNullable<ConversationState["agent_v2_prior_selected_product_projections"]> {
  if (!Array.isArray(value)) return []

  return value
    .flatMap((projection) => {
      if (!isRecord(projection)) return []

      const products = Array.isArray(projection.products)
        ? projection.products.flatMap((product, index) => {
            if (!isRecord(product)) return []
            const productId = typeof product.product_id === "string" ? product.product_id : null
            const name = typeof product.name === "string" ? product.name : null
            if (!productId || !name) return []

            return [
              {
                product_id: productId,
                rank: typeof product.rank === "number" ? product.rank : index + 1,
                name,
                brand: typeof product.brand === "string" ? product.brand : null,
                price_eur: typeof product.price_eur === "number" ? product.price_eur : null,
                currency: typeof product.currency === "string" ? product.currency : null,
                fit_reason: typeof product.fit_reason === "string" ? product.fit_reason : "",
                caveat: typeof product.caveat === "string" ? product.caveat : null,
                supported_claims: Array.isArray(product.supported_claims)
                  ? product.supported_claims
                  : [],
                unsupported_requested_signals: Array.isArray(product.unsupported_requested_signals)
                  ? product.unsupported_requested_signals
                  : [],
              },
            ]
          })
        : []

      if (products.length === 0) return []

      return [
        {
          tool_name: "select_products",
          category: normalizeAgentV2ProjectionCategory(projection.category),
          products: products.slice(0, 3),
          valid_product_ids: Array.isArray(projection.valid_product_ids)
            ? projection.valid_product_ids.filter((id): id is string => typeof id === "string")
            : products.map((product) => product.product_id),
        } satisfies Partial<AgentV2SelectProductsProjection>,
      ]
    })
    .slice(-3)
}

function normalizeAgentV2ProjectionCategory(
  value: unknown,
): AgentV2SelectProductsProjection["category"] {
  return typeof value === "string" && AGENT_V2_SELECTABLE_CATEGORIES.has(value)
    ? (value as AgentV2SelectableCategory)
    : null
}

function normalizeAgentV2SessionMemory(
  value: unknown,
): NonNullable<ConversationState["agent_v2_session_memory"]> {
  if (!Array.isArray(value)) return []

  return value
    .flatMap((entry) => {
      const parsed = AgentV2SessionMemoryWriteSchema.safeParse(entry)
      return parsed.success ? [parsed.data] : []
    })
    .slice(-8)
}

export function applyConversationStateToClassification(params: {
  state: ConversationState
  classification: ClassificationResult
  userMessage: string
}): { classification: ClassificationResult; override: string | null } {
  const { state, classification, userMessage } = params

  if (
    !isRoutineClassification(classification) &&
    shouldApplyPendingRoutineAnswerOverride({ state, userMessage })
  ) {
    return {
      classification: {
        ...classification,
        intent: "routine_help",
        product_category: "routine",
        router_confidence: Math.max(classification.router_confidence, 0.75),
      },
      override: "conversation_state_pending_routine_answer",
    }
  }

  return { classification, override: null }
}

export function shouldApplyPendingRoutineAnswerOverride(params: {
  state: ConversationState
  userMessage: string
}): boolean {
  return (
    params.state.active_topic === "routine" &&
    params.state.routine_layer === "basics" &&
    params.state.pending_offer === "routine_goals_or_problems" &&
    params.state.last_assistant_action === "asked_routine_basics" &&
    isLikelyPendingRoutineAnswer(params.userMessage)
  )
}

export function computeConversationStateTransition(params: {
  previousState: ConversationState
  classification: ClassificationResult
  routerDecision: RouterDecision
  userMessage: string
  assistantAction: string | null
  hairProfile: HairProfile | null
  matchedProductCategory: ProductCategory
  classifierOverride?: string | null
}): ConversationStateTransition {
  const previousState = normalizeConversationState(params.previousState)
  let nextState: ConversationState = {
    ...previousState,
    answered_slots: [...previousState.answered_slots],
    last_assistant_action: params.assistantAction,
  }
  let reason = "unchanged"

  const classifiedProductTopic = toSupportedProductTopic(params.classification.product_category)
  const matchedProductTopic = toSupportedProductTopic(params.matchedProductCategory)
  const productTopic = matchedProductTopic ?? classifiedProductTopic
  const requestedRoutineLayer = shouldSelectRoutineLayerFromBasics(previousState)
    ? getRequestedRoutineLayer(params.userMessage)
    : null
  const isUnsupportedStandaloneCategorySwitch =
    params.classification.intent === "product_recommendation" &&
    params.classification.product_category !== null &&
    params.classification.product_category !== "routine" &&
    classifiedProductTopic === null &&
    previousState.active_topic === "routine"

  if (
    params.classification.intent === "product_recommendation" &&
    classifiedProductTopic !== null &&
    previousState.active_topic === "routine"
  ) {
    nextState = {
      ...nextState,
      active_topic: classifiedProductTopic,
      routine_layer: null,
      pending_offer: null,
      last_product_category: classifiedProductTopic,
    }
    reason = "category_switch"
  } else if (isUnsupportedStandaloneCategorySwitch) {
    nextState = {
      ...nextState,
      active_topic: null,
      routine_layer: null,
      pending_offer: null,
      last_product_category: null,
    }
    reason = "category_switch_out_of_scope"
  } else if (previousState.active_topic === "routine" && productTopic !== null) {
    nextState = {
      ...nextState,
      active_topic: "routine",
      routine_layer: "deep_dive",
      pending_offer: null,
      last_product_category: productTopic,
    }
    reason = "routine_category_deep_dive"
  } else if (requestedRoutineLayer !== null) {
    nextState = {
      ...nextState,
      active_topic: "routine",
      routine_layer: requestedRoutineLayer.layer,
      pending_offer: requestedRoutineLayer.includesBoth
        ? "routine_deep_dive"
        : "routine_other_layer",
    }
    reason = requestedRoutineLayer.reason
  } else if (isRoutineClassification(params.classification)) {
    const answeredSlots = mergeAnsweredSlots(
      previousState.answered_slots,
      toAnsweredSlots(params.userMessage, params.hairProfile),
    )

    nextState = {
      ...nextState,
      active_topic: "routine",
      answered_slots: answeredSlots,
      last_product_category: nextState.last_product_category,
    }

    if (previousState.active_topic !== "routine") {
      const shouldAskRoutineBasics =
        params.assistantAction === "asked_routine_basics" ||
        (params.routerDecision.response_mode === "clarify_only" &&
          params.routerDecision.clarification_reason === "missing_routine_frame")

      if (shouldAskRoutineBasics) {
        nextState.routine_layer = "basics"
        nextState.pending_offer = "routine_goals_or_problems"
        reason = "routine_started"
      } else if (params.assistantAction === "answered_routine_basics") {
        nextState.routine_layer = "basics"
        nextState.pending_offer = "routine_goals_or_problems"
        reason = "routine_basics_answered"
      } else if (answeredSlots.length > 0) {
        nextState.routine_layer = answeredSlots.includes("problem") ? "deep_dive" : "goals"
        nextState.pending_offer = answeredSlots.includes("problem") ? null : "routine_deep_dive"
        reason = "routine_started_with_frame"
      } else {
        nextState.routine_layer = "goals"
        nextState.pending_offer = "routine_deep_dive"
        reason = "routine_started_with_frame"
      }
    } else if (
      previousState.routine_layer === "basics" &&
      previousState.pending_offer === "routine_goals_or_problems" &&
      answeredSlots.length > previousState.answered_slots.length
    ) {
      nextState.routine_layer = answeredSlots.includes("problem") ? "problems" : "goals"
      nextState.pending_offer = "routine_deep_dive"
      reason = "routine_basics_answered"
    } else {
      reason = "routine_continued"
    }
  }

  if (
    reason === "unchanged" &&
    previousState.active_topic === "routine" &&
    previousState.routine_layer === "basics" &&
    previousState.pending_offer === "routine_goals_or_problems" &&
    previousState.last_assistant_action === "asked_routine_basics" &&
    params.assistantAction !== "asked_routine_basics" &&
    !isRoutineClassification(params.classification) &&
    productTopic === null
  ) {
    nextState = {
      ...nextState,
      pending_offer: null,
    }
    reason = "routine_pending_offer_dismissed"
  }

  return {
    previous_state: previousState,
    next_state: nextState,
    reason,
    changed_fields: getChangedFields(previousState, nextState),
    classifier_override: params.classifierOverride ?? null,
  }
}

export function resolveAgenticConversationStateTransition(params: {
  previousState: ConversationState | null
  terminalStatePatch: AgenticTerminalAnswer["state_patch"]
  selectedProducts: SelectedProductsProjection | null
  routinePlan: BuildOrFixRoutineProjection | null
}): ConversationStateTransition {
  const previousState = normalizeConversationState(params.previousState)
  const patch = normalizeAgenticTerminalStatePatch(params.terminalStatePatch)
  const selectedProductTopic = shouldApplySelectedProductsOutcome(params.selectedProducts)
    ? toSupportedProductTopic(params.selectedProducts?.category)
    : null

  let nextState: ConversationState = {
    ...previousState,
    active_topic: patch.active_topic,
    routine_layer: patch.active_topic === "routine" ? patch.routine_layer : null,
    pending_offer: null,
    last_assistant_action: patch.last_assistant_action,
    last_product_category: patch.last_product_category,
  }
  let reason = patch.reason || `tool_loop_${patch.topic_relation}`

  if (selectedProductTopic !== null) {
    nextState = {
      ...nextState,
      active_topic: selectedProductTopic,
      routine_layer: null,
      pending_offer: null,
      last_product_category: selectedProductTopic,
    }
    reason = "tool_loop_select_products"
  }

  if (params.routinePlan) {
    nextState = {
      ...nextState,
      active_topic: "routine",
      routine_layer: patch.routine_layer ?? "basics",
      pending_offer: null,
    }
    reason =
      selectedProductTopic !== null
        ? "tool_loop_routine_and_product_tools"
        : "tool_loop_build_or_fix_routine"
  }

  return {
    previous_state: previousState,
    next_state: nextState,
    reason,
    changed_fields: getChangedFields(previousState, nextState),
    classifier_override: null,
    updated_by_engine: "tool_loop",
  }
}

function isRoutineClassification(classification: ClassificationResult): boolean {
  return classification.intent === "routine_help" || classification.product_category === "routine"
}

function isShortPendingRoutineAnswer(message: string): boolean {
  const normalized = message.trim().toLowerCase()
  return normalized.length > 0 && normalized.length <= 180
}

function isLikelyPendingRoutineAnswer(message: string): boolean {
  if (!isShortPendingRoutineAnswer(message)) {
    return false
  }

  const lower = message.trim().toLowerCase()
  if (hasExplicitProductAskSignal(lower)) {
    return false
  }

  return (
    hasRoutineCadenceSignal(lower) ||
    hasProductSignal(lower) ||
    hasProblemOrGoalSignal(lower) ||
    hasAcknowledgementSignal(lower) ||
    hasCategoryFollowupSignal(lower)
  )
}

function toAnsweredSlots(message: string, hairProfile: HairProfile | null): string[] {
  const slots = new Set<string>()
  const lower = message.toLowerCase()
  if (hairProfile?.wash_frequency || hasRoutineCadenceSignal(lower)) {
    slots.add("routine")
  }
  if ((hairProfile?.current_routine_products?.length ?? 0) > 0 || hasProductSignal(lower)) {
    slots.add("products_tried")
  }
  if ((hairProfile?.concerns?.length ?? 0) > 0 || hasProblemSignal(lower)) {
    slots.add("problem")
  }
  return Array.from(slots)
}

function hasRoutineCadenceSignal(lower: string): boolean {
  return /\b(alle|jeden|taeglich|täglich|woche|wochen|tage|tag|mal pro|wasch(?:e|en)?|wäsche)\b/.test(
    lower,
  )
}

function hasProductSignal(lower: string): boolean {
  return /\b(shampoo|conditioner|spuelung|spülung|maske|kur|leave-?in|oel|öl|bondbuilder|bond-builder|bond builder|olaplex|k18|kolaplex|tiefenreinigung|deep cleansing|clarifying|kopfhautpeeling|peeling|scalp scrub|trockenshampoo|dry shampoo)\b/.test(
    lower,
  )
}

function hasProblemSignal(lower: string): boolean {
  return /\b(trocken|frizz|bruch|spliss|fettig|schuppen|juck|strohig|platt|beschwert|build-?up|klett|verknot|glanzlos)\b/.test(
    lower,
  )
}

function hasProblemOrGoalSignal(lower: string): boolean {
  return (
    hasProblemSignal(lower) ||
    /\b(ziel|ziele|wunsch|möchte|moechte|will|mehr volumen|volumen|glanz|definition|definier|weniger|reduzier|bändigen|baendigen|wachstum)\b/.test(
      lower,
    )
  )
}

function hasGoalSignal(lower: string): boolean {
  return /\b(ziel|ziele|goal|goals|wunsch|wünsche|wuensche|möchte|moechte|will|richtung|mehr volumen|volumen|glanz|definition|definier|weniger|reduzier|bändigen|baendigen|wachstum)\b/.test(
    lower,
  )
}

function hasProblemLayerSignal(lower: string): boolean {
  return (
    hasProblemSignal(lower) ||
    /\b(problem|probleme|concern|concerns|sorge|sorgen|thema|themen|fixen|lösen|loesen|verbessern|reparieren|angehen)\b/.test(
      lower,
    )
  )
}

function shouldSelectRoutineLayerFromBasics(state: ConversationState): boolean {
  return (
    state.active_topic === "routine" &&
    state.routine_layer === "basics" &&
    state.pending_offer === "routine_goals_or_problems" &&
    state.last_assistant_action === "answered_routine_basics"
  )
}

function getRequestedRoutineLayer(message: string): {
  layer: Exclude<RoutineConversationLayer, null>
  includesBoth: boolean
  reason: string
} | null {
  const lower = message.trim().toLowerCase()
  const asksForGoals = hasGoalSignal(lower)
  const asksForProblems = hasProblemLayerSignal(lower)

  if (asksForGoals && asksForProblems) {
    return {
      layer: "goals",
      includesBoth: true,
      reason: "routine_goal_and_problem_layers_selected",
    }
  }

  if (asksForGoals) {
    return {
      layer: "goals",
      includesBoth: false,
      reason: "routine_goal_layer_selected",
    }
  }

  if (asksForProblems) {
    return {
      layer: "problems",
      includesBoth: false,
      reason: "routine_problem_layer_selected",
    }
  }

  return null
}

function hasAcknowledgementSignal(lower: string): boolean {
  return /^(ja|nein|genau|okay|ok|klar|gern|gerne|passt|stimmt|lieber nicht|noch nicht)[.!?\s]*$/.test(
    lower,
  )
}

function hasCategoryFollowupSignal(lower: string): boolean {
  return /\b(shampoo|conditioner|spuelung|spülung|leave-?in|maske|kur|oel|öl|bondbuilder|bond-builder|bond builder|olaplex|k18|kolaplex|tiefenreinigung|deep cleansing|clarifying|kopfhautpeeling|peeling|scalp scrub|trockenshampoo|dry shampoo)\b/.test(
    lower,
  )
}

function hasExplicitProductAskSignal(lower: string): boolean {
  const mentionsProductTarget =
    hasCategoryFollowupSignal(lower) || /\bprodukt(?:e|empfehlung|vorschlag)?\b/.test(lower)

  return (
    mentionsProductTarget &&
    /\b(welche?s?|welc\w*|welchen|welcher|empfiehlst|empfehlen|empfehlung|produkt(?:e)?|kaufen|nehmen|verwenden|benutzen|passt|passendes|such(?:e|st)?|finde|konkret)\b/.test(
      lower,
    )
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function normalizeTopic(value: unknown): ConversationStateTopic {
  return value === "routine" || toSupportedProductTopic(value) !== null
    ? (value as ConversationStateTopic)
    : null
}

function normalizeRoutineLayer(value: unknown): RoutineConversationLayer {
  return value === "basics" || value === "goals" || value === "problems" || value === "deep_dive"
    ? value
    : null
}

function normalizePendingOffer(value: unknown): ConversationPendingOffer {
  return value === "routine_goals_or_problems" ||
    value === "routine_other_layer" ||
    value === "routine_deep_dive"
    ? value
    : null
}

function normalizeAnsweredSlots(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  return Array.from(new Set(value.filter((slot): slot is string => typeof slot === "string")))
}

function toSupportedProductTopic(value: unknown): ConversationProductTopic | null {
  return SUPPORTED_PRODUCT_TOPICS.includes(value as ConversationProductTopic)
    ? (value as ConversationProductTopic)
    : null
}

function normalizeAgenticTerminalStatePatch(
  patch: AgenticTerminalStatePatch,
): AgenticTerminalStatePatch {
  const activeTopic = normalizeAgenticTerminalTopic(patch?.active_topic)
  const lastProductCategory = normalizeAgenticTerminalProductCategory(patch?.last_product_category)
  const routineLayer =
    activeTopic === "routine" ? normalizeRoutineLayer(patch?.routine_layer) : null
  const lastAssistantAction = normalizeShortStateText(patch?.last_assistant_action)
  const reason = normalizeShortStateText(patch?.reason)
  const topicRelation = isAgenticTopicRelation(patch?.topic_relation)
    ? patch.topic_relation
    : "unclear"

  return {
    active_topic: activeTopic,
    routine_layer: routineLayer,
    last_product_category: lastProductCategory,
    last_assistant_action: lastAssistantAction,
    topic_relation: topicRelation,
    reason,
  }
}

function normalizeAgenticTerminalTopic(value: unknown): AgenticTerminalStatePatch["active_topic"] {
  return value === "routine" || normalizeAgenticTerminalProductCategory(value) !== null
    ? (value as AgenticTerminalStatePatch["active_topic"])
    : null
}

function normalizeAgenticTerminalProductCategory(value: unknown): AgenticTerminalProductCategory {
  return value === "shampoo" ||
    value === "conditioner" ||
    value === "leave_in" ||
    value === "mask" ||
    value === "oil" ||
    value === "bondbuilder" ||
    value === "deep_cleansing_shampoo" ||
    value === "dry_shampoo" ||
    value === "peeling"
    ? value
    : null
}

function normalizeShortStateText(value: unknown): string {
  return typeof value === "string" ? value.trim().slice(0, 240) : ""
}

function isAgenticTopicRelation(
  value: unknown,
): value is AgenticTerminalStatePatch["topic_relation"] {
  return (
    value === "same_topic" ||
    value === "category_switch" ||
    value === "refinement" ||
    value === "recap" ||
    value === "unclear"
  )
}

function shouldApplySelectedProductsOutcome(
  selectedProducts: SelectedProductsProjection | null,
): boolean {
  if (!selectedProducts?.category) {
    return false
  }

  return !["needs_more_info", "not_recommended", "no_catalog_match"].includes(
    selectedProducts.decision,
  )
}

function mergeAnsweredSlots(current: string[], next: string[]): string[] {
  return Array.from(new Set([...current, ...next]))
}

function getChangedFields(
  previousState: ConversationState,
  nextState: ConversationState,
): string[] {
  const fields: Array<keyof ConversationState> = [
    "version",
    "active_topic",
    "routine_layer",
    "pending_offer",
    "answered_slots",
    "last_assistant_action",
    "last_product_category",
  ]

  return fields.filter(
    (field) => JSON.stringify(previousState[field]) !== JSON.stringify(nextState[field]),
  )
}
