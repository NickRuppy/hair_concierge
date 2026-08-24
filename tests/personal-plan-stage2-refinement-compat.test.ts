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
    dryingRoutes: [],
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
  dryingRoutes: [],
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
