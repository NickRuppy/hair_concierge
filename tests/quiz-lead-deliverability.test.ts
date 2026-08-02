import assert from "node:assert/strict"
import test from "node:test"

import { createQuizLeadPostHandler } from "../src/app/api/quiz/lead/route"
import { EMAIL_DELIVERABILITY_REJECTION_MESSAGE } from "../src/lib/email-deliverability-shared"

const requestBody = {
  name: "Legacy Test",
  email: "LEGACY@example.com",
  marketingConsent: false,
  quizAnswers: {
    structure: "wavy",
    thickness: "fine",
    density: "medium",
    hair_length: "medium",
    fingertest: "leicht_uneben",
    pulltest: "stretches_bounces",
    scalp_type: "ausgeglichen",
    has_scalp_issue: false,
    concerns: ["dryness"],
    treatment: ["natur"],
    goals: ["shine"],
  },
} as const

test("legacy lead rejects a definitively undeliverable address before persistence", async () => {
  let checkedEmail: string | undefined
  let recorded = false
  let adminClientCreated = false
  const handler = createQuizLeadPostHandler({
    checkRateLimit: async () => ({ allowed: true }),
    checkEmailDeliverability: async (email) => {
      checkedEmail = email
      return { ok: false, reason: "no_mx", suggestion: "legacy@gmail.com" }
    },
    recordEmailDeliverabilityOutcome: () => {
      recorded = true
    },
    createAdminClient: (() => {
      adminClientCreated = true
      throw new Error("persistence must not run")
    }) as typeof import("../src/lib/supabase/admin").createAdminClient,
  })

  const response = await handler(
    new Request("https://chaarlie.de/api/quiz/lead", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.20" },
      body: JSON.stringify(requestBody),
    }),
  )

  assert.equal(response.status, 422)
  assert.equal(checkedEmail, "legacy@example.com")
  assert.equal(recorded, true)
  assert.equal(adminClientCreated, false)
  assert.deepEqual(await response.json(), {
    error: EMAIL_DELIVERABILITY_REJECTION_MESSAGE,
    reason: "no_mx",
    suggestion: "legacy@gmail.com",
  })
})

test("legacy lead passes a normalized fail-open address into persistence", async (context) => {
  const errorLog = context.mock.method(console, "error", () => {})
  let queriedEmail: unknown
  const handler = createQuizLeadPostHandler({
    checkRateLimit: async () => ({ allowed: true }),
    checkEmailDeliverability: async () => ({
      ok: true,
      normalized: "canonical@gmail.com",
      outcome: "fail_open",
    }),
    recordEmailDeliverabilityOutcome: () => {},
    cookies: (async () => ({ get: () => undefined })) as typeof import("next/headers").cookies,
    createAdminClient: (() => ({
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: (_column: string, value: unknown) => {
              queriedEmail = value
              return {
                gte: () => ({
                  order: () => ({
                    limit: async () => {
                      throw new Error("stop after persistence boundary")
                    },
                  }),
                }),
              }
            },
          }),
        }),
      }),
    })) as unknown as typeof import("../src/lib/supabase/admin").createAdminClient,
  })

  await handler(
    new Request("https://chaarlie.de/api/quiz/lead", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.20" },
      body: JSON.stringify(requestBody),
    }),
  )

  assert.equal(queriedEmail, "canonical@gmail.com")
  assert.equal(errorLog.mock.callCount(), 1)
})
