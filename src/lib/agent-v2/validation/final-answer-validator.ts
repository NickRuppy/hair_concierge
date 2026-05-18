import {
  AgentV2AnswerModeSchema,
  AgentV2SessionMemoryWriteSchema,
  AgentV2TerminalAnswerSchema,
  type AgentV2RoutineLayer,
  type AgentV2AnswerMode,
  type AgentV2DroppedSessionMemoryWrite,
  type AgentV2ProductRequestKind,
  type AgentV2RequestInterpretation,
  type AgentV2RoutineIntent,
  type AgentV2RoutineThreadContext,
  type AgentV2SessionMemoryWrite,
  type AgentV2TerminalAnswer,
  type AgentV2ToolCallTrace,
  type AgentV2ValidationError,
} from "@/lib/agent-v2/contracts"
export interface AgentV2FinalAnswerValidationContext {
  selectedProductProjections: readonly {
    valid_product_ids?: readonly string[]
    products?: readonly { product_id?: string; name?: string }[]
  }[]
  routineProjections: readonly {
    routine_layer?: AgentV2RoutineLayer
    visible_steps?: readonly { step_id?: string }[]
  }[]
  latestUserMessage: string
  recentEvidenceText?: string
  toolCallHistory: readonly Partial<AgentV2ToolCallTrace>[]
  safetyMode: "normal" | "restricted" | "hard_short_circuit"
  requiredGuidancePackageIds: readonly string[]
  currentRoutineLayer: "basics" | "goals" | "problems" | "deep_dive" | null
  routineThreadContext?: AgentV2RoutineThreadContext | null
  knownHardRuleIds?: readonly string[]
}

export interface AgentV2FinalAnswerValidationResult {
  ok: boolean
  errors: AgentV2ValidationError[]
  warnings: AgentV2ValidationError[]
  checked_payload_mode: AgentV2AnswerMode | null
  sanitized_answer: AgentV2TerminalAnswer | null
  accepted_session_memory_writes: AgentV2SessionMemoryWrite[]
  dropped_session_memory_writes: AgentV2DroppedSessionMemoryWrite[]
}

export function validateAgentV2FinalAnswer(
  answer: unknown,
  context: AgentV2FinalAnswerValidationContext,
): AgentV2FinalAnswerValidationResult {
  const memorySanitization = sanitizeSessionMemoryWrites(answer, context)
  const parsed = AgentV2TerminalAnswerSchema.safeParse(memorySanitization.answerForSchema)
  if (!parsed.success) {
    const schemaError = buildTerminalSchemaError(memorySanitization.answerForSchema)
    return {
      ok: false,
      checked_payload_mode: null,
      sanitized_answer: null,
      accepted_session_memory_writes: [],
      dropped_session_memory_writes: memorySanitization.dropped,
      errors: [schemaError],
      warnings: [],
    }
  }

  const terminalAnswer = parsed.data
  const findings: AgentV2ValidationError[] = []

  validateModePayload(terminalAnswer, findings)
  validateVisiblePayloadRendered(terminalAnswer, context, findings)
  validateInterpretationEvidence(terminalAnswer, context, findings)
  validateInterpretationConfidence(terminalAnswer, context, findings)
  validateInterpretationAnswerMode(terminalAnswer, findings)
  validateInterpretationToolHistory(terminalAnswer, context, findings)
  validateInterpretationToolArguments(terminalAnswer, context, findings)
  validateProductAnswerShape(terminalAnswer, context, findings)
  validateRequiredGuidance(terminalAnswer, context, findings)
  validateKnownHardRuleIds(terminalAnswer, context, findings)
  validateKnownProductIds(terminalAnswer, context, findings)
  validateKnownRoutineStepIds(terminalAnswer, context, findings)
  validateProductToolRequired(terminalAnswer, context, findings)
  validateRoutineToolRequired(terminalAnswer, context, findings)
  validateRoutineThreadContinuity(terminalAnswer, context, findings)
  validateRoutineProductDeepDive(terminalAnswer, context, findings)
  validateAnswerModeForContext(terminalAnswer, findings)
  validateRoutineLayerProgression(terminalAnswer, context, findings)
  validateGeneralAdviceNoUnaskedProducts(terminalAnswer, findings)
  validateSafety(terminalAnswer, context, findings)
  validateInternalLeakage(terminalAnswer, findings)

  const errors = findings.filter((finding) => finding.severity !== "warn")
  const warnings = findings.filter((finding) => finding.severity === "warn")

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    checked_payload_mode: terminalAnswer.answer_mode,
    sanitized_answer: terminalAnswer,
    accepted_session_memory_writes: terminalAnswer.session_memory_writes,
    dropped_session_memory_writes: memorySanitization.dropped,
  }
}

const payloadFieldsByMode: Record<AgentV2AnswerMode, readonly string[]> = {
  product_recommendation: [
    "user_facing_answer_de",
    "recommendations",
    "comparison_notes_de",
    "usage_notes_de",
    "next_step_offer_de",
  ],
  routine: [
    "user_facing_answer_de",
    "routine_layer",
    "visible_steps",
    "next_layer_options",
    "next_step_offer_de",
  ],
  routine_product_deep_dive: [
    "user_facing_answer_de",
    "step_id",
    "category",
    "recommendations",
    "return_to_routine_offer_de",
  ],
  general_advice: [
    "user_facing_answer_de",
    "category_or_topic",
    "key_points_de",
    "next_step_offer_de",
  ],
  clarification: ["user_facing_answer_de", "question_de", "missing_keys"],
  constraint_blocked: ["user_facing_answer_de", "blocking_constraints", "safe_alternative_de"],
  safety_boundary: ["user_facing_answer_de", "boundary_reason_de", "next_step_de"],
}

