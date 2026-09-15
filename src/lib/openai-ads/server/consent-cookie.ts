import "server-only"
import { createHmac, timingSafeEqual } from "node:crypto"

export const OPENAI_CONSENT_COOKIE = "chaarlie_openai_consent"
export const OPENAI_CONSENT_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000
export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
export type OpenAIConsentIdentity = { id: string; issuedAt: number }
const purpose = "chaarlie:openai-ads-consent:v1:"
function signature(encoded: string, secret: string) {
  return createHmac("sha256", secret)
    .update(purpose + encoded)
    .digest()
}
export function encodeOpenAIConsentCookie(identity: OpenAIConsentIdentity, secret: string) {
  const encoded = Buffer.from(JSON.stringify(identity)).toString("base64url")
  return `${encoded}.${signature(encoded, secret).toString("base64url")}`
}
export function decodeOpenAIConsentCookie(
  value: string | undefined,
  secret: string,
  now = Date.now(),
): OpenAIConsentIdentity | null {
  try {
    if (!value || value.length > 512) return null
    const [encoded, signed, extra] = value.split(".")
    if (!encoded || !signed || extra) return null
    const actual = Buffer.from(signed, "base64url"),
      expected = signature(encoded, secret)
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null
    const identity = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"))
    if (
      !UUID_PATTERN.test(identity.id) ||
      !Number.isSafeInteger(identity.issuedAt) ||
      identity.issuedAt > now ||
      identity.issuedAt <= now - OPENAI_CONSENT_MAX_AGE_MS
    )
      return null
    return { id: identity.id, issuedAt: identity.issuedAt }
  } catch {
    return null
  }
}
