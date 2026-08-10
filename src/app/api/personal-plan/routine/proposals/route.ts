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
import { routineProposalRequestSchema } from "@/lib/personal-plan/routine/contracts"
import { createSupabaseRoutineProposalService } from "@/lib/personal-plan/routine/proposal-service"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

type Service = ReturnType<typeof createSupabaseRoutineProposalService>
export type PersonalPlanRoutineProposalRouteDeps = {
  enabled: () => boolean
  getUserId: () => Promise<string | null>
  loadJourneyAccess: (userId: string) => Promise<PersonalPlanJourneyAccess>
  service: () => Service
}
const response = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } })

export function createPersonalPlanRoutineProposalRouteHandlers(
  deps: PersonalPlanRoutineProposalRouteDeps,
) {
  return {
    async POST(request: Request) {
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
      const parsed = routineProposalRequestSchema.safeParse(await request.json().catch(() => null))
      if (!parsed.success) return response({ error: "invalid_request" }, 400)
      const result = await deps.service().propose({ userId, ...parsed.data })
      if (result.status === "temporarily_unavailable")
        return response({ error: result.status }, 503)
      if (result.status === "conflict") return response({ error: result.reason }, 409)
      if (result.status === "invalid_request") return response({ error: result.reason }, 422)
      return response(result)
    },
  }
}

const handlers = createPersonalPlanRoutineProposalRouteHandlers({
  enabled: () => isPersonalPlanAppV1Enabled() && isPersonalPlanStage4Enabled(),
  getUserId: async () => (await (await createClient()).auth.getUser()).data.user?.id ?? null,
  loadJourneyAccess: loadPersonalPlanJourneyAccessForUser,
  service: () => createSupabaseRoutineProposalService({ client: createAdminClient() as never }),
})
export const POST = handlers.POST
