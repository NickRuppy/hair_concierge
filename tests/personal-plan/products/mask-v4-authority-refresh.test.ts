import assert from "node:assert/strict"
import test from "node:test"

import { CATEGORY_ROLE_POLICIES } from "../../../src/lib/personal-plan/products/authorities"
import {
  authoritySnapshotMayNeedVersionRefresh,
  authoritySnapshotNeedsVersionRefresh,
} from "../../../src/lib/personal-plan/products/authority/snapshot"
import type {
  PersonalPlanCategory,
  Stage3AuthoritySnapshotV1,
  Stage3ProductDraft,
} from "../../../src/lib/personal-plan/products/contracts"
import { buildAuthorityRefreshDraft } from "../../../src/lib/personal-plan/products/stage3-persistence-supabase"
import { createStage3Draft } from "../../../src/lib/personal-plan/products/state-machine"

function versions(): Record<PersonalPlanCategory, string> {
  return Object.fromEntries(
    Object.entries(CATEGORY_ROLE_POLICIES).map(([category, policy]) => [
      category,
      policy.authorityVersion,
    ]),
  ) as Record<PersonalPlanCategory, string>
}

function decision(category: "shampoo" | "mask") {
  if (category === "shampoo") {
    return {
      category,
      resolution: "resolved" as const,
      needTier: "basis" as const,
      roles: ["shampoo_everyday" as const],
      target: {
        category,
        roles: ["shampoo_everyday" as const],
        scalpRoute: "balanced" as const,
        everydayConstraint: "standard" as const,
        requiresTargetedDandruffCapability: false,
      },
      frequency: null,
      reasons: [],
      executionState: "available" as const,
      executionPauseReason: null,
      deferredFacts: [],
    }
  }
  return {
    category,
    resolution: "resolved" as const,
    needTier: "basis" as const,
    roles: ["intensive_conditioning_mask" as const],
    target: {
      category,
      roles: ["intensive_conditioning_mask" as const],
      needStrength: "standard" as const,
      weight: "light" as const,
      careDirection: "moisture" as const,
      repairSupportLevel: "medium" as const,
      functionalNeeds: [],
    },
    frequency: null,
    reasons: [],
    executionState: "available" as const,
    executionPauseReason: null,
    deferredFacts: [],
  }
}

function dormantDraft(): {
  draft: Stage3ProductDraft
  currentSnapshot: Stage3AuthoritySnapshotV1
} {
  const currentAuthorityVersions = versions()
  assert.equal(currentAuthorityVersions.scalp_care, "personal-plan.scalp-care.v3")
  const legacyAuthorityVersions = {
    ...currentAuthorityVersions,
    shampoo: "personal-plan.shampoo.v3",
    mask: "personal-plan.mask.v3",
    scalp_care: "personal-plan.scalp-care.v2",
  }
  const categoryDecisions = [decision("shampoo"), decision("mask")]
  const legacySnapshot: Stage3AuthoritySnapshotV1 = {
    schemaVersion: 1,
    refinedNeedVersionId: "refined-1",
    refinedInputHash: "refined-input-1",
    categoryDecisions,
    coverage: [],
    orderedCategories: ["shampoo", "mask"],
    authorityVersions: legacyAuthorityVersions,
  }
  const draft = createStage3Draft({
    draftId: "draft-1",
    userId: "owner-1",
    personalPlanId: "plan-1",
    refinedVersionId: "refined-1",
    requirements: [
      {
        category: "shampoo",
        requiredRoles: ["shampoo_everyday"],
        needSummary: "Reinigung",
        authorityVersion: "personal-plan.shampoo.v3",
      },
      {
        category: "mask",
        requiredRoles: ["intensive_conditioning_mask"],
        needSummary: "Intensive Pflege",
        authorityVersion: "personal-plan.mask.v3",
      },
    ],
    authoritySnapshot: legacySnapshot,
    now: "2026-08-15T00:00:00.000Z",
  })
  return {
    draft,
    currentSnapshot: {
      ...legacySnapshot,
      authorityVersions: currentAuthorityVersions,
    },
  }
}

test("Scalp v3 refresh accepts supported dormant Shampoo v3, Mask v3, and Scalp v2", () => {
  const { draft, currentSnapshot } = dormantDraft()

  assert.equal(authoritySnapshotMayNeedVersionRefresh(draft), true)
  assert.equal(authoritySnapshotNeedsVersionRefresh(draft, currentSnapshot), true)

  const unsupportedScalp = structuredClone(draft)
  unsupportedScalp.authoritySnapshot!.authorityVersions.scalp_care = "personal-plan.scalp-care.v1"
  assert.equal(authoritySnapshotMayNeedVersionRefresh(unsupportedScalp), false)

  const decisionOutsideOrderedCategories = structuredClone(draft)
  decisionOutsideOrderedCategories.orderedCategories = ["mask"]
  decisionOutsideOrderedCategories.authoritySnapshot!.orderedCategories = ["mask"]
  assert.equal(authoritySnapshotMayNeedVersionRefresh(decisionOutsideOrderedCategories), false)

  const changedCoverage = structuredClone(currentSnapshot)
  changedCoverage.coverage = [
    {
      job: "scalp_flake_or_comfort",
      ruleId: "forged",
      primaryCategories: ["shampoo"],
      supportingCategories: ["scalp_care"],
      outcome: "duplicate_purchase_suppressed",
    },
  ]
  assert.equal(authoritySnapshotNeedsVersionRefresh(draft, changedCoverage), false)

  assert.equal(authoritySnapshotMayNeedVersionRefresh({ ...draft, status: "completed" }), false)
})

test("Mask v4 refresh preserves capture state and reopens only authority decisions", () => {
  const { draft, currentSnapshot } = dormantDraft()
  draft.products = [
    {
      capturedProductId: "captured-mask",
      userProductId: "owned-mask",
      identity: {
        kind: "catalog_product",
        productId: "catalog-mask",
        displayName: "Meine Maske",
        category: "mask",
      },
      frequencyRange: "biweekly_1x",
      ownership: "owned",
      source: "catalog_search",
    },
  ]
  draft.roleAssignments = [
    {
      capturedProductId: "captured-mask",
      category: "mask",
      roles: ["intensive_conditioning_mask"],
    },
  ]
  draft.decisions = [
    {
      decisionKey: "decision:mask:intensive_conditioning_mask:captured-mask",
      category: "mask",
      role: "intensive_conditioning_mask",
      capturedProductId: "captured-mask",
      verdict: "ideal",
      choiceState: "owned_active",
      criterionResults: [],
      recommendation: null,
      limitationAcknowledged: false,
    },
  ]
  draft.completedDecisionKeys = [draft.decisions[0]!.decisionKey]

  const refreshed = buildAuthorityRefreshDraft(draft, currentSnapshot)

  assert.deepEqual(refreshed.products, draft.products)
  assert.deepEqual(refreshed.roleAssignments, draft.roleAssignments)
  assert.deepEqual(refreshed.decisions, [])
  assert.deepEqual(refreshed.completedDecisionKeys, [])
  assert.equal(refreshed.authorityVersions.shampoo, "personal-plan.shampoo.v4")
  assert.equal(refreshed.authorityVersions.mask, "personal-plan.mask.v4")
  assert.equal(
    refreshed.authoritySnapshot?.authorityVersions.scalp_care,
    "personal-plan.scalp-care.v3",
  )
})
