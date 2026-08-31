import assert from "node:assert/strict"
import test from "node:test"

import { classifyModuleDrivenRefinedVersion } from "../../../src/lib/personal-plan/refinement-recompute/module-driven-classification"

const ids = {
  plan: "11111111-1111-4111-8111-111111111111",
  current: "33333333-3333-4333-8333-333333333333",
  previous: "44444444-4444-4444-8444-444444444444",
}

type Read = { table: string; filters: Record<string, unknown> }

function fakeAdmin(rows: {
  plan?: Record<string, unknown> | null
  planError?: unknown
  drafts?: Array<Record<string, unknown>>
  draftsError?: unknown
}) {
  const reads: Read[] = []
  const client = {
    from(table: string) {
      const filters: Record<string, unknown> = {}
      reads.push({ table, filters })
      const query = {
        select() {
          return query
        },
        eq(column: string, value: unknown) {
          filters[column] = value
          return query
        },
        async maybeSingle() {
          if (table !== "personal_plans") throw new Error(`unexpected maybeSingle on ${table}`)
          return { data: rows.plan ?? null, error: rows.planError ?? null }
        },
        // PostgREST list queries are thenables, not explicit executors.
        then(
          resolve: (value: { data: unknown; error: unknown }) => unknown,
          reject: (reason: unknown) => unknown,
        ) {
          if (table !== "personal_plan_refinement_drafts") {
            return Promise.reject(new Error(`unexpected list read on ${table}`)).then(
              resolve,
              reject,
            )
          }
          return Promise.resolve({
            data: rows.drafts ?? [],
            error: rows.draftsError ?? null,
          }).then(resolve, reject)
        },
      }
      return query
    },
  }
  return { client, reads }
}

function classify(client: unknown, refinedVersionId = ids.current) {
  return classifyModuleDrivenRefinedVersion({
    client: client as never,
    userId: "owner-a",
    personalPlanId: ids.plan,
    refinedVersionId,
  })
}

test("a superseded refined version is stale without reading the refinement lineage", async () => {
  const { client, reads } = fakeAdmin({
    plan: { current_refined_need_version_id: ids.current },
    drafts: [
      {
        module_projections: { habits: { needVersionId: ids.previous } },
        result_refined_need_version_id: null,
      },
    ],
  })

  assert.equal(await classify(client, ids.previous), "stale_target")
  assert.deepEqual(
    reads.map((read) => read.table),
    ["personal_plans"],
  )
})

test("a plan without a current refined version is stale rather than module-driven", async () => {
  const { client } = fakeAdmin({ plan: { current_refined_need_version_id: null } })
  assert.equal(await classify(client), "stale_target")
})

test("a missing plan row is stale rather than an exception", async () => {
  const { client } = fakeAdmin({ plan: null })
  assert.equal(await classify(client), "stale_target")
})

test("a module projection naming the current version is module-driven, owner-scoped on both reads", async () => {
  const { client, reads } = fakeAdmin({
    plan: { current_refined_need_version_id: ids.current },
    drafts: [
      {
        module_projections: {
          habits: { needVersionId: ids.current, projectedAtRevision: 4, stage3Handoff: false },
        },
        result_refined_need_version_id: null,
      },
    ],
  })

  assert.equal(await classify(client), "module_driven")
  assert.deepEqual(reads, [
    { table: "personal_plans", filters: { id: ids.plan, user_id: "owner-a" } },
    {
      table: "personal_plan_refinement_drafts",
      filters: { personal_plan_id: ids.plan, user_id: "owner-a" },
    },
  ])
})

test("a completed module draft whose result is the current version is module-driven", async () => {
  const { client } = fakeAdmin({
    plan: { current_refined_need_version_id: ids.current },
    drafts: [
      {
        module_projections: {
          products: { needVersionId: ids.previous, projectedAtRevision: 2, stage3Handoff: true },
        },
        result_refined_need_version_id: ids.current,
      },
    ],
  })

  assert.equal(await classify(client), "module_driven")
})

test("a module-driven plan whose lineage names only other versions is not module-driven", async () => {
  const { client } = fakeAdmin({
    plan: { current_refined_need_version_id: ids.current },
    drafts: [
      {
        module_projections: {
          habits: { needVersionId: ids.previous, projectedAtRevision: 1, stage3Handoff: false },
        },
        result_refined_need_version_id: ids.previous,
      },
    ],
  })

  assert.equal(await classify(client), "not_module_driven")
})

test("a linear refinement completion carries no module lineage and stays on today's terminal path", async () => {
  const { client } = fakeAdmin({
    plan: { current_refined_need_version_id: ids.current },
    drafts: [{ module_projections: {}, result_refined_need_version_id: ids.current }],
  })

  assert.equal(await classify(client), "not_module_driven")
})

test("a plan with no refinement draft at all is not module-driven", async () => {
  const { client } = fakeAdmin({
    plan: { current_refined_need_version_id: ids.current },
    drafts: [],
  })

  assert.equal(await classify(client), "not_module_driven")
})

test("read failures surface instead of being misclassified as not module-driven", async () => {
  const planFailure = fakeAdmin({ planError: new Error("plan read failed") })
  await assert.rejects(() => classify(planFailure.client), /plan read failed/)

  const draftFailure = fakeAdmin({
    plan: { current_refined_need_version_id: ids.current },
    draftsError: new Error("draft read failed"),
  })
  await assert.rejects(() => classify(draftFailure.client), /draft read failed/)
})
