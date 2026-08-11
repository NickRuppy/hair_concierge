import { NextResponse } from "next/server"
import { z } from "zod"

import {
  createProductionStage3ProductsGateway,
  Stage3AuthorityMutationError,
  type Stage3AuthorityProductionGateway,
  type Stage3ProductionPersistence,
} from "@/lib/personal-plan/products/production-persistence-gateway"
import {
  STAGE3_AUTHORITY_ACTION_KINDS,
  STAGE3_AUTHORITY_DECISION_BATCH_LIMIT,
} from "@/lib/personal-plan/products/authority/contracts"
import { Stage3AuthoritySnapshotError } from "@/lib/personal-plan/products/authority/snapshot"
import type { Stage3ProductsGateway } from "@/lib/personal-plan/products/gateway"
import {
  personalPlanCategorySchema,
  planProductRoleSchema,
  productFrequencySchema,
  stage3CapturedUncoveredRoleSchema,
  stage3RoleAssignmentSchema,
} from "@/lib/personal-plan/products/contracts"
import { createSupabaseStage3ProductionPersistence } from "@/lib/personal-plan/products/stage3-persistence-supabase"
import { isPersonalPlanAppV1Enabled } from "@/lib/personal-plan/release"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { checkRateLimit, type RateLimitConfig } from "@/lib/rate-limit"
import {
  canAccessPersonalPlanJourneyStage,
  type PersonalPlanJourneyAccess,
} from "@/lib/personal-plan/journey-access"
import { loadPersonalPlanJourneyAccessForUser } from "@/lib/personal-plan/journey-access-loader"

const STAGE3_MUTATION_RATE_LIMIT: RateLimitConfig = {
  prefix: "personal-plan-stage3-mutation",
  limit: 30,
  windowMs: 60_000,
}
const identifier = z.string().uuid()
const domainIdentifier = z.string().trim().min(1).max(200)
const authorityFingerprint = z.string().trim().min(1).max(200)
const categoryCaptureCandidateSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("catalog"),
      candidateId: domainIdentifier,
      frequencyRange: productFrequencySchema,
      roles: z.array(planProductRoleSchema).max(20),
    })
    .strict(),
  z
    .object({
      kind: z.literal("pending"),
      userProductId: identifier,
      submissionId: identifier,
      frequencyRange: productFrequencySchema,
      roles: z.array(planProductRoleSchema).max(20),
    })
    .strict(),
])
const loadQuerySchema = z
  .object({ personalPlanId: identifier, refinedVersionId: identifier })
  .strict()
const clientMutationSchema = z
  .object({
    draftId: identifier,
    expectedRevision: z.number().int().nonnegative(),
    mutation: z.discriminatedUnion("type", [
      z
        .object({
          type: z.literal("replace_capture_category"),
          category: personalPlanCategorySchema,
          refinedNeedVersionId: identifier,
          refinedInputHash: authorityFingerprint,
          categoryAuthorityVersion: authorityFingerprint,
          candidates: z.array(categoryCaptureCandidateSchema).max(10),
          uncoveredRoles: z.array(stage3CapturedUncoveredRoleSchema).max(20),
        })
        .strict(),
      z
        .object({
          type: z.literal("capture_catalog_candidate"),
          candidateId: domainIdentifier,
          frequencyRange: productFrequencySchema,
        })
        .strict(),
      z
        .object({
          type: z.literal("replace_category_role_assignments"),
          category: personalPlanCategorySchema,
          assignments: z.array(stage3RoleAssignmentSchema).min(1),
        })
        .strict(),
      z
        .object({
          type: z.literal("finalize_capture_category"),
          category: personalPlanCategorySchema,
          assignments: z.array(stage3RoleAssignmentSchema),
          uncoveredRoles: z.array(stage3CapturedUncoveredRoleSchema),
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
    ]),
  })
  .strict()
const authorityIntentPayloadSchema = z
  .object({
    type: z.literal("resolve_decision"),
    subjectKey: domainIdentifier,
    action: z.enum(STAGE3_AUTHORITY_ACTION_KINDS),
    selectedCandidateId: domainIdentifier.optional(),
  })
  .strict()
const authorityIntentSchema = z
  .object({
    draftId: identifier,
    expectedRevision: z.number().int().nonnegative(),
    intent: authorityIntentPayloadSchema,
  })
  .strict()
const authorityIntentBatchSchema = z
  .object({
    draftId: identifier,
    expectedRevision: z.number().int().nonnegative(),
    intents: z
      .array(authorityIntentPayloadSchema)
      .min(1)
      .max(STAGE3_AUTHORITY_DECISION_BATCH_LIMIT),
  })
  .strict()
const mutationSchema = z.union([
  clientMutationSchema,
  authorityIntentSchema,
  authorityIntentBatchSchema,
])

export type Stage3RouteDeps = {
  enabled: () => boolean
  getUserId: () => Promise<string | null>
  gatewayFor: (userId: string) => Stage3RouteGateway
  checkRateLimit: (
    identifier: string,
    config: RateLimitConfig,
  ) => Promise<{ allowed: boolean; error?: string }>
  loadJourneyAccess: (userId: string) => Promise<PersonalPlanJourneyAccess>
}

function response(body: unknown, status = 200, headers?: HeadersInit) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } })
}
function log(event: string, started: number, code?: string, phases: Record<string, number> = {}) {
  console.info("personal_plan_stage3_api", {
    event,
    code,
    duration_ms: Date.now() - started,
    ...Object.fromEntries(
      Object.entries(phases).map(([name, duration]) => [`${name}_duration_ms`, duration]),
    ),
  })
}
function serverTiming(phases: Record<string, number>) {
  return Object.entries(phases)
    .map(([name, duration]) => `${name};dur=${Math.max(0, Math.round(duration * 100) / 100)}`)
    .join(", ")
}

