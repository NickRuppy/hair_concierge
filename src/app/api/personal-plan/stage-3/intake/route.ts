import { createHash } from "node:crypto"

import { NextResponse } from "next/server"
import { z } from "zod"

import { createProductionStage3ProductsGateway } from "@/lib/personal-plan/products/production-persistence-gateway"
import type { Stage3ProductionPersistence } from "@/lib/personal-plan/products/production-persistence-gateway"
import type { Stage3ProductDraft } from "@/lib/personal-plan/products/contracts"
import { createSupabaseStage3ProductionPersistence } from "@/lib/personal-plan/products/stage3-persistence-supabase"
import { isPersonalPlanAppV1Enabled } from "@/lib/personal-plan/release"
import { createSupabaseProductIntakeRepository } from "@/lib/product-intake/repository"
import type { ProductIntakeRepository } from "@/lib/product-intake/repository-types"
import { personalPlanProductIntakeSubmissionSchema } from "@/lib/product-intake/schemas"
import {
  cancelPersonalPlanProductIntake,
  PersonalPlanProductIntakeCompensationError,
  submitPersonalPlanProductIntake,
} from "@/lib/product-intake/submissions"
import { checkRateLimit, type RateLimitConfig } from "@/lib/rate-limit"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import {
  canAccessPersonalPlanJourneyStage,
  type PersonalPlanJourneyAccess,
} from "@/lib/personal-plan/journey-access"
import { loadPersonalPlanJourneyAccessForUser } from "@/lib/personal-plan/journey-access-loader"

const STAGE3_INTAKE_RATE_LIMIT: RateLimitConfig = {
  prefix: "personal-plan-stage3-intake",
  limit: 8,
  windowMs: 60_000,
}
const requestSchema = z
  .object({
    draftId: z.string().uuid(),
    expectedRevision: z.number().int().nonnegative(),
    idempotencyKey: z.string().uuid().optional(),
    input: z.record(z.string(), z.unknown()),
  })
  .strict()
const idempotencyKeySchema = z.string().uuid()

type IntakeDeps = {
  enabled: () => boolean
  getUserId: () => Promise<string | null>
  checkRateLimit: (
    id: string,
    config: RateLimitConfig,
  ) => Promise<{ allowed: boolean; error?: string }>
  persistence: () => Stage3ProductionPersistence
  repository: () => ProductIntakeRepository
  loadJourneyAccess: (userId: string) => Promise<PersonalPlanJourneyAccess>
}

function response(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } })
}
function fingerprint(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex")
}
function hasExactIntake(
  draft: Stage3ProductDraft | null,
  userProductId: string,
  submissionId: string,
) {
  return Boolean(
    draft?.products.some(
      (product) =>
        product.userProductId === userProductId &&
        product.identity.kind === "pending_submission" &&
        product.identity.submissionId === submissionId,
    ),
  )
}
function isFingerprintConflict(error: unknown) {
  return (
    error instanceof Error &&
    error.message.includes("idempotency key was reused with different input")
  )
}

