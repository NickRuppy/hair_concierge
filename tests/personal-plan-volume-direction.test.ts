import assert from "node:assert/strict"
import test from "node:test"

import { buildConditionerDecision } from "@/lib/personal-plan/categories/conditioner"
import { buildPlanNeedAssessment } from "@/lib/personal-plan/needs"
import { buildPlanProfile } from "@/lib/personal-plan/input"
import {
  resolveVolumeDirection,
  volumeDirectionInputFor,
  wantsMoreVolume,
} from "@/lib/personal-plan/volume-direction"
import {
  computeToolRoutes,
  toolProfileFactsFromPlanProfile,
} from "@/lib/personal-plan/tools/routes"
import { EMPTY_TOOL_CARE_FACTS } from "@/lib/personal-plan/tools/facts"
import type { PersonalPlanQuizSubmissionEnvelope } from "@/lib/personal-plan-quiz/types"
import { COMPLETE_V3_PLAN_ENVELOPE } from "./personal-plan/fixtures"

type Answers = PersonalPlanQuizSubmissionEnvelope["answers"]

const TEXTURES = ["straight", "wavy", "curly", "coily"] as const
const THICKNESSES = ["fine", "normal", "coarse"] as const

function profileFor(overrides: Partial<Answers>) {
  return buildPlanProfile(
    {
      ...COMPLETE_V3_PLAN_ENVELOPE,
      answers: { ...COMPLETE_V3_PLAN_ENVELOPE.answers, ...overrides },
    },
    { artifactId: "artifact-1", projection: "initial_quiz" },
  )
}

test("the volume predicate reads control only for curly, coily, coarse and shaped wavy", () => {
  assert.equal(
    resolveVolumeDirection({
      texture: "straight",
      thickness: "fine",
      hasVolumeGoal: true,
      hasDefinitionGoal: false,
      hasLostShapeConcern: false,
    }),
    "volume_up",
  )
  for (const texture of ["curly", "coily"] as const) {
    assert.equal(
      resolveVolumeDirection({
        texture,
        thickness: "fine",
        hasVolumeGoal: true,
        hasDefinitionGoal: false,
        hasLostShapeConcern: false,
      }),
      "control",
    )
  }
  assert.equal(
    resolveVolumeDirection({
      texture: "wavy",
      thickness: "fine",
      hasVolumeGoal: true,
      hasDefinitionGoal: true,
      hasLostShapeConcern: false,
    }),
    "control",
  )
})

test("without the volume goal the predicate never claims a direction", () => {
  assert.equal(
    wantsMoreVolume({
      texture: "straight",
      thickness: "fine",
      hasVolumeGoal: false,
      hasDefinitionGoal: false,
      hasLostShapeConcern: false,
    }),
    false,
  )
})

/**
 * Conditioner weight and the Hair Tools styling routes must never disagree about
 * what one profile means. This walks every texture/thickness combination and
 * proves both consumers read the same shared predicate.
 */
test("Conditioner and Tools agree on volume direction for every profile", () => {
  for (const texture of TEXTURES) {
    for (const thickness of THICKNESSES) {
      for (const withDefinition of [false, true]) {
        const goals: Answers["goals"] = withDefinition
          ? ["volume_balance", "shape_definition"]
          : ["volume_balance"]
        const profile = profileFor({ texture, thickness, goals })
        const direction = resolveVolumeDirection(volumeDirectionInputFor(profile))

        const conditioner = buildConditionerDecision(profile, buildPlanNeedAssessment(profile))
        const conditionerSaysControl = conditioner.reasons.some((reason) =>
          reason.id.includes("conditioner.weight.control"),
        )
        const conditionerSaysVolumeUp = conditioner.reasons.some((reason) =>
          reason.id.includes("conditioner.weight.volume_up"),
        )

        const toolRoutes = computeToolRoutes({
          profile: toolProfileFactsFromPlanProfile(profile),
          care: EMPTY_TOOL_CARE_FACTS,
          inventory: {},
          scalpApplicationJob: false,
        })
        const toolsRecommendVolume = toolRoutes.some(
          (route) =>
            route.target === "heated_volume_set" ||
            route.target === "heatless_volume_set" ||
            route.target === "air_shaping_volume",
        )

        const label = `${texture}/${thickness}/definition=${withDefinition}`
        if (direction === "control") {
          assert.equal(toolsRecommendVolume, false, `${label}: Tools must not recommend volume`)
          if (conditionerSaysControl || conditionerSaysVolumeUp) {
            assert.equal(conditionerSaysVolumeUp, false, `${label}: Conditioner disagrees`)
          }
        } else {
          assert.equal(toolsRecommendVolume, true, `${label}: Tools must recommend volume`)
          if (conditionerSaysControl || conditionerSaysVolumeUp) {
            assert.equal(conditionerSaysControl, false, `${label}: Conditioner disagrees`)
          }
        }
      }
    }
  }
})
