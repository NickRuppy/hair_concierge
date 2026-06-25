import { getOpenAI, getObservedOpenAI } from "@/lib/openai/client"
import { createBuildOrFixRoutineTool } from "@/lib/agent/tools/build-or-fix-routine"
import { buildCareBalanceToolContext } from "@/lib/agent/tools/care-balance-context"
import { getUserContext, type UserContextProjection } from "@/lib/agent/tools/get-user-context"
import {
  createSelectProductsTool,
  type SelectProductsToolResult,
} from "@/lib/agent/tools/select-products"
import {
  loadAgentV2ProductionConversationHistory,
  verifyAgentV2ProductionConversationOwnership,
} from "@/lib/agent-v2/production/conversation-history"
import {
  buildAgentV2GenerationMetadata,
  isAgentV2LangfuseObservationEnabled,
  observeAgentV2ToolCall,
} from "@/lib/agent-v2/production/langfuse-observability"
import { buildAgentV2ProductToolMessage } from "@/lib/agent-v2/runtime/product-tool-context"
import {
  type AgentV2AnswerMode,
  AgentV2CareCategorySchema,
  type AgentV2RoutineLayer,
  type AgentV2RoutineThreadContext,
  type AgentV2SafetyMode,
  type AgentV2SessionMemoryWrite,
  type AgentV2TerminalAnswer,
  type AgentV2Trace,
} from "@/lib/agent-v2/contracts"
import {
  buildAgentV2NamedProductContext,
  getAgentV2NamedProductCategoryReferenceTerms,
  type AgentV2NamedProductContext,
} from "@/lib/agent-v2/named-product-context"
import {
  runAgentV2ResponsesTurn,
  type AgentV2TrustedSelectedProductContext,
} from "@/lib/agent-v2/runtime/responses-agent"
import { loadAgentV2AdvisorGuidance } from "@/lib/agent-v2/tools/guidance-tool"
import {
  lookupProductCandidate,
  type ProductLookupCatalog,
  type ProductLookupResult,
} from "@/lib/product-intake/product-lookup"
import {
  isProductEligibleForMode,
  productIsActive,
  productLifecycleStatus,
} from "@/lib/product-catalog/eligibility"
import { createSupabaseProductIntakeRepository } from "@/lib/product-intake/repository"
import type { BrandResolutionCatalogInput } from "@/lib/product-identity/brand-resolution"
import {
  projectRoutineForAgentV2,
  type AgentV2RoutineProjection,
} from "@/lib/agent-v2/tools/routine-projection"
import {
  projectSelectProductsForAgentV2,
  type AgentV2SelectProductsProjection,
} from "@/lib/agent-v2/tools/select-products-projection"
import {
  buildAgentV2Classification,
  buildAgentV2RouterDecision,
  deriveEngineArtifacts,
  deriveIntent,
  deriveMatchedProducts,
  deriveProductCategory,
} from "@/lib/agent-v2/production/product-output"
import {
  buildRoutineThreadVisibleSteps,
  collectTrustedSurfacedProductProjections,
  mergeAgentV2SessionMemory,
  mergePriorSelectedProductProjections,
  updateAgentV2ProductionRoutineThreadContext,
} from "@/lib/agent-v2/production/session-state"
import {
  AGENT_V2_PRODUCTION_ENGINE,
  type AgentV2ActiveResolvedProductContext,
  normalizeAgentV2ConversationState,
  type AgentV2ConversationStateTransition,
  type AgentV2ConversationStateV2,
} from "@/lib/agent-v2/production/persisted-session-state"
import { loadAgentV2ConversationStateForUser } from "@/lib/chat-runtime/conversation-state-store"
import { buildPipelineTraceDraft, type PipelineTraceDraft } from "@/lib/chat-runtime/debug-trace"
import { loadUserMemoryContext, type UserMemoryContext } from "@/lib/chat-runtime/user-memory"
import {
  LANGFUSE_PROMPTS,
  buildLangfusePromptConfig,
  getManagedTextPromptTemplate,
} from "@/lib/langfuse/prompts"
import type { PersistenceRoutineItemRow } from "@/lib/recommendation-engine/adapters/from-persistence"
import { buildRecommendationEngineRuntimeFromPersistence } from "@/lib/recommendation-engine/runtime"
import type { EffectiveCareContext } from "@/lib/recommendation-engine/types"
import { createAdminClient } from "@/lib/supabase/admin"
import type {
  ChatCategoryDecision,
  ChatPromptSnapshot,
  ClassificationResult,
  ConversationTurnStateTransition,
  EnrichedCitationSource,
  HairProfile,
  IntentType,
  LangfusePromptReference,
  Message,
  Product,
  ProductIntakeCategoryKey,
  ProductLookupClarification,
  RouterDecision,
} from "@/lib/types"
import type { RoutineProduct } from "@/lib/vocabulary"

type RecentConversationMessage = {
  role: "user" | "assistant"
  content: string
}

type AgentV2ResponsesClient = Parameters<typeof runAgentV2ResponsesTurn>[0]["client"]
type AgentV2RuntimeToolExecutionContext = {
  effectiveCareContext?: EffectiveCareContext
}
type AgentV2StoredProductProjection = Partial<AgentV2SelectProductsProjection>
type AgentV2ProductionTraceTiming = {
  modelMs: number | null
  toolMs: number | null
  gateMs: number | null
}
type ProductLookupExecutionInput = {
  category: string | null
  brand_text: string | null
  product_name_text: string | null
}
type ProductLookupExecution = {
  input: ProductLookupExecutionInput
  result: ProductLookupResult
}
type ProductLookupCatalogLoader = () => Promise<{
  catalog: ProductLookupCatalog
  brandCatalog: BrandResolutionCatalogInput
}>

export interface PipelineParams {
  message: string
  conversationId?: string
  userId: string
  requestId: string
  productIntakeEnabled?: boolean
  trustedSelectedProductContext?: AgentV2TrustedSelectedProductContext | null
}

export interface PipelineResult {
  stream: ReadableStream<Uint8Array>
  conversationId: string
  intent: IntentType
  matchedProducts: Product[]
  sources: EnrichedCitationSource[]
  routerDecision: RouterDecision
  conversationStateTransition: ConversationTurnStateTransition
  categoryDecision?: ChatCategoryDecision
  engineTrace?: import("@/lib/types").RecommendationEngineTrace
  retrievalSummary: {
    final_context_count: number
  }
  debugTrace: PipelineTraceDraft
  visibleFailure?: boolean
  answerMode: AgentV2AnswerMode
  productIntakeOffer?: import("@/lib/types").ProductIntakeOffer | null
  productLookupClarification?: ProductLookupClarification | null
}

interface ProductionAgentV2PipelineDeps {
  client?: AgentV2ResponsesClient
  verifyConversationOwnership?: (params: {
    conversationId: string
    userId: string
  }) => Promise<boolean>
  loadConversationHistory?: (conversationId: string, userId: string) => Promise<Message[]>
  getUserContext?: (userId: string) => Promise<UserContextProjection>
  loadUserMemoryContext?: (userId: string) => Promise<UserMemoryContext>
  loadConversationState?: (params: { conversationId: string; userId: string }) => Promise<unknown>
  createSelectProductsTool?: typeof createSelectProductsTool
  createBuildOrFixRoutineTool?: typeof createBuildOrFixRoutineTool
  runAgentV2ResponsesTurn?: typeof runAgentV2ResponsesTurn
  getOpenAI?: typeof getOpenAI
  getObservedOpenAI?: typeof getObservedOpenAI
  getManagedTextPromptTemplate?: typeof getManagedTextPromptTemplate
  observeAgentV2ToolCall?: typeof observeAgentV2ToolCall
  createProductIntakeRepository?: typeof createSupabaseProductIntakeRepository
}

