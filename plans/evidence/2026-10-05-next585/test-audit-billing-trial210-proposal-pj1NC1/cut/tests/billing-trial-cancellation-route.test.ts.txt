import assert from "node:assert/strict"
import test from "node:test"
import {
  handleTrialCancellation,
  handleTrialCancellationCapability,
} from "../src/app/api/billing/trial-cancellation/route"
import type { PayPalSubscription } from "../src/lib/paypal/subscription-shapes"
import { projectTrialCancellationCapability } from "../src/lib/stripe/trial-cancellation"

const user = "11111111-1111-4111-8111-111111111111"
const enrollment = "22222222-2222-4222-8222-222222222222"
const requestId = "33333333-3333-4333-8333-333333333333"
const declarationId = "44444444-4444-4444-8444-444444444444"
const secret = "x".repeat(32)
const capability = projectTrialCancellationCapability(
  { enrollmentId: enrollment, requestId },
  secret,
)
const payload = () =>
  new Request("https://x", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ enrollmentId: enrollment, capability }),
  })

test("route rejects unsigned targeting and requires authentication", async () => {
  assert.equal(
    (
      await handleTrialCancellation(payload(), {
        userId: async () => null,
        admin: {} as never,
        stripe: () => ({}) as never,
        secret,
      })
    ).status,
    401,
  )
  assert.equal(
    (
      await handleTrialCancellation(
        new Request("https://x", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ enrollmentId: enrollment, capability: "bad" }),
        }),
        { userId: async () => user, admin: {} as never, stripe: () => ({}) as never, secret },
      )
    ).status,
    400,
  )
})

test("capability issuance uses the confirmed owner RPC", async () => {
  const calls: string[] = []
  const response = await handleTrialCancellationCapability(
    new Request(`https://x?enrollmentId=${enrollment}`),
    {
      userId: async () => user,
      admin: {
        rpc: async (name: string) => {
          calls.push(name)
          return { data: true, error: null }
        },
      } as never,
      secret,
      requestId: () => requestId,
    },
  )
  assert.equal(response.status, 200)
  assert.deepEqual(calls, ["issue_trial_cancellation_capability"])
})

test("saved declaration is acknowledged when provider configuration is unavailable", async () => {
  const saved = process.env.TRIAL_IDENTITY_PROCESSING_APPROVED
  process.env.TRIAL_IDENTITY_PROCESSING_APPROVED = "false"
  const response = await handleTrialCancellation(payload(), {
    userId: async () => user,
    admin: {
      rpc: async (name: string) =>
        name === "submit_trial_cancellation_declaration"
          ? {
              data: [
                {
                  declaration_id: declarationId,
                  submitted_at: "2030-01-01T00:00:00.000Z",
                  effective_end_at: "2030-01-08T00:00:00.000Z",
                },
              ],
              error: null,
            }
          : { data: [{ provider: "stripe" }], error: null },
    } as never,
    stripe: () => {
      throw new Error("must stay lazy")
    },
    secret,
  })
  assert.equal(response.status, 200)
  assert.equal(((await response.json()) as { providerStatus: string }).providerStatus, "pending")
  if (saved === undefined) delete process.env.TRIAL_IDENTITY_PROCESSING_APPROVED
  else process.env.TRIAL_IDENTITY_PROCESSING_APPROVED = saved
})

test("PayPal capability and saved declaration immediately cancel only the exact owned trial", async () => {
  let current: PayPalSubscription = {
    id: "I-1",
    status: "ACTIVE",
    plan_id: "P-trial",
    subscriber: { payer_id: "payer_1" },
    billing_info: { next_billing_time: "2030-01-08T00:00:00.000Z" },
  }
  let cancelled = 0
  const operation = {
    enrollment_id: enrollment,
    user_id: user,
    provider: "paypal",
    provider_customer_id: "payer_1",
    provider_agreement_id: "I-1",
    original_trial_end_at: "2030-01-08T00:00:00.000Z",
    status: "pending",
    cancel_at_period_end: true,
    trial_cohort: "trial_v1",
    provider_plan_id: "P-trial",
  }
  const admin = {
    rpc: async (name: string) =>
      name === "issue_trial_cancellation_capability"
        ? { data: true, error: null }
        : name === "submit_trial_cancellation_declaration"
          ? {
              data: [
                {
                  declaration_id: declarationId,
                  submitted_at: "2030-01-01T00:00:00.000Z",
                  effective_end_at: "2030-01-08T00:00:00.000Z",
                },
              ],
              error: null,
            }
          : name === "load_trial_cancellation_provider_operation"
            ? { data: [operation], error: null }
            : { data: true, error: null },
  } as never
  assert.equal(
    (
      await handleTrialCancellationCapability(new Request(`https://x?enrollmentId=${enrollment}`), {
        userId: async () => user,
        admin,
        secret,
        requestId: () => requestId,
      })
    ).status,
    200,
  )
  const response = await handleTrialCancellation(payload(), {
    userId: async () => user,
    admin,
    stripe: () => {
      throw new Error("Stripe must stay lazy")
    },
    paypal: async () => ({
      retrieve: async () => current,
      cancel: async () => {
        cancelled++
        current = { ...current, status: "CANCELLED", billing_info: {} }
      },
    }),
    secret,
  })
  assert.equal(((await response.json()) as { providerStatus: string }).providerStatus, "confirmed")
  assert.equal(cancelled, 1)
})

test("PayPal mismatched payer stays saved and pending without provider mutation", async () => {
  const operation = {
    enrollment_id: enrollment,
    user_id: user,
    provider: "paypal",
    provider_customer_id: "payer_1",
    provider_agreement_id: "I-1",
    original_trial_end_at: "2030-01-08T00:00:00.000Z",
    status: "pending",
    cancel_at_period_end: true,
    trial_cohort: "trial_v1",
    provider_plan_id: "P-trial",
  }
  let cancelled = 0
  const response = await handleTrialCancellation(payload(), {
    userId: async () => user,
    admin: {
      rpc: async (name: string) =>
        name === "submit_trial_cancellation_declaration"
          ? {
              data: [
                {
                  declaration_id: declarationId,
                  submitted_at: "2030-01-01T00:00:00.000Z",
                  effective_end_at: "2030-01-08T00:00:00.000Z",
                },
              ],
              error: null,
            }
          : name === "load_trial_cancellation_provider_operation"
            ? { data: [operation], error: null }
            : { data: true, error: null },
    } as never,
    stripe: () => ({}) as never,
    paypal: async () => ({
      retrieve: async () => ({
        id: "I-1",
        status: "ACTIVE",
        plan_id: "P-trial",
        subscriber: { payer_id: "wrong" },
        billing_info: { next_billing_time: "2030-01-08T00:00:00.000Z" },
      }),
      cancel: async () => {
        cancelled++
      },
    }),
    secret,
  })
  assert.equal(((await response.json()) as { providerStatus: string }).providerStatus, "pending")
  assert.equal(cancelled, 0)
})
