import assert from "node:assert/strict"
import test from "node:test"

import {
  loadScanSavedState,
  removeScanRoutineProduct,
  removeScanWishlistProduct,
  saveScanRoutineProduct,
  saveScanWishlistProduct,
} from "../src/lib/scan/saved-state"

type TableHandlers = Record<
  string,
  {
    select?: (calls: { filters: Map<string, unknown> }) => { data: unknown; error: unknown }
    /** For a `.select().eq()...` chain awaited directly (list read, no `maybeSingle`). */
    selectList?: (calls: { filters: Map<string, unknown> }) => { data: unknown; error: unknown }
    insert?: (payload: unknown) => { error: unknown }
    delete?: (calls: { filters: Map<string, unknown> }) => { error: unknown }
  }
>

function stubClient(handlers: TableHandlers) {
  const inserts: Array<{ table: string; payload: unknown }> = []
  const deletes: Array<{ table: string; filters: Map<string, unknown> }> = []

  const client = {
    from(table: string) {
      const handler = handlers[table]
      if (!handler) throw new Error(`unexpected table ${table}`)
      const filters = new Map<string, unknown>()
      const selectChain = {
        select: () => selectChain,
        eq: (column: string, value: unknown) => {
          filters.set(column, value)
          return selectChain
        },
        maybeSingle: async () => {
          if (!handler.select) throw new Error(`no select handler for ${table}`)
          return handler.select({ filters })
        },
        then: (resolve: (value: unknown) => unknown) => {
          if (!handler.selectList) throw new Error(`no selectList handler for ${table}`)
          return resolve(handler.selectList({ filters }))
        },
      }
      const deleteChain = {
        eq: (column: string, value: unknown) => {
          filters.set(column, value)
          return deleteChain
        },
        then: (resolve: (value: unknown) => unknown) => {
          deletes.push({ table, filters })
          if (!handler.delete) throw new Error(`no delete handler for ${table}`)
          return resolve(handler.delete({ filters }))
        },
      }
      return {
        select: selectChain.select,
        insert: (payload: unknown) => {
          inserts.push({ table, payload })
          if (!handler.insert) throw new Error(`no insert handler for ${table}`)
          return handler.insert(payload)
        },
        delete: () => deleteChain,
      }
    },
  }
  return { client, inserts, deletes }
}

test("loadScanSavedState: wishlist row present returns merkliste before checking user_products", async () => {
  const { client } = stubClient({
    scan_wishlist: { select: () => ({ data: { id: "wish-1" }, error: null }) },
    // user_products deliberately has no select handler: must not be reached.
  })
  const result = await loadScanSavedState(client as never, "user-1", "prod-1")
  // A scan_wishlist row can only have come from this surface, so it is always removable.
  assert.deepEqual(result, { state: "merkliste", managedByScan: true })
})

test("loadScanSavedState: a scan-created owned row is routine and removable from here", async () => {
  const seen: Array<Map<string, unknown>> = []
  const { client } = stubClient({
    scan_wishlist: { select: () => ({ data: null, error: null }) },
    user_products: {
      selectList: ({ filters }) => {
        seen.push(filters)
        return { data: [{ id: "up-1", intake_source: "scan" }], error: null }
      },
    },
  })
  const result = await loadScanSavedState(client as never, "user-1", "prod-1")
  assert.deepEqual(result, { state: "routine", managedByScan: true })
  // Deliberately NOT filtered by intake_source: the query asks "does the user own this
  // product at all", and `managedByScan` answers the separate "may scan remove it" question.
  assert.equal(seen[0].has("intake_source"), false)
  assert.equal(seen[0].get("identity_status"), "matched")
  assert.equal(seen[0].get("ownership_status"), "owned")
  assert.equal(seen[0].get("user_id"), "user-1")
  assert.equal(seen[0].get("catalog_product_id"), "prod-1")
})

test("loadScanSavedState: a Stage-3-claimed routine product is reported truthfully, not removable", async () => {
  const { client } = stubClient({
    scan_wishlist: { select: () => ({ data: null, error: null }) },
    user_products: {
      selectList: () => ({ data: [{ id: "up-1", intake_source: "catalog_search" }], error: null }),
    },
  })
  const result = await loadScanSavedState(client as never, "user-1", "prod-1")
  // The footer must say "✓ In deiner Routine" — the product really is in the routine —
  // while the change sheet refuses to remove a row another surface owns.
  assert.deepEqual(result, { state: "routine", managedByScan: false })
})

test("loadScanSavedState: one scan row among foreign rows keeps the product removable", async () => {
  const { client } = stubClient({
    scan_wishlist: { select: () => ({ data: null, error: null }) },
    user_products: {
      selectList: () => ({
        data: [
          { id: "up-1", intake_source: "catalog_search" },
          { id: "up-2", intake_source: "scan" },
        ],
        error: null,
      }),
    },
  })
  const result = await loadScanSavedState(client as never, "user-1", "prod-1")
  assert.deepEqual(result, { state: "routine", managedByScan: true })
})

