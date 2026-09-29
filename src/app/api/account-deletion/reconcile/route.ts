import { NextResponse } from "next/server"
import { safeBearerTokenMatches } from "@/app/api/billing/payment-monitor/route"
import { accountDeletionEnabled } from "@/lib/account-deletion/enabled"
import { createAccountDeletionDeps } from "@/lib/account-deletion/runtime"
import {
  retryAccountDeletionCleanup,
  retryAccountDeletionWebRefunds,
} from "@/lib/account-deletion/service"
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
  /** Settles due pro-rata refunds of web subscriptions cancelled by a deletion (D14). */
  retryRefunds: () => Promise<{
    pending: number
    completed: number
    failed: number
    /** Ended in manual review this run (reported once; not a failure). */
    manual?: number
    /** A payment in scope is still pending; retried next run (not a failure). */
    waiting?: number
  }>
  purge: () => Promise<PurgeResult>
  reportPurgeFailure?: typeof reportAccountDeletionPurgeFailure
  reportOrphanClosed?: typeof reportAccountDeletionOrphanClosed
}

/**
 * Cron: close orphaned operations, resume external cleanup, settle due web refunds, purge
 * rows past retention.
 */
export async function handleAccountDeletionReconcile(request: Request, deps: Dependencies) {
  if (
    !deps.cronSecret ||
    !safeBearerTokenMatches(request.headers.get("authorization"), deps.cronSecret)
  )
    return { status: 401, body: { error: "unauthorized" } }
  // Schema not migrated yet: no RPCs, but the cron stays green.
  if (!accountDeletionEnabled())
    return { status: 200, body: { skipped: "account_deletion_disabled" } }
  // Each step is isolated: one failing (e.g. a provider outage in refunds) never skips the
  // others; the run answers 503 so the failure stays visible.
  const step = async <T>(run: () => Promise<T>): Promise<T | null> => {
    try {
      return await run()
    } catch {
      return null
    }
  }
  const orphans = await step(deps.closeOrphans)
  // Closed before web billing was cancelled: an operator must check the provider.
  for (const priorState of orphans?.priorStates ?? [])
    if (priorState === "requested")
      (deps.reportOrphanClosed ?? reportAccountDeletionOrphanClosed)({ priorState })
  const cleanup = await step(deps.retryCleanup)
  const refunds = await step(deps.retryRefunds)
  const purged = await step(deps.purge)
  for (const table of purged?.failed ?? [])
    (deps.reportPurgeFailure ?? reportAccountDeletionPurgeFailure)({ table })
  const healthy =
    orphans &&
    cleanup &&
    refunds &&
    purged &&
    !cleanup.failed &&
    !refunds.failed &&
    !purged.failed.length
  return {
    status: healthy ? 200 : 503,
    body: {
      orphansClosed: orphans?.closed ?? null,
      cleanup: cleanup ?? { error: "temporarily_unavailable" },
      refunds: refunds ?? { error: "temporarily_unavailable" },
      purged: purged ?? { error: "temporarily_unavailable" },
    },
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
    retryRefunds: () => retryAccountDeletionWebRefunds(createAccountDeletionDeps(client)),
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
