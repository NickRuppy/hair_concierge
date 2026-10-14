import { randomUUID } from "node:crypto"
import { cookies } from "next/headers"
import { FUNNEL_SESSION_COOKIE } from "@/lib/funnel/cookie"
import { resolveFunnelCookieContext } from "@/lib/funnel/server"
import { resolveModeratorJourney } from "@/lib/personal-plan-field-test/moderator-journey"
import { NextResponse } from "next/server"

import { isPersonalPlanQuizV1Enabled } from "@/lib/funnel/flags"
import { buildPersonalPlanPreparedArtifact } from "@/lib/personal-plan-quiz/prepared-plan"
import {
  canonicalizePersonalPlanAnswers,
  createPersonalPlanClaimCredential,
  hashPersonalPlanAnswers,
  hashPersonalPlanClaimToken,
  personalPlanPrepareRequestSchema,
} from "@/lib/personal-plan-quiz/persistence"
import {
  checkRateLimit,
  fixedWindowRetryAfterSeconds,
  PERSONAL_PLAN_PREPARE_IP_RATE_LIMIT,
  PERSONAL_PLAN_PREPARE_JOURNEY_RATE_LIMIT,
  type RateLimitConfig,
} from "@/lib/rate-limit"
import {
  decodePersonalPlanQuizDraftCookie,
  PERSONAL_PLAN_QUIZ_DRAFT_COOKIE,
} from "@/lib/personal-plan-quiz/server-draft"
import { createAdminClient } from "@/lib/supabase/admin"

const ARTIFACT_TTL_MS = 60 * 60 * 1000

export type PersonalPlanPrepareRouteContext =
  | { status: "unavailable" }
  | { status: "ready"; userId: string | null; journeyRateLimitId: string | null }

export type PersonalPlanPrepareArtifactInput = {
  preparationId: string
  answerHash: string
  claimTokenHash: string
  quizAnswers: ReturnType<typeof canonicalizePersonalPlanAnswers>
  prepared: ReturnType<typeof buildPersonalPlanPreparedArtifact>
  userId: string | null
  expiresAt: string
}

export type PersonalPlanPrepareRouteDeps = {
  enabled: () => boolean
  checkRateLimit: typeof checkRateLimit
  retryAfterSeconds: (config: RateLimitConfig) => number
  resolveContext: (request: Request) => Promise<PersonalPlanPrepareRouteContext>
  createLegacyCredential: () => {
    preparationId: string
    claimToken: string
    claimTokenHash: string
  }
  prepareArtifact: (
    input: PersonalPlanPrepareArtifactInput,
  ) => Promise<{ artifactId: string; expiresAt: string; replayed: boolean }>
  now: () => number
  warnRateLimited: (scope: "ip" | "journey") => void
}

export class PersonalPlanPrepareConflictError extends Error {}

export type PersonalPlanPrepareRpc = (
  name: string,
  args: Record<string, unknown>,
) => PromiseLike<{ data: unknown; error: { code?: string } | null }>

function requestIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
}

function rejectedRateLimitResponse(
  result: Awaited<ReturnType<typeof checkRateLimit>>,
  config: RateLimitConfig,
  deps: Pick<PersonalPlanPrepareRouteDeps, "retryAfterSeconds" | "warnRateLimited">,
  scope: "ip" | "journey",
) {
  const unavailable = result.error === "service_unavailable"
  if (!unavailable) deps.warnRateLimited(scope)
  return NextResponse.json(
    { error: unavailable ? "service_unavailable" : "rate_limited" },
    {
      status: unavailable ? 503 : 429,
      headers: unavailable ? undefined : { "Retry-After": String(deps.retryAfterSeconds(config)) },
    },
  )
}

export function createPersonalPlanPreparePostHandler(deps: PersonalPlanPrepareRouteDeps) {
  return async function personalPlanPreparePost(request: Request) {
    if (!deps.enabled()) {
      return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 })
    }

    const ipRate = await deps.checkRateLimit(
      requestIp(request),
      PERSONAL_PLAN_PREPARE_IP_RATE_LIMIT,
    )
    if (!ipRate.allowed) {
      return rejectedRateLimitResponse(ipRate, PERSONAL_PLAN_PREPARE_IP_RATE_LIMIT, deps, "ip")
    }

    let context: PersonalPlanPrepareRouteContext
    try {
      context = await deps.resolveContext(request)
    } catch (error) {
      console.error("Personal-plan preparation context error:", error)
      return NextResponse.json({ error: "Plan konnte nicht vorbereitet werden" }, { status: 500 })
    }
    if (context.status === "unavailable") {
      return NextResponse.json(
        { error: "Dein Zugang kann gerade nicht geprüft werden. Bitte versuche es erneut." },
        { status: 503 },
      )
    }
    if (context.journeyRateLimitId) {
      const journeyRate = await deps.checkRateLimit(
        context.journeyRateLimitId,
        PERSONAL_PLAN_PREPARE_JOURNEY_RATE_LIMIT,
      )
      if (!journeyRate.allowed) {
        return rejectedRateLimitResponse(
          journeyRate,
          PERSONAL_PLAN_PREPARE_JOURNEY_RATE_LIMIT,
          deps,
          "journey",
        )
      }
    }

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Ungueltige Daten" }, { status: 400 })
    }
    const parsed = personalPlanPrepareRequestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Ungueltige Daten" }, { status: 400 })
    }

    try {
      const credential =
        parsed.data.preparationId && parsed.data.claimToken
          ? {
              preparationId: parsed.data.preparationId,
              claimToken: parsed.data.claimToken,
              claimTokenHash: hashPersonalPlanClaimToken(parsed.data.claimToken),
            }
          : deps.createLegacyCredential()
      const quizAnswers = canonicalizePersonalPlanAnswers(parsed.data.answers)
      const answerHash = hashPersonalPlanAnswers(quizAnswers)
      const prepared = buildPersonalPlanPreparedArtifact(quizAnswers)
      const expiresAt = new Date(deps.now() + ARTIFACT_TTL_MS).toISOString()
      const result = await deps.prepareArtifact({
        preparationId: credential.preparationId,
        answerHash,
        claimTokenHash: credential.claimTokenHash,
        quizAnswers,
        prepared,
        userId: context.userId,
        expiresAt,
      })

      return NextResponse.json({
        artifactId: result.artifactId,
        claimToken: credential.claimToken,
        status: "ready",
        expiresAt: result.expiresAt,
      })
    } catch (error) {
      if (error instanceof PersonalPlanPrepareConflictError) {
        return NextResponse.json({ error: "preparation_conflict" }, { status: 409 })
      }
      console.error("Personal-plan preparation API error:", error)
      return NextResponse.json({ error: "Plan konnte nicht vorbereitet werden" }, { status: 500 })
    }
  }
}

