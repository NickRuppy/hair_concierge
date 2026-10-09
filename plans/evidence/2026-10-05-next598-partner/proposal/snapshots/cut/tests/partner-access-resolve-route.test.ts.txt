import assert from "node:assert/strict"
import test from "node:test"
import { NextRequest } from "next/server"

import { createPartnerAccessResolveHandler } from "../src/app/api/partner-access/resolve/route"
import { PARTNER_ACCESS_INTENT_COOKIE } from "../src/lib/partner-access/intent"

const invitationId = "10000000-0000-4000-8000-000000000001"

function request(body: unknown, origin = "https://chaarlie.de") {
  return new NextRequest("https://chaarlie.de/api/partner-access/resolve", {
    method: "POST",
    headers: { "content-type": "application/json", origin },
    body: JSON.stringify(body),
  })
}

function resumeRequest(cookie = "signed-intent", origin = "https://chaarlie.de") {
  return new NextRequest("https://chaarlie.de/api/partner-access/resolve", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: `${PARTNER_ACCESS_INTENT_COOKIE}=${cookie}`,
      origin,
    },
    body: JSON.stringify({ resume: true }),
  })
}

test("resolve shows personal identity and stores only signed invitation context", async () => {
  const credential = "v1.sensitive.personal"
  const handler = createPartnerAccessResolveHandler({
    resolveInvitation: async (value) => {
      assert.equal(value, credential)
      return { invitationId, name: "Lea", email: "lea@example.test", state: "pending" }
    },
    decodeCredential: () => ({ invitationId, tokenVersion: 3 }),
    createIntent: () => "signed-intent-without-credential",
    now: () => 1_000,
  })
  const response = await handler(request({ credential }))

  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), {
    name: "Lea",
    email: "lea@example.test",
    state: "pending",
  })
  assert.equal(
    response.cookies.get(PARTNER_ACCESS_INTENT_COOKIE)?.value,
    "signed-intent-without-credential",
  )
  assert.equal(response.headers.get("cache-control"), "private, no-store")
  assert.equal(response.headers.get("set-cookie")?.includes(credential), false)
})

test("resolve rejects cross-origin, malformed, and unavailable credentials generically", async () => {
  const handler = createPartnerAccessResolveHandler({
    resolveInvitation: async () => null,
    decodeCredential: () => null,
    createIntent: () => "unused",
    now: () => 1_000,
  })
  assert.equal((await handler(request({ credential: "x" }, "https://evil.example"))).status, 403)
  assert.equal((await handler(request({ nope: "x" }))).status, 400)
  const unavailable = await handler(request({ credential: "x" }))
  assert.equal(unavailable.status, 410)
  assert.deepEqual(await unavailable.json(), { error: "Diese Einladung ist nicht verfügbar." })
})

test("resolve resumes the personal screen from the signed HttpOnly intent cookie", async () => {
  const handler = createPartnerAccessResolveHandler({
    decodeIntent: () => ({
      invitationId,
      tokenVersion: 3,
      issuedAt: 500,
      expiresAt: 2_000,
    }),
    resolveByIntent: async (intent) => {
      assert.equal(intent.invitationId, invitationId)
      assert.equal(intent.tokenVersion, 3)
      return { invitationId, name: "Lea", email: "lea@example.test", state: "pending" }
    },
    createIntent: () => "renewed-signed-intent",
    now: () => 1_000,
  })
  const response = await handler(resumeRequest())

  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), {
    name: "Lea",
    email: "lea@example.test",
    state: "pending",
  })
  assert.equal(response.cookies.get(PARTNER_ACCESS_INTENT_COOKIE)?.value, "renewed-signed-intent")
})

test("resolve rejects resume without a valid intent cookie", async () => {
  const handler = createPartnerAccessResolveHandler({
    decodeIntent: () => null,
    resolveByIntent: async () => {
      throw new Error("must not load")
    },
    createIntent: () => "unused",
    now: () => 1_000,
  })
  assert.equal((await handler(resumeRequest())).status, 410)
})
