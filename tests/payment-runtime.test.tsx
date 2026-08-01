import assert from "node:assert/strict"
import test from "node:test"
import { renderToStaticMarkup } from "react-dom/server"

import {
  PaymentRuntimeProvider,
  usePaymentRuntime,
} from "../src/components/providers/payment-runtime-provider"
import {
  resolvePaymentRuntime,
  type PaymentRuntime,
  type PaymentRuntimeEnvironment,
} from "../src/lib/billing/payment-runtime-config"

test("payment runtime only marks providers live in a production deployment with live provider configuration", () => {
  assert.deepEqual(
    resolvePaymentRuntime({
      VERCEL_ENV: "production",
      STRIPE_SECRET_KEY: "sk_live_example",
      PAYPAL_ENVIRONMENT: "live",
    }),
    { stripeLive: true, paypalLive: true },
  )

  const nonLiveCases: Array<{ environment: PaymentRuntimeEnvironment; expected: PaymentRuntime }> =
    [
      {
        environment: {
          VERCEL_ENV: "preview",
          STRIPE_SECRET_KEY: "sk_live_example",
          PAYPAL_ENVIRONMENT: "live",
        },
        expected: { stripeLive: false, paypalLive: false },
      },
      {
        environment: {
          VERCEL_ENV: "development",
          STRIPE_SECRET_KEY: "sk_live_example",
          PAYPAL_ENVIRONMENT: "live",
        },
        expected: { stripeLive: false, paypalLive: false },
      },
      {
        environment: {
          VERCEL_ENV: "production",
          STRIPE_SECRET_KEY: "sk_test_example",
          PAYPAL_ENVIRONMENT: "live",
        },
        expected: { stripeLive: false, paypalLive: true },
      },
      {
        environment: {
          VERCEL_ENV: "production",
          STRIPE_SECRET_KEY: "sk_live_example",
          PAYPAL_ENVIRONMENT: "sandbox",
        },
        expected: { stripeLive: true, paypalLive: false },
      },
      {
        environment: { VERCEL_ENV: "production" },
        expected: { stripeLive: false, paypalLive: false },
      },
    ]

  for (const { environment, expected } of nonLiveCases) {
    assert.deepEqual(resolvePaymentRuntime(environment), expected)
  }
})

function PaymentRuntimeProbe() {
  const runtime = usePaymentRuntime()
  return <output>{JSON.stringify(runtime)}</output>
}

test("payment runtime context defaults safely and provides only resolved booleans", () => {
  assert.equal(
    renderToStaticMarkup(<PaymentRuntimeProbe />),
    "<output>{&quot;stripeLive&quot;:false,&quot;paypalLive&quot;:false}</output>",
  )
  assert.equal(
    renderToStaticMarkup(
      <PaymentRuntimeProvider runtime={{ stripeLive: true, paypalLive: false }}>
        <PaymentRuntimeProbe />
      </PaymentRuntimeProvider>,
    ),
    "<output>{&quot;stripeLive&quot;:true,&quot;paypalLive&quot;:false}</output>",
  )
})
