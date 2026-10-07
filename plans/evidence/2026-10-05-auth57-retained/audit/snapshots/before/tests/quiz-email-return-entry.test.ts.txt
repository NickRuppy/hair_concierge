import assert from "node:assert/strict"
import test from "node:test"

import { NextRequest } from "next/server"

import { createQuizEmailReturnEntryHandler } from "../src/app/quiz/return/route"
import {
  decodeQuizEmailReturnContext,
  QUIZ_EMAIL_RETURN_COOKIE,
} from "../src/lib/quiz/email-return-context"

const secret = "test-secret-with-at-least-thirty-two-characters"
const token = "a".repeat(43)
const linkId = "11111111-1111-4111-8111-111111111111"
const leadId = "22222222-2222-4222-8222-222222222222"

test("valid email link strips the token and scopes a return cookie without opening a funnel", async () => {
  const oldSecret = process.env.FUNNEL_COOKIE_SIGNING_SECRET
  process.env.FUNNEL_COOKIE_SIGNING_SECRET = secret
  let rateCalls = 0
  let resolveCalls = 0
  try {
    const get = createQuizEmailReturnEntryHandler({
      enabled: () => true,
      rateLimit: async () => {
        rateCalls += 1
        return { allowed: true }
      },
      resolve: async (value) => {
        resolveCalls += 1
        assert.equal(value, token)
        return {
          status: "resolved",
          linkId,
          leadId,
          quizKind: "legacy",
          campaignKey: "sunday_reactivation",
          packageKey: "customerio_scan_return_v1",
        }
      },
    })
    const response = await get(new NextRequest(`https://example.com/quiz/return?token=${token}`))
    assert.equal(response.status, 303)
    assert.equal(response.headers.get("location"), "https://example.com/quiz?return=ready")
    assert.equal(response.headers.get("cache-control"), "private, no-store")
    assert.equal(response.headers.get("referrer-policy"), "no-referrer")
    const context = response.cookies.get(QUIZ_EMAIL_RETURN_COOKIE)
    assert.ok(context)
    assert.deepEqual(decodeQuizEmailReturnContext(context.value, secret), { linkId })
    assert.equal(context.value.includes(token), false)
    assert.equal(rateCalls, 1)
    assert.equal(resolveCalls, 1)
  } finally {
    if (oldSecret === undefined) delete process.env.FUNNEL_COOKIE_SIGNING_SECRET
    else process.env.FUNNEL_COOKIE_SIGNING_SECRET = oldSecret
  }
})

test("prefetch and disabled entry do not resolve a bearer credential", async () => {
  let calls = 0
  const get = createQuizEmailReturnEntryHandler({
    enabled: () => false,
    rateLimit: async () => {
      calls += 1
      return { allowed: true }
    },
    resolve: async () => {
      calls += 1
      throw new Error("must not resolve")
    },
  })
  const prefetch = await get(
    new NextRequest(`https://example.com/quiz/return?token=${token}`, {
      headers: { purpose: "prefetch" },
    }),
  )
  assert.equal(prefetch.status, 204)
  const disabled = await get(new NextRequest(`https://example.com/quiz/return?token=${token}`))
  assert.equal(disabled.status, 303)
  assert.equal(disabled.headers.get("location"), "https://example.com/quiz?return=invalid")
  assert.equal(calls, 0)
})
