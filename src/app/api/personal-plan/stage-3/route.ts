import { NextResponse } from "next/server"
import { z } from "zod"

import {
  createProductionStage3ProductsGateway,
  type Stage3ProductionPersistence,
} from "@/lib/personal-plan/products/production-persistence-gateway"
import type { Stage3ProductsGateway } from "@/lib/personal-plan/products/gateway"
import {
  personalPlanCategorySchema,
  planProductRoleSchema,
  productFrequencySchema,
  stage3CapturedUncoveredRoleSchema,
  stage3ProductDecisionSchema,
} from "@/lib/personal-plan/products/contracts"
import { createSupabaseStage3ProductionPersistence } from "@/lib/personal-plan/products/stage3-persistence-supabase"
import { isPersonalPlanAppV1Enabled } from "@/lib/personal-plan/release"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { checkRateLimit, type RateLimitConfig } from "@/lib/rate-limit"

const STAGE3_MUTATION_RATE_LIMIT: RateLimitConfig = {
  prefix: "personal-plan-stage3-mutation",
  limit: 30,
  windowMs: 60_000,
}
const identifier = z.string().uuid()
const domainIdentifier = z.string().trim().min(1).max(200)
const loadQuerySchema = z
  .object({ personalPlanId: identifier, refinedVersionId: identifier })
  .strict()
const mutationSchema = z
  .object({
    draftId: identifier,
    expectedRevision: z.number().int().nonnegative(),
    mutation: z.discriminatedUnion("type", [
      z
        .object({
          type: z.literal("capture_catalog_candidate"),
          candidateId: domainIdentifier,
          frequencyRange: productFrequencySchema,
        })
        .strict(),
      z
        .object({
          type: z.literal("assign_roles"),
          capturedProductId: domainIdentifier,
          category: personalPlanCategorySchema,
          roles: z.array(planProductRoleSchema).min(1),
        })
        .strict(),
      z
        .object({
          type: z.literal("mark_role_uncovered"),
          uncoveredRole: stage3CapturedUncoveredRoleSchema,
        })
        .strict(),
      z
        .object({
          type: z.literal("complete_capture_category"),
          category: personalPlanCategorySchema,
        })
        .strict(),
      z
        .object({
          type: z.literal("reopen_capture_category"),
          category: personalPlanCategorySchema,
        })
        .strict(),
      z
        .object({ type: z.literal("remove_captured_product"), capturedProductId: domainIdentifier })
        .strict(),
      z
        .object({ type: z.literal("record_decision"), decision: stage3ProductDecisionSchema })
        .strict(),
    ]),
  })
  .strict()

export type Stage3RouteDeps = {
  enabled: () => boolean
  getUserId: () => Promise<string | null>
  gatewayFor: (userId: string) => Stage3ProductsGateway
  checkRateLimit: (
    identifier: string,
    config: RateLimitConfig,
  ) => Promise<{ allowed: boolean; error?: string }>
}

function response(body: unknown, status = 200, headers?: HeadersInit) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } })
}
function log(event: string, started: number, code?: string) {
  console.info("personal_plan_stage3_api", { event, code, duration_ms: Date.now() - started })
}

export function createStage3RouteHandlers(deps: Stage3RouteDeps) {
  async function authorize(started: number, applyMutationLimit: boolean) {
    if (!deps.enabled())
      return { response: response({ error: "personal_plan_not_available" }, 404) }
    const userId = await deps.getUserId()
    if (!userId) return { response: response({ error: "unauthorized" }, 401) }
    if (applyMutationLimit) {
      const limited = await deps.checkRateLimit(userId, STAGE3_MUTATION_RATE_LIMIT)
      if (!limited.allowed) {
        const unavailable = limited.error === "service_unavailable"
        log("unavailable", started, unavailable ? "temporarily_unavailable" : "rate_limited")
        return {
          response: response(
            { error: unavailable ? "temporarily_unavailable" : "rate_limited" },
            unavailable ? 503 : 429,
            unavailable ? undefined : { "Retry-After": "60" },
          ),
        }
      }
    }
    return { userId }
  }
  return {
    async GET(request: Request) {
      const started = Date.now()
      const auth = await authorize(started, false)
      if ("response" in auth) return auth.response
      const parsed = loadQuerySchema.safeParse(
        Object.fromEntries(new URL(request.url).searchParams),
      )
      if (!parsed.success) return response({ error: "invalid_request" }, 400)
      try {
        return response(
          await deps
            .gatewayFor(auth.userId)
            .loadOrCreate({
              draftId: "server-derived",
              userId: auth.userId,
              requirements: [],
              ...parsed.data,
            }),
        )
      } catch {
        log("unavailable", started, "temporarily_unavailable")
        return response({ error: "temporarily_unavailable" }, 503)
      }
    },
    async PATCH(request: Request) {
      const started = Date.now()
      const auth = await authorize(started, true)
      if ("response" in auth) return auth.response
      const parsed = mutationSchema.safeParse(await request.json().catch(() => null))
      if (!parsed.success) return response({ error: "invalid_request" }, 400)
      try {
        const result = await deps.gatewayFor(auth.userId).mutate(parsed.data as never)
        if (result.status === "conflict") {
          log("conflict", started, "revision_conflict")
          return response({ error: "revision_conflict", latestDraft: result.latestDraft }, 409)
        }
        return response(result)
      } catch {
        log("unavailable", started, "temporarily_unavailable")
        return response({ error: "temporarily_unavailable" }, 503)
      }
    },
  }
}

const handlers = createStage3RouteHandlers({
  enabled: isPersonalPlanAppV1Enabled,
  getUserId: async () => (await (await createClient()).auth.getUser()).data.user?.id ?? null,
  gatewayFor: (userId) =>
    createProductionStage3ProductsGateway({
      userId,
      persistence: createSupabaseStage3ProductionPersistence(
        createAdminClient(),
      ) as Stage3ProductionPersistence,
    }),
  checkRateLimit,
})
export const GET = handlers.GET
export const PATCH = handlers.PATCH
