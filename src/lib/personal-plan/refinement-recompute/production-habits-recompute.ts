import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"

import { recomputeRoutineAfterHabitsCompletion } from "./orchestrator"
import { createProductionStage3RecomputeDeps } from "./production-deps"
import type { Stage3RecomputeResult } from "./types"

/**
 * Production `runHabitsRecompute` for the Stage-2 module lane, shared by the PATCH
 * save-and-complete route and `POST stage-2/complete {module}`.
 *
 * Cheapest existing read that exposes `active_routine_version_id` (see
 * `journey-access-loader.ts`'s `loadPlan` / `accept-ideal-plan/route.ts`'s
 * `planState.loadActiveRoutineVersionId`): a single-column-pair lookup on the owner's one
 * `personal_plans` row. No active routine ⇒ skip the headless Stage-3 pass entirely rather
 * than let the orchestrator's own gate discover the same thing after constructing its deps.
 */
export async function runProductionHabitsRecompute({
  userId,
  refinedVersionId,
}: {
  userId: string
  refinedVersionId: string
}): Promise<Stage3RecomputeResult | null> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from("personal_plans")
    .select("id, active_routine_version_id")
    .eq("user_id", userId)
    .maybeSingle()
  if (error) throw error
  const personalPlanId = typeof data?.id === "string" ? data.id : null
  const activeRoutineVersionId =
    typeof data?.active_routine_version_id === "string" ? data.active_routine_version_id : null
  if (!personalPlanId || !activeRoutineVersionId) return null
  return recomputeRoutineAfterHabitsCompletion(
    createProductionStage3RecomputeDeps({ userId, admin }),
    { userId, personalPlanId, refinedVersionId },
  )
}
