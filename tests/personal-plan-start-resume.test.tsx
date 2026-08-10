import assert from "node:assert/strict"
import test from "node:test"
import type React from "react"
import { renderToStaticMarkup } from "react-dom/server"

import { resolvePlanStartPageState, type PlanStartPageDeps } from "../src/app/plan-start/page"
import {
  loadPlanStartStage3Bootstrap,
  PlanStartProductionGate,
  recoverPlanStartStage3Load,
  shouldRequestPlanStartOnMount,
  stage3LoadRecoveryMode,
} from "../src/components/personal-plan-start/plan-start-flow"
import {
  deriveRefinementEntryMode,
  RefinementFlow,
  shouldReturnToStage1FromQuestion,
} from "../src/components/personal-plan-refinement/refinement-flow"
import { shouldLoadStage3DraftOnMount } from "../src/components/personal-plan-products/stage3-products-flow"
import {
  loadExistingStage2RefinementSession,
  type Stage2PersistedDraft,
} from "../src/lib/personal-plan/persistence/stage2-refinement-service"
import {
  Stage3ProductsGatewayError,
  type Stage3DraftResponse,
  type Stage3ProductsGateway,
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
    personalPlanId: "plan-1",
    initialRefinementSession: refinementSession("in_progress"),
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
    personalPlanId: "plan-1",
    initialRefinementSession: refinementSession("complete", "refined-1"),
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
    personalPlanId: "plan-1",
    initialRefinementSession: refinementSession("complete", "refined-1"),
  })
})

test("server-hydrated Stage 1 skips the duplicate browser GET while retry/direct entry may load", () => {
  assert.equal(shouldRequestPlanStartOnMount({ basis: {} as never, optional: null }), false)
  assert.equal(shouldRequestPlanStartOnMount(undefined), true)
})

test("a stale Stage 3 source retries through the server frontier instead of the stale version", () => {
  let stage3Retries = 0
  let frontierReloads = 0
  const recover = (error: unknown) =>
    recoverPlanStartStage3Load(stage3LoadRecoveryMode(error), {
      retryStage3: () => {
        stage3Retries += 1
      },
      reloadServerFrontier: () => {
        frontierReloads += 1
      },
    })

  recover(new Stage3ProductsGatewayError("stale_refined_source"))
  assert.deepEqual({ stage3Retries, frontierReloads }, { stage3Retries: 0, frontierReloads: 1 })

  recover(new Stage3ProductsGatewayError("temporarily_unavailable"))
  assert.deepEqual({ stage3Retries, frontierReloads }, { stage3Retries: 1, frontierReloads: 1 })
})

test("a transient server Stage 1 preload failure preserves the browser retry path", async () => {
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
    loadExistingRefinementSession: async () => null,
    loadStage1Plan: async () => {
      throw new Error("temporary Stage 1 failure")
    },
  }

  assert.deepEqual(await resolvePlanStartPageState(deps), {
    state: "production",
    initialJourney: { stage: "stage1" },
  })
})

test("direct Stage 2 entry opens a new session immediately but preserves partial resume", () => {
  const fresh = refinementSession("in_progress")
  fresh.answers = {}
  fresh.completedQuestionIds = []
  fresh.path.completedQuestionIds = []
  fresh.path.firstUnresolvedQuestionId = "current_product_categories"

  assert.equal(deriveRefinementEntryMode(fresh, true), "question")
  assert.equal(deriveRefinementEntryMode(fresh, false), "invitation")
  assert.equal(deriveRefinementEntryMode(refinementSession("in_progress"), true), "resume")
  assert.equal(
    shouldReturnToStage1FromQuestion({
      session: fresh,
      activeQuestionId: "current_product_categories",
      directEntry: true,
    }),
    true,
  )
  assert.equal(
    deriveRefinementEntryMode(refinementSession("complete", "refined-1"), true),
    "bridge",
  )
})

test("a server-seeded Stage 2 resumer renders the saved position on first paint", () => {
  let clientLoads = 0
  const initialSession = refinementSession("in_progress")
  const props = {
    gateway: {
      load: async () => {
        clientLoads += 1
        return initialSession
      },
      saveAnswer: async () => initialSession,
      complete: async () => {
        throw new Error("not used")
      },
    },
    initialSession,
  } as React.ComponentProps<typeof RefinementFlow>

  const html = renderToStaticMarkup(<RefinementFlow {...props} />)

  assert.match(html, /Du machst bei der ersten offenen Frage weiter\./)
  assert.match(html, /Nasswasch-Rhythmus/)
  assert.equal(clientLoads, 0)
})

test("the production gate bypasses Stage 1 for a valid server-selected Stage 2 resume", () => {
  const initialSession = refinementSession("in_progress")
  const html = renderToStaticMarkup(
    <PlanStartProductionGate
      initialJourney={{ stage: "stage2" }}
      personalPlanId="plan-1"
      initialRefinementSession={initialSession}
    />,
  )

  assert.match(html, /Wir laden deine Verfeinerung\./)
  assert.match(html, /Du machst bei der ersten offenen Frage weiter\./)
  assert.doesNotMatch(html, /Dein Bedarfsplan entsteht/)
})

test("the Stage 2 handoff performs one Stage 3 GET and returns reusable bootstrap authority", async () => {
  let received: Parameters<Stage3ProductsGateway["loadOrCreate"]>[0] | null = null
  let requestCount = 0
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
  const response: Stage3DraftResponse & { authorityEvaluations: [] } = {
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
    authorityEvaluations: [],
  }
  const authorityDraft = { ...response, authorityEvaluations: [] }
  const gateway: Pick<Stage3ProductsGateway, "loadOrCreate"> = {
    loadOrCreate: async (input) => {
      requestCount += 1
      received = input
      return authorityDraft
    },
  }

  const bootstrap = await loadPlanStartStage3Bootstrap({
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
  assert.equal(requestCount, 1)
  assert.equal(bootstrap.entryContext.refinedVersionId, "refined-1")
  assert.equal(bootstrap.entryContext.authoritySnapshot?.refinedInputHash, "hash-1")
  assert.deepEqual(bootstrap.requirements, response.requirements)
  assert.equal(bootstrap.draft, response.draft)
  assert.deepEqual(bootstrap.authorityEvaluations, [])
  assert.equal(shouldLoadStage3DraftOnMount(bootstrap), false)
  assert.equal(shouldLoadStage3DraftOnMount(undefined), true)
})
