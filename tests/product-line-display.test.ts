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

function createErrorClient(error: unknown) {
  return {
    from() {
      return {
        select() {
          return {
            async in() {
              return { data: null, error }
            },
          }
        },
      }
    },
  }
}

function createThrowingClient(error: unknown) {
  return {
    from() {
      return {
        select() {
          return {
            async in() {
              throw error
            },
          }
        },
      }
    },
  }
}

test("attachProductLineNamesToProducts resolves missing product line names", async () => {
  const client = createClient([{ id: "line-1", canonical_name: "NEQI x @_the.beautiful.people" }])

  const products = await attachProductLineNamesToProducts(
    [
      {
        id: "product-1",
        product_line_id: "line-1",
        product_line_name: null,
      },
    ],
    client,
  )

  assert.equal(products[0].product_line_name, "NEQI x @_the.beautiful.people")
  assert.deepEqual(client.calls, [["line-1"]])
})

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

test("attachProductLineNamesToProducts preserves order in mixed batches", async () => {
  const client = createClient([{ id: "line-2", canonical_name: "Resolved line" }])
  const products = await attachProductLineNamesToProducts(
    [
      { id: "product-1", product_line_id: "line-1", product_line_name: "Existing line" },
      { id: "product-2", product_line_id: "line-2", product_line_name: null },
      { id: "product-3", product_line_id: "missing-line", product_line_name: null },
    ],
    client,
  )

  assert.deepEqual(
    products.map((product) => product.product_line_name),
    ["Existing line", "Resolved line", null],
  )
  assert.deepEqual(client.calls, [["line-1", "line-2", "missing-line"]])
})

test("attachProductLineNamesToProducts returns original products on lookup errors", async () => {
  const error = new Error("lookup failed")
  const errors: unknown[] = []
  const product = { id: "product-1", product_line_id: "line-1", product_line_name: null }

  const products = await attachProductLineNamesToProducts([product], createErrorClient(error), {
    onError: (nextError) => errors.push(nextError),
  })

  assert.equal(products[0], product)
  assert.deepEqual(errors, [error])
})

test("attachProductLineNamesToProducts returns original products on thrown lookup failures", async () => {
  const error = new Error("network failed")
  const errors: unknown[] = []
  const product = { id: "product-1", product_line_id: "line-1", product_line_name: null }

  const products = await attachProductLineNamesToProducts([product], createThrowingClient(error), {
    onError: (nextError) => errors.push(nextError),
  })

  assert.equal(products[0], product)
  assert.deepEqual(errors, [error])
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
