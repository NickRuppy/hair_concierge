import "server-only"

import { createHmac } from "node:crypto"

import type { TrialIdentityClaim } from "./trial-eligibility"

export type TrialIdentityInput = Readonly<{
  kind: "account" | "verified_email" | "stripe_card" | "paypal_payer"
  namespace: string
  normalizedIdentity: string
}>

export type TrialIdentityClaimKey = Readonly<{
  version: number
  secret: Uint8Array
}>

const ALLOWED_KINDS = new Set<TrialIdentityInput["kind"]>([
  "account",
  "verified_email",
  "stripe_card",
  "paypal_payer",
])
const MAX_IDENTITIES = 64
const MAX_KEYS = 8
const MAX_CLAIMS = 64

function invalidIdentity(): never {
  throw new Error("Invalid trial identity claim input")
}

function invalidKey(): never {
  throw new Error("Invalid trial identity claim key")
}

function validateIdentities(
  identities: unknown,
): asserts identities is readonly TrialIdentityInput[] {
  if (!Array.isArray(identities) || identities.length === 0 || identities.length > MAX_IDENTITIES) {
    invalidIdentity()
  }

  for (const identity of identities) {
    if (
      identity === null ||
      typeof identity !== "object" ||
      !ALLOWED_KINDS.has((identity as TrialIdentityInput).kind) ||
      typeof (identity as TrialIdentityInput).namespace !== "string" ||
      (identity as TrialIdentityInput).namespace.length === 0 ||
      (identity as TrialIdentityInput).namespace.length > 255 ||
      (identity as TrialIdentityInput).namespace.trim() !==
        (identity as TrialIdentityInput).namespace ||
      typeof (identity as TrialIdentityInput).normalizedIdentity !== "string" ||
      (identity as TrialIdentityInput).normalizedIdentity.length === 0 ||
      (identity as TrialIdentityInput).normalizedIdentity.length > 1024
    ) {
      invalidIdentity()
    }
  }
}

function validateKeys(keys: unknown): asserts keys is readonly TrialIdentityClaimKey[] {
  if (!Array.isArray(keys) || keys.length === 0 || keys.length > MAX_KEYS) {
    invalidKey()
  }

  const versions = new Set<number>()
  for (const key of keys) {
    if (
      key === null ||
      typeof key !== "object" ||
      !Number.isSafeInteger((key as TrialIdentityClaimKey).version) ||
      (key as TrialIdentityClaimKey).version <= 0 ||
      (key as TrialIdentityClaimKey).version > 999_999_999 ||
      versions.has((key as TrialIdentityClaimKey).version) ||
      !((key as TrialIdentityClaimKey).secret instanceof Uint8Array) ||
      (key as TrialIdentityClaimKey).secret.byteLength < 32 ||
      (key as TrialIdentityClaimKey).secret.byteLength > 128
    ) {
      invalidKey()
    }
    versions.add((key as TrialIdentityClaimKey).version)
  }
}

/**
 * Projects trusted, already-normalized server identities to versioned HMAC claims.
 * During key rotation, retain matching old keys until the applicable lawful retention
 * period ends. A digest remains personal data; this adapter introduces neither a
 * deletion tombstone nor a retention duration.
 */
export function createTrialIdentityClaims(
  identities: readonly TrialIdentityInput[],
  keys: readonly TrialIdentityClaimKey[],
): readonly TrialIdentityClaim[] {
  validateIdentities(identities)
  validateKeys(keys)

  const claims: TrialIdentityClaim[] = []
  const seen = new Set<string>()
  for (const identity of identities) {
    const canonicalIdentity = JSON.stringify([
      identity.kind,
      identity.namespace,
      identity.normalizedIdentity,
    ])
    for (const key of keys) {
      const value = createHmac("sha256", key.secret).update(canonicalIdentity, "utf8").digest("hex")
      const deduplicationKey = `${identity.kind}\u0000${key.version}\u0000${identity.namespace}\u0000${value}`
      if (seen.has(deduplicationKey)) continue

      if (claims.length >= MAX_CLAIMS) invalidIdentity()
      seen.add(deduplicationKey)
      claims.push({
        kind: identity.kind,
        keyVersion: key.version,
        namespace: identity.namespace,
        value,
      })
    }
  }

  return claims
}
