import assert from "node:assert/strict"
import test from "node:test"

import {
  createInMemoryOwnerProductInventory,
  createOwnedProduct,
  searchOwnedProductCatalog,
  selectRecommendationCandidates,
  type CatalogProductRecord,
} from "../../../src/lib/personal-plan/products/inventory-search"

const USER_A = "user-a"
const USER_B = "user-b"

const catalog: CatalogProductRecord[] = [
  product("catalog-2", "Acme", "Balance Shampoo", { sortOrder: 2, recommended: false }),
  product("catalog-1", "Acme", "Balance Shampoo Extra", { sortOrder: 1 }),
  product("catalog-3", "Acme", "Inactive Shampoo", { active: false }),
  product("catalog-4", "Acme", "Draft Shampoo", { lifecycleStatus: "draft" }),
]

function product(
  id: string,
  brandName: string,
  displayName: string,
  overrides: Partial<CatalogProductRecord> = {},
): CatalogProductRecord {
  return {
    id,
    brandName,
    displayName,
    category: "shampoo",
    active: true,
    lifecycleStatus: "active",
    recommended: true,
    sortOrder: 0,
    ...overrides,
  }
}

test("owned catalog search returns active same-category recommended and non-recommended matches in stable order", async () => {
  const result = await searchOwnedProductCatalog({
    catalog: { listActiveProducts: async () => catalog },
    category: "shampoo",
    query: "  balance ",
    requestToken: 7,
  })

  assert.equal(result.requestToken, 7)
  assert.equal(result.query, "balance")
  assert.deepEqual(
    result.candidates.map((candidate) => candidate.productId),
    ["catalog-1", "catalog-2"],
  )
})

test("owned catalog search returns exact, no-result, and at-most-eight candidates", async () => {
  const many = Array.from({ length: 10 }, (_, index) =>
    product(`catalog-${index}`, "Acme", `Shampoo ${index}`, { sortOrder: 10 - index }),
  )
  const source = { listActiveProducts: async () => many }

  assert.equal(
    (
      await searchOwnedProductCatalog({
        catalog: source,
        category: "shampoo",
        query: "Acme Shampoo 4",
        requestToken: 1,
      })
    ).candidates[0].confidence,
    "exact",
  )
  assert.equal(
    (
      await searchOwnedProductCatalog({
        catalog: source,
        category: "shampoo",
        query: "missing",
        requestToken: 2,
      })
    ).candidates.length,
    0,
  )
  const capped = await searchOwnedProductCatalog({
    catalog: source,
    category: "shampoo",
    query: "shampoo",
    requestToken: 3,
  })
  assert.equal(capped.candidates.length, 8)
  assert.equal(capped.totalCapped, true)

  const exactBoundary = await searchOwnedProductCatalog({
    catalog: { listActiveProducts: async () => many.slice(0, 8) },
    category: "shampoo",
    query: "shampoo",
    requestToken: 4,
  })
  assert.equal(exactBoundary.candidates.length, 8)
  assert.equal(exactBoundary.totalCapped, false)
})

test("ownership creation requires an explicit confirmation", async () => {
  const inventory = createInMemoryOwnerProductInventory()

  await assert.rejects(
    () =>
      createOwnedProduct({
        inventory,
        userId: USER_A,
        catalogProduct: catalog[0],
        confirmedOwnership: false,
      }),
    { code: "ownership_confirmation_required" },
  )
  assert.equal((await inventory.listOwned({ userId: USER_A, category: "shampoo" })).length, 0)
})

test("invalid owned search query is rejected before catalog access", async () => {
  let calls = 0
  const source = {
    listActiveProducts: async () => {
      calls += 1
      return catalog
    },
  }

  await assert.rejects(
    () =>
      searchOwnedProductCatalog({
        catalog: source,
        category: "shampoo",
        query: " ",
        requestToken: 1,
      }),
    { code: "invalid_query" },
  )
  await assert.rejects(
    () =>
      searchOwnedProductCatalog({
        catalog: source,
        category: "shampoo",
        query: "x".repeat(121),
        requestToken: 2,
      }),
    { code: "invalid_query" },
  )
  assert.equal(calls, 0)
})

test("confirmed ownership is idempotent per owner and permits distinct category siblings", async () => {
  const inventory = createInMemoryOwnerProductInventory({ now: () => "2026-08-08T10:00:00.000Z" })
  const first = await createOwnedProduct({
    inventory,
    userId: USER_A,
    catalogProduct: catalog[0],
    confirmedOwnership: true,
  })
  const duplicate = await createOwnedProduct({
    inventory,
    userId: USER_A,
    catalogProduct: catalog[0],
    confirmedOwnership: true,
  })
  const sibling = await createOwnedProduct({
    inventory,
    userId: USER_A,
    catalogProduct: catalog[1],
    confirmedOwnership: true,
  })

  assert.equal(duplicate.created, false)
  assert.equal(duplicate.product.id, first.product.id)
  assert.equal(sibling.created, true)
  assert.equal((await inventory.listOwned({ userId: USER_A, category: "shampoo" })).length, 2)
})

test("inventory creation and reads remain owner-scoped", async () => {
  const inventory = createInMemoryOwnerProductInventory()
  await createOwnedProduct({
    inventory,
    userId: USER_A,
    catalogProduct: catalog[0],
    confirmedOwnership: true,
  })
  await createOwnedProduct({
    inventory,
    userId: USER_B,
    catalogProduct: catalog[0],
    confirmedOwnership: true,
  })

  assert.equal((await inventory.listOwned({ userId: USER_A, category: "shampoo" })).length, 1)
  assert.equal((await inventory.listOwned({ userId: USER_B, category: "shampoo" })).length, 1)
})

test("recommendation selection remains separate from owned search eligibility", async () => {
  const selected = selectRecommendationCandidates({ category: "shampoo", products: catalog })

  assert.deepEqual(
    selected.map((candidate) => candidate.productId),
    ["catalog-1"],
  )
})

test("canonical Scalp Care is supported as an injected contract fixture without a database category row", async () => {
  const result = await searchOwnedProductCatalog({
    catalog: {
      listActiveProducts: async () => [
        product("scalp-1", "Acme", "Scalp Serum", { category: "scalp_care" }),
      ],
    },
    category: "scalp_care",
    query: "serum",
    requestToken: 5,
  })

  assert.deepEqual(
    result.candidates.map((candidate) => candidate.category),
    ["scalp_care"],
  )
})
