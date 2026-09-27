import { NextResponse } from "next/server"
import { safeBearerTokenMatches } from "@/app/api/billing/payment-monitor/route"
import { createAccountDeletionDeps } from "@/lib/account-deletion/runtime"
import { retryAccountDeletionCleanup } from "@/lib/account-deletion/service"
import { createAdminClient } from "@/lib/supabase/admin"

export const runtime = "nodejs"
export const maxDuration = 60

type Dependencies = {
  cronSecret?: string
  retryCleanup: () => Promise<{ pending: number; completed: number; failed: number }>
  purge: () => Promise<unknown>
}

/** Cron: resume external cleanup of deleted accounts, then purge rows past retention. */
export async function handleAccountDeletionReconcile(request: Request, deps: Dependencies) {
  if (
    !deps.cronSecret ||
    !safeBearerTokenMatches(request.headers.get("authorization"), deps.cronSecret)
  )
    return { status: 401, body: { error: "unauthorized" } }
  try {
    const cleanup = await deps.retryCleanup()
    const purged = await deps.purge()
    return { status: cleanup.failed ? 503 : 200, body: { cleanup, purged } }
  } catch {
    return { status: 503, body: { error: "temporarily_unavailable" } }
  }
}

export async function GET(request: Request) {
  const client = createAdminClient()
  const result = await handleAccountDeletionReconcile(request, {
    cronSecret: process.env.CRON_SECRET,
    retryCleanup: () => retryAccountDeletionCleanup(createAccountDeletionDeps(client)),
    purge: async () => {
      const { data, error } = await client.rpc("purge_anonymized_records")
      if (error) throw new Error("Purge failed")
      return data
    },
  })
  return NextResponse.json(result.body, {
    status: result.status,
    headers: { "Cache-Control": "no-store" },
  })
}
