"use client"

import { SpeedInsights } from "@vercel/speed-insights/next"
import { sanitizeSpeedInsightsEvent } from "@/lib/observability/speed-insights"

export function PrivacySafeSpeedInsights() {
  return <SpeedInsights beforeSend={sanitizeSpeedInsightsEvent} />
}
