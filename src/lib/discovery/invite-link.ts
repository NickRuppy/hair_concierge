import type { DiscoveryEnrollmentRow } from "./enrollment"
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

/** One invite as `/admin/beratung` shows and manages it. */
export type DiscoveryAdminInvite = {
  enrollmentId: string
  name: string
  /** Null until the participant types it on the invite page. */
  email: string | null
  status: "invited" | "claimed" | "revoked"
  tokenVersion: number
  /** Null for a revoked invite: there is no working link to hand out. */
  url: string | null
}

export function projectDiscoveryAdminInvite(
  row: DiscoveryEnrollmentRow,
  context: { secret: string; siteUrl: string },
): DiscoveryAdminInvite {
  const status = row.revoked_at ? "revoked" : row.claimed_at ? "claimed" : "invited"
  return {
    enrollmentId: row.id,
    name: row.display_name,
    email: row.normalized_email,
    status,
    tokenVersion: row.token_version,
    url:
      status === "revoked"
        ? null
        : buildDiscoveryInviteUrl({
            enrollmentId: row.id,
            tokenVersion: row.token_version,
            secret: context.secret,
            siteUrl: context.siteUrl,
          }),
  }
}
