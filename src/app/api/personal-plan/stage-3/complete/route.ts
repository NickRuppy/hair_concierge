import { NextResponse } from "next/server"
import { z } from "zod"
import {
  createProductionStage3ProductsGateway,
  Stage3ProductionUnavailableError,
} from "@/lib/personal-plan/products/production-persistence-gateway"
import { createSupabaseStage3ProductionPersistence } from "@/lib/personal-plan/products/stage3-persistence-supabase"
import { isPersonalPlanAppV1Enabled } from "@/lib/personal-plan/release"
import { createInitialRoutineCandidateCompiler } from "@/lib/personal-plan/routine-candidate-compiler"
import {
  createRoutineProposalStagerRpcAdapter,
  type RoutineProposalRpcClient,
} from "@/lib/personal-plan/routine-proposal-stager"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { checkRateLimit, type RateLimitConfig } from "@/lib/rate-limit"
const rate: RateLimitConfig = {
  prefix: "personal-plan-stage3-complete",
  limit: 8,
  windowMs: 60_000,
}
const bodySchema = z
  .object({ draftId: z.string().uuid(), expectedRevision: z.number().int().nonnegative() })
  .strict()
export async function POST(request: Request) {
  const started = Date.now()
  const fail = (error: string, status: number, headers?: HeadersInit) =>
    NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store", ...headers } })
  if (!isPersonalPlanAppV1Enabled()) return fail("personal_plan_not_available", 404)
  const userId = (await (await createClient()).auth.getUser()).data.user?.id
  if (!userId) return fail("unauthorized", 401)
  const limited = await checkRateLimit(userId, rate)
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
    const admin = createAdminClient()
    const result = await createProductionStage3ProductsGateway({
      userId,
      persistence: createSupabaseStage3ProductionPersistence(admin),
      compiler: createInitialRoutineCandidateCompiler(),
      stager: createRoutineProposalStagerRpcAdapter({
        client: admin as unknown as RoutineProposalRpcClient,
      }),
    }).complete(parsed.data)
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
