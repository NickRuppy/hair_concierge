import "server-only"

import { createClient } from "@/lib/supabase/server"

import { loadDiscoveryEnrollmentForUser, type DiscoveryEnrollment } from "./enrollment"
import { hasDiscoveryEnrollmentStamp } from "./participant"

/**
 * Resolves discovery-call context purely from the authenticated user, the same
 * shape as `src/lib/partner-access/journey.ts`.
 *
 * Only an account carrying the claim's `app_metadata` stamp ever reads
 * `discovery_enrollments`. That keeps the blast radius of `unavailable` (which
 * makes the quiz refuse to save a lead) inside discovery accounts: a signed-out
 * or unstamped visitor resolves `none` without touching the table, so a read
 * failure there can never block an ordinary quiz submission.
 *
 * The stamp is a JWT claim and therefore only a hint. The enrollment row is the
 * authority: `loadDiscoveryEnrollmentForUser` requires `revoked_at IS NULL` and
 * `claimed_user_id = userId`, so a revoked participant resolves `none` here even
 * while their token still carries the stamp.
 */

export type DiscoveryJourneyResolution =
  | { kind: "none" }
  | { kind: "unavailable" }
  | { kind: "authorized"; userId: string; enrollment: DiscoveryEnrollment }

export type DiscoveryJourneyUser = { id: string; app_metadata?: unknown }

export type DiscoveryJourneyDependencies = {
  getUser: () => Promise<DiscoveryJourneyUser | null>
  loadEnrollment: (userId: string) => Promise<DiscoveryEnrollment | null>
}

export async function resolveDiscoveryJourney(
  overrides: Partial<DiscoveryJourneyDependencies> = {},
): Promise<DiscoveryJourneyResolution> {
  const getUser = overrides.getUser ?? defaultGetUser
  const loadEnrollment = overrides.loadEnrollment ?? loadDiscoveryEnrollmentForUser
  try {
    const user = await getUser()
    if (!user?.id) return { kind: "none" }
    if (!hasDiscoveryEnrollmentStamp(user)) return { kind: "none" }
    const enrollment = await loadEnrollment(user.id)
    if (!enrollment) return { kind: "none" }
    return { kind: "authorized", userId: user.id, enrollment }
  } catch (error) {
    console.warn("Discovery journey lookup failed:", error)
    return { kind: "unavailable" }
  }
}

/**
 * With no session `@supabase/ssr` answers `getUser()` with
 * `{ data: { user: null }, error: AuthSessionMissingError }`. That is the
 * ordinary anonymous visit, not an outage — throwing here would turn every
 * signed-out quiz lead into `unavailable`. Any other error is a real auth
 * failure and still propagates.
 */
export async function defaultGetUser(
  authClient?: Awaited<ReturnType<typeof createClient>>,
): Promise<DiscoveryJourneyUser | null> {
  const session = authClient ?? (await createClient())
  const {
    data: { user },
    error,
  } = await session.auth.getUser()
  if (!user) {
    if (error && error.name !== "AuthSessionMissingError") throw error
    return null
  }
  return { id: user.id, app_metadata: user.app_metadata }
}
