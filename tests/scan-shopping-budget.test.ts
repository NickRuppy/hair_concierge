import assert from "node:assert/strict"
import test from "node:test"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"

import { createScanResolveRouteHandler } from "../src/app/api/scan/resolve/route"
import { createScanRevealRouteHandler } from "../src/app/api/scan/reveal/route"
import { ScanAlternativesList } from "../src/components/scan/scan-verdict-sections"
import { mobileScanResolveResultSchema } from "../src/lib/mobile/scan-contracts"
import type { Stage3ConditionerFacts } from "../src/lib/personal-plan/products/authority/contracts"
import { maskScanVerdictPayload } from "../src/lib/scan/masked-alternative"
import {
  presentScanVerdictPayload,
  type ScanCatalogPresentationRow,
} from "../src/lib/scan/product-presentation"
import { buildScanVerdict, type BuildScanVerdictInput } from "../src/lib/scan/resolve-verdict"
import { loadScanBudgetForRequest, loadScanShoppingBudget } from "../src/lib/scan/shopping-budget"
import type { ScanInCatalogVerdictPayload } from "../src/lib/scan/types"
import type { ShoppingBudget } from "../src/lib/user-facts/schema"

const CAP5: ShoppingBudget = { kind: "capped", limitEur: 5, allowExceptions: false }
const CAP15: ShoppingBudget = { kind: "capped", limitEur: 15, allowExceptions: true }
const UNCAPPED: ShoppingBudget = { kind: "uncapped" }

/* ------------------------------------------------------------------ fixtures */

type Price = { priceEur: number | null; link?: "available" | "unavailable" }

function conditioner(
  productId: string,
  sortOrder: number,
  price: Price,
  marketSegment?: "drugstore" | "professional",
): Stage3ConditionerFacts {
  return {
    productId,
    displayName: productId,
    category: "conditioner",
    isActive: true,
    lifecycleStatus: "active",
    recommendable: true,
    suitableThicknesses: ["normal"],
    knownReaction: false,
    protocols: [
      { role: "conditioner_rinse_out", status: "verified_complete", fingerprint: "test" },
    ],
    factFingerprint: `facts-${productId}`,
    catalogSortOrder: sortOrder,
    priceEur: price.priceEur,
    currency: "EUR",
    purchaseLinkStatus: price.link ?? "available",
    ...(marketSegment ? { marketSegment } : {}),
    spec: {
      thickness: "normal",
      proteinMoistureBalance: "moisture",
      weight: "light",
      repairSupportLevel: "medium",
      balanceDirection: "moisture",
      targetFit: "matched",
    },
  } as Stage3ConditionerFacts
}

/** Fit order is the sort order: p1 > p2 > p3 > p4 > p5 (all other facts identical). */
function candidates(): Stage3ConditionerFacts[] {
  return [
    conditioner("p1", 1, { priceEur: 20 }, "professional"),
    conditioner("p2", 2, { priceEur: 4 }, "drugstore"),
    conditioner("p3", 3, { priceEur: 12 }),
    conditioner("p4", 4, { priceEur: 3 }, "drugstore"),
    conditioner("p5", 5, { priceEur: 9, link: "unavailable" }),
  ]
}

function input(overrides: Partial<BuildScanVerdictInput> = {}): BuildScanVerdictInput {
  return {
    category: "conditioner",
    decision: {
      category: "conditioner",
      resolution: "resolved",
      needTier: "basis",
      roles: ["conditioner_rinse_out"],
      target: {
        category: "conditioner",
        roles: ["conditioner_rinse_out"],
        weight: "light",
        careDirection: "moisture",
        repairSupportLevel: "medium",
        functionalNeeds: [],
      },
      frequency: null,
      reasons: [],
      executionState: "available",
      executionPauseReason: null,
      deferredFacts: [],
    },
    productFacts: conditioner("scanned", 0, { priceEur: 8 }),
    recommendationCandidates: candidates(),
    coverage: [],
    hairThickness: "normal",
    heatCarrierCoverage: { carrierCategory: null, verifiedRoutes: [] },
    refinedVersionId: "test",
    refinedInputHash: "test",
    ...overrides,
  }
}

