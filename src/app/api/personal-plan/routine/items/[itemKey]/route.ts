import { NextResponse } from "next/server"
import { z } from "zod"

import {
  isPersonalPlanAppV1Enabled,
  isPersonalPlanStage4Enabled,
} from "@/lib/personal-plan/release"
import {
  canAccessPersonalPlanJourneyStage,
  type PersonalPlanJourneyAccess,
} from "@/lib/personal-plan/journey-access"
import { loadPersonalPlanJourneyAccessForUser } from "@/lib/personal-plan/journey-access-loader"
import { createRoutineProductDetailService } from "@/lib/personal-plan/routine/product-detail-service"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

const paramsSchema = z.object({ itemKey: z.string().min(1).max(256) }).strict()
const response = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } })

type Service = ReturnType<typeof createRoutineProductDetailService>
export type PersonalPlanRoutineItemRouteDeps = {
  enabled: () => boolean
  getUserId: () => Promise<string | null>
  loadJourneyAccess: (userId: string) => Promise<PersonalPlanJourneyAccess>
  service: () => Service
}

export function createPersonalPlanRoutineItemRouteHandlers(deps: PersonalPlanRoutineItemRouteDeps) {
  return {
    async GET(_request: Request, context: { params: Promise<{ itemKey: string }> }) {
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
      const parsed = paramsSchema.safeParse(await context.params)
      if (!parsed.success) return response({ error: "item_not_found" }, 404)
      try {
        const result = await deps.service().load({
          userId,
          itemKey: parsed.data.itemKey,
          enabled: true,
        })
        return result.status === "found"
          ? response(result.detail)
          : response({ error: "item_not_found" }, 404)
      } catch {
        return response({ error: "temporarily_unavailable" }, 503)
      }
    },
  }
}

const handlers = createPersonalPlanRoutineItemRouteHandlers({
  enabled: () => isPersonalPlanAppV1Enabled() && isPersonalPlanStage4Enabled(),
  getUserId: async () => (await (await createClient()).auth.getUser()).data.user?.id ?? null,
  loadJourneyAccess: loadPersonalPlanJourneyAccessForUser,
  service: () => createRoutineProductDetailService({ client: createAdminClient() as never }),
})
export const GET = handlers.GET
