import assert from "node:assert/strict"
import test from "node:test"

import { createAcceptIdealPlanRouteHandler } from "../src/app/api/personal-plan/accept-ideal-plan/route"
import { handleStage1LoadOrCreate } from "../src/app/api/personal-plan/stage-1/route"
import { createStage2CompleteRouteHandler } from "../src/app/api/personal-plan/stage-2/complete/route"
import { createStage2RouteHandlers } from "../src/app/api/personal-plan/stage-2/route"
import { resolvePlanStartPageState } from "../src/app/plan-start/page"
import { resolveRoutinePage } from "../src/app/routine/page"
import { interpretPlanStartApiResponse } from "../src/components/personal-plan-start/plan-start-flow"
import { computeNeedPlan } from "../src/lib/personal-plan/compute-stage1"
import { openOptionalRefinement } from "../src/lib/personal-plan/persistence/stage2-optional-entry"
import { loadExistingStage2RefinementSession } from "../src/lib/personal-plan/persistence/stage2-refinement-service"
import { createSupabaseStage2RefinementPersistence } from "../src/lib/personal-plan/persistence/stage2-refinement-supabase"
import {
  getOrderedQuestionIds,
  getStage2ModulePathStates,
} from "../src/lib/personal-plan/refinement/question-path"
import { buildRefinementStatusResponse } from "../src/lib/personal-plan/refinement/refinement-status"
import { createStage2RefinementSession } from "../src/lib/personal-plan/refinement/session"
import { deriveStage2TriggerContext } from "../src/lib/personal-plan/refinement/stage1-adapter"
import { COMPLETE_V3_PLAN_ENVELOPE } from "./personal-plan/fixtures"

/**
 * The Hair Tools rollout is ONE server-resolved boolean. These are the boundaries that derive the
 * Stage-2 question path or trigger context: with the flag off (unset / `off` / invalid) every one
 * of them must behave exactly as before the port — no tool question ids, the `tools` module
 * `not_applicable`, a 4-step meter — and a browser can never grant the flag.
 */

function initialSnapshot() {
  const computed = computeNeedPlan({
    rawEnvelope: COMPLETE_V3_PLAN_ENVELOPE,
    artifactId: "11111111-1111-4111-8111-111111111111",
    projection: "initial_quiz",
    computationVersion: "stage1-v1",
    createdAt: "2026-10-09T00:00:00.000Z",
  })
  assert.equal(computed.status, "ready")
  if (computed.status !== "ready") throw new Error("unreachable")
  return computed.snapshot
}

const isToolQuestion = (id: string) => id === "tools_overview" || id.startsWith("tools:")

// ---------------------------------------------------------------------------
// The trigger context and the path it derives
// ---------------------------------------------------------------------------

test("off keeps the trigger context byte-identical: no rollout key, no tool ids, tools not_applicable, meter 4", () => {
  const snapshot = initialSnapshot()
  const triggerContext = deriveStage2TriggerContext(snapshot, { toolsEnabled: false })
  assert.deepEqual(Object.keys(triggerContext).sort(), [
    "dryShampooBridgeEligibility",
    "hasReportedIrritatedScalp",
    "relevantCategories",
  ])

  const answers = { currentProductCategories: ["shampoo", "heat_protectant"] as never }
  const ids = getOrderedQuestionIds(triggerContext, answers)
  assert.equal(ids.some(isToolQuestion), false)
  assert.equal(getStage2ModulePathStates(ids, [])["tools"].status, "not_applicable")

  const status = buildRefinementStatusResponse({
    moduleStatusInput: { triggerContext, answers, completedQuestionIds: [], answerProvenance: {} },
    moduleProjections: {},
    bannerDismissals: { dismissedModules: new Set() },
  })
  assert.equal(status.progress.totalSteps, 4)
  assert.equal(status.modules.find((entry) => entry.module === "tools")?.status, "not_applicable")
})

test("on carries the server decision on the context and, until tool questions land, changes no path", () => {
  const snapshot = initialSnapshot()
  const on = deriveStage2TriggerContext(snapshot, { toolsEnabled: true })
  const off = deriveStage2TriggerContext(snapshot, { toolsEnabled: false })
  assert.equal(on.toolsEnabled, true)
  assert.equal("toolsEnabled" in off, false)
  const { toolsEnabled: _flag, ...rest } = on
  assert.deepEqual(rest, off)
  const answers = { currentProductCategories: ["shampoo"] as never }
  assert.deepEqual(getOrderedQuestionIds(on, answers), getOrderedQuestionIds(off, answers))
})

