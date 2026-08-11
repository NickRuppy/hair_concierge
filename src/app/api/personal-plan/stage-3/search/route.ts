import { NextResponse } from "next/server"
import { z } from "zod"
import { createProductionStage3ProductsGateway } from "@/lib/personal-plan/products/production-persistence-gateway"
import { createSupabaseStage3ProductionPersistence } from "@/lib/personal-plan/products/stage3-persistence-supabase"
import {
  personalPlanCategorySchema,
  type PersonalPlanCategory,
} from "@/lib/personal-plan/products/contracts"
import { isPersonalPlanAppV1Enabled } from "@/lib/personal-plan/release"
import { checkRateLimit, type RateLimitConfig } from "@/lib/rate-limit"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import {
  canAccessPersonalPlanJourneyStage,
  type PersonalPlanJourneyAccess,
} from "@/lib/personal-plan/journey-access"
import { loadPersonalPlanJourneyAccessForUser } from "@/lib/personal-plan/journey-access-loader"

const rate: RateLimitConfig = { prefix: "personal-plan-stage3-search", limit: 30, windowMs: 60_000 }
const querySchema = z
  .object({
    draftId: z.string().uuid(),
    category: personalPlanCategorySchema,
    q: z.string().trim().min(2).max(120),
    requestToken: z.coerce.number().int().nonnegative(),
  })
  .strict()
export type Stage3SearchRouteDeps = {
  enabled: () => boolean
  getUserId: () => Promise<string | null>
  loadJourneyAccess: (userId: string) => Promise<PersonalPlanJourneyAccess>
  checkRateLimit: typeof checkRateLimit
  search: (
    userId: string,
    input: {
      draftId: string
      category: PersonalPlanCategory
      query: string
      requestToken: number
    },
  ) => Promise<unknown>
}

export function createStage3SearchRouteHandler(deps: Stage3SearchRouteDeps) {
  return async function GET(request: Request) {
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
    const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams))
    if (!parsed.success) return fail("invalid_request", 400)
    try {
      return NextResponse.json(
        await deps.search(userId, {
          draftId: parsed.data.draftId,
          category: parsed.data.category,
          query: parsed.data.q,
          requestToken: parsed.data.requestToken,
        }),
        { headers: { "Cache-Control": "no-store" } },
      )
    } catch {
      console.info("personal_plan_stage3_api", {
        event: "unavailable",
        code: "temporarily_unavailable",
        duration_ms: Date.now() - started,
      })
      return fail("temporarily_unavailable", 503)
    }
  }
}

export const GET = createStage3SearchRouteHandler({
  enabled: isPersonalPlanAppV1Enabled,
  getUserId: async () => (await (await createClient()).auth.getUser()).data.user?.id ?? null,
  loadJourneyAccess: loadPersonalPlanJourneyAccessForUser,
  checkRateLimit,
  search: (userId, input) =>
    createProductionStage3ProductsGateway({
      userId,
      persistence: createSupabaseStage3ProductionPersistence(createAdminClient()),
    }).search(input),
})
