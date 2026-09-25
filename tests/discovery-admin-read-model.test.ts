import assert from "node:assert/strict"
import test from "node:test"

import type { SupabaseClient } from "@supabase/supabase-js"

import { seedMobileProfileFixtures } from "../scripts/mobile/profile-fixture"
import {
  discoveryPreviewInput,
  loadDiscoveryIdealRoutine,
  recomputeDiscoverySnapshot,
} from "../src/lib/discovery/load-ideal-routine"
import { buildDiscoveryRoutineContext } from "../src/lib/discovery/routine-context"
import {
  loadParticipantScanVerdicts,
  DISCOVERY_SCAN_VERDICT_DEPS,
  DISCOVERY_VERDICT_DEPS,
} from "../src/lib/discovery/load-participant-verdicts"
import type { DiscoveryIntakeItem } from "../src/lib/discovery/refined-routine"
import { stage1PreviewedRoleDecisionKeys } from "../src/lib/personal-plan/product-previews"
import {
  loadScanProductFacts,
  loadStage3RecommendationCandidatesByRole,
} from "../src/lib/personal-plan/products/authority/catalog-facts"
import {
  isProductSearchQuarantined,
  loadQuarantinedProductIdsAmong,
} from "../src/lib/scan/catalog-eligibility"
import type { ScanEvaluationContext } from "../src/lib/scan/profile-context"
import { buildScanVerdict } from "../src/lib/scan/resolve-verdict"
import type { ScannerSourceRead } from "../src/lib/scan/scanner-context"
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
const MUTATING_VERBS = new Set(["insert", "upsert", "update", "delete", "rpc"])

