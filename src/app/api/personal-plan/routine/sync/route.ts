import { NextResponse } from "next/server"

import {
  isPersonalPlanAppV1Enabled,
  isPersonalPlanStage4Enabled,
} from "@/lib/personal-plan/release"
import {
  canAccessPersonalPlanJourneyStage,
  type PersonalPlanJourneyAccess,
} from "@/lib/personal-plan/journey-access"
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
  service: () => Service
}
const response = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } })

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
  service: () => createProductionRoutineSourceSyncService(createAdminClient()),
})
// The sync worker's self-heal lane runs the headless Stage-3 recompute inline
// (`routine/production-sync-service.ts`), the same shape
// `accept-ideal-plan/route.ts` needs the raised ceiling for.
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
