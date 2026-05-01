import fs from "fs"
import path from "path"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { LangfuseClient } from "@langfuse/client"
import type { TraceFailureBucket } from "../../src/lib/types"

export interface ProductionTraceCandidate {
  langfuseTraceId: string
  createdAt: string
  feedbackScore: number | null
  conversationId: string | null
  userMessage: string
  assistantContent: string
  intent: string | null
  productCategory: string | null
  retrievalMode: string | null
  responseMode: string | null
  needsClarification: boolean | null
  promptVersion: number | null
  promptLabel: string | null
  promptIsFallback: boolean | null
  traceVersion: number | null
  responseCompositionPath: string | null
  promptKind: string | null
  engineDamageLevel: string | null
  engineRepairPriority: string | null
  engineActions: Record<string, unknown> | null
  selectedProducts: Array<Record<string, unknown>>
  failureBucket: TraceFailureBucket | null
}

type ProductionTraceRow = {
  assistant_message_id?: unknown
  langfuse_trace_id?: unknown
  created_at?: unknown
  trace?: unknown
}

const TRACE_FAILURE_BUCKETS = [
  "product_fit_mismatch",
  "routine_logic_mismatch",
  "missing_clarification",
  "unnecessary_clarification",
  "retrieval_grounding_gap",
  "response_wording_gap",
  "overclaim_or_missing_caveat",
  "memory_or_profile_miss",
  "technical_or_trace_gap",
  "positive_reference",
] satisfies TraceFailureBucket[]

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function booleanOrNull(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null
}

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : []
}

function getRecord(parent: Record<string, unknown>, key: string): Record<string, unknown> | null {
  const value = parent[key]
  return isRecord(value) ? value : null
}

function getStringPath(parent: Record<string, unknown>, keys: string[]): string | null {
  let current: unknown = parent

  for (const key of keys) {
    if (!isRecord(current)) return null
    current = current[key]
  }

  return stringOrNull(current)
}

function toFailureBucket(value: unknown): TraceFailureBucket | null {
  return typeof value === "string" && TRACE_FAILURE_BUCKETS.includes(value as TraceFailureBucket)
    ? (value as TraceFailureBucket)
    : null
}

function extractFailureBucket(trace: Record<string, unknown>): TraceFailureBucket | null {
  const direct = toFailureBucket(trace.failure_bucket ?? trace.failureBucket)
  if (direct) return direct

  const userFeedback = getRecord(trace, "user_feedback") ?? getRecord(trace, "userFeedback")
  const userFeedbackBucket = userFeedback
    ? toFailureBucket(userFeedback.failure_bucket ?? userFeedback.failureBucket)
    : null
  if (userFeedbackBucket) return userFeedbackBucket

  const review = getRecord(trace, "review")
  return review ? toFailureBucket(review.failure_bucket ?? review.failureBucket) : null
}

function extractEngineActions(trace: Record<string, unknown>): Record<string, unknown> | null {
  const decisionContext =
    getRecord(trace, "decision_context") ?? getRecord(trace, "decisionContext")
  const engineTrace = decisionContext
    ? (getRecord(decisionContext, "engine_trace") ?? getRecord(decisionContext, "engineTrace"))
    : null
  const categories = engineTrace ? getRecord(engineTrace, "categories") : null
  if (!categories) return null

  const actions: Record<string, unknown> = {}
  for (const [category, decision] of Object.entries(categories)) {
    if (!isRecord(decision)) continue

    actions[category] = {
      relevant: booleanOrNull(decision.relevant),
      action: stringOrNull(decision.action),
      reason_codes: stringList(
        decision.reason_codes ??
          decision.reasonCodes ??
          decision.plan_reason_codes ??
          decision.planReasonCodes,
      ),
      has_target_profile: Boolean(decision.target_profile ?? decision.targetProfile),
    }
  }

  return Object.keys(actions).length > 0 ? actions : null
}

