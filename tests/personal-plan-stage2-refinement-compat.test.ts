import assert from "node:assert/strict"
import test from "node:test"

import {
  createStage2RefinementSession,
  saveStage2SessionAnswer,
} from "../src/lib/personal-plan/refinement/session"
import { decodeStage2RefinementAnswers } from "../src/lib/personal-plan/persistence/stage2-refinement-supabase"
import { STAGE2_TOOL_OVERVIEW_QUESTION_ID } from "../src/lib/personal-plan/refinement/types"

// WS5 -- availability and compatibility (verification receipt C6 + C7):
// https://.../plans/2026-08-21-personal-plan-hair-tools-phase1-verification-receipt.md#L196-L201

const baseTriggerContext = {
  relevantCategories: ["shampoo" as const],
  hasReportedIrritatedScalp: false,
  dryShampooBridgeEligibility: "ineligible" as const,
}

// ---------------------------------------------------------------------------
// C6 -- a completed draft must stay loadable and complete after the Tools
// rollout toggles (or any other question-path growth) underneath it.
// ---------------------------------------------------------------------------

test("C6: a completed draft finished while a mid-draft rollout toggle wiped its Tool completion record reloads as complete once Tools are back on", () => {
  // The draft answered every non-Tool question and, while Tools were ON,
  // also submitted the overview and one Tool form page.
  const answersWithToolsDone = {
    currentProductCategories: [],
    wetWashFrequency: "weekly_1x" as const,
    towel: { material: "no_towel" as const },
    dryingRoutes: ["air_dry" as const],
    additionalHeatTools: [],
    toolFamiliesWithSomething: ["airflow" as const],
    toolForms: { airflow: ["hair_dryer" as const] },
  }
  const completedIdsExceptNight = [
    "current_product_categories",
    "wet_wash_frequency",
    "towel_handling",
    "drying_routes",
    "additional_heat_tools",
    "tools_overview",
    "tools:airflow:1",
  ] as const

  // The rollout then flips OFF mid-draft. Resuming recomputes the path
  // against today's (Tools-off) context, which prunes the now-inactive Tool
  // question ids out of `completedQuestionIds` -- while leaving the answer
  // data itself untouched (that half is intentionally non-destructive).
  const resumedOff = createStage2RefinementSession({
    pathVersion: "stage2-v1",
    triggerContext: { ...baseTriggerContext, toolsEnabled: false },
    answers: answersWithToolsDone,
    completedQuestionIds: [...completedIdsExceptNight],
    status: "in_progress",
  })
  assert.deepEqual(resumedOff.completedQuestionIds, [
    "current_product_categories",
    "wet_wash_frequency",
    "towel_handling",
    "drying_routes",
    "additional_heat_tools",
  ])
  assert.deepEqual(resumedOff.answers.toolFamiliesWithSomething, ["airflow"])

  // The user finishes the one remaining question while Tools are still off.
  const saved = saveStage2SessionAnswer(resumedOff, { questionId: "night_protection", answer: [] })

  // Production marks this draft complete: the Tools-off contract has no Tool
  // question in its required set, so this is (correctly) a real completion.
  const completed = createStage2RefinementSession({
    pathVersion: "stage2-v1",
    triggerContext: { ...baseTriggerContext, toolsEnabled: false },
    answers: saved.answers,
    completedQuestionIds: saved.completedQuestionIds,
    status: "complete",
    completedHandoff: { refinedVersionId: "fixture-refined", nextHref: "/plan-start" },
  })
  assert.equal(completed.status, "complete")

  // The rollout flips back ON. Reloading the SAME completed draft must not
  // throw `incomplete_refinement` -- the user's completed journey must stay
  // loadable even though today's contract would (re-)require the Tool form
  // page whose completion record was pruned away above.
  const reloaded = createStage2RefinementSession({
    pathVersion: "stage2-v1",
    triggerContext: { ...baseTriggerContext, toolsEnabled: true },
    answers: completed.answers,
    completedQuestionIds: completed.completedQuestionIds,
    status: "complete",
    completedHandoff: { refinedVersionId: "fixture-refined", nextHref: "/plan-start" },
  })
  assert.equal(reloaded.status, "complete")
  assert.equal(reloaded.completedHandoff?.refinedVersionId, "fixture-refined")
})

