import type { BillingInterval } from "../billing/types"
import type { SubscriptionPricingCatalog } from "../billing/pricing-catalog"

export type PayPalIntervalUnit = "DAY" | "WEEK" | "MONTH" | "YEAR"
export type PayPalPlanCatalogFamily = SubscriptionPricingCatalog

export type PayPalPlanCatalogEntry = {
  family: PayPalPlanCatalogFamily
  interval: BillingInterval
}

export type ResolvedPayPalPlanId = {
  pricingCatalog: SubscriptionPricingCatalog
  interval: BillingInterval
}

export type ExpectedPayPalPlanShape = {
  amount: string
  currency: string
  intervalUnit: PayPalIntervalUnit
  intervalCount: number
}

const PLAN_ENV_KEYS: Record<PayPalPlanCatalogFamily, Record<BillingInterval, string>> = {
  standard: {
    month: "PAYPAL_PLAN_ID_MONTHLY",
    quarter: "PAYPAL_PLAN_ID_QUARTERLY",
    year: "PAYPAL_PLAN_ID_ANNUAL",
  },
  personal_plan_launch_v1: {
    month: "PAYPAL_PLAN_ID_PERSONAL_PLAN_LAUNCH_MONTHLY",
    quarter: "PAYPAL_PLAN_ID_PERSONAL_PLAN_LAUNCH_QUARTERLY",
    year: "PAYPAL_PLAN_ID_PERSONAL_PLAN_LAUNCH_ANNUAL",
  },
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

export const EXPECTED_PAYPAL_PLAN_SHAPES_BY_FAMILY: Record<
  PayPalPlanCatalogFamily,
  Record<BillingInterval, ExpectedPayPalPlanShape>
> = {
  standard: EXPECTED_PAYPAL_PLAN_SHAPES,
  personal_plan_launch_v1: {
    month: { amount: "9.99", currency: "EUR", intervalUnit: "MONTH", intervalCount: 1 },
    quarter: { amount: "19.99", currency: "EUR", intervalUnit: "MONTH", intervalCount: 3 },
    year: { amount: "69.99", currency: "EUR", intervalUnit: "YEAR", intervalCount: 1 },
  },
}

export function getPayPalPlanId(
  interval: BillingInterval,
  family: PayPalPlanCatalogFamily = "standard",
): string {
  const envKey = PLAN_ENV_KEYS[family][interval]
  const planId = process.env[envKey]?.trim()
  if (!planId) throw new Error(`${envKey} is not set`)
  return planId
}

export function getPayPalPlanEnvKey(
  interval: BillingInterval,
  family: PayPalPlanCatalogFamily = "standard",
): string {
  return PLAN_ENV_KEYS[family][interval]
}

export function getPayPalIntervalForPlanId(
  planId: string | null | undefined,
): BillingInterval | null {
  const normalizedPlanId = planId?.trim()
  if (!normalizedPlanId) return null

  return getPayPalPlanCatalogForId(normalizedPlanId)?.interval ?? null
}

export function getPayPalPlanCatalogForId(planId: string): PayPalPlanCatalogEntry | null {
  const resolved = resolvePayPalPlanId(planId)
  return resolved ? { family: resolved.pricingCatalog, interval: resolved.interval } : null
}

export function resolvePayPalPlanId(planId: string): ResolvedPayPalPlanId | null {
  const normalizedPlanId = planId.trim()
  if (!normalizedPlanId) return null

  for (const family of Object.keys(PLAN_ENV_KEYS) as PayPalPlanCatalogFamily[]) {
    for (const interval of Object.keys(PLAN_ENV_KEYS[family]) as BillingInterval[]) {
      if (getPayPalPlanIdsForInterval(interval, family).includes(normalizedPlanId)) {
        return { pricingCatalog: family, interval }
      }
    }
  }
  return null
}

function getPayPalPlanIdsForInterval(
  interval: BillingInterval,
  family: PayPalPlanCatalogFamily,
): string[] {
  const currentPlanId = process.env[PLAN_ENV_KEYS[family][interval]]?.trim()
  return [
    ...(currentPlanId ? [currentPlanId] : []),
    ...(family === "standard"
      ? LEGACY_PLAN_ENV_KEYS[interval].flatMap((envKey) => readPlanIdsFromEnv(envKey))
      : []),
  ]
}

function readPlanIdsFromEnv(envKey: string): string[] {
  return (process.env[envKey] ?? "")
    .split(",")
    .map((planId) => planId.trim())
    .filter(Boolean)
}