const knownPayloadFields = new Set(Object.values(payloadFieldsByMode).flat())
const PRODUCT_TOOL_REQUEST_KINDS = new Set<AgentV2ProductRequestKind>([
  "specific_products",
  "compare_products",
  "product_detail",
  "routine_product_deep_dive",
])
const ROUTINE_TOOL_INTENTS = new Set<AgentV2RoutineIntent>([
  "create",
  "modify",
  "remove_step",
  "replace_product",
])
const PRODUCT_LOW_CONFIDENCE_THRESHOLD = 0.5
const ROUTINE_LOW_CONFIDENCE_THRESHOLD = 0.6
const MEMORY_WRITE_MIN_CONFIDENCE = 0.6
const MIN_EVIDENCE_QUOTE_LENGTH = 6
const SELECT_PRODUCTS_REQUIRED_ARGUMENTS = [
  "category",
  "reason",
  "user_request",
  "constraints",
  "product_request_kind",
  "requested_product_count",
  "count_policy",
  "evidence_quote",
] as const
const BUILD_ROUTINE_REQUIRED_ARGUMENTS = [
  "objective",
  "requested_layer",
  "requested_category",
  "reason",
  "routine_intent",
  "mutation_kind",
  "evidence_quote",
] as const

function buildTerminalSchemaError(answer: unknown): AgentV2ValidationError {
  const baseMessage = "Final answer does not match the AgentV2 terminal schema."
  if (!answer || typeof answer !== "object" || Array.isArray(answer)) {
    return {
      validator_id: "terminal_schema",
      message: `${baseMessage} Submit a JSON object through submit_final_answer.`,
      severity: "block",
    }
  }

  const record = answer as Record<string, unknown>
  const parsedMode = AgentV2AnswerModeSchema.safeParse(record.answer_mode)
  if (!parsedMode.success) {
    return {
      validator_id: "terminal_schema",
      message: `${baseMessage} answer_mode must be one supported AgentV2 answer mode.`,
      severity: "block",
    }
  }

  const expectedFields = payloadFieldsByMode[parsedMode.data]
  const payload =
    record.payload && typeof record.payload === "object" && !Array.isArray(record.payload)
      ? (record.payload as Record<string, unknown>)
      : null
  if (!payload) {
    return {
      validator_id: "terminal_schema",
      message: `${baseMessage} answer_mode "${parsedMode.data}" requires payload object fields: ${expectedFields.join(", ")}.`,
      severity: "block",
    }
  }

  const actualFields = Object.keys(payload)
  const missingFields = expectedFields.filter((field) => !(field in payload))
  const wrongModeFields = actualFields.filter(
    (field) => knownPayloadFields.has(field) && !expectedFields.includes(field),
  )
  const details = [
    `answer_mode "${parsedMode.data}" requires payload fields: ${expectedFields.join(", ")}`,
  ]
  if (missingFields.length > 0) {
    details.push(`missing: ${missingFields.join(", ")}`)
  }
  if (wrongModeFields.length > 0) {
    details.push(`remove fields from another answer mode: ${wrongModeFields.join(", ")}`)
  }

  return {
    validator_id: "terminal_schema",
    message: `${baseMessage} ${details.join("; ")}.`,
    severity: "block",
  }
}

function sanitizeSessionMemoryWrites(
  answer: unknown,
  context: AgentV2FinalAnswerValidationContext,
): {
  answerForSchema: unknown
  dropped: AgentV2DroppedSessionMemoryWrite[]
} {
  if (!answer || typeof answer !== "object" || Array.isArray(answer)) {
    return { answerForSchema: answer, dropped: [] }
  }

  const record = answer as Record<string, unknown>
  if (!Array.isArray(record.session_memory_writes)) {
    return { answerForSchema: answer, dropped: [] }
  }

  const accepted: AgentV2SessionMemoryWrite[] = []
  const dropped: AgentV2DroppedSessionMemoryWrite[] = []
  const evidenceText = normalizeEvidenceText(buildEvidenceText(context))
  const interpretationConfidence = readInterpretationConfidence(record)

  for (const [index, rawWrite] of record.session_memory_writes.entries()) {
    const parsed = AgentV2SessionMemoryWriteSchema.safeParse(rawWrite)
    if (!parsed.success) {
      dropped.push({
        validator_id: "session_memory_schema",
        message: "Session memory write does not match the session memory schema.",
        path: ["session_memory_writes", index],
        write: rawWrite,
      })
      continue
    }

    const memory = parsed.data
    const evidence = normalizeEvidenceText(memory.evidence_quote)
    if (!evidence || !evidenceText.includes(evidence)) {
      dropped.push({
        validator_id: "session_memory_scope",
        message:
          "Session memory writes require an evidence_quote from the latest user message or active session context.",
        path: ["session_memory_writes", index, "evidence_quote"],
        write: rawWrite,
      })
      continue
    }

    if (
      interpretationConfidence !== null &&
      interpretationConfidence < MEMORY_WRITE_MIN_CONFIDENCE
    ) {
      dropped.push({
        validator_id: "session_memory_scope",
        message: "Low-confidence interpretations must not create session memory writes.",
        path: ["session_memory_writes", index],
        write: rawWrite,
      })
      continue
    }

    if (
      /\b(allergie|allergy|schwanger|pregnan|medizin|diagnose|haarausfall|haarverlust|kopfhautkrankheit|hair texture|haartyp)\b/i.test(
        `${memory.type} ${memory.text}`,
      )
    ) {
      dropped.push({
        validator_id: "session_memory_scope",
        message:
          "Session memory must not silently create durable profile, medical, allergy, pregnancy, or hair-type facts.",
        path: ["session_memory_writes", index, "text"],
        write: rawWrite,
      })
      continue
    }

    accepted.push(memory)
  }

  return {
    answerForSchema: {
      ...record,
      session_memory_writes: accepted,
    },
    dropped,
  }
}

function validateModePayload(
  answer: AgentV2TerminalAnswer,
  errors: AgentV2ValidationError[],
): void {
  const userFacingAnswer = readUserFacingAnswer(answer.payload)
  if (!userFacingAnswer) {
    errors.push({
      validator_id: "mode_payload",
      message: `Payload for ${answer.answer_mode} must include user_facing_answer_de.`,
      severity: "block",
    })
  }

  AgentV2AnswerModeSchema.parse(answer.answer_mode)
}

