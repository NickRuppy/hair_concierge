import assert from "node:assert/strict"
import test from "node:test"

import {
  adaptAcceptedActiveRoutineForApplication,
  loadImmutableRoutineProfile,
  type ApplicationRoutineReadClient,
} from "../src/lib/personal-plan/routine/application-adapter"
import type { RoutinePayloadV1 } from "../src/lib/personal-plan/routine/contracts"
import { CatalogDatabaseReadError } from "../src/lib/catalog-authority/product-spec-relationships"

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
  } as unknown as RoutinePayloadV1
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
        cadence: {
          recommended: null,
          userOverride: null,
          displayKey: "personal_plan.cadence.product_protocol_course",
          resolved: { copyDe: "Alle drei Haarwäschen", source: "exact_product_protocol" },
        },
        product: {
          kind: "planned",
          plannedPurchaseId: "purchase:conditioner",
          productId,
          displayName: "Vorgemerkter Conditioner",
        },
      },
    ],
  } as unknown as RoutinePayloadV1
}

function productClient(
  rows: unknown[] | null,
  error: unknown = null,
  protocolRows: unknown[] | null = rows,
) {
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
          return Promise.resolve({
            data: table === "product_application_protocols" ? protocolRows : rows,
            error,
          })
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

test("Stage 5 adapter bulk-reads products and exact protocols while preserving accepted identities", async () => {
  const { client, calls } = productClient([
    {
      id: productId,
      category: "shampoo",
      category_key: "shampoo",
      is_active: true,
      lifecycle_status: "active",
      image_url:
        "https://pqdkhefxsxkyeqelqegq.supabase.co/storage/v1/object/public/product-images/shampoo.webp",
    },
  ])
  const result = await adaptAcceptedActiveRoutineForApplication({
    client,
    activeVersion: { id: "routine-v1", payload: activePayload() },
  })

  assert.equal(calls.length, 2)
  assert.equal(calls[0]!.table, "products")
  assert.deepEqual(calls[0]!.ids, [productId])
  assert.equal(calls[1]!.table, "product_application_protocols")
  assert.deepEqual(calls[1]!.ids, [productId])
  assert.deepEqual(
    result.routineItems.map((item) => item.productId),
    [productId],
  )
  assert.equal(
    result.routineItems[0]?.imageUrl,
    "https://pqdkhefxsxkyeqelqegq.supabase.co/storage/v1/object/public/product-images/shampoo.webp",
  )
  assert.match(calls[0]!.select ?? "", /image_url/)
  for (const table of [
    "product_leave_in_specs",
    "product_bondbuilder_specs",
    "product_mask_specs",
    "product_oil_specs",
    "product_heat_protectant_specs",
    "product_scalp_care_specs",
    "product_dry_shampoo_specs",
  ]) {
    assert.match(calls[0]!.select ?? "", new RegExp(`${table}!${table}_product_category_fkey\\(`))
  }
})

test("Stage 5 adapter normalizes catalog read failures without retaining database details", async () => {
  const { client } = productClient(null, {
    code: "PGRST201",
    message: "sensitive relationship and query details",
  })

  await assert.rejects(
    adaptAcceptedActiveRoutineForApplication({
      client,
      activeVersion: { id: "routine-v1", payload: activePayload() },
    }),
    (error: unknown) => {
      assert.ok(error instanceof CatalogDatabaseReadError)
      assert.equal(error.message, "catalog_database_read_failed")
      assert.doesNotMatch(error.message, /PGRST201|sensitive|relationship|query/)
      assert.equal("cause" in error, false)
      return true
    },
  )
})

function inputWithProductImage(imageUrl: string) {
  const { client } = productClient([
    {
      id: productId,
      category: "shampoo",
      category_key: "shampoo",
      is_active: true,
      lifecycle_status: "active",
      image_url: imageUrl,
    },
  ])
  return { client, activeVersion: { id: "routine-v1", payload: activePayload() } }
}

test("relative image_url is sanitized to null instead of failing", async () => {
  const result = await adaptAcceptedActiveRoutineForApplication(
    inputWithProductImage("/images/foo.png"),
  )
  assert.equal(result.routineItems[0]?.imageUrl, null)
})

test("empty image_url is sanitized to null", async () => {
  const result = await adaptAcceptedActiveRoutineForApplication(inputWithProductImage(""))
  assert.equal(result.routineItems[0]?.imageUrl, null)
})

test("absolute image_url passes through", async () => {
  const result = await adaptAcceptedActiveRoutineForApplication(
    inputWithProductImage("https://cdn.example/x.png"),
  )
  assert.equal(result.routineItems[0]?.imageUrl, "https://cdn.example/x.png")
})

test("Stage 5 V2 adapter selects only typed pointer storage and ignores V1 manufacturer prose", async () => {
  const pointer = {
    schemaVersion: 2,
    contractKind: "product_pointer",
    scope: { kind: "product", category: "shampoo", productId },
    sourceRole: "shampoo_everyday",
    role: "cleanse",
    applicationFamily: "standard_rinse_out_cleanse",
    facts: {
      applicationState: "wet_hair",
      applicationArea: "scalp_roots",
      rinse: "rinse_out",
      contactTime: null,
      amount: null,
      heat: null,
      conditionerPolicy: "not_applicable",
    },
    workflowId: null,
    requiredCompanionProductId: null,
    runtimeBlockerCode: null,
    exactSteps: [],
    cautionCodes: [],
    evidence: [
      {
        sourceUrl: "https://example.com/shampoo",
        sourceType: "manufacturer",
        checkedAt: "2026-08-12",
      },
    ],
  }
  const { client, calls } = productClient(
    [
      {
        id: productId,
        category: "shampoo",
        category_key: "shampoo",
        is_active: true,
        lifecycle_status: "active",
      },
    ],
    null,
    [
      {
        product_id: productId,
        category: "shampoo",
        role: "shampoo_everyday",
        guidance_payload_v2: pointer,
        source_text: "Bespoke manufacturer wording must not render.",
        updated_at: "2026-08-12T00:00:00.000Z",
      },
    ],
  )

  const result = await adaptAcceptedActiveRoutineForApplication({
    client,
    activeVersion: { id: "routine-v1", payload: activePayload() },
    contractVersion: 2,
  })

  assert.match(calls[1]!.select!, /guidance_payload_v2/)
  assert.doesNotMatch(calls[1]!.select!, /(^|,)guidance_payload(,|$)/)
  assert.deepEqual(result.applicationPointersV2, [pointer])
  assert.deepEqual(result.exactGuidanceProtocols, [])
})

test("Stage 5 adapter carries reviewed Oil weight into application dosage facts", async () => {
  const oilPayload = activePayload()
  oilPayload.items[0] = {
    ...oilPayload.items[0]!,
    category: "oil",
    role: "dry_finish",
  } as never
  const { client, calls } = productClient([
    {
      id: productId,
      category: "oil",
      category_key: "oil",
      is_active: true,
      lifecycle_status: "active",
      product_oil_specs: { weight: "rich", role_support: ["dry_finish"] },
    },
  ])

  const result = await adaptAcceptedActiveRoutineForApplication({
    client,
    activeVersion: { id: "routine-v1", payload: oilPayload },
  })

  assert.match(
    calls[0]!.select!,
    /product_oil_specs!product_oil_specs_product_category_fkey\(weight,role_support,provides_heat_protection\)/,
  )
  assert.equal(result.routineItems[0]?.catalogFacts.weight, "rich")
  assert.equal(result.routineItems[0]?.catalogFactProvenance?.weight, "catalog_spec")
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
    result.routineItems.map(
      ({ productName, availability, executable, routineOrder, effectiveCadenceDe }) => ({
        productName,
        availability,
        executable,
        routineOrder,
        effectiveCadenceDe,
      }),
    ),
    [
      {
        productName: "Vorgemerkter Conditioner",
        availability: "planned",
        executable: false,
        routineOrder: 0,
        effectiveCadenceDe: "Alle drei Haarwäschen",
      },
    ],
  )
})

