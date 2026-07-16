import assert from "node:assert/strict"
import test from "node:test"

import {
  QUIZ_RESULT_ARTIFACT_CTA_LABEL,
  QUIZ_RESULT_ARTIFACT_MESSAGE_ID,
  QUIZ_RESULT_ARTIFACT_MESSAGE_ID_ENV,
  buildQuizResultArtifactEmailPayload,
} from "../src/lib/customerio/quiz-result-artifact"
import {
  APP_VALUE_STACK_CTA_LABEL,
  APP_VALUE_STACK_STORIES,
  buildAppValueStackHeroCopy,
} from "../src/lib/quiz/app-value-stack-copy"
import { buildQuizOfferPreview } from "../src/lib/quiz/offer-preview"
import { buildQuizResultNarrative } from "../src/lib/quiz/result-narrative"
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

function restoreMessageIdEnv(previous: string | undefined) {
  if (previous === undefined) {
    delete process.env[QUIZ_RESULT_ARTIFACT_MESSAGE_ID_ENV]
    return
  }

  process.env[QUIZ_RESULT_ARTIFACT_MESSAGE_ID_ENV] = previous
}

test("builds Customer.io message data from the shared offer-page content", () => {
  const previousMessageId = process.env[QUIZ_RESULT_ARTIFACT_MESSAGE_ID_ENV]
  delete process.env[QUIZ_RESULT_ARTIFACT_MESSAGE_ID_ENV]

  try {
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
    assert.equal(payload.messageData.cta_label, APP_VALUE_STACK_CTA_LABEL)
    assert.equal(
      payload.messageData.result_url,
      "https://chaarlie.de/result/550e8400-e29b-41d4-a716-446655440000?focus=unlock-plan&entry=result_email",
    )

    const narrative = buildQuizResultNarrative(answers)
    const preview = buildQuizOfferPreview(answers)
    const hero = buildAppValueStackHeroCopy({ name: "Lea", narrative, lane: preview.lane })
    const foundationProducts = preview.products.filter((product) => !product.suggested)

    assert.equal(payload.messageData.headline, hero.headline)
    assert.equal(payload.messageData.intro, hero.intro)
    assert.deepEqual(payload.messageData.signals, preview.signals)
    assert.deepEqual(
      payload.messageData.foundation_products,
      foundationProducts.map((product) => ({
        category_label: product.categoryLabel,
        name: product.name,
        note: product.note,
        image_url: product.imageUrl,
        cadence_label: product.cadence.label,
        cadence_qualifier: product.cadence.qualifier ?? "",
      })),
    )
    assert.equal(foundationProducts.length, 2)
    assert.equal((payload.messageData.foundation_products as unknown[]).length, 2)
    assert.deepEqual(
      payload.messageData.app_stories,
      APP_VALUE_STACK_STORIES.map(({ label, headline, body }) => ({ label, headline, body })),
    )
    assert.equal(Array.isArray(payload.messageData.rows), true)
    assert.equal(Array.isArray(payload.messageData.routine_levers), true)
  } finally {
    restoreMessageIdEnv(previousMessageId)
  }
})

test("supports numeric Customer.io transactional message id override", () => {
  const previousMessageId = process.env[QUIZ_RESULT_ARTIFACT_MESSAGE_ID_ENV]
  process.env[QUIZ_RESULT_ARTIFACT_MESSAGE_ID_ENV] = "7"

  try {
    const payload = buildQuizResultArtifactEmailPayload({
      leadId: "550e8400-e29b-41d4-a716-446655440000",
      name: "Lea Beispiel",
      email: "lea@example.com",
      quizAnswers: answers,
      siteUrl: "https://chaarlie.de",
    })

    assert.equal(payload.transactionalMessageId, 7)
  } finally {
    restoreMessageIdEnv(previousMessageId)
  }
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
  assert.match(String(payload.messageData.headline), /^scriptLeascript, dein 4-Wochen-Weg/)
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
  assert.match(String(payload.messageData.headline), new RegExp(`^${"A".repeat(60)},`))
})

test("preserves an apostrophe in the sanitized first name for the subject", () => {
  const payload = buildQuizResultArtifactEmailPayload({
    leadId: "550e8400-e29b-41d4-a716-446655440000",
    name: "O'Brien Müller",
    email: "obrien@example.com",
    quizAnswers: answers,
    siteUrl: "https://chaarlie.de",
  })

  assert.equal(payload.messageData.first_name, "O'Brien")
})

test("encodes the lead id in the personalized attributed result URL", () => {
  const payload = buildQuizResultArtifactEmailPayload({
    leadId: "lead/with spaces",
    name: "Lea",
    email: "lea@example.com",
    quizAnswers: answers,
    siteUrl: "https://chaarlie.de",
  })

  assert.equal(
    payload.messageData.result_url,
    "https://chaarlie.de/result/lead%2Fwith%20spaces?focus=unlock-plan&entry=result_email",
  )
})
