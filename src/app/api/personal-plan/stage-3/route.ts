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
import type {
  Stage3MutationResponse,
  Stage3ProductsGateway,
} from "@/lib/personal-plan/products/gateway"
import {
  personalPlanCategorySchema,
  planProductRoleSchema,
  productFrequencySchema,
  stage3CapturedUncoveredRoleSchema,
  stage3RoleAssignmentSchema,
} from "@/lib/personal-plan/products/contracts"
import { createSupabaseStage3ProductionPersistence } from "@/lib/personal-plan/products/stage3-persistence-supabase"
import { stage3FitComparisonForTransport } from "@/lib/personal-plan/products/fit-comparison"
import {
  createSupabaseStage3RoutineAuthorityRepairService,
  type Stage3RoutineAuthorityRepairService,
} from "@/lib/personal-plan/products/stage3-routine-authority-repair-service"
import { isPersonalPlanAppV1Enabled } from "@/lib/personal-plan/release"
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

const STAGE3_MUTATION_RATE_LIMIT: RateLimitConfig = {
  prefix: "personal-plan-stage3-mutation",
  limit: 90,
  windowMs: 60_000,
}
const STAGE3_CAPTURE_RATE_LIMIT: RateLimitConfig = {
  prefix: "personal-plan-stage3-capture",
  limit: 30,
  windowMs: 60_000,
}
const STAGE3_DECISION_RATE_LIMIT: RateLimitConfig = {
  prefix: "personal-plan-stage3-decision",
  limit: 60,
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
  .object({
    personalPlanId: identifier,
    refinedVersionId: identifier,
    repairRoutineVersionId: identifier.optional(),
  })
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
    selectedCandidateFactFingerprint: domainIdentifier.optional(),
  })
  .strict()
  .superRefine((intent, ctx) => {
    if (intent.action === "select_replacement") {
      if (!intent.selectedCandidateId) {
        ctx.addIssue({
          code: "custom",
          message: "select_replacement requires selectedCandidateId",
          path: ["selectedCandidateId"],
        })
      }
      if (!intent.selectedCandidateFactFingerprint) {
        ctx.addIssue({
          code: "custom",
          message: "select_replacement requires selectedCandidateFactFingerprint",
          path: ["selectedCandidateFactFingerprint"],
        })
      }
      return
    }
    if (intent.selectedCandidateFactFingerprint !== undefined) {
      ctx.addIssue({
        code: "custom",
        message: "selectedCandidateFactFingerprint is only valid for select_replacement",
        path: ["selectedCandidateFactFingerprint"],
      })
    }
  })
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
const needRevisionSchema = z
  .object({
    draftId: identifier,
    expectedRevision: z.number().int().nonnegative(),
    expectedProposalFingerprint: z.string().regex(/^[0-9a-f]{64}$/),
    action: z.enum(["accept", "reject"]),
  })
  .strict()
const inventoryDispositionAcknowledgementSchema = z
  .object({
    draftId: identifier,
    expectedRevision: z.number().int().nonnegative(),
    action: z.literal("acknowledge_inventory_disposition"),
    dispositionKey: domainIdentifier,
  })
  .strict()
const mutationSchema = z.union([
  clientMutationSchema,
  authorityIntentSchema,
  authorityIntentBatchSchema,
  needRevisionSchema,
  inventoryDispositionAcknowledgementSchema,
])

