export type PaymentRuntime = {
  paypalLive: boolean
  stripeLive: boolean
}

export type PaymentRuntimeEnvironment = {
  PAYPAL_ENVIRONMENT?: string
  STRIPE_SECRET_KEY?: string
  VERCEL_ENV?: string
}

export function resolvePaymentRuntime({
  PAYPAL_ENVIRONMENT,
  STRIPE_SECRET_KEY,
  VERCEL_ENV,
}: PaymentRuntimeEnvironment): PaymentRuntime {
  const productionDeployment = VERCEL_ENV === "production"

  return {
    stripeLive: productionDeployment && STRIPE_SECRET_KEY?.startsWith("sk_live_") === true,
    paypalLive: productionDeployment && PAYPAL_ENVIRONMENT === "live",
  }
}
