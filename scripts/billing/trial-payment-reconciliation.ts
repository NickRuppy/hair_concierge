import { pathToFileURL } from "node:url"

import { createAdminClient } from "../../src/lib/supabase/admin"

type ReconciliationClient = Readonly<{
  rpc: (
    name: string,
    args: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: unknown }>
}>

/** Read-only, PII-minimized operational queue. This command has no apply mode. */
export async function readTrialPaymentReconciliation(argv: string[], client: ReconciliationClient) {
  if (
    argv.length < 1 ||
    argv.length > 2 ||
    argv[0] !== "--list" ||
    (argv[1] !== undefined && !/^--offset=\d{1,7}$/.test(argv[1]))
  ) {
    throw new Error("Use --list [--offset=100]; mutations are not supported")
  }
  const offset = argv[1] ? Number(argv[1].slice("--offset=".length)) : 0
  const { data, error } = await client.rpc("list_trial_payment_reconciliation_failures", {
    p_limit: 100,
    p_offset: offset,
  })
  if (error || !Array.isArray(data))
    throw new Error("Trial payment reconciliation queue unavailable")
  return { mode: "read-only", rows: data }
}

async function main() {
  const result = await readTrialPaymentReconciliation(process.argv.slice(2), createAdminClient())
  console.log(JSON.stringify(result, null, 2))
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(() => {
    console.error(
      "Trial payment reconciliation read failed. Use --list [--offset=100] with configured service access.",
    )
    process.exitCode = 1
  })
}
