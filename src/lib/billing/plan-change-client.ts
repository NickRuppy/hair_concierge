import type { BillingInterval, BillingPlanChangeStatus } from "./types"

const OPEN_PLAN_CHANGE_STATUSES: BillingPlanChangeStatus[] = [
  "pending_provider",
  "pending_approval",
  "scheduled",
  "reconciling",
]

export function shouldRetainPlanChangeOperationId(status: string | undefined) {
  return OPEN_PLAN_CHANGE_STATUSES.includes(status as BillingPlanChangeStatus)
}

export function intervalLabel(interval: BillingInterval) {
  if (interval === "month") return "Monatlich"
  if (interval === "quarter") return "Quartalsweise"
  return "Jährlich"
}
