import assert from "node:assert/strict"
import test from "node:test"
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
