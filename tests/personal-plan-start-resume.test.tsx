import assert from "node:assert/strict"
import test from "node:test"
import type React from "react"
import { renderToStaticMarkup } from "react-dom/server"

import {
  parseRefineParam,
  resolvePlanStartPageState,
  type PlanStartPageDeps,
} from "../src/app/plan-start/page"
import {
  completeStage2ProductKindCorrection,
  loadPlanStartStage2HandoffBootstrap,
  loadPlanStartStage3Bootstrap,
  planStartStage3BootstrapMode,
  PlanStartProductionGate,
  recoverPlanStartStage3Load,
  refinementAutoHandoffEnabled,
  shouldRequestPlanStartOnMount,
  Stage3ProductKindCorrectionError,
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
import { Stage2RefinementError } from "../src/lib/personal-plan/refinement/gateway"
import type { PersonalPlanJourneyAccess } from "../src/lib/personal-plan/journey-access"
import type { Stage2RefinementSession } from "../src/lib/personal-plan/refinement/session"
import { readFileSync } from "node:fs"

const allowed = {
  stage1: true,
  stage2: true,
  stage3: false,
  stage4: false,
  stage5: false,
} as const

test("direct Stage 3 entry and retry install the same once-per-journey analytics bootstrap", () => {
  const source = readFileSync("src/components/personal-plan-start/plan-start-flow.tsx", "utf8")
  assert.match(
    source,
    /installNewStage3Bootstrap\(await loadStage3Bootstrap\(initialJourney\.refinedVersionId\)\)/,
  )
  assert.match(source, /installNewStage3Bootstrap\(loaded\)/)
  assert.equal(
    source.match(/stage3BaselineAnalytics\.track\("personal_plan_stage3_journey_started", \{\}\)/g)
      ?.length,
    1,
  )
})

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
    answerProvenance: { current_product_categories: "user" },
    moduleProjections: {},
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

test("a first visit offers direct acceptance before the Stage 1 snapshot exists", async () => {
  // Access is read before `loadStage1Plan` creates the Stage-1 snapshot, so a
  // fresh buyer is still pre-`stage2` at this point — in both shapes that can
  // produce. Neither may cost them the accept button on the fork.
  const firstVisitAccessShapes: PlanStartPageDeps["loadJourneyAccess"][] = [
    async () => ({
      kind: "personal_plan_start",
      frontier: "stage1",
      nextHref: "/plan-start",
      allowed: { stage1: true, stage2: false, stage3: false, stage4: false, stage5: false },
    }),
    async () => ({
      kind: "personal_plan",
      personalPlanId: "plan-1",
      frontier: "stage1",
      nextHref: "/plan-start",
      allowed: { ...allowed, stage2: false },
    }),
  ]

  for (const loadJourneyAccess of firstVisitAccessShapes) {
    const deps: ResumeAwareDeps = {
      enabled: () => true,
      stage2Enabled: () => true,
      stage3Enabled: () => true,
      stage4Enabled: () => true,
      getUserId: async () => "owner-1",
      loadJourneyAccess,
      loadExistingRefinementSession: async () => null,
    }

    assert.deepEqual(await resolvePlanStartPageState(deps), {
      state: "production",
      initialJourney: { stage: "stage1", directAcceptanceAvailable: true },
    })
  }
})

test("a disabled Stage 2 keeps the first visit refine-only instead of offering acceptance", async () => {
  const deps: ResumeAwareDeps = {
    enabled: () => true,
    stage2Enabled: () => false,
    stage3Enabled: () => true,
    stage4Enabled: () => true,
    getUserId: async () => "owner-1",
    loadJourneyAccess: async () => ({
      kind: "personal_plan_start",
      frontier: "stage1",
      nextHref: "/plan-start",
      allowed: { stage1: true, stage2: false, stage3: false, stage4: false, stage5: false },
    }),
    loadExistingRefinementSession: async () => null,
  }

  assert.deepEqual(await resolvePlanStartPageState(deps), {
    state: "production",
    initialJourney: { stage: "stage1", refinementAvailable: false },
  })
})

test("a Stage 3 resume never offers direct acceptance", async () => {
  const deps: ResumeAwareDeps = {
    enabled: () => true,
    stage2Enabled: () => true,
    stage3Enabled: () => true,
    stage4Enabled: () => true,
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

test("a server-validated Routine repair request re-enters Stage 3 from a later frontier", async () => {
  const deps: ResumeAwareDeps = {
    enabled: () => true,
    stage2Enabled: () => true,
    getUserId: async () => "owner-1",
    loadJourneyAccess: async () => ({
      kind: "personal_plan",
      personalPlanId: "plan-1",
      frontier: "stage5",
      nextHref: "/anwendung",
      allowed: { stage1: true, stage2: true, stage3: true, stage4: true, stage5: true },
      // A stage5 frontier means the Routine is ACTIVATED — the fact
      // `planAccepted` is derived from (not the Stage-4 allowance, which a
      // pending proposal alone also satisfies).
      activeRoutineVersionId: "55555555-5555-4555-8555-555555555555",
    }),
    loadExistingRefinementSession: async () => refinementSession("complete", "refined-1"),
  }
  const repairRoutineVersionId = "44444444-4444-4444-8444-444444444444"

  assert.deepEqual(await resolvePlanStartPageState(deps, { repairRoutineVersionId }), {
    state: "production",
    initialJourney: {
      stage: "stage3",
      refinedVersionId: "refined-1",
      repairRoutineVersionId,
      planAccepted: true,
    },
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

test("direct Stage 2 entry opens fresh and partial sessions on normal Stage 2 questions", () => {
  const fresh = refinementSession("in_progress")
  fresh.answers = {}
  fresh.completedQuestionIds = []
  fresh.path.completedQuestionIds = []
  fresh.path.firstUnresolvedQuestionId = "current_product_categories"

  // The invitation chapter is retired (relic removal 28.08.2026): a fresh
  // entry always opens its first question directly.
  assert.equal(deriveRefinementEntryMode(fresh), "question")
  assert.equal(deriveRefinementEntryMode(refinementSession("in_progress")), "question")
  assert.equal(
    shouldReturnToStage1FromQuestion({
      session: fresh,
      activeQuestionId: "current_product_categories",
    }),
    true,
  )
  assert.equal(deriveRefinementEntryMode(refinementSession("complete", "refined-1")), "bridge")
})

test("a server-seeded Stage 2 partial resume renders the saved question on first paint", () => {
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

  assert.doesNotMatch(html, /Du machst bei der ersten offenen Frage weiter\./)
  assert.match(html, /Wie oft wäschst du deine Haare nass\?/)
  assert.equal(clientLoads, 0)
})

test("the production gate bypasses Stage 1 for a valid server-selected Stage 2 partial resume", () => {
  const initialSession = refinementSession("in_progress")
  const html = renderToStaticMarkup(
    <PlanStartProductionGate
      initialJourney={{ stage: "stage2" }}
      personalPlanId="plan-1"
      initialRefinementSession={initialSession}
    />,
  )

  assert.match(html, /Wie oft wäschst du deine Haare nass\?/)
  assert.doesNotMatch(html, /Du machst bei der ersten offenen Frage weiter\./)
  assert.doesNotMatch(html, /Dein Plan entsteht/)
})

test("an explicit module entry does not seed the old baseline Stage 2 resume shell", () => {
  const initialSession = refinementSession("in_progress")
  const html = renderToStaticMarkup(
    <PlanStartProductionGate
      initialJourney={{
        stage: "stage2",
        returningToRefinement: true,
        refineModule: "products",
        planAccepted: true,
      }}
      personalPlanId="plan-1"
      initialRefinementSession={initialSession}
      initialPlan={{ basis: {} as never, optional: null, personalPlanId: "plan-1" }}
    />,
  )

  assert.match(html, /Wir laden deinen Stand\./)
  assert.doesNotMatch(html, /Du machst bei der ersten offenen Frage weiter\./)
  assert.doesNotMatch(html, /Dein Plan entsteht/)
})

function stage3DraftResponse(
  draftId: string,
  refinedVersionId: string,
): Stage3DraftResponse & { authorityEvaluations: [] } {
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
  return {
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
      draftId,
      userId: "owner-1",
      personalPlanId: "plan-1",
      refinedVersionId,
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
        refinedNeedVersionId: refinedVersionId,
        refinedInputHash: "hash-1",
        categoryDecisions: [],
        coverage: [],
        orderedCategories: ["shampoo"],
        authorityVersions,
      },
    },
    authorityEvaluations: [],
  }
}

test("Stage 3 bootstrap selects optional inventory only for a verified products handoff", async () => {
  const calls: string[] = []
  const optionalDraft = stage3DraftResponse("optional-draft", "refined-products")
  const gateway: Pick<Stage3ProductsGateway, "loadOrCreate" | "openOptionalInventory"> = {
    openOptionalInventory: async (input) => {
      calls.push(`optional:${input.personalPlanId}:${input.refinedVersionId}`)
      return optionalDraft
    },
    loadOrCreate: async () => {
      calls.push("baseline")
      throw new Error("verified products handoff must not use baseline load")
    },
  }

  const bootstrap = await loadPlanStartStage3Bootstrap({
    gateway,
    personalPlanId: "plan-1",
    refinedVersionId: "refined-products",
    optionalInventory: true,
  })

  assert.deepEqual(calls, ["optional:plan-1:refined-products"])
  assert.equal(bootstrap.draft.draftId, "optional-draft")
})

test("baseline and direct-accept Stage 3 bootstrap keep loadOrCreate", async () => {
  const calls: string[] = []
  const baselineDraft = stage3DraftResponse("baseline-draft", "refined-baseline")
  const gateway: Pick<Stage3ProductsGateway, "loadOrCreate" | "openOptionalInventory"> = {
    openOptionalInventory: async () => {
      calls.push("optional")
      throw new Error("baseline/direct accept must not import optional inventory")
    },
    loadOrCreate: async (input) => {
      calls.push(`baseline:${input.personalPlanId}:${input.refinedVersionId}`)
      return baselineDraft
    },
  }

  const bootstrap = await loadPlanStartStage3Bootstrap({
    gateway,
    personalPlanId: "plan-1",
    refinedVersionId: "refined-baseline",
  })

  assert.deepEqual(calls, ["baseline:plan-1:refined-baseline"])
  assert.equal(bootstrap.draft.draftId, "baseline-draft")
})

test("host Stage 3 mode trusts only the verified products handoff marker", () => {
  assert.equal(
    planStartStage3BootstrapMode({ stage: "stage3", refinedVersionId: "refined" }, "initial"),
    "baseline",
  )
  assert.equal(
    planStartStage3BootstrapMode(
      { stage: "stage3", refinedVersionId: "refined", refineModule: "products" },
      "initial",
    ),
    "optional_inventory",
  )
  assert.equal(
    planStartStage3BootstrapMode(
      {
        stage: "stage3",
        refinedVersionId: "refined",
        repairRoutineVersionId: "repair",
        refineModule: "products",
      },
      "initial",
    ),
    "baseline",
  )
  assert.equal(
    planStartStage3BootstrapMode(
      { stage: "stage2", returningToRefinement: true, refineModule: "products" },
      "stage2_handoff",
    ),
    "optional_inventory",
  )
  assert.equal(
    planStartStage3BootstrapMode(
      { stage: "stage2", returningToRefinement: true, refineModule: "first_open" },
      "stage2_handoff",
    ),
    "optional_inventory",
  )
  assert.equal(
    planStartStage3BootstrapMode(
      { stage: "stage2", returningToRefinement: true, refineModule: "habits" },
      "stage2_handoff",
    ),
    "baseline",
  )
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

test("a stale Stage 2 bridge reloads the current server frontier without replaying completion", async () => {
  const stage3Requests: string[] = []
  let serverFrontierReloads = 0

  const result = await loadPlanStartStage2HandoffBootstrap({
    handoff: { refinedVersionId: "refined-stale", nextHref: "/plan-start" },
    loadStage3Bootstrap: async (refinedVersionId) => {
      stage3Requests.push(refinedVersionId)
      throw new Stage3ProductsGatewayError("stale_refined_source")
    },
    reloadServerFrontier: () => {
      serverFrontierReloads += 1
    },
  })

  assert.equal(result, null)
  assert.deepEqual(stage3Requests, ["refined-stale"])
  assert.equal(serverFrontierReloads, 1)
})

test("a transient Stage 2 bridge failure preserves its same-handoff retry", async () => {
  const stage3Requests: string[] = []
  const handoff = { refinedVersionId: "refined-retry", nextHref: "/plan-start" as const }

  await assert.rejects(
    loadPlanStartStage2HandoffBootstrap({
      handoff,
      loadStage3Bootstrap: async (refinedVersionId) => {
        stage3Requests.push(refinedVersionId)
        throw new Stage3ProductsGatewayError("temporarily_unavailable")
      },
      reloadServerFrontier: () =>
        assert.fail("transient errors must stay on the bridge retry path"),
    }),
    (error) =>
      error instanceof Stage3ProductsGatewayError && error.code === "temporarily_unavailable",
  )

  assert.deepEqual(stage3Requests, [handoff.refinedVersionId])
})

test("corrected Stage 3 product kinds save through Stage 2 completion and load a fresh Stage 3 bootstrap", async () => {
  const session = refinementSession("complete", "refined-old")
  const savedSession = { ...session, revision: 11, status: "in_progress" as const }
  const calls: unknown[] = []
  const bootstrap = {
    entryContext: {
      schemaVersion: 1 as const,
      personalPlanId: "plan-1",
      refinedVersionId: "refined-new",
      orderedCategories: [],
      inventoryPrompts: [],
    },
    draft: {} as never,
    requirements: [],
    authorityEvaluations: [],
  }

  const result = await completeStage2ProductKindCorrection({
    categories: ["shampoo", "conditioner"],
    session,
    stage2Gateway: {
      saveAnswerAndComplete: async (input) => {
        calls.push(input)
        return {
          session: savedSession,
          handoff: { refinedVersionId: "refined-new", nextHref: "/plan-start" },
        }
      },
      complete: async () => {
        throw new Error("completion retry must not run on the first save")
      },
    },
    loadStage3Bootstrap: async (refinedVersionId) => {
      calls.push({ loadStage3Bootstrap: refinedVersionId })
      return bootstrap
    },
  })

  assert.deepEqual(calls, [
    {
      questionId: "current_product_categories",
      answer: ["shampoo", "conditioner"],
      expectedRevision: 10,
    },
    { loadStage3Bootstrap: "refined-new" },
  ])
  assert.equal(result.session.status, "complete")
  assert.equal(result.session.completedHandoff?.refinedVersionId, "refined-new")
  assert.equal(result.bootstrap.entryContext.refinedVersionId, "refined-new")
})

test("product-kind correction preserves its completed handoff when only Stage 3 bootstrap loading fails", async () => {
  const session = refinementSession("complete", "refined-old")
  const savedSession = { ...session, revision: 11, status: "in_progress" as const }
  const handoff = { refinedVersionId: "refined-new", nextHref: "/plan-start" as const }
  let saveCalls = 0
  let completionCalls = 0
  let preservedSession: Stage2RefinementSession | null = null

  try {
    await completeStage2ProductKindCorrection({
      categories: ["shampoo", "conditioner"],
      session,
      stage2Gateway: {
        saveAnswerAndComplete: async () => {
          saveCalls += 1
          return { session: savedSession, handoff }
        },
        complete: async () => {
          completionCalls += 1
          throw new Error("completion retry must not run")
        },
      },
      loadStage3Bootstrap: async () => {
        throw new Error("temporary bootstrap failure")
      },
    })
    assert.fail("expected the first bootstrap load to fail")
  } catch (error) {
    assert.ok(error instanceof Stage3ProductKindCorrectionError)
    assert.equal(error.code, "bootstrap_failed_after_completion")
    assert.equal(error.savedSession?.status, "complete")
    assert.equal(error.savedSession?.completedHandoff?.refinedVersionId, "refined-new")
    preservedSession = error.savedSession
  }

  const expectedBootstrap = {
    entryContext: {
      schemaVersion: 1 as const,
      personalPlanId: "plan-1",
      refinedVersionId: "refined-new",
      orderedCategories: [],
      inventoryPrompts: [],
    },
    draft: {} as never,
    requirements: [],
    authorityEvaluations: [],
  }
  const result = await completeStage2ProductKindCorrection({
    categories: ["shampoo", "conditioner"],
    session,
    pendingBootstrapSession: preservedSession,
    stage2Gateway: {
      saveAnswerAndComplete: async () => {
        saveCalls += 1
        throw new Error("saved answers must not be replayed")
      },
      complete: async () => {
        completionCalls += 1
        throw new Error("completion must not be replayed")
      },
    },
    loadStage3Bootstrap: async () => expectedBootstrap,
  })

  assert.equal(saveCalls, 1)
  assert.equal(completionCalls, 0)
  assert.equal(result.bootstrap, expectedBootstrap)
  assert.equal(result.session.completedHandoff?.refinedVersionId, "refined-new")
})

test("product-kind correction completion failure preserves a saved session for completion-only retry", async () => {
  const session = refinementSession("complete", "refined-old")
  const savedSession = { ...session, revision: 11, status: "in_progress" as const }
  const calls: unknown[] = []
  await assert.rejects(
    completeStage2ProductKindCorrection({
      categories: ["shampoo", "conditioner"],
      session,
      stage2Gateway: {
        saveAnswerAndComplete: async (input) => {
          calls.push(input)
          throw new Stage2RefinementError("completion_failed", "completion_failed", savedSession)
        },
        complete: async () => {
          throw new Error("not used")
        },
      },
      loadStage3Bootstrap: async () => {
        throw new Error("not used")
      },
    }),
    (error) =>
      error instanceof Stage3ProductKindCorrectionError &&
      error.code === "completion_failed_after_save" &&
      error.savedSession === savedSession,
  )

  const bootstrap = {
    entryContext: {
      schemaVersion: 1 as const,
      personalPlanId: "plan-1",
      refinedVersionId: "refined-retry",
      orderedCategories: [],
      inventoryPrompts: [],
    },
    draft: {} as never,
    requirements: [],
    authorityEvaluations: [],
  }
  const retry = await completeStage2ProductKindCorrection({
    categories: ["conditioner"],
    session,
    pendingCompletionSession: savedSession,
    stage2Gateway: {
      saveAnswerAndComplete: async () => {
        throw new Error("retry must not save categories again")
      },
      complete: async (input) => {
        calls.push(input)
        return { refinedVersionId: "refined-retry", nextHref: "/plan-start" }
      },
    },
    loadStage3Bootstrap: async (refinedVersionId) => {
      calls.push({ loadStage3Bootstrap: refinedVersionId })
      return bootstrap
    },
  })

  assert.deepEqual(calls, [
    {
      questionId: "current_product_categories",
      answer: ["shampoo", "conditioner"],
      expectedRevision: 10,
    },
    { expectedRevision: 11 },
    { loadStage3Bootstrap: "refined-retry" },
  ])
  assert.equal(retry.bootstrap.entryContext.refinedVersionId, "refined-retry")
})

/**
 * FINDING C. After a direct accept the refinement draft is COMPLETE, so a bare
 * `/plan-start` seeds the completed session, `deriveRefinementEntryMode` maps it
 * to "bridge", and the bridge auto-hands off straight into Stage 3 — the
 * Routine nudge's "Jetzt verfeinern" would never show the Feinschliff. The
 * `?refine=1` param forces the same Stage-2 re-entry the in-session
 * "Zurück zum Feinschliff" return uses: `returningToRefinement`, which
 * suppresses the auto-handoff.
 */
test("refine=1 re-enters Stage 2 instead of resuming Stage 3, and suppresses the auto-handoff", async () => {
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

  // Without the param the completed draft resumes Stage 3 (the reported bug).
  assert.deepEqual(await resolvePlanStartPageState(deps), {
    state: "production",
    initialJourney: { stage: "stage3", refinedVersionId: "refined-1" },
    personalPlanId: "plan-1",
    initialRefinementSession: refinementSession("complete", "refined-1"),
  })

  const refined = await resolvePlanStartPageState(deps, { refine: true })
  assert.deepEqual(refined, {
    state: "production",
    initialJourney: { stage: "stage2", returningToRefinement: true },
    personalPlanId: "plan-1",
    initialRefinementSession: refinementSession("complete", "refined-1"),
  })
  assert.equal(
    refined.state === "production" && refinementAutoHandoffEnabled(refined.initialJourney),
    false,
    "an explicit refine request must not auto-hand off into Stage 3",
  )
})

test("refine=1 outranks a repair request and only accepts the exact param value", async () => {
  const deps: ResumeAwareDeps = {
    enabled: () => true,
    stage2Enabled: () => true,
    getUserId: async () => "owner-1",
    loadJourneyAccess: async () => ({
      kind: "personal_plan",
      personalPlanId: "plan-1",
      frontier: "stage5",
      nextHref: "/anwendung",
      allowed: { stage1: true, stage2: true, stage3: true, stage4: true, stage5: true },
      // A stage5 frontier means the Routine is ACTIVATED — the fact
      // `planAccepted` is derived from (not the Stage-4 allowance, which a
      // pending proposal alone also satisfies).
      activeRoutineVersionId: "55555555-5555-4555-8555-555555555555",
    }),
    loadExistingRefinementSession: async () => refinementSession("complete", "refined-1"),
  }

  const state = await resolvePlanStartPageState(deps, {
    refine: true,
    repairRoutineVersionId: "44444444-4444-4444-8444-444444444444",
  })
  assert.deepEqual(state, {
    state: "production",
    // Stage-4 access in this fixture means the plan is activated, so the
    // journey carries the post-accept origin (Codex review blocker 2).
    initialJourney: { stage: "stage2", returningToRefinement: true, planAccepted: true },
    personalPlanId: "plan-1",
    initialRefinementSession: refinementSession("complete", "refined-1"),
  })

  assert.equal(parseRefineParam("1"), true)
  assert.equal(parseRefineParam(["1", "0"]), true)
  assert.equal(parseRefineParam("true"), false)
  assert.equal(parseRefineParam(undefined), false)

  // A normal (non-refine) journey keeps the auto-handoff.
  assert.equal(refinementAutoHandoffEnabled({ stage: "stage2" }), true)
})

/**
 * Task T2.3. Defect (exists on main today): a user with an ACTIVE routine and
 * a COMPLETE refinement draft opens undirected `/plan-start`. Their frontier
 * is stage4 (`hasAcceptedRoutine` keeps stage 4/5 reachable regardless of the
 * Stage-2 draft), so none of the earlier branches — explicit refine, repair,
 * stage3-frontier resume, in-progress module1 resume — fire, and the resolver
 * falls through to the stage2 bridge. The client then seeds the completed
 * session, the legacy entry view arms the auto-handoff bridge, and the user
 * gets forwarded straight into a NEW Stage 3 creation funnel instead of their
 * already-activated Routine.
 */
const acceptedRoutineVersionId = "66666666-6666-4666-8666-666666666666"

function acceptedAccess(
  overrides: Partial<Extract<PersonalPlanJourneyAccess, { kind: "personal_plan" }>> = {},
): PersonalPlanJourneyAccess {
  return {
    kind: "personal_plan",
    personalPlanId: "plan-1",
    frontier: "stage4",
    nextHref: "/routine",
    allowed: { ...allowed, stage4: true },
    activeRoutineVersionId: acceptedRoutineVersionId,
    ...overrides,
  }
}

test("RED: accepted routine + complete draft + undirected /plan-start redirects to /routine (today: stage2 bridge)", async () => {
  const deps: ResumeAwareDeps = {
    enabled: () => true,
    stage2Enabled: () => true,
    getUserId: async () => "owner-1",
    loadJourneyAccess: async () => acceptedAccess(),
    loadExistingRefinementSession: async () => refinementSession("complete", "refined-1"),
  }

  assert.deepEqual(await resolvePlanStartPageState(deps), { state: "routine_redirect" })
})

test("accepted + complete + a pending routine proposal still redirects to /routine (the routine page owns proposal review)", async () => {
  const deps: ResumeAwareDeps = {
    enabled: () => true,
    stage2Enabled: () => true,
    getUserId: async () => "owner-1",
    loadJourneyAccess: async () =>
      acceptedAccess({ hasPendingRoutineProposal: true, allowed: { ...allowed, stage4: true } }),
    loadExistingRefinementSession: async () => refinementSession("complete", "refined-1"),
  }

  assert.deepEqual(await resolvePlanStartPageState(deps), { state: "routine_redirect" })
})

test("accepted + complete + ?refine=habits still opens the Stage 2 module entry (unchanged)", async () => {
  const deps: ResumeAwareDeps = {
    enabled: () => true,
    stage2Enabled: () => true,
    getUserId: async () => "owner-1",
    loadJourneyAccess: async () => acceptedAccess(),
    loadExistingRefinementSession: async () => refinementSession("complete", "refined-1"),
  }

  assert.deepEqual(
    await resolvePlanStartPageState(deps, { refine: true, refineModule: "habits" }),
    {
      state: "production",
      initialJourney: {
        stage: "stage2",
        returningToRefinement: true,
        refineModule: "habits",
        planAccepted: true,
      },
      personalPlanId: "plan-1",
      initialRefinementSession: refinementSession("complete", "refined-1"),
    },
  )
})

test("accepted + complete + ?refine=1 still opens Stage 2 (unchanged, legacy)", async () => {
  const deps: ResumeAwareDeps = {
    enabled: () => true,
    stage2Enabled: () => true,
    getUserId: async () => "owner-1",
    loadJourneyAccess: async () => acceptedAccess(),
    loadExistingRefinementSession: async () => refinementSession("complete", "refined-1"),
  }

  assert.deepEqual(await resolvePlanStartPageState(deps, { refine: true }), {
    state: "production",
    initialJourney: { stage: "stage2", returningToRefinement: true, planAccepted: true },
    personalPlanId: "plan-1",
    initialRefinementSession: refinementSession("complete", "refined-1"),
  })
})

test("accepted + complete + a repair request still re-enters Stage 3 (unchanged)", async () => {
  const deps: ResumeAwareDeps = {
    enabled: () => true,
    stage2Enabled: () => true,
    getUserId: async () => "owner-1",
    loadJourneyAccess: async () =>
      acceptedAccess({ allowed: { ...allowed, stage3: true, stage4: true } }),
    loadExistingRefinementSession: async () => refinementSession("complete", "refined-1"),
  }
  const repairRoutineVersionId = "77777777-7777-4777-8777-777777777777"

  assert.deepEqual(await resolvePlanStartPageState(deps, { repairRoutineVersionId }), {
    state: "production",
    initialJourney: {
      stage: "stage3",
      refinedVersionId: "refined-1",
      repairRoutineVersionId,
      planAccepted: true,
    },
    personalPlanId: "plan-1",
    initialRefinementSession: refinementSession("complete", "refined-1"),
  })
})

test("accepted + IN-PROGRESS draft, undirected: unchanged Stage 2 fall-through", async () => {
  const deps: ResumeAwareDeps = {
    enabled: () => true,
    stage2Enabled: () => true,
    getUserId: async () => "owner-1",
    loadJourneyAccess: async () => acceptedAccess(),
    loadExistingRefinementSession: async () => refinementSession("in_progress"),
  }

  assert.deepEqual(await resolvePlanStartPageState(deps), {
    state: "production",
    initialJourney: { stage: "stage2", planAccepted: true },
    personalPlanId: "plan-1",
    initialRefinementSession: refinementSession("in_progress"),
  })
})

test("NOT accepted + complete draft + frontier stage3, undirected: unchanged Stage 3 resume", async () => {
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

test("NOT accepted + complete draft + frontier != stage3, undirected: unchanged Stage 2 fall-through", async () => {
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
