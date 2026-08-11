import { NextResponse } from "next/server"
import { z } from "zod"
import {
  createProductionStage3ProductsGateway,
  Stage3ProductionUnavailableError,
} from "@/lib/personal-plan/products/production-persistence-gateway"
import { Stage3AuthoritySnapshotError } from "@/lib/personal-plan/products/authority/snapshot"
import type { Stage3ProductsGateway } from "@/lib/personal-plan/products/gateway"
import { createSupabaseStage3ProductionPersistence } from "@/lib/personal-plan/products/stage3-persistence-supabase"
import {
  isPersonalPlanAppV1Enabled,
  isPersonalPlanStage4AutoActivateInitialEnabled,
} from "@/lib/personal-plan/release"
import { createInitialRoutineCandidateCompiler } from "@/lib/personal-plan/routine-candidate-compiler"
import {
  createRoutineProposalStagerRpcAdapter,
  type RoutineProposalRpcClient,
} from "@/lib/personal-plan/routine-proposal-stager"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { checkRateLimit, type RateLimitConfig } from "@/lib/rate-limit"
import {
  canAccessPersonalPlanJourneyStage,
  type PersonalPlanJourneyAccess,
} from "@/lib/personal-plan/journey-access"
import { loadPersonalPlanJourneyAccessForUser } from "@/lib/personal-plan/journey-access-loader"
const rate: RateLimitConfig = {
  prefix: "personal-plan-stage3-complete",
  limit: 8,
  windowMs: 60_000,
}
const bodySchema = z
  .object({ draftId: z.string().uuid(), expectedRevision: z.number().int().nonnegative() })
  .strict()
export type Stage3CompleteRouteDeps = {
  enabled: () => boolean
  getUserId: () => Promise<string | null>
  loadJourneyAccess: (userId: string) => Promise<PersonalPlanJourneyAccess>
  checkRateLimit: typeof checkRateLimit
  complete: (
    userId: string,
    input: { draftId: string; expectedRevision: number },
  ) => ReturnType<Stage3ProductsGateway["complete"]>
}

export function createStage3CompleteRouteHandler(deps: Stage3CompleteRouteDeps) {
  return async function POST(request: Request) {
    const started = Date.now()
    const fail = (error: string, status: number, headers?: HeadersInit) =>
      NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store", ...headers } })
    if (!deps.enabled()) return fail("personal_plan_not_available", 404)
    const userId = await deps.getUserId()
    if (!userId) return fail("unauthorized", 401)
    try {
      if (!canAccessPersonalPlanJourneyStage(await deps.loadJourneyAccess(userId), "stage3")) {
        return fail("stage_not_ready", 409)
      }
    } catch {
      return fail("temporarily_unavailable", 503)
    }
    const limited = await deps.checkRateLimit(userId, rate)
    if (!limited.allowed) {
      const unavailable = limited.error === "service_unavailable"
      console.info("personal_plan_stage3_api", {
        event: "unavailable",
        code: unavailable ? "temporarily_unavailable" : "rate_limited",
        duration_ms: Date.now() - started,
      })
      return fail(
        unavailable ? "temporarily_unavailable" : "rate_limited",
        unavailable ? 503 : 429,
        unavailable ? undefined : { "Retry-After": "60" },
      )
    }
    const parsed = bodySchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return fail("invalid_request", 400)
    try {
      const result = await deps.complete(userId, parsed.data)
      if (result.status === "conflict") {
        console.info("personal_plan_stage3_api", {
          event: "conflict",
          code: "revision_conflict",
          duration_ms: Date.now() - started,
        })
        return NextResponse.json(
          { error: "revision_conflict", latestDraft: result.latestDraft },
          { status: 409, headers: { "Cache-Control": "no-store" } },
        )
      }
      if (result.status === "not_ready") return fail("completion_not_ready", 409)
      return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } })
    } catch (error) {
      if (error instanceof Stage3AuthoritySnapshotError) {
        console.info("personal_plan_stage3_api", {
          event: "conflict",
          code: error.code,
          duration_ms: Date.now() - started,
        })
        return fail(error.code, 409)
      }
      console.info("personal_plan_stage3_api", {
        event:
          error instanceof Stage3ProductionUnavailableError
            ? "proposal_staging_failure"
            : "unavailable",
        code: "temporarily_unavailable",
        duration_ms: Date.now() - started,
      })
      return fail("temporarily_unavailable", 503)
    }
  }
}

export const POST = createStage3CompleteRouteHandler({
  enabled: isPersonalPlanAppV1Enabled,
  getUserId: async () => (await (await createClient()).auth.getUser()).data.user?.id ?? null,
  loadJourneyAccess: loadPersonalPlanJourneyAccessForUser,
  checkRateLimit,
  complete: async (userId, input) => {
    const admin = createAdminClient()
    return createProductionStage3ProductsGateway({
      userId,
      persistence: createSupabaseStage3ProductionPersistence(admin),
      compiler: createInitialRoutineCandidateCompiler(),
      stager: createRoutineProposalStagerRpcAdapter({
        client: admin as unknown as RoutineProposalRpcClient,
        activateInitialRoutine: isPersonalPlanStage4AutoActivateInitialEnabled(),
      }),
    }).complete(input)
  },
})