const ROUTINE_PRODUCT_CATEGORY_VALUES = new Set<RoutineProduct>([
  "shampoo",
  "conditioner",
  "leave_in",
  "oil",
  "mask",
  "heat_protectant",
])

function selectProductIntakeOfferForAnswer(
  answer: AgentV2TerminalAnswer,
  executions: readonly ProductLookupExecution[],
  latestUserMessage: string,
  options: { allowFallbackIntake?: boolean } = {},
): ProductLookupResult["intake_offer"] {
  const eligible = executions.filter(
    (execution) => execution.result.status === "not_found" && execution.result.intake_offer,
  )
  if (eligible.length === 0) return null

  const matchingOffer =
    eligible.find((execution) =>
      productLookupExecutionMatchesAnswer(execution, answer, latestUserMessage),
    )?.result.intake_offer ?? null

  if (answerSupportsProductIntakeOffer(answer)) {
    return matchingOffer
  }

  if (options.allowFallbackIntake) {
    return (
      matchingOffer ?? (eligible.length === 1 ? (eligible[0]?.result.intake_offer ?? null) : null)
    )
  }

  return null
}

const PRODUCT_LOOKUP_CATEGORY_LABELS: Record<ProductIntakeCategoryKey, string> = {
  shampoo: "Shampoo",
  conditioner: "Conditioner",
  leave_in: "Leave-in",
  mask: "Maske/Kur",
  oil: "Öl",
  dry_shampoo: "Trockenshampoo",
  deep_cleansing_shampoo: "Tiefenreinigungsshampoo",
  bondbuilder: "Bondbuilder",
}

function isProductIntakeCategoryKey(value: string | null): value is ProductIntakeCategoryKey {
  return Object.prototype.hasOwnProperty.call(PRODUCT_LOOKUP_CATEGORY_LABELS, value ?? "")
}

function productLookupCandidateCategory(candidate: ProductLookupResult["candidates"][number]) {
  return candidate.product.categoryKey ?? candidate.product.category_key ?? null
}

function productLookupCandidateName(candidate: ProductLookupResult["candidates"][number]) {
  return candidate.product.cleanName ?? candidate.product.name
}

function selectProductLookupClarificationForAnswer(
  answer: AgentV2TerminalAnswer,
  executions: readonly ProductLookupExecution[],
  latestUserMessage: string,
  options: { allowFallbackClarification?: boolean } = {},
): ProductLookupClarification | null {
  if (!options.allowFallbackClarification && !answerSupportsProductIntakeOffer(answer)) return null

  const eligibleExecutions = executions.filter(
    (candidate) =>
      (candidate.result.status === "ambiguous" ||
        candidate.result.status === "needs_variant_selection" ||
        candidate.result.status === "category_mismatch") &&
      candidate.result.candidates.length > 0,
  )
  const execution =
    eligibleExecutions.find((candidate) =>
      productLookupExecutionMatchesAnswer(candidate, answer, latestUserMessage),
    ) ?? (eligibleExecutions.length === 1 ? eligibleExecutions[0] : null)
  if (!execution) return null

  const category = isProductIntakeCategoryKey(execution.result.category)
    ? execution.result.category
    : null
  if (!category) return null

  const kind =
    execution.result.status === "category_mismatch" ? "category_mismatch" : "variant_selection"
  const candidates = execution.result.candidates.slice(0, 3).map((candidate) => {
    const candidateCategory = productLookupCandidateCategory(candidate)
    const reason =
      candidateCategory && candidateCategory !== category
        ? "category_mismatch"
        : "same_brand_same_category"
    return {
      product_id: candidate.productId,
      name: productLookupCandidateName(candidate),
      category: candidateCategory,
      category_label_de: isProductIntakeCategoryKey(candidateCategory)
        ? PRODUCT_LOOKUP_CATEGORY_LABELS[candidateCategory]
        : "Produkt",
      reason,
    } satisfies ProductLookupClarification["candidates"][number]
  })

  const brandText = execution.input.brand_text?.trim() ?? ""
  const productNameText = execution.input.product_name_text?.trim() ?? ""
  const productNameAlreadyContainsBrand =
    Boolean(brandText) &&
    Boolean(productNameText) &&
    productNameText.toLocaleLowerCase("de-DE").startsWith(brandText.toLocaleLowerCase("de-DE"))
  const requestedName =
    (productNameAlreadyContainsBrand
      ? productNameText
      : [brandText, productNameText].filter(Boolean).join(" ")
    ).trim() || answer.request_interpretation.evidence_quote
  const categoryLabel = PRODUCT_LOOKUP_CATEGORY_LABELS[category]
  const firstCandidateCategoryLabel = candidates[0]?.category_label_de ?? "einer anderen Kategorie"
  const prompt =
    kind === "category_mismatch"
      ? `Ich finde ${requestedName} bei uns nur als ${firstCandidateCategoryLabel}, nicht als ${categoryLabel}. Wenn du dieses Produkt meinst, wähle es aus. Wenn du ein anderes Produkt meinst, füge es hinzu.`
      : candidates.length === 1
        ? `Ich finde ${requestedName} nicht eindeutig, aber ich habe dieses ${categoryLabel} in unserer Datenbank gefunden.`
        : `Ich finde ${requestedName} nicht eindeutig, aber ich habe diese ${categoryLabel} in unserer Datenbank gefunden.`

  return {
    id: `product-lookup-${execution.result.intake_offer?.id ?? crypto.randomUUID()}`,
    kind,
    source: "chat",
    original_user_message: latestUserMessage,
    query: {
      brand_text: execution.input.brand_text,
      product_name_text: execution.input.product_name_text,
      category,
    },
    copy: {
      prompt_de: prompt,
    },
    candidates,
    none_action: {
      label_de: "Nein, mein Produkt hinzufügen",
      product_intake_offer: execution.result.intake_offer ?? {
        id: `product-intake-${crypto.randomUUID()}`,
        source: "chat",
        reason: "product_lookup_not_found",
        category,
        extracted_identity: {
          ...(execution.input.brand_text ? { brand_text: execution.input.brand_text } : {}),
          ...(execution.input.product_name_text
            ? { product_name_text: execution.input.product_name_text }
            : {}),
        },
      },
    },
  }
}

function productLookupExecutionHasClarificationCandidates(execution: ProductLookupExecution) {
  return (
    (execution.result.status === "ambiguous" ||
      execution.result.status === "needs_variant_selection" ||
      execution.result.status === "category_mismatch") &&
    execution.result.candidates.length > 0
  )
}

function traceLookupCallCanRecoverClarification(call: AgentV2Trace["tool_calls"][number]): boolean {
  if (call.name !== "lookup_product_candidate") return false
  return (
    call.output_summary === "product_lookup:ambiguous" ||
    call.output_summary === "product_lookup:needs_variant_selection" ||
    call.output_summary === "product_lookup:category_mismatch"
  )
}

