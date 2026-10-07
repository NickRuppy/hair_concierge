import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import test from "node:test"

import { createWaitlistPostHandler } from "../src/app/api/waitlist/route"
import { createWaitlistSurveyPostHandler } from "../src/app/api/waitlist/survey/route"
import {
  createWaitlistSurveyAccessGetHandler,
  WAITLIST_SURVEY_ACCESS_RATE_LIMIT,
} from "../src/app/api/waitlist/survey-access/route"
import { WAITLIST_SURVEY_ACCESS_MAX_AGE_SECONDS } from "../src/lib/waitlist/survey-access"

const request = (body: unknown, headers?: HeadersInit) =>
  new Request("https://example.com/api/waitlist", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  })

test("waitlist signup is a dependency-free retired endpoint", async () => {
  const response = await createWaitlistPostHandler()(request({ unexpected: "ignored" }))
  assert.equal(response.status, 410)
  assert.deepEqual(await response.json(), {
    error: "Die Anmeldung zur Warteliste ist geschlossen.",
  })
})

test("survey email access exchanges a valid capability for a narrow cookie and clean redirect", async () => {
  const tokenHash = "a".repeat(64)
  const handler = createWaitlistSurveyAccessGetHandler({
    checkRateLimit: async () => ({ allowed: true }),
  })
  const response = await handler(
    new Request(`https://chaarlie.de/api/waitlist/survey-access?token=${tokenHash}`, {
      headers: { "x-forwarded-for": "198.51.100.8" },
    }),
  )

  assert.equal(response.status, 303)
  assert.equal(response.headers.get("location"), "https://chaarlie.de/warteliste/umfrage")
  assert.equal(response.headers.get("cache-control"), "no-store")
  assert.equal(response.headers.get("referrer-policy"), "no-referrer")
  const cookie = response.headers.get("set-cookie") ?? ""
  assert.match(cookie, new RegExp(`chaarlie_waitlist_survey_access=${tokenHash}`))
  assert.match(cookie, /HttpOnly/i)
  assert.match(cookie, /Secure/i)
  assert.match(cookie, /SameSite=Lax/i)
  assert.match(cookie, /Path=\/api\/waitlist\/survey(?:;|$)/i)
  assert.match(cookie, new RegExp(`Max-Age=${WAITLIST_SURVEY_ACCESS_MAX_AGE_SECONDS}`))
})

test("survey email access rejects malformed capabilities and rate-limit failures", async () => {
  const malformed = createWaitlistSurveyAccessGetHandler({
    checkRateLimit: async () => ({ allowed: true }),
  })
  const malformedResponse = await malformed(
    new Request("https://chaarlie.de/api/waitlist/survey-access?token=not-a-token"),
  )
  assert.equal(malformedResponse.status, 400)
  assert.equal(malformedResponse.headers.get("set-cookie"), null)

  for (const [rateLimit, status] of [
    [{ allowed: false }, 429],
    [{ allowed: false, error: "service_unavailable" }, 503],
  ] as const) {
    const limited = createWaitlistSurveyAccessGetHandler({
      checkRateLimit: async () => rateLimit,
    })
    const response = await limited(
      new Request(`https://chaarlie.de/api/waitlist/survey-access?token=${"a".repeat(64)}`),
    )
    assert.equal(response.status, status)
    assert.equal(response.headers.get("set-cookie"), null)
  }

  const unavailable = createWaitlistSurveyAccessGetHandler({
    checkRateLimit: async () => {
      throw new Error("unavailable")
    },
  })
  const unavailableResponse = await unavailable(
    new Request(`https://chaarlie.de/api/waitlist/survey-access?token=${"a".repeat(64)}`),
  )
  assert.equal(unavailableResponse.status, 503)
  assert.equal(unavailableResponse.headers.get("set-cookie"), null)
})

test("survey accepts only opaque token association and schedules delivery idempotently", async () => {
  const scheduled: Array<() => unknown> = []
  const handler = createWaitlistSurveyPostHandler({
    checkRateLimit: async () => ({ allowed: true }),
    createAdminClient: () => ({}) as never,
    recordWaitlistSurvey: async (_supabase: unknown, input: Record<string, unknown>) => {
      assert.deepEqual(input, { opaqueToken: "t".repeat(43), responseId: "typeform-response-1" })
      return { signupId: "signup-1", recorded: true }
    },
    dispatchWaitlistCustomerIoForSignup: async () => undefined,
    schedule: (callback: () => unknown) => scheduled.push(callback),
  } as never)

  const response = await handler(
    request({ opaqueToken: "t".repeat(43), responseId: "typeform-response-1" }),
  )
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { ok: true })
  assert.equal(scheduled.length, 1)
})