function inCatalog(value: BuildScanVerdictInput): ScanInCatalogVerdictPayload {
  const verdict = buildScanVerdict(value)
  assert.equal(verdict.kind, "in_catalog")
  return verdict as ScanInCatalogVerdictPayload
}

const ids = (verdict: ScanInCatalogVerdictPayload) => verdict.alternatives.map((a) => a.productId)

/* ------------------------------------------------------------------- loader */

function profileClient(result: { data: unknown; error: unknown } | "throw") {
  const calls: { select?: string; eq?: [string, string] } = {}
  const client = {
    from(table: string) {
      assert.equal(table, "hair_profiles")
      return {
        select(columns: string) {
          calls.select = columns
          return {
            eq(column: string, value: string) {
              calls.eq = [column, value]
              return {
                maybeSingle: async () => {
                  if (result === "throw") throw new Error("boom")
                  return result
                },
              }
            },
          }
        },
      }
    },
  }
  return { client: client as never, calls }
}

test("budget loader selects only shopping_preferences and parses a capped budget", async () => {
  const { client, calls } = profileClient({
    data: { shopping_preferences: { budget: CAP15 } },
    error: null,
  })
  assert.deepEqual(await loadScanShoppingBudget(client, "user-1"), CAP15)
  assert.equal(calls.select, "shopping_preferences")
  assert.deepEqual(calls.eq, ["user_id", "user-1"])
})

test("budget loader returns uncapped, and null for absent / invalid / errors (fail-open)", async () => {
  const cases: Array<[unknown, ShoppingBudget | null]> = [
    [{ data: { shopping_preferences: { budget: UNCAPPED } }, error: null }, UNCAPPED],
    [{ data: { shopping_preferences: {} }, error: null }, null],
    [{ data: { shopping_preferences: null }, error: null }, null],
    [{ data: null, error: null }, null],
    [
      { data: { shopping_preferences: { budget: { kind: "capped", limitEur: 7 } } }, error: null },
      null,
    ],
    [{ data: { shopping_preferences: { budget: "garbage" } }, error: null }, null],
    [{ data: { shopping_preferences: "corrupt" }, error: null }, null],
    [{ data: null, error: { message: "db down" } }, null],
  ]
  for (const [result, expected] of cases) {
    const { client } = profileClient(result as never)
    assert.deepEqual(await loadScanShoppingBudget(client, "u"), expected)
  }
  const thrown = profileClient("throw")
  assert.equal(await loadScanShoppingBudget(thrown.client, "u"), null)
})

test("loadScanBudgetForRequest is flag-gated and swallows loader errors", async () => {
  let loads = 0
  const off = await loadScanBudgetForRequest(
    {
      isShoppingBudgetEnabled: () => false,
      loadShoppingBudget: async () => {
        loads += 1
        return CAP5
      },
    },
    {} as never,
    "u",
  )
  assert.equal(off, null)
  assert.equal(loads, 0)
  const failing = await loadScanBudgetForRequest(
    {
      isShoppingBudgetEnabled: () => true,
      loadShoppingBudget: async () => {
        throw new Error("boom")
      },
    },
    {} as never,
    "u",
  )
  assert.equal(failing, null)
})

/* ----------------------------------------------------------------- ordering */

test("no budget: web alternatives keep the fit order and carry no budget keys", () => {
  const verdict = inCatalog(input())
  assert.deepEqual(ids(verdict), ["p1", "p2", "p3"])
  for (const alternative of verdict.alternatives) {
    assert.equal("overBudget" in alternative, false)
    assert.equal("budgetLimitEur" in alternative, false)
    assert.equal("marketSegment" in alternative, false)
  }
})

test("null and uncapped budgets are byte-identical to no budget", () => {
  const baseline = JSON.stringify(inCatalog(input()))
  assert.equal(JSON.stringify(inCatalog(input({ budget: null }))), baseline)
  assert.equal(JSON.stringify(inCatalog(input({ budget: UNCAPPED }))), baseline)
  const native = JSON.stringify(inCatalog(input({ alternativeSelection: "native" })))
  assert.equal(
    JSON.stringify(inCatalog(input({ alternativeSelection: "native", budget: UNCAPPED }))),
    native,
  )
})

