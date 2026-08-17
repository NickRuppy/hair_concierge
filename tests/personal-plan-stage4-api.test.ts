import assert from "node:assert/strict"
import test from "node:test"

import { createPersonalPlanRoutineAttentionRouteHandlers } from "../src/app/api/personal-plan/routine/attention/route"
import { createPersonalPlanRoutineRouteHandlers } from "../src/app/api/personal-plan/routine/route"
import { createPersonalPlanRoutineProposalRouteHandlers } from "../src/app/api/personal-plan/routine/proposals/route"
import { createPersonalPlanRoutineResolveRouteHandlers } from "../src/app/api/personal-plan/routine/proposals/[proposalId]/resolve/route"
import { createPersonalPlanRoutineNudgeDismissRouteHandlers } from "../src/app/api/personal-plan/routine/nudge/dismiss/route"
import type { PersonalPlanRoutineReadClient } from "../src/lib/personal-plan/routine/repository"

const ids = {
  plan: "11111111-1111-4111-8111-111111111111",
  version: "22222222-2222-4222-8222-222222222222",
  proposal: "33333333-3333-4333-8333-333333333333",
  refined: "44444444-4444-4444-8444-444444444444",
}
const payload = {
  schemaVersion: 1,
  planId: ids.plan,
  versionId: ids.version,
  parentVersionId: null,
  source: {
    refinedVersionId: ids.refined,
    productPortfolioVersionId: ids.version,
    sourceFingerprint: "a".repeat(64),
    compilerVersion: "v1",
    authorityVersions: {},
  },
  intent: { schemaVersion: 1, categories: [] },
  sections: [
    { key: "basis", itemKeys: [] },
    { key: "optional", itemKeys: [] },
  ],
  items: [],
  createdAt: "2026-08-08T00:00:00.000Z",
}
const stage4Access = {
  kind: "personal_plan" as const,
  personalPlanId: ids.plan,
  frontier: "stage4" as const,
  nextHref: "/routine" as const,
  allowed: { stage1: true, stage2: true, stage3: true, stage4: true, stage5: false },
  hasPendingRoutineProposal: true,
}

function client(rows: Record<string, unknown>): PersonalPlanRoutineReadClient {
  return {
    from(table) {
      const filters: Array<[string, string]> = []
      const query = {
        select() {
          return query
        },
        eq(key: string, value: string) {
          filters.push([key, value])
          return query
        },
        async maybeSingle() {
          assert.ok(
            filters.some(([key, value]) => key === "user_id" && value === "owner-1"),
            `${table} must be owner scoped`,
          )
          return { data: rows[table] ?? null, error: null }
        },
      }
      return query
    },
  } as PersonalPlanRoutineReadClient
}
function routeDeps(overrides: Record<string, unknown> = {}) {
  return {
    enabled: () => true,
    getUserId: async () => "owner-1",
    loadJourneyAccess: async () => stage4Access,
    client: () =>
      client({
        personal_plans: {
          id: ids.plan,
          revision: 4,
          source_revision: 7,
          active_routine_version_id: ids.version,
          pending_routine_proposal_id: ids.proposal,
        },
        personal_plan_routine_versions: { id: ids.version, payload },
        // The frozen Routine must remain aligned with its owner-scoped refined
        // Bedarfsplan source, even when that source currently has no roles.
        personal_plan_need_versions: {
          id: ids.refined,
          output_snapshot: { renderedOrder: [] },
        },
        personal_plan_routine_proposals: {
          id: ids.proposal,
          candidate_routine_version_id: ids.version,
          source_revision: 7,
          delta: { schemaVersion: 1, direct: [], consequential: [], unchangedItemCount: 0 },
        },
      }),
    ...overrides,
  }
}

test("routine read derives auth, owner-scopes admin reads, and returns a no-store typed view", async () => {
  const response = await createPersonalPlanRoutineRouteHandlers(routeDeps()).GET()
  assert.equal(response.status, 200)
  assert.equal(response.headers.get("Cache-Control"), "no-store")
  const body = await response.json()
  assert.equal(body.status, "active")
  assert.equal(body.planRevision, 4)
  assert.equal(body.sourceRevision, 7)
  assert.equal(body.pendingProposal.id, ids.proposal)
})

