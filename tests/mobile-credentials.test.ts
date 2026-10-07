import assert from "node:assert/strict"
import test from "node:test"

import {
  eligibleAccount,
  openCredential,
  readPilotConfig,
  sealCredential,
} from "../supabase/functions/_shared/mobile-credentials"

const account = { email: "pilot@example.test", userId: "11111111-1111-4111-8111-111111111111" }
const now = 1_800_000_000

function environment(overrides: Record<string, string | undefined> = {}) {
  return {
    MOBILE_API_ENABLED: "true",
    MOBILE_AUTH_MODE: "pilot",
    MOBILE_PILOT_ENABLED: "true",
    MOBILE_PILOT_AUDIENCE: "https://chaarlie.de/api/mobile/v1",
    MOBILE_PILOT_ENVIRONMENT: "synthetic-test",
    MOBILE_PILOT_EXPIRES_AT: "2027-01-16T00:00:00.000Z",
    MOBILE_PILOT_ACCOUNTS: JSON.stringify([account]),
    MOBILE_PILOT_ACTIVE_KEY_ID: "v2",
    MOBILE_PILOT_KEYS: JSON.stringify({
      v1: Buffer.alloc(32, 1).toString("base64url"),
      v2: Buffer.alloc(32, 2).toString("base64url"),
    }),
    MOBILE_AUTH_CALLBACK_URL: "chaarlie-pilot://auth",
    ...overrides,
  }
}

test("seals credentials in an authenticated, purpose-bound JOSE envelope", async () => {
  const config = readPilotConfig(environment(), now)
  const token = await sealCredential(
    config,
    {
      purpose: "verification",
      credential: "provider-token-hash",
      userId: account.userId,
      email: account.email,
      attemptId: "22222222-2222-4222-8222-222222222222",
      expiresAt: now + 300,
    },
    now,
  )

  assert.equal(token.split(".").length, 3)
  assert.deepEqual(await openCredential(config, token, "verification", now + 1), {
    purpose: "verification",
    credential: "provider-token-hash",
    userId: account.userId,
    email: account.email,
    attemptId: "22222222-2222-4222-8222-222222222222",
    expiresAt: now + 300,
  })
})

test("permits a bounded long provider credential inside the larger signed envelope", async () => {
  const config = readPilotConfig(environment(), now)
  const credential = "p".repeat(4096)
  const claims = {
    purpose: "access" as const,
    credential,
    userId: account.userId,
    email: account.email,
    sessionId: "33333333-3333-4333-8333-333333333333",
    expiresAt: now + 300,
  }
  const token = await sealCredential(config, claims, now)
  assert.equal(token.length <= 8192, true)
  assert.equal((await openCredential(config, token, "access", now + 1)).credential, credential)
  await assert.rejects(() =>
    sealCredential(config, { ...claims, credential: `${credential}x` }, now),
  )
})

test("rejects malformed, oversized, wrong-purpose, stale-cohort and removed-key envelopes", async () => {
  const config = readPilotConfig(environment(), now)
  const claims = {
    purpose: "access" as const,
    credential: "provider-access",
    userId: account.userId,
    email: account.email,
    sessionId: "33333333-3333-4333-8333-333333333333",
    expiresAt: now + 300,
  }
  const token = await sealCredential(config, claims, now)

  for (const [raw, purpose] of [
    ["raw-provider-token", "access"],
    ["x".repeat(8193), "access"],
    [token, "refresh"],
  ] as const) {
    await assert.rejects(() => openCredential(config, raw, purpose, now + 1))
  }

  const rotated = readPilotConfig(
    environment({
      MOBILE_PILOT_KEYS: JSON.stringify({ v2: Buffer.alloc(32, 2).toString("base64url") }),
    }),
    now,
  )
  const previousToken = await sealCredential(
    readPilotConfig(environment({ MOBILE_PILOT_ACTIVE_KEY_ID: "v1" }), now),
    claims,
    now,
  )
  await assert.rejects(() => openCredential(rotated, previousToken, "access", now + 1))
  const wrongEnvironment = readPilotConfig(
    environment({ MOBILE_PILOT_ENVIRONMENT: "other-pilot" }),
    now,
  )
  await assert.rejects(() => openCredential(wrongEnvironment, token, "access", now + 1))
  const changedCohort = readPilotConfig(
    environment({
      MOBILE_PILOT_ACCOUNTS: JSON.stringify([
        { email: "other@example.test", userId: "44444444-4444-4444-8444-444444444444" },
      ]),
    }),
    now,
  )
  await assert.rejects(() => openCredential(changedCohort, token, "access", now + 1))
  await assert.rejects(() => openCredential(config, `${token}.extra`, "access", now + 1))
})

test("accepts only the exact active configuration and pilot cohort", () => {
  const config = readPilotConfig(environment(), now)
  assert.deepEqual(eligibleAccount(config, "pilot@example.test"), account)
  assert.equal(eligibleAccount(config, "other@example.test"), null)

  for (const env of [
    environment({ MOBILE_AUTH_MODE: "local" }),
    environment({ MOBILE_PILOT_AUDIENCE: "http://chaarlie.de/api/mobile/v1" }),
    environment({ MOBILE_PILOT_ACCOUNTS: JSON.stringify([{ ...account }, { ...account }]) }),
    environment({ MOBILE_PILOT_KEYS: JSON.stringify({ v2: "not-a-key" }) }),
    environment({ MOBILE_PILOT_ACTIVE_KEY_ID: "constructor" }),
    environment({
      MOBILE_PILOT_KEYS: JSON.stringify(
        Object.fromEntries([["__proto__", Buffer.alloc(32, 2).toString("base64url")]]),
      ),
    }),
  ]) {
    assert.throws(() => readPilotConfig(env, now))
  }
})
