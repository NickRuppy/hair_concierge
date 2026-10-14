import assert from "node:assert/strict"
import test from "node:test"

import { loadDiscoveryCockpitModel } from "../src/lib/discovery/cockpit"
import {
  discoveryScanVerdictLoader,
  loadParticipantScanVerdicts,
  type DiscoveryVerdictDeps,
} from "../src/lib/discovery/load-participant-verdicts"
import type { DiscoveryIntakeItem } from "../src/lib/discovery/refined-routine"
import {
  loadScanVerdictForProduct,
  type LoadScanVerdictDeps,
} from "../src/lib/scan/load-scan-verdict"
import type { ScanEvaluationContext } from "../src/lib/scan/profile-context"
import { buildScanVerdict } from "../src/lib/scan/resolve-verdict"
import { DRY, DRY_CATALOG, s2Input } from "./personal-plan/products/fixtures/s2-catalog-2026-10-09"

/**
 * F2 (Codex review of S2a): the discovery cockpit grades with the participant's own
 * user-answered root colour, exactly like her scanner — loaded once, threaded to the previews,
 * the participant verdicts and the recommendation rows.
 */

const USER = "20000000-0000-4000-8000-000000000002"
const INTAKE = "40000000-0000-4000-8000-000000000001"
const decision = s2Input({
  category: "dry_shampoo",
  role: "root_refresh_bridge",
  candidates: DRY_CATALOG,
}).categoryDecision

const context = {
  snapshot: {
    inputHash: "input-s2",
    coverage: [],
    decisions: [decision],
    profile: {
      hair: { texture: "straight", thickness: "normal" },
      scalp: { oiliness: "oily", concerns: [] },
      goals: [],
      concerns: [],
    },
  },
  snapshotSource: "refined",
  refinedVersionId: "refined-s2",
  refinedInputHash: "input-s2",
} as unknown as ScanEvaluationContext

const scanDeps: LoadScanVerdictDeps = {
  loadScanProductFacts: (async (_client: unknown, _category: unknown, productId: string) =>
    DRY_CATALOG.find((facts) => facts.productId === productId) ?? null) as never,
  loadRecommendationCandidates: (async (_client: unknown, input: { roles: string[] }) =>
    Object.fromEntries(input.roles.map((role) => [role, DRY_CATALOG]))) as never,
  buildScanVerdict,
}

const ownedBruenett: DiscoveryIntakeItem = {
  id: "50000000-0000-4000-8000-000000000001",
  category: "dry_shampoo",
  source: "catalog_search",
  brandText: "Batiste",
  productNameText: "Brünett",
  barcodeIdentifier: null,
  productId: DRY.batisteBruenett.productId,
  productSubmissionId: null,
  createdAt: "2026-10-11T10:00:00.000Z",
}

function verdictDeps(): DiscoveryVerdictDeps {
  return {
    loadActiveProductById: async (_client, id) => ({ id, category: "dry_shampoo" }),
    loadPresentationRows: async (_client, productIds) =>
      productIds.map((id) => ({
        id,
        name: "Trockenshampoo",
        brand: "Batiste",
        category: "dry_shampoo",
        imageUrl: null,
        priceEur: null,
        currency: null,
        affiliateLink: null,
        purchaseLinkStatus: null,
        priceCheckedAt: null,
      })),
    isProductSearchQuarantined: async () => false,
    loadQuarantinedProductIdsAmong: async () => new Set<string>(),
    loadScanVerdict: discoveryScanVerdictLoader(scanDeps),
  }
}

test("brown roots: the cockpit verdict for Batiste Brünett equals the scanner verdict (ideal)", async () => {
  const scanner = await loadScanVerdictForProduct(
    {} as never,
    scanDeps,
    "dry_shampoo",
    DRY.batisteBruenett.productId,
    decision,
    context,
    undefined,
    null,
    "brown",
  )
  const [cockpit] = await loadParticipantScanVerdicts(
    {} as never,
    USER,
    [ownedBruenett],
    context,
    verdictDeps(),
    null,
    "brown",
  )
  assert.equal(scanner.kind, "in_catalog")
  assert.equal(cockpit?.status, "verdict")
  if (scanner.kind !== "in_catalog" || cockpit?.status !== "verdict") return
  assert.equal(scanner.verdict, "ideal")
  assert.equal(
    cockpit.payload.kind === "in_catalog" ? cockpit.payload.verdict : null,
    scanner.verdict,
  )
})

test("the cockpit reads the colour once and threads it to previews, verdicts and recommendation rows", async () => {
  const idealOptions: unknown[] = []
  const verdictColours: unknown[] = []
  const rowColours: unknown[] = []
  let colourReads = 0
  const result = await loadDiscoveryCockpitModel(
    {} as never,
    { intakeId: INTAKE, userId: USER },
    {
      loadVisibleHairColor: async (_client, userId) => {
        assert.equal(userId, USER)
        colourReads += 1
        return "brown"
      },
      loadShoppingBudget: async () => null,
      loadIdealRoutine: (async (_a: unknown, _u: unknown, _i: unknown, options: unknown) => {
        idealOptions.push(options)
        return {
          status: "ready" as const,
          steps: [],
          context,
          previewSource: { personalPlanId: `discovery:${INTAKE}`, sourceNeedVersionId: "v1" },
        }
      }) as never,
      loadHeatStyling: async () => null,
      loadItems: async () => [],
      loadVerdicts: (async (...args: unknown[]) => {
        verdictColours.push(args[6])
        return []
      }) as never,
      loadRecommendationRows: (async (...args: unknown[]) => {
        rowColours.push(args[4])
        return new Map()
      }) as never,
      loadDecisions: async () => [],
      loadSwapProducts: async () => [],
      loadProductIdentities: async () => new Map(),
    },
  )
  assert.equal(result.status, "ready")
  assert.equal(colourReads, 1)
  assert.deepEqual(idealOptions, [{ visibleHairColor: "brown" }])
  assert.deepEqual(verdictColours, ["brown"])
  assert.deepEqual(rowColours, ["brown"])
})
