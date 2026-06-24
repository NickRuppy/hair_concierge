import { readFile } from "node:fs/promises"

import {
  createSupabaseClientFromEnv,
  flag,
  flagBool,
  parseArgs,
  printJson,
  requireFlag,
} from "./cli"
import { notifyReviewResult, rejectSubmission, requestMoreInfo } from "./review-actions"

async function readMissingFields(path: string | null): Promise<unknown[]> {
  if (!path) return []
  const parsed = JSON.parse(await readFile(path, "utf8")) as unknown
  return sanitizeMissingFields(Array.isArray(parsed) ? parsed : [parsed])
}

function sanitizeMissingFields(fields: unknown[]): string[] {
  return fields
    .filter((field): field is string => typeof field === "string")
    .map((field) => field.trim())
    .filter(Boolean)
}

async function main() {
  const args = parseArgs()
  const supabase = createSupabaseClientFromEnv()
  const submissionId = requireFlag(args, "submission-id")
  const reviewedBy = requireFlag(args, "reviewed-by")
  const reason = requireFlag(args, "reason")
  const nextStep = flag(args, "next-step")
  const reviewedAt = new Date().toISOString()
  const reject = flagBool(args, "reject")
  const apply = flagBool(args, "apply")
  const confirm = flagBool(args, "confirm")
  const reviewNotes = flag(args, "review-notes")

  if (reject) {
    const dryRunPayload = {
      submission_id: submissionId,
      status: "rejected",
      reviewed_by: reviewedBy,
      reviewed_at: reviewedAt,
      reason,
      next_step: nextStep,
      review_notes: reviewNotes,
      notification: {
        will_send: true,
      },
    }

    if (!apply) {
      printJson(dryRunPayload)
      console.log("Dry-run only. Re-run with --apply --confirm to reject this submission.")
      return
    }

    if (!confirm) {
      throw new Error("Reject writes require --confirm")
    }

    const result = await rejectSubmission({
      supabase,
      submissionId,
      reviewedBy,
      reviewedAt,
      reason,
      nextStep,
      reviewNotes,
    })
    const notification = await notifyReviewResult(supabase, result.submission)

    printJson({
      ...dryRunPayload,
      deleted_usage_id: result.deleted_usage_id,
      notification,
    })
    return
  }

  if (!nextStep) {
    throw new Error("Request-info requires --next-step")
  }

  const missingFields = await readMissingFields(flag(args, "missing-fields-file"))
  const dryRunPayload = {
    submission_id: submissionId,
    status: "needs_more_info",
    reviewed_by: reviewedBy,
    reviewed_at: reviewedAt,
    reason,
    next_step: nextStep,
    missing_fields: missingFields,
    review_notes: reviewNotes,
    notification: {
      will_send: true,
    },
  }

  if (!apply) {
    printJson(dryRunPayload)
    console.log("Dry-run only. Re-run with --apply --confirm to request more information.")
    return
  }

  if (!confirm) {
    throw new Error("Request-info writes require --confirm")
  }

  const result = await requestMoreInfo({
    supabase,
    submissionId,
    reviewedBy,
    reviewedAt,
    reason,
    nextStep,
    missingFields,
    reviewNotes,
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