test("capped 5 EUR (web): within budget first, over budget labelled, unpriced dropped", () => {
  const verdict = inCatalog(input({ budget: CAP5 }))
  // Affordable in fit order: p2 (4), p4 (3); then over budget in fit order: p1 (20), p3 (12).
  // p5 has no buyable link -> unpriced -> dropped. Web limit is three.
  assert.deepEqual(ids(verdict), ["p2", "p4", "p1"])
  assert.deepEqual(
    verdict.alternatives.map((a) => a.overBudget),
    [false, false, true],
  )
  assert.ok(verdict.alternatives.every((a) => a.budgetLimitEur === 5))
})

test("capped 15 EUR (web): the within-budget block grows, caption limit follows", () => {
  const verdict = inCatalog(input({ budget: CAP15 }))
  assert.deepEqual(ids(verdict), ["p2", "p3", "p4"])
  assert.ok(verdict.alternatives.every((a) => a.overBudget === false && a.budgetLimitEur === 15))
})

test("native: the budget order wins over the native verdict/price comparator", () => {
  const withoutBudget = inCatalog(input({ alternativeSelection: "native" }))
  // Today's native comparator: verdict, then EUR price ascending.
  assert.deepEqual(ids(withoutBudget), ["p4", "p2", "p5", "p3", "p1"])
  const budgeted = inCatalog(input({ alternativeSelection: "native", budget: CAP5 }))
  // Allocation order: affordable in fit order (p2, p4), then over budget in fit order (p1, p3).
  assert.deepEqual(ids(budgeted), ["p2", "p4", "p1", "p3"])
  assert.deepEqual(
    budgeted.alternatives.map((a) => a.overBudget),
    [false, false, true, true],
  )
})

test("market segment is emitted only with the display flag, for shampoo/conditioner/mask", () => {
  const previous = process.env.PRODUCT_MARKET_SEGMENT_DISPLAY_ENABLED
  try {
    delete process.env.PRODUCT_MARKET_SEGMENT_DISPLAY_ENABLED
    assert.ok(inCatalog(input()).alternatives.every((a) => !("marketSegment" in a)))
    process.env.PRODUCT_MARKET_SEGMENT_DISPLAY_ENABLED = "true"
    const flagged = inCatalog(input())
    assert.deepEqual(
      flagged.alternatives.map((a) => [a.productId, a.marketSegment]),
      [
        ["p1", "professional"],
        ["p2", "drugstore"],
        ["p3", undefined],
      ],
    )
    // Unknown segment: the key is absent, not null.
    assert.equal("marketSegment" in flagged.alternatives[2], false)
    // Independent of a budget.
    assert.equal(inCatalog(input({ budget: CAP5 })).alternatives[0]?.marketSegment, "drugstore")
  } finally {
    if (previous === undefined) delete process.env.PRODUCT_MARKET_SEGMENT_DISPLAY_ENABLED
    else process.env.PRODUCT_MARKET_SEGMENT_DISPLAY_ENABLED = previous
  }
})

/* -------------------------------------------------------------- projections */

function presentationRow(id: string): ScanCatalogPresentationRow {
  return {
    id,
    name: id,
    brand: "Marke",
    category: "conditioner",
    imageUrl: null,
    priceEur: 4,
    currency: "EUR",
    affiliateLink: "https://shop.test/x",
    purchaseLinkStatus: "available",
    priceCheckedAt: "2026-08-19T00:00:00.000Z",
  }
}

test("web serialization carries the optional budget/segment fields and nothing else new", () => {
  const previous = process.env.PRODUCT_MARKET_SEGMENT_DISPLAY_ENABLED
  process.env.PRODUCT_MARKET_SEGMENT_DISPLAY_ENABLED = "true"
  try {
    const verdict = inCatalog(input({ budget: CAP5 }))
    const presented = presentScanVerdictPayload(
      verdict,
      verdict.alternatives.map((a) => presentationRow(a.productId)),
    )
    assert.equal(presented.kind, "in_catalog")
    if (presented.kind !== "in_catalog") return
    assert.deepEqual(Object.keys(presented.alternatives[0]).sort(), [
      "brand",
      "budgetLimitEur",
      "displayName",
      "imageUrl",
      "marketSegment",
      "netContentLabel",
      "overBudget",
      "priceLabel",
      "productId",
      "purchaseUrl",
      "verdict",
      "verdictLabel",
    ])
    assert.equal(presented.alternatives[2].overBudget, true)
  } finally {
    if (previous === undefined) delete process.env.PRODUCT_MARKET_SEGMENT_DISPLAY_ENABLED
    else process.env.PRODUCT_MARKET_SEGMENT_DISPLAY_ENABLED = previous
  }
})

