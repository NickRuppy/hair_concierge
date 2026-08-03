import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import { EMAIL_DELIVERABILITY_REJECTION_MESSAGE } from "../src/lib/email-deliverability-shared"
import {
  createWaitlistPostHandler,
  WAITLIST_SIGNUP_RATE_LIMIT,
} from "../src/app/api/waitlist/route"
import {
  createWaitlistSurveyPostHandler,
  WAITLIST_SURVEY_RATE_LIMIT,
} from "../src/app/api/waitlist/survey/route"
import {
  handleWaitlistCustomerIoReconcile,
  maxDuration,
} from "../src/app/api/customerio/waitlist-sync/reconcile/route"
import { waitlistCronBearerMatches } from "../src/lib/waitlist/api-auth"

const request = (body: unknown, headers?: HeadersInit) =>
  new Request("https://example.com/api/waitlist", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  })

const signupBody = { firstName: "Ada", email: "ada@example.com", marketingConsent: true }
const deliverable = { ok: true as const, normalized: "ada@example.com", outcome: "mx" as const }

function signupHandler(overrides: Record<string, unknown> = {}) {
  const scheduled: Array<() => unknown> = []
  return {
    scheduled,
    handler: createWaitlistPostHandler({
      checkRateLimit: async () => ({ allowed: true }),
      checkEmailDeliverability: async () => deliverable,
      createAdminClient: () => ({}) as never,
      saveWaitlistSignup: async () => ({
        signupId: "signup-1",
        surveyToken: "x".repeat(43),
        duplicate: false,
        surveyAlreadyCompleted: false,
      }),
      dispatchWaitlistCustomerIoForSignup: async () => undefined,
      schedule: (callback: () => unknown) => {
        scheduled.push(callback)
      },
      ...overrides,
    } as never),
  }
}

test("waitlist signup rejects malformed data", async () => {
  let checks = 0
  const { handler } = signupHandler({
    checkEmailDeliverability: async () => {
      checks += 1
      return deliverable
    },
  })

  const response = await handler(
    request({ firstName: "", email: "not-an-email", marketingConsent: true }),
  )
  assert.equal(response.status, 400)
  assert.equal(checks, 0)
})

test("waitlist signup requires explicit email consent", async () => {
  const { handler } = signupHandler()
  const response = await handler(request({ firstName: "Ada", email: "ada@example.com" }))
  assert.equal(response.status, 400)
})

test("waitlist signup accepts only bounded canonical attribution fields", async () => {
  let saved: Record<string, unknown> | undefined
  const { handler } = signupHandler({
    saveWaitlistSignup: async (_supabase: unknown, input: Record<string, unknown>) => {
      saved = input
      return {
        signupId: "signup-1",
        surveyToken: "x".repeat(43),
        duplicate: false,
        surveyAlreadyCompleted: false,
      }
    },
  })
  const accepted = await handler(
    request({ ...signupBody, attribution: { utmSource: " instagram ", utmCampaign: "launch" } }),
  )
  assert.equal(accepted.status, 200)
  assert.deepEqual(saved?.attribution, { utmSource: "instagram", utmCampaign: "launch" })

  const rejected = await handler(
    request({ ...signupBody, attribution: { email: "ada@example.com" } }),
  )
  assert.equal(rejected.status, 400)
})

test("waitlist signup returns a correction response before persistence", async () => {
  let saves = 0
  const { handler } = signupHandler({
    checkEmailDeliverability: async () => ({
      ok: false,
      reason: "no_mx",
      suggestion: "ada@gmail.com",
    }),
    saveWaitlistSignup: async () => {
      saves += 1
      throw new Error("must not save")
    },
  })

  const response = await handler(request(signupBody))
  assert.equal(response.status, 422)
  assert.deepEqual(await response.json(), {
    error: EMAIL_DELIVERABILITY_REJECTION_MESSAGE,
    reason: "no_mx",
    suggestion: "ada@gmail.com",
  })
  assert.equal(saves, 0)
})

test("waitlist signup distinguishes exhausted and unavailable rate limiting", async () => {
  assert.notEqual(WAITLIST_SIGNUP_RATE_LIMIT.prefix, WAITLIST_SURVEY_RATE_LIMIT.prefix)
  for (const [rateLimit, expected] of [
    [{ allowed: false }, 429],
    [{ allowed: false, error: "service_unavailable" }, 503],
  ] as const) {
    const { handler } = signupHandler({ checkRateLimit: async () => rateLimit })
    const response = await handler(request(signupBody))
    assert.equal(response.status, expected)
  }
})