// ---------------------------------------------------------------------------
// C7 -- a draft persisted under the old `toolSections` key must decode into
// `toolFamiliesWithSomething` on read, without ever touching the DB row.
// ---------------------------------------------------------------------------

const legacyRawRow = {
  currentProductCategories: [],
  wetWashFrequency: "weekly_1x",
  towel: { material: "no_towel" },
  dryingRoutes: ["air_dry" as const],
  additionalHeatTools: [],
  nightProtection: [],
  // The pre-rename shape: same array, old key.
  toolSections: ["wash_application"],
  toolForms: { wash_application: ["scalp_brush"] },
}

test("C7: decodeStage2RefinementAnswers maps the legacy toolSections key onto toolFamiliesWithSomething", () => {
  const decoded = decodeStage2RefinementAnswers(legacyRawRow)
  assert.deepEqual(decoded.toolFamiliesWithSomething, ["wash_application"])
  assert.equal((decoded as Record<string, unknown>).toolSections, undefined)
  // The read-time decode never mutates the raw row it was given.
  assert.deepEqual(legacyRawRow.toolSections, ["wash_application"])
})

test("C7: decodeStage2RefinementAnswers leaves a row already written under the current key untouched", () => {
  const currentRow = {
    toolFamiliesWithSomething: ["wash_application"],
    toolSections: ["night_protection"], // must never win over the new key
  }
  const decoded = decodeStage2RefinementAnswers(currentRow)
  assert.deepEqual(decoded.toolFamiliesWithSomething, ["wash_application"])
})

test("C7: an old draft resumes with its prior overview selection intact, not a blank Tools trip", () => {
  const decoded = decodeStage2RefinementAnswers(legacyRawRow)
  const session = createStage2RefinementSession({
    pathVersion: "stage2-v1",
    triggerContext: { ...baseTriggerContext, toolsEnabled: true },
    answers: decoded,
    completedQuestionIds: [
      "current_product_categories",
      "wet_wash_frequency",
      "towel_handling",
      "drying_routes",
      "additional_heat_tools",
      "night_protection",
      "tools_overview",
      "tools:wash_application:1",
    ],
  })

  assert.deepEqual(session.answers.toolFamiliesWithSomething, ["wash_application"])
  assert.deepEqual(session.answers.toolForms?.wash_application, ["scalp_brush"])
  assert.equal(session.completedQuestionIds.includes(STAGE2_TOOL_OVERVIEW_QUESTION_ID), true)
  assert.equal(session.completedQuestionIds.includes("tools:wash_application:1"), true)
  // Nothing left to answer -- the overview is not blank.
  assert.equal(session.path.firstUnresolvedQuestionId, null)
})

test("C7 regression: after decoding, saving an unrelated answer does not materialize empty families for what the old draft had reported", () => {
  const decoded = decodeStage2RefinementAnswers(legacyRawRow)
  const session = createStage2RefinementSession({
    pathVersion: "stage2-v1",
    triggerContext: { ...baseTriggerContext, toolsEnabled: true },
    answers: decoded,
    completedQuestionIds: [
      "current_product_categories",
      "wet_wash_frequency",
      "towel_handling",
      "drying_routes",
      "additional_heat_tools",
      "night_protection",
      "tools_overview",
      "tools:wash_application:1",
    ],
  })

  const next = saveStage2SessionAnswer(session, {
    questionId: "wet_wash_frequency",
    answer: "weekly_2x",
  })

  // The old draft's Tool ownership must survive untouched -- not laundered
  // into a synthesized `explicit_none` for a family the user actually reported.
  assert.deepEqual(next.answers.toolFamiliesWithSomething, ["wash_application"])
  assert.deepEqual(next.answers.toolForms?.wash_application, ["scalp_brush"])
})

// ---------------------------------------------------------------------------
// D8 / path version 2 -- the WS4 contract changes must not invalidate a row
// that was completed under path version 1.
// ---------------------------------------------------------------------------

