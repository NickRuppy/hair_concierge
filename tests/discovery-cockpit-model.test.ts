import assert from "node:assert/strict"
import test from "node:test"

import {
  buildDiscoveryCockpitView,
  describeDiscoveryIntakeItem,
  discoveryCockpitSwapOptionIds,
  discoveryOwnedProductIdentities,
  finalizeDiscoveryCall,
  loadDiscoveryCockpitModel,
  unfinalizeDiscoveryCall,
  upsertDiscoveryCallDecision,
  type DiscoveryCockpitModel,
} from "../src/lib/discovery/cockpit"
import type { DiscoveryIdealStep } from "../src/lib/discovery/load-ideal-routine"
import type { DiscoveryParticipantVerdict } from "../src/lib/discovery/load-participant-verdicts"
import {
  composeDiscoveryRefinedRoutine,
  type DiscoveryCallDecision,
  type DiscoveryIntakeItem,
} from "../src/lib/discovery/refined-routine"
import type { ScanCatalogPresentationRow } from "../src/lib/scan/product-presentation"
import type { ScanEvaluationContext } from "../src/lib/scan/profile-context"
import type { ScanPresentedVerdictPayload, ScanProductHeader } from "../src/lib/scan/types"

/**
 * The cockpit's own read model: what the screen offers as a swap, what it calls a product
 * it cannot name, and the two writes the call performs.
 *
 * The view is the contract between the page and the decisions route — the route accepts a
 * swap only if the view listed that product for that step — so the rule is tested here
 * once, not twice.
 */

const ids = {
  intake: "40000000-0000-4000-8000-000000000001",
  user: "20000000-0000-4000-8000-000000000002",
  owned: "30000000-0000-4000-8000-000000000003",
  alternativeA: "30000000-0000-4000-8000-00000000000a",
  alternativeB: "30000000-0000-4000-8000-00000000000b",
  ideal: "30000000-0000-4000-8000-00000000000c",
  item: "50000000-0000-4000-8000-000000000005",
  itemTwo: "50000000-0000-4000-8000-000000000006",
}

function step(overrides: Partial<DiscoveryIdealStep> = {}): DiscoveryIdealStep {
  return {
    decisionKey: "decision:shampoo:shampoo_everyday:gap",
    category: "shampoo",
    role: "shampoo_everyday",
    section: "basis",
    categoryLabel: "Shampoo",
    roleLabel: "Hauptreinigung",
    roleDescription: "Kopfhaut waschen",
    frequencyLabel: "3× / Woche",
    preview: null,
    ...overrides,
  }
}

