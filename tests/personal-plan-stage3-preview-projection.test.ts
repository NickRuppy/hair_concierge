import assert from "node:assert/strict"
import test from "node:test"

import type {
  Stage3AuthorityEvaluation,
  Stage3AuthoritySemanticIntent,
} from "../src/lib/personal-plan/products/authority/contracts"
import type { Stage3FitComparison } from "../src/lib/personal-plan/products/fit-comparison"
import type { Stage3DecisionReviewProjection } from "../src/lib/personal-plan/products/gateway"
import type { Stage3ReviewDraftChoice } from "../src/lib/personal-plan/products/review-draft"
import {
  clearDependentHeatReviewStateOnOilChange,
  isCurrentStage3PreviewGeneration,
  mergeStage3PreviewBundles,
  reconcileStage3PreviewProjection,
  retainStage3ChoicesAllowedByBundles,
  shouldRefreshStage3Preview,
  stage3DecisionIntentStillAllowed,
  stage3ProjectedFinalDecisionIntents,
  type Stage3PreviewReviewBundle,
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

/* ------------------------------------------------ budget: whole-proposal projection */

const CONDITIONER = "decision:conditioner:conditioner_rinse_out:gap"
const MASK = "decision:mask:intensive_conditioning_mask:gap"

function bundle(
  subjectKey: string,
  category: Stage3AuthorityEvaluation["category"],
  alternatives: string[],
  budget: Partial<Stage3FitComparison> = {},
): Stage3PreviewReviewBundle {
  return {
    authorityEvaluation: {
      status: "known",
      category,
      subjectKey,
      verdict: "unknown",
      criteria: [],
      allowedActions: ["leave_uncovered"],
      recommendation: null,
      productFactFingerprint: null,
      recommendationFactFingerprint: null,
      coverageRuleIds: ["rule"],
    } as Stage3AuthorityEvaluation,
    fitComparison: {
      subjectKey,
      alternatives: alternatives.map((productId) => ({
        productId,
        factFingerprint: `facts:${productId}`,
      })),
      ...budget,
    } as unknown as Stage3FitComparison,
  }
}

function replacement(
  subjectKey: string,
  productId: string,
): Extract<Stage3ReviewDraftChoice, { kind: "decision" }> {
  return {
    kind: "decision",
    intent: {
      type: "resolve_decision",
      subjectKey,
      action: "select_replacement",
      selectedCandidateId: productId,
      selectedCandidateFactFingerprint: `facts:${productId}`,
    },
  }
}

test("without a budget only Oil choices refresh the projection (unchanged behaviour)", () => {
  const choices = { [CONDITIONER]: replacement(CONDITIONER, "x") }
  assert.equal(
    shouldRefreshStage3Preview({
      choices,
      leaveOnOilDecisionKeys: new Set([oilKey]),
      changedDecisionKeys: [CONDITIONER],
    }),
    false,
  )
  assert.equal(
    shouldRefreshStage3Preview({
      choices,
      leaveOnOilDecisionKeys: new Set([oilKey]),
      changedDecisionKeys: [CONDITIONER],
      budgetActive: false,
    }),
    false,
  )
})

test("with a budget every changed product decision refreshes; dispositions alone do not", () => {
  assert.equal(
    shouldRefreshStage3Preview({
      choices: { [CONDITIONER]: replacement(CONDITIONER, "x") },
      leaveOnOilDecisionKeys: new Set(),
      changedDecisionKeys: [CONDITIONER],
      budgetActive: true,
    }),
    true,
  )
  assert.equal(
    shouldRefreshStage3Preview({
      choices: {
        "disposition:1": { kind: "inventory_disposition", dispositionKey: "disposition:1" },
      },
      leaveOnOilDecisionKeys: new Set(),
      changedDecisionKeys: ["disposition:1"],
      budgetActive: true,
    }),
    false,
  )
})

test("merging: without a budget only Heat is replaced; with a budget every role bundle is", () => {
  const current = new Map([
    [CONDITIONER, bundle(CONDITIONER, "conditioner", ["a", "x"], { defaultProductId: "a" })],
    [MASK, bundle(MASK, "mask", ["m1", "m2"], { defaultProductId: "m2" })],
    [heatKey, bundle(heatKey, "heat_protectant", ["h1"])],
  ])
  const projection = {
    status: "ready" as const,
    autoResolvedIntents: [],
    bundles: [
      bundle(MASK, "mask", ["m1", "m2"], {
        defaultProductId: "m1",
        budgetNotice: "allowance_used_elsewhere",
      }),
      bundle(heatKey, "heat_protectant", ["h2"]),
    ],
  }
  const plain = mergeStage3PreviewBundles({ current, projection, budgetActive: false })
  assert.equal(plain.get(MASK)?.fitComparison.defaultProductId, "m2")
  assert.equal(plain.get(heatKey)?.fitComparison.alternatives[0]?.productId, "h2")

  const budgeted = mergeStage3PreviewBundles({ current, projection, budgetActive: true })
  assert.equal(budgeted.get(MASK)?.fitComparison.defaultProductId, "m1")
  assert.equal(budgeted.get(MASK)?.fitComparison.budgetNotice, "allowance_used_elsewhere")
  assert.equal(budgeted.get(heatKey)?.fitComparison.alternatives[0]?.productId, "h2")
  // A role the projection did not return keeps its bundle.
  assert.equal(budgeted.get(CONDITIONER)?.fitComparison.defaultProductId, "a")
})

test("retaining: own choices survive a new default; only a no-longer-offered one is dropped", () => {
  const reviews = new Map([
    [CONDITIONER, bundle(CONDITIONER, "conditioner", ["a", "x"], { defaultProductId: "a" })],
    [MASK, bundle(MASK, "mask", ["m1"], { defaultProductId: "m1" })],
  ])
  const choices = {
    [CONDITIONER]: replacement(CONDITIONER, "x"),
    [MASK]: replacement(MASK, "m2"),
    "disposition:1": {
      kind: "inventory_disposition" as const,
      dispositionKey: "disposition:1",
    },
  }
  assert.equal(stage3DecisionIntentStillAllowed(reviews, choices[CONDITIONER].intent), true)
  assert.equal(stage3DecisionIntentStillAllowed(reviews, choices[MASK].intent), false)

  const retained = retainStage3ChoicesAllowedByBundles({
    choices,
    order: [CONDITIONER, MASK, "disposition:1"],
    reviews,
  })
  assert.deepEqual(Object.keys(retained.choices), [CONDITIONER, "disposition:1"])
  assert.deepEqual(retained.order, [CONDITIONER, "disposition:1"])
  assert.deepEqual(retained.droppedKeys, [MASK])
})
