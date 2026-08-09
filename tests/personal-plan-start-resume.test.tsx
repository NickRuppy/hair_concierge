import assert from "node:assert/strict"
import test from "node:test"

import { resolvePlanStartPageState, type PlanStartPageDeps } from "../src/app/plan-start/page"
import { loadPlanStartStage3Entry } from "../src/components/personal-plan-start/plan-start-flow"
import {
  loadExistingStage2RefinementSession,
  type Stage2PersistedDraft,
} from "../src/lib/personal-plan/persistence/stage2-refinement-service"
import type {
  Stage3DraftResponse,
  Stage3ProductsGateway,
} from "../src/lib/personal-plan/products/gateway"
import type { Stage2RefinementSession } from "../src/lib/personal-plan/refinement/session"

const allowed = {
  stage1: true,
  stage2: true,
  stage3: false,
  stage4: false,
  stage5: false,
} as const

function refinementSession(
  status: "in_progress" | "complete",
  refinedVersionId?: string,
): Stage2RefinementSession {
  return {
    schemaVersion: 1,
    pathVersion: "stage2-v1",
    revision: status === "in_progress" ? 1 : 10,
    status,
    triggerContext: {
      relevantCategories: ["shampoo"],
      hasReportedIrritatedScalp: false,
      dryShampooBridgeEligibility: "ineligible",
    },
    answers: { currentProductCategories: ["shampoo"] },
    completedQuestionIds: ["current_product_categories"],
    path: {
      orderedQuestionIds: ["current_product_categories", "wet_wash_frequency"],
      requiredQuestionIds: ["current_product_categories", "wet_wash_frequency"],
      completedQuestionIds: ["current_product_categories"],
      firstUnresolvedQuestionId: status === "in_progress" ? "wet_wash_frequency" : null,
      prunedAnswerKeys: [],
    },
    completedHandoff:
      status === "complete" && refinedVersionId
        ? { refinedVersionId, nextHref: "/plan-start" }
        : undefined,
  }
}

type ResumeAwareDeps = PlanStartPageDeps & {
  loadExistingRefinementSession: (userId: string) => Promise<Stage2RefinementSession | null>
}

test("the passive Stage 2 resume read preserves the exact saved question position", async () => {
  const draft: Stage2PersistedDraft = {
    id: "draft-1",
    personalPlanId: "plan-1",
    baseInitialNeedVersionId: "initial-1",
    schemaVersion: 1,
    preparedArtifactSourceId: "artifact-1",
    baseInputSnapshot: {},
    pathVersion: "stage2-v1",
    triggerContext: {
      relevantCategories: ["shampoo"],
      hasReportedIrritatedScalp: false,
      dryShampooBridgeEligibility: "ineligible",
    },
    answers: { currentProductCategories: ["shampoo"] },
    completedQuestionIds: ["current_product_categories"],
    revision: 1,
    status: "in_progress",
    refinedVersionId: null,
  }

  const loaded = await loadExistingStage2RefinementSession({
    userId: "owner-1",
    persistence: { loadExisting: async () => draft },
  })

  assert.equal(loaded?.revision, 1)
  assert.deepEqual(loaded?.answers.currentProductCategories, ["shampoo"])
  assert.equal(loaded?.path.firstUnresolvedQuestionId, "wet_wash_frequency")
})

test("plan-start stays at Stage 1 when refinement has not created a persisted session", async () => {
  let resumeReads = 0
  const deps: ResumeAwareDeps = {
    enabled: () => true,
    stage2Enabled: () => true,
    getUserId: async () => "owner-1",
    loadJourneyAccess: async () => ({
      kind: "personal_plan",
      personalPlanId: "plan-1",
      frontier: "stage2",
      nextHref: "/plan-start",
      allowed,
    }),
    loadExistingRefinementSession: async () => {
      resumeReads += 1
      return null
    },
  }

  assert.deepEqual(await resolvePlanStartPageState(deps), {
    state: "production",
    initialJourney: { stage: "stage1" },
  })
  assert.equal(resumeReads, 1)
})

test("plan-start re-entry selects the persisted Stage 2 session after the first saved answer", async () => {
  const deps: ResumeAwareDeps = {
    enabled: () => true,
    stage2Enabled: () => true,
    getUserId: async () => "owner-1",
    loadJourneyAccess: async () => ({
      kind: "personal_plan",
      personalPlanId: "plan-1",
      frontier: "stage2",
      nextHref: "/plan-start",
      allowed,
    }),
    loadExistingRefinementSession: async () => refinementSession("in_progress"),
  }

  assert.deepEqual(await resolvePlanStartPageState(deps), {
    state: "production",
    initialJourney: { stage: "stage2" },
  })
})