export function createStage3RouteHandlers(deps: Stage3RouteDeps) {
  async function authorize(started: number, applyMutationLimit: boolean) {
    const phases: Record<string, number> = {}
    if (!deps.enabled())
      return { response: response({ error: "personal_plan_not_available" }, 404) }
    let phaseStarted = Date.now()
    const userId = await deps.getUserId()
    phases.auth = Date.now() - phaseStarted
    if (!userId) return { response: response({ error: "unauthorized" }, 401) }
    try {
      phaseStarted = Date.now()
      if (!canAccessPersonalPlanJourneyStage(await deps.loadJourneyAccess(userId), "stage3")) {
        return { response: response({ error: "stage_not_ready" }, 409) }
      }
      phases.journey = Date.now() - phaseStarted
    } catch {
      return { response: response({ error: "temporarily_unavailable" }, 503) }
    }
    if (applyMutationLimit) {
      phaseStarted = Date.now()
      const limited = await deps.checkRateLimit(userId, STAGE3_MUTATION_RATE_LIMIT)
      phases.rate_limit = Date.now() - phaseStarted
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
    return { userId, phases }
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
        const gateway = deps.gatewayFor(auth.userId)
        const loaded = await gateway.loadOrCreate({
          draftId: "server-derived",
          userId: auth.userId,
          requirements: [],
          ...parsed.data,
        })
        const authorityEvaluations =
          loaded.draft.pass === "product_capture" || !gateway.evaluateDecisions
            ? []
            : await gateway.evaluateDecisions({ draftId: loaded.draft.draftId })
        return response({ ...loaded, authorityEvaluations }, 200, {
          "Server-Timing": serverTiming(auth.phases),
        })
      } catch (error) {
        if (error instanceof Stage3AuthoritySnapshotError) {
          log("conflict", started, error.code)
          return response({ error: error.code }, 409)
        }
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
        const gateway = deps.gatewayFor(auth.userId)
        const gatewayStarted = Date.now()
        const result =
          "intent" in parsed.data
            ? await requireAuthorityDecisionGateway(gateway).resolveDecision(parsed.data)
            : "intents" in parsed.data
              ? await requireAuthorityBatchGateway(gateway).resolveDecisions(parsed.data)
              : await gateway.mutate(parsed.data as never)
        auth.phases.gateway = Date.now() - gatewayStarted
        if (result.status === "conflict") {
          log("conflict", started, "revision_conflict", auth.phases)
          return response({ error: "revision_conflict", latestDraft: result.latestDraft }, 409, {
            "Server-Timing": serverTiming(auth.phases),
          })
        }
        log(
          "save",
          started,
          "intents" in parsed.data
            ? "authority_batch"
            : "intent" in parsed.data
              ? "authority_single"
              : "client_mutation",
          auth.phases,
        )
        return response(result, 200, { "Server-Timing": serverTiming(auth.phases) })
      } catch (error) {
        if (error instanceof Stage3AuthorityMutationError) {
          return response({ error: "invalid_request" }, 400)
        }
        if (error instanceof Stage3AuthoritySnapshotError) {
          log("conflict", started, error.code)
          return response({ error: error.code }, 409)
        }
        log("unavailable", started, "temporarily_unavailable")
        return response({ error: "temporarily_unavailable" }, 503)
      }
    },
  }
}

function requireAuthorityDecisionGateway(
  gateway: Stage3RouteGateway,
): Pick<Stage3AuthorityProductionGateway, "resolveDecision"> {
  if (!gateway.resolveDecision) throw new Error("stage3_authority_gateway_unavailable")
  return { resolveDecision: gateway.resolveDecision.bind(gateway) }
}

function requireAuthorityBatchGateway(
  gateway: Stage3RouteGateway,
): Pick<Stage3AuthorityProductionGateway, "resolveDecisions"> {
  if (!gateway.resolveDecisions) throw new Error("stage3_authority_gateway_unavailable")
  return { resolveDecisions: gateway.resolveDecisions.bind(gateway) }
}

type Stage3RouteGateway = Stage3ProductsGateway &
  Partial<
    Pick<
      Stage3AuthorityProductionGateway,
      "evaluateDecisions" | "resolveDecision" | "resolveDecisions"
    >
  >

const handlers = createStage3RouteHandlers({
  enabled: isPersonalPlanAppV1Enabled,
  getUserId: async () => (await (await createClient()).auth.getUser()).data.user?.id ?? null,
  loadJourneyAccess: loadPersonalPlanJourneyAccessForUser,
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
