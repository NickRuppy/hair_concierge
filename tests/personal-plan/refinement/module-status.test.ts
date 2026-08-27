import assert from "node:assert/strict"
import test from "node:test"

import { buildDirectAcceptanceStage2Defaults } from "@/lib/personal-plan/direct-acceptance/defaults"
import { buildAssumedAnswerProvenance } from "@/lib/personal-plan/refinement/answer-provenance"
import {
  stage2AssumptionsActive,
  stage2ModuleStates,
} from "@/lib/personal-plan/refinement/module-status"
import { getStage2QuestionModule } from "@/lib/personal-plan/refinement/question-path"
import type {
  Stage2AnswerProvenance,
  Stage2QuestionId,
  Stage2TriggerContext,
} from "@/lib/personal-plan/refinement/types"

/**
 * The derived replacement for the `unrefined_direct_accept` flag: "the plan
 * still runs on assumptions" must be a function of what the USER answered per
 * module, never of a boolean somebody remembered to clear.
 */

const TRIGGER_CONTEXT: Stage2TriggerContext = {
  relevantCategories: ["shampoo", "conditioner"],
  hasReportedIrritatedScalp: false,
  dryShampooBridgeEligibility: "ineligible",
}

function defaults() {
  return buildDirectAcceptanceStage2Defaults(TRIGGER_CONTEXT)
}

function provenanceFor(
  completedQuestionIds: readonly Stage2QuestionId[],
  userModules: readonly ("products" | "habits")[],
): Stage2AnswerProvenance {
  const provenance: Stage2AnswerProvenance = {}
  for (const id of completedQuestionIds) {
    provenance[id] = userModules.includes(getStage2QuestionModule(id)) ? "user" : "assumed"
  }
  return provenance
}

test("a fully auto-accepted draft leaves both modules open and assumptions active", () => {
  const { answers, completedQuestionIds } = defaults()
  const input = {
    triggerContext: TRIGGER_CONTEXT,
    answers,
    completedQuestionIds,
    answerProvenance: buildAssumedAnswerProvenance(completedQuestionIds),
  }

  const states = stage2ModuleStates(input)
  assert.equal(states.products.status, "open")
  assert.equal(states.habits.status, "open")
  assert.equal(stage2AssumptionsActive(input), true)
})

test("a draft the user answered end to end has no open module and no assumptions", () => {
  const { answers, completedQuestionIds } = defaults()
  const input = {
    triggerContext: TRIGGER_CONTEXT,
    answers,
    completedQuestionIds,
    answerProvenance: provenanceFor(completedQuestionIds, ["products", "habits"]),
  }

  const states = stage2ModuleStates(input)
  assert.equal(states.products.status, "complete")
  assert.equal(states.habits.status, "complete")
  assert.equal(stage2AssumptionsActive(input), false)
})

test("one user-answered module keeps assumptions active while the other stays open", () => {
  const { answers, completedQuestionIds } = defaults()
  const input = {
    triggerContext: TRIGGER_CONTEXT,
    answers,
    completedQuestionIds,
    answerProvenance: provenanceFor(completedQuestionIds, ["products"]),
  }

  const states = stage2ModuleStates(input)
  assert.equal(states.products.status, "complete")
  assert.equal(states.habits.status, "open")
  assert.ok(states.habits.openQuestionIds.length > 0)
  assert.equal(stage2AssumptionsActive(input), true)
})

test("an untouched draft runs on assumptions", () => {
  const input = {
    triggerContext: TRIGGER_CONTEXT,
    answers: {},
    completedQuestionIds: [] as Stage2QuestionId[],
    answerProvenance: {},
  }

  assert.equal(stage2AssumptionsActive(input), true)
})

test("legacy answers without a provenance entry count as user answers", () => {
  const { answers, completedQuestionIds } = defaults()

  assert.equal(
    stage2AssumptionsActive({
      triggerContext: TRIGGER_CONTEXT,
      answers,
      completedQuestionIds,
      answerProvenance: {},
    }),
    false,
  )
})
