import assert from "node:assert/strict"
import test from "node:test"

test("dry-shampoo seed helper identifies active rows outside the planned catalog", async () => {
  const module = await import("../scripts/seed-dry-shampoo-products")

  assert.equal(typeof module.findUnexpectedActiveDryShampooProducts, "function")
  assert.deepEqual(module.STALE_DRY_SHAMPOO_DEACTIVATION_PATCH, {
    is_active: false,
    lifecycle_status: "discontinued",
  })
  assert.deepEqual(
    module.findUnexpectedActiveDryShampooProducts([
      {
        id: "planned",
        brand: "Batiste",
        name: "Trockenshampoo Original",
        category: "Trockenshampoo",
        is_active: true,
      },
      {
        id: "planned-alias",
        brand: "Batiste",
        name: "Trockenshampoo Original",
        category: "Dry Shampoo",
        is_active: true,
      },
      {
        id: "stale",
        brand: "Legacy",
        name: "Old Dry Shampoo",
        category: "Trockenshampoo",
        is_active: true,
      },
      {
        id: "stale-alias",
        brand: "Legacy",
        name: "Old Dry Shampoo Alias",
        category: "dry_shampoo",
        is_active: true,
      },
      {
        id: "inactive",
        brand: "Legacy",
        name: "Inactive Dry Shampoo",
        category: "Trockenshampoo",
        is_active: false,
      },
      {
        id: "other-category",
        brand: "Legacy",
        name: "Old Shampoo",
        category: "Shampoo",
        is_active: true,
      },
    ]),
    ["stale", "stale-alias"],
  )
})
