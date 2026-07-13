import { createBoundedFifo } from "@/lib/analytics/runtime/bounded-fifo"

export const CUSTOMERIO_EU_CDN_URL = "https://cdp-eu.customer.io"

type CustomerIoValue = string | number | boolean | null | string[] | number[] | boolean[]
export type CustomerIoProperties = Record<string, CustomerIoValue | undefined>

export type CustomerIoEventName =
  | "checkout_started"
  | "chat_product_recommendation_shown"
  | "first_chat_message"
  | "onboarding_completed"
  | "pricing_viewed"
  | "purchase_completed"
  | "quiz_completed"
  | "quiz_goals_selected"
  | "quiz_lead_captured"
  | "quiz_started"
  | "quiz_step_viewed"
  | "subscription_started"

export type CustomerIoBrowserClient = {
  identify: (userId: string, traits?: Record<string, CustomerIoValue>) => unknown
  page: (
    category: string | null,
    name: string | null,
    properties?: Record<string, CustomerIoValue>,
  ) => unknown
  reset: () => unknown
  track: (eventName: string, properties?: Record<string, CustomerIoValue>) => unknown
}

export function cleanCustomerIoProperties(properties?: CustomerIoProperties) {
  if (!properties) return {}

  return Object.fromEntries(
    Object.entries(properties).filter(([, value]) => value !== undefined),
  ) as Record<string, CustomerIoValue>
}

type CustomerIoOperation =
  | { type: "identify"; userId: string; traits: Record<string, CustomerIoValue> }
  | { type: "page"; path: string; properties: Record<string, CustomerIoValue> }
  | { type: "reset" }
  | { type: "track"; eventName: string; properties: Record<string, CustomerIoValue> }

export function createCustomerIoTracker({
  queueLimit = 100,
  warn = (message: string, error?: unknown) => {
    if (process.env.NODE_ENV !== "production") console.warn(message, error)
  },
}: {
  queueLimit?: number
  warn?: (message: string, error?: unknown) => void
} = {}) {
  const queue = createBoundedFifo<CustomerIoOperation>({
    label: "Customer.io",
    limit: queueLimit,
    warn,
  })
  let client: CustomerIoBrowserClient | null = null
  let disabled = false

  const dispatch = (operation: CustomerIoOperation) => {
    if (!client) return false
    switch (operation.type) {
      case "identify":
        client.identify(operation.userId, operation.traits)
        break
      case "page":
        client.page(null, operation.path, operation.properties)
        break
      case "reset":
        client.reset()
        break
      case "track":
        client.track(operation.eventName, operation.properties)
        break
    }
    return true
  }

  const dispatchSafely = (operation: CustomerIoOperation) => {
    try {
      return dispatch(operation)
    } catch (error) {
      warn("[analytics] Customer.io dispatch failed", error)
      return false
    }
  }

  const enqueueOrDispatch = (operation: CustomerIoOperation) => {
    if (disabled) return false
    if (client) return dispatchSafely(operation)
    queue.push(operation)
    return true
  }

  return {
    clear() {
      client = null
      disabled = false
      queue.clear()
    },
    disable() {
      client = null
      disabled = true
      queue.clear()
    },
    identify(userId: string, traits?: CustomerIoProperties) {
      return enqueueOrDispatch({
        type: "identify",
        userId,
        traits: cleanCustomerIoProperties(traits),
      })
    },
    page(path: string, properties?: CustomerIoProperties) {
      return enqueueOrDispatch({
        type: "page",
        path,
        properties: cleanCustomerIoProperties(properties),
      })
    },
    reset() {
      return enqueueOrDispatch({ type: "reset" })
    },
    setClient(nextClient: CustomerIoBrowserClient) {
      client = nextClient
      disabled = false
      for (const operation of queue.drain()) dispatchSafely(operation)
    },
    track(eventName: string, properties?: CustomerIoProperties) {
      return enqueueOrDispatch({
        type: "track",
        eventName,
        properties: cleanCustomerIoProperties(properties),
      })
    },
  }
}

const browserTracker = createCustomerIoTracker()

export function setCustomerIoBrowserClient(client: CustomerIoBrowserClient) {
  browserTracker.setClient(client)
}

export function clearCustomerIoBrowserClient() {
  browserTracker.clear()
}

export function disableCustomerIoBrowserClient() {
  browserTracker.disable()
}

export function resetCustomerIoBrowserClient() {
  return browserTracker.reset()
}

export function trackCustomerIoPage(path: string, properties?: CustomerIoProperties) {
  return browserTracker.page(path, properties)
}

export function identifyCustomerIoUser(userId: string, traits?: CustomerIoProperties) {
  return browserTracker.identify(userId, traits)
}

export function trackCustomerIoEvent(
  eventName: CustomerIoEventName,
  properties?: CustomerIoProperties,
) {
  return browserTracker.track(eventName, properties)
}
