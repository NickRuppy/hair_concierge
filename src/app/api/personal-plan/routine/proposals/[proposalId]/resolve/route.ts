import { NextResponse } from "next/server"
import { z } from "zod"

import {
  isPersonalPlanAppV1Enabled,
  isPersonalPlanStage4Enabled,
} from "@/lib/personal-plan/release"
import { routineProposalResolveRequestSchema } from "@/lib/personal-plan/routine/contracts"
import { createSupabaseRoutineProposalService } from "@/lib/personal-plan/routine/proposal-service"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

type Service = ReturnType<typeof createSupabaseRoutineProposalService>
export type PersonalPlanRoutineResolveRouteDeps = {
  enabled: () => boolean
  getUserId: () => Promise<string | null>
  service: () => Service
}
const paramsSchema = z.object({ proposalId: z.string().uuid() }).strict()
const response = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } })

export function createPersonalPlanRoutineResolveRouteHandlers(
  deps: PersonalPlanRoutineResolveRouteDeps,
) {
  return {
    async POST(request: Request, context: { params: Promise<{ proposalId: string }> }) {
      if (!deps.enabled()) return response({ error: "personal_plan_not_available" }, 404)
      const userId = await deps.getUserId()
      if (!userId) return response({ error: "unauthorized" }, 401)
      const [body, params] = await Promise.all([request.json().catch(() => null), context.params])
      const parsed = routineProposalResolveRequestSchema.safeParse(body)
      const parsedParams = paramsSchema.safeParse(params)
      if (!parsed.success || !parsedParams.success)
        return response({ error: "invalid_request" }, 400)
      const result = await deps
        .service()
        .resolve({ userId, proposalId: parsedParams.data.proposalId, ...parsed.data })
      if (result.status === "temporarily_unavailable")
        return response({ error: result.status }, 503)
      if (result.status === "conflict") return response({ error: result.reason }, 409)
      if (result.status === "initial_proposal_not_rejectable")
        return response({ error: result.status }, 422)
      if (result.status === "invalid_request") return response({ error: result.reason }, 422)
      return response(result)
    },
  }
}

const handlers = createPersonalPlanRoutineResolveRouteHandlers({
  enabled: () => isPersonalPlanAppV1Enabled() && isPersonalPlanStage4Enabled(),
  getUserId: async () => (await (await createClient()).auth.getUser()).data.user?.id ?? null,
  service: () => createSupabaseRoutineProposalService({ client: createAdminClient() as never }),
})
export const POST = handlers.POST
