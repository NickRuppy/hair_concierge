import { NextResponse } from "next/server"
import { safeBearerTokenMatches } from "@/app/api/billing/payment-monitor/route"
import { createAccountDeletionDeps } from "@/lib/account-deletion/runtime"
import { retryAccountDeletionCleanup } from "@/lib/account-deletion/service"
import {
  reportAccountDeletionOrphanClosed,
  reportAccountDeletionPurgeFailure,
} from "@/lib/observability/account-deletion"
import { createAdminClient } from "@/lib/supabase/admin"

export const runtime = "nodejs"
export const maxDuration = 60

type PurgeResult = {
  deleted: Record<string, number>
  failed: string[]
  /** Expired anonymized rows another record still references; purged once it goes. */
  stillReferenced?: Record<string, number>
}
type OrphanResult = { closed: number; priorStates: ("requested" | "web_billing_cancelled")[] }

type Dependencies = {
  cronSecret?: string
  /** Moves open operations whose account is already gone into external cleanup. */
  closeOrphans: () => Promise<OrphanResult>
  retryCleanup: () => Promise<{ pending: number; completed: number; failed: number }>
  purge: () => Promise<PurgeResult>
  reportPurgeFailure?: typeof reportAccountDeletionPurgeFailure
  reportOrphanClosed?: typeof reportAccountDeletionOrphanClosed
}

/** Cron: close orphaned operations, resume external cleanup, purge rows past retention. */
export async function handleAccountDeletionReconcile(request: Request, deps: Dependencies) {
  if (
    !deps.cronSecret ||
    !safeBearerTokenMatches(request.headers.get("authorization"), deps.cronSecret)
  )
    return { status: 401, body: { error: "unauthorized" } }
  try {
    const orphans = await deps.closeOrphans()
    // Closed before web billing was cancelled: an operator must check the provider.
    for (const priorState of orphans.priorStates)
      if (priorState === "requested")
        (deps.reportOrphanClosed ?? reportAccountDeletionOrphanClosed)({ priorState })
    const cleanup = await deps.retryCleanup()
    const purged = await deps.purge()
    for (const table of purged.failed)
      (deps.reportPurgeFailure ?? reportAccountDeletionPurgeFailure)({ table })
    return {
      status: cleanup.failed || purged.failed.length ? 503 : 200,
      body: { orphansClosed: orphans.closed, cleanup, purged },
    }
  } catch {
    return { status: 503, body: { error: "temporarily_unavailable" } }
  }
}

export async function GET(request: Request) {
  const client = createAdminClient()
  const result = await handleAccountDeletionReconcile(request, {
    cronSecret: process.env.CRON_SECRET,
    closeOrphans: async () => {
      const { data, error } = await client.rpc("account_deletion_close_orphans")
      if (error) throw new Error("Orphan close failed")
      return data as OrphanResult
    },
    retryCleanup: () => retryAccountDeletionCleanup(createAccountDeletionDeps(client)),
    purge: async () => {
      const { data, error } = await client.rpc("purge_anonymized_records")
      if (error) throw new Error("Purge failed")
      return data as PurgeResult
    },
  })
  return NextResponse.json(result.body, {
    status: result.status,
    headers: { "Cache-Control": "no-store" },
  })
}
