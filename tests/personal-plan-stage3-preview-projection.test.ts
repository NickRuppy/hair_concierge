import assert from "node:assert/strict"
import test from "node:test"

import type { Stage3AuthoritySemanticIntent } from "../src/lib/personal-plan/products/authority/contracts"
import type { Stage3DecisionReviewProjection } from "../src/lib/personal-plan/products/gateway"
import {
  clearDependentHeatReviewStateOnOilChange,
  isCurrentStage3PreviewGeneration,
  reconcileStage3PreviewProjection,
  shouldRefreshStage3Preview,
  stage3ProjectedFinalDecisionIntents,
} from "../src/components/personal-plan-products/stage3-preview-projection"

const oilKey = "decision:oil:leave_on_fibre_conditioning:gap"
const heatKey = "decision:heat_protectant:pre_heat_protection:gap"
const oilIntent: Stage3AuthoritySemanticIntent = {
  type: "resolve_decision",
  subjectKey: oilKey,
  action: "plan_recommendation",
  selectedCandidateId: "oil-verified",
}
const autoHeatIntent: Stage3AuthoritySemanticIntent = {
  type: "resolve_decision",
  subjectKey: heatKey,
  action: "leave_uncovered",
}
const subjects = [
  { decisionKey: oilKey, category: "oil" },
  { decisionKey: heatKey, category: "heat_protectant" },
]
const choices = { [oilKey]: { kind: "decision" as const, intent: oilIntent } }

function projection(
  autoResolvedIntents: Stage3AuthoritySemanticIntent[],
  bundleKeys: string[],
): Extract<Stage3DecisionReviewProjection, { status: "ready" }> {
  return {
    status: "ready",
    autoResolvedIntents,
    bundles: bundleKeys.map((subjectKey) => ({ authorityEvaluation: { subjectKey } }) as never),
  }
}

test("verified carrier projection preserves Oil and resolves only Heat into the final one-batch intents", () => {
  const reconciled = reconcileStage3PreviewProjection({
    subjects,
    choices,
    order: [oilKey],
    previousAutoResolvedIntents: [],
    projection: projection([autoHeatIntent], [oilKey]),
  })

  assert.deepEqual([...reconciled.locallyResolvedDecisionKeys], [heatKey])
  assert.deepEqual(reconciled.choices[oilKey], choices[oilKey])
  assert.equal(reconciled.choices[heatKey], undefined)
  assert.deepEqual(
    stage3ProjectedFinalDecisionIntents(
      reconciled.choices,
      [oilKey],
      reconciled.autoResolvedIntents,
    ),
    [oilIntent, autoHeatIntent],
  )
})

test("verified carrier projection keeps the auto Heat intent out of the persisted review draft", () => {
  const reconciled = reconcileStage3PreviewProjection({
    subjects,
    choices,
    order: [oilKey],
    previousAutoResolvedIntents: [],
    projection: projection([autoHeatIntent], [oilKey]),
  })

  assert.deepEqual(reconciled.order, [oilKey])
  assert.deepEqual(Object.keys(reconciled.choices), [oilKey])
})

test("partial projection removes a prior auto Heat resolution and leaves its bundle open", () => {
  const reconciled = reconcileStage3PreviewProjection({
    subjects,
    choices: {
      ...choices,
      [heatKey]: { kind: "decision", intent: autoHeatIntent },
    },
    order: [oilKey, heatKey],
    previousAutoResolvedIntents: [autoHeatIntent],
    projection: projection([], [oilKey, heatKey]),
  })

  assert.deepEqual([...reconciled.locallyResolvedDecisionKeys], [])
  assert.equal(reconciled.choices[heatKey], undefined)
  assert.deepEqual(reconciled.order, [oilKey])
})

test("an omitted bundle without an auto intent never hides a local subject", () => {
  const reconciled = reconcileStage3PreviewProjection({
    subjects,
    choices,
    order: [oilKey],
    previousAutoResolvedIntents: [],
    projection: projection([], []),
  })
  assert.deepEqual([...reconciled.locallyResolvedDecisionKeys], [])
})

test("an older preview generation cannot overwrite a newer local choice", () => {
  assert.equal(isCurrentStage3PreviewGeneration(1, 2), false)
  assert.equal(isCurrentStage3PreviewGeneration(2, 2), true)
  const laterChoice: Stage3AuthoritySemanticIntent = {
    type: "resolve_decision",
    subjectKey: "decision:conditioner:conditioner_rinse_out:gap",
    action: "leave_uncovered",
  }
  const latestChoices = {
    ...choices,
    [laterChoice.subjectKey]: { kind: "decision" as const, intent: laterChoice },
  }
  // The stale full-carrier response is intentionally not reconciled. The
  // current local state therefore retains the later non-Oil choice.
  const stateAfterStaleResponse = isCurrentStage3PreviewGeneration(1, 2)
    ? reconcileStage3PreviewProjection({
        subjects,
        choices,
        order: [oilKey],
        previousAutoResolvedIntents: [],
        projection: projection([autoHeatIntent], [oilKey]),
      }).choices
    : latestChoices
  assert.deepEqual(stateAfterStaleResponse, latestChoices)
})

test("a later non-Oil choice refreshes an existing planned Oil projection, while removing Oil refreshes Heat", () => {
  const conditionerKey = "decision:conditioner:conditioner_rinse_out:gap"
  const conditionerIntent: Stage3AuthoritySemanticIntent = {
    type: "resolve_decision",
    subjectKey: conditionerKey,
    action: "leave_uncovered",
  }
  const withLaterChoice = {
    ...choices,
    [conditionerKey]: { kind: "decision" as const, intent: conditionerIntent },
  }
  assert.equal(
    shouldRefreshStage3Preview({
      choices: withLaterChoice,
      leaveOnOilDecisionKeys: new Set([oilKey]),
      changedDecisionKeys: [conditionerKey],
    }),
    true,
  )
  const oilRemoved = {
    ...withLaterChoice,
    [oilKey]: {
      kind: "decision" as const,
      intent: { ...oilIntent, action: "leave_uncovered" as const },
    },
  }
  assert.equal(
    shouldRefreshStage3Preview({
      choices: oilRemoved,
      leaveOnOilDecisionKeys: new Set([oilKey]),
      changedDecisionKeys: [oilKey],
    }),
    true,
  )
})

test("changing leave-on Oil clears a previously answered Heat choice before auto-submit can see it", () => {
  const conditionerKey = "decision:conditioner:conditioner_rinse_out:gap"
  const manualHeatIntent: Stage3AuthoritySemanticIntent = {
    type: "resolve_decision",
    subjectKey: heatKey,
    action: "plan_recommendation",
  }
  const state = clearDependentHeatReviewStateOnOilChange({
    changedLeaveOnOil: true,
    subjects: [...subjects, { decisionKey: conditionerKey, category: "conditioner" }],
    choices: {
      ...choices,
      [heatKey]: { kind: "decision", intent: manualHeatIntent },
      [conditionerKey]: {
        kind: "decision",
        intent: {
          type: "resolve_decision",
          subjectKey: conditionerKey,
          action: "leave_uncovered",
        },
      },
    },
    order: [oilKey, heatKey, conditionerKey],
  })

  assert.equal(state.choices[heatKey], undefined)
  assert.deepEqual(state.order, [oilKey, conditionerKey])
  assert.ok(state.choices[oilKey])
  assert.ok(state.choices[conditionerKey])
})
