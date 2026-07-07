import assert from "node:assert/strict"
import test from "node:test"

import {
  ROUTINE_PRODUCT_SUBMISSION_SELECT,
  ROUTINE_PRODUCT_USAGE_SELECT,
  loadRoutineArtifactData,
} from "../src/lib/routines/load-routine-artifact-data"
import type { HairProfile } from "../src/lib/types"

type QueryLog = Array<{
  table: string
  select?: string
  filters: Array<{ method: string; column: string; value: unknown }>
  order?: { column: string; options?: unknown }
}>

function createQueryClient(
  rowsByTable: Record<string, unknown>,
  log: QueryLog,
): { from(table: string): unknown; auth: { getUser(): Promise<unknown> } } {
  return {
    auth: {
      async getUser() {
        return { data: { user: { id: "user-1" } }, error: null }
      },
    },
    from(table: string) {
      const entry: QueryLog[number] = { table, filters: [] }
      log.push(entry)
      const builder = {
        select(columns: string) {
          entry.select = columns
          return builder
        },
        eq(column: string, value: unknown) {
          entry.filters.push({ method: "eq", column, value })
          return builder
        },
        gt(column: string, value: unknown) {
          entry.filters.push({ method: "gt", column, value })
          return Promise.resolve({ data: rowsByTable[table] ?? [], error: null })
        },
        in(column: string, value: unknown) {
          entry.filters.push({ method: "in", column, value })
          return Promise.resolve({ data: rowsByTable[table] ?? [], error: null })
        },
        order(column: string, options?: unknown) {
          entry.order = { column, options }
          return Promise.resolve({ data: rowsByTable[table] ?? [], error: null })
        },
        maybeSingle() {
          return Promise.resolve({ data: rowsByTable[table] ?? null, error: null })
        },
      }
      return builder
    },
  }
}

function minimalProfile(): HairProfile {
  return {
    id: "hair-profile-1",
    user_id: "user-1",
    hair_texture: "wavy",
    thickness: "fine",
    hair_length: "medium",
    density: "medium",
    concerns: ["dryness"],
    products_used: null,
    shampoo_frequency: "weekly_2x",
    heat_styling: "rarely",
    styling_tools: [],
    goals: ["moisture"],
    cuticle_condition: null,
    protein_moisture_balance: null,
    scalp_type: "balanced",
    scalp_condition: null,
    chemical_treatment: [],
    desired_volume: null,
    routine_preference: null,
    current_routine_products: null,
    towel_material: null,
    towel_technique: null,
    drying_method: null,
    brush_type: [],
    night_protection: [],
    uses_heat_protection: false,
    additional_notes: null,
    conversation_memory: null,
    created_at: "2026-07-06T10:00:00.000Z",
    updated_at: "2026-07-06T10:00:00.000Z",
  }
}

