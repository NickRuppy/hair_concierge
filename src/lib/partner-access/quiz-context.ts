export const PARTNER_QUIZ_CONTEXT_ENDPOINT = "/api/partner-access/quiz-context"
export const PARTNER_QUIZ_ENTRY_HREF = "/quiz?partner=1"

export type PartnerQuizContextPayload =
  | { status: "regular" }
  | { status: "unavailable" }
  | { status: "creator"; name: string; email: string }

export function hasPartnerAccessQuizHint(user: { app_metadata?: unknown } | null): boolean {
  if (!user?.app_metadata || typeof user.app_metadata !== "object") return false
  return (
    typeof (user.app_metadata as Record<string, unknown>).partner_access_invitation_id === "string"
  )
}

export function isPartnerQuizEntrySearch(search: string): boolean {
  return new URLSearchParams(search).get("partner") === "1"
}

export function getPartnerQuizContextLookupKey({
  authLoading,
  hasMetadataHint,
  search,
  userId,
}: {
  authLoading: boolean
  hasMetadataHint: boolean
  search: string
  userId: string | null
}): "regular" | "marker" | `user:${string}` {
  if (isPartnerQuizEntrySearch(search)) return "marker"
  if (!authLoading && hasMetadataHint && userId) return `user:${userId}`
  return "regular"
}

export function parsePartnerQuizContextPayload(value: unknown): PartnerQuizContextPayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { status: "unavailable" }
  }
  const row = value as Record<string, unknown>
  if (row.status === "regular") return { status: "regular" }
  if (row.status === "unavailable") return { status: "unavailable" }
  if (row.status !== "creator" || typeof row.name !== "string" || typeof row.email !== "string") {
    return { status: "unavailable" }
  }
  const name = row.name.trim()
  const email = row.email.trim().toLowerCase()
  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { status: "unavailable" }
  }
  return { status: "creator", name, email }
}
