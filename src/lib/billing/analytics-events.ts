import type {
  BillingAnalyticsEventName,
  BillingEntitlementStatus,
  BillingInterval,
  BillingProvider,
  BillingSubscriptionRow,
} from "@/lib/billing/types"

export function billingAnalyticsEventKey(input: {
  provider: BillingProvider
  eventName: BillingAnalyticsEventName
  sourceObjectId?: string | null
  sourceEventId?: string | null
  providerSubscriptionId?: string | null
}) {
  const anchor = input.sourceObjectId ?? input.sourceEventId ?? input.providerSubscriptionId
  if (!anchor) {
    throw new Error(
      `Cannot build billing analytics event key for ${input.provider}:${input.eventName}`,
    )
  }
  return `${input.provider}:${input.eventName}:${anchor}`
}

export function amountFromMinorUnits(amount: number | null | undefined) {
  return typeof amount === "number" ? amount / 100 : undefined
}

export function normalizedCurrency(currency: string | null | undefined) {
  const value = currency?.trim().toUpperCase()
  return value || undefined
}

export function billingSubscriptionPayload(
  row: Pick<
    BillingSubscriptionRow,
    | "provider_status"
    | "entitlement_status"
    | "interval"
    | "current_period_end"
    | "cancel_at_period_end"
  >,
  extra: Record<string, unknown> = {},
) {
  const paidThrough = row.current_period_end
    ? Date.parse(row.current_period_end) > Date.now()
    : false
  const hasPaidAccess =
    hasPaidAccessStatus(row.entitlement_status) || (row.cancel_at_period_end && paidThrough)

  return {
    subscription_status: row.entitlement_status,
    provider_status: row.provider_status,
    has_paid_access: hasPaidAccess,
    interval: row.interval,
    current_period_end: row.current_period_end,
    cancel_at_period_end: row.cancel_at_period_end,
    ...extra,
  }
}

export function hasPaidAccessStatus(status: BillingEntitlementStatus | string | null | undefined) {
  return status === "active" || status === "past_due"
}

export function planIdForInterval(interval: BillingInterval | string | null | undefined) {
  return interval ? `premium_${interval}` : undefined
}
