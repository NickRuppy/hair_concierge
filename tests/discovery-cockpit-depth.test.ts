import assert from "node:assert/strict"
import test from "node:test"

import type { SupabaseClient } from "@supabase/supabase-js"

import { discoveryPropertyRows } from "../src/lib/discovery/property-rows"
import { buildDiscoveryIdealSteps } from "../src/lib/discovery/load-ideal-routine"
import { loadParticipantScanVerdicts } from "../src/lib/discovery/load-participant-verdicts"
import {
  composeDiscoveryRefinedRoutine,
  type DiscoveryIntakeItem,
} from "../src/lib/discovery/refined-routine"
import type { MobileScanRow } from "../src/lib/mobile/scan-contracts"
import { computeNeedPlan } from "../src/lib/personal-plan/compute-stage1"
import { presentationFor } from "../src/lib/personal-plan/decision-presentation"
import type { Stage3FitComparisonDimension } from "../src/lib/personal-plan/products/comparison-dimensions"
import { routineRoleTimingLabel } from "../src/lib/personal-plan/routine/labels"
import type { PlanCategoryDecision } from "../src/lib/personal-plan/types"
import type { ScanEvaluationContext } from "../src/lib/scan/profile-context"
import type { ScanInCatalogVerdictPayload } from "../src/lib/scan/types"
import { COMPLETE_V3_PLAN_ENVELOPE } from "./personal-plan/fixtures"

/**
 * Batch 4 depth for the call: every routine step explains itself (D) and every product the
 * cockpit shows — hers and each alternative — carries target-vs-product rows like the iOS
 * result card (E). Both are presentation only: neither may move the finalised fingerprint.
 */

function readySnapshot() {
  const computed = computeNeedPlan({
    rawEnvelope: COMPLETE_V3_PLAN_ENVELOPE,
    artifactId: "11111111-1111-4111-8111-111111111111",
    projection: "initial_quiz",
    computationVersion: "stage1-v1",
    createdAt: "2026-09-22T10:00:00.000Z",
  })
  if (computed.status !== "ready") throw new Error("expected a ready snapshot")
  return computed.snapshot
}

// --- D: step depth ------------------------------------------------------------

test("each ideal step carries why, product type, criteria, fit and timing from the pure helpers", () => {
  const snapshot = readySnapshot()
  const steps = buildDiscoveryIdealSteps(snapshot, [])
  assert.ok(steps.length > 0)
  for (const step of steps) {
    const decision = snapshot.decisions.find((entry) => entry.category === step.category)!
    const presentation = presentationFor(decision)
    assert.ok(step.depth, step.decisionKey)
    assert.equal(step.depth.targetType, presentation?.targetType ?? null)
    assert.equal(step.depth.productCriteria, presentation?.productCriteria ?? null)
    assert.equal(step.depth.fit, presentation?.fit ?? null)
    assert.equal(step.depth.timingLabel, routineRoleTimingLabel(step.role))
    assert.ok(step.depth.purpose, `${step.decisionKey} has a purpose`)
  }
  // The shampoo step, spelled out: its timing is the Routine card's own word.
  const shampoo = steps.find((step) => step.category === "shampoo")
  if (shampoo) assert.equal(shampoo.depth?.timingLabel, "Haarwäsche")
})

test("a malformed decision target degrades the depth to nothing instead of failing the call", () => {
  const decision = {
    category: "oil",
    resolution: "resolved",
    needTier: "basis",
    roles: ["dry_finish"],
    // No `roles` on the target: `presentationFor` would throw reading it.
    target: { category: "oil" },
    frequency: null,
    reasons: [],
    executionState: "available",
    executionPauseReason: null,
    deferredFacts: [],
  } as unknown as PlanCategoryDecision
  const snapshot = { ...readySnapshot(), decisions: [decision], renderedOrder: ["oil"] as never }
  const [step] = buildDiscoveryIdealSteps(snapshot, [])
  assert.equal(step!.depth?.targetType, null)
  assert.equal(step!.depth?.fit, null)
  assert.equal(step!.depth?.timingLabel, "Im trockenen Haar")
})

test("the step depth never enters the finalised fingerprint", () => {
  const steps = buildDiscoveryIdealSteps(readySnapshot(), [])
  const item: DiscoveryIntakeItem = {
    id: "item-1",
    category: steps[0]!.category,
    source: "catalog_search",
    brandText: "Marke",
    productNameText: "Produkt",
    barcodeIdentifier: null,
    productId: "product-1",
    productSubmissionId: null,
    createdAt: "2026-09-20T10:00:00.000Z",
  }
  const compose = (input: typeof steps) =>
    composeDiscoveryRefinedRoutine({ steps: input, items: [item], decisions: [], swapProducts: [] })
  const withDepth = compose(steps)
  const withoutDepth = compose(steps.map((step) => ({ ...step, depth: undefined })))
  assert.equal(withDepth.sourceHash, withoutDepth.sourceHash)
  // …and a real change still moves it.
  const changed = compose(
    steps.map((step, index) => (index === 0 ? { ...step, roleLabel: "X" } : step)),
  )
  assert.notEqual(withDepth.sourceHash, changed.sourceHash)
})

// --- E: property rows ---------------------------------------------------------

function row(overrides: Partial<MobileScanRow>): MobileScanRow {
  return {
    dimensionId: "shampoo.scalp_route",
    label: "Kopfhaut",
    axisKind: "set",
    definition: "d",
    categoryFit: null,
    targetValue: "fettig",
    productValue: "trocken",
    targetStopIds: ["oily"],
    productStopIds: ["dry"],
    state: "outside_target",
    displayStatus: "red",
    stops: [
      { id: "oily", label: "fettig", meaning: "m" },
      { id: "dry", label: "trocken", meaning: "m" },
    ],
    ...overrides,
  }
}