export type Stage3RouteDeps = {
  enabled: () => boolean
  getUserId: () => Promise<string | null>
  gatewayFor: (userId: string) => Stage3RouteGateway
  repairServiceFor?: (userId: string) => Stage3RoutineAuthorityRepairService
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
  async function authorize() {
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
        phases.journey = Date.now() - phaseStarted
        return {
          response: response({ error: "stage_not_ready" }, 409, {
            "Server-Timing": serverTiming(phases),
          }),
        }
      }
      phases.journey = Date.now() - phaseStarted
    } catch {
      phases.journey = Date.now() - phaseStarted
      return {
        response: response({ error: "temporarily_unavailable" }, 503, {
          "Server-Timing": serverTiming(phases),
        }),
      }
    }
    return { userId, phases }
  }
  async function applyMutationLimits(
    userId: string,
    parsed: z.infer<typeof mutationSchema>,
    phases: Record<string, number>,
  ) {
    const family =
      "intent" in parsed ||
      "intents" in parsed ||
      "expectedProposalFingerprint" in parsed ||
      ("action" in parsed && parsed.action === "acknowledge_inventory_disposition")
        ? STAGE3_DECISION_RATE_LIMIT
        : STAGE3_CAPTURE_RATE_LIMIT
    for (const config of [STAGE3_MUTATION_RATE_LIMIT, family]) {
      const phaseStarted = Date.now()
      const limited = await deps.checkRateLimit(userId, config)
      phases.rate_limit = (phases.rate_limit ?? 0) + Date.now() - phaseStarted
      if (!limited.allowed) return { config, limited }
    }
    return null
  }
  return {
    async GET(request: Request) {
      const started = Date.now()
      const auth = await authorize()
      if ("response" in auth) return auth.response
      const parsed = loadQuerySchema.safeParse(
        Object.fromEntries(new URL(request.url).searchParams),
      )
      if (!parsed.success) return response({ error: "invalid_request" }, 400)
      try {
        const gateway = deps.gatewayFor(auth.userId)
        let repairRequirements:
          | Awaited<ReturnType<Stage3RoutineAuthorityRepairService["createOrLoad"]>>["requirements"]
          | null = null
        if (parsed.data.repairRoutineVersionId) {
          if (!deps.repairServiceFor) throw new Error("stage3_repair_service_unavailable")
          repairRequirements = (
            await deps.repairServiceFor(auth.userId).createOrLoad({
              userId: auth.userId,
              personalPlanId: parsed.data.personalPlanId,
              refinedVersionId: parsed.data.refinedVersionId,
              routineVersionId: parsed.data.repairRoutineVersionId,
            })
          ).requirements
        }
        const loaded = await gateway.loadOrCreate({
          draftId: "server-derived",
          userId: auth.userId,
          requirements: [],
          personalPlanId: parsed.data.personalPlanId,
          refinedVersionId: parsed.data.refinedVersionId,
          // Stage-3 re-entry: a Stage-2 (module) completion may have advanced
          // the refined head and staled this draft while the user was away.
          // The repair load is excluded — its requirements were derived for the
          // version the caller named, so it must not silently follow the head.
          rebuildOnStaleRefinedVersion: !parsed.data.repairRoutineVersionId,
        })
        if (repairRequirements) loaded.requirements = repairRequirements
        const usesReviewBundles =
          loaded.draft.status === "active" &&
          loaded.draft.pass !== "product_capture" &&
          loaded.draft.pass !== "need_revision_review" &&
          Boolean(gateway.reviewDecisionBundles)
        const reviewBundles =
          !usesReviewBundles || !gateway.reviewDecisionBundles
            ? []
            : await gateway.reviewDecisionBundles({ draftId: loaded.draft.draftId })
        const authorityEvaluations = usesReviewBundles
          ? reviewBundles.map((bundle) => bundle.authorityEvaluation)
          : loaded.draft.status !== "active" ||
              loaded.draft.pass === "product_capture" ||
              loaded.draft.pass === "need_revision_review" ||
              !gateway.evaluateDecisions
            ? []
            : await gateway.evaluateDecisions({ draftId: loaded.draft.draftId })
        return response(
          {
            ...loaded,
            authorityEvaluations,
            fitComparisons: reviewBundles.map((bundle) =>
              stage3FitComparisonForTransport(bundle.fitComparison),
            ),
          },
          200,
          {
            "Server-Timing": serverTiming(auth.phases),
          },
        )
      } catch (error) {
        if (error instanceof Stage3AuthoritySnapshotError) {
          log("conflict", started, error.code)
          return response({ error: error.code }, 409, {
            "Server-Timing": serverTiming(auth.phases),
          })
        }
        log("unavailable", started, "temporarily_unavailable")
        return response({ error: "temporarily_unavailable" }, 503, {
          "Server-Timing": serverTiming(auth.phases),
        })
      }
    },
    async PATCH(request: Request) {
      const started = Date.now()
      const auth = await authorize()
      if ("response" in auth) return auth.response
      const parsed = mutationSchema.safeParse(await request.json().catch(() => null))
      if (!parsed.success) return response({ error: "invalid_request" }, 400)
      const limited = await applyMutationLimits(auth.userId, parsed.data, auth.phases)
      if (limited) {
        const unavailable = limited.limited.error === "service_unavailable"
        const code = unavailable ? "temporarily_unavailable" : "rate_limited"
        log("unavailable", started, code, auth.phases)
        return response({ error: code }, unavailable ? 503 : 429, {
          ...(unavailable
            ? {}
            : { "Retry-After": String(fixedWindowRetryAfterSeconds(limited.config)) }),
          "Server-Timing": serverTiming(auth.phases),
        })
      }
      try {
        const gateway = deps.gatewayFor(auth.userId)
        const gatewayStarted = Date.now()
        const result =
          "intent" in parsed.data
            ? await requireAuthorityDecisionGateway(gateway).resolveDecision(parsed.data)
            : "intents" in parsed.data
              ? await requireAuthorityBatchGateway(gateway).resolveDecisions(parsed.data)
              : "expectedProposalFingerprint" in parsed.data
                ? await requireNeedRevisionGateway(gateway).resolveNeedRevision(parsed.data)
                : "action" in parsed.data &&
                    parsed.data.action === "acknowledge_inventory_disposition"
                  ? await requireInventoryDispositionGateway(
                      gateway,
                    ).acknowledgeInventoryDisposition(parsed.data)
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
              : "expectedProposalFingerprint" in parsed.data
                ? "need_revision"
                : "action" in parsed.data &&
                    parsed.data.action === "acknowledge_inventory_disposition"
                  ? "inventory_disposition"
                  : "client_mutation",
          auth.phases,
        )
        return response(result, 200, { "Server-Timing": serverTiming(auth.phases) })
      } catch (error) {
        if (error instanceof Stage3AuthorityMutationError) {
          if (error.code === "stage3_replacement_candidate_invalid") {
            log("conflict", started, error.code, auth.phases)
            return response({ error: error.code }, 409, {
              "Server-Timing": serverTiming(auth.phases),
            })
          }
          return response({ error: "invalid_request" }, 400, {
            "Server-Timing": serverTiming(auth.phases),
          })
        }
        if (error instanceof Stage3AuthoritySnapshotError) {
          log("conflict", started, error.code)
          return response({ error: error.code }, 409, {
            "Server-Timing": serverTiming(auth.phases),
          })
        }
        log("unavailable", started, "temporarily_unavailable", auth.phases)
        return response({ error: "temporarily_unavailable" }, 503, {
          "Server-Timing": serverTiming(auth.phases),
        })
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

function requireNeedRevisionGateway(
  gateway: Stage3RouteGateway,
): Required<Pick<Stage3ProductsGateway, "resolveNeedRevision">> {
  if (!gateway.resolveNeedRevision) throw new Error("stage3_need_revision_gateway_unavailable")
  return { resolveNeedRevision: gateway.resolveNeedRevision.bind(gateway) }
}

function requireInventoryDispositionGateway(gateway: Stage3RouteGateway): {
  acknowledgeInventoryDisposition(
    input: z.infer<typeof inventoryDispositionAcknowledgementSchema>,
  ): Promise<Stage3MutationResponse>
} {
  if (!gateway.acknowledgeInventoryDisposition) {
    throw new Error("stage3_inventory_disposition_gateway_unavailable")
  }
  return {
    acknowledgeInventoryDisposition: (input) =>
      gateway.acknowledgeInventoryDisposition!({
        draftId: input.draftId,
        expectedRevision: input.expectedRevision,
        dispositionKey: input.dispositionKey,
      }),
  }
}

type Stage3RouteGateway = Stage3ProductsGateway &
  Partial<
    Pick<
      Stage3AuthorityProductionGateway,
      "evaluateDecisions" | "reviewDecisionBundles" | "resolveDecision" | "resolveDecisions"
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
  repairServiceFor: () => createSupabaseStage3RoutineAuthorityRepairService(createAdminClient()),
  checkRateLimit,
})
export const maxDuration = 60
export const GET = handlers.GET
export const PATCH = handlers.PATCH
