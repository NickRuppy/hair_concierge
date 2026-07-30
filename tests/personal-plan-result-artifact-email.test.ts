import assert from "node:assert/strict"
import test from "node:test"

import {
  PERSONAL_PLAN_RESULT_ARTIFACT_MESSAGE_ID,
  PERSONAL_PLAN_RESULT_ARTIFACT_MESSAGE_ID_ENV,
  buildPersonalPlanResultArtifactEmailPayload,
} from "../src/lib/customerio/personal-plan-result-artifact"
import {
  handlePersonalPlanResultArtifactEmail,
  type PersonalPlanResultArtifactStore,
} from "../src/lib/customerio/personal-plan-result-artifact-service"
import {
  buildPersonalPlanPreparedArtifact,
  type PersonalPlanPreparedArtifact,
} from "../src/lib/personal-plan-quiz/prepared-plan"
import {
  canonicalizePersonalPlanAnswers,
  type PersonalPlanPrepareRequest,
} from "../src/lib/personal-plan-quiz/persistence"

const leadId = "550e8400-e29b-41d4-a716-446655440000"
const answers: PersonalPlanPrepareRequest["answers"] = {
  texture: "wavy",
  thickness: "fine",
  density: "low",
  goals: ["frizz_surface", "shape_definition", "moisture"],
  routineClarity: "trial_and_error",
  resultReliability: "rarely",
  adaptationConfidence: "no",
  currentConcerns: ["frizz_flyaways", "lost_shape", "dry_dull_lengths"],
  hairLength: "long",
  hairSurface: "rough",
  elasticResponse: "stretches_bounces",
  chemicalTreatments: ["natural"],
  scalpOiliness: "balanced",
  scalpConcerns: [],
  previousAttempts: "nothing_reliably_worked",
  blockers: ["product_fit"],
  routineStyle: "simple_reliable",
  meaningfulMoment: "everyday",
}

function prepared(): PersonalPlanPreparedArtifact {
  return buildPersonalPlanPreparedArtifact(canonicalizePersonalPlanAnswers(answers))
}

function restoreEnv(previous: string | undefined) {
  if (previous === undefined) delete process.env[PERSONAL_PLAN_RESULT_ARTIFACT_MESSAGE_ID_ENV]
  else process.env[PERSONAL_PLAN_RESULT_ARTIFACT_MESSAGE_ID_ENV] = previous
}

test("builds the hard-paywall payload from only the stored public analysis", () => {
  const previous = process.env[PERSONAL_PLAN_RESULT_ARTIFACT_MESSAGE_ID_ENV]
  delete process.env[PERSONAL_PLAN_RESULT_ARTIFACT_MESSAGE_ID_ENV]
  try {
    const artifact = prepared()
    const payload = buildPersonalPlanResultArtifactEmailPayload({
      email: "mia@example.com",
      leadId,
      priorities: artifact.priorities,
      publicOfferModel: artifact.publicOfferModel,
      siteUrl: "https://chaarlie.de",
    })

    assert.equal(payload.to, "mia@example.com")
    assert.equal(payload.transactionalMessageId, PERSONAL_PLAN_RESULT_ARTIFACT_MESSAGE_ID)
    assert.equal(payload.messageData.lead_id, leadId)
    assert.equal(
      payload.messageData.comparison_image_url,
      "https://chaarlie.de/images/emails/personal-plan-before-after.jpg",
    )
    assert.equal(
      payload.messageData.result_url,
      `https://chaarlie.de/result/${leadId}?entry=result_email#pricing`,
    )
    assert.deepEqual(payload.messageData.primary_message, artifact.publicOfferModel.primaryMessage)
    assert.deepEqual(
      payload.messageData.diagnostic_rows,
      artifact.publicOfferModel.diagnosticRows.map((row) => ({
        id: row.id,
        title: row.title,
        today_label: row.todayLabel,
        summary: row.summary,
      })),
    )
    const serialized = JSON.stringify(payload.messageData)
    assert.doesNotMatch(serialized, /locked_plan|products|routine|frequency|diagnostic_scores/i)
  } finally {
    restoreEnv(previous)
  }
})

