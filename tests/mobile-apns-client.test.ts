import assert from "node:assert/strict"
import test from "node:test"
import { decodeJwt, decodeProtectedHeader, exportPKCS8, generateKeyPair } from "jose"
import {
  ApnsClient,
  classifyApnsResponse,
  readApnsConfig,
  type ApnsRequest,
} from "@/lib/mobile/apns-client"

const now = 1_900_000_000_000
const submissionId = "11111111-1111-4111-8111-111111111111"
const deviceToken = "a".repeat(64)

async function config() {
  const { privateKey } = await generateKeyPair("ES256", { extractable: true })
  return {
    environment: "sandbox" as const,
    keyId: "ABC123DEFG",
    teamId: "DEF123GHIJ",
    topic: "de.chaarlie.app",
    privateKey: await exportPKCS8(privateKey),
  }
}

test("APNs research push uses ES256 token auth, HTTP/2 request data, and generic payload", async () => {
  let request: ApnsRequest | undefined
  const client = new ApnsClient(await config(), {
    now: () => now,
    createId: () => "22222222-2222-4222-8222-222222222222",
    transport: async (sent) => {
      request = sent
      return { status: 200, headers: { "apns-id": sent.headers["apns-id"] } }
    },
  })

  assert.deepEqual(await client.sendResearchReady({ deviceToken, submissionId }), {
    state: "accepted",
    apnsId: "22222222-2222-4222-8222-222222222222",
  })
  assert.ok(request)
  assert.equal(request.origin, "https://api.sandbox.push.apple.com")
  assert.equal(request.path, `/3/device/${deviceToken}`)
  assert.equal(request.headers["apns-push-type"], "alert")
  assert.equal(request.headers["apns-topic"], "de.chaarlie.app")
  assert.equal(request.headers["apns-expiration"], String(now / 1000 + 15 * 60))
  assert.deepEqual(JSON.parse(request.body), {
    aps: { alert: { title: "chaarlie", body: "Dein Produkt ist bereit." }, sound: "default" },
    url: `https://chaarlie.de/app/research/${submissionId}`,
  })
  const token = request.headers.authorization.slice("bearer ".length)
  assert.deepEqual(decodeProtectedHeader(token), { alg: "ES256", kid: "ABC123DEFG" })
  assert.deepEqual(decodeJwt(token), { iss: "DEF123GHIJ", iat: now / 1000 })
})

test("APNs uses the production origin and reuses provider tokens before Apple expiry", async () => {
  const authorizations: string[] = []
  let clock = now
  const client = new ApnsClient(
    { ...(await config()), environment: "production" },
    {
      now: () => clock,
      createId: () => "22222222-2222-4222-8222-222222222222",
      transport: async (request) => {
        authorizations.push(request.headers.authorization)
        assert.equal(request.origin, "https://api.push.apple.com")
        return { status: 200 }
      },
    },
  )
  await client.sendResearchReady({ deviceToken, submissionId })
  clock += 10_000
  await client.sendResearchReady({ deviceToken, submissionId })
  assert.equal(authorizations[0], authorizations[1])
})

test("APNs responses distinguish invalid tokens, retryable responses, rejected requests and ambiguity", () => {
  const id = "22222222-2222-4222-8222-222222222222"
  assert.deepEqual(
    classifyApnsResponse(
      {
        status: 410,
        body: JSON.stringify({ reason: "Unregistered", timestamp: 1_900_000_000_000 }),
      },
      id,
    ),
    {
      state: "invalid_token",
      apnsId: id,
      reason: "Unregistered",
      invalidatedAt: 1_900_000_000_000,
    },
  )
  assert.deepEqual(
    classifyApnsResponse({ status: 400, body: JSON.stringify({ reason: "BadDeviceToken" }) }, id),
    { state: "invalid_token", apnsId: id, reason: "BadDeviceToken", invalidatedAt: null },
  )
  assert.deepEqual(
    classifyApnsResponse(
      {
        status: 503,
        headers: { "retry-after": "30" },
        body: JSON.stringify({ reason: "ServiceUnavailable" }),
      },
      id,
    ),
    { state: "retryable", apnsId: id, reason: "ServiceUnavailable", retryAfterSeconds: 30 },
  )
  // A provider-credential fault affects every device at once and is ours to repair;
  // it must stay recoverable instead of burning each user's only push.
  for (const reason of ["InvalidProviderToken", "ExpiredProviderToken"]) {
    assert.deepEqual(classifyApnsResponse({ status: 403, body: JSON.stringify({ reason }) }, id), {
      state: "retryable",
      apnsId: id,
      reason,
      retryAfterSeconds: 3600,
    })
  }
  assert.deepEqual(
    classifyApnsResponse({ status: 400, body: JSON.stringify({ reason: "BadTopic" }) }, id),
    { state: "rejected", apnsId: id, reason: "BadTopic" },
  )
})

test("transport response loss becomes unknown and must not trigger a blind resend", async () => {
  const client = new ApnsClient(await config(), {
    now: () => now,
    createId: () => "22222222-2222-4222-8222-222222222222",
    transport: async () => {
      throw new Error("socket closed after request")
    },
  })
  assert.deepEqual(await client.sendResearchReady({ deviceToken, submissionId }), {
    state: "unknown",
    apnsId: "22222222-2222-4222-8222-222222222222",
    reason: "transport_failure",
  })
})

test("a transport without an APNs HTTP status is unknown, not a definite rejection", () => {
  assert.deepEqual(classifyApnsResponse({ status: 0 }, "22222222-2222-4222-8222-222222222222"), {
    state: "unknown",
    apnsId: "22222222-2222-4222-8222-222222222222",
    reason: "transport_failure",
  })
})

test("configuration fails closed without exposing provider secrets", () => {
  assert.deepEqual(
    readApnsConfig({
      MOBILE_APNS_ENVIRONMENT: "production",
      MOBILE_APNS_KEY_ID: "ABC123DEFG",
      MOBILE_APNS_TEAM_ID: "DEF123GHIJ",
      MOBILE_APNS_TOPIC: "de.chaarlie.app",
      MOBILE_APNS_PRIVATE_KEY: "private",
    }),
    {
      environment: "production",
      keyId: "ABC123DEFG",
      teamId: "DEF123GHIJ",
      topic: "de.chaarlie.app",
      privateKey: "private",
    },
  )
  assert.throws(
    () => readApnsConfig({ MOBILE_APNS_ENVIRONMENT: "production" }),
    /MOBILE_APNS_KEY_ID is not set/,
  )
  assert.throws(
    () =>
      new ApnsClient({
        ...readApnsConfig({
          MOBILE_APNS_ENVIRONMENT: "sandbox",
          MOBILE_APNS_KEY_ID: "ABC123DEFG",
          MOBILE_APNS_TEAM_ID: "DEF123GHIJ",
          MOBILE_APNS_TOPIC: "not a topic",
          MOBILE_APNS_PRIVATE_KEY: "private",
        }),
      }),
    /APNs topic is invalid/,
  )
})
