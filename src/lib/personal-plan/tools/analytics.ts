import type { AppEventMap } from "@/lib/analytics/events"
import { trackAppEvent } from "@/lib/analytics/track-app-event"
import { loadConsent } from "@/lib/cookie-consent"

/**
 * Hair Tools analytics.
 *
 * Only bounded counts leave the client: never a Tool identity, an ownership
 * claim, a purchase or a free-text answer. Mirrors the consent gate the Stage-3
 * baseline port already uses.
 */
export type ToolAnalyticsEventName =
  | "personal_plan_tools_inventory_entered"
  | "personal_plan_tools_inventory_completed"

export type ToolAnalyticsPort = {
  track<E extends ToolAnalyticsEventName>(eventName: E, payload: AppEventMap[E]): void
}

export const noOpToolAnalytics: ToolAnalyticsPort = { track() {} }

const TOOL_EVENTS = new Set<ToolAnalyticsEventName>([
  "personal_plan_tools_inventory_entered",
  "personal_plan_tools_inventory_completed",
])

export function createConsentAwareToolAnalytics(
  deps: { loadConsent: typeof loadConsent; trackAppEvent: ToolAnalyticsPort["track"] } = {
    loadConsent,
    trackAppEvent,
  },
): ToolAnalyticsPort {
  return {
    track(eventName, payload) {
      if (!TOOL_EVENTS.has(eventName)) return
      if (deps.loadConsent()?.analytics !== true) return
      deps.trackAppEvent(eventName, payload)
    },
  }
}

export const toolAnalytics = createConsentAwareToolAnalytics()
