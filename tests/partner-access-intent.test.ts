import assert from "node:assert/strict"
import test from "node:test"

import {
  createPartnerAccessIntent,
  decodePartnerAccessIntent,
  partnerAccessIntentCookieOptions,
} from "../src/lib/partner-access/intent"

const secret = "partner-access-signing-secret-that-is-long-enough"
const now = Date.UTC(2026, 8, 1, 8)

test("partner intent contains only invitation context and expires", () => {
  const value = createPartnerAccessIntent(
    {
      invitationId: "10000000-0000-4000-8000-000000000001",
      tokenVersion: 2,
      issuedAt: now,
      expiresAt: now + 60_000,
    },
    secret,
  )
  assert.deepEqual(decodePartnerAccessIntent(value, secret, now), {
    invitationId: "10000000-0000-4000-8000-000000000001",
    tokenVersion: 2,
    issuedAt: now,
    expiresAt: now + 60_000,
  })
  assert.equal(decodePartnerAccessIntent(value, secret, now + 60_000), null)
  assert.equal(value.includes("lea@example.test"), false)
  assert.equal(partnerAccessIntentCookieOptions.httpOnly, true)
  assert.equal(partnerAccessIntentCookieOptions.sameSite, "lax")
})