function idealPreview(productId: string): DiscoveryIdealStep["preview"] {
  return {
    kind: "recommendation",
    category: "shampoo",
    role: "shampoo_everyday",
    decisionKey: "decision:shampoo:shampoo_everyday:gap",
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

function item(overrides: Partial<DiscoveryIntakeItem> = {}): DiscoveryIntakeItem {
  return {
    id: ids.item,
    category: "shampoo",
    source: "catalog_search",
    brandText: "Elvital",
    productNameText: "Hyaluron Pure",
    barcodeIdentifier: null,
    productId: ids.owned,
    productSubmissionId: null,
    createdAt: "2026-09-20T10:00:00.000Z",
    ...overrides,
  }
}

const productHeader: ScanProductHeader = {
  productId: ids.owned,
  name: "Elvital Hyaluron Pure Shampoo",
  brand: "L'Oréal Paris",
  category: "shampoo",
  categoryLabel: "Shampoo",
  imageUrl: null,
  priceLabel: null,
  purchaseUrl: null,
}

function payload(alternatives: string[]): ScanPresentedVerdictPayload {
  return {
    kind: "in_catalog",
    verdict: "supportive",
    verdictLabel: "Passt mit Einschränkung",
    verdictTitle: "Passt mit Einschränkung zu deinem Haar",
    status: "pending",
    subtitle: "2 von 3 Zielbereichen getroffen",
    evaluatedRole: "shampoo_everyday",
    evaluatedRoleLabel: "Hauptreinigung",
    dimensions: [],
    criteria: [],
    coverage: null,
    fitNarrative: null,
    alternatives: alternatives.map((productId, index) => ({
      productId,
      displayName: `Alternative ${index + 1}`,
      imageUrl: null,
      priceLabel: null,
      netContentLabel: null,
      verdict: "ideal",
      verdictLabel: "Passt",
      brand: "Guhl",
      purchaseUrl: null,
    })),
  }
}

function model(input: {
  steps: DiscoveryIdealStep[]
  items: DiscoveryIntakeItem[]
  decisions?: DiscoveryCallDecision[]
  verdicts?: DiscoveryParticipantVerdict[]
  catalogRows?: ScanCatalogPresentationRow[]
}): DiscoveryCockpitModel {
  return {
    status: "ready",
    steps: input.steps,
    verdicts: input.verdicts ?? [],
    previewSource: { personalPlanId: `discovery:${ids.intake}`, sourceNeedVersionId: "v1" },
    routine: composeDiscoveryRefinedRoutine({
      steps: input.steps,
      items: input.items,
      decisions: input.decisions ?? [],
      swapProducts: input.catalogRows ?? [],
      recommendationProducts: input.catalogRows ?? [],
      ownedProducts: discoveryOwnedProductIdentities(input.verdicts ?? []),
    }),
    recommendationProducts: input.catalogRows ?? [],
    recommendationBrandsAvailable: true,
  }
}

function catalogRow(id: string, brand: string | null, name: string): ScanCatalogPresentationRow {
  return {
    id,
    name,
    brand,
    category: "shampoo",
    imageUrl: null,
    priceEur: null,
    currency: null,
    affiliateLink: null,
    purchaseLinkStatus: null,
    priceCheckedAt: null,
  }
}

// --- swap options -------------------------------------------------------------

test("a bound product offers exactly the alternatives the engine displayed", () => {
  const view = buildDiscoveryCockpitView(
    model({
      steps: [step()],
      items: [item()],
      verdicts: [
        {
          itemId: ids.item,
          productId: ids.owned,
          status: "verdict",
          product: productHeader,
          payload: payload([ids.alternativeA, ids.alternativeB]),
        },
      ],
    }),
  )

  assert.equal(view.steps.length, 1)
  assert.deepEqual(
    view.steps[0].swapOptions.map((option) => option.productId),
    [ids.alternativeA, ids.alternativeB],
  )
  assert.deepEqual(
    view.steps[0].swapOptions.map((option) => option.origin),
    ["alternative", "alternative"],
  )
  // The route's allow-list is derived from the very options the page renders.
  assert.deepEqual(discoveryCockpitSwapOptionIds(view, view.steps[0].decisionKey), [
    ids.alternativeA,
    ids.alternativeB,
  ])
  // Named with its catalog brand — the catalog `name` alone is often brandless.
  assert.equal(view.steps[0].ownedLabel, "L'Oréal Paris Elvital Hyaluron Pure Shampoo")
  assert.equal(view.steps[0].outcome, "undecided")
})

test("an empty step offers the Idealplan's own recommendation instead", () => {
  const view = buildDiscoveryCockpitView(
    model({ steps: [step({ preview: idealPreview(ids.ideal) })], items: [] }),
  )
  assert.deepEqual(
    view.steps[0].swapOptions.map((option) => [option.productId, option.origin]),
    [[ids.ideal, "ideal_recommendation"]],
  )
  assert.equal(view.steps[0].swapOptions[0].verdictLabel, "Passt")
  assert.equal(view.steps[0].ownedLabel, null)
  assert.equal(view.steps[0].intakeItemId, null)
  assert.equal(view.steps[0].outcome, "ideal")
})

test("a step whose verdict failed keeps the Idealplan pick, never the product itself", () => {
  const failed = buildDiscoveryCockpitView(
    model({
      steps: [step({ preview: idealPreview(ids.ideal) })],
      items: [item()],
      verdicts: [{ itemId: ids.item, productId: ids.owned, status: "product_unavailable" }],
    }),
  )
  assert.deepEqual(
    failed.steps[0].swapOptions.map((option) => option.productId),
    [ids.ideal],
  )
  assert.deepEqual(failed.steps[0].verdict, { status: "product_unavailable" })
  // Without a catalog row the cockpit falls back to what the participant typed.
  assert.equal(failed.steps[0].ownedLabel, "Elvital Hyaluron Pure")

  // And when the Idealplan recommends the product she already owns, that is no swap.
  const sameProduct = buildDiscoveryCockpitView(
    model({
      steps: [step({ preview: idealPreview(ids.owned) })],
      items: [item()],
      verdicts: [{ itemId: ids.item, productId: ids.owned, status: "unavailable" }],
    }),
  )
  assert.deepEqual(sameProduct.steps[0].swapOptions, [])
  assert.deepEqual(discoveryCockpitSwapOptionIds(sameProduct, sameProduct.steps[0].decisionKey), [])
})

test("an unknown decision key has no allow-list at all", () => {
  const view = buildDiscoveryCockpitView(model({ steps: [step()], items: [] }))
  assert.equal(discoveryCockpitSwapOptionIds(view, "decision:oil:dry_finish:gap"), null)
})

// --- naming and the collapsed blocks -------------------------------------------

test("a textless barcode row is named by its code, and research items stay named", () => {
  assert.equal(
    describeDiscoveryIntakeItem(
      item({
        source: "barcode_unknown",
        brandText: null,
        productNameText: null,
        barcodeIdentifier: "4005900123456",
        productId: null,
      }),
    ),
    "Gescanntes Produkt · 4005900123456",
  )
  assert.equal(
    describeDiscoveryIntakeItem(item({ brandText: null, productNameText: "Eigenmarke Spülung" })),
    "Eigenmarke Spülung",
  )
  assert.equal(
    describeDiscoveryIntakeItem(
      item({ brandText: "Afrolocke", productNameText: "Afrolocke Shea Butter Leave-in" }),
    ),
    "Afrolocke Shea Butter Leave-in",
  )

  const view = buildDiscoveryCockpitView(
    model({
      steps: [step()],
      items: [
        item(),
        item({
          id: ids.itemTwo,
          category: "mask",
          source: "barcode_unknown",
          brandText: null,
          productNameText: null,
          barcodeIdentifier: "4005900123456",
          productId: null,
        }),
        item({
          id: "50000000-0000-4000-8000-000000000007",
          category: "oil",
          source: "none",
          brandText: null,
          productNameText: null,
          productId: null,
        }),
      ],
    }),
  )
  assert.deepEqual(view.declinedCategories, ["oil"])
  assert.deepEqual(view.unassigned, [
    {
      itemId: ids.itemTwo,
      category: "mask",
      label: "Gescanntes Produkt · 4005900123456",
      reason: "research_pending",
    },
  ])
})

test("a decided step carries its swap target even when the catalog row is unreadable", () => {
  const view = buildDiscoveryCockpitView(
    model({
      steps: [step()],
      items: [item()],
      decisions: [
        {
          decisionKey: "decision:shampoo:shampoo_everyday:gap",
          decision: "swap",
          swapProductId: ids.alternativeA,
          intakeItemId: ids.item,
        },
      ],
      verdicts: [
        {
          itemId: ids.item,
          productId: ids.owned,
          status: "verdict",
          product: productHeader,
          payload: payload([ids.alternativeA]),
        },
      ],
    }),
  )
  assert.equal(view.steps[0].outcome, "swapped")
  assert.equal(view.steps[0].swapProductId, ids.alternativeA)
  assert.equal(view.steps[0].swapProductLabel, null)
  assert.equal(typeof view.sourceHash, "string")
  assert.ok(view.sourceHash.length > 0)
})

// --- brand on catalog names ----------------------------------------------------

// Catalog `name` is often brandless („Klärendes Serum", „Deep Cleansing Shampoo"); the
// brand lives in its own column. Every product the call and the PDF NAME must carry it.

test("the Idealplan's recommendation carries its catalog brand", () => {
  const view = buildDiscoveryCockpitView(
    model({
      steps: [step({ preview: idealPreview(ids.ideal) })],
      items: [],
      catalogRows: [catalogRow(ids.ideal, "Schwarzkopf", "Lab Shampoo Ideal")],
    }),
  )
  assert.equal(view.steps[0].idealRecommendation?.brand, "Schwarzkopf")
  assert.equal(view.steps[0].idealRecommendation?.name, "Lab Shampoo Ideal")
  assert.equal(view.steps[0].swapOptions[0]?.brand, "Schwarzkopf")
})

test("a swap target and a kept verdict product are named with their brand", () => {
  const view = buildDiscoveryCockpitView(
    model({
      steps: [step()],
      items: [item()],
      decisions: [
        {
          decisionKey: "decision:shampoo:shampoo_everyday:gap",
          decision: "swap",
          swapProductId: ids.alternativeA,
          intakeItemId: ids.item,
        },
      ],
      verdicts: [
        {
          itemId: ids.item,
          productId: ids.owned,
          status: "verdict",
          product: { ...productHeader, brand: "NEQI", name: "Deep Cleansing Shampoo" },
          payload: payload([ids.alternativeA]),
        },
      ],
      catalogRows: [catalogRow(ids.alternativeA, "Guhl", "Leichte Frische Shampoo")],
    }),
  )
  assert.equal(view.steps[0].swapProductLabel, "Guhl Leichte Frische Shampoo")
  assert.equal(view.steps[0].ownedLabel, "NEQI Deep Cleansing Shampoo")
})

const maskIdealStep = step({
  decisionKey: "decision:mask:intensive_conditioning_mask:gap",
  category: "mask",
  role: "intensive_conditioning_mask",
  categoryLabel: "Haarmaske",
  preview: idealPreview(ids.ideal),
})

const swapShampoo: DiscoveryCallDecision = {
  decisionKey: "decision:shampoo:shampoo_everyday:gap",
  decision: "swap",
  swapProductId: ids.alternativeA,
  intakeItemId: ids.item,
}

function readyIdeal(steps: DiscoveryIdealStep[]) {
  return async () => ({
    status: "ready" as const,
    steps,
    context: {} as never,
    previewSource: { personalPlanId: `discovery:${ids.intake}`, sourceNeedVersionId: "v1" },
  })
}

test("swap targets and PRINTED recommendations share one batched catalog read", async () => {
  const reads: string[][] = []
  const result = await loadDiscoveryCockpitModel(
    {} as never,
    { intakeId: ids.intake, userId: ids.user },
    {
      // The shampoo step is swapped, so its own recommendation is never printed and is not
      // read; the open mask step prints its recommendation, so that one is.
      loadIdealRoutine: readyIdeal([
        step({ preview: idealPreview("30000000-0000-4000-8000-0000000000ff") }),
        maskIdealStep,
      ]),
      loadItems: async () => [item()],
      loadVerdicts: async () => [],
      loadProductIdentities: async () => new Map(),
      loadDecisions: async () => [swapShampoo],
      loadSwapProducts: async (_client, productIds) => {
        reads.push(productIds)
        return [
          catalogRow(ids.alternativeA, "Guhl", "Leichte Frische Shampoo"),
          catalogRow(ids.ideal, "Schwarzkopf", "Lab Shampoo Ideal"),
        ]
      },
    },
  )
  assert.deepEqual(reads, [[ids.alternativeA, ids.ideal].sort()])
  assert.equal(result.status, "ready")
  if (result.status !== "ready") return
  assert.equal(result.recommendationBrandsAvailable, true)
  assert.deepEqual(
    result.recommendationProducts.map((row) => row.id),
    [ids.ideal],
  )
  assert.equal(result.routine.steps[0].swapProduct?.id, ids.alternativeA)
})

test("a recommendation that is not printed never blocks the call", async () => {
  // A kept step: its recommendation is not on the paper, so nothing is read at all.
  const result = await loadDiscoveryCockpitModel(
    {} as never,
    { intakeId: ids.intake, userId: ids.user },
    {
      loadIdealRoutine: readyIdeal([step({ preview: idealPreview(ids.ideal) })]),
      loadItems: async () => [item()],
      loadVerdicts: async () => [],
      loadProductIdentities: async () => new Map(),
      loadDecisions: async () => [{ ...swapShampoo, decision: "keep", swapProductId: null }],
      loadSwapProducts: async () => {
        throw new Error("an unprinted recommendation must not be read")
      },
    },
  )
  assert.equal(result.status, "ready")
  if (result.status !== "ready") return
  assert.equal(result.recommendationBrandsAvailable, true)
})

test("a printed recommendation missing from a successful read counts as unavailable", async () => {
  for (const decisions of [[], [swapShampoo]]) {
    const result = await loadDiscoveryCockpitModel(
      {} as never,
      { intakeId: ids.intake, userId: ids.user },
      {
        loadIdealRoutine: readyIdeal([step(), maskIdealStep]),
        loadItems: async () => [item()],
        loadVerdicts: async () => [],
        loadProductIdentities: async () => new Map(),
        loadDecisions: async () => decisions,
        // The swap row comes back; the recommendation's row does not.
        loadSwapProducts: async () => [
          catalogRow(ids.alternativeA, "Guhl", "Leichte Frische Shampoo"),
        ],
      },
    )
    assert.equal(result.status, "ready")
    if (result.status !== "ready") return
    assert.equal(result.recommendationBrandsAvailable, false)
  }
})

test("a failed brand lookup degrades a swap-free call instead of failing it", async () => {
  const deps = {
    loadIdealRoutine: async () => ({
      status: "ready" as const,
      steps: [step({ preview: idealPreview(ids.ideal) })],
      context: {} as never,
      previewSource: { personalPlanId: `discovery:${ids.intake}`, sourceNeedVersionId: "v1" },
    }),
    loadItems: async () => [],
    loadVerdicts: async () => [],
    loadProductIdentities: async () => new Map(),
    loadSwapProducts: async (): Promise<ScanCatalogPresentationRow[]> => {
      throw new Error("catalog down")
    },
  }
  const degraded = await loadDiscoveryCockpitModel(
    {} as never,
    { intakeId: ids.intake, userId: ids.user },
    { ...deps, loadDecisions: async () => [] },
  )
  assert.equal(degraded.status, "ready")
  if (degraded.status !== "ready") return
  assert.equal(degraded.recommendationBrandsAvailable, false)
  const view = buildDiscoveryCockpitView(degraded)
  assert.equal(view.recommendationBrandsAvailable, false)
  assert.equal(view.steps[0].idealRecommendation?.brand, null)
  assert.equal(view.steps[0].idealRecommendation?.name, "Lab Shampoo Ideal")

  // With a swap decided, the rows are required — the failure still fails the composition.
  await assert.rejects(() =>
    loadDiscoveryCockpitModel(
      {} as never,
      { intakeId: ids.intake, userId: ids.user },
      {
        ...deps,
        loadDecisions: async () => [
          {
            decisionKey: "decision:shampoo:shampoo_everyday:gap",
            decision: "swap" as const,
            swapProductId: ids.alternativeA,
            intakeItemId: null,
          },
        ],
      },
    ),
  )
})

// --- the single composition ----------------------------------------------------

test("the verdict pass runs once, on the very context the Idealplan prepared", async () => {
  const context = { snapshot: { decisions: [] }, snapshotSource: "refined" } as never
  const verdictCalls: Array<{ context: ScanEvaluationContext; items: readonly unknown[] }> = []
  const items = [item()]

  const result = await loadDiscoveryCockpitModel(
    {} as never,
    { intakeId: ids.intake, userId: ids.user },
    {
      loadIdealRoutine: async () => ({
        status: "ready",
        steps: [step()],
        context,
        previewSource: { personalPlanId: `discovery:${ids.intake}`, sourceNeedVersionId: "v1" },
      }),
      loadItems: async () => items,
      loadVerdicts: async (_admin, _userId, passedItems, passedContext) => {
        verdictCalls.push({ context: passedContext, items: passedItems })
        return []
      },
      loadDecisions: async () => [],
      loadSwapProducts: async () => {
        throw new Error("no swap decision and no recommendation, so no catalog read")
      },
    },
  )

  assert.equal(result.status, "ready")
  assert.equal(verdictCalls.length, 1)
  // Identity, not equality: a second `prepareScannerContext` would re-enter the path this
  // feature must not touch.
  assert.equal(verdictCalls[0].context, context)
  assert.equal(verdictCalls[0].items, items)
})

test("an unusable source short-circuits before anything else is read", async () => {
  for (const status of ["no_usable_source", "temporarily_unavailable"] as const) {
    const result = await loadDiscoveryCockpitModel(
      {} as never,
      { intakeId: ids.intake, userId: ids.user },
      {
        loadIdealRoutine: async () => ({ status }),
        loadItems: async () => {
          throw new Error("must not read items")
        },
        loadVerdicts: async () => {
          throw new Error("must not compute verdicts")
        },
        loadDecisions: async () => {
          throw new Error("must not read decisions")
        },
      },
    )
    assert.deepEqual(result, { status })
  }
})

// --- writes --------------------------------------------------------------------

type Recorded = {
  table: string
  op: string
  payload?: Record<string, unknown>
  options?: unknown
  filters: Array<[string, unknown]>
}

function recordingClient(row: unknown) {
  const calls: Recorded[] = []
  const client = {
    from(table: string) {
      const entry: Recorded = { table, op: "select", filters: [] }
      calls.push(entry)
      const builder: Record<string, unknown> = {
        select: () => builder,
        eq: (column: string, value: unknown) => {
          entry.filters.push([column, value])
          return builder
        },
        order: () => builder,
        limit: () => builder,
        update: (payload: Record<string, unknown>) => {
          entry.op = "update"
          entry.payload = payload
          return builder
        },
        upsert: (payload: Record<string, unknown>, options?: unknown) => {
          entry.op = "upsert"
          entry.payload = payload
          entry.options = options
          return builder
        },
        maybeSingle: async () => ({ data: row, error: null }),
      }
      return builder
    },
  }
  return { client: client as never, calls }
}

test("finalize stores the pair and carries the submitted precondition into the UPDATE", async () => {
  const { client, calls } = recordingClient({
    id: ids.intake,
    enrollment_id: "e",
    user_id: ids.user,
    state: "submitted",
    submitted_at: "2026-09-20T10:00:00.000Z",
    call_finalized_at: "2026-09-22T12:00:00.000Z",
    finalized_source_hash: "hash-1",
  })

  const finalized = await finalizeDiscoveryCall(
    { intakeId: ids.intake, sourceHash: "hash-1", now: () => "2026-09-22T12:00:00.000Z" },
    client,
  )

  assert.equal(finalized?.callFinalizedAt, "2026-09-22T12:00:00.000Z")
  assert.equal(finalized?.finalizedSourceHash, "hash-1")
  assert.equal(calls.length, 1)
  assert.equal(calls[0].table, "discovery_intakes")
  assert.equal(calls[0].op, "update")
  assert.deepEqual(calls[0].payload, {
    call_finalized_at: "2026-09-22T12:00:00.000Z",
    finalized_source_hash: "hash-1",
  })
  assert.deepEqual(calls[0].filters, [
    ["id", ids.intake],
    ["state", "submitted"],
  ])
})

test("a draft intake finalizes nothing", async () => {
  const { client } = recordingClient(null)
  assert.equal(
    await finalizeDiscoveryCall({ intakeId: ids.intake, sourceHash: "hash-1" }, client),
    null,
  )
})

test("un-finalize clears both columns", async () => {
  const { client, calls } = recordingClient({
    id: ids.intake,
    enrollment_id: "e",
    user_id: ids.user,
    state: "submitted",
    submitted_at: "2026-09-20T10:00:00.000Z",
    call_finalized_at: null,
    finalized_source_hash: null,
  })
  const cleared = await unfinalizeDiscoveryCall(ids.intake, client)
  assert.equal(cleared?.callFinalizedAt, null)
  assert.equal(cleared?.finalizedSourceHash, null)
  assert.deepEqual(calls[0].payload, { call_finalized_at: null, finalized_source_hash: null })
  assert.deepEqual(calls[0].filters, [["id", ids.intake]])
})

test("a keep never stores a swap target, and the upsert keys on the decision key", async () => {
  const { client, calls } = recordingClient({
    decision_key: "decision:shampoo:shampoo_everyday:gap",
    decision: "keep",
    swap_product_id: null,
    intake_item_id: ids.item,
  })
  const stored = await upsertDiscoveryCallDecision(
    {
      intakeId: ids.intake,
      decisionKey: "decision:shampoo:shampoo_everyday:gap",
      decision: "keep",
      // A stale client could still send one; the write drops it.
      swapProductId: ids.alternativeA,
      intakeItemId: ids.item,
    },
    client,
  )
  assert.deepEqual(stored, {
    decisionKey: "decision:shampoo:shampoo_everyday:gap",
    decision: "keep",
    swapProductId: null,
    intakeItemId: ids.item,
  })
  assert.equal(calls[0].table, "discovery_call_decisions")
  assert.equal(calls[0].op, "upsert")
  assert.equal((calls[0].payload as { swap_product_id: unknown }).swap_product_id, null)
  assert.deepEqual(calls[0].options, { onConflict: "intake_id,decision_key" })
})

// --- product identities (brand + line + name) ----------------------------------------

const identity = (name: string, brand: string | null, productLine: string | null = null) => ({
  name,
  brand,
  productLine,
})

test("identities are read for every labelled product and option, and a failed read degrades", async () => {
  const reads: string[][] = []
  const deps = {
    loadIdealRoutine: readyIdeal([step({ preview: idealPreview(ids.ideal) }), maskIdealStep]),
    loadItems: async () => [item()],
    loadVerdicts: async () => [],
    loadDecisions: async () => [swapShampoo],
    loadSwapProducts: async () => [
      catalogRow(ids.alternativeA, "Guhl", "Leichte Frische Shampoo"),
      catalogRow(ids.ideal, "Schwarzkopf", "Lab Maske"),
    ],
  }
  const result = await loadDiscoveryCockpitModel(
    {} as never,
    { intakeId: ids.intake, userId: ids.user },
    {
      ...deps,
      loadProductIdentities: async (_client, productIds) => {
        reads.push(productIds)
        return new Map([
          [ids.alternativeA, identity("Leichte Frische Shampoo", "Guhl", "Frische Linie")],
        ])
      },
    },
  )
  assert.equal(result.status, "ready")
  if (result.status !== "ready") return
  // Owned product, swap target and the recommendation(s) — one batched read.
  assert.deepEqual(reads, [[ids.alternativeA, ids.ideal, ids.owned].sort()])
  assert.equal(result.recommendationBrandsAvailable, true)
  assert.equal(
    result.routine.steps[0]!.swapProductLabel,
    "Guhl Frische Linie Leichte Frische Shampoo",
  )

  const degraded = await loadDiscoveryCockpitModel(
    {} as never,
    { intakeId: ids.intake, userId: ids.user },
    {
      ...deps,
      loadProductIdentities: async () => {
        throw new Error("discovery_product_identity_lookup_failed")
      },
    },
  )
  assert.equal(degraded.status, "ready")
  if (degraded.status !== "ready") return
  // Labels fall back to brand + name, and finalize/PDF are blocked like for brands.
  assert.equal(degraded.recommendationBrandsAvailable, false)
  assert.equal(degraded.routine.steps[0]!.swapProductLabel, "Guhl Leichte Frische Shampoo")
})

async function modelWithVerdict(
  verdict: DiscoveryParticipantVerdict,
  identities: Map<string, ReturnType<typeof identity>>,
) {
  const result = await loadDiscoveryCockpitModel(
    {} as never,
    { intakeId: ids.intake, userId: ids.user },
    {
      loadIdealRoutine: readyIdeal([step({ preview: idealPreview(ids.ideal) })]),
      loadItems: async () => [item()],
      loadVerdicts: async () => [verdict],
      loadDecisions: async () => [],
      loadSwapProducts: async () => [],
      loadProductIdentities: async () => identities,
    },
  )
  assert.equal(result.status, "ready")
  if (result.status !== "ready") throw new Error("not ready")
  return result
}

test("a transient verdict failure keeps the printed name and the fingerprint", async () => {
  const catalog = new Map([
    [ids.owned, identity(productHeader.name, productHeader.brand, "Hyaluron Pure")],
  ])
  const computed = await modelWithVerdict(
    {
      itemId: ids.item,
      productId: ids.owned,
      status: "verdict",
      product: productHeader,
      payload: payload([]),
    },
    catalog,
  )
  const flaky = await modelWithVerdict(
    { itemId: ids.item, productId: ids.owned, status: "unavailable" },
    catalog,
  )
  // Named by the catalog identity, as if the verdict had come back.
  assert.equal(flaky.routine.steps[0]!.ownedLabel, "L'Oréal Paris Elvital Hyaluron Pure Shampoo")
  assert.equal(flaky.routine.steps[0]!.ownedLabel, computed.routine.steps[0]!.ownedLabel)
  // Same paper, same fingerprint: an unchanged finalised PDF does not read as drifted.
  assert.equal(flaky.routine.sourceHash, computed.routine.sourceHash)
  assert.equal(flaky.recommendationBrandsAvailable, true)

  // Without a catalog identity the name WOULD fall back to her own words — degraded.
  const unnamed = await modelWithVerdict(
    { itemId: ids.item, productId: ids.owned, status: "unavailable" },
    new Map(),
  )
  assert.equal(unnamed.recommendationBrandsAvailable, false)
})

test("permanent verdict states keep her own words and never degrade", async () => {
  for (const status of [
    "product_unavailable",
    "quarantined",
    "target_mismatch",
    "decision_missing",
  ] as const) {
    const result = await modelWithVerdict(
      { itemId: ids.item, productId: ids.owned, status },
      new Map([[ids.owned, identity(productHeader.name, productHeader.brand)]]),
    )
    assert.equal(result.routine.steps[0]!.ownedLabel, "Elvital Hyaluron Pure", status)
    assert.equal(result.recommendationBrandsAvailable, true, status)
  }
})

test("swap option cards carry the same brand + line + name the PDF would print", () => {
  const identities = new Map([
    [ids.alternativeA, identity("Leichte Frische Shampoo", "Guhl", "Frische Linie")],
    [ids.ideal, identity("Lab Shampoo Ideal", "Schwarzkopf", "Lab")],
  ])
  const alternatives = buildDiscoveryCockpitView({
    ...model({
      steps: [step()],
      items: [item()],
      verdicts: [
        {
          itemId: ids.item,
          productId: ids.owned,
          status: "verdict",
          product: productHeader,
          payload: payload([ids.alternativeA, ids.alternativeB]),
        },
      ],
    }),
    productIdentities: identities,
  })
  assert.deepEqual(
    alternatives.steps[0].swapOptions.map((option) => option.label),
    // B has no catalog identity: the engine's own name and brand.
    ["Guhl Frische Linie Leichte Frische Shampoo", "Guhl Alternative 2"],
  )

  const open = buildDiscoveryCockpitView({
    ...model({ steps: [step({ preview: idealPreview(ids.ideal) })], items: [] }),
    productIdentities: identities,
  })
  assert.deepEqual(
    open.steps[0].swapOptions.map((option) => option.label),
    ["Schwarzkopf Lab Shampoo Ideal"],
  )
})
