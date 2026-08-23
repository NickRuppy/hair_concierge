import assert from "node:assert/strict"
import test from "node:test"

import { buildPlanProfile } from "@/lib/personal-plan/input"
import { buildToolPlan } from "@/lib/personal-plan/tools/assets"
import {
  computeToolRoutes,
  EMPTY_TOOL_CARE_FACTS,
  toolProfileFactsFromPlanProfile,
} from "@/lib/personal-plan/tools/routes"
import {
  projectToolInventoryFromCareFacts,
  type ToolCareFacts,
  type ToolInventory,
} from "@/lib/personal-plan/tools/facts"
import type { PersonalPlanQuizSubmissionEnvelope } from "@/lib/personal-plan-quiz/types"
import { COMPLETE_V3_PLAN_ENVELOPE } from "./personal-plan/fixtures"

type Answers = PersonalPlanQuizSubmissionEnvelope["answers"]

function planFor(input: {
  answers?: Partial<Answers>
  care?: Partial<ToolCareFacts>
  inventory?: ToolInventory
  scalpApplicationJob?: boolean
}) {
  const care = { ...EMPTY_TOOL_CARE_FACTS, ...input.care }
  const inventory = { ...projectToolInventoryFromCareFacts(care), ...(input.inventory ?? {}) }
  const routes = computeToolRoutes({
    profile: toolProfileFactsFromPlanProfile(
      buildPlanProfile(
        {
          ...COMPLETE_V3_PLAN_ENVELOPE,
          answers: { ...COMPLETE_V3_PLAN_ENVELOPE.answers, ...input.answers },
        },
        { artifactId: "artifact-1", projection: "initial_quiz" },
      ),
    ),
    care,
    inventory,
    scalpApplicationJob: input.scalpApplicationJob ?? false,
  })
  return buildToolPlan({ routes, inventory })
}

test("one physical Tool covering several routes gets one asset and several occurrences", () => {
  const plan = planFor({
    answers: {
      texture: "curly",
      goals: ["shape_definition", "volume_balance"],
      hairLength: "long",
    },
    care: { dryingRoutes: ["diffuser_or_airflow_shaping"] },
    inventory: { airflow: ["air_multi_styler"] },
  })
  const airflowAssets = plan.assets.filter((asset) => asset.family === "airflow")
  assert.equal(airflowAssets.length, 1, "one physical airflow Tool, one Routine row")
  assert.deepEqual(airflowAssets[0].productTypes, ["air_multi_styler"])
  assert.equal(airflowAssets[0].presentationState, "use_yours")
  assert.ok(
    plan.occurrences.filter((occurrence) => occurrence.assetKey === airflowAssets[0].assetKey)
      .length >= 1,
  )
})

test("durable assets carry no cadence, reorder or acquisition state", () => {
  const plan = planFor({ answers: { hairLength: "long" } })
  for (const asset of plan.assets) {
    for (const forbidden of [
      "cadence",
      "frequency",
      "replacementCadence",
      "reorder",
      "lowStock",
      "acquired",
      "price",
      "commerce",
    ]) {
      assert.equal(forbidden in asset, false, `${forbidden} must never reach a Tool asset`)
    }
  }
})

test("unknown ownership yields a conditional occurrence, never an executable one", () => {
  const plan = planFor({ answers: { hairLength: "long" } })
  const foundation = plan.occurrences.find((occurrence) =>
    occurrence.routeKey.endsWith("detangling_foundation"),
  )
  assert.equal(foundation?.executable, false)
  assert.equal(foundation?.conditionalReason, "unknown_ownership")
  const asset = plan.assets.find((candidate) => candidate.assetKey === foundation?.assetKey)
  assert.equal(asset?.presentationState, "check_in_refinement")
})

test("reported ownership makes the occurrence executable", () => {
  const plan = planFor({
    answers: { hairLength: "long" },
    inventory: { brushes_combs: ["detangling_brush"] },
  })
  const foundation = plan.occurrences.find((occurrence) =>
    occurrence.routeKey.endsWith("detangling_foundation"),
  )
  assert.equal(foundation?.executable, true)
  assert.equal(foundation?.conditionalReason, null)
})

test("an explicitly missing Phase-1 route is an honest catalog gap, not a promise", () => {
  const plan = planFor({
    answers: { hairLength: "long" },
    inventory: { brushes_combs: [] },
  })
  const asset = plan.assets.find((candidate) => candidate.family === "brushes_combs")
  assert.equal(asset?.ownership, "explicit_none")
  assert.equal(asset?.presentationState, "catalog_gap")
  const occurrence = plan.occurrences.find((candidate) => candidate.assetKey === asset?.assetKey)
  assert.equal(occurrence?.executable, false)
  assert.equal(occurrence?.conditionalReason, "explicit_none")
})

test("behaviour-only routes produce guidance, never a fake Tool card", () => {
  const plan = planFor({ care: { towelMaterial: "mikrofaser", towelTechnique: "rough_rubbing" } })
  assert.equal(
    plan.assets.some((asset) => asset.family === "drying_textiles"),
    false,
  )
  const guidance = plan.guidance.find((entry) => entry.routeKey.endsWith("gentle_towel_handling"))
  assert.equal(guidance?.strength, "firm")
  assert.deepEqual(guidance?.anchor, { kind: "wash_day", phase: "drying" })
})

test("night protection only occurs nightly and stays conditional while unknown", () => {
  const plan = planFor({ answers: { hairLength: "long" }, care: { nightProtection: null } })
  const occurrence = plan.occurrences.find((candidate) =>
    candidate.routeKey.endsWith("night_protection"),
  )
  assert.deepEqual(occurrence?.anchor, { kind: "nightly" })
  assert.equal(occurrence?.executable, false)
})

test("a reported heated tool appears once with no need and an executable use step", () => {
  const plan = planFor({
    care: { additionalHeatTools: ["straightener"] },
  })
  const heated = plan.assets.filter((asset) => asset.family === "heated_styling")
  assert.equal(heated.length, 1)
  assert.deepEqual(heated[0].productTypes, ["flat_iron"])
  assert.equal(heated[0].presentationState, "use_yours")
  const occurrence = plan.occurrences.find((candidate) => candidate.assetKey === heated[0].assetKey)
  assert.equal(occurrence?.executable, true)
  assert.deepEqual(occurrence?.anchor, { kind: "styling_session" })
})

test("the built plan always satisfies the strict Tool plan contract", () => {
  const plan = planFor({
    answers: {
      hairLength: "very_long",
      texture: "coily",
      goals: ["shape_definition", "strength_ends"],
      currentConcerns: ["tangling", "breakage"],
    },
    care: {
      dryingRoutes: ["diffuser_or_airflow_shaping"],
      additionalHeatTools: ["dryer_brush"],
      towelMaterial: "frottee",
      towelTechnique: "rough_rubbing",
      nightProtection: ["silk_satin_bonnet"],
    },
    scalpApplicationJob: true,
  })
  assert.equal(new Set(plan.assets.map((asset) => asset.assetKey)).size, plan.assets.length)
  assert.equal(
    new Set(plan.occurrences.map((occurrence) => occurrence.occurrenceKey)).size,
    plan.occurrences.length,
  )
  for (const occurrence of plan.occurrences) {
    assert.ok(plan.assets.some((asset) => asset.assetKey === occurrence.assetKey))
  }
})
