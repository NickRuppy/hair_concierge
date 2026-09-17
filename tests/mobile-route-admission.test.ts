import assert from "node:assert/strict"
import test from "node:test"
import { GET as bootstrap } from "../src/app/api/mobile/v1/bootstrap/route"
import { GET as profile } from "../src/app/api/mobile/v1/profile/route"
import { POST as resolve } from "../src/app/api/mobile/v1/scan/resolve/route"
import { GET as search } from "../src/app/api/mobile/v1/scan/search/route"
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
    for (const handler of [bootstrap, profile, resolve, search]) {
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
