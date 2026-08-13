import { Buffer } from "node:buffer"
import { performance } from "node:perf_hooks"

import { CATEGORY_ROLE_POLICIES } from "../../src/lib/personal-plan/products/authorities"
import type { Stage3ConditionerFacts } from "../../src/lib/personal-plan/products/authority/contracts"
import { STAGE3_AUTHORITY_CANDIDATE_QUERY_LIMIT } from "../../src/lib/personal-plan/products/authority/catalog-facts"
import type {
  Stage3CategoryRequirement,
  Stage3ProductDraft,
} from "../../src/lib/personal-plan/products/contracts"
import {
  createProductionStage3ProductsGateway,
  type Stage3ProductionPersistence,
} from "../../src/lib/personal-plan/products/production-persistence-gateway"
import {
  addCapturedProduct,
  assignProductRoles,
  completeCaptureCategory,
  createStage3Draft,
} from "../../src/lib/personal-plan/products/state-machine"

const MAX_WARM_P95_MS = 3_000
const MAX_RESPONSE_BYTES = 64 * 1_024

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
const reviewCount = Math.max(1, Math.floor(numberArgument("reviews", 8)))

const requirement: Stage3CategoryRequirement = {
  category: "conditioner",
  requiredRoles: ["conditioner_rinse_out"],
  needSummary: "Pflege nach jeder Wäsche",
  authorityVersion: CATEGORY_ROLE_POLICIES.conditioner.authorityVersion,
}

function delay(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, authorityLatencyMs))
}

function conditionerFacts(
  productId: string,
  sortOrder: number,
  weight: string,
): Stage3ConditionerFacts {
  return {
    productId,
    displayName: `Benchmark Conditioner ${productId}`,
    presentationImageUrl: `https://example.com/${productId}.jpg`,
    category: "conditioner",
    isActive: true,
    lifecycleStatus: "active",
    recommendable: true,
    suitableThicknesses: ["normal"],
    knownReaction: false,
    protocols: [
      {
        role: "conditioner_rinse_out",
        status: "verified_complete",
        fingerprint: `protocol-${productId}`,
      },
    ],
    factFingerprint: `facts-${productId}`,
    catalogSortOrder: sortOrder,
    priceEur: 9.95,
    purchaseLinkStatus: "available",
    spec: {
      thickness: "normal",
      proteinMoistureBalance: "moisture",
      weight,
      repairSupportLevel: "medium",
      balanceDirection: "moisture",
      targetFit: "matched",
    },
  }
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
        productId: `owned-${index}`,
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

function benchmarkPersistence(draft: Stage3ProductDraft): Stage3ProductionPersistence {
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
    loadAuthorityFacts: async (input) => {
      await delay()
      const product = draft.products.find(
        (candidate) => candidate.capturedProductId === input.subject.capturedProductId,
      )
      const ownedProductId =
        product?.identity.kind === "catalog_product" ? product.identity.productId : "owned-missing"
      return {
        productFacts: conditionerFacts(ownedProductId, 0, "rich"),
        recommendationCandidates: Array.from(
          { length: STAGE3_AUTHORITY_CANDIDATE_QUERY_LIMIT },
          (_, index) =>
            conditionerFacts(
              `alternative-${input.subject.capturedProductId}-${index}`,
              index + 1,
              "light",
            ),
        ),
        heatCarrierCoverage: { carrierCategory: null, verifiedRoutes: [] },
      }
    },
    loadDraft: async () => draft,
  }
}

async function sample() {
  const draft = benchmarkDraft()
  const gateway = createProductionStage3ProductsGateway({
    userId: draft.userId,
    persistence: benchmarkPersistence(draft),
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
    fitComparisons: reviewBundles.map((bundle) => bundle.fitComparison),
  }
  return {
    durationMs: performance.now() - startedAt,
    responseBytes: Buffer.byteLength(JSON.stringify(payload), "utf8"),
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
  const result = {
    assumptions: {
      reviewCount,
      normalizedCandidateFactsPerReview: STAGE3_AUTHORITY_CANDIDATE_QUERY_LIMIT,
      modeledPersistenceBoundaryLatencyMs: authorityLatencyMs,
      iterations,
      note: "Measures the production gateway load plus reviewDecisionBundles path and serializes the complete Stage 3 GET-shaped response.",
    },
    warmP95Ms,
    responseBytes,
    limits: { warmP95Ms: MAX_WARM_P95_MS, responseBytes: MAX_RESPONSE_BYTES },
  }
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  if (warmP95Ms > MAX_WARM_P95_MS) throw new Error("stage3_review_readiness_p95_exceeded")
  if (responseBytes > MAX_RESPONSE_BYTES) throw new Error("stage3_review_response_too_large")
}

void main()
