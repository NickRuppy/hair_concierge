import assert from "node:assert/strict"
import test from "node:test"
import { GET as bootstrap } from "../src/app/api/mobile/v1/bootstrap/route"
import { GET as profile } from "../src/app/api/mobile/v1/profile/route"
import { POST as resolve } from "../src/app/api/mobile/v1/scan/resolve/route"
import { GET as search } from "../src/app/api/mobile/v1/scan/search/route"
import { GET as history, DELETE as clearHistory } from "../src/app/api/mobile/v1/scan/history/route"
import { POST as submit } from "../src/app/api/mobile/v1/scan/submit/route"
import { classifyRoute } from "../src/lib/auth/route-classification"
import { requiresSubscriptionPath } from "../src/lib/supabase/middleware"

test("native routes fail closed by default and never infer admission from platform or cookies", async () => {
  const previous = process.env.MOBILE_API_ENABLED
  try {
    delete process.env.MOBILE_API_ENABLED
    assert.equal(
      (await bootstrap(new Request("http://localhost/api/mobile/v1/bootstrap"))).status,
      404,
    )
    process.env.MOBILE_API_ENABLED = "true"
    process.env.MOBILE_AUTH_MODE = "local"
    process.env.MOBILE_AUTH_CALLBACK_URL = "chaarlie-local://auth"
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:55321"
    for (const handler of [bootstrap, profile, resolve, search, history, clearHistory, submit]) {
      const response = await handler(
        new Request("http://localhost/api/mobile/v1/bootstrap?platform=ios&userId=other", {
          headers: { cookie: "session=fabricated", "x-user-id": "other" },
        }),
      )
      assert.equal(response.status, 401)
      assert.equal(response.headers.get("cache-control"), "no-store")
      assert.deepEqual(await response.json(), { error: "unauthorized" })
    }
  } finally {
    if (previous === undefined) delete process.env.MOBILE_API_ENABLED
    else process.env.MOBILE_API_ENABLED = previous
  }
})

test("native bearer route classification leaves web subscription paths intact", () => {
  const environment = { nodeEnv: "production", localDevLoginEnabled: false }
  assert.equal(classifyRoute("/api/mobile/v1/scan/resolve", environment), "protected")
  for (const path of [
    "/scan",
    "/api/scan/resolve",
    "/profile",
    "/api/profile",
    "/routine",
    "/api/routine",
    "/api/chat",
  ])
    assert.equal(requiresSubscriptionPath(path), true, path)
  assert.equal(requiresSubscriptionPath("/api/mobile/v1/scan/resolve"), false)
})

test("native proxy bypasses browser cookie work only at the exact route boundary", async () => {
  const { NextRequest } = await import("next/server")
  const { proxy } = await import("../src/proxy")
  const { createUpdateSession } = await import("../src/lib/supabase/middleware")
  let creates = 0
  const fail = () => {
    creates++
    throw new Error("browser_auth_called")
  }
  const middleware = createUpdateSession({
    createServerClient: fail as never,
    hasCurrentAppAccess: fail as never,
    resolveOneTimeAccessState: fail as never,
    getRouteEnvironment: () => ({ nodeEnv: "production", localDevLoginEnabled: false }),
  })
  for (const pathname of ["/api/mobile/v1", "/api/mobile/v1/profile"]) {
    const request = new NextRequest(`https://chaarlie.de${pathname}?utm_source=synthetic`, {
      headers: {
        cookie: "sb-example-auth-token=malformed; regular_quiz_field_test_campaign=invalid",
      },
    })
    const response = await proxy(request)
    assert.equal(response.status, 200)
    assert.equal(response.headers.get("set-cookie"), null)
    assert.equal(response.headers.get("location"), null)
    assert.equal((await middleware(request)).status, 200)
  }
  assert.equal(creates, 0)
  assert.equal(
    classifyRoute("/api/mobile/v1evil/profile", {
      nodeEnv: "production",
      localDevLoginEnabled: false,
    }),
    "unknown",
  )
  // An existing protected browser route must still use cookie admission.
  await assert.rejects(
    middleware(new NextRequest("https://chaarlie.de/profile")),
    /browser_auth_called/,
  )
  assert.equal(creates, 1)
})
