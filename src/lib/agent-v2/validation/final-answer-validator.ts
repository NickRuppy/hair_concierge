import {
  AgentV2AnswerModeSchema,
  type AgentV2CareCategory,
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
  type AgentV2TurnGateResult,
  type AgentV2ValidationError,
} from "@/lib/agent-v2/contracts"
import type { CareBalanceConflict } from "@/lib/recommendation-engine/types"
import { normalizeAgentV2EvidenceText } from "@/lib/agent-v2/evidence-normalization"
import {
  normalizeNamedProductForComparison,
  type AgentV2NamedProductContext,
} from "@/lib/agent-v2/named-product-context"
import { validateUserFacingLanguage } from "@/lib/agent-v2/validation/user-facing-language"
export interface AgentV2FinalAnswerValidationContext {
  selectedProductProjections: readonly {
    valid_product_ids?: readonly string[]
    products?: readonly { product_id?: string; name?: string }[]
  }[]
  productLookupResults?: readonly AgentV2ProductLookupValidationResult[]
  routineProjections: readonly {
    routine_layer?: AgentV2RoutineLayer
    visible_steps?: readonly { step_id?: string }[]
  }[]
  latestUserMessage: string
  recentEvidenceText?: string
  toolCallHistory: readonly Partial<AgentV2ToolCallTrace>[]
  safetyMode: "normal" | "restricted" | "hard_short_circuit"
  requiredGuidancePackageIds: readonly string[]
  loadedGuidancePackageIds?: readonly string[]
  currentRoutineLayer: "basics" | "goals" | "problems" | "deep_dive" | null
  routineThreadContext?: AgentV2RoutineThreadContext | null
  hasCurrentRoutineInventory?: boolean
  currentCareContextConflicts?: readonly CareBalanceConflict[]
  knownHardRuleIds?: readonly string[]
  turnGate?: AgentV2TurnGateResult | null
  namedProductContext?: AgentV2NamedProductContext | null
  productIntakeEnabled?: boolean
}

