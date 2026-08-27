const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * The campaign UUID is safe to carry through normal authentication redirects;
 * it identifies an invitation campaign but is neither a bearer credential nor
 * a roster lookup. Keeping the narrow shape here prevents generic auth
 * callbacks from treating an arbitrary `next` as moderator context.
 */
export function isModeratorReturnPath(value: string | null | undefined): value is string {
  if (!value) return false

  try {
    const url = new URL(value, "https://moderator-return.invalid")
    return (
      url.origin === "https://moderator-return.invalid" &&
      url.pathname === "/test/haarplan/konto" &&
      UUID.test(url.searchParams.get("campaign") ?? "") &&
      [...url.searchParams.keys()].every((key) => key === "campaign")
    )
  } catch {
    return false
  }
}

export function moderatorReturnPath(campaignId: string): string | null {
  if (!UUID.test(campaignId)) return null
  return `/test/haarplan/konto?campaign=${encodeURIComponent(campaignId)}`
}
