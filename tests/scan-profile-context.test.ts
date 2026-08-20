import assert from "node:assert/strict"
import test from "node:test"

import { loadScanEvaluationContext } from "../src/lib/scan/profile-context"

type Handler = (calls: { filters: Map<string, unknown> }) => { data: unknown; error: unknown }

function stubClient(handlers: Record<string, Handler>) {
  return {
    from(table: string) {
      const calls = { filters: new Map<string, unknown>() }
      const chain = {
        select: () => chain,
        eq: (column: string, value: unknown) => {
          calls.filters.set(column, value)
          return chain
        },
        maybeSingle: async () => {
          const handler = handlers[table]
          if (!handler) throw new Error(`unexpected table ${table}`)
          return handler(calls)
        },
      }
      return chain
    },
  }
}

const refinedSnapshot = {
  schemaVersion: 1,
  snapshotKind: "initial_need",
  computationVersion: "stage1-v1",
  inputHash: "refined-hash",
  createdAt: "2026-08-01T00:00:00.000Z",
  sourceQuiz: {},
  profile: { hair: { thickness: "coarse" } },
  assessments: {},
  decisions: [{ category: "shampoo" }],
  coverage: [{ job: "wet_wash_cleansing" }],
  productPreviews: [],
  renderedOrder: [],
  deferredFacts: [],
}

const initialSnapshot = {
  ...refinedSnapshot,
  inputHash: "initial-hash",
  profile: { hair: { thickness: "fine" } },
}

test("loadScanEvaluationContext: refined snapshot present takes precedence", async () => {
  const client = stubClient({
    personal_plans: () => ({
      data: {
        id: "plan-1",
        current_initial_need_version_id: "initial-1",
        current_refined_need_version_id: "refined-1",
      },
      error: null,
    }),
    personal_plan_need_versions: (calls) => {
      assert.equal(calls.filters.get("kind"), "refined")
      assert.equal(calls.filters.get("id"), "refined-1")
      assert.equal(calls.filters.get("personal_plan_id"), "plan-1")
      return { data: { output_snapshot: refinedSnapshot }, error: null }
    },
  })

  const context = await loadScanEvaluationContext(client as never, "user-1")

  assert.equal(context?.snapshotSource, "refined")
  assert.equal(context?.refinedVersionId, "refined-1")
  assert.equal(context?.refinedInputHash, "refined-hash")
  assert.equal(context?.snapshot.profile.hair.thickness, "coarse")
})

test("loadScanEvaluationContext: falls back to initial when no refined version id is set", async () => {
  const client = stubClient({
    personal_plans: () => ({
      data: {
        id: "plan-1",
        current_initial_need_version_id: "initial-1",
        current_refined_need_version_id: null,
      },
      error: null,
    }),
    personal_plan_need_versions: (calls) => {
      assert.equal(calls.filters.get("kind"), "initial")
      assert.equal(calls.filters.get("id"), "initial-1")
      return { data: { output_snapshot: initialSnapshot }, error: null }
    },
  })

  const context = await loadScanEvaluationContext(client as never, "user-1")

  assert.equal(context?.snapshotSource, "initial")
  // Stable equivalents mirroring product-previews.ts: the initial version id stands in
  // for refinedVersionId, and the snapshot's own inputHash stands in for refinedInputHash.
  assert.equal(context?.refinedVersionId, "initial-1")
  assert.equal(context?.refinedInputHash, "initial-hash")
  assert.equal(context?.snapshot.profile.hair.thickness, "fine")
})

test("loadScanEvaluationContext: falls back to initial when refined row cannot be loaded", async () => {
  const client = stubClient({
    personal_plans: () => ({
      data: {
        id: "plan-1",
        current_initial_need_version_id: "initial-1",
        current_refined_need_version_id: "refined-stale",
      },
      error: null,
    }),
    personal_plan_need_versions: (calls) => {
      if (calls.filters.get("kind") === "refined") return { data: null, error: null }
      return { data: { output_snapshot: initialSnapshot }, error: null }
    },
  })

  const context = await loadScanEvaluationContext(client as never, "user-1")

  assert.equal(context?.snapshotSource, "initial")
})

test("loadScanEvaluationContext: no plan row is null", async () => {
  const client = stubClient({
    personal_plans: () => ({ data: null, error: null }),
  })

  const context = await loadScanEvaluationContext(client as never, "user-1")

  assert.equal(context, null)
})

test("loadScanEvaluationContext: plan with no need versions at all is null", async () => {
  const client = stubClient({
    personal_plans: () => ({
      data: {
        id: "plan-1",
        current_initial_need_version_id: null,
        current_refined_need_version_id: null,
      },
      error: null,
    }),
  })

  const context = await loadScanEvaluationContext(client as never, "user-1")

  assert.equal(context, null)
})
