import assert from "node:assert/strict"
import test from "node:test"

import type { SupabaseClient } from "@supabase/supabase-js"

import {
  buildDiscoveryCockpitView,
  loadDiscoveryCockpitModel,
  type DiscoveryCockpitDependencies,
  type DiscoveryCockpitModel,
} from "../src/lib/discovery/cockpit"
import type { DiscoveryIdealStep } from "../src/lib/discovery/load-ideal-routine"
import {
  discoveryRecommendationPropertyRows,
  loadDiscoveryRecommendationPropertyRows,
  type DiscoveryRecommendationRowStep,
} from "../src/lib/discovery/load-participant-verdicts"
import type { DiscoveryPropertyRow } from "../src/lib/discovery/property-rows"
import { composeDiscoveryRefinedRoutine } from "../src/lib/discovery/refined-routine"
import type { Stage3FitComparisonDimension } from "../src/lib/personal-plan/products/comparison-dimensions"
import type { ScanEvaluationContext } from "../src/lib/scan/profile-context"
import type { ScanInCatalogVerdictPayload, ScanVerdictPayload } from "../src/lib/scan/types"

/**
 * F1 (consult-iteration-2): the Idealplan's recommendation of a step („Neu dazu", or the
 * `ideal_recommendation` swap option) gets the same target-vs-product rows as a swap
 * alternative — computed by the scan engine for the recommended product, never invented.
 * Missing or non-matching data yields no rows, so the cockpit renders no table.
 */

const recommendedId = "33333333-3333-4333-8333-333333333333"
const decisionKey = "decision:shampoo:shampoo_everyday:gap"

const scalpDimension: Stage3FitComparisonDimension = {
  dimensionId: "shampoo.scalp_route",
  label: "Kopfhaut-Fokus",
  presentationKind: "set",
  stops: [
    { stopId: "oily", label: "fettig" },
    { stopId: "dry", label: "trocken" },
  ],
  targetPosition: { kind: "supported_stops", stopIds: ["oily"] },
  productPositions: [
    { productId: recommendedId, position: { kind: "supported_stops", stopIds: ["oily"] } },
  ],
  reason: "",
}

function verdict(
  overrides: Partial<ScanInCatalogVerdictPayload> = {},
): ScanInCatalogVerdictPayload {
  return {
    kind: "in_catalog",
    verdict: "ideal",
    verdictLabel: "Passt",
    verdictTitle: "Passt zu deinem Haar",
    status: "ok",
    subtitle: "1 von 1 Zielbereichen getroffen",
    evaluatedRole: "shampoo_everyday",
    evaluatedRoleLabel: "Hauptreinigung",
    dimensions: [],
    criteria: [],
    coverage: { matches: 1, total: 1 },
    fitNarrative: null,
    alternatives: [],
    mobileDimensions: [scalpDimension],
    ...overrides,
  }
}

const EXPECTED_ROWS: DiscoveryPropertyRow[] = [
  {
    dimensionId: "shampoo.scalp_route",
    label: "Kopfhaut",
    status: "match",
    state: "in_target",
    productValue: "fettig",
    targetValue: "fettig",
  },
]

function recommendation(productId = recommendedId): DiscoveryIdealStep["preview"] {
  return {
    kind: "recommendation",
    category: "shampoo",
    role: "shampoo_everyday",
    decisionKey,
    productId,
    productName: "Lab Shampoo Ideal",
    imageUrl: "https://catalog.example/ideal.jpg",
    verdict: "ideal",
    authorityVersion: "v1",
    factFingerprint: "fp",
    commerce: {
      priceEur: null,
      purchaseLinkStatus: null,
      netContentValue: null,
      netContentUnit: null,
      priceLabel: null,
      netContentLabel: null,
      availabilityLabel: null,
      productUrl: null,
      affiliateDisclosure: null,
    },
    reasoning: { productCriteria: "Leicht.", fit: "Passt.", frequency: "3×" },
  }
}

function step(overrides: Partial<DiscoveryIdealStep> = {}): DiscoveryIdealStep {
  return {
    decisionKey,
    category: "shampoo",
    role: "shampoo_everyday",
    section: "basis",
    categoryLabel: "Shampoo",
    roleLabel: "Hauptreinigung",
    roleDescription: "Regelmäßige Reinigung für deine Kopfhaut.",
    frequencyLabel: "3× / Woche",
    preview: recommendation(),
    ...overrides,
  }
}

