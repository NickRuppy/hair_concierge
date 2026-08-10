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

function plannedPayload(): RoutinePayloadV1 {
  return {
    ...activePayload(),
    items: [
      {
        ...activePayload().items[0],
        itemKey: "item:planned-conditioner",
        assignmentKey: "assignment:planned-conditioner",
        category: "conditioner",
        role: "conditioner_rinse_out",
        roleOrder: 20,
        state: { inclusion: "included", availability: "planned" },
        executable: false,
        product: {
          kind: "planned",
          plannedPurchaseId: "purchase:conditioner",
          productId,
          displayName: "Vorgemerkter Conditioner",
        },
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

test("Stage 5 adapter preserves a canonical planned product as provisional guidance input", async () => {
  const { client } = productClient([
    {
      id: productId,
      category: "conditioner",
      category_key: "conditioner",
      is_active: true,
      lifecycle_status: "active",
    },
  ])

  const result = await adaptAcceptedActiveRoutineForApplication({
    client,
    activeVersion: { id: "routine-v1", payload: plannedPayload() },
  })

  assert.equal(result.routineItems.length, 1)
  assert.deepEqual(
    result.routineItems.map(({ productName, availability, executable, routineOrder }) => ({
      productName,
      availability,
      executable,
      routineOrder,
    })),
    [
      {
        productName: "Vorgemerkter Conditioner",
        availability: "planned",
        executable: false,
        routineOrder: 0,
      },
    ],
  )
})

test("Stage 5 adapter preserves an unresolved identity position without exposing its product name", async () => {
  const payload = plannedPayload()
  payload.items[0] = {
    ...payload.items[0]!,
    product: {
      kind: "planned",
      plannedPurchaseId: "purchase:conditioner",
      productId: null,
      displayName: "Vorgemerkter Conditioner",
    },
  }
  const { client, calls } = productClient([])

  const result = await adaptAcceptedActiveRoutineForApplication({
    client,
    activeVersion: { id: "routine-v1", payload },
  })

  assert.equal(calls.length, 0)
  assert.deepEqual(result.routineItems, [])
  assert.deepEqual(result.unresolvedRoutineItems, [
    {
      itemId: "item:planned-conditioner",
      category: "conditioner",
      role: "condition",
      routineOrder: 0,
      applicationInstanceKey: "assignment:planned-conditioner",
    },
  ])
  assert.doesNotMatch(JSON.stringify(result.unresolvedRoutineItems), /Vorgemerkter Conditioner/)
})

test("Stage 5 adapter joins reviewed exact Heat guidance for the same canonical planned product", async () => {
  const calls: string[] = []
  const client = {
    from(table: string) {
      calls.push(table)
      const query = {
        select() {
          return query
        },
        eq() {
          return query
        },
        in() {
          if (table === "products") {
            return Promise.resolve({
              data: [
                {
                  id: productId,
                  category: "heat_protectant",
                  category_key: "heat_protectant",
                  is_active: true,
                  lifecycle_status: "active",
                  product_heat_protectant_specs: [{ provides_heat_protection: true }],
                },
              ],
              error: null,
            })
          }
          return Promise.resolve({
            data: [
              {
                product_id: productId,
                category: "heat_protectant",
                role: "pre_heat_protection",
                application_state: "either",
                reapplication: "not_stated",
                source_url: "https://example.com/heat",
                source_text: "Vor dem bestätigten Wärmeschritt gleichmäßig auftragen.",
                updated_at: "2026-08-10T09:00:00.000Z",
              },
            ],
            error: null,
          })
        },
        maybeSingle() {
          return Promise.resolve({ data: null, error: null })
        },
      }
      return query
    },
  } as unknown as ApplicationRoutineReadClient
  const payload = plannedPayload()
  payload.items[0] = {
    ...payload.items[0]!,
    category: "heat_protectant",
    role: "pre_heat_protection",
  }

  const result = await adaptAcceptedActiveRoutineForApplication({
    client,
    activeVersion: { id: "routine-v1", payload },
  })

  assert.deepEqual(calls, ["products", "product_application_protocols"])
  assert.equal(result.exactGuidanceProtocols.length, 2)
  assert.equal(result.routineItems[0]?.catalogFacts.applicationState, "either")
  assert.equal(result.routineItems[0]?.catalogFacts.reapplication, "not_stated")
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

test("immutable refined profile preserves qualifying Heat event identities and tools", async () => {
  const { client } = profileClient({
    output_snapshot: {
      profile: { hair: { length: "medium", density: "medium", thickness: "normal" } },
      assessments: {
        heatExposure: {
          events: [
            { id: "heat:dryer", tool: "hair_dryer", route: "airflow_shaping" },
            { id: "heat:straightener", tool: "straightener", route: "direct_contact_heat" },
            { id: "heat:ordinary", tool: "hair_dryer", route: "ordinary_airflow" },
          ],
        },
      },
    },
  })

  const profile = await loadImmutableRoutineProfile({
    client,
    userId: "u",
    planId,
    refinedVersionId,
  })

  assert.deepEqual(profile.heatEvents, [
    { id: "heat:dryer", tool: "hair_dryer", route: "airflow_shaping" },
    { id: "heat:straightener", tool: "straightener", route: "direct_contact_heat" },
  ])
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
