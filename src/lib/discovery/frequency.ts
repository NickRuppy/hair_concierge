import {
  PRODUCT_FREQUENCIES,
  PRODUCT_FREQUENCY_METADATA,
  type ProductFrequency,
} from "@/lib/vocabulary/frequencies"

/**
 * Batch 7 (plan `plans/discovery-refinement-b7/plan.md` Rev. 3, §2.1 item 3, §2.2): how
 * often she uses a product — one uniform list for every product (ruling round 4), 1:1 with
 * `ProductFrequency` plus „Weiß ich nicht". Pure and client-safe: the participant sheet,
 * the cockpit and the routine composer share it.
 *
 * `discovery_intake_items.frequency`: NULL = not asked (legacy rows), `unknown` = „Weiß ich
 * nicht". The migration's CHECK lists exactly `DISCOVERY_ITEM_FREQUENCIES`.
 */

export const DISCOVERY_UNKNOWN_FREQUENCY = "unknown" as const

export const DISCOVERY_ITEM_FREQUENCIES = [
  ...PRODUCT_FREQUENCIES,
  DISCOVERY_UNKNOWN_FREQUENCY,
] as const

export type DiscoveryItemFrequency = (typeof DISCOVERY_ITEM_FREQUENCIES)[number]

export function isDiscoveryItemFrequency(value: unknown): value is DiscoveryItemFrequency {
  return (
    typeof value === "string" && (DISCOVERY_ITEM_FREQUENCIES as readonly string[]).includes(value)
  )
}

export function isKnownProductFrequency(value: unknown): value is ProductFrequency {
  return typeof value === "string" && (PRODUCT_FREQUENCIES as readonly string[]).includes(value)
}

/** The participant's own labels (prototype round 6), most frequent first. */
export const DISCOVERY_FREQUENCY_LABELS: Record<DiscoveryItemFrequency, string> = {
  daily_1x: "Täglich",
  weekly_5_6x: "5–6× pro Woche",
  weekly_3_4x: "3–4× pro Woche",
  weekly_2x: "2× pro Woche",
  weekly_1x: "1× pro Woche",
  biweekly_1x: "Alle 2 Wochen",
  monthly_1x: "1× im Monat",
  less_than_monthly: "Seltener",
  unknown: "Weiß ich nicht",
}

/**
 * The product step's options, in display order: most frequent first, „Weiß ich nicht"
 * last. The heat-tool step uses `DISCOVERY_HEAT_FREQUENCY_OPTIONS` (no „Weiß ich nicht" —
 * a heat event needs a concrete frequency, as in production).
 */
export const DISCOVERY_FREQUENCY_OPTIONS: readonly DiscoveryItemFrequency[] = [
  "daily_1x",
  "weekly_5_6x",
  "weekly_3_4x",
  "weekly_2x",
  "weekly_1x",
  "biweekly_1x",
  "monthly_1x",
  "less_than_monthly",
  "unknown",
]

export const DISCOVERY_HEAT_FREQUENCY_OPTIONS: readonly ProductFrequency[] =
  DISCOVERY_FREQUENCY_OPTIONS.filter(isKnownProductFrequency)

/**
 * The most frequent KNOWN frequency among `values` — `null` when none is known (not asked,
 * „Weiß ich nicht"). The Waschtag cadence (most frequent shampoo) and the routine context's
 * shampoo frequency both read it.
 */
export function mostFrequentDiscoveryFrequency(
  values: ReadonlyArray<string | null | undefined>,
): ProductFrequency | null {
  let best: ProductFrequency | null = null
  for (const value of values) {
    if (!isKnownProductFrequency(value)) continue
    if (
      best === null ||
      PRODUCT_FREQUENCY_METADATA[value].sortOrder > PRODUCT_FREQUENCY_METADATA[best].sortOrder
    ) {
      best = value
    }
  }
  return best
}
