const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * The campaign UUID is safe to carry through normal authentication redirects;
 * it identifies an invitation campaign but is neither a bearer credential nor
 * a roster lookup. Keeping the narrow shape here prevents generic auth
 * callbacks from treating an arbitrary `next` as moderator context.
 */
export function isModeratorReturnPath(value: string | null | undefined): value is string {
  return normalizeModeratorReturnPath(value) !== null
}

/** Rebuild the destination from its identifier; never navigate to raw query input. */
export function normalizeModeratorReturnPath(value: string | null | undefined): string | null {
  const match = value?.match(/^\/test\/haarplan\/konto\?campaign=([0-9A-Fa-f-]{36})$/)
  return match ? moderatorReturnPath(match[1]) : null
}

export function moderatorReturnPath(campaignId: string): string | null {
  if (!UUID.test(campaignId)) return null
  return `/test/haarplan/konto?campaign=${encodeURIComponent(campaignId)}`
}
