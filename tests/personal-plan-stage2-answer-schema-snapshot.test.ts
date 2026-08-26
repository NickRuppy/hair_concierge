import assert from "node:assert/strict"
import test from "node:test"

import {
  getOrderedQuestionIds,
  resolveStage2RefinementContract,
} from "@/lib/personal-plan/refinement/question-path"
import {
  STAGE2_QUESTION_PATH_VERSION,
  type PersonalPlanRefinementAnswersV1,
  type Stage2AnswerKey,
  type Stage2QuestionId,
  type Stage2TriggerContext,
} from "@/lib/personal-plan/refinement/types"
import {
  TOOL_ANSWER_ONLY_FORMS_BY_FAMILY,
  TOOL_FAMILIES,
  TOOL_REPORTED_FORMS_BY_FAMILY,
} from "@/lib/personal-plan/tools/contracts"
import { TOOL_FORM_PAGES } from "@/lib/personal-plan/tools/labels"

/**
 * `D8` (ruled 2026-08-24, standing rule) — schema snapshot.
 *
 * "Any change to a persisted refinement answer key, or to the meaning of the
 * completion predicate, requires a path-version bump plus a decoder."
 *
 * A rule with no enforcement is how the `toolSections` key rename AND the
 * completion-predicate change both slipped through. This file is that
 * enforcement: it pins the persisted answer keys and the completion semantics of
 * every question that has one, against `STAGE2_QUESTION_PATH_VERSION`. Adding,
 * renaming or removing a key — or changing what makes a question complete —
 * fails here until the snapshot AND the version are updated together, at which
 * point the version's decoder row in `refinement/types.ts` has to be written.
 *
 * Deliberately hand-written, not generated from the types: a snapshot derived
 * from the thing it guards guards nothing.
 */

/**
 * Bumped to 3 intentionally — Nick ruling 2026-08-26, one page per heated and
 * heatless family. `tools:heated_styling:2` and `tools:heatless_styling:2` no
 * longer exist as persisted question ids, and `tools:<family>:1` now means the
 * whole family rather than its first page. Decoder:
 * `decodeStage2CompletedQuestionIds` in
 * `persistence/stage2-refinement-supabase.ts` (row in `refinement/types.ts`).
 */
const PATH_VERSION_SNAPSHOT = 3

/**
 * The Tool capture pages, snapshotted as persisted question ids. These ARE
 * persisted keys (they land in `completed_question_ids`), so merging or
 * splitting a page is exactly the `D8` event this file guards.
 */
const TOOL_FORM_PAGE_ID_SNAPSHOT = [
  "tools:airflow:1",
  "tools:heated_styling:1",
  "tools:heatless_styling:1",
  "tools:brushes_combs:1",
  "tools:brushes_combs:2",
  "tools:securing_sectioning:1",
  "tools:securing_sectioning:2",
  "tools:wash_application:1",
  "tools:night_protection:1",
  "tools:drying_textiles:1",
]

/**
 * The persisted keys, snapshotted exhaustively.
 *
 * Typed as `Record<Stage2AnswerKey, true>` on purpose: ADDING a key to
 * `PersonalPlanRefinementAnswersV1` fails to compile here (missing property),
 * and renaming or removing one fails too (excess property). The runtime
 * assertion below then pins the same set for anyone reading the failure.
 */
const PERSISTED_ANSWER_KEY_SNAPSHOT: Record<Stage2AnswerKey, true> = {
  additionalHeatTools: true,
  currentProductCategories: true,
  dryShampooBridgePreference: true,
  dryShampooVisibleHairColor: true,
  dryingRoutes: true,
  heatEvents: true,
  nightProtection: true,
  oilPurposes: true,
  scalpIrritationDetail: true,
  toolFamiliesWithSomething: true,
  toolForms: true,
  towel: true,
  wetWashFrequency: true,
}

const PERSISTED_ANSWER_KEYS = Object.keys(PERSISTED_ANSWER_KEY_SNAPSHOT).sort()

/**
 * Which multi-select questions accept the user's explicit „Nichts davon" as a
 * completing answer, and which demand at least one value.
 *
 * This IS the completion predicate `D8` names. `drying_routes` moved from
 * `empty_completes` to `requires_one` at path version 2 (`D2`).
 */
const MULTI_SELECT_COMPLETION_SEMANTICS: Record<string, "empty_completes" | "requires_one"> = {
  current_product_categories: "empty_completes",
  oil_purposes: "requires_one",
  drying_routes: "requires_one",
  additional_heat_tools: "empty_completes",
  night_protection: "empty_completes",
  tools_overview: "empty_completes",
  "tools:brushes_combs:1": "empty_completes",
}

const CONTEXT: Stage2TriggerContext = {
  relevantCategories: [],
  hasReportedIrritatedScalp: false,
  dryShampooBridgeEligibility: "ineligible",
  toolsEnabled: true,
}

const BASE_ANSWERS: PersonalPlanRefinementAnswersV1 = {
  currentProductCategories: [],
  wetWashFrequency: "weekly_2x",
  towel: { material: "no_towel" },
  dryingRoutes: ["air_dry"],
  additionalHeatTools: [],
  nightProtection: [],
}

