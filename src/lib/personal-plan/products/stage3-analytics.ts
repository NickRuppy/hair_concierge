import type { AppEventMap } from "@/lib/analytics/events"
import { trackAppEvent } from "@/lib/analytics/track-app-event"
import { loadConsent } from "@/lib/cookie-consent"

export type Stage3AnalyticsEventName =
  | "personal_plan_stage3_journey_started"
  | "personal_plan_stage3_routine_opened"
  | "personal_plan_stage3_flow_viewed"
  | "personal_plan_stage3_search_interacted"
  | "personal_plan_stage3_fallback_opened"
  | "personal_plan_stage3_decision_selected"
  | "personal_plan_stage3_save_outcome"
  | "personal_plan_stage3_recovery_outcome"
  | "personal_plan_stage3_handoff"

export type Stage3AnalyticsPort = {
  track<E extends Stage3AnalyticsEventName>(eventName: E, payload: AppEventMap[E]): void
}

export const noOpStage3Analytics: Stage3AnalyticsPort = {
  track() {},
}

type Stage3BaselineAnalyticsEventName =
  | "personal_plan_stage3_journey_started"
  | "personal_plan_stage3_routine_opened"

const stage3BaselineEvents = new Set<Stage3BaselineAnalyticsEventName>([
  "personal_plan_stage3_journey_started",
  "personal_plan_stage3_routine_opened",
])

type ConsentAwareStage3BaselineAnalyticsDeps = {
  loadConsent: typeof loadConsent
  trackAppEvent: Stage3AnalyticsPort["track"]
}

/** Production Stage 3 analytics only permits the consented, payload-free baseline. */
export function createConsentAwareStage3BaselineAnalytics(
  deps: ConsentAwareStage3BaselineAnalyticsDeps = { loadConsent, trackAppEvent },
): Stage3AnalyticsPort {
  return {
    track(eventName) {
      if (!stage3BaselineEvents.has(eventName as Stage3BaselineAnalyticsEventName)) return
      if (deps.loadConsent()?.analytics !== true) return
      if (eventName === "personal_plan_stage3_journey_started") {
        deps.trackAppEvent("personal_plan_stage3_journey_started", {})
        return
      }
      if (eventName === "personal_plan_stage3_routine_opened") {
        deps.trackAppEvent("personal_plan_stage3_routine_opened", {})
      }
    },
  }
}

export const stage3BaselineAnalytics = createConsentAwareStage3BaselineAnalytics()
