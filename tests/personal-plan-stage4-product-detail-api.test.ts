import assert from "node:assert/strict"
import test from "node:test"

import { createPersonalPlanRoutineItemRouteHandlers } from "../src/app/api/personal-plan/routine/items/[itemKey]/route"
import { createRoutineProductDetailService } from "../src/lib/personal-plan/routine/product-detail-service"

const ids = {
  plan: "11111111-1111-4111-8111-111111111111",
  version: "22222222-2222-4222-8222-222222222222",
  refined: "44444444-4444-4444-8444-444444444444",
  product: "55555555-5555-4555-8555-555555555555",
}

function payload(
  product: Record<string, unknown> = {
    kind: "owned",
    capturedProductId: "capture-1",
    productId: ids.product,
    displayName: "Frozen Shampoo",
  },
) {
  return {
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
    intent: {
      schemaVersion: 1,
      categories: [
        {
          category: "shampoo",
          inclusion: "included",
          inclusionSource: "stage3",
          assignments: [],
        },
      ],
    },
    sections: [
      { key: "basis", itemKeys: ["wash"] },
      { key: "optional", itemKeys: [] },
    ],
    items: [
      {
        itemKey: "wash",
        assignmentKey: "wash-assignment",
        category: "shampoo",
        role: "shampoo_everyday",
        purposeKey: "shampoo_everyday",
        roleOrder: 0,
        state: {
          systemAssessment: "basis",
          inclusion: "included",
          availability: product.kind === "planned" ? "planned" : "owned",
          fitDecision: "standard",
        },
        product,
        cadence: {
          recommended: null,
          userOverride: null,
          displayKey: "personal_plan.cadence.none",
        },
        sourceDecisionKeys: ["decision-1"],
        authorityRuleIds: ["rule-1"],
        executable: true,
      },
    ],
    createdAt: "2026-08-08T00:00:00.000Z",
  }
}

function client(input: { plan?: unknown; version?: unknown; product?: unknown }) {
  const calls: Array<{ table: string; filters: Array<[string, unknown]> }> = []
  const valueFor = (table: string) => {
    if (table === "personal_plans") return input.plan ?? null
    if (table === "personal_plan_routine_versions") return input.version ?? null
    if (table === "personal_plan_need_versions") {
      return {
        id: ids.refined,
        output_snapshot: { renderedOrder: ["shampoo"] },
      }
    }
    if (table === "products") return input.product ?? null
    return null
  }
  return {
    calls,
    from(table: string) {
      const filters: Array<[string, unknown]> = []
      const query = {
        select() {
          return query
        },
        eq(column: string, value: unknown) {
          filters.push([column, value])
          return query
        },
        async maybeSingle() {
          calls.push({ table, filters })
          return { data: valueFor(table), error: null }
        },
      }
      return query
    },
  }
}

function service(input: Parameters<typeof client>[0]) {
  return createRoutineProductDetailService({ client: client(input) })
}

test("item detail combines the frozen owner Routine item with current active commerce data", async () => {
  const db = client({
    plan: {
      id: ids.plan,
      revision: 2,
      source_revision: 3,
      active_routine_version_id: ids.version,
      pending_routine_proposal_id: null,
    },
    version: { id: ids.version, payload: payload() },
    product: {
      id: ids.product,
      name: "Current Shampoo",
      brand: "Current Brand",
      price_eur: 12.9,
      currency: "EUR",
      affiliate_link: "https://shop.example.test/current-shampoo",
      purchase_link_status: "available",
      updated_at: "2026-08-08T09:00:00.000Z",
      is_active: true,
    },
  })
  const result = await createRoutineProductDetailService({ client: db }).load({
    userId: "owner-1",
    itemKey: "wash",
    enabled: true,
  })

  assert.equal(result.status, "found")
  if (result.status !== "found") return
  assert.equal(result.detail.item.itemKey, "wash")
  assert.equal(result.detail.commerce.productUrl, "https://shop.example.test/current-shampoo")
  assert.equal(result.detail.commerce.priceLabel, "12,90 €")
  assert.equal(
    result.detail.commerce.freshnessLabel,
    "Produktdaten zuletzt aktualisiert am 08.08.2026.",
  )
  assert.match(result.detail.fitStatusLabel, /Empfohlen/)
  assert.ok(
    db.calls.some(
      (call) =>
        call.table === "products" &&
        call.filters.some(([column, value]) => column === "id" && value === ids.product) &&
        call.filters.some(([column, value]) => column === "is_active" && value === true),
    ),
  )
  assert.ok(
    db.calls
      .filter((call) => call.table !== "products")
      .every((call) =>
        call.filters.some(([column, value]) => column === "user_id" && value === "owner-1"),
      ),
  )
})

test("a null currency fails closed to no price label instead of assuming EUR", async () => {
  const result = await service({
    plan: {
      id: ids.plan,
      revision: 1,
      source_revision: 1,
      active_routine_version_id: ids.version,
      pending_routine_proposal_id: null,
    },
    version: { id: ids.version, payload: payload() },
    product: {
      id: ids.product,
      name: "Current Shampoo",
      brand: null,
      price_eur: 12.9,
      currency: null,
      affiliate_link: "https://shop.example.test/current-shampoo",
      purchase_link_status: "available",
      updated_at: "2026-08-08T09:00:00.000Z",
      is_active: true,
    },
  }).load({ userId: "owner-1", itemKey: "wash", enabled: true })
  assert.equal(result.status, "found")
  if (result.status !== "found") return
  assert.equal(result.detail.commerce.priceLabel, null)
  // Availability and the product link are unaffected by the unknown currency.
  assert.equal(result.detail.commerce.productUrl, "https://shop.example.test/current-shampoo")
})