function completes(questionId: Stage2QuestionId, answers: PersonalPlanRefinementAnswersV1) {
  return resolveStage2RefinementContract({
    triggerContext: CONTEXT,
    answers,
    completedQuestionIds: [questionId],
  }).completedQuestionIds.includes(questionId)
}

test("D8: the persisted refinement answer keys match the snapshot for this path version", () => {
  assert.equal(
    STAGE2_QUESTION_PATH_VERSION,
    PATH_VERSION_SNAPSHOT,
    "the path version changed — update this snapshot AND add the version's decoder row in refinement/types.ts",
  )

  // Every key production can write, discovered by walking the full path with a
  // fully answered draft, must be in the snapshot.
  const answers: PersonalPlanRefinementAnswersV1 = {
    ...BASE_ANSWERS,
    currentProductCategories: ["oil", "dry_shampoo"],
    scalpIrritationDetail: "normal",
    dryShampooBridgePreference: "accept",
    dryShampooVisibleHairColor: "brown",
    oilPurposes: ["dry_finish"],
    dryingRoutes: ["ordinary_blow_dry"],
    additionalHeatTools: ["straightener"],
    heatEvents: {
      "heat:ordinary_blow_dry": { frequency: "weekly_2x" },
      "heat:straightener": { frequency: "weekly_1x", protectionConsistency: "always" },
    },
    toolFamiliesWithSomething: ["brushes_combs"],
    toolForms: { brushes_combs: ["detangling_brush", "fingers"] },
  }
  assert.deepEqual(Object.keys(answers).sort(), PERSISTED_ANSWER_KEYS)

  // And the path must not raise a question that has no snapshotted home.
  const questionIds = getOrderedQuestionIds(
    { ...CONTEXT, hasReportedIrritatedScalp: true, dryShampooBridgeEligibility: "eligible" },
    answers,
  )
  assert.ok(questionIds.length > 0)

  // The Tool capture page ids are persisted too: merging or splitting a page
  // changes what a stored completion means and needs a decoder.
  assert.deepEqual(
    TOOL_FORM_PAGES.map((page) => `tools:${page.pageKey}`),
    TOOL_FORM_PAGE_ID_SNAPSHOT,
    "a Tool capture page id changed — bump STAGE2_QUESTION_PATH_VERSION and ship a decoder (D8)",
  )
})

test("D8: multi-select completion semantics match the snapshot", () => {
  for (const [questionId, semantics] of Object.entries(MULTI_SELECT_COMPLETION_SEMANTICS)) {
    const empty = emptyAnswerFor(questionId as Stage2QuestionId)
    assert.equal(
      completes(questionId as Stage2QuestionId, { ...BASE_ANSWERS, ...empty }),
      semantics === "empty_completes",
      `${questionId} completion semantics changed — bump STAGE2_QUESTION_PATH_VERSION and ship a decoder (D8)`,
    )
  }
})

function emptyAnswerFor(questionId: Stage2QuestionId): PersonalPlanRefinementAnswersV1 {
  switch (questionId) {
    case "current_product_categories":
      return { currentProductCategories: [] }
    case "oil_purposes":
      return { currentProductCategories: ["oil"], oilPurposes: [] }
    case "drying_routes":
      return { dryingRoutes: [] }
    case "additional_heat_tools":
      return { additionalHeatTools: [] }
    case "night_protection":
      return { nightProtection: [] }
    case "tools_overview":
      return { toolFamiliesWithSomething: [] }
    default:
      return { toolFamiliesWithSomething: ["brushes_combs"], toolForms: { brushes_combs: [] } }
  }
}

test("D8: the answer-only tokens are part of the snapshotted answer shape", () => {
  // `fingers` (`D9b`) is persistable inside `toolForms.brushes_combs` and
  // nowhere else. Widening that would be a persisted-key change.
  assert.deepEqual(TOOL_ANSWER_ONLY_FORMS_BY_FAMILY, { brushes_combs: ["fingers"] })
  for (const family of TOOL_FAMILIES) {
    const tokens = TOOL_REPORTED_FORMS_BY_FAMILY[family].filter((form) => form === "fingers")
    assert.deepEqual(
      tokens,
      family === "brushes_combs" ? ["fingers"] : [],
      `${family} must not accept an answer-only token it was never given`,
    )
  }
  assert.equal(
    completes("tools:brushes_combs:1", {
      ...BASE_ANSWERS,
      toolFamiliesWithSomething: ["brushes_combs"],
      toolForms: { brushes_combs: ["fingers"] },
    }),
    true,
    "a fingers-only answer is a valid, completing brushes answer",
  )
  assert.equal(
    completes("tools:brushes_combs:1", {
      ...BASE_ANSWERS,
      toolFamiliesWithSomething: ["brushes_combs"],
      // Out of canonical order: `fingers` sorts after every real form.
      toolForms: { brushes_combs: ["fingers", "detangling_brush"] as never },
    }),
    false,
  )
})
