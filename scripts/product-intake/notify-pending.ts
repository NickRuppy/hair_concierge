import { createSupabaseClientFromEnv, flagBool, flagInt, parseArgs, printJson } from "./cli"
import { flushProductIntakeSentry } from "@/lib/observability/product-intake"
import { notifyReviewResult } from "./review-actions"

async function main() {
  const args = parseArgs()
  const supabase = createSupabaseClientFromEnv()
  const limit = flagInt(args, "limit", 50)
  const apply = flagBool(args, "apply")
  const confirm = flagBool(args, "confirm")

  if (apply && !confirm) {
    throw new Error("Notify-pending writes require --confirm.")
  }

  const { data, error } = await supabase
    .from("product_submissions")
    .select("*")
    .in("status", ["approved", "matched_existing", "needs_more_info", "rejected"])
    .is("notification_sent_at", null)
    .order("updated_at", { ascending: true })
    .limit(limit)

  if (error) {
    throw new Error(`load pending product intake notifications: ${error.message}`)
  }

  const results = []
  for (const submission of data ?? []) {
    if (!apply) {
      results.push({
        submission_id: submission.id,
        status: submission.status,
        dry_run: true,
      })
      continue
    }

    try {
      const notification = await notifyReviewResult(supabase, submission)
      results.push({ submission_id: submission.id, ok: true, notification })
    } catch (notifyError) {
      results.push({
        submission_id: submission.id,
        ok: false,
        error: notifyError instanceof Error ? notifyError.message : "notification failed",
      })
      process.exitCode = 1
    }
  }

  if (process.exitCode) {
    await flushProductIntakeSentry()
  }

  printJson({ count: results.length, results })
  if (!apply) {
    console.log("Dry-run only. Re-run with --apply --confirm to send pending notifications.")
  }
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : error)
  await flushProductIntakeSentry()
  process.exitCode = 1
})