function readProductLookupInputFromTraceCall(
  call: AgentV2Trace["tool_calls"][number],
): ProductLookupExecutionInput | null {
  if (call.name !== "lookup_product_candidate") return null
  const args = call.arguments
  if (!args || typeof args !== "object" || Array.isArray(args)) return null
  const input = {
    category: typeof args.category === "string" ? args.category : null,
    brand_text: typeof args.brand_text === "string" ? args.brand_text : null,
    product_name_text: typeof args.product_name_text === "string" ? args.product_name_text : null,
  }
  if (!input.category && !input.brand_text && !input.product_name_text) return null
  return input
}

async function recoverProductLookupClarificationExecutionsFromTrace(params: {
  trace: AgentV2Trace
  existingExecutions: readonly ProductLookupExecution[]
  loadProductLookupCatalogs: ProductLookupCatalogLoader
  requestId: string
}): Promise<ProductLookupExecution[]> {
  if (params.existingExecutions.some(productLookupExecutionHasClarificationCandidates)) {
    return [...params.existingExecutions]
  }

  const calls = params.trace.tool_calls.filter(traceLookupCallCanRecoverClarification)
  if (calls.length === 0) return [...params.existingExecutions]

  const recoveredExecutions: ProductLookupExecution[] = []
  const { catalog, brandCatalog } = await params.loadProductLookupCatalogs()
  for (const call of calls) {
    const input = readProductLookupInputFromTraceCall(call)
    if (!input) continue
    const result = lookupProductCandidate({
      input,
      catalog,
      brandCatalog,
      offerId: `product-intake-${params.requestId}`,
      eligibilityMode: "intake_dedupe",
    })
    if (productLookupExecutionHasClarificationCandidates({ input, result })) {
      recoveredExecutions.push({ input, result })
    }
  }

  if (recoveredExecutions.length === 0) return [...params.existingExecutions]
  return [...params.existingExecutions, ...recoveredExecutions]
}

async function buildDeterministicNamedProductLookupFallback(params: {
  namedProductContext: AgentV2NamedProductContext | null
  existingExecutions: readonly ProductLookupExecution[]
  trace: AgentV2Trace
  loadProductLookupCatalogs: ProductLookupCatalogLoader
  requestId: string
}): Promise<{ answer: AgentV2TerminalAnswer; execution: ProductLookupExecution } | null> {
  const context = params.namedProductContext
  if (!context || context.named_product_intent === "background") return null
  if (params.existingExecutions.length > 0) return null
  if (params.trace.tool_calls.some((call) => call.name === "lookup_product_candidate")) return null
  if (!isProductIntakeCategoryKey(context.category)) return null

  const { catalog, brandCatalog } = await params.loadProductLookupCatalogs()
  const input = buildLookupInputFromNamedProductContext(context, brandCatalog)
  if (!input) return null

  const result = lookupProductCandidate({
    input,
    catalog,
    brandCatalog,
    offerId: `product-intake-${params.requestId}`,
    eligibilityMode: "intake_dedupe",
  })
  if (result.status === "insufficient_identity" || result.status === "unsupported_category") {
    return null
  }

  return {
    execution: { input, result },
    answer: buildDeterministicNamedProductFallbackAnswer({
      context,
      lookupResult: result,
      usedGuidancePackageIds: params.trace.loaded_guidance_package_ids,
    }),
  }
}

function buildRecoveredNotFoundProductLookupFailureFallback(params: {
  namedProductContext: AgentV2NamedProductContext | null
  executions: readonly ProductLookupExecution[]
  trace: AgentV2Trace
  latestUserMessage: string
}): AgentV2TerminalAnswer | null {
  const context = params.namedProductContext
  if (!context || context.named_product_intent === "background") return null
  if (!params.trace.failure_stage) return null

  const eligibleExecutions = params.executions.filter(
    (execution) => execution.result.status === "not_found" && execution.result.intake_offer,
  )
  if (eligibleExecutions.length === 0) return null

  const matchingExecution =
    eligibleExecutions.find((execution) =>
      productLookupExecutionMatchesNamedProductContext(
        execution,
        context,
        params.latestUserMessage,
      ),
    ) ?? (eligibleExecutions.length === 1 ? eligibleExecutions[0] : null)
  if (!matchingExecution) return null

  return buildDeterministicNamedProductFallbackAnswer({
    context,
    lookupResult: matchingExecution.result,
    usedGuidancePackageIds: params.trace.loaded_guidance_package_ids,
  })
}

function productLookupExecutionMatchesNamedProductContext(
  execution: ProductLookupExecution,
  context: AgentV2NamedProductContext,
  latestUserMessage: string,
): boolean {
  const category = AgentV2CareCategorySchema.safeParse(execution.input.category)
  if (category.success && category.data !== context.category) return false

  const identityParts = [
    execution.input.brand_text && execution.input.product_name_text
      ? `${execution.input.brand_text} ${execution.input.product_name_text}`
      : null,
    execution.input.product_name_text,
  ].filter((part): part is string => Boolean(part?.trim()))
  if (identityParts.length === 0) return false

  const evidenceParts = [context.display_name, latestUserMessage].filter((part) =>
    Boolean(part.trim()),
  )
  return identityParts.some((identity) =>
    evidenceParts.some((evidence) =>
      normalizedProductTextOverlaps(identity, evidence, execution.input.brand_text),
    ),
  )
}