test("web serialization without a budget keeps the pre-budget key set", () => {
  const verdict = inCatalog(input())
  const presented = presentScanVerdictPayload(
    verdict,
    verdict.alternatives.map((a) => presentationRow(a.productId)),
  )
  if (presented.kind !== "in_catalog") throw new Error("expected in_catalog")
  assert.deepEqual(Object.keys(presented.alternatives[0]).sort(), [
    "brand",
    "displayName",
    "imageUrl",
    "netContentLabel",
    "priceLabel",
    "productId",
    "purchaseUrl",
    "verdict",
    "verdictLabel",
  ])
})

test("masked alternatives stay closed: exact keys, no price/tier/budget leakage, budget order", () => {
  const previous = process.env.PRODUCT_MARKET_SEGMENT_DISPLAY_ENABLED
  process.env.PRODUCT_MARKET_SEGMENT_DISPLAY_ENABLED = "true"
  try {
    const budgeted = inCatalog(input({ budget: CAP5 }))
    const masked = maskScanVerdictPayload(budgeted)
    assert.equal(masked.alternatives.length, 3)
    for (const alternative of masked.alternatives) {
      assert.deepEqual(Object.keys(alternative).sort(), ["comparison", "verdict", "verdictLabel"])
    }
    const wire = JSON.stringify(masked)
    for (const forbidden of [
      "overBudget",
      "budgetLimitEur",
      "marketSegment",
      "priceEur",
      "priceLabel",
      "packagePriceEur",
      "professional",
      "drugstore",
      "productId",
    ]) {
      assert.equal(wire.includes(forbidden), false, `${forbidden} leaked into the masked payload`)
    }
    // Verdict-level key set is the pre-budget one.
    const plain = maskScanVerdictPayload(inCatalog(input()))
    assert.deepEqual(Object.keys(masked).sort(), Object.keys(plain).sort())
  } finally {
    if (previous === undefined) delete process.env.PRODUCT_MARKET_SEGMENT_DISPLAY_ENABLED
    else process.env.PRODUCT_MARKET_SEGMENT_DISPLAY_ENABLED = previous
  }
})

/* -------------------------------------------------------------- mobile wire */

function mobileProduct(id: string) {
  return {
    id,
    name: id,
    brand: null,
    category: "conditioner",
    categoryLabel: "Conditioner",
    imageUrl: null,
    priceEur: 4,
    currency: "EUR",
    purchaseUrl: null,
  }
}

function mobileAssessment(alternative: Record<string, unknown>) {
  return {
    contractVersion: 1,
    kind: "assessment",
    contextRevision: "r1",
    product: mobileProduct("scanned"),
    verdict: "ideal",
    verdictLabel: "Passt",
    verdictTitle: "Passt",
    subtitle: "s",
    mismatchSummary: "m",
    rows: [],
    categoryFit: null,
    alternatives: [
      {
        product: mobileProduct("alt"),
        verdict: "ideal",
        verdictLabel: "Passt",
        verdictTitle: "Passt",
        mismatchSummary: "m",
        rows: [],
        categoryFit: null,
        ...alternative,
      },
    ],
  }
}

test("mobile contract keeps the optional overBudget/marketSegment fields and rejects bad values", () => {
  const parsed = mobileScanResolveResultSchema.parse(
    mobileAssessment({ overBudget: true, marketSegment: "professional" }),
  )
  assert.equal(parsed.kind, "assessment")
  if (parsed.kind !== "assessment") return
  assert.equal(parsed.alternatives[0].overBudget, true)
  assert.equal(parsed.alternatives[0].marketSegment, "professional")

  const plain = mobileScanResolveResultSchema.parse(mobileAssessment({}))
  if (plain.kind !== "assessment") throw new Error("expected assessment")
  assert.equal("overBudget" in plain.alternatives[0], false)
  assert.equal("marketSegment" in plain.alternatives[0], false)

  assert.throws(() => mobileScanResolveResultSchema.parse(mobileAssessment({ marketSegment: "x" })))
})

