import assert from "node:assert/strict"
import test from "node:test"

import { attachProductLineNamesToMessages } from "@/app/api/chat/[id]/route"
import type { Product } from "@/lib/types"

function createProduct(
  id: string,
  productLineId: string | null,
  productLineName: string | null = null,
): Product {
  return {
    id,
    name: id,
    brand: "Test Brand",
    description: null,
    short_description: null,
    category: "Leave-in",
    affiliate_link: null,
    image_url: null,
    price_eur: null,
    currency: "EUR",
    tags: [],
    suitable_thicknesses: [],
    suitable_concerns: [],
    is_active: true,
    lifecycle_status: "active",
    sort_order: 0,
    product_line_id: productLineId,
    product_line_name: productLineName,
    created_at: "2026-06-28T00:00:00.000Z",
    updated_at: "2026-06-28T00:00:00.000Z",
  }
}

function createClient(lines: Array<{ id: string; canonical_name: string | null }>) {
  return {
    from(table: "product_lines") {
      assert.equal(table, "product_lines")
      return {
        select(columns: string) {
          assert.equal(columns, "id, canonical_name")
          return {
            async in(column: "id", values: string[]) {
              assert.equal(column, "id")
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

test("attachProductLineNamesToMessages preserves message product grouping", async () => {
  const messages = [
    { id: "message-1", product_recommendations: [createProduct("product-1", "line-1")] },
    { id: "message-2", product_recommendations: null },
    {
      id: "message-3",
      product_recommendations: [
        createProduct("product-2", "line-2"),
        createProduct("product-3", "line-3", "Existing line"),
      ],
    },
  ]

  const result = await attachProductLineNamesToMessages(
    messages,
    createClient([
      { id: "line-1", canonical_name: "Line One" },
      { id: "line-2", canonical_name: "Line Two" },
    ]),
  )

  assert.equal(result.length, 3)
  assert.deepEqual(
    result.map((message) => message.product_recommendations?.map((product) => product.id) ?? null),
    [["product-1"], null, ["product-2", "product-3"]],
  )
  assert.equal(result[0].product_recommendations?.[0]?.product_line_name, "Line One")
  assert.equal(result[2].product_recommendations?.[0]?.product_line_name, "Line Two")
  assert.equal(result[2].product_recommendations?.[1]?.product_line_name, "Existing line")
})

test("attachProductLineNamesToMessages returns original messages when enrichment throws", async () => {
  const messages = [
    { id: "message-1", product_recommendations: [createProduct("product-1", "line-1")] },
  ]
  const client = {
    from() {
      throw new Error("client unavailable")
    },
  }
  const originalConsoleError = console.error
  console.error = () => {}

  try {
    const result = await attachProductLineNamesToMessages(messages, client)

    assert.equal(result, messages)
  } finally {
    console.error = originalConsoleError
  }
})