function buildLookupInputFromNamedProductContext(
  context: AgentV2NamedProductContext,
  brandCatalog: BrandResolutionCatalogInput,
): ProductLookupExecutionInput | null {
  if (!isProductIntakeCategoryKey(context.category)) return null

  const category = context.category
  const categoryProductName = getFallbackProductNameForCategory(category)
  const displayName = context.display_name.trim()
  const displayWithoutCategory = stripTrailingCategoryTerm(displayName, category)
  if (!displayWithoutCategory) return null

  const knownBrandPrefix = findKnownBrandPrefix(displayWithoutCategory, brandCatalog)
  if (knownBrandPrefix) {
    const productNameRemainder = displayWithoutCategory.slice(knownBrandPrefix.raw.length).trim()
    return {
      category,
      brand_text: knownBrandPrefix.raw,
      product_name_text: [productNameRemainder, categoryProductName].filter(Boolean).join(" "),
    }
  }

  const tokens = Array.from(
    displayWithoutCategory.matchAll(/[\p{L}\p{M}\p{N}&'.-]+/gu),
    (match) => match[0],
  )
  if (tokens.length === 0) return null
  if (tokens.some((token) => token === "&")) {
    return {
      category,
      brand_text: displayWithoutCategory,
      product_name_text: categoryProductName,
    }
  }
  if (tokens.length >= 3) {
    return {
      category,
      brand_text: tokens.slice(0, 2).join(" "),
      product_name_text: [...tokens.slice(2), categoryProductName].join(" "),
    }
  }

  return {
    category,
    brand_text: displayWithoutCategory,
    product_name_text: categoryProductName,
  }
}

function stripTrailingCategoryTerm(displayName: string, category: ProductIntakeCategoryKey) {
  const terms = [
    PRODUCT_LOOKUP_CATEGORY_LABELS[category],
    ...getAgentV2NamedProductCategoryReferenceTerms(category),
  ]
    .map((term) => term.trim())
    .filter(Boolean)
    .sort((left, right) => right.length - left.length)

  const normalizedDisplay = normalizeProductLookupText(displayName)
  for (const term of terms) {
    const normalizedTerm = normalizeProductLookupText(term)
    if (normalizedDisplay === normalizedTerm || normalizedDisplay.endsWith(` ${normalizedTerm}`)) {
      const rawSuffixStart = findRawSuffixStartByNormalizedTerm(displayName, normalizedTerm)
      return displayName.slice(0, rawSuffixStart ?? displayName.length - term.length).trim()
    }
  }
  return displayName
}

function findRawSuffixStartByNormalizedTerm(text: string, normalizedTerm: string): number | null {
  for (let start = 0; start < text.length; start += 1) {
    if (start > 0 && !/\s/u.test(text[start - 1] ?? "")) continue
    if (normalizeProductLookupText(text.slice(start)) === normalizedTerm) return start
  }
  return null
}

function findRawPrefixByNormalizedTerm(text: string, normalizedTerm: string): string | null {
  for (let end = 1; end <= text.length; end += 1) {
    const normalizedSlice = normalizeProductLookupText(text.slice(0, end))
    if (normalizedSlice === normalizedTerm) {
      const remainder = text.slice(end)
      if (!remainder || /^\s/u.test(remainder)) return text.slice(0, end).trim()
    }
    if (normalizedSlice.length > normalizedTerm.length + 2) return null
  }
  return null
}

function findKnownBrandPrefix(
  text: string,
  brandCatalog: BrandResolutionCatalogInput,
): { raw: string; normalizedLength: number } | null {
  const candidates = [
    ...brandCatalog.brands.map(
      (brand) => brand.canonical_name ?? brand.canonicalName ?? brand.name,
    ),
    ...(brandCatalog.brandAliases ?? []).map((alias) => alias.alias),
  ]
    .filter((candidate): candidate is string => Boolean(candidate?.trim()))
    .sort((left, right) => right.length - left.length)

  const normalizedText = normalizeProductLookupText(text)
  for (const candidate of candidates) {
    const normalizedCandidate = normalizeProductLookupText(candidate)
    if (
      normalizedText === normalizedCandidate ||
      normalizedText.startsWith(`${normalizedCandidate} `)
    ) {
      const rawPrefix = findRawPrefixByNormalizedTerm(text, normalizedCandidate)
      return { raw: rawPrefix ?? candidate, normalizedLength: normalizedCandidate.length }
    }
  }
  return null
}

function getFallbackProductNameForCategory(category: ProductIntakeCategoryKey) {
  switch (category) {
    case "mask":
      return "Maske"
    case "oil":
      return "Öl"
    case "deep_cleansing_shampoo":
      return "Tiefenreinigungsshampoo"
    case "dry_shampoo":
      return "Trockenshampoo"
    default:
      return PRODUCT_LOOKUP_CATEGORY_LABELS[category]
  }
}

function buildDeterministicNamedProductFallbackAnswer(params: {
  context: AgentV2NamedProductContext
  lookupResult: ProductLookupResult
  usedGuidancePackageIds: readonly string[]
}): AgentV2TerminalAnswer {
  const category = params.context.category
  const displayName = params.context.display_name
  const baseAnswer = {
    interpreted_intent: "Deterministic named-product lookup fallback after model skipped lookup.",
    request_interpretation: {
      primary_intent: "product_recommendation",
      product_request_kind: "product_detail",
      routine_intent: "none",
      care_category: category,
      requested_product_count: null,
      count_policy: "none",
      evidence_quote: displayName,
      specific_product_candidate: true,
      confidence: 0,
    },
    confidence: 0,
    extracted_constraints: {
      hair_concerns: [],
      goals: [],
      product_categories: [category],
      budget_eur: null,
      avoid_ingredients: [],
      allergies: [],
      preferences: [],
      routine_layer: null,
      raw_constraints: [displayName],
    },
    missing_information: [],
    safety_flags: [],
    tool_grounding: {
      used_guidance_package_ids: [...params.usedGuidancePackageIds],
      used_product_tool: true,
      used_routine_tool: false,
      product_ids: [],
      routine_step_ids: [],
      hard_rule_ids: ["product.no_uncatalogued_products"],
    },
    routine_context: {
      active: false,
      routine_layer: null,
      step_id: null,
      category,
      return_path: [],
    },
    pending_followup_action: null,
    session_memory_writes: [],
  } satisfies Omit<AgentV2TerminalAnswer, "answer_mode" | "payload">

  if (params.lookupResult.status === "found_exact" && params.lookupResult.product) {
    const productName = displayName
    const userFacingAnswer = `Ich habe ${productName} in unserer Produktdatenbank gefunden und nutze ab jetzt genau diesen Produktdatensatz als Bezug. Damit ist klar, welches Produkt du meinst.`
    return {
      ...baseAnswer,
      answer_mode: "general_advice",
      payload: {
        user_facing_answer_de: userFacingAnswer,
        category_or_topic: category,
        key_points_de: [userFacingAnswer],
        next_step_offer_de: null,
      },
    }
  }

  if (params.lookupResult.status !== "not_found") {
    const userFacingAnswer = `Diesen konkreten ${displayName} kann ich aktuell nicht eindeutig als verifizierten Produktdatensatz bewerten. Bitte wähle die passende Variante aus oder füge dein Produkt hinzu, damit ich nichts Falsches bewerte.`
    return {
      ...baseAnswer,
      answer_mode: "clarification",
      payload: {
        user_facing_answer_de: userFacingAnswer,
        question_de: "Welche Variante meinst du?",
        missing_keys: ["product_variant"],
      },
    }
  }

  const userFacingAnswer = `Diesen konkreten ${displayName} kann ich aktuell nicht zuverlässig bewerten, weil er noch nicht als verifizierter Produktdatensatz in unserer Datenbank ist. Ich möchte dazu nichts erfinden. Wenn du magst, kannst du ihn hinzufügen, dann prüfen wir ihn sauber.`

  return {
    ...baseAnswer,
    answer_mode: "constraint_blocked",
    payload: {
      user_facing_answer_de: userFacingAnswer,
      blocking_constraints: ["product_not_verified"],
      safe_alternative_de: "Du kannst das Produkt hinzufügen, damit wir es konkret prüfen können.",
    },
  }
}

function answerSupportsProductIntakeOffer(answer: AgentV2TerminalAnswer): boolean {
  if (!answer.request_interpretation.specific_product_candidate) return false
  const { product_request_kind: productRequestKind, routine_intent: routineIntent } =
    answer.request_interpretation
  if (
    productRequestKind === "specific_products" ||
    productRequestKind === "compare_products" ||
    productRequestKind === "product_detail"
  ) {
    return true
  }
  return routineIntent === "modify" || routineIntent === "replace_product"
}

function productLookupExecutionMatchesAnswer(
  execution: ProductLookupExecution,
  answer: AgentV2TerminalAnswer,
  latestUserMessage: string,
): boolean {
  if (
    answerNeedsLookupCategoryTargetMatch(answer) &&
    !lookupCategoryMatchesAnswer(execution, answer)
  ) {
    return false
  }

  const identityParts = [
    execution.input.brand_text && execution.input.product_name_text
      ? `${execution.input.brand_text} ${execution.input.product_name_text}`
      : null,
    !execution.input.brand_text ? execution.input.product_name_text : null,
    execution.result.product?.name,
  ].filter((part): part is string => Boolean(part?.trim()))

  if (identityParts.length === 0) return true

  const evidenceParts = [answer.request_interpretation.evidence_quote, latestUserMessage].filter(
    (part): part is string => Boolean(part?.trim()),
  )
  return identityParts.some((identity) =>
    evidenceParts.some(
      (evidence) =>
        normalizedProductTextOverlaps(identity, evidence, execution.input.brand_text) &&
        lookupCategoryMatchesEvidence(execution.input.category, evidence, answer),
    ),
  )
}

function answerNeedsLookupCategoryTargetMatch(answer: AgentV2TerminalAnswer): boolean {
  return (
    answer.request_interpretation.product_request_kind === "specific_products" ||
    answer.request_interpretation.product_request_kind === "compare_products"
  )
}

function lookupCategoryMatchesAnswer(
  execution: ProductLookupExecution,
  answer: AgentV2TerminalAnswer,
): boolean {
  const lookupCategory = AgentV2CareCategorySchema.safeParse(execution.input.category)
  if (
    !lookupCategory.success ||
    lookupCategory.data === "none" ||
    lookupCategory.data === "unknown"
  ) {
    return false
  }
  const answerCategory = answer.request_interpretation.care_category
  if (answerCategory === "none" || answerCategory === "unknown") return false
  return lookupCategory.data === answerCategory
}

function lookupCategoryMatchesEvidence(
  category: string | null,
  evidence: string,
  answer?: AgentV2TerminalAnswer,
): boolean {
  if (!category) return true
  const parsedCategory = AgentV2CareCategorySchema.safeParse(category)
  if (!parsedCategory.success) return true
  if (
    answer &&
    parsedCategory.data !== "none" &&
    parsedCategory.data !== "unknown" &&
    answer.request_interpretation.care_category === parsedCategory.data
  ) {
    return true
  }
  const categoryTerms = getAgentV2NamedProductCategoryReferenceTerms(parsedCategory.data)
  if (categoryTerms.length === 0) return true
  const normalizedEvidence = normalizeProductLookupText(evidence)
  return categoryTerms.some((term) => normalizedEvidence.includes(normalizeProductLookupText(term)))
}

function normalizedProductTextOverlaps(
  a: string,
  b: string,
  requiredBrand?: string | null,
): boolean {
  const normalizedA = normalizeProductLookupText(a)
  const normalizedB = normalizeProductLookupText(b)
  if (!normalizedA || !normalizedB) return false
  const normalizedRequiredBrand = requiredBrand ? normalizeProductLookupText(requiredBrand) : ""
  if (normalizedRequiredBrand && !normalizedB.includes(normalizedRequiredBrand)) return false
  return (
    normalizedA === normalizedB ||
    normalizedA.includes(normalizedB) ||
    normalizedB.includes(normalizedA)
  )
}

function normalizeProductLookupText(value: string): string {
  return value
    .toLocaleLowerCase("de-DE")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[\p{P}\p{S}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
}

async function measureAsync<T>(work: () => Promise<T>): Promise<{ result: T; durationMs: number }> {
  const start = performance.now()
  const result = await work()
  return {
    result,
    durationMs: Math.round(performance.now() - start),
  }
}

function sumFiniteLatencies(values: readonly (number | null | undefined)[]): number | null {
  const latencies = values.filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value),
  )
  if (latencies.length === 0) return null
  return latencies.reduce((sum, value) => sum + value, 0)
}

function readAgentV2ModelStepLatencyMs(step: unknown): number | null {
  if (!step || typeof step !== "object" || Array.isArray(step)) return null
  const latencyMs = (step as { latency_ms?: unknown }).latency_ms
  return typeof latencyMs === "number" && Number.isFinite(latencyMs) ? latencyMs : null
}

function summarizeAgentV2ProductionTraceTiming(
  trace: Awaited<ReturnType<typeof runAgentV2ResponsesTurn>>["trace"],
): AgentV2ProductionTraceTiming {
  return {
    modelMs: sumFiniteLatencies(trace.model_steps.map(readAgentV2ModelStepLatencyMs)),
    toolMs: sumFiniteLatencies(trace.tool_calls.map((call) => call.latency_ms)),
    gateMs: trace.turn_gate?.latency_ms ?? null,
  }
}

function createTextStream(content: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()

  return new ReadableStream({
    start(controller) {
      if (content.length > 0) {
        controller.enqueue(encoder.encode(content))
      }
      controller.close()
    },
  })
}

function projectRecentMessages(messages: Message[]): RecentConversationMessage[] {
  return messages.flatMap((message): RecentConversationMessage[] => {
    if (message.role !== "user" && message.role !== "assistant") return []
    const content = message.content?.trim()
    return content ? [{ role: message.role, content }] : []
  })
}

function buildAgentV2PromptSnapshot(params: {
  message: string
  recentMessages: RecentConversationMessage[]
  model: string
  promptRef: LangfusePromptReference
}): ChatPromptSnapshot {
  const recentMessageRoles = params.recentMessages.slice(-4).map((message) => message.role)

  return {
    kind: "agent_v2_responses",
    model: params.model,
    temperature: 0,
    prompt_ref: params.promptRef,
    system_prompt: "agent_v2_responses_care_balance",
    messages: [
      {
        role: "user",
        content: JSON.stringify({
          latest_user_message_chars: params.message.length,
          recent_message_count: params.recentMessages.length,
          recent_message_roles: recentMessageRoles,
          engine: "agent_v2_care_balance",
        }),
      },
    ],
  }
}

function buildAgentV2CareBalanceContext(
  profile: HairProfile | null,
  routineItems: PersistenceRoutineItemRow[],
) {
  const runtime = buildRecommendationEngineRuntimeFromPersistence(profile, routineItems)
  const rowsWithActions = runtime.careBalance.rows.filter(
    (row) => row.recommendation !== "no_action",
  )
  return buildCareBalanceToolContext({
    runtime,
    rows: rowsWithActions.length > 0 ? rowsWithActions : runtime.careBalance.rows,
  })
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
            product_id: item.matchStatus === "matched" ? item.productId : null,
            product_submission_id:
              item.matchStatus === "pending_review" || item.matchStatus === "needs_more_info"
                ? item.productSubmissionId
                : null,
            match_status: item.matchStatus,
          },
        ]
      : [],
  )
}

