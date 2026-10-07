import assert from "node:assert/strict"
import test from "node:test"
import { POST as refresh } from "../src/app/api/mobile/v1/auth/refresh/route"
import { POST as logout } from "../src/app/api/mobile/v1/auth/logout/route"
import { POST as start } from "../src/app/api/mobile/v1/auth/start/route"
import { GET as profile } from "../src/app/api/mobile/v1/profile/route"

const settings = {
  MOBILE_API_ENABLED: "true",
  MOBILE_AUTH_MODE: "pilot",
  MOBILE_PILOT_ENABLED: "true",
  MOBILE_PILOT_AUDIENCE: "https://chaarlie.de/api/mobile/v1",
  MOBILE_PILOT_ENVIRONMENT: "synthetic-test",
  MOBILE_PILOT_EXPIRES_AT: "2099-01-01T00:00:00.000Z",
  MOBILE_PILOT_ACCOUNTS: JSON.stringify([
    { email: "pilot@example.test", userId: "11111111-1111-4111-8111-111111111111" },
  ]),
  MOBILE_PILOT_ACTIVE_KEY_ID: "test-v1",
  MOBILE_PILOT_KEYS: JSON.stringify({ "test-v1": Buffer.alloc(32, 42).toString("base64url") }),
  MOBILE_AUTH_CALLBACK_URL: "chaarlie-pilot://auth",
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:55321",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "synthetic-anon",
  SUPABASE_SERVICE_ROLE_KEY: "synthetic-service",
}
function request(path: string, body?: unknown, token?: string) {
  return new Request(`http://127.0.0.1/api/mobile/v1/${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      ...(body ? { "content-type": "application/json" } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
}
test("pilot rejects raw credentials and foreign email before any provider/database call", async () => {
  const old = Object.fromEntries(Object.keys(settings).map((k) => [k, process.env[k]]))
  const originalFetch = globalThis.fetch
  let calls = 0
  try {
    Object.assign(process.env, settings)
    globalThis.fetch = async () => {
      calls++
      return Response.json({ error: "synthetic_denial" }, { status: 401 })
    }
    const cases = [
      [refresh, request("auth/refresh", { refreshToken: "raw-provider-refresh" }), 401],
      [
        logout,
        request("auth/logout", {}, "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ3ZWIifQ.signature"),
        401,
      ],
      [profile, request("profile", undefined, "raw-provider-access"), 401],
      [start, request("auth/start", { email: "foreign@example.test" }), 401],
    ] as const
    for (const [handler, input, status] of cases) {
      calls = 0
      const response = await handler(input)
      assert.equal(calls, 0, `side effect for ${new URL(input.url).pathname}`)
      assert.equal(response.status, status)
      assert.equal(response.headers.get("cache-control"), "no-store")
    }
  } finally {
    globalThis.fetch = originalFetch
    for (const [k, v] of Object.entries(old)) {
      if (v === undefined) delete process.env[k]
      else process.env[k] = v
    }
  }
})

test("disabled or misconfigured pilot cannot fall back to provider credentials", async () => {
  const old = Object.fromEntries(Object.keys(settings).map((k) => [k, process.env[k]]))
  const originalFetch = globalThis.fetch
  let calls = 0
  try {
    globalThis.fetch = async () => {
      calls++
      throw new Error("unexpected network")
    }
    for (const override of [
      { MOBILE_API_ENABLED: "false" },
      { MOBILE_PILOT_ENABLED: "false" },
      { MOBILE_AUTH_MODE: "" },
      { MOBILE_PILOT_KEYS: "{}" },
      { MOBILE_PILOT_EXPIRES_AT: "2020-01-01T00:00:00Z" },
      {
        MOBILE_AUTH_MODE: "local",
        MOBILE_PILOT_ENABLED: "false",
        NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
        MOBILE_AUTH_CALLBACK_URL: "chaarlie-local://auth",
      },
      { MOBILE_AUTH_MODE: "local", MOBILE_AUTH_CALLBACK_URL: "chaarlie-local://auth" },
    ]) {
      Object.assign(process.env, settings, override)
      assert.equal((await refresh(request("auth/refresh", { refreshToken: "raw" }))).status, 404)
    }
    assert.equal(calls, 0)
  } finally {
    globalThis.fetch = originalFetch
    for (const [k, v] of Object.entries(old)) {
      if (v === undefined) delete process.env[k]
      else process.env[k] = v
    }
  }
})
