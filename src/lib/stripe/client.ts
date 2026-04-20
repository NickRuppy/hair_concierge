import Stripe from "stripe"
import type { BillingInterval } from "./intervals"

let _stripe: Stripe | null = null

export function getStripe(): Stripe {
  if (_stripe) return _stripe
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set")
  _stripe = new Stripe(key, { apiVersion: "2025-08-27.basil" })
  return _stripe
}

export const PRICE_IDS: Record<BillingInterval, string> = {
  month: process.env.STRIPE_PRICE_ID_MONTHLY ?? "",
  quarter: process.env.STRIPE_PRICE_ID_QUARTERLY ?? "",
  year: process.env.STRIPE_PRICE_ID_ANNUAL ?? "",
}

export function priceIdToInterval(priceId: string): BillingInterval | null {
  const entry = Object.entries(PRICE_IDS).find(([, v]) => v === priceId)
  return entry ? (entry[0] as BillingInterval) : null
}
