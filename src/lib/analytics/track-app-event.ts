import { customerIoDestination } from "./destinations/customerio"
import { metaDestination } from "./destinations/meta"
import { postHogDestination } from "./destinations/posthog"
import type { AppEventMap, AppEventName } from "./events"
import { eventRoutes } from "./routes"

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
  const clean = cleanPayload(payload)

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
