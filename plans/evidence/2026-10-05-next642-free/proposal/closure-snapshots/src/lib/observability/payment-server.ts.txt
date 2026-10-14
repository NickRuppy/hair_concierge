import "server-only"

import * as Sentry from "@sentry/node"

import {
  captureServerPaymentCheckIn as captureCheckInWithSentry,
  captureServerPaymentFailure as captureWithSentry,
  flushServerPaymentTelemetry as flushWithSentry,
  type ServerPaymentSentry,
} from "@/lib/observability/payment-server-core"
import type { PaymentFailureDetails } from "@/lib/observability/payment"
import type { PaymentMonitorCheckIn } from "@/lib/observability/payment-server-core"

const sentry = Sentry as ServerPaymentSentry

export function captureServerPaymentFailure(details: PaymentFailureDetails): string | undefined {
  return captureWithSentry(details, { sentry })
}

export async function flushServerPaymentTelemetry(timeout = 2_000): Promise<boolean> {
  return flushWithSentry(timeout, { sentry })
}

export function captureServerPaymentCheckIn(checkIn: PaymentMonitorCheckIn): string | undefined {
  return captureCheckInWithSentry(checkIn, { sentry })
}
