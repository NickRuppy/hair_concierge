import { NextResponse } from "next/server"
import { z } from "zod"

import {
  acceptIdealPlan,
  DirectAcceptanceError,
  type AcceptIdealPlanInput,
  type AcceptIdealPlanResult,
} from "@/lib/personal-plan/direct-acceptance/accept"
import {
  canAccessPersonalPlanJourneyStage,
  type PersonalPlanJourneyAccess,
} from "@/lib/personal-plan/journey-access"
import { loadPersonalPlanJourneyAccessForUser } from "@/lib/personal-plan/journey-access-loader"
import { createSupabaseStage2RefinementPersistence } from "@/lib/personal-plan/persistence/stage2-refinement-supabase"
import { isPersonalPlanToolsEnabledForUser } from "@/lib/personal-plan/rollout-access"
import { createProductionStage3ProductsGateway } from "@/lib/personal-plan/products/production-persistence-gateway"
import { createSupabaseStage3ProductionPersistence } from "@/lib/personal-plan/products/stage3-persistence-supabase"
import {
  isPersonalPlanAppV1Enabled,
  isPersonalPlanStage2Enabled,
  isPersonalPlanStage3Enabled,
  isPersonalPlanStage4Enabled,
} from "@/lib/personal-plan/release"
import { createInitialRoutineCandidateCompiler } from "@/lib/personal-plan/routine-candidate-compiler"
import {
  createRoutineProposalStagerRpcAdapter,
  type RoutineProposalRpcClient,
} from "@/lib/personal-plan/routine-proposal-stager"
import {
  createSupabaseRoutineCadenceAuthorityReader,
  type RoutineCadenceAuthorityReadClient,
} from "@/lib/personal-plan/routine/cadence-authority"
import {
  checkRateLimit,
  fixedWindowRetryAfterSeconds,
  type RateLimitConfig,
} from "@/lib/rate-limit"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

const rate: RateLimitConfig = {
  prefix: "personal-plan-accept-ideal-plan",
  limit: 8,
  windowMs: 60_000,
}

const bodySchema = z
  .object({
    seenRoles: z
      .array(
        z
          .object({
            decisionKey: z.string().min(1).max(160),
            productId: z.string().min(1).max(64),
            factFingerprint: z.string().min(1).max(128),
          })
          .strict(),
      )
      .min(1)
      .max(40),
  })
  .strict()

const STATUS_BY_CODE = {
  stage_not_available: 404,
  seen_state_stale: 409,
  recommendation_unavailable: 409,
  conflict: 409,
  acceptance_not_ready: 409,
  refinement_in_progress: 409,
  plan_already_accepted: 409,
} as const

export type AcceptIdealPlanRouteDeps = {
  enabled: () => boolean
  getUserId: () => Promise<string | null>
  loadJourneyAccess: (userId: string) => Promise<PersonalPlanJourneyAccess>
  checkRateLimit: typeof checkRateLimit
  accept: (userId: string, input: AcceptIdealPlanInput) => Promise<AcceptIdealPlanResult>
}

function fail(error: string, status: number, headers?: HeadersInit): NextResponse {
  return NextResponse.json(
    { error },
    { status, headers: { "Cache-Control": "no-store", ...headers } },
  )
}

export function createAcceptIdealPlanRouteHandler(deps: AcceptIdealPlanRouteDeps) {
  return async function POST(request: Request): Promise<NextResponse> {
    const started = Date.now()
    if (!deps.enabled()) return fail("personal_plan_not_available", 404)
    const userId = await deps.getUserId()
    if (!userId) return fail("unauthorized", 401)
    try {
      if (!canAccessPersonalPlanJourneyStage(await deps.loadJourneyAccess(userId), "stage2")) {
        return fail("stage_not_ready", 409)
      }
    } catch {
      return fail("temporarily_unavailable", 503)
    }
    const limited = await deps.checkRateLimit(userId, rate)
    if (!limited.allowed) {
      const unavailable = limited.error === "service_unavailable"
      return fail(
        unavailable ? "temporarily_unavailable" : "rate_limited",
        unavailable ? 503 : 429,
        unavailable ? undefined : { "Retry-After": String(fixedWindowRetryAfterSeconds(rate)) },
      )
    }
    const parsed = bodySchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return fail("invalid_request", 400)
    try {
      const result = await deps.accept(userId, parsed.data)
      console.info("personal_plan_accept_ideal_plan_api", {
        event: "accepted",
        duration_ms: Date.now() - started,
      })
      return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } })
    } catch (error) {
      const code = error instanceof DirectAcceptanceError ? error.code : null
      const status = code ? STATUS_BY_CODE[code] : 503
      console.info("personal_plan_accept_ideal_plan_api", {
        event: status === 503 ? "unavailable" : "conflict",
        code,
        duration_ms: Date.now() - started,
      })
      return fail(code ?? "temporarily_unavailable", status)
    }
  }
}

export const maxDuration = 60
export const POST = createAcceptIdealPlanRouteHandler({
  enabled: isPersonalPlanAppV1Enabled,
  getUserId: async () => (await (await createClient()).auth.getUser()).data.user?.id ?? null,
  loadJourneyAccess: loadPersonalPlanJourneyAccessForUser,
  checkRateLimit,
  accept: async (userId, input) => {
    const admin = createAdminClient()
    return acceptIdealPlan(
      {
        userId,
        flags: {
          stage2Enabled: isPersonalPlanStage2Enabled(),
          stage3Enabled: isPersonalPlanStage3Enabled(),
          stage4Enabled: isPersonalPlanStage4Enabled(),
        },
        // Direct acceptance still produces the parallel Tool domain, so the
        // accepted plan carries Tool routes at `unknown` and behaviour-only
        // guidance. `careProvenance: "assumed"` in accept.ts keeps the disclosed
        // planning defaults from ever becoming ownership.
        refinementPersistence: createSupabaseStage2RefinementPersistence(admin, {
          toolsEnabled: (userId) =>
            isPersonalPlanToolsEnabledForUser(
              userId,
              admin as unknown as Parameters<typeof isPersonalPlanToolsEnabledForUser>[1],
            ),
        }),
        planState: {
          async loadActiveRoutineVersionId({ personalPlanId }) {
            const { data, error } = await admin
              .from("personal_plans")
              .select("active_routine_version_id")
              .eq("id", personalPlanId)
              .eq("user_id", userId)
              .maybeSingle()
            if (error || !data) throw new Error("direct_accept_plan_state_unavailable")
            return data.active_routine_version_id ? String(data.active_routine_version_id) : null
          },
        },
        stage3Gateway: createProductionStage3ProductsGateway({
          userId,
          persistence: createSupabaseStage3ProductionPersistence(admin),
          compiler: createInitialRoutineCandidateCompiler(),
          cadenceAuthorityReader: createSupabaseRoutineCadenceAuthorityReader(
            admin as unknown as RoutineCadenceAuthorityReadClient,
          ),
          stager: createRoutineProposalStagerRpcAdapter({
            client: admin as unknown as RoutineProposalRpcClient,
          }),
        }),
        provenance: {
          async recordDirectAccept({ personalPlanId }) {
            const { error } = await admin
              .from("personal_plans")
              .update({ unrefined_direct_accept: true, nudge_dismissed_until: null })
              .eq("id", personalPlanId)
              .eq("user_id", userId)
            if (error) throw new Error("direct_accept_provenance_write_failed")
          },
        },
      },
      input,
    )
  },
})
