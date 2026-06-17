import { readFile } from "node:fs/promises"

import { dryRunProductIntakeReadyForReview } from "@/lib/product-intake/review-workflow"

import {
  createSupabaseClientFromEnv,
  flag,
  flagBool,
  parseArgs,
  printJson,
  requireFlag,
} from "./cli"
import { loadSubmission } from "./review-actions"

const OPEN_RESEARCH_STATUSES = [
  "pending_review",
  "researching",
  "ready_for_review",
  "needs_more_info",
] as const

async function loadPayload(path: string) {
  return JSON.parse(await readFile(path, "utf8")) as Record<string, unknown>
}

function buildDraftFromSubmission(submission: Awaited<ReturnType<typeof loadSubmission>>) {
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

async function main() {
  const args = parseArgs()
  const supabase = createSupabaseClientFromEnv()
  const submissionId = requireFlag(args, "submission-id")
  const payloadFile = flag(args, "payload-file")
  const markReady = flagBool(args, "mark-ready")
  const apply = flagBool(args, "apply")
  const submission = await loadSubmission(supabase, submissionId)

  const researchedPayload = payloadFile
    ? await loadPayload(payloadFile)
    : {
        ...(submission.researched_payload ?? {}),
        ...buildDraftFromSubmission(submission),
      }

  const dryRun = dryRunProductIntakeReadyForReview({
    id: submission.id,
    category: submission.category,
    researched_payload: researchedPayload,
  })

  printJson({
    submission_id: submission.id,
    status: submission.status,
    dry_run: dryRun,
    researched_payload: researchedPayload,
  })

  if (!apply) {
    console.log("Dry-run only. Re-run with --apply to save the payload/status.")
    return
  }

  if (
    !OPEN_RESEARCH_STATUSES.includes(submission.status as (typeof OPEN_RESEARCH_STATUSES)[number])
  ) {
    throw new Error(
      `Refusing to update closed submission ${submission.id} with status ${submission.status}`,
    )
  }
  if (!submission.updated_at) {
    throw new Error(`Refusing to update submission ${submission.id} without updated_at guard`)
  }

  const nextStatus = markReady && dryRun.ok ? "ready_for_review" : "researching"
  const { data, error } = await supabase
    .from("product_submissions")
    .update({
      researched_payload: researchedPayload,
      status: nextStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", submission.id)
    .eq("status", submission.status)
    .eq("updated_at", submission.updated_at)
    .in("status", [...OPEN_RESEARCH_STATUSES])
    .select("id")
    .single()

  if (error || !data) {
    throw new Error(`save researched payload: ${error?.message ?? "no row updated"}`)
  }

  console.log(`Saved researched payload. New status: ${nextStatus}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