test("a stored context without the key decodes as off", () => {
  const stored = deriveStage2TriggerContext(initialSnapshot(), { toolsEnabled: false })
  const session = createStage2RefinementSession({
    pathVersion: "stage2.refinement.v1",
    triggerContext: stored,
    answers: {},
    revision: 0,
    status: "in_progress",
  })
  assert.equal(session.path.orderedQuestionIds.some(isToolQuestion), false)
})

// ---------------------------------------------------------------------------
// Persistence + optional entry: the flag reaches the trigger context they hand out
// ---------------------------------------------------------------------------

function persistenceClient(snapshot: unknown) {
  const tables: Record<string, Record<string, unknown> | null> = {
    personal_plans: { id: "plan-1", current_initial_need_version_id: "initial-1" },
    personal_plan_need_versions: {
      id: "initial-1",
      prepared_artifact_source_id: "artifact-1",
      stage1_source_kind: "personal_plan_artifact",
      stage1_source_lead_id: null,
      input_snapshot: {},
      output_snapshot: snapshot,
    },
    personal_plan_refinement_drafts: {
      id: "draft-1",
      personal_plan_id: "plan-1",
      base_initial_need_version_id: "initial-1",
      schema_version: 1,
      answers: {},
      completed_question_ids: [],
      answer_provenance: {},
      module_projections: {},
      revision: 0,
      status: "in_progress",
      result_refined_need_version_id: null,
      direct_acceptance_owned: false,
    },
  }
  const client = {
    from(table: string) {
      const query: Record<string, unknown> = {
        select: () => query,
        eq: () => query,
        order: () => query,
        limit: () => query,
        maybeSingle: async () => ({ data: tables[table] ?? null, error: null }),
      }
      return query
    },
  }
  return client as never
}

test("the persisted draft's trigger context follows the server flag, and only a true flag marks it", async () => {
  const snapshot = initialSnapshot()
  for (const toolsEnabled of [false, true]) {
    const persistence = createSupabaseStage2RefinementPersistence(persistenceClient(snapshot), {
      toolsEnabled,
    })
    const draft = await persistence.loadExisting("user-1")
    assert.ok(draft)
    assert.equal(draft.triggerContext.toolsEnabled, toolsEnabled ? true : undefined)
    const session = await loadExistingStage2RefinementSession({ userId: "user-1", persistence })
    assert.equal(session?.path.orderedQuestionIds.some(isToolQuestion), false)
  }
})

test("optional entry derives its context from the server flag", async () => {
  const snapshot = initialSnapshot()
  for (const toolsEnabled of [false, true]) {
    const opened: Array<boolean | undefined> = []
    const client = persistenceClient(snapshot) as unknown as {
      rpc: (name: string, args: unknown) => Promise<unknown>
      from: (table: string) => unknown
    }
    const draftRow = client.from("personal_plan_refinement_drafts") as {
      maybeSingle: () => Promise<{ data: unknown }>
    }
    const row = (await draftRow.maybeSingle()).data
    client.rpc = async () => ({
      data: { outcome: "skipped_existing_state", draft: row },
      error: null,
    })
    const draft = await openOptionalRefinement({
      userId: "user-1",
      module: "products",
      client: client as never,
      toolsEnabled,
    })
    opened.push(draft.triggerContext.toolsEnabled)
    assert.deepEqual(opened, [toolsEnabled ? true : undefined])
  }
})

// ---------------------------------------------------------------------------
// Routes: the flag is resolved on the server and relayed; the browser cannot supply it
// ---------------------------------------------------------------------------

const stage2Access = { allowed: true as const }
const readySession = createStage2RefinementSession({
  pathVersion: "stage2.refinement.v1",
  triggerContext: deriveStage2TriggerContext(initialSnapshot(), { toolsEnabled: false }),
  answers: {},
  revision: 0,
  status: "in_progress",
})

test("stage-2 route builds its gateway with the server flag and ignores browser claims", async () => {
  const seen: boolean[] = []
  const handlers = createStage2RouteHandlers({
    enabled: () => true,
    getUserId: async () => "owner-1",
    loadStage2Access: async () => stage2Access,
    toolsEnabled: async (userId) => userId === "owner-1",
    gatewayFor: (_userId, { toolsEnabled }) => {
      seen.push(toolsEnabled)
      return { load: async () => readySession, saveAnswer: async () => readySession } as never
    },
    runHabitsRecompute: async () => null,
  })
  assert.equal((await handlers.GET()).status, 200)
  const forged = await handlers.PATCH(
    new Request("http://test/api/personal-plan/stage-2?toolsEnabled=true", {
      method: "PATCH",
      body: JSON.stringify({
        questionId: "wet_wash_frequency",
        answer: "weekly_2x",
        expectedRevision: 0,
        toolsEnabled: true,
      }),
    }),
  )
  assert.equal(forged.status, 400, "a body flag is an invalid request, not a grant")
  assert.deepEqual(seen, [true, true], "the gateway is built with the server decision only")

  const off = createStage2RouteHandlers({
    enabled: () => true,
    getUserId: async () => "owner-1",
    loadStage2Access: async () => stage2Access,
    toolsEnabled: async () => {
      throw new Error("flag lookup failed")
    },
    gatewayFor: (_userId, { toolsEnabled }) => {
      seen.push(toolsEnabled)
      return { load: async () => readySession } as never
    },
    runHabitsRecompute: async () => null,
  })
  assert.equal((await off.GET()).status, 200)
  assert.equal(seen.at(-1), false, "a failing lookup fails closed")
})

