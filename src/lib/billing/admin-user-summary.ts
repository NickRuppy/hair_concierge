import { hasCurrentBillingAccess } from "./subscriptions"
import { resolveBillingTrialAccess } from "./trial-access-projection"
import type { BillingSubscriptionRow } from "./types"

export type AdminUserBillingStatus =
  | "trial_pending"
  | "trial"
  | "trial_canceled"
  | "active"
  | "canceled_at_period_end"
  | "past_due"
  | "expired"
  | "none"

export type AdminUserBillingSummary = {
  status: AdminUserBillingStatus
  /** Set only while the contract is still in its trial phase. */
  trial_ends_at: string | null
  /** Paid-through boundary for "gekündigt zum" / "abgelaufen am" rendering. */
  period_end: string | null
  provider_subscriber_email: string | null
}

const NO_BILLING: AdminUserBillingSummary = {
  status: "none",
  trial_ends_at: null,
  period_end: null,
  provider_subscriber_email: null,
}

/**
 * Picks the one subscription row worth showing per user: current access wins
 * (mirroring `hasCurrentBillingAccess`, including its expiry grace), then open
 * entitlements over canceled ones, then the later period end, then recency.
 * This keeps a lingering canceled row from masking an active subscription.
 */
export function pickAdminUserBillingRow(
  rows: BillingSubscriptionRow[],
  now: Date = new Date(),
): BillingSubscriptionRow | null {
  let best: BillingSubscriptionRow | null = null
  for (const row of rows) {
    if (best === null || compareBillingRelevance(row, best, now) > 0) {
      best = row
    }
  }
  return best
}

const ENTITLEMENT_RANK: Record<string, number> = {
  active: 3,
  past_due: 2,
  canceled: 1,
}

function compareBillingRelevance(
  left: BillingSubscriptionRow,
  right: BillingSubscriptionRow,
  now: Date,
): number {
  const accessDelta =
    Number(hasCurrentBillingAccess(left, now)) - Number(hasCurrentBillingAccess(right, now))
  if (accessDelta !== 0) return accessDelta

  const rankDelta =
    (ENTITLEMENT_RANK[left.entitlement_status] ?? 0) -
    (ENTITLEMENT_RANK[right.entitlement_status] ?? 0)
  if (rankDelta !== 0) return rankDelta

  const periodDelta = parseTime(left.current_period_end) - parseTime(right.current_period_end)
  if (periodDelta !== 0) return periodDelta

  return left.updated_at.localeCompare(right.updated_at)
}

function parseTime(value: string | null | undefined): number {
  if (!value) return Number.NEGATIVE_INFINITY
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? timestamp : Number.NEGATIVE_INFINITY
}

function readTrialFacts(row: BillingSubscriptionRow): {
  cancelAtPeriodEnd: boolean
  originalTrialEndAt: string | null
  paidThroughAt: string | null
} {
  const facts = row.trial_access_facts
  if (typeof facts !== "object" || facts === null || Array.isArray(facts)) {
    return { cancelAtPeriodEnd: false, originalTrialEndAt: null, paidThroughAt: null }
  }
  const record = facts as Record<string, unknown>
  return {
    cancelAtPeriodEnd: record.cancelAtPeriodEnd === true,
    originalTrialEndAt:
      typeof record.originalTrialEndAt === "string" ? record.originalTrialEndAt : null,
    paidThroughAt: typeof record.paidThroughAt === "string" ? record.paidThroughAt : null,
  }
}

function isFutureIso(value: string | null, now: Date): boolean {
  if (!value) return false
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) && timestamp > now.getTime()
}

export function summarizeAdminUserBilling(
  row: BillingSubscriptionRow | null | undefined,
  now: Date = new Date(),
): AdminUserBillingSummary {
  if (!row) return NO_BILLING

  const base = {
    trial_ends_at: null as string | null,
    period_end: row.current_period_end,
    provider_subscriber_email: row.provider_subscriber_email,
  }

  const trialAccess = resolveBillingTrialAccess(row, now)
  if (trialAccess !== null) {
    const facts = readTrialFacts(row)
    const canceled = facts.cancelAtPeriodEnd || row.cancel_at_period_end
    switch (trialAccess.phase) {
      case "awaiting_authorization":
        return { ...base, status: "trial_pending", trial_ends_at: facts.originalTrialEndAt }
      case "trial":
        return {
          ...base,
          status: canceled ? "trial_canceled" : "trial",
          trial_ends_at: facts.originalTrialEndAt,
        }
      case "paid":
        return {
          ...base,
          status: canceled ? "canceled_at_period_end" : "active",
          period_end: facts.paidThroughAt ?? row.current_period_end,
        }
      case "renewal_grace":
        return { ...base, status: "past_due", period_end: facts.paidThroughAt }
      case "locked":
        return {
          ...base,
          status: "expired",
          period_end: facts.paidThroughAt ?? facts.originalTrialEndAt ?? row.current_period_end,
        }
    }
  }

  // Legacy (non-trial) rows: defer access questions to the canonical policy,
  // including its post-period-end expiry grace, so the badge never contradicts
  // whether the user can actually use the app.
  if (row.entitlement_status === "canceled") {
    return {
      ...base,
      status:
        row.cancel_at_period_end && isFutureIso(row.current_period_end, now)
          ? "canceled_at_period_end"
          : "expired",
    }
  }

  const hasAccess = hasCurrentBillingAccess(row, now)

  if (row.entitlement_status === "past_due") {
    return { ...base, status: hasAccess ? "past_due" : "expired" }
  }

  if (row.entitlement_status === "active") {
    if (row.cancel_at_period_end && isFutureIso(row.current_period_end, now)) {
      return { ...base, status: "canceled_at_period_end" }
    }
    return { ...base, status: hasAccess ? "active" : "expired" }
  }

  return { ...base, status: "expired" }
}
