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
  type Stage2SaveAnswerInput,
} from "@/lib/personal-plan/refinement/gateway"

export type Stage2RouteDeps = {
  getUserId: () => Promise<string | null>
  gatewayFor: (userId: string) => Stage2RefinementGateway
  enabled: () => boolean
}

const saveRequestSchema = z
  .object({
    questionId: z.string().min(1).max(96),
    answer: z.unknown(),
    expectedRevision: z.number().int().nonnegative(),
  })
  .strict()

function response(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } })
}

function errorResponse(error: unknown, started: number) {
  if (error instanceof Stage2InvalidRequestError) {
    return response({ error: "invalid_request" }, 400)
  }
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

class Stage2InvalidRequestError extends Error {}

export function createStage2RouteHandlers(deps: Stage2RouteDeps) {
  const run = async (
    event: "load" | "save",
    operation: (gateway: Stage2RefinementGateway) => Promise<unknown>,
  ) => {
    const started = Date.now()
    if (!deps.enabled()) return response({ error: "personal_plan_not_available" }, 404)
    const userId = await deps.getUserId()
    if (!userId) return response({ error: "unauthorized" }, 401)
    try {
      const result = await operation(deps.gatewayFor(userId))
      console.info("personal_plan_stage2_api", { event, duration_ms: Date.now() - started })
      return response(result)
    } catch (error) {
      return errorResponse(error, started)
    }
  }
  return {
    GET: () => run("load", (gateway) => gateway.load()),
    PATCH: (request: Request) =>
      run("save", async (gateway) => {
        const parsed = saveRequestSchema.safeParse(await request.json().catch(() => null))
        if (!parsed.success) throw new Stage2InvalidRequestError()
        return gateway.saveAnswer(parsed.data as Stage2SaveAnswerInput)
      }),
  }
}

const handlers = createStage2RouteHandlers({
  enabled: () => isPersonalPlanAppV1Enabled(),
  getUserId: async () => (await (await createClient()).auth.getUser()).data.user?.id ?? null,
  gatewayFor: (userId) =>
    createPersistedStage2RefinementGateway({
      userId,
      persistence: createSupabaseStage2RefinementPersistence(createAdminClient()),
    }),
})
export const GET = handlers.GET
export const PATCH = handlers.PATCH