const shampooDecision = { category: "shampoo" }
const context = {
  snapshot: { decisions: [shampooDecision] },
} as unknown as ScanEvaluationContext

// --- the pure builder ----------------------------------------------------------------

test("F1: an evaluable recommendation yields its rows against her target", () => {
  assert.deepEqual(
    discoveryRecommendationPropertyRows("shampoo", "shampoo_everyday", recommendedId, verdict()),
    EXPECTED_ROWS,
  )
})

test("F1: no rows when the engine could not evaluate the recommendation for this role", () => {
  // Evaluated for another role: its dimensions describe a different target.
  assert.equal(
    discoveryRecommendationPropertyRows(
      "shampoo",
      "shampoo_everyday",
      recommendedId,
      verdict({ evaluatedRole: "shampoo_dandruff" }),
    ),
    null,
  )
  // Nothing evaluable (unclear payload): no role, no dimensions, no criteria.
  assert.equal(
    discoveryRecommendationPropertyRows(
      "shampoo",
      "shampoo_everyday",
      recommendedId,
      verdict({ evaluatedRole: null, mobileDimensions: undefined, criteria: [] }),
    ),
    null,
  )
  // A not-needed payload has no target at all.
  const notNeeded = {
    kind: "not_needed",
    mode: "not_needed",
    status: "neutral",
    headline: "",
    subtitle: "",
    reasons: [],
    dimensions: [],
    coveredBy: [],
  } as ScanVerdictPayload
  assert.equal(
    discoveryRecommendationPropertyRows("shampoo", "shampoo_everyday", recommendedId, notNeeded),
    null,
  )
})

// --- the loader ----------------------------------------------------------------------

test("F1 loader: one scan verdict per recommendation, on the Idealplan's context", async () => {
  const calls: unknown[][] = []
  const rows = await loadDiscoveryRecommendationPropertyRows(
    {} as SupabaseClient,
    [step()],
    context,
    {
      loadScanVerdict: async (...args) => {
        calls.push(args.slice(1))
        return verdict()
      },
    },
  )
  assert.deepEqual([...rows.entries()], [[decisionKey, EXPECTED_ROWS]])
  assert.deepEqual(calls, [["shampoo", recommendedId, shampooDecision, context]])
})

test("F1 loader: missing data means no entry — never a fabricated row", async () => {
  const warn = console.warn
  console.warn = () => {}
  try {
    const steps: DiscoveryRecommendationRowStep[] = [
      // A fallback card: no product to evaluate.
      step({
        decisionKey: "decision:mask:intensive_conditioning_mask:gap",
        category: "mask",
        role: "intensive_conditioning_mask",
        preview: {
          kind: "fallback",
          category: "mask",
          role: "intensive_conditioning_mask",
          decisionKey: "decision:mask:intensive_conditioning_mask:gap",
          authorityVersion: "v1",
          fallback: "post_refinement",
        },
      }),
      // No preview at all.
      step({ decisionKey: "decision:oil:dry_finish:gap", category: "oil", preview: null }),
      // A category the snapshot has no decision for.
      step({ decisionKey: "decision:leave_in:post_wash_leave_in:gap", category: "leave_in" }),
      // The engine throws.
      step({ decisionKey: "decision:shampoo:throws", preview: recommendation("throws") }),
      // The engine answers for another role.
      step({ decisionKey: "decision:shampoo:other-role", preview: recommendation("other-role") }),
    ]
    const asked: string[] = []
    const rows = await loadDiscoveryRecommendationPropertyRows(
      {} as SupabaseClient,
      steps,
      context,
      {
        loadScanVerdict: async (_client, _category, productId) => {
          asked.push(productId)
          if (productId === "throws") throw new Error("catalog down")
          return verdict({ evaluatedRole: "shampoo_dandruff" })
        },
      },
    )
    assert.equal(rows.size, 0)
    // Only the two shampoo recommendations with a decision reached the engine.
    assert.deepEqual(asked.sort(), ["other-role", "throws"])
  } finally {
    console.warn = warn
  }
})

// --- the view ------------------------------------------------------------------------

