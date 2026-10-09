import assert from "node:assert/strict"
import test from "node:test"

import {
  decodePartnerInvitationCredential,
  projectPartnerInvitationCredential,
} from "../src/lib/partner-access/token"

const secret = "partner-access-signing-secret-that-is-long-enough"
const invitationId = "10000000-0000-4000-8000-000000000001"

test("partner invitation credentials are deterministic, versioned, and tamper evident", () => {
  const first = projectPartnerInvitationCredential({ invitationId, tokenVersion: 4 }, secret)
  const replay = projectPartnerInvitationCredential({ invitationId, tokenVersion: 4 }, secret)

  assert.equal(first, replay)
  assert.match(first, /^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/)
  assert.deepEqual(decodePartnerInvitationCredential(first, secret), {
    invitationId,
    tokenVersion: 4,
  })
  assert.equal(decodePartnerInvitationCredential(`${first}x`, secret), null)
  assert.equal(decodePartnerInvitationCredential(first, `${secret}-wrong`), null)
})

test("rotating the stored version invalidates the previous credential", () => {
  const previous = projectPartnerInvitationCredential({ invitationId, tokenVersion: 1 }, secret)
  const current = projectPartnerInvitationCredential({ invitationId, tokenVersion: 2 }, secret)

  assert.notEqual(previous, current)
  assert.equal(decodePartnerInvitationCredential(previous, secret)?.tokenVersion, 1)
  assert.equal(decodePartnerInvitationCredential(current, secret)?.tokenVersion, 2)
})

test("credentials reject malformed identifiers, versions, and weak secrets", () => {
  assert.throws(
    () => projectPartnerInvitationCredential({ invitationId: "nope", tokenVersion: 1 }, secret),
    /invitation/i,
  )
  assert.throws(
    () => projectPartnerInvitationCredential({ invitationId, tokenVersion: 0 }, secret),
    /version/i,
  )
  assert.throws(
    () => projectPartnerInvitationCredential({ invitationId, tokenVersion: 1 }, "short"),
    /secret/i,
  )
})
