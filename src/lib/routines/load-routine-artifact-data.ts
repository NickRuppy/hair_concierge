import { buildRecommendationEngineRuntimeFromPersistence } from "@/lib/recommendation-engine/runtime"
import type { PersistenceRoutineItemRow } from "@/lib/recommendation-engine/adapters/from-persistence"
import { createAdminClient as defaultCreateAdminClient } from "@/lib/supabase/admin"
import { createClient as defaultCreateClient } from "@/lib/supabase/server"
import type { HairProfile } from "@/lib/types"
import { loadActiveDismissedSuggestionCategories } from "@/lib/routines/dismissals"
import type {
  RoutineArtifactData,
  RoutineArtifactPendingSubmission,
  RoutineArtifactUsageRow,
} from "@/lib/routines/types"

export const ROUTINE_PRODUCT_USAGE_SELECT = `
  id,
  user_id,
  category,
  brand_text,
  product_name,
  frequency_range,
  product_id,
  product_submission_id,
  match_status,
  intake_method,
  source,
  front_image_path,
  created_at,
  updated_at,
  product:products(
    id,
    name,
    brand,
    description,
    short_description,
    category,
    product_line_id,
    affiliate_link,
    purchase_link_status,
    purchase_link_checked_at,
    price_checked_at,
    image_url,
    price_eur,
    currency,
    tags,
    suitable_thicknesses,
    suitable_concerns,
    is_active,
    lifecycle_status,
    is_chaarlie_recommended,
    sort_order,
    created_at,
    updated_at,
    brand_identity:brands(id, canonical_name),
    product_line:product_lines(id, canonical_name)
  )
`

export const ROUTINE_PRODUCT_SUBMISSION_SELECT = `
  id,
  status,
  user_facing_resolution_reason,
  user_facing_next_step,
  user_facing_missing_fields,
  front_image_path,
  created_at
`

type SupabaseErrorLike = {
  message?: string
}

type QueryResult<T> = {
  data: T | null
  error: SupabaseErrorLike | null
}

type AuthUserResult = {
  data: {
    user: { id: string } | null
  }
  error?: SupabaseErrorLike | null
}

type RoutineQueryClient = {
  auth?: {
    getUser(): Promise<AuthUserResult>
  }
  from(table: string): RoutineTableQuery
}

type RoutineTableQuery = {
  select(columns: string): RoutineTableQuery
  eq(column: string, value: unknown): RoutineTableQuery
  gt(column: string, value: unknown): Promise<QueryResult<unknown[]>>
  in(column: string, value: unknown): Promise<QueryResult<unknown[]>>
  order(column: string, options?: unknown): Promise<QueryResult<unknown[]>>
  maybeSingle(): Promise<QueryResult<unknown>>
}

export type LoadRoutineArtifactDataDeps = {
  createClient: () => Promise<RoutineQueryClient>
  createAdminClient: () => RoutineQueryClient
  buildRuntime: typeof buildRecommendationEngineRuntimeFromPersistence
  now: () => Date
}

export type LoadRoutineArtifactDataParams = {
  userId?: string | null
  deps?: Partial<LoadRoutineArtifactDataDeps>
}

function queryError(table: string, error: SupabaseErrorLike | null): Error {
  return new Error(`routine artifact ${table} query failed: ${error?.message ?? "unknown error"}`)
}

function asRoutineClient(client: unknown): RoutineQueryClient {
  return client as RoutineQueryClient
}

function table(client: RoutineQueryClient, name: string): RoutineTableQuery {
  return client.from(name)
}

async function resolveUserId(
  client: RoutineQueryClient,
  explicitUserId: string | null | undefined,
): Promise<string> {
  if (explicitUserId) return explicitUserId

  const result = await client.auth?.getUser()
  const userId = result?.data.user?.id ?? null
  if (!userId) {
    throw new Error("routine artifact data requires an authenticated user")
  }
  return userId
}

function coerceUsageRows(rows: unknown): RoutineArtifactUsageRow[] {
  return Array.isArray(rows) ? (rows as RoutineArtifactUsageRow[]) : []
}

function coercePendingSubmissions(rows: unknown): RoutineArtifactPendingSubmission[] {
  return Array.isArray(rows) ? (rows as RoutineArtifactPendingSubmission[]) : []
}

function routineItemsForRuntime(rows: RoutineArtifactUsageRow[]): PersistenceRoutineItemRow[] {
  return rows.map((row) => ({
    category: row.category,
    product_name: row.product_name,
    frequency_range: row.frequency_range,
    product_id: row.product_id,
    product_submission_id: row.product_submission_id,
    match_status: row.match_status,
  }))
}

function pendingSubmissionIds(rows: RoutineArtifactUsageRow[]): string[] {
  return [
    ...new Set(
      rows
        .filter(
          (row) => row.match_status === "pending_review" || row.match_status === "needs_more_info",
        )
        .map((row) => row.product_submission_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ]
}

async function loadPendingSubmissions(
  ids: string[],
  deps: Pick<LoadRoutineArtifactDataDeps, "createAdminClient">,
): Promise<Map<string, RoutineArtifactPendingSubmission>> {
  if (ids.length === 0) return new Map()

  const admin = deps.createAdminClient()
  const result = (await table(admin, "product_submissions")
    .select(ROUTINE_PRODUCT_SUBMISSION_SELECT)
    .in("id", ids)) as QueryResult<RoutineArtifactPendingSubmission[]>

  if (result.error) {
    throw queryError("product_submissions", result.error)
  }

  return new Map(coercePendingSubmissions(result.data).map((row) => [row.id, row]))
}

export async function loadRoutineArtifactData(
  params: LoadRoutineArtifactDataParams = {},
): Promise<RoutineArtifactData> {
  const deps: LoadRoutineArtifactDataDeps = {
    createClient: async () => asRoutineClient(await defaultCreateClient()),
    createAdminClient: () => asRoutineClient(defaultCreateAdminClient()),
    buildRuntime: buildRecommendationEngineRuntimeFromPersistence,
    now: () => new Date(),
    ...params.deps,
  }
  const client = await deps.createClient()
  const userId = await resolveUserId(client, params.userId)

  const [profileResult, usageResult, activeDismissedCategories] = await Promise.all([
    table(client, "hair_profiles").select("*").eq("user_id", userId).maybeSingle() as Promise<
      QueryResult<HairProfile>
    >,
    table(client, "user_product_usage")
      .select(ROUTINE_PRODUCT_USAGE_SELECT)
      .eq("user_id", userId)
      .order("created_at", { ascending: true }) as Promise<QueryResult<RoutineArtifactUsageRow[]>>,
    loadActiveDismissedSuggestionCategories({
      client: client as never,
      userId,
      now: deps.now(),
    }),
  ])

  if (profileResult.error) {
    throw queryError("hair_profiles", profileResult.error)
  }
  if (usageResult.error) {
    throw queryError("user_product_usage", usageResult.error)
  }

  const hairProfile = profileResult.data ?? null
  const usageRows = coerceUsageRows(usageResult.data)
  const runtimeRows = routineItemsForRuntime(usageRows)
  const runtime = deps.buildRuntime(hairProfile, runtimeRows)
  const pendingSubmissionsById = await loadPendingSubmissions(pendingSubmissionIds(usageRows), deps)

  return {
    userId,
    hairProfile,
    usageRows,
    pendingSubmissionsById,
    activeDismissedCategories,
    runtime,
  }
}
