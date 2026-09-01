import { NextResponse } from "next/server"
import { z } from "zod"

import {
  canAccessPersonalPlanJourneyStage,
  type PersonalPlanJourneyAccess,
} from "@/lib/personal-plan/journey-access"
import { loadPersonalPlanJourneyAccessForUser } from "@/lib/personal-plan/journey-access-loader"
import { Stage3AuthoritySnapshotError } from "@/lib/personal-plan/products/authority/snapshot"
import type { Stage3DraftResponse } from "@/lib/personal-plan/products/gateway"
import { openSupabaseStage3OptionalInventory } from "@/lib/personal-plan/products/stage3-persistence-supabase"
import { composeStage3BootstrapResponse } from "@/lib/personal-plan/products/stage3-bootstrap-response-server"
import { isPersonalPlanAppV1Enabled } from "@/lib/personal-plan/release"
import {
  checkRateLimit,
  fixedWindowRetryAfterSeconds,
  type RateLimitConfig,
} from "@/lib/rate-limit"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

const STAGE3_OPTIONAL_ENTRY_RATE_LIMIT: RateLimitConfig = {
  prefix: "personal-plan-stage3-optional-entry",
  limit: 30,
  windowMs: 60_000,
}

const requestSchema = z
  .object({
    personalPlanId: z.string().uuid(),
    refinedVersionId: z.string().uuid(),
  })
  .strict()

export type Stage3OptionalEntryRouteDeps = {
  enabled: () => boolean
  getUserId: () => Promise<string | null>
  loadJourneyAccess: (userId: string) => Promise<PersonalPlanJourneyAccess>
  checkRateLimit: (
    identifier: string,
    config: RateLimitConfig,
  ) => Promise<{ allowed: boolean; error?: string }>
  openOptionalInventory: (input: {
    userId: string
    personalPlanId: string
    refinedVersionId: string
  }) => Promise<Stage3DraftResponse>
}

function response(body: unknown, status = 200, headers?: HeadersInit) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } })
}

function serverTiming(phases: Record<string, number>) {
  return Object.entries(phases)
    .map(([name, duration]) => `${name};dur=${Math.max(0, Math.round(duration * 100) / 100)}`)
    .join(", ")
}

export function createStage3OptionalEntryRouteHandler(deps: Stage3OptionalEntryRouteDeps) {
  return async function POST(request: Request) {
    const phases: Record<string, number> = {}
    if (!deps.enabled()) return response({ error: "personal_plan_not_available" }, 404)

    let phaseStarted = Date.now()
    const userId = await deps.getUserId()
    phases.auth = Date.now() - phaseStarted
    if (!userId) return response({ error: "unauthorized" }, 401)

    try {
      phaseStarted = Date.now()
      if (!canAccessPersonalPlanJourneyStage(await deps.loadJourneyAccess(userId), "stage3")) {
        phases.journey = Date.now() - phaseStarted
        return response({ error: "stage_not_ready" }, 409, {
          "Server-Timing": serverTiming(phases),
        })
      }
      phases.journey = Date.now() - phaseStarted
    } catch {
      phases.journey = Date.now() - phaseStarted
      return response({ error: "temporarily_unavailable" }, 503, {
        "Server-Timing": serverTiming(phases),
      })
    }

    const parsed = requestSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return response({ error: "invalid_request" }, 400)

    phaseStarted = Date.now()
    const limited = await deps.checkRateLimit(userId, STAGE3_OPTIONAL_ENTRY_RATE_LIMIT)
    phases.rate_limit = Date.now() - phaseStarted
    if (!limited.allowed) {
      const unavailable = limited.error === "service_unavailable"
      return response(
        { error: unavailable ? "temporarily_unavailable" : "rate_limited" },
        unavailable ? 503 : 429,
        {
          ...(unavailable
            ? {}
            : {
                "Retry-After": String(
                  fixedWindowRetryAfterSeconds(STAGE3_OPTIONAL_ENTRY_RATE_LIMIT),
                ),
              }),
          "Server-Timing": serverTiming(phases),
        },
      )
    }

    try {
      phaseStarted = Date.now()
      const result = await deps.openOptionalInventory({
        userId,
        personalPlanId: parsed.data.personalPlanId,
        refinedVersionId: parsed.data.refinedVersionId,
      })
      phases.operation = Date.now() - phaseStarted
      return response(await composeStage3BootstrapResponse({ loaded: result }), 200, {
        "Server-Timing": serverTiming(phases),
      })
    } catch (error) {
      if (error instanceof Stage3AuthoritySnapshotError) {
        return response({ error: error.code }, 409, { "Server-Timing": serverTiming(phases) })
      }
      return response({ error: "temporarily_unavailable" }, 503, {
        "Server-Timing": serverTiming(phases),
      })
    }
  }
}

export const POST = createStage3OptionalEntryRouteHandler({
  enabled: isPersonalPlanAppV1Enabled,
  getUserId: async () => (await (await createClient()).auth.getUser()).data.user?.id ?? null,
  loadJourneyAccess: loadPersonalPlanJourneyAccessForUser,
  checkRateLimit,
  openOptionalInventory: ({ userId, personalPlanId, refinedVersionId }) =>
    openSupabaseStage3OptionalInventory(createAdminClient(), {
      userId,
      personalPlanId,
      refinedVersionId,
    }),
})

export const maxDuration = 60
