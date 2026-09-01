import { createHmac, timingSafeEqual } from "node:crypto"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const CREDENTIAL_VERSION = "v1"
const MINIMUM_SECRET_LENGTH = 32

export type PartnerInvitationCredentialPayload = {
  invitationId: string
  tokenVersion: number
}

function assertSecret(secret: string) {
  if (secret.length < MINIMUM_SECRET_LENGTH) {
    throw new Error("Partner invitation signing secret must contain at least 32 characters")
  }
}

function assertPayload(payload: PartnerInvitationCredentialPayload) {
  if (!UUID.test(payload.invitationId)) throw new Error("Invalid partner invitation identifier")
  if (!Number.isSafeInteger(payload.tokenVersion) || payload.tokenVersion < 1) {
    throw new Error("Invalid partner invitation token version")
  }
}

function encodePayload(payload: PartnerInvitationCredentialPayload) {
  return Buffer.from(
    `${payload.invitationId.toLowerCase()}:${payload.tokenVersion}`,
    "utf8",
  ).toString("base64url")
}

function signature(version: string, encodedPayload: string, secret: string) {
  return createHmac("sha256", secret).update(`${version}.${encodedPayload}`, "utf8").digest()
}

export function projectPartnerInvitationCredential(
  payload: PartnerInvitationCredentialPayload,
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

export function decodePartnerInvitationCredential(
  credential: string | null | undefined,
  secret: string,
): PartnerInvitationCredentialPayload | null {
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
    const invitationId = decoded.slice(0, separator)
    const tokenVersion = Number(decoded.slice(separator + 1))
    const payload = { invitationId, tokenVersion }
    assertPayload(payload)
    if (encodePayload(payload) !== encodedPayload) return null
    return payload
  } catch {
    return null
  }
}
