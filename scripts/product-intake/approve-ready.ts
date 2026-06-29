import { createSupabaseClientFromEnv, flag, flagBool, parseArgs, requireFlag } from "./cli"
import { flushProductIntakeSentry } from "@/lib/observability/product-intake"
import { approveSubmissionById } from "./approve"
import { loadSubmissionsByIds, validateSubmissionReady } from "./review-actions"

function parseIds(raw: string): string[] {
  return raw
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
}

async function main() {
  const args = parseArgs()
  const ids = parseIds(requireFlag(args, "ids"))
  const reviewedBy = requireFlag(args, "reviewed-by")
  const apply = flagBool(args, "apply")
  const confirm = flagBool(args, "confirm")

  const supabase = createSupabaseClientFromEnv()
  const submissions = await loadSubmissionsByIds(supabase, ids)

  for (const submission of submissions) {
    if (submission.status !== "ready_for_review") {
      console.error(`${submission.id}: expected ready_for_review, got ${submission.status}`)
      process.exitCode = 1
      continue
    }

    const validation = validateSubmissionReady(submission)
    if (!validation.ok) {
      console.error(`${submission.id}: validation failed: ${validation.missingFields.join(", ")}`)
      process.exitCode = 1
      continue
    }

    try {
      await approveSubmissionById({
        submissionId: submission.id,
        reviewedBy,
        reviewNotes: flag(args, "review-notes"),
        apply,
        confirm,
      })
    } catch (error) {
      console.error(
        `${submission.id}: ${error instanceof Error ? error.message : "approval failed"}`,
      )
      process.exitCode = 1
    }
  }

  if (process.exitCode) {
    await flushProductIntakeSentry()
  }

  if (!apply) {
    console.log("Batch dry-run only. Re-run with --apply --confirm to approve selected rows.")
  }
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : error)
  await flushProductIntakeSentry()
  process.exitCode = 1
})
