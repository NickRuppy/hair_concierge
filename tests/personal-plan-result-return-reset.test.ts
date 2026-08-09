import assert from "node:assert/strict"
import test from "node:test"

import { NextResponse } from "next/server"

import {
  createPersonalPlanResultReturnResetPostHandler,
  resetPersonalPlanServerCapabilities,
} from "../src/app/api/quiz/personal-plan-result-return/reset/route"
import {
  createPersonalPlanResultReturnCredential,
  PERSONAL_PLAN_RESULT_RETURN_COOKIE,
} from "../src/lib/personal-plan-quiz/result-return"
import {
  encodePersonalPlanQuizDraftCookie,
  PERSONAL_PLAN_QUIZ_DRAFT_COOKIE,
} from "../src/lib/personal-plan-quiz/server-draft"

function request(headers: Record<string, string> = {}) {
  return new Request("https://chaarlie.de/api/quiz/personal-plan-result-return/reset", {
    method: "POST",
    headers: {
      origin: "https://chaarlie.de",
      "sec-fetch-site": "same-origin",
      "x-forwarded-for": "203.0.113.10",
      ...headers,
    },
  })
}

test("result-return reset rejects requests without same-origin Fetch Metadata", async () => {
  let resetCalls = 0
  const handler = createPersonalPlanResultReturnResetPostHandler({
    checkRateLimit: async () => ({ allowed: true }),
    resetServerCapabilities: async () => {
      resetCalls += 1
    },
  })

  const crossSite = await handler(request({ "sec-fetch-site": "cross-site" }))
  const wrongOrigin = await handler(request({ origin: "https://attacker.example" }))

  assert.equal(crossSite.status, 400)
  assert.equal(wrongOrigin.status, 400)
  assert.equal(resetCalls, 0)
})

test("result-return reset returns private no-store 204 only after both capabilities reset", async () => {
  const order: string[] = []
  const handler = createPersonalPlanResultReturnResetPostHandler({
    checkRateLimit: async () => ({ allowed: true }),
    resetServerCapabilities: async (_request, response) => {
      order.push("reset")
      response.headers.set("x-reset-proof", "done")
    },
  })

  const response = await handler(request())

  assert.equal(response.status, 204)
  assert.equal(response.headers.get("cache-control"), "no-store, private")
  assert.equal(response.headers.get("vary"), "Cookie")
  assert.equal(response.headers.get("x-reset-proof"), "done")
  assert.deepEqual(order, ["reset"])
})

test("result-return reset fails closed when rate limiting or server reset fails", async (context) => {
  context.mock.method(console, "warn", () => {})
  const limited = createPersonalPlanResultReturnResetPostHandler({
    checkRateLimit: async () => ({ allowed: false }),
    resetServerCapabilities: async () => assert.fail("must not reset"),
  })
  assert.equal((await limited(request())).status, 429)

  const failed = createPersonalPlanResultReturnResetPostHandler({
    checkRateLimit: async () => ({ allowed: true }),
    resetServerCapabilities: async () => {
      throw new Error("database unavailable")
    },
  })
  assert.equal((await failed(request())).status, 503)
})

test("server reset revokes both valid capabilities and clears both cookies", async () => {
  const previousSecret = process.env.PERSONAL_PLAN_QUIZ_DRAFT_COOKIE_SECRET
  process.env.PERSONAL_PLAN_QUIZ_DRAFT_COOKIE_SECRET =
    "test-secret-with-at-least-thirty-two-characters"
  const resultToken = createPersonalPlanResultReturnCredential().token
  const draftCookie = encodePersonalPlanQuizDraftCookie({
    draftId: "20000000-0000-4000-8000-000000000093",
    browserGeneration: 2,
    expiresAt: "2099-01-01T00:00:00.000Z",
  })
  assert.ok(draftCookie)
  const rpcCalls: Array<[string, unknown]> = []
  let revokedResultToken: string | undefined
  const response = new NextResponse(null, { status: 204 })

  try {
    await resetPersonalPlanServerCapabilities(
      new Request("https://chaarlie.de/api/quiz/personal-plan-result-return/reset", {
        headers: {
          cookie: `${PERSONAL_PLAN_RESULT_RETURN_COOKIE}=${resultToken}; ${PERSONAL_PLAN_QUIZ_DRAFT_COOKIE}=${draftCookie}`,
        },
      }),
      response,
      {
        createAdminClient: (() => ({
          rpc: async (name: string, args: unknown) => {
            rpcCalls.push([name, args])
            return { data: null, error: null }
          },
        })) as never,
        revokeResultReturn: async ({ cookieValue, response: resetResponse }) => {
          revokedResultToken = cookieValue ?? undefined
          resetResponse.cookies.set(PERSONAL_PLAN_RESULT_RETURN_COOKIE, "", {
            httpOnly: true,
            sameSite: "lax",
            secure: true,
            path: "/",
            maxAge: 0,
          })
          return { revoked: true }
        },
      },
    )

    assert.equal(revokedResultToken, resultToken)
    assert.deepEqual(rpcCalls, [
      [
        "revoke_personal_plan_quiz_draft",
        {
          p_draft_id: "20000000-0000-4000-8000-000000000093",
          p_browser_generation: 2,
        },
      ],
    ])
    const setCookie = response.headers.get("set-cookie") ?? ""
    assert.match(setCookie, new RegExp(PERSONAL_PLAN_RESULT_RETURN_COOKIE))
    assert.match(setCookie, new RegExp(PERSONAL_PLAN_QUIZ_DRAFT_COOKIE))
  } finally {
    if (previousSecret === undefined) delete process.env.PERSONAL_PLAN_QUIZ_DRAFT_COOKIE_SECRET
    else process.env.PERSONAL_PLAN_QUIZ_DRAFT_COOKIE_SECRET = previousSecret
  }
})

test("server reset treats a malformed or missing result cookie as idempotent success", async () => {
  const response = new NextResponse(null, { status: 204 })
  await resetPersonalPlanServerCapabilities(
    new Request("https://chaarlie.de/api/quiz/personal-plan-result-return/reset", {
      headers: { cookie: `${PERSONAL_PLAN_RESULT_RETURN_COOKIE}=malformed` },
    }),
    response,
    {
      createAdminClient: (() => ({ rpc: async () => ({ data: null, error: null }) })) as never,
      revokeResultReturn: async ({ response: resetResponse }) => {
        resetResponse.cookies.set(PERSONAL_PLAN_RESULT_RETURN_COOKIE, "", {
          httpOnly: true,
          sameSite: "lax",
          secure: true,
          path: "/",
          maxAge: 0,
        })
        return { revoked: false }
      },
    },
  )

  assert.match(response.headers.get("set-cookie") ?? "", /Max-Age=0/)
})
