import { createBoundedFifo } from "@/lib/analytics/runtime/bounded-fifo"
import {
  buildSafeAnalyticsPageContext,
  type SafeAnalyticsPageContext,
} from "@/lib/analytics/page-url"

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
  identify: (
    userId: string,
    traits?: Record<string, CustomerIoValue>,
    options?: CustomerIoCallOptions,
  ) => unknown
  page: (
    category: string | undefined,
    name: string | undefined,
    properties?: Record<string, CustomerIoValue>,
    options?: CustomerIoCallOptions,
  ) => unknown
  reset: () => unknown
  track: (
    eventName: string,
    properties?: Record<string, CustomerIoValue>,
    options?: CustomerIoCallOptions,
  ) => unknown
}

type CustomerIoCallOptions = {
  context: { page: SafeAnalyticsPageContext }
}

function readSafeBrowserPageContext(): SafeAnalyticsPageContext | undefined {
  if (typeof window === "undefined" || typeof document === "undefined") return undefined

  return buildSafeAnalyticsPageContext({
    href: window.location.href,
    pathname: window.location.pathname,
    referrer: document.referrer,
    search: window.location.search,
    title: document.title,
  })
}

export function cleanCustomerIoProperties(properties?: CustomerIoProperties) {
  if (!properties) return {}

  return Object.fromEntries(
    Object.entries(properties).filter(([, value]) => value !== undefined),
  ) as Record<string, CustomerIoValue>
}

type CustomerIoOperation =
  | {
      type: "identify"
      pageContext?: SafeAnalyticsPageContext
      userId: string
      traits: Record<string, CustomerIoValue>
    }
  | {
      type: "page"
      pageContext?: SafeAnalyticsPageContext
      path: string
      properties: Record<string, CustomerIoValue>
    }
  | { type: "reset" }
  | {
      type: "track"
      eventName: string
      pageContext?: SafeAnalyticsPageContext
      properties: Record<string, CustomerIoValue>
    }

export function createCustomerIoTracker({
  getPageContext = readSafeBrowserPageContext,
  queueLimit = 100,
  warn = (message: string, error?: unknown) => {
    if (process.env.NODE_ENV !== "production") console.warn(message, error)
  },
}: {
  getPageContext?: () => SafeAnalyticsPageContext | undefined
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
    const options =
      operation.type === "reset"
        ? undefined
        : operation.pageContext
          ? { context: { page: operation.pageContext } }
          : undefined
    switch (operation.type) {
      case "identify":
        if (options) client.identify(operation.userId, operation.traits, options)
        else client.identify(operation.userId, operation.traits)
        break
      case "page":
        // The SDK treats an explicit null category as the properties object and shifts properties into options.
        if (operation.pageContext && options) {
          client.page(
            undefined,
            operation.path,
            { ...operation.properties, ...operation.pageContext },
            options,
          )
        } else {
          client.page(undefined, operation.path, operation.properties)
        }
        break
      case "reset":
        client.reset()
        break
      case "track":
        if (options) client.track(operation.eventName, operation.properties, options)
        else client.track(operation.eventName, operation.properties)
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
        pageContext: getPageContext(),
        userId,
        traits: cleanCustomerIoProperties(traits),
      })
    },
    page(path: string, properties?: CustomerIoProperties) {
      return enqueueOrDispatch({
        type: "page",
        pageContext: getPageContext(),
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
        pageContext: getPageContext(),
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
