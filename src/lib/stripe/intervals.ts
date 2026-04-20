export type BillingInterval = "month" | "quarter" | "year"

export interface PriceRecurrence {
  interval: string
  interval_count: number
}

export function intervalFromPrice(p: PriceRecurrence): BillingInterval {
  if (p.interval === "month" && p.interval_count === 1) return "month"
  if (p.interval === "month" && p.interval_count === 3) return "quarter"
  if (p.interval === "year" && p.interval_count === 1) return "year"
  throw new Error(`Unsupported price recurrence: ${p.interval} x${p.interval_count}`)
}
