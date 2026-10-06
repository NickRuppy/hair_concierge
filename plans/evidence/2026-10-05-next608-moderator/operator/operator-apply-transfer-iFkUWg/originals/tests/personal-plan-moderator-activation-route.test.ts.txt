import assert from "node:assert/strict"
import test from "node:test"
import { NextRequest } from "next/server"

import { createPersonalPlanModeratorActivationHandler } from "../src/app/api/personal-plan/field-test/moderator/activate/route"

const leadId = "10000000-0000-4000-8000-000000000001"
const campaignId = "20000000-0000-4000-8000-000000000002"
const sessionId = "30000000-0000-4000-8000-000000000003"
const userId = "50000000-0000-4000-8000-000000000005"

function request(body: unknown = { leadId }) {
  return new NextRequest("https://chaarlie.de/api/personal-plan/field-test/moderator/activate", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie:
        "chaarlie_funnel_session=funnel; chaarlie_personal_plan_field_test=campaign; chaarlie_personal_plan_moderator_intent=intent",
      "x-forwarded-for": "203.0.113.10",
    },
    body: JSON.stringify(body),
  })
}

function requestWithOrigin(origin: string) {
  return new NextRequest("https://chaarlie.de/api/personal-plan/field-test/moderator/activate", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie:
        "chaarlie_funnel_session=funnel; chaarlie_personal_plan_field_test=campaign; chaarlie_personal_plan_moderator_intent=intent",
      origin,
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
      sessionId,
      packageKey: "meta_personal_plan_v1",
      issuedAt: Date.now(),
    }),
    createSession: () => ({
      auth: {
        getUser: async () => ({
          data: {
            user: {
              id: userId,
              email: "mod@example.com",
              email_confirmed_at: "2026-08-27T09:00:00Z",
            },
          },
        }),
      },
    }),
    resolveModeratorIntent: async () => ({
      kind: "ready" as const,
      intent: {
        campaignId,
        userId,
        funnelSessionId: sessionId,
        leadId,
        issuedAt: Date.now(),
        expiresAt: Date.now() + 60_000,
      },
      campaign: { id: campaignId, expiresAt: Date.now() + 60_000, accessDurationHours: 2160 },
      member: {
        id: "60000000-0000-4000-8000-000000000006",
        userId,
      },
    }),
    resolveAuthorization: async () => ({
      campaignId,
      funnelSessionId: sessionId,
      leadId,
      accessDurationHours: 2160,
    }),
  }
}

test("moderator activation requires an authenticated verified intent before allowing email-bound offer activation", async () => {
  const calls: Array<Record<string, unknown>> = []
  const handler = createPersonalPlanModeratorActivationHandler({
    ...baseOverrides(),
    resolveAuthorization: async (input) => {
      calls.push(input)
      return {
        campaignId,
        funnelSessionId: sessionId,
        leadId,
        accessDurationHours: 2160,
      }
    },
    activate: async (input) => {
      calls.push(input)
      return { enrollmentId: "enrollment", expiresAt: "2026-11-25T09:00:00.000Z", reused: false }
    },
  })

  const response = await handler(request())
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { destination: `/plan-bereit?lead=${leadId}` })
  assert.equal(calls[0].allowEmailBound, true)
  assert.deepEqual(calls[1], {
    campaignId,
    funnelSessionId: sessionId,
    leadId,
    userId,
    confirmedEmail: "mod@example.com",
    eventId: calls[1].eventId,
  })
  assert.equal(typeof calls[1].eventId, "string")
})

test("moderator activation never creates a guest and fails closed for wrong or missing accounts", async () => {
  let activationCalls = 0
  const handler = createPersonalPlanModeratorActivationHandler({
    ...baseOverrides(),
    resolveModeratorIntent: async () => ({ kind: "forbidden" as const, reason: "email_mismatch" }),
    activate: async () => {
      activationCalls += 1
      return { enrollmentId: "enrollment", expiresAt: "2026-11-25T09:00:00.000Z", reused: false }
    },
  })

  const response = await handler(request())
  assert.equal(response.status, 403)
  assert.equal(activationCalls, 0)
})

