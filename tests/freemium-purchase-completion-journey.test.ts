import assert from "node:assert/strict"
import test from "node:test"
import type Stripe from "stripe"

import {
  createFreemiumPurchaseCompletionHandler,
  type FreemiumPurchaseCompletionDeps,
} from "../src/app/api/freemium/purchase/complete/route"
import type { FreemiumProvisioningResult } from "../src/lib/freemium/plan-provisioning"
import { CheckoutActivationError } from "../src/lib/stripe/checkout-activation"
import {
  freemiumCheckoutProvisioningUserId,
  provisionFreemiumCheckoutSession,
} from "../src/lib/stripe/webhook-handlers"

/**
 * The purchase-completion journey with Stripe mocked at the API seam — the endpoint's own
 * dependency boundary, so everything below it (ownership, pending classification, the
 * unlock decision) is the real code.
 *
 * The rule this suite exists to hold: **the client callback never unlocks anything.** The
 * sheet's `onComplete` only causes this request; a Session that Stripe reports as unpaid,
 * or that belongs to somebody else, must come back as `pending` / 403 no matter what the
 * browser claims.
 */

const USER = "user-1"
const SESSION_ID = "cs_test_freemium_1"

function freemiumSession(overrides: Partial<Stripe.Checkout.Session> = {}) {
  return {
    id: SESSION_ID,
    metadata: { freemium_admission: "1", freemium_user_id: USER },
    ...overrides,
  } as unknown as Stripe.Checkout.Session
}

const provisioned: FreemiumProvisioningResult = {
  outcome: "provisioned",
  enrollmentSourceId: "admission-1",
  personalPlanId: "plan-1",
  needVersionId: "need-1",
  routineAccepted: true,
}

function deps(overrides: Partial<FreemiumPurchaseCompletionDeps> = {}) {
  return {
    enabled: () => true,
    getUser: async () => ({ id: USER }),
    checkRateLimit: (async () => ({ allowed: true })) as never,
    retrieveSession: async () => freemiumSession(),
    activate: async () =>
      ({ userId: USER, email: "buyer@example.com", canSetInitialPassword: false }) as never,
    provision: async () => provisioned,
    ...overrides,
  } satisfies FreemiumPurchaseCompletionDeps
}