function getMatchedRoutineProductIds(items: unknown[]): Set<string> {
  const productIds = new Set<string>()

  for (const item of items) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue
    const record = item as Record<string, unknown>
    const matchStatus = record.match_status ?? record.matchStatus
    const productId = record.product_id ?? record.productId
    if (matchStatus === "matched" && typeof productId === "string" && productId.length > 0) {
      productIds.add(productId)
    }
  }

  return productIds
}

function scopeLookupCatalogForUser(
  catalog: ProductLookupCatalog,
  ownedProductIds: ReadonlySet<string>,
): ProductLookupCatalog {
  const products = catalog.products.filter(
    (product) =>
      isProductEligibleForMode(product, "general_recommendation") ||
      (ownedProductIds.has(product.id) &&
        productIsActive(product) &&
        productLifecycleStatus(product) === "active"),
  )
  const allowedProductIds = new Set(products.map((product) => product.id))

  return {
    ...catalog,
    products,
    identifiers: catalog.identifiers?.filter((identifier) => {
      const productId = identifier.productId ?? identifier.product_id
      return Boolean(productId && allowedProductIds.has(productId))
    }),
  }
}

function buildConversationStateTransition(params: {
  previousState: AgentV2ConversationStateV2
  answer: AgentV2TerminalAnswer
  classification: ClassificationResult
  routineThreadContext: AgentV2RoutineThreadContext
  priorSelectedProductProjections: readonly AgentV2StoredProductProjection[]
  activeResolvedProductContext?: AgentV2ActiveResolvedProductContext | null
  acceptedSessionMemoryWrites: readonly AgentV2SessionMemoryWrite[]
}): AgentV2ConversationStateTransition {
  const previousState = params.previousState
  const nextState: AgentV2ConversationStateV2 = {
    ...previousState,
    version: 2,
    engine: AGENT_V2_PRODUCTION_ENGINE,
    agent_v2: {
      routine_thread_context: params.routineThreadContext,
      prior_selected_product_projections: [...params.priorSelectedProductProjections],
      active_resolved_product_context:
        params.activeResolvedProductContext === undefined
          ? previousState.agent_v2.active_resolved_product_context
          : params.activeResolvedProductContext,
      session_memory: mergeAgentV2SessionMemory({
        previous: previousState.agent_v2.session_memory,
        accepted: params.acceptedSessionMemoryWrites,
      }),
    },
  }

  return {
    previous_state: previousState,
    next_state: nextState,
    reason: "agent_v2_care_balance_answer",
    changed_fields: Object.keys(nextState).filter(
      (key) =>
        previousState[key as keyof AgentV2ConversationStateV2] !==
        nextState[key as keyof AgentV2ConversationStateV2],
    ),
    classifier_override: null,
    updated_by_engine: AGENT_V2_PRODUCTION_ENGINE,
  }
}

