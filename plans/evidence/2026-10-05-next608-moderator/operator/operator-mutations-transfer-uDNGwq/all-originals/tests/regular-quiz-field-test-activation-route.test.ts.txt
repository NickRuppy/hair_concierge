import assert from "node:assert/strict"
import test from "node:test"
import { NextRequest } from "next/server"

import { createRegularQuizFieldTestActivationHandler } from "../src/app/api/quiz/field-test/activate/route"

const leadId = "10000000-0000-4000-8000-000000000001"
const authorization = {
  campaignId: "20000000-0000-4000-8000-000000000002",
  funnelSessionId: "30000000-0000-4000-8000-000000000003",
  leadId,
  accessDurationHours: 168,
}

function request() {
  return new NextRequest("https://chaarlie.de/api/quiz/field-test/activate", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: "chaarlie_funnel_session=funnel; chaarlie_regular_quiz_field_test=campaign",
      "x-forwarded-for": "203.0.113.10",
    },
    body: JSON.stringify({ leadId }),
  })
}

function baseOverrides() {
  return {
    enabled: () => true,
    checkRateLimit: async () => ({ allowed: true }),
    resolveFunnelCookieContext: async () => ({
      visitorId: "40000000-0000-4000-8000-000000000004",
      sessionId: authorization.funnelSessionId,
      packageKey: "default_organic",
      issuedAt: Date.now(),
    }),
    resolveAuthorization: async () => authorization,
    isGuestRetry: async () => false,
  }
}

test("regular activation fails closed while the global field-test switch is disabled", async () => {
  let authorizationCalls = 0
  const handler = createRegularQuizFieldTestActivationHandler({
    ...baseOverrides(),
    enabled: () => false,
    resolveAuthorization: async () => {
      authorizationCalls += 1
      return authorization
    },
  })

  const response = await handler(request())
  assert.equal(response.status, 404)
  assert.equal(authorizationCalls, 0)
})

test("regular activation establishes a recoverable guest before atomic ownership and projection", async () => {
  const calls: string[] = []
  const handler = createRegularQuizFieldTestActivationHandler({
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
      assert.equal(input.userId, "guest")
      calls.push("activate")
      return { enrollmentId: "enrollment", expiresAt: new Date().toISOString(), reused: false }
    },
    linkQuizToProfile: async (userId, email, exactLeadId) => {
      assert.equal(userId, "guest")
      assert.equal(email, "guest@example.invalid")
      assert.equal(exactLeadId, leadId)
      calls.push("project")
    },
  })

  const response = await handler(request())
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { destination: `/plan-bereit?lead=${leadId}` })
  assert.deepEqual(calls, ["create-guest", "sign-in", "activate", "project"])
  assert.match(response.headers.get("set-cookie") ?? "", /sb-test-auth=opaque/)
})

test("regular activation rejects an existing customer before guest or access writes", async () => {
  let createCalls = 0
  let activationCalls = 0
  const handler = createRegularQuizFieldTestActivationHandler({
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

test("regular activation preserves the guest session when profile projection fails", async () => {
  let signInCalls = 0
  const handler = createRegularQuizFieldTestActivationHandler({
    ...baseOverrides(),
    createSession: (_request, response) => ({
      auth: {
        getUser: async () => ({ data: { user: null } }),
        signInWithPassword: async () => {
          signInCalls += 1
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
    activate: async () => ({
      enrollmentId: "enrollment",
      expiresAt: new Date().toISOString(),
      reused: false,
    }),
    linkQuizToProfile: async () => {
      throw new Error("projection unavailable")
    },
  })

  const response = await handler(request())
  assert.equal(response.status, 503)
  assert.equal(signInCalls, 1)
  assert.match(response.headers.get("set-cookie") ?? "", /sb-test-auth=opaque/)
})
