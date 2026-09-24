import assert from "node:assert/strict"
import test from "node:test"
import { renderToStaticMarkup } from "react-dom/server"

import { DiscoveryProductList } from "../src/components/discovery/intake/discovery-product-list"
import type { DiscoveryIntakeItemView } from "../src/components/discovery/intake/types"
import { itemDisplayName, itemDisplaySubline } from "../src/components/discovery/intake/usage-flow"
import { scanResultTitle } from "../src/components/scan/scan-search-sheet"
import { toScanSearchResult } from "../src/lib/scan/catalog-search"
import {
  projectDiscoveryIntakeItemRow,
  toDiscoveryIntakeItemView,
} from "../src/lib/discovery/intake"

/**
 * Search rows and picked products name a product the way the routine does: brand +
 * product line + name, de-duplicated by the shared identity formatter.
 */

test("a catalog search result carries its product line", () => {
  const result = toScanSearchResult({
    id: "p1",
    name: "Honig Schätze Shampoo",
    brand: "Garnier",
    category_key: "shampoo",
    image_url: null,
    sort_order: null,
    brand_identity: { canonical_name: "Garnier" },
    product_line: { canonical_name: "Wahre Schätze" },
  })
  assert.equal(result.productLine, "Wahre Schätze")
  assert.equal(scanResultTitle(result), "Garnier Wahre Schätze Honig Schätze Shampoo")
})

test("the search title never prints the brand or the line twice", () => {
  assert.equal(
    scanResultTitle({
      brand: "Syoss",
      productLine: "Intense Fullness",
      name: "Syoss Intense Fullness Shampoo",
    }),
    "Syoss Intense Fullness Shampoo",
  )
})

test("a dm row has no line: brand + name, still de-duplicated", () => {
  assert.equal(
    scanResultTitle({ brand: "Balea", name: "Balea Professional Repair Shampoo" }),
    "Balea Professional Repair Shampoo",
  )
  assert.equal(scanResultTitle({ brand: null, name: "Repair Shampoo" }), "Repair Shampoo")
})

function item(overrides: Partial<DiscoveryIntakeItemView>): DiscoveryIntakeItemView {
  return {
    id: "i1",
    category: "shampoo",
    source: "catalog_search",
    brandText: "Garnier",
    productNameText: "Honig Schätze Shampoo",
    barcodeIdentifier: null,
    ...overrides,
  }
}

test("a picked catalog product reads brand + line + name, with no brand subline", () => {
  const picked = item({ productLine: "Wahre Schätze" })
  assert.equal(itemDisplayName(picked), "Garnier Wahre Schätze Honig Schätze Shampoo")
  assert.equal(itemDisplaySubline(picked), null)
})

test("items without a catalog line degrade to brand + name", () => {
  assert.equal(
    itemDisplayName(
      item({
        source: "dm_search",
        brandText: "Balea",
        productNameText: "Balea Professional Repair Shampoo",
        barcodeIdentifier: "4066447107524",
      }),
    ),
    "Balea Professional Repair Shampoo",
  )
  assert.equal(
    itemDisplayName(
      item({ source: "name_research", brandText: "Weleda", productNameText: "Hafer Shampoo" }),
    ),
    "Weleda Hafer Shampoo",
  )
})

test("an unnamed scan stays „Gescanntes Produkt“ with its barcode underneath", () => {
  const scanned = item({
    source: "barcode_unknown",
    brandText: null,
    productNameText: null,
    barcodeIdentifier: "4005808858149",
  })
  assert.equal(itemDisplayName(scanned), "Gescanntes Produkt")
  assert.equal(itemDisplaySubline(scanned), "4005808858149")
})

test("the joined product line reaches the browser view", () => {
  const view = toDiscoveryIntakeItemView(
    projectDiscoveryIntakeItemRow({
      id: "50000000-0000-4000-8000-000000000001",
      intake_id: "40000000-0000-4000-8000-000000000001",
      category: "shampoo",
      source: "catalog_search",
      brand_text: "Garnier",
      product_name_text: "Honig Schätze Shampoo",
      barcode_identifier: null,
      product_id: "20000000-0000-4000-8000-000000000002",
      product_submission_id: null,
      created_at: "2026-09-23T10:00:00Z",
      catalog_product: { image_url: null, product_line: [{ canonical_name: "Wahre Schätze" }] },
    }),
  )
  assert.equal(view.productLine, "Wahre Schätze")
})

test("the selected entry renders the full title", () => {
  const html = renderToStaticMarkup(
    <DiscoveryProductList
      items={[item({ productLine: "Wahre Schätze" })]}
      busy={false}
      onChange={() => {}}
      onRemove={() => {}}
    />,
  )
  assert.match(html, /Garnier Wahre Schätze Honig Schätze Shampoo/)
})
