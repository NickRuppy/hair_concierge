import assert from "node:assert/strict"
import test from "node:test"

import {
  PERSONAL_PLAN_RESULT_ARTIFACT_CTA_LABEL,
  PERSONAL_PLAN_RESULT_ARTIFACT_MESSAGE_ID,
  PERSONAL_PLAN_RESULT_ARTIFACT_MESSAGE_ID_ENV,
} from "../src/lib/customerio/personal-plan-result-artifact"
import { buildQuizResultArtifactEmailPayload } from "../src/lib/customerio/quiz-result-artifact"
import type { QuizAnswers } from "../src/lib/quiz/types"

const leadId = "550e8400-e29b-41d4-a716-446655440000"
const answers: QuizAnswers = {
  structure: "wavy",
  thickness: "fine",
  density: "medium",
  fingertest: "leicht_uneben",
  pulltest: "stretches_stays",
  scalp_type: "ausgeglichen",
  has_scalp_issue: false,
  concerns: ["frizz", "dryness"],
  treatment: ["gefaerbt"],
  goals: ["less_frizz", "moisture"],
}

function buildPayload(quizAnswers: QuizAnswers = answers) {
  return buildQuizResultArtifactEmailPayload({
    leadId,
    name: "Lea Beispiel",
    email: "lea@example.com",
    quizAnswers,
    siteUrl: "https://chaarlie.de",
  })
}

function restoreMessageIdEnv(previous: string | undefined) {
  if (previous === undefined) delete process.env[PERSONAL_PLAN_RESULT_ARTIFACT_MESSAGE_ID_ENV]
  else process.env[PERSONAL_PLAN_RESULT_ARTIFACT_MESSAGE_ID_ENV] = previous
}

test("uses the personal-plan transactional email without exposing product details", () => {
  const previous = process.env[PERSONAL_PLAN_RESULT_ARTIFACT_MESSAGE_ID_ENV]
  delete process.env[PERSONAL_PLAN_RESULT_ARTIFACT_MESSAGE_ID_ENV]

  try {
    const payload = buildPayload()

    assert.equal(payload.to, "lea@example.com")
    assert.equal(payload.transactionalMessageId, PERSONAL_PLAN_RESULT_ARTIFACT_MESSAGE_ID)
    assert.equal(payload.messageData.lead_id, leadId)
    assert.equal(payload.messageData.profile_line, "Für welliges, feines Haar")
    assert.equal(payload.messageData.cta_label, PERSONAL_PLAN_RESULT_ARTIFACT_CTA_LABEL)
    assert.equal(
      payload.messageData.result_url,
      `https://chaarlie.de/result/${leadId}?entry=result_email&focus=personal_plan_complete_plan#personal_plan_complete_plan`,
    )
    assert.equal(Array.isArray(payload.messageData.diagnostic_rows), true)
    assert.equal("foundation_products" in payload.messageData, false)
    assert.equal("routine_levers" in payload.messageData, false)
    assert.equal("products" in payload.messageData, false)
  } finally {
    restoreMessageIdEnv(previous)
  }
})

test("builds the compact diagnosis from the regular result-page assessment model", () => {
  const payload = buildPayload()
  const rows = payload.messageData.diagnostic_rows as Array<Record<string, unknown>>

  assert.equal(rows.length, 3)
  assert.deepEqual(
    rows.map(({ id, title, today_label }) => ({ id, title, today_label })),
    [
      { id: "surface_frizz", title: "Oberfläche & Frizz", today_label: "viel Potenzial" },
      {
        id: "moisture_softness",
        title: "Feuchtigkeit & Geschmeidigkeit",
        today_label: "viel Potenzial",
      },
      { id: "breakage_stability", title: "Stabilität", today_label: "gute Basis" },
    ],
  )
})

test("projects current and legacy concern ids to the same email diagnosis", () => {
  const current = buildPayload({
    ...answers,
    concerns: ["dry_lengths", "frizz_flyaways"],
    goals: ["frizz_surface", "scalp_balance"],
  })
  const legacy = buildPayload({
    ...answers,
    concerns: ["dryness", "frizz"],
    goals: ["less_frizz", "healthy_scalp"],
  })

  assert.deepEqual(current.messageData.diagnostic_rows, legacy.messageData.diagnostic_rows)
})

test("uses the configured personal-plan transactional message id", () => {
  const previous = process.env[PERSONAL_PLAN_RESULT_ARTIFACT_MESSAGE_ID_ENV]
  process.env[PERSONAL_PLAN_RESULT_ARTIFACT_MESSAGE_ID_ENV] = "42"

  try {
    assert.equal(buildPayload().transactionalMessageId, 42)
  } finally {
    restoreMessageIdEnv(previous)
  }
})

test("never includes free quiz text in the harmonized email", () => {
  const payload = buildPayload({ ...answers, concerns_other_text: "<b>do not send</b>" })

  assert.equal("concerns_other_text" in payload.messageData, false)
  assert.doesNotMatch(JSON.stringify(payload.messageData), /do not send/)
})

test("encodes the lead id in the attributed result URL", () => {
  const payload = buildQuizResultArtifactEmailPayload({
    leadId: "lead/with spaces",
    name: "Lea",
    email: "lea@example.com",
    quizAnswers: answers,
    siteUrl: "https://chaarlie.de",
  })

  assert.equal(
    payload.messageData.result_url,
    "https://chaarlie.de/result/lead%2Fwith%20spaces?entry=result_email&focus=personal_plan_complete_plan#personal_plan_complete_plan",
  )
})