function validateVisiblePayloadRendered(
  answer: AgentV2TerminalAnswer,
  context: AgentV2FinalAnswerValidationContext,
  errors: AgentV2ValidationError[],
): void {
  const userFacing = normalizeVisibleText(readUserFacingAnswer(answer.payload))

  if (answer.answer_mode === "routine") {
    const missingStepLabels = answer.payload.visible_steps
      .map((step) => step.label_de)
      .filter((label) => label.trim().length > 0)
      .filter((label) => !hasNormalizedPhrase(userFacing, label))
    if (missingStepLabels.length > 0) {
      errors.push({
        validator_id: "visible_payload_not_rendered",
        message: `User-facing routine prose must mention every visible routine step label: ${missingStepLabels.join(", ")}`,
        severity: "block",
        path: ["payload", "user_facing_answer_de"],
      })
    }
    return
  }

  if (
    answer.answer_mode === "product_recommendation" ||
    answer.answer_mode === "routine_product_deep_dive"
  ) {
    const productNamesById = resolveSelectedProductNamesById(context)
    const unverifiableProductIds = answer.payload.recommendations
      .map((recommendation) => recommendation.product_id)
      .filter((productId) => !productNamesById.has(productId))
    const unrenderedProductNames = answer.payload.recommendations
      .map((recommendation) => productNamesById.get(recommendation.product_id))
      .filter((name): name is string => Boolean(name))
      .filter((name) => !hasNormalizedPhrase(userFacing, name))

    if (unverifiableProductIds.length > 0) {
      errors.push({
        validator_id: "visible_payload_not_rendered",
        message: `Cannot verify final product rendering without product names for: ${unverifiableProductIds.join(", ")}`,
        severity: "block",
        path: ["payload", "recommendations"],
      })
    }

    if (unrenderedProductNames.length > 0) {
      errors.push({
        validator_id: "visible_payload_not_rendered",
        message: `User-facing prose must mention every final recommended product by name: ${unrenderedProductNames.join(", ")}`,
        severity: "block",
        path: ["payload", "user_facing_answer_de"],
      })
    }
    return
  }

  if (answer.answer_mode === "constraint_blocked") {
    const missingConstraints = answer.payload.blocking_constraints.filter(
      (constraint) => !isConstraintRendered(userFacing, constraint),
    )
    if (missingConstraints.length > 0) {
      errors.push({
        validator_id: "visible_payload_not_rendered",
        message: `User-facing blocked answer prose must mention every blocking constraint: ${missingConstraints.join(", ")}`,
        severity: "block",
        path: ["payload", "user_facing_answer_de"],
      })
    }
  }
}

function validateInterpretationEvidence(
  answer: AgentV2TerminalAnswer,
  context: AgentV2FinalAnswerValidationContext,
  errors: AgentV2ValidationError[],
): void {
  const evidence = normalizeEvidenceText(answer.request_interpretation.evidence_quote)
  const evidenceText = normalizeEvidenceText(buildEvidenceText(context))
  if (!isMeaningfulEvidenceQuote(evidence, context) || !evidenceText.includes(evidence)) {
    errors.push({
      validator_id: "request_interpretation_evidence",
      message:
        "request_interpretation.evidence_quote must quote a meaningful phrase from the latest user message or active session context.",
      severity: "block",
      path: ["request_interpretation", "evidence_quote"],
    })
  }
}

function validateInterpretationConfidence(
  answer: AgentV2TerminalAnswer,
  _context: AgentV2FinalAnswerValidationContext,
  errors: AgentV2ValidationError[],
): void {
  const interpretation = answer.request_interpretation
  if (
    PRODUCT_TOOL_REQUEST_KINDS.has(interpretation.product_request_kind) &&
    interpretation.confidence < PRODUCT_LOW_CONFIDENCE_THRESHOLD &&
    answer.answer_mode !== "clarification"
  ) {
    errors.push({
      validator_id: "request_interpretation_confidence",
      message: "Low-confidence concrete product interpretations must ask a clarification.",
      severity: "block",
      path: ["request_interpretation", "confidence"],
    })
  }

  if (
    ROUTINE_TOOL_INTENTS.has(interpretation.routine_intent) &&
    interpretation.confidence < ROUTINE_LOW_CONFIDENCE_THRESHOLD &&
    answer.answer_mode !== "clarification"
  ) {
    errors.push({
      validator_id: "request_interpretation_confidence",
      message: "Low-confidence routine changes must ask a clarification.",
      severity: "block",
      path: ["request_interpretation", "confidence"],
    })
  }
}

function validateInterpretationAnswerMode(
  answer: AgentV2TerminalAnswer,
  errors: AgentV2ValidationError[],
): void {
  const interpretation = answer.request_interpretation
  if (
    PRODUCT_TOOL_REQUEST_KINDS.has(interpretation.product_request_kind) &&
    answer.answer_mode !== "product_recommendation" &&
    answer.answer_mode !== "routine_product_deep_dive" &&
    answer.answer_mode !== "clarification" &&
    answer.answer_mode !== "constraint_blocked"
  ) {
    errors.push({
      validator_id: "request_interpretation_answer_mode",
      message:
        "Concrete product interpretations must answer with product_recommendation, routine_product_deep_dive, clarification, or constraint_blocked.",
      severity: "block",
      path: ["request_interpretation", "product_request_kind"],
    })
  }

  if (
    interpretation.product_request_kind === "category_education" &&
    answer.answer_mode === "product_recommendation"
  ) {
    errors.push({
      validator_id: "category_advice_no_unasked_products",
      message:
        "Category education must not use product_recommendation mode unless the user asked for concrete products.",
      severity: "block",
      path: ["request_interpretation", "product_request_kind"],
    })
  }

  if (
    ROUTINE_TOOL_INTENTS.has(interpretation.routine_intent) &&
    answer.answer_mode !== "routine" &&
    answer.answer_mode !== "clarification" &&
    answer.answer_mode !== "constraint_blocked"
  ) {
    errors.push({
      validator_id: "request_interpretation_answer_mode",
      message:
        "Routine create/modify/remove/replace interpretations require routine-compatible answer mode.",
      severity: "block",
      path: ["request_interpretation", "routine_intent"],
    })
  }

  if (
    interpretation.primary_intent === "safety_boundary" &&
    answer.answer_mode !== "safety_boundary"
  ) {
    errors.push({
      validator_id: "request_interpretation_answer_mode",
      message: "Safety-boundary interpretations require safety_boundary answer mode.",
      severity: "block",
      path: ["request_interpretation", "primary_intent"],
    })
  }
}