function buildActiveResolvedProductContext(
  context: AgentV2TrustedSelectedProductContext | null | undefined,
): AgentV2ActiveResolvedProductContext | null {
  if (!context) return null
  return {
    source: "product_lookup_selection",
    product_id: context.selected_product.id,
    name: context.selected_product.name,
    category: context.selected_product.category,
    original_user_message: context.original_user_message,
  }
}

function buildActiveResolvedProductContextFromLookup(params: {
  fallback: { execution: ProductLookupExecution } | null
  originalUserMessage: string
  displayName: string | null
}): AgentV2ActiveResolvedProductContext | null {
  const execution = params.fallback?.execution
  if (!execution) return null
  const result = execution.result
  if (result?.status !== "found_exact" || !result.product) return null

  return {
    source: "product_lookup_selection",
    product_id: result.product.id,
    name: params.displayName?.trim() || result.product.name,
    category: result.product.category_key ?? execution.input.category ?? null,
    original_user_message: params.originalUserMessage,
  }
}

function buildNextActiveResolvedProductContext(params: {
  previous: AgentV2ActiveResolvedProductContext | null
  trustedSelectedProductContext?: AgentV2TrustedSelectedProductContext | null
  deterministicResolvedProductContext: AgentV2ActiveResolvedProductContext | null
  latestMessageNamesActionableProduct: boolean
}): AgentV2ActiveResolvedProductContext | null {
  const selectedContext = buildActiveResolvedProductContext(params.trustedSelectedProductContext)
  if (selectedContext) return selectedContext
  if (params.deterministicResolvedProductContext) return params.deterministicResolvedProductContext
  if (params.latestMessageNamesActionableProduct) return null
  return params.previous
}

function buildStoredProjectionForTrustedSelectedProduct(
  context: AgentV2TrustedSelectedProductContext | null | undefined,
): AgentV2StoredProductProjection | null {
  if (!context) return null
  return {
    tool_name: "select_products",
    category: context.selected_product.category as AgentV2StoredProductProjection["category"],
    valid_product_ids: [context.selected_product.id],
    products: [
      {
        product_id: context.selected_product.id,
        rank: 1,
        name: context.selected_product.name,
        brand: null,
        price_eur: null,
        currency: null,
        fit_reason: "Vom Nutzer aus der Produktklärung ausgewählt.",
        caveat: null,
        supported_claims: [],
        unsupported_requested_signals: [],
      },
    ],
  }
}

