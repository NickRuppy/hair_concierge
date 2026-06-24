import assert from "node:assert/strict"
import test from "node:test"

import { isEligibleForPrimaryRecommendation } from "../src/lib/recommendation-engine/selection"

test("active product without outgoing relationship is primary-eligible", () => {
  assert.equal(
    isEligibleForPrimaryRecommendation({ is_active: true, lifecycle_status: "active" }, new Set()),
    true,
  )
})

test("user-submitted product is not globally primary-eligible", () => {
  assert.equal(
    isEligibleForPrimaryRecommendation(
      { is_active: true, lifecycle_status: "active", is_chaarlie_recommended: false },
      new Set(),
    ),
    false,
  )
})

test("discontinued product is not primary-eligible", () => {
  assert.equal(
    isEligibleForPrimaryRecommendation(
      { is_active: true, lifecycle_status: "discontinued" },
      new Set(),
    ),
    false,
  )
})

test("product with outgoing replaced_by is not primary-eligible", () => {
  assert.equal(
    isEligibleForPrimaryRecommendation(
      { is_active: true, lifecycle_status: "active" },
      new Set(["replaced_by"]),
    ),
    false,
  )
})

test("product with outgoing add_on_for is not primary-eligible", () => {
  assert.equal(
    isEligibleForPrimaryRecommendation(
      { is_active: true, lifecycle_status: "active" },
      new Set(["add_on_for"]),
    ),
    false,
  )
})

test("add-on product remains relationship-retrievable outside primary eligibility", () => {
  const addOnRelationship = {
    source_product_id: "olaplex-0",
    target_product_id: "olaplex-3plus",
    relationship_type: "add_on_for",
  }

  assert.equal(addOnRelationship.target_product_id, "olaplex-3plus")
  assert.equal(addOnRelationship.relationship_type, "add_on_for")
  assert.equal(
    isEligibleForPrimaryRecommendation(
      { is_active: true, lifecycle_status: "active" },
      new Set([addOnRelationship.relationship_type]),
    ),
    false,
  )
})