test("waitlist signup fails closed when its rate-limit service throws", async () => {
  const { handler } = signupHandler({
    checkRateLimit: async () => {
      throw new Error("unavailable")
    },
  })
  const response = await handler(request(signupBody))
  assert.equal(response.status, 503)
})

test("waitlist signup succeeds only after persistence and defers Customer.io", async () => {
  const calls: string[] = []
  const { handler, scheduled } = signupHandler({
    saveWaitlistSignup: async (_supabase: unknown, input: Record<string, unknown>) => {
      calls.push(`save:${input.email}`)
      return {
        signupId: "signup-1",
        surveyToken: "x".repeat(43),
        duplicate: false,
        surveyAlreadyCompleted: false,
      }
    },
    dispatchWaitlistCustomerIoForSignup: async () => {
      calls.push("dispatch")
      throw new Error("temporary Customer.io failure")
    },
  })

  const response = await handler(request(signupBody, { "x-forwarded-for": "198.51.100.8" }))
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), {
    ok: true,
    surveyToken: "x".repeat(43),
    duplicate: false,
    surveyAlreadyCompleted: false,
  })
  assert.deepEqual(calls, ["save:ada@example.com"])
  assert.equal(scheduled.length, 1)
  await scheduled[0]()
  assert.deepEqual(calls, ["save:ada@example.com", "dispatch"])
})

test("waitlist signup treats duplicate retry as a durable success", async () => {
  const { handler } = signupHandler({
    saveWaitlistSignup: async () => ({
      signupId: "signup-1",
      duplicate: true,
      surveyAlreadyCompleted: false,
    }),
  })
  const response = await handler(request(signupBody))
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), {
    ok: true,
    duplicate: true,
    surveyAlreadyCompleted: false,
  })
})

test("completed duplicate signup returns no dead survey token", async () => {
  const { handler } = signupHandler({
    saveWaitlistSignup: async () => ({
      signupId: "signup-1",
      duplicate: true,
      surveyAlreadyCompleted: true,
    }),
  })
  const response = await handler(request(signupBody))
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), {
    ok: true,
    duplicate: true,
    surveyAlreadyCompleted: true,
  })
})

test("waitlist signup reports persistence failures without PII", async () => {
  const { handler } = signupHandler({
    saveWaitlistSignup: async () => {
      throw new Error("ada@example.com database failure")
    },
  })
  const response = await handler(request(signupBody))
  assert.equal(response.status, 500)
  assert.deepEqual(await response.json(), { error: "Dein Platz konnte nicht gespeichert werden." })
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

test("waitlist Customer.io cron is protected and scheduled", async () => {
  let calls = 0
  const forbidden = await handleWaitlistCustomerIoReconcile(new Request("https://example.com"), {
    supabase: {} as never,
    cronSecret: "secret",
    dispatchDue: async () => {
      calls += 1
      return { processed: 0, delivered: 0, failed: 0 }
    },
  })
  assert.equal(forbidden.status, 401)
  assert.equal(calls, 0)

  const allowed = await handleWaitlistCustomerIoReconcile(
    new Request("https://example.com", { headers: { authorization: "Bearer secret" } }),
    {
      supabase: {} as never,
      cronSecret: "secret",
      dispatchDue: async (_supabase, options) => {
        calls += 1
        assert.deepEqual(options, { limit: 10 })
        return { processed: 3, delivered: 2, failed: 1 }
      },
    },
  )
  assert.equal(maxDuration, 60)
  assert.deepEqual(allowed, { status: 200, body: { processed: 3, delivered: 2, failed: 1 } })

  const config = JSON.parse(readFileSync("vercel.json", "utf8")) as { crons: unknown[] }
  assert.deepEqual(config.crons.at(-1), {
    path: "/api/customerio/waitlist-sync/reconcile",
    schedule: "45 * * * *",
  })
})

test("waitlist cron bearer verification rejects missing and wrong-length secrets", () => {
  assert.equal(waitlistCronBearerMatches(null, "secret"), false)
  assert.equal(waitlistCronBearerMatches("Bearer x", "a-much-longer-secret"), false)
  assert.equal(waitlistCronBearerMatches("Bearer secret", "secret"), true)
})
