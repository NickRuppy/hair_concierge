/** Read-only reconciliation-health report for Product Intake admin alerts. */
import { pathToFileURL } from "node:url"

import { readAdminReviewOutboxHealth } from "@/lib/product-intake/admin-review-outbox-health"
import { createSupabaseClientFromEnv, printJson } from "./cli"

async function main() {
  const report = await readAdminReviewOutboxHealth(createSupabaseClientFromEnv(), {
    signal: AbortSignal.timeout(10_000),
  })
  printJson({
    status:
      report.heldCount + report.expiredSendingCount + report.failedCount > 0
        ? "attention_required"
        : "healthy",
    ...report,
  })
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(() => {
    // Database/provider details can contain private operational context.
    console.error("Product Intake admin alert health read failed.")
    process.exitCode = 1
  })
}