test("routine read preserves no-plan versus incomplete-plan and disables new entry while off", async () => {
  let response = await createPersonalPlanRoutineRouteHandlers(
    routeDeps({ client: () => client({}) }),
  ).GET()
  assert.deepEqual(await response.json(), { status: "no_personal_plan" })
  response = await createPersonalPlanRoutineRouteHandlers(
    routeDeps({
      enabled: () => false,
      client: () =>
        client({
          personal_plans: {
            id: ids.plan,
            revision: 1,
            source_revision: 1,
            active_routine_version_id: null,
            pending_routine_proposal_id: ids.proposal,
          },
        }),
    }),
  ).GET()
  assert.deepEqual(
    [response.status, await response.json()],
    [404, { error: "personal_plan_not_available" }],
  )
})

test("attention never leaks proposal facts and is false when Stage 4 is disabled", async () => {
  let constructed = false
  let response = await createPersonalPlanRoutineAttentionRouteHandlers(
    routeDeps({
      client: () => {
        constructed = true
        return client({})
      },
    }),
  ).GET()
  assert.deepEqual(await response.json(), { hasPendingProposal: true })
  assert.equal(constructed, false)
  response = await createPersonalPlanRoutineAttentionRouteHandlers(
    routeDeps({ enabled: () => false }),
  ).GET()
  assert.deepEqual(await response.json(), { hasPendingProposal: false })
})

test("attention stays non-exposing before the Stage 4 frontier and journey-loader failure fails closed", async () => {
  let constructed = false
  let response = await createPersonalPlanRoutineAttentionRouteHandlers(
    routeDeps({
      loadJourneyAccess: async () => ({
        kind: "personal_plan",
        personalPlanId: ids.plan,
        frontier: "stage3",
        nextHref: "/plan-start",
        allowed: { stage1: true, stage2: true, stage3: true, stage4: false, stage5: false },
      }),
      client: () => {
        constructed = true
        return client({})
      },
    }),
  ).GET()
  assert.deepEqual(await response.json(), { hasPendingProposal: false })
  assert.equal(constructed, false)

  response = await createPersonalPlanRoutineRouteHandlers(
    routeDeps({
      loadJourneyAccess: async () => {
        throw new Error("journey loader unavailable")
      },
      client: () => {
        constructed = true
        return client({})
      },
    }),
  ).GET()
  assert.deepEqual(
    [response.status, await response.json()],
    [503, { error: "temporarily_unavailable" }],
  )
  assert.equal(constructed, false)
})

test("routine endpoints require an authenticated user", async () => {
  const response = await createPersonalPlanRoutineRouteHandlers(
    routeDeps({ getUserId: async () => null }),
  ).GET()
  assert.deepEqual([response.status, await response.json()], [401, { error: "unauthorized" }])
})

test("routine read rejects a Personal Plan owner before constructing its read client when Stage 4 is beyond the frontier", async () => {
  let constructed = false
  const response = await createPersonalPlanRoutineRouteHandlers(
    routeDeps({
      loadJourneyAccess: async () => ({
        kind: "personal_plan",
        personalPlanId: ids.plan,
        frontier: "stage3",
        nextHref: "/plan-start",
        allowed: { stage1: true, stage2: true, stage3: true, stage4: false, stage5: false },
      }),
      client: () => {
        constructed = true
        return client({})
      },
    }),
  ).GET()

  assert.deepEqual([response.status, await response.json()], [409, { error: "stage_not_ready" }])
  assert.equal(constructed, false)
})

test("proposal mutations reject a Personal Plan owner before parsing or constructing a service when Stage 4 is beyond the frontier", async () => {
  let constructed = false
  const response = await createPersonalPlanRoutineProposalRouteHandlers({
    enabled: () => true,
    getUserId: async () => "owner-1",
    loadJourneyAccess: async () => ({
      kind: "personal_plan",
      personalPlanId: ids.plan,
      frontier: "stage3",
      nextHref: "/plan-start",
      allowed: { stage1: true, stage2: true, stage3: true, stage4: false, stage5: false },
    }),
    service: () => {
      constructed = true
      return {} as never
    },
  } as never).POST(
    new Request("http://local/api/personal-plan/routine/proposals", { method: "POST", body: "{}" }),
  )

  assert.deepEqual([response.status, await response.json()], [409, { error: "stage_not_ready" }])
  assert.equal(constructed, false)
})