function model(rows?: ReadonlyMap<string, DiscoveryPropertyRow[]>): DiscoveryCockpitModel {
  const steps = [step()]
  return {
    status: "ready",
    steps,
    verdicts: [],
    previewSource: { personalPlanId: "discovery:intake", sourceNeedVersionId: "v1" },
    routine: composeDiscoveryRefinedRoutine({ steps, items: [], decisions: [], swapProducts: [] }),
    recommendationProducts: [],
    recommendationBrandsAvailable: true,
    ...(rows ? { recommendationPropertyRows: rows } : {}),
  }
}

test("F1 view: the „Neu dazu“ recommendation carries its rows; without them, none", () => {
  const withRows = buildDiscoveryCockpitView(model(new Map([[decisionKey, EXPECTED_ROWS]])))
  assert.deepEqual(withRows.steps[0].idealRecommendation?.propertyRows, EXPECTED_ROWS)
  assert.deepEqual(
    withRows.steps[0].swapOptions.map((option) => [option.origin, option.propertyRows]),
    [["ideal_recommendation", EXPECTED_ROWS]],
  )

  const without = buildDiscoveryCockpitView(model())
  assert.equal(without.steps[0].idealRecommendation?.propertyRows, null)
  assert.equal(without.steps[0].swapOptions[0].propertyRows, null)
})

// --- the model: only where the recommendation is shown -------------------------------

test("F1 model: rows are requested only for steps that show the recommendation", async () => {
  const empty = step()
  const ownedWithAlternatives = step({
    decisionKey: "decision:conditioner:conditioner_rinse_out:gap",
    category: "conditioner",
    role: "conditioner_rinse_out",
    preview: recommendation("rec-conditioner"),
  })
  const requested: string[][] = []
  const deps: Partial<DiscoveryCockpitDependencies> = {
    loadItems: async () => [
      {
        id: "item-1",
        category: "conditioner",
        source: "catalog_search",
        brandText: "Balea",
        productNameText: "Spülung",
        barcodeIdentifier: null,
        productId: "owned-conditioner",
        productSubmissionId: null,
        createdAt: "2026-09-20T10:00:00.000Z",
      },
    ],
    loadHeatStyling: async () => null,
    loadIdealRoutine: async () => ({
      status: "ready",
      steps: [empty, ownedWithAlternatives],
      context,
      previewSource: { personalPlanId: "discovery:intake", sourceNeedVersionId: "v1" },
    }),
    loadResearchState: async () => ({ submissions: new Map(), products: new Map() }) as never,
    loadVerdicts: async () => [
      {
        itemId: "item-1",
        productId: "owned-conditioner",
        status: "verdict",
        product: {
          productId: "owned-conditioner",
          name: "Spülung",
          brand: "Balea",
          category: "conditioner",
          categoryLabel: "Conditioner",
          imageUrl: null,
          priceLabel: null,
          purchaseUrl: null,
        },
        payload: {
          ...verdict({ evaluatedRole: "conditioner_rinse_out" }),
          mobileDimensions: undefined,
          alternatives: [
            {
              productId: "alt-conditioner",
              displayName: "Alternative",
              imageUrl: null,
              priceLabel: null,
              netContentLabel: null,
              verdict: "ideal",
              verdictLabel: "Passt",
              brand: null,
              purchaseUrl: null,
            },
          ],
        } as never,
      },
    ],
    loadDecisions: async () => [],
    loadSwapProducts: async () => [],
    loadProductIdentities: async () => new Map(),
    loadApplication: async () => {
      throw new Error("not under test")
    },
    loadRecommendationRows: async (_admin, steps) => {
      requested.push(steps.map((entry) => entry.decisionKey))
      return new Map([[decisionKey, EXPECTED_ROWS]])
    },
  }
  const errors = console.error
  console.error = () => {}
  try {
    const result = await loadDiscoveryCockpitModel(
      {} as SupabaseClient,
      { intakeId: "intake", userId: "user" },
      deps,
    )
    assert.equal(result.status, "ready")
    if (result.status !== "ready") return
    // Her conditioner has displayed alternatives: its recommendation is never shown.
    assert.deepEqual(requested, [[decisionKey]])
    assert.deepEqual(result.recommendationPropertyRows?.get(decisionKey), EXPECTED_ROWS)
  } finally {
    console.error = errors
  }
})