test("routine loader uses server client rows, admin-only pending submission enrichment, and runtime builder", async () => {
  assert.match(ROUTINE_PRODUCT_USAGE_SELECT, /product:products\(/)
  assert.match(ROUTINE_PRODUCT_USAGE_SELECT, /brand_identity:brands/)
  assert.match(ROUTINE_PRODUCT_USAGE_SELECT, /product_line:product_lines/)
  assert.match(ROUTINE_PRODUCT_USAGE_SELECT, /affiliate_link/)
  assert.match(ROUTINE_PRODUCT_USAGE_SELECT, /image_url/)
  assert.match(ROUTINE_PRODUCT_USAGE_SELECT, /price_eur/)
  assert.match(ROUTINE_PRODUCT_USAGE_SELECT, /lifecycle_status/)
  assert.match(ROUTINE_PRODUCT_USAGE_SELECT, /is_chaarlie_recommended/)
  assert.match(ROUTINE_PRODUCT_SUBMISSION_SELECT, /user_facing_resolution_reason/)
  assert.match(ROUTINE_PRODUCT_SUBMISSION_SELECT, /user_facing_next_step/)
  assert.match(ROUTINE_PRODUCT_SUBMISSION_SELECT, /user_facing_missing_fields/)
  assert.match(ROUTINE_PRODUCT_SUBMISSION_SELECT, /front_image_path/)
  assert.match(ROUTINE_PRODUCT_SUBMISSION_SELECT, /created_at/)

  const usageRows = [
    {
      id: "usage-1",
      user_id: "user-1",
      category: "mask",
      brand_text: "Mystery",
      product_name: "Mask",
      frequency_range: "weekly_1x",
      product_id: null,
      product_submission_id: "sub-1",
      match_status: "pending_review",
      intake_method: "photo",
      source: "onboarding",
      front_image_path: "tmp/front.jpg",
      created_at: "2026-07-06T10:00:00.000Z",
      updated_at: "2026-07-06T10:00:00.000Z",
      product: null,
    },
    {
      id: "usage-2",
      user_id: "user-1",
      category: "conditioner",
      brand_text: null,
      product_name: null,
      frequency_range: "weekly_2x",
      product_id: "prod-1",
      product_submission_id: null,
      match_status: "matched",
      intake_method: "manual",
      source: "profile",
      front_image_path: null,
      created_at: "2026-07-06T10:01:00.000Z",
      updated_at: "2026-07-06T10:01:00.000Z",
      product: {
        id: "prod-1",
        name: "Conditioner",
        brand: "Fallback Brand",
        brand_identity: { id: "brand-1", canonical_name: "Canonical Brand" },
        product_line: { id: "line-1", canonical_name: "Line Name" },
        product_line_id: "line-1",
        product_line_name: "Line Name",
        affiliate_link: "https://example.test",
        image_url: "https://example.test/image.jpg",
        price_eur: 8.99,
        currency: "EUR",
        is_active: true,
        lifecycle_status: "active",
        is_chaarlie_recommended: true,
      },
    },
  ]
  const pendingSubmissions = [
    {
      id: "sub-1",
      status: "pending_review",
      user_facing_resolution_reason: null,
      user_facing_next_step: "Wir prüfen dein Produkt.",
      user_facing_missing_fields: ["INCI"],
      front_image_path: "uploads/front.jpg",
      created_at: "2026-07-06T10:02:00.000Z",
    },
  ]
  const serverLog: QueryLog = []
  const adminLog: QueryLog = []
  const runtimeCalls: unknown[] = []

  const result = await loadRoutineArtifactData({
    deps: {
      createClient: async () =>
        createQueryClient(
          {
            hair_profiles: minimalProfile(),
            user_product_usage: usageRows,
            dismissed_suggestions: [{ category: "leave_in" }],
          },
          serverLog,
        ) as never,
      createAdminClient: () =>
        createQueryClient(
          {
            product_submissions: pendingSubmissions,
          },
          adminLog,
        ) as never,
      buildRuntime(profile, routineItems) {
        runtimeCalls.push({ profile, routineItems })
        return {
          careBalance: { rows: [] },
        } as never
      },
      now: () => new Date("2026-07-06T10:00:00.000Z"),
    },
  })

  assert.equal(result.userId, "user-1")
  assert.equal(result.hairProfile?.id, "hair-profile-1")
  assert.deepEqual(result.usageRows, usageRows)
  assert.deepEqual([...result.activeDismissedCategories], ["leave_in"])
  assert.equal(result.pendingSubmissionsById.get("sub-1")?.front_image_path, "uploads/front.jpg")
  assert.equal(runtimeCalls.length, 1)
  assert.deepEqual(runtimeCalls[0], {
    profile: minimalProfile(),
    routineItems: usageRows.map((row) => ({
      category: row.category,
      product_name: row.product_name,
      frequency_range: row.frequency_range,
      product_id: row.product_id,
      product_submission_id: row.product_submission_id,
      match_status: row.match_status,
    })),
  })

  assert.deepEqual(
    serverLog.map((entry) => ({ table: entry.table, select: entry.select })),
    [
      { table: "hair_profiles", select: "*" },
      { table: "user_product_usage", select: ROUTINE_PRODUCT_USAGE_SELECT },
      { table: "dismissed_suggestions", select: "category" },
    ],
  )
  assert.deepEqual(serverLog[2]?.filters, [
    { method: "eq", column: "user_id", value: "user-1" },
    { method: "gt", column: "reappear_at", value: "2026-07-06T10:00:00.000Z" },
  ])
  assert.deepEqual(
    adminLog.map((entry) => ({ table: entry.table, select: entry.select })),
    [{ table: "product_submissions", select: ROUTINE_PRODUCT_SUBMISSION_SELECT }],
  )
  assert.deepEqual(adminLog[0]?.filters, [{ method: "in", column: "id", value: ["sub-1"] }])
})
