import { DISCOVERY_INVITE_PATH } from "./participant"
import { projectDiscoveryEnrollmentCredential } from "./token"

/**
 * The personal invite link, derived — never stored — from (enrollment id, token
 * version). The CLI and `/admin/beratung` both project it here, so a link copied
 * from either is the same link, and „Link erneuern" (a version bump) kills every
 * earlier copy at once.
 *
 * The credential travels in the URL fragment so it never reaches a server log, a
 * Referer header or an analytics query string.
 */
export function buildDiscoveryInviteUrl(input: {
  enrollmentId: string
  tokenVersion: number
  secret: string
  siteUrl: string
}): string {
  const credential = projectDiscoveryEnrollmentCredential(
    { enrollmentId: input.enrollmentId, tokenVersion: input.tokenVersion },
    input.secret,
  )
  return `${input.siteUrl.replace(/\/+$/, "")}${DISCOVERY_INVITE_PATH}#code=${encodeURIComponent(credential)}`
}

export function discoveryPublicSiteUrl(explicit?: string): string {
  const site = explicit ?? process.env.NEXT_PUBLIC_SITE_URL ?? "https://chaarlie.de"
  return site.replace(/\/+$/, "")
}
