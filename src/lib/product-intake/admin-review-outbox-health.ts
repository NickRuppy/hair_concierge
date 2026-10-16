import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

const RISK_STATUSES = ["needs_reconciliation", "sending", "failed"] as const
const RECONCILIATION_STATUS = "needs_reconciliation"
const SEND_LEASE_MS = 5 * 60_000
const DEFAULT_PAGE_SIZE = 100
const MAX_PAGES = 100

type RiskStatus = (typeof RISK_STATUSES)[number]

export type AdminReviewOutboxHealthClient = Pick<SupabaseClient, "from">
export type AdminReviewOutboxHealthRow = {
  id: string
  status: RiskStatus
  created_at: string
  locked_at: string | null
}

export type AdminReviewOutboxHealthReport = {
  heldCount: number
  expiredSendingCount: number
  failedCount: number
  oldestReconciliationAgeMs: number | null
  /** Opaque notification identifiers for an operator's private reconciliation lookup. */
  ids: string[]
}

export type AdminReviewOutboxHealthPoll =
  | { kind: "quiet" }
  | { kind: "issue"; report: AdminReviewOutboxHealthReport; recovered: boolean }
  | { kind: "resolved"; recovered: boolean }
  | { kind: "read_failure" }
  | { kind: "recovered" }

type ReadOptions = {
  now?: Date
  pageSize?: number
  signal?: AbortSignal
}

type ObserverOptions = {
  now?: () => Date
  pageSize?: number
  signal?: () => AbortSignal | undefined
}

function readFailure(): Error {
  return new Error("Product Intake admin notification health read failed")
}

function timestamp(value: unknown): number | null {
  if (typeof value !== "string" || !value.trim()) return null
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : null
}

function isRiskStatus(value: unknown): value is RiskStatus {
  return typeof value === "string" && (RISK_STATUSES as readonly string[]).includes(value)
}

function validRow(value: unknown): value is AdminReviewOutboxHealthRow {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const row = value as Record<string, unknown>
  return (
    typeof row.id === "string" &&
    row.id.trim().length > 0 &&
    isRiskStatus(row.status) &&
    timestamp(row.created_at) !== null &&
    (row.locked_at === null || timestamp(row.locked_at) !== null)
  )
}

function pageSize(value: number | undefined): number {
  if (!Number.isInteger(value) || !value || value < 1 || value > 200) return DEFAULT_PAGE_SIZE
  return value
}

/**
 * Read all outbox rows that can require human attention. This intentionally
 * excludes pending/sent history and never invokes a claim or settlement RPC.
 */
export async function readAdminReviewOutboxHealth(
  client: AdminReviewOutboxHealthClient,
  options: ReadOptions = {},
): Promise<AdminReviewOutboxHealthReport> {
  const limit = pageSize(options.pageSize)
  const rows: AdminReviewOutboxHealthRow[] = []

  try {
    for (let page = 0; page < MAX_PAGES; page += 1) {
      const start = page * limit
      let query = client
        .from("product_intake_admin_notifications")
        .select("id,status,created_at,locked_at")
        .in("status", [...RISK_STATUSES])
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .range(start, start + limit - 1)
      if (options.signal) query = query.abortSignal(options.signal)
      const { data, error } = await query
      if (error || !Array.isArray(data) || data.some((entry) => !validRow(entry)))
        throw readFailure()
      rows.push(...data)
      if (data.length < limit) return classify(rows, options.now ?? new Date())
    }
  } catch {
    throw readFailure()
  }

  throw readFailure()
}

function classify(rows: AdminReviewOutboxHealthRow[], now: Date): AdminReviewOutboxHealthReport {
  const nowMs = now.getTime()
  if (!Number.isFinite(nowMs)) throw readFailure()

  let heldCount = 0
  let expiredSendingCount = 0
  let failedCount = 0
  let oldestAffectedCreatedAt: number | null = null
  const ids: string[] = []

  for (const row of rows) {
    const createdAt = timestamp(row.created_at)
    if (createdAt === null) throw readFailure()
    if (row.status === RECONCILIATION_STATUS) {
      heldCount += 1
      oldestAffectedCreatedAt = Math.min(oldestAffectedCreatedAt ?? createdAt, createdAt)
      ids.push(row.id)
      continue
    }
    if (row.status === "failed") {
      failedCount += 1
      ids.push(row.id)
      continue
    }
    const lockedAt = timestamp(row.locked_at)
    if (lockedAt === null) throw readFailure()
    if (lockedAt + SEND_LEASE_MS <= nowMs) {
      expiredSendingCount += 1
      oldestAffectedCreatedAt = Math.min(oldestAffectedCreatedAt ?? createdAt, createdAt)
      ids.push(row.id)
    }
  }

  return {
    heldCount,
    expiredSendingCount,
    failedCount,
    oldestReconciliationAgeMs:
      oldestAffectedCreatedAt === null ? null : Math.max(0, nowMs - oldestAffectedCreatedAt),
    ids,
  }
}

function issueFingerprint(report: AdminReviewOutboxHealthReport): string {
  return [report.heldCount, report.expiredSendingCount, report.failedCount, ...report.ids].join(":")
}

function hasIssue(report: AdminReviewOutboxHealthReport): boolean {
  return report.heldCount + report.expiredSendingCount + report.failedCount > 0
}

/** Keeps worker monitoring quiet until a health state changes, while retaining read failures and recovery. */
export function createAdminReviewOutboxHealthObserver(
  client: AdminReviewOutboxHealthClient,
  options: ObserverOptions = {},
) {
  let lastIssue: string | null = null
  let previousReadFailed = false

  return {
    async poll(): Promise<AdminReviewOutboxHealthPoll> {
      try {
        const report = await readAdminReviewOutboxHealth(client, {
          now: options.now?.() ?? new Date(),
          pageSize: options.pageSize,
          signal: options.signal?.(),
        })
        const recovered = previousReadFailed
        previousReadFailed = false
        if (!hasIssue(report)) {
          if (lastIssue) {
            lastIssue = null
            return { kind: "resolved", recovered }
          }
          return recovered ? { kind: "recovered" } : { kind: "quiet" }
        }

        const fingerprint = issueFingerprint(report)
        if (fingerprint === lastIssue)
          return recovered ? { kind: "issue", report, recovered } : { kind: "quiet" }
        lastIssue = fingerprint
        return { kind: "issue", report, recovered }
      } catch {
        if (previousReadFailed) return { kind: "quiet" }
        previousReadFailed = true
        return { kind: "read_failure" }
      }
    },
  }
}
