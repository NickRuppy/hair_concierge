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
  createSupabaseRoutineCadenceAuthorityReader,
  type RoutineCadenceAuthorityReadClient,
} from "@/lib/personal-plan/routine/cadence-authority"
import {
  createRoutineProposalStagerRpcAdapter,
  type RoutineProposalRpcClient,
} from "@/lib/personal-plan/routine-proposal-stager"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import {
  checkRateLimit,
  fixedWindowRetryAfterSeconds,
  type RateLimitConfig,
} from "@/lib/rate-limit"
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
const receiptQuerySchema = z.object({ draftId: z.string().uuid() }).strict()
export type Stage3CompleteRouteDeps = {
  enabled: () => boolean
  getUserId: () => Promise<string | null>
  loadJourneyAccess: (userId: string) => Promise<PersonalPlanJourneyAccess>
  checkRateLimit: typeof checkRateLimit
  loadCompletionReceipt?: (
    userId: string,
    input: { draftId: string },
  ) => ReturnType<NonNullable<Stage3ProductsGateway["loadCompletionReceipt"]>>
  complete: (
    userId: string,
    input: { draftId: string; expectedRevision: number },
  ) => ReturnType<Stage3ProductsGateway["complete"]>
}

export function createStage3CompleteRouteHandlers(deps: Stage3CompleteRouteDeps) {
  function timing(phases: Record<string, number>) {
    return Object.entries(phases)
      .map(([name, duration]) => `${name};dur=${Math.max(0, Math.round(duration * 100) / 100)}`)
      .join(", ")
  }
  function fail(
    error: string,
    status: number,
    phases: Record<string, number>,
    headers?: HeadersInit,
  ): NextResponse {
    return NextResponse.json(
      { error },
      {
        status,
        headers: { "Cache-Control": "no-store", "Server-Timing": timing(phases), ...headers },
      },
    )
  }
  async function authorize(
    phases: Record<string, number>,
  ): Promise<{ response: NextResponse } | { userId: string }> {
    if (!deps.enabled()) return { response: fail("personal_plan_not_available", 404, phases) }
    let phaseStarted = Date.now()
    const userId = await deps.getUserId()
    phases.auth = Date.now() - phaseStarted
    if (!userId) return { response: fail("unauthorized", 401, phases) }
    try {
      phaseStarted = Date.now()
      if (!canAccessPersonalPlanJourneyStage(await deps.loadJourneyAccess(userId), "stage3")) {
        return { response: fail("stage_not_ready", 409, phases) }
      }
      phases.journey = Date.now() - phaseStarted
    } catch {
      return { response: fail("temporarily_unavailable", 503, phases) }
    }
    return { userId }
  }
  return {
    async GET(request: Request): Promise<NextResponse> {
      const started = Date.now()
      const phases: Record<string, number> = {}
      const auth = await authorize(phases)
      if ("response" in auth) return auth.response
      const parsed = receiptQuerySchema.safeParse(
        Object.fromEntries(new URL(request.url).searchParams),
      )
      if (!parsed.success) return fail("invalid_request", 400, phases)
      if (!deps.loadCompletionReceipt) return fail("temporarily_unavailable", 503, phases)
      try {
        const phaseStarted = Date.now()
        const result = await deps.loadCompletionReceipt(auth.userId, parsed.data)
        phases.gateway = Date.now() - phaseStarted
        return NextResponse.json(result, {
          headers: { "Cache-Control": "no-store", "Server-Timing": timing(phases) },
        })
      } catch (error) {
        if (error instanceof Stage3AuthoritySnapshotError) {
          console.info("personal_plan_stage3_api", {
            event: "conflict",
            code: error.code,
            duration_ms: Date.now() - started,
          })
          return fail(error.code, 409, phases)
        }
        console.info("personal_plan_stage3_api", {
          event:
            error instanceof Stage3ProductionUnavailableError
              ? "proposal_receipt_unavailable"
              : "unavailable",
          code: "temporarily_unavailable",
          duration_ms: Date.now() - started,
        })
        return fail("temporarily_unavailable", 503, phases)
      }
    },
    async POST(request: Request): Promise<NextResponse> {
      const started = Date.now()
      const phases: Record<string, number> = {}
      const auth = await authorize(phases)
      if ("response" in auth) return auth.response
      let phaseStarted = Date.now()
      const limited = await deps.checkRateLimit(auth.userId, rate)
      phases.rate_limit = Date.now() - phaseStarted
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
          phases,
          unavailable ? undefined : { "Retry-After": String(fixedWindowRetryAfterSeconds(rate)) },
        )
      }
      const parsed = bodySchema.safeParse(await request.json().catch(() => null))
      if (!parsed.success) return fail("invalid_request", 400, phases)
      try {
        phaseStarted = Date.now()
        const result = await deps.complete(auth.userId, parsed.data)
        phases.gateway = Date.now() - phaseStarted
        if (result.status === "conflict") {
          console.info("personal_plan_stage3_api", {
            event: "conflict",
            code: "revision_conflict",
            duration_ms: Date.now() - started,
          })
          return NextResponse.json(
            { error: "revision_conflict", latestDraft: result.latestDraft },
            {
              status: 409,
              headers: { "Cache-Control": "no-store", "Server-Timing": timing(phases) },
            },
          )
        }
        if (result.status === "not_ready") return fail("completion_not_ready", 409, phases)
        return NextResponse.json(result, {
          headers: { "Cache-Control": "no-store", "Server-Timing": timing(phases) },
        })
      } catch (error) {
        if (error instanceof Stage3AuthoritySnapshotError) {
          console.info("personal_plan_stage3_api", {
            event: "conflict",
            code: error.code,
            duration_ms: Date.now() - started,
          })
          return fail(error.code, 409, phases)
        }
        console.info("personal_plan_stage3_api", {
          event:
            error instanceof Stage3ProductionUnavailableError
              ? "proposal_staging_failure"
              : "unavailable",
          code: "temporarily_unavailable",
          duration_ms: Date.now() - started,
        })
        return fail("temporarily_unavailable", 503, phases)
      }
    },
  }
}

export function createStage3CompleteRouteHandler(deps: Stage3CompleteRouteDeps) {
  return createStage3CompleteRouteHandlers(deps).POST
}

export const { GET, POST } = createStage3CompleteRouteHandlers({
  enabled: isPersonalPlanAppV1Enabled,
  getUserId: async () => (await (await createClient()).auth.getUser()).data.user?.id ?? null,
  loadJourneyAccess: loadPersonalPlanJourneyAccessForUser,
  checkRateLimit,
  loadCompletionReceipt: async (userId, input) => {
    const admin = createAdminClient()
    return createProductionStage3ProductsGateway({
      userId,
      persistence: createSupabaseStage3ProductionPersistence(admin),
    }).loadCompletionReceipt!(input)
  },
  complete: async (userId, input) => {
    const admin = createAdminClient()
    return createProductionStage3ProductsGateway({
      userId,
      persistence: createSupabaseStage3ProductionPersistence(admin),
      compiler: createInitialRoutineCandidateCompiler(),
      cadenceAuthorityReader: createSupabaseRoutineCadenceAuthorityReader(
        admin as unknown as RoutineCadenceAuthorityReadClient,
      ),
      stager: createRoutineProposalStagerRpcAdapter({
        client: admin as unknown as RoutineProposalRpcClient,
        activateInitialRoutine: isPersonalPlanStage4AutoActivateInitialEnabled(),
      }),
    }).complete(input)
  },
})
