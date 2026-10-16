import assert from "node:assert/strict"
import test from "node:test"

import { selectOilProductsWithEngine } from "../src/lib/recommendation-engine/selection"
import { buildRecommendationRequestContext } from "../src/lib/recommendation-engine/request-context"
import { buildRecommendationEngineRuntimeFromPersistence } from "../src/lib/recommendation-engine/runtime"
import { projectSelectedProducts } from "../src/lib/agent/tools/select-products"
import { LOW_DAMAGE_PROFILE } from "./recommendation-engine-foundation.fixtures"
import type { Product } from "../src/lib/types"

test("an explicit light finish request retains its weight preference alongside the existing purpose", () => {
  const context = buildRecommendationRequestContext({
    requestedCategory: "oil",
    message: "Ich suche ein leichtes Öl als Finish.",
  })
  assert.equal(context.oilPurpose, "styling_finish")
  assert.equal(context.oilWeightRequest, "light")
})

function product(id: string, overrides: Partial<Product> = {}): Product {
  return {
    id,
    name: id,
    brand: "Test",
    category: "Öle",
    description: null,
    short_description: null,
    affiliate_link: null,
    image_url: null,
    price_eur: 20,
    currency: "EUR",
    tags: [],
    suitable_thicknesses: ["fine", "normal", "coarse"],
    suitable_concerns: [],
    is_active: true,
    lifecycle_status: "active",
    is_chaarlie_recommended: true,
    sort_order: 0,
    created_at: "2026-10-15",
    updated_at: "2026-10-15",
    ...overrides,
  }
}

// Exercise the real selector, matcher and Supabase client. Only the HTTP catalog
// boundary is replaced; no production injection/export exists for this test.
async function withCatalog(specFailure: boolean, run: (requests: URL[]) => Promise<void>) {
  const priorFetch = globalThis.fetch
  const priorUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const priorKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://oil-chat-contract.invalid"
  process.env.SUPABASE_SERVICE_ROLE_KEY = "local-contract-key"
  const blocked = Array.from({ length: 501 }, (_, i) => product(`scalp-only-${i}`))
  const safe = [product("finish-a"), product("finish-b"), product("finish-c")]
  const requests: URL[] = []
  globalThis.fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input))
    assert.equal(url.origin, "https://oil-chat-contract.invalid")
    assert.equal(init?.method ?? "GET", "GET", "selection must not write manual tags or facts")
    requests.push(url)
    const table = url.pathname.split("/").at(-1)
    if (table === "products") return Response.json([...blocked, ...safe])
    if (table === "product_oil_eligibility") {
      return Response.json(
        blocked.map((p) => ({
          product_id: p.id,
          thickness: "fine",
          oil_subtype: "trocken-oel",
          oil_purpose: "light_finish",
          products: p,
        })),
      )
    }
    if (table === "product_oil_specs") {
      if (specFailure) return Response.json({ message: "catalog unavailable" }, { status: 500 })
      const rows = [
        ...blocked.map((p) => ({
          product_id: p.id,
          weight: "light",
          role_support: [],
          products: p,
        })),
        ...safe.map((p) => ({
          product_id: p.id,
          weight: "light",
          role_support: ["dry_finish"],
          products: p,
        })),
        {
          product_id: "null-thickness",
          weight: "light",
          role_support: ["dry_finish"],
          products: { ...product("null-thickness"), suitable_thicknesses: null },
        },
        {
          product_id: "inactive",
          weight: "light",
          role_support: ["dry_finish"],
          products: product("inactive", { is_active: false }),
        },
        {
          product_id: "wrong-category",
          weight: "light",
          role_support: ["dry_finish"],
          products: product("wrong-category", { category: "Maske" }),
        },
        {
          product_id: "not-curated",
          weight: "light",
          role_support: ["dry_finish"],
          products: product("not-curated", { is_chaarlie_recommended: false }),
        },
      ]
      const offset = Number(url.searchParams.get("offset") ?? 0)
      const limit = Number(url.searchParams.get("limit") ?? rows.length)
      return Response.json(rows.slice(offset, offset + limit))
    }
    throw new Error(`Unexpected catalog table: ${table}`)
  }
  try {
    await run(requests)
  } finally {
    globalThis.fetch = priorFetch
    if (priorUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL
    else process.env.NEXT_PUBLIC_SUPABASE_URL = priorUrl
    if (priorKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY
    else process.env.SUPABASE_SERVICE_ROLE_KEY = priorKey
  }
}

test("chat selects actual supported finishes beyond the old candidate window without tag writes", async () => {
  await withCatalog(false, async (requests) => {
    const profile = { ...LOW_DAMAGE_PROFILE, thickness: "fine" as const }
    const runtime = buildRecommendationEngineRuntimeFromPersistence(
      profile,
      [],
      buildRecommendationRequestContext({
        requestedCategory: "oil",
        message: "Ich suche ein leichtes Öl als Finish.",
      }),
    )
    const selected = await selectOilProductsWithEngine({
      message: "Ich suche ein leichtes Öl als Finish.",
      hairProfile: profile,
      routineItems: [],
      runtime,
    })
    assert.deepEqual(
      selected.map((p) => p.id),
      ["finish-a", "finish-b", "finish-c"],
    )
    assert.ok(requests.some((url) => url.pathname.endsWith("/product_oil_specs")))
    assert.equal(
      requests.some((url) => url.pathname.endsWith("/product_oil_eligibility")),
      false,
    )
    const meta = selected[0].recommendation_meta
    assert.ok(meta?.category === "oil")
    assert.equal(meta.fit_status, "ideal")
    const projected = projectSelectedProducts(selected, profile, "oil", runtime)
    assert.equal(projected.decision, "recommended")
    assert.equal(
      projected.products[0].supported_claims.find((claim) => claim.field === "weight")?.value,
      "light",
    )
    assert.equal(
      projected.products[0].supported_claims.find((claim) => claim.field === "oil_role")?.value,
      "dry_finish",
    )
    assert.match(projected.products[0].fit_reason, /Gewicht: Leicht/)
  })
})

test("chat does not replace unavailable canonical oil facts with legacy matching tags", async () => {
  await withCatalog(true, async () => {
    const selected = await selectOilProductsWithEngine({
      message: "Ich suche ein leichtes Öl als Finish.",
      hairProfile: { ...LOW_DAMAGE_PROFILE, thickness: "fine" },
      routineItems: [],
    })
    assert.deepEqual(selected, [])
  })
})
