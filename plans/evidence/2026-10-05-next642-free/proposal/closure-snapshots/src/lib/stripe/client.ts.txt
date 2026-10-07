import Stripe from "stripe"
import type { SubscriptionPricingCatalog } from "../billing/pricing-catalog"
import type { BillingInterval } from "./intervals"

export type StripePriceCatalogFamily = SubscriptionPricingCatalog

export type StripePriceCatalogEntry = {
  family: StripePriceCatalogFamily
  interval: BillingInterval
}

export type ResolvedStripePriceId = {
  pricingCatalog: SubscriptionPricingCatalog
  interval: BillingInterval
}

let _stripe: Stripe | null = null

export function getStripe(): Stripe {
  if (_stripe) return _stripe
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set")
  _stripe = new Stripe(key, { apiVersion: "2026-04-22.dahlia" })
  return _stripe
}

export const PRICE_IDS: Record<BillingInterval, string> = {
  month: process.env.STRIPE_PRICE_ID_MONTHLY ?? "",
  quarter: process.env.STRIPE_PRICE_ID_QUARTERLY ?? "",
  year: process.env.STRIPE_PRICE_ID_ANNUAL ?? "",
}

const PRICE_ENV_KEYS: Record<StripePriceCatalogFamily, Record<BillingInterval, string>> = {
  standard: {
    month: "STRIPE_PRICE_ID_MONTHLY",
    quarter: "STRIPE_PRICE_ID_QUARTERLY",
    year: "STRIPE_PRICE_ID_ANNUAL",
  },
  personal_plan_launch_v1: {
    month: "STRIPE_PRICE_ID_PERSONAL_PLAN_LAUNCH_MONTHLY",
    quarter: "STRIPE_PRICE_ID_PERSONAL_PLAN_LAUNCH_QUARTERLY",
    year: "STRIPE_PRICE_ID_PERSONAL_PLAN_LAUNCH_ANNUAL",
  },
}

const LEGACY_PRICE_ENV_KEYS: Record<BillingInterval, readonly string[]> = {
  month: ["STRIPE_LEGACY_PRICE_ID_MONTHLY", "STRIPE_LEGACY_PRICE_IDS_MONTHLY"],
  quarter: ["STRIPE_LEGACY_PRICE_ID_QUARTERLY", "STRIPE_LEGACY_PRICE_IDS_QUARTERLY"],
  year: ["STRIPE_LEGACY_PRICE_ID_ANNUAL", "STRIPE_LEGACY_PRICE_IDS_ANNUAL"],
}

export function getStripePriceId(
  interval: BillingInterval,
  family: StripePriceCatalogFamily = "standard",
): string {
  return process.env[PRICE_ENV_KEYS[family][interval]]?.trim() ?? ""
}

export function getStripePriceCatalogForId(priceId: string): StripePriceCatalogEntry | null {
  const resolved = resolveStripePriceId(priceId)
  return resolved ? { family: resolved.pricingCatalog, interval: resolved.interval } : null
}

export function resolveStripePriceId(priceId: string): ResolvedStripePriceId | null {
  const normalizedPriceId = priceId.trim()
  if (!normalizedPriceId) return null

  for (const family of Object.keys(PRICE_ENV_KEYS) as StripePriceCatalogFamily[]) {
    for (const interval of Object.keys(PRICE_ENV_KEYS[family]) as BillingInterval[]) {
      if (getStripePriceIdsForInterval(interval, family).includes(normalizedPriceId)) {
        return { pricingCatalog: family, interval }
      }
    }
  }
  return null
}

function getStripePriceIdsForInterval(
  interval: BillingInterval,
  family: StripePriceCatalogFamily,
): string[] {
  const currentPriceId = getStripePriceId(interval, family)
  return [
    ...(currentPriceId ? [currentPriceId] : []),
    ...(family === "standard"
      ? LEGACY_PRICE_ENV_KEYS[interval].flatMap((envKey) => readPriceIdsFromEnv(envKey))
      : []),
  ]
}

function readPriceIdsFromEnv(envKey: string): string[] {
  return (process.env[envKey] ?? "")
    .split(",")
    .map((priceId) => priceId.trim())
    .filter(Boolean)
}

export function priceIdToInterval(priceId: string): BillingInterval | null {
  return getStripePriceCatalogForId(priceId)?.interval ?? null
}
