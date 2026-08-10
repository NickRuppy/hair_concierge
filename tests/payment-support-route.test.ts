import assert from "node:assert/strict"
import test from "node:test"

import {
  createPaymentSupportPostHandler,
  resolvePaymentSupportIdentity,
} from "../src/app/api/billing/payment-support/route"
import {
  parsePaymentSupportRequest,
  type PaymentSupportCaseResult,
} from "../src/lib/billing/payment-support"
import { fixedWindowRetryAfterSeconds, PAYMENT_SUPPORT_IP_RATE_LIMIT } from "../src/lib/rate-limit"

const validBody = {
  checkoutAttemptId: "attempt-123",
  checkoutContext: "result_membership",
  feedbackKind: "card_declined",
  provider: "stripe",
  method: "card",
}

function request(body: unknown) {
  return new Request("https://chaarlie.de/api/billing/payment-support", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.4" },
    body: JSON.stringify(body),
  })
}

function dependencies(overrides: Record<string, unknown> = {}) {
  const scheduled: Array<() => Promise<void>> = []
  const result: PaymentSupportCaseResult = {
    caseId: "case-123",
    reportCode: "PAY-7K2M9ABC",
    created: true,
    receiptDeliveryStatus: "pending",
  }
  return {
    scheduled,
    values: {
      enabled: () => true,
      checkRateLimit: async () => ({ allowed: true }),
      retryAfterSeconds: () => 137,
      resolveIdentity: async () => ({ kind: "lead" as const, id: "lead-123" }),
      createCase: async () => result,
      deliverReceipt: async () => undefined,
      recordSentryDelivery: async () => undefined,
      schedule: (task: () => Promise<void>) => scheduled.push(task),
      captureReport: () => undefined,
      ...overrides,
    },
  }
}

test("computes Retry-After from the current fixed-window boundary", () => {
  assert.equal(
    fixedWindowRetryAfterSeconds(PAYMENT_SUPPORT_IP_RATE_LIMIT, 10 * 60_000 + 125_000),
    475,
  )
})

test("returns only a stable code and schedules a durable pending receipt", async () => {
  const deps = dependencies()
  const response = await createPaymentSupportPostHandler(deps.values)(request(validBody))

  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { reportCode: "PAY-7K2M9ABC" })
  assert.equal(deps.scheduled.length, 1)
  await deps.scheduled[0]()
})

test("dedupe schedules only an existing pending receipt", async () => {
  for (const state of ["pending", "sending", "sent", "failed", "delivery_uncertain"] as const) {
    const deps = dependencies({
      createCase: async () => ({
        caseId: "case-123",
        reportCode: "PAY-7K2M9ABC",
        created: false,
        receiptDeliveryStatus: state,
      }),
    })
    const response = await createPaymentSupportPostHandler(deps.values)(request(validBody))
    assert.equal(response.status, 200)
    assert.equal(deps.scheduled.length, state === "pending" ? 1 : 0)
  }
})

test("a background receipt failure is contained after the response", async () => {
  const deps = dependencies({
    deliverReceipt: async () => {
      throw new Error("temporary receipt failure")
    },
  })
  const response = await createPaymentSupportPostHandler(deps.values)(request(validBody))
  assert.equal(response.status, 200)
  await assert.doesNotReject(deps.scheduled[0]())
})

test("rejects unknown request fields before identity lookup", async () => {
  let identityCalls = 0
  const deps = dependencies({
    resolveIdentity: async () => {
      identityCalls += 1
      return { kind: "lead" as const, id: "lead-123" }
    },
  })
  const response = await createPaymentSupportPostHandler(deps.values)(
    request({ ...validBody, leadId: "forged" }),
  )
  assert.equal(response.status, 400)
  assert.equal(identityCalls, 0)
})

test("charges the IP limiter before resolving identity and returns Retry-After", async () => {
  const order: string[] = []
  const deps = dependencies({
    checkRateLimit: async () => {
      order.push("rate")
      return { allowed: false }
    },
    resolveIdentity: async () => {
      order.push("identity")
      return null
    },
  })
  const response = await createPaymentSupportPostHandler(deps.values)(request(validBody))
  assert.equal(response.status, 429)
  assert.equal(response.headers.get("retry-after"), "137")
  assert.deepEqual(order, ["rate"])
})

test("fails closed when reporting is disabled or identity is absent", async () => {
  const disabled = dependencies({ enabled: () => false })
  assert.equal(
    (await createPaymentSupportPostHandler(disabled.values)(request(validBody))).status,
    404,
  )

  const anonymous = dependencies({ resolveIdentity: async () => null })
  assert.equal(
    (await createPaymentSupportPostHandler(anonymous.values)(request(validBody))).status,
    401,
  )
})

test("reactivation requires the authenticated user and never consults funnel identity", async () => {
  let funnelCalls = 0
  const identity = await resolvePaymentSupportIdentity(
    parsePaymentSupportRequest({ ...validBody, checkoutContext: "reactivation" }),
    {
      getAuthenticatedUserId: async () => "user-123",
      getFunnelCookieValue: async () => {
        funnelCalls += 1
        return "cookie"
      },
    },
  )
  assert.deepEqual(identity, { kind: "user", id: "user-123" })
  assert.equal(funnelCalls, 0)
})

test("result reporting derives the lead only from the verified cookie tuple", async () => {
  const lookups: unknown[] = []
  const context = {
    sessionId: "11111111-1111-4111-8111-111111111111",
    visitorId: "22222222-2222-4222-8222-222222222222",
    packageKey: "meta_personal_plan_v1",
    issuedAt: Date.now(),
  }
  const identity = await resolvePaymentSupportIdentity(parsePaymentSupportRequest(validBody), {
    getAuthenticatedUserId: async () => {
      throw new Error("result identity must not use auth fallback")
    },
    getFunnelCookieValue: async () => "signed-cookie",
    resolveFunnelContext: async (value) => (value === "signed-cookie" ? context : null),
    lookupLeadId: async (value) => {
      lookups.push(value)
      return "lead-123"
    },
  })
  assert.deepEqual(identity, { kind: "lead", id: "lead-123" })
  assert.deepEqual(lookups, [context])

  const rejected = await resolvePaymentSupportIdentity(parsePaymentSupportRequest(validBody), {
    getFunnelCookieValue: async () => "invalid",
    resolveFunnelContext: async () => null,
    lookupLeadId: async () => {
      throw new Error("invalid cookies must fail before lookup")
    },
  })
  assert.equal(rejected, null)
})
