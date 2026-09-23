/**
 * Where the invite credential lives between the invite page and the claim.
 *
 * The partner flow mints a second, TTL-bound "intent" token for this. Discovery
 * reuses the invite credential itself: it is already an unguessable HMAC over
 * (enrollment id, token version), the participant already holds it in their
 * WhatsApp link, and every server surface re-checks revocation and the token
 * version per request — so a second signing scheme would add a key to rotate
 * without adding a guarantee. The cookie is the reason the claim works after the
 * page has dropped the fragment from the URL bar.
 */

export const DISCOVERY_INVITE_COOKIE = "chaarlie_discovery_invite"
export const DISCOVERY_INVITE_COOKIE_TTL_SECONDS = 24 * 60 * 60
/** The credential is base64url over a short payload; 512 is the token module's own cap. */
export const DISCOVERY_CREDENTIAL_MAX_LENGTH = 512

export const discoveryInviteCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: DISCOVERY_INVITE_COOKIE_TTL_SECONDS,
}

export function readDiscoveryCredentialInput(value: unknown): string | null {
  return typeof value === "string" &&
    value.length > 0 &&
    value.length <= DISCOVERY_CREDENTIAL_MAX_LENGTH
    ? value
    : null
}