test("loadScanSavedState: neither present returns the not-saved payload", async () => {
  const { client } = stubClient({
    scan_wishlist: { select: () => ({ data: null, error: null }) },
    user_products: { selectList: () => ({ data: [], error: null }) },
  })
  const result = await loadScanSavedState(client as never, "user-1", "prod-1")
  assert.deepEqual(result, { state: null, managedByScan: false })
})

test("loadScanSavedState: a lookup error throws a stable error", async () => {
  const { client } = stubClient({
    scan_wishlist: { select: () => ({ data: null, error: { message: "boom" } }) },
  })
  await assert.rejects(
    () => loadScanSavedState(client as never, "user-1", "prod-1"),
    /scan_saved_state_lookup_failed/,
  )
})

const activeProduct = { select: () => ({ data: { id: "prod-1" }, error: null }) }
const notQuarantined = { select: () => ({ data: null, error: null }) }
const quarantined = { select: () => ({ data: { product_id: "prod-1" }, error: null }) }

test("saveScanWishlistProduct: inserts a row scoped to user and product", async () => {
  const { client, inserts } = stubClient({
    products: activeProduct,
    personal_plan_product_search_dispositions: notQuarantined,
    scan_wishlist: { insert: () => ({ error: null }) },
  })
  const result = await saveScanWishlistProduct(client as never, "user-1", "prod-1")
  assert.deepEqual(result, {
    outcome: "saved",
    savedState: { state: "merkliste", managedByScan: true },
  })
  assert.deepEqual(inserts, [
    { table: "scan_wishlist", payload: { user_id: "user-1", product_id: "prod-1" } },
  ])
})

test("saveScanWishlistProduct: an inactive/unknown product is reported, not inserted", async () => {
  const { client, inserts } = stubClient({
    products: { select: () => ({ data: null, error: null }) },
  })
  const result = await saveScanWishlistProduct(client as never, "user-1", "prod-missing")
  assert.deepEqual(result, { outcome: "product_not_found" })
  assert.deepEqual(inserts, [])
})

test("saveScanWishlistProduct: a disposition-quarantined product is refused (ruling R7)", async () => {
  const { client, inserts } = stubClient({
    products: activeProduct,
    personal_plan_product_search_dispositions: quarantined,
    // scan_wishlist deliberately has no handler: must not be reached.
  })
  const result = await saveScanWishlistProduct(client as never, "user-1", "prod-1")
  assert.deepEqual(result, { outcome: "product_not_saveable" })
  assert.deepEqual(inserts, [])
})

test("saveScanWishlistProduct: a unique-conflict is idempotent success", async () => {
  const { client } = stubClient({
    products: activeProduct,
    personal_plan_product_search_dispositions: notQuarantined,
    scan_wishlist: { insert: () => ({ error: { code: "23505", message: "duplicate key" } }) },
  })
  const result = await saveScanWishlistProduct(client as never, "user-1", "prod-1")
  assert.deepEqual(result, {
    outcome: "saved",
    savedState: { state: "merkliste", managedByScan: true },
  })
})

test("saveScanWishlistProduct: a non-conflict error still throws", async () => {
  const { client } = stubClient({
    products: activeProduct,
    personal_plan_product_search_dispositions: notQuarantined,
    scan_wishlist: { insert: () => ({ error: { code: "23503", message: "fk violation" } }) },
  })
  await assert.rejects(
    () => saveScanWishlistProduct(client as never, "user-1", "prod-1"),
    /scan_wishlist_save_failed/,
  )
})

test("removeScanWishlistProduct: deletes scoped to user and product, no-op if absent", async () => {
  const { client, deletes } = stubClient({
    scan_wishlist: { delete: () => ({ error: null }) },
  })
  const result = await removeScanWishlistProduct(client as never, "user-1", "prod-1")
  assert.deepEqual(result, { outcome: "removed" })
  assert.equal(deletes.length, 1)
  assert.equal(deletes[0].filters.get("user_id"), "user-1")
  assert.equal(deletes[0].filters.get("product_id"), "prod-1")
})

test("saveScanRoutineProduct: unknown/inactive product is reported, not inserted", async () => {
  const { client, inserts } = stubClient({
    products: { select: () => ({ data: null, error: null }) },
  })
  const result = await saveScanRoutineProduct(client as never, "user-1", "prod-missing")
  assert.deepEqual(result, { outcome: "product_not_found" })
  assert.deepEqual(inserts, [])
})

