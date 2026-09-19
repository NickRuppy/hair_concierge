import assert from "node:assert/strict"
import test from "node:test"
import { createClient } from "@supabase/supabase-js"

import { searchMobileScanCatalog } from "../src/lib/mobile/scan-service"

test("mobile search matches the canonical product line and returns the routine identity title", async () => {
  const client = createClient("https://db.example.test", "synthetic-service", {
    auth: { persistSession: false },
    global: {
      fetch: async (input) => {
        const url = new URL(String(input))
        if (url.pathname === "/rest/v1/products") {
          assert.match(url.searchParams.get("select") ?? "", /brand_identity:brands/)
          assert.match(url.searchParams.get("select") ?? "", /product_line:product_lines/)
          return Response.json([
            {
              id: "product-1",
              name: "Leave-In Moisturizing Mist",
              brand: "Legacy Neqi",
              brand_identity: { canonical_name: "Neqi" },
              product_line: { canonical_name: "NEQI x @_the.beautiful.people" },
              category_key: "leave_in",
              image_url: null,
              sort_order: 1,
            },
          ])
        }
        if (url.pathname === "/rest/v1/personal_plan_product_search_dispositions") {
          return Response.json([])
        }
        assert.fail(url.toString())
      },
    },
  })

  const result = await searchMobileScanCatalog(client, "beautiful")
  assert.equal(result.results.length, 1)
  assert.deepEqual(result.results[0], {
    id: "product-1",
    name: "Leave-In Moisturizing Mist",
    displayName: "NEQI x @_the.beautiful.people Leave-In Moisturizing Mist",
    brand: "Neqi",
    category: "leave_in",
    categoryLabel: "Leave-in",
    imageUrl: null,
  })
})