function compactRecommendationMeta(value: unknown): Record<string, unknown> | null {
  if (!isRecord(value)) return null

  return {
    category: stringOrNull(value.category),
    score: numberOrNull(value.score),
    fit_status: stringOrNull(value.fit_status ?? value.fitStatus),
    matched_concern_code: stringOrNull(value.matched_concern_code ?? value.matchedConcernCode),
    matched_scalp_route: stringOrNull(value.matched_scalp_route ?? value.matchedScalpRoute),
    cleansing_intensity: stringOrNull(value.cleansing_intensity ?? value.cleansingIntensity),
    matched_bucket: stringOrNull(value.matched_bucket ?? value.matchedBucket),
    matched_weight: stringOrNull(value.matched_weight ?? value.matchedWeight),
    matched_repair_level: stringOrNull(value.matched_repair_level ?? value.matchedRepairLevel),
    matched_balance_need: stringOrNull(value.matched_balance_need ?? value.matchedBalanceNeed),
    need_bucket: stringOrNull(value.need_bucket ?? value.needBucket),
    styling_context: stringOrNull(value.styling_context ?? value.stylingContext),
    conditioner_relationship: stringOrNull(
      value.conditioner_relationship ?? value.conditionerRelationship,
    ),
    product_format: stringOrNull(value.product_format ?? value.productFormat),
    heat_protection_need: stringOrNull(value.heat_protection_need ?? value.heatProtectionNeed),
    styling_prep_need: stringOrNull(value.styling_prep_need ?? value.stylingPrepNeed),
    provides_heat_protection: booleanOrNull(
      value.provides_heat_protection ?? value.providesHeatProtection,
    ),
    product_weight: stringOrNull(value.product_weight ?? value.productWeight),
    product_repair_level: stringOrNull(value.product_repair_level ?? value.productRepairLevel),
    product_balance_direction: stringOrNull(
      value.product_balance_direction ?? value.productBalanceDirection,
    ),
    matched_subtype: stringOrNull(value.matched_subtype ?? value.matchedSubtype),
    use_mode: stringOrNull(value.use_mode ?? value.useMode),
    purpose_fit: stringOrNull(value.purpose_fit ?? value.purposeFit),
    adjunct_scalp_support: booleanOrNull(value.adjunct_scalp_support ?? value.adjunctScalpSupport),
    scalp_caution: booleanOrNull(value.scalp_caution ?? value.scalpCaution),
    density_weight_caution: booleanOrNull(
      value.density_weight_caution ?? value.densityWeightCaution,
    ),
    overload_caution: booleanOrNull(value.overload_caution ?? value.overloadCaution),
    mask_type: stringOrNull(value.mask_type ?? value.maskType),
    need_strength: numberOrNull(value.need_strength ?? value.needStrength),
    role: stringOrNull(value.role),
    product_concentration: stringOrNull(value.product_concentration ?? value.productConcentration),
    matched_intensity: stringOrNull(value.matched_intensity ?? value.matchedIntensity),
    application_mode: stringOrNull(value.application_mode ?? value.applicationMode),
    scalp_type_focus: stringOrNull(value.scalp_type_focus ?? value.scalpTypeFocus),
    reset_need_level: stringOrNull(value.reset_need_level ?? value.resetNeedLevel),
    peeling_type: stringOrNull(value.peeling_type ?? value.peelingType),
  }
}

function compactSelectedProducts(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) return []

  return value.filter(isRecord).map((product) => ({
    id: stringOrNull(product.id),
    name: stringOrNull(product.name),
    brand: stringOrNull(product.brand),
    category: stringOrNull(product.category),
    score: numberOrNull(product.score),
    recommendation_meta: compactRecommendationMeta(product.recommendation_meta),
  }))
}

export function mapProductionTraceCandidateFromRow(
  row: ProductionTraceRow,
  feedbackScore: number | null,
): ProductionTraceCandidate | null {
  const trace = row.trace
  if (!isRecord(trace) || typeof row.langfuse_trace_id !== "string") return null

  const routerDecision = getRecord(trace, "router_decision") ?? getRecord(trace, "routerDecision")
  const promptRefs = getRecord(trace, "prompt_refs") ?? getRecord(trace, "promptRefs")
  const synthesisPromptRef = promptRefs ? getRecord(promptRefs, "synthesis") : null
  const decisionContext =
    getRecord(trace, "decision_context") ?? getRecord(trace, "decisionContext")
  const engineTrace = decisionContext
    ? (getRecord(decisionContext, "engine_trace") ?? getRecord(decisionContext, "engineTrace"))
    : null
  const damage = engineTrace ? getRecord(engineTrace, "damage") : null
  const matchedProducts = decisionContext?.matched_products ?? decisionContext?.matchedProducts
  const responseMode =
    stringOrNull(routerDecision?.response_mode) ??
    stringOrNull(routerDecision?.responseMode) ??
    (typeof routerDecision?.needs_clarification === "boolean"
      ? routerDecision.needs_clarification
        ? "clarify_only"
        : "answer_direct"
      : typeof routerDecision?.needsClarification === "boolean"
        ? routerDecision.needsClarification
          ? "clarify_only"
          : "answer_direct"
        : null)
  const needsClarification =
    booleanOrNull(routerDecision?.needs_clarification) ??
    booleanOrNull(routerDecision?.needsClarification) ??
    (responseMode === "clarify_only" ? true : responseMode ? false : null)

  return {
    langfuseTraceId: row.langfuse_trace_id,
    createdAt: typeof row.created_at === "string" ? row.created_at : "",
    feedbackScore,
    conversationId: stringOrNull(trace.conversation_id ?? trace.conversationId),
    userMessage: stringOrNull(trace.user_message ?? trace.userMessage) ?? "",
    assistantContent: getStringPath(trace, ["response", "assistant_content"]) ?? "",
    intent: stringOrNull(trace.intent),
    productCategory: stringOrNull(trace.product_category ?? trace.productCategory),
    retrievalMode:
      stringOrNull(routerDecision?.retrieval_mode) ?? stringOrNull(routerDecision?.retrievalMode),
    responseMode,
    needsClarification,
    promptVersion: numberOrNull(synthesisPromptRef?.version),
    promptLabel: stringOrNull(synthesisPromptRef?.label),
    promptIsFallback: booleanOrNull(
      synthesisPromptRef?.is_fallback ?? synthesisPromptRef?.isFallback,
    ),
    traceVersion: numberOrNull(trace.trace_version ?? trace.traceVersion),
    responseCompositionPath:
      getStringPath(trace, ["response_composition", "path"]) ??
      getStringPath(trace, ["responseComposition", "path"]),
    promptKind: getStringPath(trace, ["prompt", "kind"]),
    engineDamageLevel:
      stringOrNull(damage?.overall_level) ??
      stringOrNull(damage?.overallLevel) ??
      stringOrNull(damage?.level),
    engineRepairPriority:
      stringOrNull(damage?.repair_priority) ?? stringOrNull(damage?.repairPriority),
    engineActions: extractEngineActions(trace),
    selectedProducts: compactSelectedProducts(matchedProducts),
    failureBucket: extractFailureBucket(trace),
  }
}

