import assert from "node:assert/strict"
import test from "node:test"

import { createTrialIdentityClaims } from "../src/lib/billing/trial-identity-claims"

const secret = new TextEncoder().encode("0123456789abcdef0123456789abcdef")

test("projects a canonical identity tuple as a versioned SHA-256 HMAC claim", () => {
  assert.deepEqual(
    createTrialIdentityClaims(
      [{ kind: "verified_email", namespace: "chaarlie", normalizedIdentity: "Person@Example.com" }],
      [{ version: 7, secret }],
    ),
    [
      {
        kind: "verified_email",
        keyVersion: 7,
        namespace: "chaarlie",
        value: "16552af0a40a97868a0a490f92e9969f1607e61d754999c1bf703c7722e192bb",
      },
    ],
  )
})

test("separates kind, namespace, and key material", () => {
  const claims = createTrialIdentityClaims(
    [
      { kind: "account", namespace: "chaarlie", normalizedIdentity: "same" },
      { kind: "stripe_card", namespace: "stripe", normalizedIdentity: "same" },
      { kind: "stripe_card", namespace: "other", normalizedIdentity: "same" },
    ],
    [
      { version: 1, secret },
      { version: 2, secret: new TextEncoder().encode("abcdefghijklmnopqrstuvwxyzABCDEF") },
    ],
  )

  assert.equal(new Set(claims.map((claim) => claim.value)).size, claims.length)
  assert.equal(new Set(claims.map((claim) => `${claim.kind}:${claim.namespace}`)).size, 3)
})

test("derives every retained key version and deduplicates identical projections", () => {
  assert.deepEqual(
    createTrialIdentityClaims(
      [
        { kind: "account", namespace: "chaarlie", normalizedIdentity: "account-1" },
        { kind: "account", namespace: "chaarlie", normalizedIdentity: "account-1" },
      ],
      [
        { version: 2, secret },
        { version: 1, secret: new Uint8Array(secret) },
      ],
    ).map((claim) => claim.keyVersion),
    [2, 1],
  )
})

test("does not normalize the trusted adapter input or mutate inputs", () => {
  const identities = [
    { kind: "verified_email", namespace: "chaarlie", normalizedIdentity: "A.B+tag@Example.COM" },
  ] as const
  const keys = [{ version: 1, secret: new Uint8Array(secret) }] as const
  const identitiesBefore = structuredClone(identities)
  const keysBefore = keys.map((key) => ({
    version: key.version,
    secret: new Uint8Array(key.secret),
  }))

  const upper = createTrialIdentityClaims(identities, keys)
  const lower = createTrialIdentityClaims(
    [{ kind: "verified_email", namespace: "chaarlie", normalizedIdentity: "a.b+tag@example.com" }],
    keys,
  )

  assert.notEqual(upper[0]?.value, lower[0]?.value)
  assert.deepEqual(identities, identitiesBefore)
  assert.deepEqual(keys, keysBefore)
})

test("rejects malformed identity and key inputs without exposing their contents", () => {
  const secretIdentity = "private@example.com"
  const secretKey = new Uint8Array(31).fill(42)
  const invalidInputs: unknown[][] = [
    [[], [{ version: 1, secret }]],
    [
      [{ kind: "ip", namespace: "network", normalizedIdentity: secretIdentity }],
      [{ version: 1, secret }],
    ],
    [
      [{ kind: "account", namespace: " chaarlie ", normalizedIdentity: secretIdentity }],
      [{ version: 1, secret }],
    ],
    [
      [{ kind: "account", namespace: "chaarlie", normalizedIdentity: "" }],
      [{ version: 1, secret }],
    ],
    [[{ kind: "account", namespace: "chaarlie", normalizedIdentity: secretIdentity }], []],
    [
      [{ kind: "account", namespace: "chaarlie", normalizedIdentity: secretIdentity }],
      [{ version: 0, secret }],
    ],
    [
      [{ kind: "account", namespace: "chaarlie", normalizedIdentity: secretIdentity }],
      [{ version: 1, secret: secretKey }],
    ],
  ]

  for (const [identities, keys] of invalidInputs) {
    assert.throws(
      () => createTrialIdentityClaims(identities as never, keys as never),
      (error: unknown) => {
        assert.ok(error instanceof Error)
        assert.equal(error.message.includes(secretIdentity), false)
        assert.equal(error.message.includes(String(secretKey[0])), false)
        return true
      },
    )
  }
})

test("rejects projections exceeding the SQL RPC claim cap", () => {
  const identities = Array.from({ length: 9 }, (_, index) => ({
    kind: "account" as const,
    namespace: "chaarlie",
    normalizedIdentity: `account-${index}`,
  }))
  const keys = Array.from({ length: 8 }, (_, index) => ({
    version: index + 1,
    secret: new Uint8Array(secret),
  }))

  assert.throws(() => createTrialIdentityClaims(identities, keys))
})
