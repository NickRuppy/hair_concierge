import assert from "node:assert/strict"
import test from "node:test"

import { buildProductListChunks } from "../src/lib/product-matching/product-list-chunks"

test("product list chunks understand hyphenated oil subtype labels", () => {
  const chunks = buildProductListChunks([
    {
      name: "Olaplex No.7 Bonding Oil",
      brand: "Olaplex",
      category: "Öle",
      suitable_thicknesses: ["fine"],
      suitable_concerns: ["styling-oel"],
    },
  ])

  assert.equal(chunks.length, 1)
  assert.match(chunks[0]?.content ?? "", /Styling mit Oel/)
})
