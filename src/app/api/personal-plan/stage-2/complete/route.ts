import { NextResponse } from "next/server"
import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { isPersonalPlanAppV1Enabled } from "@/lib/personal-plan/release"
import { createSupabaseStage2RefinementPersistence } from "@/lib/personal-plan/persistence/stage2-refinement-supabase"
import { createPersistedStage2RefinementGateway } from "@/lib/personal-plan/refinement/production-persistence-gateway"
import {
  Stage2RefinementError,
  type Stage2RefinementGateway,
} from "@/lib/personal-plan/refinement/gateway"

const completeRequestSchema = z
  .object({ expectedRevision: z.number().int().nonnegative() })
  .strict()

export type Stage2CompleteRouteDeps = {
  enabled: () => boolean
  getUserId: () => Promise<string | null>
  gatewayFor: (userId: string) => Stage2RefinementGateway
}

function response(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } })
}

function errorResponse(error: unknown, started: number) {
  const code = error instanceof Stage2RefinementError ? error.code : "temporarily_unavailable"
  const status =
    code === "revision_conflict"
      ? 409
      : code === "invalid_answer" ||
          code === "question_not_current" ||
          code === "incomplete_refinement"
        ? 422
        : 503
  console.info("personal_plan_stage2_api", {
    event: status === 409 ? "conflict" : status === 503 ? "unavailable" : "validation_failed",
    code,
    duration_ms: Date.now() - started,
  })
  return response({ error: code }, status)
}

export function createStage2CompleteRouteHandler(deps: Stage2CompleteRouteDeps) {
  return async function POST(request: Request) {
    const started = Date.now()
    if (!deps.enabled()) return response({ error: "personal_plan_not_available" }, 404)
    const userId = await deps.getUserId()
    if (!userId) return response({ error: "unauthorized" }, 401)
    const parsed = completeRequestSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return response({ error: "invalid_request" }, 400)
    try {
      const result = await deps.gatewayFor(userId).complete(parsed.data)
      console.info("personal_plan_stage2_api", {
        event: "complete",
        duration_ms: Date.now() - started,
      })
      return response(result)
    } catch (error) {
      return errorResponse(error, started)
    }
  }
}

export const POST = createStage2CompleteRouteHandler({
  enabled: isPersonalPlanAppV1Enabled,
  getUserId: async () => (await (await createClient()).auth.getUser()).data.user?.id ?? null,
  gatewayFor: (userId) =>
    createPersistedStage2RefinementGateway({
      userId,
      persistence: createSupabaseStage2RefinementPersistence(createAdminClient()),
    }),
})