function validateInterpretationToolHistory(
  answer: AgentV2TerminalAnswer,
  context: AgentV2FinalAnswerValidationContext,
  errors: AgentV2ValidationError[],
): void {
  const hasProductToolCall = context.toolCallHistory.some((call) => call.name === "select_products")
  const hasRoutineToolCall = context.toolCallHistory.some(
    (call) => call.name === "build_or_fix_routine",
  )
  const interpretation = answer.request_interpretation

  if (PRODUCT_TOOL_REQUEST_KINDS.has(interpretation.product_request_kind) && !hasProductToolCall) {
    errors.push({
      validator_id: "product_tool_required",
      message: "Concrete product interpretations require a select_products tool call.",
      severity: "block",
      path: ["request_interpretation", "product_request_kind"],
    })
  }

  if (ROUTINE_TOOL_INTENTS.has(interpretation.routine_intent) && !hasRoutineToolCall) {
    errors.push({
      validator_id: "routine_tool_required",
      message:
        "Routine create/modify/remove/replace interpretations require build_or_fix_routine grounding.",
      severity: "block",
      path: ["request_interpretation", "routine_intent"],
    })
  }

  if (
    interpretation.product_request_kind === "category_education" &&
    hasProductToolCall &&
    extractPayloadProductIds(answer).length === 0 &&
    answer.tool_grounding.product_ids.length === 0
  ) {
    errors.push({
      validator_id: "unnecessary_product_tool_call",
      message: "Category education used select_products, but no unasked products were surfaced.",
      severity: "warn",
    })
  }

  if (
    (interpretation.routine_intent === "explain" ||
      interpretation.routine_intent === "summarize") &&
    hasRoutineToolCall &&
    answer.answer_mode !== "routine"
  ) {
    errors.push({
      validator_id: "unnecessary_routine_tool_call",
      message:
        "Routine explanation/summarization used build_or_fix_routine without surfacing a routine.",
      severity: "warn",
    })
  }
}

function validateInterpretationToolArguments(
  answer: AgentV2TerminalAnswer,
  context: AgentV2FinalAnswerValidationContext,
  errors: AgentV2ValidationError[],
): void {
  const interpretation = answer.request_interpretation
  const latestProductTool = [...context.toolCallHistory]
    .reverse()
    .find((call) => call.name === "select_products")
  const latestRoutineTool = [...context.toolCallHistory]
    .reverse()
    .find((call) => call.name === "build_or_fix_routine")

  if (latestProductTool) {
    if (!latestProductTool.arguments) {
      pushMissingToolArgumentsError("select_products", SELECT_PRODUCTS_REQUIRED_ARGUMENTS, errors)
    } else {
      requireToolArguments(
        "select_products",
        latestProductTool.arguments,
        SELECT_PRODUCTS_REQUIRED_ARGUMENTS,
        errors,
      )
      validateToolEvidenceArgument(latestProductTool.arguments, context, "select_products", errors)
    }
  }

  if (latestProductTool?.arguments) {
    compareToolArgument(
      latestProductTool.arguments,
      "product_request_kind",
      interpretation.product_request_kind,
      errors,
    )
    compareToolArgument(
      latestProductTool.arguments,
      "requested_product_count",
      interpretation.requested_product_count,
      errors,
    )
    compareToolArgument(
      latestProductTool.arguments,
      "count_policy",
      interpretation.count_policy,
      errors,
    )
    compareCategoryArgument(latestProductTool.arguments, interpretation, errors)
  }

  if (latestRoutineTool) {
    if (!latestRoutineTool.arguments) {
      pushMissingToolArgumentsError(
        "build_or_fix_routine",
        BUILD_ROUTINE_REQUIRED_ARGUMENTS,
        errors,
      )
    } else {
      requireToolArguments(
        "build_or_fix_routine",
        latestRoutineTool.arguments,
        BUILD_ROUTINE_REQUIRED_ARGUMENTS,
        errors,
      )
      validateToolEvidenceArgument(
        latestRoutineTool.arguments,
        context,
        "build_or_fix_routine",
        errors,
      )
      validateRoutineToolIntentArguments(latestRoutineTool.arguments, interpretation, errors)
    }
  }

  if (latestRoutineTool?.arguments) {
    compareToolArgument(
      latestRoutineTool.arguments,
      "routine_intent",
      interpretation.routine_intent,
      errors,
    )
    compareCategoryArgument(latestRoutineTool.arguments, interpretation, errors)
    compareToolArgument(
      latestRoutineTool.arguments,
      "requested_layer",
      answer.routine_context.routine_layer,
      errors,
    )
  }
}