export function createStage3IntakeRouteHandlers(deps: IntakeDeps) {
  return {
    async POST(request: Request) {
      const started = Date.now()
      if (!deps.enabled()) return response({ error: "personal_plan_not_available" }, 404)
      const userId = await deps.getUserId()
      if (!userId) return response({ error: "unauthorized" }, 401)
      try {
        if (!canAccessPersonalPlanJourneyStage(await deps.loadJourneyAccess(userId), "stage3")) {
          return response({ error: "stage_not_ready" }, 409)
        }
      } catch {
        return response({ error: "temporarily_unavailable" }, 503)
      }
      const limited = await deps.checkRateLimit(userId, STAGE3_INTAKE_RATE_LIMIT)
      if (!limited.allowed)
        return response(
          {
            error:
              limited.error === "service_unavailable" ? "temporarily_unavailable" : "rate_limited",
          },
          limited.error === "service_unavailable" ? 503 : 429,
        )
      const raw = requestSchema.safeParse(await request.json().catch(() => null))
      if (!raw.success) return response({ error: "invalid_request" }, 400)
      const headerKey = request.headers.get("Idempotency-Key")
      if (headerKey && raw.data.idempotencyKey && headerKey !== raw.data.idempotencyKey) {
        return response({ error: "invalid_request" }, 400)
      }
      const parsedKey = idempotencyKeySchema.safeParse(headerKey ?? raw.data.idempotencyKey)
      if (!parsedKey.success) return response({ error: "invalid_request" }, 400)
      const idempotencyKey = parsedKey.data

      const persistence = deps.persistence()
      let draft: Stage3ProductDraft | null
      try {
        draft = await persistence.loadDraft({ userId, draftId: raw.data.draftId })
      } catch {
        return response({ error: "temporarily_unavailable" }, 503)
      }
      if (
        !draft ||
        draft.status !== "active" ||
        draft.revision !== raw.data.expectedRevision ||
        !draft.categoryCursor
      ) {
        return response(
          { error: draft ? "revision_conflict" : "invalid_source" },
          draft ? 409 : 404,
        )
      }
      const input = personalPlanProductIntakeSubmissionSchema.safeParse({
        ...raw.data.input,
        category: draft.categoryCursor,
      })
      if (!input.success) return response({ error: "invalid_request" }, 400)

      const requestFingerprint = fingerprint({
        draftId: draft.draftId,
        category: input.data.category,
        input: input.data,
      })
      const userProductId = idempotencyKey
      const repository = deps.repository()
      let intake
      try {
        intake = await submitPersonalPlanProductIntake({
          userId,
          userProductId,
          requestFingerprint,
          input: input.data,
          repository,
        })
      } catch (error) {
        if (isFingerprintConflict(error)) return response({ error: "idempotency_key_reused" }, 409)
        if (error instanceof PersonalPlanProductIntakeCompensationError) {
          return error.outcome === "rolled_back"
            ? response(
                { error: "rolled_back", latestDraft: draft, rotateIdempotencyKey: true },
                409,
              )
            : response({ error: "compensation_pending", retryable: true, idempotencyKey }, 503)
        }
        return response({ error: "temporarily_unavailable" }, 503)
      }

      const submissionId = intake.submission.id
      const gateway = createProductionStage3ProductsGateway({ userId, persistence })
      try {
        const mutation = await gateway.mutate({
          draftId: draft.draftId,
          expectedRevision: draft.revision,
          mutation: {
            type: "capture_pending_submission",
            userProductId,
            submissionId,
            displayName:
              input.data.product_name_text ?? input.data.brand_text ?? "Produkt wird geprüft",
            category: input.data.category,
            reviewStatus: "pending_review",
            frequencyRange: input.data.frequency_range,
          },
        })
        if (mutation.status === "saved") return response({ intake, draft: mutation.draft }, 201)
        // Gateway conflict can race with a committed response; reload the canonical row
        // before deciding whether cancellation is safe.
        let latest: Stage3ProductDraft | null
        try {
          latest = await persistence.loadDraft({ userId, draftId: draft.draftId })
        } catch {
          return response(
            { error: "temporarily_unavailable", retryable: true, idempotencyKey },
            503,
          )
        }
        latest ??= mutation.latestDraft
        if (hasExactIntake(latest, userProductId, submissionId))
          return response({ intake, draft: latest, replayed: true }, 200)
        try {
          await cancelPersonalPlanProductIntake({ userId, userProductId, submissionId, repository })
        } catch {
          return response({ error: "compensation_pending", retryable: true, idempotencyKey }, 503)
        }
        return response(
          { error: "rolled_back", latestDraft: latest, rotateIdempotencyKey: true },
          409,
        )
      } catch {
        // A thrown mutation may have committed before its response was lost. Reconcile before compensating.
        let latest: Stage3ProductDraft | null = null
        try {
          latest = await persistence.loadDraft({ userId, draftId: draft.draftId })
        } catch {
          return response(
            { error: "temporarily_unavailable", retryable: true, idempotencyKey },
            503,
          )
        }
        if (hasExactIntake(latest, userProductId, submissionId))
          return response({ intake, draft: latest, replayed: true }, 200)
        try {
          await cancelPersonalPlanProductIntake({ userId, userProductId, submissionId, repository })
        } catch {
          return response({ error: "compensation_pending", retryable: true, idempotencyKey }, 503)
        }
        return response(
          { error: "rolled_back", latestDraft: latest, rotateIdempotencyKey: true },
          409,
        )
      } finally {
        console.info("personal_plan_stage3_api", {
          event: "pending_intake",
          duration_ms: Date.now() - started,
        })
      }
    },
  }
}

const handlers = createStage3IntakeRouteHandlers({
  enabled: isPersonalPlanAppV1Enabled,
  getUserId: async () => (await (await createClient()).auth.getUser()).data.user?.id ?? null,
  loadJourneyAccess: loadPersonalPlanJourneyAccessForUser,
  checkRateLimit,
  persistence: () => createSupabaseStage3ProductionPersistence(createAdminClient()),
  repository: createSupabaseProductIntakeRepository,
})
export const POST = handlers.POST
