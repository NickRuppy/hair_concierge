import assert from "node:assert/strict"
import test from "node:test"

import type { ProductFrequency } from "../src/lib/vocabulary/frequencies"
import {
  createRoutineApiHandlers,
  type RoutineApiShapeFunction,
} from "../src/lib/routines/api-handlers"

type QueryLogEntry = {
  table: string
  action?: "select" | "update" | "delete" | "insert"
  columns?: string
  payload?: unknown
  filters: Array<{ method: string; column: string; value: unknown }>
  order?: { column: string; options?: unknown }
}

type FakeDbState = {
  user: { id: string } | null
  tables: Record<string, unknown[]>
  log: QueryLogEntry[]
}

function createFakeClient(state: FakeDbState) {
  return {
    auth: {
      async getUser() {
        return { data: { user: state.user }, error: null }
      },
    },
    from(table: string) {
      const entry: QueryLogEntry = { table, filters: [] }
      state.log.push(entry)
      const query = {
        select(columns: string) {
          entry.action ??= "select"
          entry.columns = columns
          return query
        },
        update(payload: unknown) {
          entry.action = "update"
          entry.payload = payload
          return query
        },
        delete() {
          entry.action = "delete"
          return query
        },
        insert(payload: unknown) {
          entry.action = "insert"
          entry.payload = payload
          return query
        },
        eq(column: string, value: unknown) {
          entry.filters.push({ method: "eq", column, value })
          return query
        },
        in(column: string, value: unknown) {
          entry.filters.push({ method: "in", column, value })
          return Promise.resolve({
            data: filterRows(state.tables[table] ?? [], entry),
            error: null,
          })
        },
        order(column: string, options?: unknown) {
          entry.order = { column, options }
          return Promise.resolve({
            data: filterRows(state.tables[table] ?? [], entry),
            error: null,
          })
        },
        maybeSingle() {
          const rows = filterRows(state.tables[table] ?? [], entry)
          if (entry.action === "update") {
            const row = rows[0] as Record<string, unknown> | undefined
            if (row) Object.assign(row, entry.payload)
          }
          if (entry.action === "delete") {
            state.tables[table] = (state.tables[table] ?? []).filter((row) => !rows.includes(row))
          }
          return Promise.resolve({
            data: rows[0] ?? null,
            error: null,
          })
        },
        single() {
          const rows = filterRows(state.tables[table] ?? [], entry)
          if (entry.action === "update") {
            const row = rows[0] as Record<string, unknown> | undefined
            if (row) Object.assign(row, entry.payload)
          }
          if (entry.action === "delete") {
            state.tables[table] = (state.tables[table] ?? []).filter((row) => !rows.includes(row))
          }
          if (entry.action === "insert") {
            const row = { id: "usage-new", ...(entry.payload as Record<string, unknown>) }
            state.tables[table] = [...(state.tables[table] ?? []), row]
            return Promise.resolve({ data: row, error: null })
          }
          return Promise.resolve({
            data: rows[0] ?? null,
            error: null,
          })
        },
      }
      return query
    },
  }
}

function filterRows(rows: unknown[], entry: QueryLogEntry): unknown[] {
  return rows.filter((row) => {
    if (!row || typeof row !== "object") return false
    const record = row as Record<string, unknown>
    return entry.filters.every((filter) => {
      if (filter.method === "eq") return record[filter.column] === filter.value
      if (filter.method === "in") {
        return Array.isArray(filter.value) && filter.value.includes(record[filter.column])
      }
      return true
    })
  })
}

function createHandlers({
  state,
  loadResult = routineData(),
  shape = ((input) => ({ cards: input.usageRows })) as RoutineApiShapeFunction,
}: {
  state?: Partial<FakeDbState>
  loadResult?: ReturnType<typeof routineData>
  shape?: RoutineApiShapeFunction
} = {}) {
  const fakeState: FakeDbState = {
    user: { id: "user-1" },
    tables: {},
    log: [],
    ...state,
  }
  const calls: Record<string, unknown[]> = {
    load: [],
    shape: [],
    dismiss: [],
  }
  const client = createFakeClient(fakeState)
  const handlers = createRoutineApiHandlers({
    createClient: async () => client as never,
    // Same fake DB for the service-role path used by review-managed writes.
    createAdminClient: () => client as never,
    loadRoutineArtifactData: async (params) => {
      calls.load.push(params)
      return loadResult as never
    },
    shapeRoutineForUi: (input) => {
      calls.shape.push(input)
      return shape(input)
    },
    createDismissal: async (params) => {
      calls.dismiss.push(params)
      return {
        id: "dismissal-1",
        user_id: params.userId,
        category: params.category,
        dismissed_at: "2026-07-06T10:00:00.000Z",
        reappear_at: "2026-07-20T10:00:00.000Z",
      }
    },
  })

  return { handlers, state: fakeState, calls }
}

