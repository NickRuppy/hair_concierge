import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import {
  canonicalizePersonalPlanAnswers,
  createPersonalPlanClaimCredential,
  hashPersonalPlanAnswers,
  hashPersonalPlanClaimToken,
  normalizePersonalPlanEmail,
  personalPlanLeadRequestSchema,
  personalPlanPrepareRequestSchema,
} from "../src/lib/personal-plan-quiz/persistence"
import { syncPersonalPlanLeadToCustomerIo } from "../src/lib/personal-plan-quiz/customerio"

const request = {
  email: "  PLAN@EXAMPLE.COM ",
  marketingConsent: false,
  preparedPlan: {
    artifactId: "0b670f15-faad-4eb2-a888-4ace59680bb0",
    claimToken: "v2-prepared-plan-claim-token-with-at-least-forty-characters",
  },
  answers: {
    texture: "wavy",
    thickness: "fine",
    density: "medium",
    goals: ["shine", "moisture"],
    routineClarity: "partial",
    resultReliability: "sometimes",
    adaptationConfidence: "partly",
    currentConcerns: ["low_shine", "frizz_flyaways", "breakage", "split_ends"],
    concernRecurrence: { concernId: "breakage", frequency: "often" },
    hairLength: "medium",
    hairSurface: "slightly_uneven",
    elasticResponse: "stretches_stays",
    chemicalTreatments: ["colored"],
    scalpOiliness: "balanced",
    scalpConcerns: [],
    previousAttempts: "some_steps_helped",
    blockers: ["product_fit", "conflicting_tips"],
    routineStyle: "simple_reliable",
    meaningfulMoment: "everyday",
  },
} as const

test("personal-plan persistence accepts only the complete durable envelope and canonically orders selections", () => {
  const parsed = personalPlanLeadRequestSchema.parse(request)
  const envelope = canonicalizePersonalPlanAnswers(parsed.answers)

  assert.equal(normalizePersonalPlanEmail(parsed.email), "plan@example.com")
  assert.deepEqual(envelope, {
    kind: "personal_plan",
    version: 3,
    answers: {
      ...request.answers,
      goals: ["moisture", "shine"],
      currentConcerns: ["breakage", "frizz_flyaways", "low_shine", "split_ends"],
      concernRecurrence: { concernId: "breakage", frequency: "often" },
      blockers: ["conflicting_tips", "product_fit"],
    },
  })
})

test("personal-plan persistence accepts split concerns and binds recurrence to a selected concern", () => {
  assert.equal(
    personalPlanPrepareRequestSchema.safeParse({ answers: request.answers }).success,
    true,
  )
  assert.equal(
    personalPlanPrepareRequestSchema.safeParse({
      answers: {
        ...request.answers,
        concernRecurrence: { concernId: "dry_lengths", frequency: "sometimes" },
      },
    }).success,
    false,
  )
  assert.equal(
    personalPlanPrepareRequestSchema.safeParse({
      answers: {
        ...request.answers,
        currentConcerns: ["breakage_or_split_ends"],
        concernRecurrence: undefined,
      },
    }).success,
    false,
  )
})

test("personal-plan persistence rejects ephemeral commitments and duplicate scalp concerns", () => {
  assert.equal(
    personalPlanLeadRequestSchema.safeParse({
      ...request,
      answers: { ...request.answers, dailyTime: "5_minutes" },
    }).success,
    false,
  )
  assert.equal(
    personalPlanLeadRequestSchema.safeParse({
      ...request,
      answers: { ...request.answers, scalpConcerns: ["irritated", "irritated"] },
    }).success,
    false,
  )
})

test("personal-plan preparation accepts durable answers without contact data or conversion answers", () => {
  assert.equal(
    personalPlanPrepareRequestSchema.safeParse({ answers: request.answers }).success,
    true,
  )
  assert.equal(
    personalPlanPrepareRequestSchema.safeParse({
      answers: { ...request.answers, dailyTime: "5_minutes" },
    }).success,
    false,
  )
  assert.equal(
    personalPlanPrepareRequestSchema.safeParse({
      answers: request.answers,
      email: request.email,
    }).success,
    false,
  )
})

