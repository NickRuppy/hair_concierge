import { Buffer } from "node:buffer"
import { performance } from "node:perf_hooks"

import { CATEGORY_ROLE_POLICIES } from "../../src/lib/personal-plan/products/authorities"
import type {
  Stage3CategoryRequirement,
  Stage3ProductDraft,
} from "../../src/lib/personal-plan/products/contracts"
import {
  createProductionStage3ProductsGateway,
  type Stage3ProductionPersistence,
} from "../../src/lib/personal-plan/products/production-persistence-gateway"
import { stage3FitComparisonForTransport } from "../../src/lib/personal-plan/products/fit-comparison"
import { createSupabaseStage3ProductionPersistence } from "../../src/lib/personal-plan/products/stage3-persistence-supabase"
import {
  addCapturedProduct,
  assignProductRoles,
  completeCaptureCategory,
  createStage3Draft,
} from "../../src/lib/personal-plan/products/state-machine"

const MAX_WARM_P95_MS = 3_000
const MAX_RESPONSE_BYTES = 64 * 1_024
const BENCHMARK_CANDIDATE_COUNT = 50
const CATALOG_BATCH_QUERY_COUNT = 5
const OWNED_PRODUCT_QUERY_COUNT = 5

function numberArgument(name: string, fallback: number): number {
  const prefix = `--${name}=`
  const raw = process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length)
  if (raw === undefined) return fallback
  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`invalid_${name}`)
  return parsed
}

const iterations = Math.max(2, Math.floor(numberArgument("iterations", 20)))
const authorityLatencyMs = numberArgument("authority-latency-ms", 50)
const catalogQueryLatencyMs = numberArgument("catalog-query-latency-ms", 20)
const reviewCount = Math.max(1, Math.floor(numberArgument("reviews", 8)))
const maxCatalogQueryCount = CATALOG_BATCH_QUERY_COUNT + reviewCount * OWNED_PRODUCT_QUERY_COUNT

const requirement: Stage3CategoryRequirement = {
  category: "conditioner",
  requiredRoles: ["conditioner_rinse_out"],
  needSummary: "Pflege nach jeder Wäsche",
  authorityVersion: CATEGORY_ROLE_POLICIES.conditioner.authorityVersion,
}

function delay(durationMs = authorityLatencyMs): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, durationMs))
}

