import {
  createSupabaseClientFromEnv,
  flag,
  flagBool,
  parseArgs,
  printJson,
  requireFlag,
} from "./cli"
import type { SupabaseClient } from "@supabase/supabase-js"
import {
  captureProductIntakeException,
  flushProductIntakeSentry,
} from "@/lib/observability/product-intake"

type PromotionAction = "promote" | "already_recommended"

type ProductRow = {
  id: string
  name?: string | null
  category?: string | null
  category_key?: string | null
  origin?: string | null
  is_active: boolean | null
  lifecycle_status?: string | null
  is_chaarlie_recommended: boolean | null
  updated_at?: string | null
}

type ApprovedSubmissionRow = {
  id: string
  approved_product_id: string | null
}

export class PromotionGateError extends Error {
  override name = "PromotionGateError"
}

type PromotionPayload = {
  product_id: string
  product_name: string | null
  current_recommendation_state: boolean
  origin: string | null
  category: string | null
  category_key: string | null
  lifecycle_status: string | null
  is_active: boolean | null
  dry_run: boolean
  proposed_action: PromotionAction
  reviewer: string | null
  notes: string | null
}

type PromotionResult = PromotionPayload & {
  approved_submission_id?: string
  missing_spec_tables?: RequiredSpecTable[]
  next_recommendation_state?: boolean
  promoted_at?: string
  required_spec_tables?: RequiredSpecTable[]
}

const PRODUCT_SELECT =
  "id,name,category,category_key,origin,is_active,lifecycle_status,is_chaarlie_recommended,updated_at"

export const REQUIRED_PROMOTION_SPEC_TABLES_BY_CATEGORY = {
  shampoo: ["product_shampoo_specs"],
  conditioner: ["product_conditioner_specs", "product_conditioner_rerank_specs"],
  mask: ["product_mask_specs"],
  leave_in: [
    "product_leave_in_specs",
    "product_leave_in_fit_specs",
    "product_leave_in_eligibility",
  ],
  oil: ["product_oil_eligibility"],
  dry_shampoo: ["product_dry_shampoo_specs"],
  deep_cleansing_shampoo: ["product_deep_cleansing_shampoo_specs"],
  bondbuilder: ["product_bondbuilder_specs"],
} as const

type PromotionCategory = keyof typeof REQUIRED_PROMOTION_SPEC_TABLES_BY_CATEGORY
type RequiredSpecTable =
  (typeof REQUIRED_PROMOTION_SPEC_TABLES_BY_CATEGORY)[PromotionCategory][number]

function promotionCategory(product: ProductRow): PromotionCategory | null {
  const rawCategory = product.category_key ?? product.category
  if (!rawCategory) return null
  return rawCategory in REQUIRED_PROMOTION_SPEC_TABLES_BY_CATEGORY
    ? (rawCategory as PromotionCategory)
    : null
}

export function buildPromotionPayload(params: {
  product: ProductRow
  dryRun: boolean
  reviewer: string | null
  notes: string | null
}): PromotionPayload {
  return {
    product_id: params.product.id,
    product_name: params.product.name ?? null,
    current_recommendation_state: params.product.is_chaarlie_recommended === true,
    origin: params.product.origin ?? null,
    category: params.product.category ?? params.product.category_key ?? null,
    category_key: params.product.category_key ?? null,
    lifecycle_status: params.product.lifecycle_status ?? null,
    is_active: params.product.is_active,
    dry_run: params.dryRun,
    proposed_action:
      params.product.is_chaarlie_recommended === true ? "already_recommended" : "promote",
    reviewer: params.reviewer,
    notes: params.notes,
  }
}

export function validatePromotableProduct(product: ProductRow): RequiredSpecTable[] {
  if (product.origin !== "user_submitted") {
    throw new PromotionGateError(
      `Product ${product.id} origin is ${product.origin ?? "missing"}; promotion requires user_submitted`,
    )
  }

  if (product.is_active !== true) {
    throw new PromotionGateError(
      `Product ${product.id} is not active; promotion requires is_active=true`,
    )
  }

  if (product.lifecycle_status !== "active") {
    throw new PromotionGateError(
      `Product ${product.id} lifecycle_status is ${
        product.lifecycle_status ?? "missing"
      }; promotion requires active`,
    )
  }

  const category = promotionCategory(product)
  if (!category) {
    throw new PromotionGateError(
      `Product ${product.id} has unsupported or missing category for promotion: ${
        product.category_key ?? product.category ?? "missing"
      }`,
    )
  }

  return [...REQUIRED_PROMOTION_SPEC_TABLES_BY_CATEGORY[category]]
}