test("personal-plan claim credentials are high entropy and only their hashes are stable", () => {
  const first = createPersonalPlanClaimCredential()
  const second = createPersonalPlanClaimCredential()
  assert.notEqual(first.claimToken, second.claimToken)
  assert.equal(first.claimToken.length >= 40, true)
  assert.equal(first.claimTokenHash, hashPersonalPlanClaimToken(first.claimToken))
  assert.match(first.claimTokenHash, /^[0-9a-f]{64}$/)
  const parsed = personalPlanPrepareRequestSchema.parse({ answers: request.answers })
  assert.match(
    hashPersonalPlanAnswers(canonicalizePersonalPlanAnswers(parsed.answers)),
    /^[0-9a-f]{64}$/,
  )
})

test("personal-plan persistence accepts only a valid optional funnel event ID", () => {
  assert.equal(
    personalPlanLeadRequestSchema.safeParse({
      ...request,
      funnelEventId: "0b670f15-faad-4eb2-a888-4ace59680bb0",
    }).success,
    true,
  )
  assert.equal(
    personalPlanLeadRequestSchema.safeParse({
      ...request,
      funnelEventId: "retry-1",
    }).success,
    false,
  )
})

test("personal-plan lead-kind migration adds the discriminant and lookup index", () => {
  const migration = readFileSync(
    new URL("../supabase/migrations/20260728120000_add_leads_quiz_kind.sql", import.meta.url),
    "utf8",
  )

  assert.match(migration, /ADD COLUMN IF NOT EXISTS quiz_kind/)
  assert.match(migration, /CHECK \(quiz_kind IN \('legacy', 'personal_plan'\)\)/)
  assert.match(migration, /leads_quiz_kind_email_created_at_idx/)
  assert.doesNotMatch(migration, /CREATE OR REPLACE FUNCTION/)
})

test("prepared-plan migration keeps claims server-only and atomically attaches the first artifact", () => {
  const migration = readFileSync(
    new URL(
      "../supabase/migrations/20260728130000_add_personal_plan_prepared_artifacts.sql",
      import.meta.url,
    ),
    "utf8",
  )

  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.personal_plan_prepared_artifacts/)
  assert.match(migration, /claim_token_hash text NOT NULL UNIQUE/)
  assert.match(migration, /ENABLE ROW LEVEL SECURITY/)
  assert.doesNotMatch(migration, /CREATE POLICY/)
  assert.match(
    migration,
    /CREATE OR REPLACE FUNCTION public\.purge_expired_personal_plan_artifacts/,
  )
  assert.match(migration, /FOR UPDATE SKIP LOCKED/)
  assert.match(
    migration,
    /CREATE OR REPLACE FUNCTION public\.save_personal_plan_lead_with_artifact/,
  )
  assert.match(migration, /claimed_artifact\.answer_hash <> p_answer_hash/)
  assert.match(migration, /status = 'superseded'/)
  assert.match(migration, /superseded_by = canonical_artifact_id/)
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.link_personal_plan_artifact_to_user/)
  assert.match(migration, /artifact\.user_id <> p_user_id/)
  assert.match(migration, /REVOKE ALL ON TABLE[\s\S]+PUBLIC, anon, authenticated/)
  assert.match(migration, /GRANT EXECUTE[\s\S]+TO service_role/)
})

