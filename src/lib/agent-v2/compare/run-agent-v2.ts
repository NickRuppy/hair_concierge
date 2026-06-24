import { getOpenAI } from "@/lib/openai/client"
import { createBuildOrFixRoutineTool } from "@/lib/agent/tools/build-or-fix-routine"
import { buildCareBalanceToolContext } from "@/lib/agent/tools/care-balance-context"
import { getUserContext } from "@/lib/agent/tools/get-user-context"
import { createSelectProductsTool } from "@/lib/agent/tools/select-products"
import type { SelectProductsToolResult } from "@/lib/agent/tools/select-products"
import { loadUserMemoryContext } from "@/lib/chat-runtime/user-memory"
import type { PersistenceRoutineItemRow } from "@/lib/recommendation-engine/adapters/from-persistence"
import { buildRecommendationEngineRuntimeFromPersistence } from "@/lib/recommendation-engine/runtime"
import type { EffectiveCareContext } from "@/lib/recommendation-engine/types"
import type { RoutineProduct } from "@/lib/vocabulary"
import { createTestSession, upsertHairProfile } from "../../../../scripts/eval-chat/client"
import { runAgentV2ResponsesTurn } from "@/lib/agent-v2/runtime/responses-agent"
import { buildAgentV2ProductToolMessage } from "@/lib/agent-v2/runtime/product-tool-context"
import { loadAgentV2AdvisorGuidance } from "@/lib/agent-v2/tools/guidance-tool"
import {
  projectRoutineForAgentV2,
  type AgentV2RoutineProjection,
} from "@/lib/agent-v2/tools/routine-projection"
import { projectSelectProductsForAgentV2 } from "@/lib/agent-v2/tools/select-products-projection"
import {
  type AgentV2AnswerMode,
  type AgentV2RoutineLayer,
  type AgentV2RoutineThreadContext,
  type AgentV2RoutineThreadStep,
  type AgentV2SafetyMode,
  type AgentV2TerminalAnswer,
} from "@/lib/agent-v2/contracts"
import { readPendingFollowupAction } from "@/lib/agent-v2/pending-followup-action"
import type { HairProfile } from "@/lib/types"
import type {
  AgentCompareScenario,
  AgentCompareTurnResult,
  AgentCompareUserRequest,
  AgentCompareCareBalanceTrace,
  AgentV2CompareTrace,
  AgentV2RequestInterpretationTrace,
  CompareRunResult,
} from "@/lib/agent/compare/types"

function getRequiredCompareEnv() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    throw new Error(
      "Missing env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_ANON_KEY",
    )
  }

  return { supabaseUrl, serviceRoleKey, anonKey }
}

function normalizeTurns(value: { prompt?: string; turns?: string[] }): string[] {
  const turns = value.turns?.map((turn) => turn.trim()).filter((turn) => turn.length > 0) ?? []
  if (turns.length > 0) return turns

  const prompt = value.prompt?.trim() ?? ""
  return prompt.length > 0 ? [prompt] : []
}

type AgentV2SelectProductsProjectionForCompare = ReturnType<typeof projectSelectProductsForAgentV2>
type AgentV2RuntimeToolExecutionContext = {
  effectiveCareContext?: EffectiveCareContext
}

export function normalizeAgentV2MatchedProductsForFinalAnswer(
  projections: ReturnType<typeof projectSelectProductsForAgentV2>[],
  answer: AgentV2TerminalAnswer,
): CompareRunResult["matched_products"] {
  const surfacedProductIds = collectSurfacedProductIds(answer)
  if (surfacedProductIds.length === 0) return []

  const productsById = new Map<string, { name: string; category: string | null }>()
  for (const projection of projections) {
    for (const product of projection.products) {
      if (!productsById.has(product.product_id)) {
        productsById.set(product.product_id, {
          name: product.name,
          category: projection.category,
        })
      }
    }
  }

  return surfacedProductIds.flatMap((productId) => {
    const product = productsById.get(productId)
    return product ? [product] : []
  })
}

function collectSurfacedProductIds(answer: AgentV2TerminalAnswer): string[] {
  if (answer.answer_mode === "product_recommendation") {
    return [
      ...new Set(answer.payload.recommendations.map((recommendation) => recommendation.product_id)),
    ]
  }

  return []
}

