import {
  createSupabaseClientFromEnv,
  flag,
  flagBool,
  parseArgs,
  printJson,
  requireFlag,
} from "./cli"
import {
  captureProductIntakeException,
  flushProductIntakeSentry,
} from "@/lib/observability/product-intake"
import type { ProductIntakeTargetSpecOperation } from "@/lib/product-intake/category-validators"
import {
  appendProductAdditionRecord,
  approveReviewedSubmission,
  loadSubmission,
  notifyReviewResult,
  productAdditionRecordPathForDate,
  validateSubmissionReady,
} from "./review-actions"

export function deriveSuitableThicknessesFromSpecOperations(
  specOperations: readonly ProductIntakeTargetSpecOperation[],
): string[] {
  const thicknesses = new Set<string>()
  for (const operation of specOperations) {
    for (const row of operation.rows) {
      const thickness = (row as { thickness?: unknown }).thickness
      if (thickness === "fine" || thickness === "normal" || thickness === "coarse") {
        thicknesses.add(thickness)
      }
    }
  }
  return [...thicknesses].sort()
}

async function writeSuitableThicknessesForApprovedProduct(params: {
  supabase: ReturnType<typeof createSupabaseClientFromEnv>
  productId: string
  specOperations: readonly ProductIntakeTargetSpecOperation[]
}): Promise<void> {
  const thicknesses = deriveSuitableThicknessesFromSpecOperations(params.specOperations)
  if (thicknesses.length === 0) return
  const { error } = await params.supabase
    .from("products")
    .update({ suitable_thicknesses: thicknesses })
    .eq("id", params.productId)
  if (error) throw error
}

export async function approveSubmissionById(params: {
  submissionId: string
  reviewedBy: string
  reviewNotes: string | null
  apply: boolean
  confirm: boolean
}) {
  const supabase = createSupabaseClientFromEnv()
  const submission = await loadSubmission(supabase, params.submissionId)
  const validation = validateSubmissionReady(submission)

  if (!validation.ok) {
    printJson({
      submission_id: submission.id,
      ok: false,
      status: submission.status,
      missing_fields: validation.missingFields,
    })
    process.exitCode = 1
    if (params.apply) {
      throw new Error(`approval_validation_failed: ${validation.missingFields.join(", ")}`)
    }
    return null
  }

  const reviewedAt = new Date().toISOString()
  const dryRunPayload = {
    submission_id: submission.id,
    ok: true,
    product: validation.normalizedPayload.final.product,
    identifiers: validation.normalizedPayload.final.identifiers,
    spec_operations: validation.targetSpecOperations,
    usage_link: {
      user_product_usage_id: submission.user_product_usage_id,
      next_product_id: params.apply ? "<created_product_id>" : "<created on apply>",
      next_product_submission_id: submission.id,
      next_match_status: "matched",
    },
    addition_record_path: productAdditionRecordPathForDate(reviewedAt),
    notification: {
      source: submission.source,
      source_conversation_id: submission.source_conversation_id,
    },
  }

  if (!params.apply) {
    printJson(dryRunPayload)
    console.log("Dry-run only. Re-run with --apply --confirm to approve.")
    return null
  }

  if (!params.confirm) {
    throw new Error("Approval writes require --confirm")
  }

  const approval = await approveReviewedSubmission({
    supabase,
    submission,
    finalPayload: validation.normalizedPayload.final,
    specOperations: validation.targetSpecOperations,
    reviewedBy: params.reviewedBy,
    reviewedAt,
    reviewNotes: params.reviewNotes,
  })

  try {
    await writeSuitableThicknessesForApprovedProduct({
      supabase,
      productId: approval.product_id,
      specOperations: validation.targetSpecOperations,
    })
  } catch (error) {
    console.error(
      `Approved, but failed to write suitable_thicknesses for product ${approval.product_id}:`,
      error,
    )
  }

  let additionRecordPath: string | null = null
  try {
    additionRecordPath = await appendProductAdditionRecord({
      submission_id: submission.id,
      product_id: approval.product_id,
      category_key: validation.normalizedPayload.final.product.category_key,
      brand_id: approval.brand_id,
      product_line_id: approval.product_line_id,
      approved_at: reviewedAt,
      reviewed_by: params.reviewedBy,
      final_payload: validation.normalizedPayload.final,
      spec_operations: validation.targetSpecOperations,
    })
  } catch (error) {
    captureProductIntakeException(error, {
      stage: "append_addition_record",
      submissionId: submission.id,
      approvedProductId: approval.product_id,
      userId: submission.user_id,
      source: submission.source,
      sourceConversationId: submission.source_conversation_id,
      category: submission.category,
      intakeMethod: submission.intake_method,
      status: approval.submission.status,
      reason: "addition_record_write_failed",
      committed: true,
    })
    console.error(
      `Approved in DB, but failed to write addition record. Regenerate for submission ${submission.id}.`,
    )
    throw error
  }

  const notification = await notifyReviewResult(supabase, approval.submission)

  printJson({
    ...dryRunPayload,
    approved_product_id: approval.product_id,
    addition_record_path: additionRecordPath,
    notification,
  })

  return { ...approval, notification }
}

async function main() {
  const args = parseArgs()
  const reviewedBy = requireFlag(args, "reviewed-by")
  const submissionId = flag(args, "submission-id") ?? args.positional[0]

  if (!submissionId) {
    throw new Error("Missing submission id")
  }

  if (!flagBool(args, "manual-review-complete")) {
    throw new Error("Approval requires --manual-review-complete")
  }

  await approveSubmissionById({
    submissionId,
    reviewedBy,
    reviewNotes: flag(args, "review-notes"),
    apply: flagBool(args, "apply"),
    confirm: flagBool(args, "confirm"),
  })
}

if (process.argv[1]?.endsWith("approve.ts")) {
  main().catch(async (error) => {
    console.error(error instanceof Error ? error.message : error)
    await flushProductIntakeSentry()
    process.exitCode = 1
  })
}