function routineData({
  usageRows = [],
  category = "conditioner",
  preferredFrequency = "weekly_2x",
}: {
  usageRows?: Array<Record<string, unknown>>
  category?: string
  preferredFrequency?: ProductFrequency | null
} = {}) {
  return {
    userId: "user-1",
    hairProfile: null,
    usageRows,
    pendingSubmissionsById: new Map(),
    activeDismissedCategories: new Set(["leave_in"]),
    runtime: {
      careBalance: {
        rows: [
          {
            category,
            present: usageRows.some((row) => row.category === category),
            primaryStatus: "missing_needed",
            recommendation: "add",
            currentFrequency: null,
            frequencyTarget: preferredFrequency
              ? {
                  minFrequency: "weekly_1x",
                  maxFrequency: "weekly_3_4x",
                  preferredFrequency,
                  delta: "missing",
                }
              : null,
          },
        ],
      },
    },
  }
}

test("GET /api/routine uses the routine loader and shaper for the authenticated user", async () => {
  const { handlers, calls } = createHandlers({
    loadResult: routineData({
      usageRows: [{ id: "usage-1", user_id: "user-1", category: "conditioner" }],
    }),
  })

  const response = await handlers.getRoutine()

  assert.equal(response.status, 200)
  assert.deepEqual(response.body, {
    routine: { cards: [{ id: "usage-1", user_id: "user-1", category: "conditioner" }] },
  })
  assert.deepEqual(calls.load, [{ userId: "user-1" }])
  assert.equal(calls.shape.length, 1)
  assert.deepEqual(
    [...(calls.shape[0] as { activeDismissedCategories: Set<string> }).activeDismissedCategories],
    ["leave_in"],
  )
  assert.deepEqual((calls.shape[0] as Record<string, unknown>).careBalanceRows, [
    {
      category: "conditioner",
      present: true,
      primaryStatus: "missing_needed",
      recommendation: "add",
      currentFrequency: null,
      frequencyTarget: {
        minFrequency: "weekly_1x",
        maxFrequency: "weekly_3_4x",
        preferredFrequency: "weekly_2x",
        delta: "missing",
      },
    },
  ])
})

test("PATCH /api/routine/products/[id] rejects unknown frequency values", async () => {
  const { handlers, state } = createHandlers()

  const response = await handlers.patchProduct("usage-1", { frequency_range: "sometimes" })

  assert.equal(response.status, 400)
  assert.deepEqual(response.body, { error: "Ungültige Nutzungsfrequenz." })
  assert.equal(
    state.log.some((entry) => entry.action === "update"),
    false,
  )
})

test("PATCH /api/routine/products/[id] updates only the authenticated user's usage row", async () => {
  const { handlers, state } = createHandlers({
    state: {
      tables: {
        user_product_usage: [
          {
            id: "usage-1",
            user_id: "user-1",
            category: "conditioner",
            frequency_range: "weekly_1x",
          },
          {
            id: "usage-1",
            user_id: "user-2",
            category: "conditioner",
            frequency_range: "daily_1x",
          },
        ],
      },
    },
  })

  const response = await handlers.patchProduct("usage-1", { frequency_range: "weekly_2x" })

  assert.equal(response.status, 200)
  assert.deepEqual(response.body, {
    usage: {
      id: "usage-1",
      user_id: "user-1",
      category: "conditioner",
      frequency_range: "weekly_2x",
    },
  })
  const update = state.log.find((entry) => entry.action === "update")
  assert.deepEqual(update?.payload, { frequency_range: "weekly_2x" })
  assert.deepEqual(update?.filters, [
    { method: "eq", column: "id", value: "usage-1" },
    { method: "eq", column: "user_id", value: "user-1" },
  ])
})