export function collectTrustedSurfacedProductProjections(
  projections: readonly AgentV2SelectProductsProjectionForCompare[],
  answer: AgentV2TerminalAnswer,
): AgentV2SelectProductsProjectionForCompare[] {
  const surfacedProductIds = new Set(collectSurfacedProductIds(answer))
  if (surfacedProductIds.size === 0) return []

  return projections.flatMap((projection) => {
    const products = projection.products.filter((product) =>
      surfacedProductIds.has(product.product_id),
    )
    const productIds = new Set(products.map((product) => product.product_id))
    const validProductIds = (projection.valid_product_ids ?? []).filter((productId) =>
      productIds.has(productId),
    )
    return products.length > 0
      ? [{ ...projection, products, valid_product_ids: validProductIds }]
      : []
  })
}

function isRequestInterpretationTrace(value: unknown): value is AgentV2RequestInterpretationTrace {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const record = value as Record<string, unknown>

  return (
    typeof record.primary_intent === "string" &&
    typeof record.product_request_kind === "string" &&
    typeof record.care_category === "string" &&
    (typeof record.requested_product_count === "number" ||
      record.requested_product_count === null) &&
    typeof record.count_policy === "string" &&
    typeof record.confidence === "number"
  )
}

export function formatAgentV2RequestInterpretationSummary(
  interpretation: AgentV2RequestInterpretationTrace | null | undefined,
): string | null {
  if (!interpretation) return null

  const count =
    interpretation.requested_product_count === null
      ? interpretation.count_policy
      : `${interpretation.requested_product_count} ${interpretation.count_policy}`

  return [
    "Intent:",
    interpretation.primary_intent,
    "·",
    interpretation.product_request_kind,
    "·",
    interpretation.care_category,
    "·",
    count,
    "·",
    `confidence ${interpretation.confidence.toFixed(2)}`,
  ].join(" ")
}

function extractRequestInterpretation(
  answer: AgentV2TerminalAnswer,
): AgentV2RequestInterpretationTrace | null {
  const interpretation = (answer as unknown as { request_interpretation?: unknown })
    .request_interpretation

  return isRequestInterpretationTrace(interpretation)
    ? (interpretation as AgentV2RequestInterpretationTrace)
    : null
}

export type AgentV2TraceTimingSummary = {
  model_latency_ms: number | null
  tool_latency_ms: number | null
  observed_trace_latency_ms: number | null
  model_steps: number
  tool_calls: number
  slowest_model_step_ms: number | null
  slowest_tool_call_ms: number | null
}

type AgentV2TraceTimingInput = {
  model_steps?: readonly unknown[]
  tool_calls?: readonly (Record<string, unknown> & { latency_ms?: number | null })[]
}

export function summarizeAgentV2TraceTiming(
  traces: readonly AgentV2TraceTimingInput[],
): AgentV2TraceTimingSummary {
  const modelLatencies = traces.flatMap((trace) =>
    (trace.model_steps ?? []).flatMap((step) => {
      if (!step || typeof step !== "object" || Array.isArray(step)) return []
      const latencyMs = (step as { latency_ms?: unknown }).latency_ms
      return typeof latencyMs === "number" && Number.isFinite(latencyMs) ? [latencyMs] : []
    }),
  )
  const toolLatencies = traces.flatMap((trace) =>
    (trace.tool_calls ?? []).flatMap((call) =>
      typeof call.latency_ms === "number" && Number.isFinite(call.latency_ms)
        ? [call.latency_ms]
        : [],
    ),
  )
  const modelLatencyMs = sumLatencyMs(modelLatencies)
  const toolLatencyMs = sumLatencyMs(toolLatencies)

  return {
    model_latency_ms: modelLatencyMs,
    tool_latency_ms: toolLatencyMs,
    observed_trace_latency_ms:
      modelLatencyMs === null && toolLatencyMs === null
        ? null
        : (modelLatencyMs ?? 0) + (toolLatencyMs ?? 0),
    model_steps: traces.reduce((count, trace) => count + (trace.model_steps?.length ?? 0), 0),
    tool_calls: traces.reduce((count, trace) => count + (trace.tool_calls?.length ?? 0), 0),
    slowest_model_step_ms: maxLatencyMs(modelLatencies),
    slowest_tool_call_ms: maxLatencyMs(toolLatencies),
  }
}

function sumLatencyMs(values: readonly number[]): number | null {
  return values.length > 0 ? Math.round(values.reduce((sum, value) => sum + value, 0)) : null
}