function request(body: unknown = { sessionId: SESSION_ID }) {
  return new Request("https://chaarlie.de/api/freemium/purchase/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

async function call(overrides: Partial<FreemiumPurchaseCompletionDeps> = {}, body?: unknown) {
  const response = await createFreemiumPurchaseCompletionHandler(deps(overrides))(request(body))
  return { status: response.status, body: await response.json() }
}

test("a verified purchase unlocks and reports the provisioned Routine", async () => {
  const result = await call()
  assert.equal(result.status, 200)
  assert.deepEqual(result.body, { status: "complete", routineReady: true })
})

test("flag off: the endpoint does not exist", async () => {
  const result = await call({ enabled: () => false })
  assert.equal(result.status, 404)
})

test("an anonymous caller cannot complete anything", async () => {
  const result = await call({ getUser: async () => null })
  assert.equal(result.status, 401)
})

test("a Session created for another user is refused before any write", async () => {
  let provisionCalls = 0
  const result = await call({
    retrieveSession: async () =>
      freemiumSession({
        metadata: { freemium_admission: "1", freemium_user_id: "someone-else" },
      } as never),
    provision: async () => {
      provisionCalls += 1
      return provisioned
    },
  })
  assert.equal(result.status, 403)
  assert.equal(provisionCalls, 0)
})

test("a Session without the freemium marker is refused — a plain subscription is not an admission", async () => {
  const result = await call({
    retrieveSession: async () =>
      freemiumSession({ metadata: { pricing_catalog: "standard" } } as never),
  })
  assert.equal(result.status, 403)
})

test("an unpaid Session is pending, never complete — the client callback is only a hint", async () => {
  let provisionCalls = 0
  const result = await call({
    retrieveSession: async () => {
      throw new CheckoutActivationError("checkout_session_unpaid", "unpaid")
    },
    provision: async () => {
      provisionCalls += 1
      return provisioned
    },
  })
  assert.deepEqual(result.body, { status: "pending" })
  assert.equal(provisionCalls, 0)
})

test("a Session with no subscription yet is pending, not failed", async () => {
  const result = await call({
    activate: async () => {
      throw new CheckoutActivationError("checkout_session_subscription_missing", "no sub")
    },
  })
  assert.deepEqual(result.body, { status: "pending" })
})

test("pending → complete: the same call succeeds once the payment settles", async () => {
  let settled = false
  const retrieveSession = async () => {
    if (!settled) throw new CheckoutActivationError("checkout_session_unpaid", "unpaid")
    return freemiumSession()
  }
  assert.deepEqual((await call({ retrieveSession })).body, { status: "pending" })
  settled = true
  assert.deepEqual((await call({ retrieveSession })).body, {
    status: "complete",
    routineReady: true,
  })
})

test("a terminally unusable Session fails recoverably, with the reason named", async () => {
  const result = await call({
    activate: async () => {
      throw new CheckoutActivationError("checkout_subscription_expired", "expired")
    },
  })
  assert.equal(result.status, 200)
  assert.deepEqual(result.body, { status: "failed", reason: "checkout_subscription_expired" })
})

test("activation resolving a different account unlocks nobody", async () => {
  const result = await call({
    activate: async () => ({ userId: "other-user", email: "x@example.com" }) as never,
  })
  assert.equal(result.status, 403)
})

test("degraded provisioning still unlocks — the money moved either way", async () => {
  const result = await call({
    provision: async () => ({ outcome: "temporarily_unavailable", stage: "acceptance" }),
  })
  assert.deepEqual(result.body, { status: "complete", routineReady: false })
})

test("a thrown provisioning error is contained, not surfaced as a failed purchase", async () => {
  const result = await call({
    provision: async () => {
      throw new Error("db down")
    },
  })
  assert.deepEqual(result.body, { status: "complete", routineReady: false })
})

test("a malformed body is rejected before Stripe is touched", async () => {
  let retrieved = 0
  const result = await call(
    {
      retrieveSession: async () => {
        retrieved += 1
        return freemiumSession()
      },
    },
    { sessionId: "not-a-session" },
  )
  assert.equal(result.status, 400)
  assert.equal(retrieved, 0)
})

/* ------------------------------------------------------------------------- *
 * Webhook lane — the same provisioning, without the buyer present.
 * ------------------------------------------------------------------------- */

test("webhook replay provisions through the same idempotent service", async () => {
  const calls: { userId: string; providerReference: string }[] = []
  const webhookDeps = {
    freemiumEnabled: () => true,
    provisionFreemiumPurchase: async (input: { userId: string; providerReference: string }) => {
      calls.push(input)
      return provisioned
    },
  }
  await provisionFreemiumCheckoutSession(freemiumSession(), webhookDeps)
  await provisionFreemiumCheckoutSession(freemiumSession(), webhookDeps)

  // Both deliveries reach provisioning with the SAME identity — the service (proved
  // idempotent in freemium-plan-provisioning.test.ts) is what makes the replay a no-op,
  // rather than the webhook guessing whether it already ran.
  assert.deepEqual(calls, [
    { userId: USER, providerReference: SESSION_ID },
    { userId: USER, providerReference: SESSION_ID },
  ])
})

test("the webhook lane is inert for every non-freemium checkout", async () => {
  let calls = 0
  const provisionFreemiumPurchase = async () => {
    calls += 1
    return provisioned
  }
  await provisionFreemiumCheckoutSession(
    { id: "cs_legacy", metadata: { lead_id: "lead-1" } } as never,
    { freemiumEnabled: () => true, provisionFreemiumPurchase },
  )
  assert.equal(calls, 0)
})

test("the webhook lane is inert with the flag off", async () => {
  let calls = 0
  await provisionFreemiumCheckoutSession(freemiumSession(), {
    freemiumEnabled: () => false,
    provisionFreemiumPurchase: async () => {
      calls += 1
      return provisioned
    },
  })
  assert.equal(calls, 0)
})

test("the deferral guard decides synchronously, so a legacy checkout queues no extra work", () => {
  // The webhook schedules provisioning with `defer`; if the guard only ran INSIDE the
  // deferred callback, every legacy checkout would still enqueue one — which is exactly
  // what the Customer.io webhook suite counts.
  assert.equal(
    freemiumCheckoutProvisioningUserId(freemiumSession(), { freemiumEnabled: () => true }),
    USER,
  )
  assert.equal(
    freemiumCheckoutProvisioningUserId({ id: "cs_legacy", metadata: {} } as never, {
      freemiumEnabled: () => true,
    }),
    null,
  )
  assert.equal(
    freemiumCheckoutProvisioningUserId(freemiumSession(), { freemiumEnabled: () => false }),
    null,
  )
})

test("a failing webhook provisioning never fails the webhook", async () => {
  await provisionFreemiumCheckoutSession(freemiumSession(), {
    freemiumEnabled: () => true,
    provisionFreemiumPurchase: async () => {
      throw new Error("provisioning down")
    },
  })
})