function recordingClient(options: {
  rpc?: (name: string, args: unknown) => unknown
  select?: (table: string) => { data: unknown; error: unknown; count?: number }
}) {
  const rpcCalls: string[] = []
  const tables: string[] = []
  const mutations: string[] = []
  const client = {
    rpc: (name: string, args: unknown) => {
      rpcCalls.push(name)
      if (!options.rpc) throw new Error(`unexpected rpc ${name}`)
      return Promise.resolve(options.rpc(name, args))
    },
    from: (table: string) => {
      tables.push(table)
      const result = options.select?.(table) ?? { data: null, error: null, count: 0 }
      // Any chainable filter/ordering verb returns the builder; the builder itself is
      // thenable, so `await q`, `await q.maybeSingle()` and `await q.range(...)` all
      // resolve to `result`. Every mutating verb is recorded AND throws, so a write
      // anywhere on the path fails the test instead of passing unnoticed.
      const builder: unknown = new Proxy(
        {},
        {
          get(_target, property) {
            if (typeof property !== "string") return undefined
            if (property === "then") {
              return (
                resolve: (value: unknown) => unknown,
                reject?: (reason: unknown) => unknown,
              ) => Promise.resolve(result).then(resolve, reject)
            }
            if (MUTATING_VERBS.has(property)) {
              return () => {
                mutations.push(`${table}.${property}`)
                throw new Error(`discovery read model must not call ${property} on ${table}`)
              }
            }
            return () => builder
          },
        },
      )
      return builder
    },
  }
  return { client: client as unknown as SupabaseClient, rpcCalls, tables, mutations }
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

/**
 * A real `ScannerSourceRead`, built by the same seeding helper `scan-profile-context.test.ts`
 * uses — only the RPC boundary is faked. Without it the read-only proof never reaches the
 * branch that actually queries the catalog.
 */
async function usableScannerSource(): Promise<ScannerSourceRead> {
  const rows: Record<string, Record<string, unknown>[]> = {}
  const seedClient = {
    supabaseUrl: "http://127.0.0.1:54321",
    from(table: string) {
      return {
        async insert(data: Record<string, unknown> | Record<string, unknown>[]) {
          ;(rows[table] ??= []).push(...(Array.isArray(data) ? data : [data]))
          return { error: null }
        },
        update(data: Record<string, unknown>) {
          return {
            async eq(_column: string, id: string) {
              Object.assign(rows[table].find((row) => row.id === id)!, data)
              return { error: null }
            },
          }
        },
      }
    },
  }
  await seedMobileProfileFixtures(seedClient as never, {
    free: "free",
    detailed: "owner",
    incomplete: "incomplete",
  })
  return {
    userId: "owner",
    sourceRevision: "3",
    profileRevision: "1",
    profile: rows.hair_profiles[1],
    plan: rows.personal_plans[0],
    initial: rows.personal_plan_need_versions[0],
    refined: rows.personal_plan_need_versions[1],
    refinements: rows.personal_plan_refinement_drafts,
    leads: [],
  } as unknown as ScannerSourceRead
}

/** Catalog reads the Stage-1 preview computation legitimately performs. */
const CATALOG_READ_TABLES = new Set([
  "products",
  "product_relationships",
  "product_application_protocols",
  "application_guidance_protocols",
])

test("the ready path builds steps from the prepared context and still writes nothing", async () => {
  const source = await usableScannerSource()
  let rpcArgs: unknown = null
  const { client, rpcCalls, tables, mutations } = recordingClient({
    rpc: (name, args) => {
      rpcArgs = args
      assert.equal(name, "scanner_context_read_source")
      return { data: source, error: null }
    },
    // Every catalog read comes back empty: the previews degrade to fallbacks, the ideal
    // steps are still built, and the whole composition runs.
    select: () => ({ data: [], error: null, count: 0 }),
  })

  const result = await loadDiscoveryIdealRoutine(client, "owner", intakeId)

  assert.equal(result.status, "ready")
  if (result.status !== "ready") throw new Error("expected a ready routine")

  // The ONE accepted write is the source-registration RPC — nothing else, and no publish.
  assert.deepEqual(rpcCalls, ["scanner_context_read_source"])
  assert.deepEqual(rpcArgs, { p_user_id: "owner" })
  assert.deepEqual(mutations, [], "no insert/upsert/update/delete anywhere on the path")
  assert.ok(tables.length > 0, "the candidate loader must actually have queried")
  const unexpected = [...new Set(tables)].filter((table) => !CATALOG_READ_TABLES.has(table))
  assert.deepEqual(unexpected, [], "only catalog tables may be read")

  // The prepared context is narrowed to ScanEvaluationContext and is what the verdict
  // loader consumes — no second, publishing load.
  assert.deepEqual(Object.keys(result.context).sort(), [
    "refinedInputHash",
    "refinedVersionId",
    "snapshot",
    "snapshotSource",
  ])
  assert.equal(result.context.snapshotSource, "refined")
  assert.equal(result.context.refinedVersionId, source.refined!.id)
  assert.match(result.context.refinedInputHash, /^[a-f0-9]{64}$/)

  // Steps mirror exactly what Stage 1 would preview for this very snapshot.
  assert.ok(result.steps.length > 0, "the seeded profile must produce previewed roles")
  assert.deepEqual(
    new Set(result.steps.map((step) => step.decisionKey)),
    stage1PreviewedRoleDecisionKeys(result.context.snapshot),
  )
  for (const step of result.steps) {
    assert.equal(step.preview?.kind, "fallback", "an empty catalog yields fallback previews")
    assert.ok(step.categoryLabel.length > 0)
    assert.ok(step.frequencyLabel.length > 0)
  }
})

test("discoveryPreviewInput is the intake-scoped plan id and the prepared context's version", () => {
  assert.deepEqual(discoveryPreviewInput(intakeId, { refinedVersionId: "need-version-7" }), {
    personalPlanId: `discovery:${intakeId}`,
    sourceNeedVersionId: "need-version-7",
  })
})

test("the loader's own output echoes the two ids the preview computation actually ran under", async () => {
  const source = await usableScannerSource()
  const { client } = recordingClient({
    rpc: () => ({ data: source, error: null }),
    select: () => ({ data: [], error: null, count: 0 }),
  })

  const result = await loadDiscoveryIdealRoutine(client, "owner", intakeId)
  assert.equal(result.status, "ready")
  if (result.status !== "ready") throw new Error("expected a ready routine")

  // `previewSource` is read back off the preview RESPONSE, which echoes its own inputs
  // verbatim — so changing either argument at the call site fails here. The expectations
  // are literals, not a second call to the code under test.
  assert.deepEqual(result.previewSource, {
    personalPlanId: `discovery:${intakeId}`,
    // The PREPARED context's version — never a published `scanner_context_publish` one.
    sourceNeedVersionId: source.refined!.id,
  })
  assert.deepEqual(result.previewSource, discoveryPreviewInput(intakeId, result.context))
  assert.equal(result.context.refinedVersionId, result.previewSource.sourceNeedVersionId)
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
          : {
              id,
              category: id.endsWith("3") ? "conditioner" : id.endsWith("4") ? "mask" : "shampoo",
            },
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

/**
 * Every verdict test above injects stubs, so `DISCOVERY_VERDICT_DEPS` — the wiring
 * production actually runs — is never executed by them. Pin its members' identity to the
 * same functions `/api/scan/resolve` wires (the `POST` deps literal, `resolve/route.ts:604-607`), so a silent
 * rewire to a different facts loader, candidate loader or verdict builder fails here
 * instead of quietly giving the cockpit a different engine than the participant's scanner.
 */
test("the production verdict wiring is the resolve route's own engine", () => {
  assert.equal(DISCOVERY_SCAN_VERDICT_DEPS.loadScanProductFacts, loadScanProductFacts)
  assert.equal(
    DISCOVERY_SCAN_VERDICT_DEPS.loadRecommendationCandidates,
    loadStage3RecommendationCandidatesByRole,
  )
  assert.equal(DISCOVERY_SCAN_VERDICT_DEPS.buildScanVerdict, buildScanVerdict)
  assert.deepEqual(Object.keys(DISCOVERY_SCAN_VERDICT_DEPS).sort(), [
    "buildScanVerdict",
    "loadRecommendationCandidates",
    "loadScanProductFacts",
  ])

  assert.equal(DISCOVERY_VERDICT_DEPS.isProductSearchQuarantined, isProductSearchQuarantined)
  assert.equal(
    DISCOVERY_VERDICT_DEPS.loadQuarantinedProductIdsAmong,
    loadQuarantinedProductIdsAmong,
  )
  assert.equal(typeof DISCOVERY_VERDICT_DEPS.loadActiveProductById, "function")
  assert.equal(typeof DISCOVERY_VERDICT_DEPS.loadPresentationRows, "function")
  assert.deepEqual(Object.keys(DISCOVERY_VERDICT_DEPS).sort(), [
    "isProductSearchQuarantined",
    "loadActiveProductById",
    "loadPresentationRows",
    "loadQuarantinedProductIdsAmong",
    "loadScanVerdict",
  ])
})

test("the production loaders carry the discovery error codes", async () => {
  const failing = {
    from: () => {
      const builder: Record<string, unknown> = {
        select: () => builder,
        eq: () => builder,
        in: () => Promise.resolve({ data: null, error: new Error("db down") }),
        maybeSingle: () => Promise.resolve({ data: null, error: new Error("db down") }),
      }
      return builder
    },
  } as never

  await assert.rejects(
    () => DISCOVERY_VERDICT_DEPS.loadActiveProductById(failing, productId),
    /discovery_product_lookup_failed/,
  )
  await assert.rejects(
    () => DISCOVERY_VERDICT_DEPS.loadPresentationRows(failing, [productId]),
    /discovery_presentation_lookup_failed/,
  )
})

// --- Batch 7: the routine override (plan §2.3 Rev. 3) ------------------------------------

const straightenerOverride = buildDiscoveryRoutineContext(
  [{ source: "catalog_search", category: "shampoo", usageRole: null, frequency: "weekly_2x" }],
  {
    dryingRoutes: ["air_dry"],
    additionalHeatTools: ["straightener"],
    heatEvents: { "heat:straightener": { frequency: "weekly_2x", protectionConsistency: "no" } },
  },
)

/** The same seeded owner, before any Feinschliff: only the initial need version. */
async function initialOnlyScannerSource(): Promise<ScannerSourceRead> {
  const source = await usableScannerSource()
  return {
    ...source,
    plan: { ...source.plan!, current_refined_need_version_id: null },
    refined: null,
    refinements: [],
  }
}

test("override on the initial path: recomputed with her answers, heat protectant in, still no write", async () => {
  const source = await initialOnlyScannerSource()
  const { client, rpcCalls, tables, mutations } = recordingClient({
    rpc: () => ({ data: source, error: null }),
    select: () => ({ data: [], error: null, count: 0 }),
  })

  const plain = await loadDiscoveryIdealRoutine(client, "owner", intakeId)
  const withAnswers = await loadDiscoveryIdealRoutine(client, "owner", intakeId, {
    routineOverride: straightenerOverride,
  })
  assert.equal(plain.status, "ready")
  assert.equal(withAnswers.status, "ready")
  if (plain.status !== "ready" || withAnswers.status !== "ready") return

  assert.equal(plain.context.snapshotSource, "initial")
  assert.equal(plain.routineSource, "quiz_only")
  assert.equal(plain.heatProtectionDeferred, true)
  assert.ok(!plain.steps.some((entry) => entry.category === "heat_protectant"))

  // Discovery-only origin; the shared contract keeps "initial".
  assert.equal(withAnswers.routineSource, "intake_answers")
  assert.equal(withAnswers.context.snapshotSource, "initial")
  assert.equal(withAnswers.heatProtectionDeferred, false)
  assert.ok(withAnswers.steps.some((entry) => entry.category === "heat_protectant"))
  assert.equal(withAnswers.context.snapshot.profile.source.projection, "initial_quiz")
  // Steps and previews come from the same recomputed snapshot.
  assert.deepEqual(
    new Set(withAnswers.steps.map((entry) => entry.decisionKey)),
    stage1PreviewedRoleDecisionKeys(withAnswers.context.snapshot),
  )

  // Nothing persists: only the documented source RPC, only catalog reads, no mutation.
  assert.deepEqual([...new Set(rpcCalls)], ["scanner_context_read_source"])
  assert.deepEqual(mutations, [])
  assert.deepEqual(
    [...new Set(tables)].filter((table) => !CATALOG_READ_TABLES.has(table)),
    [],
  )
})

test("a refined participant keeps her Feinschliff: the override is ignored", async () => {
  const source = await usableScannerSource()
  const { client } = recordingClient({
    rpc: () => ({ data: source, error: null }),
    select: () => ({ data: [], error: null, count: 0 }),
  })
  const plain = await loadDiscoveryIdealRoutine(client, "owner", intakeId)
  const withAnswers = await loadDiscoveryIdealRoutine(client, "owner", intakeId, {
    routineOverride: straightenerOverride,
  })
  assert.equal(withAnswers.status, "ready")
  if (plain.status !== "ready" || withAnswers.status !== "ready") return
  assert.equal(withAnswers.context.snapshotSource, "refined")
  assert.equal(withAnswers.routineSource, "quiz_only")
  assert.deepEqual(withAnswers.steps, plain.steps)
})

test("a recompute that is not ready falls back to the prepared snapshot, never an error", () => {
  const prepared = {
    snapshot: {
      sourceQuiz: { kind: "nonsense" },
      profile: { source: { artifactId: "a" } },
    } as never,
    snapshotSource: "initial" as const,
  }
  const result = recomputeDiscoverySnapshot(prepared, straightenerOverride)
  assert.equal(result.snapshot, prepared.snapshot)
  assert.equal(result.routineSource, "quiz_only")
  assert.equal(recomputeDiscoverySnapshot(prepared, null).routineSource, "quiz_only")
})
