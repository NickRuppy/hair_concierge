import assert from "node:assert/strict"
import test from "node:test"
import { NextRequest } from "next/server"

import { createPartnerEmailChangeConfirmHandler } from "../src/app/api/partner-access/email-change/confirm/route"
import { createPartnerEmailChangeHandler } from "../src/app/api/partner-access/email-change/route"
import { PARTNER_ACCESS_INTENT_COOKIE } from "../src/lib/partner-access/intent"

const invitationId = "10000000-0000-4000-8000-000000000001"
const intent = { invitationId, tokenVersion: 1, issuedAt: 1, expiresAt: 9_999 }
const invitation = {
  display_name: "Lea Sommer",
  normalized_email: "lea@example.test",
  token_version: 1,
  claimed_user_id: null,
  revoked_at: null,
}

function request(email: string, origin = "https://chaarlie.de") {
  return new NextRequest("https://chaarlie.de/api/partner-access/email-change", {
    method: "POST",
    headers: {
      origin,
      "content-type": "application/json",
      cookie: `${PARTNER_ACCESS_INTENT_COOKIE}=signed-intent`,
    },
    body: JSON.stringify({ email }),
  })
}

function dependencies(overrides: Record<string, unknown> = {}) {
  return {
    decodeIntent: () => intent,
    loadInvitation: async () => invitation,
    issue: async () => ({ deliveryId: "message", queuedAt: new Date().toISOString() }),
    secret: () => "partner-access-signing-secret-that-is-long-enough",
    ...overrides,
  }
}

test("email correction validates the invitation and sends only the normalized new address", async () => {
  const issued: unknown[] = []
  const response = await createPartnerEmailChangeHandler(
    dependencies({
      issue: async (input: unknown) => {
        issued.push(input)
        return { deliveryId: "message", queuedAt: new Date().toISOString() }
      },
    }),
  )(request(" NEW@Example.Test "))

  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { accepted: true })
  assert.deepEqual(issued, [
    {
      invitationId,
      tokenVersion: 1,
      name: "Lea Sommer",
      email: "new@example.test",
      siteUrl: "https://chaarlie.de",
    },
  ])
})

test("email correction rejects cross-origin, stale, unchanged, and throttled requests", async () => {
  const handler = createPartnerEmailChangeHandler(dependencies())
  assert.equal((await handler(request("new@example.test", "https://evil.example"))).status, 403)
  assert.equal((await handler(request("lea@example.test"))).status, 400)

  const stale = createPartnerEmailChangeHandler(
    dependencies({ loadInvitation: async () => ({ ...invitation, token_version: 2 }) }),
  )
  assert.equal((await stale(request("new@example.test"))).status, 410)

  const throttled = createPartnerEmailChangeHandler(
    dependencies({
      issue: async () => {
        throw Object.assign(new Error("rate limited"), { code: "55P03" })
      },
    }),
  )
  const throttledResponse = await throttled(request("new@example.test"))
  assert.equal(throttledResponse.status, 429)
  assert.deepEqual(await throttledResponse.json(), {
    error: "Bitte warte kurz und versuche es dann noch einmal.",
  })
})

test("email confirmation returns a fresh fragment credential and fails closed", async () => {
  const confirmRequest = () =>
    new Request("https://chaarlie.de/api/partner-access/email-change/confirm", {
      method: "POST",
      headers: { origin: "https://chaarlie.de", "content-type": "application/json" },
      body: JSON.stringify({ token: "mailbox-proof" }),
    })
  const response = await createPartnerEmailChangeConfirmHandler({
    consume: async () => ({
      invitationId,
      name: "Lea Sommer",
      email: "new@example.test",
      tokenVersion: 2,
    }),
    projectCredential: () => "fresh-credential",
    secret: () => "partner-access-signing-secret-that-is-long-enough",
  })(confirmRequest())
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), {
    destination: "/partner/einladung?bestaetigt=1#code=fresh-credential",
  })

  const unavailable = createPartnerEmailChangeConfirmHandler({
    consume: async () => {
      throw new Error("expired")
    },
    secret: () => "partner-access-signing-secret-that-is-long-enough",
  })
  assert.equal((await unavailable(confirmRequest())).status, 410)
})
