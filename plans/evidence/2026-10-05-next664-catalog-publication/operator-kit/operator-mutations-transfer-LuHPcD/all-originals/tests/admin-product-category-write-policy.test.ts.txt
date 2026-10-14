import assert from "node:assert/strict"
import test from "node:test"

import { requiresGuardedProductRecategorization } from "../src/lib/admin/product-category-write-policy"

test("admin product edits allow aliases of the same canonical category", () => {
  assert.equal(requiresGuardedProductRecategorization("conditioner", "Conditioner Profi"), false)
  assert.equal(requiresGuardedProductRecategorization("oil", "Oil"), false)
})

test("admin product edits reject category changes and unresolved legacy values", () => {
  assert.equal(requiresGuardedProductRecategorization("mask", "Conditioner"), true)
  assert.equal(requiresGuardedProductRecategorization(null, "Maske"), true)
  assert.equal(requiresGuardedProductRecategorization("mask", "unmapped"), true)
})
