import { NextResponse } from "next/server"

import {
  isPersonalPlanAppV1Enabled,
  isPersonalPlanStage4Enabled,
} from "@/lib/personal-plan/release"
import {
  createRoutineSourceSyncService,
  createSupabaseRoutineSourceSyncRepository,
} from "@/lib/personal-plan/routine/source-sync-service"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

type Service = ReturnType<typeof createRoutineSourceSyncService>
export type PersonalPlanRoutineSyncRouteDeps = {
  enabled: () => boolean
  getUserId: () => Promise<string | null>
  service: () => Service
}
const response = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } })

export function createPersonalPlanRoutineSyncRouteHandlers(deps: PersonalPlanRoutineSyncRouteDeps) {
  return {
    async POST() {
      const userId = await deps.getUserId()
      if (!userId) return response({ error: "unauthorized" }, 401)
      if (!deps.enabled()) return response({ error: "personal_plan_not_available" }, 404)
      try {
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
  service: () =>
    createRoutineSourceSyncService({
      repository: createSupabaseRoutineSourceSyncRepository(createAdminClient()),
    }),
})
export const POST = handlers.POST
