import assert from "node:assert/strict"
import test from "node:test"

import {
  mapUsageRowToReplayLookup,
  projectReplayExample,
  type UserProductUsageReplayRow,
} from "../scripts/product-intake/replay-user-product-usage-lookup"

test("replay maps legacy usage rows with category and product name to lookup input", () => {
  const row: UserProductUsageReplayRow = {
    category: "shampoo",
    product_name: "Repair & Care Shampoo",
    brand_text: null,
    frequency_range: "weekly_2x",
    match_status: null,
    product_id: null,
  }

  assert.deepEqual(mapUsageRowToReplayLookup(row), {
    status: "mapped",
    input: {
      category: "shampoo",
      product_name_text: "Repair & Care Shampoo",
      brand_text: null,
    },
  })
})

test("replay maps newer usage rows with brand text to lookup input", () => {
  const row: UserProductUsageReplayRow = {
    category: "conditioner",
    product_name: "Hair Food Aloe Conditioner",
    brand_text: "Garnier Fructis",
    frequency_range: "weekly_1x",
    match_status: "matched_existing",
    product_id: "product-123",
  }

  assert.deepEqual(mapUsageRowToReplayLookup(row), {
    status: "mapped",
    input: {
      category: "conditioner",
      product_name_text: "Hair Food Aloe Conditioner",
      brand_text: "Garnier Fructis",
    },
  })
})

test("replay reports rows with blank product names as skipped", () => {
  const row: UserProductUsageReplayRow = {
    category: "mask",
    product_name: "   ",
    brand_text: "Garnier",
    frequency_range: null,
    match_status: null,
    product_id: null,
  }

  assert.deepEqual(mapUsageRowToReplayLookup(row), {
    status: "skipped_missing_product_name",
    input: null,
  })
})

test("replay examples do not expose direct user identifiers", () => {
  const row = {
    category: "shampoo",
    product_name: "Volume Pur Shampoo",
    brand_text: "Pantene Pro-V",
    frequency_range: "weekly_3_4x",
    match_status: "unmatched",
    product_id: "product-456",
    user_id: "user-secret",
    email: "person@example.com",
    name: "Sensitive Name",
    conversation_id: "conversation-secret",
  }

  const example = projectReplayExample({
    row,
    lookupStatus: "not_found",
    candidateCount: 0,
  })
  const serialized = JSON.stringify(example)

  assert.deepEqual(Object.keys(example).sort(), [
    "brand_text",
    "candidate_count",
    "category",
    "frequency_range",
    "lookup_status",
    "match_status",
    "product_id_present_before_replay",
    "product_name",
  ])
  assert.equal(example.product_id_present_before_replay, true)
  assert.doesNotMatch(
    serialized,
    /user-secret|person@example\.com|Sensitive Name|conversation-secret/,
  )
})