function validateProductAnswerShape(
  answer: AgentV2TerminalAnswer,
  context: AgentV2FinalAnswerValidationContext,
  errors: AgentV2ValidationError[],
): void {
  if (
    answer.answer_mode !== "product_recommendation" &&
    answer.answer_mode !== "routine_product_deep_dive"
  ) {
    return
  }

  const userFacing = readUserFacingAnswer(answer.payload)
  const rawPropertyPattern =
    /^\s*[-*]\s*(?:\*\*)?(?:Format|Gewicht|Balance|Hitzeschutz|Preis|Besonderheit)(?:\*\*)?\s*:/im
  if (rawPropertyPattern.test(userFacing)) {
    errors.push({
      validator_id: "product_answer_shape",
      message:
        "Product recommendations must not render raw product projection fields as property bullets; use natural fit sentences per product.",
      severity: "block",
    })
  }

  const recommendations = answer.payload.recommendations
  const recommendationIds = new Set(
    recommendations.map((recommendation) => recommendation.product_id),
  )
  const relevantProductProjections = getRelevantProductProjections(
    context.selectedProductProjections,
    recommendationIds,
  )
  const relevantProjectionCounts = relevantProductProjections.map(
    (projection) => projection.valid_product_ids?.length ?? 0,
  )
  const availableRecommendationCount = Math.max(0, ...relevantProjectionCounts)
  const countRequirement = getRecommendationCountRequirement(
    answer.request_interpretation,
    availableRecommendationCount,
  )
  if (countRequirement.kind === "exact" && recommendations.length !== countRequirement.count) {
    errors.push({
      validator_id: "requested_product_count",
      message: `The user asked for ${countRequirement.count} product recommendation(s); return exactly that many when enough valid products are available.`,
      severity: "block",
    })
  } else if (
    countRequirement.kind === "minimum" &&
    recommendations.length < countRequirement.count
  ) {
    errors.push({
      validator_id: "product_answer_shape",
      message: `Product recommendations should surface ${countRequirement.count} grounded options when that many are available.`,
      severity: "block",
    })
  } else if (countRequirement.kind === "cap" && recommendations.length > countRequirement.count) {
    errors.push({
      validator_id: "requested_product_count",
      message: `Product recommendations must not surface more than ${countRequirement.count} option(s) for this request.`,
      severity: "block",
    })
  }
}

function validateRequiredGuidance(
  answer: AgentV2TerminalAnswer,
  context: AgentV2FinalAnswerValidationContext,
  errors: AgentV2ValidationError[],
): void {
  const loaded = new Set(answer.tool_grounding.used_guidance_package_ids)
  const missing = context.requiredGuidancePackageIds.filter((id) => !loaded.has(id))
  if (missing.length > 0) {
    errors.push({
      validator_id: "required_guidance_loaded",
      message: `Missing required guidance packages: ${missing.join(", ")}`,
      severity: "block",
    })
  }
}

function validateKnownHardRuleIds(
  answer: AgentV2TerminalAnswer,
  context: AgentV2FinalAnswerValidationContext,
  errors: AgentV2ValidationError[],
): void {
  const known = new Set(context.knownHardRuleIds ?? [])
  const unknown = answer.tool_grounding.hard_rule_ids.filter((id) => !known.has(id))
  if (unknown.length > 0) {
    errors.push({
      validator_id: "known_hard_rule_ids",
      message: `Unknown hard rule IDs: ${unknown.join(", ")}`,
      severity: "block",
    })
  }
}

function validateKnownProductIds(
  answer: AgentV2TerminalAnswer,
  context: AgentV2FinalAnswerValidationContext,
  errors: AgentV2ValidationError[],
): void {
  const known = new Set(
    context.selectedProductProjections.flatMap((projection) => projection.valid_product_ids ?? []),
  )
  const payloadProductIds = extractPayloadProductIds(answer)
  const missingFromGrounding = payloadProductIds.filter(
    (id) => !answer.tool_grounding.product_ids.includes(id),
  )
  if (missingFromGrounding.length > 0) {
    errors.push({
      validator_id: "known_product_ids",
      message: `Payload product IDs must also appear in tool_grounding.product_ids: ${missingFromGrounding.join(", ")}`,
      severity: "block",
    })
  }

  const referencedProductIds = [
    ...new Set([...answer.tool_grounding.product_ids, ...payloadProductIds]),
  ]
  const unknown = referencedProductIds.filter((id) => !known.has(id))
  if (unknown.length > 0) {
    errors.push({
      validator_id: "known_product_ids",
      message: `Final answer references product IDs not returned by select_products: ${unknown.join(", ")}`,
      severity: "block",
    })
  }
}

function validateKnownRoutineStepIds(
  answer: AgentV2TerminalAnswer,
  context: AgentV2FinalAnswerValidationContext,
  errors: AgentV2ValidationError[],
): void {
  const known = new Set([
    ...context.routineProjections.flatMap((projection) =>
      (projection.visible_steps ?? [])
        .map((step) => step.step_id)
        .filter((id): id is string => Boolean(id)),
    ),
    ...(context.routineThreadContext?.active
      ? (context.routineThreadContext.visible_steps ?? []).map((step) => step.step_id)
      : []),
  ])
  const payloadRoutineStepIds = extractPayloadRoutineStepIds(answer)
  const missingFromGrounding = payloadRoutineStepIds.filter(
    (id) => !answer.tool_grounding.routine_step_ids.includes(id),
  )
  if (missingFromGrounding.length > 0) {
    errors.push({
      validator_id: "known_routine_step_ids",
      message: `Payload routine step IDs must also appear in tool_grounding.routine_step_ids: ${missingFromGrounding.join(", ")}`,
      severity: "block",
    })
  }

  const referencedRoutineStepIds = [
    ...new Set([...answer.tool_grounding.routine_step_ids, ...payloadRoutineStepIds]),
  ]
  const unknown = referencedRoutineStepIds.filter((id) => !known.has(id))
  if (unknown.length > 0) {
    errors.push({
      validator_id: "known_routine_step_ids",
      message: `Final answer references routine step IDs not returned by build_or_fix_routine or active routine thread context: ${unknown.join(", ")}`,
      severity: "block",
    })
  }
}

function validateProductToolRequired(
  answer: AgentV2TerminalAnswer,
  context: AgentV2FinalAnswerValidationContext,
  errors: AgentV2ValidationError[],
): void {
  const hasProductToolCall = context.toolCallHistory.some((call) => call.name === "select_products")
  const payloadProductIds = extractPayloadProductIds(answer)
  if (
    (answer.tool_grounding.product_ids.length > 0 ||
      payloadProductIds.length > 0 ||
      answer.answer_mode === "product_recommendation" ||
      answer.answer_mode === "routine_product_deep_dive") &&
    !hasProductToolCall
  ) {
    errors.push({
      validator_id: "product_tool_required",
      message: "Product answers require a select_products tool call.",
      severity: "block",
    })
  }
}

