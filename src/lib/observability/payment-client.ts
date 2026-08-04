import * as Sentry from "@sentry/nextjs"

import {
  checkoutExperienceObservabilityEnabled,
  capturePaymentFailureWithSink,
  type PaymentFailureDetails,
} from "@/lib/observability/payment"

export type {
  PaymentBoundary,
  PaymentCommerceKind,
  PaymentErrorFamily,
} from "@/lib/observability/payment"

export function capturePaymentFailure(details: PaymentFailureDetails): string | undefined {
  if (
    details.signal === "checkout_experience_degraded" &&
    !checkoutExperienceObservabilityEnabled(process.env.NEXT_PUBLIC_CHECKOUT_OBSERVABILITY_ENABLED)
  ) {
    return undefined
  }
  return capturePaymentFailureWithSink(details, Sentry)
}
