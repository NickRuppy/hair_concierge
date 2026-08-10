import assert from "node:assert/strict"
import test from "node:test"

import { prepareStage3EntryContextForLab } from "../src/app/labs/personal-plan-stage-1-2/integration"
import {
  createStage2RefinementSession,
  saveStage2SessionAnswer,
  type Stage2RefinementHandoff,
} from "../src/lib/personal-plan/refinement/session"
import type {
  PersonalPlanRefinementAnswersV1,
  Stage2QuestionId,
  Stage2TriggerContext,
} from "../src/lib/personal-plan/refinement/types"

const triggerContext: Stage2TriggerContext = {
  relevantCategories: [
    "shampoo",
    "conditioner",
    "leave_in",
    "oil",
    "mask",
    "bondbuilder",
    "deep_cleansing_shampoo",
  ],
  hasReportedIrritatedScalp: true,
  dryShampooBridgeEligibility: "eligible",
}

const answers: PersonalPlanRefinementAnswersV1 = {
  currentProductCategories: ["shampoo", "conditioner", "oil"],
  wetWashFrequency: "weekly_2x",
  scalpIrritationDetail: "mild_sensitive_or_itchy",
  dryShampooBridgePreference: "accept",
  dryShampooVisibleHairColor: "dark",
  oilPurposes: ["dry_finish"],
  towel: { material: "mikrofaser", technique: "gentle_press" },
  dryingRoutes: ["ordinary_blow_dry"],
  additionalHeatTools: ["straightener"],
  heatEvents: {
    "heat:ordinary_blow_dry": { frequency: "weekly_2x" },
    "heat:straightener": { frequency: "monthly_1x", protectionConsistency: "always" },
  },
  nightProtection: [],
}

const completedQuestionIds: Stage2QuestionId[] = [
  "current_product_categories",
  "wet_wash_frequency",
  "scalp_irritation_detail",
  "dry_shampoo_bridge_preference",
  "dry_shampoo_visible_hair_color",
  "oil_purposes",
  "towel_handling",
  "drying_routes",
  "additional_heat_tools",
  "heat:ordinary_blow_dry",
  "heat:straightener",
  "night_protection",
]

const handoff: Stage2RefinementHandoff = {
  refinedVersionId: "fixture-refined-stage2-v1-r12",
  nextHref: "/plan-start",
}

function completedSession() {
  return createStage2RefinementSession({
    pathVersion: "stage2-fixture-v1",
    triggerContext,
    answers,
    completedQuestionIds,
    revision: 12,
    status: "complete",
    completedHandoff: handoff,
  })
}

test("the completed refinement recomputes the plan and becomes the Stage 3 entry authority", () => {
  const result = prepareStage3EntryContextForLab({ session: completedSession(), handoff })

  assert.equal(result.refinedSnapshot.profile.source.projection, "refined_post_plan")
  assert.equal(result.entryContext.refinedVersionId, handoff.refinedVersionId)
  assert.deepEqual(
    result.entryContext.orderedCategories.map((requirement) => requirement.category),
    result.refinedSnapshot.renderedOrder,
  )
  assert.ok(
    result.entryContext.orderedCategories.some((item) => item.category === "heat_protectant"),
  )
  assert.ok(result.entryContext.orderedCategories.some((item) => item.category === "scalp_care"))
  assert.ok(result.entryContext.orderedCategories.some((item) => item.category === "dry_shampoo"))
})

test("editing a completed refinement invalidates the old Stage 3 entry until recompletion", () => {
  const edited = saveStage2SessionAnswer(completedSession(), {
    questionId: "night_protection",
    answer: ["loose_tied"],
  })

  assert.equal(edited.status, "in_progress")
  assert.throws(
    () => prepareStage3EntryContextForLab({ session: edited, handoff }),
    /completed Stage 2 refinement/,
  )
})
