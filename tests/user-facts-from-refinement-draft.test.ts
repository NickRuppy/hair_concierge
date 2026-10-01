import assert from "node:assert/strict"
import test from "node:test"

import { toCareHabitsPatch, toFieldProvenance } from "../src/lib/user-facts/from-refinement-draft"
import type {
  PersonalPlanRefinementAnswersV1,
  Stage2AnswerProvenance,
  Stage2QuestionId,
} from "../src/lib/personal-plan/refinement/types"

const ANSWERS: PersonalPlanRefinementAnswersV1 = {
  currentProductCategories: ["shampoo", "oil"],
  wetWashFrequency: "daily_1x",
  oilPurposes: ["scalp"],
  towel: { material: "frottee", technique: "rough_rubbing" },
  dryingRoutes: ["ordinary_blow_dry"],
  additionalHeatTools: ["straightener"],
  heatEvents: {
    "heat:ordinary_blow_dry": { frequency: "daily_1x" },
    "heat:straightener": { frequency: "weekly_2x", protectionConsistency: "always" },
  },
  nightProtection: ["silk_satin_pillow"],
}

test("toCareHabitsPatch is the answers object as-is, present fields only", () => {
  const patch = toCareHabitsPatch(ANSWERS)
  assert.deepEqual(patch, ANSWERS)
  // No brush field: Feinschliff never asks about brushes/combs.
  assert.equal((patch as Record<string, unknown>).brushesCombs, undefined)
})

test("toCareHabitsPatch omits fields the current path never asked (partial answers)", () => {
  const partial: PersonalPlanRefinementAnswersV1 = { wetWashFrequency: "daily_1x" }
  const patch = toCareHabitsPatch(partial)
  assert.deepEqual(patch, { wetWashFrequency: "daily_1x" })
  assert.equal("towel" in patch, false)
  assert.equal("heatEvents" in patch, false)
})

const ALL_QUESTION_IDS: Stage2QuestionId[] = [
  "current_product_categories",
  "wet_wash_frequency",
  "scalp_irritation_detail",
  "dry_shampoo_bridge_preference",
  "dry_shampoo_visible_hair_color",
  "oil_purposes",
  "towel_handling",
  "drying_routes",
  "additional_heat_tools",
  "night_protection",
]

test("toFieldProvenance maps every static question id to its care_habits field", () => {
  const provenance: Stage2AnswerProvenance = Object.fromEntries(
    ALL_QUESTION_IDS.map((id) => [id, "user"]),
  )
  const fields = toFieldProvenance({
    completedQuestionIds: ALL_QUESTION_IDS,
    answerProvenance: provenance,
  })
  assert.deepEqual(fields, {
    currentProductCategories: "user",
    wetWashFrequency: "user",
    scalpIrritationDetail: "user",
    dryShampooBridgePreference: "user",
    dryShampooVisibleHairColor: "user",
    oilPurposes: "user",
    towel: "user",
    dryingRoutes: "user",
    additionalHeatTools: "user",
    nightProtection: "user",
  })
})

test("toFieldProvenance marks a field assumed when its provenance entry says so", () => {
  const fields = toFieldProvenance({
    completedQuestionIds: ["wet_wash_frequency"],
    answerProvenance: { wet_wash_frequency: "assumed" },
  })
  assert.deepEqual(fields, { wetWashFrequency: "assumed" })
})

test("toFieldProvenance: a completed id with no provenance entry defaults to user", () => {
  const fields = toFieldProvenance({
    completedQuestionIds: ["wet_wash_frequency"],
    answerProvenance: {},
  })
  assert.deepEqual(fields, { wetWashFrequency: "user" })
})

test("toFieldProvenance: an uncompleted id with no provenance entry is omitted", () => {
  const fields = toFieldProvenance({
    completedQuestionIds: [],
    answerProvenance: { wet_wash_frequency: "user" },
  })
  assert.deepEqual(fields, {})
})

test("toFieldProvenance folds every heat:<source> id into one heatEvents key — all user", () => {
  const ids: Stage2QuestionId[] = ["heat:ordinary_blow_dry", "heat:straightener"]
  const fields = toFieldProvenance({
    completedQuestionIds: ids,
    answerProvenance: { "heat:ordinary_blow_dry": "user", "heat:straightener": "user" },
  })
  assert.deepEqual(fields, { heatEvents: "user" })
})

test("toFieldProvenance folds heatEvents to assumed when any one heat event is assumed", () => {
  const ids: Stage2QuestionId[] = [
    "heat:ordinary_blow_dry",
    "heat:straightener",
    "heat:dryer_brush",
  ]
  const fields = toFieldProvenance({
    completedQuestionIds: ids,
    answerProvenance: {
      "heat:ordinary_blow_dry": "user",
      "heat:straightener": "assumed",
      "heat:dryer_brush": "user",
    },
  })
  assert.deepEqual(fields, { heatEvents: "assumed" })
})

test("toFieldProvenance: a completed heat id with no provenance entry still defaults to user", () => {
  const fields = toFieldProvenance({
    completedQuestionIds: ["heat:ordinary_blow_dry"],
    answerProvenance: {},
  })
  assert.deepEqual(fields, { heatEvents: "user" })
})

test("toFieldProvenance combines static fields and the heatEvents aggregate together", () => {
  const ids: Stage2QuestionId[] = [
    "wet_wash_frequency",
    "drying_routes",
    "heat:ordinary_blow_dry",
    "heat:straightener",
  ]
  const fields = toFieldProvenance({
    completedQuestionIds: ids,
    answerProvenance: {
      wet_wash_frequency: "user",
      drying_routes: "assumed",
      "heat:ordinary_blow_dry": "user",
      "heat:straightener": "user",
    },
  })
  assert.deepEqual(fields, {
    wetWashFrequency: "user",
    dryingRoutes: "assumed",
    heatEvents: "user",
  })
})
