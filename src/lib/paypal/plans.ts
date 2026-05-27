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

export const EXPECTED_PAYPAL_PLAN_SHAPES: Record<BillingInterval, ExpectedPayPalPlanShape> = {
  month: { amount: "7.49", currency: "EUR", intervalUnit: "MONTH", intervalCount: 1 },
  quarter: { amount: "17.49", currency: "EUR", intervalUnit: "MONTH", intervalCount: 3 },
  year: { amount: "49.99", currency: "EUR", intervalUnit: "YEAR", intervalCount: 1 },
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