async function resolvePersonalPlanPrepareContext(): Promise<PersonalPlanPrepareRouteContext> {
  const cookieStore = await cookies()
  const funnelContext = await resolveFunnelCookieContext(
    cookieStore.get(FUNNEL_SESSION_COOKIE)?.value,
  )
  const moderator = await resolveModeratorJourney({
    cookies: cookieStore,
    funnelContext,
  })
  if (moderator.kind === "unavailable") return { status: "unavailable" }
  if (moderator.kind === "authorized") {
    return {
      status: "ready",
      userId: moderator.userId,
      journeyRateLimitId: `user:${moderator.userId}`,
    }
  }
  const draft = decodePersonalPlanQuizDraftCookie(
    cookieStore.get(PERSONAL_PLAN_QUIZ_DRAFT_COOKIE)?.value,
  )
  return {
    status: "ready",
    userId: null,
    journeyRateLimitId: draft
      ? `draft:${draft.draftId}`
      : funnelContext
        ? `session:${funnelContext.sessionId}`
        : null,
  }
}

export async function persistPersonalPlanPreparedArtifact(
  input: PersonalPlanPrepareArtifactInput,
  rpc?: PersonalPlanPrepareRpc,
): Promise<{ artifactId: string; expiresAt: string; replayed: boolean }> {
  const supabase = rpc ? null : createAdminClient()
  const callRpc: PersonalPlanPrepareRpc =
    rpc ?? ((name, args) => supabase!.rpc(name, args) as ReturnType<PersonalPlanPrepareRpc>)

  const { data, error } = await callRpc("prepare_personal_plan_artifact", {
    p_id: input.preparationId,
    p_answer_hash: input.answerHash,
    p_claim_token_hash: input.claimTokenHash,
    p_quiz_answers: input.quizAnswers,
    p_canonical_profile: input.prepared.canonicalProfile,
    p_fallback_metadata: input.prepared.fallbackMetadata,
    p_priorities: input.prepared.priorities,
    p_diagnostic_scores: input.prepared.diagnosticScores,
    p_public_offer_model: input.prepared.publicOfferModel,
    p_locked_plan: input.prepared.lockedPlan,
    p_user_id: input.userId,
    p_expires_at: input.expiresAt,
  })
  if (error) {
    if (error.code && ["22023", "23505"].includes(error.code)) {
      throw new PersonalPlanPrepareConflictError()
    }
    throw error
  }
  if (!Array.isArray(data) || data.length !== 1) {
    throw new Error("Personal-plan preparation returned no artifact receipt")
  }
  const receipt = data[0] as Record<string, unknown>
  if (
    typeof receipt.artifact_id !== "string" ||
    typeof receipt.artifact_expires_at !== "string" ||
    typeof receipt.replayed !== "boolean"
  ) {
    throw new Error("Personal-plan preparation returned an invalid artifact receipt")
  }
  if (!receipt.replayed) {
    const { error: purgeError } = await callRpc("purge_expired_personal_plan_artifacts", {
      p_limit: 100,
    })
    if (purgeError) console.warn("[funnel] personal-plan artifact purge failed", purgeError)
  }
  return {
    artifactId: receipt.artifact_id,
    expiresAt: receipt.artifact_expires_at,
    replayed: receipt.replayed,
  }
}

export const POST = createPersonalPlanPreparePostHandler({
  enabled: isPersonalPlanQuizV1Enabled,
  checkRateLimit,
  retryAfterSeconds: fixedWindowRetryAfterSeconds,
  resolveContext: resolvePersonalPlanPrepareContext,
  createLegacyCredential: () => {
    const credential = createPersonalPlanClaimCredential()
    return { preparationId: randomUUID(), ...credential }
  },
  prepareArtifact: persistPersonalPlanPreparedArtifact,
  now: Date.now,
  warnRateLimited: (scope) =>
    console.warn("[funnel] personal-plan preparation rate limited", { scope }),
})