test("survey accepts the narrow email-access cookie and clears it after success", async () => {
  const tokenHash = "a".repeat(64)
  let recorded: Record<string, unknown> | undefined
  const handler = createWaitlistSurveyPostHandler({
    checkRateLimit: async () => ({ allowed: true }),
    createAdminClient: () => ({}) as never,
    recordWaitlistSurvey: async (_supabase: unknown, input: Record<string, unknown>) => {
      recorded = input
      return { signupId: "signup-1", recorded: true }
    },
    dispatchWaitlistCustomerIoForSignup: async () => undefined,
    schedule: () => undefined,
  } as never)

  const response = await handler(
    request(
      { responseId: "typeform-response-1" },
      { cookie: `chaarlie_waitlist_survey_access=${tokenHash}` },
    ),
  )
  assert.equal(response.status, 200)
  assert.deepEqual(recorded, { tokenHash, responseId: "typeform-response-1" })
  assert.match(response.headers.get("set-cookie") ?? "", /chaarlie_waitlist_survey_access=;/)
  assert.match(response.headers.get("set-cookie") ?? "", /Max-Age=0/i)
})

test("survey prefers the same-tab opaque token over an email-access cookie", async () => {
  let recorded: Record<string, unknown> | undefined
  const handler = createWaitlistSurveyPostHandler({
    checkRateLimit: async () => ({ allowed: true }),
    createAdminClient: () => ({}) as never,
    recordWaitlistSurvey: async (_supabase: unknown, input: Record<string, unknown>) => {
      recorded = input
      return { signupId: "signup-1", recorded: true }
    },
    dispatchWaitlistCustomerIoForSignup: async () => undefined,
    schedule: () => undefined,
  } as never)

  const response = await handler(
    request(
      { opaqueToken: "t".repeat(43), responseId: "typeform-response-1" },
      { cookie: `chaarlie_waitlist_survey_access=${"a".repeat(64)}` },
    ),
  )
  assert.equal(response.status, 200)
  assert.deepEqual(recorded, {
    opaqueToken: "t".repeat(43),
    responseId: "typeform-response-1",
  })
})

test("survey rejects a missing or malformed association cookie", async () => {
  let calls = 0
  const handler = createWaitlistSurveyPostHandler({
    checkRateLimit: async () => ({ allowed: true }),
    createAdminClient: () => ({}) as never,
    recordWaitlistSurvey: async () => {
      calls += 1
      return { signupId: "signup-1", recorded: true }
    },
  } as never)

  for (const headers of [undefined, { cookie: "chaarlie_waitlist_survey_access=invalid" }]) {
    const response = await handler(request({ responseId: "typeform-response-1" }, headers))
    assert.equal(response.status, 400)
  }
  assert.equal(calls, 0)
})

test("survey rejects forged or stale opaque tokens without scheduling delivery", async () => {
  let scheduled = 0
  const handler = createWaitlistSurveyPostHandler({
    checkRateLimit: async () => ({ allowed: true }),
    createAdminClient: () => ({}) as never,
    recordWaitlistSurvey: async () => ({ signupId: "", recorded: false }),
    dispatchWaitlistCustomerIoForSignup: async () => undefined,
    schedule: () => {
      scheduled += 1
    },
  } as never)
  const response = await handler(request({ opaqueToken: "f".repeat(43), responseId: "response" }))
  assert.equal(response.status, 404)
  assert.equal(scheduled, 0)
})

test("survey rejects untrusted identity fields instead of treating Typeform as an entitlement webhook", async () => {
  let calls = 0
  const handler = createWaitlistSurveyPostHandler({
    checkRateLimit: async () => ({ allowed: true }),
    createAdminClient: () => ({}) as never,
    recordWaitlistSurvey: async () => {
      calls += 1
      return { signupId: "signup-1", recorded: true }
    },
    dispatchWaitlistCustomerIoForSignup: async () => undefined,
  } as never)
  const response = await handler(
    request({
      opaqueToken: "t".repeat(43),
      responseId: "client-callback",
      email: "forged@example.com",
    }),
  )
  assert.equal(response.status, 400)
  assert.equal(calls, 0)
})

test("waitlist Customer.io delivery has no scheduled reconciliation endpoint", () => {
  const config = JSON.parse(readFileSync("vercel.json", "utf8")) as {
    crons: Array<{ path: string }>
  }
  assert.equal(
    config.crons.some(({ path }) => path === "/api/customerio/waitlist-sync/reconcile"),
    false,
  )
  assert.equal(existsSync("src/app/api/customerio/waitlist-sync/reconcile/route.ts"), false)
  assert.equal(existsSync("src/lib/waitlist/api-auth.ts"), false)
})