test("saveScanRoutineProduct: already-owned row is a no-op success (any origin)", async () => {
  const { client, inserts } = stubClient({
    products: {
      select: () => ({
        data: {
          id: "prod-1",
          name: "Shampoo X",
          brand: "Marke",
          category_key: "shampoo",
          origin: "user_submitted",
        },
        error: null,
      }),
    },
    personal_plan_product_search_dispositions: notQuarantined,
    user_products: {
      selectList: () => ({ data: [{ id: "up-1", intake_source: "catalog_search" }], error: null }),
    },
  })
  const result = await saveScanRoutineProduct(client as never, "user-1", "prod-1")
  // No fake insert-success: the row exists, it just is not the scan surface's to manage.
  assert.deepEqual(result, {
    outcome: "saved",
    savedState: { state: "routine", managedByScan: false },
  })
  assert.deepEqual(inserts, [])
})

test("saveScanRoutineProduct: inserts a matched/owned/scan row for a new curated product", async () => {
  const { client, inserts } = stubClient({
    products: {
      select: () => ({
        data: {
          id: "prod-1",
          name: "Shampoo X",
          brand: "Marke",
          category_key: "shampoo",
          origin: "curated",
        },
        error: null,
      }),
    },
    personal_plan_product_search_dispositions: notQuarantined,
    user_products: {
      selectList: () => ({ data: [], error: null }),
      insert: () => ({ error: null }),
    },
  })
  const result = await saveScanRoutineProduct(client as never, "user-1", "prod-1")
  assert.deepEqual(result, {
    outcome: "saved",
    savedState: { state: "routine", managedByScan: true },
  })
  assert.deepEqual(inserts, [
    {
      table: "user_products",
      payload: {
        user_id: "user-1",
        category: "shampoo",
        catalog_product_id: "prod-1",
        brand_text: "Marke",
        product_name_text: "Shampoo X",
        identity_status: "matched",
        ownership_status: "owned",
        intake_source: "scan",
      },
    },
  ])
})

test("saveScanRoutineProduct: a disposition-quarantined product is refused (ruling R7)", async () => {
  const { client, inserts } = stubClient({
    products: {
      select: () => ({
        data: {
          id: "prod-1",
          name: "Shampoo X",
          brand: "Marke",
          category_key: "shampoo",
          origin: "curated",
        },
        error: null,
      }),
    },
    personal_plan_product_search_dispositions: quarantined,
    // user_products deliberately has no handler: must not be reached.
  })
  const result = await saveScanRoutineProduct(client as never, "user-1", "prod-1")
  assert.deepEqual(result, { outcome: "product_not_saveable" })
  assert.deepEqual(inserts, [])
})

test("saveScanRoutineProduct: a non-curated product the user does not already own is refused", async () => {
  const { client, inserts } = stubClient({
    products: {
      select: () => ({
        data: {
          id: "prod-1",
          name: "Shampoo X",
          brand: "Marke",
          category_key: "shampoo",
          origin: "user_submitted",
        },
        error: null,
      }),
    },
    personal_plan_product_search_dispositions: notQuarantined,
    user_products: { selectList: () => ({ data: [], error: null }) },
  })
  const result = await saveScanRoutineProduct(client as never, "user-1", "prod-1")
  assert.deepEqual(result, { outcome: "product_not_saveable" })
  assert.deepEqual(inserts, [])
})

test("removeScanRoutineProduct: only deletes rows this helper's own intake_source created", async () => {
  const { client, deletes } = stubClient({
    user_products: {
      selectList: () => ({ data: [{ id: "up-1", intake_source: "scan" }], error: null }),
      delete: () => ({ error: null }),
    },
  })
  const result = await removeScanRoutineProduct(client as never, "user-1", "prod-1")
  assert.deepEqual(result, { outcome: "removed" })
  assert.equal(deletes.length, 1)
  assert.equal(deletes[0].filters.get("intake_source"), "scan")
  assert.equal(deletes[0].filters.get("ownership_status"), "owned")
  assert.equal(deletes[0].filters.get("catalog_product_id"), "prod-1")
})

test("removeScanRoutineProduct: refuses a row another surface owns instead of no-op success", async () => {
  const { client, deletes } = stubClient({
    user_products: {
      selectList: () => ({ data: [{ id: "up-1", intake_source: "catalog_search" }], error: null }),
      // No delete handler: the delete must never be attempted.
    },
  })
  const result = await removeScanRoutineProduct(client as never, "user-1", "prod-1")
  assert.deepEqual(result, { outcome: "not_removable_here" })
  assert.deepEqual(deletes, [])
})

test("removeScanRoutineProduct: nothing owned at all is a plain idempotent success", async () => {
  const { client } = stubClient({
    user_products: {
      selectList: () => ({ data: [], error: null }),
      delete: () => ({ error: null }),
    },
  })
  const result = await removeScanRoutineProduct(client as never, "user-1", "prod-1")
  assert.deepEqual(result, { outcome: "removed" })
})
