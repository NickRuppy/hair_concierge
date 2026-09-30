import assert from "node:assert/strict"
import test from "node:test"
import { POST as start } from "../src/app/api/mobile/v1/registration/start/route"
import { POST as verify } from "../src/app/api/mobile/v1/registration/verify/route"
import { POST as login } from "../src/app/api/mobile/v1/auth/start/route"
import { POST as refresh } from "../src/app/api/mobile/v1/auth/refresh/route"
import { requireMobileUser } from "../src/lib/mobile/auth"
import {
  readRegistrationConfig,
  sealRegistrationCredential,
} from "../supabase/functions/_shared/mobile-registration-credentials"
import { sealCredential } from "../supabase/functions/_shared/mobile-credentials"
const env = {
  MOBILE_API_ENABLED: "true",
  MOBILE_AUTH_MODE: "pilot",
  MOBILE_PILOT_ENABLED: "false",
  MOBILE_REGISTRATION_ENABLED: "true",
  MOBILE_REGISTRATION_EMAILS: JSON.stringify([
    "new@example.test",
    "existing@example.test",
    "unknown@example.test",
  ]),
  MOBILE_REGISTRATION_CALLBACK_URL: "chaarlie-pilot://auth",
  MOBILE_REGISTRATION_AUDIENCE: "https://chaarlie.de/api/mobile/v1",
  MOBILE_REGISTRATION_ENVIRONMENT: "test",
  MOBILE_REGISTRATION_EXPIRES_AT: "2099-01-01T00:00:00.000Z",
  MOBILE_REGISTRATION_ACTIVE_KEY_ID: "key",
  MOBILE_REGISTRATION_KEYS: JSON.stringify({ key: Buffer.alloc(32, 22).toString("base64url") }),
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:55321",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "synthetic-anon",
  SUPABASE_SERVICE_ROLE_KEY: "synthetic-service",
}
function request(body: unknown) {
  return new Request("http://localhost/api/mobile/v1/registration/start", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}
test("disabled registration endpoints fail before any provider/database operation", async () => {
  const previous = process.env.MOBILE_REGISTRATION_ENABLED,
    fetch = globalThis.fetch
  try {
    delete process.env.MOBILE_REGISTRATION_ENABLED
    globalThis.fetch = async () => {
      assert.fail("no IO when off")
    }
    for (const handler of [start, verify]) {
      const response = await handler(request({}))
      assert.equal(response.status, 404)
      assert.equal(response.headers.get("cache-control"), "no-store")
    }
  } finally {
    globalThis.fetch = fetch
    if (previous === undefined) delete process.env.MOBILE_REGISTRATION_ENABLED
    else process.env.MOBILE_REGISTRATION_ENABLED = previous
  }
})
test("registered access signature validates before enrollment/provider; nonready enrollment cannot reach provider", async () => {
  const old = Object.fromEntries(Object.keys(env).map((k) => [k, process.env[k]])),
    original = globalThis.fetch
  try {
    Object.assign(process.env, env)
    const userId = "33333333-3333-4333-8333-333333333333",
      email = "new@example.test",
      config = { ...readRegistrationConfig(env), accounts: [{ email, userId }] }
    const token = await sealCredential(config, {
      purpose: "access",
      credential: "provider-token",
      email,
      userId,
      sessionId: "44444444-4444-4444-8444-444444444444",
      expiresAt: Math.floor(Date.now() / 1000) + 300,
    })
    let calls = 0
    globalThis.fetch = async (input) => {
      calls++
      assert.ok(String(input).includes("/mobile_registration_enrollments"))
      return Response.json(null)
    }
    await assert.rejects(
      requireMobileUser(
        new Request("http://localhost", { headers: { authorization: `Bearer ${token}` } }),
      ),
    )
    assert.equal(calls, 1)
    calls = 0
    await assert.rejects(
      requireMobileUser(
        new Request("http://localhost", {
          headers: { authorization: `Bearer ${token.slice(0, -2)}xx` },
        }),
      ),
    )
    assert.equal(calls, 0)
    const response = await refresh(request({ refreshToken: token }))
    assert.equal(response.status, 401)
    assert.equal(calls, 0)
  } finally {
    globalThis.fetch = original
    for (const [k, v] of Object.entries(old)) {
      if (v === undefined) delete process.env[k]
      else process.env[k] = v
    }
  }
})
test("ordinary login requests provider no-signup for unknown or existing email without disclosing existence", async () => {
  const old = Object.fromEntries(Object.keys(env).map((k) => [k, process.env[k]])),
    original = globalThis.fetch
  try {
    Object.assign(process.env, env)
    const paths: string[] = []
    globalThis.fetch = async (input, init) => {
      const url = String(input)
      paths.push(url)
      if (url.includes("/rpc/check_rate_limit"))
        return Response.json({
          allowed: true,
          remaining: 4,
          reset_at: new Date(Date.now() + 60000).toISOString(),
        })
      if (url.includes("/rpc/mobile_registration_start")) {
        const body = JSON.parse(String(init?.body))
        assert.equal(body.p_flow, "login")
        return Response.json({
          status: "ready",
          intent: {
            id: "11111111-1111-4111-8111-111111111111",
            send_generation: "22222222-2222-4222-8222-222222222222",
            request_hash: body.p_request_hash,
            email: body.p_email,
            expires_at: new Date(Date.now() + 3500000).toISOString(),
          },
        })
      }
      if (url.includes("/auth/v1/otp")) {
        const body = JSON.parse(String(init?.body))
        assert.equal(body.create_user, false)
        return Response.json({ msg: "Signups not allowed for otp" }, { status: 400 })
      }
      assert.fail("must not lookup user/enrollment before proof")
    }
    const response = await login(request({ email: "unknown@example.test" }))
    assert.equal(response.status, 200)
    assert.ok(paths[0].includes("/rpc/check_rate_limit"))
    assert.ok(paths[1].includes("/rpc/check_rate_limit"))
    assert.ok(paths[2].includes("/rpc/mobile_registration_start"))
    assert.ok(paths[3].includes("/auth/v1/otp"))
  } finally {
    globalThis.fetch = original
    for (const [k, v] of Object.entries(old)) {
      if (v === undefined) delete process.env[k]
      else process.env[k] = v
    }
  }
})

test("encrypted profile-completion capability cannot admit a scanner session or expose provider credentials", async () => {
  const old = Object.fromEntries(Object.keys(env).map((k) => [k, process.env[k]])),
    original = globalThis.fetch
  try {
    Object.assign(process.env, env)
    const token = await sealRegistrationCredential(readRegistrationConfig(env), {
      purpose: "profile_completion",
      attemptId: "11111111-1111-4111-8111-111111111111",
      sendGeneration: "22222222-2222-4222-8222-222222222222",
      requestHash: "a".repeat(64),
      email: "new@example.test",
      userId: "33333333-3333-4333-8333-333333333333",
      credential: "provider-access-secret",
      refreshToken: "provider-refresh-secret",
      sessionId: "44444444-4444-4444-8444-444444444444",
      expiresAt: Math.floor(Date.now() / 1000) + 300,
      sessionExpiresAt: Math.floor(Date.now() / 1000) + 3600,
    })
    let calls = 0
    globalThis.fetch = async () => {
      calls++
      assert.fail("limited token must not hit provider or scanner DB")
    }
    await assert.rejects(
      requireMobileUser(
        new Request("http://localhost", { headers: { authorization: `Bearer ${token}` } }),
      ),
    )
    assert.equal(calls, 0)
    assert.equal(token.split(".").length, 5)
    assert.equal(token.includes("provider-access-secret"), false)
  } finally {
    globalThis.fetch = original
    for (const [k, v] of Object.entries(old)) {
      if (v === undefined) delete process.env[k]
      else process.env[k] = v
    }
  }
})

test("start caps a database deadline across the 70ms second boundary before sending provider OTP", async () => {
  const { startRegisteredLogin } = await import("../src/lib/mobile/registration-auth")
  const { openRegistrationCredential } =
    await import("../supabase/functions/_shared/mobile-registration-credentials")
  const old = Object.fromEntries(Object.keys(env).map((k) => [k, process.env[k]])),
    originalFetch = globalThis.fetch,
    originalNow = Date.now
  const fixedNow = 1900000000950
  try {
    Object.assign(process.env, env)
    Date.now = () => fixedNow
    let providerCalls = 0
    globalThis.fetch = async (input, init) => {
      providerCalls++
      const callback = new URL(String(input)).searchParams.get("redirect_to")
      assert.ok(callback)
      const proof = new URLSearchParams(new URL(callback).hash.slice(1)).get("registrationRequest")
      assert.ok(proof)
      const opened = await openRegistrationCredential(
        readRegistrationConfig(env),
        proof,
        "registration_request",
        1900000000,
      )
      assert.equal(opened.expiresAt, 1900003600)
      assert.equal(JSON.parse(String(init?.body)).create_user, false)
      return Response.json({})
    }
    const client = {
      rpc: async () => ({
        data: {
          status: "ready",
          intent: {
            id: "11111111-1111-4111-8111-111111111111",
            send_generation: "22222222-2222-4222-8222-222222222222",
            request_hash: "a".repeat(64),
            email: "existing@example.test",
            expires_at: new Date(fixedNow + 70 + 3600000).toISOString(),
          },
        },
        error: null,
      }),
    }
    const result = await startRegisteredLogin("existing@example.test", client as never)
    assert.equal(result.codeLength, 8)
    assert.equal(providerCalls, 1)
  } finally {
    Date.now = originalNow
    globalThis.fetch = originalFetch
    for (const [k, v] of Object.entries(old)) {
      if (v === undefined) delete process.env[k]
      else process.env[k] = v
    }
  }
})

test("excluded exact address and unlisted plus alias cannot create registration or login intents", async () => {
  const old = Object.fromEntries(Object.keys(env).map((key) => [key, process.env[key]]))
  const originalFetch = globalThis.fetch
  try {
    Object.assign(process.env, env)
    globalThis.fetch = async (input) => {
      assert.ok(
        String(input).includes("/rpc/check_rate_limit"),
        "excluded address must not call intent/account/provider APIs",
      )
      return Response.json({
        allowed: true,
        remaining: 4,
        reset_at: new Date(Date.now() + 60000).toISOString(),
      })
    }
    for (const email of ["excluded@example.test", "new+unlisted@example.test"]) {
      const submission = {
        requestId: "11111111-1111-4111-8111-111111111111",
        firstName: "Ada",
        email,
        marketingOptIn: false,
        answers: {
          structure: "wavy",
          thickness: "fine",
          density: "medium",
          hair_length: "long",
          fingertest: "rau",
          pulltest: "stretches_bounces",
          scalp_type: "ausgeglichen",
          has_scalp_issue: false,
          treatment: ["natur"],
          concerns: [],
          goals: ["moisture"],
        },
      }
      for (const response of [await start(request(submission)), await login(request({ email }))]) {
        assert.ok(
          [401, 403, 404].includes(response.status),
          `excluded address unexpectedly returned ${response.status}`,
        )
      }
    }
  } finally {
    globalThis.fetch = originalFetch
    for (const [key, value] of Object.entries(old)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
})

test("cohort removal denies already issued access and refresh before any database or provider call", async () => {
  const old = Object.fromEntries(Object.keys(env).map((key) => [key, process.env[key]]))
  const originalFetch = globalThis.fetch
  try {
    Object.assign(process.env, env)
    const email = "new@example.test",
      userId = "33333333-3333-4333-8333-333333333333"
    const config = { ...readRegistrationConfig(env), accounts: [{ email, userId }] }
    const tokens = await Promise.all(
      (["access", "refresh"] as const).map((purpose) =>
        sealCredential(config, {
          purpose,
          credential: "provider-token",
          email,
          userId,
          sessionId: "44444444-4444-4444-8444-444444444444",
          expiresAt: Math.floor(Date.now() / 1000) + 300,
        }),
      ),
    )
    process.env.MOBILE_REGISTRATION_EMAILS = JSON.stringify(["other@example.test"])
    let calls = 0
    globalThis.fetch = async () => {
      calls++
      throw new Error("removed member must not reach IO")
    }
    await assert.rejects(
      requireMobileUser(
        new Request("http://localhost", { headers: { authorization: `Bearer ${tokens[0]}` } }),
      ),
    )
    assert.equal((await refresh(request({ refreshToken: tokens[1] }))).status, 401)
    assert.equal(calls, 0)
  } finally {
    globalThis.fetch = originalFetch
    for (const [key, value] of Object.entries(old)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
})
