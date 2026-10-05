import "server-only"

import { resolvePersonalPlanMigrationAdmission } from "@/lib/personal-plan/migration-admission"
import {
  hasPersonalPlanRecord,
  loadCachedAuthenticatedAppUserId,
  type AuthenticatedAppNavigationAccess,
} from "@/lib/personal-plan/navigation-access"
import { createAdminClient } from "@/lib/supabase/admin"

/**
 * Whether a `personal_plans` row exists for the profile's user, independent of tier
 * (central profile PR2, W05). The profile editors announce „Beim Speichern berechnen wir
 * deinen Plan … neu.“ for exactly these users, and a profile save recomputes the plan
 * server-side whenever the row exists — also for a free-tier user (a lapsed plan owner, or a
 * freemium plan).
 *
 * Paid navigation already carries the fact from the cached journey access, so it costs
 * nothing. The synthetic free-tier navigation loads no journey access (`hasPersonalPlan:
 * false` there means "not looked up"), so ONLY that branch pays one owner-scoped existence
 * read — and only here, for the profile layout, not for every page that shares the navigation
 * resolver. A failed read degrades to `false` (no sentence); it never breaks the layout.
 */
export type ProfilePlanOwnershipDeps = {
  loadUserId: () => Promise<string | null>
  hasPlanRow: (userId: string) => Promise<boolean>
}

export async function resolveProfileHasPersonalPlan(
  navigation: AuthenticatedAppNavigationAccess,
  deps: ProfilePlanOwnershipDeps,
): Promise<boolean> {
  if (navigation.kind !== "personal_plan" || navigation.tier !== "free") {
    return hasPersonalPlanRecord(navigation)
  }
  try {
    const userId = await deps.loadUserId()
    if (!userId) return false
    return await deps.hasPlanRow(userId)
  } catch {
    return false
  }
}

async function hasPersonalPlanRowForUser(userId: string): Promise<boolean> {
  const { data, error } = await createAdminClient()
    .from("personal_plans")
    .select("id")
    .eq("user_id", userId)
    .limit(1)
  if (error) throw error
  return Array.isArray(data) && data.length > 0
}

export function loadProfileHasPersonalPlan(
  navigation: AuthenticatedAppNavigationAccess,
): Promise<boolean> {
  return resolveProfileHasPersonalPlan(navigation, {
    loadUserId: loadCachedAuthenticatedAppUserId,
    hasPlanRow: hasPersonalPlanRowForUser,
  })
}

/**
 * Lets the Profil tab point a paying member without a plan at `/plan-bereit`,
 * where the migration runs. Costs one read-only RPC, only for viewers without a plan.
 */
export async function resolveProfilePlanMigrationAvailable(
  hasPersonalPlan: boolean,
  deps: {
    loadUserId: () => Promise<string | null>
    loadMigrationStatus: (
      userId: string,
    ) => Promise<"ineligible" | "candidate" | "pending_source" | "ready">
  },
): Promise<boolean> {
  if (hasPersonalPlan) return false
  try {
    const userId = await deps.loadUserId()
    if (!userId) return false
    const status = await deps.loadMigrationStatus(userId)
    return status === "candidate" || status === "pending_source" || status === "ready"
  } catch {
    return false
  }
}

export function loadProfilePlanMigrationAvailable(hasPersonalPlan: boolean): Promise<boolean> {
  return resolveProfilePlanMigrationAvailable(hasPersonalPlan, {
    loadUserId: loadCachedAuthenticatedAppUserId,
    loadMigrationStatus: async (userId) =>
      (await resolvePersonalPlanMigrationAdmission({ client: createAdminClient(), userId })).status,
  })
}
