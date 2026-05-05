import assert from "node:assert/strict"
import test from "node:test"

test("dry-shampoo seed helper identifies active rows outside the planned catalog", async () => {
  const module = await import("../scripts/seed-dry-shampoo-products")

  assert.equal(typeof module.findUnexpectedActiveDryShampooProducts, "function")
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
        id: "stale",
        brand: "Legacy",
        name: "Old Dry Shampoo",
        category: "Trockenshampoo",
        is_active: true,
      },
      {
        id: "inactive",
        brand: "Legacy",
        name: "Inactive Dry Shampoo",
        category: "Trockenshampoo",
        is_active: false,
      },
    ]),
    ["stale"],
  )
})