export function loadLocalEnv(): void {
  const envPath = path.join(process.cwd(), ".env.local")
  if (!fs.existsSync(envPath)) return

  for (const line of fs.readFileSync(envPath, "utf-8").replace(/\r/g, "").split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/)
    if (match && !process.env[match[1].trim()]) {
      process.env[match[1].trim()] = match[2].trim().replace(/^"(.*)"$/, "$1")
    }
  }
}

export function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing ${name}. Add it to your environment or .env.local.`)
  }
  return value
}

export function getLangfuseClientOrThrow(): LangfuseClient {
  return new LangfuseClient({
    publicKey: requireEnv("LANGFUSE_PUBLIC_KEY"),
    secretKey: requireEnv("LANGFUSE_SECRET_KEY"),
    baseUrl: requireEnv("LANGFUSE_BASE_URL"),
  })
}

export function getSupabaseAdminClientOrThrow(): SupabaseClient {
  return createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: { autoRefreshToken: false, persistSession: false },
    },
  )
}

export function getPromptLabel(): string {
  return (
    process.env.LANGFUSE_PROMPT_LABEL ??
    (process.env.NODE_ENV === "production" ? "production" : "staging")
  )
}

export function parseArgs(argv: string[]): Map<string, string | true> {
  const parsed = new Map<string, string | true>()

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    if (!token.startsWith("--")) continue

    const next = argv[index + 1]
    if (next && !next.startsWith("--")) {
      parsed.set(token, next)
      index += 1
    } else {
      parsed.set(token, true)
    }
  }

  return parsed
}

export function readStringArg(
  args: Map<string, string | true>,
  name: string,
  fallback?: string,
): string | undefined {
  const value = args.get(name)
  if (typeof value === "string") return value
  return fallback
}

export function readNumberArg(
  args: Map<string, string | true>,
  name: string,
  fallback: number,
): number {
  const value = args.get(name)
  if (typeof value !== "string") return fallback

  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

export function hasFlag(args: Map<string, string | true>, name: string): boolean {
  return args.has(name)
}

export async function fetchProductionTraceCandidates(
  supabase: SupabaseClient,
  sinceDays: number,
  fetchLimit: number,
): Promise<ProductionTraceCandidate[]> {
  const sinceIso = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000).toISOString()

  const { data: traceRows, error: traceError } = await supabase
    .from("conversation_turn_traces")
    .select("assistant_message_id, langfuse_trace_id, created_at, trace")
    .gte("created_at", sinceIso)
    .not("langfuse_trace_id", "is", null)
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(fetchLimit)

  if (traceError) {
    throw new Error(`Failed to load production traces: ${traceError.message}`)
  }

  const assistantMessageIds = (traceRows ?? [])
    .map((row) => row.assistant_message_id)
    .filter((value): value is string => typeof value === "string")

  const feedbackByMessageId = new Map<string, number | null>()
  if (assistantMessageIds.length > 0) {
    const { data: messageRows, error: messageError } = await supabase
      .from("messages")
      .select("id, user_feedback_score")
      .in("id", assistantMessageIds)

    if (messageError) {
      throw new Error(`Failed to load assistant feedback rows: ${messageError.message}`)
    }

    for (const row of messageRows ?? []) {
      feedbackByMessageId.set(row.id, row.user_feedback_score ?? null)
    }
  }

  return (traceRows ?? [])
    .map((row) => {
      const feedbackScore =
        typeof row.assistant_message_id === "string"
          ? (feedbackByMessageId.get(row.assistant_message_id) ?? null)
          : null

      return mapProductionTraceCandidateFromRow(row, feedbackScore)
    })
    .filter((value): value is ProductionTraceCandidate => Boolean(value))
}
