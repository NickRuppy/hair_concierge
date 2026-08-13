import assert from "node:assert/strict"
import test from "node:test"
import { renderToStaticMarkup } from "react-dom/server"

import {
  filterRetainedPersonalPlanProductRows,
  RetainedPersonalPlanProducts,
} from "../src/components/profile/retained-personal-plan-products"
import { createProductRows } from "../src/lib/profile/product-usage-rows"

test("removes the matching retained catalog product from legacy rows and shows it once", () => {
  const legacyRows = createProductRows([
    {
      id: "legacy-usage-id-is-not-the-stage3-user-product-id",
      category: "shampoo",
      brand_text: "Balea",
      product_name: "Altes Shampoo",
      frequency_range: "weekly_2x",
      product_id: "product-old",
      product_submission_id: null,
      match_status: "matched",
      product: null,
    },
  ])
  const retained = [
    {
      capturedProductId: "captured-old",
      userProductId: "stage3-user-product-id",
      productId: "product-old",
      displayName: "Altes Shampoo",
      category: "shampoo" as const,
      role: "shampoo_everyday" as const,
      sourceDecisionKey: "decision-replace",
      planStatus: "not_used" as const,
    },
  ]
  const activeRows = filterRetainedPersonalPlanProductRows(legacyRows, retained)
  const html = renderToStaticMarkup(
    <>
      {activeRows.map((row) => (
        <span key={row.key}>{row.productName}</span>
      ))}
      <RetainedPersonalPlanProducts products={retained} />
    </>,
  )

  assert.equal(activeRows.length, 0)
  assert.equal((html.match(/Altes Shampoo/g) ?? []).length, 1)
  assert.match(html, /Nicht verwendet/)
})

test("keeps legacy rows that do not match the retained catalog identity", () => {
  const legacyRows = createProductRows([
    {
      id: "usage-wrong-category",
      category: "conditioner",
      brand_text: "Balea",
      product_name: "Same catalog id, another category",
      frequency_range: "weekly_2x",
      product_id: "product-old",
      product_submission_id: null,
      match_status: "matched",
      product: null,
    },
    {
      id: "usage-wrong-product",
      category: "shampoo",
      brand_text: "Balea",
      product_name: "Another shampoo",
      frequency_range: "weekly_2x",
      product_id: "product-other",
      product_submission_id: null,
      match_status: "matched",
      product: null,
    },
    {
      id: "usage-pending",
      category: "shampoo",
      brand_text: "Unknown",
      product_name: "Pending shampoo",
      frequency_range: "weekly_2x",
      product_id: null,
      product_submission_id: "submission-pending",
      match_status: "pending_review",
      product: null,
    },
  ])
  const retained = [
    {
      capturedProductId: "captured-old",
      userProductId: "stage3-user-product-id",
      productId: "product-old",
      displayName: "Altes Shampoo",
      category: "shampoo" as const,
      role: "shampoo_everyday" as const,
      sourceDecisionKey: "decision-replace",
      planStatus: "not_used" as const,
    },
  ]

  assert.deepEqual(
    filterRetainedPersonalPlanProductRows(legacyRows, retained).map((row) => row.key),
    ["usage-wrong-product", "usage-pending", "usage-wrong-category"],
  )
})
