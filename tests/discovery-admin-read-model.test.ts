import assert from "node:assert/strict"
import test from "node:test"

import type { SupabaseClient } from "@supabase/supabase-js"

import { loadDiscoveryIdealRoutine } from "../src/lib/discovery/load-ideal-routine"
import { loadParticipantScanVerdicts } from "../src/lib/discovery/load-participant-verdicts"
import type { DiscoveryIntakeItem } from "../src/lib/discovery/refined-routine"
import type { ScanEvaluationContext } from "../src/lib/scan/profile-context"
import type { ScanInCatalogVerdictPayload } from "../src/lib/scan/types"

const userId = "11111111-1111-4111-8111-111111111111"
const intakeId = "22222222-2222-4222-8222-222222222222"
const productId = "33333333-3333-4333-8333-333333333333"
const alternativeId = "44444444-4444-4444-8444-444444444444"

/**
 * A recording fake: every mutating verb the Supabase client exposes throws, so the
 * read-only contract (§4) is asserted by construction rather than by inspection. The
 * ONE accepted write is `rpc("scanner_context_read_source")`, whose idempotent source
 * registration is documented in migration 20260916175239.
 */
function recordingClient(options: {
  rpc?: (name: string, args: unknown) => unknown
  select?: (table: string) => { data: unknown; error: unknown }
}) {
  const rpcCalls: string[] = []
  const tables: string[] = []
  const forbid = (verb: string) => () => {
    throw new Error(`discovery read model must not call ${verb}`)
  }
  const client = {
    rpc: (name: string, args: unknown) => {
      rpcCalls.push(name)
      if (!options.rpc) throw new Error(`unexpected rpc ${name}`)
      return Promise.resolve(options.rpc(name, args))
    },
    from: (table: string) => {
      tables.push(table)
      const result = options.select?.(table) ?? { data: null, error: null }
      const builder: Record<string, unknown> = {
        select: () => builder,
        eq: () => builder,
        in: () => builder,
        order: () => builder,
        maybeSingle: () => Promise.resolve(result),
        single: () => Promise.resolve(result),
        then: (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve),
        insert: forbid("insert"),
        upsert: forbid("upsert"),
        update: forbid("update"),
        delete: forbid("delete"),
      }
      return builder
    },
  }
  return { client: client as unknown as SupabaseClient, rpcCalls, tables }
}

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

const context: ScanEvaluationContext = {
  snapshot: {
    schemaVersion: 1,
    snapshotKind: "initial_need",
    computationVersion: "stage1-v1",
    inputHash: "hash",
    createdAt: "2026-09-22T00:00:00.000Z",
    sourceQuiz: {} as never,
    profile: { hair: { thickness: "normal" } } as never,
    assessments: {} as never,
    decisions: [decision],
    coverage: [],
    productPreviews: [],
    renderedOrder: ["shampoo"],
    deferredFacts: [],
  },
  snapshotSource: "refined",
  refinedVersionId: "refined-1",
  refinedInputHash: "input-hash",
}

const inCatalogVerdict: ScanInCatalogVerdictPayload = {
  kind: "in_catalog",
  verdict: "mismatch",
  verdictLabel: "Passt nicht",
  verdictTitle: "Passt nicht zu deinem Haar",
  status: "danger",
  subtitle: "1 von 3 Zielbereichen getroffen",
  evaluatedRole: null,
  evaluatedRoleLabel: null,
  dimensions: [],
  criteria: [],
  coverage: { matches: 1, total: 3 },
  fitNarrative: null,
  alternatives: [
    {
      productId: alternativeId,
      displayName: "Sanftes Shampoo",
      imageUrl: null,
      priceLabel: null,
      netContentLabel: "250 ml",
      verdict: "ideal",
      verdictLabel: "Passt",
      criteria: [],
    },
  ],
}

function presentationRow(id: string, category = "shampoo") {
  return {
    id,
    name: `Produkt ${id}`,
    brand: "Marke",
    category: category as never,
    imageUrl: null,
    priceEur: 12,
    currency: "EUR",
    affiliateLink: null,
    purchaseLinkStatus: null,
    priceCheckedAt: null,
  }
}

function item(overrides: Partial<DiscoveryIntakeItem> & { id: string }): DiscoveryIntakeItem {
  return {
    category: "shampoo",
    source: "barcode",
    brandText: null,
    productNameText: null,
    barcodeIdentifier: null,
    productId: null,
    productSubmissionId: null,
    createdAt: "2026-09-20T10:00:00.000Z",
    ...overrides,
  }
}

function verdictDeps(overrides: Record<string, unknown> = {}) {
  return {
    loadActiveProductById: async (_client: SupabaseClient, id: string) => ({
      id,
      category: "shampoo" as const,
    }),
    loadQuarantinedProductIdsAmong: async () => new Set<string>(),
    isProductSearchQuarantined: async () => false,
    loadPresentationRows: async (_client: SupabaseClient, ids: string[]) =>
      ids.map((id) => presentationRow(id)),
    loadScanVerdict: async () => inCatalogVerdict,
    ...overrides,
  } as never
}

test("the ideal-routine loader touches exactly the documented source RPC — no publish, no write", async () => {
  const { client, rpcCalls } = recordingClient({
    rpc: (name) => {
      assert.equal(name, "scanner_context_read_source")
      return { data: null, error: new Error("boom") }
    },
  })

  const result = await loadDiscoveryIdealRoutine(client, userId, intakeId)

  assert.equal(result.status, "temporarily_unavailable")
  assert.deepEqual(rpcCalls, ["scanner_context_read_source"])
})

