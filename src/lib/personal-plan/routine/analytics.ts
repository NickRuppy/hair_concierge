import type { AppEventMap } from "@/lib/analytics/events"
import { trackAppEvent } from "@/lib/analytics/track-app-event"

export type RoutineAnalyticsEventName =
  | "personal_plan_stage4_routine_viewed"
  | "personal_plan_stage4_proposal_interacted"
  | "personal_plan_stage4_editor_interacted"
  | "personal_plan_stage4_item_interacted"
  | "personal_plan_stage4_outcome"

/** Client-facing, structural-only event port for the Stage 4 Routine journey. */
export type RoutineAnalyticsPort = {
  track<E extends RoutineAnalyticsEventName>(eventName: E, payload: AppEventMap[E]): void
}

export const noOpRoutineAnalytics: RoutineAnalyticsPort = {
  track() {},
}

export const routineAnalytics: RoutineAnalyticsPort = {
  track(eventName, payload) {
    trackAppEvent(eventName, payload)
  },
}
