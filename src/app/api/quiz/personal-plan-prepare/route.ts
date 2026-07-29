import { NextResponse } from "next/server"

import { isPersonalPlanQuizV1Enabled } from "@/lib/funnel/flags"
import { buildPersonalPlanPreparedArtifact } from "@/lib/personal-plan-quiz/prepared-plan"
import {
  canonicalizePersonalPlanAnswers,
  createPersonalPlanClaimCredential,
  hashPersonalPlanAnswers,
  personalPlanPrepareRequestSchema,
} from "@/lib/personal-plan-quiz/persistence"
import { checkRateLimit, QUIZ_LEAD_RATE_LIMIT } from "@/lib/rate-limit"
import { createAdminClient } from "@/lib/supabase/admin"

const ARTIFACT_TTL_MS = 60 * 60 * 1000

export async function POST(request: Request) {
  if (!isPersonalPlanQuizV1Enabled()) {
    return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 })
  }

  const rateCheck = await checkRateLimit(
    request.headers.get("x-forwarded-for") ?? "unknown",
    QUIZ_LEAD_RATE_LIMIT,
  )
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: "Zu viele Anfragen" },
      { status: rateCheck.error === "service_unavailable" ? 503 : 429 },
    )
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
    const quizAnswers = canonicalizePersonalPlanAnswers(parsed.data.answers)
    const answerHash = hashPersonalPlanAnswers(quizAnswers)
    const prepared = buildPersonalPlanPreparedArtifact(quizAnswers)
    const { claimToken, claimTokenHash } = createPersonalPlanClaimCredential()
    const expiresAt = new Date(Date.now() + ARTIFACT_TTL_MS).toISOString()
    const supabase = createAdminClient()

    const { error: purgeError } = await supabase.rpc("purge_expired_personal_plan_artifacts", {
      p_limit: 100,
    })
    if (purgeError) console.warn("[funnel] personal-plan artifact purge failed", purgeError)

    const { data, error } = await supabase
      .from("personal_plan_prepared_artifacts")
      .insert({
        answer_hash: answerHash,
        canonical_profile: prepared.canonicalProfile,
        claim_token_hash: claimTokenHash,
        diagnostic_scores: prepared.diagnosticScores,
        expires_at: expiresAt,
        fallback_metadata: prepared.fallbackMetadata,
        locked_plan: prepared.lockedPlan,
        priorities: prepared.priorities,
        public_offer_model: prepared.publicOfferModel,
        quiz_answers: quizAnswers,
      })
      .select("id")
      .single()
    if (error) throw error
    if (!data?.id) throw new Error("Personal-plan preparation returned no artifact ID")

    return NextResponse.json({
      artifactId: data.id,
      claimToken,
      status: "ready",
      expiresAt,
    })
  } catch (error) {
    console.error("Personal-plan preparation API error:", error)
    return NextResponse.json({ error: "Plan konnte nicht vorbereitet werden" }, { status: 500 })
  }
}