function validateRoutineToolRequired(
  answer: AgentV2TerminalAnswer,
  context: AgentV2FinalAnswerValidationContext,
  errors: AgentV2ValidationError[],
): void {
  const hasRoutineToolCall = context.toolCallHistory.some(
    (call) => call.name === "build_or_fix_routine",
  )
  const payloadRoutineStepIds = extractPayloadRoutineStepIds(answer)
  const routineStepIdsRequireCurrentTool =
    answer.answer_mode !== "routine_product_deep_dive" &&
    (answer.tool_grounding.routine_step_ids.length > 0 || payloadRoutineStepIds.length > 0)
  const requiresRoutineTool =
    answer.answer_mode === "routine" ||
    routineStepIdsRequireCurrentTool ||
    ROUTINE_TOOL_INTENTS.has(answer.request_interpretation.routine_intent)
  if (requiresRoutineTool && !hasRoutineToolCall) {
    errors.push({
      validator_id: "routine_tool_required",
      message: "Routine answers require build_or_fix_routine grounding.",
      severity: "block",
    })
  }
}

function extractPayloadProductIds(answer: AgentV2TerminalAnswer): string[] {
  if (
    answer.answer_mode !== "product_recommendation" &&
    answer.answer_mode !== "routine_product_deep_dive"
  ) {
    return []
  }

  return [
    ...new Set(
      answer.payload.recommendations
        .map((recommendation) => recommendation.product_id)
        .filter((id) => id.trim().length > 0),
    ),
  ]
}

function extractPayloadRoutineStepIds(answer: AgentV2TerminalAnswer): string[] {
  if (answer.answer_mode === "routine") {
    return [
      ...new Set(
        answer.payload.visible_steps
          .map((step) => step.step_id)
          .filter((id) => id.trim().length > 0),
      ),
    ]
  }

  if (answer.answer_mode === "routine_product_deep_dive") {
    return answer.payload.step_id && answer.payload.step_id.trim().length > 0
      ? [answer.payload.step_id]
      : []
  }

  return []
}

function validateRoutineThreadContinuity(
  answer: AgentV2TerminalAnswer,
  context: AgentV2FinalAnswerValidationContext,
  errors: AgentV2ValidationError[],
): void {
  if (!context.routineThreadContext?.active) return
  if (answer.routine_context.active) return
  if (
    answer.request_interpretation.routine_intent === "exit" ||
    answer.request_interpretation.primary_intent === "routine_exit"
  ) {
    return
  }

  errors.push({
    validator_id: "routine_context_continuity",
    message:
      "Active routine threads must keep routine_context.active=true unless the user leaves the routine topic.",
    severity: "block",
  })
}

function validateRoutineProductDeepDive(
  answer: AgentV2TerminalAnswer,
  _context: AgentV2FinalAnswerValidationContext,
  errors: AgentV2ValidationError[],
): void {
  if (answer.answer_mode !== "routine_product_deep_dive") return

  const payload = answer.payload
  if (
    answer.routine_context.return_path.length === 0 ||
    !payload.return_to_routine_offer_de ||
    payload.return_to_routine_offer_de.trim().length === 0
  ) {
    errors.push({
      validator_id: "routine_return_path_required",
      message: "Routine product deep dives must preserve a return path to the routine.",
      severity: "block",
    })
  }
}

function validateAnswerModeForContext(
  answer: AgentV2TerminalAnswer,
  errors: AgentV2ValidationError[],
): void {
  if (
    answer.answer_mode === "product_recommendation" &&
    !PRODUCT_TOOL_REQUEST_KINDS.has(answer.request_interpretation.product_request_kind)
  ) {
    errors.push({
      validator_id: "category_advice_no_unasked_products",
      message:
        "Do not use product_recommendation mode when the user asked category/general advice rather than for concrete products.",
      severity: "block",
    })
  }

  if (
    answer.answer_mode === "product_recommendation" &&
    answer.request_interpretation.product_request_kind === "routine_product_deep_dive"
  ) {
    errors.push({
      validator_id: "routine_product_deep_dive_required",
      message:
        "Concrete product asks inside an active routine thread must use routine_product_deep_dive so the answer can return to the routine.",
      severity: "block",
    })
  }
}

function validateRoutineLayerProgression(
  answer: AgentV2TerminalAnswer,
  context: AgentV2FinalAnswerValidationContext,
  errors: AgentV2ValidationError[],
): void {
  if (answer.answer_mode !== "routine") return

  const requestedLayer = answer.routine_context.routine_layer
  if (!requestedLayer) return

  if (!context.currentRoutineLayer && requestedLayer !== "basics") {
    errors.push({
      validator_id: "routine_layer_progression",
      message: "First routine answer must start with the basics layer.",
      severity: "block",
    })
    return
  }

  const allowedNextLayers: Record<AgentV2RoutineLayer, AgentV2RoutineLayer[]> = {
    basics: ["basics", "goals", "problems", "deep_dive"],
    goals: ["goals", "problems", "deep_dive"],
    problems: ["problems", "goals", "deep_dive"],
    deep_dive: ["goals", "problems", "deep_dive"],
  }
  const currentLayer = context.currentRoutineLayer
  if (currentLayer && !allowedNextLayers[currentLayer].includes(requestedLayer)) {
    errors.push({
      validator_id: "routine_layer_progression",
      message: `Routine layer ${requestedLayer} is not allowed after ${currentLayer}.`,
      severity: "block",
    })
  }
}

function validateGeneralAdviceNoUnaskedProducts(
  answer: AgentV2TerminalAnswer,
  errors: AgentV2ValidationError[],
): void {
  const payload = answer.payload as { recommendations?: unknown }
  const hasRecommendations = Array.isArray(payload.recommendations)
  if (
    answer.answer_mode === "general_advice" &&
    !PRODUCT_TOOL_REQUEST_KINDS.has(answer.request_interpretation.product_request_kind)
  ) {
    if (answer.tool_grounding.product_ids.length > 0 || hasRecommendations) {
      errors.push({
        validator_id: "category_advice_no_unasked_products",
        message: "General advice must not surface unasked product recommendations.",
        severity: "block",
      })
    }
  }
}

