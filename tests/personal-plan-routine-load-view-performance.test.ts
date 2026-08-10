import assert from "node:assert/strict"
import test from "node:test"

import { loadPersonalPlanRoutineView } from "../src/lib/personal-plan/routine/load-view"
import type { PersonalPlanRoutineReadClient } from "../src/lib/personal-plan/routine/repository"
import { knownRoutineAttentionFromEvent } from "../src/components/routine/personal-plan/routine-attention-indicator"
import { reportPersonalPlanTransitionTiming } from "../src/lib/personal-plan/transition-performance"

const ids = {
  plan: "11111111-1111-4111-8111-111111111111",
  active: "22222222-2222-4222-8222-222222222222",
  candidate: "33333333-3333-4333-8333-333333333333",
  proposal: "44444444-4444-4444-8444-444444444444",
  refined: "55555555-5555-4555-8555-555555555555",
}

function routinePayload(versionId: string) {
  return {
    schemaVersion: 1,
    planId: ids.plan,
    versionId,
    parentVersionId: null,
    source: {
      refinedVersionId: ids.refined,
      productPortfolioVersionId: ids.active,
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
    createdAt: "2026-08-10T00:00:00.000Z",
  }
}

function trackedClient(input: {
  calls: string[]
  beforeRead?: (table: string, filters: ReadonlyMap<string, string>) => Promise<void> | void
}): PersonalPlanRoutineReadClient {
  return {
    from(table) {
      const filters = new Map<string, string>()
      const query = {
        select() {
          return query
        },
        eq(column: string, value: string) {
          filters.set(column, value)
          return query
        },
        async maybeSingle() {
          input.calls.push(table)
          await input.beforeRead?.(table, filters)

          if (table === "personal_plans") {
            return {
              data: {
                id: ids.plan,
                revision: 4,
                source_revision: 7,
                active_routine_version_id: ids.active,
                pending_routine_proposal_id: ids.proposal,
              },
              error: null,
            }
          }
          if (table === "personal_plan_routine_proposals") {
            return {
              data: {
                id: ids.proposal,
                candidate_routine_version_id: ids.candidate,
                source_revision: 7,
                delta: {
                  schemaVersion: 1,
                  direct: [],
                  consequential: [],
                  unchangedItemCount: 0,
                },
              },
              error: null,
            }
          }
          if (table === "personal_plan_routine_versions") {
            const versionId = filters.get("id")
            return {
              data: versionId ? { id: versionId, payload: routinePayload(versionId) } : null,
              error: null,
            }
          }
          return { data: null, error: null }
        },
      }
      return query
    },
  }
}

test("routine view starts independent active-version and proposal reads together", async () => {
  let releaseActive!: () => void
  const activeMayFinish = new Promise<void>((resolve) => {
    releaseActive = resolve
  })
  let proposalStarted = false
  const calls: string[] = []
  const viewPromise = loadPersonalPlanRoutineView({
    client: trackedClient({
      calls,
      beforeRead: async (table, filters) => {
        if (table === "personal_plan_routine_versions" && filters.get("id") === ids.active) {
          await activeMayFinish
        }
        if (table === "personal_plan_routine_proposals") proposalStarted = true
      },
    }),
    userId: "owner-1",
    enabled: true,
  })

  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(proposalStarted, true)
  releaseActive()
  const view = await viewPromise
  assert.equal(view.status, "active")
  assert.deepEqual(calls, [
    "personal_plans",
    "personal_plan_routine_versions",
    "personal_plan_routine_proposals",
    "personal_plan_routine_versions",
  ])
})

test("accepted-routine-only reads omit pending proposal and candidate queries", async () => {
  const calls: string[] = []
  const view = await loadPersonalPlanRoutineView({
    client: trackedClient({ calls }),
    userId: "owner-1",
    enabled: true,
    includePendingProposal: false,
  } as Parameters<typeof loadPersonalPlanRoutineView>[0] & {
    includePendingProposal: boolean
  })

  assert.equal(view.status, "active")
  assert.deepEqual(calls, ["personal_plans", "personal_plan_routine_versions"])
})

test("routine-attention refresh events use known canonical state without another read", () => {
  assert.equal(
    knownRoutineAttentionFromEvent({ detail: { hasPendingProposal: true } } as unknown as Event),
    true,
  )
  assert.equal(
    knownRoutineAttentionFromEvent({ detail: { hasPendingProposal: false } } as unknown as Event),
    false,
  )
  assert.equal(knownRoutineAttentionFromEvent(new Event("refresh")), null)
})

test("transition timing emits a stable non-identifying production comparison envelope", () => {
  const events: Array<[string, Record<string, string | number>]> = []
  reportPersonalPlanTransitionTiming(
    {
      layer: "server",
      operation: "application_page_resolve",
      outcome: "ready",
      durationMs: 12.345,
      status: 200,
    },
    (event, details) => events.push([event, details]),
  )

  assert.deepEqual(events, [
    [
      "personal_plan_transition_performance",
      {
        layer: "server",
        operation: "application_page_resolve",
        outcome: "ready",
        duration_ms: 12.35,
        status: 200,
      },
    ],
  ])
})
