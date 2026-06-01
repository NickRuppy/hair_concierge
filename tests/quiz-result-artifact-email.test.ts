import assert from "node:assert/strict"
import test from "node:test"

import {
  QUIZ_RESULT_ARTIFACT_CTA_LABEL,
  QUIZ_RESULT_ARTIFACT_MESSAGE_ID,
  buildQuizResultArtifactEmailPayload,
} from "../src/lib/customerio/quiz-result-artifact"
import type { QuizAnswers } from "../src/lib/quiz/types"

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

test("builds Customer.io message data from quiz result narrative", () => {
  const payload = buildQuizResultArtifactEmailPayload({
    leadId: "550e8400-e29b-41d4-a716-446655440000",
    name: "Lea Beispiel",
    email: "lea@example.com",
    quizAnswers: answers,
    siteUrl: "https://chaarlie.de",
  })

  assert.equal(payload.to, "lea@example.com")
  assert.equal(payload.transactionalMessageId, QUIZ_RESULT_ARTIFACT_MESSAGE_ID)
  assert.equal(payload.messageData.lead_id, "550e8400-e29b-41d4-a716-446655440000")
  assert.equal(payload.messageData.first_name, "Lea")
  assert.equal(payload.messageData.cta_label, QUIZ_RESULT_ARTIFACT_CTA_LABEL)
  assert.equal(
    payload.messageData.result_url,
    "https://chaarlie.de/result/550e8400-e29b-41d4-a716-446655440000?focus=routine",
  )
  assert.equal(Array.isArray(payload.messageData.rows), true)
  assert.equal(Array.isArray(payload.messageData.routine_levers), true)
})

test("includes deterministic row and routine lever arrays", () => {
  const payload = buildQuizResultArtifactEmailPayload({
    leadId: "550e8400-e29b-41d4-a716-446655440000",
    name: "Lea Beispiel",
    email: "lea@example.com",
    quizAnswers: answers,
    siteUrl: "https://chaarlie.de/",
  })

  assert.deepEqual(payload.messageData.rows, [
    {
      label: "Haargefühl",
      scope: "HAAR",
      before: "strapazierte Längen",
      after: "spürbar fester",
    },
    {
      label: "Was dich gerade ausbremst",
      scope: "LÄNGEN",
      before: "Trockenheit",
      after: "weichere, geschmeidige Längen",
    },
    {
      label: "Worauf wir hinarbeiten",
      scope: "LÄNGEN",
      before: "wenig Feuchtigkeit",
      after: "mehr Elastizität & Geschmeidigkeit",
    },
  ])
  assert.deepEqual(payload.messageData.routine_levers, [
    {
      name: "Bondbuilder",
      description: "Stabilisiert die Längen von innen.",
    },
    { name: "Stärkende Maske", description: "Macht die Längen wieder belastbar." },
  ])
})

test("sanitizes first name and never includes raw free text", () => {
  const payload = buildQuizResultArtifactEmailPayload({
    leadId: "550e8400-e29b-41d4-a716-446655440000",
    name: "<script>Lea</script> Danger",
    email: "lea@example.com",
    quizAnswers: { ...answers, concerns_other_text: "<b>raw</b>" },
    siteUrl: "https://chaarlie.de",
  })

  assert.equal(payload.messageData.first_name, "scriptLeascript")
  assert.equal("concerns_other_text" in payload.messageData, false)
  assert.doesNotMatch(JSON.stringify(payload.messageData), /raw/)
})

test("limits sanitized first name to 60 characters", () => {
  const payload = buildQuizResultArtifactEmailPayload({
    leadId: "550e8400-e29b-41d4-a716-446655440000",
    name: `${"A".repeat(80)} Beispiel`,
    email: "lea@example.com",
    quizAnswers: answers,
    siteUrl: "https://chaarlie.de",
  })

  assert.equal(String(payload.messageData.first_name).length, 60)
})