test("prepare and lead endpoints exchange only an opaque claim before the result route", () => {
  const prepareRoute = readFileSync(
    new URL("../src/app/api/quiz/personal-plan-prepare/route.ts", import.meta.url),
    "utf8",
  )
  const leadRoute = readFileSync(
    new URL("../src/app/api/quiz/personal-plan-lead/route.ts", import.meta.url),
    "utf8",
  )

  assert.match(prepareRoute, /artifactId: data\.id/)
  assert.match(prepareRoute, /claimToken,/)
  assert.doesNotMatch(prepareRoute, /NextResponse\.json\(\{[\s\S]{0,200}lockedPlan/)
  assert.doesNotMatch(prepareRoute, /NextResponse\.json\(\{[\s\S]{0,200}publicOfferModel/)
  assert.match(leadRoute, /save_personal_plan_lead_with_artifact/)
  assert.match(leadRoute, /hashPersonalPlanClaimToken\(parsed\.preparedPlan\.claimToken\)/)
  assert.match(leadRoute, /resolveBrowserFunnelEventId\(body\)/)
  assert.match(leadRoute, /dispatchCustomerIoProfileSyncForLead\(supabase, leadId\)/)
  assert.doesNotMatch(leadRoute, /syncPersonalPlanLeadToCustomerIo\(/)
  assert.match(leadRoute, /enqueueMetaLead\(\{/)
  assert.match(leadRoute, /META_PERSONAL_PLAN_QUIZ_EVENT_SOURCE_URL/)
  assert.match(leadRoute, /isPreparedPlanClaimError/)
  assert.match(leadRoute, /status: isPreparedPlanClaimError\(error\) \? 409 : 500/)
  assert.doesNotMatch(leadRoute, /NextResponse\.json\(\{[\s\S]{0,200}artifact/)
})

test("lead route rejects definitive deliverability failures before persistence", () => {
  const leadRoute = readFileSync(
    new URL("../src/app/api/quiz/personal-plan-lead/route.ts", import.meta.url),
    "utf8",
  )
  const deliverabilityCheck = leadRoute.indexOf(
    "const deliverability = await checkEmailDeliverability(email)",
  )
  const persistenceCall = leadRoute.indexOf("save_personal_plan_lead_with_artifact")

  assert.ok(deliverabilityCheck >= 0, "lead route must check deliverability")
  assert.ok(
    persistenceCall > deliverabilityCheck,
    "deliverability rejection must happen before the lead is persisted",
  )
  assert.match(
    leadRoute,
    /if \(!deliverability\.ok\) \{[\s\S]*reason: deliverability\.reason,[\s\S]*suggestion: deliverability\.suggestion,[\s\S]*\{ status: 422 \}/,
  )
})

test("personal-plan Customer.io sync identifies the approved structured profile without an event", async () => {
  const originalFetch = globalThis.fetch
  const originalKey = process.env.CUSTOMERIO_SERVER_WRITE_KEY
  const calls: Array<{ url: string; body: Record<string, unknown> }> = []
  process.env.CUSTOMERIO_SERVER_WRITE_KEY = "server-key"
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({
      url: String(url),
      body: JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>,
    })
    return new Response("{}", { status: 200 })
  }) as typeof fetch

  try {
    await syncPersonalPlanLeadToCustomerIo({
      createdAt: "2026-07-28T10:00:00.000Z",
      email: "plan@example.com",
      leadId: "lead-123",
      marketingConsent: false,
      quizAnswers: canonicalizePersonalPlanAnswers(
        personalPlanLeadRequestSchema.parse(request).answers,
      ),
      profileSyncRevision: 1,
      sendCompletionEvent: false,
    })
    assert.equal(calls.length, 1)
    assert.equal(calls[0].url, "https://cdp-eu.customer.io/v1/identify")
    const traits = calls[0].body.traits as Record<string, unknown>
    assert.equal(traits.email, "plan@example.com")
    assert.equal(traits.lead_id, "lead-123")
    assert.equal(traits.quiz_kind, "personal_plan")
    assert.equal(traits.marketing_consent, false)
    assert.equal(traits.personal_plan_profile_version, 3)
    assert.deepEqual(traits.personal_plan_goals, ["moisture", "shine"])
    assert.equal("plan_expires_at" in traits, false)
    assert.equal("blockers_other_text" in traits, false)
  } finally {
    globalThis.fetch = originalFetch
    if (originalKey === undefined) delete process.env.CUSTOMERIO_SERVER_WRITE_KEY
    else process.env.CUSTOMERIO_SERVER_WRITE_KEY = originalKey
  }
})