test("D8: a row completed with an empty drying answer stays complete after the ≥1 rule lands", () => {
  const legacyCompleted = {
    currentProductCategories: [],
    wetWashFrequency: "weekly_1x" as const,
    towel: { material: "no_towel" as const },
    // Path version 1 accepted this as a completing answer. Version 2 does not.
    dryingRoutes: [],
    additionalHeatTools: [],
    nightProtection: [],
  }
  const reloaded = createStage2RefinementSession({
    pathVersion: "stage2-v1",
    triggerContext: baseTriggerContext,
    answers: legacyCompleted,
    completedQuestionIds: [
      "current_product_categories",
      "wet_wash_frequency",
      "towel_handling",
      "drying_routes",
      "additional_heat_tools",
      "night_protection",
    ],
    status: "complete",
    completedHandoff: { refinedVersionId: "fixture-refined", nextHref: "/plan-start" },
  })
  assert.equal(reloaded.status, "complete")
  assert.equal(reloaded.completedHandoff?.refinedVersionId, "fixture-refined")
  // The stored `[]` survives untouched -- it is read as "unanswered" by the
  // engine, never rewritten or deleted.
  assert.deepEqual(reloaded.answers.dryingRoutes, [])

  // An in-progress draft with the same answer correctly re-opens the question:
  // only a finished journey is protected, not an unfinished one.
  const inProgress = createStage2RefinementSession({
    pathVersion: "stage2-v1",
    triggerContext: baseTriggerContext,
    answers: legacyCompleted,
    completedQuestionIds: [
      "current_product_categories",
      "wet_wash_frequency",
      "towel_handling",
      "drying_routes",
      "additional_heat_tools",
      "night_protection",
    ],
  })
  assert.equal(inProgress.path.firstUnresolvedQuestionId, "drying_routes")
})

test("D8/R1: the decoder drops a legacy diffuser protectionConsistency at the persistence boundary", () => {
  const legacyRow = {
    dryingRoutes: ["diffuser_or_airflow_shaping"],
    heatEvents: {
      "heat:diffuser_airflow_shaping": { frequency: "weekly_2x", protectionConsistency: "no" },
      "heat:straightener": { frequency: "weekly_1x", protectionConsistency: "always" },
    },
  }
  const decoded = decodeStage2RefinementAnswers(legacyRow)
  assert.deepEqual(decoded.heatEvents?.["heat:diffuser_airflow_shaping"], {
    frequency: "weekly_2x",
  })
  assert.deepEqual(
    decoded.heatEvents?.["heat:straightener"],
    { frequency: "weekly_1x", protectionConsistency: "always" },
    "a source that still asks the question keeps its answer",
  )
  // Read-only: the raw row is never mutated.
  assert.equal(
    legacyRow.heatEvents["heat:diffuser_airflow_shaping"].protectionConsistency,
    "no",
    "the decode never writes back to the row it was given",
  )
})

test("D8: the two decoders compose -- a legacy row decodes both its Tool key and its heat event", () => {
  const decoded = decodeStage2RefinementAnswers({
    ...legacyRawRow,
    dryingRoutes: ["diffuser_or_airflow_shaping"],
    heatEvents: {
      "heat:diffuser_airflow_shaping": { frequency: "weekly_2x", protectionConsistency: "unsure" },
    },
  })
  assert.deepEqual(decoded.toolFamiliesWithSomething, ["wash_application"])
  assert.equal((decoded as Record<string, unknown>).toolSections, undefined)
  assert.deepEqual(decoded.heatEvents?.["heat:diffuser_airflow_shaping"], {
    frequency: "weekly_2x",
  })
})

test("C7 regression: resubmitting the decoded overview with the same family keeps its previously reported forms, instead of materializing an empty explicit_none", () => {
  const decoded = decodeStage2RefinementAnswers(legacyRawRow)
  const session = createStage2RefinementSession({
    pathVersion: "stage2-v1",
    triggerContext: { ...baseTriggerContext, toolsEnabled: true },
    answers: decoded,
    completedQuestionIds: [
      "current_product_categories",
      "wet_wash_frequency",
      "towel_handling",
      "drying_routes",
      "additional_heat_tools",
      "night_protection",
      "tools_overview",
      "tools:wash_application:1",
    ],
  })

  // The overview UI, correctly pre-filled from the decoded family list,
  // resubmits the same section ("waschen_auftragen" -> wash_application).
  const next = saveStage2SessionAnswer(session, {
    questionId: STAGE2_TOOL_OVERVIEW_QUESTION_ID,
    answer: ["waschen_auftragen"],
  })

  assert.deepEqual(next.answers.toolFamiliesWithSomething, ["wash_application"])
  // Without the decode, `toolFamiliesWithSomething` would have started
  // undefined, the overview would resubmit blank, and this would become `[]`.
  assert.deepEqual(next.answers.toolForms?.wash_application, ["scalp_brush"])
})
