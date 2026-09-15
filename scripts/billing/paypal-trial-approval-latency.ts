import { pathToFileURL } from "node:url"
import { createAdminClient } from "../../src/lib/supabase/admin"

/**
 * Read-only operator report: minutes from tapping "Mit PayPal" (checkout
 * freeze) to approving the agreement, aggregated over the last N days.
 * Decides whether the 24-hour PayPal approval window can be shortened later
 * (ruled 2026-09-15: keep 24h, revisit with data). Aggregates only.
 *
 *   node --env-file=.env.local --import ./tests/server-only-register.cjs --import tsx \
 *     scripts/billing/paypal-trial-approval-latency.ts [--days=90]
 */
type Client = {
  rpc: (
    name: string,
    args: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: unknown }>
}

export async function runPayPalTrialApprovalLatency(argv: string[], client: Client) {
  const days = Number(argv.find((a) => a.startsWith("--days="))?.slice(7) ?? "90")
  if (!Number.isInteger(days) || days < 1 || days > 3650) throw new Error("--days must be 1..3650")
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await client.rpc("report_paypal_trial_approval_latency", {
    p_since: since,
  })
  if (error) throw new Error(`PayPal approval latency report failed: ${JSON.stringify(error)}`)
  return data as Record<string, unknown>
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  runPayPalTrialApprovalLatency(process.argv.slice(2), createAdminClient())
    .then((report) => console.log(JSON.stringify(report, null, 2)))
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error)
      process.exit(1)
    })
