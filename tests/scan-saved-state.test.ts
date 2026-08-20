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
  assert.equal(result, "merkliste")
})

test("loadScanSavedState: owned user_products row (no wishlist row) returns routine", async () => {
  const { client } = stubClient({
    scan_wishlist: { select: () => ({ data: null, error: null }) },
    user_products: { select: () => ({ data: { id: "up-1" }, error: null }) },
  })
  const result = await loadScanSavedState(client as never, "user-1", "prod-1")
  assert.equal(result, "routine")
})

test("loadScanSavedState: neither present returns null", async () => {
  const { client } = stubClient({
    scan_wishlist: { select: () => ({ data: null, error: null }) },
    user_products: { select: () => ({ data: null, error: null }) },
  })
  const result = await loadScanSavedState(client as never, "user-1", "prod-1")
  assert.equal(result, null)
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

test("saveScanWishlistProduct: inserts a row scoped to user and product", async () => {
  const { client, inserts } = stubClient({
    scan_wishlist: { insert: () => ({ error: null }) },
  })
  await saveScanWishlistProduct(client as never, "user-1", "prod-1")
  assert.deepEqual(inserts, [
    { table: "scan_wishlist", payload: { user_id: "user-1", product_id: "prod-1" } },
  ])
})

test("saveScanWishlistProduct: a unique-conflict is idempotent success", async () => {
  const { client } = stubClient({
    scan_wishlist: { insert: () => ({ error: { code: "23505", message: "duplicate key" } }) },
  })
  await saveScanWishlistProduct(client as never, "user-1", "prod-1") // does not throw
})

test("saveScanWishlistProduct: a non-conflict error still throws", async () => {
  const { client } = stubClient({
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
  await removeScanWishlistProduct(client as never, "user-1", "prod-1")
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

test("saveScanRoutineProduct: already-owned row is a no-op success", async () => {
  const { client, inserts } = stubClient({
    products: {
      select: () => ({
        data: { id: "prod-1", name: "Shampoo X", brand: "Marke", category_key: "shampoo" },
        error: null,
      }),
    },
    user_products: { select: () => ({ data: { id: "up-1" }, error: null }) },
  })
  const result = await saveScanRoutineProduct(client as never, "user-1", "prod-1")
  assert.deepEqual(result, { outcome: "saved" })
  assert.deepEqual(inserts, [])
})

test("saveScanRoutineProduct: inserts a matched/owned/scan row for a new product", async () => {
  const { client, inserts } = stubClient({
    products: {
      select: () => ({
        data: { id: "prod-1", name: "Shampoo X", brand: "Marke", category_key: "shampoo" },
        error: null,
      }),
    },
    user_products: {
      select: () => ({ data: null, error: null }),
      insert: () => ({ error: null }),
    },
  })
  const result = await saveScanRoutineProduct(client as never, "user-1", "prod-1")
  assert.deepEqual(result, { outcome: "saved" })
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

test("removeScanRoutineProduct: only deletes rows this helper's own intake_source created", async () => {
  const { client, deletes } = stubClient({
    user_products: { delete: () => ({ error: null }) },
  })
  await removeScanRoutineProduct(client as never, "user-1", "prod-1")
  assert.equal(deletes.length, 1)
  assert.equal(deletes[0].filters.get("intake_source"), "scan")
  assert.equal(deletes[0].filters.get("ownership_status"), "owned")
  assert.equal(deletes[0].filters.get("catalog_product_id"), "prod-1")
})
