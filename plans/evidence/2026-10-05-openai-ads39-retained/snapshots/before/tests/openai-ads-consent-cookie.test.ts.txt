import assert from "node:assert/strict"
import test from "node:test"
import { createHmac } from "node:crypto"
import {
  encodeOpenAIConsentCookie,
  decodeOpenAIConsentCookie,
  OPENAI_CONSENT_MAX_AGE_MS,
} from "../src/lib/openai-ads/server/consent-cookie"
const secret = "unit-test-signing-secret"
const identity = { id: "11111111-1111-4111-8111-111111111111", issuedAt: 1000 }
test("signed consent identity rejects tampering, expiry, future issue and a different purpose", async () => {
  const value = encodeOpenAIConsentCookie(identity, secret)
  assert.deepEqual(decodeOpenAIConsentCookie(value, secret, 1001), identity)
  assert.equal(decodeOpenAIConsentCookie(value + "x", secret, 1001), null)
  assert.equal(decodeOpenAIConsentCookie(value, secret, 1000 + OPENAI_CONSENT_MAX_AGE_MS), null)
  assert.equal(decodeOpenAIConsentCookie(value, secret, 999), null)
  assert.equal(decodeOpenAIConsentCookie(value, "different", 1001), null)
})

test("same signing key cannot authenticate a token without the OpenAI purpose", () => {
  const encoded = Buffer.from(JSON.stringify(identity)).toString("base64url")
  const signed = createHmac("sha256", secret).update(encoded).digest("base64url")
  assert.equal(decodeOpenAIConsentCookie(`${encoded}.${signed}`, secret, 1001), null)
})
