import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import {
  handleOneTimeActivationStatus,
  ONE_TIME_ACTIVATION_STATUS_RATE_LIMIT,
} from "../src/app/api/billing/one-time-activation-status/route"
import { PayPalCheckoutActivationError } from "../src/lib/paypal/checkout-activation"

const statusRouteSource = readFileSync(
  new URL("../src/app/api/billing/one-time-activation-status/route.ts", import.meta.url),
  "utf8",
)

function request(path: string) {
  return new Request(`https://hair.example${path}`)
}

function baseDeps(overrides: Partial<Parameters<typeof handleOneTimeActivationStatus>[1]> = {}) {
  return {
    supabase: {} as any,
    stripe: {} as any,
    getPremiumTierId: async () => "tier-premium",
    checkRateLimit: async () => ({ allowed: true }),
    ...overrides,
  }
}

test("one-time activation status rejects mixed provider identifiers without caching", async () => {
  const response = await handleOneTimeActivationStatus(
    request("/api/billing/one-time-activation-status?provider=stripe&session_id=cs_test&token=bad"),
    baseDeps(),
  )

  assert.equal(response.status, 400)
  assert.equal(response.headers.get("cache-control"), "no-store")
  assert.deepEqual(await response.json(), { status: "failed_permanent" })
})

test("one-time activation status maps Stripe paid-pending without returning identifiers", async () => {
  const calls: string[] = []
  const response = await handleOneTimeActivationStatus(
    request("/api/billing/one-time-activation-status?provider=stripe&session_id=cs_test"),
    baseDeps({
      verifyCheckoutSessionForActivation: async (sessionId) => {
        calls.push(`verify:${sessionId}`)
        return { id: sessionId, metadata: { product_kind: "personal_plan_once" } } as any
      },
      ensureOneTimeCheckoutAccount: async () => {
        calls.push("ensure")
        return {
          userId: "user-once",
          email: "buyer@example.com",
          canSetInitialPassword: true,
          state: "paid_pending",
          paymentIntentId: "pi_test",
          purchaseId: "purchase-test",
        }
      },
    }),
  )

  assert.equal(response.status, 200)
  assert.equal(response.headers.get("cache-control"), "no-store")
  const body = await response.json()
  assert.deepEqual(body, { status: "paid_pending" })
  assert.equal(JSON.stringify(body).includes("buyer@example.com"), false)
  assert.deepEqual(calls, ["verify:cs_test", "ensure"])
})

test("one-time activation status preserves a revoked Stripe purchase", async () => {
  const response = await handleOneTimeActivationStatus(
    request("/api/billing/one-time-activation-status?provider=stripe&session_id=cs_test"),
    baseDeps({
      verifyCheckoutSessionForActivation: async (sessionId) =>
        ({ id: sessionId, metadata: { product_kind: "personal_plan_once" } }) as any,
      ensureOneTimeCheckoutAccount: async () =>
        ({
          email: "buyer@example.com",
          paymentIntentId: "pi_test",
          purchaseId: "purchase-test",
          state: "revoked",
        }) as any,
    }),
  )

  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { status: "revoked" })
})

