import { NextResponse } from "next/server"

import {
  isPersonalPlanAppV1Enabled,
  isPersonalPlanStage4Enabled,
} from "@/lib/personal-plan/release"
import {
  canAccessPersonalPlanJourneyStage,
  type PersonalPlanJourneyAccess,
} from "@/lib/personal-plan/journey-access"
import { createProductionSyncPlanWithFacts } from "@/lib/personal-plan/facts-recompute"
import type { SyncPlanWithFacts } from "@/lib/personal-plan/facts-recompute/types"
import { loadPersonalPlanJourneyAccessForUser } from "@/lib/personal-plan/journey-access-loader"
import type { createRoutineSourceSyncService } from "@/lib/personal-plan/routine/source-sync-service"
import { createProductionRoutineSourceSyncService } from "@/lib/personal-plan/routine/production-sync-service"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { reportPersonalPlanTransitionTiming } from "@/lib/personal-plan/transition-performance"

type Service = ReturnType<typeof createRoutineSourceSyncService>
export type PersonalPlanRoutineSyncRouteDeps = {
  enabled: () => boolean
  getUserId: () => Promise<string | null>
  loadJourneyAccess: (userId: string) => Promise<PersonalPlanJourneyAccess>
  /**
   * Rebases a plan whose profile changed before the outbox drain, so opening the Routine tab
   * finds the plan on the current facts and the drain recomputes the routine from the
   * `refined_need` row the rebase enqueued. Its result is only logged; a plan problem never
   * fails the sync. Absent = no rebase.
   */
  syncPlanWithFacts?: SyncPlanWithFacts
  service: () => Service
}
const response = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } })

async function syncPlanBeforeDrain(deps: PersonalPlanRoutineSyncRouteDeps, userId: string) {
  if (!deps.syncPlanWithFacts) return
  try {
    const result = await deps.syncPlanWithFacts({ userId })
    console.info("personal_plan_routine_sync_api", {
      event: "plan_sync",
      status: result.status,
      ...(result.status === "unavailable"
        ? { reason: result.reason, retryable: result.retryable }
        : {}),
    })
  } catch (error) {
    console.info("personal_plan_routine_sync_api", {
      event: "plan_sync",
      status: "unavailable",
      reason: "unexpected_error",
      // The class only: an error message can carry the user id.
      cause: error instanceof Error ? error.name : typeof error,
    })
  }
}

export function createPersonalPlanRoutineSyncRouteHandlers(deps: PersonalPlanRoutineSyncRouteDeps) {
  return {
    async POST() {
      if (!deps.enabled()) return response({ error: "personal_plan_not_available" }, 404)
      const userId = await deps.getUserId()
      if (!userId) return response({ error: "unauthorized" }, 401)
      try {
        const journey = await deps.loadJourneyAccess(userId)
        if (!canAccessPersonalPlanJourneyStage(journey, "stage4")) {
          return response({ error: "stage_not_ready" }, 409)
        }
        await syncPlanBeforeDrain(deps, userId)
        const result = await deps.service().sync({ userId })
        if (result.status === "conflict") return response({ error: result.reason }, 409)
        if (result.status === "temporarily_unavailable")
          return response({ error: result.status }, 503)
        return response(result)
      } catch {
        return response({ error: "temporarily_unavailable" }, 503)
      }
    },
  }
}

const handlers = createPersonalPlanRoutineSyncRouteHandlers({
  enabled: () => isPersonalPlanAppV1Enabled() && isPersonalPlanStage4Enabled(),
  getUserId: async () => (await (await createClient()).auth.getUser()).data.user?.id ?? null,
  loadJourneyAccess: loadPersonalPlanJourneyAccessForUser,
  syncPlanWithFacts: (input) => createProductionSyncPlanWithFacts(createAdminClient())(input),
  service: () => createProductionRoutineSourceSyncService(createAdminClient()),
})
// The sync worker's self-heal lane runs the headless Stage-3 recompute inline
// (`routine/production-sync-service.ts`), the same shape
// `accept-ideal-plan/route.ts` needs the raised ceiling for. The plan rebase that runs first
// adds one transaction to that.
export const maxDuration = 60
export const POST = async () => {
  const startedAt = performance.now()
  const result = await handlers.POST()
  const durationMs = performance.now() - startedAt
  result.headers.set("Server-Timing", `personal_plan_routine_sync;dur=${durationMs.toFixed(2)}`)
  reportPersonalPlanTransitionTiming({
    layer: "server",
    operation: "routine_sync",
    outcome: result.ok ? "ok" : "error",
    status: result.status,
    durationMs,
  })
  return result
}
