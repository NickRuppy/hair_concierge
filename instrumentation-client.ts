import type * as Sentry from "@sentry/nextjs"

import { scheduleAfterFirstPaint } from "@/lib/analytics/runtime/post-paint"
import { filterMetaNativeBridgeEvent } from "@/lib/observability/sentry-client-filter"
import {
  createSentryClientRuntime,
  setActiveSentryClientRuntime,
  type SentryClientModule,
} from "@/lib/observability/sentry-client-runtime"
import { scrubSentryBreadcrumb, scrubSentryEvent } from "@/lib/observability/sentry-scrubbing"

type SentryModule = typeof Sentry
type SentryClient = Pick<SentryModule, "init">

function filterAndScrubSentryEvent<Event extends Parameters<typeof scrubSentryEvent>[0]>(
  event: Event,
) {
  const filteredEvent = filterMetaNativeBridgeEvent(event)
  return filteredEvent ? scrubSentryEvent(filteredEvent) : null
}

export function initializeSentryClient(sentry: SentryClient) {
  sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
    sendDefaultPii: false,
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0,
    // Checkout activation secrets currently live in URLs; keep Replay off until those URLs are secret-free.
    replaysOnErrorSampleRate: 0,
    beforeSend: filterAndScrubSentryEvent,
    beforeSendTransaction: scrubSentryEvent,
    beforeBreadcrumb: scrubSentryBreadcrumb,
  })
}

export function scheduleSentryAfterFirstPaint(
  callback: () => void,
  scheduleFrames: typeof scheduleAfterFirstPaint = scheduleAfterFirstPaint,
  scheduleTask: typeof setTimeout = setTimeout,
  cancelTask: typeof clearTimeout = clearTimeout,
) {
  let task: ReturnType<typeof setTimeout> | null = null
  const cancelFrames = scheduleFrames(() => {
    task = scheduleTask(callback, 0)
  })

  return () => {
    cancelFrames()
    if (task !== null) cancelTask(task)
  }
}

let runtime: ReturnType<typeof createSentryClientRuntime> | null = null

if (typeof window !== "undefined") {
  let loadedSentry: SentryModule | null = null
  runtime = createSentryClientRuntime({
    eventSource: {
      addEventListener(type, listener) {
        window.addEventListener(type, listener as EventListener)
      },
      removeEventListener(type, listener) {
        window.removeEventListener(type, listener as EventListener)
      },
    },
    initializeClient() {
      if (!loadedSentry) throw new Error("Sentry client loaded without its module")
      initializeSentryClient(loadedSentry)
    },
    async loadClient(): Promise<SentryClientModule> {
      loadedSentry = await import("@sentry/nextjs")
      return {
        captureException: loadedSentry.captureException,
        captureRouterTransitionStart: (...args: unknown[]) =>
          (
            loadedSentry?.captureRouterTransitionStart as
              | ((...routerArgs: unknown[]) => unknown)
              | undefined
          )?.(...args),
      }
    },
    scheduleAfterPaint: (callback) => scheduleSentryAfterFirstPaint(callback),
  })
  setActiveSentryClientRuntime(runtime)
  void runtime.start(window.location.pathname)
}

export const onRouterTransitionStart: SentryModule["captureRouterTransitionStart"] = (...args) => {
  runtime?.onRouterTransitionStart(...args)
}
