import { createHmac, timingSafeEqual } from "node:crypto"

/**
 * Discovery enrollment credential — the value that travels in the invite link's
 * URL fragment (`/beratung/einladung#code=…`, never a query parameter). Same
 * reproducible HMAC shape as src/lib/partner-access/token.ts: the link is a
 * projection of (id, token_version), so rotating the version invalidates every
 * copy of the old link without storing any per-link secret.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const CREDENTIAL_VERSION = "v1"
const MINIMUM_SECRET_LENGTH = 32

export type DiscoveryEnrollmentCredentialPayload = {
  enrollmentId: string
  tokenVersion: number
}

function assertSecret(secret: string) {
  if (secret.length < MINIMUM_SECRET_LENGTH) {
    throw new Error("Discovery enrollment signing secret must contain at least 32 characters")
  }
}

function assertPayload(payload: DiscoveryEnrollmentCredentialPayload) {
  if (!UUID.test(payload.enrollmentId)) throw new Error("Invalid discovery enrollment identifier")
  if (!Number.isSafeInteger(payload.tokenVersion) || payload.tokenVersion < 1) {
    throw new Error("Invalid discovery enrollment token version")
  }
}

function encodePayload(payload: DiscoveryEnrollmentCredentialPayload) {
  return Buffer.from(
    `${payload.enrollmentId.toLowerCase()}:${payload.tokenVersion}`,
    "utf8",
  ).toString("base64url")
}

function signature(version: string, encodedPayload: string, secret: string) {
  return createHmac("sha256", secret).update(`${version}.${encodedPayload}`, "utf8").digest()
}

export function projectDiscoveryEnrollmentCredential(
  payload: DiscoveryEnrollmentCredentialPayload,
  secret: string,
) {
  assertSecret(secret)
  assertPayload(payload)
  const encodedPayload = encodePayload(payload)
  return `${CREDENTIAL_VERSION}.${encodedPayload}.${signature(
    CREDENTIAL_VERSION,
    encodedPayload,
    secret,
  ).toString("base64url")}`
}

export function decodeDiscoveryEnrollmentCredential(
  credential: string | null | undefined,
  secret: string,
): DiscoveryEnrollmentCredentialPayload | null {
  if (!credential || credential.length > 512 || secret.length < MINIMUM_SECRET_LENGTH) return null
  const [version, encodedPayload, encodedSignature, ...rest] = credential.split(".")
  if (version !== CREDENTIAL_VERSION || !encodedPayload || !encodedSignature || rest.length)
    return null

  let supplied: Buffer
  try {
    supplied = Buffer.from(encodedSignature, "base64url")
  } catch {
    return null
  }
  const expected = signature(version, encodedPayload, secret)
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null

  try {
    const decoded = Buffer.from(encodedPayload, "base64url").toString("utf8")
    const separator = decoded.lastIndexOf(":")
    const enrollmentId = decoded.slice(0, separator)
    const tokenVersion = Number(decoded.slice(separator + 1))
    const payload = { enrollmentId, tokenVersion }
    assertPayload(payload)
    if (encodePayload(payload) !== encodedPayload) return null
    return payload
  } catch {
    return null
  }
}

export function discoveryEnrollmentSigningSecret(explicit?: string) {
  const secret = explicit ?? process.env.DISCOVERY_ENROLLMENT_SIGNING_SECRET
  if (!secret) throw new Error("Discovery enrollment signing secret is not configured")
  assertSecret(secret)
  return secret
}