test("Stage 5 adapter carries only the frozen effective cadence for resolved, override, and legacy accepted Routine items", async () => {
  const payload = activePayload()
  payload.items = [
    {
      ...payload.items[0]!,
      itemKey: "item:resolved",
      cadence: {
        recommended: null,
        userOverride: null,
        displayKey: "personal_plan.cadence.product_protocol_course",
        resolved: { copyDe: "Alle drei Haarwäschen", source: "exact_product_protocol" },
      },
    },
    {
      ...payload.items[0]!,
      itemKey: "item:override",
      cadence: {
        recommended: null,
        userOverride: "weekly_2x",
        displayKey: "weekly_2x",
        resolved: { copyDe: "Nicht anzeigen", source: "category" },
      },
    },
    {
      ...payload.items[0]!,
      itemKey: "item:legacy",
      cadence: {
        recommended: { kind: "wet_wash_total", target: "weekly_2x" },
        userOverride: null,
        displayKey: "weekly_2x",
      },
    },
  ] as never
  const { client } = productClient([
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
    activeVersion: { id: "routine-v1", payload },
  })

  assert.deepEqual(
    result.routineItems.map(({ itemId, effectiveCadenceDe }) => ({ itemId, effectiveCadenceDe })),
    [
      { itemId: "item:resolved", effectiveCadenceDe: "Alle drei Haarwäschen" },
      { itemId: "item:override", effectiveCadenceDe: "2× pro Woche" },
      { itemId: "item:legacy", effectiveCadenceDe: "2× pro Woche" },
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
                application_state: "damp",
                reapplication: "not_stated",
                source_url: "https://example.com/heat",
                source_text: "Vor dem bestätigten Wärmeschritt gleichmäßig auftragen.",
                updated_at: "2026-08-10T09:00:00.000Z",
              },
              {
                product_id: productId,
                category: "heat_protectant",
                role: "pre_heat_protection",
                application_state: "dry",
                reapplication: "required",
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
  assert.equal(result.routineItems[0]?.catalogFacts.reapplication, "required")
})

test("Stage 5 adapter accepts a canonical exact Mask guidance payload", async () => {
  const payload = plannedPayload()
  payload.items[0] = {
    ...payload.items[0]!,
    category: "mask",
    role: "intensive_conditioning_mask",
  }
  const guidancePayload = {
    schemaVersion: 1,
    guidanceKey: `product-mask-${productId}`,
    protocolVersion: 1,
    locale: "de",
    scope: { kind: "product", category: "mask", productId },
    role: "intensive_care",
    applicationFamily: "post_shampoo_rinse_out_mask",
    compatibleDayTypes: ["intensive_care_day"],
    exactGuidanceRequired: true,
    sequence: {
      anchor: "post_cleanse_rinse_off",
      before: [],
      after: ["wet_cleanse"],
      conflictsWith: [],
    },
    requirements: {
      requiredCatalogFacts: [],
      requiredProtocolFacts: [],
      requiredProfileFacts: [],
    },
    protocolFacts: {
      applicationArea: "lengths_ends",
      rinse: "rinse_out",
      contactTimeSeconds: 180,
      conditionerRelationship: "replaces_conditioner",
      reapplication: "none",
      amount: null,
      cautions: [],
    },
    steps: [
      {
        stepKey: "apply-mask",
        action: "apply_product",
        copyTemplateDe: "Nach dem Shampoo in Längen und Spitzen verteilen.",
      },
      { stepKey: "wait-mask", action: "wait", copyTemplateDe: "3 Minuten einwirken lassen." },
      { stepKey: "rinse-mask", action: "rinse", copyTemplateDe: "Gründlich ausspülen." },
    ],
    evidence: [
      {
        sourceUrl: "https://example.com/mask",
        sourceType: "manufacturer",
        checkedAt: "2026-08-10",
      },
    ],
  }
  const client = {
    from(table: string) {
      const query = {
        select() {
          return query
        },
        eq() {
          return query
        },
        in() {
          return Promise.resolve(
            table === "products"
              ? {
                  data: [
                    {
                      id: productId,
                      category: "mask",
                      category_key: "mask",
                      is_active: true,
                      lifecycle_status: "active",
                      product_mask_specs: [{ weight: "medium" }],
                    },
                  ],
                  error: null,
                }
              : {
                  data: [
                    {
                      product_id: productId,
                      category: "mask",
                      role: "intensive_conditioning_mask",
                      guidance_payload: guidancePayload,
                      application_state: null,
                      reapplication: null,
                      source_url: "https://example.com/mask",
                      source_text: "Maske drei Minuten einwirken lassen.",
                      updated_at: "2026-08-10T09:00:00.000Z",
                    },
                  ],
                  error: null,
                },
          )
        },
        maybeSingle() {
          return Promise.resolve({ data: null, error: null })
        },
      }
      return query
    },
  } as unknown as ApplicationRoutineReadClient

  const result = await adaptAcceptedActiveRoutineForApplication({
    client,
    activeVersion: { id: "routine-v1", payload },
  })

  assert.deepEqual(result.exactGuidanceProtocols, [guidancePayload])
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

const productBId = "30000000-0000-4000-8000-000000000002"

function twoItemPayload(): RoutinePayloadV1 {
  return {
    planId,
    items: [
      activePayload().items[0]!,
      {
        itemKey: "item:conditioner",
        assignmentKey: "assignment:conditioner",
        category: "conditioner",
        role: "conditioner_rinse_out",
        state: { inclusion: "included", availability: "owned" },
        executable: true,
        product: { kind: "owned", productId: productBId, displayName: "Zweites Produkt" },
      },
    ],
  } as unknown as RoutinePayloadV1
}

const activeProductB = {
  id: productBId,
  category: "conditioner",
  category_key: "conditioner",
  is_active: true,
  lifecycle_status: "active",
}

function inputWithInactiveProductA() {
  const { client } = productClient([
    {
      id: productId,
      category: "shampoo",
      category_key: "shampoo",
      is_active: true,
      lifecycle_status: "discontinued",
    },
    activeProductB,
  ])
  return { client, activeVersion: { id: "routine-v1", payload: twoItemPayload() } }
}

function inputWithMiscategorizedProductA() {
  const { client } = productClient([
    {
      id: productId,
      category: "mask",
      category_key: "mask",
      is_active: true,
      lifecycle_status: "active",
    },
    activeProductB,
  ])
  return { client, activeVersion: { id: "routine-v1", payload: twoItemPayload() } }
}

function inputWhereAllProductsInactive() {
  const { client } = productClient([
    {
      id: productId,
      category: "shampoo",
      category_key: "shampoo",
      is_active: true,
      lifecycle_status: "discontinued",
    },
    { ...activeProductB, is_active: false },
  ])
  return { client, activeVersion: { id: "routine-v1", payload: twoItemPayload() } }
}

test("inactive product demotes its item instead of failing the page", async () => {
  const result = await adaptAcceptedActiveRoutineForApplication(inputWithInactiveProductA())

  assert.equal(result.routineItems.length, 1)
  assert.equal(result.routineItems[0]?.productId, productBId)
  assert.equal(result.unresolvedRoutineItems.length, 1)
  assert.deepEqual(result.degradedItems, [
    { productId, category: "shampoo", issue: "catalog_identity_mismatch" },
  ])
})

test("category_key mismatch demotes instead of failing", async () => {
  const result = await adaptAcceptedActiveRoutineForApplication(inputWithMiscategorizedProductA())

  assert.equal(result.routineItems.length, 1)
  assert.deepEqual(result.degradedItems, [
    { productId, category: "shampoo", issue: "catalog_identity_mismatch" },
  ])
  assert.deepEqual(result.unresolvedRoutineItems, [
    {
      itemId: "item:shampoo",
      category: "shampoo",
      role: "cleanse",
      routineOrder: 0,
      applicationInstanceKey: "assignment:shampoo",
      reason: "catalog_unavailable",
    },
  ])
})

test("all items demoted fails closed", async () => {
  await assert.rejects(
    () => adaptAcceptedActiveRoutineForApplication(inputWhereAllProductsInactive()),
    /accepted_routine_product_unavailable/,
  )
})

test("demoted item carries reason catalog_unavailable", async () => {
  const result = await adaptAcceptedActiveRoutineForApplication(inputWithInactiveProductA())
  assert.equal(result.unresolvedRoutineItems[0]?.reason, "catalog_unavailable")
})

test("a demoted item never leaks the accepted product display name", async () => {
  const result = await adaptAcceptedActiveRoutineForApplication(inputWithInactiveProductA())
  assert.doesNotMatch(JSON.stringify(result.unresolvedRoutineItems), /Never sent to observability/)
})

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
    (error: unknown) =>
      error instanceof CatalogDatabaseReadError && error.message === "catalog_database_read_failed",
  )
})
