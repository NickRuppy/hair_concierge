import assert from "node:assert/strict"
import test from "node:test"
import { NextRequest } from "next/server"
import { handlePublicContractDeclaration } from "../src/lib/billing/public-contract-declaration-request"
import { createUpdateSession } from "../src/lib/supabase/middleware"
import { classifyRoute } from "../src/lib/auth/route-classification"

const declaration = {
  requestId: "00000000-0000-4000-8000-000000000001",
  kind: "ordinary_cancellation" as const,
  name: "Marie",
  email: "marie@example.com",
  contract: "Chaarlie Jahresabo",
  requestedEnd: "Zum nächstmöglichen Zeitpunkt",
  reason: null,
}
const receipt = {
  declarationId: "00000000-0000-4000-8000-000000000002",
  submittedAt: "2026-09-14T12:00:00.000Z",
  declaration,
}
const request = (body: unknown = declaration, headers: Record<string, string> = {}) =>
  new Request("https://chaarlie.de/api/billing/contract-declarations", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  })

test("no-cookie public request returns only its own durable receipt after both limits pass", async () => {
  const calls: string[] = []
  const response = await handlePublicContractDeclaration(request(), {
    rateLimit: async (identifier, config) => {
      assert.match(identifier, /^[a-f0-9]{64}$/)
      calls.push(config.prefix)
      return { allowed: true }
    },
    submit: async (input) => {
      assert.deepEqual(input, declaration)
      calls.push("save")
      return receipt
    },
  })
  assert.equal(response.status, 200)
  assert.equal(response.headers.get("cache-control"), "no-store")
  assert.deepEqual(await response.json(), { receipt, deliveryStatus: "queued" })
  assert.deepEqual(calls, ["public-declaration-ip", "public-declaration-address", "save"])
})

test("database failure cannot report a received declaration or reveal internal account data", async () => {
  const response = await handlePublicContractDeclaration(request(), {
    rateLimit: async () => ({ allowed: true }),
    submit: async () => {
      throw new Error("private customer account exists")
    },
  })
  assert.equal(response.status, 503)
  assert.deepEqual(await response.json(), { error: "submission_unavailable" })
})

test("rate limits and unavailable rate storage stop persistence; address budget is shared across kinds", async () => {
  for (const failingIndex of [1, 2])
    for (const unavailable of [false, true]) {
      let calls = 0
      const response = await handlePublicContractDeclaration(request(), {
        rateLimit: async () =>
          ++calls === failingIndex
            ? { allowed: false, ...(unavailable ? { error: "db-down" } : {}) }
            : { allowed: true },
        submit: async () => {
          assert.fail("must not save")
        },
      })
      assert.equal(response.status, unavailable ? 503 : 429)
      if (!unavailable) assert.ok(Number(response.headers.get("retry-after")) > 0)
    }
  const keys: string[] = []
  for (const body of [declaration, { ...declaration, kind: "withdrawal", requestedEnd: null }]) {
    await handlePublicContractDeclaration(request(body), {
      rateLimit: async (id, c) => {
        if (c.prefix.includes("address")) keys.push(id)
        return { allowed: true }
      },
      submit: async () => receipt,
    })
  }
  assert.equal(keys[0], keys[1])
})

test("rejects cross-site requests, oversized bodies and account-authority fields before persistence", async () => {
  for (const req of [
    request(declaration, { origin: "https://elsewhere.test" }),
    request(declaration, { "sec-fetch-site": "cross-site" }),
    request({ ...declaration, userId: "victim" }),
    request({ ...declaration, contract: "x".repeat(20000) }),
    request(declaration, { "content-type": "text/plain" }),
  ]) {
    const response = await handlePublicContractDeclaration(req, {
      rateLimit: async () => ({ allowed: true }),
      submit: async () => {
        assert.fail("must not save")
      },
    })
    assert.ok([400, 403, 413].includes(response.status))
  }
})

test("public legal pages and exact submission API bypass auth, including during auth outages", async () => {
  const environment = { nodeEnv: "production", localDevLoginEnabled: false }
  const update = createUpdateSession({
    createServerClient: () => {
      assert.fail("public declarations must not initialize authentication")
    },
    hasCurrentAppAccess: async () => {
      assert.fail("no access lookup")
    },
    resolveOneTimeAccessState: async () => {
      assert.fail("no entitlement lookup")
    },
    getRouteEnvironment: () => environment,
  })
  for (const path of ["/kuendigen", "/widerruf/erklaeren", "/api/billing/contract-declarations"]) {
    assert.equal(classifyRoute(path, environment), "public")
    const response = await update(new NextRequest(`https://chaarlie.de${path}`))
    assert.equal(response.headers.get("x-middleware-next"), "1")
    assert.equal(response.headers.get("location"), null)
  }
  assert.equal(
    classifyRoute("/api/billing/contract-declarations/private", environment),
    "protected",
  )
  assert.equal(classifyRoute("/api/billing/trial-cancellation", environment), "protected")
})