test("detail does not turn an invalid current commerce URL into an outbound link", async () => {
  const result = await service({
    plan: {
      id: ids.plan,
      revision: 1,
      source_revision: 1,
      active_routine_version_id: ids.version,
      pending_routine_proposal_id: null,
    },
    version: { id: ids.version, payload: payload() },
    product: {
      id: ids.product,
      name: "Current Shampoo",
      brand: null,
      price_eur: 10,
      currency: "EUR",
      affiliate_link: "javascript:alert(1)",
      purchase_link_status: "available",
      updated_at: null,
      is_active: true,
    },
  }).load({ userId: "owner-1", itemKey: "wash", enabled: true })
  assert.equal(result.status, "found")
  if (result.status !== "found") return
  assert.equal(result.detail.commerce.productUrl, null)
  assert.equal(result.detail.commerce.availabilityLabel, "Derzeit kein verifizierter Produktlink")
})

test("a planned exact catalog product is allowed current commerce; foreign, no-plan, and forged item keys remain unavailable", async () => {
  const plannedDb = client({
    plan: {
      id: ids.plan,
      revision: 1,
      source_revision: 1,
      active_routine_version_id: ids.version,
      pending_routine_proposal_id: null,
    },
    version: {
      id: ids.version,
      payload: payload({
        kind: "planned",
        plannedPurchaseId: "planned-1",
        productId: ids.product,
        displayName: "Frozen planned Shampoo",
      }),
    },
    product: {
      id: ids.product,
      name: "Planned Shampoo",
      brand: null,
      price_eur: null,
      currency: "EUR",
      affiliate_link: "https://shop.example.test/planned",
      purchase_link_status: "available",
      updated_at: "2026-08-08T09:00:00.000Z",
      is_active: true,
    },
  })
  const planned = await createRoutineProductDetailService({ client: plannedDb }).load({
    userId: "owner-1",
    itemKey: "wash",
    enabled: true,
  })
  assert.equal(planned.status, "found")
  if (planned.status === "found")
    assert.equal(planned.detail.commerce.productUrl, "https://shop.example.test/planned")
  assert.ok(
    plannedDb.calls.some(
      (call) =>
        call.table === "products" &&
        call.filters.some(
          ([column, value]) => column === "lifecycle_status" && value === "active",
        ) &&
        call.filters.some(
          ([column, value]) => column === "is_chaarlie_recommended" && value === true,
        ),
    ),
  )

  const absent = await service({}).load({ userId: "owner-1", itemKey: "wash", enabled: true })
  assert.equal(absent.status, "not_found")
  const forged = await service({
    plan: {
      id: ids.plan,
      revision: 1,
      source_revision: 1,
      active_routine_version_id: ids.version,
      pending_routine_proposal_id: null,
    },
    version: { id: ids.version, payload: payload() },
  }).load({ userId: "owner-1", itemKey: "foreign-item", enabled: true })
  assert.equal(forged.status, "not_found")
})

test("route authenticates before constructing its admin-backed service and returns typed no-store errors", async () => {
  let constructed = false
  const handlers = createPersonalPlanRoutineItemRouteHandlers({
    enabled: () => true,
    getUserId: async () => null,
    loadJourneyAccess: async () => ({ kind: "legacy" }),
    service: () => {
      constructed = true
      return {} as never
    },
  })
  let response = await handlers.GET(new Request("http://local"), {
    params: Promise.resolve({ itemKey: "wash" }),
  })
  assert.deepEqual([response.status, await response.json()], [401, { error: "unauthorized" }])
  assert.equal(constructed, false)

  response = await createPersonalPlanRoutineItemRouteHandlers({
    enabled: () => false,
    getUserId: async () => "owner-1",
    loadJourneyAccess: async () => ({ kind: "legacy" }),
    service: () => ({ load: async () => ({ status: "found" as const, detail: {} }) }) as never,
  }).GET(new Request("http://local"), { params: Promise.resolve({ itemKey: "wash" }) })
  assert.deepEqual(
    [response.status, await response.json(), response.headers.get("Cache-Control")],
    [404, { error: "personal_plan_not_available" }, "no-store"],
  )
})

test("unknown availability stays quiet instead of announcing an unconfirmed status", async () => {
  const db = client({
    plan: {
      id: ids.plan,
      revision: 2,
      source_revision: 3,
      active_routine_version_id: ids.version,
      pending_routine_proposal_id: null,
    },
    version: { id: ids.version, payload: payload() },
    product: null,
  })
  const result = await createRoutineProductDetailService({ client: db }).load({
    userId: "owner-1",
    itemKey: "wash",
    enabled: true,
  })

  assert.equal(result.status, "found")
  if (result.status !== "found") return
  assert.equal(result.detail.commerce.availabilityLabel, null)
  assert.equal(result.detail.commerce.productUrl, null)
})