test("proposal mutation derives the user before constructing the service and rejects unbounded bodies", async () => {
  let constructed = false
  const handlers = createPersonalPlanRoutineProposalRouteHandlers({
    enabled: () => true,
    getUserId: async () => null,
    loadJourneyAccess: async () => stage4Access,
    service: () => {
      constructed = true
      return {} as never
    },
  })
  const response = await handlers.POST(
    new Request("http://local/api/personal-plan/routine/proposals", { method: "POST", body: "{}" }),
  )
  assert.equal(response.status, 401)
  assert.equal(constructed, false)

  const invalid = await createPersonalPlanRoutineProposalRouteHandlers({
    enabled: () => true,
    getUserId: async () => "owner-1",
    loadJourneyAccess: async () => stage4Access,
    service: () => ({}) as never,
  }).POST(
    new Request("http://local/api/personal-plan/routine/proposals", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        expectedRevision: 1,
        expectedSourceRevision: 1,
        operations: Array.from({ length: 33 }, () => ({
          kind: "assignment_remove",
          assignmentKey: "x",
        })),
      }),
    }),
  )
  assert.deepEqual(
    [invalid.status, await invalid.json(), invalid.headers.get("Cache-Control")],
    [400, { error: "invalid_request" }, "no-store"],
  )
})

test("initial proposal rejection remains a typed unambiguous non-mutating error", async () => {
  const handlers = createPersonalPlanRoutineResolveRouteHandlers({
    enabled: () => true,
    getUserId: async () => "owner-1",
    loadJourneyAccess: async () => stage4Access,
    service: () =>
      ({ resolve: async () => ({ status: "initial_proposal_not_rejectable" }) }) as never,
  })
  const response = await handlers.POST(
    new Request("http://local", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "reject", expectedRevision: 1 }),
    }),
    { params: Promise.resolve({ proposalId: ids.proposal }) },
  )
  assert.deepEqual(
    [response.status, await response.json()],
    [422, { error: "initial_proposal_not_rejectable" }],
  )
})

test("nudge dismiss requires auth, gates on Stage 4, and returns the typed snooze result", async () => {
  const unauthenticated = await createPersonalPlanRoutineNudgeDismissRouteHandlers({
    enabled: () => true,
    getUserId: async () => null,
    loadJourneyAccess: async () => stage4Access,
    service: () => ({ dismiss: async () => assert.fail("must not be constructed") }) as never,
  }).POST()
  assert.deepEqual(
    [unauthenticated.status, await unauthenticated.json()],
    [401, { error: "unauthorized" }],
  )

  const disabled = await createPersonalPlanRoutineNudgeDismissRouteHandlers({
    enabled: () => false,
    getUserId: async () => "owner-1",
    loadJourneyAccess: async () => stage4Access,
    service: () => ({ dismiss: async () => assert.fail("must not be constructed") }) as never,
  }).POST()
  assert.deepEqual(
    [disabled.status, await disabled.json()],
    [404, { error: "personal_plan_not_available" }],
  )

  let constructed = false
  const beyondFrontier = await createPersonalPlanRoutineNudgeDismissRouteHandlers({
    enabled: () => true,
    getUserId: async () => "owner-1",
    loadJourneyAccess: async () => ({
      kind: "personal_plan",
      personalPlanId: ids.plan,
      frontier: "stage3",
      nextHref: "/plan-start",
      allowed: { stage1: true, stage2: true, stage3: true, stage4: false, stage5: false },
    }),
    service: () => {
      constructed = true
      return { dismiss: async () => assert.fail("must not be constructed") } as never
    },
  }).POST()
  assert.deepEqual(
    [beyondFrontier.status, await beyondFrontier.json()],
    [409, { error: "stage_not_ready" }],
  )
  assert.equal(constructed, false)

  const success = await createPersonalPlanRoutineNudgeDismissRouteHandlers({
    enabled: () => true,
    getUserId: async () => "owner-1",
    loadJourneyAccess: async () => stage4Access,
    service: () =>
      ({
        dismiss: async () => ({
          status: "dismissed",
          nudgeDismissedUntil: "2026-08-17T12:00:00.000Z",
        }),
      }) as never,
  }).POST()
  assert.deepEqual(
    [success.status, await success.json(), success.headers.get("Cache-Control")],
    [200, { status: "dismissed", nudgeDismissedUntil: "2026-08-17T12:00:00.000Z" }, "no-store"],
  )

  const noPlan = await createPersonalPlanRoutineNudgeDismissRouteHandlers({
    enabled: () => true,
    getUserId: async () => "owner-1",
    loadJourneyAccess: async () => stage4Access,
    service: () => ({ dismiss: async () => ({ status: "no_personal_plan" }) }) as never,
  }).POST()
  assert.deepEqual([noPlan.status, await noPlan.json()], [404, { error: "no_personal_plan" }])
})
