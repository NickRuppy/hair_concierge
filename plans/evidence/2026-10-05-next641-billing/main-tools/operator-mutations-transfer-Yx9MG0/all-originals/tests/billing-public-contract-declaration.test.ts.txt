import assert from "node:assert/strict"
import test from "node:test"
import { parsePublicContractDeclaration } from "../src/lib/billing/public-contract-declaration"

const input = {
  requestId: "00000000-0000-4000-8000-000000000001",
  kind: "ordinary_cancellation",
  name: " Marie Beispiel ",
  email: " Marie@EXAMPLE.com ",
  contract: " Chaarlie Jahresabo · CH-12345 ",
  requestedEnd: "Zum nächstmöglichen Zeitpunkt",
  reason: null,
}

test("accepts a cancellation without authentication and normalizes only surrounding whitespace/email", () => {
  assert.deepEqual(parsePublicContractDeclaration(input), {
    ...input,
    name: "Marie Beispiel",
    email: "marie@example.com",
    contract: "Chaarlie Jahresabo · CH-12345",
  })
})

test("keeps withdrawal separate; rejects cancellation timing/reason and unknown account-authority fields", () => {
  assert.equal(parsePublicContractDeclaration({ ...input, kind: "withdrawal" }), null)
  assert.equal(parsePublicContractDeclaration({ ...input, userId: "someone-else" }), null)
  assert.equal(parsePublicContractDeclaration({ ...input, effectiveEndAt: "2099-01-01" }), null)
  assert.equal(
    parsePublicContractDeclaration({ ...input, kind: "ordinary_cancellation", reason: "reason" }),
    null,
  )
  assert.equal(parsePublicContractDeclaration({ ...input, kind: "refund" }), null)
  const withdrawal = { ...input, kind: "withdrawal", requestedEnd: null, reason: null }
  assert.equal(parsePublicContractDeclaration(withdrawal)?.kind, "withdrawal")
  assert.equal(
    parsePublicContractDeclaration({
      ...input,
      kind: "extraordinary_cancellation",
      reason: "Mein Grund",
    })?.reason,
    "Mein Grund",
  )
})

test("bounds untrusted text, requires usable contact/contract, and rejects control characters", () => {
  for (const changes of [
    { email: "a@example.com\r\nBcc: victim@example.com" },
    { email: "not-an-email" },
    { name: " " },
    { contract: " " },
    { contract: "x".repeat(501) },
    { name: "hello\u0000world" },
    { requestedEnd: " " },
    { requestId: "predictable" },
  ])
    assert.equal(parsePublicContractDeclaration({ ...input, ...changes }), null)
})
