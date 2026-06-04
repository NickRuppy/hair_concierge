import * as Sentry from "@sentry/nextjs"
import { scrubSentryBreadcrumb, scrubSentryEvent } from "@/lib/observability/checkout"

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
  sendDefaultPii: false,
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0,
  // Checkout activation secrets currently live in URLs; keep Replay off until those URLs are secret-free.
  replaysOnErrorSampleRate: 0,
  beforeSend: scrubSentryEvent,
  beforeSendTransaction: scrubSentryEvent,
  beforeBreadcrumb: scrubSentryBreadcrumb,
})

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
