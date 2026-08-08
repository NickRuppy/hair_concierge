import type { AppEventMap } from "@/lib/analytics/events"

export type Stage3AnalyticsEventName =
  | "personal_plan_stage3_flow_viewed"
  | "personal_plan_stage3_search_interacted"
  | "personal_plan_stage3_fallback_opened"
  | "personal_plan_stage3_decision_selected"
  | "personal_plan_stage3_save_outcome"
  | "personal_plan_stage3_handoff"

export type Stage3AnalyticsPort = {
  track<E extends Stage3AnalyticsEventName>(eventName: E, payload: AppEventMap[E]): void
}

export const noOpStage3Analytics: Stage3AnalyticsPort = {
  track() {},
}
