import assert from "node:assert/strict"
import test from "node:test"

import {
  adaptAcceptedActiveRoutineForApplication,
  loadImmutableRoutineProfile,
  type ApplicationRoutineReadClient,
} from "../src/lib/personal-plan/routine/application-adapter"
import type { RoutinePayloadV1 } from "../src/lib/personal-plan/routine/contracts"

const planId = "10000000-0000-4000-8000-000000000001"
const refinedVersionId = "20000000-0000-4000-8000-000000000001"
const productId = "30000000-0000-4000-8000-000000000001"

function activePayload(): RoutinePayloadV1 {
  return {
    planId,
    items: [
      {
        itemKey: "item:shampoo",
        assignmentKey: "assignment:shampoo",
        category: "shampoo",
        role: "shampoo_everyday",
        state: { inclusion: "included", availability: "owned" },
        executable: true,
        product: { kind: "owned", productId, displayName: "Never sent to observability" },
      },
    ],
  } as RoutinePayloadV1
}

function productClient(rows: unknown[] | null, error: unknown = null) {
  const calls: Array<{ table: string; select?: string; ids?: string[] }> = []
  const client = {
    from(table: string) {
      const query = {
        select(columns: string) {
          calls.push({ table, select: columns })
          return query
        },
        eq() {
          return query
        },
        in(_column: string, ids: string[]) {
          calls[calls.length - 1]!.ids = ids
          return Promise.resolve({ data: rows, error })
        },
        maybeSingle() {
          return Promise.resolve({ data: null, error })
        },
      }
      return query
    },
  }
  return { client: client as unknown as ApplicationRoutineReadClient, calls }
}

test("Stage 5 adapter makes one bulk product read and preserves verified accepted identities", async () => {
  const { client, calls } = productClient([
    {
      id: productId,
      category: "shampoo",
      category_key: "shampoo",
      is_active: true,
      lifecycle_status: "active",
    },
  ])
  const result = await adaptAcceptedActiveRoutineForApplication({
    client,
    activeVersion: { id: "routine-v1", payload: activePayload() },
  })

  assert.equal(calls.length, 1)
  assert.equal(calls[0]!.table, "products")
  assert.deepEqual(calls[0]!.ids, [productId])
  assert.deepEqual(
    result.routineItems.map((item) => item.productId),
    [productId],
  )
})

for (const [label, row] of [
  ["missing", null],
  [
    "inactive",
    {
      id: productId,
      category: "shampoo",
      category_key: "shampoo",
      is_active: false,
      lifecycle_status: "active",
    },
  ],
  [
    "recategorized",
    {
      id: productId,
      category: "conditioner",
      category_key: "conditioner",
      is_active: true,
      lifecycle_status: "active",
    },
  ],
] as const) {
  test(`Stage 5 adapter fails closed for ${label} accepted product`, async () => {
    const { client } = productClient(row ? [row] : [])
    await assert.rejects(
      adaptAcceptedActiveRoutineForApplication({
        client,
        activeVersion: { id: "routine-v1", payload: activePayload() },
      }),
      /accepted_routine_product_unavailable/,
    )
  })
}

function profileClient(data: unknown, error: unknown = null) {
  const filters: Array<[string, unknown]> = []
  const client = {
    from() {
      const query = {
        select() {
          return query
        },
        eq(key: string, value: unknown) {
          filters.push([key, value])
          return query
        },
        in() {
          return Promise.resolve({ data: [], error: null })
        },
        maybeSingle() {
          return Promise.resolve({ data, error })
        },
      }
      return query
    },
  }
  return { client: client as unknown as ApplicationRoutineReadClient, filters }
}

test("immutable refined profile uses exactly the accepted Routine source version and known heat routes", async () => {
  const { client, filters } = profileClient({
    output_snapshot: {
      profile: { hair: { length: "medium", density: "high", thickness: "fine" } },
      assessments: { heatExposure: { events: [{ route: "airflow_shaping" }] } },
    },
  })
  const result = await loadImmutableRoutineProfile({
    client,
    userId: "user-1",
    planId,
    refinedVersionId,
  })

  assert.deepEqual(result, {
    length: "medium",
    density: "high",
    thickness: "fine",
    dryingRoute: "blow_dry",
  })
  assert.deepEqual(filters, [
    ["id", refinedVersionId],
    ["user_id", "user-1"],
    ["personal_plan_id", planId],
    ["kind", "refined"],
  ])
})

test("immutable refined profile prioritizes direct-contact heat and never infers air dry", async () => {
  const direct = profileClient({
    output_snapshot: {
      profile: { hair: { length: "short", density: "low", thickness: "normal" } },
      assessments: {
        heatExposure: { events: [{ route: "airflow_shaping" }, { route: "direct_contact_heat" }] },
      },
    },
  })
  assert.equal(
    (
      await loadImmutableRoutineProfile({
        client: direct.client,
        userId: "u",
        planId,
        refinedVersionId,
      })
    ).dryingRoute,
    "heat_tool",
  )

  const unknown = profileClient({
    output_snapshot: {
      profile: { hair: { length: "short", density: "low", thickness: "normal" } },
      assessments: { heatExposure: { events: [] } },
    },
  })
  assert.equal(
    (
      await loadImmutableRoutineProfile({
        client: unknown.client,
        userId: "u",
        planId,
        refinedVersionId,
      })
    ).dryingRoute,
    undefined,
  )
})

test("immutable refined profile fails closed on missing row or database error", async () => {
  await assert.rejects(
    loadImmutableRoutineProfile({
      client: profileClient(null).client,
      userId: "u",
      planId,
      refinedVersionId,
    }),
    /refined_need_not_found/,
  )
  await assert.rejects(
    loadImmutableRoutineProfile({
      client: profileClient(null, new Error("database unavailable")).client,
      userId: "u",
      planId,
      refinedVersionId,
    }),
    /database unavailable/,
  )
})