test("stage-2/complete route builds its gateway with the server flag", async () => {
  const seen: boolean[] = []
  const post = createStage2CompleteRouteHandler({
    enabled: () => true,
    getUserId: async () => "owner-1",
    loadStage2Access: async () => stage2Access,
    toolsEnabled: async () => true,
    gatewayFor: (_userId, { toolsEnabled }) => {
      seen.push(toolsEnabled)
      return {
        complete: async () => ({ refinedVersionId: "refined-1", nextHref: "/plan-start" }),
      } as never
    },
  })
  const response = await post(
    new Request("http://test/api/personal-plan/stage-2/complete", {
      method: "POST",
      body: JSON.stringify({ expectedRevision: 0 }),
    }),
  )
  assert.equal(response.status, 200)
  assert.deepEqual(seen, [true])
})

test("accept-ideal-plan route hands the server flag to acceptance", async () => {
  const seen: boolean[] = []
  const post = createAcceptIdealPlanRouteHandler({
    enabled: () => true,
    getUserId: async () => "owner-1",
    loadJourneyAccess: async () => ({
      kind: "personal_plan",
      frontier: "stage2",
      allowed: { stage1: true, stage2: true, stage3: false, stage4: false, stage5: false },
      nextHref: "/plan-start",
      personalPlanId: "plan-1",
    }),
    checkRateLimit: (async () => ({ allowed: true })) as never,
    toolsEnabled: async () => true,
    accept: async (_userId, _input, { toolsEnabled }) => {
      seen.push(toolsEnabled)
      return {
        status: "accepted",
        personalPlanId: "plan-1",
        refinedVersionId: "refined-1",
        productDraftId: "draft-1",
        productPortfolioVersionId: "portfolio-1",
        next: { stage: 4, href: "/routine" },
      }
    },
  })
  const response = await post(
    new Request("http://test/api/personal-plan/accept-ideal-plan", {
      method: "POST",
      body: JSON.stringify({ seenRoles: [] }),
    }),
  )
  assert.equal(response.status, 200)
  assert.deepEqual(seen, [true])
})

function stage1Deps(toolsEnabled: () => Promise<boolean>) {
  return {
    getAuthenticatedUser: async () => ({ id: "user-1" }),
    loadJourneyAccess: async () => ({
      kind: "personal_plan_start" as const,
      frontier: "stage1" as const,
      nextHref: "/plan-start" as const,
      allowed: { stage1: true, stage2: false, stage3: false, stage4: false, stage5: false },
    }),
    toolsEnabled,
    persistence: {
      isEnabled: () => true,
      cohortCutoff: () => new Date("2026-08-08T00:00:00.000Z"),
      findEntitlement: async () => ({
        accessState: "active" as const,
        enrollmentSourceId: "purchase-1",
        qualifiedAt: "2026-08-08T01:00:00.000Z",
        artifactLeadId: "lead-1",
      }),
      loadArtifact: async () => ({ id: "artifact-1", quizAnswers: COMPLETE_V3_PLAN_ENVELOPE }),
      createOrReuseInitialNeed: async (request: { outputSnapshot: unknown }) => ({
        outcome: "completed" as const,
        personalPlanId: "plan-1",
        needVersionId: "need-1",
        outputSnapshot: request.outputSnapshot,
      }),
    },
  } as never
}