test("one-time activation status retrieves an already-captured PayPal order without capture or recovery", async () => {
  let verifiedToken: string | undefined
  let markedCapture: { token: string; orderId: string; captureId: string } | undefined
  let activationCalls = 0
  const response = await handleOneTimeActivationStatus(
    request("/api/billing/one-time-activation-status?provider=paypal&token=I-test"),
    baseDeps({
      verifyPayPalOneTimePaymentForRecovery: async ({ token }) => {
        verifiedToken = token ?? undefined
        return {
          payment: {
            provider: "paypal",
            providerTransactionId: "capture-test",
            providerOrderId: "order-test",
            consentId: "consent-test",
            email: "paypal@example.com",
            amountMinor: 2999,
            currency: "eur",
            paidAt: "2026-07-31T12:00:00.000Z",
          },
          intent: { provider_capture_id: null } as any,
          consent: {} as any,
          existingPurchase: null,
          accountContext: {} as any,
        }
      },
      tryMarkPayPalOrderIntentCaptured: async (_supabase, token, orderId, captureId) => {
        markedCapture = { token, orderId, captureId }
        return { provider_capture_id: captureId } as any
      },
      activateVerifiedPayPalOrderIntent: async (intent) => {
        activationCalls += 1
        assert.equal(intent.provider_capture_id, "capture-test")
        return {
          status: "active",
          state: "active",
          intent: {} as any,
          account: {} as any,
        }
      },
    }),
  )

  assert.equal(response.status, 200)
  assert.equal(response.headers.get("cache-control"), "no-store")
  assert.deepEqual(await response.json(), { status: "active" })
  assert.equal(verifiedToken, "I-test")
  assert.deepEqual(markedCapture, {
    token: "I-test",
    orderId: "order-test",
    captureId: "capture-test",
  })
  assert.equal(activationCalls, 1)
  assert.doesNotMatch(statusRouteSource, /recoverPayPalOrderActivation/)
  assert.doesNotMatch(statusRouteSource, /captureProviderPayPalOrder/)
  assert.doesNotMatch(statusRouteSource, /captureAndActivatePayPalOrder/)
})

test("one-time activation status reuses an already-persisted PayPal capture", async () => {
  let markerCalls = 0
  const response = await handleOneTimeActivationStatus(
    request("/api/billing/one-time-activation-status?provider=paypal&token=I-test"),
    baseDeps({
      verifyPayPalOneTimePaymentForRecovery: async () => ({
        payment: {
          provider: "paypal",
          providerTransactionId: "capture-test",
          providerOrderId: "order-test",
          consentId: "consent-test",
          email: "paypal@example.com",
          amountMinor: 2999,
          currency: "eur",
          paidAt: "2026-07-31T12:00:00.000Z",
        },
        intent: { provider_capture_id: "capture-test" } as any,
        consent: {} as any,
        existingPurchase: null,
        accountContext: {} as any,
      }),
      tryMarkPayPalOrderIntentCaptured: async () => {
        markerCalls += 1
        throw new Error("must not rewrite an already-persisted capture")
      },
      activateVerifiedPayPalOrderIntent: async () => ({
        status: "active",
        state: "active",
        intent: { provider_capture_id: "capture-test" } as any,
        account: {} as any,
      }),
    }),
  )

  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { status: "active" })
  assert.equal(markerCalls, 0)
})

test("one-time activation status keeps an uncaptured PayPal order pending without activation", async () => {
  let activationCalls = 0
  const response = await handleOneTimeActivationStatus(
    request("/api/billing/one-time-activation-status?provider=paypal&token=I-test"),
    baseDeps({
      verifyPayPalOneTimePaymentForRecovery: async () => {
        throw new PayPalCheckoutActivationError("paypal_order_capture_pending", "not captured yet")
      },
      activateVerifiedPayPalOrderIntent: async () => {
        activationCalls += 1
        throw new Error("must not activate an uncaptured payment")
      },
    }),
  )

  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { status: "pending" })
  assert.equal(activationCalls, 0)
})

test("one-time activation status preserves a revoked PayPal purchase", async () => {
  const response = await handleOneTimeActivationStatus(
    request("/api/billing/one-time-activation-status?provider=paypal&token=I-test"),
    baseDeps({
      verifyPayPalOneTimePaymentForRecovery: async () => ({
        payment: {
          provider: "paypal",
          providerTransactionId: "capture-test",
          providerOrderId: "order-test",
          consentId: "consent-test",
          email: "paypal@example.com",
          amountMinor: 2999,
          currency: "eur",
          paidAt: "2026-07-31T12:00:00.000Z",
        },
        intent: { provider_capture_id: "capture-test" } as any,
        consent: {} as any,
        existingPurchase: null,
        accountContext: {} as any,
      }),
      activateVerifiedPayPalOrderIntent: async () => ({
        status: "revoked",
        state: "revoked",
        intent: {} as any,
        account: null,
      }),
    }),
  )

  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { status: "revoked" })
})