function validateSafety(
  answer: AgentV2TerminalAnswer,
  context: AgentV2FinalAnswerValidationContext,
  errors: AgentV2ValidationError[],
): void {
  const userFacing = normalizeVisibleText(readUserFacingAnswer(answer.payload))
  if (context.safetyMode === "hard_short_circuit" && answer.answer_mode !== "safety_boundary") {
    errors.push({
      validator_id: "safety_no_product_first",
      message: "Hard short-circuit safety requires a safety_boundary answer.",
      severity: "block",
    })
  }

  if (
    context.safetyMode === "restricted" &&
    (answer.answer_mode === "product_recommendation" ||
      answer.answer_mode === "routine_product_deep_dive" ||
      PRODUCT_TOOL_REQUEST_KINDS.has(answer.request_interpretation.product_request_kind))
  ) {
    errors.push({
      validator_id: "safety_no_product_first",
      message: "Restricted safety turns must not lead with product recommendations.",
      severity: "block",
    })
  }

  if (
    /\b(heilt|therapiert|diagnose|diagnostiziert|diagnostizieren|stoppt haarausfall)\b/i.test(
      userFacing,
    ) ||
    /\bdas ist (?:ein |eine )?\b(?:ekzem|psoriasis|pilz|infektion|entzundung|krankheit)\b/i.test(
      userFacing,
    ) ||
    /\bdas klingt nach (?:einem |einer |)\b(?:ekzem|psoriasis|pilz|infektion|entzundung|krankheit)\b/i.test(
      userFacing,
    ) ||
    /\bbehandelt\b(?=.*\b(haarausfall|haarverlust|kopfhautkrankheit|ekzem|psoriasis|entzundung|entzuendung|pilz|infektion|krankheit|medizinisch)\b)/i.test(
      userFacing,
    )
  ) {
    errors.push({
      validator_id: "safety_no_treatment_claims",
      message: "User-facing prose includes medical diagnosis or treatment language.",
      severity: "block",
    })
  }
}

function validateInternalLeakage(
  answer: AgentV2TerminalAnswer,
  errors: AgentV2ValidationError[],
): void {
  const userFacing = readUserFacingAnswer(answer.payload).toLocaleLowerCase("de-DE")
  if (
    /\b(validator|trace|regel-id|rule_id|session memory|speichere diese erinnerung)\b/i.test(
      userFacing,
    )
  ) {
    errors.push({
      validator_id: "no_internal_leakage",
      message: "User-facing prose leaks internal tool, trace, or memory language.",
      severity: "block",
    })
  }
}

function readUserFacingAnswer(payload: Record<string, unknown>): string {
  const value = payload.user_facing_answer_de
  return typeof value === "string" ? value.trim() : ""
}

function resolveSelectedProductNamesById(
  context: AgentV2FinalAnswerValidationContext,
): Map<string, string> {
  return new Map(
    context.selectedProductProjections.flatMap((projection) =>
      (projection.products ?? []).flatMap((product) =>
        product.product_id && product.name ? [[product.product_id, product.name] as const] : [],
      ),
    ),
  )
}