function benchmarkDraft(): Stage3ProductDraft {
  let draft = createStage3Draft({
    draftId: "benchmark-stage3-draft",
    userId: "benchmark-owner",
    personalPlanId: "benchmark-plan",
    refinedVersionId: "benchmark-refined-version",
    requirements: [requirement],
    now: "2026-08-13T00:00:00.000Z",
  })
  for (let index = 0; index < reviewCount; index += 1) {
    const capturedProductId = `captured-${index}`
    draft = addCapturedProduct(draft, {
      capturedProductId,
      userProductId: `user-product-${index}`,
      identity: {
        kind: "catalog_product",
        productId: `benchmark-product-${index}`,
        displayName: `Owned Conditioner ${index}`,
        category: "conditioner",
        imageUrl: `https://example.com/owned-${index}.jpg`,
      },
      frequencyRange: "weekly_2x",
      ownership: "owned",
      source: "catalog_search",
    })
    draft = assignProductRoles(draft, {
      capturedProductId,
      category: "conditioner",
      roles: ["conditioner_rinse_out"],
    })
  }
  draft = completeCaptureCategory(draft, "conditioner", [requirement])
  return {
    ...draft,
    authoritySnapshot: {
      schemaVersion: 1,
      refinedNeedVersionId: draft.refinedVersionId,
      refinedInputHash: "benchmark-refined-input",
      categoryDecisions: [
        {
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
      ],
      coverage: [],
      orderedCategories: ["conditioner"],
      authorityVersions: Object.fromEntries(
        Object.entries(CATEGORY_ROLE_POLICIES).map(([category, policy]) => [
          category,
          policy.authorityVersion,
        ]),
      ) as never,
    },
  }
}

type BenchmarkCatalogCall = {
  table: string
  terminal: "range" | "many" | "maybeSingle"
  range: [number, number] | null
  inIds: string[] | null
  rowCount: number
}

function benchmarkCatalogClient(calls: BenchmarkCatalogCall[]) {
  const products = Array.from({ length: BENCHMARK_CANDIDATE_COUNT }, (_, index) => ({
    id: `benchmark-product-${index}`,
    name: `Benchmark Conditioner ${index}`,
    image_url: `https://example.com/benchmark-product-${index}.jpg`,
    category_key: "conditioner",
    is_active: true,
    lifecycle_status: "active",
    is_chaarlie_recommended: true,
    suitable_thicknesses: ["normal"],
    updated_at: "2026-08-14T00:00:00.000Z",
    sort_order: index + 1,
    price_eur: 9.95,
    price_checked_at: "2026-08-14T00:00:00.000Z",
    purchase_link_status: "available",
    net_content_value: 250,
    net_content_unit: "ml",
  }))
  const rowsByTable: Record<string, readonly Record<string, unknown>[]> = {
    products,
    product_conditioner_specs: products.map((product) => ({
      product_id: product.id,
      thickness: "normal",
      protein_moisture_balance: "moisture",
    })),
    product_conditioner_rerank_specs: products.map((product) => ({
      product_id: product.id,
      weight: "light",
      repair_level: "medium",
      balance_direction: "moisture",
    })),
    product_application_protocols: [],
    application_guidance_protocols: products.map((product) => ({
      product_id: product.id,
      id: `guidance-${product.id}`,
      role_key: "conditioner_rinse_out",
      protocol_version: 1,
      verified_at: "2026-08-14T00:00:00.000Z",
      updated_at: "2026-08-14T00:00:00.000Z",
      scope_kind: "product",
      status: "active",
      locale: "de",
    })),
  }

  return {
    from(table: string) {
      const filters = new Map<string, unknown>()
      let inFilter: { column: string; values: string[] } | null = null
      let selectedColumns = "*"
      let exactCount = false
      let limit: number | null = null
      const materialize = async (
        terminal: BenchmarkCatalogCall["terminal"],
        range: [number, number] | null,
      ) => {
        await delay(catalogQueryLatencyMs)
        let rows = [...(rowsByTable[table] ?? [])]
        for (const [column, value] of filters) {
          rows = rows.filter((row) => row[column] === value)
        }
        if (inFilter) {
          const activeFilter = inFilter
          rows = rows.filter((row) =>
            activeFilter.values.includes(String(row[activeFilter.column])),
          )
        }
        const count = rows.length
        const bounded = range
          ? rows.slice(range[0], range[1] + 1)
          : limit === null
            ? rows
            : rows.slice(0, limit)
        const selected =
          selectedColumns === "*"
            ? bounded
            : bounded.map((row) =>
                Object.fromEntries(
                  selectedColumns
                    .split(",")
                    .map((column) => column.trim())
                    .filter((column) => column in row)
                    .map((column) => [column, row[column]]),
                ),
              )
        calls.push({
          table,
          terminal,
          range,
          inIds: inFilter ? [...inFilter.values] : null,
          rowCount: selected.length,
        })
        return { data: selected, error: null, count: exactCount ? count : null }
      }
      const chain = {
        select: (columns: string, options?: { count?: string }) => {
          selectedColumns = columns
          exactCount = options?.count === "exact"
          return chain
        },
        eq: (column: string, value: unknown) => {
          filters.set(column, value)
          return chain
        },
        in: (column: string, values: string[]) => {
          inFilter = { column, values: [...values] }
          return chain
        },
        order: () => chain,
        limit: (value: number) => {
          limit = value
          return chain
        },
        range: (from: number, to: number) => materialize("range", [from, to]),
        maybeSingle: async () => {
          const result = await materialize("maybeSingle", null)
          if (result.data.length > 1) {
            return { data: null, error: { code: "PGRST116" }, count: result.count }
          }
          return { ...result, data: result.data[0] ?? null }
        },
        then: <T>(
          resolve: (value: unknown) => T | PromiseLike<T>,
          reject?: (reason: unknown) => unknown,
        ) => materialize("many", null).then(resolve, reject),
      }
      return chain
    },
  }
}

function benchmarkPersistence(
  draft: Stage3ProductDraft,
  catalogCalls: BenchmarkCatalogCall[],
): Stage3ProductionPersistence {
  const catalogPersistence = createSupabaseStage3ProductionPersistence(
    benchmarkCatalogClient(catalogCalls) as never,
  )
  return {
    loadOrCreate: async () => {
      await delay()
      return { draft, requirements: [requirement] }
    },
    save: async (input) => ({ outcome: "saved", draft: input.draft }),
    search: async (input) => ({
      query: input.query,
      category: input.category,
      candidates: [],
      totalCapped: false,
    }),
    resolveOwnedCatalogProduct: async () => null,
    loadCurrentCatalogProduct: async () => null,
    loadRequirements: async () => [requirement],
    loadCompletedPortfolio: async () => null,
    loadRefinedNeedSnapshot: async () => {
      await delay()
      return {
        inputHash: "benchmark-refined-input",
        profile: {
          source: { projection: "refined_post_plan" },
          hair: { thickness: "normal" },
        },
      } as never
    },
    loadSourceRevision: async () => 1,
    loadCurrentRefinedVersionId: async () => {
      await delay()
      return draft.refinedVersionId
    },
    loadAuthorityFacts: catalogPersistence.loadAuthorityFacts,
    loadDraft: async () => draft,
  }
}

async function sample() {
  const draft = benchmarkDraft()
  const catalogCalls: BenchmarkCatalogCall[] = []
  const gateway = createProductionStage3ProductsGateway({
    userId: draft.userId,
    persistence: benchmarkPersistence(draft, catalogCalls),
  })
  const startedAt = performance.now()
  const loaded = await gateway.loadOrCreate({
    draftId: draft.draftId,
    userId: draft.userId,
    personalPlanId: draft.personalPlanId,
    refinedVersionId: draft.refinedVersionId,
    requirements: [],
  })
  const reviewBundles = await gateway.reviewDecisionBundles({ draftId: draft.draftId })
  const payload = {
    ...loaded,
    authorityEvaluations: reviewBundles.map((bundle) => bundle.authorityEvaluation),
    fitComparisons: reviewBundles.map((bundle) =>
      stage3FitComparisonForTransport(bundle.fitComparison),
    ),
  }
  return {
    durationMs: performance.now() - startedAt,
    responseBytes: Buffer.byteLength(JSON.stringify(payload), "utf8"),
    catalogQueryCount: catalogCalls.length,
    catalogReturnedRows: catalogCalls.reduce((total, call) => total + call.rowCount, 0),
    exercisedCompleteCatalogPath:
      catalogCalls.some(
        (call) => call.table === "products" && call.terminal === "range" && call.range !== null,
      ) &&
      [
        "product_conditioner_specs",
        "product_conditioner_rerank_specs",
        "product_application_protocols",
        "application_guidance_protocols",
      ].every((table) => catalogCalls.some((call) => call.table === table && call.inIds !== null)),
  }
}

function percentile(values: number[], quantile: number): number {
  const sorted = [...values].sort((left, right) => left - right)
  return sorted[Math.ceil(sorted.length * quantile) - 1]!
}

async function main() {
  await sample() // cold sample is intentionally excluded from the warm SLO
  const samples = []
  for (let index = 0; index < iterations; index += 1) samples.push(await sample())
  const warmP95Ms =
    Math.round(
      percentile(
        samples.map((item) => item.durationMs),
        0.95,
      ) * 100,
    ) / 100
  const responseBytes = Math.max(...samples.map((item) => item.responseBytes))
  const catalogQueryCount = Math.max(...samples.map((item) => item.catalogQueryCount))
  const catalogReturnedRows = Math.max(...samples.map((item) => item.catalogReturnedRows))
  const exercisedCompleteCatalogPath = samples.every((item) => item.exercisedCompleteCatalogPath)
  const result = {
    assumptions: {
      reviewCount,
      candidateCatalogSize: BENCHMARK_CANDIDATE_COUNT,
      modeledGatewayPersistenceLatencyMs: authorityLatencyMs,
      catalogQueryLatencyMs,
      iterations,
      note: "Runs the production Supabase complete-catalog persistence adapter against a latency-bearing query double, then executes the production gateway review path and serializes the Stage 3 GET-shaped response.",
    },
    warmP95Ms,
    responseBytes,
    catalogQueryCount,
    catalogReturnedRows,
    exercisedCompleteCatalogPath,
    limits: {
      warmP95Ms: MAX_WARM_P95_MS,
      responseBytes: MAX_RESPONSE_BYTES,
      catalogQueryCount: maxCatalogQueryCount,
    },
  }
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  if (warmP95Ms > MAX_WARM_P95_MS) throw new Error("stage3_review_readiness_p95_exceeded")
  if (responseBytes > MAX_RESPONSE_BYTES) throw new Error("stage3_review_response_too_large")
  if (!exercisedCompleteCatalogPath) throw new Error("stage3_review_catalog_path_not_exercised")
  if (catalogQueryCount > maxCatalogQueryCount) {
    throw new Error("stage3_review_catalog_query_count_exceeded")
  }
}

void main()