test("one-time activation status allows the normal fifteen pending polls", async () => {
  let rateLimitCalls = 0
  let providerCalls = 0
  const deps = baseDeps({
    checkRateLimit: async (_identifier, config) => {
      rateLimitCalls += 1
      assert.deepEqual(config, ONE_TIME_ACTIVATION_STATUS_RATE_LIMIT)
      return { allowed: true }
    },
    verifyCheckoutSessionForActivation: async (sessionId) => {
      providerCalls += 1
      return { id: sessionId, metadata: { product_kind: "personal_plan_once" } } as any
    },
    ensureOneTimeCheckoutAccount: async () =>
      ({
        email: "buyer@example.com",
        paymentIntentId: "pi_test",
        purchaseId: "purchase-test",
        state: "paid_pending",
      }) as any,
  })

  for (let attempt = 0; attempt < 15; attempt += 1) {
    const response = await handleOneTimeActivationStatus(
      request("/api/billing/one-time-activation-status?provider=stripe&session_id=cs_normal_poll"),
      deps,
    )
    assert.equal(response.status, 200)
  }

  assert.equal(ONE_TIME_ACTIVATION_STATUS_RATE_LIMIT.limit >= 15, true)
  assert.equal(rateLimitCalls, 15)
  assert.equal(providerCalls, 15)
})

test("one-time activation status rejects abuse before Stripe or PayPal provider work", async () => {
  let stripeCalls = 0
  let paypalCalls = 0
  const checkRateLimit = async () => ({ allowed: false })
  const stripeResponse = await handleOneTimeActivationStatus(
    request("/api/billing/one-time-activation-status?provider=stripe&session_id=cs_abuse"),
    baseDeps({
      checkRateLimit,
      verifyCheckoutSessionForActivation: async () => {
        stripeCalls += 1
        throw new Error("Stripe must not be called")
      },
    }),
  )
  const paypalResponse = await handleOneTimeActivationStatus(
    request("/api/billing/one-time-activation-status?provider=paypal&token=I-abuse"),
    baseDeps({
      checkRateLimit,
      verifyPayPalOneTimePaymentForRecovery: async () => {
        paypalCalls += 1
        throw new Error("PayPal must not be called")
      },
    }),
  )

  for (const response of [stripeResponse, paypalResponse]) {
    assert.equal(response.status, 429)
    assert.equal(response.headers.get("cache-control"), "no-store")
    assert.deepEqual(await response.json(), { status: "pending" })
  }
  assert.equal(stripeCalls, 0)
  assert.equal(paypalCalls, 0)
})

test("one-time activation status rate-limit keys hash Stripe and PayPal references with request context", async () => {
  const identifiers: string[] = []
  const checkRateLimit = async (identifier: string) => {
    identifiers.push(identifier)
    return { allowed: false }
  }

  await handleOneTimeActivationStatus(
    new Request(
      "https://hair.example/api/billing/one-time-activation-status?provider=stripe&session_id=cs_private_reference",
      { headers: { "x-forwarded-for": "203.0.113.1" } },
    ),
    baseDeps({ checkRateLimit }),
  )
  await handleOneTimeActivationStatus(
    new Request(
      "https://hair.example/api/billing/one-time-activation-status?provider=paypal&token=I-private-reference",
      { headers: { "x-forwarded-for": "203.0.113.2" } },
    ),
    baseDeps({ checkRateLimit }),
  )

  assert.equal(identifiers.length, 2)
  assert.match(identifiers[0]!, /^[a-f0-9]{64}$/)
  assert.match(identifiers[1]!, /^[a-f0-9]{64}$/)
  assert.notEqual(identifiers[0], identifiers[1])
  assert.equal(
    identifiers.some((key) => key.includes("cs_private_reference")),
    false,
  )
  assert.equal(
    identifiers.some((key) => key.includes("I-private-reference")),
    false,
  )
  assert.doesNotMatch(statusRouteSource, /console\.(?:log|warn|error)\([^\n]*parsed\./)
})