test("DELETE /api/routine/products/[id] deletes only the authenticated user's usage row", async () => {
  const { handlers, state } = createHandlers({
    state: {
      tables: {
        user_product_usage: [
          { id: "usage-1", user_id: "user-1" },
          { id: "usage-1", user_id: "user-2" },
        ],
      },
    },
  })

  const response = await handlers.deleteProduct("usage-1")

  assert.equal(response.status, 200)
  assert.deepEqual(response.body, { success: true })
  const deletion = state.log.find((entry) => entry.action === "delete")
  assert.deepEqual(deletion?.filters, [
    { method: "eq", column: "id", value: "usage-1" },
    { method: "eq", column: "user_id", value: "user-1" },
  ])
  assert.deepEqual(state.tables.user_product_usage, [{ id: "usage-1", user_id: "user-2" }])
})

test("POST /api/routine/suggestions/[category]/dismiss calls the dismissal helper", async () => {
  const { handlers, calls } = createHandlers()

  const response = await handlers.dismissSuggestion("conditioner")

  assert.equal(response.status, 200)
  assert.deepEqual(response.body, {
    dismissal: {
      id: "dismissal-1",
      user_id: "user-1",
      category: "conditioner",
      dismissed_at: "2026-07-06T10:00:00.000Z",
      reappear_at: "2026-07-20T10:00:00.000Z",
    },
  })
  assert.equal(calls.dismiss.length, 1)
  assert.equal((calls.dismiss[0] as Record<string, unknown>).userId, "user-1")
  assert.equal((calls.dismiss[0] as Record<string, unknown>).category, "conditioner")
})

test("POST /api/routine/products adds a product with the category preferred frequency", async () => {
  const { handlers, state } = createHandlers({
    loadResult: routineData({ category: "conditioner", preferredFrequency: "weekly_2x" }),
    state: {
      tables: {
        products: [
          {
            id: "product-1",
            category: "conditioner",
            name: "Conditioner",
            brand: "Brand",
            is_active: true,
            lifecycle_status: "active",
            is_chaarlie_recommended: true,
          },
        ],
        user_product_usage: [],
      },
    },
  })

  const response = await handlers.addProduct({
    category: "conditioner",
    productId: "product-1",
  })

  assert.equal(response.status, 201)
  assert.deepEqual(response.body, {
    usage: {
      id: "usage-new",
      user_id: "user-1",
      category: "conditioner",
      product_id: "product-1",
      product_name: "Conditioner",
      brand_text: "Brand",
      frequency_range: "weekly_2x",
      match_status: "matched",
      intake_method: "manual",
      source: "profile",
      product_submission_id: null,
      front_image_path: null,
    },
  })
})

test("POST /api/routine/products replaces a usage row and preserves its frequency", async () => {
  const { handlers, state } = createHandlers({
    state: {
      tables: {
        products: [
          {
            id: "product-2",
            category: "conditioner",
            name: "New Conditioner",
            brand: "New Brand",
            is_active: true,
            lifecycle_status: "active",
            is_chaarlie_recommended: true,
          },
        ],
        user_product_usage: [
          {
            id: "usage-1",
            user_id: "user-1",
            category: "conditioner",
            frequency_range: "weekly_1x",
            product_name: "Old",
            product_id: "product-1",
            match_status: "matched",
          },
        ],
      },
    },
  })

  const response = await handlers.addProduct({
    category: "conditioner",
    productId: "product-2",
    replaceUsageId: "usage-1",
    confirmReplace: true,
  })

  assert.equal(response.status, 200)
  assert.deepEqual(response.body, {
    usage: {
      id: "usage-1",
      user_id: "user-1",
      category: "conditioner",
      frequency_range: "weekly_1x",
      product_name: "New Conditioner",
      product_id: "product-2",
      match_status: "matched",
      brand_text: "New Brand",
      product_submission_id: null,
      front_image_path: null,
      intake_method: "manual",
      source: "profile",
    },
  })
  const update = state.log.find((entry) => entry.action === "update")
  assert.deepEqual(update?.payload, {
    product_id: "product-2",
    product_name: "New Conditioner",
    brand_text: "New Brand",
    product_submission_id: null,
    front_image_path: null,
    match_status: "matched",
    intake_method: "manual",
    source: "profile",
  })
})

