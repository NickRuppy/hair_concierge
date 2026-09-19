import assert from "node:assert/strict"
import test from "node:test"

import { createQuizEmailReturnChoiceHandler } from "../src/app/api/quiz/email-return/choose/route"
import { decodeFunnelContext, FUNNEL_SESSION_COOKIE } from "../src/lib/funnel/cookie"

const leadId = "22222222-2222-4222-8222-222222222222"
const secret = "test-secret-with-at-least-thirty-two-characters"

test("Continue binds the exact saved lead to a fresh email session, without quiz completion", async () => {
  const oldSecret = process.env.FUNNEL_COOKIE_SIGNING_SECRET
  process.env.FUNNEL_COOKIE_SIGNING_SECRET = secret
  const events: Array<{
    milestone: string
    leadId?: string | null
    context: { sessionId: string; packageKey: string }
    properties?: Record<string, unknown>
  }> = []
  try {
    const post = createQuizEmailReturnChoiceHandler({
      enabled: () => true,
      cookieStore: async () => ({ get: () => ({ value: "signed-link-cookie" }) }) as never,
      resolveSource: async (value) => {
        assert.equal(value, "signed-link-cookie")
        return {
          status: "resolved",
          linkId: "11111111-1111-4111-8111-111111111111",
          leadId,
          quizKind: "legacy",
          campaignKey: "sunday_reminder",
        }
      },
      resolvePrevious: async () => null,
      rateLimit: async () => ({ allowed: true }),
      record: async (input) => {
        events.push(input)
        return [{ inserted: true }] as never
      },
    })
    const response = await post(
      new Request("https://example.com/api/quiz/email-return/choose", {
        method: "POST",
        headers: { origin: "https://example.com", "content-type": "application/json" },
        body: JSON.stringify({ choice: "continue" }),
      }),
    )
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), {
      status: "continue",
      destination: `/result/${leadId}`,
    })
    assert.equal(events.length, 1)
    assert.equal(events[0].milestone, "landing_viewed")
    assert.equal(events[0].leadId, leadId)
    assert.equal(events[0].properties?.return_choice, "continue")
    assert.equal(events[0].context.packageKey, "customerio_scan_return_v1")
    const cookie = response.cookies.get(FUNNEL_SESSION_COOKIE)
    assert.ok(cookie)
    const session = await decodeFunnelContext(cookie.value, secret)
    assert.equal(session?.sessionId, events[0].context.sessionId)
  } finally {
    if (oldSecret === undefined) delete process.env.FUNNEL_COOKIE_SIGNING_SECRET
    else process.env.FUNNEL_COOKIE_SIGNING_SECRET = oldSecret
  }
})

test("Edit creates an unbound session and returns only prefilled quiz answers", async () => {
  const oldSecret = process.env.FUNNEL_COOKIE_SIGNING_SECRET
  process.env.FUNNEL_COOKIE_SIGNING_SECRET = secret
  let recordedLeadId: string | null | undefined = "unset"
  try {
    const post = createQuizEmailReturnChoiceHandler({
      enabled: () => true,
      cookieStore: async () => ({ get: () => ({ value: "signed-link-cookie" }) }) as never,
      resolveSource: async () => ({
        status: "resolved",
        linkId: "11111111-1111-4111-8111-111111111111",
        leadId,
        quizKind: "legacy",
        campaignKey: "sunday_reminder",
      }),
      resolvePrevious: async () => null,
      rateLimit: async () => ({ allowed: true }),
      loadLead: async () =>
        ({
          data: {
            id: leadId,
            quiz_kind: "legacy",
            quiz_answers: { structure: "wavy", hair_length: "made-up" },
          },
          error: null,
        }) as never,
      record: async (input) => {
        recordedLeadId = input.leadId
        return [{ inserted: true }] as never
      },
    })
    const response = await post(
      new Request("https://example.com/api/quiz/email-return/choose", {
        method: "POST",
        headers: { origin: "https://example.com", "content-type": "application/json" },
        body: JSON.stringify({ choice: "edit" }),
      }),
    )
    assert.equal(response.status, 200)
    assert.equal(recordedLeadId, null)
    assert.deepEqual(await response.json(), { status: "edit", answers: { structure: "wavy" } })
  } finally {
    if (oldSecret === undefined) delete process.env.FUNNEL_COOKIE_SIGNING_SECRET
    else process.env.FUNNEL_COOKIE_SIGNING_SECRET = oldSecret
  }
})
