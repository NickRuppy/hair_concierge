import { customerIoDestination } from "./destinations/customerio"
import { metaDestination } from "./destinations/meta"
import { postHogDestination } from "./destinations/posthog"
import type { AppEventMap, AppEventName } from "./events"
import { eventRoutes } from "./routes"
import { recordBrowserFunnelMilestone } from "@/lib/funnel/client"

type DestinationName = "customerio" | "meta" | "posthog"

function cleanPayload<E extends AppEventName>(payload: AppEventMap[E]) {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined),
  ) as AppEventMap[E]
}

function dispatchSafely(destination: DestinationName, dispatch: () => unknown) {
  try {
    return Boolean(dispatch())
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[analytics] ${destination} failed`, error)
    }
    return false
  }
}

export function trackAppEvent<E extends AppEventName>(eventName: E, payload: AppEventMap[E]): void {
  const route = eventRoutes[eventName]
  const milestone = toFunnelMilestone(eventName)
  const suppliedEventId = (payload as { funnelEventId?: string | null }).funnelEventId ?? undefined
  const envelope = milestone
    ? recordBrowserFunnelMilestone(milestone, undefined, suppliedEventId, !suppliedEventId)
    : null
  const clean = cleanPayload({ ...envelope, ...payload } as AppEventMap[E])

  if (route.posthog) {
    dispatchSafely("posthog", () => postHogDestination.track(eventName, clean as AppEventMap[E]))
  }

  if (route.customerio) {
    dispatchSafely("customerio", () =>
      customerIoDestination.track(eventName, clean as AppEventMap[E]),
    )
  }

  if (route.meta) {
    dispatchSafely("meta", () => metaDestination.track(eventName, clean as AppEventMap[E]))
  }
}

function toFunnelMilestone(eventName: AppEventName) {
  switch (eventName) {
    case "quiz_started":
    case "quiz_completed":
    case "offer_viewed":
    case "checkout_started":
      return eventName
    case "quiz_lead_captured":
      return "lead_captured" as const
    default:
      return null
  }
}
