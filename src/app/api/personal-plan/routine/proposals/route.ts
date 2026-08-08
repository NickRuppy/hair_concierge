import { NextResponse } from "next/server"

import {
  isPersonalPlanAppV1Enabled,
  isPersonalPlanStage4Enabled,
} from "@/lib/personal-plan/release"
import { routineProposalRequestSchema } from "@/lib/personal-plan/routine/contracts"
import { createSupabaseRoutineProposalService } from "@/lib/personal-plan/routine/proposal-service"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

type Service = ReturnType<typeof createSupabaseRoutineProposalService>
export type PersonalPlanRoutineProposalRouteDeps = {
  enabled: () => boolean
  getUserId: () => Promise<string | null>
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
  service: () => createSupabaseRoutineProposalService({ client: createAdminClient() as never }),
})
export const POST = handlers.POST
