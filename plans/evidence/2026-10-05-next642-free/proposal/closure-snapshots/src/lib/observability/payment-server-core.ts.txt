import {
  checkoutExperienceObservabilityEnabled,
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
  captureCheckIn(checkIn: PaymentMonitorCheckIn, monitorConfig?: PaymentMonitorConfig): string
  init(options: ServerSentryInitOptions): unknown
  getClient(): ServerSentryClient | undefined
  flush(timeout?: number): Promise<boolean>
}

export type PaymentMonitorCheckIn =
  | { monitorSlug: string; status: "in_progress" }
  | { monitorSlug: string; status: "ok" | "error"; checkInId?: string; duration?: number }

type PaymentMonitorConfig = {
  schedule: { type: "crontab"; value: string } | { type: "interval"; value: number; unit: "minute" }
  checkinMargin: number
  maxRuntime: number
  timezone: string
  failureIssueThreshold: number
  recoveryThreshold: number
}

const PAYMENT_MONITOR_CONFIGS: Record<string, PaymentMonitorConfig> = {
  "payment-integrity-local": {
    schedule: { type: "interval", value: 30, unit: "minute" },
    checkinMargin: 20,
    maxRuntime: 2,
    timezone: "Europe/Berlin",
    failureIssueThreshold: 2,
    recoveryThreshold: 1,
  },
  "payment-integrity-daily": {
    schedule: { type: "crontab", value: "15 2 * * *" },
    checkinMargin: 15,
    maxRuntime: 2,
    timezone: "UTC",
    failureIssueThreshold: 1,
    recoveryThreshold: 1,
  },
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
  if (
    (details.signal === "checkout_experience_degraded" ||
      (details.signal === "customer_payment_error_observed" &&
        details.errorFamily === "control_outcome")) &&
    !checkoutExperienceObservabilityEnabled(
      (deps.environment ?? process.env).CHECKOUT_OBSERVABILITY_ENABLED,
    )
  ) {
    return undefined
  }
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

export function captureServerPaymentCheckIn(
  checkIn: PaymentMonitorCheckIn,
  deps: ServerPaymentObservabilityDeps,
): string | undefined {
  if (!ensureServerPaymentSentry(deps)) return undefined
  try {
    return deps.sentry.captureCheckIn(
      checkIn,
      checkIn.status === "in_progress" ? PAYMENT_MONITOR_CONFIGS[checkIn.monitorSlug] : undefined,
    )
  } catch {
    return undefined
  }
}
