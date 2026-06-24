import { mkdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"

import { sendProductIntakeReviewNotification } from "@/lib/product-intake/notifications"
import { captureProductIntakeException } from "@/lib/observability/product-intake"
import type {
  ProductIntakeFinalReviewedPayload,
  ProductIntakeTargetSpecOperation,
} from "@/lib/product-intake/category-validators"
import { dryRunProductIntakeReadyForReview } from "@/lib/product-intake/review-workflow"
import type { ProductSubmission } from "@/lib/types"
import type { SupabaseClient } from "@supabase/supabase-js"

export type ReviewActionSubmission = ProductSubmission

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

type ApprovalRpcResult = {
  submission: ReviewActionSubmission
  product_id: string
  brand_id: string
  product_line_id: string | null
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