test("derives a controlled primary message for compatible stored artifacts", () => {
  const artifact = prepared()
  const legacyModel = structuredClone(artifact.publicOfferModel) as Record<string, unknown>
  delete legacyModel.primaryMessage

  const payload = buildPersonalPlanResultArtifactEmailPayload({
    email: "mia@example.com",
    leadId,
    priorities: artifact.priorities,
    publicOfferModel: legacyModel,
    siteUrl: "https://chaarlie.de",
  })

  assert.equal(
    (payload.messageData.primary_message as { label: string }).label,
    artifact.publicOfferModel.primaryMessage.label,
  )
})

test("rejects a corrupted compatibility artifact whose central priority differs from row one", () => {
  const artifact = prepared()
  const legacyModel = structuredClone(artifact.publicOfferModel) as Record<string, unknown>
  delete legacyModel.primaryMessage
  const priorities = structuredClone(artifact.priorities)
  priorities[0].family = priorities[1].family

  assert.throws(
    () =>
      buildPersonalPlanResultArtifactEmailPayload({
        email: "mia@example.com",
        leadId,
        priorities,
        publicOfferModel: legacyModel,
        siteUrl: "https://chaarlie.de",
      }),
    /central priority does not match diagnostic row one/,
  )
})

test("supports a numeric personal-plan transactional message id", () => {
  const previous = process.env[PERSONAL_PLAN_RESULT_ARTIFACT_MESSAGE_ID_ENV]
  process.env[PERSONAL_PLAN_RESULT_ARTIFACT_MESSAGE_ID_ENV] = "42"
  try {
    const artifact = prepared()
    const payload = buildPersonalPlanResultArtifactEmailPayload({
      email: "mia@example.com",
      leadId,
      priorities: artifact.priorities,
      publicOfferModel: artifact.publicOfferModel,
      siteUrl: "https://chaarlie.de",
    })
    assert.equal(payload.transactionalMessageId, 42)
  } finally {
    restoreEnv(previous)
  }
})

function createStore(artifact = prepared()): PersonalPlanResultArtifactStore & {
  sent: string[]
  failed: Array<{ leadId: string; error: string }>
} {
  let claimed = false
  const sent: string[] = []
  const failed: Array<{ leadId: string; error: string }> = []
  return {
    sent,
    failed,
    async claimLead(id) {
      if (claimed || id !== leadId) return null
      claimed = true
      return {
        id: leadId,
        quiz_kind: "personal_plan",
        email: "mia@example.com",
        artifact_email_status: "sending",
      }
    },
    async loadAttachedArtifact(id) {
      if (id !== leadId) return null
      return {
        priorities: artifact.priorities,
        public_offer_model: artifact.publicOfferModel,
      }
    },
    async markSent(id) {
      sent.push(id)
    },
    async markFailed(id, error) {
      failed.push({ leadId: id, error })
    },
  }
}

test("claims and sends the personal-plan email only once", async () => {
  const store = createStore()
  const sends: unknown[] = []
  const input = {
    leadId,
    siteUrl: "https://chaarlie.de",
    store,
    send: async (payload: unknown) => {
      sends.push(payload)
    },
  }
  const [first, second] = await Promise.all([
    handlePersonalPlanResultArtifactEmail(input),
    handlePersonalPlanResultArtifactEmail(input),
  ])

  assert.deepEqual(
    [first, second],
    [
      { sent: true, skipped: false },
      { sent: false, skipped: true },
    ],
  )
  assert.equal(sends.length, 1)
  assert.deepEqual(store.sent, [leadId])
  assert.deepEqual(store.failed, [])
})

test("marks a sanitized failure without throwing into the result journey", async () => {
  const store = createStore()
  const result = await handlePersonalPlanResultArtifactEmail({
    leadId,
    siteUrl: "https://chaarlie.de",
    store,
    send: async () => {
      throw new Error("Bearer secret-token-this-must-not-persist")
    },
  })

  assert.deepEqual(result, { sent: false, skipped: false })
  assert.equal(store.failed.length, 1)
  assert.doesNotMatch(store.failed[0].error, /secret-token/)
  assert.match(store.failed[0].error, /\[redacted\]/)
})