test("POST /api/routine/products returns 409 when the category is already occupied", async () => {
  const { handlers } = createHandlers({
    state: {
      tables: {
        products: [
          {
            id: "product-2",
            category: "conditioner",
            is_active: true,
            lifecycle_status: "active",
            is_chaarlie_recommended: true,
          },
        ],
        user_product_usage: [
          {
            id: "usage-1",
            user_id: "user-1",
            category: "conditioner",
            frequency_range: "weekly_1x",
            product_name: "Old",
            match_status: "matched",
          },
        ],
      },
    },
  })

  const response = await handlers.addProduct({
    category: "conditioner",
    productId: "product-2",
  })

  assert.equal(response.status, 409)
  assert.deepEqual(response.body, {
    error: "Diese Kategorie ist bereits belegt.",
    existingUsageId: "usage-1",
  })
})

test("POST /api/routine/products rejects replace confirmation without a usage id", async () => {
  const { handlers, state } = createHandlers({
    state: {
      tables: {
        products: [
          {
            id: "product-2",
            category: "conditioner",
            is_active: true,
            lifecycle_status: "active",
            is_chaarlie_recommended: true,
          },
        ],
        user_product_usage: [
          {
            id: "usage-1",
            user_id: "user-1",
            category: "conditioner",
            frequency_range: "weekly_1x",
            product_name: "Old",
            match_status: "matched",
          },
        ],
      },
    },
  })

  const response = await handlers.addProduct({
    category: "conditioner",
    productId: "product-2",
    confirmReplace: true,
  })

  assert.equal(response.status, 400)
  assert.deepEqual(response.body, { error: "Zu ersetzendes Produkt fehlt." })
  assert.equal(
    state.log.some((entry) => entry.action === "insert" || entry.action === "update"),
    false,
  )
})

test("POST /api/routine/products rejects replace confirmation without a usage id even when category is empty", async () => {
  const { handlers, state } = createHandlers({
    state: {
      tables: {
        products: [
          {
            id: "product-2",
            category: "conditioner",
            is_active: true,
            lifecycle_status: "active",
            is_chaarlie_recommended: true,
          },
        ],
        user_product_usage: [],
      },
    },
  })

  const response = await handlers.addProduct({
    category: "conditioner",
    productId: "product-2",
    confirmReplace: true,
  })

  assert.equal(response.status, 400)
  assert.deepEqual(response.body, { error: "Zu ersetzendes Produkt fehlt." })
  assert.equal(
    state.log.some((entry) => entry.action === "insert" || entry.action === "update"),
    false,
  )
})

test("POST /api/routine/products rejects a replacement id without explicit confirmation", async () => {
  const { handlers, state } = createHandlers({
    state: {
      tables: {
        products: [
          {
            id: "product-2",
            category: "conditioner",
            is_active: true,
            lifecycle_status: "active",
            is_chaarlie_recommended: true,
          },
        ],
        user_product_usage: [
          {
            id: "usage-1",
            user_id: "user-1",
            category: "conditioner",
            frequency_range: "weekly_1x",
            product_name: "Old",
            match_status: "matched",
          },
        ],
      },
    },
  })

  const response = await handlers.addProduct({
    category: "conditioner",
    productId: "product-2",
    replaceUsageId: "usage-1",
  })

  assert.equal(response.status, 400)
  assert.deepEqual(response.body, { error: "Ersetzen muss bestätigt werden." })
  assert.equal(
    state.log.some((entry) => entry.action === "insert" || entry.action === "update"),
    false,
  )
})

test("POST /api/routine/products returns 422 when the empty category has no frequency target", async () => {
  const { handlers } = createHandlers({
    loadResult: routineData({ category: "conditioner", preferredFrequency: null }),
    state: {
      tables: {
        products: [
          {
            id: "product-1",
            category: "conditioner",
            is_active: true,
            lifecycle_status: "active",
            is_chaarlie_recommended: true,
          },
        ],
        user_product_usage: [],
      },
    },
  })

  const response = await handlers.addProduct({
    category: "conditioner",
    productId: "product-1",
  })

  assert.equal(response.status, 422)
  assert.deepEqual(response.body, {
    error: "Für diese Kategorie fehlt ein Frequenzziel.",
  })
})
