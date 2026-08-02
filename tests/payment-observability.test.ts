import assert from "node:assert/strict"
import test from "node:test"

import {
  buildPaymentFailurePayload,
  capturePaymentFailureWithSink,
  getPaymentBoundary,
  getPaymentFailureLevel,
} from "../src/lib/observability/payment"

test("payment reporter uses closed tags, a safe internal user id, and stable immediate grouping", () => {
  const payload = buildPaymentFailurePayload({
    signal: "customer_payment_error_observed",
    provider: "stripe",
    stage: "stripe_express_checkout_confirm",
    errorFamily: "not_confirmable",
    commerceKind: "subscription",
    origin: "browser",
    method: "apple_pay",
    truth: "pending",
    live: true,
    isInternalTest: false,
    userId: "user-123",
    leadId: "lead-123",
    checkoutAttemptId: "attempt-123",
    providerReferencePresent: true,
  })

  assert.equal(getPaymentBoundary("stripe_express_checkout_confirm"), "customer_authorization")
  assert.equal(getPaymentFailureLevel("payment_integrity_mismatch"), "fatal")
  assert.deepEqual(payload.fingerprint, [
    "payment/customer_payment_error_observed/stripe/customer_authorization/not_confirmable",
  ])
  assert.equal(payload.tags["payment.live"], "true")
  assert.equal(payload.tags["payment.retryable"], "unknown")
  assert.equal(payload.user?.id, "user-123")
  assert.equal(payload.context.provider_reference_present, true)
  assert.equal(JSON.stringify(payload).includes("cs_"), false)
})

test("payment reporter uses lead id only when the internal user id is absent", () => {
  const payload = buildPaymentFailurePayload({
    signal: "provider_payment_failed",
    provider: "paypal",
    stage: "paypal_activation_status_poll",
    errorFamily: "declined",
    commerceKind: "one_time",
    origin: "provider_api",
    method: "paypal",
    truth: "failed",
    live: false,
    isInternalTest: true,
    leadId: "lead-123",
  })

  assert.deepEqual(payload.user, { id: "lead-123" })
  assert.equal(payload.level, "warning")
})

test("checkout initialization failures use the closed error signal and severity", () => {
  const payload = buildPaymentFailurePayload({
    signal: "payment_checkout_initialization_failed",
    provider: "stripe",
    boundary: "provider_session",
    errorFamily: "provider_session",
    commerceKind: "one_time",
    origin: "provider_api",
    method: "unknown",
    truth: "unknown",
    live: true,
    isInternalTest: false,
    source: "quiz_result_offer",
    status: "idempotency_conflict",
  })

  assert.equal(payload.level, "error")
  assert.equal(payload.tags["payment.signal"], "payment_checkout_initialization_failed")
  assert.equal(payload.context.status, "idempotency_conflict")
  assert.doesNotMatch(JSON.stringify(payload), /client_secret|customer@example.com|cs_/)
})

test("payment reporter refuses email-like values in internal identity fields", () => {
  const payload = buildPaymentFailurePayload({
    signal: "customer_payment_error_observed",
    provider: "stripe",
    boundary: "provider_session",
    errorFamily: "configuration",
    commerceKind: "subscription",
    origin: "browser",
    method: "card",
    truth: "unknown",
    live: true,
    isInternalTest: false,
    userId: "customer@example.com",
    leadId: "other@example.com",
    checkoutAttemptId: "attempt@example.com",
  })

  assert.equal(payload.user, null)
  assert.equal("user_id" in payload.context, false)
  assert.equal("lead_id" in payload.context, false)
  assert.equal("checkout_attempt_id" in payload.context, false)
  assert.doesNotMatch(JSON.stringify(payload), /@/)
})

test("integrity findings add only an opaque attempt or caller-supplied digest to the fingerprint", () => {
  const digest = "a".repeat(64)
  const payload = buildPaymentFailurePayload({
    signal: "payment_integrity_mismatch",
    provider: "stripe",
    boundary: "entitlement",
    errorFamily: "entitlement_state",
    commerceKind: "subscription",
    origin: "reconciliation",
    method: "card",
    truth: "succeeded",
    live: true,
    isInternalTest: false,
    invariant: "provider_success_without_entitlement",
    providerReferenceDigest: digest,
    providerReferencePresent: true,
  })

  assert.deepEqual(payload.fingerprint, [
    "payment/payment_integrity_mismatch/stripe/entitlement/entitlement_state",
    "provider_success_without_entitlement",
    digest,
  ])
  assert.equal(JSON.stringify(payload).includes("provider-reference"), false)
})

