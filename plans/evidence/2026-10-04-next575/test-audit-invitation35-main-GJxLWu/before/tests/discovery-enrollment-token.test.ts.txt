import assert from "node:assert/strict"
import test from "node:test"

import {
  decodeDiscoveryEnrollmentCredential,
  discoveryEnrollmentSigningSecret,
  projectDiscoveryEnrollmentCredential,
} from "../src/lib/discovery/token"

const SECRET = "discovery-enrollment-secret-with-enough-length"
const OTHER_SECRET = "a-different-discovery-secret-of-sufficient-length"
const enrollmentId = "3f1a6f2e-2b44-4a1e-9a1a-6f2e2b444a1e"

test("a discovery credential round-trips through its signature", () => {
  const credential = projectDiscoveryEnrollmentCredential({ enrollmentId, tokenVersion: 3 }, SECRET)

  assert.match(credential, /^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/)
  assert.deepEqual(decodeDiscoveryEnrollmentCredential(credential, SECRET), {
    enrollmentId,
    tokenVersion: 3,
  })
  // The link is a pure projection of (id, version): rotating the version
  // produces a different credential and invalidates every copy of the old one.
  assert.notEqual(
    credential,
    projectDiscoveryEnrollmentCredential({ enrollmentId, tokenVersion: 4 }, SECRET),
  )
  assert.equal(
    credential,
    projectDiscoveryEnrollmentCredential({ enrollmentId, tokenVersion: 3 }, SECRET),
  )
})

test("tampered, foreign-signed and malformed credentials are rejected", () => {
  const credential = projectDiscoveryEnrollmentCredential({ enrollmentId, tokenVersion: 1 }, SECRET)
  const [version, payload, signature] = credential.split(".")
  const forgedPayload = Buffer.from(`${enrollmentId}:99`, "utf8").toString("base64url")

  for (const tampered of [
    `${version}.${forgedPayload}.${signature}`,
    `${version}.${payload}.${signature.slice(0, -2)}xy`,
    `v2.${payload}.${signature}`,
    `${version}.${payload}`,
    `${version}.${payload}.${signature}.extra`,
    credential.toUpperCase(),
    "",
    null,
    undefined,
  ]) {
    assert.equal(decodeDiscoveryEnrollmentCredential(tampered, SECRET), null)
  }

  assert.equal(decodeDiscoveryEnrollmentCredential(credential, OTHER_SECRET), null)
  assert.equal(decodeDiscoveryEnrollmentCredential("v1." + "a".repeat(600) + ".sig", SECRET), null)
})

test("a short signing secret can neither sign nor verify", () => {
  assert.throws(
    () => projectDiscoveryEnrollmentCredential({ enrollmentId, tokenVersion: 1 }, "too-short"),
    /at least 32 characters/,
  )
  const credential = projectDiscoveryEnrollmentCredential({ enrollmentId, tokenVersion: 1 }, SECRET)
  assert.equal(decodeDiscoveryEnrollmentCredential(credential, "too-short"), null)
  assert.throws(() => discoveryEnrollmentSigningSecret("too-short"), /at least 32 characters/)
  assert.throws(() => discoveryEnrollmentSigningSecret(""), /not configured/)
  assert.equal(discoveryEnrollmentSigningSecret(SECRET), SECRET)
})

test("an unsigned payload shape is refused at projection time", () => {
  assert.throws(
    () =>
      projectDiscoveryEnrollmentCredential({ enrollmentId: "not-a-uuid", tokenVersion: 1 }, SECRET),
    /Invalid discovery enrollment identifier/,
  )
  assert.throws(
    () => projectDiscoveryEnrollmentCredential({ enrollmentId, tokenVersion: 0 }, SECRET),
    /Invalid discovery enrollment token version/,
  )
})
