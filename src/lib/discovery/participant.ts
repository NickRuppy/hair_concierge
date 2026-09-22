/**
 * Everything the participant-facing Edge and browser layers need to know about a
 * discovery enrollment: the journey's paths, the `app_metadata` stamp the claim
 * route writes, and the quiz-context payload the lead-capture screen reads.
 *
 * Deliberately free of Node APIs, of `server-only` and of the admin client, so
 * `src/lib/supabase/middleware.ts` (Edge runtime) and the quiz client can both
 * import it. Everything that touches the database lives in `enrollment.ts`.
 */

export const DISCOVERY_INVITE_PATH = "/beratung/einladung"
export const DISCOVERY_CONTINUATION_PATH = "/beratung/weiter"
export const DISCOVERY_CHECKLIST_PATH = "/beratung/produkte"
/** Where a fresh claim lands: the ordinary legacy quiz, with a locked identity. */
export const DISCOVERY_QUIZ_ENTRY_HREF = "/quiz"

export const DISCOVERY_RESOLVE_ENDPOINT = "/api/beratung/resolve"
export const DISCOVERY_CLAIM_ENDPOINT = "/api/beratung/claim"
export const DISCOVERY_QUIZ_CONTEXT_ENDPOINT = "/api/beratung/quiz-context"

/**
 * The claim route is the only writer of this stamp (plan §4). Middleware reads it
 * straight from the JWT, so revoking an enrollment must clear it as well — see
 * `revokeDiscoveryEnrollment`.
 */
export const DISCOVERY_ACCESS_KIND = "discovery"
export const DISCOVERY_ENROLLMENT_METADATA_KEY = "discovery_enrollment_id"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function readDiscoveryEnrollmentStamp(
  user: { app_metadata?: unknown } | null | undefined,
): string | null {
  if (!user?.app_metadata || typeof user.app_metadata !== "object") return null
  const value = (user.app_metadata as Record<string, unknown>)[DISCOVERY_ENROLLMENT_METADATA_KEY]
  return typeof value === "string" && UUID.test(value) ? value : null
}

export function hasDiscoveryEnrollmentStamp(
  user: { app_metadata?: unknown } | null | undefined,
): boolean {
  return readDiscoveryEnrollmentStamp(user) !== null
}

/** The checklist link the quiz hands the participant once their lead is saved. */
export function buildDiscoveryChecklistPath(leadId: string | null | undefined): string {
  return leadId
    ? `${DISCOVERY_CHECKLIST_PATH}?lead=${encodeURIComponent(leadId)}`
    : DISCOVERY_CHECKLIST_PATH
}

export type DiscoveryQuizContextPayload =
  | { status: "regular" }
  | { status: "unavailable" }
  | { status: "participant"; name: string; email: string }

export function parseDiscoveryQuizContextPayload(value: unknown): DiscoveryQuizContextPayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { status: "unavailable" }
  }
  const row = value as Record<string, unknown>
  if (row.status === "regular") return { status: "regular" }
  if (row.status !== "participant" || typeof row.name !== "string" || typeof row.email !== "string")
    return { status: "unavailable" }
  const name = row.name.trim()
  const email = row.email.trim().toLowerCase()
  if (!name || !EMAIL.test(email)) return { status: "unavailable" }
  return { status: "participant", name, email }
}