test("mobile rows keep label, product value and target value apart (iOS comparison table)", () => {
  assert.deepEqual(
    discoveryPropertyRows([
      row({}),
      row({
        dimensionId: "conditioner.weight",
        label: "Pflegegewicht",
        targetValue: "leicht",
        productValue: "mittel",
        targetStopIds: ["light"],
        productStopIds: ["medium"],
        displayStatus: "amber",
        stops: [
          { id: "light", label: "leicht", meaning: "m" },
          { id: "medium", label: "mittel", meaning: "m" },
        ],
      }),
      row({
        productValue: "fettig",
        productStopIds: ["oily"],
        state: "in_target",
        displayStatus: "green",
      }),
      row({
        productValue: null,
        productStopIds: [],
        state: "unknown",
        displayStatus: "neutral",
      }),
      row({ targetValue: null, targetStopIds: [], state: "no_target", displayStatus: "neutral" }),
    ]),
    [
      {
        dimensionId: "shampoo.scalp_route",
        label: "Kopfhaut",
        status: "mismatch",
        state: "outside_target",
        productValue: "trocken",
        targetValue: "fettig",
      },
      {
        dimensionId: "conditioner.weight",
        label: "Pflegegewicht",
        status: "partial",
        state: "outside_target",
        productValue: "mittel",
        targetValue: "leicht",
      },
      {
        dimensionId: "shampoo.scalp_route",
        label: "Kopfhaut",
        status: "match",
        state: "in_target",
        productValue: "fettig",
        targetValue: "fettig",
      },
      {
        dimensionId: "shampoo.scalp_route",
        label: "Kopfhaut",
        status: "unknown",
        state: "unknown",
        productValue: null,
        targetValue: "fettig",
      },
      {
        dimensionId: "shampoo.scalp_route",
        label: "Kopfhaut",
        status: "unknown",
        state: "no_target",
        productValue: "trocken",
        targetValue: null,
      },
    ],
  )
})

const productId = "33333333-3333-4333-8333-333333333333"
const alternativeId = "44444444-4444-4444-8444-444444444444"

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
    { productId, position: { kind: "supported_stops", stopIds: ["dry"] } },
    { productId: alternativeId, position: { kind: "supported_stops", stopIds: ["oily"] } },
  ],
  reason: "",
}

const verdict: ScanInCatalogVerdictPayload = {
  kind: "in_catalog",
  verdict: "mismatch",
  verdictLabel: "Passt nicht",
  verdictTitle: "Passt nicht zu deiner Kopfhaut",
  status: "danger",
  subtitle: "0 von 1 Zielbereichen getroffen",
  evaluatedRole: "shampoo_everyday",
  evaluatedRoleLabel: "Hauptreinigung",
  dimensions: [],
  criteria: [],
  coverage: { matches: 0, total: 1 },
  fitNarrative: null,
  alternatives: [
    {
      productId: alternativeId,
      displayName: "Sanftes Shampoo",
      imageUrl: null,
      priceLabel: null,
      netContentLabel: null,
      verdict: "ideal",
      verdictLabel: "Passt",
      criteria: [],
    },
  ],
  mobileDimensions: [scalpDimension],
}

const context = {
  snapshot: {
    decisions: [{ category: "shampoo" }],
  },
} as unknown as ScanEvaluationContext

function presentationRow(id: string) {
  return {
    id,
    name: `Produkt ${id}`,
    brand: "Marke",
    category: "shampoo" as never,
    imageUrl: null,
    priceEur: null,
    currency: null,
    affiliateLink: null,
    purchaseLinkStatus: null,
    priceCheckedAt: null,
  }
}

test("the verdict loader carries property rows for her product and every displayed alternative", async () => {
  const [entry] = await loadParticipantScanVerdicts(
    {} as SupabaseClient,
    "user-1",
    [
      {
        id: "item-1",
        category: "shampoo",
        source: "barcode",
        brandText: null,
        productNameText: null,
        barcodeIdentifier: null,
        productId,
        productSubmissionId: null,
        createdAt: "2026-09-20T10:00:00.000Z",
      },
    ],
    context,
    {
      loadActiveProductById: async (_client, id) => ({ id, category: "shampoo" }) as never,
      loadPresentationRows: async (_client, ids) => ids.map(presentationRow),
      isProductSearchQuarantined: async () => false,
      loadQuarantinedProductIdsAmong: async () => new Set<string>(),
      loadScanVerdict: async () => verdict,
    },
  )
  assert.equal(entry?.status, "verdict")
  if (entry?.status !== "verdict") return
  assert.deepEqual(
    entry.propertyRows?.product.map((entry) => [
      entry.status,
      entry.productValue,
      entry.targetValue,
    ]),
    [["mismatch", "trocken", "fettig"]],
  )
  assert.deepEqual(entry.propertyRows?.alternatives, [
    {
      productId: alternativeId,
      rows: [
        {
          dimensionId: "shampoo.scalp_route",
          label: "Kopfhaut",
          status: "match",
          state: "in_target",
          productValue: "fettig",
          targetValue: "fettig",
        },
      ],
    },
  ])
  // The web payload the shared scan sheet renders stays the stripped web shape.
  assert.ok(!("mobileDimensions" in entry.payload))
})
