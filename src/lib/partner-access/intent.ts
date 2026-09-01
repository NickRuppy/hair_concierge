import { createHmac, timingSafeEqual } from "node:crypto"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const VERSION = 1

export const PARTNER_ACCESS_INTENT_COOKIE = "chaarlie_partner_access_intent"
export const PARTNER_ACCESS_INTENT_TTL_SECONDS = 24 * 60 * 60

export type PartnerAccessIntent = {
  invitationId: string
  tokenVersion: number
  issuedAt: number
  expiresAt: number
}

function sign(encoded: string, secret: string) {
  return createHmac("sha256", `${secret}:partner-access-intent:v1`).update(encoded).digest()
}

function isValidIntent(value: PartnerAccessIntent) {
  return (
    UUID.test(value.invitationId) &&
    Number.isSafeInteger(value.tokenVersion) &&
    value.tokenVersion > 0 &&
    Number.isFinite(value.issuedAt) &&
    Number.isFinite(value.expiresAt) &&
    value.expiresAt > value.issuedAt
  )
}

export function createPartnerAccessIntent(value: PartnerAccessIntent, secret: string) {
  if (secret.length < 32) throw new Error("Partner access signing secret is too short")
  if (!isValidIntent(value)) throw new Error("Invalid partner access intent")
  const encoded = Buffer.from(
    JSON.stringify({ version: VERSION, payload: value }),
    "utf8",
  ).toString("base64url")
  return `${encoded}.${sign(encoded, secret).toString("base64url")}`
}

export function decodePartnerAccessIntent(
  value: string | null | undefined,
  secret: string,
  now = Date.now(),
): PartnerAccessIntent | null {
  if (!value || value.length > 1024 || secret.length < 32) return null
  try {
    const [encoded, signature, extra] = value.split(".")
    if (!encoded || !signature || extra) return null
    const supplied = Buffer.from(signature, "base64url")
    const expected = sign(encoded, secret)
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null
    const decoded = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as {
      version?: unknown
      payload?: PartnerAccessIntent
    }
    if (decoded.version !== VERSION || !decoded.payload || !isValidIntent(decoded.payload))
      return null
    if (decoded.payload.issuedAt > now || decoded.payload.expiresAt <= now) return null
    return decoded.payload
  } catch {
    return null
  }
}

export const partnerAccessIntentCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: PARTNER_ACCESS_INTENT_TTL_SECONDS,
}