function maxLatencyMs(values: readonly number[]): number | null {
  return values.length > 0 ? Math.round(Math.max(...values)) : null
}

function augmentAgentV2CompareTrace(
  trace: Awaited<ReturnType<typeof runAgentV2ResponsesTurn>>["trace"],
  answer: AgentV2TerminalAnswer,
): AgentV2CompareTrace {
  const requestInterpretation = extractRequestInterpretation(answer)

  return {
    ...trace,
    request_interpretation_summary:
      formatAgentV2RequestInterpretationSummary(requestInterpretation),
    request_interpretation: requestInterpretation,
    validation_warnings: trace.validation_warnings,
    bounded_repair_kind: trace.bounded_repair_kind,
  }
}

export function updateAgentV2RoutineThreadContext(
  previous: AgentV2RoutineThreadContext | null,
  update: {
    answer_mode: AgentV2AnswerMode
    user_message: string
    routine_context: {
      active: boolean
      routine_layer: AgentV2RoutineLayer | null
      step_id?: string | null
      category: string | null
    }
    categories: string[]
    summary_de: string | null
    answer?: unknown
    routineProjection?: AgentV2RoutineProjection | null
    trusted?: boolean
  },
): AgentV2RoutineThreadContext {
  if (update.trusted === false && previous) return previous

  const keepsRoutineTrack = update.routine_context.active || update.answer_mode === "routine"

  if (!keepsRoutineTrack) {
    return {
      active: false,
      current_layer: null,
      last_answer_mode: update.answer_mode,
      last_routine_categories: [],
      last_user_goal: null,
      summary_de: null,
      pending_followup_action: readPendingFollowupAction(update.answer),
      visible_steps: [],
    }
  }

  const updateCategories = [
    ...update.categories,
    ...(update.routine_context.category ? [update.routine_context.category] : []),
  ]
    .map((category) => normalizeRoutineThreadCategory(category))
    .filter((category): category is string => Boolean(category))
  const lastRoutineCategories = [
    ...new Set([...(previous?.last_routine_categories ?? []), ...updateCategories]),
  ]
  const visibleSteps = updateAgentV2VisibleRoutineThreadSteps(previous?.visible_steps ?? [], update)

  return {
    active: true,
    current_layer: update.routine_context.routine_layer ?? previous?.current_layer ?? null,
    last_answer_mode: update.answer_mode,
    last_routine_categories: lastRoutineCategories,
    last_user_goal:
      update.answer_mode === "routine" || !previous?.last_user_goal
        ? update.user_message
        : previous.last_user_goal,
    summary_de: update.summary_de ?? previous?.summary_de ?? null,
    pending_followup_action: readPendingFollowupAction(update.answer),
    visible_steps: visibleSteps,
  }
}

