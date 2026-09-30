import assert from "node:assert/strict"
import test from "node:test"

import { buildQuizResultArtifactEmailPayload } from "../src/lib/customerio/quiz-result-artifact"
import {
  canonicalizePersonalPlanAnswers,
  type PersonalPlanPrepareRequest,
} from "../src/lib/personal-plan-quiz/persistence"
import { buildPersonalPlanPreparedArtifact } from "../src/lib/personal-plan-quiz/prepared-plan"
import type { QuizAnswers } from "../src/lib/quiz/types"

/**
 * F1 in the result email (Codex review of PR 7a, P2): „Das beschäftigt dich gerade
 * besonders: …" names the problem she STATED — never the top of the assessment ranking,
 * which is exactly the mismatch Nick saw. Without a statement the email makes no concern
 * claim at all.
 */

type PrimaryMessage = { kind: "concern" | "goal" | "positive"; label: string }

const QUIZ: QuizAnswers = {
  structure: "wavy",
  thickness: "fine",
  density: "medium",
  hair_length: "medium",
  fingertest: "rau",
  pulltest: "stretches_stays",
  scalp_type: "ausgeglichen",
  has_scalp_issue: false,
  concerns: ["breakage", "low_shine"],
  treatment: ["blondiert"],
  goals: ["shine", "strength_ends"],
}

function emailMessage(quizAnswers: QuizAnswers): PrimaryMessage {
  return buildQuizResultArtifactEmailPayload({
    leadId: "550e8400-e29b-41d4-a716-446655440000",
    name: "Lea",
    email: "lea@example.com",
    quizAnswers,
    siteUrl: "https://chaarlie.de",
  }).messageData.primary_message as PrimaryMessage
}

test("standard quiz email: the stated pick wins over a structural ranking", () => {
  // Bleached, rough, over-stretching hair ranks breakage first — she said shine.
  const message = emailMessage({ ...QUIZ, primary_concern: "low_shine" })
  assert.deepEqual(message, { kind: "concern", label: "Wenig Glanz" })
})

test("standard quiz email: a single concern is her main problem", () => {
  assert.deepEqual(emailMessage({ ...QUIZ, concerns: ["low_shine"] }), {
    kind: "concern",
    label: "Wenig Glanz",
  })
})

test("standard quiz email: legacy aliases name the visible concern card", () => {
  assert.deepEqual(
    emailMessage({ ...QUIZ, concerns: ["dryness"] }).label,
    "Trockene oder strohige Längen",
  )
})

test("standard quiz email: several concerns without a pick make no concern claim", () => {
  const message = emailMessage(QUIZ)
  assert.notEqual(message.kind, "concern")
  assert.doesNotMatch(message.label, /bricht|Haarbruch|Glanz/)
})

test("standard quiz email: no concerns at all make no concern claim either", () => {
  assert.notEqual(emailMessage({ ...QUIZ, concerns: [] }).kind, "concern")
})

const PP: PersonalPlanPrepareRequest["answers"] = {
  texture: "wavy",
  thickness: "fine",
  density: "low",
  goals: ["shine", "strength_ends"],
  routineClarity: "trial_and_error",
  resultReliability: "rarely",
  adaptationConfidence: "no",
  currentConcerns: ["breakage", "split_ends", "low_shine"],
  hairLength: "long",
  hairSurface: "rough",
  elasticResponse: "stretches_stays",
  chemicalTreatments: ["lightened"],
  scalpOiliness: "balanced",
  scalpConcerns: [],
  previousAttempts: "nothing_reliably_worked",
  blockers: ["product_fit"],
  routineStyle: "simple_reliable",
  meaningfulMoment: "everyday",
}

function ppArtifact(answers: PersonalPlanPrepareRequest["answers"]) {
  return buildPersonalPlanPreparedArtifact(canonicalizePersonalPlanAnswers(answers))
}

test("personal-plan artifact: the stated pick is the primary message, priorities stay the assessment's", () => {
  const artifact = ppArtifact({ ...PP, primaryConcern: "low_shine" })
  assert.deepEqual(artifact.publicOfferModel.primaryMessage, {
    kind: "concern",
    label: "Wenig Glanz",
  })
  // The assessment ranking is untouched — it just no longer speaks for her.
  assert.equal(
    artifact.priorities.some((priority) => priority.isCentral),
    true,
  )
})

test("personal-plan artifact: several concerns without a pick make no concern claim", () => {
  const message = ppArtifact(PP).publicOfferModel.primaryMessage
  assert.notEqual(message.kind, "concern")
})

test("personal-plan artifact: a single concern is her main problem", () => {
  assert.deepEqual(
    ppArtifact({ ...PP, currentConcerns: ["split_ends"] }).publicOfferModel.primaryMessage,
    {
      kind: "concern",
      label: "Meine Spitzen sind sichtbar gespalten oder ausgefranst",
    },
  )
})