test("stage-1 route echoes the flag only when on, and the client adapter relays just that echo", async () => {
  const off = await handleStage1LoadOrCreate(stage1Deps(async () => false))
  assert.equal(off?.status, 200)
  assert.equal("toolsEnabled" in (off!.body as object), false, "off leaves the body untouched")

  const failing = await handleStage1LoadOrCreate(
    stage1Deps(async () => {
      throw new Error("flag lookup failed")
    }),
  )
  assert.equal("toolsEnabled" in (failing!.body as object), false)

  const on = await handleStage1LoadOrCreate(stage1Deps(async () => true))
  assert.equal((on!.body as { toolsEnabled?: boolean }).toolsEnabled, true)

  const relayedOn = interpretPlanStartApiResponse(200, on!.body)
  const relayedOff = interpretPlanStartApiResponse(200, off!.body)
  assert.equal(relayedOn.state, "ready")
  assert.equal(relayedOff.state, "ready")
  if (relayedOn.state === "ready" && relayedOff.state === "ready") {
    assert.equal(relayedOn.plan.stage2TriggerContext?.toolsEnabled, true)
    assert.equal("toolsEnabled" in (relayedOff.plan.stage2TriggerContext ?? {}), false)
  }
  // Only a literal `true` counts; any other body value is off.
  const forged = interpretPlanStartApiResponse(200, {
    ...(off!.body as object),
    toolsEnabled: "true",
  })
  if (forged.state === "ready") {
    assert.equal("toolsEnabled" in (forged.plan.stage2TriggerContext ?? {}), false)
  }
})

// ---------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------

function planStartDeps(
  seen: Array<[string, boolean]>,
  toolsEnabled?: (userId: string) => Promise<boolean>,
) {
  return {
    enabled: () => true,
    stage2Enabled: () => true,
    getUserId: async () => "owner-1",
    loadJourneyAccess: async () =>
      ({
        kind: "personal_plan",
        personalPlanId: "plan-1",
        frontier: "stage2",
        nextHref: "/plan-start",
        allowed: { stage1: true, stage2: true, stage3: false, stage4: false, stage5: false },
      }) as never,
    ...(toolsEnabled ? { toolsEnabled } : {}),
    loadStage1Plan: async (_userId: string, { toolsEnabled: flag }: { toolsEnabled: boolean }) => {
      seen.push(["stage1", flag])
      return null
    },
    loadExistingRefinementSession: async (
      _userId: string,
      { toolsEnabled: flag }: { toolsEnabled: boolean },
    ) => {
      seen.push(["session", flag])
      return readySession
    },
    loadRefinementProgress: async (
      _userId: string,
      { toolsEnabled: flag }: { toolsEnabled: boolean },
    ) => {
      seen.push(["progress", flag])
      return { completedSteps: 2, totalSteps: 4 }
    },
  }
}

test("plan-start resolves the flag once per request and hands it to every path loader", async () => {
  let lookups = 0
  const seen: Array<[string, boolean]> = []
  await resolvePlanStartPageState(
    planStartDeps(seen, async () => {
      lookups += 1
      return true
    }),
    { refine: true, refineModule: "products" },
  )
  assert.equal(lookups, 1)
  assert.deepEqual(seen, [
    ["stage1", true],
    ["session", true],
    ["progress", true],
  ])
})

test("plan-start is tools-off when the lookup is unwired or fails", async () => {
  for (const toolsEnabled of [
    undefined,
    async () => {
      throw new Error("flag lookup failed")
    },
    async () => false,
  ]) {
    const seen: Array<[string, boolean]> = []
    const state = await resolvePlanStartPageState(planStartDeps(seen, toolsEnabled), {
      refine: true,
      refineModule: "products",
    })
    assert.equal(state.state, "production")
    assert.deepEqual(
      seen.map(([, flag]) => flag),
      [false, false, false],
    )
  }
})

test("routine page reads its banner with the server flag, tools-off when unwired or failing", async () => {
  const view = {
    status: "active",
    personalPlanId: "plan-1",
    activeVersion: { payload: { source: {} } },
  } as never
  const base = {
    getUserId: async () => "user-1",
    loadJourneyAccess: async () =>
      ({
        kind: "personal_plan",
        personalPlanId: "plan-1",
        frontier: "stage4",
        nextHref: "/routine",
        allowed: { stage1: true, stage2: true, stage3: true, stage4: true, stage5: false },
      }) as never,
    stage4Enabled: () => true,
    readView: async () => view,
  }
  const seen: boolean[] = []
  const readRefinementBanner = async (
    _userId: string,
    { toolsEnabled }: { toolsEnabled: boolean },
  ) => {
    seen.push(toolsEnabled)
    return null
  }
  await resolveRoutinePage({ ...base, readRefinementBanner, toolsEnabled: async () => true })
  await resolveRoutinePage({ ...base, readRefinementBanner })
  await resolveRoutinePage({
    ...base,
    readRefinementBanner,
    toolsEnabled: async () => {
      throw new Error("flag lookup failed")
    },
  })
  assert.deepEqual(seen, [true, false, false])
})
