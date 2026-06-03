import * as Sentry from "@sentry/nextjs"
import { ensureLangfuseTracing, isLangfuseConfigured } from "@/lib/langfuse/client"
import { scrubSentryBreadcrumb, scrubSentryEvent } from "@/lib/observability/checkout"

export async function register() {
  if (process.env.NEXT_RUNTIME !== "edge" && isLangfuseConfigured()) {
    ensureLangfuseTracing()
  }

  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment:
      process.env.VERCEL_ENV ?? process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
    sendDefaultPii: false,
    tracesSampleRate: 0.1,
    beforeSend: scrubSentryEvent,
    beforeSendTransaction: scrubSentryEvent,
    beforeBreadcrumb: scrubSentryBreadcrumb,
  })
}

export const onRequestError = Sentry.captureRequestError
