import { mkdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { isDeepStrictEqual } from "node:util"
import {
  executeReviewAction,
  loadReviewPublicationPreflight,
  publishReviewedProduct,
  stableReviewRequestId,
  reviewBinding,
  type ReviewPublicationReceipt,
} from "../../src/lib/product-intake/review-publication"

import { sendProductIntakeReviewNotification } from "@/lib/product-intake/notifications"
import { captureProductIntakeException } from "@/lib/observability/product-intake"
import type {
  ProductIntakeFinalReviewedPayload,
  ProductIntakeResearchedPayload,
  ProductIntakeTargetSpecOperation,
} from "@/lib/product-intake/category-validators"
import {
  dryRunProductIntakeReadyForReview,
  validateBondbuilderOwnerSubmissionApproval,
} from "@/lib/product-intake/review-workflow"
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
    user_id: submission.user_id,
    source: submission.source,
    status: submission.status,
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
    user_id: params.submission.user_id,
    source: params.submission.source,
    status: params.submission.status,
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
  publication: ReviewPublicationReceipt
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
  const ownerAdmission = validateBondbuilderOwnerSubmissionApproval(params.submission)
  const selected = ownerAdmission.ok
    ? ownerAdmission.validation
    : validateSubmissionReady(params.submission)
  if (params.submission.status !== "ready_for_review" || !selected.ok) {
    throw new Error("approval_validation_failed: stored submission is not ready for approval")
  }
  if (
    !isDeepStrictEqual(selected.normalizedPayload.final, params.finalPayload) ||
    !isDeepStrictEqual(selected.targetSpecOperations, params.specOperations)
  ) {
    throw new Error(
      "approval_payload_mismatch: caller payload does not match the validated stored submission",
    )
  }
  const preflight = await loadReviewPublicationPreflight(params.supabase, params.submission.id)
  if (!preflight.data_decision_id || !preflight.image_decision_id)
    throw new Error("approval_requires_current_separate_reviews")
  const request = {
    ...reviewBinding(preflight),
    reviewed_by: params.reviewedBy,
    data_decision_id: preflight.data_decision_id,
    image_decision_id: preflight.image_decision_id,
    confirm: true as const,
  }
  const { publication } = await publishReviewedProduct(params.supabase, {
    ...request,
    request_id: stableReviewRequestId(request),
  })
  return {
    submission: await loadSubmission(params.supabase, params.submission.id),
    product_id: publication.product_id,
    brand_id: publication.brand_id,
    product_line_id: publication.product_line_id,
    publication,
  }
}

export async function linkExistingProduct(params: {
  supabase: SupabaseClient
  submissionId: string
  productId: string
  reviewedBy: string
  reviewedAt: string
  reviewNotes: string | null
}) {
  const preflight = await loadReviewPublicationPreflight(params.supabase, params.submissionId)
  const request = {
    ...reviewBinding(preflight),
    reviewed_by: params.reviewedBy,
    action: "link_existing" as const,
    reviewer_value: { product_id: params.productId },
    comment: params.reviewNotes,
  }
  const result = await executeReviewAction(params.supabase, {
    ...request,
    request_id: stableReviewRequestId(request),
  })
  return {
    submission: await loadSubmission(params.supabase, params.submissionId),
    notification: { status: result.decision.notification_status },
    deleted_usage_id: null,
  }
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
  const preflight = await loadReviewPublicationPreflight(params.supabase, params.submissionId)
  const request = {
    ...reviewBinding(preflight),
    reviewed_by: params.reviewedBy,
    action: "request_info" as const,
    reviewer_value: {
      reason: params.reason,
      next_step: params.nextStep,
      missing_fields: params.missingFields,
    },
    comment: params.reviewNotes,
  }
  const result = await executeReviewAction(params.supabase, {
    ...request,
    request_id: stableReviewRequestId(request),
  })
  return {
    submission: await loadSubmission(params.supabase, params.submissionId),
    notification: { status: result.decision.notification_status },
    deleted_usage_id: null,
  }
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
  const preflight = await loadReviewPublicationPreflight(params.supabase, params.submissionId)
  const request = {
    ...reviewBinding(preflight),
    reviewed_by: params.reviewedBy,
    action: "reject" as const,
    reviewer_value: { reason: params.reason, next_step: params.nextStep },
    comment: params.reviewNotes,
  }
  const result = await executeReviewAction(params.supabase, {
    ...request,
    request_id: stableReviewRequestId(request),
  })
  return {
    submission: await loadSubmission(params.supabase, params.submissionId),
    notification: { status: result.decision.notification_status },
    deleted_usage_id: null,
  }
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
