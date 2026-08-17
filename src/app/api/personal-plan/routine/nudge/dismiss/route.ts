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
import { createSupabaseRoutineNudgeDismissalService } from "@/lib/personal-plan/routine/nudge-service"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

type Service = ReturnType<typeof createSupabaseRoutineNudgeDismissalService>
export type PersonalPlanRoutineNudgeDismissRouteDeps = {
  enabled: () => boolean
  getUserId: () => Promise<string | null>
  loadJourneyAccess: (userId: string) => Promise<PersonalPlanJourneyAccess>
  service: () => Service
}
const response = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } })

export function createPersonalPlanRoutineNudgeDismissRouteHandlers(
  deps: PersonalPlanRoutineNudgeDismissRouteDeps,
) {
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
      } catch {
        return response({ error: "temporarily_unavailable" }, 503)
      }
      const result = await deps.service().dismiss({ userId })
      if (result.status === "no_personal_plan") return response({ error: result.status }, 404)
      if (result.status === "temporarily_unavailable")
        return response({ error: result.status }, 503)
      return response(result)
    },
  }
}

const handlers = createPersonalPlanRoutineNudgeDismissRouteHandlers({
  enabled: () => isPersonalPlanAppV1Enabled() && isPersonalPlanStage4Enabled(),
  getUserId: async () => (await (await createClient()).auth.getUser()).data.user?.id ?? null,
  loadJourneyAccess: loadPersonalPlanJourneyAccessForUser,
  service: () =>
    createSupabaseRoutineNudgeDismissalService({ client: createAdminClient() as never }),
})
export const POST = handlers.POST