/* ----------------------------------------------------------------------- UI */

test("ScanAlternativesList shows the caption, over-budget badge and segment badge", () => {
  const verdict = inCatalog(input({ budget: CAP15 }))
  const withSegment = verdict.alternatives.map((alternative, index) => ({
    ...alternative,
    overBudget: index === 2,
    ...(index === 0 ? { marketSegment: "professional" as const } : {}),
  }))
  const html = renderToStaticMarkup(
    React.createElement(ScanAlternativesList, {
      alternatives: withSegment.map((alternative) => {
        const { criteria: _criteria, ...rest } = alternative
        void _criteria
        return { ...rest, brand: null, purchaseUrl: null }
      }),
    }),
  )
  assert.match(html, /Bis 15 € zuerst/)
  assert.equal((html.match(/Über deinem Budget/g) ?? []).length, 1)
  assert.match(html, /Profi/)
})

test("ScanAlternativesList without budget metadata renders no caption or badges", () => {
  const verdict = inCatalog(input())
  const html = renderToStaticMarkup(
    React.createElement(ScanAlternativesList, {
      alternatives: verdict.alternatives.map((alternative) => {
        const { criteria: _criteria, ...rest } = alternative
        void _criteria
        return { ...rest, brand: null, purchaseUrl: null }
      }),
    }),
  )
  assert.equal(html.includes("zuerst"), false)
  assert.equal(html.includes("Über deinem Budget"), false)
  assert.equal(html.includes("Drogerie"), false)
  assert.match(html, /mb-2/)
})

/* ------------------------------------------------------------------- routes */

const userId = "11111111-1111-4111-8111-111111111111"
const productId = "22222222-2222-4222-8222-222222222222"

const decision = {
  category: "shampoo" as const,
  resolution: "resolved" as const,
  needTier: "basis" as const,
  roles: ["shampoo_everyday" as const],
  target: null,
  frequency: null,
  reasons: [],
  executionState: "available" as const,
  executionPauseReason: null,
  deferredFacts: [],
}

const context = {
  snapshot: {
    schemaVersion: 1 as const,
    snapshotKind: "initial_need" as const,
    computationVersion: "v1",
    inputHash: "hash",
    createdAt: "2026-08-01T00:00:00.000Z",
    sourceQuiz: {} as never,
    profile: { hair: { thickness: "normal" } } as never,
    assessments: {} as never,
    decisions: [decision],
    coverage: [],
    productPreviews: [],
    renderedOrder: [],
    deferredFacts: [],
  },
  snapshotSource: "refined" as const,
  refinedVersionId: "refined-1",
  refinedInputHash: "input-hash",
}

const routeVerdict: ScanInCatalogVerdictPayload = {
  kind: "in_catalog",
  verdict: "ideal",
  verdictLabel: "Passt",
  verdictTitle: "Passt zu deinem Haar",
  status: "ok",
  subtitle: "x",
  evaluatedRole: null,
  evaluatedRoleLabel: null,
  dimensions: [],
  criteria: [],
  coverage: null,
  fitNarrative: null,
  alternatives: [],
}

function row(id: string): ScanCatalogPresentationRow {
  return {
    id,
    name: "Shampoo",
    brand: "Marke",
    category: "shampoo",
    imageUrl: null,
    priceEur: 9,
    currency: "EUR",
    affiliateLink: "https://shop.test/a",
    purchaseLinkStatus: "available",
    priceCheckedAt: "2026-08-19T00:00:00.000Z",
  }
}

type BudgetStubs = {
  enabled: boolean
  loader: () => Promise<ShoppingBudget | null>
}

