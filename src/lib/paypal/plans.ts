import type { BillingInterval } from "../billing/types"

export type PayPalIntervalUnit = "DAY" | "WEEK" | "MONTH" | "YEAR"

export type ExpectedPayPalPlanShape = {
  amount: string
  currency: string
  intervalUnit: PayPalIntervalUnit
  intervalCount: number
}

const PLAN_ENV_KEYS: Record<BillingInterval, string> = {
  month: "PAYPAL_PLAN_ID_MONTHLY",
  quarter: "PAYPAL_PLAN_ID_QUARTERLY",
  year: "PAYPAL_PLAN_ID_ANNUAL",
}

const LEGACY_PLAN_ENV_KEYS: Record<BillingInterval, readonly string[]> = {
  month: ["PAYPAL_LEGACY_PLAN_ID_MONTHLY", "PAYPAL_LEGACY_PLAN_IDS_MONTHLY"],
  quarter: ["PAYPAL_LEGACY_PLAN_ID_QUARTERLY", "PAYPAL_LEGACY_PLAN_IDS_QUARTERLY"],
  year: ["PAYPAL_LEGACY_PLAN_ID_ANNUAL", "PAYPAL_LEGACY_PLAN_IDS_ANNUAL"],
}

export const EXPECTED_PAYPAL_PLAN_SHAPES: Record<BillingInterval, ExpectedPayPalPlanShape> = {
  month: { amount: "14.99", currency: "EUR", intervalUnit: "MONTH", intervalCount: 1 },
  quarter: { amount: "34.99", currency: "EUR", intervalUnit: "MONTH", intervalCount: 3 },
  year: { amount: "99.99", currency: "EUR", intervalUnit: "YEAR", intervalCount: 1 },
}

export function getPayPalPlanId(interval: BillingInterval): string {
  const envKey = PLAN_ENV_KEYS[interval]
  const planId = process.env[envKey]?.trim()
  if (!planId) throw new Error(`${envKey} is not set`)
  return planId
}

export function getPayPalPlanEnvKey(interval: BillingInterval): string {
  return PLAN_ENV_KEYS[interval]
}

export function getPayPalIntervalForPlanId(
  planId: string | null | undefined,
): BillingInterval | null {
  const normalizedPlanId = planId?.trim()
  if (!normalizedPlanId) return null

  for (const interval of Object.keys(PLAN_ENV_KEYS) as BillingInterval[]) {
    if (getPayPalPlanIdsForInterval(interval).includes(normalizedPlanId)) {
      return interval
    }
  }

  return null
}

function getPayPalPlanIdsForInterval(interval: BillingInterval): string[] {
  const currentPlanId = process.env[PLAN_ENV_KEYS[interval]]?.trim()
  return [
    ...(currentPlanId ? [currentPlanId] : []),
    ...LEGACY_PLAN_ENV_KEYS[interval].flatMap((envKey) => readPlanIdsFromEnv(envKey)),
  ]
}

function readPlanIdsFromEnv(envKey: string): string[] {
  return (process.env[envKey] ?? "")
    .split(",")
    .map((planId) => planId.trim())
    .filter(Boolean)
}
