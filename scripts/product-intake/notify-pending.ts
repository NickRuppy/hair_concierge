import { createSupabaseClientFromEnv, flagBool, flagInt, parseArgs, printJson } from "./cli"
import { notifyReviewResult } from "./review-actions"
import { retryReviewNotification } from "../../src/lib/product-intake/review-publication"

async function main() {
  const args = parseArgs()
  const client = createSupabaseClientFromEnv()
  const limit = flagInt(args, "limit", 50)
  const apply = flagBool(args, "apply")
  if (apply && !flagBool(args, "confirm"))
    throw new Error("Notify-pending writes require --confirm.")
  const results = []
  for (const table of [
    "product_intake_publication_receipts",
    "product_intake_review_decisions",
  ] as const) {
    const { data, error } = await client
      .from(table)
      .select("id,submission_id,notification_status")
      .in("notification_status", ["pending", "failed"])
      .order("created_at", { ascending: true })
      .limit(limit)
    if (error) throw new Error("review_notifications_unavailable")
    for (const row of data ?? []) {
      if (!apply) {
        results.push({
          id: row.id,
          submission_id: row.submission_id,
          notification_status: row.notification_status,
          dry_run: true,
        })
        continue
      }
      try {
        const notification = await retryReviewNotification(
          client,
          table === "product_intake_publication_receipts"
            ? { publicationId: row.id }
            : { decisionId: row.id },
        )
        results.push({ id: row.id, ...notification })
        if (notification.notification_status === "failed") process.exitCode = 1
      } catch {
        results.push({ id: row.id, error: "review_notification_retry_failed" })
        process.exitCode = 1
      }
    }
  }
  // Historical handoffs predate durable events. Do not replay their messages
  // for any submission now owned by a durable publication or disposition.
  const historical = await client
    .from("product_submissions")
    .select("*")
    .in("status", ["approved", "matched_existing", "needs_more_info", "rejected"])
    .is("notification_sent_at", null)
    .order("updated_at", { ascending: true })
    .limit(limit)
  if (historical.error) throw new Error("review_legacy_notifications_unavailable")
  for (const submission of historical.data ?? []) {
    const publication = await client
      .from("product_intake_publication_receipts")
      .select("id")
      .eq("submission_id", submission.id)
      .maybeSingle()
    const disposition = await client
      .from("product_intake_review_decisions")
      .select("id")
      .eq("submission_id", submission.id)
      .not("notification_status", "is", null)
      .limit(1)
      .maybeSingle()
    if (publication.error || disposition.error)
      throw new Error("review_notification_authority_unavailable")
    if (publication.data || disposition.data) continue
    if (!apply) {
      results.push({ submission_id: submission.id, legacy: true, dry_run: true })
      continue
    }
    try {
      results.push({
        submission_id: submission.id,
        legacy: true,
        notification: await notifyReviewResult(client, submission),
      })
    } catch {
      results.push({ submission_id: submission.id, error: "review_notification_retry_failed" })
      process.exitCode = 1
    }
  }
  printJson({ count: results.length, results })
  if (!apply)
    console.log("Dry-run only. Re-run with --apply --confirm to retry customer chat notifications.")
}
main().catch((error) => {
  console.error(error instanceof Error ? error.message : "notification retry failed")
  process.exitCode = 1
})