function updateAgentV2VisibleRoutineThreadSteps(
  previous: readonly AgentV2RoutineThreadStep[],
  update: {
    answer_mode: AgentV2AnswerMode
    routine_context: {
      routine_layer: AgentV2RoutineLayer | null
      step_id?: string | null
      category: string | null
    }
    categories: string[]
    answer?: unknown
    routineProjection?: AgentV2RoutineProjection | null
  },
): AgentV2RoutineThreadStep[] {
  const routineAnswer = isAgentV2RoutineAnswer(update.answer) ? update.answer : null
  if (update.answer_mode === "routine" && routineAnswer) {
    const singleStepCategory =
      routineAnswer.payload.visible_steps.length === 1 && update.categories.length === 1
        ? normalizeRoutineThreadCategory(update.categories[0])
        : null
    const routineContextCategory = update.routine_context.category
      ? normalizeRoutineThreadCategory(update.routine_context.category)
      : null
    const projectionStepsById = new Map(
      (update.routineProjection?.visible_steps ?? []).map((step) => [step.step_id, step]),
    )
    return routineAnswer.payload.visible_steps.map((step, index) => {
      const projectionStep = projectionStepsById.get(step.step_id)
      const category =
        projectionStep?.category ??
        (routineAnswer.payload.visible_steps.length === 1
          ? (routineContextCategory ??
            singleStepCategory ??
            inferRoutineThreadCategory(step.label_de))
          : inferRoutineThreadCategory(step.label_de))

      return {
        step_id: step.step_id,
        label_de: step.label_de,
        category,
        ...(projectionStep
          ? {
              action: normalizeRoutineThreadAction(projectionStep.action),
              necessity: normalizeRoutineThreadNecessity(projectionStep.necessity),
              already_in_current_routine:
                projectionStep.action === "keep"
                  ? true
                  : projectionStep.action === "add"
                    ? false
                    : null,
            }
          : {}),
        order: index + 1,
        routine_layer: routineAnswer.payload.routine_layer,
      }
    })
  }

  const routineProductAnswer = isAgentV2RoutineProductRecommendation(update.answer)
    ? update.answer
    : null
  if (routineProductAnswer) {
    const routineContext = routineProductAnswer.routine_context ?? update.routine_context
    const stepId = routineContext.step_id?.trim()
    if (!stepId) return [...previous]

    const category =
      normalizeRoutineThreadCategory(routineContext.category ?? "") ??
      (update.routine_context.category
        ? normalizeRoutineThreadCategory(update.routine_context.category)
        : null)
    const existingIndex = previous.findIndex((step) => step.step_id === stepId)
    if (existingIndex >= 0) {
      return previous.map((step, index) =>
        index === existingIndex
          ? {
              ...step,
              category: category ?? step.category,
            }
          : step,
      )
    }

    return [
      ...previous,
      {
        step_id: stepId,
        label_de: category ? formatRoutineThreadCategoryLabel(category) : stepId,
        category,
        order: previous.length + 1,
        routine_layer: update.routine_context.routine_layer,
      },
    ]
  }

  return [...previous]
}

function normalizeRoutineThreadAction(
  action: string | null | undefined,
): AgentV2RoutineThreadStep["action"] {
  return action === "keep" || action === "add" || action === "adjust" || action === "remove"
    ? action
    : null
}

function normalizeRoutineThreadNecessity(
  necessity: string | null | undefined,
): AgentV2RoutineThreadStep["necessity"] {
  return necessity === "core" || necessity === "recommended" || necessity === "optional"
    ? necessity
    : null
}

function isAgentV2RoutineAnswer(
  answer: unknown,
): answer is Extract<AgentV2TerminalAnswer, { answer_mode: "routine" }> {
  return (
    Boolean(answer) &&
    typeof answer === "object" &&
    (answer as { answer_mode?: unknown }).answer_mode === "routine" &&
    Array.isArray((answer as { payload?: { visible_steps?: unknown } }).payload?.visible_steps)
  )
}

function isAgentV2RoutineProductRecommendation(
  answer: unknown,
): answer is Extract<AgentV2TerminalAnswer, { answer_mode: "product_recommendation" }> {
  return (
    Boolean(answer) &&
    typeof answer === "object" &&
    (answer as { answer_mode?: unknown }).answer_mode === "product_recommendation" &&
    (answer as { routine_context?: { active?: unknown } }).routine_context?.active === true
  )
}

function inferRoutineThreadCategory(labelDe: string): string | null {
  const normalized = labelDe
    .trim()
    .toLocaleLowerCase("de-DE")
    .replace(/[-\s]+/g, "_")
  const categoryByLabel: Record<string, string> = {
    shampoo: "shampoo",
    conditioner: "conditioner",
    spuelung: "conditioner",
    leave_in: "leave_in",
    leavein: "leave_in",
    leave_in_conditioner: "leave_in",
    maske: "mask",
    haarmaske: "mask",
    oel: "oil",
    öl: "oil",
    haaroel: "oil",
    haaröl: "oil",
    bondbuilder: "bondbuilder",
    tiefenreinigung: "deep_cleansing_shampoo",
    tiefenreinigungsshampoo: "deep_cleansing_shampoo",
    trockenshampoo: "dry_shampoo",
    peeling: "peeling",
  }

  return categoryByLabel[normalized] ?? null
}

