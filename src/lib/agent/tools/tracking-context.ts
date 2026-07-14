import { daysSinceLastWash } from "@/lib/tracking/aggregation"
import type { TrackerLogDay } from "@/lib/tracking/types"

const RAW_DIARY_WINDOW_DAYS = 14
const DAY_MS = 24 * 60 * 60 * 1000

function shiftDate(dateIso: string, days: number): string {
  return new Date(Date.parse(`${dateIso}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10)
}

export interface TrackingToolContext {
  mode: "tracking_observation_context"
  window_days: number
  logged_day_count: number
  days_since_last_wash: number | null
  logged_days: Array<{
    date: string
    day_type: string
    custom_activity_name: string | null
    products: Array<{ category: string; product_name: string | null }>
  }>
  notes: string
}

export function buildTrackingToolContext(params: {
  days: TrackerLogDay[]
  today: string
}): TrackingToolContext | null {
  const since = shiftDate(params.today, -(RAW_DIARY_WINDOW_DAYS - 1))
  const recentDays = params.days.filter(
    (day) => day.loggedOn >= since && day.loggedOn <= params.today,
  )
  if (recentDays.length === 0) return null
  const loggedDays = [...recentDays]
    .sort((left, right) => left.loggedOn.localeCompare(right.loggedOn))
    .map((day) => ({
      date: day.loggedOn,
      day_type: day.dayType,
      custom_activity_name: day.dayType === "custom" ? (day.customActivityName ?? null) : null,
      products: day.products.map((product) => ({
        category: product.category,
        product_name: product.productName,
      })),
    }))

  return {
    mode: "tracking_observation_context",
    window_days: RAW_DIARY_WINDOW_DAYS,
    logged_day_count: new Set(recentDays.map((day) => day.loggedOn)).size,
    days_since_last_wash: daysSinceLastWash(params.days, params.today),
    logged_days: loggedDays,
    notes:
      "Beobachtete Nutzung aus dem Nutzer-Tagebuch. Fehlende Tage sind unbekannt, nie 'nicht benutzt'. 'none' = bewusst nichts gemacht. 'custom' ist eine vom Nutzer benannte, nicht standardisierte Aktivität und zählt nicht als Pflege- oder Kadenzsignal.",
  }
}
