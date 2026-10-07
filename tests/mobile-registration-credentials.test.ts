import { decodeJwt } from "jose"
import assert from "node:assert/strict"
import test from "node:test"
import {
  readRegistrationConfig,
  sealRegistrationCredential,
  openRegistrationCredential,
  registrationCodeDigest,
} from "../supabase/functions/_shared/mobile-registration-credentials"
const now = 1900000000
const env = {
  MOBILE_API_ENABLED: "true",
  MOBILE_REGISTRATION_ENABLED: "true",
  MOBILE_REGISTRATION_EMAILS: JSON.stringify(["new@example.test"]),
  MOBILE_REGISTRATION_CALLBACK_URL: "chaarlie-pilot://auth",
  MOBILE_REGISTRATION_AUDIENCE: "https://chaarlie.de/api/mobile/v1",
  MOBILE_REGISTRATION_ENVIRONMENT: "test",
  MOBILE_REGISTRATION_EXPIRES_AT: new Date((now + 7200) * 1000).toISOString(),
  MOBILE_REGISTRATION_ACTIVE_KEY_ID: "key",
  MOBILE_REGISTRATION_KEYS: JSON.stringify({ key: Buffer.alloc(32, 13).toString("base64url") }),
}
const claims = {
  purpose: "registration_request" as const,
  attemptId: "11111111-1111-4111-8111-111111111111",
  sendGeneration: "22222222-2222-4222-8222-222222222222",
  requestHash: "a".repeat(64),
  email: "new@example.test",
  expiresAt: now + 3600,
}
test("registration request has no pre-authorized owner and is purpose/environment bound", async () => {
  const config = readRegistrationConfig(env, now)
  const raw = await sealRegistrationCredential(config, claims, now)
  assert.deepEqual(
    await openRegistrationCredential(config, raw, "registration_request", now),
    claims,
  )
  await assert.rejects(openRegistrationCredential(config, raw, "registration_completion", now))
  await assert.rejects(
    openRegistrationCredential(
      { ...config, environment: "other" },
      raw,
      "registration_request",
      now,
    ),
  )
  await assert.rejects(openRegistrationCredential(config, raw, "registration_request", now + 3600))
  await assert.rejects(
    sealRegistrationCredential(config, { ...claims, userId: claims.attemptId }, now),
  )
})
test("registration disabled and malformed config fail closed", () => {
  assert.throws(() => readRegistrationConfig({ ...env, MOBILE_REGISTRATION_ENABLED: "false" }, now))
  assert.throws(() =>
    readRegistrationConfig({ ...env, MOBILE_REGISTRATION_CALLBACK_URL: "https://evil.test" }, now),
  )
})
test("keyed OTP digest binds email, attempt, hash and generation", async () => {
  const config = readRegistrationConfig(env, now)
  const a = await registrationCodeDigest(config, claims, "12345678")
  assert.match(a, /^[0-9a-f]{64}$/)
  assert.notEqual(
    a,
    await registrationCodeDigest(
      config,
      { ...claims, sendGeneration: claims.attemptId },
      "12345678",
    ),
  )
  assert.notEqual(a, await registrationCodeDigest(config, claims, "12345679"))
})

test("completion capabilities use authenticated encryption and reject signed or cross-purpose substitution", async () => {
  const config = readRegistrationConfig(env, now)
  const completion = {
    ...claims,
    purpose: "registration_completion" as const,
    userId: "33333333-3333-4333-8333-333333333333",
    credential: "private-access-token",
    refreshToken: "private-refresh-token",
    sessionId: "44444444-4444-4444-8444-444444444444",
    sessionExpiresAt: now + 3600,
  }
  const token = await sealRegistrationCredential(config, completion, now)
  assert.equal(token.split(".").length, 5)
  assert.throws(() => decodeJwt(token))
  assert.deepEqual(
    await openRegistrationCredential(config, token, "registration_completion", now),
    completion,
  )
  await assert.rejects(openRegistrationCredential(config, token, "profile_completion", now))
  await assert.rejects(
    openRegistrationCredential(config, token.slice(0, -2) + "xx", "registration_completion", now),
  )
  await assert.rejects(
    openRegistrationCredential(
      { ...config, environment: "other" },
      token,
      "registration_completion",
      now,
    ),
  )
  const profile = { ...completion, purpose: "profile_completion" as const }
  const limited = await sealRegistrationCredential(config, profile, now)
  assert.deepEqual(
    await openRegistrationCredential(config, limited, "profile_completion", now),
    profile,
  )
  await assert.rejects(openRegistrationCredential(config, limited, "registration_completion", now))
})

test("registration cohort configuration rejects missing, malformed, noncanonical and broad values", () => {
  const bad = [
    undefined,
    "",
    "not-json",
    "null",
    "{}",
    '"new@example.test"',
    "[]",
    '["*"]',
    '["*@example.test"]',
    '["new?@example.test"]',
    '["example.test"]',
    '["New@example.test"]',
    '[" new@example.test"]',
    '["new@example.test "]',
    '["new@example.test","new@example.test"]',
    '["bad..local@example.test"]',
    '["new@-example.test"]',
    '["new@example..test"]',
    "[1]",
    JSON.stringify(Array.from({ length: 21 }, (_, i) => `user${i}@example.test`)),
    JSON.stringify(["a".repeat(65) + "@example.test"]),
  ]
  for (const raw of bad)
    assert.throws(
      () => readRegistrationConfig({ ...env, MOBILE_REGISTRATION_EMAILS: raw }, now),
      String(raw),
    )
  const exact = readRegistrationConfig(
    { ...env, MOBILE_REGISTRATION_EMAILS: '["new+test@example.test"]' },
    now,
  )
  assert.deepEqual(exact.emails, ["new+test@example.test"])
})

test("removed exact email invalidates every previously issued registration proof and does not expand aliases", async () => {
  const allowed = readRegistrationConfig(env, now)
  const removed = readRegistrationConfig(
    { ...env, MOBILE_REGISTRATION_EMAILS: '["other@example.test"]' },
    now,
  )
  const proofs = [
    claims,
    {
      ...claims,
      purpose: "registration_verification" as const,
      userId: claims.attemptId,
      credential: "a".repeat(64),
    },
    ...(["registration_completion", "profile_completion"] as const).map((purpose) => ({
      ...claims,
      purpose,
      userId: claims.attemptId,
      credential: "access",
      refreshToken: "refresh",
      sessionId: claims.sendGeneration,
      sessionExpiresAt: now + 3600,
    })),
  ]
  for (const proof of proofs) {
    const raw = await sealRegistrationCredential(allowed, proof, now)
    await assert.rejects(openRegistrationCredential(removed, raw, proof.purpose, now))
    await assert.rejects(sealRegistrationCredential(removed, proof, now))
  }
  await assert.rejects(
    sealRegistrationCredential(allowed, { ...claims, email: "new+unlisted@example.test" }, now),
  )
})
