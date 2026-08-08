import { trackAppEvent } from "@/lib/analytics/track-app-event"

import type { Stage3AnalyticsPort } from "./stage3-analytics"

export const developmentStage3Analytics: Stage3AnalyticsPort = {
  track(eventName, payload) {
    trackAppEvent(eventName, payload)
  },
}
