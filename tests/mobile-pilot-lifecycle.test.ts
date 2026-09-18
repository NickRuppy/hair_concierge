import assert from "node:assert/strict"
import test from "node:test"
import { SignJWT } from "jose"
import { POST as start } from "../src/app/api/mobile/v1/auth/start/route"
import { POST as verify } from "../src/app/api/mobile/v1/auth/verify/route"
import { POST as refresh } from "../src/app/api/mobile/v1/auth/refresh/route"
import { POST as logout } from "../src/app/api/mobile/v1/auth/logout/route"
import {
  readPilotConfig,
  sealCredential,
  openCredential,
} from "../supabase/functions/_shared/mobile-credentials"
const userId = "11111111-1111-4111-8111-111111111111",
  sid = "22222222-2222-4222-8222-222222222222",
  attemptId = "33333333-3333-4333-8333-333333333333"
const email = "pilot@example.test"
const now = Math.floor(Date.now() / 1000)
const env = {
  MOBILE_API_ENABLED: "true",
  MOBILE_AUTH_MODE: "pilot",
  MOBILE_PILOT_ENABLED: "true",
  MOBILE_PILOT_AUDIENCE: "https://chaarlie.de/api/mobile/v1",
  MOBILE_PILOT_ENVIRONMENT: "synthetic-test",
  MOBILE_PILOT_EXPIRES_AT: new Date((now + 86400) * 1000).toISOString(),
  MOBILE_PILOT_ACCOUNTS: JSON.stringify([{ email, userId }]),
  MOBILE_PILOT_ACTIVE_KEY_ID: "v1",
  MOBILE_PILOT_KEYS: JSON.stringify({ v1: Buffer.alloc(32, 42).toString("base64url") }),
  MOBILE_AUTH_CALLBACK_URL: "chaarlie-pilot://auth",
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:55321",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "synthetic-anon",
  SUPABASE_SERVICE_ROLE_KEY: "synthetic-service",
}
const user = {
  id: userId,
  email,
  is_anonymous: false,
  aud: "authenticated",
  role: "authenticated",
  app_metadata: {},
  user_metadata: {},
  created_at: "2026-01-01T00:00:00Z",
}
function req(path: string, body: unknown, token?: string) {
  return new Request(`http://localhost/api/mobile/v1/auth/${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  })
}
async function fixture(
  run: (f: {
    events: string[]
    config: ReturnType<typeof readPilotConfig>
    token: string
    setFault: (value: string) => void
  }) => Promise<void>,
) {
  const old = Object.fromEntries(Object.keys(env).map((k) => [k, process.env[k]])),
    originalFetch = globalThis.fetch
  Object.assign(process.env, env)
  const events: string[] = []
  let fault = ""
  const jwt = (sessionId: string) =>
    new SignJWT({ session_id: sessionId })
      .setSubject(userId)
      .setExpirationTime(now + 3600)
      .setProtectedHeader({ alg: "HS256" })
      .sign(Buffer.alloc(32, 13))
  const token = await jwt(sid)
  globalThis.fetch = async (input, init) => {
    const url = new URL(
      typeof input === "string" ? input : input instanceof URL ? input.href : input.url,
    )
    const path = url.pathname + url.search
    events.push(`${init?.method ?? "GET"} ${path}`)
    if (url.pathname === "/rest/v1/rpc/check_rate_limit")
      return Response.json(fault !== "rate-limited")
    if (url.pathname === `/auth/v1/admin/users/${userId}`)
      return Response.json({
        user: fault === "reassigned-email" ? { ...user, email: "reassigned@example.test" } : user,
      })
    if (url.pathname === "/auth/v1/user")
      return Response.json(
        fault === "foreign-user" ? { ...user, id: "44444444-4444-4444-8444-444444444444" } : user,
      )
    if (url.pathname === "/auth/v1/verify" || url.pathname === "/auth/v1/token") {
      if (fault === "provider-503") return Response.json({ msg: "transient" }, { status: 503 })
      return Response.json({
        access_token:
          fault === "foreign-session" ? await jwt("44444444-4444-4444-8444-444444444444") : token,
        refresh_token: "provider-refresh-child",
        token_type: "bearer",
        expires_in: 3600,
        expires_at: now + 3600,
        user,
      })
    }
    if (url.pathname === "/auth/v1/logout") return new Response(null, { status: 204 })
    if (url.pathname === "/rest/v1/rpc/mobile_claim_auth_verification") return Response.json(email)
    if (url.pathname === "/rest/v1/mobile_auth_attempts") {
      if (init?.method === "PATCH")
        return Response.json(fault === "finish-race" ? [] : [{ id: attemptId }])
      return Response.json({ email })
    }
    throw new Error("Unexpected synthetic endpoint")
  }
  try {
    await run({
      events,
      config: readPilotConfig(env),
      token,
      setFault: (v) => {
        fault = v
      },
    })
  } finally {
    globalThis.fetch = originalFetch
    for (const [k, v] of Object.entries(old)) {
      if (v === undefined) delete process.env[k]
      else process.env[k] = v
    }
  }
}
test("code verification returns authenticated envelopes only after one-use finish", () =>
  fixture(async (f) => {
    const response = await verify(req("verify", { attemptId, code: "12345678" }))
    assert.equal(response.status, 200)
    const body = await response.json()
    assert.notEqual(body.accessToken, f.token)
    const access = await openCredential(f.config, body.accessToken, "access")
    const renewal = await openCredential(f.config, body.refreshToken, "refresh")
    assert.equal(access.credential, f.token)
    assert.equal(access.sessionId, sid)
    assert.equal(renewal.sessionId, sid)
    assert.equal(body.email, undefined)
    assert.ok(f.events.some((e) => e.startsWith("PATCH /rest/v1/mobile_auth_attempts")))
    f.setFault("finish-race")
    const rejected = await verify(req("verify", { attemptId, code: "12345678" }))
    assert.equal(rejected.status, 401)
    assert.equal((await rejected.json()).accessToken, undefined)
  }))
test("raw and swapped link proofs fail before provider consumption", () =>
  fixture(async (f) => {
    for (const tokenHash of [
      "a".repeat(64),
      await sealCredential(f.config, {
        purpose: "verification",
        credential: "b".repeat(64),
        userId,
        email,
        attemptId: "44444444-4444-4444-8444-444444444444",
        expiresAt: now + 300,
      }),
    ]) {
      f.events.length = 0
      assert.equal((await verify(req("verify", { attemptId, tokenHash }))).status, 401)
      assert.deepEqual(f.events, [])
    }
    const proof = await sealCredential(f.config, {
      purpose: "verification",
      credential: "b".repeat(64),
      userId,
      email,
      attemptId,
      expiresAt: now + 300,
    })
    assert.equal((await verify(req("verify", { attemptId, tokenHash: proof }))).status, 200)
  }))
test("refresh pins provider session and logout uses only its local scope", () =>
  fixture(async (f) => {
    const base = {
      credential: "provider-refresh-parent",
      purpose: "refresh" as const,
      userId,
      email,
      sessionId: sid,
      expiresAt: now + 1000,
    }
    const refreshToken = await sealCredential(f.config, base)
    const response = await refresh(req("refresh", { refreshToken }))
    assert.equal(response.status, 200)
    const body = await response.json()
    assert.equal(
      (await openCredential(f.config, body.refreshToken, "refresh")).credential,
      "provider-refresh-child",
    )
    const signedOut = await logout(req("logout", {}, body.accessToken))
    assert.equal(signedOut.status, 200)
    assert.ok(f.events.some((e) => e.includes("/auth/v1/logout?scope=local")))
    f.setFault("reassigned-email")
    f.events.length = 0
    assert.equal((await refresh(req("refresh", { refreshToken }))).status, 401)
    assert.ok(!f.events.some((event) => event.includes("/auth/v1/token")))
    f.setFault("foreign-session")
    assert.equal((await refresh(req("refresh", { refreshToken }))).status, 401)
    f.setFault("foreign-user")
    f.events.length = 0
    assert.equal((await logout(req("logout", {}, body.accessToken))).status, 401)
    assert.ok(!f.events.some((e) => e.includes("/logout")))
    f.setFault("provider-503")
    assert.equal((await refresh(req("refresh", { refreshToken }))).status, 503)
  }))

test("start limits provider identity lookups and rejects reassigned email before sending", () =>
  fixture(async (f) => {
    f.setFault("rate-limited")
    assert.equal((await start(req("start", { email }))).status, 429)
    assert.ok(!f.events.some((event) => event.includes("/auth/v1/")))
    f.setFault("reassigned-email")
    f.events.length = 0
    assert.equal((await start(req("start", { email }))).status, 401)
    assert.ok(f.events.some((event) => event.includes("/admin/users/")))
    assert.ok(!f.events.some((event) => event.includes("/otp")))
    f.events.length = 0
    assert.equal((await verify(req("verify", { attemptId, code: "12345678" }))).status, 401)
    assert.ok(!f.events.some((event) => event.includes("/auth/v1/verify")))
  }))
