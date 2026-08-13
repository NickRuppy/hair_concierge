import assert from "node:assert/strict"
import test from "node:test"

import {
  getPersonalPlanFrontierRedirect,
  resolvePersonalPlanRoutingFrontier,
} from "../src/lib/personal-plan/frontier-routing"
import { loadPersonalPlanRoutingFrontierForUser } from "../src/lib/personal-plan/frontier-routing-loader"

test("a qualifying source routes recovery and pre-Routine stages without legacy onboarding", () => {
  assert.deepEqual(
    resolvePersonalPlanRoutingFrontier({ eligible: true, sourceReady: false, plan: null }),
    { kind: "recovery", nextHref: "/plan-bereit" },
  )
  assert.deepEqual(
    resolvePersonalPlanRoutingFrontier({ eligible: true, sourceReady: true, plan: null }),
    { kind: "personal_plan", frontier: "stage1", nextHref: "/plan-start" },
  )
  assert.deepEqual(
    resolvePersonalPlanRoutingFrontier({
      eligible: true,
      sourceReady: true,
      plan: {
        currentInitialNeedVersionId: "initial-1",
        currentRefinedNeedVersionId: null,
        pendingRoutineProposalId: null,
        activeRoutineVersionId: null,
      },
    }),
    { kind: "personal_plan", frontier: "stage2", nextHref: "/plan-start" },
  )
})

test("the narrow frontier routes Routine and Anwendung from durable pointers", () => {
  const pendingRoutine = resolvePersonalPlanRoutingFrontier({
    eligible: true,
    sourceReady: true,
    plan: {
      currentInitialNeedVersionId: "initial-1",
      currentRefinedNeedVersionId: "refined-1",
      pendingRoutineProposalId: "proposal-1",
      activeRoutineVersionId: null,
    },
  })
  assert.deepEqual(pendingRoutine, {
    kind: "personal_plan",
    frontier: "stage4",
    nextHref: "/routine",
  })
  assert.equal(getPersonalPlanFrontierRedirect("/routine", pendingRoutine), null)
  assert.equal(getPersonalPlanFrontierRedirect("/anwendung", pendingRoutine), "/routine")

  const activeRoutine = resolvePersonalPlanRoutingFrontier({
    eligible: true,
    sourceReady: true,
    plan: {
      currentInitialNeedVersionId: "initial-1",
      currentRefinedNeedVersionId: "refined-1",
      pendingRoutineProposalId: null,
      activeRoutineVersionId: "routine-1",
    },
  })
  assert.deepEqual(activeRoutine, {
    kind: "personal_plan",
    frontier: "stage5",
    nextHref: "/anwendung",
  })
  assert.equal(getPersonalPlanFrontierRedirect("/routine", activeRoutine), null)
  assert.equal(getPersonalPlanFrontierRedirect("/anwendung", activeRoutine), null)
})

test("legacy users and explicit old-flow edits remain untouched", () => {
  const legacy = resolvePersonalPlanRoutingFrontier({
    eligible: false,
    sourceReady: false,
    plan: null,
  })
  assert.deepEqual(legacy, { kind: "legacy" })
  assert.equal(getPersonalPlanFrontierRedirect("/chat", legacy), null)

  const stage1 = resolvePersonalPlanRoutingFrontier({
    eligible: true,
    sourceReady: true,
    plan: null,
  })
  assert.equal(getPersonalPlanFrontierRedirect("/onboarding", stage1), null)
  assert.equal(getPersonalPlanFrontierRedirect("/onboarding/products", stage1), null)
  assert.equal(getPersonalPlanFrontierRedirect("/auth", stage1), "/plan-start")
  assert.equal(getPersonalPlanFrontierRedirect("/chat", stage1), "/plan-start")
  assert.equal(getPersonalPlanFrontierRedirect("/routine", stage1), "/plan-start")
})

test("the owner-only routing source keeps a new legacy buyer in readiness until Stage 1 exists", async () => {
  const client = {
    rpc: async () => ({
      data: {
        qualified_at: "2026-08-12T12:00:00.000Z",
        quiz_source_kind: "legacy",
        plan: null,
      },
      error: null,
    }),
    from: () => {
      throw new Error("routing must not load private tables from middleware")
    },
  }
  const result = await loadPersonalPlanRoutingFrontierForUser(client as never, "user-1", {
    cohortCutoff: () => new Date("2026-08-12T12:00:00.000Z"),
    legacyQuizCutoverEnabled: () => true,
    appAllowedForUser: async () => true,
  })
  assert.deepEqual(result, { kind: "recovery", nextHref: "/plan-bereit" })
})

test("an explicit regular-quiz field test reaches readiness without opening the customer cutover", async () => {
  const client = {
    rpc: async () => ({
      data: {
        qualified_at: "2026-08-11T12:00:00.000Z",
        quiz_source_kind: "legacy",
        source_kind: "field_test",
        plan: null,
      },
      error: null,
    }),
    from: () => {
      throw new Error("routing must not load private tables from middleware")
    },
  }
  const result = await loadPersonalPlanRoutingFrontierForUser(client as never, "guest-1", {
    cohortCutoff: () => new Date("2026-08-12T12:00:00.000Z"),
    legacyQuizCutoverEnabled: () => false,
    appAllowedForUser: async () => true,
  })
  assert.deepEqual(result, { kind: "recovery", nextHref: "/plan-bereit" })
})

test("a paid legacy source still requires the customer cutover", async () => {
  const client = {
    rpc: async () => ({
      data: {
        qualified_at: "2026-08-13T12:00:00.000Z",
        quiz_source_kind: "legacy",
        source_kind: "paid",
        plan: null,
      },
      error: null,
    }),
    from: () => {
      throw new Error("routing must not load private tables from middleware")
    },
  }
  const result = await loadPersonalPlanRoutingFrontierForUser(client as never, "buyer-1", {
    cohortCutoff: () => new Date("2026-08-12T12:00:00.000Z"),
    legacyQuizCutoverEnabled: () => false,
    appAllowedForUser: async () => true,
  })
  assert.deepEqual(result, { kind: "legacy" })
})

test("the narrow owner source routes from durable plan pointers and fails closed on cutoff", async () => {
  const row = {
    qualified_at: "2026-08-12T12:00:00.000Z",
    quiz_source_kind: "legacy",
    plan: {
      current_initial_need_version_id: "initial-1",
      current_refined_need_version_id: "refined-1",
      pending_routine_proposal_id: "proposal-1",
      active_routine_version_id: null,
    },
  }
  const client = { rpc: async () => ({ data: row, error: null }), from: () => null }
  const release = {
    cohortCutoff: () => new Date("2026-08-12T12:00:00.000Z"),
    legacyQuizCutoverEnabled: () => true,
    appAllowedForUser: async () => true,
  }
  assert.deepEqual(
    await loadPersonalPlanRoutingFrontierForUser(client as never, "user-1", release),
    { kind: "personal_plan", frontier: "stage4", nextHref: "/routine" },
  )
  assert.deepEqual(
    await loadPersonalPlanRoutingFrontierForUser(client as never, "user-1", {
      ...release,
      cohortCutoff: () => new Date("2026-08-12T12:00:00.001Z"),
    }),
    { kind: "legacy" },
  )
})
