import assert from "node:assert/strict"
import test from "node:test"
import { renderToStaticMarkup } from "react-dom/server"

import { DiscoveryProductCard } from "../src/components/discovery/intake/discovery-products-screen"
import {
  projectDiscoveryIntakeItemRow,
  toDiscoveryIntakeItemView,
} from "../src/lib/discovery/intake"

/**
 * A captured product shows the same packshot its search row showed. The image is
 * not stored on the item: it is read through `product_id` -> `products.image_url`
 * at load time, so only rows that resolved to a catalog product have one.
 */

const baseRow = {
  id: "50000000-0000-4000-8000-000000000001",
  intake_id: "40000000-0000-4000-8000-000000000001",
  category: "shampoo",
  source: "catalog_search",
  brand_text: "Weleda",
  product_name_text: "Hafer Aufbau-Shampoo",
  barcode_identifier: null,
  product_id: "20000000-0000-4000-8000-000000000002",
  product_submission_id: null,
  created_at: "2026-09-23T10:00:00Z",
}

test("the joined catalog image reaches the browser view — object or array relation", () => {
  for (const relation of [
    { image_url: "https://catalog.example/weleda.jpg" },
    [{ image_url: "https://catalog.example/weleda.jpg" }],
  ]) {
    const view = toDiscoveryIntakeItemView(
      projectDiscoveryIntakeItemRow({ ...baseRow, catalog_product: relation }),
    )
    assert.equal(view.imageUrl, "https://catalog.example/weleda.jpg")
    // The identity columns still stay server-side.
    assert.equal("productId" in view, false)
  }
})

test("rows without a catalog product (or without a catalog image) degrade to no image", () => {
  for (const relation of [null, undefined, { image_url: null }, { image_url: "  " }, []]) {
    const view = toDiscoveryIntakeItemView(
      projectDiscoveryIntakeItemRow({
        ...baseRow,
        source: "name_research",
        product_id: null,
        product_submission_id: "30000000-0000-4000-8000-000000000004",
        catalog_product: relation,
      }),
    )
    assert.equal(view.imageUrl, null)
  }
})

function renderEntry(imageUrl: string | null) {
  return renderToStaticMarkup(
    <DiscoveryProductCard
      item={{
        id: "i1",
        category: "shampoo",
        source: "catalog_search",
        brandText: "Weleda",
        productNameText: "Hafer Aufbau-Shampoo",
        barcodeIdentifier: null,
        imageUrl,
        frequency: "weekly_2x",
      }}
      busy={false}
      landed={false}
      onEdit={() => {}}
      onFrequency={() => {}}
      onRemove={() => {}}
    />,
  )
}

test("the product card shows its packshot", () => {
  assert.match(
    renderEntry("https://catalog.example/weleda.jpg"),
    /src="https:\/\/catalog\.example\/weleda\.jpg"/,
  )
})

test("a selected product without an image shows its category icon instead", () => {
  const html = renderEntry(null)
  assert.doesNotMatch(html, /<img/)
  assert.match(html, /<svg/)
})
