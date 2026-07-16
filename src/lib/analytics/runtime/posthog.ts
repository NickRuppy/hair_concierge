import { createBoundedFifo } from "./bounded-fifo"
import type { CurrentFunnelContext } from "@/lib/funnel/client"
import { sanitizeAnalyticsUrl } from "@/lib/analytics/page-url"

type PostHogProperties = Record<string, unknown>

export type PostHogRuntimeClient = {
  capture: (eventName: string, properties?: PostHogProperties) => unknown
  get_session_id: () => string | undefined
  identify: (userId: string, properties?: PostHogProperties) => unknown
  register: (properties: PostHogProperties) => unknown
  reset: () => unknown
}

type PostHogOperation =
  | { type: "capture"; eventName: string; properties?: PostHogProperties }
  | { type: "identify"; userId: string; properties?: PostHogProperties }
  | { type: "register"; properties: PostHogProperties }
  | { type: "reset" }

type PostHogRuntimeOptions = {
  loadClient: () => Promise<PostHogRuntimeClient | null>
  queueLimit?: number
  warn?: (message: string, error?: unknown) => void
}

const defaultWarn = (message: string, error?: unknown) => {
  if (process.env.NODE_ENV !== "production") console.warn(message, error)
}

export function createPostHogRuntime({
  loadClient,
  queueLimit = 100,
  warn = defaultWarn,
}: PostHogRuntimeOptions) {
  const queue = createBoundedFifo<PostHogOperation>({
    label: "PostHog",
    limit: queueLimit,
    warn: (message) => warn(message),
  })
  let client: PostHogRuntimeClient | null = null
  let contextPromise: Promise<CurrentFunnelContext | null> | null = null
  let released = false
  let failed = false
  let startPromise: Promise<void> | null = null

  const dispatch = (operation: PostHogOperation) => {
    if (!client) return false
    switch (operation.type) {
      case "capture":
        client.capture(operation.eventName, operation.properties)
        break
      case "identify":
        client.identify(operation.userId, operation.properties)
        break
      case "register":
        client.register(operation.properties)
        break
      case "reset":
        client.reset()
        break
    }
    return true
  }

  const enqueueOrDispatch = (operation: PostHogOperation) => {
    if (failed) return false
    if (client) return dispatch(operation)
    queue.push(operation)
    return true
  }

  const maybeStart = () => {
    if (!released || !contextPromise || startPromise) return startPromise

    startPromise = Promise.all([loadClient(), contextPromise.catch(() => null)])
      .then(([nextClient, context]) => {
        if (!nextClient) {
          failed = true
          queue.clear()
          return
        }

        client = nextClient
        if (context) {
          client.register({
            funnel_package_key: context.funnelPackageKey,
            funnel_session_id: context.funnelSessionId,
          })
        }
        for (const operation of queue.drain()) dispatch(operation)
      })
      .catch((error) => {
        failed = true
        queue.clear()
        warn("[analytics] PostHog loader failed", error)
      })

    return startPromise
  }

  const posthog = {
    capture(eventName: string, properties?: PostHogProperties) {
      return enqueueOrDispatch({ type: "capture", eventName, properties })
    },
    get_session_id() {
      if (!client) return undefined
      try {
        return client.get_session_id()
      } catch {
        return undefined
      }
    },
    identify(userId: string, properties?: PostHogProperties) {
      return enqueueOrDispatch({ type: "identify", userId, properties })
    },
    register(properties: PostHogProperties) {
      return enqueueOrDispatch({ type: "register", properties })
    },
    reset() {
      return enqueueOrDispatch({ type: "reset" })
    },
  }

  return {
    configureContext(promise: Promise<CurrentFunnelContext | null>) {
      if (!contextPromise) contextPromise = promise.catch(() => null)
      return maybeStart() ?? Promise.resolve()
    },
    posthog,
    release() {
      released = true
      return maybeStart() ?? Promise.resolve()
    },
  }
}

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://eu.i.posthog.com"
const POSTHOG_URL_PROPERTY_KEYS = new Set([
  "$current_url",
  "$initial_current_url",
  "$initial_referrer",
  "$referrer",
  "$session_entry_referrer",
  "$session_entry_url",
])

export function sanitizePostHogProperties(properties: PostHogProperties) {
  const sanitized = { ...properties }

  for (const [key, value] of Object.entries(sanitized)) {
    if (POSTHOG_URL_PROPERTY_KEYS.has(key) && typeof value === "string") {
      sanitized[key] = sanitizeAnalyticsUrl(value)
      continue
    }
    if ((key === "$set" || key === "$set_once") && isPropertyRecord(value)) {
      sanitized[key] = sanitizePostHogProperties(value)
    }
  }

  return sanitized
}

function isPropertyRecord(value: unknown): value is PostHogProperties {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

async function loadPostHogClient(): Promise<PostHogRuntimeClient | null> {
  if (!POSTHOG_KEY || typeof window === "undefined") return null

  const posthogModule = await import("posthog-js")
  const client = posthogModule.default
  client.init(POSTHOG_KEY, {
    advanced_disable_flags: true,
    api_host: POSTHOG_HOST,
    autocapture: false,
    before_send: (event) =>
      event
        ? {
            ...event,
            properties: sanitizePostHogProperties(
              event.properties ?? {},
            ) as typeof event.properties,
          }
        : null,
    capture_pageview: false,
    persistence: "localStorage+cookie",
  })
  return client as unknown as PostHogRuntimeClient
}

const runtime = createPostHogRuntime({ loadClient: loadPostHogClient })

export const posthog = runtime.posthog

export function configurePostHogFunnelContext(
  contextPromise: Promise<CurrentFunnelContext | null>,
) {
  return runtime.configureContext(contextPromise)
}

export function releasePostHogRuntime() {
  return runtime.release()
}
