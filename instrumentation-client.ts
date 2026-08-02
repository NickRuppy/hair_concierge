import * as Sentry from "@sentry/nextjs"
import { scrubSentryBreadcrumb, scrubSentryEvent } from "@/lib/observability/checkout"
import { filterMetaNativeBridgeEvent } from "@/lib/observability/sentry-client-filter"

type SentryClient = Pick<typeof Sentry, "init">

function filterAndScrubSentryEvent<Event extends Parameters<typeof scrubSentryEvent>[0]>(
  event: Event,
) {
  const filteredEvent = filterMetaNativeBridgeEvent(event)
  return filteredEvent ? scrubSentryEvent(filteredEvent) : null
}

export function initializeSentryClient(sentry: SentryClient = Sentry) {
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

initializeSentryClient()

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
