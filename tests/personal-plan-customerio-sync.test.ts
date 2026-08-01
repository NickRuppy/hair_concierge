import assert from "node:assert/strict"
import test from "node:test"

import {
  buildPersonalPlanCustomerIoTraits,
  syncPersonalPlanLeadToCustomerIo,
} from "../src/lib/personal-plan-quiz/customerio"
import type { PersonalPlanQuizSubmissionEnvelope } from "../src/lib/personal-plan-quiz/types"

const quizAnswers: PersonalPlanQuizSubmissionEnvelope = {
  kind: "personal_plan",
  version: 2,
  answers: {
    texture: "wavy",
    thickness: "fine",
    density: "medium",
    goals: ["moisture", "shine"],
    routineClarity: "partial",
    resultReliability: "sometimes",
    adaptationConfidence: "partly",
    currentConcerns: ["dry_dull_lengths", "frizz_flyaways"],
    hairLength: "medium",
    hairSurface: "slightly_uneven",
    elasticResponse: "stretches_stays",
    chemicalTreatments: ["colored"],
    scalpOiliness: "balanced",
    scalpConcerns: ["dry_dandruff", "irritated"],
    previousAttempts: "some_steps_helped",
    blockers: ["other", "product_fit"],
    blockersOtherText: "Bitte nicht an Customer.io senden",
    routineStyle: "simple_reliable",
    meaningfulMoment: "everyday",
  },
}

test("personal-plan traits keep shared primitives canonical and namespace divergent answers", () => {
  const traits = buildPersonalPlanCustomerIoTraits({
    createdAt: "2026-08-01T10:00:00.000Z",
    email: "plan@example.com",
    leadId: "lead-123",
    marketingConsent: true,
    quizAnswers,
    funnelSessionId: "session-123",
    funnelPackageKey: "meta_personal_plan_v1",
  })

  assert.equal(traits.personal_plan_profile_version, 2)
  assert.equal(traits.hair_texture, "wavy")
  assert.equal(traits.thickness, "fine")
  assert.equal(traits.density, "medium")
  assert.equal(traits.hair_length, "medium")
  assert.equal(traits.protein_moisture_balance, "stretches_stays")
  assert.deepEqual(traits.personal_plan_scalp_concerns, ["dry_dandruff", "irritated"])
  assert.deepEqual(traits.personal_plan_scalp_concern_labels, [
    "Trockene Schuppen",
    "Gereizte Kopfhaut",
  ])
  assert.deepEqual(traits.personal_plan_chemical_treatments, ["colored"])
  assert.deepEqual(traits.personal_plan_concerns, ["dry_dull_lengths", "frizz_flyaways"])
  assert.deepEqual(traits.personal_plan_goals, ["moisture", "shine"])
  assert.equal(traits.funnel_session_id, "session-123")
  assert.equal(traits.funnel_package_key, "meta_personal_plan_v1")

  assert.equal("scalp_condition" in traits, false)
  assert.equal("chemical_treatment" in traits, false)
  assert.equal("concerns" in traits, false)
  assert.equal("goals" in traits, false)
  assert.equal("blockers_other_text" in traits, false)
  assert.equal("plan_id" in traits, false)
  assert.equal("plan_expires_at" in traits, false)
})

test("personal-plan live sync identifies first and emits one dedicated stable completion event", async () => {
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
    const result = await syncPersonalPlanLeadToCustomerIo({
      createdAt: "2026-08-01T10:00:00.000Z",
      email: "plan@example.com",
      leadId: "lead-123",
      marketingConsent: true,
      quizAnswers,
      funnelSessionId: "session-123",
      funnelPackageKey: "meta_personal_plan_v1",
      profileSyncRevision: 3,
      sendCompletionEvent: true,
    })

    assert.equal(result.identify.ok, true)
    assert.equal(result.completionEvent?.ok, true)
    assert.equal(calls.length, 2)
    assert.equal(calls[0].url, "https://cdp-eu.customer.io/v1/identify")
    assert.equal(calls[0].body.messageId, "identify:personal_plan_lead:lead-123:3")
    assert.equal(calls[1].url, "https://cdp-eu.customer.io/v1/track")
    assert.equal(calls[1].body.event, "personal_plan_profile_submitted")
    assert.equal(calls[1].body.messageId, "personal_plan_profile_submitted:lead-123")
    assert.deepEqual(calls[1].body.properties, {
      source: "personal_plan_lead_api",
      lead_id: "lead-123",
      funnel_session_id: "session-123",
      funnel_package_key: "meta_personal_plan_v1",
      marketing_consent: true,
    })
  } finally {
    globalThis.fetch = originalFetch
    if (originalKey === undefined) delete process.env.CUSTOMERIO_SERVER_WRITE_KEY
    else process.env.CUSTOMERIO_SERVER_WRITE_KEY = originalKey
  }
})

test("personal-plan profile-only sync cannot emit a completion event", async () => {
  const originalFetch = globalThis.fetch
  const originalKey = process.env.CUSTOMERIO_SERVER_WRITE_KEY
  const calls: string[] = []
  process.env.CUSTOMERIO_SERVER_WRITE_KEY = "server-key"
  globalThis.fetch = (async (url: string | URL | Request) => {
    calls.push(String(url))
    return new Response("{}", { status: 200 })
  }) as typeof fetch

  try {
    const result = await syncPersonalPlanLeadToCustomerIo({
      createdAt: "2026-08-01T10:00:00.000Z",
      email: "historical@example.com",
      leadId: "lead-old",
      marketingConsent: true,
      quizAnswers,
      profileSyncRevision: 1,
      sendCompletionEvent: false,
    })

    assert.equal(result.identify.ok, true)
    assert.equal(result.completionEvent, undefined)
    assert.deepEqual(calls, ["https://cdp-eu.customer.io/v1/identify"])
  } finally {
    globalThis.fetch = originalFetch
    if (originalKey === undefined) delete process.env.CUSTOMERIO_SERVER_WRITE_KEY
    else process.env.CUSTOMERIO_SERVER_WRITE_KEY = originalKey
  }
})

test("personal-plan sync does not emit the completion event when identify failed", async () => {
  const originalFetch = globalThis.fetch
  const originalKey = process.env.CUSTOMERIO_SERVER_WRITE_KEY
  let calls = 0
  process.env.CUSTOMERIO_SERVER_WRITE_KEY = "server-key"
  globalThis.fetch = (async () => {
    calls += 1
    return new Response("down", { status: 503 })
  }) as typeof fetch

  try {
    const result = await syncPersonalPlanLeadToCustomerIo({
      createdAt: "2026-08-01T10:00:00.000Z",
      email: "plan@example.com",
      leadId: "lead-123",
      marketingConsent: true,
      quizAnswers,
      profileSyncRevision: 3,
      sendCompletionEvent: true,
    })

    assert.equal(result.identify.ok, false)
    assert.equal(result.completionEvent, undefined)
    assert.equal(calls, 1)
  } finally {
    globalThis.fetch = originalFetch
    if (originalKey === undefined) delete process.env.CUSTOMERIO_SERVER_WRITE_KEY
    else process.env.CUSTOMERIO_SERVER_WRITE_KEY = originalKey
  }
})
