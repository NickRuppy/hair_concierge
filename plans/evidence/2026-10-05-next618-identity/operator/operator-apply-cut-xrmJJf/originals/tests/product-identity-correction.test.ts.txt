import assert from "node:assert/strict"
import test from "node:test"

import {
  assertCanonicalCorrectionApplyTarget,
  brandAliasWriteRow,
  buildProductPatch,
} from "../scripts/product-identity/correct-canonical-identities"

test("canonical correction apply guard requires the production project confirmation", () => {
  assert.doesNotThrow(() =>
    assertCanonicalCorrectionApplyTarget({
      apply: false,
      confirmProject: null,
      supabaseUrl: "https://example.supabase.co",
    }),
  )

  assert.throws(
    () =>
      assertCanonicalCorrectionApplyTarget({
        apply: true,
        confirmProject: "wrong",
        supabaseUrl: "https://pqdkhefxsxkyeqelqegq.supabase.co",
      }),
    /Writes require --confirm-project=pqdkhefxsxkyeqelqegq/,
  )

  assert.throws(
    () =>
      assertCanonicalCorrectionApplyTarget({
        apply: true,
        confirmProject: "pqdkhefxsxkyeqelqegq",
        supabaseUrl: "https://other.supabase.co",
      }),
    /unexpected Supabase project/,
  )
})

test("canonical correction product patch never writes live product names or legacy fields", () => {
  const patch = buildProductPatch({
    brandId: "brand-id",
    productLineId: "line-id",
  }) as Record<string, unknown>

  assert.deepEqual(patch, {
    brand_id: "brand-id",
    product_line_id: "line-id",
  })
  assert.equal("name" in patch, false)
  assert.equal("brand" in patch, false)
  assert.equal("category" in patch, false)
})

test("canonical correction alias upsert rows only include database columns", () => {
  const row = brandAliasWriteRow({
    brand_id: "brand-id",
    product_line_id: "line-id",
    alias: "Garnier Hair Food",
    normalized_alias: "garnier hair food",
    source: "curated",
    target_brand_name: "Garnier",
    target_product_line_name: "Fructis",
  })

  assert.deepEqual(row, {
    brand_id: "brand-id",
    product_line_id: "line-id",
    alias: "Garnier Hair Food",
    normalized_alias: "garnier hair food",
    source: "curated",
  })
})
