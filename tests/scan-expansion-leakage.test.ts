import assert from "node:assert/strict"
import test from "node:test"

import {
  loadScanProductFacts,
  loadStage3RecommendationCandidates,
} from "@/lib/personal-plan/products/authority/catalog-facts"
import { buildScanVerdict } from "@/lib/scan/resolve-verdict"

/**
 * F-10 leakage regression for the Scan DB Expansion pilot (T5 of
 * plans/2026-09-01-scan-db-expansion-pilot.md).
 *
 * A product published by the expansion adapter is `origin='curated'`,
 * `is_active=true`, `lifecycle_status='active'` and `is_chaarlie_recommended=false`
 * (R3). These tests pin the two consequences that must hold forever:
 *
 *  1. It can NEVER reach Stage-3 recommendation candidates — and therefore never
 *     the scan result's alternatives, which `buildScanVerdict` derives purely from
 *     `recommendationCandidates` (src/lib/scan/resolve-verdict.ts:243-289; the scan
 *     route feeds that from `loadStage3RecommendationCandidates`,
 *     src/app/api/scan/resolve/route.ts:473).
 *  2. It IS reachable by the scanner's own by-id lookup — that is the whole point
 *     of a scannable-only catalog row.
 *
 * The seeded state below is exactly what the adapter writes.
 */

const EXPANSION_PRODUCT = {
  id: "aaaaaaaa-0000-4000-8000-000000000001",
  name: "Garnier Fructis Haarkur Banana Hair Food 3in1 Maske",
  image_url: "https://pqdkhefxsxkyeqelqegq.supabase.co/storage/v1/object/public/product-images/x.png",
  category_key: "mask",
  is_active: true,
  lifecycle_status: "active",
  // The single bit that separates a scan-only row from a recommendable one.
  is_chaarlie_recommended: false,
  suitable_thicknesses: ["fine", "normal", "coarse"],
  sort_order: 0,
  updated_at: "2026-09-02T09:00:00.000Z",
  price_eur: 5.95,
  price_checked_at: "2026-09-02T09:00:00.000Z",
  purchase_link_status: "available",
  net_content_value: 400,
  net_content_unit: "ml",
  affiliate_link: "https://www.dm.de/p/d/1676324/x",
  currency: "EUR",
}

const RECOMMENDED_PRODUCT = {
  ...EXPANSION_PRODUCT,
  id: "bbbbbbbb-0000-4000-8000-000000000002",
  name: "Empfohlene Maske",
  is_chaarlie_recommended: true,
}

const MASK_SPEC = {
  weight: "medium",
  concentration: "medium",
  balance_direction: "moisture",
  ingredient_flags: ["oils", "humectants"],
  repair_support_level: "low",
  functional_benefits: ["smoothing_frizz_control", "detangling_slip"],
}

const PROTOCOL_ROW = {
  category: "mask",
  category_key: "mask",
  role: "intensive_conditioning_mask",
  application_family: "post_shampoo_rinse_out_mask",
  contact_time_seconds: 180,
  rinse_action: "rinse_out",
  guidance_payload_v2: {
    schemaVersion: 2,
    contractKind: "product_pointer",
    scope: { kind: "product", category: "mask", productId: "" },
    sourceRole: "intensive_conditioning_mask",
    runtimeBlockerCode: null,
  },
}

type Row = Record<string, unknown>

/**
 * Minimal PostgREST-shaped client over an in-memory catalog. `eq` genuinely
 * filters, so the loaders' own `is_chaarlie_recommended` predicate is what decides
 * the outcome — not a hand-written expectation.
 */
