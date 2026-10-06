import assert from "node:assert/strict"
import test from "node:test"
import { NextRequest } from "next/server"

import { createPersonalPlanFieldTestActivationHandler } from "../src/app/api/personal-plan/field-test/activate/route"

const leadId = "10000000-0000-4000-8000-000000000001"
const authorization = {
  campaignId: "20000000-0000-4000-8000-000000000002",
  funnelSessionId: "30000000-0000-4000-8000-000000000003",
  leadId,
  accessDurationHours: 168,
}

function request() {
  return new NextRequest("https://chaarlie.de/api/personal-plan/field-test/activate", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: "chaarlie_funnel_session=funnel; chaarlie_personal_plan_field_test=campaign",
      "x-forwarded-for": "203.0.113.10",
    },
    body: JSON.stringify({ leadId }),
  })
}

function baseOverrides() {
  return {
    checkRateLimit: async () => ({ allowed: true }),
    resolveFunnelCookieContext: async () => ({
      visitorId: "40000000-0000-4000-8000-000000000004",
      sessionId: authorization.funnelSessionId,
      packageKey: "meta_personal_plan_v1",
      issuedAt: Date.now(),
    }),
    resolveAuthorization: async () => authorization,
    isGuestRetry: async () => false,
  }
}

test("activation refuses an existing customer browser before creating or granting access", async () => {
  let createCalls = 0
  let activationCalls = 0
  const handler = createPersonalPlanFieldTestActivationHandler({
    ...baseOverrides(),
    createSession: () => ({
      auth: {
        getUser: async () => ({ data: { user: { id: "customer", app_metadata: {} } } }),
        signInWithPassword: async () => ({ error: null }),
      },
    }),
    createGuest: async () => {
      createCalls += 1
      return { userId: "guest", email: "guest@example.invalid", password: "secret" }
    },
    activate: async () => {
      activationCalls += 1
      return { enrollmentId: "enrollment", expiresAt: new Date().toISOString(), reused: false }
    },
  })

  const response = await handler(request())
  assert.equal(response.status, 409)
  assert.equal(createCalls, 0)
  assert.equal(activationCalls, 0)
})

test("activation creates and signs in one scoped guest before the exact service transaction", async () => {
  const calls: string[] = []
  const handler = createPersonalPlanFieldTestActivationHandler({
    ...baseOverrides(),
    createSession: (_request, response) => ({
      auth: {
        getUser: async () => ({ data: { user: null } }),
        signInWithPassword: async () => {
          calls.push("sign-in")
          response.cookies.set("sb-test-auth", "opaque", { httpOnly: true })
          return { error: null }
        },
      },
    }),
    createGuest: async (_dependencies, claim) => {
      assert.deepEqual(claim, {
        campaignId: authorization.campaignId,
        funnelSessionId: authorization.funnelSessionId,
        leadId,
      })
      calls.push("create-guest")
      return { userId: "guest", email: "guest@example.invalid", password: "secret" }
    },
    activate: async (input) => {
      calls.push("activate")
      assert.equal(input.userId, "guest")
      return { enrollmentId: "enrollment", expiresAt: new Date().toISOString(), reused: false }
    },
  })

  const response = await handler(request())
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { destination: `/plan-bereit?lead=${leadId}` })
  assert.deepEqual(calls, ["create-guest", "sign-in", "activate"])
  assert.match(response.headers.get("set-cookie") ?? "", /sb-test-auth=opaque/)
})

test("activation failure preserves the new guest session cookie for an exact retry", async () => {
  const handler = createPersonalPlanFieldTestActivationHandler({
    ...baseOverrides(),
    createSession: (_request, response) => ({
      auth: {
        getUser: async () => ({ data: { user: null } }),
        signInWithPassword: async () => {
          response.cookies.set("sb-test-auth", "opaque", { httpOnly: true })
          return { error: null }
        },
      },
    }),
    createGuest: async () => ({
      userId: "guest",
      email: "guest@example.invalid",
      password: "secret",
    }),
    activate: async () => {
      throw new Error("database unavailable")
    },
  })

  const response = await handler(request())
  assert.equal(response.status, 503)
  assert.match(response.headers.get("set-cookie") ?? "", /sb-test-auth=opaque/)
})

test("activation fails closed when the persistent rate limiter is unavailable", async () => {
  const handler = createPersonalPlanFieldTestActivationHandler({
    ...baseOverrides(),
    checkRateLimit: async () => ({ allowed: false, error: "service_unavailable" }),
  })
  const response = await handler(request())
  assert.equal(response.status, 503)
})
