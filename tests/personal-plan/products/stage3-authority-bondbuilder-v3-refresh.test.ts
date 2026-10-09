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

function bondbuilderDecision() {
  return {
    category: "bondbuilder" as const,
    resolution: "resolved" as const,
    needTier: "basis" as const,
    roles: ["specialized_bond_treatment" as const],
    target: {
      category: "bondbuilder" as const,
      roles: ["specialized_bond_treatment" as const],
      requiredFunction: "support_stressed_hair_resilience" as const,
      mechanismTarget: "mechanism_neutral" as const,
    },
    frequency: null,
    reasons: [],
    executionState: "available" as const,
    executionPauseReason: null,
    deferredFacts: [],
  }
}

function legacyBondbuilderDraft(): {
  draft: Stage3ProductDraft
  currentSnapshot: Stage3AuthoritySnapshotV1
} {
  const currentAuthorityVersions = versions()
  assert.equal(currentAuthorityVersions.bondbuilder, "personal-plan.bondbuilder.v3")
  const legacyAuthorityVersions = {
    ...currentAuthorityVersions,
    bondbuilder: "personal-plan.bondbuilder.v2",
  }
  const legacySnapshot: Stage3AuthoritySnapshotV1 = {
    schemaVersion: 1,
    refinedNeedVersionId: "refined-1",
    refinedInputHash: "refined-input-1",
    categoryDecisions: [bondbuilderDecision()],
    coverage: [],
    orderedCategories: ["bondbuilder"],
    authorityVersions: legacyAuthorityVersions,
  }
  const draft = createStage3Draft({
    draftId: "draft-1",
    userId: "owner-1",
    personalPlanId: "plan-1",
    refinedVersionId: "refined-1",
    requirements: [
      {
        category: "bondbuilder",
        requiredRoles: ["specialized_bond_treatment"],
        needSummary: "Bond-Aufbau",
        authorityVersion: "personal-plan.bondbuilder.v2",
      },
    ],
    authoritySnapshot: legacySnapshot,
    now: "2026-10-06T00:00:00.000Z",
  })
  return {
    draft,
    currentSnapshot: {
      ...legacySnapshot,
      authorityVersions: currentAuthorityVersions,
    },
  }
}

test("Bondbuilder v3 refresh accepts exactly an active v2 snapshot", () => {
  const { draft, currentSnapshot } = legacyBondbuilderDraft()

  assert.equal(authoritySnapshotMayNeedVersionRefresh(draft), true)
  assert.equal(authoritySnapshotNeedsVersionRefresh(draft, currentSnapshot), true)

  const earlierVersion = structuredClone(draft)
  earlierVersion.authoritySnapshot!.authorityVersions.bondbuilder = "personal-plan.bondbuilder.v1"
  assert.equal(authoritySnapshotMayNeedVersionRefresh(earlierVersion), false)

  const futureVersion = structuredClone(draft)
  futureVersion.authoritySnapshot!.authorityVersions.bondbuilder = "personal-plan.bondbuilder.v4"
  assert.equal(authoritySnapshotMayNeedVersionRefresh(futureVersion), false)

  assert.equal(authoritySnapshotMayNeedVersionRefresh({ ...draft, status: "completed" }), false)
})

test("Bondbuilder v3 refresh preserves capture state and reopens only authority decisions", () => {
  const { draft, currentSnapshot } = legacyBondbuilderDraft()
  draft.products = [
    {
      capturedProductId: "captured-bondbuilder",
      userProductId: "owned-bondbuilder",
      identity: {
        kind: "catalog_product",
        productId: "catalog-bondbuilder",
        displayName: "Mein Bondbuilder",
        category: "bondbuilder",
      },
      frequencyRange: "weekly_1x",
      ownership: "owned",
      source: "catalog_search",
    },
  ]
  draft.roleAssignments = [
    {
      capturedProductId: "captured-bondbuilder",
      category: "bondbuilder",
      roles: ["specialized_bond_treatment"],
    },
  ]
  draft.decisions = [
    {
      decisionKey: "decision:bondbuilder:specialized_bond_treatment:captured-bondbuilder",
      category: "bondbuilder",
      role: "specialized_bond_treatment",
      capturedProductId: "captured-bondbuilder",
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
  assert.equal(refreshed.authorityVersions.bondbuilder, "personal-plan.bondbuilder.v3")
  assert.equal(
    refreshed.authoritySnapshot?.authorityVersions.bondbuilder,
    "personal-plan.bondbuilder.v3",
  )
})
