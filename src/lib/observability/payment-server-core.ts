import {
  capturePaymentFailureWithSink,
  type PaymentFailureDetails,
  type PaymentSentrySink,
} from "@/lib/observability/payment"
import { scrubSentryBreadcrumb, scrubSentryEvent } from "@/lib/observability/sentry-scrubbing"

type ServerSentryClient = {
  getDsn?: () => unknown
}

type ServerSentryInitOptions = {
  dsn: string
  environment?: string
  sendDefaultPii: false
  tracesSampleRate: number
  beforeSend: typeof scrubSentryEvent
  beforeSendTransaction: typeof scrubSentryEvent
  beforeBreadcrumb: typeof scrubSentryBreadcrumb
}

export type ServerPaymentSentry = PaymentSentrySink & {
  init(options: ServerSentryInitOptions): unknown
  getClient(): ServerSentryClient | undefined
  flush(timeout?: number): Promise<boolean>
}

export type ServerPaymentObservabilityDeps = {
  sentry: ServerPaymentSentry
  environment?: Record<string, string | undefined>
}

function hasConfiguredClient(sentry: ServerPaymentSentry): boolean {
  try {
    return Boolean(sentry.getClient()?.getDsn?.())
  } catch {
    return false
  }
}

export function ensureServerPaymentSentry(deps: ServerPaymentObservabilityDeps): boolean {
  const { sentry } = deps
  if (hasConfiguredClient(sentry)) return true

  const environment = deps.environment ?? process.env
  const dsn = environment.NEXT_PUBLIC_SENTRY_DSN?.trim()
  if (!dsn) return false

  try {
    sentry.init({
      dsn,
      environment:
        environment.VERCEL_ENV ?? environment.NEXT_PUBLIC_VERCEL_ENV ?? environment.NODE_ENV,
      sendDefaultPii: false,
      tracesSampleRate: 0.1,
      beforeSend: scrubSentryEvent,
      beforeSendTransaction: scrubSentryEvent,
      beforeBreadcrumb: scrubSentryBreadcrumb,
    })
  } catch {
    return false
  }

  return hasConfiguredClient(sentry)
}

export function captureServerPaymentFailure(
  details: PaymentFailureDetails,
  deps: ServerPaymentObservabilityDeps,
): string | undefined {
  if (!ensureServerPaymentSentry(deps)) return undefined
  return capturePaymentFailureWithSink(details, deps.sentry)
}

export async function flushServerPaymentTelemetry(
  timeout: number,
  deps: ServerPaymentObservabilityDeps,
): Promise<boolean> {
  if (!ensureServerPaymentSentry(deps)) return false
  try {
    return (await deps.sentry.flush(timeout)) === true
  } catch {
    return false
  }
}
