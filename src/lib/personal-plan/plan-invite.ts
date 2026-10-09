import "server-only"

import { cache } from "react"

import { resolvePaidAppAccess, type FreemiumAccessResult } from "@/lib/entitlements/access"
import { isPersonalPlanFieldTestGuest } from "@/lib/supabase/middleware"
import { createClient } from "@/lib/supabase/server"
import type { PersonalPlanRoutingFrontier } from "./frontier-routing"
import { loadPersonalPlanRoutingFrontierForUser } from "./frontier-routing-loader"

export type PersonalPlanInviteDependencies = {
  getUser: () => Promise<{
    id: string
    email?: string | null
    app_metadata?: Record<string, unknown>
  } | null>
  loadFrontier: (userId: string) => Promise<PersonalPlanRoutingFrontier>
  resolvePaidAccess: (
    userId: string,
    email: string | null | undefined,
    fieldTestGuest: boolean,
  ) => Promise<FreemiumAccessResult>
}

/**
 * Whether the Chat and Profil tabs show the „Neu: Dein persönlicher Haarplan“ banner.
 *
 * Reuses the middleware's own routing authority: the banner appears exactly for the
 * members `/routine` would already send to `/plan-bereit` (frontier `recovery` — a member
 * admitted to a Personal Plan who has no Stage 1 yet: typically a pre-cutoff subscriber
 * via the legacy migration, but also an active field-test or partner tester, whom
 * `/plan-bereit` serves the same way). No new eligibility rule lives here.
 *
 * Fails closed in both directions: any read failure, or paid access that is not
 * positively `"allowed"`, hides the banner — an invite never points at a page that
 * would bounce the member to `/pricing`.
 */
export async function resolvePersonalPlanInvite(
  deps: PersonalPlanInviteDependencies,
): Promise<boolean> {
  try {
    const user = await deps.getUser()
    if (!user) return false
    const frontier = await deps.loadFrontier(user.id)
    if (frontier.kind !== "recovery") return false
    const access = await deps.resolvePaidAccess(
      user.id,
      user.email,
      isPersonalPlanFieldTestGuest(user),
    )
    return access === "allowed"
  } catch {
    return false
  }
}

export const loadPersonalPlanInvite = cache(async (): Promise<boolean> => {
  const supabase = await createClient()
  return resolvePersonalPlanInvite({
    getUser: async () => (await supabase.auth.getUser()).data.user,
    loadFrontier: (userId) => loadPersonalPlanRoutingFrontierForUser(supabase as never, userId),
    resolvePaidAccess: (userId, email, fieldTestGuest) =>
      resolvePaidAppAccess(userId, email, fieldTestGuest),
  })
})