function catalogClient(products: Row[]) {
  const tables: Record<string, Row[]> = {
    products,
    product_mask_specs: products.map((product) => ({ ...MASK_SPEC, product_id: product.id })),
    product_application_protocols: products.map((product) => ({
      ...PROTOCOL_ROW,
      product_id: product.id,
      guidance_payload_v2: {
        ...PROTOCOL_ROW.guidance_payload_v2,
        scope: { ...PROTOCOL_ROW.guidance_payload_v2.scope, productId: String(product.id) },
      },
    })),
    personal_plan_product_search_dispositions: [],
  }

  return {
    from(table: string) {
      const filters: Array<[string, unknown]> = []
      let inFilter: [string, unknown[]] | null = null
      const rows = () => {
        let result = tables[table] ?? []
        for (const [column, value] of filters) {
          result = result.filter((row) => row[column] === value)
        }
        if (inFilter) {
          const [column, values] = inFilter
          result = result.filter((row) => values.includes(row[column]))
        }
        return result
      }
      const chain = {
        select: () => chain,
        eq: (column: string, value: unknown) => {
          filters.push([column, value])
          return chain
        },
        in: (column: string, values: unknown[]) => {
          inFilter = [column, values]
          return chain
        },
        order: () => chain,
        limit: () => chain,
        range: () => chain,
        maybeSingle: async () => {
          const found = rows()
          return { data: found[0] ?? null, error: found[0] ? null : { code: "PGRST116" } }
        },
        single: async () => ({ data: rows()[0] ?? null, error: null }),
        then: <T>(resolve: (value: unknown) => T | PromiseLike<T>) =>
          Promise.resolve({ data: rows(), error: null, count: rows().length }).then(resolve),
      }
      return chain
    },
  }
}

const SELECTION = {
  hairThickness: "normal" as const,
  role: "intensive_conditioning_mask" as const,
  shampooTarget: null,
  conditionerTarget: null,
}

test("an expansion-published product never reaches Stage-3 recommendation candidates", async () => {
  const client = catalogClient([EXPANSION_PRODUCT, RECOMMENDED_PRODUCT])

  for (const completeCatalog of [false, true]) {
    const candidates = await loadStage3RecommendationCandidates(client as never, {
      category: "mask",
      ...SELECTION,
      completeCatalog,
    } as never)
    const ids = candidates.map((candidate) => candidate.productId)
    assert.ok(
      !ids.includes(EXPANSION_PRODUCT.id),
      `scan-only product leaked into candidates (completeCatalog=${completeCatalog})`,
    )
  }
})

test("scan alternatives never contain an expansion-published product", async () => {
  const client = catalogClient([EXPANSION_PRODUCT, RECOMMENDED_PRODUCT])
  const scanned = await loadScanProductFacts(client as never, "mask", EXPANSION_PRODUCT.id, SELECTION)
  assert.ok(scanned)

  // Exactly the route's own wiring: alternatives come from the filtered candidate
  // loader (src/app/api/scan/resolve/route.ts:473 → resolve-verdict.ts:243-289).
  const candidates = await loadStage3RecommendationCandidates(client as never, {
    category: "mask",
    ...SELECTION,
    completeCatalog: true,
  } as never)

  const verdict = buildScanVerdict({
    category: "mask",
    decision: {
      category: "mask",
      resolution: "resolved",
      needTier: "basis",
      roles: ["intensive_conditioning_mask"],
      target: {
        category: "mask",
        roles: ["intensive_conditioning_mask"],
        needStrength: "standard",
        weight: "medium",
        careDirection: "balanced",
        repairSupportLevel: "medium",
        functionalNeeds: [],
      },
      frequency: null,
      reasons: [],
      executionState: "available",
      executionPauseReason: null,
      deferredFacts: [],
    },
    productFacts: scanned,
    recommendationCandidates: candidates,
    coverage: [],
    hairThickness: "normal",
    heatCarrierCoverage: { carrierCategory: null, verifiedRoutes: [] },
    refinedVersionId: "leakage-test",
    refinedInputHash: "leakage-test",
  } as never)

  assert.equal(verdict.kind, "in_catalog")
  if (verdict.kind !== "in_catalog") return
  assert.ok(
    verdict.alternatives.every((alternative) => alternative.productId !== EXPANSION_PRODUCT.id),
    "a scan-only product leaked into the scan alternatives",
  )
})

test("the scanner's own by-id lookup still resolves an expansion-published product", async () => {
  const client = catalogClient([EXPANSION_PRODUCT])
  const facts = await loadScanProductFacts(client as never, "mask", EXPANSION_PRODUCT.id, SELECTION)
  assert.ok(facts, "a scannable-only product must still resolve for the scanner")
  assert.equal(facts.productId, EXPANSION_PRODUCT.id)
  assert.equal(facts.recommendable, false, "scan-only rows are never recommendable")
})