async function loadProduct(supabase: SupabaseClient, productId: string): Promise<ProductRow> {
  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("id", productId)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to load product ${productId}: ${error.message ?? "unknown error"}`)
  }
  if (!data) {
    throw new PromotionGateError(`Product ${productId} not found`)
  }

  return data as ProductRow
}

async function missingSpecTables(
  supabase: SupabaseClient,
  productId: string,
  tables: RequiredSpecTable[],
): Promise<RequiredSpecTable[]> {
  const results = await Promise.all(
    tables.map(async (table) => {
      const { data, error } = await supabase
        .from(table)
        .select("product_id")
        .eq("product_id", productId)
        .limit(1)

      if (error) {
        throw new Error(
          `Failed to check ${table} for product ${productId}: ${error.message ?? "unknown error"}`,
        )
      }

      return Array.isArray(data) && data.length > 0 ? null : table
    }),
  )

  return results.filter((table): table is RequiredSpecTable => table !== null)
}

async function loadApprovedSubmissionForProduct(
  supabase: SupabaseClient,
  productId: string,
): Promise<ApprovedSubmissionRow> {
  const { data, error } = await supabase
    .from("product_submissions")
    .select("id,approved_product_id")
    .eq("approved_product_id", productId)
    .eq("status", "approved")
    .limit(1)

  if (error) {
    throw new Error(
      `Failed to load approved intake submission for product ${productId}: ${
        error.message ?? "unknown error"
      }`,
    )
  }

  const row = Array.isArray(data) ? data[0] : null
  if (!row) {
    throw new PromotionGateError(
      `Product ${productId} cannot be promoted without an approved intake submission`,
    )
  }

  return row as ApprovedSubmissionRow
}

export async function promoteProductById(params: {
  supabase?: SupabaseClient
  productId: string
  confirm: boolean
  reviewer: string | null
  notes: string | null
}): Promise<PromotionResult> {
  const supabase = params.supabase ?? createSupabaseClientFromEnv()
  const product = await loadProduct(supabase, params.productId)
  const dryRun = !params.confirm
  const payload = buildPromotionPayload({
    product,
    dryRun,
    reviewer: params.reviewer,
    notes: params.notes,
  })

  if (product.is_chaarlie_recommended === true) {
    printJson(payload)
    return payload
  }

  const requiredSpecTables = validatePromotableProduct(product)
  if (!product.updated_at) {
    throw new PromotionGateError(
      `Product ${product.id} cannot be promoted without updated_at concurrency guard`,
    )
  }

  const approvedSubmission = await loadApprovedSubmissionForProduct(supabase, product.id)
  const missingTables = await missingSpecTables(supabase, product.id, requiredSpecTables)
  if (missingTables.length > 0) {
    printJson({
      ...payload,
      approved_submission_id: approvedSubmission.id,
      required_spec_tables: requiredSpecTables,
      missing_spec_tables: missingTables,
    })
    throw new PromotionGateError(
      `Product ${product.id} is missing required category specs: ${missingTables.join(", ")}`,
    )
  }

  if (dryRun) {
    const result = {
      ...payload,
      approved_submission_id: approvedSubmission.id,
      required_spec_tables: requiredSpecTables,
    }
    printJson(result)

    return result
  }

  const updatedAt = new Date().toISOString()
  const { data, error } = await supabase
    .from("products")
    .update({
      is_chaarlie_recommended: true,
      updated_at: updatedAt,
    })
    .eq("id", product.id)
    .eq("is_active", true)
    .eq("lifecycle_status", "active")
    .eq("is_chaarlie_recommended", false)
    .eq("updated_at", product.updated_at)
    .select("id, updated_at")
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to promote product ${product.id}: ${error.message ?? "unknown error"}`)
  }
  if (!data) {
    throw new PromotionGateError(
      `Product ${product.id} changed after validation; re-run promotion review`,
    )
  }

  const result = {
    ...payload,
    dry_run: false,
    promoted_at: (data as { updated_at?: string | null }).updated_at ?? updatedAt,
    next_recommendation_state: true,
    approved_submission_id: approvedSubmission.id,
    required_spec_tables: requiredSpecTables,
  }
  printJson(result)

  return result
}

export function shouldCapturePromotionError(error: unknown): boolean {
  return !(error instanceof PromotionGateError)
}

async function main(args = parseArgs()) {
  await promoteProductById({
    productId: requireFlag(args, "product-id"),
    confirm: flagBool(args, "confirm"),
    reviewer: flag(args, "reviewer"),
    notes: flag(args, "notes"),
  })
}

if (process.argv[1]?.endsWith("promote.ts")) {
  const args = parseArgs()
  main(args).catch(async (error) => {
    if (shouldCapturePromotionError(error)) {
      captureProductIntakeException(error, {
        stage: "promote_product",
        productId: flag(args, "product-id"),
        reason: "failed",
        committed: false,
      })
      await flushProductIntakeSentry()
    }
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