export interface AgentV2ProductLookupValidationResult {
  status: string
  category?: string | null
  product?: { id?: string; name?: string } | null
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
  validateTurnGateConsistency(terminalAnswer, context, findings)
  validateInterpretationToolHistory(terminalAnswer, context, findings)
  validateInterpretationToolArguments(terminalAnswer, context, findings)
  validateProductAnswerShape(terminalAnswer, context, findings)
  validateRequiredGuidance(terminalAnswer, context, findings)
  validateKnownHardRuleIds(terminalAnswer, context, findings)
  validateKnownProductIds(terminalAnswer, context, findings)
  validateKnownRoutineStepIds(terminalAnswer, context, findings)
  validateProductToolRequired(terminalAnswer, context, findings)
  validateNamedProductLookupRequired(terminalAnswer, context, findings)
  validateProductLookupResultClaims(terminalAnswer, context, findings)
  validateNamedProductDetailAnswer(terminalAnswer, context, findings)
  validateRoutineToolRequired(terminalAnswer, context, findings)
  validateRoutineThreadContinuity(terminalAnswer, context, findings)
  validateRoutineProductDeepDive(terminalAnswer, context, findings)
  validateRoutineMetadataConsistency(terminalAnswer, context, findings)
  validateAnswerModeForContext(terminalAnswer, findings)
  validatePendingFollowupAction(terminalAnswer, findings)
  validateBoundaryAnswerSideEffects(terminalAnswer, findings)
  validateRoutineLayerProgression(terminalAnswer, context, findings)
  validateCurrentCareContextConflictAcknowledgement(terminalAnswer, context, findings)
  validateGeneralAdviceNoUnaskedProducts(terminalAnswer, findings)
  validateSafety(terminalAnswer, context, findings)
  validateInternalLeakage(terminalAnswer, findings)
  validateUserFacingLanguage(
    terminalAnswer,
    {
      latestUserMessage: context.latestUserMessage,
      recentEvidenceText: context.recentEvidenceText,
    },
    findings,
  )

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

export function sanitizeRepairableEvidenceQuote(
  answer: AgentV2TerminalAnswer,
  errors: readonly AgentV2ValidationError[],
): { answer: AgentV2TerminalAnswer; warning: AgentV2ValidationError } | null {
  const blockingErrors = errors.filter((error) => error.severity !== "warn")
  if (blockingErrors.length === 0) return null
  if (
    !blockingErrors.every(
      (error) =>
        error.validator_id === "request_interpretation_evidence" &&
        error.path?.join(".") === "request_interpretation.evidence_quote" &&
        typeof error.suggested_value === "string" &&
        error.suggested_value.trim().length > 0,
    )
  ) {
    return null
  }

  const suggested = String(blockingErrors[0].suggested_value).trim()
  const sanitizedAnswer = AgentV2TerminalAnswerSchema.parse({
    ...answer,
    request_interpretation: {
      ...answer.request_interpretation,
      evidence_quote: suggested,
    },
  })

  return {
    answer: sanitizedAnswer,
    warning: {
      validator_id: "request_interpretation_evidence_sanitized",
      message:
        "request_interpretation.evidence_quote was sanitized after model repair failed for evidence metadata only.",
      severity: "warn",
      path: ["request_interpretation", "evidence_quote"],
      rejected_value: answer.request_interpretation.evidence_quote,
      suggested_value: suggested,
    },
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
  general_advice: [
    "user_facing_answer_de",
    "category_or_topic",
    "key_points_de",
    "next_step_offer_de",
  ],
  clarification: ["user_facing_answer_de", "question_de", "missing_keys"],
  constraint_blocked: ["user_facing_answer_de", "blocking_constraints", "safe_alternative_de"],
  safety_boundary: ["user_facing_answer_de", "boundary_reason_de", "next_step_de"],
  social: ["user_facing_answer_de", "pivot_de"],
  domain_boundary: ["user_facing_answer_de", "boundary_kind", "redirect_topic_de"],
}

const knownPayloadFields = new Set(Object.values(payloadFieldsByMode).flat())
const PRODUCT_TOOL_REQUEST_KINDS = new Set<AgentV2ProductRequestKind>([
  "specific_products",
  "compare_products",
  "product_detail",
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
const UNRESOLVED_PRODUCT_LOOKUP_STATUSES = new Set([
  "ambiguous",
  "insufficient_identity",
  "not_found",
  "unsupported_category",
])

const ALWAYS_REQUIRED_GUIDANCE_PACKAGE_IDS = [
  "base.advisor_rules.v1",
  "base.answer_contract.v1",
  "base.tone_and_format.v1",
] as const

const BASE_GUIDANCE_BY_ANSWER_MODE: Partial<Record<AgentV2AnswerMode, string[]>> = {
  product_recommendation: ["base.product_recommendation.v1"],
  routine: ["base.routine_building.v1"],
  general_advice: ["base.general_advice.v1"],
  safety_boundary: ["base.safety_boundaries.v1"],
}

const CATEGORY_GUIDANCE_BY_INTERPRETATION: Partial<Record<AgentV2CareCategory, string>> = {
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

function isRoutineProductRecommendation(
  answer: AgentV2TerminalAnswer,
): answer is Extract<AgentV2TerminalAnswer, { answer_mode: "product_recommendation" }> {
  return answer.answer_mode === "product_recommendation" && answer.routine_context.active
}

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

  const record = coerceSafetyBoundaryPayload(answer as Record<string, unknown>)
  if (!Array.isArray(record.session_memory_writes)) {
    return { answerForSchema: record, dropped: [] }
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

function coerceSafetyBoundaryPayload(record: Record<string, unknown>): Record<string, unknown> {
  if (record.answer_mode !== "safety_boundary") return record
  if (!record.payload || typeof record.payload !== "object" || Array.isArray(record.payload)) {
    return record
  }

  const payload = record.payload as Record<string, unknown>
  if ("boundary_reason_de" in payload || "next_step_de" in payload) return record
  if (!("blocking_constraints" in payload) && !("safe_alternative_de" in payload)) return record

  const blockingConstraints = Array.isArray(payload.blocking_constraints)
    ? payload.blocking_constraints.filter((item): item is string => typeof item === "string")
    : []
  const boundaryReason =
    blockingConstraints.length > 0
      ? blockingConstraints.join("; ")
      : "Medizinisch oder reizungsbezogen klingender Kontext."
  const nextStep =
    typeof payload.safe_alternative_de === "string" ? payload.safe_alternative_de : null

  return {
    ...record,
    payload: {
      user_facing_answer_de: payload.user_facing_answer_de,
      boundary_reason_de: boundaryReason,
      next_step_de: nextStep,
    },
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
  const nextStepOffer = readNextStepOffer(answer)
  if (nextStepOffer && !isNextStepOfferRendered(userFacing, nextStepOffer)) {
    errors.push({
      validator_id: "visible_payload_not_rendered",
      message:
        "User-facing prose must visibly include next_step_offer_de when it creates a pending follow-up action.",
      severity: "block",
      path: ["payload", "user_facing_answer_de"],
    })
  }

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

  if (answer.answer_mode === "product_recommendation") {
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

function validateCurrentCareContextConflictAcknowledgement(
  answer: AgentV2TerminalAnswer,
  context: AgentV2FinalAnswerValidationContext,
  findings: AgentV2ValidationError[],
): void {
  const conflicts = context.currentCareContextConflicts ?? []
  if (conflicts.length === 0) return

  const userFacing = normalizeVisibleText(readUserFacingAnswer(answer.payload))
  const acknowledged = conflicts.some((conflict) => {
    const currentValue = String(conflict.currentTurnValue ?? "").trim()
    const evidenceQuote = conflict.evidenceQuote.trim()
    return (
      (currentValue.length > 0 && hasNormalizedPhrase(userFacing, currentValue)) ||
      (evidenceQuote.length > 0 && hasNormalizedPhrase(userFacing, evidenceQuote)) ||
      /\b(aktuell|gerade|korrektur|korrigiert|jetzt|heute)\b/.test(userFacing)
    )
  })

  if (!acknowledged) {
    findings.push({
      validator_id: "current_care_context_conflict_acknowledgement",
      message:
        "Meaningful current-turn profile/routine conflicts should be acknowledged naturally in German when they affect the answer.",
      severity: "warn",
      path: ["payload", "user_facing_answer_de"],
    })
  }
}

function validateInterpretationEvidence(
  answer: AgentV2TerminalAnswer,
  context: AgentV2FinalAnswerValidationContext,
  findings: AgentV2ValidationError[],
): void {
  const originalEvidence = answer.request_interpretation.evidence_quote
  const evidence = normalizeEvidenceText(originalEvidence)
  const evidenceText = normalizeEvidenceText(buildEvidenceText(context))
  const grounding = classifyEvidenceGrounding(evidence, evidenceText, context)

  if (grounding === "grounded") return
  if (grounding === "plausible") {
    findings.push({
      validator_id: "request_interpretation_evidence",
      message:
        "request_interpretation.evidence_quote is not an exact quote, but overlaps enough with active context to keep the turn reviewable.",
      severity: "warn",
      path: ["request_interpretation", "evidence_quote"],
    })
    return
  }

  findings.push({
    validator_id: "request_interpretation_evidence",
    message:
      "request_interpretation.evidence_quote must quote a meaningful phrase from the latest user message or active session context.",
    severity: "block",
    path: ["request_interpretation", "evidence_quote"],
    ...buildEvidenceRepairMetadata({
      normalizedEvidence: evidence,
      originalEvidence,
      normalizedEvidenceText: evidenceText,
      context,
    }),
  })
}

function buildEvidenceRepairMetadata(params: {
  normalizedEvidence: string
  originalEvidence: string
  normalizedEvidenceText: string
  context: AgentV2FinalAnswerValidationContext
}): Pick<
  AgentV2ValidationError,
  "reason_code" | "rejected_value" | "expected" | "suggested_value" | "repair_hint"
> {
  const suggestedValue = chooseEvidenceQuoteSuggestion(params.context)
  const reasonCode = params.normalizedEvidenceText.includes(params.normalizedEvidence)
    ? "evidence_quote_too_short_or_generic"
    : "evidence_quote_not_in_context"

  return {
    reason_code: reasonCode,
    rejected_value: params.originalEvidence,
    expected: "Exact phrase from latest user message or active session context.",
    suggested_value: suggestedValue,
    repair_hint:
      "Set request_interpretation.evidence_quote to suggested_value exactly, or to another exact phrase from the latest user message / active context.",
  }
}

function chooseEvidenceQuoteSuggestion(context: AgentV2FinalAnswerValidationContext): string {
  const latest = context.latestUserMessage.trim()
  if (latest.length > 0) return latest.slice(0, 240)
  const recent = (context.recentEvidenceText ?? "").trim()
  if (recent.length > 0) return recent.slice(0, 240)
  // Re-validation will still reject this sentinel when no grounding context exists.
  return "unclear"
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
    !isProductBackedRoutineAnswer(answer) &&
    answer.answer_mode !== "clarification" &&
    answer.answer_mode !== "constraint_blocked"
  ) {
    errors.push({
      validator_id: "request_interpretation_answer_mode",
      message:
        "Concrete product interpretations must answer with product_recommendation, clarification, or constraint_blocked.",
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

  if (answer.answer_mode === "social" && interpretation.primary_intent !== "smalltalk") {
    errors.push({
      validator_id: "request_interpretation_answer_mode",
      message: "Social answers require primary_intent smalltalk.",
      severity: "block",
      path: ["request_interpretation", "primary_intent"],
    })
  }

  if (answer.answer_mode === "domain_boundary" && interpretation.primary_intent !== "unknown") {
    errors.push({
      validator_id: "request_interpretation_answer_mode",
      message: "Domain-boundary answers require primary_intent unknown.",
      severity: "block",
      path: ["request_interpretation", "primary_intent"],
    })
  }

  if (
    (answer.answer_mode === "social" || answer.answer_mode === "domain_boundary") &&
    (interpretation.product_request_kind !== "none" ||
      interpretation.routine_intent !== "none" ||
      interpretation.care_category !== "none" ||
      interpretation.requested_product_count !== null ||
      interpretation.count_policy !== "none" ||
      interpretation.confidence < 0.7)
  ) {
    errors.push({
      validator_id: "request_interpretation_answer_mode",
      message:
        "Social and domain-boundary interpretations must use no product/routine/category fields and confidence at least 0.7.",
      severity: "block",
      path: ["request_interpretation"],
    })
  }
}

function validateTurnGateConsistency(
  answer: AgentV2TerminalAnswer,
  context: AgentV2FinalAnswerValidationContext,
  errors: AgentV2ValidationError[],
): void {
  const gate = context.turnGate
  if (!gate) {
    if (answer.answer_mode === "social" || answer.answer_mode === "domain_boundary") {
      errors.push({
        validator_id: "turn_gate_answer_mode",
        message: "Social and domain-boundary answer modes require an authorized turn gate.",
        severity: "block",
        path: ["answer_mode"],
      })
    }
    return
  }

  if (answer.answer_mode === "social" && gate.gate_status !== "social") {
    errors.push({
      validator_id: "turn_gate_answer_mode",
      message: "Social answer mode requires social turn-gate status.",
      severity: "block",
      path: ["answer_mode"],
    })
  }

  if (
    answer.answer_mode === "domain_boundary" &&
    gate.gate_status !== "domain_boundary" &&
    gate.gate_status !== "prompt_or_role_bypass"
  ) {
    errors.push({
      validator_id: "turn_gate_answer_mode",
      message:
        "Domain-boundary answer mode requires domain_boundary or prompt_or_role_bypass gate status.",
      severity: "block",
      path: ["answer_mode"],
    })
  }

  if (gate.gate_status === "social" && answer.answer_mode !== "social") {
    errors.push({
      validator_id: "turn_gate_answer_mode",
      message: "Social turn-gate status must submit a social answer.",
      severity: "block",
      path: ["answer_mode"],
    })
  }

  if (
    (gate.gate_status === "domain_boundary" || gate.gate_status === "prompt_or_role_bypass") &&
    answer.answer_mode !== "domain_boundary"
  ) {
    errors.push({
      validator_id: "turn_gate_answer_mode",
      message: "Boundary turn-gate status must submit a domain_boundary answer.",
      severity: "block",
      path: ["answer_mode"],
    })
  }

  if (answer.answer_mode === "domain_boundary") {
    const payload = answer.payload
    if (payload.boundary_kind !== gate.boundary_kind) {
      errors.push({
        validator_id: "turn_gate_answer_mode",
        message: "Domain-boundary payload boundary_kind must match the authorized turn gate.",
        severity: "block",
        path: ["payload", "boundary_kind"],
      })
    }
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
  const multiSlotProductContext = isMultiSlotProductSelectionContext(answer, context)

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
    if (!isProductSelectionSupportingRoutineAnswer(answer, latestRoutineTool)) {
      compareToolArgument(
        latestProductTool.arguments,
        "product_request_kind",
        interpretation.product_request_kind,
        errors,
      )
      if (!multiSlotProductContext) {
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
      }
    }
    if (!multiSlotProductContext) {
      compareCategoryArgument(latestProductTool.arguments, interpretation, errors)
    }
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

function isProductBackedRoutineAnswer(answer: AgentV2TerminalAnswer): boolean {
  return (
    answer.answer_mode === "routine" &&
    answer.tool_grounding.used_product_tool === true &&
    answer.tool_grounding.used_routine_tool === true &&
    ROUTINE_TOOL_INTENTS.has(answer.request_interpretation.routine_intent)
  )
}

function isProductSelectionSupportingRoutineAnswer(
  answer: AgentV2TerminalAnswer,
  latestRoutineTool: Partial<AgentV2ToolCallTrace> | undefined,
): boolean {
  return isProductBackedRoutineAnswer(answer) && Boolean(latestRoutineTool?.arguments)
}

type MultiSlotProductSelectionInfo = {
  isSlotShaped: boolean
  isValid: boolean
  distinctCategoryCount: number
}

const MULTI_SLOT_CATEGORY_EVIDENCE_PATTERNS: Partial<Record<AgentV2CareCategory, RegExp[]>> = {
  shampoo: [/\bshampoo\b/, /\balltagsshampoo\b/],
  conditioner: [/\bconditioner\b/, /\bspuelung\b/],
  mask: [/\bmaske\b/, /\bmask\b/],
  leave_in: [/\bleave\s?in\b/, /\bleavein\b/],
  oil: [/\boel\b/, /\bol\b/, /\boil\b/],
  bondbuilder: [/\bbondbuilder\b/, /\bbond\s?builder\b/, /\bbonding\b/, /\bk18\b/, /\bolaplex\b/],
  deep_cleansing_shampoo: [
    /\btiefenreinigung\b/,
    /\btiefenreinigungsshampoo\b/,
    /\bdeep\s?cleansing\b/,
    /\bclarifying\b/,
    /\bdetox\b/,
    /\breset\b/,
  ],
  dry_shampoo: [/\btrockenshampoo\b/, /\bdry\s?shampoo\b/],
  peeling: [/\bpeeling\b/, /\bscalp\s?scrub\b/],
  styling: [/\bstyling\b/, /\bstyler\b/],
  treatment: [/\btreatment\b/, /\bbehandlung\b/],
}

function getProductToolCalls(
  context: AgentV2FinalAnswerValidationContext,
): readonly Partial<AgentV2ToolCallTrace>[] {
  return context.toolCallHistory.filter((call) => call.name === "select_products")
}

function getCurrentProductProjections(
  context: AgentV2FinalAnswerValidationContext,
  productToolCallCount: number,
): AgentV2FinalAnswerValidationContext["selectedProductProjections"] {
  // responses-agent prepends prior-turn projections and appends one current projection per product call.
  if (context.selectedProductProjections.length < productToolCallCount) return []
  return context.selectedProductProjections.slice(-productToolCallCount)
}

function getToolArgumentString(call: Partial<AgentV2ToolCallTrace>, key: string): string | null {
  const value = call.arguments?.[key]
  return typeof value === "string" && value.trim().length > 0 ? value : null
}

function getToolArgumentNumber(call: Partial<AgentV2ToolCallTrace>, key: string): number | null {
  const value = call.arguments?.[key]
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function userEvidenceMentionsCategory(category: string, evidenceText: string): boolean {
  const patterns = MULTI_SLOT_CATEGORY_EVIDENCE_PATTERNS[category as AgentV2CareCategory]
  return Boolean(patterns?.some((pattern) => pattern.test(evidenceText)))
}

function userFacingAdmitsMissingSlot(category: string, userFacingText: string): boolean {
  const normalized = normalizeAgentV2EvidenceText(userFacingText)
  const mentionsCategory = userEvidenceMentionsCategory(category, normalized)
  const admitsMissingCatalogMatch = [
    /\b(?:kein|keinen|keine)\s+(?:sicher(?:er|en|e|es)|passend(?:er|en|e|es))?\s*(?:treffer|katalogtreffer|produkt|option|match)\b/,
    /\bkein(?:e|en)?\s+passend(?:es|en|e|er)?\s+(?:produkt|option|treffer|match)\b/,
    /\bnichts\s+passend(?:es|en|e|er)?\b/,
    /\bfehl(?:t|en)?\s+(?:mir\s+|uns\s+)?(?:ein|eine|einen|den|der)?\s*(?:sicher(?:er|en|e|es)?|passend(?:er|en|e|es)?|katalog)\s*(?:treffer|produkt|option|match)\b/,
    /\bohne\s+(?:sicher(?:en|er|e|es)?|passend(?:en|er|e|es)?)\s*(?:treffer|produkt|option|match)\b/,
    /\bno\s+(?:safe|catalog)\s+(?:hit|match|product)\b/,
  ].some((pattern) => pattern.test(normalized))

  return mentionsCategory && admitsMissingCatalogMatch
}

function getMultiSlotEvidenceText(context: AgentV2FinalAnswerValidationContext): string {
  return normalizeAgentV2EvidenceText(context.latestUserMessage)
}

function getEmptySlotCategories(
  categories: readonly string[],
  projections: AgentV2FinalAnswerValidationContext["selectedProductProjections"],
): string[] {
  return projections.flatMap((projection, index) =>
    (projection.valid_product_ids?.length ?? 0) === 0 && categories[index]
      ? [categories[index]]
      : [],
  )
}

function getMultiSlotProductSelectionInfo(
  answer: AgentV2TerminalAnswer,
  context: AgentV2FinalAnswerValidationContext,
): MultiSlotProductSelectionInfo {
  const productToolCalls = getProductToolCalls(context)
  const categories = productToolCalls
    .map((call) => getToolArgumentString(call, "category"))
    .filter((category): category is string => Boolean(category))
  const allProductCallsHaveCategories = categories.length === productToolCalls.length
  const distinctCategoryCount = new Set(categories).size
  const invalidInfo = {
    isSlotShaped: false,
    isValid: false,
    distinctCategoryCount,
  }

  if (
    answer.answer_mode !== "product_recommendation" ||
    answer.request_interpretation.product_request_kind === "product_detail" ||
    answer.request_interpretation.product_request_kind === "compare_products" ||
    productToolCalls.length < 2 ||
    !allProductCallsHaveCategories ||
    distinctCategoryCount < 2
  ) {
    return invalidInfo
  }

  const isSlotShaped =
    productToolCalls.length === distinctCategoryCount &&
    productToolCalls.every(
      (call) =>
        getToolArgumentString(call, "count_policy") === "exact" &&
        getToolArgumentNumber(call, "requested_product_count") === 1,
    )
  if (!isSlotShaped) return invalidInfo

  const categorySet = new Set(categories)
  const interpretationMatchesSlotShape =
    answer.request_interpretation.count_policy === "exact" &&
    answer.request_interpretation.requested_product_count === distinctCategoryCount &&
    categorySet.has(answer.request_interpretation.care_category)
  const evidenceText = getMultiSlotEvidenceText(context)
  const evidenceMentionsEverySlot = categories.every((category) =>
    userEvidenceMentionsCategory(category, evidenceText),
  )
  const visibleRecommendationIds = answer.payload.recommendations.map(
    (recommendation) => recommendation.product_id,
  )
  const currentProductProjections = getCurrentProductProjections(context, productToolCalls.length)
  const emptySlotCategories = getEmptySlotCategories(categories, currentProductProjections)
  const userFacing = readUserFacingAnswer(answer.payload)
  const userFacingAdmitsEveryEmptySlot = emptySlotCategories.every((category) =>
    userFacingAdmitsMissingSlot(category, userFacing),
  )
  const fillableProjectionIndexes = new Set(
    currentProductProjections.flatMap((projection, index) =>
      (projection.valid_product_ids?.length ?? 0) > 0 ? [index] : [],
    ),
  )
  const visibleProjectionIndexes = new Set<number>()
  const allVisibleRecommendationsSelected = visibleRecommendationIds.every((id) => {
    const projectionIndex = currentProductProjections.findIndex((projection) =>
      (projection.valid_product_ids ?? []).includes(id),
    )
    if (projectionIndex === -1) return false
    visibleProjectionIndexes.add(projectionIndex)
    return true
  })
  const visibleRecommendationsUseDistinctSlots =
    visibleProjectionIndexes.size === visibleRecommendationIds.length
  const allFillableSlotsAreVisible =
    visibleRecommendationIds.length === fillableProjectionIndexes.size &&
    Array.from(fillableProjectionIndexes).every((index) => visibleProjectionIndexes.has(index))
  const visibleRecommendationCountAllowsRelaxation =
    visibleRecommendationIds.length <= distinctCategoryCount

  return {
    isSlotShaped,
    isValid:
      interpretationMatchesSlotShape &&
      evidenceMentionsEverySlot &&
      userFacingAdmitsEveryEmptySlot &&
      visibleRecommendationCountAllowsRelaxation &&
      allVisibleRecommendationsSelected &&
      visibleRecommendationsUseDistinctSlots &&
      allFillableSlotsAreVisible,
    distinctCategoryCount,
  }
}

function isMultiSlotProductSelectionContext(
  answer: AgentV2TerminalAnswer,
  context: AgentV2FinalAnswerValidationContext,
): boolean {
  return getMultiSlotProductSelectionInfo(answer, context).isValid
}

function validateProductAnswerShape(
  answer: AgentV2TerminalAnswer,
  context: AgentV2FinalAnswerValidationContext,
  errors: AgentV2ValidationError[],
): void {
  if (answer.answer_mode !== "product_recommendation") {
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
  const multiSlotProductContext = getMultiSlotProductSelectionInfo(answer, context)
  if (
    multiSlotProductContext.isSlotShaped &&
    recommendations.length > multiSlotProductContext.distinctCategoryCount
  ) {
    errors.push({
      validator_id: "requested_product_count",
      message: `Multi-category product requests must not surface more visible recommendations than the ${multiSlotProductContext.distinctCategoryCount} selected category slot(s).`,
      severity: "block",
    })
  }

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
  if (
    countRequirement.kind === "exact" &&
    recommendations.length !== countRequirement.count &&
    !multiSlotProductContext.isValid
  ) {
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
  const reported = new Set(answer.tool_grounding.used_guidance_package_ids)
  const loaded = context.loadedGuidancePackageIds
    ? new Set(context.loadedGuidancePackageIds)
    : reported
  const missing = getRequiredGuidancePackageIds(answer, context).filter(
    (id) => !reported.has(id) || !loaded.has(id),
  )
  if (missing.length > 0) {
    errors.push({
      validator_id: "required_guidance_loaded",
      message: `Missing required guidance packages from loaded guidance and terminal grounding: ${missing.join(", ")}`,
      severity: "block",
    })
  }
}

function getRequiredGuidancePackageIds(
  answer: AgentV2TerminalAnswer,
  context: AgentV2FinalAnswerValidationContext,
): string[] {
  if (answer.answer_mode === "social" || answer.answer_mode === "domain_boundary") {
    return [...context.requiredGuidancePackageIds]
  }

  const required = new Set<string>(ALWAYS_REQUIRED_GUIDANCE_PACKAGE_IDS)

  for (const id of BASE_GUIDANCE_BY_ANSWER_MODE[answer.answer_mode] ?? []) {
    required.add(id)
  }

  if (PRODUCT_TOOL_REQUEST_KINDS.has(answer.request_interpretation.product_request_kind)) {
    required.add("base.product_recommendation.v1")
  }

  if (answer.answer_mode !== "clarification" && answer.answer_mode !== "safety_boundary") {
    const categoryId =
      CATEGORY_GUIDANCE_BY_INTERPRETATION[answer.request_interpretation.care_category]
    if (categoryId) required.add(categoryId)
  }

  for (const id of context.requiredGuidancePackageIds) {
    required.add(id)
  }

  return [...required]
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
  const routineContextStepIds = extractRoutineContextStepIds(answer)
  const answerRoutineStepIds = [...new Set([...payloadRoutineStepIds, ...routineContextStepIds])]
  const missingFromGrounding = answerRoutineStepIds.filter(
    (id) => !answer.tool_grounding.routine_step_ids.includes(id),
  )
  if (missingFromGrounding.length > 0) {
    errors.push({
      validator_id: "known_routine_step_ids",
      message: `Final answer routine step IDs must also appear in tool_grounding.routine_step_ids: ${missingFromGrounding.join(", ")}`,
      severity: "block",
    })
  }

  const referencedRoutineStepIds = [
    ...new Set([...answer.tool_grounding.routine_step_ids, ...answerRoutineStepIds]),
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
      answer.answer_mode === "product_recommendation") &&
    !hasProductToolCall
  ) {
    errors.push({
      validator_id: "product_tool_required",
      message: "Product answers require a select_products tool call.",
      severity: "block",
    })
  }
}

function validateNamedProductLookupRequired(
  answer: AgentV2TerminalAnswer,
  context: AgentV2FinalAnswerValidationContext,
  errors: AgentV2ValidationError[],
): void {
  const namedProductContext = context.namedProductContext
  if (!namedProductContext?.plausible_exact_name) return
  if (context.productIntakeEnabled === false) return

  const hasLookupToolCall = context.toolCallHistory.some(
    (call) => call.name === "lookup_product_candidate",
  )
  if (hasLookupToolCall) return
  if (!isNamedProductLookupTurn(answer)) return
  if (!makesNamedProductSpecificFinalAnswer(answer)) return

  errors.push({
    validator_id: "product_lookup_required",
    message:
      "Named-product detail, suitability, or routine-add answers require lookup_product_candidate before product-specific final claims.",
    severity: "block",
  })
}

function validateProductLookupResultClaims(
  answer: AgentV2TerminalAnswer,
  context: AgentV2FinalAnswerValidationContext,
  errors: AgentV2ValidationError[],
): void {
  const lookupResults = context.productLookupResults ?? []
  const unresolvedLookupResults = lookupResults.filter((result) =>
    UNRESOLVED_PRODUCT_LOOKUP_STATUSES.has(result.status),
  )
  if (unresolvedLookupResults.length === 0) {
    return
  }

  const payloadProductIds = extractPayloadProductIds(answer)
  const claimedProductIds = [
    ...new Set([...answer.tool_grounding.product_ids, ...payloadProductIds]),
  ].filter((id) => id.trim().length > 0)
  const exactLookupProductIds = new Set(
    lookupResults
      .filter((result) => result.status === "found_exact" && result.product?.id)
      .map((result) => result.product?.id as string),
  )
  if (
    claimedProductIds.length > 0 &&
    claimedProductIds.every((productId) => exactLookupProductIds.has(productId))
  ) {
    return
  }

  const makesProductSpecificClaim =
    answer.answer_mode === "product_recommendation" ||
    (answer.answer_mode === "general_advice" && isNamedProductLookupTurn(answer)) ||
    answer.answer_mode === "routine" ||
    answer.tool_grounding.product_ids.length > 0 ||
    payloadProductIds.length > 0

  if (!makesProductSpecificClaim) return

  errors.push({
    validator_id: "product_lookup_unresolved",
    message: `Product-specific claims are blocked after lookup_product_candidate returned unresolved status: ${unresolvedLookupResults
      .map((result) => result.status)
      .join(", ")}.`,
    severity: "block",
  })
}

function isNamedProductLookupTurn(answer: AgentV2TerminalAnswer): boolean {
  return (
    PRODUCT_TOOL_REQUEST_KINDS.has(answer.request_interpretation.product_request_kind) ||
    ROUTINE_TOOL_INTENTS.has(answer.request_interpretation.routine_intent)
  )
}

function makesNamedProductSpecificFinalAnswer(answer: AgentV2TerminalAnswer): boolean {
  return (
    answer.answer_mode === "product_recommendation" ||
    answer.answer_mode === "routine" ||
    answer.answer_mode === "general_advice" ||
    answer.answer_mode === "constraint_blocked"
  )
}

function validateNamedProductDetailAnswer(
  answer: AgentV2TerminalAnswer,
  context: AgentV2FinalAnswerValidationContext,
  errors: AgentV2ValidationError[],
): void {
  const namedProductContext = context.namedProductContext
  if (
    !namedProductContext ||
    !namedProductContext.plausible_exact_name ||
    answer.request_interpretation.product_request_kind !== "product_detail"
  ) {
    return
  }

  if (answer.answer_mode === "clarification" && asksForExactProductNameAgain(answer)) {
    errors.push({
      validator_id: "named_product_detail_unverified",
      message:
        "The user already gave a plausible exact product name; do not ask for the exact name again. Use constraint_blocked if select_products cannot verify it.",
      severity: "block",
      path: ["payload", "question_de"],
    })
    return
  }

  if (
    answer.answer_mode === "product_recommendation" &&
    !referencesNamedProductMatch(answer, context, namedProductContext)
  ) {
    errors.push({
      validator_id: "named_product_detail_unverified",
      message:
        "Named product detail turns must not substitute unrelated catalog recommendations when the named product is not verified.",
      severity: "block",
      path: ["payload", "recommendations"],
    })
  }
}

function asksForExactProductNameAgain(
  answer: Extract<AgentV2TerminalAnswer, { answer_mode: "clarification" }>,
): boolean {
  const text = [answer.payload.user_facing_answer_de, answer.payload.question_de].join("\n")
  return /(?:genaue?|exakte?)\s+(?:produkt(?:bezeichnung|name)?|bezeichnung|name)|wie\s+hei(?:ß|ss)t\s+(?:das\s+)?produkt\s+genau/iu.test(
    text,
  )
}

function referencesNamedProductMatch(
  answer: Extract<AgentV2TerminalAnswer, { answer_mode: "product_recommendation" }>,
  context: AgentV2FinalAnswerValidationContext,
  namedProductContext: AgentV2NamedProductContext,
): boolean {
  const referencedProductIds = new Set([
    ...answer.tool_grounding.product_ids,
    ...extractPayloadProductIds(answer),
  ])
  if (referencedProductIds.size === 0) return false

  const referencedProductNames = context.selectedProductProjections.flatMap((projection) =>
    (projection.products ?? [])
      .filter((product) => product.product_id && referencedProductIds.has(product.product_id))
      .map((product) => product.name)
      .filter((name): name is string => Boolean(name)),
  )
  return referencedProductNames.some((name) =>
    namedProductNamesMatch(name, namedProductContext.display_name),
  )
}

function namedProductNamesMatch(candidateName: string, namedProductName: string): boolean {
  const candidate = normalizeNamedProductForComparison(candidateName)
  const named = normalizeNamedProductForComparison(namedProductName)
  if (candidate.length === 0 || named.length === 0) return false
  return candidate === named || candidate.includes(named) || named.includes(candidate)
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
    !isRoutineProductRecommendation(answer) &&
    (answer.tool_grounding.routine_step_ids.length > 0 || payloadRoutineStepIds.length > 0)
  const asksForRoutineChange = isRoutineChangeRequest(
    [context.latestUserMessage, context.recentEvidenceText ?? ""].join("\n"),
  )
  const handRolledRoutineChange =
    answer.answer_mode === "general_advice" &&
    asksForRoutineChange &&
    answerSuggestsRoutineStepChanges(answer)
  const requiresRoutineTool =
    answer.answer_mode === "routine" ||
    routineStepIdsRequireCurrentTool ||
    ROUTINE_TOOL_INTENTS.has(answer.request_interpretation.routine_intent) ||
    handRolledRoutineChange
  if (requiresRoutineTool && !hasRoutineToolCall) {
    errors.push({
      validator_id: "routine_tool_required",
      message: "Routine answers require build_or_fix_routine grounding.",
      severity: "block",
    })
  }
}

function extractPayloadProductIds(answer: AgentV2TerminalAnswer): string[] {
  if (answer.answer_mode !== "product_recommendation") {
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

  return []
}

function extractRoutineContextStepIds(answer: AgentV2TerminalAnswer): string[] {
  if (!isRoutineProductRecommendation(answer)) return []

  const stepId = answer.routine_context.step_id
  return stepId && stepId.trim().length > 0 ? [stepId] : []
}

function isRoutineChangeRequest(text: string): boolean {
  const normalized = text.toLocaleLowerCase("de-DE")
  return (
    /\b(routine|ablauf)\b.*\b(einfacher|leichter|aendern|ändern|umstellen|ergaenzen|ergänzen|weglassen|reduzieren)\b/.test(
      normalized,
    ) ||
    /\b(keine schwere routine|nicht so schwere routine|leichte routine)\b/.test(normalized) ||
    /\b(was soll ich|was sollte ich).*\b(aendern|ändern|ergaenzen|ergänzen|weglassen)\b/.test(
      normalized,
    ) ||
    /\b(fuege|füge|nimm|baue).*\b(routine|schritt)\b/.test(normalized) ||
    /\b(mach|mache|machst|machen)\b\s+(sie|ihn|es|das)\b.*\b(mit|statt|ohne)\b/.test(normalized)
  )
}

function answerSuggestsRoutineStepChanges(answer: AgentV2TerminalAnswer): boolean {
  const payload = answer.payload as Record<string, unknown>
  const textParts = [readUserFacingAnswer(payload)]

  for (const [key, value] of Object.entries(payload)) {
    if (key === "next_step_offer_de") continue
    if (typeof value === "string") textParts.push(value)
    if (Array.isArray(value)) {
      textParts.push(...value.filter((item): item is string => typeof item === "string"))
    }
  }

  const normalized = normalizeVisibleText(textParts.join(" "))
  const mentionsStepCategory =
    /\b(conditioner|spuelung|leave in|maske|mask|oel|ol|oil|shampoo|trockenshampoo|peeling|bondbuilder|reset|tiefenreinigung)\b/.test(
      normalized,
    )
  const suggestsChange =
    /\b(aendere|andere|aendern|andern|wechsel|wechsle|ersetze|fuege|fuge|ergaenze|erganze|hinzufuegen|hinzufugen|nimm|baue|mache|machen|nutze|verwende|statt|weglassen|reduzieren)\b/.test(
      normalized,
    )

  return mentionsStepCategory && suggestsChange
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
  if (!isRoutineProductRecommendation(answer)) return

  if (!answer.routine_context.active || answer.routine_context.return_path.length === 0) {
    errors.push({
      validator_id: "routine_context_return_path_required",
      message:
        "Product recommendations inside routine threads must keep routine_context active and preserve a return path to the routine.",
      severity: "block",
    })
  }
}

function validateRoutineMetadataConsistency(
  answer: AgentV2TerminalAnswer,
  context: AgentV2FinalAnswerValidationContext,
  errors: AgentV2ValidationError[],
): void {
  if (answer.answer_mode === "routine") {
    if (answer.payload.routine_layer !== answer.routine_context.routine_layer) {
      errors.push({
        validator_id: "routine_metadata_consistency",
        message: "Routine payload routine_layer must match routine_context.routine_layer.",
        severity: "block",
        path: ["payload", "routine_layer"],
      })
    }
    return
  }

  if (!isRoutineProductRecommendation(answer)) return

  const contextCategory = answer.routine_context.category
  const interpretationCategory = answer.request_interpretation.care_category
  const stepCategory = findRoutineThreadStepCategory(context, answer.routine_context.step_id)
  if (
    contextCategory &&
    interpretationCategory !== "unknown" &&
    interpretationCategory !== "none" &&
    interpretationCategory !== contextCategory
  ) {
    errors.push({
      validator_id: "routine_metadata_consistency",
      message:
        "Routine product recommendation context category must match request_interpretation.care_category.",
      severity: "block",
      path: ["routine_context", "category"],
    })
  }

  const comparableInterpretationCategory =
    interpretationCategory !== "unknown" && interpretationCategory !== "none"
      ? interpretationCategory
      : null
  const declaredCategory = contextCategory ?? comparableInterpretationCategory
  if (stepCategory && declaredCategory && stepCategory !== declaredCategory) {
    errors.push({
      validator_id: "routine_metadata_consistency",
      message:
        "Routine product recommendation category must match the referenced routine step category.",
      severity: "block",
      path: ["routine_context", "step_id"],
    })
  }
}

function findRoutineThreadStepCategory(
  context: AgentV2FinalAnswerValidationContext,
  stepId: string | null,
): string | null {
  if (!stepId || !context.routineThreadContext?.active) return null
  const step = context.routineThreadContext.visible_steps.find((visibleStep) => {
    return visibleStep.step_id === stepId
  })
  return step?.category ?? null
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
}

function readNextStepOffer(answer: AgentV2TerminalAnswer): string | null {
  if (!("next_step_offer_de" in answer.payload)) return null
  const offer = answer.payload.next_step_offer_de
  return typeof offer === "string" && offer.trim().length > 0 ? offer.trim() : null
}

function readVisibleFollowupOffer(answer: AgentV2TerminalAnswer): string | null {
  const nextStepOffer = readNextStepOffer(answer)
  const proseOffer = extractConfirmableFollowupOfferFromVisibleProse(
    readUserFacingAnswer(answer.payload),
  )
  const nextStepKind = classifyPendingFollowupOfferKind(nextStepOffer)
  const proseKind = classifyPendingFollowupOfferKind(proseOffer)

  if (proseOffer && proseKind && proseKind !== nextStepKind) return proseOffer
  if (nextStepOffer && (nextStepKind || isConfirmableFollowupOffer(nextStepOffer))) {
    return nextStepOffer
  }
  return proseOffer ?? nextStepOffer
}

function validatePendingFollowupAction(
  answer: AgentV2TerminalAnswer,
  errors: AgentV2ValidationError[],
): void {
  const nextStepOffer = readVisibleFollowupOffer(answer)
  const expectedOfferKind = classifyPendingFollowupOfferKind(nextStepOffer)
  const hasConfirmableOffer =
    Boolean(expectedOfferKind) || isConfirmableFollowupOffer(nextStepOffer)
  const expectedActionKind = expectedOfferKind ?? (hasConfirmableOffer ? "advisor_response" : null)
  const action = answer.pending_followup_action

  if (nextStepOffer && !answer.pending_followup_action && hasConfirmableOffer) {
    errors.push({
      validator_id: "pending_followup_action_missing",
      message: "Actionable next_step_offer_de should provide pending_followup_action.",
      severity: "block",
      ...buildPendingFollowupRepairMetadata(
        "pending_followup_action_missing",
        expectedActionKind,
        nextStepOffer,
      ),
    })
  }

  if ((!nextStepOffer || !hasConfirmableOffer) && answer.pending_followup_action) {
    errors.push({
      validator_id: "pending_followup_action_hidden",
      message:
        "pending_followup_action must not be set without a visible confirmable next_step_offer_de.",
      severity: "block",
      reason_code: "pending_followup_action_hidden",
      rejected_value: answer.pending_followup_action,
      expected: "pending_followup_action=null",
      repair_hint:
        "Remove pending_followup_action, or make the user-facing answer visibly offer a confirmable next action.",
    })
  }

  if (
    action &&
    ((action.kind === "routine_mutation" && expectedActionKind !== "routine_mutation") ||
      (expectedOfferKind && action.kind !== expectedOfferKind))
  ) {
    errors.push({
      validator_id: "pending_followup_action_kind_mismatch",
      message: "pending_followup_action.kind must match the visible next-step offer semantics.",
      severity: "block",
      path: ["pending_followup_action", "kind"],
      rejected_value: action.kind,
      ...buildPendingFollowupRepairMetadata(
        "pending_followup_action_kind_mismatch",
        expectedActionKind,
        nextStepOffer,
      ),
    })
  }

  const expectedOfferCategory = inferPendingFollowupOfferCategory(
    nextStepOffer,
    answer.request_interpretation.care_category,
  )
  if (
    (action?.kind === "product_recommendation" || action?.kind === "routine_mutation") &&
    expectedOfferCategory &&
    action.category !== expectedOfferCategory
  ) {
    errors.push({
      validator_id: "pending_followup_action_category_mismatch",
      message:
        "Pending follow-up category must match the visible next-step offer when the category is clear.",
      severity: "block",
      path: ["pending_followup_action", "category"],
      reason_code: "pending_followup_action_category_mismatch",
      rejected_value: action.category,
      expected: `pending_followup_action.category=${expectedOfferCategory}`,
      repair_hint:
        "Set pending_followup_action.category to the product/routine category named in the visible offer.",
    })
  }
}

function buildPendingFollowupRepairMetadata(
  reasonCode: "pending_followup_action_missing" | "pending_followup_action_kind_mismatch",
  expectedActionKind: "product_recommendation" | "routine_mutation" | "advisor_response" | null,
  nextStepOffer: string | null,
): Pick<AgentV2ValidationError, "reason_code" | "expected" | "rejected_value" | "repair_hint"> {
  const expected = expectedActionKind
    ? `pending_followup_action.kind=${expectedActionKind}`
    : "pending_followup_action must match visible next_step_offer_de semantics"
  return {
    reason_code: reasonCode,
    expected,
    rejected_value: nextStepOffer,
    repair_hint: expectedActionKind
      ? `Set pending_followup_action.kind to ${expectedActionKind}, or remove/soften next_step_offer_de if the visible answer should not create a confirmable follow-up.`
      : "Align pending_followup_action with the visible next_step_offer_de, or remove/soften next_step_offer_de if no confirmation should be stored.",
  }
}

function classifyPendingFollowupOfferKind(
  offer: string | null,
): "product_recommendation" | "routine_mutation" | null {
  if (!offer) return null
  const normalizedOffer = normalizeVisibleText(offer)

  if (isRoutineMutationOffer(normalizedOffer)) {
    return "routine_mutation"
  }

  if (
    /\b(empfehl|produk|produkt|option|auswahl|heraussuch|raussuch|vorschlag|vorschlaeg|katalog)\w*/.test(
      normalizedOffer,
    )
  ) {
    return "product_recommendation"
  }

  return null
}

function isRoutineMutationOffer(normalizedOffer: string): boolean {
  if (!/\broutine\b/.test(normalizedOffer)) return false
  if (
    !/\b(anpass|ander|aender|einbau|integrier|hinzufug|hinzufueg|aufnehm|setz|bau|baue|umbau|vereinfach|passe|passen)\w*/.test(
      normalizedOffer,
    )
  ) {
    return false
  }
  if (isAdviceStyleRoutineOffer(normalizedOffer)) return false

  return (
    /\b(?:soll|mochtest|moechtest|willst)\b.{0,70}\b(?:ich|wir)\b.{0,120}\broutine\b/.test(
      normalizedOffer,
    ) ||
    /\b(?:mochtest|moechtest|willst)\b.{0,90}\bdass\b.{0,30}\b(?:ich|wir)\b.{0,120}\broutine\b/.test(
      normalizedOffer,
    ) ||
    /\b(?:ich|wir)\b.{0,50}\b(?:kann|konnen|passe|passen|baue|bauen|nehme|nehmen|setze|setzen|integriere|integrieren|vereinfache|vereinfachen)\w*\b.{0,120}\broutine\b/.test(
      normalizedOffer,
    ) ||
    /\b(?:ich|wir)\b.{0,120}\broutine\b.{0,80}\b(?:anpass|ander|aender|einbau|integrier|hinzufug|hinzufueg|aufnehm|setz|bau|baue|umbau|vereinfach)\w*/.test(
      normalizedOffer,
    ) ||
    /\b(?:anpass|ander|aender|einbau|integrier|hinzufug|hinzufueg|aufnehm|setz|bau|baue|umbau|vereinfach|passe|passen|baue|bauen|nehme|nehmen|setze|setzen|integriere|integrieren|vereinfache|vereinfachen)\w*\b.{0,40}\b(?:ich|wir)\b.{0,120}\broutine\b/.test(
      normalizedOffer,
    )
  )
}

function isAdviceStyleRoutineOffer(normalizedOffer: string): boolean {
  return (
    /\b(?:wie|wo|wann)\b.{0,80}\b(?:du|man)\b.{0,100}\b(?:anpass|ander|aender|einbau|integrier|hinzufug|hinzufueg|aufnehm|setz|bau|baue|umbau|vereinfach)\w*/.test(
      normalizedOffer,
    ) ||
    /\b(?:zeige|zeigen|erklaere|erklaren|erklar|schaue|schauen|anschauen|einordne|einordnen)\w*\b.{0,80}\b(?:wie|wo|wann)\b/.test(
      normalizedOffer,
    )
  )
}

function isConfirmableFollowupOffer(offer: string | null): boolean {
  if (!offer) return false
  const normalizedOffer = normalizeVisibleText(offer)

  return (
    /\b(?:soll|mochtest|moechtest|willst)\b.{0,50}\b(?:ich|wir)\b/.test(normalizedOffer) ||
    /\b(?:kann|konnen)\b.{0,30}\b(?:ich|wir)\b/.test(normalizedOffer) ||
    /\b(?:ich|wir)\b.{0,30}\b(?:kann|konnen|empfehle|erklaere|erklare|ordne|passe|baue|schaue|zeige)\w*/.test(
      normalizedOffer,
    ) ||
    /\bwenn du (?:magst|mochtest|moechtest|willst)\b.{0,90}\b(?:ich|wir)\b/.test(normalizedOffer)
  )
}

function extractConfirmableFollowupOfferFromVisibleProse(userFacingAnswer: string): string | null {
  const candidates = userFacingAnswer
    .split(/(?:\n+|(?<=[.!?])\s+)/u)
    .map((part) => part.trim())
    .filter((part) => part.length > 0)

  for (const candidate of candidates.reverse()) {
    if (isVisibleProseConfirmableFollowupOffer(candidate)) return candidate
  }

  return null
}

function isVisibleProseConfirmableFollowupOffer(offer: string): boolean {
  const normalizedOffer = normalizeVisibleText(offer)
  if (!isConfirmableFollowupOffer(offer)) return false
  if (
    /\b(?:ich|wir)\b.{0,30}\b(?:kann|konnen)\b.{0,60}\b(?:nicht|kein|keine|keinen)\b/.test(
      normalizedOffer,
    )
  ) {
    return false
  }
  if (/\b(?:ich|wir)\b.{0,30}\b(?:kann|konnen)\b.{0,60}\bnur\b/.test(normalizedOffer)) {
    return false
  }
  const isQuestion = /[?？]\s*$/.test(offer.trim())

  return (
    /\b(?:soll|mochtest|moechtest)\b.{0,70}\b(?:ich|wir)\b/.test(normalizedOffer) ||
    (isQuestion && /\b(?:kann|konnen)\b.{0,30}\b(?:ich|wir)\b/.test(normalizedOffer)) ||
    /\b(?:ich|wir)\b.{0,30}\b(?:kann|konnen)\b.{0,80}\b(?:als nachstes|danach|anschliessend|noch kurz|kurz erklaren|kurz zeigen|gern erklaren|gerne erklaren)\b/.test(
      normalizedOffer,
    ) ||
    /\b(?:ich|wir)\b.{0,30}\b(?:empfehle|erklaere|erklare|ordne|passe|baue|schaue|zeige)\w*\b.{0,80}\b(?:gern|gerne|als nachstes|danach|anschliessend)\b/.test(
      normalizedOffer,
    ) ||
    /\bwenn du (?:magst|mochtest|moechtest|willst)\b.{0,90}\b(?:ich|wir)\b/.test(normalizedOffer)
  )
}

function inferPendingFollowupOfferCategory(
  offer: string | null,
  interpretedCategory: AgentV2CareCategory,
): AgentV2CareCategory | null {
  if (!offer) return null
  const normalizedOffer = normalizeVisibleText(offer)
  const visibleCategory = inferCareCategoryFromOfferText(normalizedOffer)
  if (visibleCategory) return visibleCategory

  return interpretedCategory !== "none" && interpretedCategory !== "unknown"
    ? interpretedCategory
    : null
}

function inferCareCategoryFromOfferText(normalizedOffer: string): AgentV2CareCategory | null {
  if (/\b(leave in|leave ins)\b/.test(normalizedOffer)) return "leave_in"
  if (/\b(mask|maske|masken)\b/.test(normalizedOffer)) return "mask"
  if (/\b(conditioner|spulung|spuelung)\b/.test(normalizedOffer)) return "conditioner"
  if (/\b(shampoo|shampoos)\b/.test(normalizedOffer)) return "shampoo"
  if (/\b(oel|ol|oil|serum|seren)\b/.test(normalizedOffer)) return "oil"
  if (/\b(bondbuilder|bond builder|bond repair|bonding)\b/.test(normalizedOffer)) {
    return "bondbuilder"
  }
  if (/\b(trockenshampoo|dry shampoo)\b/.test(normalizedOffer)) return "dry_shampoo"
  if (/\b(tiefenreinigung|deep cleansing|reset shampoo)\b/.test(normalizedOffer)) {
    return "deep_cleansing_shampoo"
  }
  if (/\b(peeling|scalp scrub|kopfhautpeeling)\b/.test(normalizedOffer)) return "peeling"

  return null
}

function validateBoundaryAnswerSideEffects(
  answer: AgentV2TerminalAnswer,
  errors: AgentV2ValidationError[],
): void {
  if (answer.answer_mode !== "social" && answer.answer_mode !== "domain_boundary") return

  const hasSideEffects =
    answer.tool_grounding.used_product_tool ||
    answer.tool_grounding.used_routine_tool ||
    answer.tool_grounding.product_ids.length > 0 ||
    answer.tool_grounding.routine_step_ids.length > 0 ||
    extractPayloadProductIds(answer).length > 0 ||
    extractPayloadRoutineStepIds(answer).length > 0 ||
    answer.session_memory_writes.length > 0 ||
    answer.routine_context.active ||
    answer.pending_followup_action !== null

  if (hasSideEffects) {
    errors.push({
      validator_id: "boundary_answer_no_side_effects",
      message:
        "Social and domain-boundary answers must not include product, routine, memory, active routine context, or pending follow-up side effects.",
      severity: "block",
    })
  }

  if (
    answer.answer_mode === "domain_boundary" &&
    answer.payload.boundary_kind === "unsupported_domain" &&
    !answer.payload.redirect_topic_de
  ) {
    errors.push({
      validator_id: "domain_boundary_redirect",
      message: "Unsupported-domain answers must include a hair-care redirect topic.",
      severity: "block",
      path: ["payload", "redirect_topic_de"],
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

  const currentLayer = context.currentRoutineLayer ?? context.routineThreadContext?.current_layer
  const hasRoutineBaseline =
    Boolean(currentLayer) ||
    context.routineThreadContext?.active === true ||
    context.hasCurrentRoutineInventory === true

  if (!hasRoutineBaseline && requestedLayer !== "basics") {
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
  const rawUserFacing = readUserFacingAnswer(answer.payload)
  const userFacing = rawUserFacing.toLocaleLowerCase("de-DE")
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

  if (
    answer.answer_mode === "domain_boundary" &&
    (/```/.test(rawUserFacing) || /<\/?[a-z][\s\S]*>/i.test(rawUserFacing))
  ) {
    errors.push({
      validator_id: "no_internal_leakage",
      message: "Domain-boundary responses must not include code fences or raw HTML.",
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

function isNextStepOfferRendered(normalizedProse: string, offer: string): boolean {
  if (hasNormalizedPhrase(normalizedProse, offer)) return true

  const meaningfulParts = normalizeVisibleText(offer)
    .split(" ")
    .filter((part) => part.length >= 4)
  if (meaningfulParts.length < 3) return false

  const renderedParts = meaningfulParts.filter((part) => normalizedProse.includes(part))
  return renderedParts.length >= Math.ceil(meaningfulParts.length * 0.6)
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
  findings: AgentV2ValidationError[],
): void {
  const evidence =
    typeof args.evidence_quote === "string" ? normalizeEvidenceText(args.evidence_quote) : ""
  const evidenceText = normalizeEvidenceText(buildEvidenceText(context))
  const grounding = classifyEvidenceGrounding(evidence, evidenceText, context)
  if (grounding === "grounded") return
  if (grounding === "plausible") {
    findings.push({
      validator_id: "request_interpretation_tool_args_match",
      message: `${toolName}.evidence_quote is not an exact quote, but overlaps enough with active context to keep the tool call reviewable.`,
      severity: "warn",
      path: ["request_interpretation", "evidence_quote"],
    })
    return
  }

  findings.push({
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
  if (interpretation.care_category === "none" || interpretation.care_category === "unknown") return
  if (actual === null || actual === undefined || actual === "none") {
    errors.push({
      validator_id: "request_interpretation_tool_args_match",
      message:
        "Tool arguments must include a category when terminal request_interpretation declares a care_category.",
      severity: "block",
      path: ["request_interpretation", "care_category"],
    })
    return
  }
  if (actual === interpretation.care_category) return

  errors.push({
    validator_id: "request_interpretation_tool_args_match",
    message:
      "Terminal request_interpretation care_category does not match the category used in tool arguments.",
    severity: "block",
    path: ["request_interpretation", "care_category"],
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

/*
 * Evidence validation is lightweight provenance for traces and repair, not an
 * intent classifier. Exact quotes pass; close overlap becomes a warning;
 * empty, vague, or unrelated evidence still blocks.
 */
function classifyEvidenceGrounding(
  normalizedEvidence: string,
  normalizedEvidenceText: string,
  context: AgentV2FinalAnswerValidationContext,
): "grounded" | "plausible" | "missing" {
  if (!isMeaningfulEvidenceQuote(normalizedEvidence, context)) return "missing"
  if (normalizedEvidenceText.includes(normalizedEvidence)) return "grounded"

  const evidenceTokens = meaningfulEvidenceTokens(normalizedEvidence)
  if (evidenceTokens.length < 2) return "missing"

  const sourceTokens = new Set(meaningfulEvidenceTokens(normalizedEvidenceText))
  const overlap = evidenceTokens.filter((token) => sourceTokens.has(token))
  const overlapRatio = overlap.length / evidenceTokens.length
  if (overlap.length >= 2 && overlapRatio >= 0.45) return "plausible"

  return "missing"
}

const EVIDENCE_STOPWORDS = new Set([
  "aber",
  "auch",
  "bitte",
  "dann",
  "das",
  "der",
  "die",
  "dir",
  "du",
  "ein",
  "eine",
  "einen",
  "einer",
  "gerne",
  "ich",
  "ja",
  "mal",
  "meine",
  "meiner",
  "mir",
  "mit",
  "und",
  "was",
  "welche",
  "welcher",
  "welches",
  "zu",
])

function meaningfulEvidenceTokens(normalizedValue: string): string[] {
  return normalizedValue
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length >= 3)
    .filter((token) => !EVIDENCE_STOPWORDS.has(token))
}

function normalizeEvidenceText(value: string): string {
  return normalizeAgentV2EvidenceText(value)
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
  if (
    compactEvidence.length >= MIN_EVIDENCE_QUOTE_LENGTH - 1 &&
    meaningfulEvidenceTokens(normalizedEvidence).length > 0 &&
    normalizeEvidenceText(buildEvidenceText(context)).includes(normalizedEvidence)
  ) {
    return true
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