test("moderator activation replay for an active member does not depend on campaign admission capacity", async () => {
  let authorizationCalls = 0
  let activationCalls = 0
  const handler = createPersonalPlanModeratorActivationHandler({
    ...baseOverrides(),
    resolveModeratorIntent: async () => ({
      kind: "active" as const,
      intent: {
        campaignId,
        userId,
        funnelSessionId: sessionId,
        leadId,
        issuedAt: Date.now(),
        expiresAt: Date.now() + 60_000,
      },
      campaignId,
      expiresAt: "2026-11-25T09:00:00.000Z",
      member: {
        id: "60000000-0000-4000-8000-000000000006",
        userId,
      },
    }),
    resolveAuthorization: async () => {
      authorizationCalls += 1
      return null
    },
    activate: async (input) => {
      activationCalls += 1
      assert.equal(input.campaignId, campaignId)
      assert.equal(input.funnelSessionId, sessionId)
      assert.equal(input.leadId, leadId)
      return { enrollmentId: "enrollment", expiresAt: "2026-11-25T09:00:00.000Z", reused: true }
    },
  })

  const response = await handler(request())
  assert.equal(response.status, 200)
  assert.equal(authorizationCalls, 0)
  assert.equal(activationCalls, 1)
})

test("moderator activation rejects cross-origin posts before touching auth or activation", async () => {
  let authCalls = 0
  let activationCalls = 0
  const handler = createPersonalPlanModeratorActivationHandler({
    ...baseOverrides(),
    createSession: () => {
      authCalls += 1
      return baseOverrides().createSession()
    },
    activate: async () => {
      activationCalls += 1
      return { enrollmentId: "enrollment", expiresAt: "2026-11-25T09:00:00.000Z", reused: false }
    },
  })

  const response = await handler(requestWithOrigin("https://attacker.example"))
  assert.equal(response.status, 403)
  assert.equal(authCalls, 0)
  assert.equal(activationCalls, 0)
})

test("moderator activation returns controlled unavailable JSON when auth lookup fails", async () => {
  const handler = createPersonalPlanModeratorActivationHandler({
    ...baseOverrides(),
    createSession: () => ({
      auth: {
        getUser: async () => {
          throw new Error("auth unavailable")
        },
      },
    }),
  })

  const response = await handler(request())
  assert.equal(response.status, 503)
  assert.deepEqual(await response.json(), { error: "Testzugang konnte nicht aktiviert werden" })
})

test("moderator activation distinguishes an absent session from an Auth outage", async () => {
  const handler = createPersonalPlanModeratorActivationHandler({
    ...baseOverrides(),
    createSession: () => ({ auth: { getUser: async () => ({ data: { user: null } }) } }),
  })
  assert.equal((await handler(request())).status, 401)
})

test("organic moderator activation uses the owned legacy result and never the Meta package", async () => {
  const overrides = baseOverrides()
  let activated = 0
  const handler = createPersonalPlanModeratorActivationHandler({
    ...overrides,
    packageKey: "default_organic",
    resolveFunnelCookieContext: async () => ({
      ...(await overrides.resolveFunnelCookieContext()),
      packageKey: "default_organic",
    }),
    activate: async (input) => {
      activated++
      assert.equal(input.userId, userId)
      assert.equal(input.leadId, leadId)
      return { enrollmentId: "enrollment", expiresAt: "2026-11-25T09:00:00.000Z", reused: false }
    },
  })
  const response = await handler(request())
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { destination: `/plan-bereit?lead=${leadId}` })
  assert.equal(activated, 1)
  const wrongPackage = createPersonalPlanModeratorActivationHandler({
    ...overrides,
    packageKey: "default_organic",
    activate: async () => {
      throw Error("must not activate Meta on organic endpoint")
    },
  })
  assert.equal((await wrongPackage(request())).status, 403)
})
