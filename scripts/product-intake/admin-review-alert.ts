/** Explicit, isolated admin alert test; never claims a live Supabase row. */
import { mkdir, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { pathToFileURL } from "node:url"
import type { PGlite } from "@electric-sql/pglite"
import {
  commitResearchPass,
  type JsonRecord,
  type ProductIntakeResearchJob,
} from "@chaarlie/product-intake-core"
import {
  buildAdminReviewSnapshot,
  buildAdminReviewEmail,
} from "@/lib/product-intake/admin-review-email"
import {
  drainAdminReviewOutbox,
  type AdminReviewOutboxClient,
} from "@/lib/product-intake/admin-review-outbox"
import { loadLocalEnv, parseArgs, flag, flagBool } from "./cli"

// Parameterized, allowlisted bridge to the same real RPCs used by Supabase.
// This adapter exists only for the explicitly authorized, offline-ledger test.
function offlineRpcClient(pg: PGlite): AdminReviewOutboxClient {
  const rpc = async (name: string, args: JsonRecord = {}) => {
    const signatures: Record<string, string[]> = {
      product_intake_commit_research_pass: [
        "target_job_id",
        "expected_locked_by",
        "expected_locked_at",
        "next_status",
        "next_stage",
        "next_progress",
        "next_last_error",
        "researched_payload",
        "resolve_decision_ids",
        "review_outcome",
        "notification_payload",
      ],
      product_intake_claim_admin_notification: [],
      product_intake_settle_admin_notification: [
        "target_id",
        "expected_lease_token",
        "result",
        "delivery_id",
        "queued_at",
        "error_code",
      ],
    }
    const names = signatures[name]
    if (!names) throw new Error("Unsupported offline admin alert RPC")
    const values = names.map((key) => args[key] ?? null)
    const result = await pg.query<Record<string, unknown>>(
      `SELECT * FROM public.${name}(${names.map((_, index) => `$${index + 1}`).join(",")})`,
      values,
    )
    const data =
      name === "product_intake_claim_admin_notification"
        ? result.rows
        : name === "product_intake_settle_admin_notification"
          ? result.rows[0]?.[name]
          : result.rows[0]
    return { data, error: null }
  }
  return { rpc } as unknown as AdminReviewOutboxClient
}

async function main() {
  const args = parseArgs()
  const run = flag(args, "test-run")
  if (
    !flagBool(args, "test") ||
    !flagBool(args, "confirm") ||
    !run ||
    !/^[a-z0-9-]{1,64}$/.test(run)
  )
    throw new Error("Requires --test --confirm --test-run=<unique-authorized-run>")
  loadLocalEnv()
  if (process.env.PRODUCT_INTAKE_REVIEW_EMAILS !== "false")
    throw new Error("Explicit test requires PRODUCT_INTAKE_REVIEW_EMAILS=false")
  const payload = {
    final: { product: { canonical_brand: "Testmarke", clean_name: "Beispiel-Conditioner" } },
  }
  const testSnapshot = {
    ...buildAdminReviewSnapshot({
      submissionId: "11111111-1111-4111-8111-111111111111",
      category: "conditioner",
      researchedPayload: payload,
      outcome: "ready_for_review",
    }),
    is_test: true,
    review_url: "https://chaarlie.de/admin",
  }
  // Preflight before a durable run marker; missing settings cannot consume a test.
  buildAdminReviewEmail(testSnapshot, undefined, undefined, { test: true })
  if (!process.env.CUSTOMERIO_APP_API_KEY?.trim())
    throw new Error("Customer.io sending credential is not configured")
  const root = join(process.cwd(), "tmp", "product-intake-admin-alert-tests")
  await mkdir(root, { recursive: true, mode: 0o700 })
  const runDir = join(root, run)
  // Refuse repeat sends after a lost acknowledgement. Inspect this retained ledger
  // and the provider before authorizing another run, never blindly repeat the CLI.
  await mkdir(runDir, { mode: 0o700 })
  const receiptPath = join(runDir, "receipt.json")
  await writeFile(
    receiptPath,
    JSON.stringify(
      { status: "prepared", automaticAlerts: false, preparedAt: new Date().toISOString() },
      null,
      2,
    ),
    { mode: 0o600 },
  )
  const { createAdminAlertTestDatabase } = await import("./admin-alert-test-database")
  const pg = await createAdminAlertTestDatabase(join(runDir, "ledger"))
  try {
    const submission = (
      await pg.query<{ id: string }>(`INSERT INTO public.product_submissions
      (user_id,source,intake_method,category,frequency_range)
      VALUES ('11111111-1111-4111-8111-111111111111','chat','manual','conditioner','weekly_1x') RETURNING id`)
    ).rows[0]!
    const job = (
      await pg.query<{ job: ProductIntakeResearchJob }>(
        "SELECT row_to_json(j) AS job FROM public.product_intake_claim_research_jobs('admin-alert-isolated-test',1) j",
      )
    ).rows[0]!.job
    const snapshot = buildAdminReviewSnapshot({
      submissionId: submission.id,
      category: "conditioner",
      researchedPayload: payload,
      outcome: "ready_for_review",
    })
    const client = offlineRpcClient(pg)
    await commitResearchPass(client as Parameters<typeof commitResearchPass>[0], {
      jobId: job.id,
      expectedLockedBy: job.locked_by,
      expectedLockedAt: String(job.locked_at),
      status: "waiting_for_review",
      stage: "preview_build",
      progress: { message: "Isolierter E-Mail-Test" },
      researchedPayload: payload,
      reviewOutcome: "ready_for_review",
      notificationPayload: snapshot,
    })
    // Test-only mutation of the isolated ledger. Production completion forbids
    // test payloads; there is no test insertion RPC in the live database.
    await pg.query("UPDATE public.product_intake_admin_notifications SET payload = $1", [
      testSnapshot,
    ])
    const result = await drainAdminReviewOutbox(client, { mode: "test" })
    const stored = (
      await pg.query(
        "SELECT id,status,attempts,provider_delivery_id,provider_queued_at,sent_at,error FROM public.product_intake_admin_notifications",
      )
    ).rows[0]
    await writeFile(
      receiptPath,
      JSON.stringify(
        { ...result, automaticAlerts: false, ledger: stored, finishedAt: new Date().toISOString() },
        null,
        2,
      ),
      { mode: 0o600 },
    )
    console.log(JSON.stringify({ ...result, automaticAlerts: false, receiptPath }))
    if (result.status !== "sent") process.exitCode = 1
  } finally {
    await pg.close()
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(() => {
    // Do not dump provider bodies, raw configuration or recipient details.
    console.error("Admin alert test failed; inspect the private run receipt before retrying.")
    process.exitCode = 1
  })
}