const ROUTINE_THREAD_CATEGORY_VALUES = new Set([
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

const ROUTINE_PRODUCT_CATEGORY_VALUES = new Set<RoutineProduct>([
  "shampoo",
  "conditioner",
  "leave_in",
  "oil",
  "mask",
  "heat_protectant",
])

function normalizeRoutineThreadCategory(category: string): string | null {
  const inferred = inferRoutineThreadCategory(category)
  if (inferred) return inferred

  const normalized = category
    .trim()
    .toLocaleLowerCase("de-DE")
    .replace(/[-\s]+/g, "_")
  return ROUTINE_THREAD_CATEGORY_VALUES.has(normalized) ? normalized : null
}

function readAgentV2EffectiveCareContext(
  input: Record<string, unknown>,
): EffectiveCareContext | null {
  const value = input.effective_care_context
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const normalized = (value as { normalized?: unknown }).normalized
  if (!normalized || typeof normalized !== "object" || Array.isArray(normalized)) return null
  const routineInventory = (normalized as { routineInventory?: unknown }).routineInventory
  if (
    !routineInventory ||
    typeof routineInventory !== "object" ||
    Array.isArray(routineInventory)
  ) {
    return null
  }
  return value as EffectiveCareContext
}

function createEmptyAgentV2HairProfile(): HairProfile {
  return {
    id: "",
    user_id: "",
    hair_texture: null,
    thickness: null,
    hair_length: null,
    density: null,
    concerns: [],
    products_used: null,
    shampoo_frequency: null,
    heat_styling: null,
    styling_tools: null,
    goals: [],
    cuticle_condition: null,
    protein_moisture_balance: null,
    scalp_type: null,
    scalp_condition: null,
    chemical_treatment: [],
    desired_volume: null,
    routine_preference: null,
    current_routine_products: [],
    towel_material: null,
    towel_technique: null,
    drying_method: null,
    brush_type: null,
    night_protection: null,
    uses_heat_protection: false,
    additional_notes: null,
    conversation_memory: null,
    created_at: "",
    updated_at: "",
  }
}

function buildAgentV2EffectiveHairProfile(
  fallback: HairProfile | null,
  effectiveContext: EffectiveCareContext | null,
): HairProfile | null {
  if (!effectiveContext) return fallback

  const profile = effectiveContext.normalized
  return {
    ...(fallback ?? createEmptyAgentV2HairProfile()),
    hair_texture: profile.hairTexture,
    hair_length: profile.hairLength,
    thickness: profile.thickness,
    density: profile.density,
    concerns: [...profile.concerns],
    shampoo_frequency: profile.shampooFrequency,
    heat_styling: profile.heatStyling,
    styling_tools: profile.stylingTools ? [...profile.stylingTools] : null,
    goals: [...profile.goals],
    cuticle_condition: profile.cuticleCondition,
    protein_moisture_balance: profile.proteinMoistureBalance,
    scalp_type: profile.scalpType,
    scalp_condition: profile.scalpCondition,
    chemical_treatment: [...profile.chemicalTreatment],
    current_routine_products: Object.values(profile.routineInventory).flatMap((item) =>
      item?.present === true && ROUTINE_PRODUCT_CATEGORY_VALUES.has(item.category as RoutineProduct)
        ? [item.category as RoutineProduct]
        : [],
    ),
    towel_material: profile.towelMaterial,
    towel_technique: profile.towelTechnique,
    drying_method: profile.dryingMethod,
    brush_type: profile.brushType,
    night_protection: profile.nightProtection ? [...profile.nightProtection] : null,
    uses_heat_protection: profile.usesHeatProtection,
  }
}

function buildAgentV2EffectiveRoutineItems(
  fallback: PersistenceRoutineItemRow[],
  effectiveContext: EffectiveCareContext | null,
): PersistenceRoutineItemRow[] {
  if (!effectiveContext) return fallback

  return Object.values(effectiveContext.normalized.routineInventory).flatMap((item) =>
    item?.present === true
      ? [
          {
            category: item.category,
            product_name: item.productName,
            frequency_range: item.frequencyBand,
          },
        ]
      : [],
  )
}

function buildAgentV2CareBalanceContext(
  profile: HairProfile | null,
  routineItems: PersistenceRoutineItemRow[],
): AgentCompareCareBalanceTrace {
  const runtime = buildRecommendationEngineRuntimeFromPersistence(profile, routineItems)
  const rowsWithActions = runtime.careBalance.rows.filter(
    (row) => row.recommendation !== "no_action",
  )
  return buildCareBalanceToolContext({
    runtime,
    rows: rowsWithActions.length > 0 ? rowsWithActions : runtime.careBalance.rows,
  })
}

function formatRoutineThreadCategoryLabel(category: string): string {
  const labelByCategory: Record<string, string> = {
    shampoo: "Shampoo",
    conditioner: "Conditioner",
    mask: "Maske",
    leave_in: "Leave-in",
    oil: "Oel",
    bondbuilder: "Bondbuilder",
    deep_cleansing_shampoo: "Tiefenreinigung",
    dry_shampoo: "Trockenshampoo",
    peeling: "Peeling",
  }

  return labelByCategory[category] ?? category
}

function extractRoutineThreadCategories(answer: AgentV2TerminalAnswer): string[] {
  const categories = [
    ...answer.extracted_constraints.product_categories,
    answer.routine_context.category,
  ].filter((category): category is string => Boolean(category))

  if (answer.answer_mode === "routine") {
    categories.push(
      ...answer.payload.visible_steps
        .map((step) => inferRoutineThreadCategory(step.label_de))
        .filter((category): category is string => Boolean(category)),
    )
  }

  return [...new Set(categories)]
}

export function classifyAgentV2SafetyMode(message: string): AgentV2SafetyMode {
  const normalized = message.toLocaleLowerCase("de-DE")

  if (
    /\b(blutet|bluten|wunde|wunden|offene kopfhaut|brennt stark|verbrennung|eiter|infektion)\b/.test(
      normalized,
    ) ||
    /haare?\s+fall(?:en|t).*(?:b(?:ue|ü)scheln|b(?:ue|ü)schelweise)/.test(normalized) ||
    /\b(pl[oö]tzlich(?:er|e|es)?\s+haarausfall|verschreibungspflichtig|rezeptpflichtig)\b/.test(
      normalized,
    )
  ) {
    return "hard_short_circuit"
  }

  const hasItchWithForegroundSymptom =
    /\bjuck(?:t|en|reiz)\b/.test(normalized) &&
    /\b(ger[oö]tet|rot|r[oö]tlich|brennt|brennen|wund|schmerzt|schmerzen|n[aä]sst|n[aä]ssen|ausschlag|offene stelle|offene stellen|schuppen|schuppt|schupp(?:ig|ige|iger|iges|enden?))\b/.test(
      normalized,
    )
  const hasForegroundSymptom =
    /\b(schmerzt|schmerzen|n[aä]sst|n[aä]ssen|ausschlag|offene stelle|offene stellen)\b/.test(
      normalized,
    ) ||
    /\bkopfhaut\b.*\bbrennt\b/.test(normalized) ||
    /\bbrennt\b.*\bkopfhaut\b/.test(normalized)
  const hasHairLossRedFlag =
    /\b(haarausfall|haarverlust|kahle stelle|kahle stellen|kreisrund(?:er|e|es)? haarausfall|postpartum|schwangerschaft)\b/.test(
      normalized,
    )

  if (hasItchWithForegroundSymptom || hasForegroundSymptom || hasHairLossRedFlag) {
    return "restricted"
  }

  return "normal"
}

export async function runAgentV2ComparisonForUser(
  params: AgentCompareUserRequest,
  options: { includeCareBalanceContext?: boolean } = {},
): Promise<CompareRunResult> {
  const startedAt = performance.now()
  const turns = normalizeTurns(params)
  const context = await getUserContext(params.userId)
  const memoryContext = await loadUserMemoryContext(params.userId)
  let latestSelectProductsResult: SelectProductsToolResult | null = null
  const selectProducts = createSelectProductsTool({
    onResult: (result) => {
      latestSelectProductsResult = result
    },
  })
  const buildRoutine = createBuildOrFixRoutineTool()
  const recentMessages: Array<{ role: "user" | "assistant"; content: string }> = []
  const sessionMemory = []
  const turnResults: AgentCompareTurnResult[] = []
  let finalResult: Awaited<ReturnType<typeof runAgentV2ResponsesTurn>> | null = null
  const selectedProductProjections: AgentV2SelectProductsProjectionForCompare[] = []
  const trustedSurfacedProductProjections: AgentV2SelectProductsProjectionForCompare[] = []
  let latestCareBalanceTrace: AgentCompareCareBalanceTrace | null = null
  let latestRoutineProjection: AgentV2RoutineProjection | null = null
  let currentRoutineLayer: AgentV2RoutineLayer | null = null
  let routineThreadContext: AgentV2RoutineThreadContext | null = null

  for (const [index, message] of turns.entries()) {
    const turnStartedAt = performance.now()
    latestRoutineProjection = null
    const safetyMode = classifyAgentV2SafetyMode(message)
    const turnCareBalanceContext = options.includeCareBalanceContext
      ? buildAgentV2CareBalanceContext(context.profile, context.routine_inventory)
      : null
    if (turnCareBalanceContext) {
      latestCareBalanceTrace = turnCareBalanceContext
    }
    const result = await runAgentV2ResponsesTurn({
      client: getOpenAI() as unknown as Parameters<typeof runAgentV2ResponsesTurn>[0]["client"],
      message,
      recentMessages,
      userContext: {
        hairProfile: context.profile,
        routineInventory: context.routine_inventory,
        derivedSignals: context.derived_signals,
        relevantMemory: context.relevant_memory,
        missingProfile: context.missing_profile,
        sessionMemory,
        careBalanceContext: turnCareBalanceContext,
      },
      currentRoutineLayer,
      routineThreadContext,
      priorSelectedProductProjections: [...trustedSurfacedProductProjections],
      safetyMode,
      tools: {
        load_advisor_guidance: async (input) => loadAgentV2AdvisorGuidance(input),
        select_products: async (input, executionContext?: AgentV2RuntimeToolExecutionContext) => {
          latestSelectProductsResult = null
          const effectiveCareContext =
            executionContext?.effectiveCareContext ?? readAgentV2EffectiveCareContext(input)
          const effectiveHairProfile = buildAgentV2EffectiveHairProfile(
            context.profile,
            effectiveCareContext,
          )
          const effectiveRoutineItems = buildAgentV2EffectiveRoutineItems(
            context.routine_inventory,
            effectiveCareContext,
          )
          const productToolMessage = buildAgentV2ProductToolMessage({
            latestMessage: message,
            recentMessages,
          })
          const projection = await selectProducts({
            category: input.category as Parameters<typeof selectProducts>[0]["category"],
            message: productToolMessage,
            hairProfile: effectiveHairProfile,
            memoryContext,
            routineItems: effectiveRoutineItems,
            effectiveCareContext,
          })
          const rawResult =
            latestSelectProductsResult ??
            ({
              projection,
              products: [],
              effectiveHairProfile,
              runtime: {} as SelectProductsToolResult["runtime"],
            } satisfies SelectProductsToolResult)
          if (rawResult.projection.care_balance_context) {
            latestCareBalanceTrace = rawResult.projection.care_balance_context
          }
          const agentProjection = projectSelectProductsForAgentV2(rawResult, {
            includeCareBalanceContext: options.includeCareBalanceContext,
          })
          selectedProductProjections.push(agentProjection)
          return agentProjection
        },
        build_or_fix_routine: async (
          input,
          executionContext?: AgentV2RuntimeToolExecutionContext,
        ) => {
          const effectiveCareContext =
            executionContext?.effectiveCareContext ?? readAgentV2EffectiveCareContext(input)
          const effectiveHairProfile = buildAgentV2EffectiveHairProfile(
            context.profile,
            effectiveCareContext,
          )
          const effectiveRoutineItems = buildAgentV2EffectiveRoutineItems(
            context.routine_inventory,
            effectiveCareContext,
          )
          const mutationKind = typeof input.mutation_kind === "string" ? input.mutation_kind : null
          const projection = await buildRoutine({
            objective:
              input.objective === "build_routine" || input.objective === "fix_routine"
                ? input.objective
                : "build_routine",
            message,
            hairProfile: effectiveHairProfile,
            layer: input.requested_layer as Parameters<typeof buildRoutine>[0]["layer"],
            requestedCategory: input.requested_category as Parameters<
              typeof buildRoutine
            >[0]["requestedCategory"],
            mutationKind: mutationKind as Parameters<typeof buildRoutine>[0]["mutationKind"],
            routineItems: effectiveRoutineItems,
            effectiveCareContext,
          })
          if (projection.care_balance_context) {
            latestCareBalanceTrace = projection.care_balance_context
          }
          const agentProjection = projectRoutineForAgentV2(projection, {
            requestedLayer: input.requested_layer as AgentV2RoutineLayer,
            includeCareBalanceContext: options.includeCareBalanceContext,
          })
          latestRoutineProjection = agentProjection
          return agentProjection
        },
      },
    })

    finalResult = result
    const trustedTurn =
      result.trace.failure_stage === null && result.trace.validation_errors.length === 0
    routineThreadContext = updateAgentV2RoutineThreadContext(routineThreadContext, {
      answer_mode: result.final_answer.answer_mode,
      user_message: message,
      answer: result.final_answer,
      routine_context: {
        active: result.final_answer.routine_context.active,
        routine_layer: result.final_answer.routine_context.routine_layer,
        category: result.final_answer.routine_context.category,
      },
      categories: extractRoutineThreadCategories(result.final_answer),
      summary_de: String(result.final_answer.payload.user_facing_answer_de ?? "").slice(0, 500),
      routineProjection: latestRoutineProjection,
      trusted: trustedTurn,
    })
    if (trustedTurn) {
      trustedSurfacedProductProjections.push(
        ...collectTrustedSurfacedProductProjections(
          selectedProductProjections,
          result.final_answer,
        ),
      )
    }
    currentRoutineLayer = routineThreadContext.current_layer
    sessionMemory.push(...result.accepted_session_memory_writes)
    const answer = String(result.final_answer.payload.user_facing_answer_de ?? "")
    const compareTrace = augmentAgentV2CompareTrace(result.trace, result.final_answer)

    turnResults.push({
      turn: index + 1,
      prompt: message,
      answer,
      latency_ms: Math.round(performance.now() - turnStartedAt),
      debug_lines: [
        `AgentV2: ${result.final_answer.answer_mode}`,
        `Tools: ${result.trace.tool_calls.map((call) => call.name).join(", ") || "keine"}`,
        `Routine thread: ${routineThreadContext.active ? "aktiv" : "inaktiv"}${
          routineThreadContext.current_layer ? `/${routineThreadContext.current_layer}` : ""
        }`,
      ],
      matched_products: normalizeAgentV2MatchedProductsForFinalAnswer(
        selectedProductProjections,
        result.final_answer,
      ),
      care_balance_trace: options.includeCareBalanceContext ? latestCareBalanceTrace : null,
      agent_v2_trace: compareTrace,
      error: null,
    })
    recentMessages.push({ role: "user", content: message }, { role: "assistant", content: answer })
  }

  if (!finalResult) {
    throw new Error("AgentV2 comparison did not produce a result.")
  }

  const finalCompareTrace = augmentAgentV2CompareTrace(finalResult.trace, finalResult.final_answer)

  return {
    system: options.includeCareBalanceContext ? "agent_v2_care_balance" : "agent_v2",
    display_label: options.includeCareBalanceContext
      ? "AgentV2 GPT-5.4-mini + CareBalance"
      : "AgentV2 GPT-5.4-mini",
    answer: String(finalResult.final_answer.payload.user_facing_answer_de ?? ""),
    latency_ms: Math.round(performance.now() - startedAt),
    debug_lines: [
      `AgentV2: ${finalResult.final_answer.answer_mode}`,
      `Tools: ${finalResult.trace.tool_calls.map((call) => call.name).join(", ") || "keine"}`,
      `Routine thread: ${routineThreadContext?.active ? "aktiv" : "inaktiv"}${
        routineThreadContext?.current_layer ? `/${routineThreadContext.current_layer}` : ""
      }`,
    ],
    matched_products: normalizeAgentV2MatchedProductsForFinalAnswer(
      selectedProductProjections,
      finalResult.final_answer,
    ),
    care_balance_trace: options.includeCareBalanceContext ? latestCareBalanceTrace : null,
    agent_v2_trace: finalCompareTrace,
    turns: turnResults.length > 1 ? turnResults : undefined,
    error: null,
  }
}

export async function runAgentV2Comparison(params: {
  scenario: AgentCompareScenario
  prompt?: string
  turns?: string[]
  baseUrl?: string | null
  includeCareBalanceContext?: boolean
}): Promise<CompareRunResult> {
  const { supabaseUrl, serviceRoleKey, anonKey } = getRequiredCompareEnv()
  const session = await createTestSession(supabaseUrl, serviceRoleKey, anonKey)

  try {
    await upsertHairProfile(
      session.admin,
      session.userId,
      params.scenario.hair_profile,
      params.scenario.routine_inventory ?? [],
    )

    return runAgentV2ComparisonForUser(
      {
        userId: session.userId,
        prompt: params.prompt,
        turns: params.turns,
        baseUrl: params.baseUrl,
      },
      { includeCareBalanceContext: params.includeCareBalanceContext },
    )
  } finally {
    await session.cleanup()
  }
}