export function classifyAgentV2ProductionSafetyMode(message: string): AgentV2SafetyMode {
  const normalized = message.toLocaleLowerCase("de-DE")

  if (
    /\b(blutet|bluten|wunde|wunden|offene kopfhaut|brennt stark|verbrennung|eiter|infektion)\b/.test(
      normalized,
    ) ||
    /haare?\s+fall(?:en|t).*(?:b(?:ue|ü)scheln|b(?:ue|ü)schelweise)/.test(normalized) ||
    /\b(pl[oö]tzlich(?:er|e|es)?\s+haarausfall|verschreibungspflichtig|rezeptpflichtig)\b/.test(
      normalized,
    ) ||
    /\b(verliere|verlierst|verliert|haarausfall)\b.{0,120}\b(extrem|sehr|viele?|wochen|nicht besser)\b/.test(
      normalized,
    ) ||
    /\b(extrem|sehr|viele?|wochen)\b.{0,120}\b(haare?|haarausfall)\b/.test(normalized)
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

function buildRoutineThreadContextFromConversationState(
  state: AgentV2ConversationStateV2,
): AgentV2RoutineThreadContext | null {
  return state.agent_v2.routine_thread_context
}

export async function runAgentV2ProductionPipeline(
  params: PipelineParams,
  deps: ProductionAgentV2PipelineDeps = {},
): Promise<PipelineResult> {
  const { message, userId, conversationId, requestId } = params
  if (!conversationId) {
    throw new Error("AgentV2 production chat requires a conversation id before orchestration.")
  }

  const startedAt = new Date().toISOString()
  const ownsConversation = await (
    deps.verifyConversationOwnership ?? verifyAgentV2ProductionConversationOwnership
  )({ conversationId, userId })

  if (!ownsConversation) {
    throw new Error("AgentV2 production conversation does not belong to user.")
  }

  const [
    { result: conversationHistory, durationMs: historyLoadMs },
    { result: userContext, durationMs: contextLoadMs },
    { result: memoryContext, durationMs: memoryLoadMs },
    { result: rawConversationState },
  ] = await Promise.all([
    measureAsync(() =>
      (deps.loadConversationHistory ?? loadAgentV2ProductionConversationHistory)(
        conversationId,
        userId,
      ),
    ),
    measureAsync(() => (deps.getUserContext ?? getUserContext)(userId)),
    measureAsync(() => (deps.loadUserMemoryContext ?? loadUserMemoryContext)(userId)),
    measureAsync(() =>
      deps.loadConversationState
        ? deps.loadConversationState({ conversationId, userId })
        : loadAgentV2ConversationStateForUser(createAdminClient(), { conversationId, userId }),
    ),
  ])

  const conversationState = normalizeAgentV2ConversationState(rawConversationState)
  const recentMessages = projectRecentMessages(conversationHistory)
  const careBalanceContext = buildAgentV2CareBalanceContext(
    userContext.profile,
    userContext.routine_inventory,
  )
  const selectedProductResults: SelectProductsToolResult[] = []
  const selectedProductProjections: ReturnType<typeof projectSelectProductsForAgentV2>[] = []
  const productLookupExecutions: ProductLookupExecution[] = []
  let latestRoutineProjection: AgentV2RoutineProjection | null = null
  const buildRoutine = (deps.createBuildOrFixRoutineTool ?? createBuildOrFixRoutineTool)()
  const routineThreadContext = buildRoutineThreadContextFromConversationState(conversationState)
  const priorSelectedProductProjections =
    conversationState.agent_v2.prior_selected_product_projections
  const activeResolvedProductContext =
    buildActiveResolvedProductContext(params.trustedSelectedProductContext) ??
    conversationState.agent_v2.active_resolved_product_context
  const sessionMemory = conversationState.agent_v2.session_memory
  const runTurn = deps.runAgentV2ResponsesTurn ?? runAgentV2ResponsesTurn
  const productIntakeEnabled = params.productIntakeEnabled === true
  let productLookupCatalogPromise: Promise<{
    catalog: ProductLookupCatalog
    brandCatalog: BrandResolutionCatalogInput
  }> | null = null
  const loadProductLookupCatalogs = () => {
    productLookupCatalogPromise ??= (async () => {
      const repository =
        deps.createProductIntakeRepository?.() ?? createSupabaseProductIntakeRepository()
      const ownedProductIds = getMatchedRoutineProductIds(userContext.routine_inventory)
      const [catalog, brandCatalog] = await Promise.all([
        repository.loadCatalog({ eligibilityMode: "intake_dedupe" }),
        repository.loadBrandResolutionCatalog(),
      ])
      return { catalog: scopeLookupCatalogForUser(catalog, ownedProductIds), brandCatalog }
    })()
    return productLookupCatalogPromise
  }
  const safetyMode = classifyAgentV2ProductionSafetyMode(message)
  const managedPrompt = await (deps.getManagedTextPromptTemplate ?? getManagedTextPromptTemplate)(
    LANGFUSE_PROMPTS.agentV2ResponsesCareBalance,
  )
  const useInjectedRuntimeWithoutClient =
    Boolean(deps.runAgentV2ResponsesTurn) && !deps.getOpenAI && !deps.getObservedOpenAI
  const client =
    deps.client ??
    (useInjectedRuntimeWithoutClient
      ? ({
          responses: {
            create: async () => {
              throw new Error("Injected AgentV2 runtime did not use its model client.")
            },
          },
        } satisfies AgentV2ResponsesClient)
      : isAgentV2LangfuseObservationEnabled()
        ? ((deps.getObservedOpenAI ?? getObservedOpenAI)({
            generationName: "agent-v2-responses-step",
            langfusePrompt: buildLangfusePromptConfig(managedPrompt.ref),
            generationMetadata: buildAgentV2GenerationMetadata({
              conversationId,
              requestId,
              safetyMode,
              engine: "agent_v2",
              endpoint: "responses",
              migrationMode: "agent_v2_care_balance",
            }),
          }) as unknown as AgentV2ResponsesClient)
        : ((deps.getOpenAI ?? getOpenAI)() as unknown as AgentV2ResponsesClient))
  const agentStart = performance.now()

  const result = await runTurn({
    client,
    message,
    recentMessages,
    userContext: {
      hairProfile: userContext.profile,
      routineInventory: userContext.routine_inventory,
      derivedSignals: userContext.derived_signals,
      relevantMemory: userContext.relevant_memory,
      missingProfile: userContext.missing_profile,
      sessionMemory,
      careBalanceContext,
    },
    currentRoutineLayer: routineThreadContext?.active ? routineThreadContext.current_layer : null,
    routineThreadContext,
    priorSelectedProductProjections,
    activeResolvedProductContext,
    safetyMode,
    productIntakeEnabled,
    trustedSelectedProductContext: params.trustedSelectedProductContext ?? null,
    langfuseMode: "enabled",
    observeToolCall: deps.observeAgentV2ToolCall ?? observeAgentV2ToolCall,
    tools: {
      load_advisor_guidance: async (input) => loadAgentV2AdvisorGuidance(input),
      lookup_product_candidate: async (input) => {
        if (!productIntakeEnabled) {
          throw new Error("product intake lookup tool is disabled")
        }
        const { catalog, brandCatalog } = await loadProductLookupCatalogs()
        const lookupInput = {
          category: typeof input.category === "string" ? input.category : null,
          brand_text: typeof input.brand_text === "string" ? input.brand_text : null,
          product_name_text:
            typeof input.product_name_text === "string" ? input.product_name_text : null,
        }
        const result = lookupProductCandidate({
          input: lookupInput,
          catalog,
          brandCatalog,
          offerId: `product-intake-${requestId}`,
          eligibilityMode: "intake_dedupe",
        })
        productLookupExecutions.push({ input: lookupInput, result })
        return result
      },
      select_products: async (input, executionContext?: AgentV2RuntimeToolExecutionContext) => {
        const effectiveCareContext =
          executionContext?.effectiveCareContext ?? readAgentV2EffectiveCareContext(input)
        const effectiveHairProfile = buildAgentV2EffectiveHairProfile(
          userContext.profile,
          effectiveCareContext,
        )
        const effectiveRoutineItems = buildAgentV2EffectiveRoutineItems(
          userContext.routine_inventory,
          effectiveCareContext,
        )
        const productToolMessage = buildAgentV2ProductToolMessage({
          latestMessage: message,
          recentMessages,
        })
        let rawResult: SelectProductsToolResult | null = null
        const selectProductsForCall = (deps.createSelectProductsTool ?? createSelectProductsTool)({
          onResult: (result) => {
            rawResult = result
          },
        })
        const projection = await selectProductsForCall({
          category: input.category as Parameters<typeof selectProductsForCall>[0]["category"],
          message: productToolMessage,
          hairProfile: effectiveHairProfile,
          memoryContext,
          routineItems: effectiveRoutineItems,
          effectiveCareContext,
        })
        const resultForProjection =
          rawResult ??
          ({
            projection,
            products: [],
            effectiveHairProfile,
            runtime: {} as SelectProductsToolResult["runtime"],
          } satisfies SelectProductsToolResult)
        selectedProductResults.push(resultForProjection)
        const agentProjection = projectSelectProductsForAgentV2(resultForProjection, {
          includeCareBalanceContext: true,
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
          userContext.profile,
          effectiveCareContext,
        )
        const effectiveRoutineItems = buildAgentV2EffectiveRoutineItems(
          userContext.routine_inventory,
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
        const agentProjection = projectRoutineForAgentV2(projection, {
          requestedLayer: input.requested_layer as AgentV2RoutineLayer,
          includeCareBalanceContext: true,
        })
        latestRoutineProjection = agentProjection
        return agentProjection
      },
    },
  })
  const agentMs = Math.round(performance.now() - agentStart)
  const agentTiming = summarizeAgentV2ProductionTraceTiming(result.trace)

  const latestNamedProductContext = buildAgentV2NamedProductContext({
    latestMessage: params.message,
    recentMessages,
  })
  const latestMessageNamesNewProduct = Boolean(latestNamedProductContext)
  const suppressStaleLookupActions =
    Boolean(activeResolvedProductContext) && !latestMessageNamesNewProduct
  const deterministicLookupFallback =
    productIntakeEnabled && !suppressStaleLookupActions
      ? await buildDeterministicNamedProductLookupFallback({
          namedProductContext: latestNamedProductContext,
          existingExecutions: productLookupExecutions,
          trace: result.trace,
          loadProductLookupCatalogs,
          requestId,
        })
      : null
  if (deterministicLookupFallback) {
    productLookupExecutions.push(deterministicLookupFallback.execution)
  }
  const recoveredNotFoundLookupFailureFallback =
    productIntakeEnabled && !suppressStaleLookupActions
      ? buildRecoveredNotFoundProductLookupFailureFallback({
          namedProductContext: latestNamedProductContext,
          executions: productLookupExecutions,
          trace: result.trace,
          latestUserMessage: params.message,
        })
      : null
  const deterministicResolvedProductContext = buildActiveResolvedProductContextFromLookup({
    fallback: deterministicLookupFallback,
    originalUserMessage: params.message,
    displayName: latestNamedProductContext?.display_name ?? null,
  })
  const latestMessageNamesActionableProduct = Boolean(
    latestNamedProductContext && latestNamedProductContext.named_product_intent !== "background",
  )

  const answer =
    deterministicLookupFallback?.answer ??
    recoveredNotFoundLookupFailureFallback ??
    result.final_answer
  const visibleFailure =
    result.trace.failure_stage !== null &&
    !deterministicLookupFallback &&
    !recoveredNotFoundLookupFailureFallback
  const productIntakeOffer =
    productIntakeEnabled && !suppressStaleLookupActions
      ? selectProductIntakeOfferForAnswer(answer, productLookupExecutions, params.message, {
          allowFallbackIntake: visibleFailure,
        })
      : null
  const productLookupExecutionsForClarification =
    productIntakeEnabled && !suppressStaleLookupActions
      ? await recoverProductLookupClarificationExecutionsFromTrace({
          trace: result.trace,
          existingExecutions: productLookupExecutions,
          loadProductLookupCatalogs,
          requestId,
        })
      : productLookupExecutions
  const productLookupClarification = productIntakeEnabled
    ? suppressStaleLookupActions
      ? null
      : selectProductLookupClarificationForAnswer(
          answer,
          productLookupExecutionsForClarification,
          params.message,
          {
            allowFallbackClarification: visibleFailure,
          },
        )
    : null
  const intent = deriveIntent(answer)
  const productCategory = visibleFailure ? null : deriveProductCategory(answer)
  const routerDecision = buildAgentV2RouterDecision({ answer, visibleFailure })
  const classification = buildAgentV2Classification({
    answer,
    intent,
    productCategory,
    routerDecision,
  })
  const matchedProducts = visibleFailure
    ? []
    : deriveMatchedProducts({ answer, selectedProductResults })
  const { categoryDecision, engineTrace } = deriveEngineArtifacts(
    selectedProductResults.at(-1) ?? null,
  )
  const exposedCategoryDecision = visibleFailure ? undefined : categoryDecision
  const exposedEngineTrace = visibleFailure ? undefined : engineTrace
  const attachmentMode = matchedProducts.length > 0 ? "cards" : "text_only"
  const prompt = buildAgentV2PromptSnapshot({
    message,
    recentMessages,
    model: result.trace.model,
    promptRef: managedPrompt.ref,
  })
  const visibleRoutineSteps = buildRoutineThreadVisibleSteps(
    latestRoutineProjection as AgentV2RoutineProjection | null,
  )
  const nextRoutineThreadContext = updateAgentV2ProductionRoutineThreadContext({
    previous: routineThreadContext,
    answer,
    message,
    routineProjection: latestRoutineProjection,
    visibleFailure,
  })
  const nextPriorSelectedProductProjections = visibleFailure
    ? priorSelectedProductProjections
    : mergePriorSelectedProductProjections({
        previous: priorSelectedProductProjections,
        next: [
          ...collectTrustedSurfacedProductProjections({
            projections: selectedProductProjections,
            answer,
          }),
          ...(buildStoredProjectionForTrustedSelectedProduct(params.trustedSelectedProductContext)
            ? [
                buildStoredProjectionForTrustedSelectedProduct(
                  params.trustedSelectedProductContext,
                ) as AgentV2StoredProductProjection,
              ]
            : []),
        ],
      })
  const persistedVisibleRoutineSteps =
    nextRoutineThreadContext.visible_steps.length > 0
      ? nextRoutineThreadContext.visible_steps
      : visibleRoutineSteps
  const conversationStateTransition = buildConversationStateTransition({
    previousState: conversationState,
    answer,
    classification,
    routineThreadContext: {
      ...nextRoutineThreadContext,
      visible_steps: persistedVisibleRoutineSteps,
    },
    priorSelectedProductProjections: nextPriorSelectedProductProjections,
    activeResolvedProductContext: visibleFailure
      ? activeResolvedProductContext
      : buildNextActiveResolvedProductContext({
          previous: activeResolvedProductContext,
          trustedSelectedProductContext: params.trustedSelectedProductContext,
          deterministicResolvedProductContext,
          latestMessageNamesActionableProduct,
        }),
    acceptedSessionMemoryWrites: result.accepted_session_memory_writes,
  })
  const debugTrace = buildPipelineTraceDraft({
    request_id: requestId,
    started_at: startedAt,
    user_message: `[agent_v2_user_message chars=${message.length}]`,
    conversation_id: conversationId,
    intent,
    product_category: productCategory,
    conversation_history_count: conversationHistory.length,
    classification,
    router_decision: routerDecision,
    conversation_state: conversationStateTransition,
    clarification_questions:
      routerDecision.response_mode === "clarify_only" && routerDecision.clarification_reason
        ? [routerDecision.clarification_reason]
        : [],
    hair_profile_snapshot: userContext.profile,
    memory_context: memoryContext.promptContext,
    retrieval_debug: {
      source_types: [],
      metadata_filter: null,
      subqueries: [],
      candidate_count_before_rerank: 0,
      reranked_count: 0,
      fallback_used: false,
    },
    retrieval_count: 0,
    retrieved_chunks: [],
    should_plan_routine: answer.answer_mode === "routine",
    category_decision: exposedCategoryDecision,
    engine_trace: exposedEngineTrace,
    matched_products: matchedProducts,
    classification_prompt_ref: managedPrompt.ref,
    prompt,
    response_composition: {
      path: "agent_v2_responses",
      migration_mode: "agent_v2_care_balance",
      fallback_reason: null,
      rendering_path: null,
      plan_type: answer.answer_mode,
      attachment_mode: attachmentMode,
    },
    engine_variant: "agent_v2_care_balance",
    agent_v2_trace: {
      ...result.trace,
      routine_thread_context: {
        ...nextRoutineThreadContext,
        visible_steps: persistedVisibleRoutineSteps,
      },
    },
    latencies_ms: {
      classification_ms: 0,
      hair_profile_load_ms: contextLoadMs,
      routine_inventory_load_ms: 0,
      memory_load_ms: memoryLoadMs,
      routine_planning_ms: 0,
      history_load_ms: historyLoadMs,
      router_ms: 0,
      conversation_create_ms: 0,
      retrieval_ms: 0,
      product_matching_ms: 0,
      prompt_build_ms: 0,
      stream_setup_ms: 0,
      agent_runtime_ms: agentMs,
      agent_turn_gate_ms: agentTiming.gateMs,
      agent_model_ms: agentTiming.modelMs,
      agent_tool_ms: agentTiming.toolMs,
    },
  })

  return {
    stream: createTextStream(String(answer.payload.user_facing_answer_de ?? "")),
    conversationId,
    intent,
    matchedProducts,
    sources: [],
    conversationStateTransition,
    retrievalSummary: {
      final_context_count: 0,
    },
    routerDecision,
    categoryDecision: exposedCategoryDecision,
    engineTrace: exposedEngineTrace,
    debugTrace,
    visibleFailure,
    answerMode: answer.answer_mode,
    productIntakeOffer,
    productLookupClarification,
  }
}
