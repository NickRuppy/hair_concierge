import assert from "node:assert/strict"
import test from "node:test"

import { planVolumeDirection } from "../../../src/lib/personal-plan/categories/volume-direction"
import { buildPlanProfile } from "../../../src/lib/personal-plan/input"
import {
  buildStage3SelectionProfile,
  UNKNOWN_SELECTION_PROFILE,
} from "../../../src/lib/personal-plan/products/authority/selection-profile"
import type { PlanProfile } from "../../../src/lib/personal-plan/types"
import type { PersonalPlanQuizSubmissionEnvelope } from "../../../src/lib/personal-plan-quiz/types"
import { COMPLETE_V3_PLAN_ENVELOPE } from "../fixtures"

function profile(
  overrides: Partial<PersonalPlanQuizSubmissionEnvelope["answers"]> = {},
  scalp: Partial<PlanProfile["scalp"]> = {},
): PlanProfile {
  const envelope: PersonalPlanQuizSubmissionEnvelope = {
    ...COMPLETE_V3_PLAN_ENVELOPE,
    answers: { ...COMPLETE_V3_PLAN_ENVELOPE.answers, ...overrides },
  }
  const built = buildPlanProfile(envelope, {
    artifactId: "60000000-0000-4000-8000-000000000001",
    projection: "initial_quiz",
  })
  return { ...built, scalp: { ...built.scalp, ...scalp } }
}

function slice(planProfile: PlanProfile, color: "light_blonde" | "brown" | "dark" | null = null) {
  return buildStage3SelectionProfile({ profile: planProfile }, color)
}

test("selection profile passes the quiz scalp oiliness through", () => {
  for (const oiliness of ["oily", "balanced", "dry"] as const) {
    assert.equal(slice(profile({ scalpOiliness: oiliness })).scalpOiliness, oiliness)
  }
})

test("selection profile: scalp concern `irritated` marks the scalp as sensitive", () => {
  assert.equal(slice(profile({ scalpConcerns: ["irritated"] })).sensitiveScalp, true)
  assert.equal(slice(profile({ scalpConcerns: [] })).sensitiveScalp, false)
})

test("selection profile: an assumed/normal irritation detail never clears the quiz sensitivity", () => {
  const planProfile = profile(
    { scalpConcerns: ["irritated"] },
    { irritationState: { state: "known", value: "normal" } },
  )
  assert.equal(slice(planProfile).sensitiveScalp, true)
})

test("volume direction: low-volume concern → more", () => {
  const planProfile = profile({ currentConcerns: ["low_volume_or_weighed_down"], goals: [] })
  assert.equal(planVolumeDirection(planProfile), "more")
  assert.equal(slice(planProfile).volumeDirection, "more")
})

test("volume direction: volume goal on straight fine hair → more", () => {
  const planProfile = profile({
    texture: "straight",
    thickness: "fine",
    goals: ["volume_balance"],
    currentConcerns: [],
  })
  assert.equal(planVolumeDirection(planProfile), "more")
})

test("volume direction: volume goal on curly or coarse hair → less (control route)", () => {
  assert.equal(
    planVolumeDirection(
      profile({
        texture: "curly",
        thickness: "normal",
        goals: ["volume_balance"],
        currentConcerns: [],
      }),
    ),
    "less",
  )
  assert.equal(
    planVolumeDirection(
      profile({
        texture: "straight",
        thickness: "coarse",
        goals: ["volume_balance"],
        currentConcerns: [],
      }),
    ),
    "less",
  )
})

test("volume direction: no volume goal or concern → null", () => {
  const planProfile = profile({ goals: [], currentConcerns: [] })
  assert.equal(planVolumeDirection(planProfile), null)
  assert.equal(slice(planProfile).volumeDirection, null)
})

test("selection profile carries the user-answered visible hair colour only", () => {
  assert.equal(slice(profile(), "brown").visibleHairColor, "brown")
  assert.equal(slice(profile(), null).visibleHairColor, null)
})

test("the unknown selection profile is neutral", () => {
  assert.deepEqual(UNKNOWN_SELECTION_PROFILE, {
    scalpOiliness: null,
    sensitiveScalp: false,
    volumeDirection: null,
    visibleHairColor: null,
  })
  assert.ok(Object.isFrozen(UNKNOWN_SELECTION_PROFILE))
})

test("a partial persisted profile degrades to neutral answers instead of throwing", () => {
  assert.deepEqual(
    buildStage3SelectionProfile({ profile: { hair: { thickness: "normal" } } } as never, "dark"),
    { scalpOiliness: null, sensitiveScalp: false, volumeDirection: null, visibleHairColor: "dark" },
  )
})