function normalizeVisibleText(value: string): string {
  return value
    .toLocaleLowerCase("de-DE")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[\p{P}\p{S}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function hasNormalizedPhrase(normalizedHaystack: string, needle: string): boolean {
  const normalizedNeedle = normalizeVisibleText(needle)
  return normalizedNeedle.length > 0 && normalizedHaystack.includes(normalizedNeedle)
}

function isConstraintRendered(normalizedProse: string, constraint: string): boolean {
  if (hasNormalizedPhrase(normalizedProse, constraint)) return true

  const meaningfulParts = normalizeVisibleText(constraint)
    .split(" ")
    .filter((part) => part.length >= 4)
  if (meaningfulParts.length < 2) return false

  const renderedParts = meaningfulParts.filter((part) => normalizedProse.includes(part))
  return renderedParts.length >= 2
}

function getRecommendationCountRequirement(
  interpretation: AgentV2RequestInterpretation,
  availableRecommendationCount: number,
):
  | { kind: "none" }
  | { kind: "exact"; count: number }
  | { kind: "minimum"; count: number }
  | { kind: "cap"; count: number } {
  if (availableRecommendationCount <= 0 || interpretation.count_policy === "none") {
    return { kind: "none" }
  }

  const requestedCount = interpretation.requested_product_count ?? 0
  if (interpretation.count_policy === "exact" && requestedCount > 0) {
    return { kind: "exact", count: Math.min(requestedCount, availableRecommendationCount) }
  }

  if (interpretation.count_policy === "default") {
    return { kind: "minimum", count: Math.min(3, availableRecommendationCount) }
  }

  if (interpretation.count_policy === "cap" && requestedCount > 0) {
    return { kind: "cap", count: Math.min(3, requestedCount, availableRecommendationCount) }
  }

  return { kind: "none" }
}

function getRelevantProductProjections(
  projections: AgentV2FinalAnswerValidationContext["selectedProductProjections"],
  recommendationIds: Set<string>,
): AgentV2FinalAnswerValidationContext["selectedProductProjections"] {
  if (projections.length === 0) return []

  if (recommendationIds.size > 0) {
    const overlapping = projections.filter((projection) =>
      (projection.valid_product_ids ?? []).some((id) => recommendationIds.has(id)),
    )
    if (overlapping.length > 0) return overlapping
  }

  const latestProjection = projections.at(-1)
  return latestProjection ? [latestProjection] : []
}

function requireToolArguments(
  toolName: string,
  args: Record<string, unknown>,
  requiredKeys: readonly string[],
  errors: AgentV2ValidationError[],
): void {
  const missingKeys = requiredKeys.filter((key) => !(key in args))
  if (missingKeys.length === 0) return
  pushMissingToolArgumentsError(toolName, missingKeys, errors)
}

function pushMissingToolArgumentsError(
  toolName: string,
  missingKeys: readonly string[],
  errors: AgentV2ValidationError[],
): void {
  errors.push({
    validator_id: "request_interpretation_tool_args_match",
    message: `${toolName} must include typed semantic arguments: ${missingKeys.join(", ")}.`,
    severity: "block",
  })
}

function validateToolEvidenceArgument(
  args: Record<string, unknown>,
  context: AgentV2FinalAnswerValidationContext,
  toolName: string,
  errors: AgentV2ValidationError[],
): void {
  const evidence =
    typeof args.evidence_quote === "string" ? normalizeEvidenceText(args.evidence_quote) : ""
  const evidenceText = normalizeEvidenceText(buildEvidenceText(context))
  if (isMeaningfulEvidenceQuote(evidence, context) && evidenceText.includes(evidence)) return

  errors.push({
    validator_id: "request_interpretation_tool_args_match",
    message: `${toolName}.evidence_quote must quote a meaningful phrase from the latest user message or active session context.`,
    severity: "block",
    path: ["request_interpretation", "evidence_quote"],
  })
}

function validateRoutineToolIntentArguments(
  args: Record<string, unknown>,
  interpretation: AgentV2RequestInterpretation,
  errors: AgentV2ValidationError[],
): void {
  const mutationKind = args.mutation_kind
  const objective = args.objective
  const routineIntent = interpretation.routine_intent

  if (routineIntent === "create" && objective !== "build_routine") {
    errors.push({
      validator_id: "request_interpretation_tool_args_match",
      message:
        "Routine create interpretations require build_or_fix_routine.objective=build_routine.",
      severity: "block",
      path: ["request_interpretation", "routine_intent"],
    })
  }

  if (routineIntent === "remove_step" && mutationKind !== "remove_step") {
    errors.push({
      validator_id: "request_interpretation_tool_args_match",
      message:
        "Routine remove_step interpretations require build_or_fix_routine.mutation_kind=remove_step.",
      severity: "block",
      path: ["request_interpretation", "routine_intent"],
    })
  }

  if (routineIntent === "replace_product" && mutationKind !== "replace_product") {
    errors.push({
      validator_id: "request_interpretation_tool_args_match",
      message:
        "Routine replace_product interpretations require build_or_fix_routine.mutation_kind=replace_product.",
      severity: "block",
      path: ["request_interpretation", "routine_intent"],
    })
  }

  if (
    routineIntent === "modify" &&
    (mutationKind === null || mutationKind === undefined || mutationKind === "none")
  ) {
    errors.push({
      validator_id: "request_interpretation_tool_args_match",
      message:
        "Routine modify interpretations require a concrete build_or_fix_routine.mutation_kind.",
      severity: "block",
      path: ["request_interpretation", "routine_intent"],
    })
  }
}

function compareToolArgument(
  args: Record<string, unknown>,
  key: string,
  expected: unknown,
  errors: AgentV2ValidationError[],
): void {
  if (!(key in args)) {
    errors.push({
      validator_id: "request_interpretation_tool_args_match",
      message: `Tool arguments are missing ${key}; terminal request_interpretation cannot be verified.`,
      severity: "block",
      path: ["request_interpretation", key],
    })
    return
  }
  const actual = args[key]
  if (actual === expected) return

  errors.push({
    validator_id: "request_interpretation_tool_args_match",
    message: `Terminal request_interpretation does not match ${key} used in tool arguments.`,
    severity: "block",
    path: ["request_interpretation", key],
  })
}

function compareCategoryArgument(
  args: Record<string, unknown>,
  interpretation: AgentV2RequestInterpretation,
  errors: AgentV2ValidationError[],
): void {
  const actual = "requested_category" in args ? args.requested_category : args.category
  if (interpretation.category === "none" || interpretation.category === "unknown") return
  if (actual === null || actual === undefined || actual === "none") {
    errors.push({
      validator_id: "request_interpretation_tool_args_match",
      message:
        "Tool arguments must include a category when terminal request_interpretation declares one.",
      severity: "block",
      path: ["request_interpretation", "category"],
    })
    return
  }
  if (actual === interpretation.category) return

  errors.push({
    validator_id: "request_interpretation_tool_args_match",
    message:
      "Terminal request_interpretation category does not match the category used in tool arguments.",
    severity: "block",
    path: ["request_interpretation", "category"],
  })
}

function buildEvidenceText(context: AgentV2FinalAnswerValidationContext): string {
  const visibleStepEvidence =
    context.routineThreadContext?.visible_steps.flatMap((step) => [
      step.step_id,
      step.label_de,
      step.category,
      step.routine_layer,
    ]) ?? []

  return [
    context.latestUserMessage,
    context.recentEvidenceText ?? "",
    context.routineThreadContext?.summary_de ?? "",
    context.routineThreadContext?.last_user_goal ?? "",
    ...(context.routineThreadContext?.last_routine_categories ?? []),
    ...visibleStepEvidence,
  ].join("\n")
}

function normalizeEvidenceText(value: string): string {
  return value
    .toLocaleLowerCase("de-DE")
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/^[\s"'“”„‚‘’`´]+|[\s"'“”„‚‘’`´]+$/gu, "")
    .replace(/[\p{P}\p{S}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function isMeaningfulEvidenceQuote(
  normalizedEvidence: string,
  context: AgentV2FinalAnswerValidationContext,
): boolean {
  const compactEvidence = normalizedEvidence.replace(/[^\p{L}\p{N}]+/gu, "")
  const evidenceTokens = normalizedEvidence.split(" ").filter(Boolean)
  if (evidenceTokens.length === 1 && ["shampoo", "routine"].includes(evidenceTokens[0] ?? "")) {
    return false
  }
  if (compactEvidence.length >= MIN_EVIDENCE_QUOTE_LENGTH) return true

  const normalizedLatestMessage = normalizeEvidenceText(context.latestUserMessage)
  const compactLatestMessage = normalizedLatestMessage.replace(/[^\p{L}\p{N}]+/gu, "")
  return (
    compactEvidence.length >= 2 &&
    compactLatestMessage.length >= 2 &&
    normalizedEvidence === normalizedLatestMessage
  )
}

function readInterpretationConfidence(record: Record<string, unknown>): number | null {
  const interpretation = record.request_interpretation
  if (!interpretation || typeof interpretation !== "object" || Array.isArray(interpretation)) {
    return null
  }
  const confidence = (interpretation as Record<string, unknown>).confidence
  return typeof confidence === "number" ? confidence : null
}
