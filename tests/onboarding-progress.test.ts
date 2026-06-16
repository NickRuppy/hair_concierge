import assert from "node:assert/strict"
import test from "node:test"

import { buildOnboardingProgressState } from "../src/lib/onboarding/progress"

test("product drilldowns count as individual progress steps", () => {
  const progress = buildOnboardingProgressState({
    currentStep: "product_drilldown",
    currentDrilldownIndex: 2,
    drilldownCount: 3,
    selectedHeatTools: ["foehn"],
    towelMaterial: null,
  })

  assert.equal(progress.totalSteps, 14)
  assert.equal(progress.currentIndex, 4)
  assert.equal(progress.currentSectionIndex, 0)
  assert.equal(progress.currentLabel, "Produkt-Details 3")
  assert.equal(progress.progressPercent, 36)
  assert.equal(progress.milestones[0]?.label, "Produkte")
  assert.equal(progress.milestones[0]?.percent, 36)
  assert.equal(progress.milestones[1]?.label, "Styling")
  assert.equal(progress.milestones[1]?.percent, 64)
})

test("heat branch disappears from the effective path when no tools are selected", () => {
  const progress = buildOnboardingProgressState({
    currentStep: "interstitial",
    currentDrilldownIndex: 1,
    drilldownCount: 2,
    selectedHeatTools: [],
    towelMaterial: null,
  })

  assert.equal(progress.totalSteps, 11)
  assert.equal(progress.currentIndex, 5)
  assert.equal(progress.currentSectionIndex, 1)
  assert.equal(progress.currentLabel, "Styling-Check")
  assert.equal(progress.progressPercent, 55)
  assert.equal(progress.path.includes("heat_frequency"), false)
  assert.equal(progress.path.includes("heat_protection"), false)
  assert.equal(progress.milestones[0]?.percent, 36)
  assert.equal(progress.milestones[1]?.percent, 55)
})

test("night protection reaches the end of the visible onboarding path", () => {
  const progress = buildOnboardingProgressState({
    currentStep: "night_protection",
    currentDrilldownIndex: 0,
    drilldownCount: 1,
    selectedHeatTools: ["glätteisen"],
    towelMaterial: null,
  })

  assert.equal(progress.currentLabel, "Nachtschutz")
  assert.equal(progress.currentIndex, progress.totalSteps - 1)
  assert.equal(progress.currentSectionIndex, 2)
  assert.equal(progress.progressPercent, 100)
  assert.equal(progress.milestones[2]?.label, "Alltag")
  assert.equal(progress.milestones[2]?.percent, 100)
})

test("no towel removes towel technique from the visible routine path", () => {
  const progress = buildOnboardingProgressState({
    currentStep: "drying_method",
    currentDrilldownIndex: 0,
    drilldownCount: 1,
    selectedHeatTools: [],
    towelMaterial: "no_towel",
  })

  assert.equal(progress.path.includes("towel_technique"), false)
  assert.equal(progress.path.includes("towel_material"), true)
  assert.equal(progress.path.includes("drying_method"), true)
  assert.equal(progress.currentLabel, "Trocknen")
  assert.equal(progress.currentSectionIndex, 2)
})
