import { resolveBillingTrialAccess } from "./trial-access-projection"
import type { BillingSubscriptionRow } from "./types"

export type AdminUserBillingStatus =
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

  if (row.entitlement_status === "past_due") {
    return { ...base, status: "past_due" }
  }

  if (row.entitlement_status === "canceled") {
    return {
      ...base,
      status:
        row.cancel_at_period_end && isFutureIso(row.current_period_end, now)
          ? "canceled_at_period_end"
          : "expired",
    }
  }

  if (row.entitlement_status === "active") {
    if (row.cancel_at_period_end && isFutureIso(row.current_period_end, now)) {
      return { ...base, status: "canceled_at_period_end" }
    }
    if (row.current_period_end !== null && !isFutureIso(row.current_period_end, now)) {
      return { ...base, status: "expired" }
    }
    return { ...base, status: "active" }
  }

  return { ...base, status: "expired" }
}
