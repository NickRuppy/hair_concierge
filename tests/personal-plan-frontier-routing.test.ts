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
  assert.equal(getPersonalPlanFrontierRedirect("/routine", stage1), "/plan-start")
})

test("chat is never frontier-redirected for personal-plan users", () => {
  const stage1 = resolvePersonalPlanRoutingFrontier({
    eligible: true,
    sourceReady: true,
    plan: null,
  })
  const stage3 = resolvePersonalPlanRoutingFrontier({
    eligible: true,
    sourceReady: true,
    plan: {
      currentInitialNeedVersionId: "initial-1",
      currentRefinedNeedVersionId: "refined-1",
      pendingRoutineProposalId: null,
      activeRoutineVersionId: null,
    },
  })
  const stage5 = resolvePersonalPlanRoutingFrontier({
    eligible: true,
    sourceReady: true,
    plan: {
      currentInitialNeedVersionId: "initial-1",
      currentRefinedNeedVersionId: "refined-1",
      pendingRoutineProposalId: null,
      activeRoutineVersionId: "routine-1",
    },
  })

  assert.equal(getPersonalPlanFrontierRedirect("/chat", stage1), null)
  assert.equal(getPersonalPlanFrontierRedirect("/chat", stage3), null)
  assert.equal(getPersonalPlanFrontierRedirect("/chat", stage5), null)
  assert.equal(getPersonalPlanFrontierRedirect("/chat/verlauf", stage5), null)
  assert.equal(
    getPersonalPlanFrontierRedirect("/chat", { kind: "recovery", nextHref: "/plan-bereit" }),
    null,
  )
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

test("moderator application entry routes recovery and unfinished setup safely", () => {
  const cases = [
    { sourceReady: false, plan: null, destination: "/plan-bereit" },
    { sourceReady: true, plan: null, destination: "/plan-start" },
  ]
  for (const item of cases) {
    const frontier = resolvePersonalPlanRoutingFrontier({
      eligible: true,
      sourceReady: item.sourceReady,
      plan: item.plan,
    })
    assert.equal(
      getPersonalPlanFrontierRedirect("/anwendung", frontier) ?? "/anwendung",
      item.destination,
    )
  }
})

test("migration candidates require rollout while bound Plans resume without the launch cutoff", async () => {
  const row = {
    source_kind: "migration",
    migration_status: "candidate",
    qualified_at: "2026-01-01T00:00:00Z",
    quiz_source_kind: null as string | null,
    plan: null as Record<string, string | null> | null,
  }
  const client = { rpc: async () => ({ data: row, error: null }), from: () => null }
  const release = {
    cohortCutoff: () => null,
    legacyQuizCutoverEnabled: () => false,
    appAllowedForUser: async () => true,
    migrationEnabled: () => false,
  }
  assert.deepEqual(
    await loadPersonalPlanRoutingFrontierForUser(client as never, "owner", release),
    { kind: "legacy" },
  )
  assert.deepEqual(
    await loadPersonalPlanRoutingFrontierForUser(client as never, "owner", {
      ...release,
      migrationEnabled: () => true,
    }),
    { kind: "recovery", nextHref: "/plan-bereit" },
  )
  row.migration_status = "ready"
  row.quiz_source_kind = "legacy"
  row.plan = {
    current_initial_need_version_id: "initial",
    current_refined_need_version_id: "refined",
    active_routine_version_id: "routine",
    pending_routine_proposal_id: null,
  }
  assert.deepEqual(
    await loadPersonalPlanRoutingFrontierForUser(client as never, "owner", release),
    { kind: "personal_plan", frontier: "stage5", nextHref: "/anwendung" },
  )
  row.migration_status = "invented"
  assert.deepEqual(
    await loadPersonalPlanRoutingFrontierForUser(client as never, "owner", release),
    { kind: "legacy" },
  )
})

test("a valid historical paid source enters preparation when migration is enabled despite the old cutoff", async () => {
  const client = {
    rpc: async () => ({
      data: {
        source_kind: "paid",
        qualified_at: "2026-01-01T00:00:00Z",
        quiz_source_kind: "legacy",
        plan: null,
      },
      error: null,
    }),
    from: () => null,
  }
  assert.deepEqual(
    await loadPersonalPlanRoutingFrontierForUser(client as never, "owner", {
      cohortCutoff: () => new Date("2026-08-01"),
      legacyQuizCutoverEnabled: () => false,
      migrationEnabled: () => true,
      appAllowedForUser: async () => true,
    }),
    { kind: "recovery", nextHref: "/plan-bereit" },
  )
})