function resolveHandler(stubs: BudgetStubs, seen: { budget: unknown[]; loads: number }) {
  return createScanResolveRouteHandler({
    getUserId: async () => userId,
    checkRateLimit: async () => ({ allowed: true }),
    createAdminClient: () => ({}) as never,
    validateEanInput: () => ({ ok: true, type: "ean", value: "4006381333931" }),
    findOpenScanSubmission: async () => null,
    resolveRetailerEnrichment: async () => ({
      enrichment: null,
      outcome: "disabled",
      durationMs: null,
      deadlineMs: null,
    }),
    createScanResolveAttemptId: () => "attempt-1",
    recordScanResolveAttempt: async () => {},
    completeScanResolveAttempt: async () => {},
    lookupCatalogProductByIdentifier: async () => ({ productId, category: "shampoo" }),
    isProductSearchQuarantined: async () => false,
    loadQuarantinedProductIdsAmong: async () => new Set<string>(),
    loadScanEvaluationContext: async () => context,
    isShoppingBudgetEnabled: () => stubs.enabled,
    loadShoppingBudget: async () => {
      seen.loads += 1
      return stubs.loader()
    },
    loadScanProductFacts: async () => null,
    loadRecommendationCandidates: async (_client, args) =>
      Object.fromEntries(args.roles.map((role) => [role, []])),
    loadScanSavedState: async () => ({ state: null, managedByScan: false }),
    buildScanVerdict: (verdictInput) => {
      seen.budget.push(verdictInput.budget)
      return routeVerdict
    },
    loadActiveProductById: async () => ({ id: productId, category: "shampoo" }),
    loadPresentationRows: async () => [row(productId)],
    resolvePaidAccess: async () => "allowed",
    hasUsedFreeReveal: async () => false,
    autoSaveScanWishlist: async () => {},
    after: () => {},
  })
}

const resolveRequest = () =>
  new Request("http://test/api/scan/resolve", {
    method: "POST",
    body: JSON.stringify({ productId }),
    headers: { "content-type": "application/json" },
  })

test("resolve route threads the saved budget into the verdict build", async () => {
  const seen = { budget: [] as unknown[], loads: 0 }
  const response = await resolveHandler(
    { enabled: true, loader: async () => CAP15 },
    seen,
  )(resolveRequest())
  assert.equal(response.status, 200)
  assert.deepEqual(seen.budget, [CAP15])
})

test("resolve route: flag off never reads the budget", async () => {
  const seen = { budget: [] as unknown[], loads: 0 }
  const response = await resolveHandler(
    { enabled: false, loader: async () => CAP15 },
    seen,
  )(resolveRequest())
  assert.equal(response.status, 200)
  assert.equal(seen.loads, 0)
  assert.deepEqual(seen.budget, [undefined])
})

test("resolve route: a failing budget loader is fail-open (scan still 200, no budget)", async () => {
  const seen = { budget: [] as unknown[], loads: 0 }
  const response = await resolveHandler(
    {
      enabled: true,
      loader: async () => {
        throw new Error("db down")
      },
    },
    seen,
  )(resolveRequest())
  assert.equal(response.status, 200)
  assert.deepEqual(seen.budget, [undefined])
})

test("reveal route reads the same budget as resolve and passes it to the verdict build", async () => {
  const seen = { budget: [] as unknown[], loads: 0 }
  const handler = createScanRevealRouteHandler({
    getUserId: async () => userId,
    checkRateLimit: async () => ({ allowed: true }),
    createAdminClient: () => ({}) as never,
    isFreemiumScannerFirstEnabled: () => true,
    resolvePaidAccess: async () => "allowed",
    consumeFreeReveal: async () => "consumed",
    loadFreeRevealRecord: async () => null,
    loadActiveProductById: async () => ({ id: productId, category: "shampoo" }),
    isProductSearchQuarantined: async () => false,
    loadQuarantinedProductIdsAmong: async () => new Set<string>(),
    loadScanEvaluationContext: async () => context,
    isShoppingBudgetEnabled: () => true,
    loadShoppingBudget: async () => {
      seen.loads += 1
      return CAP5
    },
    loadScanProductFacts: async () => null,
    loadRecommendationCandidates: async (_client, args) =>
      Object.fromEntries(args.roles.map((role) => [role, []])),
    buildScanVerdict: (verdictInput) => {
      seen.budget.push(verdictInput.budget)
      return routeVerdict
    },
    loadPresentationRows: async () => [],
  })
  const response = await handler(
    new Request("http://test/api/scan/reveal", {
      method: "POST",
      body: JSON.stringify({ productId }),
      headers: { "content-type": "application/json" },
    }),
  )
  assert.equal(response.status, 200)
  assert.equal(seen.loads, 1)
  assert.deepEqual(seen.budget, [CAP5])
})
