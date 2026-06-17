import { createSupabaseClientFromEnv, flagInt, parseArgs, printJson } from "./cli"
import { notifyReviewResult } from "./review-actions"

async function main() {
  const args = parseArgs()
  const supabase = createSupabaseClientFromEnv()
  const limit = flagInt(args, "limit", 50)

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

  printJson({ count: results.length, results })
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
