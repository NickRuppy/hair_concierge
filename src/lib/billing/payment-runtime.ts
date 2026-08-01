import "server-only"

import { resolvePaymentRuntime, type PaymentRuntime } from "@/lib/billing/payment-runtime-config"

export type { PaymentRuntime }

export function getPaymentRuntime(): PaymentRuntime {
  return resolvePaymentRuntime({
    VERCEL_ENV: process.env.VERCEL_ENV,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    PAYPAL_ENVIRONMENT: process.env.PAYPAL_ENVIRONMENT,
  })
}
