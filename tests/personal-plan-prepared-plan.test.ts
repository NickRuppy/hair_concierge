import assert from "node:assert/strict"
import test from "node:test"

import { adaptPersonalPlanAnswersForOffer } from "../src/lib/personal-plan-quiz/offer-adapter"
import {
  buildPersonalPlanPreparedArtifact,
  personalPlanScoreToSegments,
} from "../src/lib/personal-plan-quiz/prepared-plan"
import {
  canonicalizePersonalPlanAnswers,
  hashPersonalPlanAnswers,
  type PersonalPlanPrepareRequest,
} from "../src/lib/personal-plan-quiz/persistence"
import type { PersonalPlanQuizAnswers } from "../src/lib/personal-plan-quiz/types"

type CompleteAnswers = PersonalPlanQuizAnswers & PersonalPlanPrepareRequest["answers"]

const completeAnswers: CompleteAnswers = {
  texture: "curly",
  thickness: "fine",
  density: "low",
  goals: [
    "moisture",
    "frizz_surface",
    "shine",
    "shape_definition",
    "volume_balance",
    "strength_ends",
    "scalp_balance",
    "manageability_styling",
  ],
  routineClarity: "trial_and_error",
  resultReliability: "rarely",
  adaptationConfidence: "no",
  currentConcerns: [
    "dry_dull_lengths",
    "frizz_flyaways",
    "low_shine",
    "lost_shape",
    "low_volume_or_weighed_down",
    "breakage_or_split_ends",
    "tangling",
    "scalp_imbalance",
  ],
  hairLength: "long",
  hairSurface: "rough",
  elasticResponse: "unknown",
  chemicalTreatments: ["lightened"],
  scalpOiliness: "balanced",
  scalpConcerns: ["irritated"],
  previousAttempts: "nothing_reliably_worked",
  blockers: ["product_fit", "routine_too_complex"],
  routineStyle: "simple_reliable",
  meaningfulMoment: "everyday",
}

test("V2 adapter uses the fixed taxonomy, diagnostic priority, and recorded elasticity fallback", () => {
  const adapted = adaptPersonalPlanAnswersForOffer(completeAnswers)

  assert.deepEqual(adapted.answers, {
    structure: "curly",
    thickness: "fine",
    density: "low",
    hair_length: "long",
    fingertest: "rau",
    pulltest: "stretches_bounces",
    scalp_type: "ausgeglichen",
    has_scalp_issue: true,
    scalp_condition: "gereizt",
    concerns: ["breakage", "split_ends", "dryness"],
    treatment: ["blondiert"],
    goals: ["moisture", "healthy_scalp", "curl_definition", "less_split_ends", "anti_breakage"],
  })
  assert.deepEqual(adapted.fallbackMetadata, {
    elasticityFallback: true,
    scalpFallback: false,
  })
})

test("multiple scalp concerns retain the safest supported shampoo direction", () => {
  const adapted = adaptPersonalPlanAnswersForOffer({
    ...completeAnswers,
    scalpConcerns: ["dry_dandruff", "oily_dandruff", "irritated"],
  })

  assert.equal(adapted.answers.has_scalp_issue, true)
  assert.equal(adapted.answers.scalp_condition, "gereizt")
  assert.equal(adapted.answers.goals?.includes("healthy_scalp"), true)
})

test("volume balance follows factual hair signals instead of selection order", () => {
  const lowFine = adaptPersonalPlanAnswersForOffer({
    ...completeAnswers,
    texture: "straight",
    thickness: "fine",
    density: "low",
    goals: ["volume_balance"],
    currentConcerns: [],
    elasticResponse: "stretches_bounces",
    scalpOiliness: "balanced",
    scalpConcerns: [],
  })
  const highCoarse = adaptPersonalPlanAnswersForOffer({
    ...completeAnswers,
    texture: "coily",
    thickness: "coarse",
    density: "high",
    goals: ["volume_balance"],
    currentConcerns: [],
    elasticResponse: "stretches_bounces",
    scalpOiliness: "balanced",
    scalpConcerns: [],
  })

  assert.deepEqual(lowFine.answers.goals, ["volume"])
  assert.deepEqual(highCoarse.answers.goals, ["less_volume"])
})

test("score bands map to the reviewed three visual segments", () => {
  for (const score of [40, 45, 50, 55, 60] as const) {
    assert.equal(personalPlanScoreToSegments(score), 1)
  }
  for (const score of [65, 70, 75, 80] as const) {
    assert.equal(personalPlanScoreToSegments(score), 2)
  }
  for (const score of [85, 90, 95, 100] as const) {
    assert.equal(personalPlanScoreToSegments(score), 3)
  }
})

test("prepared artifact contains three public dimensions but keeps products and routine locked", () => {
  const artifact = buildPersonalPlanPreparedArtifact(
    canonicalizePersonalPlanAnswers(completeAnswers),
  )

  assert.equal(artifact.publicOfferModel.diagnosticRows.length, 3)
  assert.equal(artifact.diagnosticScores.dimensions.length, 3)
  assert.equal(
    artifact.publicOfferModel.diagnosticRows.every((row) => row.potentialSegments === 3),
    true,
  )
  assert.equal(artifact.lockedPlan.products.length >= 2, true)
  assert.equal(artifact.lockedPlan.routine.order.length >= 2, true)

  assert.equal("products" in artifact.publicOfferModel, false)
  assert.equal("routine" in artifact.publicOfferModel, false)
  assert.equal("application" in artifact.publicOfferModel, false)
  assert.equal("frequency" in artifact.publicOfferModel, false)
})

test("straight, wavy, curly, and coily complete profiles all prepare deterministic plans", () => {
  const textures: CompleteAnswers["texture"][] = ["straight", "wavy", "curly", "coily"]
  for (const texture of textures) {
    const envelope = canonicalizePersonalPlanAnswers({
      ...completeAnswers,
      texture,
      goals:
        texture === "straight"
          ? ["shine", "volume_balance"]
          : ["moisture", "shape_definition", "frizz_surface"],
      currentConcerns:
        texture === "straight"
          ? ["low_shine", "low_volume_or_weighed_down"]
          : ["dry_dull_lengths", "lost_shape", "frizz_flyaways"],
      scalpConcerns: [],
      scalpOiliness: "balanced",
      elasticResponse: "stretches_bounces",
      chemicalTreatments: ["natural"],
    })
    const first = buildPersonalPlanPreparedArtifact(envelope)
    const second = buildPersonalPlanPreparedArtifact(envelope)
    assert.equal(first.publicOfferModel.diagnosticRows.length, 3)
    assert.equal(first.lockedPlan.products.length >= 2, true)
    assert.deepEqual(first, second)
  }
})

test("canonical answer hash ignores selection order but changes with durable answers", () => {
  const first = canonicalizePersonalPlanAnswers(completeAnswers)
  const reordered = canonicalizePersonalPlanAnswers({
    ...completeAnswers,
    goals: [...completeAnswers.goals].reverse(),
    currentConcerns: [...completeAnswers.currentConcerns].reverse(),
    scalpConcerns: [...completeAnswers.scalpConcerns].reverse(),
    chemicalTreatments: [...completeAnswers.chemicalTreatments].reverse(),
    blockers: [...completeAnswers.blockers].reverse(),
  })
  const changed = canonicalizePersonalPlanAnswers({
    ...completeAnswers,
    density: "high",
  })

  assert.equal(hashPersonalPlanAnswers(first), hashPersonalPlanAnswers(reordered))
  assert.notEqual(hashPersonalPlanAnswers(first), hashPersonalPlanAnswers(changed))
})
