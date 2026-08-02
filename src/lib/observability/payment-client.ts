import * as Sentry from "@sentry/nextjs"

import {
  capturePaymentFailureWithSink,
  type PaymentFailureDetails,
} from "@/lib/observability/payment"

export type {
  PaymentBoundary,
  PaymentCommerceKind,
  PaymentErrorFamily,
} from "@/lib/observability/payment"

export function capturePaymentFailure(details: PaymentFailureDetails): string | undefined {
  return capturePaymentFailureWithSink(details, Sentry)
}
