import {
  createSupabaseClientFromEnv,
  flag,
  flagBool,
  parseArgs,
  printJson,
  requireFlag,
} from "./cli"
import { linkExistingProduct, notifyReviewResult } from "./review-actions"

async function main() {
  const args = parseArgs()
  const supabase = createSupabaseClientFromEnv()
  const submissionId = requireFlag(args, "submission-id")
  const productId = requireFlag(args, "product-id")
  const reviewedBy = requireFlag(args, "reviewed-by")
  const reviewedAt = new Date().toISOString()
  const apply = flagBool(args, "apply")
  const confirm = flagBool(args, "confirm")

  const dryRunPayload = {
    submission_id: submissionId,
    linked_product_id: productId,
    reviewed_by: reviewedBy,
    reviewed_at: reviewedAt,
    review_notes: flag(args, "review-notes"),
    next_status: "matched_existing",
    notification: {
      will_send: true,
    },
  }

  if (!apply) {
    printJson(dryRunPayload)
    console.log("Dry-run only. Re-run with --apply --confirm to link this product.")
    return
  }

  if (!confirm) {
    throw new Error("Link-existing writes require --confirm")
  }

  const result = await linkExistingProduct({
    supabase,
    submissionId,
    productId,
    reviewedBy,
    reviewedAt,
    reviewNotes: flag(args, "review-notes"),
  })
  const notification = await notifyReviewResult(supabase, result.submission)

  printJson({
    ...dryRunPayload,
    notification,
  })
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
