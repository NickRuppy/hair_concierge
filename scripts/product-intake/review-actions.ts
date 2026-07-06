import { mkdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"

import { sendProductIntakeReviewNotification } from "@/lib/product-intake/notifications"
import { captureProductIntakeException } from "@/lib/observability/product-intake"
import { normalizeIdentityText } from "@/lib/product-identity/normalize"
import type {
  ProductIntakeFinalReviewedPayload,
  ProductIntakeResearchedPayload,
  ProductIntakeTargetSpecOperation,
} from "@/lib/product-intake/category-validators"
import { dryRunProductIntakeReadyForReview } from "@/lib/product-intake/review-workflow"
import type { ProductSubmission } from "@/lib/types"
import type { SupabaseClient } from "@supabase/supabase-js"

export type ReviewActionSubmission = ProductSubmission

const OPEN_RESEARCH_STATUSES = [
  "pending_review",
  "researching",
  "ready_for_review",
  "needs_more_info",
] as const

export async function loadSubmission(
  supabase: SupabaseClient,
  submissionId: string,
): Promise<ReviewActionSubmission> {
  const { data, error } = await supabase
    .from("product_submissions")
    .select("*")
    .eq("id", submissionId)
    .single()

  if (error || !data) {
    throw new Error(`load product submission ${submissionId}: ${error?.message ?? "not found"}`)
  }

  return data as ReviewActionSubmission
}

export async function loadSubmissionsByIds(
  supabase: SupabaseClient,
  submissionIds: readonly string[],
): Promise<ReviewActionSubmission[]> {
  if (submissionIds.length === 0) return []

  const { data, error } = await supabase
    .from("product_submissions")
    .select("*")
    .in("id", [...submissionIds])

  if (error) {
    throw new Error(`load product submissions: ${error.message}`)
  }

  const rows = (data ?? []) as ReviewActionSubmission[]
  const rowsById = new Map(rows.map((row) => [row.id, row]))
  return submissionIds.map((id) => {
    const row = rowsById.get(id)
    if (!row) throw new Error(`submission not found: ${id}`)
    return row
  })
}

export function validateSubmissionReady(submission: ReviewActionSubmission) {
  return dryRunProductIntakeReadyForReview({
    id: submission.id,
    category: submission.category,
    researched_payload: submission.researched_payload,
  })
}

export function buildResearchPayloadDraft(submission: ReviewActionSubmission) {
  const researchedPayload = submission.researched_payload ?? {}

  return {
    draft: {
      product: {
        canonical_brand: submission.brand_text,
        clean_name: submission.product_name_text,
        category_key: submission.category,
      },
      raw_submission: {
        id: submission.id,
        source: submission.source,
        intake_method: submission.intake_method,
        frequency_range: submission.frequency_range,
        front_image_path: submission.front_image_path,
        barcode_image_path: submission.barcode_image_path,
      },
      sources: [],
      field_rationales: {},
    },
    final: (researchedPayload as { final?: unknown }).final,
  }
}

export function dryRunResearchedPayload(params: {
  submission: ReviewActionSubmission
  researchedPayload: ProductIntakeResearchedPayload | Record<string, unknown>
  markReady: boolean
}) {
  const dryRun = dryRunProductIntakeReadyForReview({
    id: params.submission.id,
    category: params.submission.category,
    researched_payload: params.researchedPayload,
  })
  const nextStatus = params.markReady && dryRun.ok ? "ready_for_review" : "researching"

  return {
    submission_id: params.submission.id,
    status: params.submission.status,
    next_status: nextStatus,
    dry_run: dryRun,
    researched_payload: params.researchedPayload,
  }
}

export async function saveResearchedPayload(params: {
  supabase: SupabaseClient
  submission: ReviewActionSubmission
  researchedPayload: ProductIntakeResearchedPayload | Record<string, unknown>
  markReady: boolean
  now?: () => Date
}) {
  if (
    !OPEN_RESEARCH_STATUSES.includes(
      params.submission.status as (typeof OPEN_RESEARCH_STATUSES)[number],
    )
  ) {
    throw new Error(
      `Refusing to update closed submission ${params.submission.id} with status ${params.submission.status}`,
    )
  }
  if (!params.submission.updated_at) {
    throw new Error(
      `Refusing to update submission ${params.submission.id} without updated_at guard`,
    )
  }

  const dryRun = dryRunResearchedPayload({
    submission: params.submission,
    researchedPayload: params.researchedPayload,
    markReady: params.markReady,
  })
  const updatedAt = (params.now?.() ?? new Date()).toISOString()

  const { data, error } = await params.supabase
    .from("product_submissions")
    .update({
      researched_payload: params.researchedPayload,
      status: dryRun.next_status,
      updated_at: updatedAt,
    })
    .eq("id", params.submission.id)
    .eq("status", params.submission.status)
    .eq("updated_at", params.submission.updated_at)
    .in("status", [...OPEN_RESEARCH_STATUSES])
    .select("id")
    .single()

  if (error || !data) {
    throw new Error(`save researched payload: ${error?.message ?? "no row updated"}`)
  }

  return dryRun
}

type ApprovalRpcResult = {
  submission: ReviewActionSubmission
  product_id: string
  brand_id: string
  product_line_id: string | null
}

export function buildCanonicalBrandLineAliasApprovalError(params: {
  canonicalBrand: string | null | undefined
  canonicalBrandExists: boolean
  lineAlias: { alias: string } | null
}): Error | null {
  const canonicalBrand = params.canonicalBrand?.trim() ?? ""
  if (!canonicalBrand || params.canonicalBrandExists || !params.lineAlias) return null

  return new Error(
    `Reviewed product canonical_brand "${canonicalBrand}" is a brand-line alias (${params.lineAlias.alias}), not a canonical brand. Set canonical_brand to the owning brand and put the line/range in product_line before approval.`,
  )
}

async function assertReviewedCanonicalBrandCanBeApproved(params: {
  supabase: SupabaseClient
  finalPayload: ProductIntakeFinalReviewedPayload
}) {
  const canonicalBrand = params.finalPayload.product.canonical_brand
  const normalizedBrand = normalizeIdentityText(canonicalBrand)
  if (!normalizedBrand) return

  const [{ data: existingBrand, error: brandError }, { data: lineAlias, error: aliasError }] =
    await Promise.all([
      params.supabase
        .from("brands")
        .select("id")
        .eq("normalized_name", normalizedBrand)
        .maybeSingle(),
      params.supabase
        .from("brand_aliases")
        .select("alias")
        .eq("normalized_alias", normalizedBrand)
        .not("product_line_id", "is", null)
        .maybeSingle(),
    ])

  if (brandError) {
    throw new Error(`validate reviewed canonical brand: ${brandError.message}`)
  }
  if (aliasError) {
    throw new Error(`validate reviewed brand alias: ${aliasError.message}`)
  }

  const approvalError = buildCanonicalBrandLineAliasApprovalError({
    canonicalBrand,
    canonicalBrandExists: Boolean(existingBrand),
    lineAlias: lineAlias as { alias: string } | null,
  })
  if (approvalError) throw approvalError
}

export async function approveReviewedSubmission(params: {
  supabase: SupabaseClient
  submission: ReviewActionSubmission
  finalPayload: ProductIntakeFinalReviewedPayload
  specOperations: ProductIntakeTargetSpecOperation[]
  reviewedBy: string
  reviewedAt: string
  reviewNotes: string | null
}): Promise<ApprovalRpcResult> {
  await assertReviewedCanonicalBrandCanBeApproved({
    supabase: params.supabase,
    finalPayload: params.finalPayload,
  })

  const { data, error } = await params.supabase.rpc("product_intake_approve_reviewed_product", {
    p_submission_id: params.submission.id,
    p_final_payload: params.finalPayload,
    p_spec_operations: params.specOperations,
    p_reviewed_by: params.reviewedBy,
    p_reviewed_at: params.reviewedAt,
    p_review_notes: params.reviewNotes,
  })

  if (error) {
    captureProductIntakeException(error, {
      stage: "approve_reviewed_product",
      submissionId: params.submission.id,
      userId: params.submission.user_id,
      source: params.submission.source,
      sourceConversationId: params.submission.source_conversation_id,
      category: params.submission.category,
      intakeMethod: params.submission.intake_method,
      status: params.submission.status,
      reason: error.code ?? "rpc_error",
      committed: false,
    })
    throw new Error(`approve product submission ${params.submission.id}: ${error.message}`)
  }

  return data as ApprovalRpcResult
}

export async function linkExistingProduct(params: {
  supabase: SupabaseClient
  submissionId: string
  productId: string
  reviewedBy: string
  reviewedAt: string
  reviewNotes: string | null
}) {
  const { data, error } = await params.supabase.rpc("product_intake_link_existing_product", {
    p_submission_id: params.submissionId,
    p_product_id: params.productId,
    p_reviewed_by: params.reviewedBy,
    p_reviewed_at: params.reviewedAt,
    p_review_notes: params.reviewNotes,
  })

  if (error) {
    captureProductIntakeException(error, {
      stage: "link_existing_product",
      submissionId: params.submissionId,
      productId: params.productId,
      reason: error.code ?? "rpc_error",
      committed: false,
    })
    throw new Error(`link product submission ${params.submissionId}: ${error.message}`)
  }

  return data as { submission: ReviewActionSubmission }
}

export async function requestMoreInfo(params: {
  supabase: SupabaseClient
  submissionId: string
  reviewedBy: string
  reviewedAt: string
  reason: string
  nextStep: string
  missingFields: unknown[]
  reviewNotes: string | null
}) {
  const { data, error } = await params.supabase.rpc("product_intake_request_more_info", {
    p_submission_id: params.submissionId,
    p_reviewed_by: params.reviewedBy,
    p_reason: params.reason,
    p_next_step: params.nextStep,
    p_missing_fields: params.missingFields,
    p_reviewed_at: params.reviewedAt,
    p_review_notes: params.reviewNotes,
  })

  if (error) {
    captureProductIntakeException(error, {
      stage: "request_more_info",
      submissionId: params.submissionId,
      reason: error.code ?? "rpc_error",
      committed: false,
    })
    throw new Error(`request info for product submission ${params.submissionId}: ${error.message}`)
  }

  return data as { submission: ReviewActionSubmission }
}

export async function rejectSubmission(params: {
  supabase: SupabaseClient
  submissionId: string
  reviewedBy: string
  reviewedAt: string
  reason: string
  nextStep: string | null
  reviewNotes: string | null
}) {
  const { data, error } = await params.supabase.rpc("product_intake_reject_submission", {
    p_submission_id: params.submissionId,
    p_reviewed_by: params.reviewedBy,
    p_reason: params.reason,
    p_next_step: params.nextStep,
    p_reviewed_at: params.reviewedAt,
    p_review_notes: params.reviewNotes,
  })

  if (error) {
    captureProductIntakeException(error, {
      stage: "reject_submission",
      submissionId: params.submissionId,
      reason: error.code ?? "rpc_error",
      committed: false,
    })
    throw new Error(`reject product submission ${params.submissionId}: ${error.message}`)
  }

  return data as { submission: ReviewActionSubmission; deleted_usage_id: string | null }
}

type AdditionRecord = {
  submission_id: string
  product_id: string
  category_key: string
  brand_id: string
  product_line_id: string | null
  approved_at: string
  reviewed_by: string
  final_payload: ProductIntakeFinalReviewedPayload
  spec_operations: ProductIntakeTargetSpecOperation[]
}

export function productAdditionRecordPathForDate(dateIso: string): string {
  const day = dateIso.slice(0, 10)
  return join(process.cwd(), "data", "product-additions", `${day}-user-submitted.json`)
}

export async function appendProductAdditionRecord(record: AdditionRecord): Promise<string> {
  const path = productAdditionRecordPathForDate(record.approved_at)
  await mkdir(join(process.cwd(), "data", "product-additions"), { recursive: true })

  let existing: unknown[] = []
  try {
    existing = JSON.parse(await readFile(path, "utf8")) as unknown[]
    if (!Array.isArray(existing)) existing = []
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error
  }

  const next = [
    ...existing.filter(
      (entry) =>
        !entry ||
        typeof entry !== "object" ||
        (entry as { submission_id?: unknown }).submission_id !== record.submission_id,
    ),
    record,
  ]
  await writeFile(path, `${JSON.stringify(next, null, 2)}\n`)
  return path
}

export async function notifyReviewResult(supabase: SupabaseClient, submission: ProductSubmission) {
  try {
    return await sendProductIntakeReviewNotification(supabase, submission)
  } catch (error) {
    captureProductIntakeException(error, {
      stage: "send_review_notification",
      submissionId: submission.id,
      approvedProductId: submission.approved_product_id,
      userId: submission.user_id,
      source: submission.source,
      sourceConversationId: submission.source_conversation_id,
      category: submission.category,
      intakeMethod: submission.intake_method,
      status: submission.status,
      notificationResult: "failed",
    })
    throw error
  }
}