test("plan-start re-entry selects Stage 3 when refinement is complete and current authority exists", async () => {
  const deps: ResumeAwareDeps = {
    enabled: () => true,
    stage2Enabled: () => true,
    getUserId: async () => "owner-1",
    loadJourneyAccess: async () => ({
      kind: "personal_plan",
      personalPlanId: "plan-1",
      frontier: "stage3",
      nextHref: "/plan-start",
      allowed: { ...allowed, stage3: true },
    }),
    loadExistingRefinementSession: async () => refinementSession("complete", "refined-1"),
  }

  assert.deepEqual(await resolvePlanStartPageState(deps), {
    state: "production",
    initialJourney: { stage: "stage3", refinedVersionId: "refined-1" },
  })
})

test("completed refinement remains at the Stage 2 bridge until Stage 3 authority is ready", async () => {
  const deps: ResumeAwareDeps = {
    enabled: () => true,
    stage2Enabled: () => true,
    getUserId: async () => "owner-1",
    loadJourneyAccess: async () => ({
      kind: "personal_plan",
      personalPlanId: "plan-1",
      frontier: "stage2",
      nextHref: "/plan-start",
      allowed,
    }),
    loadExistingRefinementSession: async () => refinementSession("complete", "refined-1"),
  }

  assert.deepEqual(await resolvePlanStartPageState(deps), {
    state: "production",
    initialJourney: { stage: "stage2" },
  })
})

test("the Stage 3 re-entry loader requests and returns the exact persisted authority", async () => {
  let received: Parameters<Stage3ProductsGateway["loadOrCreate"]>[0] | null = null
  const authorityVersions = {
    shampoo: "shampoo-v1",
    conditioner: "conditioner-v1",
    leave_in: "leave-in-v1",
    heat_protectant: "heat-protectant-v1",
    oil: "oil-v1",
    mask: "mask-v1",
    scalp_care: "scalp-care-v1",
    dry_shampoo: "dry-shampoo-v1",
    bondbuilder: "bondbuilder-v1",
    deep_cleansing_shampoo: "deep-cleansing-v1",
  }
  const response: Stage3DraftResponse = {
    status: "active",
    requirements: [
      {
        category: "shampoo",
        requiredRoles: ["shampoo_everyday"],
        needSummary: "Sanfte Reinigung",
        authorityVersion: "shampoo-v1",
      },
    ],
    draft: {
      schemaVersion: 1,
      status: "active",
      authorityVersions,
      draftId: "draft-3",
      userId: "owner-1",
      personalPlanId: "plan-1",
      refinedVersionId: "refined-1",
      staleRefinedVersionId: null,
      revision: 3,
      pass: "product_capture",
      orderedCategories: ["shampoo"],
      categoryCursor: "shampoo",
      products: [],
      roleAssignments: [],
      uncoveredRoles: [],
      decisions: [],
      completedCaptureCategories: [],
      completedDecisionKeys: [],
      createdAt: "2026-08-09T10:00:00.000Z",
      updatedAt: "2026-08-09T10:05:00.000Z",
      authoritySnapshot: {
        schemaVersion: 1,
        refinedNeedVersionId: "refined-1",
        refinedInputHash: "hash-1",
        categoryDecisions: [],
        coverage: [],
        orderedCategories: ["shampoo"],
        authorityVersions,
      },
    },
  }
  const gateway: Pick<Stage3ProductsGateway, "loadOrCreate"> = {
    loadOrCreate: async (input) => {
      received = input
      return response
    },
  }

  const entry = await loadPlanStartStage3Entry({
    gateway,
    personalPlanId: "plan-1",
    refinedVersionId: "refined-1",
  })

  assert.deepEqual(received, {
    draftId: "client-derived",
    userId: "client-derived",
    personalPlanId: "plan-1",
    refinedVersionId: "refined-1",
    requirements: [],
  })
  assert.equal(entry.refinedVersionId, "refined-1")
  assert.equal(entry.authoritySnapshot?.refinedInputHash, "hash-1")
  assert.deepEqual(entry.orderedCategories, response.requirements)
})
