import assert from "node:assert/strict"
import test from "node:test"

import { buildRetailerImageProxyUrl } from "../src/lib/mobile/retailer-image"
import {
  resolveMobileScan,
  type MobileScanResolveDependencies,
} from "../src/lib/mobile/scan-service"
import { mobileScanResolveResultSchema } from "../src/lib/mobile/scan-contracts"
import type { RetailerLookupResult } from "../src/lib/scan/enrichment/resolve-enrichment"

const identifier = { type: "ean" as const, value: "4001638530378" }
const hit: RetailerLookupResult = {
  outcome: "hit",
  durationMs: 22,
  deadlineMs: 1500,
  enrichment: {
    source: "dm",
    fetchedAt: "2026-09-19T10:00:00.000Z",
    gtin: "04001638530378",
    dan: "2973187",
    productName: "Shampoo Rosmarin Revitalising, 250 ml",
    brand: "WELEDA",
    imageUrl: "https://products.dm-static.com/images/a product.jpg?size=large",
    productUrl: "https://www.dm.de/product",
    ingredientsText: "Aqua",
    description: "Description",
    keyBenefits: "Benefits",
    suggestedCategory: "shampoo",
  },
}
const fallback = (
  outcome: Exclude<RetailerLookupResult["outcome"], "hit">,
): RetailerLookupResult => ({
  outcome,
  enrichment: null,
  durationMs: outcome === "disabled" ? null : 22,
  deadlineMs: outcome === "disabled" ? null : 1500,
})

function deps(
  overrides: Partial<MobileScanResolveDependencies> = {},
): Partial<MobileScanResolveDependencies> {
  return {
    lookupIdentifier: async () => ({ kind: "miss" }),
    resolveRetailerEnrichment: async () => hit,
    ...overrides,
  }
}

test("a true identifier catalog miss exposes only a safe dm identity preview", async () => {
  let routes: string[] = []
  const result = await resolveMobileScan(
    {} as never,
    {} as never,
    { identifier, retailerImageOrigin: "https://app.chaarlie.de/api/mobile/v1/scan/resolve" },
    deps({
      resolveRetailerEnrichment: async (_barcode, input) => {
        routes.push(input.route)
        return hit
      },
    }),
  )
  assert.equal(result.kind, "submission_required")
  if (result.kind !== "submission_required") return
  assert.equal(result.productId, null)
  assert.deepEqual(routes, ["resolve"])
  assert.deepEqual(result.identified, {
    displayName: "WELEDA Shampoo Rosmarin Revitalising, 250 ml",
    productName: "Shampoo Rosmarin Revitalising, 250 ml",
    brand: "WELEDA",
    suggestedCategory: "shampoo",
    imageUrl:
      "https://app.chaarlie.de/_next/image?url=https%3A%2F%2Fproducts.dm-static.com%2Fimages%2Fa+product.jpg%3Fsize%3Dlarge&w=256&q=75",
  })
  assert.equal(JSON.stringify(result.identified).includes("www.dm.de"), false)
  assert.equal(JSON.stringify(result.identified).includes("ingredientsText"), false)
})

test("dm lookup fails open for disabled, misses, timeout and mismatched identity", async () => {
  for (const outcome of ["disabled", "not_found", "timeout", "gtin_mismatch"] as const) {
    const result = await resolveMobileScan(
      {} as never,
      {} as never,
      { identifier, retailerImageOrigin: "https://app.chaarlie.de/anything" },
      deps({ resolveRetailerEnrichment: async () => fallback(outcome) }),
    )
    assert.equal(result.kind, "submission_required")
    if (result.kind === "submission_required") assert.equal(result.identified, undefined)
  }
})

test("the additive response keeps installed clients' old submission_required payload valid", () => {
  assert.deepEqual(
    mobileScanResolveResultSchema.parse({
      contractVersion: 1,
      kind: "submission_required",
      productId: null,
      missingFacts: ["unknown_product"],
    }),
    {
      contractVersion: 1,
      kind: "submission_required",
      productId: null,
      missingFacts: ["unknown_product"],
    },
  )
})

test("dm lookup runs only for an actual identifier miss, never a catalog hit, quarantine or product id", async () => {
  let calls = 0
  const noLookup = async () => {
    calls++
    return hit
  }
  const common = { resolveRetailerEnrichment: noLookup, isQuarantined: async () => false }
  await resolveMobileScan(
    {} as never,
    {} as never,
    { identifier },
    deps({
      ...common,
      lookupIdentifier: async () => ({
        kind: "candidate",
        productId: "catalog-product",
        category: "shampoo",
      }),
      loadProductById: async () => null,
    }),
  )
  await resolveMobileScan(
    {} as never,
    {} as never,
    { identifier },
    deps({
      ...common,
      lookupIdentifier: async () => ({
        kind: "candidate",
        productId: "quarantined",
        category: "shampoo",
      }),
      isQuarantined: async () => true,
    }),
  )
  await resolveMobileScan(
    {} as never,
    {} as never,
    { productId: "00000000-0000-4000-8000-000000000001" },
    deps({ ...common, loadProductById: async () => null }),
  )
  await resolveMobileScan(
    {} as never,
    {} as never,
    { identifier },
    deps({ ...common, lookupIdentifier: async () => ({ kind: "unavailable" }) }),
  )
  assert.equal(calls, 0)
})

test("an active shared catalog match wins when another raw identifier row is inactive", async () => {
  let dmCalls = 0
  const activeId = "00000000-0000-4000-8000-000000000010"
  const inactiveId = "00000000-0000-4000-8000-000000000011"
  const client = {
    from(table: string) {
      const response =
        table === "product_identifiers"
          ? { data: [{ product_id: activeId }, { product_id: inactiveId }], error: null }
          : {
              data: [
                {
                  id: activeId,
                  category_key: "shampoo",
                  is_active: true,
                  lifecycle_status: "active",
                },
              ],
              error: null,
            }
      return {
        ...response,
        select() {
          return this
        },
        eq() {
          return this
        },
        in() {
          return this
        },
      }
    },
  }
  const result = await resolveMobileScan(
    client as never,
    { snapshot: { decisions: [] } } as never,
    { identifier },
    {
      isQuarantined: async () => false,
      loadProductById: async () => ({
        id: activeId,
        name: "Catalog shampoo",
        brand: null,
        category_key: "shampoo",
        image_url: null,
        price_eur: null,
        currency: null,
        affiliate_link: null,
        purchase_link_status: null,
        price_checked_at: null,
      }),
      resolveRetailerEnrichment: async () => {
        dmCalls++
        return hit
      },
    },
  )
  assert.equal(result.kind, "retryable_error")
  assert.equal(dmCalls, 0)
})

test("retailer image proxy keeps the caller origin, fixed optimization parameters and never proxies rejected input", () => {
  assert.equal(
    buildRetailerImageProxyUrl(
      "https://products.dm-static.com/images/a product.jpg?size=large",
      "http://localhost:3000/api/mobile/v1/scan/resolve",
    ),
    "http://localhost:3000/_next/image?url=https%3A%2F%2Fproducts.dm-static.com%2Fimages%2Fa+product.jpg%3Fsize%3Dlarge&w=256&q=75",
  )
  assert.equal(
    buildRetailerImageProxyUrl(
      "https://products.dm-static.com.evil.test/images/a.jpg",
      "https://app.chaarlie.de/x",
    ),
    null,
  )
  assert.equal(buildRetailerImageProxyUrl(null, "https://app.chaarlie.de/x"), null)
})
