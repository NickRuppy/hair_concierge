import type { BillingInterval } from "./intervals"

export interface StripePricingPlan {
  interval: BillingInterval
  name: string
  /** Anchor / list price — rendered with a strikethrough next to discountedPrice. */
  price: string
  /** Price actually charged (50% off via the Stripe discount coupon). */
  discountedPrice: string
  perMonth: string
  badge?: string
  savings?: string
  ctaLabel: string
}

export const STRIPE_PRICING_PLANS: readonly StripePricingPlan[] = [
  {
    interval: "month",
    name: "Monatlich",
    price: "€14,99",
    discountedPrice: "€7,49",
    perMonth: "/ Monat",
    ctaLabel: "Jetzt starten — €7,49 / Monat",
  },
  {
    interval: "quarter",
    name: "Quartal",
    price: "€34,99",
    discountedPrice: "€17,49",
    perMonth: "~€5,83 / Monat",
    badge: "Beliebteste Wahl",
    // savings reflects per-month savings vs the monthly plan (longer-commitment benefit),
    // NOT the Stripe coupon — the coupon's 50% off is communicated via the strikethrough.
    savings: "22% sparen",
    ctaLabel: "Jetzt starten — €17,49 im Quartal",
  },
  {
    interval: "year",
    name: "Jährlich",
    price: "€99,99",
    discountedPrice: "€49,99",
    perMonth: "~€4,16 / Monat",
    // savings reflects per-month savings vs the monthly plan, not the Stripe coupon.
    savings: "44% sparen",
    ctaLabel: "Jetzt starten — €49,99 / Jahr",
  },
] as const

export const DEFAULT_PRICING_INTERVAL: BillingInterval = "quarter"

export function getStripePricingPlan(interval: BillingInterval): StripePricingPlan {
  const plan = STRIPE_PRICING_PLANS.find((candidate) => candidate.interval === interval)
  if (!plan) {
    throw new Error(`Unknown pricing interval: ${interval}`)
  }
  return plan
}
