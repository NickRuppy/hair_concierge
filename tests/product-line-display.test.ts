import assert from "node:assert/strict"
import test from "node:test"

import {
  attachProductLineNamesToProducts,
  getProductIdentityDisplayLabel,
  getProductIdentityDisplayParts,
} from "@/lib/product-lines/display"

function createClient(lines: Array<{ id: string; canonical_name: string | null }>) {
  const calls: string[][] = []

  return {
    calls,
    from(table: "product_lines") {
      assert.equal(table, "product_lines")
      return {
        select(columns: string) {
          assert.equal(columns, "id, canonical_name")
          return {
            async in(column: "id", values: string[]) {
              assert.equal(column, "id")
              calls.push(values)
              return {
                data: lines.filter((line) => values.includes(line.id)),
                error: null,
              }
            },
          }
        },
      }
    },
  }
}

test("attachProductLineNamesToProducts keeps already enriched products untouched", async () => {
  const client = createClient([{ id: "line-1", canonical_name: "Unused" }])
  const product = {
    id: "product-1",
    product_line_id: "line-1",
    product_line_name: "Existing line",
  }

  const products = await attachProductLineNamesToProducts([product], client)

  assert.equal(products[0], product)
  assert.deepEqual(client.calls, [])
})

test("product identity display removes line suffixes from combined brand names", () => {
  assert.deepEqual(
    getProductIdentityDisplayParts({
      brand: "Garnier Wahre Schätze",
      product_line_name: "Wahre Schätze",
    }),
    ["Garnier", "Wahre Schätze"],
  )
  assert.equal(
    getProductIdentityDisplayLabel({
      brand: "Balea Aqua",
      product_line_name: "Aqua",
    }),
    "Balea · Aqua",
  )
  assert.equal(
    getProductIdentityDisplayLabel({
      brand: "Neqi",
      product_line_name: "NEQI x @_the.beautiful.people",
    }),
    "Neqi · NEQI x @_the.beautiful.people",
  )
})