test("integrity fingerprints and bounded context reject raw or message-like caller strings", () => {
  const payload = buildPaymentFailurePayload({
    signal: "payment_integrity_mismatch",
    provider: "paypal",
    boundary: "billing",
    errorFamily: "billing_state",
    commerceKind: "one_time",
    origin: "reconciliation",
    method: "paypal",
    truth: "succeeded",
    live: true,
    isInternalTest: false,
    invariant: "customer@example.com paid but missing",
    providerReferenceDigest: "ORDER-RAW-PROVIDER-REFERENCE",
    plan: "customer@example.com",
    status: "declined for customer@example.com",
  })

  assert.equal(payload.fingerprint.length, 1)
  assert.equal("plan" in payload.context, false)
  assert.equal("status" in payload.context, false)
  assert.equal(JSON.stringify(payload).includes("customer@example.com"), false)
  assert.equal(JSON.stringify(payload).includes("ORDER-RAW"), false)
})

test("payment reporter swallows synchronous and asynchronous sink failures", async () => {
  const details = {
    signal: "payment_monitor_failed" as const,
    provider: "unknown" as const,
    boundary: "reconciliation" as const,
    errorFamily: "unknown" as const,
    commerceKind: "unknown" as const,
    origin: "reconciliation" as const,
    method: "unknown" as const,
    truth: "unknown" as const,
    live: true,
    isInternalTest: false,
  }

  assert.doesNotThrow(() =>
    capturePaymentFailureWithSink(details, {
      captureException: () => {
        throw new Error("sink failed")
      },
      withScope: (callback) =>
        callback({
          setContext: () => undefined,
          setFingerprint: () => undefined,
          setLevel: () => undefined,
          setTag: () => undefined,
          setUser: () => undefined,
        }),
    }),
  )

  assert.doesNotThrow(() =>
    capturePaymentFailureWithSink(details, {
      captureException: () => Promise.reject(new Error("async sink failed")),
      withScope: (callback) =>
        callback({
          setContext: () => undefined,
          setFingerprint: () => undefined,
          setLevel: () => undefined,
          setTag: () => undefined,
          setUser: () => undefined,
        }),
    }),
  )
  await new Promise((resolve) => setImmediate(resolve))
})

test("payment reporter clears an inherited Sentry user when no safe internal id exists", () => {
  const seenUsers: Array<{ id: string } | null> = []

  capturePaymentFailureWithSink(
    {
      signal: "payment_monitor_failed",
      provider: "unknown",
      boundary: "reconciliation",
      errorFamily: "unknown",
      commerceKind: "unknown",
      origin: "reconciliation",
      method: "unknown",
      truth: "unknown",
      live: true,
      isInternalTest: false,
    },
    {
      captureException: () => undefined,
      withScope: (callback) =>
        callback({
          setContext: () => undefined,
          setFingerprint: () => undefined,
          setLevel: () => undefined,
          setTag: () => undefined,
          setUser: (user) => seenUsers.push(user),
        }),
    },
  )

  assert.deepEqual(seenUsers, [null])
})

test("payment reporter returns the Sentry event id as a delivery receipt", () => {
  const eventId = capturePaymentFailureWithSink(
    {
      signal: "payment_monitor_failed",
      provider: "paypal",
      boundary: "reconciliation",
      errorFamily: "provider_unavailable",
      commerceKind: "unknown",
      origin: "reconciliation",
      method: "unknown",
      truth: "unknown",
      live: true,
      isInternalTest: false,
    },
    {
      captureException: () => "0123456789abcdef0123456789abcdef",
      withScope: (callback) =>
        callback({
          setContext: () => undefined,
          setFingerprint: () => undefined,
          setLevel: () => undefined,
          setTag: () => undefined,
          setUser: () => undefined,
        }),
    },
  )

  assert.equal(eventId, "0123456789abcdef0123456789abcdef")
})
