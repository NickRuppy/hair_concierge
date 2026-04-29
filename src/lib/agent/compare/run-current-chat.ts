import type { PipelineResult } from "@/lib/rag/contracts"
import { runPipeline } from "@/lib/rag/pipeline"
import type { HairProfile, Product, UserMemoryEntry } from "@/lib/types"
import { getUserContext, type UserContextProjection } from "@/lib/agent/tools/get-user-context"
import { createTestSession, upsertHairProfile } from "../../../../scripts/eval-chat/client"
import type {
  HairProfileOverrides,
  RoutineInventorySeed,
} from "../../../../scripts/eval-chat/types"
import type { AgentCompareScenario, AgentCompareUserRequest, CompareRunResult } from "./types"

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

function normalizeMatchedProducts(products: Product[]): CompareRunResult["matched_products"] {
  return products.map((product) => ({
    name: product.name,
    category: typeof product.category === "string" ? product.category : null,
  }))
}

async function readTextStream(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let content = ""

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    content += decoder.decode(value, { stream: true })
  }

  return content
}

export function buildCurrentDebugLines(
  result: PipelineResult,
  options: { ephemeral?: boolean } = {},
): string[] {
  const lines = [
    `sources: ${result.sources.length}`,
    `products: ${result.matchedProducts.length}`,
    `retrieval: ${result.routerDecision.retrieval_mode}`,
    `response: ${result.routerDecision.response_mode}`,
    `clarify: ${result.routerDecision.response_mode === "clarify_only" ? "yes" : "no"}`,
  ]

  if (options.ephemeral) {
    lines.push("ephemeral: yes")
  }

  return lines
}

function cloneHairProfileForCompare(profile: HairProfile | null): HairProfileOverrides {
  if (!profile) return {}

  return {
    hair_texture: profile.hair_texture,
    thickness: profile.thickness,
    density: profile.density,
    concerns: profile.concerns,
    protein_moisture_balance: profile.protein_moisture_balance,
    cuticle_condition: profile.cuticle_condition,
    scalp_type: profile.scalp_type,
    scalp_condition: profile.scalp_condition,
    chemical_treatment: profile.chemical_treatment,
    wash_frequency: profile.wash_frequency,
    heat_styling: profile.heat_styling,
    styling_tools: profile.styling_tools,
    drying_method: profile.drying_method,
    towel_technique: profile.towel_technique,
    brush_type: profile.brush_type,
    night_protection: profile.night_protection,
    goals: profile.goals,
    uses_heat_protection: profile.uses_heat_protection,
  }
}

function cloneRoutineInventoryForCompare(
  routineInventory: UserContextProjection["routine_inventory"],
): RoutineInventorySeed[] {
  return routineInventory.map((item) => ({
    category: item.category,
    product_name: item.product_name,
    frequency_range: item.frequency_range,
  }))
}

async function cloneMemoryEntriesForCompare(params: {
  admin: Awaited<ReturnType<typeof createTestSession>>["admin"]
  targetUserId: string
  entries: UserMemoryEntry[]
}): Promise<void> {
  if (params.entries.length === 0) return

  const { error } = await params.admin.from("user_memory_entries").insert(
    params.entries.map((entry) => ({
      user_id: params.targetUserId,
      kind: entry.kind,
      content: entry.content,
      normalized_key: entry.normalized_key,
      source: entry.source,
      source_conversation_id: null,
      evidence: entry.evidence,
      confidence: entry.confidence,
      metadata: entry.metadata,
      status: entry.status,
      superseded_by: null,
      archived_at: entry.archived_at,
    })),
  )

  if (error) {
    throw new Error(`Failed to clone compare memory entries: ${error.message}`)
  }
}

async function seedCurrentCompareClone(params: {
  session: Awaited<ReturnType<typeof createTestSession>>
  sourceContext: UserContextProjection
}): Promise<void> {
  await upsertHairProfile(
    params.session.admin,
    params.session.userId,
    cloneHairProfileForCompare(params.sourceContext.profile),
    cloneRoutineInventoryForCompare(params.sourceContext.routine_inventory),
  )
  await cloneMemoryEntriesForCompare({
    admin: params.session.admin,
    targetUserId: params.session.userId,
    entries: params.sourceContext.relevant_memory,
  })
}

export async function runCurrentChatComparison(params: {
  scenario: AgentCompareScenario
  prompt: string
  baseUrl?: string | null
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

    const startedAt = performance.now()
    const result = await runPipeline({
      message: params.prompt,
      userId: session.userId,
      requestId: crypto.randomUUID(),
    })
    const answer = await readTextStream(result.stream)

    return {
      system: "current",
      answer,
      latency_ms: Math.round(performance.now() - startedAt),
      debug_lines: buildCurrentDebugLines(result),
      matched_products: normalizeMatchedProducts(result.matchedProducts),
      product_trace: null,
      route_trace: null,
      error: null,
    }
  } finally {
    await session.cleanup()
  }
}

export async function runCurrentChatComparisonForUser(
  params: AgentCompareUserRequest,
): Promise<CompareRunResult> {
  const { supabaseUrl, serviceRoleKey, anonKey } = getRequiredCompareEnv()
  const sourceContext = await getUserContext(params.userId)
  const session = await createTestSession(supabaseUrl, serviceRoleKey, anonKey)

  try {
    await seedCurrentCompareClone({ session, sourceContext })

    const startedAt = performance.now()
    const result = await runPipeline({
      message: params.prompt,
      userId: session.userId,
      requestId: crypto.randomUUID(),
    })
    const answer = await readTextStream(result.stream)

    return {
      system: "current",
      answer,
      latency_ms: Math.round(performance.now() - startedAt),
      debug_lines: buildCurrentDebugLines(result, { ephemeral: true }),
      matched_products: normalizeMatchedProducts(result.matchedProducts),
      product_trace: null,
      route_trace: null,
      error: null,
    }
  } finally {
    await session.cleanup()
  }
}