test("a profile without a usable scanner source reports no_usable_source, not an error", async () => {
  const { client } = recordingClient({
    rpc: () => ({
      data: { userId, sourceRevision: "1", profileRevision: "1", profile: null, leads: [] },
      error: null,
    }),
  })

  const result = await loadDiscoveryIdealRoutine(client, userId, intakeId)
  assert.equal(result.status, "no_usable_source")
})

test("participant verdicts: resolved product yields a presented verdict with a header and no savedState", async () => {
  const { client, rpcCalls } = recordingClient({})
  const verdicts = await loadParticipantScanVerdicts(
    client,
    userId,
    [item({ id: "item-1", productId })],
    context,
    verdictDeps(),
  )

  assert.equal(verdicts.length, 1)
  const entry = verdicts[0]!
  assert.equal(entry.status, "verdict")
  if (entry.status !== "verdict") throw new Error("expected a verdict")
  assert.equal(entry.itemId, "item-1")
  assert.equal(entry.product.productId, productId)
  assert.equal(entry.payload.kind, "in_catalog")
  assert.ok(!("savedState" in entry))
  assert.deepEqual(rpcCalls, [])
})

test("participant verdicts: an item with no resolved product is skipped entirely", async () => {
  const { client } = recordingClient({})
  let lookups = 0
  const verdicts = await loadParticipantScanVerdicts(
    client,
    userId,
    [item({ id: "item-open", source: "name_research", productNameText: "Unbekannt" })],
    context,
    verdictDeps({
      loadActiveProductById: async (_c: SupabaseClient, id: string) => {
        lookups += 1
        return { id, category: "shampoo" as const }
      },
    }),
  )

  assert.deepEqual(verdicts, [])
  assert.equal(lookups, 0)
})

test("participant verdicts map the per-item failure modes instead of throwing", async () => {
  const { client } = recordingClient({})
  const items = [
    item({ id: "gone", productId: "00000000-0000-4000-8000-000000000001" }),
    item({ id: "quarantined", productId: "00000000-0000-4000-8000-000000000002" }),
    item({ id: "mismatch", productId: "00000000-0000-4000-8000-000000000003" }),
    item({
      id: "no-decision",
      category: "mask",
      productId: "00000000-0000-4000-8000-000000000004",
    }),
    item({ id: "throws", productId: "00000000-0000-4000-8000-000000000005" }),
  ]

  const verdicts = await loadParticipantScanVerdicts(
    client,
    userId,
    items,
    context,
    verdictDeps({
      loadActiveProductById: async (_c: SupabaseClient, id: string) =>
        id.endsWith("1")
          ? null
          : { id, category: id.endsWith("3") ? "conditioner" : id.endsWith("4") ? "mask" : "shampoo" },
      isProductSearchQuarantined: async (_c: SupabaseClient, id: string) => id.endsWith("2"),
      loadScanVerdict: async () => {
        throw new Error("verdict exploded")
      },
    }),
  )

  assert.deepEqual(
    verdicts.map((entry) => [entry.itemId, entry.status]),
    [
      ["gone", "product_unavailable"],
      ["quarantined", "quarantined"],
      // The catalog says conditioner, the participant filed it under shampoo.
      ["mismatch", "target_mismatch"],
      // No snapshot decision exists for mask at all.
      ["no-decision", "decision_missing"],
      ["throws", "unavailable"],
    ],
  )
})

test("participant verdicts drop quarantined alternatives and batch the catalog read once", async () => {
  const { client } = recordingClient({})
  const presentationCalls: string[][] = []
  const verdicts = await loadParticipantScanVerdicts(
    client,
    userId,
    [
      item({ id: "item-1", productId }),
      item({ id: "item-2", productId: "00000000-0000-4000-8000-00000000000a" }),
    ],
    context,
    verdictDeps({
      loadQuarantinedProductIdsAmong: async () => new Set([alternativeId]),
      loadPresentationRows: async (_c: SupabaseClient, ids: string[]) => {
        presentationCalls.push(ids)
        return ids.map((id) => presentationRow(id))
      },
    }),
  )

  assert.equal(presentationCalls.length, 1, "one batched catalog read for every item")
  assert.deepEqual(presentationCalls[0], [productId, "00000000-0000-4000-8000-00000000000a"])
  for (const entry of verdicts) {
    assert.equal(entry.status, "verdict")
    if (entry.status !== "verdict") throw new Error("expected a verdict")
    assert.equal(entry.payload.kind, "in_catalog")
    if (entry.payload.kind !== "in_catalog") throw new Error("expected in_catalog")
    assert.deepEqual(entry.payload.alternatives, [])
  }
})

test("participant verdicts: a scanned product missing from the catalog read reports unavailable", async () => {
  const { client } = recordingClient({})
  const verdicts = await loadParticipantScanVerdicts(
    client,
    userId,
    [item({ id: "item-1", productId })],
    context,
    verdictDeps({ loadPresentationRows: async () => [] }),
  )

  assert.deepEqual(
    verdicts.map((entry) => [entry.itemId, entry.status]),
    [["item-1", "unavailable"]],
  )
})
