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
import { authorityDecisionIntent } from "../src/components/personal-plan-products/stage3-decision-controller"

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

test("Stage 3 decision controller keeps every Oil role for explicit review", () => {
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

  assert.equal(evaluations.length, 2)
  assert.deepEqual(
    deriveStage3DecisionSubjects(draft).map((subject) => subject.role),
    ["pre_wash_fibre_treatment", "dry_finish"],
  )
})

test("authority decision intents preserve a selected replacement candidate", () => {
  assert.deepEqual(
    authorityDecisionIntent(
      "decision:oil:dry_finish:capture-1",
      "select_replacement",
      "candidate-1",
      "facts-candidate-1",
    ),
    {
      type: "resolve_decision",
      subjectKey: "decision:oil:dry_finish:capture-1",
      action: "select_replacement",
      selectedCandidateId: "candidate-1",
      selectedCandidateFactFingerprint: "facts-candidate-1",
    },
  )
  assert.throws(
    () =>
      authorityDecisionIntent(
        "decision:oil:dry_finish:capture-1",
        "select_replacement",
        "candidate-1",
      ),
    /requires the viewed candidate and fact fingerprint/,
  )
})
