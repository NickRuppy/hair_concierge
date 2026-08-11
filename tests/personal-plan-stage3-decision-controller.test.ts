import assert from "node:assert/strict"
import test from "node:test"

import { CATEGORY_ROLE_POLICIES } from "../src/lib/personal-plan/products/authorities"
import type { Stage3AuthorityEvaluation } from "../src/lib/personal-plan/products/authority/contracts"
import {
  deriveStage3DecisionSubjects,
  type Stage3EntryContext,
  type Stage3ProductDraft,
} from "../src/lib/personal-plan/products/contracts"
import { createStage3Draft } from "../src/lib/personal-plan/products/state-machine"
import {
  automaticAuthorityOutcomes,
  automaticOutcomeIntents,
  clearFitDecisions,
  hasUnresolvedDecisionSubjects,
} from "../src/components/personal-plan-products/stage3-decision-controller"

function oilDecisionDraft(): Stage3ProductDraft {
  const requirements: Stage3EntryContext["orderedCategories"] = [
    {
      category: "oil",
      requiredRoles: ["pre_wash_fibre_treatment", "dry_finish"],
      needSummary: "Schutz und Finish",
      authorityVersion: CATEGORY_ROLE_POLICIES.oil.authorityVersion,
    },
  ]
  return {
    ...createStage3Draft({
      draftId: "draft-controller-oil",
      userId: "user-controller-oil",
      personalPlanId: "plan-controller-oil",
      refinedVersionId: "refined-controller-oil",
      requirements,
      now: "2026-08-11T00:00:00.000Z",
    }),
    pass: "product_decisions",
    categoryCursor: null,
    products: [
      {
        capturedProductId: "capture-controller-oil",
        userProductId: "product-controller-oil",
        identity: {
          kind: "catalog_product",
          productId: "catalog-controller-oil",
          displayName: "Leichtes Haaröl",
          category: "oil",
        },
        frequencyRange: "weekly_2x",
        ownership: "owned",
        source: "catalog_search",
      },
    ],
    roleAssignments: [
      {
        capturedProductId: "capture-controller-oil",
        category: "oil",
        roles: ["dry_finish"],
      },
    ],
    uncoveredRoles: [
      { category: "oil", role: "pre_wash_fibre_treatment", reason: "not_ready_to_decide" },
    ],
  }
}

test("Stage 3 decision controller separates automatic Oil outcomes from user-facing clear fits", () => {
  const draft = oilDecisionDraft()
  const evaluations = deriveStage3DecisionSubjects(draft).map(
    (subject): Stage3AuthorityEvaluation =>
      subject.subjectKind === "uncovered_role"
        ? {
            status: "known",
            category: "oil",
            subjectKey: subject.decisionKey,
            verdict: "unknown",
            criteria: [],
            allowedActions: ["leave_uncovered"],
            recommendation: null,
            productFactFingerprint: null,
            recommendationFactFingerprint: null,
            coverageRuleIds: [],
          }
        : {
            status: "known",
            category: "oil",
            subjectKey: subject.decisionKey,
            verdict: "ideal",
            criteria: [],
            allowedActions: ["keep_owned"],
            recommendation: null,
            productFactFingerprint: "facts:oil",
            recommendationFactFingerprint: null,
            coverageRuleIds: [],
          },
  )

  const automatic = automaticAuthorityOutcomes(draft, evaluations)
  assert.equal(hasUnresolvedDecisionSubjects(draft), true)
  assert.deepEqual(
    automatic.map(({ action }) => action),
    ["leave_uncovered", "keep_owned"],
  )
  assert.deepEqual(
    automaticOutcomeIntents(automatic).map((intent) => intent.action),
    ["leave_uncovered", "keep_owned"],
  )
  assert.deepEqual(
    clearFitDecisions(draft, evaluations).map(({ subject }) => subject.role),
    ["dry_finish"],
  )
})
