import assert from "node:assert/strict"
import test from "node:test"

import {
  createScanWishlistRouteHandler,
  listScanWishlist,
  type ScanWishlistRouteDeps,
} from "../src/app/api/scan/wishlist/route"

const userId = "11111111-1111-4111-8111-111111111111"

function baseDeps(overrides: Partial<ScanWishlistRouteDeps> = {}): ScanWishlistRouteDeps {
  return {
    getUserId: async () => userId,
    createAdminClient: () => ({}) as never,
    listWishlist: async () => [],
    ...overrides,
  }
}

test("scan wishlist GET: unauthenticated is rejected", async () => {
  const handler = createScanWishlistRouteHandler(baseDeps({ getUserId: async () => null }))
  const response = await handler()
  assert.equal(response.status, 401)
})

test("scan wishlist GET: returns the injected entries", async () => {
  const entry = {
    productId: "prod-1",
    name: "Shampoo X",
    brand: "Marke",
    imageUrl: null,
    priceLabel: "12,99 €",
    purchaseUrl: "https://example.com/p",
  }
  const handler = createScanWishlistRouteHandler(baseDeps({ listWishlist: async () => [entry] }))
  const response = await handler()
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { entries: [entry] })
})

test("scan wishlist GET: an unexpected error maps to 503", async () => {
  const handler = createScanWishlistRouteHandler(
    baseDeps({
      listWishlist: async () => {
        throw new Error("boom")
      },
    }),
  )
  const response = await handler()
  assert.equal(response.status, 503)
})

/** `listScanWishlist` itself, against a stub client — join + commerce presentation. */
function stubWishlistClient(rows: unknown[]) {
  const filters = new Map<string, unknown>()
  let ordered = false
  const chain = {
    select: () => chain,
    eq: (column: string, value: unknown) => {
      filters.set(column, value)
      return chain
    },
    order: (column: string, options: { ascending: boolean }) => {
      assert.equal(column, "created_at")
      assert.equal(options.ascending, false)
      ordered = true
      return chain
    },
    then: (resolve: (value: unknown) => unknown) => resolve({ data: rows, error: null }),
  }
  const client = { from: () => chain }
  return { client, filters, isOrdered: () => ordered }
}

test("listScanWishlist: joins product fields and presents commerce data", async () => {
  const { client, filters, isOrdered } = stubWishlistClient([
    {
      product_id: "prod-1",
      products: {
        name: "Shampoo X",
        brand: "Marke",
        image_url: "https://example.com/img.jpg",
        price_eur: 12.99,
        currency: "EUR",
        affiliate_link: "https://example.com/p",
        purchase_link_status: "available",
        price_checked_at: "2026-08-01T00:00:00.000Z",
      },
    },
  ])
  const entries = await listScanWishlist(client as never, userId)
  assert.equal(filters.get("user_id"), userId)
  assert.ok(isOrdered())
  assert.deepEqual(entries, [
    {
      productId: "prod-1",
      name: "Shampoo X",
      brand: "Marke",
      imageUrl: "https://example.com/img.jpg",
      priceLabel: new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(
        12.99,
      ),
      purchaseUrl: "https://example.com/p",
    },
  ])
})

test("listScanWishlist: drops a row whose joined product is gone (deleted/deactivated)", async () => {
  const { client } = stubWishlistClient([{ product_id: "prod-orphan", products: null }])
  const entries = await listScanWishlist(client as never, userId)
  assert.deepEqual(entries, [])
})

test("listScanWishlist: a load error throws a stable error", async () => {
  const chain = {
    select: () => chain,
    eq: () => chain,
    order: () => chain,
    then: (resolve: (value: unknown) => unknown) =>
      resolve({ data: null, error: { message: "boom" } }),
  }
  const client = { from: () => chain }
  await assert.rejects(() => listScanWishlist(client as never, userId), /scan_wishlist_list_failed/)
})
